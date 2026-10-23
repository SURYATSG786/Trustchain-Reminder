import React, { useState, useEffect } from "react";
import { categories, departments } from "../utils/format.js";

import { Icon } from "./Icon.jsx";

import { Field } from "./Field.jsx";
export function RecordForm({ records, category, form, setForm, busy, act }) {
  return (
    <div className="overlay modal-overlay">
      <section
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={form.id ? "Edit record" : "Add record"}
      >
        <div className="modal-header">
          <div>
            <span className="eyebrow">BUILD A CLEARER PICTURE</span>
            <h2>{form.id ? "Edit record" : "Add a renewal record"}</h2>
            <p className="muted">A few details now. Fewer surprises later.</p>
          </div>
          <button
            aria-label="Close form"
            className="icon-button"
            onClick={() => setForm(null)}
          >
            <Icon name="close" />
          </button>
        </div>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (
              await act(
                "/records" + (form.id ? "/" + form.id : ""),
                form,
                form.id ? "Record updated" : "Record added",
                form.id ? "PUT" : "POST",
              )
            )
              setForm(null);
          }}
        >
          <div className="form-grid">
            <Field label="Record title" wide>
              <input
                autoFocus
                required
                maxLength={120}
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="e.g. Professional indemnity insurance"
              />
            </Field>
            {[
              ["category", "Category", categories],
              ["department", "Department", departments],
            ].map(([k, l, options]) => (
              <Field label={l} key={k}>
                <select
                  value={form[k]}
                  onChange={(e) => setForm({ ...form, [k]: e.target.value })}
                >
                  {options.map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              </Field>
            ))}
            {[
              ["issuer", "Issuer / provider", "text"],
              ["owner", "Responsible owner", "text"],
              ["email", "Reminder email", "email"],
              ["cost", "Annual cost (INR)", "number"],
              ["issued", "Issue date", "date"],
              ["expiry", "Expiry date", "date"],
            ].map(([k, l, type]) => (
              <Field label={l} key={k}>
                <input
                  required
                  type={type}
                  disabled={k === "expiry" && !!form.id}
                  min={type === "number" ? 0 : undefined}
                  maxLength={k === "email" ? 180 : 120}
                  step={type === "number" ? "0.01" : undefined}
                  value={form[k]}
                  onChange={(e) => setForm({ ...form, [k]: e.target.value })}
                />
              </Field>
            ))}
            <Field label="Remind before expiry">
              <select
                value={form.reminderDays}
                onChange={(e) =>
                  setForm({ ...form, reminderDays: Number(e.target.value) })
                }
              >
                {[7, 15, 30, 60, 90].map((n) => (
                  <option key={n} value={n}>
                    {n} days
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Notes" wide>
              <textarea
                rows="3"
                maxLength={2000}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Anything your team should know…"
              />
            </Field>
          </div>
          {form.id && (
            <p className="muted text-xs">
              Use Renew record to change the expiry date and preserve its
              history.
            </p>
          )}
          <div className="modal-footer">
            <button
              type="button"
              className="btn secondary"
              onClick={() => setForm(null)}
            >
              Cancel
            </button>
            <button disabled={busy} className="btn primary">
              {busy ? "Saving…" : form.id ? "Save changes" : "Create record"}
              <Icon name="arrow" size={16} />
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
