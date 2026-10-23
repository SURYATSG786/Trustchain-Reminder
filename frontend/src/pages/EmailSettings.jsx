import React, { useState, useEffect } from "react";

import { api } from "../api/client.js";
import { Icon } from "../components/Icon.jsx";
import { Field } from "../components/Field.jsx";
export function EmailSettings({ onSaved, notify, readOnly }) {
  const [settings, setSettings] = useState(null),
    [saving, setSaving] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    api("/settings/email")
      .then((c) => setSettings({ ...c, password: "" }))
      .catch((e) => setError(e.message));
  }, []);
  if (!settings)
    return (
      <div className="panel p-6">{error || "Loading email settings…"}</div>
    );
  const change = (key, value) => setSettings((s) => ({ ...s, [key]: value }));
  return (
    <section className="panel max-w-3xl">
      <div className="panel-heading">
        <div>
          <h3>
            {readOnly
              ? "Email configuration (owner managed)"
              : "Connect your email server"}
          </h3>
          <p>Credentials are encrypted before being stored in MongoDB.</p>
        </div>
      </div>
      <fieldset disabled={readOnly}>
        <form
          className="px-5 pb-6"
          onSubmit={async (e) => {
            e.preventDefault();
            setSaving(true);
            setError("");
            try {
              const c = await api("/settings/email", {
                method: "PUT",
                body: JSON.stringify(settings),
              });
              setSettings({ ...c, password: "" });
              await onSaved();
              notify("SMTP connection verified. Email settings saved.");
            } catch (e) {
              setError(e.message);
            } finally {
              setSaving(false);
            }
          }}
        >
          <div className="form-grid">
            <Field label="SMTP host">
              <input
                required
                value={settings.host}
                onChange={(e) => change("host", e.target.value)}
                placeholder="smtp.your-provider.com"
              />
            </Field>
            <Field label="SMTP port">
              <input
                type="number"
                min="1"
                max="65535"
                required
                value={settings.port}
                onChange={(e) => change("port", Number(e.target.value))}
              />
            </Field>
            <Field label="SMTP username">
              <input
                value={settings.username}
                onChange={(e) => change("username", e.target.value)}
                autoComplete="off"
              />
            </Field>
            <Field label="SMTP password / app password">
              <input
                type="password"
                value={settings.password}
                onChange={(e) => change("password", e.target.value)}
                autoComplete="new-password"
                placeholder={
                  settings.hasPassword
                    ? "Saved securely · Leave blank to keep"
                    : "Enter your provider’s SMTP password"
                }
              />
            </Field>
            <Field label="Sender email address" wide>
              <input
                type="email"
                required
                value={settings.from}
                onChange={(e) => change("from", e.target.value)}
              />
            </Field>
          </div>
          <label className="flex items-center gap-3 mt-5">
            <input
              className="w-4 h-4 m-0"
              type="checkbox"
              checked={settings.secure}
              onChange={(e) => change("secure", e.target.checked)}
            />
            Use SSL/TLS from connection start (usually port 465)
          </label>
          <label className="flex items-center gap-3 mt-4">
            <input
              className="w-4 h-4 m-0"
              type="checkbox"
              checked={settings.enabled}
              onChange={(e) => change("enabled", e.target.checked)}
            />
            Enable automatic renewal reminder emails
          </label>
          <p className="muted text-xs mt-4 leading-relaxed">
            Port 587 uses STARTTLS. Saving tests the SMTP connection and login
            without sending an email. When delivery is enabled, due records are
            checked hourly and emailed to their responsible owner.
          </p>
          {settings.verifiedAt && (
            <p className="text-leaf text-xs mt-4">
              Last verified:{" "}
              {new Date(settings.verifiedAt).toLocaleString("en-IN")}
            </p>
          )}
          {error && (
            <p role="alert" className="error text-sm mt-4">
              {error}
            </p>
          )}
          <div className="modal-footer">
            <button disabled={saving} className="btn primary">
              {saving
                ? "Checking SMTP connection…"
                : "Save & verify connection"}
              <Icon name="check" size={16} />
            </button>
          </div>
        </form>
      </fieldset>
    </section>
  );
}
