const { BrowserWindow } = require('electron');

class SettingsWindowFactory {
  constructor(settingsService, displayDetector) {
    this.settingsService = settingsService;
    this.displayDetector = displayDetector;
    console.log('⚙️ Settings Window Factory initialized');
  }

  /**
   * Create the settings window
   */
  createSettingsWindow(currentDisplay = null) {
    console.log('⚙️ Creating settings window...');
    
    // Use provided display or detect current display
    const targetDisplay = currentDisplay || this.displayDetector.getPrimaryDisplay();
    const { x: screenX, y: screenY, width: screenWidth, height: screenHeight } = targetDisplay.bounds;
    
    // Get current theme
    const currentTheme = this.settingsService.getTheme();
    const backgroundColor = currentTheme === 'dark' ? '#282828' : '#ffffff';
    
    // Calculate centered position
    const windowWidth = 500;
    const windowHeight = 800;
    const x = screenX + (screenWidth - windowWidth) / 2;
    const y = screenY + (screenHeight - windowHeight) / 2;
    
    const settingsWindow = new BrowserWindow({
      x: Math.round(x),
      y: Math.round(y),
      width: windowWidth,
      height: windowHeight,
      minWidth: 400,
      minHeight: 600,
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
      backgroundColor: backgroundColor,
      alwaysOnTop: false,
      skipTaskbar: false,
      frame: true,
      parent: null,
      modal: false
    });

    console.log('⚙️ Loading settings.html...');
    settingsWindow.loadFile('renderer/settings.html');
    
    console.log('✅ Settings window created');
    
    return {
      window: settingsWindow,
      bounds: { x, y, width: windowWidth, height: windowHeight },
      display: targetDisplay,
      theme: currentTheme
    };
  }

  /**
   * Create settings window with specific configuration
   */
  createConfiguredSettingsWindow(config) {
    const {
      bounds = null,
      theme = null,
      display = null,
      modal = false,
      parent = null,
      options = {}
    } = config;
    
    const targetDisplay = display || this.displayDetector.getPrimaryDisplay();
    const currentTheme = theme || this.settingsService.getTheme();
    const backgroundColor = currentTheme === 'dark' ? '#282828' : '#ffffff';
    
    // Use provided bounds or calculate centered position
    let windowBounds;
    if (bounds && this.isValidBounds(bounds)) {
      windowBounds = bounds;
    } else {
      const { x: screenX, y: screenY, width: screenWidth, height: screenHeight } = targetDisplay.bounds;
      const windowWidth = 500;
      const windowHeight = 800;
      windowBounds = {
        x: Math.round(screenX + (screenWidth - windowWidth) / 2),
        y: Math.round(screenY + (screenHeight - windowHeight) / 2),
        width: windowWidth,
        height: windowHeight
      };
    }
    
    const windowOptions = {
      ...windowBounds,
      minWidth: 400,
      minHeight: 600,
      show: false,
      resizable: true,
      movable: true,
      minimizable: !modal,
      maximizable: !modal,
      fullscreenable: false,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false
      },
      titleBarStyle: 'default',
      vibrancy: 'window',
      transparent: false,
      backgroundColor,
      alwaysOnTop: modal,
      skipTaskbar: modal,
      frame: true,
      parent: parent,
      modal: modal,
      ...options // Allow override of any option
    };
    
    const settingsWindow = new BrowserWindow(windowOptions);
    settingsWindow.loadFile('renderer/settings.html');
    
    return {
      window: settingsWindow,
      bounds: windowBounds,
      display: targetDisplay,
      theme: currentTheme,
      modal,
      parent
    };
  }

  /**
   * Position settings window relative to main window
   */
  createSettingsWindowRelativeToMain(mainWindow, offset = { x: 50, y: 50 }) {
    if (!mainWindow || mainWindow.isDestroyed()) {
      console.warn('⚠️ Main window not available, creating centered settings window');
      return this.createSettingsWindow();
    }
    
    const mainBounds = mainWindow.getBounds();
    const display = this.displayDetector.getDisplayAtPoint(mainBounds.x, mainBounds.y);
    
    const settingsBounds = {
      x: mainBounds.x + offset.x,
      y: mainBounds.y + offset.y,
      width: 500,
      height: 800
    };
    
    // Ensure settings window stays within display bounds
    if (display) {
      const constrainedBounds = this.constrainBoundsToDisplay(settingsBounds, display);
      settingsBounds.x = constrainedBounds.x;
      settingsBounds.y = constrainedBounds.y;
    }
    
    return this.createConfiguredSettingsWindow({
      bounds: settingsBounds,
      display: display,
      parent: null // Don't set parent to avoid modal behavior
    });
  }

  /**
   * Create modal settings window
   */
  createModalSettingsWindow(parentWindow = null) {
    const display = parentWindow ? 
      this.displayDetector.getDisplayAtPoint(
        parentWindow.getBounds().x, 
        parentWindow.getBounds().y
      ) : 
      this.displayDetector.getPrimaryDisplay();
    
    return this.createConfiguredSettingsWindow({
      display: display,
      modal: true,
      parent: parentWindow
    });
  }

  /**
   * Create settings window on specific display
   */
  createSettingsWindowOnDisplay(displayId) {
    const display = this.displayDetector.getDisplayById(displayId);
    if (!display) {
      console.error('❌ Display not found:', displayId);
      return this.createSettingsWindow(); // Fallback
    }
    
    return this.createConfiguredSettingsWindow({
      display: display
    });
  }

  /**
   * Validate bounds for settings window
   */
  isValidBounds(bounds) {
    return (
      bounds &&
      typeof bounds.x === 'number' && !isNaN(bounds.x) &&
      typeof bounds.y === 'number' && !isNaN(bounds.y) &&
      typeof bounds.width === 'number' && bounds.width > 0 &&
      typeof bounds.height === 'number' && bounds.height > 0
    );
  }

  /**
   * Constrain bounds to display
   */
  constrainBoundsToDisplay(bounds, display) {
    if (!display || !display.bounds) {
      return bounds;
    }

    const { x: screenX, y: screenY, width: screenWidth, height: screenHeight } = display.bounds;
    
    return {
      x: Math.max(screenX, Math.min(bounds.x, screenX + screenWidth - bounds.width)),
      y: Math.max(screenY, Math.min(bounds.y, screenY + screenHeight - bounds.height)),
      width: Math.min(bounds.width, screenWidth),
      height: Math.min(bounds.height, screenHeight)
    };
  }

  /**
   * Get default settings window configuration
   */
  getDefaultSettingsConfig() {
    const display = this.displayDetector.getPrimaryDisplay();
    const theme = this.settingsService.getTheme();
    
    const { x: screenX, y: screenY, width: screenWidth, height: screenHeight } = display.bounds;
    const windowWidth = 500;
    const windowHeight = 800;
    
    return {
      bounds: {
        x: Math.round(screenX + (screenWidth - windowWidth) / 2),
        y: Math.round(screenY + (screenHeight - windowHeight) / 2),
        width: windowWidth,
        height: windowHeight
      },
      theme,
      display,
      modal: false,
      parent: null
    };
  }

  /**
   * Update settings window configuration
   */
  updateSettingsWindowConfig(window, newConfig) {
    if (!window || window.isDestroyed()) {
      console.error('❌ Cannot update destroyed settings window');
      return false;
    }
    
    const { bounds, theme } = newConfig;
    
    try {
      // Update bounds if provided
      if (bounds && this.isValidBounds(bounds)) {
        window.setBounds(bounds);
      }
      
      // Update theme by sending to renderer
      if (theme && window.webContents) {
        window.webContents.send('theme-changed', theme);
      }
      
      console.log('✅ Settings window configuration updated');
      return true;
      
    } catch (error) {
      console.error('❌ Error updating settings window configuration:', error);
      return false;
    }
  }

  /**
   * Clone settings window configuration
   */
  cloneSettingsWindowConfig(existingWindow) {
    if (!existingWindow || existingWindow.isDestroyed()) {
      return this.getDefaultSettingsConfig();
    }
    
    const bounds = existingWindow.getBounds();
    const theme = this.settingsService.getTheme();
    const display = this.displayDetector.getDisplayAtPoint(bounds.x, bounds.y);
    
    return {
      bounds,
      theme,
      display: display || this.displayDetector.getPrimaryDisplay(),
      modal: existingWindow.isModal(),
      parent: existingWindow.getParentWindow()
    };
  }

  /**
   * Test settings window creation
   */
  testSettingsWindowCreation() {
    try {
      const config = this.getDefaultSettingsConfig();
      const isValid = this.validateSettingsConfig(config);
      
      return {
        success: isValid,
        config,
        errors: isValid ? [] : ['Invalid configuration generated']
      };
    } catch (error) {
      return {
        success: false,
        config: null,
        errors: [error.message]
      };
    }
  }

  /**
   * Validate settings window configuration
   */
  validateSettingsConfig(config) {
    const { bounds, theme, display } = config;
    
    // Validate bounds
    if (!bounds || !this.isValidBounds(bounds)) {
      console.error('❌ Invalid bounds in settings config:', bounds);
      return false;
    }
    
    // Validate theme
    if (!theme || !['light', 'dark'].includes(theme)) {
      console.error('❌ Invalid theme in settings config:', theme);
      return false;
    }
    
    // Validate display
    if (!display || !display.bounds) {
      console.error('❌ Invalid display in settings config:', display);
      return false;
    }
    
    return true;
  }

  /**
   * Get factory statistics for debugging
   */
  getFactoryStats() {
    return {
      factoryInitialized: true,
      hasSettingsService: !!this.settingsService,
      hasDisplayDetector: !!this.displayDetector,
      platform: process.platform,
      defaultTheme: this.settingsService?.getTheme() || 'light',
      availableDisplays: this.displayDetector?.getAllDisplays()?.length || 0
    };
  }

  /**
   * Calculate optimal settings window size based on display
   */
  calculateOptimalSize(display) {
    if (!display || !display.bounds) {
      return { width: 500, height: 800 };
    }
    
    const { width: screenWidth, height: screenHeight } = display.bounds;
    
    // Scale window size based on display size
    let windowWidth = 500;
    let windowHeight = 800;
    
    // For smaller displays, reduce window size
    if (screenWidth < 1200 || screenHeight < 900) {
      windowWidth = Math.min(450, screenWidth * 0.8);
      windowHeight = Math.min(700, screenHeight * 0.8);
    }
    // For larger displays, increase window size
    else if (screenWidth > 2000) {
      windowWidth = 600;
      windowHeight = 900;
    }
    
    return {
      width: Math.round(windowWidth),
      height: Math.round(windowHeight)
    };
  }

  /**
   * Clean up factory resources
   */
  destroy() {
    console.log('⚙️ Destroying settings window factory...');
    
    // Clear references
    this.settingsService = null;
    this.displayDetector = null;
    
    console.log('✅ Settings window factory destroyed');
  }
}

module.exports = SettingsWindowFactory;