import { cpSync, rmSync } from "node:fs";
import { build } from "esbuild";

/** Bundles the Electron main process and the built Worker into desktop-build/, so the app needs no node_modules. */
const out = "desktop-build";
rmSync(out, { recursive: true, force: true });

const common = {
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  logLevel: "warning",
  banner: { js: "import{createRequire as __createRequire}from'node:module';const require=__createRequire(import.meta.url);" },
};

await build({ ...common, entryPoints: ["desktop/main.ts"], outfile: `${out}/main.mjs`, external: ["electron"] });
await build({ ...common, entryPoints: ["dist/server/index.js"], outfile: `${out}/server/index.js` });
cpSync("dist/client", `${out}/client`, { recursive: true });
cpSync("drizzle", `${out}/drizzle`, { recursive: true });
