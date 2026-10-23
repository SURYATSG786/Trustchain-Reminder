import { audit } from "../services/audit.service.mjs";
export function requireAuditIntegrity(store) {
  return async (req, res, next) => {
    if (
      req.method !== "GET" &&
      (req.path.startsWith("/administrators") || req.path === "/settings/email")
    ) {
      if (!audit((await store.read()).chain).valid)
        return res.status(409).json({
          error: "Audit chain integrity failure. Writes are blocked.",
        });
    }
    next();
  };
}
