import React, { useState, useEffect, useRef } from "react";
import { Icon } from "../Icon.jsx";
import { Logo } from "../Logo.jsx";
import { api } from "../../api/client.js";

export function TopBar({
  page,
  go,
  session,
  nav,
  soon = [],
  expired = [],
  setSession,
  setData,
}) {
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const menu = useRef(null);
  const primary = [
    ["Overview", "Dashboard"],
    ["Renewal register", "Records"],
    ["Calendar", "Calendar"],
    ["Documents", "Documents"],
    ["Reminders", "Reminders"],
    ["Reports", "Reports"],
  ];
  const groups = [
    [
      "Verification",
      ["Document verification", "Certificate inspection", "Audit trail"],
    ],
    [
      "Settings",
      ["Email settings", "Administrators", "Backups", "Account settings"],
    ],
  ];
  const navigate = (target) => {
    setOpen(false);
    go(target);
  };
  useEffect(() => {
    if (!open) return;
    const outside = (e) => {
      if (!menu.current?.contains(e.target)) setOpen(false);
    };
    const keyboard = (e) => {
      if (e.key === "Escape") {
        setOpen(false);
        menu.current?.querySelector("button")?.focus();
      }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", keyboard);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", keyboard);
    };
  }, [open]);
  return (
    <header className="topbar app-header header-only">
      <button
        type="button"
        className="header-brand"
        aria-label="Go to dashboard"
        onClick={() => navigate("Overview")}
      >
        <Logo />
      </button>
      <nav className="header-navigation" aria-label="Main navigation">
        {primary.map(([target, label]) => (
          <button
            key={target}
            type="button"
            aria-current={page === target ? "page" : undefined}
            className={page === target ? "selected" : ""}
            onClick={() => navigate(target)}
          >
            <Icon name={nav?.find(([p]) => p === target)?.[1] || "file"} size={15} />
            {label}
            {target === "Reminders" && soon.length + expired.length > 0 && (
              <span className="header-count">
                {soon.length + expired.length}
              </span>
            )}
          </button>
        ))}
        <div className="header-more" ref={menu}>
          <button
            type="button"
            className={
              groups.some(([, names]) => names.includes(page)) ? "selected" : ""
            }
            aria-expanded={open}
            aria-controls="header-tools"
            onClick={() => setOpen(!open)}
          >
            More
            <Icon name="chevron" size={13} />
          </button>
          {open && (
            <div className="header-dropdown" id="header-tools">
              {groups.map(([label, names]) => (
                <div className="header-menu-group" key={label}>
                  <h3>{label}</h3>
                  {names.map((name) => {
                    const item = nav?.find(([p]) => p === name);
                    if (!item) return null;
                    return (
                      <button
                        type="button"
                        className={page === name ? "selected" : ""}
                        key={name}
                        onClick={() => navigate(name)}
                      >
                        <Icon name={item[1]} size={16} />
                        {name}
                      </button>
                    );
                  })}
                </div>
              ))}

            </div>
          )}
        </div>
      </nav>
      <button
        type="button"
        aria-label="Open account settings"
        className="header-account"
        onClick={() => navigate("Account settings")}
      >
        <span className="avatar">
          {(session?.email || "TC").slice(0, 2).toUpperCase()}
        </span>
        <span>{session?.role === "owner" ? "Owner" : "Administrator"}</span>
      </button>
      <button
                className="header-logout"
                type="button"
                disabled={signingOut}
                onClick={async () => {
                  setSigningOut(true);
                  try {
                    await api("/logout", { method: "POST" });
                    setSession(await api("/session"));
                    setData(null);
                  } finally {
                    setSigningOut(false);
                    setOpen(false);
                  }
                }}
              >
                <Icon name="logout" size={16} />
                {signingOut ? "Signing out…" : "Sign out"}
              </button>
    </header>
  );
}
