import { audit, status } from "../domain.mjs";

export function createWorkspaceService({ store }) {
  let queue = Promise.resolve();
  async function mutate(fn) {
    const work = queue.then(async () => {
      for (let retry = 0; retry < 5; retry++) {
        const state = await store.read(),
          revision = state.revision;
        if (!audit(state.chain).valid)
          throw Object.assign(
            Error("Audit chain integrity failure. Writes are blocked."),
            { status: 409 },
          );
        const result = await fn(state);
        state.revision++;
        if (await store.save(state, revision)) return result;
      }
      throw Object.assign(Error("Workspace changed. Please try again."), {
        status: 409,
      });
    });
    queue = work.catch(() => {});
    return work;
  }
  function find(state, id) {
    const r = state.records.find((x) => x.id === id);
    if (!r) throw Object.assign(Error("Record not found"), { status: 404 });
    return r;
  }
  return { mutate, find };
}
