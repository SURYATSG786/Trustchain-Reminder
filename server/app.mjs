import { securityHeaders } from "./middleware/security.middleware.mjs";
import { requireAuditIntegrity } from "./middleware/integrity.middleware.mjs";
import { errorHandler } from "./middleware/error.middleware.mjs";
import { createSystemController } from "./controllers/system.controller.mjs";
import { mountSystemRoutes } from "./routes/system.routes.mjs";
import { createAdministratorController } from "./controllers/administrator.controller.mjs";
import { mountAdministratorRoutes } from "./routes/administrator.routes.mjs";
import { createBackupController } from "./controllers/backup.controller.mjs";
import { mountBackupRoutes } from "./routes/backup.routes.mjs";
import { createInspectionController } from "./controllers/inspection.controller.mjs";
import { mountInspectionRoutes } from "./routes/inspection.routes.mjs";
import { createRenewalController } from "./controllers/renewal.controller.mjs";
import { mountRenewalRoutes } from "./routes/renewal.routes.mjs";
import { createEmailController } from "./controllers/email.controller.mjs";
import { mountEmailRoutes } from "./routes/email.routes.mjs";
import { createDocumentController } from "./controllers/document.controller.mjs";
import { mountDocumentRoutes } from "./routes/document.routes.mjs";
import { createAuditController } from "./controllers/audit.controller.mjs";
import { mountAuditRoutes } from "./routes/audit.routes.mjs";
import { createReminderController } from "./controllers/reminder.controller.mjs";
import { mountReminderRoutes } from "./routes/reminder.routes.mjs";
import { createWorkspaceService } from "./services/workspace.service.mjs";
import { createDocumentService } from "./services/document.service.mjs";
import { createReminderService } from "./services/reminder.service.mjs";
import express from "express";

import { fileURLToPath } from "node:url";

import { inspectPdf } from "./services/pdf.service.mjs";
import { verifyNptel } from "./services/nptel.service.mjs";

import { installAuth } from "./middleware/auth.middleware.mjs";
import { emailService } from "./services/email.service.mjs";

export function createApp(
  store,
  env = process.env,
  inspection = { inspectPdf, verifyNptel },
) {
  const app = express();
  const email = emailService(store, env);
  const trustedIssuers = (env.TRUSTED_ISSUERS || "").split("|").filter(Boolean);
  const { mutate, find } = createWorkspaceService({ store });
  const { inspectionInput, registerDocument } = createDocumentService({
    store,
    env,
    inspection,
    trustedIssuers,
    mutate,
    find,
  });
  const { sendReminders } = createReminderService({
    store,
    env,
    email,
    mutate,
    find,
  });
  const dependencies = {
    store,
    env,
    email,
    inspection,
    trustedIssuers,
    mutate,
    find,
    inspectionInput,
    registerDocument,
    sendReminders,
  };
  const systemControllers = createSystemController(dependencies);
  const administratorControllers = createAdministratorController(dependencies);
  const backupControllers = createBackupController(dependencies);
  const inspectionControllers = createInspectionController(dependencies);
  const renewalControllers = createRenewalController(dependencies);
  const emailControllers = createEmailController(dependencies);
  const documentControllers = createDocumentController(dependencies);
  const auditControllers = createAuditController(dependencies);
  const reminderControllers = createReminderController(dependencies);

  app.disable("x-powered-by");
  if (env.VERCEL || env.TRUST_PROXY === "true") app.set("trust proxy", 1);
  app.use(securityHeaders);
  app.use(express.json({ limit: "3mb" }));
  mountSystemRoutes(app, systemControllers);

  const { ready } = installAuth(app, store, env);
  app.use("/api", requireAuditIntegrity(store));
  mountAdministratorRoutes(app, administratorControllers);

  mountBackupRoutes(app, backupControllers);

  mountInspectionRoutes(app, inspectionControllers);
  mountRenewalRoutes(app, renewalControllers);
  mountEmailRoutes(app, emailControllers);

  mountDocumentRoutes(app, documentControllers);

  mountAuditRoutes(app, auditControllers);

  mountReminderRoutes(app, reminderControllers);

  app.use("/api", (req, res) =>
    res.status(404).json({ error: "API endpoint not found" }),
  );
  app.get("/", (req, res) =>
    res.sendFile(
      fileURLToPath(new URL("../public/index.html", import.meta.url)),
    ),
  );
  app.use(express.static(fileURLToPath(new URL("../public", import.meta.url))));
  app.use(errorHandler);
  return { app, sendReminders, ready };
}
