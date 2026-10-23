import express from "express";
export function mountBackupRoutes(app, controllers) {
  app.get("/api/backups", controllers.listBackups);
  app.post("/api/backups", controllers.createBackup);
  app.get("/api/backups/:id/download", controllers.downloadBackup);
}
