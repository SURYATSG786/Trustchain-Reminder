# API migration from the supplied Python project

The original archive is preserved separately and is not modified. The running project uses the required Node/Express stack.

Implemented in Node and used by React:

- Actual file upload and storage, SHA-256 fingerprint and duplicate registration handling.
- TrustClaim fields: type, asset name, issuer, registered-by account, file hash, submission time, claim hash and metadata.
- Claim identity fingerprint and Proof of Work mining.
- Provenance report and the original five scoring weights.
- Registered file hash verification, with an additional MongoDB stored-byte integrity check.
- Chain list, block report, audit and health endpoints under the original `/api/v1` paths.
- New renewal APIs, original and updated expiry history, document associations, compliance reports and Nodemailer reminder delivery.

Interface differences:

- Original endpoints now require sign-in, except health; the Python app did not enforce administrator sign-in.
- Upload accepts original multipart field names; `record_id` optionally links a PDF to a renewal record.
- `submitted_by` comes from the authenticated account instead of trusting a user-provided name.
- Upload returns HTTP 201 and includes the persisted document ID.
- The ledger is a new MongoDB chain with renewal/audit events; original Python ledger JSON is not silently imported or rehashed.
- Scores indicate integrity signals. No hardcoded issuer is presented as externally verified.
- Specialized `/api/v1/verify/nptel-certificate` and `/api/v1/forensics` operations remain outside this migration. No fake or placeholder certificate-authenticity verdicts are produced.
