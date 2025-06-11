const { app } = require('electron');
const ClipboardManagerApp = require('./src/app');

// Prevent multiple instances
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  console.log('Another instance is already running, quitting...');
  app.quit();
} else {
  // Create and start the application
  const clipboardManagerApp = new ClipboardManagerApp();
  
  // Make app instance globally available for debugging
  global.clipboardManagerApp = clipboardManagerApp;
}
