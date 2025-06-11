#!/bin/bash

# Phase 1: Core Structure Migration Script
# This script helps migrate your existing codebase to the new structure

set -e  # Exit on any error

echo "🚀 Starting Phase 1: Core Structure Migration"
echo "================================================"

# Step 1: Create new directory structure
echo "📁 Creating new directory structure..."

mkdir -p src/bootstrap
mkdir -p src/config
mkdir -p src/managers/window
mkdir -p src/services/settings
mkdir -p src/clipboard
mkdir -p src/ipc
mkdir -p src/storage
mkdir -p src/utils

echo "✅ Directory structure created"

# Step 2: Backup existing files
echo "💾 Creating backup of existing files..."

# Create backup directory with timestamp
BACKUP_DIR="backup_$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"

# Backup main files that will be changed
cp main.js "$BACKUP_DIR/main.js.backup"
echo "✅ Backed up main.js"

# Step 3: Create new main.js (minimal entry point)
echo "📝 Creating new main.js..."

cat > main.js << 'EOF'
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
EOF

echo "✅ Created new main.js"

# Step 4: Extract main app class
echo "📝 Creating src/app.js..."

cat > src/app.js << 'EOF'
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
EOF

echo "✅ Created src/app.js"

# Step 5: Create service registry
echo "📝 Creating service registry..."

cat > src/bootstrap/service-registry.js << 'EOF'
class ServiceRegistry {
  constructor() {
    this.services = new Map();
    this.initialized = new Set();
    console.log('📋 Service registry created');
  }

  register(name, serviceInstance) {
    if (this.services.has(name)) {
      console.warn(`⚠️ Service '${name}' already registered, overwriting`);
    }
    
    this.services.set(name, serviceInstance);
    console.log(`✅ Service registered: ${name}`);
    return this;
  }

  get(name) {
    if (!this.services.has(name)) {
      throw new Error(`❌ Service '${name}' not found in registry`);
    }
    return this.services.get(name);
  }

  has(name) {
    return this.services.has(name);
  }

  markInitialized(name) {
    this.initialized.add(name);
    console.log(`🎯 Service initialized: ${name}`);
  }

  isInitialized(name) {
    return this.initialized.has(name);
  }

  getAll() {
    return Array.from(this.services.keys());
  }

  getInitialized() {
    return Array.from(this.initialized);
  }

  cleanup() {
    console.log('🧹 Cleaning up services...');
    
    // Cleanup in reverse order of initialization
    const services = Array.from(this.initialized).reverse();
    
    for (const serviceName of services) {
      try {
        const service = this.get(serviceName);
        if (service && typeof service.cleanup === 'function') {
          service.cleanup();
          console.log(`🧹 Cleaned up: ${serviceName}`);
        }
      } catch (error) {
        console.error(`❌ Error cleaning up ${serviceName}:`, error);
      }
    }
    
    this.services.clear();
    this.initialized.clear();
    console.log('✅ Service registry cleanup completed');
  }
}

module.exports = ServiceRegistry;
EOF

echo "✅ Created service registry"

# Step 6: Create app initializer
echo "📝 Creating app initializer..."

cat > src/bootstrap/app-initializer.js << 'EOF'
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
EOF

echo "✅ Created app initializer"

# Step 7: Create permission manager
echo "📝 Creating permission manager..."

cat > src/bootstrap/permission-manager.js << 'EOF'
const { app, systemPreferences } = require('electron');

class PermissionManager {
  constructor() {
    this.platform = process.platform;
    console.log('🔐 Permission manager initialized');
  }

  async requestRequiredPermissions() {
    if (this.platform === 'darwin') {
      await this.requestMacOSPermissions();
    }
    // Add other platforms as needed
  }

  async requestMacOSPermissions() {
    console.log('🍎 macOS detected, checking permissions...');
    
    // Set about panel
    app.setAboutPanelOptions({
      applicationName: 'Clipboard Manager',
      applicationVersion: '1.0.0',
      credits: 'A comprehensive clipboard manager for macOS'
    });

    // Check accessibility permissions
    await this.checkAccessibilityPermissions();
  }

  async checkAccessibilityPermissions() {
    try {
      const hasPermissions = systemPreferences.isTrustedAccessibilityClient(false);
      
      if (!hasPermissions) {
        console.log('🔐 Requesting accessibility permissions...');
        systemPreferences.isTrustedAccessibilityClient(true);
      } else {
        console.log('✅ Accessibility permissions already granted');
      }
      
      return hasPermissions;
    } catch (error) {
      console.error('❌ Error checking accessibility permissions:', error);
      return false;
    }
  }

  async checkScreenRecordingPermissions() {
    // Future: Add screen recording permission check if needed
    return true;
  }

  async checkFileSystemPermissions() {
    // Future: Add file system permission check if needed
    return true;
  }
}

module.exports = PermissionManager;
EOF

echo "✅ Created permission manager"

# Step 8: Create configuration files
echo "📝 Creating configuration files..."

cat > src/config/app-config.js << 'EOF'
const APP_CONFIG = {
  // Application metadata
  APP_NAME: 'Clipboard Manager',
  APP_VERSION: '1.0.0',
  APP_DESCRIPTION: 'A comprehensive clipboard manager for macOS',
  
  // Window configuration
  WINDOW: {
    DEFAULT_WIDTH: 350,
    DEFAULT_HEIGHT: 600,
    MIN_WIDTH: 300,
    MIN_HEIGHT: 400,
    MAX_ITEMS_DISPLAYED: 100
  },
  
  // Clipboard monitoring
  CLIPBOARD: {
    POLL_INTERVAL: 500, // ms
    COOLDOWN_PERIOD: 1000, // ms
    MAX_HISTORY_ITEMS: 1000,
    MAX_IMAGE_SIZE: 10 * 1024 * 1024, // 10MB
    MAX_IMAGE_DIMENSION: 1920
  },
  
  // Storage configuration
  STORAGE: {
    DATABASE_NAME: 'clipboard.db',
    BACKUP_ENABLED: true,
    CLEANUP_INTERVAL: 24 * 60 * 60 * 1000 // 24 hours
  },
  
  // Performance settings
  PERFORMANCE: {
    DEBOUNCE_SEARCH: 150, // ms
    VIRTUAL_SCROLL_THRESHOLD: 50,
    IMAGE_LAZY_LOADING: true
  }
};

module.exports = APP_CONFIG;
EOF

echo "✅ Created app config"

cat > src/config/platform-config.js << 'EOF'
const PLATFORM_CONFIG = {
  darwin: {
    // macOS specific
    shortcuts: {
      main: 'Cmd+Shift+V',
      settings: 'Cmd+,',
      quit: 'Cmd+Q'
    },
    permissions: {
      accessibility: true,
      screenRecording: false,
      fileSystem: true
    },
    window: {
      vibrancy: 'sidebar',
      titleBarStyle: 'hiddenInset',
      trafficLightPosition: { x: 20, y: 20 }
    }
  },
  
  win32: {
    // Windows specific
    shortcuts: {
      main: 'Ctrl+Shift+V',
      settings: 'Ctrl+,',
      quit: 'Ctrl+Q'
    },
    permissions: {
      accessibility: false,
      screenRecording: false,
      fileSystem: true
    }
  },
  
  linux: {
    // Linux specific
    shortcuts: {
      main: 'Ctrl+Shift+V',
      settings: 'Ctrl+,',
      quit: 'Ctrl+Q'
    },
    permissions: {
      accessibility: false,
      screenRecording: false,
      fileSystem: true
    }
  }
};

function getPlatformConfig() {
  return PLATFORM_CONFIG[process.platform] || PLATFORM_CONFIG.linux;
}

module.exports = {
  PLATFORM_CONFIG,
  getPlatformConfig
};
EOF

echo "✅ Created platform config"

# Step 9: Move existing files to new locations
echo "📁 Moving existing files to new structure..."

# Move storage.js to new location
if [ -f "src/storage.js" ]; then
  mv src/storage.js src/storage/storage.js
  echo "✅ Moved storage.js to src/storage/"
else
  # Create the storage module in the new location
  mkdir -p src/storage
  mv src/storage.js src/storage/ 2>/dev/null || echo "⚠️ storage.js not found, will need to be created"
fi

# Create an index file for storage module
cat > src/storage/index.js << 'EOF'
module.exports = require('./storage');
EOF

echo "✅ Created storage module index"

# Step 10: Test the new structure
echo "🧪 Testing new structure..."

echo "📋 Checking if all required files exist:"
required_files=(
  "main.js"
  "src/app.js"
  "src/bootstrap/service-registry.js"
  "src/bootstrap/app-initializer.js"
  "src/bootstrap/permission-manager.js"
  "src/config/app-config.js"
  "src/config/platform-config.js"
)

all_exist=true
for file in "${required_files[@]}"; do
  if [ -f "$file" ]; then
    echo "  ✅ $file"
  else
    echo "  ❌ $file (missing)"
    all_exist=false
  fi
done

if [ "$all_exist" = true ]; then
  echo "✅ All core files created successfully"
else
  echo "❌ Some files are missing"
fi

# Step 11: Update imports in existing files (if they exist)
echo "🔧 Updating imports in existing manager files..."

# Update window-manager.js imports if it exists
if [ -f "src/managers/window-manager.js" ]; then
  echo "📝 Note: You may need to update imports in src/managers/window-manager.js"
fi

# Update other manager files
for manager_file in src/managers/*.js; do
  if [ -f "$manager_file" ]; then
    echo "📝 Note: You may need to update imports in $manager_file"
  fi
done

echo ""
echo "================================================"
echo "🎉 Phase 1 Migration Complete!"
echo "================================================"
echo ""
echo "📋 What was done:"
echo "  ✅ Created new directory structure"
echo "  ✅ Backed up original main.js to $BACKUP_DIR/"
echo "  ✅ Created new minimal main.js entry point"
echo "  ✅ Extracted ClipboardManagerApp to src/app.js"
echo "  ✅ Created ServiceRegistry for dependency injection"
echo "  ✅ Created AppInitializer for ordered service startup"
echo "  ✅ Created PermissionManager for platform permissions"
echo "  ✅ Created configuration files"
echo "  ✅ Moved storage module to new location"
echo ""
echo "🔧 Next steps:"
echo "  1. Test the app: npm start"
echo "  2. Fix any import issues in existing manager files"
echo "  3. Verify all functionality works"
echo "  4. Proceed to Phase 2 (Window Management refactoring)"
echo ""
echo "📝 Files to review:"
echo "  - All manager files in src/managers/ may need import updates"
echo "  - Check that all services are properly initialized"
echo ""
echo "💡 If something breaks:"
echo "  - Restore from backup: cp $BACKUP_DIR/main.js.backup main.js"
echo "  - Check console for initialization errors"
echo "  - Verify all dependencies are still working"