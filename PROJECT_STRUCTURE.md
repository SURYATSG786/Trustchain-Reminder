# TrustChain MERN project structure

TrustChain uses MongoDB, Express.js, React and Node.js. Tailwind CSS styles the frontend, Nodemailer delivers reminders, and SHA-256 with Proof of Work supports document and audit integrity. MongoDB access uses the official Node.js driver rather than Mongoose.

## Folder responsibilities

```text
TrustChain/
├── frontend/
│   └── src/
│       ├── main.jsx                    React entry point
│       ├── App.jsx                     Page selection and application composition
│       ├── api/client.js               Shared HTTP client for /api requests
│       ├── hooks/useWorkspace.js       Session, loading, actions and UI state
│       ├── pages/                      Individual feature screens
│       │   ├── AuthPage.jsx            Sign-in and organization registration
│       │   ├── OverviewPage.jsx        Compliance dashboard
│       │   ├── RenewalRegisterPage.jsx  Search and filters
│       │   ├── CalendarPage.jsx         Expiry calendar
│       │   ├── DocumentsPage.jsx        Supporting documents
│       │   ├── RemindersPage.jsx        Reminder eligibility and delivery history
│       │   ├── AuditTrailPage.jsx       Audit events
│       │   ├── ReportsPage.jsx          Reports and exports
│       │   ├── EmailSettings.jsx        SMTP configuration
│       │   ├── DocumentVerification.jsx Fingerprint registration and verification
│       │   ├── CertificateInspection.jsx NPTEL and PDF inspection
│       │   ├── TeamSettings.jsx         Administrator management
│       │   ├── BackupSettings.jsx       Backup creation and downloads
│       │   └── AccountSettings.jsx      Password changes
│       ├── components/                 Reusable controls, record forms and drawer
│       │   └── layout/                 Sidebar and top navigation
│       ├── styles/index.css            Tailwind directives and application styles
│       └── utils/format.js             Date/currency formatting and options
├── server/
│   ├── index.mjs                       Local startup and scheduled jobs
│   ├── app.mjs                         Express configuration and dependency wiring
│   ├── routes/                         HTTP methods, paths and middleware
│   ├── controllers/                    Request validation and HTTP responses
│   ├── services/                       Reusable business logic and integrations
│   ├── middleware/                     Authentication, roles, headers and errors
│   ├── models/                         Validation, collection definitions and indexes
│   ├── repositories/                   MongoDB reads and writes
│   ├── config/database.mjs             MongoDB connection setup
│   └── utils/dates.mjs                 UTC date and expiry calculations
├── public/                             Generated browser files and static assets
├── scripts/                            Backup export/restore and deployment import
├── tests/                              Automated behavior and integration tests
├── build.mjs                           Builds React and Tailwind assets
├── package.json                        Dependencies and application commands
├── .env                                Private runtime configuration
└── app.mjs                             Existing Vercel entry point
```

## Request example: creating a renewal record

1. The React record form submits through `frontend/src/api/client.js`.
2. `server/routes/renewal.routes.mjs` maps POST `/api/records` to `createRecord`.
3. Authentication middleware checks the session and selects its organization.
4. `server/controllers/renewal.controller.mjs` validates the input using the renewal model.
5. The workspace service serializes updates and checks audit integrity.
6. The audit service appends a SHA-256/Proof of Work block.
7. The workspace repository saves the revised MongoDB document.
8. The JSON response lets React refresh the register and dashboard.

## What to show during the review

- Start with `frontend/src/pages` to demonstrate separate screens.
- Open `server/routes/renewal.routes.mjs` to explain API endpoints.
- Open the corresponding controller to show request handling.
- Show `server/services/reminder.service.mjs` and `email.service.mjs` for reminder scheduling and email delivery.
- Show `server/models/renewal.model.mjs` for field/date validation.
- Show `server/models/workspace.model.mjs` for MongoDB collections and indexes.
- Show `server/repositories/workspace.repository.mjs` for database operations.
- Show `server/middleware/auth.middleware.mjs` for session checks and organization isolation.

The small original files such as `server/store.mjs`, `server/auth.mjs` and `frontend/main.jsx` remain compatibility entry points only. Their implementations now live in the folders above. Existing scripts and integrations keep working.

## Run locally

Start MongoDB on the port configured in your private `.env`, then run from this folder:

```sh
npm run build
npm start
```

Open http://localhost:4317. The same Express server serves the compiled React frontend and APIs. Separate source folders do not require separate ports.

Never display `.env`, SMTP passwords or runtime encryption keys during the presentation. `public/app.js` is a generated production bundle; demonstrate the source in `frontend/src` instead.
