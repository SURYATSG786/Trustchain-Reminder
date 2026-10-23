import React, { useState, useEffect } from "react";

import { api } from "../api/client.js";
import { Icon } from "../components/Icon.jsx";
export function BackupSettings({ notify }) {
  const [state, setState] = useState(null),
    [busy, setBusy] = useState(false);
  const refresh = async () => setState(await api("/backups"));
  useEffect(() => {
    refresh().catch((e) => notify(e.message));
  }, []);
  return (
    <>
      <div className="notice">
        <Icon name="shield" />
        <div>
          <b>Encrypted recovery snapshots</b>
          <p>
            Daily scheduled backups retain seven days of workspace data,
            accounts, SMTP configuration and documents. Download a copy and keep
            both encryption keys separately for recovery.
          </p>
        </div>
      </div>
      <section className="panel p-6">
        <h3>Backup status</h3>
        <p className="muted mt-2">
          {state?.configured
            ? "Backup encryption is configured."
            : "Set BACKUP_ENCRYPTION_KEY on the server to enable backups."}
        </p>
        <p className="muted mt-2">
          {state?.independent
            ? "Backups are stored in your separate MongoDB destination."
            : "Snapshots share the application database. Configure a separate backup MongoDB destination or download copies for disaster recovery."}
        </p>
        <button
          className="btn primary mt-5"
          disabled={busy || !state?.configured}
          onClick={async () => {
            setBusy(true);
            try {
              await api("/backups", { method: "POST", body: "{}" });
              await refresh();
              notify("Encrypted backup completed.");
            } catch (e) {
              notify(e.message);
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "Creating backup…" : "Create backup now"}
        </button>
      </section>
      <section className="panel p-6 mt-5">
        <h3>Recovery points</h3>
        {state?.backups.map((b) => (
          <div
            className="flex flex-wrap items-center justify-between gap-4 py-4 border-b"
            key={b._id}
          >
            <div>
              <b>{new Date(b.createdAt).toLocaleString()}</b>
              <p className="muted">
                {b.records} records · {b.documents} documents · expires{" "}
                {new Date(b.expiresAt).toLocaleDateString()}
              </p>
            </div>
            {b.bytes <= 3500000 ? (
              <button
                className="btn secondary"
                onClick={async () => {
                  try {
                    const data = await api(`/backups/${b._id}/download`);
                    const url = URL.createObjectURL(
                      new Blob([JSON.stringify(data)], {
                        type: "application/json",
                      }),
                    );
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `trustchain-${b._id}.backup.json`;
                    a.click();
                    setTimeout(() => URL.revokeObjectURL(url), 1000);
                  } catch (e) {
                    notify(e.message);
                  }
                }}
              >
                Download encrypted backup
              </button>
            ) : (
              <span className="muted">Use backup export CLI: {b._id}</span>
            )}
          </div>
        ))}
        {state && !state.backups.length && (
          <p className="muted mt-4">No recovery points yet.</p>
        )}
      </section>
    </>
  );
}
