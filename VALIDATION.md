# Validation — 14 October 2026

- Frontend builds with React and Tailwind CSS; the Node/Express application uses MongoDB for persistent data.
- 17 automated tests pass with real MongoDB integration enabled; none skipped.
- Tests cover first-run setup, correct/incorrect login, protected APIs, multipart registration, file hashing, duplicate rejection, renewal history, restart persistence, concurrent writes and tamper rejection.
- Real PDF parsing/rendering and metadata extraction pass. NPTEL tests reject mismatched fields, hostile domains, missing evidence and unavailable servers.
- Live official NPTEL verification of the supplied Blockchain certificate returned GENUINE with matching bytes, rendered page and fields. The official redirect to NPTEL-signed Google Storage is supported.
- Real MongoDB tests cover owner/admin permissions, disabled-account session revocation, password change revocation, owner protection, encrypted snapshot download and wrong-key/tampered-backup rejection.
- An independent MongoDB backup database retained a snapshot after its source test database was dropped. The CLI restored the snapshot into a new empty database and refused a second overwrite.
- Durable locks and delivery reservations reject concurrent duplicate work across separate MongoDB store connections.
- Local SMTP fixture tests verify actual Nodemailer submission and same-day deduplication without sending external email. The owner previously confirmed Gmail inbox delivery on 5 October.
- The user's existing record, renewal, document and five original audit blocks are retained. Development tests use separate randomly named databases.
- Production dependencies report zero npm audit vulnerabilities after the Nodemailer update. Tailwind 3's build-only dependency tree still has upstream audit findings; user-supplied PDFs never reach those build tools.

The Vercel entry point, Node runtime, static output and daily cron configuration are included. Vercel production hosting and Atlas migration are verified at https://trustchain-reminder.vercel.app. Live health returns 200 with five audit blocks; protected APIs reject unauthenticated requests. Both authenticated cron endpoints ran successfully, including an encrypted cloud backup. Actual scheduled future invocation is pending its scheduled time; use VERCEL_DEPLOY.md for configuration details. Backups are encrypted application snapshots, not a substitute for independent cluster backups or exported disaster recovery archives.

- A replica-set integration test verifies atomic encrypted cloud bootstrap import, ciphertext corruption rejection, initial sign-in, and refusal to replace an existing account.
