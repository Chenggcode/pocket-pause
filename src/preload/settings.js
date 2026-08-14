const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('pauseApi', {
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (settings) => ipcRenderer.invoke('settings:save', settings),
  onSettingsChanged: (callback) => ipcRenderer.on('settings:changed', (_event, value) => callback(value)),
  onStatusChanged: (callback) => ipcRenderer.on('status:changed', (_event, value) => callback(value))
});
