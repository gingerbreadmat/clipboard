const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Clipboard operations
  getClipboardHistory: () => ipcRenderer.invoke('get-clipboard-history'),
  searchClipboard: (query) => ipcRenderer.invoke('search-clipboard', query),
  copyToClipboard: (content, type) => ipcRenderer.invoke('copy-to-clipboard', content, type),
  deleteClipboardItem: (id) => ipcRenderer.invoke('delete-clipboard-item', id),
  pinClipboardItem: (id, pinned) => ipcRenderer.invoke('pin-clipboard-item', id, pinned),
  clearClipboardHistory: () => ipcRenderer.invoke('clear-clipboard-history'),
  
  // Settings operations
  openSettings: () => ipcRenderer.invoke('open-settings'),
  closeSettings: () => ipcRenderer.invoke('close-settings'),
  openDataFolder: () => ipcRenderer.invoke('open-data-folder'),
  quitApplication: () => ipcRenderer.invoke('quit-application'),
  
  // Image operations
  loadImageFromPath: (filePath) => ipcRenderer.invoke('load-image-from-path', filePath),
  
  // Event listeners
  onWindowShown: (callback) => ipcRenderer.on('window-shown', callback),
  onHistoryCleared: (callback) => ipcRenderer.on('history-cleared', callback),
  onClipboardItemAdded: (callback) => ipcRenderer.on('clipboard-item-added', callback),
  
  // Remove event listeners
  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel)
});