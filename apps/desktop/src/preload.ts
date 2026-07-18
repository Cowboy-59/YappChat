import { contextBridge, ipcRenderer } from "electron";

// Spec 089 — the DesktopBridge the renderer reads via getDesktopBridge().
contextBridge.exposeInMainWorld("yappchatDesktop", {
  isDesktop: true,
  startControl: (token: string, wsUrl: string) => ipcRenderer.send("control:start", token, wsUrl),
  stopControl: () => ipcRenderer.send("control:stop"),
});
