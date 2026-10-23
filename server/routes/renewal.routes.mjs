import express from "express";
export function mountRenewalRoutes(app, controllers) {
  app.get("/api/workspace", controllers.getWorkspace);
  app.post("/api/records", controllers.createRecord);
  app.put("/api/records/:id", controllers.updateRecord);
  app.post("/api/records/:id/renew", controllers.renewRecord);
  app.get("/api/export", controllers.exportRecords);
}
