# Verification — 14 October 2026

- React and Tailwind frontend build passes.
- 10 automated tests pass, with MongoDB integration enabled against a real local Community Server 8.0.25.
- Real workspace starts empty; no demo mode or sample data is loaded by the application.
- MongoDB test covers first-run account setup, setup replacement rejection, correct/incorrect login, protected endpoints, multipart file registration, duplicate handling, hash verification, provenance, renewal and history.
- A new Express/store instance retains the administrator, authenticated session, records, history and documents through MongoDB.
- Changed document bytes and changed storage fingerprints are compared with the original chain anchor; integrity failure prevents download.
- Audit tampering is detected and prevents subsequent writes. Reminder delivery also checks chain integrity before sending.
- Concurrent record creation retains all records and audit blocks.
- Nodemailer reminder tests use an isolated local SMTP server, record delivery and skip same-day successful reminders; no external email is sent by the tests.
- Browser verifies sign-in, actual API-loaded records, stored-file provenance results and the Email settings form in a separate integration database.
- The user's existing workspace retains one renewal record, its renewal history, one PDF with matching SHA-256 bytes, and five valid audit blocks.

The running application has no mock backend. Synthetic records and local SMTP fixtures are confined to tests. Live Gmail SMTP configuration and inbox delivery were confirmed by the owner on 5 October 2026. The saved delivery entry remains present. This check did not send another email. Public hosting has not been performed.

The Python NPTEL authenticity and forensic endpoints are not included in the Express migration; see API_MIGRATION.md. The file registration, verification, provenance, chain, audit and health operations are implemented under the original API paths.
