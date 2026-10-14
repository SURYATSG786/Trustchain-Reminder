import { createBackup } from "./backups.mjs";
import { createStore } from "./store.mjs";
import { createApp } from "./app.mjs";
import { randomBytes } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
const keyFile = new URL("../.runtime-key", import.meta.url);
if (!process.env.APP_ENCRYPTION_KEY) {
  try {
    process.env.APP_ENCRYPTION_KEY = (await readFile(keyFile, "utf8")).trim();
  } catch (e) {
    if (e.code !== "ENOENT") throw e;
    const key = randomBytes(32).toString("hex");
    await writeFile(keyFile, key, { mode: 0o600, flag: "wx" });
    process.env.APP_ENCRYPTION_KEY = key;
  }
}
if (!/^[a-fA-F0-9]{64}$/.test(process.env.APP_ENCRYPTION_KEY))
  throw Error("APP_ENCRYPTION_KEY must contain 64 hexadecimal characters");
const store = await createStore({
  uri: process.env.MONGODB_URI,
  database: process.env.MONGODB_DATABASE,
});
const { app, sendReminders, ready } = createApp(store);
await ready;
const port = Number(process.env.PORT || 4317);
const server = app.listen(port, "127.0.0.1", (error) => {
  if (!error)
    console.log(
      `TrustChain running at http://localhost:${port} · MongoDB connected`,
    );
});
server.on("error", async (error) => {
  console.error("Server could not start:", error.message);
  await store.close();
  process.exit(1);
});
const tick = async () => {
  try {
    const settings = await store.getSettings();
    if (settings?.enabled || process.env.SMTP_HOST) await sendReminders();
  } catch (e) {
    console.error("Reminder scan:", e.message);
  }
};
const timer = setInterval(tick, 60 * 60 * 1000);
timer.unref();
setTimeout(tick, 5000).unref();
const backupTick = async () => {
  if (process.env.BACKUP_ENCRYPTION_KEY)
    try {
      await createBackup(store, process.env);
    } catch (e) {
      console.error("Backup:", e.message);
    }
};
const backupTimer = setInterval(backupTick, 86400000);
backupTimer.unref();
const shutdown = () =>
  server.close(async () => {
    clearInterval(timer);
    clearInterval(backupTimer);
    await store.close();
    process.exit(0);
  });
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
