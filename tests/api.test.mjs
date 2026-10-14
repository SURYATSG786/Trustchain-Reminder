import test from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../server/app.mjs";
import { createTestStore as createStore } from "./helpers.mjs";
import { seed } from "./fixtures.mjs";
async function fixture(t, store) {
  store ??= await createStore();
  const { app } = createApp(store, {
    ADMIN_EMAIL: "tester@example.com",
    ADMIN_PASSWORD: "test-password-123",
  });
  const server = app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  const base = `http://127.0.0.1:${server.address().port}`;
  let cookie = "";
  t.after(() => new Promise((r) => server.close(r)));
  return {
    store,
    async request(path, body, method = body ? "POST" : "GET") {
      if (path === "/login" && body && Object.keys(body).length === 0)
        body = { email: "tester@example.com", password: "test-password-123" };
      const res = await fetch(base + "/api" + path, {
        method,
        headers: { "Content-Type": "application/json", Cookie: cookie },
        body: body ? JSON.stringify(body) : undefined,
      });
      if (res.headers.get("set-cookie"))
        cookie = res.headers.get("set-cookie").split(";")[0];
      return {
        status: res.status,
        body: res.headers.get("content-type")?.includes("json")
          ? await res.json()
          : Buffer.from(await res.arrayBuffer()),
      };
    },
  };
}
test("API requires login and preserves renewal history, evidence, and audit linkage", async (t) => {
  const f = await fixture(t);
  assert.equal((await f.request("/workspace")).status, 401);
  assert.equal((await f.request("/login", {})).status, 200);
  let state = (await f.request("/workspace")).body;
  assert.equal(state.records.length, 8);
  const fields = {
    ...seed().records[0],
    title: "Integration contract",
    issued: "2026-01-01",
    expiry: "2027-01-01",
  };
  const created = await f.request("/records", fields);
  assert.equal(created.status, 201);
  const id = created.body.id;
  const original = Buffer.from("%PDF-1.4\nTrustChain test document\n%%EOF");
  const doc = await f.request(`/records/${id}/documents`, {
    name: "evidence.pdf",
    base64: original.toString("base64"),
  });
  assert.equal(doc.status, 201);
  const download = await f.request("/documents/" + doc.body.id);
  assert.deepEqual(download.body, original);
  assert.equal(
    (await f.request(`/records/${id}/renew`, { expiry: "2026-12-01" })).status,
    400,
  );
  const renewed = await f.request(`/records/${id}/renew`, {
    expiry: "2028-01-01",
    note: "Approved",
  });
  assert.equal(renewed.status, 200);
  assert.equal(renewed.body.history[0].oldExpiry, "2027-01-01");
  assert.deepEqual(renewed.body.history[0].documents, [doc.body.id]);
  assert.equal(
    (
      await f.request(
        `/records/${id}`,
        { ...fields, expiry: "2029-01-01" },
        "PUT",
      )
    ).status,
    400,
  );
  state = (await f.request("/workspace")).body;
  assert.equal(state.audit.valid, true);
  assert.equal(state.records.find((r) => r.id === id).documents.length, 1);
  assert.equal((await f.request("/reminders/send", {})).status, 503);
  assert.equal(
    (await f.request("/records/missing/renew", { expiry: "2028-01-01" }))
      .status,
    404,
  );
  const file = await f.store.getFile(doc.body.id);
  file.data[5] = 88;
  await f.store.putFile(doc.body.id, file);
  assert.equal((await f.request("/documents/" + doc.body.id)).status, 409);
  const corrupted = await f.store.read();
  corrupted.chain[0].event.action = "Forged";
  const rev = corrupted.revision;
  corrupted.revision++;
  await f.store.save(corrupted, rev);
  assert.equal((await f.request("/records", fields)).status, 409);
  await f.request("/logout", {});
  assert.equal((await f.request("/workspace")).status, 401);
});
test("configured workspace rejects wrong credentials and accepts admin login", async (t) => {
  const store = await createStore();
  const f = await fixture(t, store);
  assert.equal(
    (
      await f.request("/login", {
        email: "tester@example.com",
        password: "wrong",
      })
    ).status,
    401,
  );
  assert.equal(
    (
      await f.request("/login", {
        email: "tester@example.com",
        password: "test-password-123",
      })
    ).status,
    200,
  );
});
test("simultaneous updates retain every record and audit block", async (t) => {
  const f = await fixture(t);
  await f.request("/login", {});
  const base = { ...seed().records[0] };
  await Promise.all(
    Array.from({ length: 8 }, (_, i) =>
      f.request("/records", { ...base, title: "Concurrent " + i }),
    ),
  );
  const s = (await f.request("/workspace")).body;
  assert.equal(s.records.length, 16);
  assert.equal(s.chain.length, 16);
  assert.equal(s.audit.valid, true);
});
