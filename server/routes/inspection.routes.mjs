import express from "express";
export function mountInspectionRoutes(app, controllers) {
  app.post(
    "/api/v1/verify/nptel-certificate",
    express.raw({ type: "multipart/form-data", limit: "3mb" }),
    controllers.verifyCertificate,
  );
  app.post(
    "/api/v1/forensics/analyze",
    express.raw({ type: "multipart/form-data", limit: "3mb" }),
    controllers.analyzeDocument,
  );
}
