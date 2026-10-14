import { randomUUID } from "node:crypto";
import { day, appendBlock } from "../server/domain.mjs";
export function seed() {
  const state = { revision: 0, records: [], chain: [], notifications: [] };
  const relative = (n) =>
    new Date(Date.now() + n * day).toISOString().slice(0, 10);
  const rows = [
    [
      "Cloud infrastructure agreement",
      "Contract",
      "IT & Security",
      "Amazon Web Services",
      "Aarav Mehta",
      12,
      240000,
    ],
    [
      "ISO 27001 certification",
      "Certification",
      "IT & Security",
      "BSI Group",
      "Priya Sharma",
      24,
      85000,
    ],
    [
      "Professional indemnity cover",
      "Insurance",
      "Finance",
      "HDFC ERGO",
      "Rohan Das",
      -4,
      64000,
    ],
    [
      "Business operating permit",
      "Permit",
      "Operations",
      "Municipal Authority",
      "Ananya Rao",
      7,
      18000,
    ],
    [
      "Design team workspace",
      "Subscription",
      "Operations",
      "Figma",
      "Ananya Rao",
      48,
      32000,
    ],
    [
      "Enterprise software license",
      "License",
      "IT & Security",
      "Microsoft",
      "Aarav Mehta",
      85,
      120000,
    ],
    [
      "Office equipment warranty",
      "Warranty",
      "Operations",
      "Dell Technologies",
      "Priya Sharma",
      124,
      15000,
    ],
    [
      "Facilities service agreement",
      "Contract",
      "Legal",
      "Acme Facilities",
      "Rohan Das",
      160,
      96000,
    ],
  ];
  for (const [title, category, department, issuer, owner, n, cost] of rows) {
    const r = {
      id: randomUUID(),
      title,
      category,
      department,
      issuer,
      owner,
      email: "demo@example.com",
      issued: relative(-240),
      expiry: relative(n),
      cost,
      reminderDays: 30,
      notes: "Sample record for exploring TrustChain.",
      documents: [],
      history: [],
      createdAt: new Date().toISOString(),
    };
    state.records.push(r);
    appendBlock(
      state,
      "Created",
      r.id,
      { title, expiry: r.expiry },
      "Demo workspace",
    );
  }
  return state;
}
