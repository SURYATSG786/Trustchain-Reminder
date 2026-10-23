export function mountPublicAuthRoutes(
  app,
  controllers,
  { origin, throttle, organizationEnabled },
) {
  app.get("/api/session", controllers.getSession);
  app.post("/api/setup", origin, throttle, controllers.setupWorkspace);
  if (organizationEnabled)
    app.post(
      "/api/organizations",
      origin,
      throttle,
      controllers.createOrganization,
    );
  app.post("/api/login", origin, throttle, controllers.login);
}
export function mountAccountRoutes(app, controllers) {
  app.post("/api/account/password", controllers.changePassword);
  app.post("/api/logout", controllers.logout);
}
