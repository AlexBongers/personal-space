import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { app, clipboard, dialog, globalShortcut, Menu, powerMonitor, safeStorage, shell } from "electron";
import { GOOGLE_CALENDAR_DATABASE_ID, GOOGLE_TASKS_DATABASE_ID } from "../app/personal-space/model.ts";
import { createDayCache, createEventAnnouncer } from "./agenda.ts";
import { createBackgroundSync, type InboxMessage } from "./background-sync.ts";
import { createCommands, type Commands } from "./commands.ts";
import { KeychainError, loadEnv, loadSettings, setKeysAside } from "./config.ts";
import { contextMenuTemplate } from "./context-menu.ts";
import { D1Database } from "./d1-sqlite.ts";
import { URL_SCHEME } from "./deep-link.ts";
import { registerIpc } from "./ipc.ts";
import { writeLog } from "./logger.ts";
import { quickActions, setApplicationMenu, SHORTCUTS } from "./menus.ts";
import { migrate } from "./migrate.ts";
import { createNotifier } from "./notifier.ts";
import { briefingDate, briefingDue, briefingText, freshMessages, loadNotifyState, saveNotifyState } from "./notifications.ts";
import { appPaths } from "./paths.ts";
import { createReminderService } from "./reminder-service.ts";
import { createScheduler } from "./scheduler.ts";
import { startLocalServer, type LocalServer } from "./server.ts";
import { createTray } from "./tray.ts";
import { createWindows, type Windows } from "./windows.ts";
import { readItems, readRevision } from "./workspace.ts";

const TICK_MS = 15_000;
const MINUTE = 60_000;
const NOTIFIED_AT_ONCE = 3;
const resources = import.meta.dirname;

// The internal app name stays "personal-space": macOS keeps the key that unlocks keys.bin in the Keychain under
// "<app name> Safe Storage", so renaming the app would lose the Google and Parro keys. Menus spell out "Personal Space".
// PERSONAL_SPACE_DATA_DIR lets tests and a second profile use their own folder.
if (process.env.PERSONAL_SPACE_DATA_DIR) app.setPath("userData", process.env.PERSONAL_SPACE_DATA_DIR);
// Run Chromium's network service inside the main process instead of a separate one: about 75 MB less, and the
// app only talks to localhost and a handful of APIs.
app.commandLine.appendSwitch("enable-features", "NetworkServiceInProcess2");
const paths = appPaths(app.getPath("userData"));
const log = (message: string) => { try { writeLog(paths.dataDir, message); } catch { /* Logging never stops the app. */ } };
const describe = (error: unknown) => error instanceof Error ? error.stack || error.message : String(error);

// A daily app must not show crash dialogs for a stray error in background work; it is logged instead.
process.on("uncaughtException", (error) => log(`Onverwachte fout: ${describe(error)}`));
process.on("unhandledRejection", (reason) => log(`Onafgehandelde fout: ${describe(reason)}`));

let windows: Windows | null = null;
let commands: Commands | null = null;
let shutdown: () => void = () => {};
const pendingLinks: string[] = [];

const receiveLink = (link: string) => {
  if (!commands) { pendingLinks.push(link); return; }
  commands.handleDeepLink(link).catch((error: unknown) => log(`Link mislukt: ${describe(error)}`));
};

/** When the Keychain cannot unlock keys.bin, offer new keys instead of a dead end. */
const loadKeysOrRecover = async () => {
  try {
    return await loadEnv(paths.dataDir, safeStorage);
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
    setKeysAside(paths.dataDir);
    return loadEnv(paths.dataDir, safeStorage);
  }
};

const start = async () => {
  mkdirSync(paths.dataDir, { recursive: true });
  const database = new D1Database(paths.database);
  migrate(database, join(resources, "drizzle"));
  const settings = loadSettings(paths.dataDir);
  const local: LocalServer = await startLocalServer({ distDir: resources, database, env: await loadKeysOrRecover(), port: settings.port });

  const ui = createWindows({ origin: local.origin, boundsFile: paths.windowBounds, preload: join(resources, "preload.cjs"), log });
  windows = ui;
  const { notify, sendTest } = createNotifier(log, ui.show);
  const notifyState = loadNotifyState(paths.notifyState);
  const saveState = () => saveNotifyState(paths.notifyState, notifyState);
  const todaySummary = createDayCache(() => readRevision(database), () => readItems(database));
  const announceEvents = createEventAnnouncer();

  let refreshTray = () => {};
  let stopJobs = () => {};
  const reminders = createReminderService(paths.reminders, () => refreshTray());

  shutdown = () => {
    stopJobs();
    globalShortcut.unregisterAll();
    local.close();
    database.close();
  };
  const cmd = createCommands({ database, paths, settings, windows: ui, notify, reminders, log, shutdown });
  commands = cmd;

  const announce = (source: string, messages: InboxMessage[], enabled: boolean, title: (message: InboxMessage) => string, body: (message: InboxMessage) => string, open: (message: InboxMessage) => void, more: string, openAll: () => void) => {
    const before = JSON.stringify(notifyState.seen[source] ?? null);
    const fresh = freshMessages(notifyState, source, messages);
    if (JSON.stringify(notifyState.seen[source]) !== before) saveState();
    if (!enabled) return;
    for (const message of fresh.slice(0, NOTIFIED_AT_ONCE)) notify(title(message), body(message), () => open(message));
    if (fresh.length > NOTIFIED_AT_ONCE) notify(source === "parro" ? "Parro" : "Gmail", `En nog ${fresh.length - NOTIFIED_AT_ONCE} ${more}`, openAll);
  };

  const sync = createBackgroundSync({
    fetch: local.fetch,
    origin: local.origin,
    isWindowOpen: () => ui.mainWindow() !== null,
    googleEveryMs: 15 * MINUTE,
    onError: log,
    onParro: (messages, unread) => {
      app.dock?.setBadge(unread > 0 ? String(unread) : "");
      announce("parro", messages, settings.notifyParro, (m) => m.sender || "Parro", (m) => [m.title, m.roomName].filter(Boolean).join(" - "), () => ui.openItem("parro"), "nieuwe berichten", () => ui.openItem("parro"));
    },
    onGmail: (messages) => announce("gmail", messages, settings.notifyGmail, (m) => m.sender || "Gmail", (m) => m.subject || "(geen onderwerp)",
      (m) => { if (m.url) void shell.openExternal(m.url); else ui.openItem("gmail"); }, "nieuwe e-mails", () => ui.openItem("gmail")),
  });

  const menuActions = {
    ...cmd.menu,
    syncNow: () => { void sync.run(); },
    testNotification: sendTest,
    toggleLaunchAtLogin: () => {
      app.setLoginItemSettings({ openAtLogin: !app.getLoginItemSettings().openAtLogin });
      setApplicationMenu(menuActions, app.getLoginItemSettings().openAtLogin);
    },
  };
  const tray = createTray(join(resources, "trayTemplate.png"), [{ label: "Open Personal Space", click: ui.show }, ...quickActions(menuActions), { label: "Nu synchroniseren", click: menuActions.syncNow }]);

  const updateAgenda = async (now = new Date()) => {
    const day = await todaySummary(now);
    const timeLabel = (at: string) => new Date(at).toLocaleString("nl-NL", { dateStyle: "short", timeStyle: "short" });
    tray.update(day.dueCount > 0 ? String(day.dueCount) : "", [
      { heading: "Herinneringen", lines: reminders.list().slice(0, 3).map((reminder) => ({ label: `${timeLabel(reminder.at)}  ${reminder.text}`, click: cmd.openReminders })) },
      { heading: "Agenda vandaag", lines: day.events.map((event) => ({ label: event.label, click: () => ui.openItem(GOOGLE_CALENDAR_DATABASE_ID, event.id) })) },
      { heading: "Taken (vandaag en achterstallig)", lines: day.tasks.map((task) => ({ label: task.label, click: () => ui.openItem(GOOGLE_TASKS_DATABASE_ID, task.id) })) },
    ]);
    if (settings.eventReminderMinutes > 0) {
      for (const event of announceEvents(day, now, settings.eventReminderMinutes)) notify(event.title, `Begint om ${event.time}`, () => ui.openItem(GOOGLE_CALENDAR_DATABASE_ID, event.id));
    }
    if (briefingDue(now, settings.briefingTime, notifyState.lastBriefing)) {
      notifyState.lastBriefing = briefingDate(now);
      saveState();
      const greeting = now.getHours() < 12 ? "Goedemorgen" : now.getHours() < 18 ? "Goedemiddag" : "Goedenavond";
      notify(`${greeting}, dit staat er vandaag op je planning`, briefingText(day, reminders.countOn(now)), () => ui.openItem("home"));
    }
  };
  refreshTray = () => { updateAgenda().catch((error: unknown) => log(`Menubalk bijwerken mislukt: ${describe(error)}`)); };

  const jobs = createScheduler([
    { name: "herinneringen", everyMs: TICK_MS, run: (now) => cmd.fireReminders(reminders.takeDue(now)) },
    { name: "agenda", everyMs: MINUTE, run: updateAgenda },
    { name: "back-up", everyMs: 5 * MINUTE, run: () => cmd.backup() },
    { name: "sync", everyMs: 5 * MINUTE, run: () => sync.run() },
  ], (name, error) => log(`Taak ${name} mislukt: ${describe(error)}`));
  stopJobs = jobs.stop;

  registerIpc(cmd, reminders, ui);
  globalShortcut.register(SHORTCUTS.quickNote, cmd.openQuickNote);
  globalShortcut.register(SHORTCUTS.showApp, ui.show);
  globalShortcut.register(SHORTCUTS.reminders, cmd.openReminders);
  globalShortcut.register(SHORTCUTS.search, () => cmd.openSearch());
  setApplicationMenu(menuActions, app.getLoginItemSettings().openAtLogin);
  app.dock?.setMenu(Menu.buildFromTemplate(quickActions(menuActions)));
  // The packaged app takes its icon from the bundle; `npm run desktop:dev` runs Electron's own, so set it here.
  if (process.defaultApp) app.dock?.setIcon(join(resources, "icon.png"));
  // After sleep, catch up at once instead of waiting for the next tick.
  powerMonitor.on("resume", () => { void jobs.tick(); });

  // Missed reminders, today's overview, the backup and the first sync all run right away.
  void jobs.tick();
  jobs.start(TICK_MS);

  // When macOS starts the app at login, or a link started it, it stays in the menu bar until opened.
  if (!app.getLoginItemSettings().wasOpenedAtLogin && !pendingLinks.length) ui.createMain();
  for (const link of pendingLinks.splice(0)) receiveLink(link);
};

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
    else windows?.show();
  });
  if (process.defaultApp) app.setAsDefaultProtocolClient(URL_SCHEME, process.execPath, [process.argv[1]]);
  else app.setAsDefaultProtocolClient(URL_SCHEME);
  app.on("activate", () => windows?.show());
  // On macOS the app stays running after the last window closes; Cmd+Q quits.
  app.on("window-all-closed", () => {});
  app.on("will-quit", () => shutdown());
  app.whenReady().then(start).catch((error: unknown) => {
    log(`Starten mislukt: ${describe(error)}`);
    dialog.showErrorBox("Personal Space kon niet starten", error instanceof Error ? error.message : String(error));
    app.quit();
  });
}
