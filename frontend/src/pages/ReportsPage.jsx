import { Empty } from "../components/Empty.jsx";
import React, { useState, useEffect } from "react";
import { categories, departments, money } from "../utils/format.js";
import { api } from "../api/client.js";
import { Icon } from "../components/Icon.jsx";

import { Stat } from "../components/Stat.jsx";

export function ReportsPage({
  records,
  expired,
  soon,
  active,
  filter,
  category,
}) {
  if (!records.length)
    return (
      <section className="panel">
        <Empty
          title="No report data yet"
          detail="Create your first renewal record to see costs and compliance summaries."
        />
      </section>
    );
  return (
    <>
      <section className="stats-grid">
        <Stat
          title="Annual renewal cost"
          value={money(records.reduce((n, r) => n + r.cost, 0))}
          detail="Sum of recorded annual costs"
          icon="chart"
        />
        <Stat
          title="Due within 30 days"
          value={money(soon.reduce((n, r) => n + r.cost, 0))}
          detail="Upcoming annual commitments"
          icon="calendar"
          color="amber"
        />
        <Stat
          title="Current records"
          value={active.length + soon.length}
          detail="Records that have not expired"
          icon="check"
          color="green"
        />
        <Stat
          title="Completed renewals"
          value={records.reduce((n, r) => n + r.history.length, 0)}
          detail="Preserved in renewal history"
          icon="clock"
        />
      </section>
      <div className="overview-grid">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h3>Records by category</h3>
              <p>Number of records in each category.</p>
            </div>
          </div>
          <div className="bar-list">
            {categories
              .filter((c) => records.some((r) => r.category === c))
              .map((c) => {
                const n = records.filter((r) => r.category === c).length;
                return (
                  <div className="bar-item" key={c}>
                    <span>{c}</span>
                    <div>
                      <i
                        style={{
                          width:
                            (records.length ? (n / records.length) * 100 : 0) +
                            "%",
                        }}
                      />
                    </div>
                    <b>{n}</b>
                  </div>
                );
              })}
          </div>
        </section>
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h3>Department overview</h3>
              <p>Renewal costs and status by department.</p>
            </div>
          </div>
          {departments
            .filter((d) => records.some((r) => r.department === d))
            .map((d) => {
              const rows = records.filter((r) => r.department === d);
              return (
                <div className="department-row" key={d}>
                  <div>
                    <b>{d}</b>
                    <small>
                      {rows.length} records ·{" "}
                      {rows.filter((r) => r.status === "Expired").length}{" "}
                      expired
                    </small>
                  </div>
                  <b>{money(rows.reduce((n, r) => n + r.cost, 0))}</b>
                </div>
              );
            })}
        </section>
      </div>
      <div className="notice">
        <Icon name="download" />
        <div>
          <b>Export reports</b>
          <p>
            Export the register for reporting or the full audit chain for
            independent verification.
          </p>
        </div>
        <a className="btn secondary ml-auto" href="/api/export">
          Export CSV
        </a>
        <a className="btn secondary" href="/api/audit/export">
          Export audit
        </a>
      </div>
    </>
  );
}
