import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("quickNote", {
  save: (text: string): Promise<boolean> => ipcRenderer.invoke("quick-note:save", text),
  close: () => ipcRenderer.send("quick-note:close"),
});

contextBridge.exposeInMainWorld("reminders", {
  list: () => ipcRenderer.invoke("reminders:list"),
  add: (input: unknown) => ipcRenderer.invoke("reminders:add", input),
  quick: (text: string, popup: boolean) => ipcRenderer.invoke("reminders:quick", text, popup),
  remove: (id: string) => ipcRenderer.invoke("reminders:remove", id),
  close: () => ipcRenderer.send("reminders:close"),
});

contextBridge.exposeInMainWorld("search", {
  initial: (): Promise<string> => ipcRenderer.invoke("search:initial"),
  query: (text: string) => ipcRenderer.invoke("search:query", text),
  open: (hit: { id: string; rowId?: string }) => ipcRenderer.send("search:open", { id: hit.id, rowId: hit.rowId }),
  close: () => ipcRenderer.send("search:close"),
});
