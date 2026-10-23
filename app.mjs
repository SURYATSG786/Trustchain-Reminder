import express from "express";
import { createOrganizationStore as createStore } from "./server/services/organization.service.mjs";
import { createApp } from "./server/app.mjs";
const app = express();
app.set("trust proxy", 1);
let runtime;
async function connect() {
  if (!/^[a-f\d]{64}$/i.test(process.env.APP_ENCRYPTION_KEY || ""))
    throw Error("Set APP_ENCRYPTION_KEY in Vercel environment variables");
  const store = await createStore({
    uri: process.env.MONGODB_URI,
    database: process.env.MONGODB_DATABASE,
  });
  const built = createApp(store);
  await built.ready;
  return built;
}
app.use(async (req, res, next) => {
  try {
    runtime ||= connect().catch((e) => {
      runtime = null;
      throw e;
    });
    const built = await runtime;
    built.app(req, res, next);
  } catch (e) {
    console.error(e.message);
    res
      .status(503)
      .json({
        error:
          "Application configuration or database connection is unavailable",
      });
  }
});
export default app;
