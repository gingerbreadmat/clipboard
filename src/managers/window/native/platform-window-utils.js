class PlatformWindowUtils {
  constructor() {
    this.platform = process.platform;
    console.log(`🖥️ Platform Window Utils initialized for ${this.platform}`);
  }

  /**
   * Check if window should be recreated for desktop switching
   */
  shouldRecreateForDesktopSwitch() {
    // Only recreate on macOS for better desktop switching
    return this.platform === 'darwin';
  }

  /**
   * Get platform-specific window options
   */
  getPlatformWindowOptions() {
    const options = {};

    switch (this.platform) {
      case 'darwin': // macOS
        options.vibrancy = 'sidebar';
        options.titleBarStyle = 'hiddenInset';
        options.trafficLightPosition = { x: 0, y: 0 };
        break;

      case 'win32': // Windows
        options.vibrancy = null;
        options.titleBarStyle = 'default';
        break;

      case 'linux': // Linux
        options.vibrancy = null;
        options.titleBarStyle = 'default';
        break;
    }

    return options;
  }

  /**
   * Get platform-specific positioning constraints
   */
  getPositioningConstraints() {
    const constraints = {
      minWidth: 300,
      minHeight: 400,
      maxWidth: null,
      maxHeight: null,
      snapToEdges: false,
      allowOverDock: false
    };

    switch (this.platform) {
      case 'darwin':
        constraints.allowOverDock = true;
        constraints.snapToEdges = true;
        break;

      case 'win32':
        constraints.snapToEdges = true;
        // Windows has taskbar considerations
        break;

      case 'linux':
        // Linux varies by desktop environment
        break;
    }

    return constraints;
  }

  /**
   * Apply platform-specific window properties
   */
  applyPlatformProperties(window) {
    if (!window || window.isDestroyed()) {
      return false;
    }

    try {
      switch (this.platform) {
        case 'darwin':
          return this.applyMacOSProperties(window);
        case 'win32':
          return this.applyWindowsProperties(window);
        case 'linux':
          return this.applyLinuxProperties(window);
        default:
          return true;
      }
    } catch (error) {
      console.error('❌ Error applying platform properties:', error);
      return false;
    }
  }

  /**
   * Apply macOS-specific properties
   */
  applyMacOSProperties(window) {
    try {
      // Hide traffic light buttons
      window.setWindowButtonVisibility(false);
      
      // Set collection behavior for proper space handling
      window.setCollectionBehavior([
        'moveToActiveSpace',
        'managed',
        'participatesInCycle'
      ]);
      
      // Configure for current space only
      window.setVisibleOnAllWorkspaces(false);
      
      console.log('✅ macOS properties applied');
      return true;
    } catch (error) {
      console.error('❌ Error applying macOS properties:', error);
      return false;
    }
  }

  /**
   * Apply Windows-specific properties
   */
  applyWindowsProperties(window) {
    try {
      // Windows-specific configurations
      // Could add Windows-specific taskbar integration here
      
      console.log('✅ Windows properties applied');
      return true;
    } catch (error) {
      console.error('❌ Error applying Windows properties:', error);
      return false;
    }
  }

  /**
   * Apply Linux-specific properties
   */
  applyLinuxProperties(window) {
    try {
      // Linux-specific configurations
      // Could add desktop environment specific handling here
      
      console.log('✅ Linux properties applied');
      return true;
    } catch (error) {
      console.error('❌ Error applying Linux properties:', error);
      return false;
    }
  }

  /**
   * Get platform-specific window levels
   */
  getWindowLevels() {
    const levels = {
      normal: 'normal',
      floating: 'floating',
      screenSaver: 'screen-saver',
      popupMenu: 'pop-up-menu',
      modalPanel: 'modal-panel'
    };

    switch (this.platform) {
      case 'darwin':
        levels.dock = 'dock';
        levels.mainMenu = 'main-menu';
        levels.status = 'status';
        break;

      case 'win32':
        // Windows has different level semantics
        break;

      case 'linux':
        // Linux varies by window manager
        break;
    }

    return levels;
  }

  /**
   * Check platform capabilities
   */
  getPlatformCapabilities() {
    const capabilities = {
      vibrancy: false,
      transparency: true,
      alwaysOnTop: true,
      windowLevels: true,
      nativeMenus: false,
      systemTray: true,
      globalShortcuts: true,
      multiMonitor: true,
      dockIntegration: false,
      spaceManagement: false
    };

    switch (this.platform) {
      case 'darwin':
        capabilities.vibrancy = true;
        capabilities.nativeMenus = true;
        capabilities.dockIntegration = true;
        capabilities.spaceManagement = true;
        break;

      case 'win32':
        capabilities.nativeMenus = true;
        break;

      case 'linux':
        // Capabilities vary by desktop environment
        break;
    }

    return capabilities;
  }

  /**
   * Get optimal window creation options for platform
   */
  getOptimalWindowOptions(type = 'main') {
    const baseOptions = {
      show: false,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false
      }
    };

    const platformOptions = this.getPlatformWindowOptions();
    const capabilities = this.getPlatformCapabilities();

    // Merge based on capabilities
    if (capabilities.vibrancy) {
      baseOptions.vibrancy = platformOptions.vibrancy;
      baseOptions.transparent = false; // Better performance with vibrancy
    } else {
      baseOptions.transparent = false;
      baseOptions.backgroundColor = '#ffffff';
    }

    if (type === 'main') {
      baseOptions.frame = false;
      baseOptions.alwaysOnTop = true;
      baseOptions.skipTaskbar = true;
      
      if (this.platform === 'darwin') {
        baseOptions.level = 'screen-saver';
      }
    }

    return { ...baseOptions, ...platformOptions };
  }

  /**
   * Handle platform-specific window showing
   */
  showWindowPlatformSpecific(window, options = {}) {
    if (!window || window.isDestroyed()) {
      return false;
    }

    try {
      switch (this.platform) {
        case 'darwin':
          return this.showWindowMacOS(window, options);
        case 'win32':
          return this.showWindowWindows(window, options);
        case 'linux':
          return this.showWindowLinux(window, options);
        default:
          window.show();
          return true;
      }
    } catch (error) {
      console.error('❌ Error showing window platform-specific:', error);
      return false;
    }
  }

  /**
   * Show window with macOS-specific handling
   */
  showWindowMacOS(window, options = {}) {
    const { fadeIn = false, moveToActiveSpace = true } = options;

    if (moveToActiveSpace) {
      // Ensure window appears on current space
      window.setVisibleOnAllWorkspaces(false);
    }

    if (fadeIn) {
      // Fade in effect
      window.setOpacity(0);
      window.show();
      
      let opacity = 0;
      const fadeInterval = setInterval(() => {
        opacity += 0.1;
        if (opacity >= 1) {
          opacity = 1;
          clearInterval(fadeInterval);
        }
        window.setOpacity(opacity);
      }, 16);
    } else {
      window.show();
    }

    window.focus();
    return true;
  }

  /**
   * Show window with Windows-specific handling
   */
  showWindowWindows(window, options = {}) {
    const { bringToFront = true } = options;

    window.show();
    
    if (bringToFront) {
      window.focus();
      window.moveTop();
    }

    return true;
  }

  /**
   * Show window with Linux-specific handling
   */
  showWindowLinux(window, options = {}) {
    window.show();
    window.focus();
    return true;
  }

  /**
   * Get platform-specific theme preferences
   */
  getPlatformThemePreferences() {
    const prefs = {
      defaultTheme: 'light',
      supportsSystemTheme: false,
      systemTheme: null
    };

    switch (this.platform) {
      case 'darwin':
        try {
          const { nativeTheme } = require('electron');
          prefs.supportsSystemTheme = true;
          prefs.systemTheme = nativeTheme.shouldUseDarkColors ? 'dark' : 'light';
          prefs.defaultTheme = prefs.systemTheme;
        } catch (error) {
          console.log('Could not detect macOS system theme');
        }
        break;

      case 'win32':
        // Could detect Windows theme here
        break;

      case 'linux':
        // Could detect Linux desktop theme here
        break;
    }

    return prefs;
  }

  /**
   * Handle platform-specific accessibility
   */
  configureAccessibility(window) {
    if (!window || window.isDestroyed()) {
      return false;
    }

    try {
      switch (this.platform) {
        case 'darwin':
          // macOS accessibility
          window.setAccessibleTitle('Clipboard Manager');
          break;

        case 'win32':
          // Windows accessibility
          break;

        case 'linux':
          // Linux accessibility
          break;
      }

      return true;
    } catch (error) {
      console.error('❌ Error configuring accessibility:', error);
      return false;
    }
  }

  /**
   * Get platform-specific performance recommendations
   */
  getPerformanceRecommendations() {
    const recommendations = {
      useTransparency: false,
      useVibrancy: false,
      enableHardwareAcceleration: true,
      backgroundThrottling: false
    };

    switch (this.platform) {
      case 'darwin':
        recommendations.useVibrancy = true; // Good performance on macOS
        break;

      case 'win32':
        recommendations.useTransparency = false; // Can be slow on Windows
        break;

      case 'linux':
        recommendations.useTransparency = false; // Depends on compositor
        break;
    }

    return recommendations;
  }

  /**
   * Get debug information
   */
  getDebugInfo() {
    return {
      platform: this.platform,
      capabilities: this.getPlatformCapabilities(),
      windowLevels: this.getWindowLevels(),
      constraints: this.getPositioningConstraints(),
      themePreferences: this.getPlatformThemePreferences(),
      performanceRecommendations: this.getPerformanceRecommendations(),
      shouldRecreateForDesktopSwitch: this.shouldRecreateForDesktopSwitch()
    };
  }

  /**
   * Clean up platform resources
   */
  destroy() {
    console.log('🖥️ Destroying platform window utils...');
    // No specific cleanup needed for this module
    console.log('✅ Platform window utils destroyed');
  }
}

module.exports = PlatformWindowUtils;