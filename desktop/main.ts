import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import type { Server } from "node:http";
import { join } from "node:path";
import { app, BrowserWindow, dialog, globalShortcut, ipcMain, Menu, nativeImage, Notification, safeStorage, shell, Tray } from "electron";
import { createBackgroundSync } from "./background-sync.ts";
import { backupDatabase } from "./backup.ts";
import { DEFAULT_PORT, loadEnv, loadUserConfig } from "./config.ts";
import { D1Database } from "./d1-sqlite.ts";
import { exportMarkdown } from "./markdown-export.ts";
import { migrate } from "./migrate.ts";
import { QUICK_NOTE_HTML, addQuickNote } from "./quick-note.ts";
import { restoreBackup } from "./restore.ts";
import { startLocalServer } from "./server.ts";
import { loadWorkspace, type WorkspaceDatabase } from "../worker/workspace-store.ts";

const SYNC_INTERVAL_MS = 15 * 60 * 1000;
const QUICK_NOTE_SHORTCUT = "CommandOrControl+Alt+N";

let window: BrowserWindow | null = null;
let noteWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let server: Server | null = null;
let database: D1Database | null = null;
let origin = "";
let waitingForGoogle = false;
let syncTimer: NodeJS.Timeout | null = null;
let sync: ReturnType<typeof createBackgroundSync> | null = null;

const dataDir = () => app.getPath("userData");
const boundsFile = () => join(dataDir(), "window.json");
const workspaceDb = () => database as unknown as WorkspaceDatabase;

const loadBounds = () => {
  try { return JSON.parse(readFileSync(boundsFile(), "utf8")) as Electron.Rectangle; } catch { return { width: 1280, height: 860 } as Partial<Electron.Rectangle>; }
};

const showWindow = () => {
  if (window) {
    if (window.isMinimized()) window.restore();
    window.show();
    window.focus();
  } else {
    createWindow();
  }
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
    const isGoogleLogin = target.origin === origin && target.pathname === "/api/google-tasks/connect";
    if (target.origin === origin && !isGoogleLogin) return;
    // Google refuses OAuth inside embedded windows, so the login runs in the default browser.
    event.preventDefault();
    if (isGoogleLogin) waitingForGoogle = true;
    void shell.openExternal(url);
  });
  void window.loadURL(origin);
};

const openQuickNote = () => {
  if (noteWindow) { noteWindow.focus(); return; }
  noteWindow = new BrowserWindow({
    width: 460,
    height: 240,
    alwaysOnTop: true,
    resizable: false,
    minimizable: false,
    maximizable: false,
    title: "Snelle notitie",
    webPreferences: { contextIsolation: true, sandbox: true, nodeIntegration: false, preload: join(import.meta.dirname, "preload.cjs") },
  });
  noteWindow.on("closed", () => { noteWindow = null; });
  void noteWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(QUICK_NOTE_HTML)}`);
};

const notify = (title: string, body: string) => {
  const notification = new Notification({ title, body });
  notification.on("click", showWindow);
  notification.show();
};

const exportToFolder = async () => {
  const chosen = await dialog.showOpenDialog({ title: "Kies een map voor de export", properties: ["openDirectory", "createDirectory"] });
  if (chosen.canceled || !database) return;
  const { items } = await loadWorkspace(workspaceDb());
  const target = join(chosen.filePaths[0], "Personal Space export");
  const count = exportMarkdown(items, target);
  notify("Export klaar", `${count} bestanden geschreven naar ${target}`);
  void shell.openPath(target);
};

const restoreFromBackup = async () => {
  const chosen = await dialog.showOpenDialog({
    title: "Kies een back-up",
    defaultPath: join(dataDir(), "backups"),
    filters: [{ name: "Back-ups", extensions: ["sqlite"] }],
    properties: ["openFile"],
  });
  if (chosen.canceled) return;
  const confirmed = await dialog.showMessageBox({
    type: "warning",
    message: "Back-up terugzetten?",
    detail: "Alle huidige gegevens worden vervangen door deze back-up. De huidige database blijft bewaard in de map backups.",
    buttons: ["Terugzetten", "Annuleren"],
    defaultId: 1,
    cancelId: 1,
  });
  if (confirmed.response !== 0) return;
  server?.close();
  database?.close();
  database = null;
  restoreBackup(dataDir(), chosen.filePaths[0]);
  app.relaunch();
  app.exit(0);
};

const toggleLaunchAtLogin = () => {
  app.setLoginItemSettings({ openAtLogin: !app.getLoginItemSettings().openAtLogin });
  createMenus();
};

const createMenus = () => {
  const openAtLogin = app.getLoginItemSettings().openAtLogin;
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { role: "appMenu" },
    {
      label: "Bestand",
      submenu: [
        { label: "Snelle notitie", accelerator: QUICK_NOTE_SHORTCUT, click: openQuickNote },
        { label: "Nu synchroniseren", click: () => { void sync?.run(); } },
        { type: "separator" },
        { label: "Exporteer als Markdown...", click: () => { void exportToFolder(); } },
        { label: "Back-up terugzetten...", click: () => { void restoreFromBackup(); } },
        { label: "Maak back-up nu", click: () => { if (database) backupDatabase(database, dataDir(), new Date()); } },
        { label: "Open datamap", click: () => { void shell.openPath(dataDir()); } },
        { type: "separator" },
        { label: "Start bij inloggen", type: "checkbox", checked: openAtLogin, click: toggleLaunchAtLogin },
        { role: "close" },
      ],
    },
    { role: "editMenu" },
    { role: "viewMenu" },
    { role: "windowMenu" },
  ]));
};

const createTray = () => {
  const icon = nativeImage.createFromPath(join(import.meta.dirname, "icon.png")).resize({ width: 18, height: 18 });
  tray = new Tray(icon);
  tray.setToolTip("Personal Space");
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: "Open Personal Space", click: showWindow },
    { label: "Snelle notitie", click: openQuickNote },
    { label: "Nu synchroniseren", click: () => { void sync?.run(); } },
    { type: "separator" },
    { label: "Stop", role: "quit" },
  ]));
};

const start = async () => {
  mkdirSync(dataDir(), { recursive: true });
  database = new D1Database(join(dataDir(), "personal-space.sqlite"));
  migrate(database, join(import.meta.dirname, "drizzle"));
  backupDatabase(database, dataDir());
  const port = loadUserConfig(dataDir()).port || DEFAULT_PORT;
  origin = `http://localhost:${port}`;
  server = await startLocalServer({ distDir: import.meta.dirname, database, env: loadEnv(dataDir(), safeStorage), port });

  sync = createBackgroundSync({
    baseUrl: origin,
    isWindowOpen: () => window !== null,
    onParroUnread: (unread, increased) => {
      app.dock?.setBadge(unread > 0 ? String(unread) : "");
      if (increased) notify("Nieuw Parro-bericht", `${unread} ongelezen ${unread === 1 ? "bericht" : "berichten"}`);
    },
  });
  syncTimer = setInterval(() => { void sync?.run(); }, SYNC_INTERVAL_MS);
  void sync.run();

  ipcMain.handle("quick-note:save", async (_event, text: string) => {
    await addQuickNote(workspaceDb(), String(text));
    window?.webContents.reload();
    return true;
  });
  ipcMain.on("quick-note:close", () => noteWindow?.close());
  globalShortcut.register(QUICK_NOTE_SHORTCUT, openQuickNote);

  createMenus();
  createTray();
  // When macOS starts the app at login it stays in the menu bar until you open it.
  if (!app.getLoginItemSettings().wasOpenedAtLogin) createWindow();
};

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", showWindow);
  app.on("activate", () => { if (!window && server) createWindow(); });
  // On macOS the app stays running after the last window closes; Cmd+Q quits.
  app.on("window-all-closed", () => {});
  app.on("will-quit", () => {
    if (syncTimer) clearInterval(syncTimer);
    globalShortcut.unregisterAll();
    server?.close();
    database?.close();
  });
  app.whenReady().then(start).catch((error: unknown) => {
    dialog.showErrorBox("Personal Space kon niet starten", error instanceof Error ? error.message : String(error));
    app.quit();
  });
}
