import React from "react";
import { Icon } from "../Icon.jsx";
import { api } from "../../api/client.js";

export function Sidebar({
  session,
  nav,
  page,
  go,
  soon,
  expired,
  setSession,
  setData,
}) {
  const groups = [
    [
      "Workspace",
      [
        "Overview",
        "Renewal register",
        "Calendar",
        "Documents",
        "Reminders",
        "Reports",
      ],
    ],
    [
      "Verification",
      ["Document verification", "Certificate inspection", "Audit trail"],
    ],
    [
      "Settings",
      ["Email settings", "Administrators", "Backups", "Account settings"],
    ],
  ];
  return (
    <aside className="sidebar">
      <nav aria-label="Main navigation">
        {groups.map(([label, names]) => (
          <NavGroup key={label} label={label} active={names.includes(page)}>
            {names.map((name) => {
              const item = nav.find(([p]) => p === name);
              if (!item) return null;
              const [p, icon] = item;
              return (
                <button
                  key={p}
                  className={page === p ? "active" : ""}
                  aria-current={page === p ? "page" : undefined}
                  onClick={() => go(p)}
                >
                  <Icon name={icon} size={18} />
                  <span>{p === "Overview" ? "Dashboard" : p}</span>
                  {p === "Reminders" && soon.length + expired.length > 0 && (
                    <span className="nav-count">
                      {soon.length + expired.length}
                    </span>
                  )}
                </button>
              );
            })}
          </NavGroup>
        ))}
      </nav>
      <div className="sidebar-bottom">
        <button
          className="user"
          aria-label="Sign out"
          title="Sign out"
          onClick={async () => {
            await api("/logout", { method: "POST" });
            setSession(await api("/session"));
            setData(null);
          }}
        >
          <span className="avatar">
            {(session.email || "TC").slice(0, 2).toUpperCase()}
          </span>
          <span>
            {session.role === "owner" ? "Owner" : "Administrator"}
            <small>Sign out</small>
          </span>
          <Icon name="logout" size={17} />
        </button>
      </div>
    </aside>
  );
}

function NavGroup({ label, active, children }) {
  if (label === "Workspace")
    return (
      <div className="nav-group">
        <div className="nav-label">Navigation</div>
        {children}
      </div>
    );
  return (
    <details className="nav-group nav-disclosure" open={active}>
      <summary>
        {label}
        <Icon name="chevron" size={14} />
      </summary>
      <div className="nav-disclosure-body">{children}</div>
    </details>
  );
}
