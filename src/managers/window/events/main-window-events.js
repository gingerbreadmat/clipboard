const { BrowserWindow, screen } = require('electron');

/**
 * MainWindowFactory - Creates and configures main clipboard windows
 * Handles positioning, theming, and platform-specific configurations
 */
class MainWindowFactory {
  constructor(settingsService, positionCalculator) {
    this.settingsService = settingsService;
    this.positionCalculator = positionCalculator;
    console.log('📱 MainWindowFactory initialized');
  }

  /**
   * Creates a new main window with cursor-aware positioning
   * @param {Object} options - Additional window options
   * @returns {BrowserWindow} The created main window
   */
  async createWindow(options = {}) {
    console.log('📱 Creating main window...');
    
    // Get cursor position and target display
    const cursorPosition = screen.getCursorScreenPoint();
    const targetDisplay = this.getDisplayAtCursor(cursorPosition);
    
    console.log(`🖱️ Cursor at: ${cursorPosition.x}, ${cursorPosition.y}`);
    console.log(`📺 Target display: ${targetDisplay.id} (${targetDisplay.bounds.width}x${targetDisplay.bounds.height})`);
    
    // Get stored position preference and theme
    const storedPosition = this.settingsService.getWindowPosition();
    const currentTheme = this.settingsService.getTheme();
    
    console.log('📍 Using stored position:', storedPosition);
    console.log('🎨 Using theme:', currentTheme);
    
    // Calculate window bounds
    const initialBounds = await this.calculateWindowBounds(storedPosition, targetDisplay, cursorPosition);
    
    if (!initialBounds) {
      throw new Error('Failed to calculate valid window bounds');
    }

    // Create window configuration
    const windowConfig = this.createWindowConfiguration(storedPosition, currentTheme, initialBounds, options);
    
    // Create the window
    const mainWindow = new BrowserWindow(windowConfig);

    // Set up event handlers
    this.setupMainWindowEventHandlers(mainWindow, storedPosition);

    // Load the main HTML file
    await mainWindow.loadFile('renderer/index.html');

    return mainWindow;
  }

  /**
   * Creates the window configuration object
   * @param {string} position - Window position mode
   * @param {string} theme - Current theme
   * @param {Object} bounds - Window bounds
   * @param {Object} additionalOptions - Additional options
   * @returns {Object} Complete window configuration
   */
  createWindowConfiguration(position, theme, bounds, additionalOptions = {}) {
    const backgroundColor = theme === 'dark' ? '#282828' : '#ffffff';
    
    // Base configuration
    const baseConfig = {
      ...bounds,
      show: false, // Prevent flash
      resizable: position === 'window',
      movable: position === 'window',
      minimizable: position === 'window',
      maximizable: position === 'window',
      fullscreenable: false,
      closable: false,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
        paintWhenInitiallyHidden: false,
        backgroundThrottling: false
      },
      frame: false,
      transparent: false,
      backgroundColor: backgroundColor,
      alwaysOnTop: true,
      skipTaskbar: true,
      level: 'screen-saver',
      visibleOnAllWorkspaces: false,
      focusable: true
    };

    // Add platform-specific options
    if (process.platform === 'darwin') {
      baseConfig.vibrancy = 'sidebar';
      baseConfig.titleBarStyle = 'hidden';
      baseConfig.trafficLightPosition = { x: -100, y: -100 }; // Hide traffic lights
    }

    // Merge with additional options
    return { ...baseConfig, ...additionalOptions };
  }

  /**
   * Calculates window bounds based on position mode and cursor location
   * @param {string} position - Position mode
   * @param {Object} display - Target display
   * @param {Object} cursorPosition - Current cursor position
   * @returns {Object|null} Window bounds or null if calculation fails
   */
  async calculateWindowBounds(position, display, cursorPosition) {
    if (!this.positionCalculator) {
      console.error('❌ Position calculator not available');
      return this.getFallbackBounds(display);
    }

    try {
      return await this.positionCalculator.calculateBounds(position, display, cursorPosition);
    } catch (error) {
      console.error('❌ Error calculating bounds:', error);
      return this.getFallbackBounds(display);
    }
  }

  /**
   * Gets fallback bounds if calculation fails
   * @param {Object} display - Target display
   * @returns {Object} Fallback window bounds
   */
  getFallbackBounds(display) {
    const { x: screenX, y: screenY, width: screenWidth, height: screenHeight } = display.bounds;
    
    return {
      x: Math.round(screenX + (screenWidth - 400) / 2),
      y: Math.round(screenY + (screenHeight - 600) / 2),
      width: 400,
      height: 600
    };
  }

  /**
   * Gets the display at the current cursor position
   * @param {Object} cursorPosition - Cursor coordinates
   * @returns {Object} Display object
   */
  getDisplayAtCursor(cursorPosition) {
    const displays = screen.getAllDisplays();
    
    const targetDisplay = displays.find(display => {
      const { x, y, width, height } = display.bounds;
      return cursorPosition.x >= x && 
             cursorPosition.x < x + width && 
             cursorPosition.y >= y && 
             cursorPosition.y < y + height;
    });
    
    return targetDisplay || screen.getPrimaryDisplay();
  }

  /**
   * Sets up event handlers for the main window
   * @param {BrowserWindow} mainWindow - The main window
   * @param {string} position - Window position mode
   */
  setupMainWindowEventHandlers(mainWindow, position) {
    // Ready to show event
    mainWindow.once('ready-to-show', () => {
      console.log('✅ Main window ready');
      this.configureWindowBehavior(mainWindow, position);
      this.hideTrafficLightButtons(mainWindow);
    });

    // Close event - hide instead of close
    mainWindow.on('close', (event) => {
      const { app } = require('electron');
      if (!app.isQuiting) {
        event.preventDefault();
        mainWindow.hide();
        console.log('🙈 Main window hidden');
      } else {
        console.log('💀 Main window closing - app is quitting');
      }
    });

    // Show event
    mainWindow.on('show', () => {
      console.log('👁️ Main window shown');
      this.onWindowShow(mainWindow);
    });

    // Blur event - hide when focus is lost
    mainWindow.on('blur', () => {
      setTimeout(() => {
        if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.isFocused()) {
          console.log('😴 Main window lost focus, hiding...');
          mainWindow.hide();
        }
      }, 100);
    });

    // Error handling
    mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
      console.error('❌ Main window failed to load:', errorCode, errorDescription);
    });

    mainWindow.webContents.on('did-finish-load', () => {
      console.log('✅ Main window finished loading');
    });
  }

  /**
   * Configures window behavior based on position
   * @param {BrowserWindow} mainWindow - The main window
   * @param {string} position - Window position mode
   */
  configureWindowBehavior(mainWindow, position) {
    if (process.platform === 'darwin') {
      try {
        mainWindow.setVisibleOnAllWorkspaces(false);
        
        if (typeof mainWindow.setCollectionBehavior === 'function') {
          mainWindow.setCollectionBehavior([
            'moveToActiveSpace',
            'managed',
            'participatesInCycle'
          ]);
        }
        
        console.log('✅ macOS window behavior configured');
      } catch (error) {
        console.error('❌ Error configuring window behavior:', error);
      }
    }

    // Set appropriate window level based on position
    if (position === 'bottom') {
      // Bottom positioning may need special handling for dock
      this.configureBottomPosition(mainWindow);
    } else {
      mainWindow.setAlwaysOnTop(true, 'screen-saver');
    }
  }

  /**
   * Configures bottom positioning (may need dock management)
   * @param {BrowserWindow} mainWindow - The main window
   */
  configureBottomPosition(mainWindow) {
    console.log('🔧 Configuring bottom position');
    
    // Try native positioning first if available
    if (this.hasNativeWindowManager()) {
      setTimeout(() => {
        this.applyNativeBottomPosition(mainWindow);
      }, 100);
    } else {
      // Fallback to high window level
      mainWindow.setAlwaysOnTop(true, 'pop-up-menu');
    }
  }

  /**
   * Checks if native window manager is available
   * @returns {boolean} True if native manager is available
   */
  hasNativeWindowManager() {
    try {
      const nativeManager = require('../../../build/Release/macos_window_manager.node');
      return !!nativeManager;
    } catch (error) {
      return false;
    }
  }

  /**
   * Applies native bottom positioning
   * @param {BrowserWindow} mainWindow - The main window
   */
  applyNativeBottomPosition(mainWindow) {
    try {
      const nativeManager = require('../../../build/Release/macos_window_manager.node');
      const bounds = mainWindow.getBounds();
      const windowId = mainWindow.getNativeWindowHandle().readInt32LE(0);
      
      const success = nativeManager.forceWindowOverDock(
        windowId, bounds.x, bounds.y, bounds.width, bounds.height
      );
      
      if (success) {
        console.log('✅ Native bottom positioning applied');
      } else {
        console.log('❌ Native positioning failed, using fallback');
        mainWindow.setAlwaysOnTop(true, 'pop-up-menu');
      }
    } catch (error) {
      console.error('❌ Error with native positioning:', error);
      mainWindow.setAlwaysOnTop(true, 'pop-up-menu');
    }
  }

  /**
   * Handles window show event
   * @param {BrowserWindow} mainWindow - The main window
   */
  onWindowShow(mainWindow) {
    if (process.platform === 'darwin') {
      mainWindow.moveTop();
    }
    
    // Send events to renderer
    mainWindow.webContents.send('window-shown');
    
    // Apply current theme
    if (this.settingsService) {
      const currentTheme = this.settingsService.getTheme();
      mainWindow.webContents.send('theme-changed', currentTheme);
    }
  }

  /**
   * Hides traffic light buttons on macOS
   * @param {BrowserWindow} mainWindow - The main window
   */
  hideTrafficLightButtons(mainWindow) {
    try {
      if (process.platform === 'darwin') {
        mainWindow.setWindowButtonVisibility(false);
      }
    } catch (error) {
      console.log('Could not hide window buttons:', error.message);
    }
  }

  /**
   * Validates window bounds
   * @param {Object} bounds - Window bounds to validate
   * @returns {boolean} True if bounds are valid
   */
  isValidBounds(bounds) {
    return (
      typeof bounds.x === 'number' && !isNaN(bounds.x) && isFinite(bounds.x) &&
      typeof bounds.y === 'number' && !isNaN(bounds.y) && isFinite(bounds.y) &&
      typeof bounds.width === 'number' && !isNaN(bounds.width) && isFinite(bounds.width) && bounds.width > 0 &&
      typeof bounds.height === 'number' && !isNaN(bounds.height) && isFinite(bounds.height) && bounds.height > 0
    );
  }

  /**
   * Creates a main window optimized for performance
   * @param {Object} options - Additional options
   * @returns {BrowserWindow} Optimized main window
   */
  async createOptimizedWindow(options = {}) {
    const optimizedOptions = {
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
        paintWhenInitiallyHidden: false,
        backgroundThrottling: false,
        enableBlinkFeatures: 'OverlayScrollbars', // Better scrollbars
        disableBlinkFeatures: 'Auxclick' // Disable middle-click features we don't need
      },
      ...options
    };

    return this.createWindow(optimizedOptions);
  }

  /**
   * Cleanup method
   */
  cleanup() {
    console.log('🧹 MainWindowFactory cleanup...');
    // No specific cleanup needed currently
  }
}

module.exports = MainWindowFactory;