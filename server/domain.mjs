import { createHash, randomUUID } from "node:crypto";
export const categories = [
  "Contract",
  "License",
  "Certification",
  "Warranty",
  "Insurance",
  "Subscription",
  "Permit",
];
export const departments = [
  "Operations",
  "Finance",
  "IT & Security",
  "Legal",
  "People",
];
export const day = 86400000;
export function daysLeft(date, now = new Date()) {
  return Math.round(
    (Date.parse(date + "T00:00:00Z") -
      Date.parse(now.toISOString().slice(0, 10) + "T00:00:00Z")) /
      day,
  );
}
export function status(record) {
  const n = daysLeft(record.expiry);
  return n < 0 ? "Expired" : n <= 30 ? "Due soon" : "Active";
}
export function hash(value) {
  return createHash("sha256").update(value).digest("hex");
}
export function appendBlock(state, action, recordId, detail, actor) {
  const event = {
    id: randomUUID(),
    at: new Date().toISOString(),
    action,
    recordId,
    detail,
    actor,
  };
  const previousHash = state.chain.at(-1)?.hash || "0".repeat(64);
  const block = { index: state.chain.length, previousHash, event, nonce: 0 };
  while (!hash(JSON.stringify(block)).startsWith("000")) block.nonce++;
  block.hash = hash(JSON.stringify(block));
  state.chain.push(block);
  return block;
}
export function audit(chain) {
  for (let i = 0; i < chain.length; i++) {
    const { hash: stored, ...body } = chain[i];
    if (
      body.index !== i ||
      body.previousHash !== (i ? chain[i - 1].hash : "0".repeat(64)) ||
      hash(JSON.stringify(body)) !== stored ||
      !stored.startsWith("000")
    )
      return { valid: false, blocks: chain.length, invalidBlock: i };
  }
  return {
    valid: true,
    blocks: chain.length,
    head: chain.at(-1)?.hash || null,
  };
}
export function validateRecord(input) {
  const r = {};
  for (const [key, max] of [
    ["title", 120],
    ["issuer", 120],
    ["owner", 80],
    ["email", 180],
    ["notes", 2000],
  ]) {
    if (
      typeof input[key] !== "string" ||
      input[key].trim().length > max ||
      (key !== "notes" && !input[key].trim())
    )
      throw Error(`Invalid ${key}`);
    r[key] = input[key].trim();
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r.email))
    throw Error("Enter a valid reminder email");
  if (
    !categories.includes(input.category) ||
    !departments.includes(input.department)
  )
    throw Error("Invalid category or department");
  r.category = input.category;
  r.department = input.department;
  for (const key of ["issued", "expiry"]) {
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(input[key]) ||
      !Number.isFinite(Date.parse(input[key])) ||
      new Date(input[key]).toISOString().slice(0, 10) !== input[key]
    )
      throw Error(`Invalid ${key} date`);
    r[key] = input[key];
  }
  if (r.expiry <= r.issued) throw Error("Expiry must follow the issue date");
  r.cost = Number(input.cost);
  if (!Number.isFinite(r.cost) || r.cost < 0 || r.cost > 1e12)
    throw Error("Invalid annual cost");
  r.reminderDays = Number(input.reminderDays);
  if (![7, 15, 30, 60, 90].includes(r.reminderDays))
    throw Error("Invalid reminder period");
  return r;
}
