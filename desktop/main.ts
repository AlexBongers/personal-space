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
import { KeychainError, loadEnv, loadSettings, setKeysAside, type Settings } from "./config.ts";
import { D1Database } from "./d1-sqlite.ts";
import { writeLog } from "./logger.ts";
import { importMarkdown } from "./markdown-import.ts";
import { exportMarkdown } from "./markdown-export.ts";
import { migrate } from "./migrate.ts";
import { briefingDate, briefingDue, briefingText, freshMessages, loadNotifyState, saveNotifyState, type NotifyState } from "./notifications.ts";
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

const SYNC_INTERVAL_MS = 5 * 60 * 1000;
const GOOGLE_SYNC_INTERVAL_MS = 15 * 60 * 1000;
const NOTIFIED_AT_ONCE = 3;
const QUICK_NOTE_SHORTCUT = "CommandOrControl+Alt+N";
const SHOW_APP_SHORTCUT = "CommandOrControl+Alt+P";
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
let settings: Settings;
let notifyState: NotifyState = { seen: {}, lastBriefing: "" };
const pendingLinks: string[] = [];
const announcedEvents = new Set<string>();
const log = (message: string) => writeLog(dataDir(), message);

const dataDir = () => app.getPath("userData");
const boundsFile = () => join(dataDir(), "window.json");
const remindersFile = () => join(dataDir(), "reminders.json");
const notifyStateFile = () => join(dataDir(), "notify-state.json");
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
  notification.on("failed", (_event, error) => log(`Melding niet getoond (${title}): ${error}`));
  notification.show();
  return notification;
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

const NOTIFICATION_HELP = "Open Systeeminstellingen > Meldingen > Personal Space en zet 'Sta meldingen toe' aan. Staat Personal Space daar niet, bouw de app dan opnieuw met npm run desktop:build: macOS toont alleen meldingen van ondertekende apps. Een Focus-stand kan meldingen ook verbergen.";

/** Reports back what macOS did with the test notification, instead of failing silently. */
const sendTestNotification = () => {
  if (!Notification.isSupported()) {
    void dialog.showMessageBox({ type: "warning", message: "Meldingen worden niet ondersteund op dit systeem." });
    return;
  }
  const notification = notify("Personal Space", "Meldingen werken. Je ziet herinneringen, Parro en Gmail voortaan hier.");
  let answered = false;
  notification.on("show", () => { answered = true; });
  notification.on("failed", (_event, error) => {
    answered = true;
    void dialog.showMessageBox({ type: "warning", message: "macOS weigerde de melding", detail: `${error}\n\n${NOTIFICATION_HELP}` });
  });
  setTimeout(() => {
    if (!answered) void dialog.showMessageBox({ type: "info", message: "Geen melding gezien?", detail: NOTIFICATION_HELP, buttons: ["Open Meldingen-instellingen", "Sluit"], defaultId: 0, cancelId: 1 }).then(({ response }) => {
      if (response === 0) void shell.openExternal("x-apple.systempreferences:com.apple.Notifications-Settings.extension");
    });
  }, 4000);
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

/** Daily backup, also into the extra folder from config.json. A missing extra folder is logged, not fatal. */
const backup = (manual = false) => {
  if (!database) return false;
  try {
    return backupDatabase(database, dataDir(), new Date(), settings.backupDir, manual);
  } catch (error) {
    log(`Back-up mislukt: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
};

const toggleLaunchAtLogin = () => {
  app.setLoginItemSettings({ openAtLogin: !app.getLoginItemSettings().openAtLogin });
  createMenus();
};

const createMenus = () => {
  const openAtLogin = app.getLoginItemSettings().openAtLogin;
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    {
      // Spelled out because the internal app name stays "personal-space"; see the note at app.setPath.
      label: "Personal Space",
      submenu: [
        { label: "Over Personal Space", role: "about" },
        { type: "separator" },
        { label: "Instellingen...", accelerator: "CommandOrControl+,", click: openSettings },
        { type: "separator" },
        { role: "services" },
        { type: "separator" },
        { label: "Verberg Personal Space", role: "hide" },
        { role: "hideOthers" },
        { role: "unhide" },
        { type: "separator" },
        { label: "Stop Personal Space", role: "quit" },
      ],
    },
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
        { label: "Maak back-up nu", click: () => { if (backup(true)) notify("Back-up gemaakt", "De back-up staat in de map backups.", () => { void shell.openPath(join(dataDir(), "backups")); }); else notify("Back-up mislukt", "Bekijk het logbestand voor de oorzaak.", openLog); } },
        { label: "Open datamap", click: () => { void shell.openPath(dataDir()); } },
        { label: "Open logbestand", click: openLog },
        { label: "Stuur test-melding", click: sendTestNotification },
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
  if (settings.eventReminderMinutes > 0) {
    for (const event of upcomingEvents(items, now, settings.eventReminderMinutes, announcedEvents)) notify(event.title, `Begint om ${event.time}`, () => openItem(GOOGLE_CALENDAR_DATABASE_ID, event.id));
  }
  if (briefingDue(now, settings.briefingTime, notifyState.lastBriefing)) {
    notifyState.lastBriefing = briefingDate(now);
    saveNotifyState(notifyStateFile(), notifyState);
    const remindersToday = loadReminders(remindersFile()).filter((reminder) => briefingDate(new Date(reminder.at)) === briefingDate(now)).length;
    const greeting = now.getHours() < 12 ? "Goedemorgen" : now.getHours() < 18 ? "Goedemiddag" : "Goedenavond";
    notify(`${greeting}, dit staat er vandaag op je planning`, briefingText(day, remindersToday), () => openItem("home"));
  }
};

const createTray = () => {
  // A "Template" image is black with transparency; macOS tints it for light and dark menu bars and picks @2x itself.
  const icon = nativeImage.createFromPath(join(import.meta.dirname, "trayTemplate.png"));
  icon.setTemplateImage(true);
  tray = new Tray(icon);
  tray.setToolTip("Personal Space");
  void updateAgenda();
};

/** When the Keychain cannot unlock keys.bin, offer new keys instead of a dead end. */
const loadKeysOrRecover = async () => {
  try {
    return await loadEnv(dataDir(), safeStorage);
  } catch (error) {
    if (!(error instanceof KeychainError)) throw error;
    const { response } = await dialog.showMessageBox({
      type: "warning",
      message: "De sleutels konden niet worden gelezen",
      detail: `${error.message}\n\nJe pagina's en databases zijn veilig; die zijn niet versleuteld. Met nieuwe sleutels moet je Google en Parro opnieuw koppelen. De oude sleutels blijven bewaard in de datamap.`,
      buttons: ["Nieuwe sleutels maken", "Stop"],
      defaultId: 0,
      cancelId: 1,
    });
    if (response !== 0) throw new Error("Gestopt zonder sleutels.");
    log("Onleesbare sleutels apart gezet; nieuwe sleutels gemaakt.");
    setKeysAside(dataDir());
    return loadEnv(dataDir(), safeStorage);
  }
};

const start = async () => {
  mkdirSync(dataDir(), { recursive: true });
  database = new D1Database(join(dataDir(), "personal-space.sqlite"));
  migrate(database, join(import.meta.dirname, "drizzle"));
  settings = loadSettings(dataDir());
  backup();
  notifyState = loadNotifyState(notifyStateFile());
  const port = settings.port;
  origin = `http://localhost:${port}`;
  server = await startLocalServer({ distDir: import.meta.dirname, database, env: await loadKeysOrRecover(), port });

  sync = createBackgroundSync({
    baseUrl: origin,
    isWindowOpen: () => window !== null,
    onError: log,
    googleEveryMs: GOOGLE_SYNC_INTERVAL_MS,
    onParro: (messages, unread) => {
      app.dock?.setBadge(unread > 0 ? String(unread) : "");
      const fresh = freshMessages(notifyState, "parro", messages);
      saveNotifyState(notifyStateFile(), notifyState);
      if (!settings.notifyParro) return;
      for (const message of fresh.slice(0, NOTIFIED_AT_ONCE)) notify(message.sender || "Parro", [message.title, message.roomName].filter(Boolean).join(" - "), () => openItem("parro"));
      if (fresh.length > NOTIFIED_AT_ONCE) notify("Parro", `En nog ${fresh.length - NOTIFIED_AT_ONCE} nieuwe berichten`, () => openItem("parro"));
    },
    onGmail: (messages) => {
      const fresh = freshMessages(notifyState, "gmail", messages);
      saveNotifyState(notifyStateFile(), notifyState);
      if (!settings.notifyGmail) return;
      for (const message of fresh.slice(0, NOTIFIED_AT_ONCE)) notify(message.sender || "Gmail", message.subject || "(geen onderwerp)", () => { if (message.url) void shell.openExternal(message.url); else openItem("gmail"); });
      if (fresh.length > NOTIFIED_AT_ONCE) notify("Gmail", `En nog ${fresh.length - NOTIFIED_AT_ONCE} nieuwe e-mails`, () => openItem("gmail"));
    },
  });
  syncTimer = setInterval(() => {
    void sync?.run();
    backup();
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

  // The packaged app takes its icon from the bundle; `npm run desktop:dev` runs Electron's own, so set it here.
  if (process.defaultApp) app.dock?.setIcon(join(import.meta.dirname, "icon.png"));
  createMenus();
  createTray();
  // When macOS starts the app at login it stays in the menu bar until you open it.
  const openedByLink = pendingLinks.length > 0;
  if (!app.getLoginItemSettings().wasOpenedAtLogin && !openedByLink) createWindow();
  started = true;
  for (const link of pendingLinks.splice(0)) receiveLink(link);
};

// The internal app name stays "personal-space": macOS keeps the key that unlocks keys.bin in the Keychain under
// "<app name> Safe Storage", so renaming the app would lose the Google and Parro keys. Menus spell out "Personal Space".
// PERSONAL_SPACE_DATA_DIR lets tests and a second profile use their own folder.
if (process.env.PERSONAL_SPACE_DATA_DIR) app.setPath("userData", process.env.PERSONAL_SPACE_DATA_DIR);

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
