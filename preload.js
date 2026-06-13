const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  getCsvPath: () => ipcRenderer.invoke('get-csv-path'),
  readCsv: () => ipcRenderer.invoke('read-csv'),
  writeCsv: (content) => ipcRenderer.invoke('write-csv', content),
  logError: (msg) => ipcRenderer.send('log-error', msg)
});
