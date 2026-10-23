import { randomUUID } from "node:crypto";

import {
  appendBlock,
  audit,
  validateRecord,
  status,
  daysLeft,
} from "../domain.mjs";

export function createRenewalController({ store, email, mutate, find }) {
  return {
    getWorkspace: async (req, res) => {
      const s = await store.read();
      res.json({
        ...s,
        records: s.records.map((r) => ({
          ...r,
          status: status(r),
          daysLeft: daysLeft(r.expiry),
        })),
        audit: audit(s.chain),
        smtpConfigured: await email.configured(),
        emailEnabled: await email.enabled(),
      });
    },
    createRecord: async (req, res) => {
      const fields = validateRecord(req.body);
      const record = await mutate((state) => {
        if (state.records.length >= 1000)
          throw Error("Workspace record limit reached");
        const r = {
          ...fields,
          id: randomUUID(),
          createdAt: new Date().toISOString(),
          documents: [],
          history: [],
        };
        state.records.push(r);
        appendBlock(state, "Created", r.id, { record: fields }, req.user.email);
        return r;
      });
      res.status(201).json(record);
    },
    updateRecord: async (req, res) => {
      const fields = validateRecord(req.body);
      res.json(
        await mutate((state) => {
          const r = find(state, req.params.id);
          if (fields.expiry !== r.expiry)
            throw Error(
              "Use Renew to change expiry and preserve renewal history",
            );
          const before = { ...r };
          Object.assign(r, fields);
          appendBlock(
            state,
            "Updated",
            r.id,
            { before, after: fields },
            req.user.email,
          );
          return r;
        }),
      );
    },
    renewRecord: async (req, res) => {
      res.json(
        await mutate((state) => {
          const r = find(state, req.params.id);
          const fields = validateRecord({
            ...r,
            issued: r.expiry,
            expiry: req.body.expiry,
          });
          if (fields.expiry <= r.expiry)
            throw Error("New expiry must follow the previous expiry");
          const entry = {
            at: new Date().toISOString(),
            oldExpiry: r.expiry,
            newExpiry: fields.expiry,
            note: String(req.body.note || "").slice(0, 2000),
            actor: req.user.email,
            documents: r.documents.map((d) => d.id),
          };
          r.history.push(entry);
          r.issued = r.expiry;
          r.expiry = fields.expiry;
          appendBlock(state, "Renewed", r.id, entry, req.user.email);
          return r;
        }),
      );
    },
    exportRecords: async (req, res) => {
      const s = await store.read();
      const cell = (v) =>
        '"' +
        String(v ?? "")
          .replace(/^([=+@\-\t\r])/, "'$1")
          .replaceAll('"', '""') +
        '"';
      const columns = [
        "title",
        "category",
        "department",
        "issuer",
        "owner",
        "email",
        "issued",
        "expiry",
        "cost",
      ];
      const csv = [
        columns.map(cell).join(","),
        ...s.records.map((r) => columns.map((k) => cell(r[k])).join(",")),
      ].join("\r\n");
      res.set({
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="trustchain-records.csv"',
      });
      res.send(csv);
    },
  };
}
