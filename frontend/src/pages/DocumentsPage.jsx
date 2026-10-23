import React, { useState, useEffect } from "react";

import { api } from "../api/client.js";
import { Icon } from "../components/Icon.jsx";

import { Empty } from "../components/Empty.jsx";

export function DocumentsPage({ records, setSelected }) {
  return (
    <>
      <div className="notice">
        <Icon name="shield" />
        <div>
          <b>Stored documents</b>
          <p>
            Upload PDFs from a renewal record. Each download checks that the
            file matches its registered fingerprint.
          </p>
        </div>
      </div>
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h3>Your documents</h3>
            <p>
              {records.reduce((n, r) => n + r.documents.length, 0)} documents
              stored
            </p>
          </div>
        </div>
        {records.flatMap((r) =>
          r.documents.map((d) => (
            <div className="document-row" key={d.id}>
              <span className="file-icon">
                <Icon name="file" />
              </span>
              <div>
                <b>{d.name}</b>
                <button className="text-button" onClick={() => setSelected(r)}>
                  {r.title}
                </button>
                <code>{d.hash.slice(0, 20)}…</code>
              </div>
              <span className="muted">{(d.size / 1024).toFixed(1)} KB</span>
              <a
                className="btn secondary compact"
                href={"/api/documents/" + d.id}
              >
                <Icon name="download" size={16} />
                Download
              </a>
            </div>
          )),
        )}
        {!records.some((r) => r.documents.length) && (
          <Empty
            title="A home for your evidence"
            detail="Open a record and upload its supporting PDF to begin."
          />
        )}
      </section>
    </>
  );
}
