import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import type { Server } from "node:http";
import { join } from "node:path";
import { app, BrowserWindow, dialog, Menu, safeStorage, shell } from "electron";
import { backupDatabase } from "./backup.ts";
import { loadEnv } from "./config.ts";
import { D1Database } from "./d1-sqlite.ts";
import { migrate } from "./migrate.ts";
import { startLocalServer } from "./server.ts";

// The port is fixed because the Google OAuth redirect URI must be registered for it.
const PORT = 3210;
const ORIGIN = `http://localhost:${PORT}`;

let window: BrowserWindow | null = null;
let server: Server | null = null;
let database: D1Database | null = null;
let waitingForGoogle = false;

const dataDir = () => join(app.getPath("userData"));
const boundsFile = () => join(dataDir(), "window.json");

const loadBounds = () => {
  try { return JSON.parse(readFileSync(boundsFile(), "utf8")) as Electron.Rectangle; } catch { return { width: 1280, height: 860 } as Partial<Electron.Rectangle>; }
};

const createWindow = () => {
  window = new BrowserWindow({
    ...loadBounds(),
    minWidth: 720,
    minHeight: 480,
    titleBarStyle: "hiddenInset",
    webPreferences: { contextIsolation: true, sandbox: true, nodeIntegration: false },
  });
  window.on("close", () => { if (window) writeFileSync(boundsFile(), JSON.stringify(window.getBounds())); });
  window.on("closed", () => { window = null; });
  // After signing in with Google in the browser, reload once so the new connection shows up.
  window.on("focus", () => { if (waitingForGoogle) { waitingForGoogle = false; window?.webContents.reload(); } });

  window.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: "deny" };
  });
  window.webContents.on("will-navigate", (event, url) => {
    const target = new URL(url);
    const isGoogleLogin = target.origin === ORIGIN && target.pathname === "/api/google-tasks/connect";
    if (target.origin === ORIGIN && !isGoogleLogin) return;
    // Google refuses OAuth inside embedded windows, so the login runs in the default browser.
    event.preventDefault();
    if (isGoogleLogin) waitingForGoogle = true;
    void shell.openExternal(url);
  });
  void window.loadURL(ORIGIN);
};

const createMenu = () => {
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { role: "appMenu" },
    {
      label: "Bestand",
      submenu: [
        { label: "Open datamap", click: () => { void shell.openPath(dataDir()); } },
        { label: "Maak back-up nu", click: () => { if (database) backupDatabase(database, dataDir(), new Date()); } },
        { type: "separator" },
        { role: "close" },
      ],
    },
    { role: "editMenu" },
    { role: "viewMenu" },
    { role: "windowMenu" },
  ]));
};

const start = async () => {
  mkdirSync(dataDir(), { recursive: true });
  database = new D1Database(join(dataDir(), "personal-space.sqlite"));
  migrate(database, join(import.meta.dirname, "drizzle"));
  backupDatabase(database, dataDir());
  server = await startLocalServer({
    distDir: import.meta.dirname,
    database,
    env: loadEnv(dataDir(), safeStorage),
    port: PORT,
  });
  createMenu();
  createWindow();
};

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (window?.isMinimized()) window.restore();
    window?.focus();
  });
  app.on("activate", () => { if (!window && server) createWindow(); });
  // On macOS the app stays in the Dock after the last window closes; Cmd+Q quits.
  app.on("window-all-closed", () => {});
  app.on("will-quit", () => {
    server?.close();
    database?.close();
  });
  app.whenReady().then(start).catch((error: unknown) => {
    dialog.showErrorBox("Personal Space kon niet starten", error instanceof Error ? error.message : String(error));
    app.quit();
  });
}
