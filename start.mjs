#!/usr/bin/env node
/**
 * Personal Space launcher. `npm start` runs the app on http://localhost:8100.
 * First run installs dependencies and builds the frontend automatically.
 * Flags: --dev (Vite dev server + API with reload), --port N, --db PATH.
 */
import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const dev = args.includes("--dev");
const argAfter = (flag) => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : undefined;
};
const port = argAfter("--port") ?? process.env.PORT ?? "8100";
const db = path.resolve(root, argAfter("--db") ?? process.env.DB_PATH ?? path.join(root, "data", "personal-space.db"));

const run = (cmd, cmdArgs, extraEnv = {}) =>
  spawnSync(cmd, cmdArgs, { cwd: root, stdio: "inherit", env: { ...process.env, ...extraEnv } });

if (!existsSync(path.join(root, "node_modules"))) {
  console.log("First run: installing dependencies...");
  const r = run("npm", ["install"]);
  if (r.status !== 0) process.exit(r.status ?? 1);
}

if (!dev && !existsSync(path.join(root, "web", "dist", "index.html"))) {
  console.log("Building the app...");
  const r = run("npm", ["run", "build", "-w", "web"]);
  if (r.status !== 0) process.exit(r.status ?? 1);
}

const env = { ...process.env, PORT: port, DB_PATH: db };
const children = [];
const launch = (name, cmdArgs, extra = {}) => {
  const child = spawn("npm", cmdArgs, { cwd: root, stdio: "inherit", env: { ...env, ...extra } });
  child.on("exit", (code) => process.exit(code ?? 0));
  children.push(child);
};

if (dev) {
  launch("api", ["run", "dev", "-w", "server"]);
  launch("web", ["run", "dev", "-w", "web"], { API_PORT: port });
} else {
  launch("app", ["run", "start", "-w", "server"]);
}

for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, () => {
    for (const c of children) c.kill(sig);
    process.exit(0);
  });
}
