import express from "express";
export function mountSystemRoutes(app, controllers) {
  app.get("/api/v1/health", controllers.health);
  app.get(
    [
      "/api/cron/daily",
      "/api/cron/reminders",
      "/api/cron/backups",
      "/api/cron/verify-email",
    ],
    controllers.runScheduledJobs,
  );
  app.post("/api/deployment/import", controllers.importWorkspace);
}
