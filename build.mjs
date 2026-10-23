import { appendFile, readFile } from "node:fs/promises";
import { build } from "esbuild";
import { execFileSync } from "node:child_process";
await build({
  entryPoints: ["frontend/src/main.jsx"],
  bundle: true,
  minify: true,
  outfile: "public/app.js",
  loader: { ".jsx": "jsx" },
  define: { "process.env.NODE_ENV": '"production"' },
});
execFileSync(
  process.execPath,
  [
    "node_modules/tailwindcss/lib/cli.js",
    "-i",
    "frontend/src/styles/index.css",
    "-o",
    "public/styles.css",
    "--minify",
  ],
  { stdio: "inherit" },
);

// Keep the reference-inspired theme separate from base layout rules.
await appendFile(
  "public/styles.css",
  await readFile("frontend/src/styles/litera-glass.css", "utf8"),
);

await appendFile(
  "public/styles.css",
  await readFile("frontend/src/styles/workspace-pages.css", "utf8"),
);

await appendFile(
  "public/styles.css",
  await readFile("frontend/src/styles/uniform-workspace.css", "utf8"),
);

await appendFile(
  "public/styles.css",
  await readFile("frontend/src/styles/yellow-workspace.css", "utf8"),
);

await appendFile(
  "public/styles.css",
  await readFile("frontend/src/styles/monochrome-workspace.css", "utf8"),
);
