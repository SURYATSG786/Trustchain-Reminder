import {
  randomBytes,
  scryptSync,
  timingSafeEqual,
  createHash,
} from "node:crypto";
export function credential(email, password) {
  if (
    typeof email !== "string" ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    email.length > 180
  )
    throw Error("Enter a valid administrator email");
  if (
    typeof password !== "string" ||
    password.length < 12 ||
    password.length > 256
  )
    throw Error("Password must contain between 12 and 256 characters");
  const salt = randomBytes(16).toString("hex");
  return {
    email: email.trim().toLowerCase(),
    salt,
    passwordHash: scryptSync(password, salt, 64).toString("hex"),
    createdAt: new Date().toISOString(),
  };
}
const tokenHash = (token) => createHash("sha256").update(token).digest("hex");
export function installAuth(app, store, env) {
  const attempts = new Map();
  const bootstrap = (async () => {
    if (env.ADMIN_EMAIL && env.ADMIN_PASSWORD && !(await store.getAdmin()))
      await store.createAdmin(credential(env.ADMIN_EMAIL, env.ADMIN_PASSWORD));
  })();
  function origin(req, res, next) {
    if (
      req.headers.origin &&
      req.headers.origin !== `${req.protocol}://${req.get("host")}`
    )
      return res.status(403).json({ error: "Invalid origin" });
    next();
  }
  async function user(req) {
    const token = (req.headers.cookie || "").match(
      /(?:^|;\s*)tc_session=([^;]+)/,
    )?.[1];
    if (!token) return null;
    const s = await store.getSession(tokenHash(token));
    if (!s || new Date(s.expiresAt) <= new Date()) return null;
    const a = store.findAdmin
      ? await store.findAdmin(s.email)
      : await store.getAdmin();
    return a && a.active !== false ? { ...s, role: a.role || "owner" } : null;
  }
  async function throttle(req, res, next) {
    if (store.loginAttempt) {
      const account = String(req.body?.email || "setup")
        .trim()
        .toLowerCase()
        .slice(0, 180);
      if (
        (await store.loginAttempt(`ip:${req.ip}`)) > 120 ||
        (await store.loginAttempt(`account:${req.ip}:${account}`)) > 12
      )
        return res
          .status(429)
          .json({ error: "Too many attempts. Try again in 15 minutes." });
      return next();
    }
    const k = req.ip,
      old = attempts.get(k),
      a =
        old && Date.now() - old.at < 900000
          ? old
          : { count: 0, at: Date.now() };
    attempts.set(k, a);
    if (++a.count > 12)
      return res
        .status(429)
        .json({ error: "Too many attempts. Try again in 15 minutes." });
    next();
  }
  async function signIn(req, res, email) {
    attempts.delete(req.ip);
    const token = randomBytes(32).toString("hex");
    await store.putSession(tokenHash(token), {
      email,
      expiresAt: new Date(Date.now() + 8 * 3600000),
    });
    res.cookie("tc_session", token, {
      httpOnly: true,
      sameSite: "strict",
      secure: env.NODE_ENV === "production",
      maxAge: 8 * 3600000,
    });
    res.json({ ok: true });
  }
  app.get("/api/session", async (req, res) => {
    await bootstrap;
    const admin = await store.getAdmin(),
      s = await user(req);
    res.json({
      authenticated: !!s,
      setupRequired: !admin,
      email: s?.email,
      role: s?.role,
      organization: admin?.organization || "Your organization",
    });
  });
  app.post("/api/setup", origin, throttle, async (req, res) => {
    await bootstrap;
    if (env.ALLOW_SETUP === "false")
      return res
        .status(403)
        .json({ error: "Administrator setup is disabled on this server" });
    const admin = {
      ...credential(req.body?.email, req.body?.password),
      organization: String(req.body?.organization || "Your organization")
        .trim()
        .slice(0, 120),
    };
    if (!(await store.createAdmin(admin)))
      return res
        .status(409)
        .json({ error: "Workspace is already configured. Please sign in." });
    await signIn(req, res, admin.email);
  });
  app.post("/api/login", origin, throttle, async (req, res) => {
    await bootstrap;
    const admin = store.findAdmin
      ? await store.findAdmin(
          String(req.body?.email || "")
            .trim()
            .toLowerCase(),
        )
      : await store.getAdmin();
    const password = req.body?.password;
    if (
      !admin ||
      admin.active === false ||
      typeof password !== "string" ||
      password.length > 256 ||
      req.body?.email?.trim().toLowerCase() !== admin.email ||
      !timingSafeEqual(
        scryptSync(password, admin.salt, 64),
        Buffer.from(admin.passwordHash, "hex"),
      )
    )
      return res.status(401).json({ error: "Email or password is incorrect" });
    await signIn(req, res, admin.email);
  });
  app.use("/api", async (req, res, next) => {
    await bootstrap;
    req.user = await user(req);
    if (!req.user) return res.status(401).json({ error: "Please sign in" });
    if (!["GET", "HEAD"].includes(req.method)) return origin(req, res, next);
    next();
  });
  app.use("/api", (req, res, next) => {
    if (
      (req.path.startsWith("/administrators") ||
        req.path.startsWith("/backups") ||
        (req.path === "/settings/email" && req.method !== "GET")) &&
      req.user.role !== "owner"
    )
      return res.status(403).json({ error: "Workspace owner access required" });
    next();
  });
  app.post("/api/account/password", async (req, res) => {
    const a = store.findAdmin
      ? await store.findAdmin(req.user.email)
      : await store.getAdmin();
    if (
      typeof req.body?.currentPassword !== "string" ||
      req.body.currentPassword.length > 256 ||
      !timingSafeEqual(
        scryptSync(req.body.currentPassword, a.salt, 64),
        Buffer.from(a.passwordHash, "hex"),
      )
    )
      return res.status(401).json({ error: "Current password is incorrect" });
    await store.changePassword(a.email, credential(a.email, req.body.password));
    await store.revokeSessions(a.email);
    res.clearCookie("tc_session");
    res.json({ ok: true });
  });
  app.post("/api/logout", async (req, res) => {
    const token = (req.headers.cookie || "").match(/tc_session=([^;]+)/)?.[1];
    if (token) await store.deleteSession(tokenHash(token));
    res.clearCookie("tc_session");
    res.json({ ok: true });
  });
  return { ready: bootstrap };
}
