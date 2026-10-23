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
export const fmt = (d) =>
  new Date(d + "T00:00:00").toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
export const money = (n) => "₹" + Number(n).toLocaleString("en-IN");
