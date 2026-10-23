import React, { useState, useEffect } from "react";

import { api } from "../api/client.js";
import { Icon } from "../components/Icon.jsx";
import { Field } from "../components/Field.jsx";
export function CertificateInspection({ claims }) {
  const [file, setFile] = useState(null),
    [documentId, setDocumentId] = useState(""),
    [busy, setBusy] = useState(""),
    [result, setResult] = useState(null),
    [error, setError] = useState("");
  async function inspect(kind) {
    setBusy(kind);
    setError("");
    setResult(null);
    try {
      let body;
      if (file) {
        body = new FormData();
        body.set("file", file);
      } else if (documentId) body = JSON.stringify({ documentId });
      else throw Error("Choose a PDF or a registered document");
      const r = await api(
        kind === "NPTEL"
          ? "/v1/verify/nptel-certificate"
          : "/v1/forensics/analyze",
        { method: "POST", body },
      );
      setResult({ kind, ...r });
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy("");
    }
  }
  return (
    <>
      <div className="notice">
        <Icon name="shield" />
        <div>
          <b>Certificate checks</b>
          <p>
            Choose a certificate to check its NPTEL issuer record or inspect the
            PDF. These checks serve different purposes.
          </p>
        </div>
      </div>
      <section className="panel p-6">
        <h3>Choose a certificate</h3>
        <div className="grid gap-4 mt-5 md:grid-cols-2">
          <Field label="PDF to inspect (up to 2 MB)">
            <input
              type="file"
              accept="application/pdf"
              onChange={(e) => {
                setFile(e.target.files[0] || null);
                setDocumentId("");
              }}
            />
          </Field>
          <Field label="Or select a registered PDF">
            <select
              value={documentId}
              onChange={(e) => {
                setDocumentId(e.target.value);
                setFile(null);
              }}
            >
              <option value="">Select document</option>
              {claims
                .filter((c) => /\.pdf$/i.test(c.asset_name))
                .map((c) => (
                  <option key={c.claim_id} value={c.metadata.document_id}>
                    {c.asset_name} · {c.issuer}
                  </option>
                ))}
            </select>
          </Field>
        </div>
        <div className="flex flex-wrap gap-3 mt-5">
          <button
            className="btn primary"
            disabled={!!busy}
            onClick={() => inspect("NPTEL")}
          >
            {busy === "NPTEL"
              ? "Checking official record…"
              : "Verify with NPTEL"}
          </button>
          <button
            className="btn secondary"
            disabled={!!busy}
            onClick={() => inspect("PDF")}
          >
            {busy === "PDF" ? "Inspecting PDF…" : "Analyze PDF"}
          </button>
        </div>
        {error && (
          <p className="error mt-4" role="alert">
            {error}
          </p>
        )}
      </section>
      {result && (
        <section className="panel p-6 mt-5" aria-live="polite">
          <h3>
            {result.kind === "NPTEL"
              ? result.status
              : `PDF indicators: ${result.risk_level}`}
          </h3>
          <p className="muted mt-3">{result.reason || result.scope}</p>
          {result.kind === "NPTEL" ? (
            <>
              <div className="grid gap-4 mt-5 md:grid-cols-2">
                {Object.entries(result.checks || {}).map(([k, v]) => (
                  <div key={k}>
                    <b>{k.replaceAll("_", " ")}</b>
                    <p>{v ? "Matched" : "Did not match"}</p>
                  </div>
                ))}
              </div>
              {result.mismatches?.length > 0 && (
                <ul className="list-disc pl-5 mt-4">
                  {result.mismatches.map((m) => (
                    <li key={m.field}>
                      {m.field.replaceAll("_", " ")}: uploaded{" "}
                      {m.uploaded || "missing"}; official{" "}
                      {m.official || "missing"}
                    </li>
                  ))}
                </ul>
              )}
              {result.official_fields && (
                <div className="grid gap-4 mt-5 md:grid-cols-2">
                  {Object.entries(result.official_fields).map(([k, v]) => (
                    <div key={k}>
                      <small className="muted">{k.replaceAll("_", " ")}</small>
                      <p>{v || "Unavailable"}</p>
                    </div>
                  ))}
                </div>
              )}
              {result.qr_url && (
                <p className="muted mt-4 break-all">
                  Official QR: {result.qr_url}
                </p>
              )}
            </>
          ) : (
            <>
              <div className="grid gap-4 mt-5 md:grid-cols-2">
                {[
                  "page_count",
                  "file_size_bytes",
                  "author",
                  "creator",
                  "producer",
                  "creation_date",
                  "modification_date",
                  "sha256",
                ].map((k) => (
                  <div className="break-all" key={k}>
                    <small className="muted">{k.replaceAll("_", " ")}</small>
                    <p>{result[k] ?? "Unavailable"}</p>
                  </div>
                ))}
              </div>
              <ul className="list-disc pl-5 mt-4">
                {result.tamper_indicators.map((i) => (
                  <li key={i}>{i}</li>
                ))}
              </ul>
            </>
          )}
        </section>
      )}
    </>
  );
}
