// Enhanced src/managers/window-manager.js with smooth animations and flash prevention

const { BrowserWindow, screen } = require('electron');
const path = require('path');

/**
 * WindowManager - Enhanced with smooth animations and flash prevention
 * Implements best practices from the Electron animation guide
 */
class WindowManager {
  constructor(settingsService, dockService) {
    this.settingsService = settingsService;
    this.dockService = dockService;
    this.mainWindow = null;
    this.settingsWindow = null;
    this.nativeWindowManager = null;
    this.currentDisplay = null;
    this.originalDockState = null;
    this.dockWasHiddenByUs = false;
    this.isAnimating = false;
    this.windowPool = [];
    
    // Performance monitoring
    this.performanceMonitor = new PerformanceMonitor();
    
    // Try to load native window manager
    try {
      this.nativeWindowManager = require('../build/Release/macos_window_manager.node');
      console.log('✅ Native macOS window manager loaded');
    } catch (error) {
      console.log('⚠️ Native window manager not available:', error.message);
    }
  }

  async createMainWindow() {
    console.log('📱 Creating main window with smooth animations...');
    
    // Store original dock state
    await this.storeOriginalDockState();
    
    // Get cursor position to determine which display to use
    const cursorPosition = screen.getCursorScreenPoint();
    const targetDisplay = this.getDisplayAtCursor(cursorPosition);
    
    console.log(`🖱️ Cursor at: ${cursorPosition.x}, ${cursorPosition.y}`);
    console.log(`📺 Target display: ${targetDisplay.id} (${targetDisplay.bounds.width}x${targetDisplay.bounds.height})`);
    
    this.currentDisplay = targetDisplay;
    
    // Get stored position preference
    const storedPosition = this.settingsService.getWindowPosition();
    console.log('📍 Using stored position:', storedPosition);
    
    // Get current theme to set correct background
    const currentTheme = this.settingsService.getTheme();
    const backgroundColor = currentTheme === 'dark' ? '#1e1e1e' : '#ffffff';
    
    console.log('🎨 Setting background color:', backgroundColor, 'for theme:', currentTheme);
    
    // Calculate initial bounds based on cursor location and dock position
    const initialBounds = await this.calculateDockAwareBounds(storedPosition, targetDisplay, cursorPosition);
    
    // Create window with optimized settings for smooth animations
    const windowOptions = {
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
        contextIsolation: false,
        paintWhenInitiallyHidden: false,
        backgroundThrottling: false
      },
      frame: false,
      transparent: false,
      backgroundColor: backgroundColor,
      vibrancy: process.platform === 'darwin' ? 'sidebar' : undefined,
      alwaysOnTop: true,
      skipTaskbar: true,
      level: 'screen-saver',
      visibleOnAllWorkspaces: false,  // Start as false
      focusable: true
    };

    // For macOS, add these specific options
    if (process.platform === 'darwin') {
      windowOptions.titleBarStyle = 'hidden';
      windowOptions.trafficLightPosition = { x: -100, y: -100 }; // Hide traffic lights
    }

    this.mainWindow = new BrowserWindow(windowOptions);

    // Configure performance optimizations
    this.configurePerformanceOptimizations();

    console.log('📄 Loading index.html...');
    await this.mainWindow.loadFile('renderer/index.html');

    this.setupMainWindowEventHandlers();
    
    return this.mainWindow;
  }

  configurePerformanceOptimizations() {
    if (process.platform === 'darwin') {
      // Enable GPU acceleration
      this.mainWindow.webContents.executeJavaScript(`
        // Force GPU layer creation for smooth animations
        document.documentElement.style.transform = 'translateZ(0)';
        document.documentElement.style.willChange = 'transform';
      `);
    }
  }

  async storeOriginalDockState() {
    try {
      const dockInfo = await this.dockService.getDockInfo();
      this.originalDockState = {
        hidden: dockInfo.hidden,
        position: dockInfo.position,
        size: dockInfo.size
      };
      console.log('💾 Stored original dock state:', this.originalDockState);
    } catch (error) {
      console.log('⚠️ Could not detect dock state, using defaults:', error.message);
      this.originalDockState = { hidden: false, position: 'bottom', size: 64 };
    }
  }

  async calculateDockAwareBounds(position, display, cursorPosition) {
    if (!display || !display.bounds) {
      console.error('❌ Invalid display object');
      return null;
    }
    
    const { x: screenX, y: screenY, width: screenWidth, height: screenHeight } = display.bounds;
    
    let availableSpace = {
      x: screenX,
      y: screenY,
      width: screenWidth,
      height: screenHeight
    };
    
    console.log(`📐 Using full screen space (covering dock): ${availableSpace.width}x${availableSpace.height} at (${availableSpace.x}, ${availableSpace.y})`);
    
    const sidebarWidth = 350;
    const popupWidth = 400;
    const popupHeight = 600;
    
    let bounds = null;
    
    try {
      switch (position) {
        case 'cursor':
          bounds = this.calculateCursorProximityBounds(cursorPosition, availableSpace, popupWidth, popupHeight);
          break;
        case 'cursor-edge':
          bounds = this.calculateNearestEdgeBounds(cursorPosition, availableSpace, sidebarWidth);
          break;
        case 'left':
          bounds = {
            x: Math.round(screenX),
            y: Math.round(screenY),
            width: Math.round(sidebarWidth),
            height: Math.round(screenHeight)
          };
          break;
        case 'right':
          bounds = {
            x: Math.round(screenX + screenWidth - sidebarWidth),
            y: Math.round(screenY),
            width: Math.round(sidebarWidth),
            height: Math.round(screenHeight)
          };
          break;
        case 'top':
          bounds = {
            x: Math.round(screenX),
            y: Math.round(screenY),
            width: Math.round(screenWidth),
            height: 300
          };
          break;
        case 'bottom':
          bounds = {
            x: Math.round(screenX),
            y: Math.round(screenY + screenHeight - 300),
            width: Math.round(screenWidth),
            height: 300
          };
          break;
        case 'window':
          bounds = {
            x: Math.round(availableSpace.x + (availableSpace.width - popupWidth) / 2),
            y: Math.round(availableSpace.y + (availableSpace.height - popupHeight) / 2),
            width: Math.round(popupWidth),
            height: Math.round(popupHeight)
          };
          break;
        default:
          bounds = {
            x: Math.round(screenX),
            y: Math.round(screenY),
            width: Math.round(sidebarWidth),
            height: Math.round(screenHeight)
          };
          break;
      }
      
      if (bounds && this.isValidBounds(bounds)) {
        console.log(`✅ Calculated bounds: ${bounds.width}x${bounds.height} at (${bounds.x}, ${bounds.y})`);
        return bounds;
      } else {
        console.error('❌ Calculated bounds are invalid:', bounds);
        return null;
      }
      
    } catch (error) {
      console.error('❌ Error calculating bounds:', error);
      return null;
    }
  }

  calculateCursorProximityBounds(cursorPosition, availableSpace, windowWidth, windowHeight) {
    const margin = 20;
    
    if (!cursorPosition || typeof cursorPosition.x !== 'number' || typeof cursorPosition.y !== 'number') {
      console.warn('⚠️ Invalid cursor position, using available space center');
      cursorPosition = {
        x: availableSpace.x + availableSpace.width / 2,
        y: availableSpace.y + availableSpace.height / 2
      };
    }
    
    let x = Math.round(cursorPosition.x + margin);
    let y = Math.round(cursorPosition.y + margin);
    
    if (x + windowWidth > availableSpace.x + availableSpace.width) {
      x = Math.round(cursorPosition.x - windowWidth - margin);
    }
    
    if (y + windowHeight > availableSpace.y + availableSpace.height) {
      y = Math.round(cursorPosition.y - windowHeight - margin);
    }
    
    const padding = 10;
    x = Math.max(availableSpace.x + padding, Math.min(x, availableSpace.x + availableSpace.width - windowWidth - padding));
    y = Math.max(availableSpace.y + padding, Math.min(y, availableSpace.y + availableSpace.height - windowHeight - padding));
    
    console.log(`🎯 Cursor proximity bounds: ${windowWidth}x${windowHeight} at (${x}, ${y})`);
    
    return { x, y, width: windowWidth, height: windowHeight };
  }

  calculateNearestEdgeBounds(cursorPosition, availableSpace, sidebarWidth) {
    if (!cursorPosition || typeof cursorPosition.x !== 'number' || typeof cursorPosition.y !== 'number') {
      console.warn('⚠️ Invalid cursor position, defaulting to left edge');
      return {
        x: availableSpace.x,
        y: availableSpace.y,
        width: Math.round(sidebarWidth),
        height: Math.round(availableSpace.height)
      };
    }
    
    const distanceToLeft = Math.abs(cursorPosition.x - availableSpace.x);
    const distanceToRight = Math.abs((availableSpace.x + availableSpace.width) - cursorPosition.x);
    const distanceToTop = Math.abs(cursorPosition.y - availableSpace.y);
    const distanceToBottom = Math.abs((availableSpace.y + availableSpace.height) - cursorPosition.y);
    
    const minDistance = Math.min(distanceToLeft, distanceToRight, distanceToTop, distanceToBottom);
    
    console.log(`📏 Distances - Left: ${distanceToLeft}, Right: ${distanceToRight}, Top: ${distanceToTop}, Bottom: ${distanceToBottom}`);
    
    if (minDistance === distanceToLeft) {
      console.log('🎯 Nearest edge: LEFT');
      return {
        x: Math.round(availableSpace.x),
        y: Math.round(availableSpace.y),
        width: Math.round(sidebarWidth),
        height: Math.round(availableSpace.height)
      };
    } else if (minDistance === distanceToRight) {
      console.log('🎯 Nearest edge: RIGHT');
      return {
        x: Math.round(availableSpace.x + availableSpace.width - sidebarWidth),
        y: Math.round(availableSpace.y),
        width: Math.round(sidebarWidth),
        height: Math.round(availableSpace.height)
      };
    } else if (minDistance === distanceToTop) {
      console.log('🎯 Nearest edge: TOP');
      return {
        x: Math.round(availableSpace.x),
        y: Math.round(availableSpace.y),
        width: Math.round(availableSpace.width),
        height: 300
      };
    } else {
      console.log('🎯 Nearest edge: BOTTOM');
      return {
        x: Math.round(availableSpace.x),
        y: Math.round(availableSpace.y + availableSpace.height - 300),
        width: Math.round(availableSpace.width),
        height: 300
      };
    }
  }

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

  // --- INSTANT SHOW/HIDE METHODS ---

  async showMainWindow() {
    console.log('👁️ Showing main window instantly on current desktop...');
    
    if (process.platform === 'darwin') {
      // For macOS: Always recreate window to ensure it appears on current desktop
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.destroy();
        this.mainWindow = null;
      }
      
      // Create fresh window on current desktop
      await this.createMainWindow();
      
      // Position it correctly
      await this.repositionToCursor();
      
      // Show immediately - no animation
      this.mainWindow.show();
      this.mainWindow.focus();
      
    } else {
      // Non-macOS
      if (!this.mainWindow || this.mainWindow.isDestroyed()) {
        await this.createMainWindow();
      }
      
      await this.repositionToCursor();
      this.mainWindow.show();
      this.mainWindow.focus();
    }
    
    console.log('✅ Window shown instantly');
  }

  hideMainWindow() {
    if (!this.mainWindow || this.mainWindow.isDestroyed()) return;
    
    console.log('🙈 Hiding main window instantly...');
    
    // Restore dock if we hid it
    this.restoreDockIfHiddenByUs();
    
    // Hide immediately - no animation
    this.mainWindow.hide();
    
    console.log('✅ Window hidden instantly');
  }

  async fadeInWindow() {
    // No animation - just show
    this.mainWindow.show();
    this.mainWindow.focus();
  }

  async toggleMainWindow() {
    if (this.mainWindow && !this.mainWindow.isDestroyed() && this.mainWindow.isVisible()) {
      this.hideMainWindow();
    } else {
      await this.showMainWindow();
    }
  }

  async repositionToCursor() {
    if (!this.mainWindow) return;
    
    console.log('🖱️ Repositioning window to cursor location...');
    
    try {
      const cursorPosition = screen.getCursorScreenPoint();
      const targetDisplay = this.getDisplayAtCursor(cursorPosition);
      const currentPosition = this.settingsService.getWindowPosition();
      
      if (!this.currentDisplay || this.currentDisplay.id !== targetDisplay.id) {
        console.log(`📺 Switched to display: ${targetDisplay.id}`);
        this.currentDisplay = targetDisplay;
      }
      
      const newBounds = await this.calculateDockAwareBounds(currentPosition, targetDisplay, cursorPosition);
      
      if (this.isValidBounds(newBounds)) {
        console.log(`📍 Moving window to: ${newBounds.width}x${newBounds.height} at (${newBounds.x}, ${newBounds.y})`);
        
        if (process.platform === 'darwin') {
          this.mainWindow.setVisibleOnAllWorkspaces(false);
          this.mainWindow.setBounds(newBounds);
          await this.applyDisplaySpecificPositioning(currentPosition, targetDisplay);
        } else {
          this.mainWindow.setBounds(newBounds);
          await this.applyDisplaySpecificPositioning(currentPosition, targetDisplay);
        }
        
      } else {
        console.error('❌ Invalid bounds calculated:', newBounds);
        this.fallbackToCenter(targetDisplay);
      }
    } catch (error) {
      console.error('❌ Error repositioning to cursor:', error);
      const primaryDisplay = screen.getPrimaryDisplay();
      this.fallbackToCenter(primaryDisplay);
    }
  }

  easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  isValidBounds(bounds) {
    return (
      typeof bounds.x === 'number' && !isNaN(bounds.x) && isFinite(bounds.x) &&
      typeof bounds.y === 'number' && !isNaN(bounds.y) && isFinite(bounds.y) &&
      typeof bounds.width === 'number' && !isNaN(bounds.width) && isFinite(bounds.width) && bounds.width > 0 &&
      typeof bounds.height === 'number' && !isNaN(bounds.height) && isFinite(bounds.height) && bounds.height > 0
    );
  }

  fallbackToCenter(display) {
    console.log('🔄 Using fallback positioning for display:', display.id);
    
    const { x: screenX, y: screenY, width: screenWidth, height: screenHeight } = display.bounds;
    const fallbackBounds = {
      x: Math.round(screenX + (screenWidth - 400) / 2),
      y: Math.round(screenY + (screenHeight - 600) / 2),
      width: 400,
      height: 600
    };
    
    if (this.isValidBounds(fallbackBounds)) {
      this.mainWindow.setBounds(fallbackBounds);
      console.log('✅ Fallback positioning applied');
    } else {
      console.error('❌ Even fallback bounds are invalid:', fallbackBounds);
    }
  }

  async applyDisplaySpecificPositioning(position, display) {
    console.log('🔧 Applying display specific positioning:', position);
    
    if (position === 'cursor' || position === 'window') {
      console.log('🔧 Floating position, using normal window level');
      await this.restoreDockIfHiddenByUs();
      this.mainWindow.setAlwaysOnTop(true, 'screen-saver');
      return;
    }
    
    console.log('🏠 Edge position: will cover dock using high window level');
    
    if (this.nativeWindowManager && process.platform === 'darwin') {
      console.log('🔧 Attempting native positioning over dock');
      
      const bounds = this.mainWindow.getBounds();
      
      setTimeout(async () => {
        try {
          const windowId = this.mainWindow.getNativeWindowHandle().readInt32LE(0);
          const success = this.nativeWindowManager.forceWindowOverDock(
            windowId, bounds.x, bounds.y, bounds.width, bounds.height
          );
          
          if (success) {
            console.log('✅ Successfully positioned window over dock using native APIs');
            return;
          } else {
            console.log('❌ Native positioning failed, using high window level');
            this.mainWindow.setAlwaysOnTop(true, 'pop-up-menu');
          }
        } catch (error) {
          console.log('⚠️ Native positioning error, using high window level:', error.message);
          this.mainWindow.setAlwaysOnTop(true, 'pop-up-menu');
        }
      }, 50);
    } else {
      console.log('🔧 Using high window level to cover dock');
      this.mainWindow.setAlwaysOnTop(true, 'pop-up-menu');
    }
  }

  async restoreDockIfHiddenByUs() {
    if (this.dockWasHiddenByUs) {
      console.log('🏠 Restoring dock that we previously hid');
      
      try {
        const success = await this.dockService.setDockVisibility(true);
        if (success) {
          this.dockWasHiddenByUs = false;
          console.log('✅ Dock restored successfully');
        } else {
          console.log('⚠️ Could not restore dock');
        }
      } catch (error) {
        console.log('⚠️ Error restoring dock:', error.message);
      }
    }
  }

  async restoreOriginalDockState() {
    console.log('🔄 Restoring original dock state...');
    
    if (this.originalDockState) {
      try {
        await this.dockService.setDockVisibility(!this.originalDockState.hidden);
        this.dockWasHiddenByUs = false;
        console.log('✅ Original dock state restored');
      } catch (error) {
        console.log('⚠️ Could not restore original dock state:', error.message);
      }
    }
  }

  async applyWindowPosition(position) {
    console.log('📍 Applying window position:', position);
    
    if (!this.mainWindow) return;
    
    try {
      await this.restoreDockIfHiddenByUs();
      
      const cursorPosition = screen.getCursorScreenPoint();
      const targetDisplay = this.getDisplayAtCursor(cursorPosition);
      
      const newBounds = await this.calculateDockAwareBounds(position, targetDisplay, cursorPosition);
      
      if (!newBounds) {
        console.error('❌ Failed to calculate bounds, using fallback');
        this.fallbackToCenter(targetDisplay);
        return;
      }
      
      console.log('📍 Setting window bounds:', newBounds);
      this.mainWindow.setBounds(newBounds);
      
      this.currentDisplay = targetDisplay;
      
      if (position !== 'window' && position !== 'cursor') {
        this.mainWindow.setResizable(false);
        this.mainWindow.setMovable(false);
        this.mainWindow.setMinimizable(false);
        this.mainWindow.setMaximizable(false);
        
        await this.applyDisplaySpecificPositioning(position, targetDisplay);
      } else {
        this.mainWindow.setResizable(true);
        this.mainWindow.setMovable(true);
        this.mainWindow.setAlwaysOnTop(true, 'screen-saver');
      }
    } catch (error) {
      console.error('❌ Error applying window position:', error);
      const primaryDisplay = screen.getPrimaryDisplay();
      this.fallbackToCenter(primaryDisplay);
    }
  }

  createSettingsWindow() {
    console.log('⚙️ createSettingsWindow called');
    
    if (this.settingsWindow && !this.settingsWindow.isDestroyed()) {
      console.log('⚙️ Settings window already exists, focusing...');
      this.settingsWindow.show();
      this.settingsWindow.focus();
      return this.settingsWindow;
    }

    console.log('⚙️ Creating new settings window...');
    
    const targetDisplay = this.currentDisplay || screen.getPrimaryDisplay();
    const { x: screenX, y: screenY, width: screenWidth, height: screenHeight } = targetDisplay.bounds;
    
    this.settingsWindow = new BrowserWindow({
      x: screenX + (screenWidth - 500) / 2,
      y: screenY + (screenHeight - 800) / 2,
      width: 500,
      height: 800,
      minWidth: 400,
      minHeight: 600,
      show: false,  // Prevent flash
      resizable: true,
      movable: true,
      minimizable: true,
      maximizable: true,
      fullscreenable: false,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
        backgroundThrottling: false
      },
      titleBarStyle: 'default',
      vibrancy: process.platform === 'darwin' ? 'window' : undefined,
      transparent: false,
      alwaysOnTop: false,
      skipTaskbar: false,
      frame: true,
      parent: null,
      modal: false,
      backgroundColor: '#ffffff'  // Match theme
    });

    console.log('⚙️ Loading settings.html...');
    this.settingsWindow.loadFile('renderer/settings.html');

    this.setupSettingsWindowEventHandlers();
    
    return this.settingsWindow;
  }

  setupMainWindowEventHandlers() {
    this.mainWindow.once('ready-to-show', () => {
      console.log('✅ Main window ready - showing immediately');
      
      const currentPosition = this.settingsService.getWindowPosition();
      
      if (process.platform === 'darwin') {
        // Set collection behavior but don't worry about workspace switching
        try {
          if (typeof this.mainWindow.setCollectionBehavior === 'function') {
            this.mainWindow.setCollectionBehavior([
              'moveToActiveSpace',
              'fullScreenNone'
            ]);
          }
        } catch (error) {
          console.log('ℹ️ Collection behavior not supported');
        }
      }
      
      // Apply positioning immediately
      if (currentPosition === 'cursor' || currentPosition === 'window') {
        this.mainWindow.setAlwaysOnTop(true, 'screen-saver');
      } else {
        setTimeout(async () => {
          await this.applyWindowPosition(currentPosition);
        }, 10); // Minimal delay just for positioning
      }
      
      this.hideTrafficLightButtons();
      
      // Show immediately - no waiting
      this.mainWindow.show();
      this.mainWindow.focus();
    });

    this.mainWindow.on('close', (event) => {
      const { app } = require('electron');
      if (!app.isQuiting) {
        event.preventDefault();
        this.hideMainWindow(); // Now instant
      }
    });

    this.mainWindow.on('show', () => {
      console.log('👁️ Main window shown');
      
      if (process.platform === 'darwin') {
        this.mainWindow.moveTop();
      }
      
      this.mainWindow.webContents.send('window-shown');
      
      const currentTheme = this.settingsService.getTheme();
      this.mainWindow.webContents.send('theme-changed', currentTheme);
      
      this.ensureCorrectWindowLevel();
    });

    this.mainWindow.on('blur', () => {
      // Reduced delay for instant hiding
      setTimeout(() => {
        if (this.mainWindow && !this.mainWindow.isDestroyed() && !this.mainWindow.isFocused()) {
          console.log('😴 Main window lost focus, hiding instantly...');
          this.hideMainWindow();
        }
      }, 100); // Very short delay
    });

    // ...rest of event handlers stay the same...
  }

  setupSettingsWindowEventHandlers() {
    this.settingsWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
      console.error('❌ Settings window failed to load:', errorCode, errorDescription, validatedURL);
    });

    this.settingsWindow.webContents.on('did-finish-load', () => {
      console.log('✅ Settings window finished loading');
    });

    this.settingsWindow.webContents.on('dom-ready', () => {
      console.log('✅ Settings window DOM ready');
    });

    this.settingsWindow.on('closed', () => {
      console.log('⚙️ Settings window closed');
      this.settingsWindow = null;
    });

    this.settingsWindow.on('ready-to-show', () => {
      console.log('⚙️ Settings window ready to show');
      this.settingsWindow.show();
      this.settingsWindow.center();
      this.settingsWindow.focus();
      
      const currentTheme = this.settingsService.getTheme();
      this.settingsWindow.webContents.send('theme-changed', currentTheme);
    });
  }

  async ensureCorrectWindowLevel() {
    const currentPosition = this.settingsService.getWindowPosition();
    
    if (currentPosition === 'cursor' || currentPosition === 'window') {
      this.mainWindow.setAlwaysOnTop(true, 'screen-saver');
    } else {
      console.log('🔧 Edge position: using high window level to cover dock');
      this.mainWindow.setAlwaysOnTop(true, 'pop-up-menu');
      
      if (this.currentDisplay) {
        const { x: screenX, y: screenY, width: screenWidth, height: screenHeight } = this.currentDisplay.bounds;
        const currentBounds = this.mainWindow.getBounds();
        
        let newBounds = currentBounds;
        
        switch (currentPosition) {
          case 'left':
            newBounds = {
              x: screenX,
              y: screenY,
              width: currentBounds.width,
              height: screenHeight
            };
            break;
          case 'right':
            newBounds = {
              x: screenX + screenWidth - currentBounds.width,
              y: screenY,
              width: currentBounds.width,
              height: screenHeight
            };
            break;
          case 'top':
            newBounds = {
              x: screenX,
              y: screenY,
              width: screenWidth,
              height: currentBounds.height
            };
            break;
          case 'bottom':
            newBounds = {
              x: screenX,
              y: screenY + screenHeight - currentBounds.height,
              width: screenWidth,
              height: currentBounds.height
            };
            break;
        }
        
        if (newBounds !== currentBounds) {
          this.mainWindow.setBounds(newBounds);
        }
      }
    }
  }

  hideTrafficLightButtons() {
    try {
      if (process.platform === 'darwin') {
        this.mainWindow.setWindowButtonVisibility(false);
      }
    } catch (error) {
      console.log('Could not hide window buttons:', error.message);
    }
  }

  // Getters
  getMainWindow() {
    return this.mainWindow;
  }

  getSettingsWindow() {
    return this.settingsWindow;
  }

  closeSettingsWindow() {
    if (this.settingsWindow) {
      this.settingsWindow.close();
    }
  }

  // Send events to windows
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

  getDisplayInfo() {
    const displays = screen.getAllDisplays();
    const primary = screen.getPrimaryDisplay();
    const cursor = screen.getCursorScreenPoint();
    
    return {
      cursor,
      primary: primary.id,
      current: this.currentDisplay?.id,
      displays: displays.map(display => ({
        id: display.id,
        isPrimary: display.id === primary.id,
        isCurrent: display.id === this.currentDisplay?.id,
        bounds: display.bounds,
        workArea: display.workArea,
        scaleFactor: display.scaleFactor
      }))
    };
  }

  async cleanup() {
    console.log('💀 Window manager cleanup...');
    
    try {
      // Stop any ongoing animations
      this.isAnimating = false;
      
      // Always restore original dock state during cleanup
      await this.restoreOriginalDockState();
      
      console.log('✅ Window manager cleanup completed');
    } catch (error) {
      console.error('❌ Error during window manager cleanup:', error);
    }
  }
}

// Performance monitoring class
class PerformanceMonitor {
  constructor() {
    this.metrics = { frameDrops: 0, memoryPeaks: [], animationLatencies: [] };
    this.isMonitoring = false;
  }

  startMonitoring() {
    if (this.isMonitoring) return;
    this.isMonitoring = true;
    
    this.monitorFrameRate();
    this.monitorMemoryUsage();
  }

  monitorFrameRate() {
    let frameCount = 0;
    let lastTime = Date.now();
    
    const trackFrame = () => {
      if (!this.isMonitoring) return;
      
      frameCount++;
      const currentTime = Date.now();
      
      if (currentTime - lastTime >= 1000) {
        const fps = frameCount;
        if (fps < 30) {
          this.metrics.frameDrops++;
          console.warn(`🎬 Low FPS detected: ${fps.toFixed(2)}`);
        }
        frameCount = 0;
        lastTime = currentTime;
      }
      
      if (this.isMonitoring) {
        setTimeout(trackFrame, 16); // ~60fps monitoring
      }
    };
    
    trackFrame();
  }

  monitorMemoryUsage() {
    const interval = setInterval(() => {
      if (!this.isMonitoring) {
        clearInterval(interval);
        return;
      }
      
      const usage = process.memoryUsage();
      if (usage.heapUsed > 200 * 1024 * 1024) { // 200MB threshold
        console.warn('🧠 High memory usage detected:', this.formatBytes(usage.heapUsed));
        this.optimizeMemory();
      }
    }, 5000);
  }

  optimizeMemory() {
    if (global.gc) {
      global.gc();
      console.log('🧹 Garbage collection triggered');
    }
  }

  formatBytes(bytes) {
    const sizes = ['B', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 B';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  }

  stop() {
    this.isMonitoring = false;
  }
}

module.exports = WindowManager;