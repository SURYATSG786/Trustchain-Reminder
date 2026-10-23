import React, { useState, useEffect } from "react";

import { api } from "../api/client.js";
import { Field } from "../components/Field.jsx";
export function TeamSettings({ notify }) {
  const [users, setUsers] = useState([]),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [busy, setBusy] = useState(false);
  const refresh = async () =>
    setUsers((await api("/administrators")).administrators);
  useEffect(() => {
    refresh().catch((e) => notify(e.message));
  }, []);
  return (
    <>
      <section className="panel p-6">
        <h3>Workspace administrators</h3>
        <p className="muted mt-2">
          Administrators manage records and inspect documents. The owner manages
          administrator access, email configuration and backups.
        </p>
        <form
          className="grid gap-4 mt-5"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            try {
              await api("/administrators", {
                method: "POST",
                body: JSON.stringify({ email, password }),
              });
              setEmail("");
              setPassword("");
              await refresh();
              notify(
                "Administrator created. Share the temporary password privately; they can change it in Account settings.",
              );
            } catch (e) {
              notify(e.message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <Field label="Administrator email">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="off"
            />
          </Field>
          <Field label="Initial password (at least 12 characters)">
            <input
              type="password"
              required
              minLength="12"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
            />
          </Field>
          <button className="btn primary justify-self-start" disabled={busy}>
            {busy ? "Adding…" : "Add administrator"}
          </button>
        </form>
      </section>
      <section className="panel p-6 mt-5">
        <h3>Current access</h3>
        {users.map((u) => (
          <div
            className="flex items-center justify-between gap-4 py-4 border-b"
            key={u.email}
          >
            <div>
              <b>{u.email}</b>
              <p className="muted">
                {u.role} · {u.active === false ? "Disabled" : "Active"}
              </p>
            </div>
            {u.role === "admin" && (
              <button
                className="btn secondary"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await api("/administrators/status", {
                      method: "PUT",
                      body: JSON.stringify({
                        email: u.email,
                        active: u.active === false,
                      }),
                    });
                    await refresh();
                    notify("Administrator access updated.");
                  } catch (e) {
                    notify(e.message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {u.active === false ? "Enable" : "Disable"}
              </button>
            )}
          </div>
        ))}
      </section>
    </>
  );
}
