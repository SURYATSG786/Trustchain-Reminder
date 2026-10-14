import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { MongoClient } from "mongodb";
import { createStore } from "../server/store.mjs";
import { createApp } from "../server/app.mjs";
import { hash } from "../server/domain.mjs";
test(
  "real MongoDB workspace: setup, authentication, multipart API registration, hash verification, renewal and restart persistence",
  { skip: !process.env.TEST_MONGODB_URI },
  async (t) => {
    const uri = process.env.TEST_MONGODB_URI,
      database = "trustchain_e2e_" + randomUUID().replaceAll("-", "");
    const client = new MongoClient(uri);
    await client.connect();
    t.after(async () => {
      await client.db(database).dropDatabase();
      await client.close();
    });
    const store = await createStore({ uri, database });
    t.after(() => store.close());
    const { app, ready } = createApp(store, {
      APP_ENCRYPTION_KEY: "a".repeat(64),
    });
    await ready;
    const server = app.listen(0, "127.0.0.1");
    await new Promise((r) => server.once("listening", r));
    t.after(() => new Promise((r) => server.close(r)));
    const base = `http://127.0.0.1:${server.address().port}`;
    let cookie = "";
    async function request(path, body, method = body ? "POST" : "GET") {
      const res = await fetch(base + "/api" + path, {
        method,
        headers: {
          Cookie: cookie,
          ...(body instanceof FormData
            ? {}
            : { "Content-Type": "application/json" }),
        },
        body:
          body instanceof FormData
            ? body
            : body
              ? JSON.stringify(body)
              : undefined,
      });
      if (res.headers.get("set-cookie"))
        cookie = res.headers.get("set-cookie").split(";")[0];
      return {
        status: res.status,
        body: res.headers.get("content-type")?.includes("json")
          ? await res.json()
          : Buffer.from(await res.arrayBuffer()),
      };
    }
    assert.equal((await request("/session")).body.setupRequired, true);
    assert.equal((await request("/workspace")).status, 401);
    const credentials = {
      email: "owner@example.com",
      password: "private-password-123",
      organization: "Integration Organization",
    };
    assert.equal((await request("/setup", credentials)).status, 200);
    assert.equal((await request("/setup", credentials)).status, 409);
    let state = (await request("/workspace")).body;
    assert.equal(state.records.length, 0);
    assert.equal(state.claims.length, 0);
    assert.equal(state.chain.length, 0);
    const record = {
      title: "Actual API contract",
      category: "Contract",
      department: "Legal",
      issuer: "API Vendor",
      owner: "Owner",
      email: "owner@example.com",
      issued: "2026-01-01",
      expiry: "2027-01-01",
      cost: 5000,
      reminderDays: 30,
      notes: "",
    };
    const created = await request("/records", record);
    assert.equal(created.status, 201);
    const bytes = Buffer.from("%PDF-1.4\nReal API integration test\n%%EOF");
    const form = new FormData();
    form.set(
      "file",
      new Blob([bytes], { type: "application/pdf" }),
      "contract.pdf",
    );
    form.set("asset_type", "CONTRACT");
    form.set("issuer", "API Vendor");
    form.set("record_id", created.body.id);
    const registered = await request("/v1/claims/upload", form);
    assert.equal(registered.status, 201);
    assert.equal(registered.body.provenance.integrity.claim_valid, true);
    assert.equal(registered.body.provenance.integrity.chain_valid, true);
    const digest = registered.body.file_hash;
    const verified = await request("/v1/claims/" + digest + "/verify");
    assert.equal(verified.body.found, true);
    assert.equal(verified.body.provenance.integrity.document_valid, true);
    assert.equal(verified.body.provenance.trust.verdict, "INTEGRITY VERIFIED");
    assert.equal((await request("/v1/claims/upload", form)).status, 409);
    assert.equal(
      (await request("/v1/claims/" + "f".repeat(64) + "/verify")).body.found,
      false,
    );
    assert.deepEqual(
      (await request("/documents/" + registered.body.document.id)).body,
      bytes,
    );
    const provenance = await request(
      "/v1/claims/" + registered.body.block_index + "/report",
    );
    assert.equal(provenance.body.asset.file_hash, digest);
    const renewed = await request("/records/" + created.body.id + "/renew", {
      expiry: "2028-01-01",
      note: "Approved renewal",
    });
    assert.equal(renewed.status, 200);
    assert.equal(renewed.body.history[0].oldExpiry, "2027-01-01");
    assert.equal(
      renewed.body.history[0].documents[0],
      registered.body.document.id,
    );
    assert.equal((await request("/v1/chain/audit")).body.chain_valid, true);
    assert.equal((await request("/v1/chain")).body.total_blocks, 3);
    assert.equal((await request("/settings/email")).body.hasPassword, false);
    // New API/store connection simulates a process restart: credentials, session, records and evidence remain in MongoDB.
    const reopened = await createStore({ uri, database });
    t.after(() => reopened.close());
    const second = createApp(reopened, { APP_ENCRYPTION_KEY: "a".repeat(64) });
    await second.ready;
    const server2 = second.app.listen(0, "127.0.0.1");
    await new Promise((r) => server2.once("listening", r));
    t.after(() => new Promise((r) => server2.close(r)));
    const persisted = await fetch(
      `http://127.0.0.1:${server2.address().port}/api/workspace`,
      { headers: { Cookie: cookie } },
    );
    assert.equal(persisted.status, 200);
    const persistedBody = await persisted.json();
    assert.equal(persistedBody.records[0].expiry, "2028-01-01");
    assert.equal(persistedBody.claims[0].file_hash, digest);
    await client
      .db(database)
      .collection("documents")
      .updateOne(
        { _id: registered.body.document.id },
        {
          $set: {
            data: Buffer.from("%PDF-1.4\nCHANGED"),
            hash: hash(Buffer.from("%PDF-1.4\nCHANGED")),
          },
        },
      );
    const changed = await request("/v1/claims/" + digest + "/verify");
    assert.equal(changed.body.provenance.integrity.document_valid, false);
    assert.equal(changed.body.provenance.trust.risk_tier, "CRITICAL");
    assert.equal(
      (await request("/documents/" + registered.body.document.id)).status,
      409,
    );
    await request("/logout", {});
    assert.equal((await request("/workspace")).status, 401);
    assert.equal(
      (await request("/login", { ...credentials, password: "wrong" })).status,
      401,
    );
    assert.equal((await request("/login", credentials)).status, 200);
  },
);
