import test from "node:test";
import assert from "node:assert/strict";
import { createSystemController } from "../server/controllers/system.controller.mjs";

for (const failTenant of [null, "org-one"]) {
  test(`cloud reminder scheduler visits every workspace${failTenant ? " despite a delivery error" : ""}`, async () => {
    let current = "main";
    const visited = [];
    const store = {
      currentTenant: () => current,
      forEachWorkspace: async (fn) => {
        for (const id of ["main", "org-one", "org-two"]) {
          current = id;
          await fn();
        }
        current = "main";
      },
    };
    const controller = createSystemController({
      store,
      env: { CRON_SECRET: "test-scheduler-secret" },
      email: { enabled: async () => true },
      sendReminders: async () => {
        visited.push(current);
        if (current === failTenant) throw Error("test delivery failure");
        return { sent: 1 };
      },
    });
    let status, payload;
    const res = {
      status(code) { status = code; return this; },
      json(value) { payload = value; return this; },
    };
    await controller.runScheduledJobs({
      path: "/api/cron/reminders",
      headers: { authorization: "Bearer test-scheduler-secret" },
    }, res);
    assert.deepEqual(visited, ["main", "org-one", "org-two"]);
    assert.equal(status, failTenant ? 503 : 200);
    assert.equal(payload.workspaces.length, 3);
    assert.deepEqual(payload.workspaces.map(x => x.tenantId), visited);
    if (failTenant) assert.equal(payload.workspaces[1].reminders.error, "test delivery failure");
  });
}
