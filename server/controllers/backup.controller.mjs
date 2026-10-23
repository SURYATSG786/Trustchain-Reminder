import { status } from "../domain.mjs";

import { createBackup, backupArchive } from "../services/backup.service.mjs";

export function createBackupController({ store, env, email }) {
  return {
    listBackups: async (req, res) =>
      res.json({
        configured: !!env.BACKUP_ENCRYPTION_KEY,
        independent: !!store.backupIsIndependent,
        backups: await store.listBackups(),
      }),
    createBackup: async (req, res) =>
      res.status(201).json(await createBackup(store, env, req.user.email)),
    downloadBackup: async (req, res) => {
      const b = await store.getBackup(req.params.id);
      if (b?.bytes > 3500000)
        throw Object.assign(
          Error(
            "This backup exceeds the web download limit. Use npm run backup:export with this backup ID.",
          ),
          { status: 413 },
        );
      const archive = await backupArchive(store, req.params.id);
      res.set({
        "Cache-Control": "no-store",
        "Content-Disposition": `attachment; filename="trustchain-${req.params.id}.backup.json"`,
      });
      res.json(archive);
    },
  };
}
