import { appendBlock } from "../domain.mjs";

export function createEmailController({ email, mutate }) {
  return {
    getEmailSettings: async (req, res) =>
      res.json(await email.publicSettings()),
    saveEmailSettings: async (req, res) => {
      const settings = await email.save(req.body);
      await mutate((s) =>
        appendBlock(
          s,
          "Email settings updated",
          null,
          {
            host: settings.host,
            from: settings.from,
            enabled: settings.enabled,
          },
          req.user.email,
        ),
      );
      res.json(settings);
    },
  };
}
