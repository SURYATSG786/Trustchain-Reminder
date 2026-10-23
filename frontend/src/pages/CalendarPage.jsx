import React, { useState, useEffect } from "react";

export function CalendarPage({
  records,
  expired,
  filter,
  setSelected,
  month,
  setMonth,
}) {
  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <h3>
            {month.toLocaleDateString("en-IN", {
              month: "long",
              year: "numeric",
            })}
          </h3>
          <p>Click a renewal to view its details.</p>
        </div>
        <div className="calendar-controls flex gap-2">
          <button
            className="btn secondary compact"
            onClick={() =>
              setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))
            }
          >
            Previous
          </button>
          <button
            className="btn secondary compact"
            onClick={() => setMonth(new Date())}
          >
            Today
          </button>
          <button
            className="btn secondary compact"
            onClick={() =>
              setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))
            }
          >
            Next
          </button>
        </div>
      </div>
      <div className="calendar">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div className="calendar-day" key={d}>
            {d}
          </div>
        ))}
        {Array.from(
          {
            length: new Date(month.getFullYear(), month.getMonth(), 1).getDay(),
          },
          (_, i) => (
            <div className="calendar-cell blank" key={"blank" + i} />
          ),
        )}
        {Array.from(
          {
            length: new Date(
              month.getFullYear(),
              month.getMonth() + 1,
              0,
            ).getDate(),
          },
          (_, i) => {
            const date = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}-${String(i + 1).padStart(2, "0")}`;
            return (
              <div
                className={
                  "calendar-cell " +
                  (date === new Date().toISOString().slice(0, 10)
                    ? "is-today"
                    : "")
                }
                key={date}
              >
                <b>{i + 1}</b>
                {records
                  .filter((r) => r.expiry === date)
                  .map((r) => (
                    <button
                      onClick={() => setSelected(r)}
                      key={r.id}
                      className={r.status === "Expired" ? "expired" : ""}
                    >
                      {r.title}
                    </button>
                  ))}
              </div>
            );
          },
        )}
      </div>
    </section>
  );
}
