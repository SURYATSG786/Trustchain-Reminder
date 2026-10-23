import { createAuthController } from "../controllers/auth.controller.mjs";
import {
  mountPublicAuthRoutes,
  mountAccountRoutes,
} from "../routes/auth.routes.mjs";
import { credential } from "../models/administrator.model.mjs";
import {
  randomBytes,
  scryptSync,
  timingSafeEqual,
  createHash,
} from "node:crypto";
export { credential } from "../models/administrator.model.mjs";
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
    return a &&
      a.active !== false &&
      (s.tenantId || "main") === (a.tenantId || "main")
      ? { ...s, tenantId: a.tenantId || "main", role: a.role || "owner" }
      : null;
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
  async function signIn(req, res, email, tenantId = "main") {
    attempts.delete(req.ip);
    const token = randomBytes(32).toString("hex");
    await store.putSession(tokenHash(token), {
      email,
      tenantId,
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

  const controllers = createAuthController({
    store,
    env,
    bootstrap,
    user,
    signIn,
    tokenHash,
  });
  mountPublicAuthRoutes(app, controllers, {
    origin,
    throttle,
    organizationEnabled: !!store.createOrganization,
  });
  app.use("/api", async (req, res, next) => {
    await bootstrap;
    req.user = await user(req);
    if (!req.user) return res.status(401).json({ error: "Please sign in" });
    const proceed = () => {
      if (!["GET", "HEAD"].includes(req.method)) return origin(req, res, next);
      next();
    };
    if (store.runWithTenant)
      return store.runWithTenant(req.user.tenantId, proceed);
    proceed();
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

  mountAccountRoutes(app, controllers);
  return { ready: bootstrap };
}
