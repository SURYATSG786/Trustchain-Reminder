import { appendBlock, status } from "../domain.mjs";
import { credential } from "../middleware/auth.middleware.mjs";

export function createAdministratorController({ store, email, mutate }) {
  return {
    listAdministrators: async (req, res) =>
      res.json({ administrators: await store.listAdmins() }),
    createAdministrator: async (req, res) => {
      if ((await store.listAdmins()).length >= 20)
        throw Error("Maximum 20 administrators per workspace");
      const a = credential(req.body?.email, req.body?.password);
      if (!(await store.addAdmin(a)))
        return res
          .status(409)
          .json({ error: "Administrator email already exists" });
      await mutate((s) =>
        appendBlock(
          s,
          "Administrator added",
          null,
          { email: a.email },
          req.user.email,
        ),
      );
      res.status(201).json({ email: a.email, role: "admin", active: true });
    },
    updateAdministratorStatus: async (req, res) => {
      if (typeof req.body?.active !== "boolean")
        throw Error("Specify an active status");
      const email = String(req.body?.email || "")
        .trim()
        .toLowerCase();
      const changed = await store.setAdminActive(email, req.body.active);
      if (!changed.matchedCount)
        return res.status(404).json({
          error: "Administrator not found or owner cannot be disabled",
        });
      if (!req.body.active) await store.revokeSessions(email);
      await mutate((s) =>
        appendBlock(
          s,
          "Administrator access changed",
          null,
          { email, active: req.body.active },
          req.user.email,
        ),
      );
      res.json({ ok: true });
    },
  };
}
