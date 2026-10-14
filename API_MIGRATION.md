# Original API migration

The supplied Python implementation is preserved outside this repository. All running APIs are implemented in Express/Node.js and called by the React frontend.

| Original path | Node implementation |
|---|---|
| `POST /api/v1/claims/upload` | Multipart registration, SHA-256, claim identity, Proof of Work, stored bytes |
| `GET /api/v1/claims/:hash/verify` | Chain-anchored document integrity and provenance |
| `GET /api/v1/claims/:index/report` | Provenance report |
| `GET /api/v1/chain` | Chain list |
| `GET /api/v1/chain/audit` | Chain validation |
| `GET /api/v1/chain/block/:index` | Block provenance |
| `GET /api/v1/health` | API and MongoDB health |
| `POST /api/v1/verify/nptel-certificate` | Actual PDF QR decoding, official record retrieval, field and rendered-page comparison |
| `POST /api/v1/forensics/analyze` | PDF metadata/text parsing, page count, timestamps, embedded JavaScript/attachments and incremental-revision indicators |

Inspection accepts multipart `file` uploads or JSON `{ "documentId": "..." }` for registered documents. PDF uploads are limited to 2 MB. NPTEL certificates must be one page; forensic inspection supports up to 10 pages. The inspection operations do not register files or change claims. Registration also reads a single-page PDF QR: NPTEL-linked or NPTEL-labelled documents are checked before mining. A confirmed FAKE verdict prevents registration; GENUINE/UNVERIFIABLE status and reason are anchored in the claim metadata.

NPTEL returns `GENUINE` only when the uploaded file matches the official bytes, or all fields and rendered pages match with essential fields extracted. Altered extracted fields or an unofficial QR URL return `FAKE`; unreadable QR codes, unavailable servers, unsupported layouts, and visual differences without a provable field mismatch return `UNVERIFIABLE`. A converted or compressed genuine certificate may be unverifiable: use the original PDF. Network failures never become a forged-certificate verdict.

Requests are restricted to NPTEL HTTPS hosts, with DNS address validation, pinned public destinations, request size/time/redirect bounds. Official redirects to NPTEL-signed Google Storage certificate downloads are supported; arbitrary uploaded Google Storage URLs are not trusted. The live supplied NPTEL Blockchain certificate matched the official PDF during validation.

PDF forensic indicators are observations, not proof of forgery or a malware verdict. Missing author/creator metadata is common in valid documents. This implementation does not perform OCR, certificate digital-signature validation or arbitrary issuer verification.

All APIs except health and secret-authenticated cron require sign-in. The authenticated account supplies claim identity. The MongoDB audit ledger is not a byte-compatible import of the original Python ledger; the original five provenance scoring weights are retained. Standalone integrity scores remain separate from NPTEL issuer verification.
