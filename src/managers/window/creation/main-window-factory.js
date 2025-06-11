const { BrowserWindow } = require('electron');

class MainWindowFactory {
  constructor(settingsService, positionCalculator, displayDetector, cursorTracker) {
    this.settingsService = settingsService;
    this.positionCalculator = positionCalculator;
    this.displayDetector = displayDetector;
    this.cursorTracker = cursorTracker;
    
    console.log('📱 Main Window Factory initialized');
  }

  /**
   * Create the main clipboard window
   */
  createMainWindow() {
    console.log('📱 Creating main window...');
    
    // Get cursor position to determine which display to use
    const cursorPosition = this.cursorTracker.getCurrentCursorPosition();
    const targetDisplay = this.cursorTracker.getDisplayAtCursor(cursorPosition);
    
    console.log(`🖱️ Cursor at: ${cursorPosition.x}, ${cursorPosition.y}`);
    console.log(`📺 Target display: ${targetDisplay.id} (${targetDisplay.bounds.width}x${targetDisplay.bounds.height})`);
    
    // Get stored position preference
    const storedPosition = this.settingsService.getWindowPosition();
    console.log('📍 Using stored position:', storedPosition);
    
    // Get current theme to set correct background - prevents flash
    const currentTheme = this.settingsService.getTheme();
    const backgroundColor = currentTheme === 'dark' ? '#282828' : '#ffffff';
    
    console.log('🎨 Setting background color:', backgroundColor, 'for theme:', currentTheme);
    
    // Calculate initial bounds based on cursor location
    const initialBounds = this.positionCalculator.calculateCursorAwareBounds(
      storedPosition, 
      targetDisplay, 
      cursorPosition
    );
    
    if (!initialBounds) {
      console.error('❌ Failed to calculate initial bounds');
      // Use fallback bounds
      const fallbackBounds = this.positionCalculator.createFallbackBounds(targetDisplay);
      if (!fallbackBounds) {
        throw new Error('Failed to create window bounds');
      }
      Object.assign(initialBounds, fallbackBounds);
    }
    
    // Create the BrowserWindow
    const mainWindow = new BrowserWindow({
      ...initialBounds,
      show: false,
      resizable: storedPosition === 'window',
      movable: storedPosition === 'window',
      minimizable: storedPosition === 'window',
      maximizable: storedPosition === 'window',
      fullscreenable: false,
      closable: false,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false
      },
      frame: false,
      transparent: false, // Important: Set to false so backgroundColor works
      backgroundColor: backgroundColor, // This prevents the flash
      vibrancy: 'sidebar',
      alwaysOnTop: true,
      skipTaskbar: true,
      level: 'screen-saver',
      visibleOnAllWorkspaces: false,
      focusable: true
    });

    console.log('📄 Loading index.html...');
    mainWindow.loadFile('renderer/index.html');
    
    console.log('✅ Main window created with bounds:', initialBounds);
    
    return {
      window: mainWindow,
      bounds: initialBounds,
      display: targetDisplay,
      position: storedPosition
    };
  }

  /**
   * Configure window for specific position mode
   */
  configureWindowForPosition(window, position) {
    console.log('🔧 Configuring window for position:', position);
    
    if (position !== 'window' && position !== 'cursor') {
      // Fixed positioning modes
      window.setResizable(false);
      window.setMovable(false);
      window.setMinimizable(false);
      window.setMaximizable(false);
    } else {
      // Free window modes
      window.setResizable(true);
      window.setMovable(true);
      window.setMinimizable(true);
      window.setMaximizable(true);
    }
    
    this.hideTrafficLightButtons(window);
  }

  /**
   * Apply macOS-specific window properties
   */
  configureMacOSWindow(window) {
    if (process.platform !== 'darwin') {
      return;
    }

    try {
      // Configure space management
      window.setVisibleOnAllWorkspaces(false);
      
      // Set collection behavior for proper space handling
      window.setCollectionBehavior([
        'moveToActiveSpace',
        'managed',
        'participatesInCycle'
      ]);
      
      console.log('✅ macOS window configuration applied');
    } catch (error) {
      console.error('❌ Error configuring macOS window:', error);
    }
  }

  /**
   * Hide window traffic light buttons on macOS
   */
  hideTrafficLightButtons(window) {
    try {
      if (process.platform === 'darwin') {
        window.setWindowButtonVisibility(false);
        console.log('✅ Traffic light buttons hidden');
      }
    } catch (error) {
      console.log('⚠️ Could not hide window buttons:', error.message);
    }
  }

  /**
   * Calculate window bounds for repositioning
   */
  calculateRepositionBounds(position, targetDisplay, cursorPosition) {
    const bounds = this.positionCalculator.calculateCursorAwareBounds(
      position,
      targetDisplay,
      cursorPosition
    );
    
    if (!bounds) {
      console.error('❌ Failed to calculate reposition bounds');
      return this.positionCalculator.createFallbackBounds(targetDisplay);
    }
    
    // Ensure bounds are constrained to display
    return this.positionCalculator.constrainBoundsToDisplay(bounds, targetDisplay);
  }

  /**
   * Prepare window for showing (handle desktop switching)
   */
  prepareWindowForShow(window, recreate = false) {
    if (process.platform === 'darwin' && recreate) {
      // For macOS desktop switching, we'll handle this in the window manager
      // This method can be used for future enhancements
      console.log('📱 Preparing window for show on macOS');
    }
    
    return window;
  }

  /**
   * Create window with specific configuration
   */
  createConfiguredWindow(config) {
    const {
      bounds,
      position,
      theme,
      display,
      options = {}
    } = config;
    
    const backgroundColor = theme === 'dark' ? '#282828' : '#ffffff';
    
    const windowOptions = {
      ...bounds,
      show: false,
      resizable: position === 'window',
      movable: position === 'window',
      minimizable: position === 'window',
      maximizable: position === 'window',
      fullscreenable: false,
      closable: false,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false
      },
      frame: false,
      transparent: false,
      backgroundColor,
      vibrancy: 'sidebar',
      alwaysOnTop: true,
      skipTaskbar: true,
      level: 'screen-saver',
      visibleOnAllWorkspaces: false,
      focusable: true,
      ...options // Allow override of any option
    };
    
    const window = new BrowserWindow(windowOptions);
    
    // Apply macOS-specific configuration
    this.configureMacOSWindow(window);
    
    // Configure for position
    this.configureWindowForPosition(window, position);
    
    return {
      window,
      bounds,
      display,
      position,
      theme
    };
  }

  /**
   * Validate window configuration before creation
   */
  validateWindowConfig(config) {
    const { bounds, position, theme, display } = config;
    
    // Validate bounds
    if (!bounds || !this.positionCalculator.isValidBounds(bounds)) {
      console.error('❌ Invalid bounds in window config:', bounds);
      return false;
    }
    
    // Validate position
    const validPositions = ['cursor', 'cursor-edge', 'left', 'right', 'top', 'bottom', 'window'];
    if (!position || !validPositions.includes(position)) {
      console.error('❌ Invalid position in window config:', position);
      return false;
    }
    
    // Validate theme
    if (!theme || !['light', 'dark'].includes(theme)) {
      console.error('❌ Invalid theme in window config:', theme);
      return false;
    }
    
    // Validate display
    if (!display || !display.bounds) {
      console.error('❌ Invalid display in window config:', display);
      return false;
    }
    
    return true;
  }

  /**
   * Get default window configuration
   */
  getDefaultWindowConfig() {
    const primaryDisplay = this.displayDetector.getPrimaryDisplay();
    const cursorPosition = this.cursorTracker.getCurrentCursorPosition();
    const defaultPosition = 'cursor';
    const defaultTheme = this.settingsService.getTheme();
    
    const bounds = this.positionCalculator.calculateCursorAwareBounds(
      defaultPosition,
      primaryDisplay,
      cursorPosition
    ) || this.positionCalculator.createFallbackBounds(primaryDisplay);
    
    return {
      bounds,
      position: defaultPosition,
      theme: defaultTheme,
      display: primaryDisplay
    };
  }

  /**
   * Create window with automatic configuration
   */
  createAutoConfiguredWindow() {
    const config = this.getDefaultWindowConfig();
    
    if (!this.validateWindowConfig(config)) {
      throw new Error('Failed to create valid window configuration');
    }
    
    const result = this.createConfiguredWindow(config);
    
    // Load the main HTML file
    result.window.loadFile('renderer/index.html');
    
    console.log('✅ Auto-configured window created');
    return result;
  }

  /**
   * Clone window configuration from existing window
   */
  cloneWindowConfig(existingWindow) {
    if (!existingWindow || existingWindow.isDestroyed()) {
      return this.getDefaultWindowConfig();
    }
    
    const bounds = existingWindow.getBounds();
    const currentTheme = this.settingsService.getTheme();
    const currentPosition = this.settingsService.getWindowPosition();
    const cursorPosition = this.cursorTracker.getCurrentCursorPosition();
    const display = this.cursorTracker.getDisplayAtCursor(cursorPosition);
    
    return {
      bounds,
      position: currentPosition,
      theme: currentTheme,
      display
    };
  }

  /**
   * Update window configuration
   */
  updateWindowConfig(window, newConfig) {
    if (!window || window.isDestroyed()) {
      console.error('❌ Cannot update destroyed window');
      return false;
    }
    
    if (!this.validateWindowConfig(newConfig)) {
      console.error('❌ Invalid configuration for window update');
      return false;
    }
    
    const { bounds, position, theme } = newConfig;
    
    try {
      // Update bounds
      window.setBounds(bounds);
      
      // Update position-specific configuration
      this.configureWindowForPosition(window, position);
      
      // Update theme by sending to renderer
      if (window.webContents) {
        window.webContents.send('theme-changed', theme);
      }
      
      console.log('✅ Window configuration updated');
      return true;
      
    } catch (error) {
      console.error('❌ Error updating window configuration:', error);
      return false;
    }
  }

  /**
   * Get window creation statistics for debugging
   */
  getCreationStats() {
    return {
      factoryInitialized: true,
      hasPositionCalculator: !!this.positionCalculator,
      hasDisplayDetector: !!this.displayDetector,
      hasCursorTracker: !!this.cursorTracker,
      hasSettingsService: !!this.settingsService,
      platform: process.platform,
      supportedPositions: ['cursor', 'cursor-edge', 'left', 'right', 'top', 'bottom', 'window'],
      defaultTheme: this.settingsService?.getTheme() || 'light'
    };
  }

  /**
   * Test window creation without actually creating window
   */
  testWindowCreation() {
    try {
      const config = this.getDefaultWindowConfig();
      const isValid = this.validateWindowConfig(config);
      
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
   * Create window for specific display
   */
  createWindowForDisplay(displayId, position = null) {
    const display = this.displayDetector.getDisplayById(displayId);
    if (!display) {
      console.error('❌ Display not found:', displayId);
      return null;
    }
    
    const currentPosition = position || this.settingsService.getWindowPosition();
    const currentTheme = this.settingsService.getTheme();
    
    // Use center of display as cursor position for calculation
    const centerPosition = {
      x: display.bounds.x + display.bounds.width / 2,
      y: display.bounds.y + display.bounds.height / 2
    };
    
    const bounds = this.positionCalculator.calculateCursorAwareBounds(
      currentPosition,
      display,
      centerPosition
    );
    
    if (!bounds) {
      console.error('❌ Failed to calculate bounds for display');
      return null;
    }
    
    const config = {
      bounds,
      position: currentPosition,
      theme: currentTheme,
      display
    };
    
    const result = this.createConfiguredWindow(config);
    result.window.loadFile('renderer/index.html');
    
    console.log(`✅ Window created for display ${displayId}`);
    return result;
  }

  /**
   * Clean up factory resources
   */
  destroy() {
    console.log('📱 Destroying main window factory...');
    
    // Clear references
    this.settingsService = null;
    this.positionCalculator = null;
    this.displayDetector = null;
    this.cursorTracker = null;
    
    console.log('✅ Main window factory destroyed');
  }
}

module.exports = MainWindowFactory;