import React, { useState, useEffect } from "react";

import { api } from "../api/client.js";
import { Icon } from "../components/Icon.jsx";

import { Empty } from "../components/Empty.jsx";

export function AuditTrailPage({ data, records, latest }) {
  return (
    <>
      <div className={"notice " + (!data.audit.valid ? "notice-error" : "")}>
        <Icon name="shield" />
        <div>
          <b>
            {data.audit.valid
              ? "Audit chain integrity verified"
              : "Audit chain integrity failed"}
          </b>
          <p>
            {data.audit.blocks} blocks · SHA-256 · Proof of Work difficulty 3
            {!data.audit.valid ? " · Writes are blocked" : ""}
          </p>
        </div>
        <a className="btn secondary compact ml-auto" href="/api/audit/export">
          <Icon name="download" size={16} />
          Export audit
        </a>
      </div>
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h3>Workspace history</h3>
            <p>Creation, edits, renewals, documents, and reminders.</p>
          </div>
        </div>
        {latest.map((b) => (
          <div className="audit-row" key={b.hash}>
            <span className="audit-index">
              {String(b.index).padStart(3, "0")}
            </span>
            <div>
              <b>{b.event.action}</b>
              <p>
                {records.find((r) => r.id === b.event.recordId)?.title ||
                  b.event.recordId}
              </p>
              <details className="advanced-options compact-details">
                <summary>Technical details</summary>
                <code>{b.hash}</code>
                <small>Nonce: {b.nonce}</small>
              </details>
            </div>
            <span className="muted text-right">
              {new Date(b.event.at).toLocaleString("en-IN")}
              <small>{b.event.actor}</small>
            </span>
          </div>
        ))}
        {!latest.length && (
          <Empty
            title="Your history starts here"
            detail="Create a record to begin your audit trail."
          />
        )}
      </section>
    </>
  );
}
