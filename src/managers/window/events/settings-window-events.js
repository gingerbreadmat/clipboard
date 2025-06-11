const { BrowserWindow, screen } = require('electron');

/**
 * SettingsWindowFactory - Creates and configures settings windows
 * Based on the existing settings window creation logic from your WindowManager
 */
class SettingsWindowFactory {
  constructor(settingsService) {
    this.settingsService = settingsService;
    console.log('⚙️ SettingsWindowFactory initialized');
  }

  /**
   * Creates a new settings window with proper configuration
   * @param {Object} options - Additional window options
   * @param {Object} targetDisplay - Display to position the window on
   * @returns {BrowserWindow} The created settings window
   */
  createWindow(options = {}, targetDisplay = null) {
    console.log('⚙️ Creating settings window...');
    
    // Use provided display or get primary display
    const display = targetDisplay || screen.getPrimaryDisplay();
    const { x: screenX, y: screenY, width: screenWidth, height: screenHeight } = display.bounds;
    
    // Get current theme for proper background color
    const currentTheme = this.settingsService ? this.settingsService.getTheme() : 'light';
    const backgroundColor = currentTheme === 'dark' ? '#282828' : '#ffffff';
    
    // Default window configuration
    const defaultOptions = {
      x: screenX + (screenWidth - 500) / 2,
      y: screenY + (screenHeight - 800) / 2,
      width: 500,
      height: 800,
      minWidth: 400,
      minHeight: 600,
      show: false, // Prevent flash
      resizable: true,
      movable: true,
      minimizable: true,
      maximizable: true,
      fullscreenable: false,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
        backgroundThrottling: false,
        paintWhenInitiallyHidden: false
      },
      titleBarStyle: 'default',
      transparent: false,
      alwaysOnTop: false,
      skipTaskbar: false,
      frame: true,
      parent: null,
      modal: false,
      backgroundColor: backgroundColor
    };

    // Add platform-specific options
    if (process.platform === 'darwin') {
      defaultOptions.vibrancy = 'window';
      defaultOptions.titleBarStyle = 'default';
    }

    // Merge with provided options
    const windowOptions = { ...defaultOptions, ...options };
    
    console.log('⚙️ Settings window options:', {
      position: `${windowOptions.x}, ${windowOptions.y}`,
      size: `${windowOptions.width}x${windowOptions.height}`,
      theme: currentTheme,
      backgroundColor: windowOptions.backgroundColor
    });

    // Create the window
    const settingsWindow = new BrowserWindow(windowOptions);

    // Set up window event handlers
    this.setupWindowEventHandlers(settingsWindow);

    // Load the settings HTML file
    settingsWindow.loadFile('renderer/settings.html');

    return settingsWindow;
  }

  /**
   * Sets up event handlers for the settings window
   * @param {BrowserWindow} settingsWindow - The settings window to configure
   */
  setupWindowEventHandlers(settingsWindow) {
    // Handle load failures
    settingsWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
      console.error('❌ Settings window failed to load:', errorCode, errorDescription, validatedURL);
    });

    // Handle successful load
    settingsWindow.webContents.on('did-finish-load', () => {
      console.log('✅ Settings window finished loading');
    });

    // Handle DOM ready
    settingsWindow.webContents.on('dom-ready', () => {
      console.log('✅ Settings window DOM ready');
    });

    // Handle ready to show
    settingsWindow.on('ready-to-show', () => {
      console.log('⚙️ Settings window ready to show');
      settingsWindow.show();
      settingsWindow.center();
      settingsWindow.focus();
      
      // Apply current theme when settings window is shown
      if (this.settingsService) {
        const currentTheme = this.settingsService.getTheme();
        settingsWindow.webContents.send('theme-changed', currentTheme);
      }
    });

    // Handle window closed
    settingsWindow.on('closed', () => {
      console.log('⚙️ Settings window closed');
      // Note: The window manager should handle nullifying the reference
    });

    // Handle window blur (optional - for auto-hide behavior)
    settingsWindow.on('blur', () => {
      // Settings window doesn't auto-hide like main window
      console.log('⚙️ Settings window lost focus');
    });

    // Handle minimize/restore
    settingsWindow.on('minimize', () => {
      console.log('⚙️ Settings window minimized');
    });

    settingsWindow.on('restore', () => {
      console.log('⚙️ Settings window restored');
    });
  }

  /**
   * Creates a settings window positioned relative to a main window
   * @param {BrowserWindow} mainWindow - Reference main window for positioning
   * @param {Object} options - Additional window options
   * @returns {BrowserWindow} The created settings window
   */
  createRelativeToMainWindow(mainWindow, options = {}) {
    if (!mainWindow || mainWindow.isDestroyed()) {
      // Fall back to primary display if main window is not available
      return this.createWindow(options);
    }

    const mainBounds = mainWindow.getBounds();
    const mainDisplay = screen.getDisplayMatching(mainBounds);
    
    // Position settings window on the same display as main window
    const centeredOptions = {
      x: mainDisplay.bounds.x + (mainDisplay.bounds.width - 500) / 2,
      y: mainDisplay.bounds.y + (mainDisplay.bounds.height - 800) / 2,
      ...options
    };

    return this.createWindow(centeredOptions, mainDisplay);
  }

  /**
   * Creates a modal settings window (if needed)
   * @param {BrowserWindow} parentWindow - Parent window for modal
   * @param {Object} options - Additional window options
   * @returns {BrowserWindow} The created modal settings window
   */
  createModal(parentWindow, options = {}) {
    const modalOptions = {
      parent: parentWindow,
      modal: true,
      ...options
    };

    return this.createWindow(modalOptions);
  }

  /**
   * Validates window options
   * @param {Object} options - Window options to validate
   * @returns {boolean} True if options are valid
   */
  validateOptions(options) {
    // Basic validation
    if (options.width && (options.width < 300 || options.width > 2000)) {
      console.warn('⚠️ Settings window width should be between 300 and 2000 pixels');
      return false;
    }

    if (options.height && (options.height < 400 || options.height > 1500)) {
      console.warn('⚠️ Settings window height should be between 400 and 1500 pixels');
      return false;
    }

    return true;
  }

  /**
   * Gets recommended window options based on current system
   * @returns {Object} Recommended options
   */
  getRecommendedOptions() {
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width: screenWidth, height: screenHeight } = primaryDisplay.bounds;
    
    // Calculate optimal size based on screen size
    const optimalWidth = Math.min(500, Math.max(400, screenWidth * 0.3));
    const optimalHeight = Math.min(800, Math.max(600, screenHeight * 0.8));

    return {
      width: optimalWidth,
      height: optimalHeight,
      minWidth: 400,
      minHeight: 600
    };
  }

  /**
   * Creates a debug/development settings window with dev tools
   * @param {Object} options - Additional window options
   * @returns {BrowserWindow} The created debug settings window
   */
  createDebugWindow(options = {}) {
    const debugOptions = {
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
        backgroundThrottling: false,
        devTools: true // Ensure dev tools are enabled
      },
      ...options
    };

    const window = this.createWindow(debugOptions);
    
    // Open dev tools automatically for debug window
    window.webContents.once('did-finish-load', () => {
      window.webContents.openDevTools();
    });

    return window;
  }

  /**
   * Cleanup method
   */
  cleanup() {
    console.log('🧹 SettingsWindowFactory cleanup...');
    // No specific cleanup needed currently
  }
}

module.exports = SettingsWindowFactory;