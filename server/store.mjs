import { randomUUID } from "node:crypto";
import { MongoClient, BSON } from "mongodb";
export async function createStore({
  uri,
  database = "trustchain",
  backupUri = process.env.BACKUP_MONGODB_URI,
  backupDatabase = process.env.BACKUP_MONGODB_DATABASE || "trustchain_backups",
} = {}) {
  if (!uri)
    throw Error(
      "MONGODB_URI is required. TrustChain uses MongoDB for all application data.",
    );
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 });
  await client.connect();
  const backupClient = backupUri
    ? new MongoClient(backupUri, { serverSelectionTimeoutMS: 5000 })
    : null;
  if (backupClient) await backupClient.connect();
  const backupDb = backupClient
    ? backupClient.db(backupDatabase)
    : client.db(database);
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
    read: async () => {
      const { _id, ...state } = await states.findOne({ _id: "main" });
      return { ...state, claims: state.claims || [] };
    },
    save: async (next, revision) => {
      if (BSON.calculateObjectSize(next) > 14 * 1024 * 1024)
        throw Error(
          "Workspace history limit reached. Export your audit and contact the workspace administrator.",
        );
      return (
        (
          await states.replaceOne(
            { _id: "main", revision },
            { _id: "main", ...next },
          )
        ).modifiedCount === 1
      );
    },
    putFile: async (id, file) => files.insertOne({ _id: id, ...file }),
    getFile: async (id) => {
      const f = await files.findOne({ _id: id });
      return f && { ...f, data: Buffer.from(f.data.buffer) };
    },
    deleteFile: async (id) => files.deleteOne({ _id: id }),
    findAdmin: (email) => admins.findOne({ email }),
    listAdmins: () =>
      admins.find({}, { projection: { passwordHash: 0, salt: 0 } }).toArray(),
    addAdmin: async (a) => {
      try {
        await admins.insertOne({
          _id: randomUUID(),
          ...a,
          role: "admin",
          active: true,
        });
        return true;
      } catch (e) {
        if (e.code === 11000) return false;
        throw e;
      }
    },
    setAdminActive: (email, active) =>
      admins.updateOne({ email, role: "admin" }, { $set: { active } }),
    changePassword: (email, a) =>
      admins.updateOne(
        { email },
        { $set: { salt: a.salt, passwordHash: a.passwordHash } },
      ),
    revokeSessions: (email) => sessions.deleteMany({ email }),
    loginAttempt: async (key) => {
      const window = Math.floor(Date.now() / 900000);
      const row = await limits.findOneAndUpdate(
        { _id: `${key}:${window}` },
        {
          $inc: { count: 1 },
          $setOnInsert: { expiresAt: new Date((window + 2) * 900000) },
        },
        { upsert: true, returnDocument: "after" },
      );
      return row.count;
    },
    acquireLock: async (key, duration = 300000) => {
      const token = randomUUID();
      try {
        const r = await locks.findOneAndUpdate(
          { _id: key, expiresAt: { $lt: new Date() } },
          { $set: { token, expiresAt: new Date(Date.now() + duration) } },
          { upsert: true, returnDocument: "after" },
        );
        return r.token;
      } catch (e) {
        if (e.code === 11000) return null;
        throw e;
      }
    },
    releaseLock: (key, token) => locks.deleteOne({ _id: key, token }),
    reserveDelivery: async (key) => {
      try {
        await deliveries.insertOne({
          _id: key,
          status: "Sending",
          at: new Date(),
        });
        return true;
      } catch (e) {
        if (e.code === 11000) return false;
        throw e;
      }
    },
    finishDelivery: (key, status) =>
      deliveries.updateOne(
        { _id: key },
        { $set: { status, finishedAt: new Date() } },
      ),
    releaseFailedDelivery: (key) =>
      deliveries.deleteOne({ _id: key, status: "Failed" }),
    exportAccounts: () => admins.find().toArray(),
    allFiles: () => files.find(),
    saveBackupPart: (part) => parts.insertOne(part),
    finishBackup: (b) => backups.insertOne(b),
    listBackups: () =>
      backups
        .find({}, { projection: { parts: 0 } })
        .sort({ createdAt: -1 })
        .limit(30)
        .toArray(),
    getBackup: (id) => backups.findOne({ _id: id }),
    getBackupParts: (id) =>
      parts.find({ backupId: id }).sort({ index: 1 }).toArray(),
    getAdmin: () => admins.findOne({ _id: "owner" }),
    createAdmin: async (admin) => {
      try {
        await admins.insertOne({
          _id: "owner",
          ...admin,
          role: "owner",
          active: true,
        });
        return true;
      } catch (e) {
        if (e.code === 11000) return false;
        throw e;
      }
    },
    putSession: (id, s) => sessions.insertOne({ _id: id, ...s }),
    getSession: (id) => sessions.findOne({ _id: id }),
    deleteSession: (id) => sessions.deleteOne({ _id: id }),
    getSettings: () => settings.findOne({ _id: "email" }),
    saveSettings: (config) =>
      settings.replaceOne(
        { _id: "email" },
        { _id: "email", ...config },
        { upsert: true },
      ),
    importInitial: async ({ workspace, documents }) => {
      const session = client.startSession();
      try {
        await session.withTransaction(async () => {
          if (await admins.findOne({}, { session }))
            throw Object.assign(
              Error("A configured workspace cannot be replaced"),
              { status: 409 },
            );
          const current = await states.findOne({ _id: "main" }, { session });
          if (
            current.records.length ||
            current.chain.length ||
            (await files.countDocuments({}, { session }))
          )
            throw Object.assign(
              Error("Migration requires an empty workspace"),
              { status: 409 },
            );
          await admins.insertMany(workspace.accounts, { session });
          await states.replaceOne(
            { _id: "main" },
            { _id: "main", ...workspace.state },
            { session },
          );
          if (documents.length)
            await files.insertMany(
              documents.map((d) => ({
                _id: d.id,
                name: d.name,
                hash: d.hash,
                data: Buffer.from(d.data, "base64"),
              })),
              { session },
            );
          if (workspace.settings)
            await settings.replaceOne({ _id: "email" }, workspace.settings, {
              upsert: true,
              session,
            });
        });
      } finally {
        await session.endSession();
      }
    },
    backupIsIndependent: !!backupClient,
    close: async () => {
      await backupClient?.close();
      await client.close();
    },
  };
}
