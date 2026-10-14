import { MongoClient, BSON } from "mongodb";
export async function createStore({ uri, database = "trustchain" } = {}) {
  if (!uri)
    throw Error(
      "MONGODB_URI is required. TrustChain uses MongoDB for all application data.",
    );
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 });
  await client.connect();
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
    getAdmin: () => admins.findOne({ _id: "owner" }),
    createAdmin: async (admin) => {
      try {
        await admins.insertOne({ _id: "owner", ...admin });
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
    close: () => client.close(),
  };
}
