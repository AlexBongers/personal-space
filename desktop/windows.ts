import { readFileSync, writeFileSync } from "node:fs";
import { BrowserWindow, screen, shell } from "electron";

export type ToolName = "note" | "reminders" | "search";

type WindowOptions = {
  origin: string;
  boundsFile: string;
  preload: string;
  log: (message: string) => void;
};

const SAFE = { contextIsolation: true, sandbox: true, nodeIntegration: false } as const;

/**
 * The main window and the small tool windows. A closed window is destroyed, not hidden, so its renderer
 * process and memory are released; the app then lives on in the menu bar with only the main process.
 */
export const createWindows = ({ origin, boundsFile, preload, log }: WindowOptions) => {
  let main: BrowserWindow | null = null;
  let waitingForGoogle = false;
  const tools = new Map<ToolName, BrowserWindow>();

  /** The last size and place, unless that place is on a display that is no longer connected. */
  const loadBounds = (): Partial<Electron.Rectangle> => {
    let saved: Electron.Rectangle;
    try { saved = JSON.parse(readFileSync(boundsFile, "utf8")) as Electron.Rectangle; } catch { return { width: 1280, height: 860 }; }
    const visible = screen.getAllDisplays().some(({ workArea }) =>
      saved.x < workArea.x + workArea.width && saved.x + saved.width > workArea.x && saved.y < workArea.y + workArea.height && saved.y + saved.height > workArea.y);
    return visible ? saved : { width: saved.width, height: saved.height };
  };

  const run = (script: string) => { void main?.webContents.executeJavaScript(script).catch(() => {}); };

  /** Tells the page that the workspace changed outside it; the page merges the server version with unsaved edits. */
  const refresh = () => run('window.dispatchEvent(new Event("personal-space:refresh"))');

  const createMain = (query = "") => {
    const window = new BrowserWindow({ ...loadBounds(), minWidth: 720, minHeight: 480, webPreferences: SAFE });
    main = window;
    window.on("close", () => writeFileSync(boundsFile, JSON.stringify(window.getBounds())));
    window.on("closed", () => { if (main === window) main = null; });
    // After signing in with Google in the browser, reload once so the new connection shows up.
    // Otherwise pull in what changed meanwhile, such as background syncs and quick notes.
    window.on("focus", () => {
      if (waitingForGoogle) { waitingForGoogle = false; window.webContents.reload(); } else refresh();
    });
    window.webContents.on("render-process-gone", (_event, details) => {
      log(`Venster vastgelopen (${details.reason}); opnieuw geladen.`);
      if (details.reason !== "clean-exit") window.webContents.reload();
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

  const show = () => {
    if (!main) { createMain(); return; }
    if (main.isMinimized()) main.restore();
    main.show();
    main.focus();
  };

  /** Shows the window on a page, or on a row of a database page. */
  const openItem = (id: string, rowId?: string) => {
    if (!main) { createMain(`?${new URLSearchParams(rowId ? { open: id, row: rowId } : { open: id })}`); return; }
    show();
    run(`window.dispatchEvent(new CustomEvent("personal-space:open", { detail: ${JSON.stringify({ id, rowId })} }))`);
  };

  /** Opens a tool window once; a second request focuses it. Its page talks to the app through the preload bridge only. */
  const openTool = (name: ToolName, options: Electron.BrowserWindowConstructorOptions, html: string, closeOnBlur = false) => {
    const existing = tools.get(name);
    if (existing) { existing.focus(); return existing; }
    const window = new BrowserWindow({ ...options, webPreferences: { ...SAFE, preload } });
    tools.set(name, window);
    window.on("closed", () => tools.delete(name));
    if (closeOnBlur) window.on("blur", () => window.close());
    window.webContents.on("render-process-gone", () => window.destroy());
    void window.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    return window;
  };

  return {
    createMain,
    show,
    refresh,
    openItem,
    openTool,
    closeTool: (name: ToolName) => tools.get(name)?.close(),
    mainWindow: () => main,
  };
};

export type Windows = ReturnType<typeof createWindows>;
