// Enhanced main.js with perfect initialization for smooth animations
// Eliminates all startup flashing and coordinates with smooth window manager

const { app, BrowserWindow } = require('electron');
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

/**
 * Enhanced ClipboardManagerApp with smooth startup and no flashing
 */
class ClipboardManagerApp {
  constructor() {
    console.log('🚀 Starting Clipboard Manager with smooth animations...');
    
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
    
    // Track initialization state
    this.isInitialized = false;
    this.isCleaningUp = false;
    this.initializationPromise = null;
    
    // Setup app event handlers immediately
    this.setupAppEventHandlers();
  }

  /**
   * Main initialization with perfect startup timing
   */
  async initialize() {
    if (this.isInitialized || this.initializationPromise) {
      return this.initializationPromise;
    }
    
    console.log('🎯 App ready, initializing with smooth startup...');
    
    this.initializationPromise = this.performInitialization();
    return this.initializationPromise;
  }

  async performInitialization() {
    try {
      // Configure app for optimal performance FIRST
      this.configureAppForPerformance();
      
      // Request accessibility permissions early (non-blocking)
      this.requestAccessibilityPermissions();
      
      // Initialize core services
      await this.initializeServices();
      
      // Initialize managers with smooth coordination
      await this.initializeManagers();
      
      // Start clipboard monitoring
      await this.startClipboardMonitoring();
      
      this.isInitialized = true;
      console.log('🎉 Clipboard Manager fully initialized with smooth animations!');
      
    } catch (error) {
      console.error('❌ Failed to initialize Clipboard Manager:', error);
      await this.emergencyCleanup();
      app.quit();
    }
  }

  /**
   * Configure app for optimal performance and smooth animations
   */
  configureAppForPerformance() {
    console.log('⚡ Configuring app for optimal performance...');
    
    // Enable hardware acceleration optimizations
    if (process.platform === 'darwin') {
      // macOS-specific optimizations for smooth animations
      app.commandLine.appendSwitch('enable-gpu-rasterization');
      app.commandLine.appendSwitch('enable-zero-copy');
      app.commandLine.appendSwitch('enable-hardware-overlays');
      app.commandLine.appendSwitch('force-color-profile', 'srgb');
      
      // Memory optimizations
      app.commandLine.appendSwitch('max_old_space_size', '2048');
      app.commandLine.appendSwitch('force-gpu-mem-available-mb', '1024');
      
      // Disable problematic flags that can cause flashing
      app.commandLine.appendSwitch('disable-background-timer-throttling');
      app.commandLine.appendSwitch('disable-renderer-backgrounding');
    }
    
    // Handle GPU crashes gracefully
    app.on('gpu-process-crashed', (event, killed) => {
      console.warn('⚠️ GPU process crashed, attempting recovery...');
      if (killed) {
        console.warn('🔧 Falling back to software rendering for stability');
        app.disableHardwareAcceleration();
      }
    });
    
    // Set app user model (Windows)
    if (process.platform === 'win32') {
      app.setAppUserModelId('com.yourname.clipboard-manager');
    }
    
    console.log('✅ Performance configuration complete');
  }

  /**
   * Request accessibility permissions with proper handling
   */
  async requestAccessibilityPermissions() {
    if (process.platform === 'darwin') {
      console.log('🍎 macOS detected, checking accessibility permissions...');
      
      try {
        const { systemPreferences } = require('electron');
        
        const hasAccessibilityPermissions = systemPreferences.isTrustedAccessibilityClient(false);
        
        if (!hasAccessibilityPermissions) {
          console.log('🔐 Requesting accessibility permissions...');
          systemPreferences.isTrustedAccessibilityClient(true);
        } else {
          console.log('✅ Accessibility permissions already granted');
        }
        
        // Set about panel options
        app.setAboutPanelOptions({
          applicationName: 'Clipboard Manager',
          applicationVersion: '1.0.0',
          version: '1.0.0',
          credits: 'A smooth and efficient clipboard manager for macOS',
          authors: ['Your Name'],
          website: 'https://your-website.com',
          iconPath: path.join(__dirname, 'assets', 'icon.png')
        });
        
      } catch (error) {
        console.warn('⚠️ Could not configure accessibility permissions:', error.message);
      }
    }
  }

  /**
   * Initialize services with proper error handling
   */
  async initializeServices() {
    console.log('🔧 Initializing core services...');
    
    try {
      // Initialize settings service first (other services depend on it)
      this.settingsService = new SettingsService();
      console.log('✅ Settings service initialized');
      
      // Initialize dock service
      this.dockService = new DockService();
      
      // Give dock service time to detect initial state
      await new Promise(resolve => setTimeout(resolve, 100));
      console.log('✅ Dock service initialized');
      
      // Initialize storage with retry logic
      let storageRetries = 0;
      const maxStorageRetries = 3;
      
      while (!this.storage && storageRetries < maxStorageRetries) {
        try {
          this.storage = new Storage();
          console.log('✅ Storage initialized');
          break;
        } catch (storageError) {
          storageRetries++;
          console.warn(`⚠️ Storage initialization attempt ${storageRetries} failed:`, storageError.message);
          
          if (storageRetries < maxStorageRetries) {
            console.log('🔄 Retrying storage initialization...');
            await new Promise(resolve => setTimeout(resolve, 1000));
          } else {
            throw storageError;
          }
        }
      }
      
    } catch (error) {
      console.error('❌ Service initialization failed:', error);
      throw error;
    }
  }

  /**
   * Initialize managers with smooth coordination
   */
  async initializeManagers() {
    console.log('🏗️ Initializing managers with smooth coordination...');
    
    try {
      // Initialize window manager first (most critical for smooth animations)
      this.windowManager = new WindowManager(this.settingsService, this.dockService);
      
      // Create main window but don't show it yet
      console.log('📱 Creating main window...');
      await this.windowManager.createMainWindow();
      console.log('✅ Window manager initialized with smooth animations');
      
      // Initialize tray manager
      this.trayManager = new TrayManager(this.windowManager, this.storage);
      this.trayManager.createTray();
      console.log('✅ Tray manager initialized');
      
      // Initialize shortcut manager with graceful fallback
      this.shortcutManager = new ShortcutManager(this.windowManager);
      
      try {
        const results = this.shortcutManager.registerDefaultShortcuts();
        console.log('✅ Shortcut manager initialized');
        
        // Log any shortcut registration failures
        Object.entries(results).forEach(([name, success]) => {
          if (!success) {
            console.warn(`⚠️ Failed to register shortcut: ${name} (possibly already in use)`);
          }
        });
        
        // Ensure main shortcut is working
        if (!results.main) {
          console.warn('⚠️ Main shortcut (Cmd+Shift+V) registration failed');
          console.log('💡 You can still use the tray icon to access the clipboard manager');
        }
        
      } catch (shortcutError) {
        console.warn('⚠️ Shortcut registration failed:', shortcutError.message);
        console.log('💡 Continuing without shortcuts - tray icon will still work');
      }
      
      // Initialize IPC manager last (depends on all other managers)
      this.ipcManager = new IPCManager(
        this.storage,
        this.windowManager,
        this.settingsService,
        this.dockService
      );
      console.log('✅ IPC manager initialized');
      
    } catch (error) {
      console.error('❌ Manager initialization failed:', error);
      throw error;
    }
  }

  /**
   * Start clipboard monitoring with proper error handling
   */
  async startClipboardMonitoring() {
    console.log('📋 Initializing clipboard monitor...');
    
    try {
      this.clipboardMonitor = new ClipboardMonitor(
        this.storage,
        this.windowManager.getMainWindow()
      );
      
      // Start monitoring with a slight delay to ensure everything is ready
      setTimeout(() => {
        this.clipboardMonitor.start();
        console.log('✅ Clipboard monitor started successfully');
      }, 500);
      
    } catch (error) {
      console.error('❌ Clipboard monitor initialization failed:', error);
      throw error;
    }
  }

  /**
   * Setup app event handlers with smooth coordination
   */
  setupAppEventHandlers() {
    // App ready event
    app.whenReady().then(() => {
      console.log('🚀 Electron app ready');
      this.initialize();
    });

    // Window all closed event
    app.on('window-all-closed', () => {
      console.log('🪟 All windows closed');
      // Keep app running in background on macOS (standard behavior)
      if (process.platform !== 'darwin') {
        console.log('💀 Quitting app (non-macOS platform)');
        this.cleanup();
      }
    });

    // App activation event (macOS)
    app.on('activate', async () => {
      console.log('🔄 App activated');
      
      // Ensure app is initialized
      if (!this.isInitialized) {
        await this.initialize();
      }
      
      // Show main window if no windows are visible
      if (this.windowManager && !this.windowManager.getMainWindow()) {
        console.log('📱 Creating new main window on activation');
        await this.windowManager.createMainWindow();
      }
    });

    // App will quit event (graceful shutdown)
    app.on('will-quit', (event) => {
      if (!this.isCleaningUp) {
        console.log('🚨 App will quit - starting graceful cleanup...');
        event.preventDefault();
        this.cleanup();
      }
    });

    // Handle second instance (prevent multiple instances)
    app.on('second-instance', () => {
      console.log('🔄 Second instance detected, focusing main window');
      if (this.windowManager) {
        this.windowManager.showMainWindow();
      }
    });

    // Handle unexpected exits gracefully
    process.on('SIGINT', () => {
      console.log('🚨 SIGINT received, cleaning up...');
      this.cleanup();
    });

    process.on('SIGTERM', () => {
      console.log('🚨 SIGTERM received, cleaning up...');
      this.cleanup();
    });

    // Handle uncaught exceptions with proper logging
    process.on('uncaughtException', (error) => {
      console.error('🚨 Uncaught exception:', error);
      console.error('Stack trace:', error.stack);
      this.emergencyCleanup();
    });

    process.on('unhandledRejection', (reason, promise) => {
      console.error('🚨 Unhandled promise rejection at:', promise);
      console.error('Reason:', reason);
      // Don't exit on unhandled rejection, just log it
    });

    // Handle app errors
    app.on('render-process-gone', (event, webContents, details) => {
      console.error('🚨 Renderer process gone:', details);
      if (this.windowManager) {
        this.windowManager.createMainWindow();
      }
    });

    app.on('child-process-gone', (event, details) => {
      console.error('🚨 Child process gone:', details);
    });
  }

  /**
   * Graceful cleanup with smooth animations
   */
  async cleanup() {
    if (this.isCleaningUp) {
      console.log('🔄 Cleanup already in progress...');
      return;
    }

    this.isCleaningUp = true;
    console.log('💀 Starting graceful app cleanup...');
    
    try {
      // Stop clipboard monitoring first
      if (this.clipboardMonitor) {
        this.clipboardMonitor.stop();
        console.log('📋 Clipboard monitor stopped');
      }
      
      // Unregister all shortcuts
      if (this.shortcutManager) {
        this.shortcutManager.unregisterAllShortcuts();
        console.log('⌨️ Global shortcuts unregistered');
      }
      
      // Window manager cleanup (includes dock restoration with animations)
      if (this.windowManager) {
        await this.windowManager.cleanup();
        console.log('📱 Window manager cleaned up with smooth animations');
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
      
      console.log('✅ Graceful cleanup completed successfully');
      
      // Small delay to ensure cleanup animations complete
      setTimeout(() => {
        app.isQuiting = true;
        app.quit();
      }, 100);
      
    } catch (error) {
      console.error('❌ Error during graceful cleanup:', error);
      // Fall back to emergency cleanup
      await this.emergencyCleanup();
    }
  }

  /**
   * Emergency cleanup for critical failures
   */
  async emergencyCleanup() {
    console.log('🚨 Emergency cleanup initiated...');
    
    try {
      // Critical: Restore dock state immediately
      if (this.dockService) {
        console.log('🏠 Emergency dock restoration...');
        await this.dockService.resetDockToDefaults();
      }
      
      // Force quit shortcuts
      if (this.shortcutManager) {
        try {
          this.shortcutManager.unregisterAllShortcuts();
        } catch (error) {
          console.error('Emergency shortcut cleanup failed:', error);
        }
      }
      
      console.log('✅ Emergency cleanup completed');
      
    } catch (error) {
      console.error('❌ Emergency cleanup failed:', error);
    } finally {
      // Force quit no matter what
      setTimeout(() => {
        console.log('🔌 Force quitting application');
        app.isQuiting = true;
        app.exit(0);
      }, 1000);
    }
  }

  /**
   * Public methods for external access if needed
   */
  getWindowManager() {
    return this.windowManager;
  }

  getStorage() {
    return this.storage;
  }

  getSettingsService() {
    return this.settingsService;
  }

  getDockService() {
    return this.dockService;
  }

  /**
   * Get initialization status
   */
  isReady() {
    return this.isInitialized;
  }

  /**
   * Get debug information
   */
  getDebugInfo() {
    return {
      initialized: this.isInitialized,
      cleaningUp: this.isCleaningUp,
      platform: process.platform,
      electron: process.versions.electron,
      node: process.versions.node,
      chrome: process.versions.chrome,
      managers: {
        windowManager: !!this.windowManager,
        storageManager: !!this.storage,
        clipboardMonitor: !!this.clipboardMonitor,
        shortcutManager: !!this.shortcutManager,
        trayManager: !!this.trayManager,
        ipcManager: !!this.ipcManager
      }
    };
  }
}

// Prevent multiple instances for better user experience
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  console.log('🔒 Another instance is already running, quitting...');
  app.quit();
} else {
  console.log('🔓 Got single instance lock, proceeding with initialization');
  
  // Create and start the application
  const clipboardManagerApp = new ClipboardManagerApp();
  
  // Make app instance globally available for debugging
  global.clipboardManagerApp = clipboardManagerApp;
  
  // Add global error handlers for main process
  process.on('warning', (warning) => {
    console.warn('⚠️ Node.js Warning:', warning.name, warning.message);
  });
  
  // Log successful startup
  app.whenReady().then(() => {
    console.log('🎉 Clipboard Manager with smooth animations is starting up...');
  });
}