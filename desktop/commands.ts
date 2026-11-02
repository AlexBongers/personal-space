import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { app, clipboard, dialog, shell } from "electron";
import { createEmptyPage } from "../app/personal-space/model.ts";
import type { Item } from "../app/personal-space/types.ts";
import { saveWorkspace } from "../worker/workspace-store.ts";
import { backupDatabase } from "./backup.ts";
import type { Settings } from "./config.ts";
import type { D1Database } from "./d1-sqlite.ts";
import { parseDeepLink } from "./deep-link.ts";
import { exportMarkdown } from "./markdown-export.ts";
import { importMarkdown } from "./markdown-import.ts";
import type { Notify } from "./notifier.ts";
import type { AppPaths } from "./paths.ts";
import { QUICK_NOTE_HTML, addQuickNote } from "./quick-note.ts";
import type { createReminderService } from "./reminder-service.ts";
import type { Reminder } from "./reminders.ts";
import { REMINDERS_HTML } from "./reminders-ui.ts";
import { restoreBackup } from "./restore.ts";
import { searchWorkspace } from "./search.ts";
import { SEARCH_HTML } from "./search-ui.ts";
import type { Windows } from "./windows.ts";
import { asWorkspaceDatabase, readItems, readRevision } from "./workspace.ts";

export type CommandContext = {
  database: D1Database;
  paths: AppPaths;
  settings: Settings;
  windows: Windows;
  notify: Notify;
  reminders: ReturnType<typeof createReminderService>;
  log: (message: string) => void;
  /** Stops the server and closes the database before the database file is replaced. */
  shutdown: () => void;
};

const describe = (error: unknown) => error instanceof Error ? error.message : String(error);

export const createCommands = ({ database, paths, settings, windows, notify, reminders, log, shutdown }: CommandContext) => {
  const workspaceDb = asWorkspaceDatabase(database);
  let initialSearch = "";
  // The search window keeps one parsed copy of the workspace while it is open, and drops it when it closes.
  let searchCache: { revision: number; items: Item[] } | null = null;

  const saveNote = async (text: string, confirmation?: string) => {
    const pageId = await addQuickNote(workspaceDb, text);
    windows.refresh();
    if (confirmation) notify("Notitie bewaard", confirmation, () => { if (pageId) windows.openItem(pageId); });
    return pageId;
  };

  const backup = (manual = false) => {
    try {
      return backupDatabase(database, paths.dataDir, new Date(), settings.backupDir, manual);
    } catch (error) {
      log(`Back-up mislukt: ${describe(error)}`);
      return false;
    }
  };

  const openQuickNote = () => windows.openTool("note", { width: 460, height: 240, alwaysOnTop: true, resizable: false, minimizable: false, maximizable: false, title: "Snelle notitie" }, QUICK_NOTE_HTML);
  const openReminders = () => windows.openTool("reminders", { width: 560, height: 560, title: "Herinneringen" }, REMINDERS_HTML);

  const openSearch = (query = "") => {
    initialSearch = query;
    windows.closeTool("search");
    const window = windows.openTool("search", { width: 640, height: 440, alwaysOnTop: true, minimizable: false, maximizable: false, title: "Zoeken in Personal Space" }, SEARCH_HTML, true);
    window.on("closed", () => { searchCache = null; });
  };

  const search = async (text: string) => {
    const revision = readRevision(database);
    if (searchCache?.revision !== revision) searchCache = { revision, items: await readItems(database) };
    return searchWorkspace(searchCache.items, text);
  };

  /** A pop-up stays on screen until it is handled; it can be postponed instead of dismissed. */
  const showPopup = async (text: string) => {
    app.focus({ steal: true });
    const minutes = [0, 10, 60];
    const { response } = await dialog.showMessageBox({ type: "info", message: text, detail: "Herinnering van Personal Space", buttons: ["Klaar", "Over 10 minuten", "Over 1 uur"], defaultId: 0, cancelId: 0 });
    if (minutes[response] > 0) reminders.snooze(text, minutes[response]);
  };

  const fireReminders = (due: Reminder[]) => {
    for (const reminder of due) {
      notify("Herinnering", reminder.text, openReminders);
      if (reminder.popup) void showPopup(reminder.text);
    }
  };

  const handleDeepLink = async (link: string) => {
    const action = parseDeepLink(link);
    if (action.action === "note") await saveNote(action.text, action.text);
    else if (action.action === "reminder") {
      const result = reminders.addFromText(action.text, false, action.at);
      if ("error" in result) notify("Herinnering niet gezet", result.error ?? "");
      else notify("Herinnering gezet", `${result.text} - ${result.at.toLocaleString("nl-NL", { dateStyle: "medium", timeStyle: "short" })}`, openReminders);
    } else if (action.action === "open") windows.openItem(action.id, action.rowId);
    else if (action.action === "search") openSearch(action.query);
    else windows.show();
  };

  const clipboardNote = async () => {
    const text = await clipboard.readText();
    if (!text.trim()) { notify("Klembord is leeg", "Kopieer eerst wat tekst."); return; }
    await saveNote(text, "Het klembord staat op de pagina Snelle notities.");
  };

  const exportToMarkdown = async () => {
    const chosen = await dialog.showOpenDialog({ title: "Kies een map voor de export", properties: ["openDirectory", "createDirectory"] });
    if (chosen.canceled) return;
    const target = join(chosen.filePaths[0], "Personal Space export");
    const count = exportMarkdown(await readItems(database), target);
    notify("Export klaar", `${count} bestanden geschreven naar ${target}`, () => { void shell.openPath(target); });
    void shell.openPath(target);
  };

  const importFromMarkdown = async () => {
    const chosen = await dialog.showOpenDialog({ title: "Kies een map met Markdown-bestanden", properties: ["openDirectory"] });
    if (chosen.canceled) return;
    const container = { ...createEmptyPage(null), title: `Import ${new Date().toLocaleDateString("nl-NL")}`, icon: "📥" };
    const pages = importMarkdown(chosen.filePaths[0], container.id);
    const revision = readRevision(database);
    const saved = await saveWorkspace(workspaceDb, [...await readItems(database), container, ...pages], revision);
    if (!saved.ok) { notify("Import mislukt", "De workspace veranderde tijdens het importeren. Probeer opnieuw."); return; }
    windows.refresh();
    notify("Import klaar", `${pages.length} pagina's toegevoegd onder "${container.title}".`, () => windows.openItem(container.id));
  };

  const exportPdf = async () => {
    const window = windows.mainWindow();
    if (!window) { notify("Geen venster", "Open eerst de pagina die je wilt exporteren."); return; }
    const target = await dialog.showSaveDialog(window, { title: "Exporteer als PDF", defaultPath: join(app.getPath("documents"), "Personal Space.pdf"), filters: [{ name: "PDF", extensions: ["pdf"] }] });
    if (target.canceled || !target.filePath) return;
    writeFileSync(target.filePath, await window.webContents.printToPDF({ printBackground: true }));
    shell.showItemInFolder(target.filePath);
  };

  const restoreFromBackup = async () => {
    const chosen = await dialog.showOpenDialog({ title: "Kies een back-up", defaultPath: paths.backups, filters: [{ name: "Back-ups", extensions: ["sqlite"] }], properties: ["openFile"] });
    if (chosen.canceled) return;
    const { response } = await dialog.showMessageBox({
      type: "warning",
      message: "Back-up terugzetten?",
      detail: "Alle huidige gegevens worden vervangen door deze back-up. De huidige database blijft bewaard in de map backups.",
      buttons: ["Terugzetten", "Annuleren"],
      defaultId: 1,
      cancelId: 1,
    });
    if (response !== 0) return;
    shutdown();
    restoreBackup(paths.dataDir, chosen.filePaths[0]);
    app.relaunch();
    app.exit(0);
  };

  const backupNow = () => {
    if (backup(true)) notify("Back-up gemaakt", "De back-up staat in de map backups.", () => { void shell.openPath(paths.backups); });
    else notify("Back-up mislukt", "Bekijk het logbestand voor de oorzaak.", () => { void shell.openPath(paths.log); });
  };

  // Menu clicks cannot await; failures go to the log and a notification instead of disappearing.
  const safely = (name: string, action: () => Promise<unknown> | unknown) => () => {
    Promise.resolve().then(action).catch((error: unknown) => {
      log(`${name} mislukt: ${describe(error)}`);
      notify(`${name} mislukt`, describe(error));
    });
  };

  return {
    saveNote,
    backup,
    search,
    initialSearch: () => initialSearch,
    fireReminders,
    handleDeepLink,
    openQuickNote,
    openReminders,
    openSearch,
    menu: {
      quickNote: openQuickNote,
      clipboardNote: safely("Klembordnotitie", clipboardNote),
      reminders: openReminders,
      search: () => openSearch(),
      importMarkdown: safely("Import", importFromMarkdown),
      exportMarkdown: safely("Export", exportToMarkdown),
      exportPdf: safely("PDF-export", exportPdf),
      restoreBackup: safely("Terugzetten", restoreFromBackup),
      backupNow,
      openDataFolder: () => { void shell.openPath(paths.dataDir); },
      openLog: () => { void shell.openPath(paths.log); },
      settings: () => { void shell.openPath(paths.config); },
    },
  };
};

export type Commands = ReturnType<typeof createCommands>;
