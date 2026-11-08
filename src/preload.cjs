// Einzige Verbindung zwischen Oberfläche und Hauptprozess.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('pw', {
  call: (method, ...args) => ipcRenderer.invoke('pw', method, ...args),
  onChanged: (fn) => ipcRenderer.on('pw:changed', () => fn()),
  onOpenProduct: (fn) => ipcRenderer.on('pw:open-product', (event, id) => fn(id)),
});
