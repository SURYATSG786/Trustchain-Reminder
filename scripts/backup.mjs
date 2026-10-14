import { MongoClient } from "mongodb";
import { open, readFile } from "node:fs/promises";
import { createStore } from "../server/store.mjs";
import { createBackup, decryptPart } from "../server/backups.mjs";
import { audit, hash } from "../server/domain.mjs";
const [command, argument, target] = process.argv.slice(2);
if (command === "restore") {
  if (
    !argument ||
    !target ||
    target === process.env.MONGODB_DATABASE ||
    !/^[a-zA-Z0-9_-]+$/.test(target)
  )
    throw Error(
      "Use restore <archive.ndjson> <NEW_EMPTY_DATABASE>; the live database cannot be overwritten",
    );
  const { createInterface } = await import("node:readline");
  const { createReadStream } = await import("node:fs");
  let header,
    workspace,
    partIndex = 0;
  const documents = [];
  async function* rows() {
    for await (const line of createInterface({
      input: createReadStream(argument),
      crlfDelay: Infinity,
    })) {
      const value = JSON.parse(line);
      if (value.parts) {
        const { parts, ...manifest } = value;
        yield manifest;
        for (const p of parts) yield p;
      } else yield value;
    }
  }
  for await (const row of rows()) {
    if (!header) {
      if (row.format !== "TrustChain encrypted backup" || row.schema !== 1)
        throw Error("Unknown backup format");
      header = row;
      continue;
    }
    const value = decryptPart(row, process.env);
    if (
      value.backupId !== header.manifest._id ||
      value.partIndex !== partIndex ||
      row.index !== partIndex++
    )
      throw Error(
        "Backup parts do not belong to this recovery point or are out of order",
      );
    if (value.type === "workspace") {
      if (workspace) throw Error("Duplicate workspace");
      workspace = value;
    } else if (value.type === "document") documents.push(value);
    else throw Error("Unknown backup part");
  }
  if (
    !workspace ||
    header.manifest.parts !== documents.length + 1 ||
    !audit(workspace.state.chain).valid
  )
    throw Error("Invalid backup chain or missing parts");
  if (
    !workspace.accounts.some(
      (a) => a._id === "owner" && (a.role || "owner") === "owner",
    )
  )
    throw Error("Backup has no workspace owner");
  const refs = new Map(
    workspace.state.chain
      .map((b) => b.event.detail?.claim)
      .filter(Boolean)
      .map((c) => [c.metadata.document_id, c.file_hash]),
  );
  for (const d of documents) {
    if (
      !refs.has(d.id) ||
      hash(Buffer.from(d.data, "base64")) !== refs.get(d.id)
    )
      throw Error("Backup file integrity failed");
    refs.delete(d.id);
  }
  if (refs.size) throw Error("Backup lacks referenced files");
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  try {
    const db = client.db(target);
    if ((await db.listCollections().toArray()).length)
      throw Error("Target database must be completely empty");
    await db
      .collection("workspace")
      .insertOne({ _id: "main", ...workspace.state });
    await db.collection("administrators").insertMany(workspace.accounts);
    if (workspace.settings)
      await db.collection("settings").insertOne(workspace.settings);
    if (documents.length)
      await db.collection("documents").insertMany(
        documents.map((d) => ({
          _id: d.id,
          name: d.name,
          hash: d.hash,
          data: Buffer.from(d.data, "base64"),
        })),
      );
    console.log(
      `Restored ${workspace.state.records.length} records and ${documents.length} files into ${target}. Verify it, then update MONGODB_DATABASE. Sessions were not restored.`,
    );
  } finally {
    await client.close();
  }
} else if (command === "export") {
  if (!argument) throw Error("Use export <output.ndjson> [backup-id]");
  const store = await createStore({
    uri: process.env.MONGODB_URI,
    database: process.env.MONGODB_DATABASE,
  });
  let file;
  try {
    const b = target
      ? await store.getBackup(target)
      : await createBackup(store, process.env, "Backup export");
    if (!b) throw Error("Backup not found");
    file = await open(argument, "wx", 0o600);
    await file.write(
      JSON.stringify({
        format: "TrustChain encrypted backup",
        schema: 1,
        manifest: b,
      }) + "\n",
    );
    for (const p of await store.getBackupParts(b._id))
      await file.write(
        JSON.stringify({ iv: p.iv, tag: p.tag, data: p.data, index: p.index }) +
          "\n",
      );
    console.log(
      `Encrypted backup exported to ${argument}. Store it outside this server and retain both encryption keys separately.`,
    );
  } finally {
    await file?.close();
    await store.close();
  }
} else
  throw Error(
    "Use export <output.ndjson> [backup-id] or restore <archive.ndjson> <NEW_EMPTY_DATABASE>",
  );
