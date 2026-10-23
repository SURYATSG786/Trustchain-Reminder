## Source structure

See [PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md) for the React pages/components and Express routes/controllers/services/models/repository layout and a presentation walkthrough. Source code is modular; `public/app.js` is the generated browser bundle.

# TrustChain Compliance & Renewal Management — working application

The application runs **React + Tailwind CSS, Node.js + Express.js, MongoDB, SHA-256, Proof of Work and Nodemailer**. Application data is stored in MongoDB. There is no demo mode, sample-data startup or runtime mock database.

## Open the configured local application

The current workspace is configured at **http://localhost:4317** with a real local MongoDB database named `trustchain`. On first use, create your organization and administrator account in the setup screen. Choose your own email and a password of at least 12 characters. The workspace starts empty. All further access requires sign-in.

## Install / run elsewhere

Requires Node.js 22.13+ and MongoDB Community Server or Atlas.

```sh
npm ci
npm run build
cp .env.example .env
```

Set `MONGODB_URI` and `MONGODB_DATABASE` in `.env`, start MongoDB if using a local server, then run:

```sh
npm start
```

Open `http://localhost:4317`. First-run setup persists a password hash in MongoDB; plaintext administrator passwords are not stored. Optional `ADMIN_EMAIL` and `ADMIN_PASSWORD` environment variables can initialize the account without the setup screen. Once an administrator exists, setup cannot replace it. Set `ALLOW_SETUP=false` before public hosting if first-run setup should be disabled.

## Workflow

1. **Create your organization account.** Choose your own credentials in the first-run screen.
2. **Add a renewal record.** Enter the title, category, department, issuer, owner, reminder email, issue date, expiry, annual cost and reminder window.
3. **Attach a PDF.** Open the record and upload the original document. The frontend sends a multipart request to `/api/v1/claims/upload`. Express fingerprints the actual bytes, creates a trust claim, mines a Proof of Work block and stores the bytes in MongoDB.
4. **Verify documents.** Use Document verification to register standalone files, check an uploaded file against its SHA-256 digest, inspect provenance, or download the original bytes. File checks call `/api/v1/claims/:file_hash/verify` and verify the stored bytes against the recorded fingerprint.
5. **Renew a record.** Enter the later expiry and renewal notes. Prior expiry, actor, timestamp and supporting document IDs remain in history.
6. **Connect email.** Enter your provider's SMTP details in Email settings and click Save & verify connection. The connection and authentication are tested without sending email. Enable automatic reminders when ready.
7. **Review compliance.** Dashboard, calendar, audit trail and reports use the current records returned by Express. CSV and audit JSON exports are available.

## Email configuration

In **Email settings**, enter SMTP host, port, username, app password and sender email. For port 465 select SSL/TLS; port 587 normally uses STARTTLS. Credentials that authenticate over port 587 require STARTTLS. Use your provider's documented settings.

The SMTP password is encrypted with AES-256-GCM before MongoDB storage, using Node's built-in crypto. The password and ciphertext are never returned by the settings API. The encryption key is read from `APP_ENCRYPTION_KEY`, or generated once in `.runtime-key` with restrictive permissions. Back up this key alongside the database; losing it prevents reading stored SMTP credentials. The key and `.env` are excluded from the distributable ZIP and Git.

Reminder delivery is off until enabled in settings or configured through SMTP environment variables. The server scans eligible records hourly while running, with a scan five seconds after startup. It sends to each record's configured reminder email when expiry is inside the selected 7/15/30/60/90-day window or overdue. Successful reminders are deduplicated by record, expiry and UTC date. Failed attempts are recorded and can be retried. Sent means accepted by the SMTP server, not guaranteed inbox placement. You can run a scan from the Reminders screen.

The owner configured Gmail and confirmed a reminder arrived in the inbox on 5 October 2026. New installations must configure their own SMTP credentials.

## Your original APIs

Your supplied project implements FastAPI/Python, which conflicts with your explicit Node.js/Express-only stack. Its source is preserved unchanged at `../PythonProject2`. **This application does not call the Python service.** The following original endpoint operations are ported into Express and wired to the frontend:

| Original API route | Working Express operation |
|---|---|
| `POST /api/v1/claims/upload` | Real multipart upload, SHA-256 fingerprint, claim identity, Proof of Work, MongoDB file storage and provenance |
| `GET /api/v1/claims/:file_hash/verify` | Registered fingerprint lookup, block/claim/chain checks and original stored-byte verification |
| `GET /api/v1/claims/:block_index/report` | Current provenance report for a stored block |
| `GET /api/v1/chain` | Blocks, hashes, timestamps, mining nonces and claim scores |
| `GET /api/v1/chain/audit` | Actual chain integrity and document provenance |
| `GET /api/v1/chain/block/:block_index` | Stored block provenance |
| `GET /api/v1/health` | API and database health |

The original scoring dimensions (35/25/20/15/5) and claim identity are retained as Node implementations. Scores refer to integrity signals. An issuer name or high score does not prove certificate authenticity. Proof of Work and renewal audit events share the new MongoDB-backed chain; this is not a byte-compatible import of the previous Python ledger.

The **Certificate inspection** screen implements NPTEL QR/official-record verification and PDF metadata/structural analysis in Node.js. Upload the original certificate or select a registered PDF. NPTEL checks compare actual official bytes, fields and rendered pages; unavailable or inconclusive evidence remains UNVERIFIABLE. Forensic metadata indicators do not prove forgery. See `API_MIGRATION.md` for contracts and limits.

## Additional working APIs

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/session` | Setup/authentication state |
| POST | `/api/setup` | One-time organization/administrator setup |
| POST | `/api/login` | Sign in |
| POST | `/api/logout` | Revoke session |
| GET | `/api/workspace` | Current records, claims, deliveries and audit |
| POST | `/api/records` | Add record |
| PUT | `/api/records/:id` | Edit details |
| POST | `/api/records/:id/renew` | Renew and preserve history |
| POST | `/api/records/:id/documents` | Alternate JSON/base64 PDF upload |
| GET | `/api/documents/:id` | Authenticated download with byte-integrity check |
| GET / PUT | `/api/settings/email` | Read safe settings / verify and save SMTP configuration |
| POST | `/api/reminders/send` | Scan and deliver eligible reminder emails |
| GET | `/api/export` | Register CSV |
| GET | `/api/audit/export` | Complete audit JSON |

All workspace, document, chain and settings APIs require the authenticated HttpOnly session cookie. Sessions are stored in MongoDB and expire after eight hours. Session tokens are stored hashed; logout revokes them. Rate limits and same-origin checks protect sign-in and changes. API errors return JSON.

## Verification

```sh
npm test
TEST_MONGODB_URI=mongodb://127.0.0.1:27017 npm test
```

The MongoDB tests create and drop their own randomly named test databases. They do not delete application data. The real-workspace test covers an initially empty MongoDB workspace, account setup, sign-in, multipart registration, file verification, provenance, renewal history and an independent API/store instance that retains sessions and records. Tests also cover tampering, concurrency and reminders. SMTP unit tests use a local test SMTP server and do not send outside the machine; that is test infrastructure, not an application delivery mode.

## Technical scope

This is a single-organization application with an owner and up to 19 additional administrators. The owner creates/disables administrators and controls SMTP configuration and encrypted backups. Disabled accounts lose access immediately; each administrator can change their own password. Records and audit events share one MongoDB workspace document for atomic revision-checked updates; document bytes, sessions, account and encrypted SMTP settings use separate MongoDB collections. The workspace history is bounded to 14 MB before MongoDB's 16 MB document limit. Files are limited to 2 MB each and supporting PDFs to 30 per record. MongoDB locks coordinate reminder scans and snapshots across instances; delivery reservations prevent simultaneous duplicate sends and MongoDB counters enforce login throttling. Renewal dates and email deduplication use UTC dates.

The audit chain is tamper-evident under the application's checks, with three leading hexadecimal zeroes required for Proof of Work. It is not a distributed blockchain or externally anchored ledger; a privileged database operator could re-mine a replacement. Restrict database access and keep independent backups/audit exports.

Local development binds to loopback. The Vercel entry point exports Express without a permanent listener or background timers. The application is deployed at https://trustchain-reminder.vercel.app. See `VERCEL_DEPLOY.md` for Atlas, encryption keys, authenticated daily cron, independent backup storage and disaster recovery. Development tooling uses esbuild for JSX bundling and Tailwind CLI for styles; the runtime has no additional frontend or backend framework.

## Administrators and recovery

Sign in as owner to use **Administrators** and **Backups**. Added administrators can manage records, upload documents and inspect certificates. They cannot administer users, save SMTP settings or access backups. All accounts have **Account settings** for password changes; changing a password revokes existing sessions.

Backups contain workspace data, chain, original document bytes, account hashes and encrypted SMTP settings. Configure `BACKUP_ENCRYPTION_KEY`; optionally set `BACKUP_MONGODB_URI` to an independent destination. The local server snapshots daily while running. Vercel uses protected cron requests. Recovery points expire after seven days. Download independent copies from Backups, or use `npm run backup:export`. `npm run backup:restore` verifies the archive and writes only to a new empty database. Keep both encryption keys outside the server and repository.

New routes: `GET/POST /api/administrators`, `PUT /api/administrators/status`, `POST /api/account/password`, `GET/POST /api/backups`, `GET /api/backups/:id/download`, `POST /api/v1/verify/nptel-certificate`, `POST /api/v1/forensics/analyze`, and secret-authenticated `GET /api/cron/reminders` / `/api/cron/backups`.
