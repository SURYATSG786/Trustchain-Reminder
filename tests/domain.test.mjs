import { seed } from "./fixtures.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import {
  audit,
  appendBlock,
  validateRecord,
  daysLeft,
  status,
} from "../server/domain.mjs";
test("audit detects changed event, broken linkage, nonce, and index", () => {
  const state = seed();
  assert.equal(audit(state.chain).valid, true);
  for (const tamper of [
    (b) => (b.event.action = "Forged"),
    (b) => (b.previousHash = "x"),
    (b) => b.nonce++,
    (b) => (b.index = 100),
  ]) {
    const copy = structuredClone(state.chain);
    tamper(copy[2]);
    assert.equal(audit(copy).valid, false);
  }
});
test("date boundaries use whole UTC calendar days", () => {
  assert.equal(daysLeft("2026-10-05", new Date("2026-10-05T23:59:00Z")), 0);
  assert.equal(daysLeft("2026-10-04", new Date("2026-10-05T00:00:00Z")), -1);
  const date = (n) =>
    new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
  assert.equal(status({ expiry: date(30) }), "Due soon");
  assert.equal(status({ expiry: date(31) }), "Active");
  assert.equal(status({ expiry: date(-1) }), "Expired");
});
test("reject invalid date rollover, reversed dates, negative cost, unsupported category", () => {
  const record = { ...seed().records[0] };
  assert.ok(validateRecord(record));
  for (const patch of [
    { expiry: "2027-02-30" },
    { expiry: record.issued },
    { cost: -1 },
    { category: "Other" },
    { email: "invalid" },
    { reminderDays: 0 },
  ])
    assert.throws(() => validateRecord({ ...record, ...patch }));
});
test("new events extend the existing proof of work chain", () => {
  const s = { chain: [] };
  appendBlock(s, "Created", "record", { title: "Test" }, "tester");
  appendBlock(s, "Renewed", "record", { expiry: "2027-01-01" }, "tester");
  assert.equal(audit(s.chain).valid, true);
  assert.equal(s.chain[1].previousHash, s.chain[0].hash);
});
