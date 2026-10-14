import React, { useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
const categories = [
  "Contract",
  "License",
  "Certification",
  "Warranty",
  "Insurance",
  "Subscription",
  "Permit",
];
const departments = [
  "Operations",
  "Finance",
  "IT & Security",
  "Legal",
  "People",
];
const fmt = (d) =>
  new Date(d + "T00:00:00").toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
const money = (n) => "₹" + Number(n).toLocaleString("en-IN");
function Icon({ name, size = 20, ...props }) {
  const paths = {
    grid: "M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z",
    file: "M14 2H5v20h14V7z M14 2v5h5 M8 12h8 M8 16h6",
    calendar: "M4 5h16v16H4z M8 2v6 M16 2v6 M4 10h16",
    shield: "M12 2l8 3v6c0 5-8 11-8 11S4 16 4 11V5z M8 11l3 3 5-6",
    bell: "M18 8a6 6 0 00-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9 M10 21h4",
    arrow: "M5 12h14 M13 6l6 6-6 6",
    plus: "M12 5v14 M5 12h14",
    search: "M21 21l-6-6 M10 3a7 7 0 110 14 7 7 0 010-14",
    download: "M12 3v12 M7 10l5 5 5-5 M4 16v5h16v-5",
    check: "M5 12l4 4L19 6",
    close: "M6 6l12 12 M6 18L18 6",
    chart: "M4 3v18h17 M8 16v-4 M13 16V7 M18 16v-7",
    logout: "M9 4H4v16h5 M10 12h11 M17 8l4 4-4 4",
    clock: "M12 8v4l3 2 M12 3a9 9 0 110 18 9 9 0 010-18",
    link: "M9 15l6-6 M7 14l-2 2a3 3 0 004 4l4-4 M11 8l4-4a3 3 0 014 4l-2 2",
    chevron: "M9 5l7 7-7 7",
    upload: "M12 16V3 M7 8l5-5 5 5 M4 16v5h16v-5",
    info: "M12 11v6 M12 7v1 M12 2a10 10 0 110 20 10 10 0 010-20",
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.65"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d={paths[name] || paths.file} />
    </svg>
  );
}
async function api(path, options = {}) {
  const res = await fetch("/api" + path, {
    ...options,
    headers: {
      ...(options.body instanceof FormData
        ? {}
        : { "Content-Type": "application/json" }),
      ...options.headers,
    },
  });
  const body = await res.json();
  if (!res.ok)
    throw Object.assign(Error(body.error || "Request failed"), {
      status: res.status,
    });
  return body;
}
function App() {
  const [session, setSession] = useState(null),
    [data, setData] = useState(null),
    [page, setPage] = useState("Overview"),
    [query, setQuery] = useState(""),
    [filter, setFilter] = useState("All records"),
    [category, setCategory] = useState("All categories"),
    [selected, setSelected] = useState(null),
    [form, setForm] = useState(null),
    [renew, setRenew] = useState(null),
    [toast, setToast] = useState(""),
    [busy, setBusy] = useState(false),
    [loginError, setLoginError] = useState(""),
    [month, setMonth] = useState(new Date());
  async function load() {
    try {
      const d = await api("/workspace");
      setData(d);
      setSelected((s) =>
        s ? d.records.find((r) => r.id === s.id) || null : null,
      );
    } catch (e) {
      if (e.status === 401) {
        setSession((s) => ({ ...s, authenticated: false }));
        setData(null);
        setSelected(null);
        setForm(null);
        setRenew(null);
        setLoginError("Your session has expired. Please sign in again.");
      } else notify(e.message);
    }
  }
  useEffect(() => {
    api("/session")
      .then((s) => {
        setSession(s);
        if (s.authenticated) load();
      })
      .catch((e) => setLoginError(e.message));
  }, []);
  useEffect(() => {
    if (!session?.authenticated) return;
    const timer = setInterval(load, 60000);
    return () => clearInterval(timer);
  }, [session?.authenticated]);
  useEffect(() => {
    if (!selected && !form && !renew) return;
    const dialogs = document.querySelectorAll('[role="dialog"]');
    const dialog = dialogs[dialogs.length - 1];
    const previous = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusable = () =>
      Array.from(
        dialog?.querySelectorAll("button,a[href],input,select,textarea") || [],
      ).filter((el) => !el.disabled && el.offsetParent !== null);
    if (dialog && !dialog.contains(document.activeElement))
      focusable()[0]?.focus();
    function keyboard(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        if (renew) setRenew(null);
        else if (form) setForm(null);
        else setSelected(null);
      }
      if (event.key === "Tab") {
        const items = focusable(),
          first = items[0],
          last = items.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    }
    document.addEventListener("keydown", keyboard);
    return () => {
      document.removeEventListener("keydown", keyboard);
      document.body.style.overflow = overflow;
      if (previous?.isConnected) previous.focus();
    };
  }, [!!selected, !!form, !!renew]);
  function notify(message) {
    setToast(message);
    setTimeout(() => setToast(""), 4500);
  }
  async function act(path, body, success, method = "POST") {
    setBusy(true);
    try {
      await api(path, { method, body: JSON.stringify(body) });
      await load();
      notify(success);
      return true;
    } catch (e) {
      notify(e.message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function login(event) {
    event.preventDefault();
    setBusy(true);
    setLoginError("");
    const f = new FormData(event.currentTarget);
    try {
      await api(session.setupRequired ? "/setup" : "/login", {
        method: "POST",
        body: JSON.stringify(Object.fromEntries(f)),
      });
      setSession(await api("/session"));
      await load();
    } catch (e) {
      setLoginError(e.message);
    } finally {
      setBusy(false);
    }
  }
  const nav = [
    ["Overview", "grid"],
    ["Renewal register", "file"],
    ["Calendar", "calendar"],
    ["Documents", "shield"],
    ["Audit trail", "link"],
    ["Reminders", "bell"],
    ["Reports", "chart"],
    ["Document verification", "shield"],
    ["Email settings", "bell"],
    ["Certificate inspection", "shield"],
    ...(session?.role === "owner"
      ? [
          ["Administrators", "grid"],
          ["Backups", "download"],
        ]
      : []),
    ["Account settings", "shield"],
  ];
  if (!session || !session.authenticated)
    return (
      <div className="login">
        <div className="login-story">
          <Logo />
          <div>
            <div className="eyebrow text-emerald-200">
              A LITTLE FORESIGHT. A LOT OF PEACE OF MIND.
            </div>
            <h1>
              Every renewal.
              <br />
              One clear picture.
            </h1>
            <p>
              Keep your commitments current, your documents protected, and your
              organization a step ahead.
            </p>
            <div className="login-seal">
              <Icon name="shield" size={36} />
              <span>
                Compliance, confidently.
                <small>Document integrity · Complete renewal history</small>
              </span>
            </div>
          </div>
          <small>TRUSTCHAIN / COMPLIANCE & RENEWAL MANAGEMENT</small>
        </div>
        <div className="login-form">
          <div className="eyebrow">YOUR COMPLIANCE WORKSPACE</div>
          <h2>
            {session?.setupRequired
              ? "Set up your workspace"
              : "Welcome to TrustChain"}
          </h2>
          <p className="muted">A calmer way to stay on top of what matters.</p>
          <form onSubmit={login}>
            {session?.setupRequired && (
              <label>
                Organization name
                <input
                  name="organization"
                  required
                  maxLength={120}
                  placeholder="Your organization"
                />
              </label>
            )}
            <label>
              Email address
              <input
                name="email"
                type="email"
                required
                autoComplete="username"
                placeholder="you@organization.com"
              />
            </label>
            <label>
              Password
              <input
                name="password"
                type="password"
                required
                minLength={session?.setupRequired ? 12 : undefined}
                maxLength={256}
                autoComplete={
                  session?.setupRequired ? "new-password" : "current-password"
                }
              />
            </label>
            {session?.setupRequired && (
              <p className="muted text-xs">
                Choose a password of at least 12 characters. This creates your
                administrator account and an empty workspace in MongoDB.
              </p>
            )}
            {loginError && (
              <p role="alert" className="error">
                {loginError}
              </p>
            )}
            <button disabled={busy || !session} className="btn primary w-full">
              {busy
                ? "Opening workspace…"
                : session?.setupRequired
                  ? "Create workspace"
                  : "Sign in"}
              <Icon name="arrow" />
            </button>
          </form>
          <p className="muted text-xs mt-6">
            {session?.setupRequired
              ? "Your records, documents and renewal history will be stored in MongoDB."
              : "Sign in to your organization’s compliance workspace."}
          </p>
        </div>
      </div>
    );
  if (!data) return <div className="loading">Opening your workspace…</div>;
  const records = data.records;
  const expired = records.filter((r) => r.status === "Expired"),
    soon = records.filter((r) => r.status === "Due soon"),
    active = records.filter((r) => r.status === "Active");
  const compliance = records.length
    ? Math.round(((records.length - expired.length) / records.length) * 100)
    : 0;
  const shown = records
    .filter(
      (r) =>
        (filter === "All records" || r.status === filter) &&
        (category === "All categories" || r.category === category) &&
        [r.title, r.issuer, r.owner, r.department].some((v) =>
          v.toLowerCase().includes(query.toLowerCase()),
        ),
    )
    .sort((a, b) => a.expiry.localeCompare(b.expiry));
  const upcoming = records
    .filter((r) => r.daysLeft >= 0)
    .sort((a, b) => a.daysLeft - b.daysLeft)
    .slice(0, 4);
  const latest = [...data.chain].reverse();
  function go(p) {
    setPage(p);
    setQuery("");
    setFilter("All records");
    setCategory("All categories");
  }
  const newRecord = () =>
    setForm({
      title: "",
      category: "Contract",
      department: "Operations",
      issuer: "",
      owner: "",
      email: "",
      issued: new Date().toISOString().slice(0, 10),
      expiry: "",
      cost: 0,
      reminderDays: 30,
      notes: "",
    });
  const table = (
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
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Logo />
        <div className="workspace">
          <span className="workspace-symbol">T</span>
          <div>
            TrustChain workspace
            <small>{session.organization || "Your organization"}</small>
          </div>
          <span className="text-gray-400">⌄</span>
        </div>
        <div className="nav-label">WORKSPACE</div>
        <nav>
          {nav.map(([p, icon]) => (
            <button
              key={p}
              className={page === p ? "active" : ""}
              onClick={() => go(p)}
            >
              <Icon name={icon} />
              {p}
              {p === "Reminders" && soon.length + expired.length > 0 && (
                <span className="nav-count">
                  {soon.length + expired.length}
                </span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="protected">
            <Icon name="shield" />
            <b>Trust is built in.</b>
            <p>Every change leaves a verifiable trail.</p>
            <span>
              <i />
              SHA-256 + Proof of Work
            </span>
          </div>
          <button
            className="user"
            onClick={async () => {
              await api("/logout", { method: "POST" });
              setSession(await api("/session"));
              setData(null);
            }}
          >
            <span className="avatar">TC</span>
            <span>
              Workspace admin<small>Sign out</small>
            </span>
            <Icon name="logout" size={17} />
          </button>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <span className="breadcrumb">
            Workspace <span>/</span> <b>{page}</b>
          </span>
          <div className="topbar-right">
            <span className="today">
              <Icon name="calendar" size={16} />
              {new Date().toLocaleDateString("en-IN", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </span>
            <button
              aria-label="Open reminders"
              className="bell-button"
              onClick={() => go("Reminders")}
            >
              <Icon name="bell" />
              <i />
            </button>
            <span className="avatar">TC</span>
          </div>
        </header>
        <main>
          <div className="page-heading">
            <div className="eyebrow">
              {page === "Overview"
                ? "YOUR COMPLIANCE, AT A GLANCE"
                : "TRUSTCHAIN WORKSPACE"}
            </div>
            <div className="heading-row">
              <div>
                <h1>
                  {page === "Overview" ? "Stay ahead. Stay assured." : page}
                </h1>
                <p className="muted">
                  {
                    {
                      Overview:
                        "Every commitment in view. Every deadline under control.",
                      "Renewal register":
                        "One place for every contract, license, and commitment.",
                      Calendar:
                        "See what is coming, and give your team time to act.",
                      Documents:
                        "Your evidence, protected and connected to its renewal.",
                      "Audit trail":
                        "A verifiable record of every change in your workspace.",
                      Reminders:
                        "Timely follow-ups, delivered to the people responsible.",
                      Reports:
                        "Turn your renewal records into a clear compliance picture.",
                      "Email settings":
                        "Connect your mail server and manage reminder delivery.",
                      "Document verification":
                        "Register actual files and verify their recorded fingerprint.",
                    }[page]
                  }
                </p>
              </div>
              <button className="btn primary" onClick={newRecord}>
                <Icon name="plus" size={18} />
                Add record
              </button>
            </div>
          </div>
          {page === "Overview" && (
            <>
              <section className="hero">
                <div>
                  <div className="hero-label">
                    <i /> A CLEARER VIEW OF COMPLIANCE
                  </div>
                  <h2>
                    Good governance starts
                    <br />
                    with no surprises.
                  </h2>
                  <p>
                    {soon.length + expired.length
                      ? `${soon.length + expired.length} renewals need your attention. Let's keep things moving.`
                      : records.length
                        ? "All tracked renewals are current. Your next dates are below."
                        : "Your workspace is ready. Add records to start tracking renewals."}
                  </p>
                  <button
                    onClick={() => {
                      go("Renewal register");
                      setFilter(expired.length ? "Expired" : "Due soon");
                    }}
                  >
                    Review priority renewals <Icon name="arrow" size={17} />
                  </button>
                </div>
                <div className="hero-art">
                  <div className="orbit orbit-one" />
                  <div className="orbit orbit-two" />
                  <div className="shield-core">
                    <Icon name="shield" size={70} />
                  </div>
                  <span className="art-tag tag-one">
                    <Icon name="check" size={14} /> Document integrity
                  </span>
                  <span className="art-tag tag-two">
                    <Icon name="clock" size={14} /> Renewal visibility
                  </span>
                  <span className="spark s1">+</span>
                  <span className="spark s2">+</span>
                </div>
              </section>
              <section className="stats-grid">
                <Stat
                  title="Total records"
                  value={records.length}
                  detail="Across all renewal categories"
                  icon="file"
                />
                <Stat
                  title="Due in 30 days"
                  value={soon.length}
                  detail="Time to plan your next steps"
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
                    expired.length
                      ? "Needs your attention"
                      : "Everything is up to date"
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
                  value={compliance + "%"}
                  detail="Records that have not expired"
                  icon="shield"
                  color="green"
                />
              </section>
              <div className="overview-grid">
                <section className="panel">
                  <div className="panel-heading">
                    <div>
                      <h3>Coming up next</h3>
                      <p>Make room for the renewals that matter.</p>
                    </div>
                    <button
                      className="text-button"
                      onClick={() => go("Calendar")}
                    >
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
                          className={
                            "days-pill " + (r.daysLeft <= 10 ? "urgent" : "")
                          }
                        >
                          {r.daysLeft} days
                        </span>
                      </button>
                    ))}
                    {!upcoming.length && (
                      <Empty
                        title="A clear horizon"
                        detail="Upcoming renewals will appear here."
                      />
                    )}
                  </div>
                </section>
                <section className="panel compliance-panel">
                  <div className="panel-heading">
                    <div>
                      <h3>Compliance health</h3>
                      <p>A little clarity goes a long way.</p>
                    </div>
                    <Icon name="shield" size={18} />
                  </div>
                  <div
                    className="donut"
                    style={{
                      background: `conic-gradient(#2d795b 0 ${compliance}%, #f2c9be ${compliance}% 100%)`,
                    }}
                  >
                    <div>
                      <b>{compliance}%</b>
                      <span>up to date</span>
                    </div>
                  </div>
                  <div className="health-legend">
                    <span>
                      <i className="bg-green-700" />
                      Current records <b>{records.length - expired.length}</b>
                    </span>
                    <span>
                      <i className="bg-rose-200" />
                      Expired records <b>{expired.length}</b>
                    </span>
                  </div>
                </section>
              </div>
              <section className="panel">
                <div className="panel-heading">
                  <div>
                    <h3>Your renewal register</h3>
                    <p>Everything important, all together.</p>
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
              <div className="footer-note">
                <Icon name="shield" size={14} />
                Every record has a history. Every document has a fingerprint.
                <span>TrustChain / Built for peace of mind</span>
              </div>
            </>
          )}
          {page === "Renewal register" && (
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
          )}
          {page === "Calendar" && (
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
                      setMonth(
                        new Date(month.getFullYear(), month.getMonth() - 1, 1),
                      )
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
                      setMonth(
                        new Date(month.getFullYear(), month.getMonth() + 1, 1),
                      )
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
                    length: new Date(
                      month.getFullYear(),
                      month.getMonth(),
                      1,
                    ).getDay(),
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
                              className={
                                r.status === "Expired" ? "expired" : ""
                              }
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
          )}
          {page === "Documents" && (
            <>
              <div className="notice">
                <Icon name="shield" />
                <div>
                  <b>Evidence that stays with the record.</b>
                  <p>
                    PDFs are stored with a SHA-256 fingerprint. Downloads check
                    the original fingerprint before returning your file.
                  </p>
                </div>
              </div>
              <section className="panel">
                <div className="panel-heading">
                  <div>
                    <h3>Document vault</h3>
                    <p>
                      {records.reduce((n, r) => n + r.documents.length, 0)}{" "}
                      documents stored
                    </p>
                  </div>
                </div>
                {records.flatMap((r) =>
                  r.documents.map((d) => (
                    <div className="document-row" key={d.id}>
                      <span className="file-icon">
                        <Icon name="file" />
                      </span>
                      <div>
                        <b>{d.name}</b>
                        <button
                          className="text-button"
                          onClick={() => setSelected(r)}
                        >
                          {r.title}
                        </button>
                        <code>{d.hash.slice(0, 20)}…</code>
                      </div>
                      <span className="muted">
                        {(d.size / 1024).toFixed(1)} KB
                      </span>
                      <a
                        className="btn secondary compact"
                        href={"/api/documents/" + d.id}
                      >
                        <Icon name="download" size={16} />
                        Download
                      </a>
                    </div>
                  )),
                )}
                {!records.some((r) => r.documents.length) && (
                  <Empty
                    title="A home for your evidence"
                    detail="Open a record and upload its supporting PDF to begin."
                  />
                )}
              </section>
            </>
          )}
          {page === "Audit trail" && (
            <>
              <div
                className={
                  "notice " + (!data.audit.valid ? "notice-error" : "")
                }
              >
                <Icon name="shield" />
                <div>
                  <b>
                    {data.audit.valid
                      ? "Audit chain integrity verified"
                      : "Audit chain integrity failed"}
                  </b>
                  <p>
                    {data.audit.blocks} blocks · SHA-256 · Proof of Work
                    difficulty 3
                    {!data.audit.valid ? " · Writes are blocked" : ""}
                  </p>
                </div>
                <a
                  className="btn secondary compact ml-auto"
                  href="/api/audit/export"
                >
                  <Icon name="download" size={16} />
                  Export audit
                </a>
              </div>
              <section className="panel">
                <div className="panel-heading">
                  <div>
                    <h3>Workspace history</h3>
                    <p>Creation, edits, renewals, documents, and reminders.</p>
                  </div>
                </div>
                {latest.map((b) => (
                  <div className="audit-row" key={b.hash}>
                    <span className="audit-index">
                      {String(b.index).padStart(3, "0")}
                    </span>
                    <div>
                      <b>{b.event.action}</b>
                      <p>
                        {records.find((r) => r.id === b.event.recordId)
                          ?.title || b.event.recordId}
                      </p>
                      <code>{b.hash}</code>
                    </div>
                    <span className="muted text-right">
                      {new Date(b.event.at).toLocaleString("en-IN")}
                      <small>
                        {b.event.actor} · Nonce {b.nonce}
                      </small>
                    </span>
                  </div>
                ))}
                {!latest.length && (
                  <Empty
                    title="Your history starts here"
                    detail="Create a record to begin your audit trail."
                  />
                )}
              </section>
            </>
          )}
          {page === "Reminders" && (
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
                    Scanned hourly while the server runs. Due and expired
                    records receive at most one successful reminder per UTC day.
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
          )}
          {page === "Certificate inspection" && (
            <CertificateInspection claims={data.claims || []} notify={notify} />
          )}
          {page === "Administrators" && <TeamSettings notify={notify} />}
          {page === "Backups" && <BackupSettings notify={notify} />}
          {page === "Account settings" && (
            <AccountSettings
              notify={notify}
              onPasswordChanged={async () => {
                setSession(await api("/session"));
                setData(null);
              }}
            />
          )}
          {page === "Email settings" && (
            <EmailSettings
              onSaved={load}
              notify={notify}
              readOnly={session.role !== "owner"}
            />
          )}
          {page === "Document verification" && (
            <DocumentVerification
              records={records}
              claims={data.claims || []}
              onChange={load}
              notify={notify}
            />
          )}
          {page === "Reports" && (
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
                      <p>Where your commitments live.</p>
                    </div>
                  </div>
                  <div className="bar-list">
                    {categories.map((c) => {
                      const n = records.filter((r) => r.category === c).length;
                      return (
                        <div className="bar-item" key={c}>
                          <span>{c}</span>
                          <div>
                            <i
                              style={{
                                width:
                                  (records.length
                                    ? (n / records.length) * 100
                                    : 0) + "%",
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
                      <p>Accountability across your organization.</p>
                    </div>
                  </div>
                  {departments.map((d) => {
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
                  <b>Take your records with you.</b>
                  <p>
                    Export the register for reporting or the full audit chain
                    for independent verification.
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
          )}
        </main>
      </div>
      {selected && (
        <div className="overlay" onClick={() => setSelected(null)}>
          <aside
            className="detail"
            role="dialog"
            aria-modal="true"
            aria-label="Record details"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="detail-top">
              <span className="eyebrow">RECORD DETAILS</span>
              <button
                className="icon-button"
                aria-label="Close details"
                onClick={() => setSelected(null)}
              >
                <Icon name="close" />
              </button>
            </div>
            <div className="detail-title">
              <span className="file-icon">
                <Icon name="file" size={26} />
              </span>
              <h2>{selected.title}</h2>
              <p>{selected.issuer}</p>
              <Status value={selected.status} />
            </div>
            <div className="detail-actions">
              <button
                className="btn primary"
                onClick={() =>
                  setRenew({
                    id: selected.id,
                    title: selected.title,
                    expiry: "",
                    note: "",
                  })
                }
              >
                <Icon name="clock" size={16} />
                Renew record
              </button>
              <button
                className="btn secondary"
                onClick={() => {
                  setForm({ ...selected });
                  setSelected(null);
                }}
              >
                Edit details
              </button>
            </div>
            <div className="detail-grid">
              {[
                ["Category", selected.category],
                ["Department", selected.department],
                ["Owner", selected.owner],
                ["Reminder email", selected.email],
                ["Issued", fmt(selected.issued)],
                ["Expiry", fmt(selected.expiry)],
                ["Annual cost", money(selected.cost)],
                ["Reminder window", selected.reminderDays + " days"],
              ].map(([k, v]) => (
                <div key={k}>
                  <small>{k}</small>
                  <b>{v}</b>
                </div>
              ))}
            </div>
            {selected.notes && (
              <div className="detail-section">
                <h3>Notes</h3>
                <p>{selected.notes}</p>
              </div>
            )}
            <div className="detail-section">
              <div className="flex items-center justify-between">
                <h3>Supporting documents</h3>
                <label
                  className={
                    "btn secondary compact upload-button " +
                    (busy ? "opacity-50" : "")
                  }
                >
                  <Icon name="upload" size={15} />
                  Upload PDF
                  <input
                    type="file"
                    accept="application/pdf"
                    disabled={busy}
                    onChange={async (e) => {
                      const f = e.target.files[0];
                      if (!f) return;
                      if (f.size > 2 * 1024 * 1024) {
                        notify("Choose a PDF under 2 MB");
                        return;
                      }
                      const upload = new FormData();
                      upload.set("file", f);
                      upload.set("asset_name", f.name);
                      upload.set("issuer", selected.issuer);
                      upload.set(
                        "asset_type",
                        selected.category === "Certification"
                          ? "CERTIFICATE"
                          : selected.category === "Contract"
                            ? "CONTRACT"
                            : "OTHER",
                      );
                      upload.set("record_id", selected.id);
                      setBusy(true);
                      try {
                        await api("/v1/claims/upload", {
                          method: "POST",
                          body: upload,
                        });
                        await load();
                        notify("Document registered, stored and fingerprinted");
                      } catch (error) {
                        notify(error.message);
                      } finally {
                        setBusy(false);
                      }
                      e.target.value = "";
                    }}
                  />
                </label>
              </div>
              <p className="muted text-xs">
                PDF only · Up to 2 MB · SHA-256 integrity check
              </p>
              {selected.documents.map((d) => (
                <div className="detail-document" key={d.id}>
                  <Icon name="file" size={18} />
                  <div>
                    <b>{d.name}</b>
                    <code>{d.hash.slice(0, 24)}…</code>
                  </div>
                  <button
                    aria-label={"Verify " + d.name}
                    className="text-button"
                    onClick={async () => {
                      try {
                        const result = await api(
                          "/v1/claims/" + d.hash + "/verify",
                        );
                        notify(result.message);
                      } catch (error) {
                        notify(error.message);
                      }
                    }}
                  >
                    <Icon name="shield" size={18} />
                  </button>
                  <a
                    aria-label={"Download " + d.name}
                    href={"/api/documents/" + d.id}
                  >
                    <Icon name="download" size={18} />
                  </a>
                </div>
              ))}
              {!selected.documents.length && (
                <p className="muted text-sm mt-4">
                  No supporting documents yet.
                </p>
              )}
            </div>
            <div className="detail-section">
              <h3>Renewal history</h3>
              {[...selected.history].reverse().map((h, i) => (
                <div className="history-entry" key={i}>
                  <Icon name="check" size={16} />
                  <div>
                    <b>
                      {fmt(h.oldExpiry)} → {fmt(h.newExpiry)}
                    </b>
                    <p>{h.note || "Renewal completed"}</p>
                    <small>
                      {new Date(h.at).toLocaleString("en-IN")} · {h.actor}
                    </small>
                  </div>
                </div>
              ))}
              {!selected.history.length && (
                <p className="muted text-sm">
                  Your first renewal will appear here.
                </p>
              )}
            </div>
          </aside>
        </div>
      )}
      {form && (
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
                <p className="muted">
                  A few details now. Fewer surprises later.
                </p>
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
                    onChange={(e) =>
                      setForm({ ...form, title: e.target.value })
                    }
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
                      onChange={(e) =>
                        setForm({ ...form, [k]: e.target.value })
                      }
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
                      onChange={(e) =>
                        setForm({ ...form, [k]: e.target.value })
                      }
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
                    onChange={(e) =>
                      setForm({ ...form, notes: e.target.value })
                    }
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
                  {busy
                    ? "Saving…"
                    : form.id
                      ? "Save changes"
                      : "Create record"}
                  <Icon name="arrow" size={16} />
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
      {renew && (
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
                  onChange={(e) =>
                    setRenew({ ...renew, expiry: e.target.value })
                  }
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
                The previous expiry and document references remain in your
                renewal history.
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
      )}
      {toast && (
        <div className="toast" role="status">
          <Icon name="info" size={18} />
          {toast}
          <button aria-label="Dismiss message" onClick={() => setToast("")}>
            <Icon name="close" size={15} />
          </button>
        </div>
      )}
    </div>
  );
}
function Logo() {
  return (
    <div className="logo">
      <img
        className="brand-mark"
        src="/trustchain-logo.png"
        alt=""
        width="48"
        height="48"
      />
      TrustChain<span className="logo-dot">.</span>
    </div>
  );
}
function Status({ value }) {
  return (
    <span className={"status " + value.toLowerCase().replace(" ", "-")}>
      <i />
      {value}
    </span>
  );
}
function Stat({ title, value, detail, icon, color = "", onClick }) {
  return (
    <button className={"stat " + color} onClick={onClick} disabled={!onClick}>
      <div>
        <span>{title}</span>
        <span className={"stat-icon " + color}>
          <Icon name={icon} size={19} />
        </span>
      </div>
      <b>{value}</b>
      <small>{detail}</small>
    </button>
  );
}
function Empty({ title, detail }) {
  return (
    <div className="empty">
      <Icon name="file" size={28} />
      <h3>{title}</h3>
      <p>{detail}</p>
    </div>
  );
}
function Field({ label, wide, children }) {
  return (
    <label className={wide ? "col-span-2" : ""}>
      {label}
      {children}
    </label>
  );
}
createRoot(document.getElementById("root")).render(<App />);

function EmailSettings({ onSaved, notify, readOnly }) {
  const [settings, setSettings] = useState(null),
    [saving, setSaving] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    api("/settings/email")
      .then((c) => setSettings({ ...c, password: "" }))
      .catch((e) => setError(e.message));
  }, []);
  if (!settings)
    return (
      <div className="panel p-6">{error || "Loading email settings…"}</div>
    );
  const change = (key, value) => setSettings((s) => ({ ...s, [key]: value }));
  return (
    <section className="panel max-w-3xl">
      <div className="panel-heading">
        <div>
          <h3>
            {readOnly
              ? "Email configuration (owner managed)"
              : "Connect your email server"}
          </h3>
          <p>Credentials are encrypted before being stored in MongoDB.</p>
        </div>
      </div>
      <fieldset disabled={readOnly}>
        <form
          className="px-5 pb-6"
          onSubmit={async (e) => {
            e.preventDefault();
            setSaving(true);
            setError("");
            try {
              const c = await api("/settings/email", {
                method: "PUT",
                body: JSON.stringify(settings),
              });
              setSettings({ ...c, password: "" });
              await onSaved();
              notify("SMTP connection verified. Email settings saved.");
            } catch (e) {
              setError(e.message);
            } finally {
              setSaving(false);
            }
          }}
        >
          <div className="form-grid">
            <Field label="SMTP host">
              <input
                required
                value={settings.host}
                onChange={(e) => change("host", e.target.value)}
                placeholder="smtp.your-provider.com"
              />
            </Field>
            <Field label="SMTP port">
              <input
                type="number"
                min="1"
                max="65535"
                required
                value={settings.port}
                onChange={(e) => change("port", Number(e.target.value))}
              />
            </Field>
            <Field label="SMTP username">
              <input
                value={settings.username}
                onChange={(e) => change("username", e.target.value)}
                autoComplete="off"
              />
            </Field>
            <Field label="SMTP password / app password">
              <input
                type="password"
                value={settings.password}
                onChange={(e) => change("password", e.target.value)}
                autoComplete="new-password"
                placeholder={
                  settings.hasPassword
                    ? "Saved securely · Leave blank to keep"
                    : "Enter your provider’s SMTP password"
                }
              />
            </Field>
            <Field label="Sender email address" wide>
              <input
                type="email"
                required
                value={settings.from}
                onChange={(e) => change("from", e.target.value)}
              />
            </Field>
          </div>
          <label className="flex items-center gap-3 mt-5">
            <input
              className="w-4 h-4 m-0"
              type="checkbox"
              checked={settings.secure}
              onChange={(e) => change("secure", e.target.checked)}
            />
            Use SSL/TLS from connection start (usually port 465)
          </label>
          <label className="flex items-center gap-3 mt-4">
            <input
              className="w-4 h-4 m-0"
              type="checkbox"
              checked={settings.enabled}
              onChange={(e) => change("enabled", e.target.checked)}
            />
            Enable automatic renewal reminder emails
          </label>
          <p className="muted text-xs mt-4 leading-relaxed">
            Port 587 uses STARTTLS. Saving tests the SMTP connection and login
            without sending an email. When delivery is enabled, due records are
            checked hourly and emailed to their responsible owner.
          </p>
          {settings.verifiedAt && (
            <p className="text-leaf text-xs mt-4">
              Last verified:{" "}
              {new Date(settings.verifiedAt).toLocaleString("en-IN")}
            </p>
          )}
          {error && (
            <p role="alert" className="error text-sm mt-4">
              {error}
            </p>
          )}
          <div className="modal-footer">
            <button disabled={saving} className="btn primary">
              {saving
                ? "Checking SMTP connection…"
                : "Save & verify connection"}
              <Icon name="check" size={16} />
            </button>
          </div>
        </form>
      </fieldset>
    </section>
  );
}
function DocumentVerification({ records, claims, onChange, notify }) {
  const [file, setFile] = useState(null),
    [issuer, setIssuer] = useState(""),
    [assetType, setAssetType] = useState("OTHER"),
    [recordId, setRecordId] = useState(""),
    [result, setResult] = useState(null),
    [digest, setDigest] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function verify(value) {
    setBusy(true);
    setError("");
    try {
      const r = await api("/v1/claims/" + value.trim() + "/verify");
      setResult(r);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="notice">
        <Icon name="shield" />
        <div>
          <b>Check the file, follow its history.</b>
          <p>
            Registration stores the original bytes in MongoDB and mines a claim
            into the audit chain. Verification checks the registered fingerprint
            and stored document.
          </p>
        </div>
      </div>
      <div className="overview-grid">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h3>Register a document</h3>
              <p>
                Store your original file and create a verifiable provenance
                record.
              </p>
            </div>
          </div>
          <form
            className="px-5 pb-6"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError("");
              try {
                if (!file) throw Error("Choose a file");
                if (file.size > 2 * 1024 * 1024)
                  throw Error("Choose a file under 2 MB");
                const form = new FormData();
                form.set("file", file);
                form.set("issuer", issuer);
                form.set("asset_type", assetType);
                if (recordId) form.set("record_id", recordId);
                const r = await api("/v1/claims/upload", {
                  method: "POST",
                  body: form,
                });
                setResult({
                  found: true,
                  message: r.message,
                  provenance: r.provenance,
                });
                setDigest(r.file_hash);
                await onChange();
                notify(
                  "File registered with a SHA-256 fingerprint and provenance report",
                );
              } catch (e) {
                setError(e.message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <Field label="File (up to 2 MB)">
              <input
                type="file"
                required
                onChange={(e) => setFile(e.target.files[0] || null)}
              />
            </Field>
            <div className="form-grid mt-4">
              <Field label="Issuer / provider">
                <input
                  required
                  maxLength={180}
                  value={issuer}
                  onChange={(e) => setIssuer(e.target.value)}
                />
              </Field>
              <Field label="Asset type">
                <select
                  value={assetType}
                  onChange={(e) => setAssetType(e.target.value)}
                >
                  {[
                    "CERTIFICATE",
                    "IDENTITY",
                    "CONTRACT",
                    "RESUME",
                    "RESEARCH_PAPER",
                    "FINANCIAL_REPORT",
                    "IMAGE",
                    "VIDEO",
                    "OTHER",
                  ].map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              </Field>
              <Field label="Link to renewal record (PDF only)" wide>
                <select
                  value={recordId}
                  onChange={(e) => {
                    setRecordId(e.target.value);
                    const r = records.find((r) => r.id === e.target.value);
                    if (r) setIssuer(r.issuer);
                  }}
                >
                  <option value="">Standalone document</option>
                  {records.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.title}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <button disabled={busy} className="btn primary mt-5">
              <Icon name="upload" size={16} />
              {busy ? "Working…" : "Register document"}
            </button>
          </form>
        </section>
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h3>Verify a document</h3>
              <p>Choose a file to calculate its SHA-256 fingerprint.</p>
            </div>
          </div>
          <div className="px-5 pb-6">
            <label>
              File to verify
              <input
                type="file"
                onChange={async (e) => {
                  const f = e.target.files[0];
                  if (!f) return;
                  if (f.size > 100 * 1024 * 1024) {
                    setError("Choose a file under 100 MB");
                    return;
                  }
                  const h = await crypto.subtle.digest(
                    "SHA-256",
                    await f.arrayBuffer(),
                  );
                  const value = Array.from(new Uint8Array(h))
                    .map((x) => x.toString(16).padStart(2, "0"))
                    .join("");
                  setDigest(value);
                  await verify(value);
                }}
              />
            </label>
            <form
              className="mt-4"
              onSubmit={(e) => {
                e.preventDefault();
                verify(digest);
              }}
            >
              <Field label="Or enter a SHA-256 fingerprint">
                <input
                  required
                  minLength={64}
                  maxLength={64}
                  pattern="[a-fA-F0-9]{64}"
                  value={digest}
                  onChange={(e) => setDigest(e.target.value)}
                  className="font-mono text-xs"
                />
              </Field>
              <button className="btn secondary mt-5" disabled={busy}>
                <Icon name="shield" size={16} />
                Verify fingerprint
              </button>
            </form>
          </div>
        </section>
      </div>
      {error && (
        <div className="notice notice-error" role="alert">
          {error}
        </div>
      )}
      {result && (
        <section className="panel mb-5">
          <div className="panel-heading">
            <div>
              <h3>{result.message}</h3>
              <p>
                {result.found
                  ? "Registration found on the audit chain"
                  : "The selected file has no matching registration"}
              </p>
            </div>
          </div>
          {result.provenance && (
            <div className="px-5 pb-6">
              <div className="detail-grid">
                {[
                  ["Document", result.provenance.asset.name],
                  ["Issuer", result.provenance.asset.issuer],
                  ["Registered by", result.provenance.asset.submitted_by],
                  ["Integrity score", result.provenance.trust.score + "/100"],
                  ["Block", result.provenance.blockchain.block_index],
                  ["Verdict", result.provenance.trust.verdict],
                ].map(([k, v]) => (
                  <div key={k}>
                    <small>{k}</small>
                    <b>{v}</b>
                  </div>
                ))}
              </div>
              <div className="flex gap-3 flex-wrap mt-5">
                {Object.entries(result.provenance.integrity).map(([k, v]) => (
                  <span
                    key={k}
                    className={"status " + (v ? "active" : "expired")}
                  >
                    {k.replaceAll("_", " ")}: {v ? "Passed" : "Failed"}
                  </span>
                ))}
              </div>
              <code className="block mt-4">
                {result.provenance.asset.file_hash}
              </code>
              <p className="muted text-xs mt-4">{result.provenance.scope}</p>
            </div>
          )}
        </section>
      )}
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h3>Registered documents</h3>
            <p>{claims.length} documents registered through the API</p>
          </div>
        </div>
        {claims.map((c) => (
          <div className="document-row" key={c.claim_id}>
            <span className="file-icon">
              <Icon name="file" />
            </span>
            <div>
              <b>{c.asset_name}</b>
              {c.metadata?.nptel_verification && (
                <small>
                  NPTEL issuer check: {c.metadata.nptel_verification.status}
                </small>
              )}
              <small className="muted text-xs mt-1">
                {c.issuer} · Block {c.block_index}
              </small>
              <code>{c.file_hash}</code>
            </div>
            <button
              className="btn secondary compact"
              disabled={busy}
              onClick={() => {
                setDigest(c.file_hash);
                verify(c.file_hash);
              }}
            >
              Verify
            </button>
            <a
              className="btn secondary compact"
              href={"/api/documents/" + c.metadata.document_id}
            >
              <Icon name="download" size={16} />
              Download
            </a>
          </div>
        ))}
        {!claims.length && (
          <Empty
            title="No files registered"
            detail="Upload your first document to create its provenance record."
          />
        )}
      </section>
    </>
  );
}

function CertificateInspection({ claims, notify }) {
  const [file, setFile] = useState(null),
    [documentId, setDocumentId] = useState(""),
    [busy, setBusy] = useState(""),
    [result, setResult] = useState(null),
    [error, setError] = useState("");
  async function inspect(kind) {
    setBusy(kind);
    setError("");
    setResult(null);
    try {
      let body;
      if (file) {
        body = new FormData();
        body.set("file", file);
      } else if (documentId) body = JSON.stringify({ documentId });
      else throw Error("Choose a PDF or a registered document");
      const r = await api(
        kind === "NPTEL"
          ? "/v1/verify/nptel-certificate"
          : "/v1/forensics/analyze",
        { method: "POST", body },
      );
      setResult({ kind, ...r });
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy("");
    }
  }
  return (
    <>
      <div className="notice">
        <Icon name="shield" />
        <div>
          <b>Check the issuer. Inspect the evidence.</b>
          <p>
            NPTEL verification reads the QR, retrieves the official certificate,
            and compares fields and rendered pages. PDF inspection reports
            metadata and structural indicators.
          </p>
        </div>
      </div>
      <section className="panel p-6">
        <h3>Choose a certificate</h3>
        <div className="grid gap-4 mt-5 md:grid-cols-2">
          <Field label="PDF to inspect (up to 2 MB)">
            <input
              type="file"
              accept="application/pdf"
              onChange={(e) => {
                setFile(e.target.files[0] || null);
                setDocumentId("");
              }}
            />
          </Field>
          <Field label="Or select a registered PDF">
            <select
              value={documentId}
              onChange={(e) => {
                setDocumentId(e.target.value);
                setFile(null);
              }}
            >
              <option value="">Select document</option>
              {claims
                .filter((c) => /\.pdf$/i.test(c.asset_name))
                .map((c) => (
                  <option key={c.claim_id} value={c.metadata.document_id}>
                    {c.asset_name} · {c.issuer}
                  </option>
                ))}
            </select>
          </Field>
        </div>
        <div className="flex flex-wrap gap-3 mt-5">
          <button
            className="btn primary"
            disabled={!!busy}
            onClick={() => inspect("NPTEL")}
          >
            {busy === "NPTEL"
              ? "Checking official record…"
              : "Verify with NPTEL"}
          </button>
          <button
            className="btn secondary"
            disabled={!!busy}
            onClick={() => inspect("PDF")}
          >
            {busy === "PDF" ? "Inspecting PDF…" : "Analyze PDF"}
          </button>
        </div>
        {error && (
          <p className="error mt-4" role="alert">
            {error}
          </p>
        )}
      </section>
      {result && (
        <section className="panel p-6 mt-5" aria-live="polite">
          <h3>
            {result.kind === "NPTEL"
              ? result.status
              : `PDF indicators: ${result.risk_level}`}
          </h3>
          <p className="muted mt-3">{result.reason || result.scope}</p>
          {result.kind === "NPTEL" ? (
            <>
              <div className="grid gap-4 mt-5 md:grid-cols-2">
                {Object.entries(result.checks || {}).map(([k, v]) => (
                  <div key={k}>
                    <b>{k.replaceAll("_", " ")}</b>
                    <p>{v ? "Matched" : "Did not match"}</p>
                  </div>
                ))}
              </div>
              {result.mismatches?.length > 0 && (
                <ul className="list-disc pl-5 mt-4">
                  {result.mismatches.map((m) => (
                    <li key={m.field}>
                      {m.field.replaceAll("_", " ")}: uploaded{" "}
                      {m.uploaded || "missing"}; official{" "}
                      {m.official || "missing"}
                    </li>
                  ))}
                </ul>
              )}
              {result.official_fields && (
                <div className="grid gap-4 mt-5 md:grid-cols-2">
                  {Object.entries(result.official_fields).map(([k, v]) => (
                    <div key={k}>
                      <small className="muted">{k.replaceAll("_", " ")}</small>
                      <p>{v || "Unavailable"}</p>
                    </div>
                  ))}
                </div>
              )}
              {result.qr_url && (
                <p className="muted mt-4 break-all">
                  Official QR: {result.qr_url}
                </p>
              )}
            </>
          ) : (
            <>
              <div className="grid gap-4 mt-5 md:grid-cols-2">
                {[
                  "page_count",
                  "file_size_bytes",
                  "author",
                  "creator",
                  "producer",
                  "creation_date",
                  "modification_date",
                  "sha256",
                ].map((k) => (
                  <div className="break-all" key={k}>
                    <small className="muted">{k.replaceAll("_", " ")}</small>
                    <p>{result[k] ?? "Unavailable"}</p>
                  </div>
                ))}
              </div>
              <ul className="list-disc pl-5 mt-4">
                {result.tamper_indicators.map((i) => (
                  <li key={i}>{i}</li>
                ))}
              </ul>
            </>
          )}
        </section>
      )}
    </>
  );
}
function TeamSettings({ notify }) {
  const [users, setUsers] = useState([]),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [busy, setBusy] = useState(false);
  const refresh = async () =>
    setUsers((await api("/administrators")).administrators);
  useEffect(() => {
    refresh().catch((e) => notify(e.message));
  }, []);
  return (
    <>
      <section className="panel p-6">
        <h3>Workspace administrators</h3>
        <p className="muted mt-2">
          Administrators manage records and inspect documents. The owner manages
          administrator access, email configuration and backups.
        </p>
        <form
          className="grid gap-4 mt-5"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            try {
              await api("/administrators", {
                method: "POST",
                body: JSON.stringify({ email, password }),
              });
              setEmail("");
              setPassword("");
              await refresh();
              notify(
                "Administrator created. Share the temporary password privately; they can change it in Account settings.",
              );
            } catch (e) {
              notify(e.message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <Field label="Administrator email">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="off"
            />
          </Field>
          <Field label="Initial password (at least 12 characters)">
            <input
              type="password"
              required
              minLength="12"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
            />
          </Field>
          <button className="btn primary justify-self-start" disabled={busy}>
            {busy ? "Adding…" : "Add administrator"}
          </button>
        </form>
      </section>
      <section className="panel p-6 mt-5">
        <h3>Current access</h3>
        {users.map((u) => (
          <div
            className="flex items-center justify-between gap-4 py-4 border-b"
            key={u.email}
          >
            <div>
              <b>{u.email}</b>
              <p className="muted">
                {u.role} · {u.active === false ? "Disabled" : "Active"}
              </p>
            </div>
            {u.role === "admin" && (
              <button
                className="btn secondary"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await api("/administrators/status", {
                      method: "PUT",
                      body: JSON.stringify({
                        email: u.email,
                        active: u.active === false,
                      }),
                    });
                    await refresh();
                    notify("Administrator access updated.");
                  } catch (e) {
                    notify(e.message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {u.active === false ? "Enable" : "Disable"}
              </button>
            )}
          </div>
        ))}
      </section>
    </>
  );
}
function BackupSettings({ notify }) {
  const [state, setState] = useState(null),
    [busy, setBusy] = useState(false);
  const refresh = async () => setState(await api("/backups"));
  useEffect(() => {
    refresh().catch((e) => notify(e.message));
  }, []);
  return (
    <>
      <div className="notice">
        <Icon name="shield" />
        <div>
          <b>Encrypted recovery snapshots</b>
          <p>
            Daily scheduled backups retain seven days of workspace data,
            accounts, SMTP configuration and documents. Download a copy and keep
            both encryption keys separately for recovery.
          </p>
        </div>
      </div>
      <section className="panel p-6">
        <h3>Backup status</h3>
        <p className="muted mt-2">
          {state?.configured
            ? "Backup encryption is configured."
            : "Set BACKUP_ENCRYPTION_KEY on the server to enable backups."}
        </p>
        <p className="muted mt-2">
          {state?.independent
            ? "Backups are stored in your separate MongoDB destination."
            : "Snapshots share the application database. Configure a separate backup MongoDB destination or download copies for disaster recovery."}
        </p>
        <button
          className="btn primary mt-5"
          disabled={busy || !state?.configured}
          onClick={async () => {
            setBusy(true);
            try {
              await api("/backups", { method: "POST", body: "{}" });
              await refresh();
              notify("Encrypted backup completed.");
            } catch (e) {
              notify(e.message);
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "Creating backup…" : "Create backup now"}
        </button>
      </section>
      <section className="panel p-6 mt-5">
        <h3>Recovery points</h3>
        {state?.backups.map((b) => (
          <div
            className="flex flex-wrap items-center justify-between gap-4 py-4 border-b"
            key={b._id}
          >
            <div>
              <b>{new Date(b.createdAt).toLocaleString()}</b>
              <p className="muted">
                {b.records} records · {b.documents} documents · expires{" "}
                {new Date(b.expiresAt).toLocaleDateString()}
              </p>
            </div>
            {b.bytes <= 3500000 ? (
              <button
                className="btn secondary"
                onClick={async () => {
                  try {
                    const data = await api(`/backups/${b._id}/download`);
                    const url = URL.createObjectURL(
                      new Blob([JSON.stringify(data)], {
                        type: "application/json",
                      }),
                    );
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `trustchain-${b._id}.backup.json`;
                    a.click();
                    setTimeout(() => URL.revokeObjectURL(url), 1000);
                  } catch (e) {
                    notify(e.message);
                  }
                }}
              >
                Download encrypted backup
              </button>
            ) : (
              <span className="muted">Use backup export CLI: {b._id}</span>
            )}
          </div>
        ))}
        {state && !state.backups.length && (
          <p className="muted mt-4">No recovery points yet.</p>
        )}
      </section>
    </>
  );
}
function AccountSettings({ notify, onPasswordChanged }) {
  const [currentPassword, setCurrent] = useState(""),
    [password, setPassword] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <section className="panel p-6">
      <h3>Change your password</h3>
      <p className="muted mt-2">
        Changing your password signs out all your sessions.
      </p>
      <form
        className="grid gap-4 mt-5"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            await api("/account/password", {
              method: "POST",
              body: JSON.stringify({ currentPassword, password }),
            });
            notify("Password changed. Sign in with your new password.");
            await onPasswordChanged();
          } catch (e) {
            notify(e.message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <Field label="Current password">
          <input
            type="password"
            required
            value={currentPassword}
            onChange={(e) => setCurrent(e.target.value)}
            autoComplete="current-password"
          />
        </Field>
        <Field label="New password">
          <input
            type="password"
            required
            minLength="12"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
          />
        </Field>
        <button className="btn primary justify-self-start" disabled={busy}>
          {busy ? "Saving…" : "Change password"}
        </button>
      </form>
    </section>
  );
}
