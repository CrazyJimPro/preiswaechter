// Einzige Verbindung zwischen Oberfläche und Hauptprozess.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('pw', {
  call: (method, ...args) => ipcRenderer.invoke('pw', method, ...args),
  onChanged: (fn) => ipcRenderer.on('pw:changed', () => fn()),
});
