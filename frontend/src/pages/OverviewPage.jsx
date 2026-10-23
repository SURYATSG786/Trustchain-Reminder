import React, { useState, useEffect } from "react";
import { categories } from "../utils/format.js";

import { Icon } from "../components/Icon.jsx";

import { Stat } from "../components/Stat.jsx";
import { Empty } from "../components/Empty.jsx";

export function OverviewPage({
  records,
  expired,
  soon,
  compliance,
  upcoming,
  table,
  go,
  setFilter,
  category,
  setSelected,
  month,
  newRecord,
}) {
  if (!records.length)
    return (
      <div className="workspace-start">
        <section className="start-hero">
          <div className="start-copy">
            <span className="start-symbol">
              <Icon name="file" size={30} />
            </span>
            <h2>Add your first renewal</h2>
            <p>
              Track a contract, license or certificate. Set its expiry date and
              choose when to receive a reminder.
            </p>
            <button
              className="btn primary"
              onClick={newRecord || (() => go("Renewal register"))}
            >
              <Icon name="plus" size={18} /> Add a renewal record
            </button>
          </div>
          <div className="start-illustration" aria-hidden="true">
            <div className="start-sheet">
              <span className="start-sheet-icon">
                <Icon name="shield" size={30} />
              </span>
              <b>Renewal record</b>
              <div />
              <div />
              <span className="start-sheet-status">
                <Icon name="check" size={14} /> Ready to track
              </span>
            </div>
            <span className="start-bubble bubble-calendar">
              <Icon name="calendar" size={25} />
            </span>
            <span className="start-bubble bubble-bell">
              <Icon name="bell" size={25} />
            </span>
          </div>
        </section>
        <div className="start-steps">
          {[
            [
              "file",
              "01",
              "Create a record",
              "Add the title, owner and expiry date.",
            ],
            [
              "shield",
              "02",
              "Attach your documents",
              "Keep supporting PDFs with the record.",
            ],
            [
              "bell",
              "03",
              "Set up reminders",
              "Connect your email to send renewal alerts.",
            ],
          ].map(([icon, n, title, detail]) => (
            <button
              key={n}
              className="start-step"
              onClick={() =>
                n === "03"
                  ? go("Email settings")
                  : n === "02"
                    ? go("Documents")
                    : newRecord
                      ? newRecord()
                      : go("Renewal register")
              }
            >
              <span className="step-icon">
                <Icon name={icon} size={23} />
              </span>
              <span>
                <small>STEP {n}</small>
                <b>{title}</b>
                <p>{detail}</p>
              </span>
              <Icon name="arrow" size={17} />
            </button>
          ))}
        </div>
      </div>
    );
  return (
    <>
      <section className="stats-grid">
        <Stat
          title="Total records"
          value={records.length}
          detail="All registered commitments"
          icon="file"
        />
        <Stat
          title="Due in 30 days"
          value={soon.length}
          detail="Expiring within 30 days"
          icon="clock"
          color="amber"
          onClick={() => {
            go("Renewal register");
            setFilter("Due soon");
          }}
        />
        <Stat
          title="Overdue renewals"
          value={expired.length}
          detail={
            expired.length ? "Past their expiry date" : "No overdue records"
          }
          icon="calendar"
          color="rose"
          onClick={() => {
            go("Renewal register");
            setFilter("Expired");
          }}
        />
        <Stat
          title="Compliance rate"
          value={records.length ? compliance + "%" : "—"}
          detail={
            records.length
              ? "Records within their validity period"
              : "No records to evaluate"
          }
          icon="shield"
          color="green"
        />
      </section>
      {(expired.length > 0 || soon.length > 0) && (
        <section
          className="priority-strip"
          aria-label="Renewals requiring attention"
        >
          <span className="priority-icon">
            <Icon name="clock" size={19} />
          </span>
          <div>
            <b>{expired.length + soon.length} renewals need attention</b>
            <p>
              {expired.length} overdue and {soon.length} expiring within 30
              days.
            </p>
          </div>
          <button
            onClick={() => {
              go("Renewal register");
              setFilter(expired.length ? "Expired" : "Due soon");
            }}
          >
            Review records <Icon name="arrow" size={15} />
          </button>
        </section>
      )}
      <div className="overview-grid">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h3>Upcoming renewals</h3>
              <p>Next expiry dates across your organization.</p>
            </div>
            <button className="text-button" onClick={() => go("Calendar")}>
              View calendar <Icon name="arrow" size={15} />
            </button>
          </div>
          <div className="upcoming-list">
            {upcoming.map((r) => (
              <button
                key={r.id}
                onClick={() => setSelected(r)}
                className="upcoming"
              >
                <span className="date-tile">
                  <small>
                    {new Date(r.expiry).toLocaleDateString("en-IN", {
                      month: "short",
                    })}
                  </small>
                  <b>{Number(r.expiry.slice(-2))}</b>
                </span>
                <span className="upcoming-info">
                  <b>{r.title}</b>
                  <small>
                    {r.category} <span>·</span> {r.owner}
                  </small>
                </span>
                <span
                  className={"days-pill " + (r.daysLeft <= 10 ? "urgent" : "")}
                >
                  {r.daysLeft} days
                </span>
              </button>
            ))}
            {!upcoming.length && (
              <Empty
                title="No upcoming renewals"
                detail="Add a record to track its expiry date here."
              />
            )}
          </div>
        </section>
        <section className="panel compliance-panel">
          <div className="panel-heading">
            <div>
              <h3>Compliance status</h3>
              <p>Current and expired records.</p>
            </div>
            <Icon name="shield" size={18} />
          </div>
          <div
            className="donut"
            style={{
              background: records.length
                ? `conic-gradient(#666666 0 ${compliance}%, #ededed ${compliance}% 100%)`
                : "#eceef4",
            }}
          >
            <div>
              <b>{records.length ? compliance + "%" : "—"}</b>
              <span>{records.length ? "compliant" : "No records"}</span>
            </div>
          </div>
          <div className="health-legend">
            <span>
              <i className="legend-current" />
              Current records <b>{records.length - expired.length}</b>
            </span>
            <span>
              <i className="legend-expired" />
              Expired records <b>{expired.length}</b>
            </span>
          </div>
        </section>
      </div>
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h3>Recent records</h3>
            <p>Contracts, licenses and other tracked records.</p>
          </div>
          <button
            className="text-button"
            onClick={() => go("Renewal register")}
          >
            View all records <Icon name="arrow" size={15} />
          </button>
        </div>
        {table}
      </section>
    </>
  );
}
