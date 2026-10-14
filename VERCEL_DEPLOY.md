# Deploy TrustChain on Vercel

The application stays on React, Tailwind CSS, Express/Node.js and MongoDB. Vercel runs the exported Express application in `app.mjs`; the local listener in `server/index.mjs` is not used there. `public/` contains the built React bundle and logo. PDF.js, jsQR and the Node canvas binding are Node libraries for PDF parsing/rendering and QR decoding, not another backend framework.

## Configure MongoDB and secrets

Create a MongoDB Atlas database and database user; configure Atlas network access so Vercel can connect. A localhost MongoDB address cannot work from Vercel. Use an independent MongoDB cluster for disaster recovery backups, or export encrypted backups to an independent location. A backup collection on the same cluster does not protect against loss of that cluster.

Set these variables in Vercel Project → Settings → Environment Variables for Production:

| Variable | Value |
|---|---|
| `MONGODB_URI` | Atlas connection string with credentials |
| `MONGODB_DATABASE` | `trustchain` |
| `APP_ENCRYPTION_KEY` | Private 64-character hexadecimal key for SMTP settings |
| `BACKUP_ENCRYPTION_KEY` | A different private 64-character hexadecimal key |
| `CRON_SECRET` | A random secret of at least 32 characters |
| `BACKUP_MONGODB_URI` | Independent MongoDB backup destination connection string |
| `BACKUP_MONGODB_DATABASE` | `trustchain_backups` |
| `NODE_ENV` | `production` |
| `ALLOW_SETUP` | `true` for a new database; `false` after owner setup |

Generate new keys locally with `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`. Run it separately for each key. Enter the values directly in Vercel; do not commit them. Keep a secure independent copy of both encryption keys.

If migrating your existing workspace, retain its `.runtime-key` value as `APP_ENCRYPTION_KEY` and its `.env` backup key as `BACKUP_ENCRYPTION_KEY`, migrate the database using backup export/restore below, and set `ALLOW_SETUP=false`. Otherwise configure Gmail again after signing in to the new empty production workspace. GitHub contains code, not your local account or SMTP credentials.

## Import and deploy

1. Import `SURYATSG786/Trustchain-Reminder` in Vercel; use the repository root.
2. Use the Express framework preset and Node.js 22.x or 24.x. The included `vercel.json` sets the build command to `npm run build`; leave Output Directory unset for the Express application.
3. Add the environment variables above, then deploy.
4. Open the HTTPS deployment URL. Create the owner account if this is a new database. Set `ALLOW_SETUP=false` and redeploy after setup.
5. Configure Gmail in Email settings with `smtp.gmail.com`, port 465, SSL enabled, your Gmail address, and a Google app password. Verify the connection and enable delivery.
6. Create a record within its reminder window, run Send due reminders, and check inbox delivery. Test Certificate inspection with the original NPTEL PDF.
7. Check Vercel Cron Jobs for the reminder and backup executions. Create a backup from the Backups screen and download an encrypted copy.

Vercel deploys cron schedules only for production deployments. The included cron jobs use UTC: reminders at 03:00 (08:30 India time), backups at 03:30 (09:00 India time). On the Hobby plan, each job can run once per day and invocation timing is approximate. For hourly reminders on an eligible plan, change only the reminder schedule to `0 * * * *`. Local `npm start` retains hourly reminder checks and daily backup snapshots while the server runs.

Cron endpoints require `Authorization: Bearer <CRON_SECRET>`; Vercel supplies that header. MongoDB locks prevent overlapping scans across function instances. Successful and in-progress delivery reservations prevent simultaneous duplicate sends. SMTP and the database cannot commit as one transaction: if a function crashes after delivery, an in-progress reservation is retained and must be reviewed against the provider logs; the system does not blindly resend that same-day attempt. A failed send can be retried manually. A scan stops after about 200 seconds and reports `remaining`; use another scan for a large backlog, or use a more frequent eligible cron schedule. There is no guarantee of exact-once SMTP delivery after a network failure.

## Backup export and restore

Backups contain the workspace, all referenced original documents, password hashes, and encrypted SMTP configuration. Each part is gzip-compressed and authenticated with AES-256-GCM. Completed snapshots retain seven days using MongoDB TTL indexes; expiry cleanup is approximate. Snapshot creation rejects invalid chains, missing/changed document bytes, or concurrent workspace revision changes. Sessions are intentionally excluded.

For an independent archive, run locally with the production MongoDB and encryption keys supplied through private environment variables:

```sh
npm run backup:export -- /path/to/safe-storage/trustchain.ndjson
```

For an existing recovery point, append its backup ID. Files are created with owner-only access and will not overwrite existing files. The web download supports encrypted snapshots up to 3.5 MB; use the CLI for larger ones. Store archives outside the application database and host.

Restore the exported NDJSON file or a downloaded `.backup.json` into a completely empty, separately named database:

```sh
npm run backup:restore -- /path/to/trustchain.ndjson trustchain_recovered
```

Supply the original `BACKUP_ENCRYPTION_KEY`. Restore verifies authenticated encryption, chain integrity, file hashes against chain anchors, complete part counts and the owner account before writing. It refuses to overwrite a non-empty database or the configured live database. Test the recovered database, then switch `MONGODB_DATABASE` to it. Retain the original `APP_ENCRYPTION_KEY` to read SMTP credentials.

## Deployment verification

The local build and integration tests pass, including owner/admin restrictions, password/session revocation, independent backup storage and actual CLI recovery into a new MongoDB database. Live NPTEL verification succeeded for the supplied Blockchain certificate. The Vercel adapter is tested locally; an actual Vercel deployment, Atlas connectivity, scheduled execution and inbox delivery from Vercel still require verification in your deployed account.

Official platform references: [Express on Vercel](https://vercel.com/docs/frameworks/backend/express), [Cron usage limits](https://vercel.com/docs/cron-jobs/usage-and-pricing), [Managing cron jobs](https://vercel.com/docs/cron-jobs/manage-cron-jobs).

## Migrate without exposing an Atlas connection string

For a new, empty Atlas workspace, retain the existing encryption keys, set `ALLOW_SETUP=false`, and deploy. Run the local helper with the private cron secret loaded from your local `.env`:

```sh
node --env-file-if-exists=.env scripts/deploy-import.mjs https://YOUR-DEPLOYMENT.vercel.app ../TrustChain_Recovery_2026-10-14.ndjson
```

This sends the encrypted archive over HTTPS to `/api/deployment/import`. The endpoint requires the cron secret and an empty workspace, authenticates every backup part and checks chain/file integrity, then imports using a MongoDB transaction. Once an owner exists, further import attempts are refused. No login sessions are migrated. The existing owner signs in using their previous password. This web import supports archives below the 3 MB API limit; larger migrations use the CLI restore workflow.
