class WindowNativeBridge {
  constructor() {
    this.nativeWindowManager = null;
    this.isAvailable = false;
    
    this.initializeNativeModule();
    console.log('🌉 Window Native Bridge initialized');
  }

  /**
   * Initialize the native window manager module
   */
  initializeNativeModule() {
    try {
      this.nativeWindowManager = require('../../../build/Release/macos_window_manager.node');
      this.isAvailable = true;
      console.log('✅ Native macOS window manager loaded');
    } catch (error) {
      console.log('⚠️ Native window manager not available:', error.message);
      this.isAvailable = false;
    }
  }

  /**
   * Check if native functionality is available
   */
  isNativeAvailable() {
    return this.isAvailable && process.platform === 'darwin';
  }

  /**
   * Get screen information using native APIs
   */
  getScreenInfo() {
    if (!this.isNativeAvailable()) {
      console.warn('⚠️ Native screen info not available');
      return null;
    }

    try {
      const screenInfo = this.nativeWindowManager.getScreenInfo();
      console.log('📺 Native screen info retrieved:', screenInfo);
      return screenInfo;
    } catch (error) {
      console.error('❌ Error getting native screen info:', error);
      return null;
    }
  }

  /**
   * Force window to appear over the dock
   */
  forceWindowOverDock(window, bounds) {
    if (!this.isNativeAvailable()) {
      console.warn('⚠️ Native dock override not available, using fallback');
      return this.fallbackDockPositioning(window);
    }

    try {
      const windowId = this.getWindowId(window);
      if (!windowId) {
        console.error('❌ Could not get window ID for dock override');
        return false;
      }

      const success = this.nativeWindowManager.forceWindowOverDock(
        windowId,
        bounds.x,
        bounds.y,
        bounds.width,
        bounds.height
      );

      if (success) {
        console.log('✅ Successfully positioned window over dock using native APIs');
        return true;
      } else {
        console.log('❌ Native dock positioning failed, using fallback');
        return this.fallbackDockPositioning(window);
      }
    } catch (error) {
      console.error('❌ Error with native dock positioning:', error);
      return this.fallbackDockPositioning(window);
    }
  }

  /**
   * Get native window ID from Electron window
   */
  getWindowId(window) {
    try {
      if (!window || window.isDestroyed()) {
        return null;
      }

      // Get native window handle and extract ID
      const handle = window.getNativeWindowHandle();
      if (handle && handle.length >= 4) {
        return handle.readInt32LE(0);
      }

      console.error('❌ Invalid window handle');
      return null;
    } catch (error) {
      console.error('❌ Error getting window ID:', error);
      return null;
    }
  }

  /**
   * Fallback positioning when native APIs fail
   */
  fallbackDockPositioning(window) {
    try {
      console.log('🔧 Using fallback dock positioning');
      window.setAlwaysOnTop(true, 'pop-up-menu');
      return true;
    } catch (error) {
      console.error('❌ Fallback dock positioning failed:', error);
      return false;
    }
  }

  /**
   * Configure window for specific position using native APIs
   */
  configureForPosition(window, position, display) {
    if (position !== 'bottom') {
      // Only bottom position needs special native handling
      return true;
    }

    console.log('🌉 Configuring window for bottom position with native APIs');

    if (!display || !display.bounds) {
      console.error('❌ Invalid display for native positioning');
      return false;
    }

    const { x: screenX, y: screenY, width: screenWidth, height: screenHeight } = display.bounds;
    const bounds = {
      x: screenX,
      y: screenY + screenHeight - 300,
      width: screenWidth,
      height: 300
    };

    // Use setTimeout to ensure window is fully created
    setTimeout(() => {
      const success = this.forceWindowOverDock(window, bounds);
      if (!success) {
        console.log('⚠️ Native positioning failed, window may appear behind dock');
      }
    }, 100);

    return true;
  }

  /**
   * Apply bottom positioning with dock management
   */
  applyBottomPositioning(window, display, dockService) {
    console.log('🏠 Applying bottom positioning with dock management');

    if (!window || window.isDestroyed()) {
      console.error('❌ Invalid window for bottom positioning');
      return false;
    }

    if (!display || !display.bounds) {
      console.error('❌ Invalid display for bottom positioning');
      return false;
    }

    const { x: screenX, y: screenY, width: screenWidth, height: screenHeight } = display.bounds;
    const bottomBarHeight = 300;
    const bounds = {
      x: screenX,
      y: screenY + screenHeight - bottomBarHeight,
      width: screenWidth,
      height: bottomBarHeight
    };

    if (this.isNativeAvailable()) {
      console.log('🔧 Using native APIs for bottom positioning');
      
      setTimeout(() => {
        const success = this.forceWindowOverDock(window, bounds);
        
        if (success) {
          console.log('✅ Native bottom positioning successful');
        } else {
          console.log('❌ Native positioning failed, using dock hiding');
          this.fallbackBottomPositioning(window, dockService);
        }
      }, 100);
    } else {
      console.log('🔧 Using dock hiding for bottom positioning');
      this.fallbackBottomPositioning(window, dockService);
    }

    return true;
  }

  /**
   * Fallback bottom positioning using dock hiding
   */
  fallbackBottomPositioning(window, dockService) {
    try {
      window.setAlwaysOnTop(true, 'pop-up-menu');
      if (dockService) {
        dockService.setDockVisibility(false);
      }
      console.log('✅ Fallback bottom positioning applied');
      return true;
    } catch (error) {
      console.error('❌ Fallback bottom positioning failed:', error);
      return false;
    }
  }

  /**
   * Test native functionality
   */
  testNativeFunctionality() {
    const results = {
      isAvailable: this.isNativeAvailable(),
      platform: process.platform,
      screenInfo: null,
      errors: []
    };

    if (!this.isNativeAvailable()) {
      results.errors.push('Native module not available');
      return results;
    }

    try {
      results.screenInfo = this.getScreenInfo();
      if (!results.screenInfo) {
        results.errors.push('Failed to get screen info');
      }
    } catch (error) {
      results.errors.push(`Screen info error: ${error.message}`);
    }

    return results;
  }

  /**
   * Get native capabilities
   */
  getNativeCapabilities() {
    return {
      isAvailable: this.isNativeAvailable(),
      platform: process.platform,
      features: {
        screenInfo: this.isNativeAvailable(),
        dockOverride: this.isNativeAvailable(),
        windowLevels: this.isNativeAvailable()
      },
      fallbacks: {
        dockPositioning: true,
        windowLevels: true
      }
    };
  }

  /**
   * Force reload native module
   */
  reloadNativeModule() {
    console.log('🔄 Reloading native module...');
    
    // Clear module cache
    const modulePath = require.resolve('../../../build/Release/macos_window_manager.node');
    if (require.cache[modulePath]) {
      delete require.cache[modulePath];
    }
    
    // Reinitialize
    this.initializeNativeModule();
    
    return this.isAvailable;
  }

  /**
   * Get native module debug information
   */
  getDebugInfo() {
    return {
      isAvailable: this.isAvailable,
      platform: process.platform,
      capabilities: this.getNativeCapabilities(),
      testResults: this.testNativeFunctionality(),
      moduleInfo: {
        hasNativeManager: !!this.nativeWindowManager,
        methods: this.nativeWindowManager ? Object.getOwnPropertyNames(this.nativeWindowManager) : []
      }
    };
  }

  /**
   * Apply window collection behavior (macOS specific)
   */
  applyCollectionBehavior(window, behaviors = []) {
    if (process.platform !== 'darwin') {
      return false;
    }

    try {
      const defaultBehaviors = [
        'moveToActiveSpace',
        'managed',
        'participatesInCycle'
      ];

      const behaviorList = behaviors.length > 0 ? behaviors : defaultBehaviors;
      window.setCollectionBehavior(behaviorList);
      
      console.log('✅ Window collection behavior applied:', behaviorList);
      return true;
    } catch (error) {
      console.error('❌ Error applying collection behavior:', error);
      return false;
    }
  }

  /**
   * Set window level with fallback
   */
  setWindowLevel(window, level) {
    try {
      window.setAlwaysOnTop(true, level);
      console.log(`🔧 Window level set to: ${level}`);
      return true;
    } catch (error) {
      console.error(`❌ Error setting window level to ${level}:`, error);
      
      // Fallback to basic always on top
      try {
        window.setAlwaysOnTop(true);
        console.log('🔧 Fallback: Window set to always on top');
        return true;
      } catch (fallbackError) {
        console.error('❌ Fallback window level setting failed:', fallbackError);
        return false;
      }
    }
  }

  /**
   * Clean up native resources
   */
  destroy() {
    console.log('🌉 Destroying window native bridge...');
    
    // Clear native module reference
    this.nativeWindowManager = null;
    this.isAvailable = false;
    
    console.log('✅ Window native bridge destroyed');
  }
}

module.exports = WindowNativeBridge;