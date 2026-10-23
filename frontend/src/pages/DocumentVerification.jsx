import React, { useState, useEffect } from "react";

import { api } from "../api/client.js";
import { Icon } from "../components/Icon.jsx";
import { Empty } from "../components/Empty.jsx";
import { Field } from "../components/Field.jsx";
export function DocumentVerification({ records, claims, onChange, notify }) {
  const [file, setFile] = useState(null),
    [issuer, setIssuer] = useState(""),
    [assetType, setAssetType] = useState("OTHER"),
    [recordId, setRecordId] = useState(""),
    [result, setResult] = useState(null),
    [digest, setDigest] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function verify(value) {
    setBusy(true);
    setError("");
    try {
      const r = await api("/v1/claims/" + value.trim() + "/verify");
      setResult(r);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="notice">
        <Icon name="shield" />
        <div>
          <b>Register or check a document</b>
          <p>
            Register an original file, or select a file to check whether it
            matches your stored document.
          </p>
        </div>
      </div>
      <div className="overview-grid">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h3>Register a document</h3>
              <p>
                Store your original file and create a verifiable provenance
                record.
              </p>
            </div>
          </div>
          <form
            className="px-5 pb-6"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError("");
              try {
                if (!file) throw Error("Choose a file");
                if (file.size > 2 * 1024 * 1024)
                  throw Error("Choose a file under 2 MB");
                const form = new FormData();
                form.set("file", file);
                form.set("issuer", issuer);
                form.set("asset_type", assetType);
                if (recordId) form.set("record_id", recordId);
                const r = await api("/v1/claims/upload", {
                  method: "POST",
                  body: form,
                });
                setResult({
                  found: true,
                  message: r.message,
                  provenance: r.provenance,
                });
                setDigest(r.file_hash);
                await onChange();
                notify(
                  "File registered with a SHA-256 fingerprint and provenance report",
                );
              } catch (e) {
                setError(e.message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <Field label="File (up to 2 MB)">
              <input
                type="file"
                required
                onChange={(e) => setFile(e.target.files[0] || null)}
              />
            </Field>
            <div className="form-grid mt-4">
              <Field label="Issuer / provider">
                <input
                  required
                  maxLength={180}
                  value={issuer}
                  onChange={(e) => setIssuer(e.target.value)}
                />
              </Field>
              <Field label="Asset type">
                <select
                  value={assetType}
                  onChange={(e) => setAssetType(e.target.value)}
                >
                  {[
                    "CERTIFICATE",
                    "IDENTITY",
                    "CONTRACT",
                    "RESUME",
                    "RESEARCH_PAPER",
                    "FINANCIAL_REPORT",
                    "IMAGE",
                    "VIDEO",
                    "OTHER",
                  ].map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              </Field>
              <Field label="Link to renewal record (PDF only)" wide>
                <select
                  value={recordId}
                  onChange={(e) => {
                    setRecordId(e.target.value);
                    const r = records.find((r) => r.id === e.target.value);
                    if (r) setIssuer(r.issuer);
                  }}
                >
                  <option value="">Standalone document</option>
                  {records.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.title}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <button disabled={busy} className="btn primary mt-5">
              <Icon name="upload" size={16} />
              {busy ? "Working…" : "Register document"}
            </button>
          </form>
        </section>
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h3>Verify a document</h3>
              <p>Choose a file to calculate its SHA-256 fingerprint.</p>
            </div>
          </div>
          <div className="px-5 pb-6">
            <label>
              File to verify
              <input
                type="file"
                onChange={async (e) => {
                  const f = e.target.files[0];
                  if (!f) return;
                  if (f.size > 100 * 1024 * 1024) {
                    setError("Choose a file under 100 MB");
                    return;
                  }
                  const h = await crypto.subtle.digest(
                    "SHA-256",
                    await f.arrayBuffer(),
                  );
                  const value = Array.from(new Uint8Array(h))
                    .map((x) => x.toString(16).padStart(2, "0"))
                    .join("");
                  setDigest(value);
                  await verify(value);
                }}
              />
            </label>
            <details className="advanced-options">
              <summary>Verify using a fingerprint</summary>
              <form
                className="mt-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  verify(digest);
                }}
              >
                <Field label="Or enter a SHA-256 fingerprint">
                  <input
                    required
                    minLength={64}
                    maxLength={64}
                    pattern="[a-fA-F0-9]{64}"
                    value={digest}
                    onChange={(e) => setDigest(e.target.value)}
                    className="font-mono text-xs"
                  />
                </Field>
                <button className="btn secondary mt-5" disabled={busy}>
                  <Icon name="shield" size={16} />
                  Verify fingerprint
                </button>
              </form>
            </details>
          </div>
        </section>
      </div>
      {error && (
        <div className="notice notice-error" role="alert">
          {error}
        </div>
      )}
      {result && (
        <section className="panel mb-5">
          <div className="panel-heading">
            <div>
              <h3>{result.message}</h3>
              <p>
                {result.found
                  ? "Registration found on the audit chain"
                  : "The selected file has no matching registration"}
              </p>
            </div>
          </div>
          {result.provenance && (
            <div className="px-5 pb-6">
              <div className="detail-grid">
                {[
                  ["Document", result.provenance.asset.name],
                  ["Issuer", result.provenance.asset.issuer],
                  ["Registered by", result.provenance.asset.submitted_by],
                  ["Integrity score", result.provenance.trust.score + "/100"],
                  ["Block", result.provenance.blockchain.block_index],
                  ["Verdict", result.provenance.trust.verdict],
                ].map(([k, v]) => (
                  <div key={k}>
                    <small>{k}</small>
                    <b>{v}</b>
                  </div>
                ))}
              </div>
              <div className="flex gap-3 flex-wrap mt-5">
                {Object.entries(result.provenance.integrity).map(([k, v]) => (
                  <span
                    key={k}
                    className={"status " + (v ? "active" : "expired")}
                  >
                    {k.replaceAll("_", " ")}: {v ? "Passed" : "Failed"}
                  </span>
                ))}
              </div>
              <code className="block mt-4">
                {result.provenance.asset.file_hash}
              </code>
              <p className="muted text-xs mt-4">{result.provenance.scope}</p>
            </div>
          )}
        </section>
      )}
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h3>Registered documents</h3>
            <p>{claims.length} registered documents</p>
          </div>
        </div>
        {claims.map((c) => (
          <div className="document-row" key={c.claim_id}>
            <span className="file-icon">
              <Icon name="file" />
            </span>
            <div>
              <b>{c.asset_name}</b>
              {c.metadata?.nptel_verification && (
                <small>
                  NPTEL issuer check: {c.metadata.nptel_verification.status}
                </small>
              )}
              <small className="muted text-xs mt-1">
                {c.issuer} · Block {c.block_index}
              </small>
              <code>{c.file_hash}</code>
            </div>
            <button
              className="btn secondary compact"
              disabled={busy}
              onClick={() => {
                setDigest(c.file_hash);
                verify(c.file_hash);
              }}
            >
              Verify
            </button>
            <a
              className="btn secondary compact"
              href={"/api/documents/" + c.metadata.document_id}
            >
              <Icon name="download" size={16} />
              Download
            </a>
          </div>
        ))}
        {!claims.length && (
          <Empty
            title="No files registered"
            detail="Upload your first document to create its provenance record."
          />
        )}
      </section>
    </>
  );
}
