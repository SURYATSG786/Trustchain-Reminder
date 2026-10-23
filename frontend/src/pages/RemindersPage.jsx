import React, { useState, useEffect } from "react";

import { api } from "../api/client.js";
import { Icon } from "../components/Icon.jsx";

import { Status } from "../components/Status.jsx";

import { Empty } from "../components/Empty.jsx";

export function RemindersPage({
  data,
  records,
  expired,
  active,
  filter,
  selected,
  setSelected,
  busy,
  setBusy,
  load,
  notify,
}) {
  return (
    <>
      <div className="notice">
        <Icon name="bell" />
        <div>
          <b>
            {data.emailEnabled
              ? "Email reminders are ready"
              : "Connect your email server and enable delivery in Email settings"}
          </b>
          <p>
            Scanned hourly while the server runs. Due and expired records
            receive at most one successful reminder per UTC day.
          </p>
        </div>
        <button
          className="btn primary compact ml-auto"
          disabled={busy || !data.emailEnabled}
          onClick={async () => {
            setBusy(true);
            try {
              const result = await api("/reminders/send", {
                method: "POST",
              });
              await load();
              notify(
                `${result.sent} sent · ${result.failed} failed · ${result.skipped} already sent today`,
              );
            } catch (e) {
              notify(e.message);
            } finally {
              setBusy(false);
            }
          }}
        >
          Send due reminders
        </button>
      </div>
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h3>Ready for a reminder</h3>
            <p>Records inside their selected reminder window.</p>
          </div>
        </div>
        {records
          .filter((r) => r.daysLeft <= r.reminderDays)
          .map((r) => (
            <div className="reminder-row" key={r.id}>
              <span className="file-icon amber">
                <Icon name="bell" />
              </span>
              <div>
                <button
                  className="text-button font-semibold"
                  onClick={() => setSelected(r)}
                >
                  {r.title}
                </button>
                <small>
                  {r.email} · {r.reminderDays}-day reminder window
                </small>
              </div>
              <Status value={r.status} />
            </div>
          ))}
      </section>
      <section className="panel mt-5">
        <div className="panel-heading">
          <div>
            <h3>Delivery history</h3>
            <p>Actual email delivery attempts appear here.</p>
          </div>
        </div>
        {[...data.notifications].reverse().map((n) => (
          <div className="reminder-row" key={n.id}>
            <div>
              <b>{n.title}</b>
              <small>
                {n.to} · {new Date(n.at).toLocaleString("en-IN")}
              </small>
            </div>
            <span
              className={
                "status " + (n.status === "Sent" ? "active" : "expired")
              }
            >
              {n.status}
            </span>
          </div>
        ))}
        {!data.notifications.length && (
          <Empty
            title="No deliveries yet"
            detail="Completed reminder attempts will be recorded here."
          />
        )}
      </section>
    </>
  );
}
