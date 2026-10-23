import React, { useState, useEffect } from "react";
import { fmt, money } from "../utils/format.js";
import { api } from "../api/client.js";
import { Icon } from "./Icon.jsx";

import { Status } from "./Status.jsx";

export function RecordDetails({
  category,
  selected,
  setSelected,
  setForm,
  setRenew,
  busy,
  setBusy,
  load,
  notify,
}) {
  return (
    <div className="overlay" onClick={() => setSelected(null)}>
      <aside
        className="detail"
        role="dialog"
        aria-modal="true"
        aria-label="Record details"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="detail-top">
          <span className="eyebrow">RECORD DETAILS</span>
          <button
            className="icon-button"
            aria-label="Close details"
            onClick={() => setSelected(null)}
          >
            <Icon name="close" />
          </button>
        </div>
        <div className="detail-title">
          <span className="file-icon">
            <Icon name="file" size={26} />
          </span>
          <h2>{selected.title}</h2>
          <p>{selected.issuer}</p>
          <Status value={selected.status} />
        </div>
        <div className="detail-actions">
          <button
            className="btn primary"
            onClick={() =>
              setRenew({
                id: selected.id,
                title: selected.title,
                expiry: "",
                note: "",
              })
            }
          >
            <Icon name="clock" size={16} />
            Renew record
          </button>
          <button
            className="btn secondary"
            onClick={() => {
              setForm({ ...selected });
              setSelected(null);
            }}
          >
            Edit details
          </button>
        </div>
        <div className="detail-grid">
          {[
            ["Category", selected.category],
            ["Department", selected.department],
            ["Owner", selected.owner],
            ["Reminder email", selected.email],
            ["Issued", fmt(selected.issued)],
            ["Expiry", fmt(selected.expiry)],
            ["Annual cost", money(selected.cost)],
            ["Reminder window", selected.reminderDays + " days"],
          ].map(([k, v]) => (
            <div key={k}>
              <small>{k}</small>
              <b>{v}</b>
            </div>
          ))}
        </div>
        {selected.notes && (
          <div className="detail-section">
            <h3>Notes</h3>
            <p>{selected.notes}</p>
          </div>
        )}
        <div className="detail-section">
          <div className="flex items-center justify-between">
            <h3>Supporting documents</h3>
            <label
              className={
                "btn secondary compact upload-button " +
                (busy ? "opacity-50" : "")
              }
            >
              <Icon name="upload" size={15} />
              Upload PDF
              <input
                type="file"
                accept="application/pdf"
                disabled={busy}
                onChange={async (e) => {
                  const f = e.target.files[0];
                  if (!f) return;
                  if (f.size > 2 * 1024 * 1024) {
                    notify("Choose a PDF under 2 MB");
                    return;
                  }
                  const upload = new FormData();
                  upload.set("file", f);
                  upload.set("asset_name", f.name);
                  upload.set("issuer", selected.issuer);
                  upload.set(
                    "asset_type",
                    selected.category === "Certification"
                      ? "CERTIFICATE"
                      : selected.category === "Contract"
                        ? "CONTRACT"
                        : "OTHER",
                  );
                  upload.set("record_id", selected.id);
                  setBusy(true);
                  try {
                    await api("/v1/claims/upload", {
                      method: "POST",
                      body: upload,
                    });
                    await load();
                    notify("Document registered, stored and fingerprinted");
                  } catch (error) {
                    notify(error.message);
                  } finally {
                    setBusy(false);
                  }
                  e.target.value = "";
                }}
              />
            </label>
          </div>
          <p className="muted text-xs">
            PDF only · Up to 2 MB · SHA-256 integrity check
          </p>
          {selected.documents.map((d) => (
            <div className="detail-document" key={d.id}>
              <Icon name="file" size={18} />
              <div>
                <b>{d.name}</b>
                <code>{d.hash.slice(0, 24)}…</code>
              </div>
              <button
                aria-label={"Verify " + d.name}
                className="text-button"
                onClick={async () => {
                  try {
                    const result = await api(
                      "/v1/claims/" + d.hash + "/verify",
                    );
                    notify(result.message);
                  } catch (error) {
                    notify(error.message);
                  }
                }}
              >
                <Icon name="shield" size={18} />
              </button>
              <a
                aria-label={"Download " + d.name}
                href={"/api/documents/" + d.id}
              >
                <Icon name="download" size={18} />
              </a>
            </div>
          ))}
          {!selected.documents.length && (
            <p className="muted text-sm mt-4">No supporting documents yet.</p>
          )}
        </div>
        <div className="detail-section">
          <h3>Renewal history</h3>
          {[...selected.history].reverse().map((h, i) => (
            <div className="history-entry" key={i}>
              <Icon name="check" size={16} />
              <div>
                <b>
                  {fmt(h.oldExpiry)} → {fmt(h.newExpiry)}
                </b>
                <p>{h.note || "Renewal completed"}</p>
                <small>
                  {new Date(h.at).toLocaleString("en-IN")} · {h.actor}
                </small>
              </div>
            </div>
          ))}
          {!selected.history.length && (
            <p className="muted text-sm">
              Your first renewal will appear here.
            </p>
          )}
        </div>
      </aside>
    </div>
  );
}
