const { globalShortcut } = require('electron');

class ShortcutManager {
  constructor(windowManager) {
    this.windowManager = windowManager;
    this.registeredShortcuts = new Map();
    console.log('⌨️ Shortcut manager initialized');
  }

  registerMainShortcut() {
    console.log('⌨️ Registering global shortcut (Cmd+Shift+V)...');
    
    const shortcutKey = 'CmdOrCtrl+Shift+V';
    const shortcutRegistered = globalShortcut.register(shortcutKey, () => {
      console.log('⌨️ Global shortcut triggered');
      this.windowManager.toggleMainWindow();
    });

    if (shortcutRegistered) {
      this.registeredShortcuts.set('main', shortcutKey);
      console.log('✅ Global shortcut registered successfully');
      return true;
    } else {
      console.error('❌ Failed to register global shortcut');
      return false;
    }
  }

  registerShortcut(name, accelerator, callback) {
    console.log(`⌨️ Registering shortcut: ${name} (${accelerator})`);
    
    // Unregister if already exists
    if (this.registeredShortcuts.has(name)) {
      this.unregisterShortcut(name);
    }
    
    const registered = globalShortcut.register(accelerator, callback);
    
    if (registered) {
      this.registeredShortcuts.set(name, accelerator);
      console.log(`✅ Shortcut '${name}' registered successfully`);
      return true;
    } else {
      console.error(`❌ Failed to register shortcut '${name}'`);
      return false;
    }
  }

  unregisterShortcut(name) {
    if (this.registeredShortcuts.has(name)) {
      const accelerator = this.registeredShortcuts.get(name);
      globalShortcut.unregister(accelerator);
      this.registeredShortcuts.delete(name);
      console.log(`🗑️ Unregistered shortcut: ${name} (${accelerator})`);
      return true;
    } else {
      console.warn(`⚠️ Shortcut '${name}' not found for unregistration`);
      return false;
    }
  }

  unregisterAllShortcuts() {
    console.log('🧹 Unregistering all shortcuts...');
    globalShortcut.unregisterAll();
    this.registeredShortcuts.clear();
    console.log('✅ All shortcuts unregistered');
  }

  isShortcutRegistered(accelerator) {
    return globalShortcut.isRegistered(accelerator);
  }

  getRegisteredShortcuts() {
    return Array.from(this.registeredShortcuts.entries()).map(([name, accelerator]) => ({
      name,
      accelerator
    }));
  }

  // Predefined shortcuts that can be easily enabled/disabled
  registerSettingsShortcut() {
    return this.registerShortcut('settings', 'CmdOrCtrl+,', () => {
      console.log('⌨️ Settings shortcut triggered');
      this.windowManager.createSettingsWindow();
    });
  }

  registerClearHistoryShortcut() {
    return this.registerShortcut('clear-history', 'CmdOrCtrl+Shift+Delete', () => {
      console.log('⌨️ Clear history shortcut triggered');
      // Could add confirmation dialog here
      // For now, just log - the actual implementation would need storage access
      console.log('🧹 Clear history shortcut triggered (implementation needed)');
    });
  }

  registerQuitShortcut() {
    return this.registerShortcut('quit', 'CmdOrCtrl+Q', () => {
      console.log('⌨️ Quit shortcut triggered');
      const { app } = require('electron');
      app.isQuiting = true;
      app.quit();
    });
  }

  // Register all default shortcuts
  registerDefaultShortcuts() {
    console.log('⌨️ Registering default shortcuts...');
    
    const results = {
      main: this.registerMainShortcut(),
      settings: this.registerSettingsShortcut(),
      // quit: this.registerQuitShortcut() // Commented out as it might conflict with other apps
    };
    
    const successCount = Object.values(results).filter(Boolean).length;
    console.log(`✅ Registered ${successCount} out of ${Object.keys(results).length} default shortcuts`);
    
    return results;
  }

  // Check if shortcuts are available (not conflicting)
  checkShortcutAvailability(accelerator) {
    try {
      // Try to register temporarily to check availability
      const testRegistered = globalShortcut.register(accelerator, () => {});
      if (testRegistered) {
        globalShortcut.unregister(accelerator);
        return true;
      }
      return false;
    } catch (error) {
      console.error(`❌ Error checking shortcut availability for ${accelerator}:`, error);
      return false;
    }
  }

  // Get info about all shortcuts
  getShortcutInfo() {
    const registered = this.getRegisteredShortcuts();
    const systemShortcuts = [
      'CmdOrCtrl+Shift+V',
      'CmdOrCtrl+,',
      'CmdOrCtrl+Shift+Delete',
      'CmdOrCtrl+Q'
    ];
    
    return {
      registered,
      available: systemShortcuts.map(shortcut => ({
        accelerator: shortcut,
        available: this.checkShortcutAvailability(shortcut),
        registered: this.isShortcutRegistered(shortcut)
      }))
    };
  }

  // Validate accelerator format
  isValidAccelerator(accelerator) {
    try {
      // Try to register with a dummy callback to validate format
      const testRegistered = globalShortcut.register(accelerator, () => {});
      if (testRegistered) {
        globalShortcut.unregister(accelerator);
        return true;
      }
      return false;
    } catch (error) {
      return false;
    }
  }

  // Debug information
  getDebugInfo() {
    return {
      registeredShortcuts: this.getRegisteredShortcuts(),
      shortcutInfo: this.getShortcutInfo(),
      platform: process.platform
    };
  }
}

module.exports = ShortcutManager;