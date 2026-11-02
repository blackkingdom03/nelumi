const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('deskcal', {
  openExternal: (url) => ipcRenderer.invoke('links:open', url),
  getState: () => ipcRenderer.invoke('app:get-state'),
  getHolidays: (year, force = false) => ipcRenderer.invoke('holidays:get', year, force),
  saveEvents: (events) => ipcRenderer.invoke('events:save', events),
  saveCalendars: (calendars) => ipcRenderer.invoke('calendars:save', calendars),
  updateSettings: (patch) => ipcRenderer.invoke('settings:update', patch),
  setSettingsOpen: (open) => ipcRenderer.send('settings:panel-open', open),
  windowAction: (action) => ipcRenderer.invoke('window:action', action),
  exportData: () => ipcRenderer.invoke('data:export'),
  importData: () => ipcRenderer.invoke('data:import'),
  onCreateRequest: (callback) => ipcRenderer.on('event:create-request', callback),
  onOpenSettings: (callback) => ipcRenderer.on('settings:open-request', callback),
  onSettingsChanged: (callback) =>
    ipcRenderer.on('settings:changed', (_event, value) => callback(value)),
  onReminder: (callback) =>
    ipcRenderer.on('reminder:fired', (_event, value) => callback(value)),
  onReminderOpen: (callback) =>
    ipcRenderer.on('reminder:open', (_event, eventId) => callback(eventId))
});
