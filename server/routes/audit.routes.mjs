import express from "express";
export function mountAuditRoutes(app, controllers) {
  app.get("/api/v1/chain/audit", controllers.verifyAudit);
  app.get("/api/v1/chain/block/:index", controllers.getBlock);
  app.get("/api/v1/chain", controllers.getChain);
  app.get("/api/audit/export", controllers.exportAudit);
}
