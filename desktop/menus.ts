import { Menu } from "electron";

export const SHORTCUTS = {
  quickNote: "CommandOrControl+Alt+N",
  reminders: "CommandOrControl+Alt+R",
  search: "CommandOrControl+Alt+K",
  showApp: "CommandOrControl+Alt+P",
} as const;

export type MenuActions = {
  quickNote: () => void;
  clipboardNote: () => void;
  reminders: () => void;
  search: () => void;
  syncNow: () => void;
  importMarkdown: () => void;
  exportMarkdown: () => void;
  exportPdf: () => void;
  restoreBackup: () => void;
  backupNow: () => void;
  openDataFolder: () => void;
  openLog: () => void;
  testNotification: () => void;
  settings: () => void;
  toggleLaunchAtLogin: () => void;
};

/** The actions that also appear in the menu bar icon and the Dock menu. */
export const quickActions = (actions: MenuActions): Electron.MenuItemConstructorOptions[] => [
  { label: "Snelle notitie", click: actions.quickNote },
  { label: "Klembord als notitie", click: actions.clipboardNote },
  { label: "Nieuwe herinnering...", click: actions.reminders },
  { label: "Zoeken...", click: actions.search },
];

export const setApplicationMenu = (actions: MenuActions, openAtLogin: boolean) => {
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    {
      // Spelled out because the internal app name stays "personal-space" for the Keychain.
      label: "Personal Space",
      submenu: [
        { label: "Over Personal Space", role: "about" },
        { type: "separator" },
        { label: "Instellingen...", accelerator: "CommandOrControl+,", click: actions.settings },
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
        { label: "Snelle notitie", accelerator: SHORTCUTS.quickNote, click: actions.quickNote },
        { label: "Klembord als notitie", click: actions.clipboardNote },
        { label: "Nieuwe herinnering...", accelerator: SHORTCUTS.reminders, click: actions.reminders },
        { label: "Zoeken...", accelerator: SHORTCUTS.search, click: actions.search },
        { label: "Nu synchroniseren", click: actions.syncNow },
        { type: "separator" },
        { label: "Importeer Markdown-map...", click: actions.importMarkdown },
        { label: "Exporteer als Markdown...", click: actions.exportMarkdown },
        { label: "Exporteer als PDF...", click: actions.exportPdf },
        { label: "Back-up terugzetten...", click: actions.restoreBackup },
        { label: "Maak back-up nu", click: actions.backupNow },
        { label: "Open datamap", click: actions.openDataFolder },
        { label: "Open logbestand", click: actions.openLog },
        { label: "Stuur test-melding", click: actions.testNotification },
        { type: "separator" },
        { label: "Start bij inloggen", type: "checkbox", checked: openAtLogin, click: actions.toggleLaunchAtLogin },
        { role: "close" },
      ],
    },
    { role: "editMenu" },
    { role: "viewMenu" },
    { role: "windowMenu" },
  ]));
};
