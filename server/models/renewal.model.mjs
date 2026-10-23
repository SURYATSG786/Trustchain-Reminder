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
