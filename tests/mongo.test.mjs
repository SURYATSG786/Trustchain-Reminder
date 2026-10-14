import { seed } from "./fixtures.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { MongoClient } from "mongodb";
import { createStore } from "../server/store.mjs";
import { appendBlock, audit, hash } from "../server/domain.mjs";
test(
  "MongoDB retains records, PDF bytes and chain across connections; rejects stale writes",
  { skip: !process.env.TEST_MONGODB_URI },
  async (t) => {
    const uri = process.env.TEST_MONGODB_URI,
      database = "trustchain_test_" + randomUUID().replaceAll("-", "");
    const cleanup = new MongoClient(uri);
    await cleanup.connect();
    t.after(async () => {
      await cleanup.db(database).dropDatabase();
      await cleanup.close();
    });
    let store = await createStore({ uri, database });
    const s = await store.read();
    s.records.push({ ...seed().records[0], id: "persistence-test" });
    appendBlock(
      s,
      "Created",
      "persistence-test",
      { title: "Persistence" },
      "test",
    );
    s.revision = 1;
    assert.equal(await store.save(s, 0), true);
    assert.equal(await store.save({ ...s, revision: 2 }, 0), false);
    const bytes = Buffer.from("%PDF-1.4\nPersistence test\n%%EOF");
    await store.putFile("document", {
      data: bytes,
      name: "test.pdf",
      hash: hash(bytes),
    });
    await store.close();
    store = await createStore({ uri, database });
    t.after(() => store.close());
    const persisted = await store.read();
    assert.equal(persisted.records[0].id, "persistence-test");
    assert.equal(audit(persisted.chain).valid, true);
    assert.deepEqual((await store.getFile("document")).data, bytes);
  },
);
