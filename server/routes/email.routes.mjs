import express from "express";
export function mountEmailRoutes(app, controllers) {
  app.get("/api/settings/email", controllers.getEmailSettings);
  app.put("/api/settings/email", controllers.saveEmailSettings);
}
