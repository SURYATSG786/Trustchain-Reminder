import express from "express";
export function mountDocumentRoutes(app, controllers) {
  app.post("/api/records/:id/documents", controllers.uploadSupportingDocument);
  app.post(
    "/api/v1/claims/upload",
    express.raw({ type: "multipart/form-data", limit: "3mb" }),
    controllers.registerDocumentClaim,
  );
  app.get("/api/v1/claims/:fileHash/verify", controllers.verifyFingerprint);
  app.get("/api/v1/claims/:index/report", controllers.getClaimReport);
  app.get("/api/documents/:id", controllers.downloadDocument);
}
