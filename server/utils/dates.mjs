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
