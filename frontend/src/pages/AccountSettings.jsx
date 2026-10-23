import React, { useState, useEffect } from "react";

import { api } from "../api/client.js";
import { Field } from "../components/Field.jsx";
export function AccountSettings({ notify, onPasswordChanged }) {
  const [currentPassword, setCurrent] = useState(""),
    [password, setPassword] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <section className="panel p-6">
      <h3>Change your password</h3>
      <p className="muted mt-2">
        Changing your password signs out all your sessions.
      </p>
      <form
        className="grid gap-4 mt-5"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            await api("/account/password", {
              method: "POST",
              body: JSON.stringify({ currentPassword, password }),
            });
            notify("Password changed. Sign in with your new password.");
            await onPasswordChanged();
          } catch (e) {
            notify(e.message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <Field label="Current password">
          <input
            type="password"
            required
            value={currentPassword}
            onChange={(e) => setCurrent(e.target.value)}
            autoComplete="current-password"
          />
        </Field>
        <Field label="New password">
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
          {busy ? "Saving…" : "Change password"}
        </button>
      </form>
    </section>
  );
}
