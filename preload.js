const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktop', {
  quit: () => ipcRenderer.send('app-quit'),
  toggleFullscreen: () => ipcRenderer.send('toggle-fullscreen'),
});
