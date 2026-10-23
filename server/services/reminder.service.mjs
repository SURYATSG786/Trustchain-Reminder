import { randomUUID } from "node:crypto";

import { appendBlock, audit, status, daysLeft } from "../domain.mjs";

export function createReminderService({ store, env, email, mutate, find }) {
  let sending = false;
  async function sendReminders(actor = "Scheduler") {
    if (sending)
      throw Object.assign(Error("Reminder scan is already running"), {
        status: 409,
      });
    if (!(await email.enabled()))
      throw Object.assign(
        Error("Configure email settings and enable reminder delivery first"),
        { status: 503 },
      );
    const lock = store.acquireLock
      ? await store.acquireLock("reminders", 300000)
      : "local";
    if (!lock)
      throw Object.assign(Error("Reminder scan is already running"), {
        status: 409,
      });
    sending = true;
    const result = { sent: 0, failed: 0, skipped: 0, remaining: 0 };
    const started = Date.now();
    try {
      const state = await store.read();
      if (!audit(state.chain).valid)
        throw Object.assign(
          Error("Audit chain integrity failure. Reminder delivery is blocked."),
          { status: 409 },
        );
      const today = new Date().toISOString().slice(0, 10);
      for (const r of state.records) {
        if (daysLeft(r.expiry) > r.reminderDays) continue;
        const key = `${r.id}:${r.expiry}:${today}`;
        if (
          state.notifications.some((n) => n.key === key && n.status === "Sent")
        ) {
          result.skipped++;
          continue;
        }
        if (Date.now() - started > 200000) {
          result.remaining++;
          continue;
        }
        if (store.reserveDelivery && !(await store.reserveDelivery(key))) {
          result.skipped++;
          continue;
        }
        let delivery = "Sent",
          error = "";
        try {
          const info = await email.send({
            to: r.email,
            subject: `TrustChain: ${r.title} · ${status(r)}`,
            text: `${r.title}\nIssuer: ${r.issuer}\nExpiry: ${r.expiry}\nOwner: ${r.owner}\nDays remaining: ${daysLeft(r.expiry)}\nPlease review this renewal in TrustChain.`,
          });
          if (!info.accepted?.length) throw Error("Recipient was not accepted");
          result.sent++;
        } catch (e) {
          delivery = "Failed";
          error =
            "SMTP delivery failed: " +
            String(e.code || e.responseCode || "connection error");
          result.failed++;
        }
        if (store.finishDelivery) {
          await store.finishDelivery(key, delivery);
          if (delivery === "Failed") await store.releaseFailedDelivery(key);
        }
        await mutate((s) => {
          s.notifications.push({
            id: randomUUID(),
            key,
            recordId: r.id,
            title: r.title,
            to: r.email,
            status: delivery,
            error,
            at: new Date().toISOString(),
          });
          s.notifications = s.notifications.slice(-1000);
          appendBlock(
            s,
            "Reminder " + delivery.toLowerCase(),
            r.id,
            { to: r.email, expiry: r.expiry },
            actor,
          );
        });
      }
      return result;
    } finally {
      sending = false;
      if (store.releaseLock) await store.releaseLock("reminders", lock);
    }
  }
  return { sendReminders };
}
