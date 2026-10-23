import { status, hash } from "../domain.mjs";

import { createBackup, decodeArchive } from "../services/backup.service.mjs";

export function createSystemController({ store, env, email, sendReminders }) {
  return {
    health: async (req, res) => {
      const state = await store.read();
      res.json({
        status: "ok",
        version: "3.0.0",
        database: "MongoDB",
        chain_length: state.chain.length,
      });
    },
    runScheduledJobs: async (req, res) => {
      if (
        !env.CRON_SECRET ||
        !req.headers.authorization ||
        hash(req.headers.authorization) !== hash(`Bearer ${env.CRON_SECRET}`)
      )
        return res.status(401).json({ error: "Invalid scheduler credentials" });
      const jobs = {};
      if (req.path === "/api/cron/verify-email")
        return res.json({ email: await email.verify() });
      if (req.path !== "/api/cron/backups")
        try {
          jobs.reminders = (await email.enabled())
            ? await sendReminders("Vercel scheduler")
            : { disabled: true };
        } catch (e) {
          jobs.reminders = { error: e.message };
        }
      if (req.path !== "/api/cron/reminders")
        try {
          jobs.backup = env.BACKUP_ENCRYPTION_KEY
            ? await createBackup(store, env)
            : { disabled: true };
        } catch (e) {
          jobs.backup = { error: e.message };
        }
      res
        .status(Object.values(jobs).some((j) => j.error) ? 503 : 200)
        .json(jobs);
    },
    importWorkspace: async (req, res) => {
      if (
        env.ALLOW_SETUP !== "false" ||
        !env.CRON_SECRET ||
        !req.headers.authorization ||
        hash(req.headers.authorization) !== hash(`Bearer ${env.CRON_SECRET}`)
      )
        return res.status(403).json({
          error: "Migration is disabled or scheduler credentials are invalid",
        });
      if (await store.getAdmin())
        return res
          .status(409)
          .json({ error: "A configured workspace cannot be replaced" });
      const decoded = decodeArchive(req.body, env);
      await store.importInitial(decoded);
      res.json({
        ok: true,
        records: decoded.workspace.state.records.length,
        documents: decoded.documents.length,
        blocks: decoded.workspace.state.chain.length,
      });
    },
  };
}
