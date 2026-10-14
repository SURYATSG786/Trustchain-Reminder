import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { MongoClient } from "mongodb";
import { createStore } from "../server/store.mjs";
import { createApp } from "../server/app.mjs";
import {
  createBackup,
  backupArchive,
  decryptPart,
} from "../server/backups.mjs";
import { inspectPdf, analyzePdf } from "../server/pdf.mjs";
import { verifyNptel, officialUrl, publicAddress } from "../server/nptel.mjs";
function pdf(text = "SURYA T") {
  const objs = [
    `<< /Type /Catalog /Pages 2 0 R >>`,
    `<< /Type /Pages /Kids [3 0 R] /Count 1 >>`,
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 600 800] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>`,
    `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>`,
  ];
  const stream = `BT /F1 18 Tf 40 700 Td (${text}) Tj 0 -30 Td (Blockchain and its Applications) Tj ET`;
  objs.push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
  objs.push(
    `<< /Author (Tester) /Creator (TrustChain test) /Producer (Node) /CreationDate (D:20260101000000Z) >>`,
  );
  let out = "%PDF-1.4\n",
    offsets = [0];
  for (let i = 0; i < objs.length; i++) {
    offsets.push(Buffer.byteLength(out));
    out += `${i + 1} 0 obj\n${objs[i]}\nendobj\n`;
  }
  const start = Buffer.byteLength(out);
  out +=
    `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` +
    offsets
      .slice(1)
      .map((n) => `${String(n).padStart(10, "0")} 00000 n \n`)
      .join("") +
    `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R /Info 6 0 R >>\nstartxref\n${start}\n%%EOF`;
  return Buffer.from(out);
}
test("PDF parser extracts actual text, renders pages, reads metadata and distinguishes unreadable PDFs", async () => {
  const b = pdf();
  const r = await inspectPdf(b, { render: true });
  assert.equal(r.pageCount, 1);
  assert.ok(r.lines.includes("SURYA T"));
  assert.equal(r.images.length, 1);
  const report = await analyzePdf(b);
  assert.equal(report.author, "Tester");
  assert.equal(report.risk_level, "LOW");
  assert.equal(
    (await analyzePdf(Buffer.from("%PDF-Broken"))).risk_level,
    "HIGH",
  );
});
test("NPTEL verifier never approves missing evidence, mismatched fields, hostile URLs or unavailable records", async () => {
  const base = {
    qr: "https://nptel.ac.in/noc/E_Certificate/NOC26CS34TEST",
    lines: [
      "SURYA T",
      "Blockchain and its Applications",
      "78",
      "25/25",
      "53.25/75",
      "Jan-Apr 2026",
      "NPTEL26CS34S123456",
    ],
    images: [{ hash: "page", width: 10, height: 10 }],
  };
  const bytes = Buffer.from("%PDF-original");
  const fetcher = async () => ({ status: 200, url: base.qr, bytes });
  const inspect = async () => structuredClone(base);
  assert.equal(
    (await verifyNptel(bytes, { inspect, fetcher })).status,
    "GENUINE",
  );
  let calls = 0;
  const altered = async () => {
    const r = structuredClone(base);
    if (++calls === 1) r.lines[0] = "FORGED NAME";
    return r;
  };
  assert.equal(
    (
      await verifyNptel(Buffer.from("%PDF-changed"), {
        inspect: altered,
        fetcher,
      })
    ).status,
    "FAKE",
  );
  assert.equal(
    (
      await verifyNptel(bytes, {
        inspect: async () => ({ ...base, qr: null }),
        fetcher,
      })
    ).status,
    "UNVERIFIABLE",
  );
  assert.equal(
    (
      await verifyNptel(bytes, {
        inspect: async () => ({
          ...base,
          qr: "https://nptel.ac.in.evil.test/cert",
        }),
        fetcher,
      })
    ).status,
    "FAKE",
  );
  assert.equal(
    (
      await verifyNptel(bytes, {
        inspect,
        fetcher: async () => {
          throw Error("offline");
        },
      })
    ).status,
    "UNVERIFIABLE",
  );
  assert.throws(() => officialUrl("https://nptel.ac.in@127.0.0.1/"));
  assert.equal(publicAddress("127.0.0.1"), false);
  assert.equal(publicAddress("::ffff:127.0.0.1"), false);
  assert.equal(publicAddress("169.254.169.254"), false);
  assert.equal(publicAddress("8.8.8.8"), true);
});
test(
  "MongoDB owner/admin separation, session revocation, encrypted backups, durable locks and inspection APIs",
  { skip: !process.env.TEST_MONGODB_URI },
  async (t) => {
    const uri = process.env.TEST_MONGODB_URI,
      database = "trustchain_prod_test_" + randomUUID().replaceAll("-", ""),
      client = new MongoClient(uri);
    await client.connect();
    const store = await createStore({ uri, database });
    t.after(async () => {
      await store.close();
      await client.db(database).dropDatabase();
      await client.close();
    });
    const env = {
      APP_ENCRYPTION_KEY: "a".repeat(64),
      BACKUP_ENCRYPTION_KEY: "b".repeat(64),
      CRON_SECRET: "test-scheduler-secret",
    };
    const { app, ready } = createApp(store, env);
    await ready;
    const server = app.listen(0, "127.0.0.1");
    await new Promise((r) => server.once("listening", r));
    t.after(() => new Promise((r) => server.close(r)));
    const base = `http://127.0.0.1:${server.address().port}/api`;
    let owner = "",
      admin = "";
    async function req(
      path,
      body,
      method = body ? "POST" : "GET",
      cookie = owner,
      authorization,
    ) {
      const r = await fetch(base + path, {
        method,
        headers: {
          Cookie: cookie,
          ...(authorization ? { Authorization: authorization } : {}),
          ...(body instanceof FormData
            ? {}
            : { "Content-Type": "application/json" }),
        },
        body:
          body instanceof FormData
            ? body
            : body
              ? JSON.stringify(body)
              : undefined,
      });
      return {
        status: r.status,
        body: await r.json(),
        cookie: r.headers.get("set-cookie")?.split(";")[0],
      };
    }
    let r = await req("/setup", {
      email: "owner@example.com",
      password: "owner-password-123",
      organization: "Production test",
    });
    owner = r.cookie;
    assert.equal((await req("/session")).body.role, "owner");
    assert.equal(
      (
        await req("/administrators", {
          email: "admin@example.com",
          password: "admin-password-123",
        })
      ).status,
      201,
    );
    assert.equal(
      (
        await req("/administrators", {
          email: "admin@example.com",
          password: "admin-password-123",
        })
      ).status,
      409,
    );
    r = await req("/login", {
      email: "admin@example.com",
      password: "admin-password-123",
    });
    admin = r.cookie;
    assert.equal((await req("/workspace", null, "GET", admin)).status, 200);
    assert.equal((await req("/backups", null, "GET", admin)).status, 403);
    assert.equal((await req("/settings/email", {}, "PUT", admin)).status, 403);
    assert.equal(
      (await req("/administrators", null, "GET", admin)).status,
      403,
    );
    const record = {
      title: "Contract",
      issuer: "Provider",
      owner: "Admin",
      email: "admin@example.com",
      category: "Contract",
      department: "Legal",
      issued: "2026-01-01",
      expiry: "2027-01-01",
      cost: 1000,
      reminderDays: 30,
      notes: "",
    };
    r = await req("/records", record, "POST", admin);
    assert.equal(r.status, 201);
    const id = r.body.id;
    const form = new FormData();
    form.set(
      "file",
      new Blob([pdf()], { type: "application/pdf" }),
      "evidence.pdf",
    );
    form.set("issuer", "Provider");
    form.set("record_id", id);
    r = await req("/v1/claims/upload", form, "POST", admin);
    assert.equal(r.status, 201);
    const documentId = r.body.document.id;
    r = await req("/v1/forensics/analyze", { documentId }, "POST", admin);
    assert.equal(r.body.page_count, 1);
    assert.equal(r.body.author, "Tester");
    r = await req(
      "/v1/verify/nptel-certificate",
      { documentId },
      "POST",
      admin,
    );
    assert.equal(r.body.status, "UNVERIFIABLE");
    assert.equal(
      (
        await req(
          "/administrators/status",
          { email: "owner@example.com", active: false },
          "PUT",
        )
      ).status,
      404,
    );
    await req(
      "/administrators/status",
      { email: "admin@example.com", active: false },
      "PUT",
    );
    assert.equal((await req("/workspace", null, "GET", admin)).status, 401);
    await req(
      "/administrators/status",
      { email: "admin@example.com", active: true },
      "PUT",
    );
    const b = await createBackup(store, env, "test");
    const archive = await backupArchive(store, b._id);
    assert.equal(archive.parts.length, 2);
    const restored = decryptPart(archive.parts[0], env);
    assert.equal(restored.state.records[0].id, id);
    assert.equal(restored.accounts.length, 2);
    assert.equal(
      restored.accounts.find((a) => a.email === "owner@example.com")
        .passwordHash.length,
      128,
    );
    assert.equal(
      decryptPart(archive.parts[1], env).data,
      pdf().toString("base64"),
    );
    assert.throws(() =>
      decryptPart(archive.parts[0], { BACKUP_ENCRYPTION_KEY: "c".repeat(64) }),
    );
    assert.ok(!JSON.stringify(archive).includes("owner-password"));
    const corrupt = {
      ...archive.parts[1],
      tag: Buffer.alloc(16).toString("base64"),
    };
    assert.throws(() => decryptPart(corrupt, env));
    assert.equal((await req(`/backups/${b._id}/download`)).status, 200);
    const lock = await store.acquireLock("test");
    assert.ok(lock);
    const secondStore = await createStore({ uri, database });
    assert.equal(await secondStore.acquireLock("test"), null);
    await secondStore.close();
    await store.releaseLock("test", lock);
    assert.equal(await store.reserveDelivery("same-day"), true);
    assert.equal(await store.reserveDelivery("same-day"), false);
    assert.equal((await req("/cron/daily")).status, 401);
    assert.equal(
      (await req("/cron/daily", null, "GET", "", `Bearer ${env.CRON_SECRET}`))
        .status,
      200,
    );
    r = await req("/login", {
      email: "admin@example.com",
      password: "admin-password-123",
    });
    admin = r.cookie;
    assert.equal(
      (
        await req(
          "/account/password",
          {
            currentPassword: "admin-password-123",
            password: "new-private-password-123",
          },
          "POST",
          admin,
        )
      ).status,
      200,
    );
    assert.equal((await req("/workspace", null, "GET", admin)).status, 401);
    assert.equal(
      (
        await req("/login", {
          email: "admin@example.com",
          password: "new-private-password-123",
        })
      ).status,
      200,
    );
  },
);

test(
  "Independent backup destination survives source loss and CLI restore recovers into an empty database",
  { skip: !process.env.TEST_MONGODB_URI },
  async (t) => {
    const { credential } = await import("../server/auth.mjs");
    const { writeFile, unlink } = await import("node:fs/promises");
    const { tmpdir } = await import("node:os");
    const { join } = await import("node:path");
    const { execFile } = await import("node:child_process");
    const { promisify } = await import("node:util");
    const run = promisify(execFile);
    const uri = process.env.TEST_MONGODB_URI,
      id = randomUUID().replaceAll("-", ""),
      source = "trustchain_restore_source_" + id,
      destination = "trustchain_restore_backup_" + id,
      target = "trustchain_restore_target_" + id,
      path = join(tmpdir(), "trustchain-" + id + ".backup.json");
    const client = new MongoClient(uri);
    await client.connect();
    const store = await createStore({
      uri,
      database: source,
      backupUri: uri,
      backupDatabase: destination,
    });
    t.after(async () => {
      await store.close();
      for (const n of [source, destination, target])
        await client.db(n).dropDatabase();
      await client.close();
      await unlink(path).catch(() => {});
    });
    await store.createAdmin(
      credential("restore@example.com", "restore-password-123"),
    );
    const env = {
      ...process.env,
      BACKUP_ENCRYPTION_KEY: "d".repeat(64),
      MONGODB_URI: uri,
      MONGODB_DATABASE: source,
    };
    const b = await createBackup(store, env, "test");
    assert.equal(store.backupIsIndependent, true);
    const archive = await backupArchive(store, b._id);
    await writeFile(path, JSON.stringify(archive), { mode: 0o600 });
    await client.db(source).dropDatabase();
    assert.equal((await store.getBackup(b._id)).parts, 1);
    const r = await run(
      process.execPath,
      ["scripts/backup.mjs", "restore", path, target],
      { env },
    );
    assert.ok(r.stdout.includes("Restored 0 records"));
    const recovered = await createStore({ uri, database: target });
    assert.equal((await recovered.getAdmin()).email, "restore@example.com");
    await recovered.close();
    await assert.rejects(() =>
      run(process.execPath, ["scripts/backup.mjs", "restore", path, target], {
        env,
      }),
    );
  },
);

test(
  "Vercel Express entry serves frontend and APIs behind HTTPS proxy without local background timers",
  { skip: !process.env.TEST_MONGODB_URI },
  async (t) => {
    const { execFile } = await import("node:child_process");
    const { promisify } = await import("node:util");
    const run = promisify(execFile);
    const database =
        "trustchain_vercel_test_" + randomUUID().replaceAll("-", ""),
      client = new MongoClient(process.env.TEST_MONGODB_URI);
    await client.connect();
    t.after(async () => {
      await client.db(database).dropDatabase();
      await client.close();
    });
    const code = `import assert from 'node:assert/strict';import app from './app.mjs';const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const base='http://127.0.0.1:'+server.address().port;const health=await fetch(base+'/api/v1/health');assert.equal((await health.json()).version,'3.0.0');assert.equal((await fetch(base+'/')).status,200);const response=await fetch(base+'/api/setup',{method:'POST',headers:{'Content-Type':'application/json','x-forwarded-proto':'https',Origin:'https://127.0.0.1:'+server.address().port},body:JSON.stringify({email:'vercel-test@example.com',password:'vercel-test-password-123'})});assert.equal(response.status,200);assert.ok(response.headers.get('set-cookie').includes('Secure'));const bad=await fetch(base+'/api/login',{method:'POST',headers:{'Content-Type':'application/json','x-forwarded-proto':'https',Origin:'https://evil.test'},body:'{}'});assert.equal(bad.status,403);console.log('Vercel adapter checks passed');server.close(()=>process.exit(0));`;
    const r = await run(process.execPath, ["--input-type=module", "-e", code], {
      env: {
        ...process.env,
        MONGODB_URI: process.env.TEST_MONGODB_URI,
        MONGODB_DATABASE: database,
        APP_ENCRYPTION_KEY: "e".repeat(64),
        NODE_ENV: "production",
        VERCEL: "1",
      },
      timeout: 20000,
    });
    assert.ok(r.stdout.includes("Vercel adapter checks passed"));
  },
);

test("NPTEL registration gate rejects confirmed forgery before storing bytes or mining a block", async (t) => {
  const { createTestStore } = await import("./helpers.mjs");
  const store = await createTestStore({ empty: true });
  const runtime = createApp(
    store,
    { ADMIN_EMAIL: "gate@example.com", ADMIN_PASSWORD: "gate-password-123" },
    {
      inspectPdf: async () => ({
        qr: "https://nptel.ac.in/noc/E_Certificate/NOC123",
        lines: [],
        images: [],
      }),
      verifyNptel: async () => ({
        status: "FAKE",
        verified: false,
        reason: "Candidate name mismatch",
      }),
    },
  );
  await runtime.ready;
  const server = runtime.app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  t.after(() => new Promise((r) => server.close(r)));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const login = await fetch(base + "/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "gate@example.com",
      password: "gate-password-123",
    }),
  });
  const cookie = login.headers.get("set-cookie").split(";")[0];
  const form = new FormData();
  form.set("file", new Blob([pdf()]), "forged.pdf");
  form.set("issuer", "NPTEL");
  const r = await fetch(base + "/v1/claims/upload", {
    method: "POST",
    headers: { Cookie: cookie },
    body: form,
  });
  assert.equal(r.status, 422);
  assert.equal((await store.read()).chain.length, 0);
  assert.equal((await store.read()).claims.length, 0);
});
