import React from "react";
import { Icon } from "./Icon.jsx";
import { Status } from "./Status.jsx";
import { Empty } from "./Empty.jsx";
import { fmt } from "../utils/format.js";
export function RecordTable({ shown, setSelected }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>RECORD / ISSUER</th>
            <th>CATEGORY</th>
            <th>OWNER</th>
            <th>RENEWAL DATE</th>
            <th>STATUS</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {shown.map((r) => (
            <tr key={r.id} onClick={() => setSelected(r)}>
              <td>
                <button
                  className="record-name"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelected(r);
                  }}
                >
                  <span className={"file-icon " + r.category.toLowerCase()}>
                    <Icon name="file" />
                  </span>
                  <span>
                    <b>{r.title}</b>
                    <small>{r.issuer}</small>
                  </span>
                </button>
              </td>
              <td>{r.category}</td>
              <td>
                <div className="owner">
                  <span className="avatar small">
                    {r.owner
                      .split(" ")
                      .map((x) => x[0])
                      .slice(0, 2)
                      .join("")}
                  </span>
                  <span>
                    {r.owner}
                    <small>{r.department}</small>
                  </span>
                </div>
              </td>
              <td>
                <b className="font-medium">{fmt(r.expiry)}</b>
                <small className={r.daysLeft < 0 ? "error" : "muted"}>
                  {r.daysLeft < 0
                    ? `${-r.daysLeft} days overdue`
                    : `In ${r.daysLeft} days`}
                </small>
              </td>
              <td>
                <Status value={r.status} />
              </td>
              <td>
                <Icon name="chevron" size={16} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!shown.length && (
        <Empty
          title="No records found"
          detail="Add your first record or adjust the filters."
        />
      )}
    </div>
  );
}
