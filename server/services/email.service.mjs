import nodemailer from "nodemailer";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
export function emailService(store, env) {
  const key = env.APP_ENCRYPTION_KEY
    ? Buffer.from(env.APP_ENCRYPTION_KEY, "hex")
    : null;
  function encrypt(password) {
    if (!key || key.length !== 32)
      throw Error("Email secret encryption is not configured");
    const iv = randomBytes(12),
      cipher = createCipheriv("aes-256-gcm", key, iv),
      bytes = Buffer.concat([cipher.update(password, "utf8"), cipher.final()]);
    return {
      iv: iv.toString("hex"),
      tag: cipher.getAuthTag().toString("hex"),
      data: bytes.toString("hex"),
    };
  }
  function decrypt(secret) {
    if (!secret) return "";
    if (!key || key.length !== 32)
      throw Error(
        "The server encryption key is required to read SMTP credentials",
      );
    const cipher = createDecipheriv(
      "aes-256-gcm",
      key,
      Buffer.from(secret.iv, "hex"),
    );
    cipher.setAuthTag(Buffer.from(secret.tag, "hex"));
    return Buffer.concat([
      cipher.update(Buffer.from(secret.data, "hex")),
      cipher.final(),
    ]).toString("utf8");
  }
  const fallback = () =>
    env.SMTP_HOST && (!store.currentTenant || store.currentTenant() === "main")
      ? {
          host: env.SMTP_HOST,
          port: Number(env.SMTP_PORT || 587),
          secure: env.SMTP_SECURE === "true",
          username: env.SMTP_USER || "",
          password: env.SMTP_PASS || "",
          from: env.SMTP_FROM || env.SMTP_USER,
          enabled: true,
        }
      : null;
  async function config() {
    const saved = await store.getSettings();
    return saved ? { ...saved, password: decrypt(saved.secret) } : fallback();
  }
  function transport(c) {
    return nodemailer.createTransport({
      host: c.host,
      port: c.port,
      secure: c.secure,
      requireTLS: !!c.password && !c.secure,
      auth: c.username ? { user: c.username, pass: c.password } : undefined,
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 20000,
      disableFileAccess: true,
      disableUrlAccess: true,
    });
  }
  function redact(c) {
    return c
      ? {
          host: c.host,
          port: c.port,
          secure: c.secure,
          username: c.username,
          from: c.from,
          enabled: c.enabled,
          hasPassword: !!c.password,
          verifiedAt: c.verifiedAt || null,
        }
      : {
          host: "",
          port: 587,
          secure: false,
          username: "",
          from: "",
          enabled: false,
          hasPassword: false,
          verifiedAt: null,
        };
  }
  async function save(input) {
    if (
      typeof input.host !== "string" ||
      !/^[a-zA-Z0-9.-]+$/.test(input.host) ||
      input.host.length > 253
    )
      throw Error("Enter a valid SMTP hostname");
    const port = Number(input.port);
    if (!Number.isInteger(port) || port < 1 || port > 65535)
      throw Error("Enter a valid SMTP port");
    if (
      typeof input.from !== "string" ||
      !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(input.from)
    )
      throw Error("Enter a valid sender email");
    const old = await config();
    const password =
      typeof input.password === "string" && input.password
        ? input.password
        : old?.password || "";
    const username = String(input.username || "").trim();
    if (username.length > 254 || password.length > 1024)
      throw Error("Invalid SMTP credentials");
    if (username && !password)
      throw Error("Enter your SMTP password or app password");
    const c = {
      host: input.host.trim(),
      port,
      secure: input.secure === true,
      username,
      password,
      from: input.from.trim(),
      enabled: input.enabled === true,
    };
    const t = transport(c);
    try {
      await t.verify();
    } catch (e) {
      throw Error(
        "SMTP connection failed: " +
          String(e.code || e.responseCode || "connection error"),
      );
    } finally {
      t.close();
    }
    const { password: _, ...stored } = c;
    c.verifiedAt = new Date().toISOString();
    stored.verifiedAt = c.verifiedAt;
    stored.secret = encrypt(password);
    await store.saveSettings(stored);
    return redact(c);
  }
  return {
    publicSettings: async () => redact(await config()),
    configured: async () => !!(await config())?.host,
    enabled: async () => !!(await config())?.enabled,
    save,
    verify: async () => {
      const c = await config();
      if (!c?.host)
        throw Object.assign(Error("SMTP is not configured"), { status: 503 });
      const t = transport(c);
      try {
        await t.verify();
        return { verified: true };
      } finally {
        t.close();
      }
    },
    send: async (mail) => {
      const c = await config();
      if (!c?.host || !c.enabled)
        throw Object.assign(
          Error("Configure email settings and enable reminder delivery first"),
          { status: 503 },
        );
      const t = transport(c);
      try {
        return await t.sendMail({ ...mail, from: c.from });
      } finally {
        t.close();
      }
    },
  };
}
