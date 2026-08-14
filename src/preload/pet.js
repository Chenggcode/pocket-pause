const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('petApi', {
  hide: () => ipcRenderer.send('pet:hide'),
  act: (type, action) => ipcRenderer.send('reminder:action', { type, action }),
  onState: (callback) => ipcRenderer.on('pet:state', (_event, value) => callback(value))
});
