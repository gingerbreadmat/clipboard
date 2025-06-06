
const Store = require('electron-store');

class SettingsService {
  constructor() {
    console.log('⚙️ Initializing settings service...');
    
    this.store = new Store({
      defaults: {
        theme: 'light',
        windowPosition: 'cursor', // Default to cursor-aware positioning
        // New cursor-specific settings
        cursorOffset: { x: 20, y: 20 }, // Default offset from cursor
        edgeSnapping: true, // Whether to snap to nearest edge in cursor-edge mode
        multiMonitorSupport: true, // Enable multi-monitor support
        rememberLastDisplay: false, // Remember which display was last used
        lastDisplayId: null, // Store last display ID
        // Legacy compatibility settings
        legacyPositioning: false // For backward compatibility
      }
    });
    
    // Migrate old settings if needed
    this.migrateOldSettings();
    
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
    const position = this.store.get('windowPosition', 'cursor');
    console.log('📍 Getting window position from store:', position);
    return position;
  }

  setWindowPosition(position) {
    console.log('📍 Setting window position to:', position);
    this.store.set('windowPosition', position);
    return true;
  }

  // Cursor positioning settings
  getCursorOffset() {
    return this.store.get('cursorOffset', { x: 20, y: 20 });
  }

  setCursorOffset(offset) {
    console.log('🖱️ Setting cursor offset to:', offset);
    this.store.set('cursorOffset', offset);
    return true;
  }

  getEdgeSnapping() {
    return this.store.get('edgeSnapping', true);
  }

  setEdgeSnapping(enabled) {
    console.log('⚡ Setting edge snapping to:', enabled);
    this.store.set('edgeSnapping', enabled);
    return true;
  }

  // Multi-monitor settings
  getMultiMonitorSupport() {
    return this.store.get('multiMonitorSupport', true);
  }

  setMultiMonitorSupport(enabled) {
    console.log('📺 Setting multi-monitor support to:', enabled);
    this.store.set('multiMonitorSupport', enabled);
    return true;
  }

  getRememberLastDisplay() {
    return this.store.get('rememberLastDisplay', false);
  }

  setRememberLastDisplay(enabled) {
    console.log('💾 Setting remember last display to:', enabled);
    this.store.set('rememberLastDisplay', enabled);
    return true;
  }

  getLastDisplayId() {
    return this.store.get('lastDisplayId', null);
  }

  setLastDisplayId(displayId) {
    console.log('📺 Setting last display ID to:', displayId);
    this.store.set('lastDisplayId', displayId);
    return true;
  }

  // Legacy compatibility
  getLegacyPositioning() {
    return this.store.get('legacyPositioning', false);
  }

  setLegacyPositioning(enabled) {
    console.log('🔄 Setting legacy positioning to:', enabled);
    this.store.set('legacyPositioning', enabled);
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
    return ['cursor', 'cursor-edge', 'left', 'right', 'top', 'bottom', 'window'].includes(position);
  }

  isValidCursorOffset(offset) {
    return (
      typeof offset === 'object' &&
      typeof offset.x === 'number' &&
      typeof offset.y === 'number' &&
      offset.x >= 0 && offset.x <= 200 &&
      offset.y >= 0 && offset.y <= 200
    );
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

  setCursorOffsetSafe(offset) {
    if (this.isValidCursorOffset(offset)) {
      return this.setCursorOffset(offset);
    } else {
      console.error('❌ Invalid cursor offset:', offset);
      return false;
    }
  }

  // Migration for old settings
  migrateOldSettings() {
    console.log('🔄 Checking for settings migration...');
    
    // If we have old position settings, migrate them
    if (!this.has('windowPosition') && this.has('position')) {
      const oldPosition = this.get('position');
      console.log('📦 Migrating old position setting:', oldPosition);
      
      // Map old position values to new ones
      let newPosition = 'cursor'; // Default
      
      switch (oldPosition) {
        case 'left':
        case 'right':
        case 'top':
        case 'bottom':
        case 'window':
          newPosition = oldPosition;
          break;
        default:
          newPosition = 'cursor';
      }
      
      this.setWindowPosition(newPosition);
      this.delete('position'); // Remove old setting
      console.log('✅ Position setting migrated to:', newPosition);
    }
    
    // Set legacy flag if migrating from old version
    if (!this.has('legacyPositioning') && this.has('version')) {
      const version = this.get('version');
      if (version && version < '1.1.0') {
        this.setLegacyPositioning(true);
        console.log('🔄 Legacy positioning enabled for migration');
      }
    }
    
    // Set current version
    this.set('version', '1.1.0');
  }

  // Get positioning configuration
  getPositioningConfig() {
    return {
      position: this.getWindowPosition(),
      cursorOffset: this.getCursorOffset(),
      edgeSnapping: this.getEdgeSnapping(),
      multiMonitorSupport: this.getMultiMonitorSupport(),
      rememberLastDisplay: this.getRememberLastDisplay(),
      lastDisplayId: this.getLastDisplayId(),
      legacyPositioning: this.getLegacyPositioning()
    };
  }

  // Set positioning configuration
  setPositioningConfig(config) {
    console.log('📍 Setting positioning configuration:', config);
    
    const results = {};
    
    if (config.position !== undefined) {
      results.position = this.setWindowPositionSafe(config.position);
    }
    
    if (config.cursorOffset !== undefined) {
      results.cursorOffset = this.setCursorOffsetSafe(config.cursorOffset);
    }
    
    if (config.edgeSnapping !== undefined) {
      results.edgeSnapping = this.setEdgeSnapping(config.edgeSnapping);
    }
    
    if (config.multiMonitorSupport !== undefined) {
      results.multiMonitorSupport = this.setMultiMonitorSupport(config.multiMonitorSupport);
    }
    
    if (config.rememberLastDisplay !== undefined) {
      results.rememberLastDisplay = this.setRememberLastDisplay(config.rememberLastDisplay);
    }
    
    if (config.lastDisplayId !== undefined) {
      results.lastDisplayId = this.setLastDisplayId(config.lastDisplayId);
    }
    
    if (config.legacyPositioning !== undefined) {
      results.legacyPositioning = this.setLegacyPositioning(config.legacyPositioning);
    }
    
    console.log('✅ Positioning configuration results:', results);
    return results;
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
      

      if (settings.cursorOffset && !this.isValidCursorOffset(settings.cursorOffset)) {
        console.error('❌ Invalid cursor offset in import:', settings.cursorOffset);
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
      windowPosition: this.getWindowPosition(),
      positioningConfig: this.getPositioningConfig(),
      version: this.get('version'),
      migrated: !this.getLegacyPositioning()
    };
  }

  // Get recommended settings based on system
  getRecommendedSettings() {
    const os = require('os');
    const platform = os.platform();
    
    const recommendations = {
      theme: 'light', // Could detect system theme
      windowPosition: 'cursor',
      cursorOffset: { x: 20, y: 20 },
      edgeSnapping: true,
      multiMonitorSupport: true,
      rememberLastDisplay: false
    };
    
    // Platform-specific recommendations
    switch (platform) {
      case 'darwin': // macOS
        recommendations.windowPosition = 'cursor';
        recommendations.edgeSnapping = true;
        break;
      case 'win32': // Windows
        recommendations.windowPosition = 'cursor-edge';
        recommendations.edgeSnapping = false;
        break;
      case 'linux': // Linux
        recommendations.windowPosition = 'window';
        recommendations.edgeSnapping = false;
        break;
    }
    
    console.log('💡 Recommended settings for', platform, ':', recommendations);
    return recommendations;
  }

  // Apply recommended settings
  applyRecommendedSettings() {
    console.log('💡 Applying recommended settings...');
    const recommended = this.getRecommendedSettings();
    
    Object.keys(recommended).forEach(key => {
      switch (key) {
        case 'theme':
          this.setThemeSafe(recommended.theme);
          break;
        case 'windowPosition':
          this.setWindowPositionSafe(recommended.windowPosition);
          break;
        case 'cursorOffset':
          this.setCursorOffsetSafe(recommended.cursorOffset);
          break;
        default:
          this.set(key, recommended[key]);
      }
    });
    
    console.log('✅ Recommended settings applied');
    return true;
  }
}

module.exports = SettingsService;