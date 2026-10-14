// Isolated test fixture only; the running application has no seed data or database fallback.
import { seed } from "./fixtures.mjs";
export async function createTestStore({ empty = false } = {}) {
  let state = empty
    ? { revision: 0, records: [], chain: [], claims: [], notifications: [] }
    : { ...seed(), claims: [] };
  let admin = null,
    settings = null;
  const files = new Map(),
    sessions = new Map();
  return {
    read: async () => structuredClone(state),
    save: async (next, revision) => {
      if (state.revision !== revision) return false;
      state = structuredClone(next);
      return true;
    },
    putFile: async (id, file) => files.set(id, file),
    getFile: async (id) => files.get(id),
    deleteFile: async (id) => files.delete(id),
    getAdmin: async () => admin,
    createAdmin: async (a) => {
      if (admin) return false;
      admin = structuredClone(a);
      return true;
    },
    putSession: async (id, s) => sessions.set(id, s),
    getSession: async (id) => sessions.get(id),
    deleteSession: async (id) => sessions.delete(id),
    getSettings: async () => structuredClone(settings),
    saveSettings: async (c) => {
      settings = structuredClone(c);
    },
    close: async () => {},
  };
}
