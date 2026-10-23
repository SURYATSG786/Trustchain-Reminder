import express from "express";
export function mountReminderRoutes(app, controllers) {
  app.post("/api/reminders/send", controllers.sendDueReminders);
}
