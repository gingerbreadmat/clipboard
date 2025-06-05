const { app } = require('electron');
const path = require('path');

// Import managers and services
const WindowManager = require('./src/managers/window-manager');
const IPCManager = require('./src/managers/ipc-manager');
const ShortcutManager = require('./src/managers/shortcut-manager');
const TrayManager = require('./src/managers/tray-manager');

const SettingsService = require('./src/services/settings-service');
const DockService = require('./src/services/dock-service');

const ClipboardMonitor = require('./src/clipboard-monitor');
const Storage = require('./src/storage');

class ClipboardManagerApp {
  constructor() {
    console.log('🚀 Starting Clipboard Manager...');
    
    // Initialize services first
    this.settingsService = null;
    this.dockService = null;
    this.storage = null;
    
    // Initialize managers
    this.windowManager = null;
    this.ipcManager = null;
    this.shortcutManager = null;
    this.trayManager = null;
    this.clipboardMonitor = null;
    
    // Setup app event handlers
    this.setupAppEventHandlers();
  }

  async initialize() {
    console.log('🎯 App ready, initializing...');
    
    try {
      // Request accessibility permissions on macOS
      await this.requestAccessibilityPermissions();
      
      // Initialize services
      await this.initializeServices();
      
      // Initialize managers
      await this.initializeManagers();
      
      // Start clipboard monitoring
      await this.startClipboardMonitoring();
      
      console.log('🎉 Clipboard Manager fully initialized!');
    } catch (error) {
      console.error('❌ Failed to initialize Clipboard Manager:', error);
      app.quit();
    }
  }

  async requestAccessibilityPermissions() {
    if (process.platform === 'darwin') {
      console.log('🍎 macOS detected, checking accessibility permissions...');
      const { systemPreferences } = require('electron');
      
      const hasAccessibilityPermissions = systemPreferences.isTrustedAccessibilityClient(false);
      
      if (!hasAccessibilityPermissions) {
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
  }

  async initializeServices() {
    console.log('🔧 Initializing services...');
    
    // Initialize settings service
    this.settingsService = new SettingsService();
    console.log('✅ Settings service initialized');
    
    // Initialize dock service
    this.dockService = new DockService();
    console.log('✅ Dock service initialized');
    
    // Initialize storage
    try {
      this.storage = new Storage();
      console.log('✅ Storage initialized');
    } catch (error) {
      console.error('❌ Storage initialization failed:', error);
      throw error;
    }
  }

  async initializeManagers() {
    console.log('🏗️ Initializing managers...');
    
    // Initialize window manager
    this.windowManager = new WindowManager(this.settingsService, this.dockService);
    this.windowManager.createMainWindow();
    console.log('✅ Window manager initialized');
    
    // Initialize tray manager
    this.trayManager = new TrayManager(this.windowManager, this.storage);
    this.trayManager.createTray();
    console.log('✅ Tray manager initialized');
    
    // Initialize shortcut manager
    this.shortcutManager = new ShortcutManager(this.windowManager);
    
    // Register shortcuts with better error handling
    try {
      const results = this.shortcutManager.registerDefaultShortcuts();
      console.log('✅ Shortcut manager initialized');
      
      // Log any failures
      Object.entries(results).forEach(([name, success]) => {
        if (!success) {
          console.warn(`⚠️ Failed to register shortcut: ${name}`);
        }
      });
    } catch (error) {
      console.error('❌ Shortcut registration failed:', error);
      // Continue without shortcuts rather than crashing
    }
    
    // Initialize IPC manager (should be last as it depends on other managers)
    this.ipcManager = new IPCManager(
      this.storage,
      this.windowManager,
      this.settingsService,
      this.dockService
    );
    console.log('✅ IPC manager initialized');
  }

  async startClipboardMonitoring() {
    console.log('📋 Initializing clipboard monitor...');
    
    try {
      this.clipboardMonitor = new ClipboardMonitor(
        this.storage,
        this.windowManager.getMainWindow()
      );
      this.clipboardMonitor.start();
      console.log('✅ Clipboard monitor started');
    } catch (error) {
      console.error('❌ Clipboard monitor initialization failed:', error);
      throw error;
    }
  }

  setupAppEventHandlers() {
    // App ready event
    app.whenReady().then(() => {
      this.initialize();
    });

    // Window all closed event
    app.on('window-all-closed', () => {
      console.log('🪟 All windows closed');
      // Keep app running in background on macOS
      if (process.platform !== 'darwin') {
        console.log('💀 Quitting app (non-macOS)');
        app.quit();
      }
    });

    // App activation event
    app.on('activate', () => {
      console.log('🔄 App activated');
      if (this.windowManager && !this.windowManager.getMainWindow()) {
        this.windowManager.createMainWindow();
      }
    });

    // App will quit event
    app.on('will-quit', () => {
      this.cleanup();
    });

    // Handle second instance (prevent multiple instances)
    app.on('second-instance', () => {
      console.log('🔄 Second instance detected, focusing main window');
      if (this.windowManager) {
        this.windowManager.showMainWindow();
      }
    });
  }

  cleanup() {
    console.log('💀 App will quit, cleaning up...');
    
    try {
      // Unregister all shortcuts
      if (this.shortcutManager) {
        this.shortcutManager.unregisterAllShortcuts();
        console.log('⌨️ Global shortcuts unregistered');
      }
      
      // Stop clipboard monitoring
      if (this.clipboardMonitor) {
        this.clipboardMonitor.stop();
        console.log('📋 Clipboard monitor stopped');
      }

      // Close storage
      if (this.storage) {
        this.storage.close();
        console.log('💾 Storage closed');
      }

      // Destroy tray
      if (this.trayManager) {
        this.trayManager.destroy();
        console.log('🔧 Tray destroyed');
      }

      // Remove IPC handlers
      if (this.ipcManager) {
        this.ipcManager.removeAllHandlers();
        console.log('🔗 IPC handlers removed');
      }

      console.log('✅ Cleanup completed');
    } catch (error) {
      console.error('❌ Error during cleanup:', error);
    }
  }

  // Public methods for external access if needed
  getWindowManager() {
    return this.windowManager;
  }

  getStorage() {
    return this.storage;
  }

  getSettingsService() {
    return this.settingsService;
  }
}

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