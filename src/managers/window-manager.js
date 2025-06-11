// Import all the new modular components
const PositionCalculator = require('./window/positioning/position-calculator');
const CursorTracker = require('./window/positioning/cursor-tracker');
const DisplayDetector = require('./window/positioning/display-detector');
const LayoutModes = require('./window/positioning/layout-modes');

const MainWindowFactory = require('./window/creation/main-window-factory');
const SettingsWindowFactory = require('./window/creation/settings-window-factory');
const WindowConfig = require('./window/creation/window-config');

const MainWindowEvents = require('./window/events/main-window-events');
const SettingsWindowEvents = require('./window/events/settings-window-events');
const WindowLifecycle = require('./window/events/window-lifecycle');

const WindowNativeBridge = require('./window/native/window-native-bridge');
const PlatformWindowUtils = require('./window/native/platform-window-utils');

class WindowManager {
  constructor(settingsService, dockService) {
    this.settingsService = settingsService;
    this.dockService = dockService;
    
    // Window instances
    this.mainWindow = null;
    this.settingsWindow = null;
    this.currentDisplay = null;
    
    // Initialize all modular components
    this.initializeComponents();
    
    console.log('🪟 Window Manager initialized (modular)');
  }

  /**
   * Initialize all modular components with dependency injection
   */
  initializeComponents() {
    console.log('🔧 Initializing window manager components...');
    
    // Positioning components
    this.positionCalculator = new PositionCalculator();
    this.cursorTracker = new CursorTracker();
    this.displayDetector = new DisplayDetector();
    this.layoutModes = new LayoutModes();
    
    // Creation components
    this.mainWindowFactory = new MainWindowFactory(
      this.settingsService,
      this.positionCalculator,
      this.displayDetector,
      this.cursorTracker
    );
    this.settingsWindowFactory = new SettingsWindowFactory(
      this.settingsService,
      this.displayDetector
    );
    this.windowConfig = new WindowConfig();
    
    // Event handling components (will be initialized when windows are created)
    this.mainWindowEvents = new MainWindowEvents(this.settingsService, this.dockService);
    this.settingsWindowEvents = new SettingsWindowEvents();
    this.windowLifecycle = new WindowLifecycle();
    
    // Native integration components
    this.nativeBridge = new WindowNativeBridge();
    this.platformUtils = new PlatformWindowUtils();
    
    console.log('✅ All window manager components initialized');
  }

  /**
   * Create main window - delegated to factory
   */
  createMainWindow() {
    console.log('📱 Creating main window via factory...');
    
    try {
      const result = this.mainWindowFactory.createMainWindow();
      
      this.mainWindow = result.window;
      this.currentDisplay = result.display;
      
      // Setup event handling
      this.mainWindowEvents.setupEventHandlers(this.mainWindow, this);
      this.windowLifecycle.registerWindow(this.mainWindow, 'main');
      
      // Apply native positioning if needed
      this.nativeBridge.configureForPosition(this.mainWindow, result.position, result.display);
      
      console.log('✅ Main window created successfully');
      return this.mainWindow;
      
    } catch (error) {
      console.error('❌ Failed to create main window:', error);
      throw error;
    }
  }

  /**
   * Create settings window - delegated to factory
   */
  createSettingsWindow() {
    console.log('⚙️ Creating settings window via factory...');
    
    if (this.settingsWindow && !this.settingsWindow.isDestroyed()) {
      console.log('⚙️ Settings window already exists, focusing...');
      this.settingsWindow.show();
      this.settingsWindow.focus();
      return this.settingsWindow;
    }

    try {
      const result = this.settingsWindowFactory.createSettingsWindow(this.currentDisplay);
      
      this.settingsWindow = result.window;
      
      // Setup event handling
      this.settingsWindowEvents.setupEventHandlers(this.settingsWindow, this);
      this.windowLifecycle.registerWindow(this.settingsWindow, 'settings');
      
      console.log('✅ Settings window created successfully');
      return this.settingsWindow;
      
    } catch (error) {
      console.error('❌ Failed to create settings window:', error);
      throw error;
    }
  }

  /**
   * Show main window with cursor-aware positioning
   */
  showMainWindow() {
    console.log('👁️ Showing main window...');
    
    if (this.mainWindow) {
      // For macOS desktop switching, recreate window
      if (this.platformUtils.shouldRecreateForDesktopSwitch()) {
        this.recreateMainWindow();
      } else {
        this.repositionToCursor();
        this.mainWindow.show();
        this.mainWindow.focus();
      }
    } else {
      this.createMainWindow();
      this.showMainWindow();
    }
  }

  /**
   * Hide main window
   */
  hideMainWindow() {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.hide();
    }
  }

  /**
   * Toggle main window visibility
   */
  toggleMainWindow() {
    if (this.mainWindow && !this.mainWindow.isDestroyed() && this.mainWindow.isVisible()) {
      this.hideMainWindow();
    } else {
      this.showMainWindow();
    }
  }

  /**
   * Reposition window to current cursor location
   */
  repositionToCursor() {
    if (!this.mainWindow || this.mainWindow.isDestroyed()) {
      return;
    }

    console.log('🖱️ Repositioning window to cursor location...');
    
    try {
      const cursorPosition = this.cursorTracker.getCurrentCursorPosition();
      const targetDisplay = this.cursorTracker.getDisplayAtCursor(cursorPosition);
      const currentPosition = this.settingsService.getWindowPosition();
      
      // Check if we've moved to a different display
      if (!this.currentDisplay || this.currentDisplay.id !== targetDisplay.id) {
        console.log(`📺 Switched to display: ${targetDisplay.id}`);
        this.currentDisplay = targetDisplay;
      }
      
      const newBounds = this.positionCalculator.calculateCursorAwareBounds(
        currentPosition, 
        targetDisplay, 
        cursorPosition
      );
      
      if (this.positionCalculator.isValidBounds(newBounds)) {
        console.log(`📍 Moving window to: ${newBounds.width}x${newBounds.height} at (${newBounds.x}, ${newBounds.y})`);
        
        this.mainWindow.setBounds(newBounds);
        this.applyDisplaySpecificPositioning(currentPosition, targetDisplay);
      } else {
        console.error('❌ Invalid bounds calculated, using fallback');
        this.fallbackToCenter(targetDisplay);
      }
    } catch (error) {
      console.error('❌ Error repositioning to cursor:', error);
      const primaryDisplay = this.displayDetector.getPrimaryDisplay();
      this.fallbackToCenter(primaryDisplay);
    }
  }

  /**
   * Apply window position - delegated to position calculator
   */
  applyWindowPosition(position) {
    console.log('📍 Applying window position:', position);
    
    if (!this.mainWindow || this.mainWindow.isDestroyed()) {
      console.error('❌ No main window to position');
      return;
    }
    
    try {
      const cursorPosition = this.cursorTracker.getCurrentCursorPosition();
      const targetDisplay = this.cursorTracker.getDisplayAtCursor(cursorPosition);
      
      const newBounds = this.positionCalculator.calculateCursorAwareBounds(
        position, 
        targetDisplay, 
        cursorPosition
      );
      
      if (!newBounds) {
        console.error('❌ Failed to calculate bounds');
        this.fallbackToCenter(targetDisplay);
        return;
      }
      
      this.mainWindow.setBounds(newBounds);
      this.currentDisplay = targetDisplay;
      
      // Configure window for position mode
      this.mainWindowFactory.configureWindowForPosition(this.mainWindow, position);
      this.applyDisplaySpecificPositioning(position, targetDisplay);
      
      console.log('✅ Window position applied successfully');
      
    } catch (error) {
      console.error('❌ Error applying window position:', error);
    }
  }

  /**
   * Apply display-specific positioning logic
   */
  applyDisplaySpecificPositioning(position, display) {
    if (position === 'bottom') {
      this.nativeBridge.applyBottomPositioning(this.mainWindow, display, this.dockService);
    } else {
      // For non-bottom positions, restore dock and use normal window level
      this.dockService.setDockVisibility(true);
      this.mainWindow.setAlwaysOnTop(true, 'screen-saver');
    }
  }

  /**
   * Recreate main window for desktop switching
   */
  recreateMainWindow() {
    console.log('🔄 Recreating main window for desktop switch...');
    
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.destroy();
    }
    this.mainWindow = null;
    
    // Create new window
    this.createMainWindow();
    
    // Show with fade-in effect
    this.mainWindow.once('ready-to-show', () => {
      this.mainWindow.setOpacity(0);
      this.mainWindow.show();
      
      setTimeout(() => {
        let opacity = 0;
        const fadeIn = setInterval(() => {
          opacity += 0.2;
          if (opacity >= 1) {
            opacity = 1;
            clearInterval(fadeIn);
          }
          this.mainWindow.setOpacity(opacity);
        }, 20);
        
        this.mainWindow.focus();
      }, 400);
    });
  }

  /**
   * Fallback positioning
   */
  fallbackToCenter(display) {
    const fallbackBounds = this.positionCalculator.createFallbackBounds(display);
    if (fallbackBounds && this.mainWindow) {
      this.mainWindow.setBounds(fallbackBounds);
      console.log('✅ Fallback positioning applied');
    }
  }

  /**
   * Close settings window
   */
  closeSettingsWindow() {
    if (this.settingsWindow && !this.settingsWindow.isDestroyed()) {
      this.settingsWindow.close();
    }
  }

  /**
   * Get display information - delegated to display detector
   */
  getDisplayInfo() {
    const displays = this.displayDetector.getAllDisplays();
    const cursor = this.cursorTracker.getCurrentCursorPosition();
    
    return {
      cursor,
      primary: this.displayDetector.getPrimaryDisplay()?.id,
      current: this.currentDisplay?.id,
      displays
    };
  }

  // Getter methods
  getMainWindow() {
    return this.mainWindow;
  }

  getSettingsWindow() {
    return this.settingsWindow;
  }

  // Utility methods for sending events
  sendToMainWindow(event, data) {
    if (this.mainWindow && this.mainWindow.webContents) {
      this.mainWindow.webContents.send(event, data);
    }
  }

  sendToSettingsWindow(event, data) {
    if (this.settingsWindow && this.settingsWindow.webContents) {
      this.settingsWindow.webContents.send(event, data);
    }
  }

  sendToAllWindows(event, data) {
    this.sendToMainWindow(event, data);
    this.sendToSettingsWindow(event, data);
  }

  /**
   * Clean up all resources
   */
  destroy() {
    console.log('🪟 Destroying window manager...');
    
    // Destroy all components
    this.positionCalculator = null;
    this.cursorTracker?.destroy();
    this.displayDetector?.destroy();
    this.layoutModes?.destroy();
    
    this.mainWindowFactory?.destroy();
    this.settingsWindowFactory?.destroy();
    this.windowConfig?.destroy();
    
    this.mainWindowEvents?.destroy();
    this.settingsWindowEvents?.destroy();
    this.windowLifecycle?.destroy();
    
    this.nativeBridge?.destroy();
    this.platformUtils?.destroy();
    
    // Clear window references
    this.mainWindow = null;
    this.settingsWindow = null;
    this.currentDisplay = null;
    
    console.log('✅ Window manager destroyed');
  }
}

module.exports = WindowManager;t