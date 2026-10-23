import { randomUUID } from "node:crypto";

import { appendBlock, audit, status, hash } from "../domain.mjs";

import { inspectPdf } from "../services/pdf.service.mjs";

import { makeClaim, report } from "../services/provenance.service.mjs";
export function createDocumentService({
  store,
  env,
  inspection,
  trustedIssuers,
  mutate,
  find,
}) {
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
  return { inspectionInput, registerDocument };
}
