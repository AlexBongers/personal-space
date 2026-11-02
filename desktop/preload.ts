import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("quickNote", {
  save: (text: string): Promise<boolean> => ipcRenderer.invoke("quick-note:save", text),
  close: () => ipcRenderer.send("quick-note:close"),
});
