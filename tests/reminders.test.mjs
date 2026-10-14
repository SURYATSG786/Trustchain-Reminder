import test from "node:test";
import assert from "node:assert/strict";
import net from "node:net";
import { createApp } from "../server/app.mjs";
import { createTestStore as createStore } from "./helpers.mjs";
test("Nodemailer sends due reminders to a local SMTP test server, records delivery and avoids same-day duplicates", async (t) => {
  let messages = 0;
  const sockets = new Set();
  const smtp = net.createServer((socket) => {
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
    socket.write("220 localhost test SMTP\r\n");
    let buffer = "",
      inData = false;
    socket.on("data", (chunk) => {
      buffer += chunk.toString();
      let end;
      while ((end = buffer.indexOf("\r\n")) >= 0) {
        const line = buffer.slice(0, end);
        buffer = buffer.slice(end + 2);
        if (inData) {
          if (line === ".") {
            inData = false;
            messages++;
            socket.write("250 Message accepted\r\n");
          }
          continue;
        }
        if (line.startsWith("EHLO") || line.startsWith("HELO"))
          socket.write("250 localhost\r\n");
        else if (line.startsWith("MAIL") || line.startsWith("RCPT"))
          socket.write("250 OK\r\n");
        else if (line === "DATA") {
          inData = true;
          socket.write("354 End with dot\r\n");
        } else if (line === "QUIT") {
          socket.write("221 Bye\r\n");
          socket.end();
        } else socket.write("250 OK\r\n");
      }
    });
  });
  smtp.listen(0, "127.0.0.1");
  await new Promise((r) => smtp.once("listening", r));
  t.after(() => {
    for (const s of sockets) s.destroy();
    return new Promise((r) => smtp.close(r));
  });
  const store = await createStore();
  const { sendReminders } = createApp(store, {
    SMTP_HOST: "127.0.0.1",
    SMTP_PORT: smtp.address().port,
    SMTP_FROM: "test@example.com",
  });
  const first = await sendReminders("Test");
  assert.equal(first.sent, 4);
  assert.equal(first.failed, 0);
  assert.equal(messages, 4);
  const second = await sendReminders("Test");
  assert.equal(second.sent, 0);
  assert.equal(second.skipped, 4);
  assert.equal(messages, 4);
  assert.equal((await store.read()).notifications.length, 4);
});
