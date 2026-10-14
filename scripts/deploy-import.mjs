import { readFile } from "node:fs/promises";
const [destination, file] = process.argv.slice(2);
const url = new URL(destination);
if (url.protocol !== "https:" || !file || !process.env.CRON_SECRET)
  throw Error(
    "Use a deployment HTTPS URL, encrypted archive path and private CRON_SECRET environment variable",
  );
const content = await readFile(file, "utf8");
let archive;
try {
  archive = JSON.parse(content);
} catch {
  const rows = content
    .trim()
    .split("\n")
    .map((l) => JSON.parse(l));
  archive = { ...rows[0], parts: rows.slice(1) };
}
if (archive.format !== "TrustChain encrypted backup")
  throw Error("Expected an encrypted TrustChain backup");
const response = await fetch(new URL("/api/deployment/import", url), {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${process.env.CRON_SECRET}`,
  },
  body: JSON.stringify(archive),
  signal: AbortSignal.timeout(120000),
});
const result = await response.json();
if (!response.ok)
  throw Error(result.error || `Migration failed (${response.status})`);
console.log(JSON.stringify(result));
