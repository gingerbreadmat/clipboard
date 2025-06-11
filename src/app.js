const { app } = require('electron');
const AppInitializer = require('./bootstrap/app-initializer');
const ServiceRegistry = require('./bootstrap/service-registry');
const PermissionManager = require('./bootstrap/permission-manager');

class ClipboardManagerApp {
  constructor() {
    console.log('🚀 Starting Clipboard Manager...');
    
    this.serviceRegistry = new ServiceRegistry();
    this.appInitializer = new AppInitializer(this.serviceRegistry);
    this.permissionManager = new PermissionManager();
    
    this.setupAppEventHandlers();
  }

  async initialize() {
    console.log('🎯 App ready, initializing...');
    
    try {
      // Request platform-specific permissions
      await this.permissionManager.requestRequiredPermissions();
      
      // Initialize all services and managers
      await this.appInitializer.initializeAll();
      
      console.log('🎉 Clipboard Manager fully initialized!');
    } catch (error) {
      console.error('❌ Failed to initialize Clipboard Manager:', error);
      app.quit();
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
      if (process.platform !== 'darwin') {
        console.log('💀 Quitting app (non-macOS)');
        app.quit();
      }
    });

    // App activation event
    app.on('activate', () => {
      console.log('🔄 App activated');
      const windowManager = this.serviceRegistry.get('windowManager');
      if (windowManager && !windowManager.getMainWindow()) {
        windowManager.createMainWindow();
      }
    });

    // App will quit event
    app.on('will-quit', () => {
      this.cleanup();
    });

    // Handle second instance
    app.on('second-instance', () => {
      console.log('🔄 Second instance detected, focusing main window');
      const windowManager = this.serviceRegistry.get('windowManager');
      if (windowManager) {
        windowManager.showMainWindow();
      }
    });
  }

  cleanup() {
    console.log('💀 App will quit, cleaning up...');
    this.appInitializer.cleanup();
  }

  // Public getters for external access
  getServiceRegistry() {
    return this.serviceRegistry;
  }
}

module.exports = ClipboardManagerApp;
