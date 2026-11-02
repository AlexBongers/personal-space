import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import type { Server } from "node:http";
import { join } from "node:path";
import { app, BrowserWindow, clipboard, dialog, globalShortcut, ipcMain, Menu, nativeImage, Notification, safeStorage, shell, Tray } from "electron";
import { summarizeDay, upcomingEvents } from "./agenda.ts";
import { createBackgroundSync } from "./background-sync.ts";
import { contextMenuTemplate } from "./context-menu.ts";
import { parseDeepLink, URL_SCHEME } from "./deep-link.ts";
import { backupDatabase } from "./backup.ts";
import { DEFAULT_PORT, loadEnv, loadUserConfig } from "./config.ts";
import { D1Database } from "./d1-sqlite.ts";
import { writeLog } from "./logger.ts";
import { importMarkdown } from "./markdown-import.ts";
import { exportMarkdown } from "./markdown-export.ts";
import { migrate } from "./migrate.ts";
import { parseReminder } from "./natural-time.ts";
import { QUICK_NOTE_HTML, addQuickNote } from "./quick-note.ts";
import { addReminder, dueReminders, loadReminders, removeReminder, saveReminders, settle, snooze } from "./reminders.ts";
import { REMINDERS_HTML } from "./reminders-ui.ts";
import { restoreBackup } from "./restore.ts";
import { searchWorkspace } from "./search.ts";
import { SEARCH_HTML } from "./search-ui.ts";
import { startLocalServer } from "./server.ts";
import { createEmptyPage, GOOGLE_CALENDAR_DATABASE_ID, GOOGLE_TASKS_DATABASE_ID } from "../app/personal-space/model.ts";
import { loadWorkspace, saveWorkspace, type WorkspaceDatabase } from "../worker/workspace-store.ts";

const SYNC_INTERVAL_MS = 15 * 60 * 1000;
const QUICK_NOTE_SHORTCUT = "CommandOrControl+Alt+N";
const SHOW_APP_SHORTCUT = "CommandOrControl+Alt+P";
const REMINDER_LEAD_MINUTES = 10;
const AGENDA_INTERVAL_MS = 60 * 1000;
const REMINDER_INTERVAL_MS = 15 * 1000;
const REMINDERS_SHORTCUT = "CommandOrControl+Alt+R";
const SEARCH_SHORTCUT = "CommandOrControl+Alt+K";

let window: BrowserWindow | null = null;
let noteWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let server: Server | null = null;
let database: D1Database | null = null;
let origin = "";
let waitingForGoogle = false;
let syncTimer: NodeJS.Timeout | null = null;
let sync: ReturnType<typeof createBackgroundSync> | null = null;
let agendaTimer: NodeJS.Timeout | null = null;
let reminderTimer: NodeJS.Timeout | null = null;
let remindersWindow: BrowserWindow | null = null;
let searchWindow: BrowserWindow | null = null;
let initialSearch = "";
let started = false;
const pendingLinks: string[] = [];
const announcedEvents = new Set<string>();
const log = (message: string) => writeLog(dataDir(), message);

const dataDir = () => app.getPath("userData");
const boundsFile = () => join(dataDir(), "window.json");
const remindersFile = () => join(dataDir(), "reminders.json");
const workspaceDb = () => database as unknown as WorkspaceDatabase;

const loadBounds = () => {
  try { return JSON.parse(readFileSync(boundsFile(), "utf8")) as Electron.Rectangle; } catch { return { width: 1280, height: 860 } as Partial<Electron.Rectangle>; }
};

/** Tells the page that the workspace changed outside it; the page merges the server version with unsaved edits. */
const refreshWindow = () => {
  void window?.webContents.executeJavaScript('window.dispatchEvent(new Event("personal-space:refresh"))').catch(() => {});
};

/** Shows the window on a page, or a row of a database page. */
const openItem = (id: string, rowId?: string) => {
  if (!window) {
    createWindow(`?${new URLSearchParams(rowId ? { open: id, row: rowId } : { open: id })}`);
    return;
  }
  showWindow();
  void window.webContents.executeJavaScript(`window.dispatchEvent(new CustomEvent("personal-space:open", { detail: ${JSON.stringify({ id, rowId })} }))`).catch(() => {});
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

const createWindow = (query = "") => {
  window = new BrowserWindow({
    ...loadBounds(),
    minWidth: 720,
    minHeight: 480,
    webPreferences: { contextIsolation: true, sandbox: true, nodeIntegration: false },
  });
  window.on("close", () => { if (window) writeFileSync(boundsFile(), JSON.stringify(window.getBounds())); });
  window.on("closed", () => { window = null; });
  // After signing in with Google in the browser, reload once so the new connection shows up.
  // Otherwise pull in what changed meanwhile, such as background syncs and quick notes.
  window.on("focus", () => {
    if (waitingForGoogle) { waitingForGoogle = false; window?.webContents.reload(); } else refreshWindow();
  });

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
  void window.loadURL(`${origin}/${query}`);
};

const toolWindow = (options: Electron.BrowserWindowConstructorOptions, html: string) => {
  const created = new BrowserWindow({
    ...options,
    webPreferences: { contextIsolation: true, sandbox: true, nodeIntegration: false, preload: join(import.meta.dirname, "preload.cjs") },
  });
  void created.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
  return created;
};

const openQuickNote = () => {
  if (noteWindow) { noteWindow.focus(); return; }
  noteWindow = toolWindow({ width: 460, height: 240, alwaysOnTop: true, resizable: false, minimizable: false, maximizable: false, title: "Snelle notitie" }, QUICK_NOTE_HTML);
  noteWindow.on("closed", () => { noteWindow = null; });
};

const notify = (title: string, body: string, onClick: () => void = showWindow) => {
  const notification = new Notification({ title, body });
  notification.on("click", onClick);
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

const openSearch = (query = "") => {
  initialSearch = query;
  if (searchWindow) { searchWindow.close(); searchWindow = null; }
  searchWindow = toolWindow({ width: 640, height: 440, alwaysOnTop: true, minimizable: false, maximizable: false, title: "Zoeken in Personal Space" }, SEARCH_HTML);
  searchWindow.on("closed", () => { searchWindow = null; });
  searchWindow.on("blur", () => searchWindow?.close());
};

/** "morgen 9:00 tandarts bellen" becomes a reminder; returns a message for the user when no time is found. */
const addReminderFromText = (text: string, popup: boolean, at?: string) => {
  const parsed = at ? { text, at: new Date(at) } : parseReminder(text);
  if (!parsed) return { error: "Ik zie geen tijdstip. Probeer bijvoorbeeld 'morgen 9:00 tandarts bellen' of 'over 20 min thee'." };
  try {
    const reminders = addReminder(loadReminders(remindersFile()), { text: parsed.text, at: parsed.at.toISOString(), repeat: "none", popup }, randomUUID());
    saveReminders(remindersFile(), reminders);
    void updateAgenda();
    return { reminders, text: parsed.text, at: parsed.at };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
};

const handleDeepLink = async (link: string) => {
  const action = parseDeepLink(link);
  if (action.action === "note") {
    const pageId = await addQuickNote(workspaceDb(), action.text);
    refreshWindow();
    notify("Notitie bewaard", action.text, () => { if (pageId) openItem(pageId); });
  } else if (action.action === "reminder") {
    const result = addReminderFromText(action.text, false, action.at);
    if ("error" in result) notify("Herinnering niet gezet", result.error ?? "");
    else notify("Herinnering gezet", `${result.text} - ${result.at.toLocaleString("nl-NL", { dateStyle: "medium", timeStyle: "short" })}`, openReminders);
  } else if (action.action === "open") openItem(action.id, action.rowId);
  else if (action.action === "search") openSearch(action.query);
  else showWindow();
};

const receiveLink = (link: string) => {
  if (started) void handleDeepLink(link).catch((error: unknown) => log(`Link mislukt: ${error instanceof Error ? error.message : String(error)}`));
  else pendingLinks.push(link);
};

const openReminders = () => {
  if (remindersWindow) { remindersWindow.focus(); return; }
  remindersWindow = toolWindow({ width: 560, height: 560, title: "Herinneringen" }, REMINDERS_HTML);
  remindersWindow.on("closed", () => { remindersWindow = null; });
};

/** A pop-up stays on screen until it is handled; it can be snoozed instead of dismissed. */
const showPopup = async (text: string) => {
  app.focus({ steal: true });
  const snoozeMinutes = [0, 10, 60];
  const { response } = await dialog.showMessageBox({ type: "info", message: text, detail: "Herinnering van Personal Space", buttons: ["Klaar", "Over 10 minuten", "Over 1 uur"], defaultId: 0, cancelId: 0 });
  if (snoozeMinutes[response] > 0) {
    const now = new Date();
    saveReminders(remindersFile(), settle(loadReminders(remindersFile()), [], now, [snooze({ id: randomUUID(), text, at: "", repeat: "none", popup: true }, snoozeMinutes[response], now)]));
  }
};

const checkReminders = () => {
  const now = new Date();
  const all = loadReminders(remindersFile());
  const due = dueReminders(all, now);
  if (!due.length) return;
  // Save the next state before showing anything, so a pop-up that stays open is never fired twice.
  saveReminders(remindersFile(), settle(all, due, now));
  for (const reminder of due) {
    notify("Herinnering", reminder.text);
    if (reminder.popup) void showPopup(reminder.text);
  }
};

const sendTestNotification = () => {
  if (!Notification.isSupported()) {
    void dialog.showMessageBox({ type: "warning", message: "Meldingen worden niet ondersteund op dit systeem." });
    return;
  }
  notify("Personal Space", "Meldingen werken. Staat deze niet in beeld? Zet ze aan bij Systeeminstellingen, Meldingen.");
};

const noteFromClipboard = async () => {
  const text = await clipboard.readText();
  if (!text.trim()) { notify("Klembord is leeg", "Kopieer eerst wat tekst."); return; }
  const pageId = await addQuickNote(workspaceDb(), text);
  refreshWindow();
  notify("Notitie bewaard", "Het klembord staat op de pagina Snelle notities.", () => { if (pageId) openItem(pageId); });
};

const exportPdf = async () => {
  if (!window) { notify("Geen venster", "Open eerst de pagina die je wilt exporteren."); return; }
  const target = await dialog.showSaveDialog(window, { title: "Exporteer als PDF", defaultPath: join(app.getPath("documents"), "Personal Space.pdf"), filters: [{ name: "PDF", extensions: ["pdf"] }] });
  if (target.canceled || !target.filePath) return;
  writeFileSync(target.filePath, await window.webContents.printToPDF({ printBackground: true }));
  void shell.showItemInFolder(target.filePath);
};

const importFromFolder = async () => {
  const chosen = await dialog.showOpenDialog({ title: "Kies een map met Markdown-bestanden", properties: ["openDirectory"] });
  if (chosen.canceled || !database) return;
  const container = { ...createEmptyPage(null), title: `Import ${new Date().toLocaleDateString("nl-NL")}`, icon: "📥" };
  const pages = importMarkdown(chosen.filePaths[0], container.id);
  const { items, revision } = await loadWorkspace(workspaceDb());
  const saved = await saveWorkspace(workspaceDb(), [...items, container, ...pages], revision);
  if (!saved.ok) { notify("Import mislukt", "De workspace veranderde tijdens het importeren. Probeer opnieuw."); return; }
  refreshWindow();
  notify("Import klaar", `${pages.length} pagina's toegevoegd onder "${container.title}".`, () => openItem(container.id));
};

const openSettings = () => { void shell.openPath(join(dataDir(), "config.json")); };
const openLog = () => { void shell.openPath(join(dataDir(), "app.log")); };

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
        { label: "Klembord als notitie", click: () => { void noteFromClipboard(); } },
        { label: "Nieuwe herinnering...", accelerator: REMINDERS_SHORTCUT, click: openReminders },
        { label: "Zoeken...", accelerator: SEARCH_SHORTCUT, click: () => openSearch() },
        { label: "Nu synchroniseren", click: () => { void sync?.run(); } },
        { type: "separator" },
        { label: "Importeer Markdown-map...", click: () => { void importFromFolder(); } },
        { label: "Exporteer als Markdown...", click: () => { void exportToFolder(); } },
        { label: "Exporteer als PDF...", click: () => { void exportPdf(); } },
        { label: "Back-up terugzetten...", click: () => { void restoreFromBackup(); } },
        { label: "Maak back-up nu", click: () => { if (database) backupDatabase(database, dataDir(), new Date()); } },
        { label: "Open datamap", click: () => { void shell.openPath(dataDir()); } },
        { label: "Open logbestand", click: openLog },
        { label: "Stuur test-melding", click: sendTestNotification },
        { label: "Instellingen...", accelerator: "CommandOrControl+,", click: openSettings },
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

const updateAgenda = async () => {
  if (!database || !tray) return;
  const { items } = await loadWorkspace(workspaceDb());
  const now = new Date();
  const day = summarizeDay(items, now);
  tray.setTitle(day.dueCount > 0 ? String(day.dueCount) : "");
  type Line = { label: string; click?: () => void };
  const section = (title: string, lines: Line[]): Electron.MenuItemConstructorOptions[] =>
    lines.length ? [{ label: title, enabled: false }, ...lines.slice(0, 8).map((line) => ({ label: line.label, enabled: Boolean(line.click), click: line.click })), { type: "separator" as const }] : [];
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: "Open Personal Space", click: showWindow },
    { label: "Snelle notitie", click: openQuickNote },
    { label: "Klembord als notitie", click: () => { void noteFromClipboard(); } },
    { label: "Nieuwe herinnering...", click: openReminders },
    { label: "Zoeken...", click: () => openSearch() },
    { label: "Nu synchroniseren", click: () => { void sync?.run(); } },
    { type: "separator" },
    ...section("Herinneringen", loadReminders(remindersFile()).slice(0, 3).map((reminder) => ({ label: `${new Date(reminder.at).toLocaleString("nl-NL", { dateStyle: "short", timeStyle: "short" })}  ${reminder.text}`, click: openReminders }))),
    ...section("Agenda vandaag", day.events.map((event) => ({ label: event.label, click: () => openItem(GOOGLE_CALENDAR_DATABASE_ID, event.id) }))),
    ...section("Taken (vandaag en achterstallig)", day.tasks.map((task) => ({ label: task.label, click: () => openItem(GOOGLE_TASKS_DATABASE_ID, task.id) }))),
    { label: "Stop", role: "quit" },
  ]));
  for (const event of upcomingEvents(items, now, REMINDER_LEAD_MINUTES, announcedEvents)) notify(event.title, `Begint om ${event.time}`, () => openItem(GOOGLE_CALENDAR_DATABASE_ID, event.id));
};

const createTray = () => {
  const icon = nativeImage.createFromPath(join(import.meta.dirname, "icon.png")).resize({ width: 18, height: 18 });
  tray = new Tray(icon);
  tray.setToolTip("Personal Space");
  void updateAgenda();
};

const start = async () => {
  mkdirSync(dataDir(), { recursive: true });
  database = new D1Database(join(dataDir(), "personal-space.sqlite"));
  migrate(database, join(import.meta.dirname, "drizzle"));
  backupDatabase(database, dataDir());
  const port = loadUserConfig(dataDir()).port || DEFAULT_PORT;
  origin = `http://localhost:${port}`;
  server = await startLocalServer({ distDir: import.meta.dirname, database, env: await loadEnv(dataDir(), safeStorage), port });

  sync = createBackgroundSync({
    baseUrl: origin,
    isWindowOpen: () => window !== null,
    onError: log,
    onParroUnread: (unread, increased) => {
      app.dock?.setBadge(unread > 0 ? String(unread) : "");
      if (increased) notify("Nieuw Parro-bericht", `${unread} ongelezen ${unread === 1 ? "bericht" : "berichten"}`);
    },
  });
  syncTimer = setInterval(() => {
    void sync?.run();
    if (database) backupDatabase(database, dataDir());
  }, SYNC_INTERVAL_MS);
  agendaTimer = setInterval(() => { updateAgenda().catch((error: unknown) => log(`Agenda bijwerken mislukt: ${error instanceof Error ? error.message : String(error)}`)); }, AGENDA_INTERVAL_MS);
  void sync.run();

  ipcMain.handle("quick-note:save", async (_event, text: string) => {
    await addQuickNote(workspaceDb(), String(text));
    refreshWindow();
    return true;
  });
  ipcMain.on("quick-note:close", () => noteWindow?.close());
  ipcMain.handle("reminders:list", () => loadReminders(remindersFile()));
  ipcMain.handle("reminders:add", (_event, input: Parameters<typeof addReminder>[1]) => {
    try {
      const reminders = addReminder(loadReminders(remindersFile()), input, randomUUID());
      saveReminders(remindersFile(), reminders);
      void updateAgenda();
      return { reminders };
    } catch (error) {
      return { error: error instanceof Error ? error.message : String(error) };
    }
  });
  ipcMain.handle("reminders:remove", (_event, id: string) => {
    const reminders = removeReminder(loadReminders(remindersFile()), String(id));
    saveReminders(remindersFile(), reminders);
    void updateAgenda();
    return reminders;
  });
  ipcMain.on("reminders:close", () => remindersWindow?.close());
  ipcMain.handle("reminders:quick", (_event, text: string, popup: boolean) => {
    const result = addReminderFromText(String(text), popup === true);
    return "error" in result ? { error: result.error } : { reminders: result.reminders };
  });
  ipcMain.handle("search:initial", () => initialSearch);
  ipcMain.handle("search:query", async (_event, text: string) => searchWorkspace((await loadWorkspace(workspaceDb())).items, String(text)));
  ipcMain.on("search:open", (_event, hit: { id: string; rowId?: string }) => {
    searchWindow?.close();
    openItem(String(hit.id), hit.rowId ? String(hit.rowId) : undefined);
  });
  ipcMain.on("search:close", () => searchWindow?.close());
  // Reminders that came due while the app was closed fire right away.
  checkReminders();
  reminderTimer = setInterval(checkReminders, REMINDER_INTERVAL_MS);
  globalShortcut.register(QUICK_NOTE_SHORTCUT, openQuickNote);
  globalShortcut.register(SHOW_APP_SHORTCUT, showWindow);
  globalShortcut.register(REMINDERS_SHORTCUT, openReminders);
  globalShortcut.register(SEARCH_SHORTCUT, () => openSearch());
  app.dock?.setMenu(Menu.buildFromTemplate([
    { label: "Snelle notitie", click: openQuickNote },
    { label: "Klembord als notitie", click: () => { void noteFromClipboard(); } },
    { label: "Nieuwe herinnering...", click: openReminders },
    { label: "Zoeken...", click: () => openSearch() },
  ]));

  createMenus();
  createTray();
  // When macOS starts the app at login it stays in the menu bar until you open it.
  const openedByLink = pendingLinks.length > 0;
  if (!app.getLoginItemSettings().wasOpenedAtLogin && !openedByLink) createWindow();
  started = true;
  for (const link of pendingLinks.splice(0)) receiveLink(link);
};

// The data folder keeps its original name (~/Library/Application Support/personal-space) while menus say "Personal Space".
// PERSONAL_SPACE_DATA_DIR lets tests and a second profile use their own folder.
const userData = process.env.PERSONAL_SPACE_DATA_DIR || app.getPath("userData");
app.setName("Personal Space");
app.setPath("userData", userData);

app.on("web-contents-created", (_event, contents) => {
  contents.on("context-menu", (_menuEvent, params) => {
    const template = contextMenuTemplate(params, {
      replaceMisspelling: (word) => contents.replaceMisspelling(word),
      addToDictionary: (word) => contents.session.addWordToSpellCheckerDictionary(word),
      openExternal: (url) => { void shell.openExternal(url); },
      copyText: (text) => clipboard.writeText(text),
    });
    if (template.length) Menu.buildFromTemplate(template).popup();
  });
});

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  // macOS delivers personal-space:// links here, also when the link started the app.
  app.on("open-url", (event, link) => { event.preventDefault(); receiveLink(link); });
  app.on("second-instance", (_event, argv) => {
    const link = argv.find((argument) => argument.startsWith(`${URL_SCHEME}://`));
    if (link) receiveLink(link);
    else showWindow();
  });
  if (process.defaultApp) app.setAsDefaultProtocolClient(URL_SCHEME, process.execPath, [process.argv[1]]);
  else app.setAsDefaultProtocolClient(URL_SCHEME);
  app.on("activate", () => { if (!window && server) createWindow(); });
  // On macOS the app stays running after the last window closes; Cmd+Q quits.
  app.on("window-all-closed", () => {});
  app.on("will-quit", () => {
    if (syncTimer) clearInterval(syncTimer);
    if (agendaTimer) clearInterval(agendaTimer);
    if (reminderTimer) clearInterval(reminderTimer);
    globalShortcut.unregisterAll();
    server?.close();
    database?.close();
  });
  app.whenReady().then(start).catch((error: unknown) => {
    dialog.showErrorBox("Personal Space kon niet starten", error instanceof Error ? error.message : String(error));
    app.quit();
  });
}
