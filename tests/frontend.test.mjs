import test from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import { seed } from "./fixtures.mjs";
import { audit, status, daysLeft } from "../server/domain.mjs";

test("extracted React pages and record components render with workspace data", async () => {
  const names = [
    "AuthPage",
    "OverviewPage",
    "RenewalRegisterPage",
    "CalendarPage",
    "DocumentsPage",
    "AuditTrailPage",
    "RemindersPage",
    "ReportsPage",
    "EmailSettings",
    "DocumentVerification",
    "CertificateInspection",
    "TeamSettings",
    "BackupSettings",
    "AccountSettings",
  ];
  const components = [
    "RecordDetails",
    "RecordForm",
    "RenewalForm",
    "RecordTable",
  ];
  const imports = [
    ...names.map(
      (name) => `import {${name}} from './frontend/src/pages/${name}.jsx';`,
    ),
    ...components.map(
      (name) =>
        `import {${name}} from './frontend/src/components/${name}.jsx';`,
    ),
  ];
  const result = await build({
    stdin: {
      contents: `import React from 'react'; import {renderToStaticMarkup} from 'react-dom/server'; ${imports.join("\n")} export function render(props) { return [${[...names, ...components].join(",")}].map(Component => renderToStaticMarkup(React.createElement(Component, props))); }`,
      resolveDir: fileURLToPath(new URL("../", import.meta.url)),
      loader: "jsx",
    },
    bundle: true,
    write: false,
    platform: "node",
    format: "cjs",
  });
  const dir = await mkdtemp(join(tmpdir(), "trustchain-ui-test-"));
  try {
    const output = join(dir, "render.cjs");
    await writeFile(output, result.outputFiles[0].contents);
    const { render } = await import(pathToFileURL(output).href);
    const data = {
      ...seed(),
      claims: [],
      smtpConfigured: false,
      emailEnabled: false,
    };
    data.records = data.records.map((r) => ({
      ...r,
      status: status(r),
      daysLeft: daysLeft(r.expiry),
    }));
    data.audit = audit(data.chain);
    const noop = () => {};
    const props = {
      data,
      records: data.records,
      session: { organization: "Test organization", role: "owner" },
      claims: [],
      expired: data.records.filter((r) => r.status === "Expired"),
      soon: data.records.filter((r) => r.status === "Due soon"),
      active: data.records.filter((r) => r.status === "Active"),
      compliance: 90,
      upcoming: data.records,
      latest: [...data.chain].reverse(),
      shown: data.records,
      table: null,
      page: "Overview",
      query: "",
      filter: "All records",
      category: "All categories",
      month: new Date(),
      selected: data.records[0],
      form: data.records[0],
      renew: data.records[0],
      busy: false,
      creating: false,
      registration: false,
      loginError: "",
    };
    for (const key of [
      "setSelected",
      "setForm",
      "setRenew",
      "setBusy",
      "setQuery",
      "setFilter",
      "setCategory",
      "setMonth",
      "setRegistration",
      "setLoginError",
      "go",
      "newRecord",
      "act",
      "load",
      "notify",
      "login",
      "onSaved",
      "onChange",
      "onPasswordChanged",
    ])
      props[key] = noop;
    const html = render(props);
    assert.equal(html.length, names.length + components.length);
    for (const markup of html) assert.ok(markup.length > 0);
    assert.match(html[0], /Welcome to TrustChain/);
    assert.match(html[1], /Upcoming renewals/);
    const empty = render({
      ...props,
      records: [],
      expired: [],
      soon: [],
      active: [],
      upcoming: [],
      shown: [],
      compliance: 0,
      data: { ...data, records: [] },
    });
    assert.match(empty[1], /Add your first renewal/);
    assert.doesNotMatch(empty[1], /Compliance rate|Recent records|0%/);
    assert.match(empty[7], /No report data yet/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
