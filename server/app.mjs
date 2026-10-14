import express from "express";
import {
  randomUUID,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import { fileURLToPath } from "node:url";
import {
  appendBlock,
  audit,
  validateRecord,
  status,
  daysLeft,
  hash,
} from "./domain.mjs";
import { credential } from "./auth.mjs";
import { analyzePdf, inspectPdf } from "./pdf.mjs";
import { verifyNptel } from "./nptel.mjs";
import { createBackup, backupArchive } from "./backups.mjs";
import { installAuth } from "./auth.mjs";
import { emailService } from "./email.mjs";
import { makeClaim, report } from "./provenance.mjs";
export function createApp(
  store,
  env = process.env,
  inspection = { inspectPdf, verifyNptel },
) {
  const app = express();
  let queue = Promise.resolve();
  const email = emailService(store, env);
  const trustedIssuers = (env.TRUSTED_ISSUERS || "").split("|").filter(Boolean);
  app.disable("x-powered-by");
  if (env.VERCEL || env.TRUST_PROXY === "true") app.set("trust proxy", 1);
  app.use((req, res, next) => {
    if (req.path.startsWith("/api")) res.set("Cache-Control", "no-store");
    res.set({
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "same-origin",
      "Content-Security-Policy":
        "default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; script-src 'self'; connect-src 'self'; frame-ancestors 'none'",
    });
    next();
  });
  app.use(express.json({ limit: "3mb" }));
  app.get("/api/v1/health", async (req, res) => {
    const state = await store.read();
    res.json({
      status: "ok",
      version: "3.0.0",
      database: "MongoDB",
      chain_length: state.chain.length,
    });
  });
  app.get(
    ["/api/cron/daily", "/api/cron/reminders", "/api/cron/backups"],
    async (req, res) => {
      if (
        !env.CRON_SECRET ||
        !req.headers.authorization ||
        hash(req.headers.authorization) !== hash(`Bearer ${env.CRON_SECRET}`)
      )
        return res.status(401).json({ error: "Invalid scheduler credentials" });
      const jobs = {};
      if (req.path !== "/api/cron/backups")
        try {
          jobs.reminders = (await email.enabled())
            ? await sendReminders("Vercel scheduler")
            : { disabled: true };
        } catch (e) {
          jobs.reminders = { error: e.message };
        }
      if (req.path !== "/api/cron/reminders")
        try {
          jobs.backup = env.BACKUP_ENCRYPTION_KEY
            ? await createBackup(store, env)
            : { disabled: true };
        } catch (e) {
          jobs.backup = { error: e.message };
        }
      res
        .status(Object.values(jobs).some((j) => j.error) ? 503 : 200)
        .json(jobs);
    },
  );
  const { ready } = installAuth(app, store, env);
  app.use("/api", async (req, res, next) => {
    if (
      req.method !== "GET" &&
      (req.path.startsWith("/administrators") || req.path === "/settings/email")
    ) {
      if (!audit((await store.read()).chain).valid)
        return res
          .status(409)
          .json({
            error: "Audit chain integrity failure. Writes are blocked.",
          });
    }
    next();
  });
  app.get("/api/administrators", async (req, res) =>
    res.json({ administrators: await store.listAdmins() }),
  );
  app.post("/api/administrators", async (req, res) => {
    if ((await store.listAdmins()).length >= 20)
      throw Error("Maximum 20 administrators per workspace");
    const a = credential(req.body?.email, req.body?.password);
    if (!(await store.addAdmin(a)))
      return res
        .status(409)
        .json({ error: "Administrator email already exists" });
    await mutate((s) =>
      appendBlock(
        s,
        "Administrator added",
        null,
        { email: a.email },
        req.user.email,
      ),
    );
    res.status(201).json({ email: a.email, role: "admin", active: true });
  });
  app.put("/api/administrators/status", async (req, res) => {
    if (typeof req.body?.active !== "boolean")
      throw Error("Specify an active status");
    const email = String(req.body?.email || "")
      .trim()
      .toLowerCase();
    const changed = await store.setAdminActive(email, req.body.active);
    if (!changed.matchedCount)
      return res
        .status(404)
        .json({ error: "Administrator not found or owner cannot be disabled" });
    if (!req.body.active) await store.revokeSessions(email);
    await mutate((s) =>
      appendBlock(
        s,
        "Administrator access changed",
        null,
        { email, active: req.body.active },
        req.user.email,
      ),
    );
    res.json({ ok: true });
  });
  app.get("/api/backups", async (req, res) =>
    res.json({
      configured: !!env.BACKUP_ENCRYPTION_KEY,
      independent: !!store.backupIsIndependent,
      backups: await store.listBackups(),
    }),
  );
  app.post("/api/backups", async (req, res) =>
    res.status(201).json(await createBackup(store, env, req.user.email)),
  );
  app.get("/api/backups/:id/download", async (req, res) => {
    const b = await store.getBackup(req.params.id);
    if (b?.bytes > 3500000)
      throw Object.assign(
        Error(
          "This backup exceeds the web download limit. Use npm run backup:export with this backup ID.",
        ),
        { status: 413 },
      );
    const archive = await backupArchive(store, req.params.id);
    res.set({
      "Cache-Control": "no-store",
      "Content-Disposition": `attachment; filename="trustchain-${req.params.id}.backup.json"`,
    });
    res.json(archive);
  });
  async function inspectionInput(req) {
    let bytes, name;
    if (Buffer.isBuffer(req.body)) {
      const form = await new Request("http://localhost/inspection", {
        method: "POST",
        headers: { "content-type": req.headers["content-type"] },
        body: req.body,
      }).formData();
      const file = form.get("file");
      if (!file || typeof file.arrayBuffer !== "function")
        throw Error("Choose a PDF");
      bytes = Buffer.from(await file.arrayBuffer());
      name = file.name;
    } else if (req.body?.documentId) {
      const state = await store.read();
      if (!audit(state.chain).valid)
        throw Object.assign(Error("Audit integrity failed"), { status: 409 });
      const claim = state.chain
        .map((b) => b.event.detail?.claim)
        .filter(Boolean)
        .find((c) => c.metadata.document_id === req.body.documentId);
      if (!claim)
        throw Object.assign(Error("Document not found"), { status: 404 });
      const file = await store.getFile(req.body.documentId);
      if (!file || hash(file.data) !== claim.file_hash)
        throw Object.assign(Error("Document integrity failed"), {
          status: 409,
        });
      bytes = file.data;
      name = file.name;
    } else throw Error("Upload a PDF or choose a registered document");
    if (
      bytes.length > 2 * 1024 * 1024 ||
      bytes.subarray(0, 5).toString() !== "%PDF-"
    )
      throw Error("Choose a PDF up to 2 MB");
    return { bytes, name };
  }
  app.post(
    "/api/v1/forensics/analyze",
    express.raw({ type: "multipart/form-data", limit: "3mb" }),
    async (req, res) => {
      const { bytes, name } = await inspectionInput(req);
      res.json(await analyzePdf(bytes, name));
    },
  );
  app.post(
    "/api/v1/verify/nptel-certificate",
    express.raw({ type: "multipart/form-data", limit: "3mb" }),
    async (req, res) => {
      const { bytes } = await inspectionInput(req);
      res.json(await verifyNptel(bytes));
    },
  );
  app.get("/api/settings/email", async (req, res) =>
    res.json(await email.publicSettings()),
  );
  app.put("/api/settings/email", async (req, res) => {
    const settings = await email.save(req.body);
    await mutate((s) =>
      appendBlock(
        s,
        "Email settings updated",
        null,
        { host: settings.host, from: settings.from, enabled: settings.enabled },
        req.user.email,
      ),
    );
    res.json(settings);
  });
  async function mutate(fn) {
    const work = queue.then(async () => {
      for (let retry = 0; retry < 5; retry++) {
        const state = await store.read(),
          revision = state.revision;
        if (!audit(state.chain).valid)
          throw Object.assign(
            Error("Audit chain integrity failure. Writes are blocked."),
            { status: 409 },
          );
        const result = await fn(state);
        state.revision++;
        if (await store.save(state, revision)) return result;
      }
      throw Object.assign(Error("Workspace changed. Please try again."), {
        status: 409,
      });
    });
    queue = work.catch(() => {});
    return work;
  }
  function find(state, id) {
    const r = state.records.find((x) => x.id === id);
    if (!r) throw Object.assign(Error("Record not found"), { status: 404 });
    return r;
  }
  app.get("/api/workspace", async (req, res) => {
    const s = await store.read();
    res.json({
      ...s,
      records: s.records.map((r) => ({
        ...r,
        status: status(r),
        daysLeft: daysLeft(r.expiry),
      })),
      audit: audit(s.chain),
      smtpConfigured: await email.configured(),
      emailEnabled: await email.enabled(),
    });
  });
  app.post("/api/records", async (req, res) => {
    const fields = validateRecord(req.body);
    const record = await mutate((state) => {
      if (state.records.length >= 1000)
        throw Error("Workspace record limit reached");
      const r = {
        ...fields,
        id: randomUUID(),
        createdAt: new Date().toISOString(),
        documents: [],
        history: [],
      };
      state.records.push(r);
      appendBlock(state, "Created", r.id, { record: fields }, req.user.email);
      return r;
    });
    res.status(201).json(record);
  });
  app.put("/api/records/:id", async (req, res) => {
    const fields = validateRecord(req.body);
    res.json(
      await mutate((state) => {
        const r = find(state, req.params.id);
        if (fields.expiry !== r.expiry)
          throw Error(
            "Use Renew to change expiry and preserve renewal history",
          );
        const before = { ...r };
        Object.assign(r, fields);
        appendBlock(
          state,
          "Updated",
          r.id,
          { before, after: fields },
          req.user.email,
        );
        return r;
      }),
    );
  });
  app.post("/api/records/:id/renew", async (req, res) => {
    res.json(
      await mutate((state) => {
        const r = find(state, req.params.id);
        const fields = validateRecord({
          ...r,
          issued: r.expiry,
          expiry: req.body.expiry,
        });
        if (fields.expiry <= r.expiry)
          throw Error("New expiry must follow the previous expiry");
        const entry = {
          at: new Date().toISOString(),
          oldExpiry: r.expiry,
          newExpiry: fields.expiry,
          note: String(req.body.note || "").slice(0, 2000),
          actor: req.user.email,
          documents: r.documents.map((d) => d.id),
        };
        r.history.push(entry);
        r.issued = r.expiry;
        r.expiry = fields.expiry;
        appendBlock(state, "Renewed", r.id, entry, req.user.email);
        return r;
      }),
    );
  });
  async function registerDocument({
    data,
    name,
    issuer,
    assetType,
    recordId,
    actor,
  }) {
    if (!Buffer.isBuffer(data) || !data.length || data.length > 2 * 1024 * 1024)
      throw Error("Document must be between 1 byte and 2 MB");
    if (typeof name !== "string" || !name.trim() || name.length > 180)
      throw Error("Invalid filename");
    if (recordId && data.subarray(0, 5).toString() !== "%PDF-")
      throw Error("Please upload a PDF document");
    const before = await store.read();
    if (!audit(before.chain).valid)
      throw Object.assign(
        Error("Audit chain integrity failure. Writes are blocked."),
        { status: 409 },
      );
    if (
      before.chain.some((b) => b.event.detail?.claim?.file_hash === hash(data))
    )
      throw Object.assign(
        Error("This file is already registered. Use Verify document."),
        { status: 409 },
      );
    const recordBefore = recordId ? find(before, recordId) : null;
    let nptelResult = null;
    if (data.subarray(0, 5).toString() === "%PDF-") {
      let parsed;
      try {
        parsed = await inspection.inspectPdf(data, {
          render: true,
          maxPages: 1,
        });
      } catch (e) {
        if (/nptel/i.test(issuer || recordBefore?.issuer || ""))
          nptelResult = {
            status: "UNVERIFIABLE",
            reason: "Could not inspect the NPTEL certificate PDF",
            verified: null,
          };
      }
      if (
        (parsed?.qr && /nptel\.ac\.in/i.test(parsed.qr)) ||
        (parsed && /nptel/i.test(issuer || recordBefore?.issuer || ""))
      )
        nptelResult = await inspection.verifyNptel(data, {
          inspect: async (b, options) =>
            hash(b) === hash(data) ? parsed : inspectPdf(b, options),
        });
      if (nptelResult?.status === "FAKE")
        throw Object.assign(
          Error(
            "NPTEL certificate registration rejected: " + nptelResult.reason,
          ),
          { status: 422 },
        );
    }
    const id = randomUUID(),
      fileHash = hash(data),
      metadata = {
        id,
        name: name.replace(/[\r\n]/g, ""),
        size: data.length,
        hash: fileHash,
        uploadedAt: new Date().toISOString(),
      };
    await store.putFile(id, { data, name: metadata.name, hash: fileHash });
    try {
      return await mutate((state) => {
        state.claims ??= [];
        const existing = state.chain.find(
          (b) => b.event.detail?.claim?.file_hash === fileHash,
        );
        if (existing)
          throw Object.assign(
            Error(
              "This file is already registered at block " +
                existing.index +
                ". Use Verify document to inspect it.",
            ),
            { status: 409 },
          );
        const record = recordId ? find(state, recordId) : null;
        if (record && record.documents.length >= 30)
          throw Error("Document limit reached");
        const claim = makeClaim({
          name: metadata.name,
          issuer: issuer || record?.issuer,
          actor,
          fileHash,
          assetType: assetType || "OTHER",
          recordId,
          documentId: id,
          size: data.length,
        });
        if (nptelResult)
          claim.metadata.nptel_verification = {
            status: nptelResult.status,
            reason: nptelResult.reason,
            checked_at: nptelResult.checked_at || new Date().toISOString(),
          };
        metadata.blockIndex = state.chain.length;
        metadata.claimId = claim.claim_id;
        const block = appendBlock(
          state,
          "Document registered",
          recordId,
          { document: metadata, claim },
          actor,
        );
        state.claims.push({ ...claim, block_index: block.index });
        if (record) record.documents.push(metadata);
        return {
          success: true,
          nptel_verification: nptelResult,
          message: "Document registered and mined into the audit chain",
          block_index: block.index,
          file_hash: fileHash,
          claim_id: claim.claim_id,
          document: metadata,
          provenance: report(state, block, trustedIssuers),
        };
      });
    } catch (e) {
      await store.deleteFile(id);
      throw e;
    }
  }
  app.post("/api/records/:id/documents", async (req, res) => {
    const { name, base64 } = req.body || {};
    if (typeof base64 !== "string" || !/^[A-Za-z0-9+/]*={0,2}$/.test(base64))
      throw Error("Invalid document");
    const result = await registerDocument({
      name,
      data: Buffer.from(base64, "base64"),
      recordId: req.params.id,
      actor: req.user.email,
    });
    res.status(201).json(result.document);
  });
  app.post(
    "/api/v1/claims/upload",
    express.raw({ type: "multipart/form-data", limit: "3mb" }),
    async (req, res) => {
      let data, name, fields;
      if (Buffer.isBuffer(req.body)) {
        const form = await new Request("http://localhost/upload", {
          method: "POST",
          headers: { "content-type": req.headers["content-type"] },
          body: req.body,
        }).formData();
        const file = form.get("file");
        if (!file || typeof file.arrayBuffer !== "function")
          throw Error("Choose a file to register");
        data = Buffer.from(await file.arrayBuffer());
        name = form.get("asset_name") || file.name;
        fields = Object.fromEntries(form);
      } else {
        fields = req.body || {};
        if (typeof fields.base64 !== "string")
          throw Error("Upload multipart/form-data with a file");
        data = Buffer.from(fields.base64, "base64");
        name = fields.asset_name || fields.name;
      }
      res.status(201).json(
        await registerDocument({
          data,
          name,
          issuer: fields.issuer,
          assetType: String(fields.asset_type || "OTHER").toUpperCase(),
          recordId: fields.record_id || null,
          actor: req.user.email,
        }),
      );
    },
  );
  app.get("/api/v1/claims/:fileHash/verify", async (req, res) => {
    const fileHash = req.params.fileHash.toLowerCase();
    if (!/^[a-f0-9]{64}$/.test(fileHash))
      throw Error("Enter a 64-character SHA-256 digest");
    const state = await store.read(),
      block = state.chain.find(
        (b) => b.event.detail?.claim?.file_hash === fileHash,
      );
    if (!block)
      return res.json({
        found: false,
        message: "No registration matches this file fingerprint",
        provenance: null,
      });
    const provenance = report(state, block, trustedIssuers),
      file = await store.getFile(block.event.detail.claim.metadata.document_id);
    provenance.integrity.document_valid =
      !!file && hash(file.data) === fileHash;
    if (!provenance.integrity.document_valid) {
      provenance.trust.score = 0;
      provenance.trust.risk_tier = "CRITICAL";
      provenance.trust.verdict = "INTEGRITY CHECK FAILED";
      provenance.trust.flags.push(
        "Stored document bytes are missing or changed",
      );
    }
    res.json({
      found: true,
      message: provenance.integrity.document_valid
        ? "Registered file fingerprint matches stored bytes"
        : "Stored document integrity check failed",
      provenance,
    });
  });
  app.get("/api/v1/claims/:index/report", async (req, res) => {
    const state = await store.read(),
      n = Number(req.params.index);
    if (!Number.isInteger(n) || !state.chain[n])
      return res.status(404).json({ error: "Block not found" });
    res.json(report(state, state.chain[n], trustedIssuers));
  });
  app.get("/api/v1/chain/audit", async (req, res) => {
    const s = await store.read();
    res.json({
      chain_valid: audit(s.chain).valid,
      total_claims: s.claims.length,
      total_blocks: s.chain.length,
      audit: audit(s.chain),
      claims: s.claims.map((c) =>
        report(s, s.chain[c.block_index], trustedIssuers),
      ),
    });
  });
  app.get("/api/v1/chain/block/:index", async (req, res) => {
    const s = await store.read(),
      n = Number(req.params.index);
    if (!Number.isInteger(n) || !s.chain[n])
      return res.status(404).json({ error: "Block not found" });
    res.json(report(s, s.chain[n], trustedIssuers));
  });
  app.get("/api/v1/chain", async (req, res) => {
    const s = await store.read();
    res.json({
      total_blocks: s.chain.length,
      difficulty: 3,
      blocks: s.chain.map((b) => ({
        index: b.index,
        asset_name: b.event.detail?.claim?.asset_name || b.event.action,
        asset_type: b.event.detail?.claim?.asset_type || "AUDIT_EVENT",
        issuer: b.event.detail?.claim?.issuer || b.event.actor,
        block_hash: b.hash,
        nonce: b.nonce,
        timestamp: b.event.at,
        ...(b.event.detail?.claim
          ? { trust_score: report(s, b, trustedIssuers).trust.score }
          : {}),
      })),
    });
  });
  app.get("/api/documents/:id", async (req, res) => {
    const s = await store.read();
    if (
      !s.records.some((r) => r.documents.some((d) => d.id === req.params.id)) &&
      !s.claims.some((c) => c.metadata.document_id === req.params.id)
    )
      return res.status(404).json({ error: "Document not found" });
    const f = await store.getFile(req.params.id);
    if (!f) return res.status(404).json({ error: "Document not found" });
    const anchor = s.chain.find(
      (b) => b.event.detail?.claim?.metadata?.document_id === req.params.id,
    );
    const expected = anchor?.event.detail.claim.file_hash;
    if (!audit(s.chain).valid || !expected || hash(f.data) !== expected)
      return res.status(409).json({ error: "Document integrity check failed" });
    res.set({
      "Content-Type":
        f.data.subarray(0, 5).toString() === "%PDF-"
          ? "application/pdf"
          : "application/octet-stream",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(f.name)}`,
    });
    res.send(f.data);
  });
  let sending = false;
  async function sendReminders(actor = "Scheduler") {
    if (sending)
      throw Object.assign(Error("Reminder scan is already running"), {
        status: 409,
      });
    if (!(await email.enabled()))
      throw Object.assign(
        Error("Configure email settings and enable reminder delivery first"),
        { status: 503 },
      );
    const lock = store.acquireLock
      ? await store.acquireLock("reminders", 300000)
      : "local";
    if (!lock)
      throw Object.assign(Error("Reminder scan is already running"), {
        status: 409,
      });
    sending = true;
    const result = { sent: 0, failed: 0, skipped: 0, remaining: 0 };
    const started = Date.now();
    try {
      const state = await store.read();
      if (!audit(state.chain).valid)
        throw Object.assign(
          Error("Audit chain integrity failure. Reminder delivery is blocked."),
          { status: 409 },
        );
      const today = new Date().toISOString().slice(0, 10);
      for (const r of state.records) {
        if (daysLeft(r.expiry) > r.reminderDays) continue;
        const key = `${r.id}:${r.expiry}:${today}`;
        if (
          state.notifications.some((n) => n.key === key && n.status === "Sent")
        ) {
          result.skipped++;
          continue;
        }
        if (Date.now() - started > 200000) {
          result.remaining++;
          continue;
        }
        if (store.reserveDelivery && !(await store.reserveDelivery(key))) {
          result.skipped++;
          continue;
        }
        let delivery = "Sent",
          error = "";
        try {
          const info = await email.send({
            to: r.email,
            subject: `TrustChain: ${r.title} · ${status(r)}`,
            text: `${r.title}\nIssuer: ${r.issuer}\nExpiry: ${r.expiry}\nOwner: ${r.owner}\nDays remaining: ${daysLeft(r.expiry)}\nPlease review this renewal in TrustChain.`,
          });
          if (!info.accepted?.length) throw Error("Recipient was not accepted");
          result.sent++;
        } catch (e) {
          delivery = "Failed";
          error =
            "SMTP delivery failed: " +
            String(e.code || e.responseCode || "connection error");
          result.failed++;
        }
        if (store.finishDelivery) {
          await store.finishDelivery(key, delivery);
          if (delivery === "Failed") await store.releaseFailedDelivery(key);
        }
        await mutate((s) => {
          s.notifications.push({
            id: randomUUID(),
            key,
            recordId: r.id,
            title: r.title,
            to: r.email,
            status: delivery,
            error,
            at: new Date().toISOString(),
          });
          s.notifications = s.notifications.slice(-1000);
          appendBlock(
            s,
            "Reminder " + delivery.toLowerCase(),
            r.id,
            { to: r.email, expiry: r.expiry },
            actor,
          );
        });
      }
      return result;
    } finally {
      sending = false;
      if (store.releaseLock) await store.releaseLock("reminders", lock);
    }
  }
  app.post("/api/reminders/send", async (req, res) =>
    res.json(await sendReminders(req.user.email)),
  );
  app.get("/api/export", async (req, res) => {
    const s = await store.read();
    const cell = (v) =>
      '"' +
      String(v ?? "")
        .replace(/^([=+@\-\t\r])/, "'$1")
        .replaceAll('"', '""') +
      '"';
    const columns = [
      "title",
      "category",
      "department",
      "issuer",
      "owner",
      "email",
      "issued",
      "expiry",
      "cost",
    ];
    const csv = [
      columns.map(cell).join(","),
      ...s.records.map((r) => columns.map((k) => cell(r[k])).join(",")),
    ].join("\r\n");
    res.set({
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="trustchain-records.csv"',
    });
    res.send(csv);
  });
  app.get("/api/audit/export", async (req, res) => {
    const s = await store.read();
    res.set(
      "Content-Disposition",
      'attachment; filename="trustchain-audit.json"',
    );
    res.json({ audit: audit(s.chain), chain: s.chain });
  });
  app.use("/api", (req, res) =>
    res.status(404).json({ error: "API endpoint not found" }),
  );
  app.get("/", (req, res) =>
    res.sendFile(
      fileURLToPath(new URL("../public/index.html", import.meta.url)),
    ),
  );
  app.use(express.static(fileURLToPath(new URL("../public", import.meta.url))));
  app.use((err, req, res, next) => {
    console.error(err.message);
    res.status(err.status || 400).json({
      error:
        err.status === 413
          ? "Upload too large"
          : err.message || "Request failed",
    });
  });
  return { app, sendReminders, ready };
}
