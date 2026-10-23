import { useState, useEffect } from "react";
import { api } from "../api/client.js";
export function useWorkspace() {
  const [registration, setRegistration] = useState(false);
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
  const creating = registration || session?.setupRequired;
  async function login(event) {
    event.preventDefault();
    setBusy(true);
    setLoginError("");
    const f = new FormData(event.currentTarget);
    try {
      await api(
        registration
          ? "/organizations"
          : session.setupRequired
            ? "/setup"
            : "/login",
        {
          method: "POST",
          body: JSON.stringify(Object.fromEntries(f)),
        },
      );
      setSession(await api("/session"));
      await load();
    } catch (e) {
      setLoginError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return {
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
  };
}
