// MongoDB collection definitions, default workspace and indexes.
export async function initializeWorkspaceModels(client, backupDb, database) {
  const db = client.db(database),
    states = db.collection("workspace"),
    files = db.collection("documents"),
    admins = db.collection("administrators"),
    sessions = db.collection("sessions"),
    settings = db.collection("settings");
  await states.updateOne(
    { _id: "main" },
    {
      $setOnInsert: {
        revision: 0,
        records: [],
        chain: [],
        claims: [],
        notifications: [],
      },
    },
    { upsert: true },
  );
  await admins.updateMany(
    { role: { $exists: false } },
    { $set: { role: "owner", active: true } },
  );
  await admins.createIndex({ email: 1 }, { unique: true });
  const locks = db.collection("locks"),
    deliveries = db.collection("deliveries"),
    backups = backupDb.collection("backups"),
    parts = backupDb.collection("backup_parts"),
    limits = db.collection("login_limits");
  await locks.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  await limits.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  await backups.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  await parts.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  await sessions.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  return {
    states,
    files,
    admins,
    sessions,
    settings,
    locks,
    deliveries,
    backups,
    parts,
    limits,
  };
}
