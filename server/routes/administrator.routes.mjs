import express from "express";
export function mountAdministratorRoutes(app, controllers) {
  app.get("/api/administrators", controllers.listAdministrators);
  app.post("/api/administrators", controllers.createAdministrator);
  app.put("/api/administrators/status", controllers.updateAdministratorStatus);
}
