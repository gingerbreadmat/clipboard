const { app, BrowserWindow, Tray, Menu, globalShortcut, ipcMain, clipboard, nativeImage, dialog, shell, screen } = require('electron');
const path = require('path');
const fs = require('fs');
const ClipboardMonitor = require('./src/clipboard-monitor');
const Storage = require('./src/storage');
const Store = require('electron-store');

// Load native window manager
let nativeWindowManager;
try {
  nativeWindowManager = require('./build/Release/macos_window_manager.node');
  console.log('✅ Native macOS window manager loaded');
} catch (error) {
  console.log('⚠️ Native window manager not available:', error.message);
  nativeWindowManager = null;
}

// Track dock state to avoid unnecessary changes
let dockCurrentlyHidden = false;

function setDockVisibility(shouldHide) {
  if (process.platform !== 'darwin') return;
  
  // Only change dock if the state actually needs to change
  if (shouldHide === dockCurrentlyHidden) {
    console.log(`🏠 Dock already in correct state (hidden: ${dockCurrentlyHidden})`);
    return;
  }
  
  const { exec } = require('child_process');
  
  if (shouldHide) {
    console.log('🏠 Hiding dock for bottom positioning');
    // Try AppleScript approach first (might avoid restart)
    const appleScript = `
      tell application "System Events"
        tell dock preferences
          set autohide to true
        end tell
      end tell
    `;
    
    exec(`osascript -e '${appleScript}'`, (error) => {
      if (error) {
        console.log('AppleScript failed, falling back to defaults:', error);
        // Fallback to the original method
        exec('defaults write com.apple.dock autohide -bool true && killall Dock', (fallbackError) => {
          if (!fallbackError) {
            dockCurrentlyHidden = true;
            console.log('✅ Dock hidden (via defaults)');
          }
        });
      } else {
        dockCurrentlyHidden = true;
        console.log('✅ Dock hidden (via AppleScript)');
      }
    });
  } else {
    console.log('🏠 Showing dock for non-bottom positioning');
    // Try AppleScript approach first
    const appleScript = `
      tell application "System Events"
        tell dock preferences
          set autohide to false
        end tell
      end tell
    `;
    
    exec(`osascript -e '${appleScript}'`, (error) => {
      if (error) {
        console.log('AppleScript failed, falling back to defaults:', error);
        // Fallback to the original method
        exec('defaults write com.apple.dock autohide -bool false && killall Dock', (fallbackError) => {
          if (!fallbackError) {
            dockCurrentlyHidden = false;
            console.log('✅ Dock shown (via defaults)');
          }
        });
      } else {
        dockCurrentlyHidden = false;
        console.log('✅ Dock shown (via AppleScript)');
      }
    });
  }
}

let mainWindow;
let settingsWindow;
let tray;
let clipboardMonitor;
let storage;
let store;

console.log('🚀 Starting Clipboard Manager...');

function createWindow() {
  console.log('📱 Creating main window...');
  
  // Get the primary display's FULL bounds (includes dock/menu bar areas)
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight } = primaryDisplay.bounds;
  const { x: screenX, y: screenY } = primaryDisplay.bounds;
  
  console.log(`📺 Screen dimensions: ${screenWidth}x${screenHeight} at (${screenX}, ${screenY})`);
  
  // Get stored position
  const storedPosition = store.get('windowPosition', 'left');
  console.log('📍 Using stored position:', storedPosition);
  
  // Calculate initial bounds based on stored position
  let initialBounds = {};
  const sidebarWidth = 350;
  const sidebarHeight = screenHeight;
  
  switch (storedPosition) {
    case 'right':
      initialBounds = {
        x: screenX + screenWidth - sidebarWidth,
        y: screenY,
        width: sidebarWidth,
        height: sidebarHeight
      };
      break;
    case 'top':
      initialBounds = {
        x: screenX,
        y: screenY,
        width: screenWidth,
        height: 300
      };
      break;
    case 'bottom':
      initialBounds = {
        x: screenX,
        y: screenY + screenHeight - 300,
        width: screenWidth,
        height: 300
      };
      break;
    case 'window':
      initialBounds = {
        x: screenX + 100,
        y: screenY + 100,
        width: 400,
        height: 600
      };
      break;
    default: // 'left'
      initialBounds = {
        x: screenX,
        y: screenY,
        width: sidebarWidth,
        height: sidebarHeight
      };
  }
  
  mainWindow = new BrowserWindow({
    ...initialBounds,
    show: false,
    resizable: storedPosition === 'window',
    movable: storedPosition === 'window',
    minimizable: storedPosition === 'window',
    maximizable: storedPosition === 'window',
    fullscreenable: false,
    closable: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    },
    frame: false,
    transparent: true,
    vibrancy: 'sidebar',
    alwaysOnTop: true,
    skipTaskbar: true,
    level: 'screen-saver'
  });

  console.log('📄 Loading index.html...');
  mainWindow.loadFile('renderer/index.html');

  // Set the window level after creation for maximum overlay capability
  mainWindow.once('ready-to-show', () => {
    console.log('✅ Main window ready to show');
    
    // Apply correct positioning and window level based on stored position
    const currentPosition = store.get('windowPosition', 'left');
    console.log('🔧 Ready-to-show: Applying position logic for:', currentPosition);
    
    if (currentPosition === 'bottom' && nativeWindowManager) {
      console.log('🔧 Ready-to-show: Using native APIs for bottom position');
      // Apply native positioning immediately
      setTimeout(() => {
        applyWindowPosition(currentPosition);
      }, 100);
    } else {
      console.log('🔧 Ready-to-show: Using standard window level');
      mainWindow.setAlwaysOnTop(true, 'screen-saver');
    }
    
    // Force hide traffic light buttons
    try {
      if (process.platform === 'darwin') {
        mainWindow.setWindowButtonVisibility(false);
      }
    } catch (error) {
      console.log('Could not hide window buttons:', error.message);
    }
  });

  // Hide window instead of closing
  mainWindow.on('close', (event) => {
    if (!app.isQuiting) {
      event.preventDefault();
      mainWindow.hide();
      console.log('🙈 Main window hidden');
    } else {
      console.log('💀 Main window closing - app is quitting');
    }
  });

  // Show window when focused
  mainWindow.on('show', () => {
    console.log('👁️ Main window shown');
    mainWindow.webContents.send('window-shown');
    
    // Apply current theme when window is shown
    const currentTheme = store.get('theme', 'light');
    mainWindow.webContents.send('theme-changed', currentTheme);
    
    // Ensure correct window level based on position
    const currentPosition = store.get('windowPosition', 'left');
    if (currentPosition === 'bottom') {
      console.log('🔧 Reapplying bottom position window level');
      mainWindow.setAlwaysOnTop(true, 'pop-up-menu');
      
      // Reapply bounds for bottom position
      const primaryDisplay = screen.getPrimaryDisplay();
      const { width: screenWidth, height: screenHeight } = primaryDisplay.bounds;
      const { x: screenX, y: screenY } = primaryDisplay.bounds;
      const bottomBarHeight = 300;
      
      mainWindow.setBounds({
        x: screenX,
        y: screenY + screenHeight - bottomBarHeight,
        width: screenWidth,
        height: bottomBarHeight
      });
    } else {
      mainWindow.setAlwaysOnTop(true, 'screen-saver');
    }
  });

  // Hide when losing focus (clicking outside)
  mainWindow.on('blur', () => {
    console.log('😴 Main window lost focus, hiding...');
    mainWindow.hide();
  });

  // Add error handling for main window
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('❌ Main window failed to load:', errorCode, errorDescription);
  });

  mainWindow.webContents.on('did-finish-load', () => {
    console.log('✅ Main window finished loading');
  });
}

function createSettingsWindow() {
  console.log('⚙️ createSettingsWindow called');
  
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    console.log('⚙️ Settings window already exists, focusing...');
    settingsWindow.show();
    settingsWindow.focus();
    return;
  }

  console.log('⚙️ Creating new settings window...');
  
  settingsWindow = new BrowserWindow({
    width: 500,
    height: 800,
    minWidth: 400,
    minHeight: 600,
    show: false,
    resizable: true,
    movable: true,
    minimizable: true,
    maximizable: true,
    fullscreenable: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    },
    titleBarStyle: 'default',
    vibrancy: 'window',
    transparent: false,
    alwaysOnTop: false,
    skipTaskbar: false,
    frame: true,
    parent: null,
    modal: false
  });

  console.log('⚙️ Loading settings.html...');
  settingsWindow.loadFile('renderer/settings.html');

  settingsWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    console.error('❌ Settings window failed to load:', errorCode, errorDescription, validatedURL);
  });

  settingsWindow.webContents.on('did-finish-load', () => {
    console.log('✅ Settings window finished loading');
  });

  settingsWindow.webContents.on('dom-ready', () => {
    console.log('✅ Settings window DOM ready');
  });

  settingsWindow.on('closed', () => {
    console.log('⚙️ Settings window closed');
    settingsWindow = null;
  });

  settingsWindow.on('ready-to-show', () => {
    console.log('⚙️ Settings window ready to show');
    settingsWindow.show();
    settingsWindow.center();
    settingsWindow.focus();
    
    // Apply current theme when settings window is shown
    const currentTheme = store.get('theme', 'light');
    settingsWindow.webContents.send('theme-changed', currentTheme);
  });

  settingsWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('❌ Settings window failed to load:', errorCode, errorDescription);
  });
}

function createTray() {
  console.log('🔧 Creating tray icon...');
  
  // Create a simple tray icon
  const trayIcon = nativeImage.createFromNamedImage('NSTouchBarRecordStartTemplate', [-1, 0, 1]);
  tray = new Tray(trayIcon);
  
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show Clipboard Manager',
      click: () => {
        console.log('🔧 Tray: Show clicked');
        mainWindow.show();
        mainWindow.focus();
      }
    },
    {
      label: 'Settings',
      click: () => {
        console.log('🔧 Tray: Settings clicked');
        createSettingsWindow();
      }
    },
    {
      label: 'Clear History',
      click: () => {
        console.log('🔧 Tray: Clear History clicked');
        storage.clearHistory();
        if (mainWindow) {
          mainWindow.webContents.send('history-cleared');
        }
      }
    }
  ]);

  tray.setToolTip('Clipboard Manager');
  tray.setContextMenu(contextMenu);
  
  // Show window on tray click
  tray.on('click', () => {
    console.log('🔧 Tray clicked');
    mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show();
  });

  console.log('✅ Tray icon created');
}

app.whenReady().then(() => {
  console.log('🎯 App ready, initializing...');
  
  // Request accessibility permissions on macOS
  if (process.platform === 'darwin') {
    console.log('🍎 macOS detected, checking accessibility permissions...');
    const { systemPreferences } = require('electron');
    
    // Check if we have accessibility permissions
    const hasAccessibilityPermissions = systemPreferences.isTrustedAccessibilityClient(false);
    
    if (!hasAccessibilityPermissions) {
      // Request accessibility permissions
      console.log('🔐 Requesting accessibility permissions...');
      systemPreferences.isTrustedAccessibilityClient(true);
    } else {
      console.log('✅ Accessibility permissions already granted');
    }
    
    app.setAboutPanelOptions({
      applicationName: 'Clipboard Manager',
      applicationVersion: '1.0.0',
      credits: 'A comprehensive clipboard manager for macOS'
    });
  }

  // Initialize storage
  console.log('💾 Initializing storage...');
  try {
    storage = new Storage();
    console.log('✅ Storage initialized successfully');
  } catch (error) {
    console.error('❌ Storage initialization failed:', error);
    return;
  }

  // Initialize settings store
  console.log('⚙️ Initializing settings store...');
  store = new Store({
    defaults: {
      theme: 'light',
      windowPosition: 'left'
    }
  });
  console.log('✅ Settings store initialized');
  
  // Create window and tray
  console.log('🏗️ Creating UI components...');
  createWindow();
  createTray();
  
  // Initialize clipboard monitor
  console.log('📋 Initializing clipboard monitor...');
  try {
    clipboardMonitor = new ClipboardMonitor(storage, mainWindow);
    clipboardMonitor.start();
    console.log('✅ Clipboard monitor started successfully');
  } catch (error) {
    console.error('❌ Clipboard monitor initialization failed:', error);
  }
  
  // Register global shortcut (Cmd+Shift+V)
  console.log('⌨️ Registering global shortcut (Cmd+Shift+V)...');
  const shortcutRegistered = globalShortcut.register('CommandOrControl+Shift+V', () => {
    console.log('⌨️ Global shortcut triggered');
    if (mainWindow.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow.show();
      mainWindow.focus();
    }
  });

  if (shortcutRegistered) {
    console.log('✅ Global shortcut registered successfully');
  } else {
    console.error('❌ Failed to register global shortcut');
  }

  app.on('activate', () => {
    console.log('🔄 App activated');
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });

  console.log('🎉 Clipboard Manager fully initialized!');
});

app.on('window-all-closed', () => {
  console.log('🪟 All windows closed');
  // Keep app running in background on macOS
  if (process.platform !== 'darwin') {
    console.log('💀 Quitting app (non-macOS)');
    app.quit();
  }
});

app.on('will-quit', () => {
  console.log('💀 App will quit, cleaning up...');
  
  // Unregister all shortcuts
  globalShortcut.unregisterAll();
  console.log('⌨️ Global shortcuts unregistered');
  
  // Stop clipboard monitoring
  if (clipboardMonitor) {
    clipboardMonitor.stop();
    console.log('📋 Clipboard monitor stopped');
  }

  // Close storage
  if (storage) {
    storage.close();
    console.log('💾 Storage closed');
  }
});

// IPC handlers
ipcMain.handle('get-clipboard-history', async () => {
  console.log('🔗 IPC: get-clipboard-history called');
  try {
    const history = storage.getHistory();
    console.log(`🔗 IPC: returning history with ${history.length} items`);
    return history;
  } catch (error) {
    console.error('❌ IPC: Error getting clipboard history:', error);
    return [];
  }
});

ipcMain.handle('search-clipboard', async (event, query) => {
  console.log('🔍 IPC: search-clipboard called with query:', query);
  try {
    const results = storage.search(query);
    console.log(`🔍 IPC: search returned ${results.length} results`);
    return results;
  } catch (error) {
    console.error('❌ IPC: Error searching clipboard:', error);
    return [];
  }
});

ipcMain.handle('delete-clipboard-item', async (event, id) => {
  console.log('🗑️ IPC: delete-clipboard-item called for ID:', id);
  try {
    const result = storage.deleteItem(id);
    console.log('🗑️ IPC: delete result:', result);
    return result;
  } catch (error) {
    console.error('❌ IPC: Error deleting clipboard item:', error);
    return false;
  }
});

ipcMain.handle('copy-to-clipboard', async (event, content, type) => {
  console.log('📋 IPC: copy-to-clipboard called, type:', type);
  try {
    if (type === 'text' || type === 'html') {
      clipboard.writeText(content);
    } else if (type === 'files') {
      clipboard.writeText(content);
    } else if (type === 'image') {
      if (content.startsWith('data:image/')) {
        try {
          const image = nativeImage.createFromDataURL(content);
          if (!image.isEmpty()) {
            clipboard.writeImage(image);
            console.log('📋 Image copied to clipboard successfully');
          } else {
            console.error('❌ Failed to create image from data URL');
            return false;
          }
        } catch (imageError) {
          console.error('❌ Error creating image from data URL:', imageError);
          return false;
        }
      } else {
        console.error('❌ Invalid image data format');
        return false;
      }
    }
    console.log('✅ Successfully copied to clipboard');
    return true;
  } catch (error) {
    console.error('❌ Error copying to clipboard:', error);
    return false;
  }
});

ipcMain.handle('pin-clipboard-item', async (event, id, pinned) => {
  console.log('📌 IPC: pin-clipboard-item called for ID:', id, 'pinned:', pinned);
  try {
    const result = storage.pinItem(id, pinned);
    console.log('📌 IPC: pin result:', result);
    return result;
  } catch (error) {
    console.error('❌ IPC: Error pinning clipboard item:', error);
    return false;
  }
});

ipcMain.handle('clear-clipboard-history', async () => {
  console.log('🧹 IPC: clear-clipboard-history called');
  try {
    const result = storage.clearHistory();
    console.log('🧹 IPC: cleared', result, 'items');
    if (mainWindow) {
      mainWindow.webContents.send('history-cleared');
    }
    return result;
  } catch (error) {
    console.error('❌ IPC: Error clearing clipboard history:', error);
    return 0;
  }
});

// Settings IPC handlers
ipcMain.handle('open-settings', async () => {
  console.log('⚙️ IPC: open-settings called');
  createSettingsWindow();
});

ipcMain.handle('close-settings', async () => {
  console.log('⚙️ IPC: close-settings called');
  if (settingsWindow) {
    settingsWindow.close();
  }
});

ipcMain.handle('open-data-folder', async () => {
  console.log('📁 IPC: open-data-folder called');
  const userDataPath = app.getPath('userData');
  console.log('📁 Opening folder:', userDataPath);
  shell.openPath(userDataPath);
});

// Theme management IPC handlers
ipcMain.handle('get-current-theme', async () => {
  console.log('🎨 IPC: get-current-theme called');
  try {
    const currentTheme = store.get('theme', 'light');
    console.log('🎨 Current theme from store:', currentTheme);
    return currentTheme;
  } catch (error) {
    console.error('❌ Error getting current theme:', error);
    return 'light';
  }
});

ipcMain.handle('set-theme', async (event, theme) => {
  console.log('🎨 IPC: set-theme called with:', theme);
  try {
    console.log('💾 Storing theme in electron-store...');
    store.set('theme', theme);
    console.log('✅ Theme stored successfully');
    
    // Apply theme to all open windows
    console.log('📡 Broadcasting theme to all windows...');
    if (mainWindow && !mainWindow.isDestroyed()) {
      console.log('📱 Sending theme to main window');
      mainWindow.webContents.send('theme-changed', theme);
    }
    if (settingsWindow && !settingsWindow.isDestroyed()) {
      console.log('⚙️ Sending theme to settings window');
      settingsWindow.webContents.send('theme-changed', theme);
    }
    
    console.log('🎨 Theme set to:', theme);
    return true;
  } catch (error) {
    console.error('❌ Failed to set theme:', error);
    return false;
  }
});

ipcMain.handle('quit-application', async () => {
  console.log('💀 IPC: quit-application called');
  console.log('💀 Quitting application from settings...');
  
  // Set the flag immediately
  app.isQuiting = true;
  
  // Close all windows properly
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.destroy();
  }
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.destroy();
  }
  
  // Quit the app
  app.quit();
  
  return true;
});

// Handle force quit message
ipcMain.on('force-quit', () => {
  console.log('💀 IPC: force-quit called');
  app.isQuiting = true;
  app.quit();
});

// Window position management IPC handlers
ipcMain.handle('get-current-position', async () => {
  console.log('📍 IPC: get-current-position called');
  try {
    const currentPosition = store.get('windowPosition', 'left');
    console.log('📍 Current position from store:', currentPosition);
    return currentPosition;
  } catch (error) {
    console.error('❌ Error getting current position:', error);
    return 'left';
  }
});

ipcMain.handle('set-window-position', async (event, position) => {
  console.log('📍 IPC: set-window-position called with:', position);
  try {
    console.log('💾 Storing position in electron-store...');
    store.set('windowPosition', position);
    console.log('✅ Position stored successfully');
    
    // Apply position to main window
    if (mainWindow && !mainWindow.isDestroyed()) {
      console.log('📱 Applying new position to main window');
      applyWindowPosition(position);
    }
    
    console.log('📍 Position set to:', position);
    return true;
  } catch (error) {
    console.error('❌ Failed to set position:', error);
    return false;
  }
});

function applyWindowPosition(position) {
  console.log('📍 Applying window position:', position);
  
  // Get the primary display bounds
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight } = primaryDisplay.bounds;
  const { x: screenX, y: screenY } = primaryDisplay.bounds;
  
  // Get the work area (excludes dock/menu bar)
  const workArea = primaryDisplay.workArea;
  console.log('📺 Screen bounds:', { screenWidth, screenHeight, screenX, screenY });
  console.log('💼 Work area:', workArea);
  
  // Use native APIs to get more accurate screen info if available
  if (nativeWindowManager) {
    try {
      const nativeScreenInfo = nativeWindowManager.getScreenInfo();
      console.log('🔍 Native screen info:', nativeScreenInfo);
    } catch (error) {
      console.log('⚠️ Could not get native screen info:', error);
    }
  }
  
  let newBounds = {};
  const sidebarWidth = 350;
  const sidebarHeight = screenHeight;
  const bottomBarHeight = 300;
  
  switch (position) {
    case 'left':
      newBounds = {
        x: screenX,
        y: screenY,
        width: sidebarWidth,
        height: sidebarHeight
      };
      break;
      
    case 'right':
      newBounds = {
        x: screenX + screenWidth - sidebarWidth,
        y: screenY,
        width: sidebarWidth,
        height: sidebarHeight
      };
      break;
      
    case 'top':
      newBounds = {
        x: screenX,
        y: screenY,
        width: screenWidth,
        height: 300
      };
      break;
      
  case 'bottom':
    console.log('🚨 DEBUG: Entering bottom case in NEW CODE');
    newBounds = {
      x: screenX,
      y: screenY + screenHeight - bottomBarHeight,
      width: screenWidth,
      height: bottomBarHeight
    };
    
    // NATIVE API APPROACH - Try this first!
    if (nativeWindowManager && process.platform === 'darwin') {
      console.log('🔧 Using native APIs to position window over dock');
      
      // Set initial bounds
      mainWindow.setBounds(newBounds);
      
      setTimeout(() => {
        try {
          const windowId = mainWindow.getNativeWindowHandle().readInt32LE(0);
          console.log('🔍 Window ID:', windowId);
          
          const success = nativeWindowManager.forceWindowOverDock(
            windowId,
            newBounds.x,
            newBounds.y,
            newBounds.width,
            newBounds.height
          );
          
          if (success) {
            console.log('✅ Successfully positioned window over dock using native APIs - NO FLASHING!');
          } else {
            console.log('❌ Native positioning failed, falling back to dock hiding');
            // Fallback to dock hiding approach
            mainWindow.setAlwaysOnTop(true, 'pop-up-menu');
            setDockVisibility(true);
          }
        } catch (error) {
          console.error('❌ Error using native window positioning:', error);
          console.log('🔄 Falling back to dock hiding approach');
          // Fallback to dock hiding approach
          mainWindow.setAlwaysOnTop(true, 'pop-up-menu');
          setDockVisibility(true);
        }
      }, 100);
      
      return; // Exit early - don't do regular positioning
    } else {
      console.log('⚠️ Native APIs not available, falling back to dock hiding approach');
      // Fallback to the dock hiding approach
      setTimeout(() => {
        mainWindow.setAlwaysOnTop(true, 'pop-up-menu');
        setDockVisibility(true);
      }, 100);
      return; // Exit early
    }
      
    case 'window':
      newBounds = {
        x: screenX + 100,
        y: screenY + 100,
        width: 400,
        height: 600
      };
      // Enable window controls for free window mode
      mainWindow.setResizable(true);
      mainWindow.setMovable(true);
      mainWindow.setMinimizable(true);
      mainWindow.setMaximizable(true);
      break;
      
    default:
      console.log('Unknown position:', position);
      return;
  }
  
  console.log('📍 Setting window bounds:', newBounds);
  mainWindow.setBounds(newBounds);
  
  // For non-window modes, ensure it stays as a sidebar
  if (position !== 'window') {
    mainWindow.setResizable(false);
    mainWindow.setMovable(false);
    mainWindow.setMinimizable(false);
    mainWindow.setMaximizable(false);
    
    // Use different window levels based on position
    if (position === 'bottom') {
      // Use highest window level but DON'T hide dock to avoid flashing
      mainWindow.setAlwaysOnTop(true, 'status'); // Try 'status' level
    } else {
      // For non-bottom positions, restore dock if it was hidden
      setDockVisibility(false);
      mainWindow.setAlwaysOnTop(true, 'screen-saver');
    }
  }
}

// Add IPC handler for native dock management
ipcMain.handle('toggle-dock-visibility', async (event, visible) => {
  console.log('🏠 IPC: toggle-dock-visibility called with:', visible);
  
  if (nativeWindowManager && process.platform === 'darwin') {
    try {
      const result = nativeWindowManager.setDockVisible(visible);
      console.log('🏠 Dock visibility toggled:', result);
      return result;
    } catch (error) {
      console.error('❌ Error toggling dock visibility:', error);
      return false;
    }
  } else {
    console.log('⚠️ Native dock management not available');
    return false;
  }
});

// Handle file access for images
ipcMain.handle('load-image-from-path', async (event, filePath) => {
  console.log('🖼️ IPC: load-image-from-path called for:', filePath);
  try {
    // Check if file exists and is accessible
    if (!fs.existsSync(filePath)) {
      console.log('❌ File does not exist:', filePath);
      return null;
    }

    // Check file permissions
    try {
      fs.accessSync(filePath, fs.constants.R_OK);
    } catch (accessError) {
      console.log('❌ No read permission for file:', filePath);
      return null;
    }

    // Try to load the image
    const image = nativeImage.createFromPath(filePath);
    if (image.isEmpty()) {
      console.log('❌ Failed to load image from path:', filePath);
      return null;
    }

    const size = image.getSize();
    console.log(`✅ Successfully loaded image: ${size.width}×${size.height} from ${filePath}`);

    // Apply size limits
    let processedImage = image;
    const maxDimension = 1920;
    
    if (size.width > maxDimension || size.height > maxDimension) {
      const scale = Math.min(maxDimension / size.width, maxDimension / size.height);
      const newWidth = Math.round(size.width * scale);
      const newHeight = Math.round(size.height * scale);
      processedImage = image.resize({ width: newWidth, height: newHeight });
      console.log(`📏 Image resized to: ${newWidth}×${newHeight}`);
    }

    const imageBuffer = processedImage.toPNG();
    
    if (imageBuffer.length > 10 * 1024 * 1024) {
      console.log('❌ Image too large after processing');
      return null;
    }

    return {
      dataURL: `data:image/png;base64,${imageBuffer.toString('base64')}`,
      width: size.width,
      height: size.height
    };

  } catch (error) {
    console.error('❌ Error loading image from path:', error);
    return null;
  }
});