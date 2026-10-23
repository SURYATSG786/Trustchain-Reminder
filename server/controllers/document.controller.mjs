import { audit, hash } from "../domain.mjs";

import { report } from "../services/provenance.service.mjs";
export function createDocumentController({
  store,
  email,
  trustedIssuers,
  find,
  registerDocument,
}) {
  return {
    uploadSupportingDocument: async (req, res) => {
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
    },
    registerDocumentClaim: async (req, res) => {
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
    verifyFingerprint: async (req, res) => {
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
        file = await store.getFile(
          block.event.detail.claim.metadata.document_id,
        );
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
    },
    getClaimReport: async (req, res) => {
      const state = await store.read(),
        n = Number(req.params.index);
      if (!Number.isInteger(n) || !state.chain[n])
        return res.status(404).json({ error: "Block not found" });
      res.json(report(state, state.chain[n], trustedIssuers));
    },
    downloadDocument: async (req, res) => {
      const s = await store.read();
      if (
        !s.records.some((r) =>
          r.documents.some((d) => d.id === req.params.id),
        ) &&
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
        return res
          .status(409)
          .json({ error: "Document integrity check failed" });
      res.set({
        "Content-Type":
          f.data.subarray(0, 5).toString() === "%PDF-"
            ? "application/pdf"
            : "application/octet-stream",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(f.name)}`,
      });
      res.send(f.data);
    },
  };
}
