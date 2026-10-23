import React, { useState, useEffect } from "react";
import { categories } from "../utils/format.js";
import { api } from "../api/client.js";
import { Icon } from "../components/Icon.jsx";

export function RenewalRegisterPage({
  records,
  soon,
  shown,
  table,
  query,
  setQuery,
  filter,
  setFilter,
  category,
  setCategory,
  selected,
}) {
  return (
    <section className="panel">
      <div className="register-toolbar">
        <div className="tabs">
          {["All records", "Active", "Due soon", "Expired"].map((f) => (
            <button
              key={f}
              className={filter === f ? "selected" : ""}
              onClick={() => setFilter(f)}
            >
              {f}
              <span>
                {f === "All records"
                  ? records.length
                  : records.filter((r) => r.status === f).length}
              </span>
            </button>
          ))}
        </div>
        <a className="btn secondary compact" href="/api/export">
          <Icon name="download" size={16} />
          Export CSV
        </a>
      </div>
      <div className="filters">
        <label className="search">
          <Icon name="search" size={18} />
          <input
            aria-label="Search records"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search records, issuers, or owners…"
          />
        </label>
        <select
          aria-label="Filter by category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          {["All categories", ...categories].map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <span>{shown.length} records</span>
      </div>
      {table}
    </section>
  );
}
