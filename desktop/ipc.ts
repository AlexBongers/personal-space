import { ipcMain } from "electron";
import type { Commands } from "./commands.ts";
import type { createReminderService } from "./reminder-service.ts";
import type { ReminderInput } from "./reminders.ts";
import type { Windows } from "./windows.ts";

const describe = (error: unknown) => error instanceof Error ? error.message : String(error);

/** The only channels the tool windows can use. Every value from a page is converted before use. */
export const registerIpc = (commands: Commands, reminders: ReturnType<typeof createReminderService>, windows: Windows) => {
  ipcMain.handle("quick-note:save", async (_event, text: unknown) => Boolean(await commands.saveNote(String(text))));
  ipcMain.on("quick-note:close", () => windows.closeTool("note"));

  ipcMain.handle("reminders:list", () => reminders.list());
  ipcMain.handle("reminders:add", (_event, input: ReminderInput) => {
    try { return { reminders: reminders.add(input) }; } catch (error) { return { error: describe(error) }; }
  });
  ipcMain.handle("reminders:quick", (_event, text: unknown, popup: unknown) => {
    const result = reminders.addFromText(String(text), popup === true);
    return "error" in result ? { error: result.error } : { reminders: result.reminders };
  });
  ipcMain.handle("reminders:remove", (_event, id: unknown) => reminders.remove(String(id)));
  ipcMain.on("reminders:close", () => windows.closeTool("reminders"));

  ipcMain.handle("search:initial", () => commands.initialSearch());
  ipcMain.handle("search:query", (_event, text: unknown) => commands.search(String(text)));
  ipcMain.on("search:open", (_event, hit: { id?: unknown; rowId?: unknown }) => {
    windows.closeTool("search");
    windows.openItem(String(hit.id), hit.rowId ? String(hit.rowId) : undefined);
  });
  ipcMain.on("search:close", () => windows.closeTool("search"));
};
