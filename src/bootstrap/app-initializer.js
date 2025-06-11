const SettingsService = require('../services/settings-service');
const DockService = require('../services/dock-service');
const Storage = require('../storage');
const WindowManager = require('../managers/window-manager');
const IPCManager = require('../managers/ipc-manager');
const ShortcutManager = require('../managers/shortcut-manager');
const TrayManager = require('../managers/tray-manager');
const ClipboardMonitor = require('../clipboard-monitor');

class AppInitializer {
  constructor(serviceRegistry) {
    this.registry = serviceRegistry;
    this.initializationOrder = [
      'settingsService',
      'dockService', 
      'storage',
      'windowManager',
      'trayManager',
      'shortcutManager',
      'ipcManager',
      'clipboardMonitor'
    ];
  }

  async initializeAll() {
    console.log('🏗️ Starting service initialization...');
    
    for (const serviceName of this.initializationOrder) {
      await this.initializeService(serviceName);
    }
    
    console.log('✅ All services initialized successfully');
  }

  async initializeService(serviceName) {
    try {
      console.log(`🔧 Initializing ${serviceName}...`);
      
      switch (serviceName) {
        case 'settingsService':
          await this.initializeSettingsService();
          break;
        case 'dockService':
          await this.initializeDockService();
          break;
        case 'storage':
          await this.initializeStorage();
          break;
        case 'windowManager':
          await this.initializeWindowManager();
          break;
        case 'trayManager':
          await this.initializeTrayManager();
          break;
        case 'shortcutManager':
          await this.initializeShortcutManager();
          break;
        case 'ipcManager':
          await this.initializeIPCManager();
          break;
        case 'clipboardMonitor':
          await this.initializeClipboardMonitor();
          break;
        default:
          throw new Error(`Unknown service: ${serviceName}`);
      }
      
      this.registry.markInitialized(serviceName);
      
    } catch (error) {
      console.error(`❌ Failed to initialize ${serviceName}:`, error);
      throw error;
    }
  }

  async initializeSettingsService() {
    const settingsService = new SettingsService();
    this.registry.register('settingsService', settingsService);
  }

  async initializeDockService() {
    const dockService = new DockService();
    this.registry.register('dockService', dockService);
  }

  async initializeStorage() {
    const storage = new Storage();
    this.registry.register('storage', storage);
  }

  async initializeWindowManager() {
    const settingsService = this.registry.get('settingsService');
    const dockService = this.registry.get('dockService');
    
    const windowManager = new WindowManager(settingsService, dockService);
    windowManager.createMainWindow();
    
    this.registry.register('windowManager', windowManager);
  }

  async initializeTrayManager() {
    const windowManager = this.registry.get('windowManager');
    const storage = this.registry.get('storage');
    
    const trayManager = new TrayManager(windowManager, storage);
    trayManager.createTray();
    
    this.registry.register('trayManager', trayManager);
  }

  async initializeShortcutManager() {
    const windowManager = this.registry.get('windowManager');
    
    const shortcutManager = new ShortcutManager(windowManager);
    
    try {
      const results = shortcutManager.registerDefaultShortcuts();
      
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
    
    this.registry.register('shortcutManager', shortcutManager);
  }

  async initializeIPCManager() {
    const storage = this.registry.get('storage');
    const windowManager = this.registry.get('windowManager');
    const settingsService = this.registry.get('settingsService');
    const dockService = this.registry.get('dockService');
    
    const ipcManager = new IPCManager(
      storage,
      windowManager,
      settingsService,
      dockService
    );
    
    this.registry.register('ipcManager', ipcManager);
  }

  async initializeClipboardMonitor() {
    const storage = this.registry.get('storage');
    const windowManager = this.registry.get('windowManager');
    
    const clipboardMonitor = new ClipboardMonitor(
      storage,
      windowManager.getMainWindow()
    );
    clipboardMonitor.start();
    
    this.registry.register('clipboardMonitor', clipboardMonitor);
  }

  cleanup() {
    this.registry.cleanup();
  }
}

module.exports = AppInitializer;
