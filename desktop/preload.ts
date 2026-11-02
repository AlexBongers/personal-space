import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("quickNote", {
  save: (text: string): Promise<boolean> => ipcRenderer.invoke("quick-note:save", text),
  close: () => ipcRenderer.send("quick-note:close"),
});

contextBridge.exposeInMainWorld("reminders", {
  list: () => ipcRenderer.invoke("reminders:list"),
  add: (input: unknown) => ipcRenderer.invoke("reminders:add", input),
  remove: (id: string) => ipcRenderer.invoke("reminders:remove", id),
  close: () => ipcRenderer.send("reminders:close"),
});
