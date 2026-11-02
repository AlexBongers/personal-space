import { Menu, nativeImage, Tray } from "electron";

export type TrayLine = { label: string; click?: () => void };
export type TraySection = { heading: string; lines: TrayLine[] };

const MAX_LINES = 8;

/**
 * The menu bar icon. Its menu is rebuilt only when what it shows changes, not on every minute tick,
 * so no new native menus pile up while the app runs for days.
 */
export const createTray = (iconPath: string, actions: Electron.MenuItemConstructorOptions[]) => {
  // A "Template" image is black with transparency; macOS tints it for light and dark menu bars and picks @2x itself.
  const icon = nativeImage.createFromPath(iconPath);
  icon.setTemplateImage(true);
  const tray = new Tray(icon);
  tray.setToolTip("Personal Space");
  let shown = "";

  const update = (title: string, sections: TraySection[]) => {
    const signature = JSON.stringify([title, sections.map((section) => [section.heading, section.lines.slice(0, MAX_LINES).map((line) => line.label)])]);
    if (signature === shown) return;
    shown = signature;
    tray.setTitle(title);
    const rows = sections.filter((section) => section.lines.length).flatMap((section): Electron.MenuItemConstructorOptions[] => [
      { label: section.heading, enabled: false },
      ...section.lines.slice(0, MAX_LINES).map((line) => ({ label: line.label, enabled: Boolean(line.click), click: line.click })),
      { type: "separator" },
    ]);
    tray.setContextMenu(Menu.buildFromTemplate([...actions, { type: "separator" }, ...rows, { label: "Stop", role: "quit" }]));
  };

  return { update, destroy: () => tray.destroy() };
};
