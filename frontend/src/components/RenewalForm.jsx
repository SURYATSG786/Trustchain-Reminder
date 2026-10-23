import React, { useState, useEffect } from "react";

import { Icon } from "./Icon.jsx";

import { Field } from "./Field.jsx";
export function RenewalForm({ records, form, renew, setRenew, busy, act }) {
  return (
    <div className="overlay modal-overlay">
      <section
        className="modal small-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Renew record"
      >
        <div className="modal-header">
          <div>
            <span className="eyebrow">THE NEXT CHAPTER</span>
            <h2>Renew your record</h2>
            <p className="muted">{renew.title}</p>
          </div>
          <button
            className="icon-button"
            aria-label="Close renewal"
            onClick={() => setRenew(null)}
          >
            <Icon name="close" />
          </button>
        </div>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (
              await act(
                "/records/" + renew.id + "/renew",
                renew,
                "Renewal completed. History preserved.",
              )
            )
              setRenew(null);
          }}
        >
          <Field label="New expiry date">
            <input
              autoFocus
              type="date"
              required
              value={renew.expiry}
              onChange={(e) => setRenew({ ...renew, expiry: e.target.value })}
            />
          </Field>
          <Field label="Renewal notes">
            <textarea
              rows="3"
              maxLength={2000}
              value={renew.note}
              onChange={(e) => setRenew({ ...renew, note: e.target.value })}
              placeholder="Approval reference, changed terms, or context…"
            />
          </Field>
          <p className="muted text-sm mt-4">
            The previous expiry and document references remain in your renewal
            history.
          </p>
          <div className="modal-footer">
            <button
              className="btn secondary"
              type="button"
              onClick={() => setRenew(null)}
            >
              Cancel
            </button>
            <button className="btn primary" disabled={busy}>
              {busy ? "Renewing…" : "Confirm renewal"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
