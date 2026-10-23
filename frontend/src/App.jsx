import { pageThemes } from "./utils/pageThemes.js";
import { TopBar } from "./components/layout/TopBar.jsx";
import { RecordTable } from "./components/RecordTable.jsx";
import { useWorkspace } from "./hooks/useWorkspace.js";
import React, { useState, useEffect } from "react";
import { categories } from "./utils/format.js";
import { api } from "./api/client.js";
import { Icon } from "./components/Icon.jsx";

import { EmailSettings } from "./pages/EmailSettings.jsx";
import { DocumentVerification } from "./pages/DocumentVerification.jsx";
import { CertificateInspection } from "./pages/CertificateInspection.jsx";
import { TeamSettings } from "./pages/TeamSettings.jsx";
import { BackupSettings } from "./pages/BackupSettings.jsx";
import { AccountSettings } from "./pages/AccountSettings.jsx";
import { OverviewPage } from "./pages/OverviewPage.jsx";
import { RenewalRegisterPage } from "./pages/RenewalRegisterPage.jsx";
import { CalendarPage } from "./pages/CalendarPage.jsx";
import { DocumentsPage } from "./pages/DocumentsPage.jsx";
import { AuditTrailPage } from "./pages/AuditTrailPage.jsx";
import { RemindersPage } from "./pages/RemindersPage.jsx";
import { ReportsPage } from "./pages/ReportsPage.jsx";
import { AuthPage } from "./pages/AuthPage.jsx";
import { RecordDetails } from "./components/RecordDetails.jsx";
import { RecordForm } from "./components/RecordForm.jsx";
import { RenewalForm } from "./components/RenewalForm.jsx";
export default function App() {
  const {
    registration,
    setRegistration,
    session,
    setSession,
    data,
    setData,
    page,
    setPage,
    query,
    setQuery,
    filter,
    setFilter,
    category,
    setCategory,
    selected,
    setSelected,
    form,
    setForm,
    renew,
    setRenew,
    toast,
    setToast,
    busy,
    setBusy,
    loginError,
    setLoginError,
    month,
    setMonth,
    load,
    notify,
    act,
    creating,
    login,
  } = useWorkspace();
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
      <AuthPage
        {...{
          session,
          creating,
          registration,
          setRegistration,
          loginError,
          setLoginError,
          busy,
          login,
        }}
      />
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
  const theme = pageThemes[page] || pageThemes.Overview;
  const table = <RecordTable shown={shown} setSelected={setSelected} />;
  return (
    <div
      className="app-shell"
      data-page={page}
      style={{ "--page-accent": "#2d6fa3", "--page-soft": "#edf5fc" }}
    >
      <TopBar
        {...{ page, go, session, nav, soon, expired, setSession, setData }}
      />
      <div className="main-shell">
        <main>
          <div className="page-heading">
            <div className="heading-row">
              <div className="page-title-group">
                <span className="page-icon">
                  <Icon name={theme.icon} size={25} />
                </span>
                <div>
                  <h1>{page === "Overview" ? "Dashboard" : page}</h1>
                  <p className="muted">
                    {
                      {
                        Overview:
                          "Track renewals, monitor compliance and manage your records.",
                        "Renewal register":
                          "Manage contracts, licenses and renewal dates.",
                        Calendar: "View expiry dates by month.",
                        Documents:
                          "Manage the documents attached to your records.",
                        "Audit trail":
                          "A verifiable record of every change in your workspace.",
                        Reminders:
                          "Review scheduled reminders and delivery history.",
                        Reports: "Review compliance and annual renewal costs.",
                        "Email settings":
                          "Connect your mail server and manage reminder delivery.",
                        "Document verification":
                          "Register actual files and verify their recorded fingerprint.",
                      }[page]
                    }
                  </p>
                </div>
              </div>
              {[
                "Overview",
                "Renewal register",
                "Calendar",
                "Documents",
              ].includes(page) &&
                !(page === "Overview" && !records.length) && (
                  <button className="btn primary" onClick={newRecord}>
                    <Icon name="plus" size={18} />
                    Add record
                  </button>
                )}
            </div>
          </div>
          {page === "Overview" && (
            <OverviewPage
              {...{
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
              }}
            />
          )}
          {page === "Renewal register" && (
            <RenewalRegisterPage
              {...{
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
              }}
            />
          )}
          {page === "Calendar" && (
            <CalendarPage
              {...{ records, expired, filter, setSelected, month, setMonth }}
            />
          )}
          {page === "Documents" && (
            <DocumentsPage {...{ records, setSelected }} />
          )}
          {page === "Audit trail" && (
            <AuditTrailPage {...{ data, records, latest }} />
          )}
          {page === "Reminders" && (
            <RemindersPage
              {...{
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
              }}
            />
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
            <ReportsPage
              {...{ records, expired, soon, active, filter, category }}
            />
          )}
        </main>
      </div>
      {selected && (
        <RecordDetails
          {...{
            category,
            selected,
            setSelected,
            setForm,
            setRenew,
            busy,
            setBusy,
            load,
            notify,
          }}
        />
      )}
      {form && (
        <RecordForm {...{ records, category, form, setForm, busy, act }} />
      )}
      {renew && (
        <RenewalForm {...{ records, form, renew, setRenew, busy, act }} />
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
