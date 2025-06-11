class WindowConfig {
  constructor() {
    console.log('🔧 Window Config initialized');
  }

  /**
   * Get base configuration for main windows
   */
  getMainWindowBaseConfig() {
    return {
      show: false,
      fullscreenable: false,
      closable: false,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false
      },
      frame: false,
      transparent: false,
      vibrancy: 'sidebar',
      alwaysOnTop: true,
      skipTaskbar: true,
      level: 'screen-saver',
      visibleOnAllWorkspaces: false,
      focusable: true
    };
  }

  /**
   * Get base configuration for settings windows
   */
  getSettingsWindowBaseConfig() {
    return {
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
    };
  }

  /**
   * Get configuration for specific position modes
   */
  getPositionConfig(position) {
    const configs = {
      'cursor': {
        resizable: true,
        movable: true,
        minimizable: true,
        maximizable: true
      },
      'cursor-edge': {
        resizable: false,
        movable: false,
        minimizable: false,
        maximizable: false
      },
      'left': {
        resizable: false,
        movable: false,
        minimizable: false,
        maximizable: false
      },
      'right': {
        resizable: false,
        movable: false,
        minimizable: false,
        maximizable: false
      },
      'top': {
        resizable: false,
        movable: false,
        minimizable: false,
        maximizable: false
      },
      'bottom': {
        resizable: false,
        movable: false,
        minimizable: false,
        maximizable: false
      },
      'window': {
        resizable: true,
        movable: true,
        minimizable: true,
        maximizable: true
      }
    };

    return configs[position] || configs['cursor'];
  }

  /**
   * Get theme-specific configuration
   */
  getThemeConfig(theme) {
    const configs = {
      'light': {
        backgroundColor: '#ffffff'
      },
      'dark': {
        backgroundColor: '#282828'
      }
    };

    return configs[theme] || configs['light'];
  }

  /**
   * Get platform-specific configuration
   */
  getPlatformConfig() {
    const configs = {
      'darwin': {
        vibrancy: 'sidebar',
        titleBarStyle: 'hiddenInset'
      },
      'win32': {
        vibrancy: null,
        titleBarStyle: 'default'
      },
      'linux': {
        vibrancy: null,
        titleBarStyle: 'default'
      }
    };

    return configs[process.platform] || configs['linux'];
  }

  /**
   * Get window bounds configuration
   */
  getBoundsConfig(type = 'main') {
    const configs = {
      'main': {
        defaultWidth: 350,
        defaultHeight: 600,
        minWidth: 300,
        minHeight: 400,
        maxWidth: 800,
        maxHeight: 1200
      },
      'settings': {
        defaultWidth: 500,
        defaultHeight: 800,
        minWidth: 400,
        minHeight: 600,
        maxWidth: 800,
        maxHeight: 1000
      },
      'popup': {
        defaultWidth: 400,
        defaultHeight: 600,
        minWidth: 350,
        minHeight: 500,
        maxWidth: 600,
        maxHeight: 800
      }
    };

    return configs[type] || configs['main'];
  }

  /**
   * Get security configuration
   */
  getSecurityConfig() {
    return {
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
        enableRemoteModule: false,
        worldSafeExecuteJavaScript: true,
        sandbox: false
      }
    };
  }

  /**
   * Get accessibility configuration
   */
  getAccessibilityConfig() {
    return {
      accessibleTitle: 'Clipboard Manager',
      accessibleDescription: 'Clipboard history and management tool'
    };
  }

  /**
   * Merge multiple configurations
   */
  mergeConfigs(...configs) {
    return Object.assign({}, ...configs);
  }

  /**
   * Create complete window configuration
   */
  createWindowConfig(type, options = {}) {
    const {
      position = 'cursor',
      theme = 'light',
      bounds = null,
      windowType = 'main',
      modal = false,
      parent = null
    } = options;

    // Get base configuration
    let baseConfig;
    if (type === 'settings') {
      baseConfig = this.getSettingsWindowBaseConfig();
    } else {
      baseConfig = this.getMainWindowBaseConfig();
    }

    // Get additional configurations
    const positionConfig = this.getPositionConfig(position);
    const themeConfig = this.getThemeConfig(theme);
    const platformConfig = this.getPlatformConfig();
    const boundsConfig = this.getBoundsConfig(windowType);
    const securityConfig = this.getSecurityConfig();
    const accessibilityConfig = this.getAccessibilityConfig();

    // Handle modal configuration
    const modalConfig = modal ? {
      modal: true,
      parent: parent,
      alwaysOnTop: true,
      minimizable: false,
      maximizable: false
    } : {};

    // Handle bounds
    const boundsOverride = bounds ? {
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height
    } : {
      width: boundsConfig.defaultWidth,
      height: boundsConfig.defaultHeight
    };

    // Merge all configurations
    const finalConfig = this.mergeConfigs(
      baseConfig,
      positionConfig,
      themeConfig,
      platformConfig,
      securityConfig,
      accessibilityConfig,
      modalConfig,
      boundsOverride,
      options.overrides || {} // Allow custom overrides
    );

    return finalConfig;
  }

  /**
   * Validate window configuration
   */
  validateConfig(config) {
    const required = ['width', 'height'];
    const missing = required.filter(key => !(key in config));
    
    if (missing.length > 0) {
      console.error('❌ Missing required config properties:', missing);
      return false;
    }

    // Validate bounds
    if (config.width <= 0 || config.height <= 0) {
      console.error('❌ Invalid window dimensions');
      return false;
    }

    // Validate webPreferences
    if (!config.webPreferences || typeof config.webPreferences !== 'object') {
      console.error('❌ Invalid webPreferences configuration');
      return false;
    }

    return true;
  }

  /**
   * Get configuration presets
   */
  getPresets() {
    return {
      'sidebar-left': this.createWindowConfig('main', {
        position: 'left',
        windowType: 'main'
      }),
      'sidebar-right': this.createWindowConfig('main', {
        position: 'right',
        windowType: 'main'
      }),
      'bottom-bar': this.createWindowConfig('main', {
        position: 'bottom',
        windowType: 'main'
      }),
      'top-bar': this.createWindowConfig('main', {
        position: 'top',
        windowType: 'main'
      }),
      'floating-window': this.createWindowConfig('main', {
        position: 'window',
        windowType: 'popup'
      }),
      'cursor-follow': this.createWindowConfig('main', {
        position: 'cursor',
        windowType: 'popup'
      }),
      'settings-standard': this.createWindowConfig('settings', {
        windowType: 'settings'
      }),
      'settings-modal': this.createWindowConfig('settings', {
        windowType: 'settings',
        modal: true
      })
    };
  }

  /**
   * Get preset by name
   */
  getPreset(name) {
    const presets = this.getPresets();
    return presets[name] || null;
  }

  /**
   * List available presets
   */
  listPresets() {
    return Object.keys(this.getPresets());
  }

  /**
   * Get responsive configuration based on display size
   */
  getResponsiveConfig(display) {
    if (!display || !display.bounds) {
      return {};
    }

    const { width: screenWidth, height: screenHeight } = display.bounds;
    const config = {};

    // Adjust based on screen size
    if (screenWidth < 1200) {
      // Small displays
      config.width = Math.min(300, screenWidth * 0.8);
      config.height = Math.min(500, screenHeight * 0.8);
    } else if (screenWidth > 2000) {
      // Large displays  
      config.width = 400;
      config.height = 700;
    }

    // Adjust for high DPI
    if (display.scaleFactor > 1) {
      config.minWidth = Math.round((config.minWidth || 300) * display.scaleFactor);
      config.minHeight = Math.round((config.minHeight || 400) * display.scaleFactor);
    }

    return config;
  }

  /**
   * Get configuration for specific use cases
   */
  getUseCaseConfig(useCase) {
    const configs = {
      'quick-access': {
        alwaysOnTop: true,
        skipTaskbar: true,
        focusable: true,
        show: false
      },
      'persistent-sidebar': {
        alwaysOnTop: false,
        skipTaskbar: false,
        focusable: true,
        visibleOnAllWorkspaces: true
      },
      'overlay-mode': {
        alwaysOnTop: true,
        skipTaskbar: true,
        level: 'screen-saver',
        focusable: true
      },
      'background-monitor': {
        alwaysOnTop: false,
        skipTaskbar: true,
        show: false,
        focusable: false
      }
    };

    return configs[useCase] || {};
  }

  /**
   * Create development configuration
   */
  getDevConfig() {
    return {
      webPreferences: {
        devTools: true,
        nodeIntegration: true,
        contextIsolation: false
      },
      show: true, // Show immediately in dev mode
      alwaysOnTop: false // Don't interfere with dev tools
    };
  }

  /**
   * Create production configuration
   */
  getProdConfig() {
    return {
      webPreferences: {
        devTools: false,
        nodeIntegration: true,
        contextIsolation: false
      },
      show: false, // Hide until ready
      alwaysOnTop: true // Maintain overlay behavior
    };
  }

  /**
   * Get configuration for testing
   */
  getTestConfig() {
    return {
      show: false,
      alwaysOnTop: false,
      skipTaskbar: true,
      width: 400,
      height: 600,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
        devTools: true
      }
    };
  }

  /**
   * Apply conditional configuration based on environment
   */
  applyEnvironmentConfig(config) {
    const isDev = process.env.NODE_ENV === 'development';
    const isTest = process.env.NODE_ENV === 'test';

    if (isDev) {
      return this.mergeConfigs(config, this.getDevConfig());
    } else if (isTest) {
      return this.mergeConfigs(config, this.getTestConfig());
    } else {
      return this.mergeConfigs(config, this.getProdConfig());
    }
  }

  /**
   * Get configuration differences between two configs
   */
  getConfigDiff(config1, config2) {
    const diff = {};
    const allKeys = new Set([...Object.keys(config1), ...Object.keys(config2)]);

    allKeys.forEach(key => {
      if (config1[key] !== config2[key]) {
        diff[key] = {
          from: config1[key],
          to: config2[key]
        };
      }
    });

    return diff;
  }

  /**
   * Sanitize configuration (remove invalid properties)
   */
  sanitizeConfig(config) {
    const sanitized = { ...config };

    // Remove undefined values
    Object.keys(sanitized).forEach(key => {
      if (sanitized[key] === undefined) {
        delete sanitized[key];
      }
    });

    // Ensure numeric values are valid
    ['x', 'y', 'width', 'height', 'minWidth', 'minHeight', 'maxWidth', 'maxHeight'].forEach(key => {
      if (key in sanitized) {
        const value = Number(sanitized[key]);
        if (isNaN(value) || !isFinite(value)) {
          delete sanitized[key];
        } else {
          sanitized[key] = Math.round(value);
        }
      }
    });

    // Ensure boolean values are boolean
    ['show', 'resizable', 'movable', 'minimizable', 'maximizable', 'alwaysOnTop', 'modal'].forEach(key => {
      if (key in sanitized) {
        sanitized[key] = Boolean(sanitized[key]);
      }
    });

    return sanitized;
  }

  /**
   * Get default configuration for unknown scenarios
   */
  getFallbackConfig() {
    return this.createWindowConfig('main', {
      position: 'cursor',
      theme: 'light',
      windowType: 'popup'
    });
  }

  /**
   * Create configuration optimized for performance
   */
  getPerformanceConfig() {
    return {
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
        backgroundThrottling: false,
        offscreen: false
      },
      transparent: false, // Better performance than transparent
      vibrancy: null // Disable vibrancy for better performance
    };
  }

  /**
   * Create configuration optimized for appearance
   */
  getAppearanceConfig() {
    return {
      transparent: false,
      vibrancy: process.platform === 'darwin' ? 'sidebar' : null,
      titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
      webPreferences: {
        experimentalFeatures: true
      }
    };
  }

  /**
   * Get debug information about configurations
   */
  getDebugInfo() {
    return {
      platform: process.platform,
      environment: process.env.NODE_ENV || 'production',
      availablePresets: this.listPresets(),
      defaultBounds: this.getBoundsConfig(),
      platformConfig: this.getPlatformConfig(),
      securityConfig: this.getSecurityConfig()
    };
  }

  /**
   * Export configuration to JSON
   */
  exportConfig(config) {
    return JSON.stringify(this.sanitizeConfig(config), null, 2);
  }

  /**
   * Import configuration from JSON
   */
  importConfig(jsonString) {
    try {
      const config = JSON.parse(jsonString);
      return this.sanitizeConfig(config);
    } catch (error) {
      console.error('❌ Error importing configuration:', error);
      return this.getFallbackConfig();
    }
  }

  /**
   * Clean up configuration resources
   */
  destroy() {
    console.log('🔧 Destroying window config...');
    // No resources to clean up for this module
    console.log('✅ Window config destroyed');
  }
}

module.exports = WindowConfig;