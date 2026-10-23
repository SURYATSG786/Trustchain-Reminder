import { scryptSync, timingSafeEqual } from "node:crypto";
import { credential } from "../models/administrator.model.mjs";
export function createAuthController({
  store,
  env,
  bootstrap,
  user,
  signIn,
  tokenHash,
}) {
  return {
    getSession: async (req, res) => {
      await bootstrap;
      const admin = await store.getAdmin(),
        s = await user(req);
      const owner =
        s && store.ownerForTenant
          ? await store.ownerForTenant(s.tenantId)
          : admin;
      res.json({
        organizationRegistrationEnabled:
          !!store.organizationRegistrationEnabled,
        authenticated: !!s,
        setupRequired:
          !admin &&
          !(store.hasOrganizations && (await store.hasOrganizations())),
        email: s?.email,
        role: s?.role,
        organization: owner?.organization || "Your organization",
      });
    },
    setupWorkspace: async (req, res) => {
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
    },
    createOrganization: async (req, res) => {
      const organization = String(req.body?.organization || "").trim();
      if (organization.length < 2 || organization.length > 120)
        return res.status(400).json({
          error: "Enter an organization name between 2 and 120 characters",
        });
      const a = {
        ...credential(req.body?.email, req.body?.password),
        organization,
      };
      const tenantId = await store.createOrganization(a);
      if (!tenantId)
        return res.status(409).json({
          error:
            "This email already has an account. Sign in or use another email.",
        });
      await signIn(req, res, a.email, tenantId);
    },
    login: async (req, res) => {
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
        return res
          .status(401)
          .json({ error: "Email or password is incorrect" });
      await signIn(req, res, admin.email, admin.tenantId);
    },
    changePassword: async (req, res) => {
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
      await store.changePassword(
        a.email,
        credential(a.email, req.body.password),
      );
      await store.revokeSessions(a.email);
      res.clearCookie("tc_session");
      res.json({ ok: true });
    },
    logout: async (req, res) => {
      const token = (req.headers.cookie || "").match(/tc_session=([^;]+)/)?.[1];
      if (token) await store.deleteSession(tokenHash(token));
      res.clearCookie("tc_session");
      res.json({ ok: true });
    },
  };
}
