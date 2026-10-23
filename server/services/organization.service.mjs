import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import { MongoClient } from "mongodb";
import { createStore } from "../repositories/workspace.repository.mjs";

// Local runtime: separate MongoDB databases, selected only by authenticated sessions.
export async function createOrganizationStore(options) {
  const database = options.database || "trustchain";
  const context = new AsyncLocalStorage();
  const client = await new MongoClient(options.uri).connect();
  const directory = client.db(database).collection("organization_accounts");
  const organizations = client.db(database).collection("organizations");
  const stores = new Map();
  stores.set("main", Promise.resolve(await createStore(options)));
  async function tenant(id = "main") {
    if (!stores.has(id)) {
      const org = await organizations.findOne({ _id: id });
      if (!org) throw Error("Workspace unavailable");
      stores.set(
        id,
        createStore({
          ...options,
          database: org.database,
          backupDatabase: `${org.database.slice(0, 25)}_backups`,
        }),
      );
    }
    return stores.get(id);
  }
  const base = await tenant();
  for (const a of await base.listAdmins()) {
    await directory.updateOne(
      { _id: a.email },
      { $setOnInsert: { tenantId: "main", active: true } },
      { upsert: true },
    );
  }
  async function reserve(email, tenantId, operation) {
    try {
      await directory.insertOne({ _id: email, tenantId, active: false });
    } catch (e) {
      if (e.code === 11000) return false;
      throw e;
    }
    try {
      const result = await operation();
      if (!result) {
        await directory.deleteOne({ _id: email, tenantId, active: false });
        return false;
      }
      await directory.updateOne(
        { _id: email, tenantId },
        { $set: { active: true } },
      );
      return result;
    } catch (e) {
      await directory.deleteOne({ _id: email, tenantId, active: false });
      throw e;
    }
  }
  const special = {
    currentTenant: () => context.getStore() || "main",
    allFiles: async function* () {
      const scoped = await tenant(context.getStore() || "main");
      for await (const file of scoped.allFiles()) yield file;
    },
    organizationRegistrationEnabled: true,
    hasOrganizations: async () => !!(await directory.findOne({ active: true })),
    runWithTenant: (id, fn) => context.run(id || "main", fn),
    ownerForTenant: async (id) => (await tenant(id)).getAdmin(),
    findAdmin: async (email) => {
      const entry = await directory.findOne({ _id: email, active: true });
      if (!entry) return null;
      const admin = await (await tenant(entry.tenantId)).findAdmin(email);
      return admin && { ...admin, tenantId: entry.tenantId };
    },
    createAdmin: async (a) =>
      reserve(a.email, "main", () => base.createAdmin(a)),
    addAdmin: async (a) => {
      const id = context.getStore() || "main";
      return reserve(a.email, id, async () => (await tenant(id)).addAdmin(a));
    },
    createOrganization: async (a) => {
      const id = randomUUID().replaceAll("-", "");
      return reserve(a.email, id, async () => {
        const name = `${database.slice(0, 10)}_org_${id.slice(0, 20)}`;
        await organizations.insertOne({
          _id: id,
          database: name,
          organization: a.organization,
          createdAt: new Date(),
        });
        try {
          const store = await tenant(id);
          if (!(await store.createAdmin(a)))
            throw Error("Could not create workspace");
          return id;
        } catch (error) {
          await organizations.deleteOne({ _id: id });
          throw error;
        }
      });
    },
    forEachWorkspace: async (fn) => {
      await context.run("main", fn);
      for (const org of await organizations.find({}).toArray()) {
        if (await directory.findOne({ tenantId: org._id, active: true }))
          await context.run(org._id, fn);
      }
    },
    close: async () => {
      for (const value of stores.values()) await (await value).close();
      await client.close();
    },
  };
  for (const key of [
    "getSession",
    "putSession",
    "deleteSession",
    "loginAttempt",
    "revokeSessions",
  ])
    special[key] = (...args) => base[key](...args);
  return new Proxy(special, {
    get(target, key) {
      if (key in target) return target[key];
      if (typeof base[key] !== "function") return base[key];
      return async (...args) =>
        (await tenant(context.getStore() || "main"))[key](...args);
    },
  });
}
