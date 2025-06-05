const Store = require('electron-store');

class SettingsService {
  constructor() {
    console.log('⚙️ Initializing settings service...');
    
    this.store = new Store({
      defaults: {
        theme: 'light',
        windowPosition: 'left'
      }
    });
    
    console.log('✅ Settings service initialized');
  }

  // Theme management
  getTheme() {
    const theme = this.store.get('theme', 'light');
    console.log('🎨 Getting theme from store:', theme);
    return theme;
  }

  setTheme(theme) {
    console.log('🎨 Setting theme to:', theme);
    this.store.set('theme', theme);
    return true;
  }

  // Window position management
  getWindowPosition() {
    const position = this.store.get('windowPosition', 'left');
    console.log('📍 Getting window position from store:', position);
    return position;
  }

  setWindowPosition(position) {
    console.log('📍 Setting window position to:', position);
    this.store.set('windowPosition', position);
    return true;
  }

  // General setting management
  get(key, defaultValue = null) {
    return this.store.get(key, defaultValue);
  }

  set(key, value) {
    this.store.set(key, value);
    return true;
  }

  has(key) {
    return this.store.has(key);
  }

  delete(key) {
    this.store.delete(key);
    return true;
  }

  clear() {
    this.store.clear();
    return true;
  }

  // Get all settings
  getAll() {
    return this.store.store;
  }

  // Reset to defaults
  resetToDefaults() {
    console.log('🔄 Resetting settings to defaults...');
    this.store.clear();
    console.log('✅ Settings reset to defaults');
    return true;
  }

  // Validation methods
  isValidTheme(theme) {
    return ['light', 'dark'].includes(theme);
  }

  isValidWindowPosition(position) {
    return ['left', 'right', 'top', 'bottom', 'window'].includes(position);
  }

  // Safe setters with validation
  setThemeSafe(theme) {
    if (this.isValidTheme(theme)) {
      return this.setTheme(theme);
    } else {
      console.error('❌ Invalid theme:', theme);
      return false;
    }
  }

  setWindowPositionSafe(position) {
    if (this.isValidWindowPosition(position)) {
      return this.setWindowPosition(position);
    } else {
      console.error('❌ Invalid window position:', position);
      return false;
    }
  }

  // Export/Import settings
  exportSettings() {
    return JSON.stringify(this.getAll(), null, 2);
  }

  importSettings(settingsJson) {
    try {
      const settings = JSON.parse(settingsJson);
      
      // Validate before importing
      if (settings.theme && !this.isValidTheme(settings.theme)) {
        console.error('❌ Invalid theme in import:', settings.theme);
        return false;
      }
      
      if (settings.windowPosition && !this.isValidWindowPosition(settings.windowPosition)) {
        console.error('❌ Invalid window position in import:', settings.windowPosition);
        return false;
      }
      
      // Import valid settings
      Object.keys(settings).forEach(key => {
        this.set(key, settings[key]);
      });
      
      console.log('✅ Settings imported successfully');
      return true;
    } catch (error) {
      console.error('❌ Error importing settings:', error);
      return false;
    }
  }

  // Get settings file path (useful for debugging)
  getSettingsPath() {
    return this.store.path;
  }

  // Debug information
  getDebugInfo() {
    return {
      path: this.getSettingsPath(),
      settings: this.getAll(),
      theme: this.getTheme(),
      windowPosition: this.getWindowPosition()
    };
  }
}

module.exports = SettingsService;