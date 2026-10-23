export function createReminderController({ email, sendReminders }) {
  return {
    sendDueReminders: async (req, res) =>
      res.json(await sendReminders(req.user.email)),
  };
}
