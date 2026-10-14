import {
  randomBytes,
  randomUUID,
  createCipheriv,
  createDecipheriv,
} from "node:crypto";
import { gzipSync, gunzipSync } from "node:zlib";
import { audit, hash } from "./domain.mjs";
function key(env) {
  if (!/^[a-f\d]{64}$/i.test(env.BACKUP_ENCRYPTION_KEY || ""))
    throw Object.assign(
      Error(
        "Set BACKUP_ENCRYPTION_KEY to a separate 64-character hex key before creating backups",
      ),
      { status: 503 },
    );
  return Buffer.from(env.BACKUP_ENCRYPTION_KEY, "hex");
}
export function encryptPart(value, env) {
  const iv = randomBytes(12),
    c = createCipheriv("aes-256-gcm", key(env), iv);
  const data = Buffer.concat([
    c.update(gzipSync(Buffer.from(JSON.stringify(value)))),
    c.final(),
  ]);
  return {
    iv: iv.toString("base64"),
    tag: c.getAuthTag().toString("base64"),
    data: data.toString("base64"),
  };
}
export function decryptPart(part, env) {
  const c = createDecipheriv(
    "aes-256-gcm",
    key(env),
    Buffer.from(part.iv, "base64"),
  );
  c.setAuthTag(Buffer.from(part.tag, "base64"));
  return JSON.parse(
    gunzipSync(
      Buffer.concat([c.update(Buffer.from(part.data, "base64")), c.final()]),
      { maxOutputLength: 20 * 1024 * 1024 },
    ).toString(),
  );
}
export async function createBackup(store, env, actor = "Scheduler") {
  key(env);
  const lock = await store.acquireLock("backup", 300000);
  if (!lock)
    throw Object.assign(Error("Backup is already running"), { status: 409 });
  try {
    const state = await store.read();
    if (!audit(state.chain).valid)
      throw Object.assign(Error("Audit integrity failed; backup aborted"), {
        status: 409,
      });
    const id = randomUUID(),
      createdAt = new Date(),
      expiresAt = new Date(Date.now() + 7 * 86400000);
    let index = 0,
      bytes = 0;
    const write = async (value) => {
      const envelope = encryptPart(
        { ...value, backupId: id, partIndex: index },
        env,
      );
      bytes += JSON.stringify(envelope).length;
      await store.saveBackupPart({
        _id: `${id}:${index}`,
        backupId: id,
        index: index++,
        expiresAt,
        ...envelope,
      });
    };
    await write({
      type: "workspace",
      schema: 1,
      state,
      accounts: await store.exportAccounts(),
      settings: await store.getSettings(),
    });
    const references = new Map(
      state.chain
        .map((b) => b.event.detail?.claim)
        .filter(Boolean)
        .map((c) => [c.metadata.document_id, c.file_hash]),
    );
    for await (const file of store.allFiles()) {
      if (!references.has(file._id)) continue;
      const data = Buffer.from(file.data.buffer || file.data);
      if (hash(data) !== references.get(file._id))
        throw Error("Stored document does not match chain fingerprint");
      await write({
        type: "document",
        id: file._id,
        name: file.name,
        hash: file.hash,
        data: data.toString("base64"),
      });
      references.delete(file._id);
    }
    if (references.size)
      throw Error("Referenced document is missing; backup aborted");
    const after = await store.read();
    if (after.revision !== state.revision)
      throw Object.assign(Error("Workspace changed during backup; retry"), {
        status: 409,
      });
    const b = {
      _id: id,
      schema: 1,
      createdAt,
      expiresAt,
      parts: index,
      bytes,
      records: state.records.length,
      documents: index - 1,
      actor,
      status: "Complete",
    };
    await store.finishBackup(b);
    return b;
  } finally {
    await store.releaseLock("backup", lock);
  }
}
export async function backupArchive(store, id) {
  const manifest = await store.getBackup(id);
  if (!manifest)
    throw Object.assign(Error("Backup not found"), { status: 404 });
  const parts = await store.getBackupParts(id);
  if (parts.length !== manifest.parts) throw Error("Backup is incomplete");
  return {
    format: "TrustChain encrypted backup",
    schema: 1,
    manifest,
    parts: parts.map(({ iv, tag, data, index }) => ({ iv, tag, data, index })),
  };
}
