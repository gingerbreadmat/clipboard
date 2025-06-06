// Complete Enhanced src/managers/window-manager.js with dock position awareness

const { BrowserWindow, screen } = require('electron');
const path = require('path');

/**
 * WindowManager - Handles window positioning and dock interaction
 * 
 * Current behavior: All edge positions (left, right, top, bottom) cover the dock
 * TODO: Add user toggle setting to control dock covering behavior
 */
class WindowManager {
  constructor(settingsService, dockService) {
    this.settingsService = settingsService;
    this.dockService = dockService;
    this.mainWindow = null;
    this.settingsWindow = null;
    this.nativeWindowManager = null;
    this.currentDisplay = null;
    this.originalDockState = null; // Track original dock state
    this.dockWasHiddenByUs = false; // Track if we hid the dock
    
    // Try to load native window manager
    try {
      this.nativeWindowManager = require('../build/Release/macos_window_manager.node');
      console.log('✅ Native macOS window manager loaded');
    } catch (error) {
      console.log('⚠️ Native window manager not available:', error.message);
    }
  }

  async createMainWindow() {
    console.log('📱 Creating main window...');
    
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
    const backgroundColor = currentTheme === 'dark' ? '#282828' : '#ffffff';
    
    console.log('🎨 Setting background color:', backgroundColor, 'for theme:', currentTheme);
    
    // Calculate initial bounds based on cursor location and dock position
    const initialBounds = await this.calculateDockAwareBounds(storedPosition, targetDisplay, cursorPosition);
    
    this.mainWindow = new BrowserWindow({
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
      transparent: false,
      backgroundColor: backgroundColor,
      vibrancy: 'sidebar',
      alwaysOnTop: true,
      skipTaskbar: true,
      level: 'screen-saver',
      visibleOnAllWorkspaces: false,
      focusable: true
    });

    console.log('📄 Loading index.html...');
    this.mainWindow.loadFile('renderer/index.html');

    this.setupMainWindowEventHandlers();
    
    return this.mainWindow;
  }

  async storeOriginalDockState() {
    try {
      // Use cached dock info for faster startup
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
    // Validate inputs
    if (!display || !display.bounds) {
      console.error('❌ Invalid display object');
      return null;
    }
    
    const { x: screenX, y: screenY, width: screenWidth, height: screenHeight } = display.bounds;
    
    // For now, ALWAYS use full screen space - clipboard covers dock
    // TODO: Later this will be controlled by a user toggle setting
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
          // Use full screen height, covering dock
          bounds = {
            x: Math.round(screenX),
            y: Math.round(screenY),
            width: Math.round(sidebarWidth),
            height: Math.round(screenHeight)
          };
          break;
          
        case 'right':
          // Use full screen height, covering dock
          bounds = {
            x: Math.round(screenX + screenWidth - sidebarWidth),
            y: Math.round(screenY),
            width: Math.round(sidebarWidth),
            height: Math.round(screenHeight)
          };
          break;
          
        case 'top':
          // Use full screen width, covering dock
          bounds = {
            x: Math.round(screenX),
            y: Math.round(screenY),
            width: Math.round(screenWidth),
            height: 300
          };
          break;
          
        case 'bottom':
          // Use full screen width, covering dock
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
      
      // Final validation of calculated bounds
      if (bounds && this.isValidBounds(bounds)) {
        console.log(`✅ Calculated bounds (covering dock): ${bounds.width}x${bounds.height} at (${bounds.x}, ${bounds.y})`);
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

  async calculateBottomBoundsWithDockConflict(availableSpace, screenX, screenY, screenWidth, screenHeight) {
    // This method is now simplified since bottom position always covers dock
    console.log('🏠 Bottom position: using full screen width to cover dock');
    
    return {
      x: Math.round(screenX),
      y: Math.round(screenY + screenHeight - 300),
      width: Math.round(screenWidth),
      height: 300
    };
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
    
    // Adjust if window would go off available space
    if (x + windowWidth > availableSpace.x + availableSpace.width) {
      x = Math.round(cursorPosition.x - windowWidth - margin);
    }
    
    if (y + windowHeight > availableSpace.y + availableSpace.height) {
      y = Math.round(cursorPosition.y - windowHeight - margin);
    }
    
    // Ensure window stays within available space
    const padding = 10;
    x = Math.max(availableSpace.x + padding, Math.min(x, availableSpace.x + availableSpace.width - windowWidth - padding));
    y = Math.max(availableSpace.y + padding, Math.min(y, availableSpace.y + availableSpace.height - windowHeight - padding));
    
    console.log(`🎯 Cursor proximity bounds (dock-aware): ${windowWidth}x${windowHeight} at (${x}, ${y})`);
    
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
    
    // Calculate distances to each edge of available space
    const distanceToLeft = Math.abs(cursorPosition.x - availableSpace.x);
    const distanceToRight = Math.abs((availableSpace.x + availableSpace.width) - cursorPosition.x);
    const distanceToTop = Math.abs(cursorPosition.y - availableSpace.y);
    const distanceToBottom = Math.abs((availableSpace.y + availableSpace.height) - cursorPosition.y);
    
    const minDistance = Math.min(distanceToLeft, distanceToRight, distanceToTop, distanceToBottom);
    
    console.log(`📏 Distances (dock-aware) - Left: ${distanceToLeft}, Right: ${distanceToRight}, Top: ${distanceToTop}, Bottom: ${distanceToBottom}`);
    
    if (minDistance === distanceToLeft) {
      console.log('🎯 Nearest edge: LEFT (dock-aware)');
      return {
        x: Math.round(availableSpace.x),
        y: Math.round(availableSpace.y),
        width: Math.round(sidebarWidth),
        height: Math.round(availableSpace.height)
      };
    } else if (minDistance === distanceToRight) {
      console.log('🎯 Nearest edge: RIGHT (dock-aware)');
      return {
        x: Math.round(availableSpace.x + availableSpace.width - sidebarWidth),
        y: Math.round(availableSpace.y),
        width: Math.round(sidebarWidth),
        height: Math.round(availableSpace.height)
      };
    } else if (minDistance === distanceToTop) {
      console.log('🎯 Nearest edge: TOP (dock-aware)');
      return {
        x: Math.round(availableSpace.x),
        y: Math.round(availableSpace.y),
        width: Math.round(availableSpace.width),
        height: 300
      };
    } else {
      console.log('🎯 Nearest edge: BOTTOM (dock-aware)');
      return {
        x: Math.round(availableSpace.x),
        y: Math.round(availableSpace.y + availableSpace.height - 300),
        width: Math.round(availableSpace.width),
        height: 300
      };
    }
  }

  async applyDisplaySpecificPositioning(position, display) {
    console.log('🔧 Applying display specific positioning:', position);
    
    // For now, ALL clipboard positions cover the dock
    // TODO: Later this will be controlled by a user toggle setting
    
    // Skip dock covering for cursor and window modes (they're floating)
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

  async forceWindowOverDock() {
    console.log('🏠 Forcing window to cover dock');
    
    try {
      const success = await this.dockService.setDockVisibility(false);
      if (success) {
        this.dockWasHiddenByUs = true;
        this.mainWindow.setAlwaysOnTop(true, 'pop-up-menu');
        console.log('✅ Dock hidden successfully, window will cover dock area');
      } else {
        console.log('⚠️ Could not hide dock, using high window level');
        this.mainWindow.setAlwaysOnTop(true, 'pop-up-menu');
      }
    } catch (error) {
      console.log('⚠️ Error hiding dock, using high window level:', error.message);
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
        // Restore to original visibility state
        await this.dockService.setDockVisibility(!this.originalDockState.hidden);
        this.dockWasHiddenByUs = false;
        console.log('✅ Original dock state restored');
      } catch (error) {
        console.log('⚠️ Could not restore original dock state:', error.message);
      }
    }
  }

  getDisplayAtCursor(cursorPosition) {
    const displays = screen.getAllDisplays();
    
    // Find the display that contains the cursor
    const targetDisplay = displays.find(display => {
      const { x, y, width, height } = display.bounds;
      return cursorPosition.x >= x && 
             cursorPosition.x < x + width && 
             cursorPosition.y >= y && 
             cursorPosition.y < y + height;
    });
    
    // Fallback to primary display if cursor position detection fails
    return targetDisplay || screen.getPrimaryDisplay();
  }

  async repositionToCursor() {
    if (!this.mainWindow) return;
    
    console.log('🖱️ Repositioning window to cursor location and current desktop...');
    
    try {
      const cursorPosition = screen.getCursorScreenPoint();
      const targetDisplay = this.getDisplayAtCursor(cursorPosition);
      const currentPosition = this.settingsService.getWindowPosition();
      
      // Check if we've moved to a different display
      if (!this.currentDisplay || this.currentDisplay.id !== targetDisplay.id) {
        console.log(`📺 Switched to display: ${targetDisplay.id}`);
        this.currentDisplay = targetDisplay;
      }
      
      const newBounds = await this.calculateDockAwareBounds(currentPosition, targetDisplay, cursorPosition);
      
      // Validate bounds before setting
      if (this.isValidBounds(newBounds)) {
        console.log(`📍 Moving window to: ${newBounds.width}x${newBounds.height} at (${newBounds.x}, ${newBounds.y})`);
        
        // On macOS, handle desktop switching without hiding the window
        if (process.platform === 'darwin') {
          // Force window to current space
          this.mainWindow.setVisibleOnAllWorkspaces(false);
          this.mainWindow.setBounds(newBounds);
          await this.applyDisplaySpecificPositioning(currentPosition, targetDisplay);
        } else {
          this.mainWindow.setBounds(newBounds);
          await this.applyDisplaySpecificPositioning(currentPosition, targetDisplay);
        }
        
      } else {
        console.error('❌ Invalid bounds calculated:', newBounds);
        // Fallback to center of current display
        this.fallbackToCenter(targetDisplay);
      }
    } catch (error) {
      console.error('❌ Error repositioning to cursor:', error);
      // Fallback to primary display center
      const primaryDisplay = screen.getPrimaryDisplay();
      this.fallbackToCenter(primaryDisplay);
    }
  }

  // Validate bounds to prevent setBounds errors
  isValidBounds(bounds) {
    return (
      typeof bounds.x === 'number' && !isNaN(bounds.x) && isFinite(bounds.x) &&
      typeof bounds.y === 'number' && !isNaN(bounds.y) && isFinite(bounds.y) &&
      typeof bounds.width === 'number' && !isNaN(bounds.width) && isFinite(bounds.width) && bounds.width > 0 &&
      typeof bounds.height === 'number' && !isNaN(bounds.height) && isFinite(bounds.height) && bounds.height > 0
    );
  }

  // Fallback positioning when normal positioning fails
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

  // Enhanced show method that recreates window on current desktop but keeps it simple
  async showMainWindow() {
    if (this.mainWindow) {
      console.log('👁️ Showing main window...');
      
      // For macOS desktop switching, recreate window
      if (process.platform === 'darwin') {
        // Destroy and recreate to force current desktop
        this.mainWindow.destroy();
        this.mainWindow = null;
        
        // Recreate immediately
        await this.createMainWindow();
        
        // Show when ready with faster, simpler animation
        this.mainWindow.once('ready-to-show', () => {
          // Show immediately but start with low opacity
          this.mainWindow.setOpacity(0.3);
          this.mainWindow.show();
          
          // Quick fade in - much faster than before
          setTimeout(() => {
            if (this.mainWindow && !this.mainWindow.isDestroyed()) {
              this.mainWindow.setOpacity(1);
              this.mainWindow.focus();
            }
          }, 100); // Much faster - was 400ms
        });
      } else {
        // Non-macOS: just reposition and show
        await this.repositionToCursor();
        this.mainWindow.show();
        this.mainWindow.focus();
      }
    }
  }

  // Override the toggle method to use new show behavior
  toggleMainWindow() {
    if (this.mainWindow && !this.mainWindow.isDestroyed() && this.mainWindow.isVisible()) {
      this.hideMainWindow();
    } else {
      this.showMainWindow();
    }
  }

  // Enhanced apply window position method
  async applyWindowPosition(position) {
    console.log('📍 Applying window position:', position);
    
    if (!this.mainWindow) return;
    
    try {
      // First, restore dock if we previously hid it
      await this.restoreDockIfHiddenByUs();
      
      // Get current cursor position and display
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
      
      // Update current display tracking
      this.currentDisplay = targetDisplay;
      
      // Apply position-specific logic
      if (position !== 'window' && position !== 'cursor') {
        this.mainWindow.setResizable(false);
        this.mainWindow.setMovable(false);
        this.mainWindow.setMinimizable(false);
        this.mainWindow.setMaximizable(false);
        
        await this.applyDisplaySpecificPositioning(position, targetDisplay);
      } else {
        // For window and cursor modes, allow normal window behavior
        this.mainWindow.setResizable(true);
        this.mainWindow.setMovable(true);
        this.mainWindow.setAlwaysOnTop(true, 'screen-saver');
      }
    } catch (error) {
      console.error('❌ Error applying window position:', error);
      // Fallback to primary display center
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
    
    // Position settings window on the same display as the main window
    const targetDisplay = this.currentDisplay || screen.getPrimaryDisplay();
    const { x: screenX, y: screenY, width: screenWidth, height: screenHeight } = targetDisplay.bounds;
    
    this.settingsWindow = new BrowserWindow({
      x: screenX + (screenWidth - 500) / 2,
      y: screenY + (screenHeight - 800) / 2,
      width: 500,
      height: 800,
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
      alwaysOnTop: false,
      skipTaskbar: false,
      frame: true,
      parent: null,
      modal: false
    });

    console.log('⚙️ Loading settings.html...');
    this.settingsWindow.loadFile('renderer/settings.html');

    this.setupSettingsWindowEventHandlers();
    
    return this.settingsWindow;
  }

  setupMainWindowEventHandlers() {
    // Set the window level after creation for maximum overlay capability
    this.mainWindow.once('ready-to-show', () => {
      console.log('✅ Main window ready to show');
      
      // Apply correct positioning and window level based on stored position
      const currentPosition = this.settingsService.getWindowPosition();
      console.log('🔧 Ready-to-show: Applying position logic for:', currentPosition);
      
      // Set up space management for macOS (with compatibility check)
      if (process.platform === 'darwin') {
        try {
          this.mainWindow.setVisibleOnAllWorkspaces(false);
          
          // Check if setCollectionBehavior exists (newer Electron versions)
          if (typeof this.mainWindow.setCollectionBehavior === 'function') {
            this.mainWindow.setCollectionBehavior([
              'moveToActiveSpace',
              'managed',
              'participatesInCycle'
            ]);
            console.log('✅ Modern space management configured');
          } else {
            console.log('ℹ️ Using legacy space management (setCollectionBehavior not available)');
          }
          
        } catch (error) {
          console.log('ℹ️ Space management not fully supported in this Electron version');
        }
      }
      
      // Apply positioning with reduced delay for faster startup
      if (currentPosition === 'cursor' || currentPosition === 'window') {
        console.log('🔧 Ready-to-show: Floating position, using standard window level');
        this.mainWindow.setAlwaysOnTop(true, 'screen-saver');
      } else {
        console.log('🔧 Ready-to-show: Edge position will cover dock');
        // Reduced delay for faster startup
        setTimeout(async () => {
          await this.applyWindowPosition(currentPosition);
        }, 50);
      }
      
      // Force hide traffic light buttons
      this.hideTrafficLightButtons();
    });

    // Hide window instead of closing
    this.mainWindow.on('close', (event) => {
      const { app } = require('electron');
      if (!app.isQuiting) {
        event.preventDefault();
        this.mainWindow.hide();
        console.log('🙈 Main window hidden');
      } else {
        console.log('💀 Main window closing - app is quitting');
      }
    });

    // Show window when focused
    this.mainWindow.on('show', () => {
      console.log('👁️ Main window shown');
      
      // Ensure proper space behavior when shown (with compatibility check)
      if (process.platform === 'darwin') {
        this.mainWindow.setVisibleOnAllWorkspaces(false);
        this.mainWindow.moveTop();
        
        // Only try setCollectionBehavior if it exists
        if (typeof this.mainWindow.setCollectionBehavior === 'function') {
          try {
            this.mainWindow.setCollectionBehavior([
              'moveToActiveSpace',
              'managed', 
              'participatesInCycle'
            ]);
          } catch (error) {
            console.log('ℹ️ Could not set collection behavior:', error.message);
          }
        }
      }
      
      this.mainWindow.webContents.send('window-shown');
      
      // Apply current theme when window is shown
      const currentTheme = this.settingsService.getTheme();
      this.mainWindow.webContents.send('theme-changed', currentTheme);
      
      // Ensure correct window level based on position
      this.ensureCorrectWindowLevel();
    });

    // Modified blur handler with reduced delay for faster response
    this.mainWindow.on('blur', () => {
      // Reduced delay for faster hiding
      setTimeout(async () => {
        // Only hide if the window is still unfocused after the delay
        if (this.mainWindow && !this.mainWindow.isDestroyed() && !this.mainWindow.isFocused()) {
          console.log('😴 Main window lost focus, hiding...');
          await this.hideMainWindow();
        }
      }, 50); // Reduced from 100ms to 50ms
    });

    // Add error handling for main window
    this.mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
      console.error('❌ Main window failed to load:', errorCode, errorDescription);
    });

    this.mainWindow.webContents.on('did-finish-load', () => {
      console.log('✅ Main window finished loading');
    });
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
      
      // Apply current theme when settings window is shown
      const currentTheme = this.settingsService.getTheme();
      this.settingsWindow.webContents.send('theme-changed', currentTheme);
    });
  }

  async ensureCorrectWindowLevel() {
    const currentPosition = this.settingsService.getWindowPosition();
    
    // For now, ALL edge positions use high window level to cover dock
    // TODO: Later this will be controlled by a user toggle setting
    
    if (currentPosition === 'cursor' || currentPosition === 'window') {
      // Floating positions use normal level
      this.mainWindow.setAlwaysOnTop(true, 'screen-saver');
    } else {
      // Edge positions (left, right, top, bottom) use high level to cover dock
      console.log('🔧 Edge position: using high window level to cover dock');
      this.mainWindow.setAlwaysOnTop(true, 'pop-up-menu');
      
      // Ensure window bounds cover the full edge
      if (this.currentDisplay) {
        const { x: screenX, y: screenY, width: screenWidth, height: screenHeight } = this.currentDisplay.bounds;
        const currentBounds = this.mainWindow.getBounds();
        
        // Make sure the window extends to screen edges based on position
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

  // Utility methods
  async hideMainWindow() {
    if (this.mainWindow) {
      // Restore dock if we hid it
      await this.restoreDockIfHiddenByUs();
      this.mainWindow.hide();
    }
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

  // Get information about all displays (useful for debugging)
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

  // Cleanup method
  async cleanup() {
    console.log('💀 Window manager cleanup...');
    
    try {
      // Always restore original dock state during cleanup
      await this.restoreOriginalDockState();
      
      console.log('✅ Window manager cleanup completed');
    } catch (error) {
      console.error('❌ Error during window manager cleanup:', error);
    }
  }
}

module.exports = WindowManager;