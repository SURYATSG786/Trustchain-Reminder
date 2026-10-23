import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { MongoClient } from "mongodb";
import { createOrganizationStore } from "../server/services/organization.service.mjs";
import { credential } from "../server/models/administrator.model.mjs";
import { emailService } from "../server/services/email.service.mjs";
import { createBackup } from "../server/services/backup.service.mjs";

test(
  "organization databases fit Atlas limits, isolate SMTP and support backup iteration",
  { skip: !process.env.TEST_MONGODB_URI },
  async () => {
    const uri = process.env.TEST_MONGODB_URI;
    const database = "tc_org_test_" + randomUUID().slice(0, 8);
    const client = await new MongoClient(uri).connect();
    const store = await createOrganizationStore({
      uri,
      database,
      backupUri: "",
    });
    try {
      assert.equal(await store.hasOrganizations(), false);
      const tenantId = await store.createOrganization({
        ...credential(
          "proof-owner@example.com",
          "integration-only-password-123",
        ),
        organization: "Integration proof",
      });
      assert.ok(tenantId);
      assert.equal(await store.hasOrganizations(), true);
      const org = await client
        .db(database)
        .collection("organizations")
        .findOne({ _id: tenantId });
      assert.ok(Buffer.byteLength(org.database) <= 38);
      const email = emailService(store, {
        SMTP_HOST: "smtp.example.com",
        SMTP_FROM: "test@example.com",
        APP_ENCRYPTION_KEY: "a".repeat(64),
      });
      assert.equal(await email.enabled(), true);
      await store.runWithTenant(tenantId, async () => {
        assert.equal(await email.enabled(), false);
        const files = [];
        for await (const file of store.allFiles()) files.push(file);
        assert.equal(files.length, 0);
        const backup = await createBackup(store, {
          BACKUP_ENCRYPTION_KEY: "b".repeat(64),
        });
        assert.equal(backup.status, "Complete");
        assert.equal((await store.listBackups()).length, 1);
      });
      assert.equal((await store.listBackups()).length, 0);
      await client
        .db(database)
        .collection("organizations")
        .insertOne({
          _id: "incomplete-proof",
          database: "invalid_missing_database",
        });
      const scanned = [];
      await store.forEachWorkspace(async () =>
        scanned.push(store.currentTenant()),
      );
      assert.deepEqual(scanned, ["main", tenantId]);
    } finally {
      const orgs = await client
        .db(database)
        .collection("organizations")
        .find({})
        .toArray();
      await store.close();
      for (const org of orgs)
        if (org._id !== "incomplete-proof")
          await client.db(org.database).dropDatabase();
      await client.db(database).dropDatabase();
      await client.close();
    }
  },
);
