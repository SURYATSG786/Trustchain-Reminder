import { build } from "esbuild";
import { execFileSync } from "node:child_process";
await build({
  entryPoints: ["frontend/main.jsx"],
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
    "frontend/styles.css",
    "-o",
    "public/styles.css",
    "--minify",
  ],
  { stdio: "inherit" },
);
