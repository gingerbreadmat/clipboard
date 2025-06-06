
const { BrowserWindow, screen } = require('electron');
const path = require('path');

class WindowManager {
  constructor(settingsService, dockService) {
    this.settingsService = settingsService;
    this.dockService = dockService;
    this.mainWindow = null;
    this.settingsWindow = null;
    this.nativeWindowManager = null;
    this.currentDisplay = null; // Track which display we're on
    
    // Try to load native window manager
    try {
      this.nativeWindowManager = require('../build/Release/macos_window_manager.node');
      console.log('✅ Native macOS window manager loaded');
    } catch (error) {
      console.log('⚠️ Native window manager not available:', error.message);
    }
  }

  createMainWindow() {
    console.log('📱 Creating main window...');
    
    // Get cursor position to determine which display to use
    const cursorPosition = screen.getCursorScreenPoint();
    const targetDisplay = this.getDisplayAtCursor(cursorPosition);
    
    console.log(`🖱️ Cursor at: ${cursorPosition.x}, ${cursorPosition.y}`);
    console.log(`📺 Target display: ${targetDisplay.id} (${targetDisplay.bounds.width}x${targetDisplay.bounds.height})`);
    
    this.currentDisplay = targetDisplay;
    
    // Get stored position preference
    const storedPosition = this.settingsService.getWindowPosition();
    console.log('📍 Using stored position:', storedPosition);
    
    // Get current theme to set correct background - THIS PREVENTS THE FLASH
    const currentTheme = this.settingsService.getTheme();
    const backgroundColor = currentTheme === 'dark' ? '#282828' : '#ffffff';
    
    console.log('🎨 Setting background color:', backgroundColor, 'for theme:', currentTheme);
    
    // Calculate initial bounds based on cursor location
    const initialBounds = this.calculateCursorAwareBounds(storedPosition, targetDisplay, cursorPosition);
    
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
      transparent: false, // IMPORTANT: Set to false so backgroundColor works
      backgroundColor: backgroundColor, // THIS PREVENTS THE FLASH
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

  calculateCursorAwareBounds(position, display, cursorPosition) {
    // Validate inputs
    if (!display || !display.bounds) {
      console.error('❌ Invalid display object');
      return null;
    }
    
    const { x: screenX, y: screenY, width: screenWidth, height: screenHeight } = display.bounds;
    const { x: workX, y: workY, width: workWidth, height: workHeight } = display.workArea || display.bounds;
    
    // Validate display bounds
    if (!Number.isFinite(screenX) || !Number.isFinite(screenY) || !Number.isFinite(screenWidth) || !Number.isFinite(screenHeight)) {
      console.error('❌ Invalid display bounds:', display.bounds);
      return null;
    }
    
    const sidebarWidth = 350;
    const sidebarHeight = screenHeight;
    const popupWidth = 400;
    const popupHeight = 600;
    
    console.log(`📐 Display bounds: ${screenWidth}x${screenHeight} at (${screenX}, ${screenY})`);
    console.log(`💼 Work area: ${workWidth}x${workHeight} at (${workX}, ${workY})`);
    
    let bounds = null;
    
    try {
      switch (position) {
        case 'cursor':
          // New mode: Open near cursor with smart positioning
          bounds = this.calculateCursorProximityBounds(cursorPosition, display, popupWidth, popupHeight);
          break;
          
        case 'cursor-edge':
          // New mode: Open at nearest edge to cursor
          bounds = this.calculateNearestEdgeBounds(cursorPosition, display, sidebarWidth);
          break;
          
        case 'right':
          bounds = {
            x: Math.round(screenX + screenWidth - sidebarWidth),
            y: Math.round(screenY),
            width: Math.round(sidebarWidth),
            height: Math.round(sidebarHeight)
          };
          break;
          
        case 'top':
          bounds = {
            x: Math.round(screenX),
            y: Math.round(workY), // Use work area to avoid menu bar
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
          // Center on the display where cursor is
          bounds = {
            x: Math.round(screenX + (screenWidth - popupWidth) / 2),
            y: Math.round(screenY + (screenHeight - popupHeight) / 2),
            width: Math.round(popupWidth),
            height: Math.round(popupHeight)
          };
          break;
          
        default: // 'left'
          bounds = {
            x: Math.round(screenX),
            y: Math.round(screenY),
            width: Math.round(sidebarWidth),
            height: Math.round(sidebarHeight)
          };
          break;
      }
      
      // Final validation of calculated bounds
      if (bounds && this.isValidBounds(bounds)) {
        return bounds;
      } else {
        console.error('❌ Calculated bounds are invalid:', bounds);
        return null;
      }
      
    } catch (error) {
      console.error('❌ Error calculating cursor aware bounds:', error);
      return null;
    }
  }

  calculateCursorProximityBounds(cursorPosition, display, windowWidth, windowHeight) {
    const { x: screenX, y: screenY, width: screenWidth, height: screenHeight } = display.bounds;
    const margin = 20; // Distance from cursor
    
    // Ensure cursor position is valid
    if (!cursorPosition || typeof cursorPosition.x !== 'number' || typeof cursorPosition.y !== 'number') {
      console.warn('⚠️ Invalid cursor position, using display center');
      cursorPosition = {
        x: screenX + screenWidth / 2,
        y: screenY + screenHeight / 2
      };
    }
    
    // Default position: bottom-right of cursor
    let x = Math.round(cursorPosition.x + margin);
    let y = Math.round(cursorPosition.y + margin);
    
    // Adjust if window would go off-screen
    if (x + windowWidth > screenX + screenWidth) {
      x = Math.round(cursorPosition.x - windowWidth - margin); // Place to the left instead
    }
    
    if (y + windowHeight > screenY + screenHeight) {
      y = Math.round(cursorPosition.y - windowHeight - margin); // Place above instead
    }
    
    // Ensure window stays within screen bounds with some padding
    const padding = 10;
    x = Math.max(screenX + padding, Math.min(x, screenX + screenWidth - windowWidth - padding));
    y = Math.max(screenY + padding, Math.min(y, screenY + screenHeight - windowHeight - padding));
    
    // Final validation
    x = Math.round(x);
    y = Math.round(y);
    windowWidth = Math.round(windowWidth);
    windowHeight = Math.round(windowHeight);
    
    console.log(`🎯 Cursor proximity bounds: ${windowWidth}x${windowHeight} at (${x}, ${y})`);
    
    return { x, y, width: windowWidth, height: windowHeight };
  }

  calculateNearestEdgeBounds(cursorPosition, display, sidebarWidth) {
    const { x: screenX, y: screenY, width: screenWidth, height: screenHeight } = display.bounds;
    
    // Ensure cursor position is valid
    if (!cursorPosition || typeof cursorPosition.x !== 'number' || typeof cursorPosition.y !== 'number') {
      console.warn('⚠️ Invalid cursor position, defaulting to left edge');
      return {
        x: screenX,
        y: screenY,
        width: Math.round(sidebarWidth),
        height: Math.round(screenHeight)
      };
    }
    
    // Calculate distances to each edge
    const distanceToLeft = Math.abs(cursorPosition.x - screenX);
    const distanceToRight = Math.abs((screenX + screenWidth) - cursorPosition.x);
    const distanceToTop = Math.abs(cursorPosition.y - screenY);
    const distanceToBottom = Math.abs((screenY + screenHeight) - cursorPosition.y);
    
    // Find the nearest edge
    const minDistance = Math.min(distanceToLeft, distanceToRight, distanceToTop, distanceToBottom);
    
    console.log(`📏 Distances - Left: ${distanceToLeft}, Right: ${distanceToRight}, Top: ${distanceToTop}, Bottom: ${distanceToBottom}`);
    
    if (minDistance === distanceToLeft) {
      console.log('🎯 Nearest edge: LEFT');
      return {
        x: Math.round(screenX),
        y: Math.round(screenY),
        width: Math.round(sidebarWidth),
        height: Math.round(screenHeight)
      };
    } else if (minDistance === distanceToRight) {
      console.log('🎯 Nearest edge: RIGHT');
      return {
        x: Math.round(screenX + screenWidth - sidebarWidth),
        y: Math.round(screenY),
        width: Math.round(sidebarWidth),
        height: Math.round(screenHeight)
      };
    } else if (minDistance === distanceToTop) {
      console.log('🎯 Nearest edge: TOP');
      return {
        x: Math.round(screenX),
        y: Math.round(screenY),
        width: Math.round(screenWidth),
        height: 300
      };
    } else {
      console.log('🎯 Nearest edge: BOTTOM');
      return {
        x: Math.round(screenX),
        y: Math.round(screenY + screenHeight - 300),
        width: Math.round(screenWidth),
        height: 300
      };
    }
  }

  // New method to update window position based on current cursor location
  repositionToCursor() {
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
      
      const newBounds = this.calculateCursorAwareBounds(currentPosition, targetDisplay, cursorPosition);
      
      // Validate bounds before setting
      if (this.isValidBounds(newBounds)) {
        console.log(`📍 Moving window to: ${newBounds.width}x${newBounds.height} at (${newBounds.x}, ${newBounds.y})`);
        
        // On macOS, handle desktop switching without hiding the window
        if (process.platform === 'darwin') {
          // Force window to current space
          this.mainWindow.setVisibleOnAllWorkspaces(false);
          this.mainWindow.setBounds(newBounds);
          this.applyDisplaySpecificPositioning(currentPosition, targetDisplay);
        } else {
          this.mainWindow.setBounds(newBounds);
          this.applyDisplaySpecificPositioning(currentPosition, targetDisplay);
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

  applyDisplaySpecificPositioning(position, display) {
    // Handle special cases like bottom positioning that might need dock management
    if (position === 'bottom') {
      console.log('🏠 Applying bottom positioning with dock management');
      
      if (this.nativeWindowManager && process.platform === 'darwin') {
        console.log('🔧 Using native APIs for bottom positioning');
        
        const { x: screenX, y: screenY, width: screenWidth, height: screenHeight } = display.bounds;
        const bounds = {
          x: screenX,
          y: screenY + screenHeight - 300,
          width: screenWidth,
          height: 300
        };
        
        setTimeout(() => {
          try {
            const windowId = this.mainWindow.getNativeWindowHandle().readInt32LE(0);
            const success = this.nativeWindowManager.forceWindowOverDock(
              windowId, bounds.x, bounds.y, bounds.width, bounds.height
            );
            
            if (success) {
              console.log('✅ Successfully positioned window over dock');
            } else {
              console.log('❌ Native positioning failed, using dock hiding');
              this.mainWindow.setAlwaysOnTop(true, 'pop-up-menu');
              this.dockService.setDockVisibility(false);
            }
          } catch (error) {
            console.error('❌ Error with native positioning:', error);
            this.mainWindow.setAlwaysOnTop(true, 'pop-up-menu');
            this.dockService.setDockVisibility(false);
          }
        }, 100);
      } else {
        console.log('🔧 Using dock hiding for bottom positioning');
        this.mainWindow.setAlwaysOnTop(true, 'pop-up-menu');
        this.dockService.setDockVisibility(false);
      }
    } else {
      // For non-bottom positions, restore dock and use normal window level
      this.dockService.setDockVisibility(true);
      this.mainWindow.setAlwaysOnTop(true, 'screen-saver');
    }
  }

  applyBottomPositioning(display) {
    const { x: screenX, y: screenY, width: screenWidth, height: screenHeight } = display.bounds;
    const bottomBarHeight = 300;
    
    if (this.nativeWindowManager && process.platform === 'darwin') {
      console.log('🔧 Using native APIs for bottom positioning');
      
      const bounds = {
        x: screenX,
        y: screenY + screenHeight - bottomBarHeight,
        width: screenWidth,
        height: bottomBarHeight
      };
      
      setTimeout(() => {
        try {
          const windowId = this.mainWindow.getNativeWindowHandle().readInt32LE(0);
          const success = this.nativeWindowManager.forceWindowOverDock(
            windowId, bounds.x, bounds.y, bounds.width, bounds.height
          );
          
          if (success) {
            console.log('✅ Successfully positioned window over dock');
          } else {
            console.log('❌ Native positioning failed, using dock hiding');
            this.mainWindow.setAlwaysOnTop(true, 'pop-up-menu');
            this.dockService.setDockVisibility(false);
          }
        } catch (error) {
          console.error('❌ Error with native positioning:', error);
          this.mainWindow.setAlwaysOnTop(true, 'pop-up-menu');
          this.dockService.setDockVisibility(false);
        }
      }, 100);
    } else {
      console.log('🔧 Using dock hiding for bottom positioning');
      this.mainWindow.setAlwaysOnTop(true, 'pop-up-menu');
      this.dockService.setDockVisibility(false);
    }
  }

  // Enhanced show method that recreates window on current desktop but keeps it simple
  showMainWindow() {
    if (this.mainWindow) {
      console.log('👁️ Showing main window...');
      
      // For macOS desktop switching, recreate window
      if (process.platform === 'darwin') {
        // Destroy and recreate to force current desktop
        this.mainWindow.destroy();
        this.mainWindow = null;
        
        // Recreate immediately
        this.createMainWindow();
        
        // Show when ready but keep invisible until content is fully positioned
        this.mainWindow.once('ready-to-show', () => {
          // Show but make completely invisible
          this.mainWindow.setOpacity(0);
          this.mainWindow.show();
          
          // Wait for content to load and settle, then fade in
          setTimeout(() => {
            // Gradually increase opacity to avoid any jarring appearance
            let opacity = 0;
            const fadeIn = setInterval(() => {
              opacity += 0.2;
              if (opacity >= 1) {
                opacity = 1;
                clearInterval(fadeIn);
              }
              this.mainWindow.setOpacity(opacity);
            }, 20); // 20ms intervals for smooth fade
            
            this.mainWindow.focus();
          }, 400); // Even longer delay - 400ms
        });
      } else {
        // Non-macOS: just reposition and show
        this.repositionToCursor();
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
      this.showMainWindow(); // This will now recreate window on current desktop
    }
  }

  // Enhanced apply window position method
  applyWindowPosition(position) {
    console.log('📍 Applying window position:', position);
    
    if (!this.mainWindow) return;
    
    try {
      // Get current cursor position and display
      const cursorPosition = screen.getCursorScreenPoint();
      const targetDisplay = this.getDisplayAtCursor(cursorPosition);
      
      const newBounds = this.calculateCursorAwareBounds(position, targetDisplay, cursorPosition);
      
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
        
        this.applyDisplaySpecificPositioning(position, targetDisplay);
      } else {
        // For window and cursor modes, allow normal window behavior
        this.mainWindow.setResizable(true);
        this.mainWindow.setMovable(true);
        this.mainWindow.setAlwaysOnTop(true, 'screen-saver');
        
        // Restore dock if it was hidden
        this.dockService.setDockVisibility(true);
      }
    } catch (error) {
      console.error('❌ Error applying window position:', error);
      // Fallback to primary display center
      const primaryDisplay = screen.getPrimaryDisplay();
      this.fallbackToCenter(primaryDisplay);
    }
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
      
      // Set up space management for macOS
      if (process.platform === 'darwin') {
        try {
          this.mainWindow.setVisibleOnAllWorkspaces(false);
          
          // Set collection behavior for proper space handling
          this.mainWindow.setCollectionBehavior([
            'moveToActiveSpace',
            'managed',
            'participatesInCycle'
          ]);
          
          console.log('✅ Space management configured');
        } catch (error) {
          console.error('❌ Error configuring space management:', error);
        }
      }
      
      if (currentPosition === 'bottom' && this.nativeWindowManager) {
        console.log('🔧 Ready-to-show: Using native APIs for bottom position');
        // Apply native positioning immediately
        setTimeout(() => {
          this.applyWindowPosition(currentPosition);
        }, 100);
      } else {
        console.log('🔧 Ready-to-show: Using standard window level');
        this.mainWindow.setAlwaysOnTop(true, 'screen-saver');
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
      
      // Ensure proper space behavior when shown
      if (process.platform === 'darwin') {
        this.mainWindow.setVisibleOnAllWorkspaces(false);
        this.mainWindow.moveTop();
        
        // Reapply collection behavior to ensure it sticks
        try {
          this.mainWindow.setCollectionBehavior([
            'moveToActiveSpace',
            'managed', 
            'participatesInCycle'
          ]);
        } catch (error) {
          console.error('❌ Error reapplying collection behavior:', error);
        }
      }
      
      this.mainWindow.webContents.send('window-shown');
      
      // Apply current theme when window is shown
      const currentTheme = this.settingsService.getTheme();
      this.mainWindow.webContents.send('theme-changed', currentTheme);
      
      // Ensure correct window level based on position
      this.ensureCorrectWindowLevel();
    });

    // Modified blur handler to prevent immediate hiding during repositioning
    this.mainWindow.on('blur', () => {
      // Add a small delay to prevent hiding during window repositioning
      setTimeout(() => {
        // Only hide if the window is still unfocused after the delay
        if (this.mainWindow && !this.mainWindow.isDestroyed() && !this.mainWindow.isFocused()) {
          console.log('😴 Main window lost focus, hiding...');
          this.mainWindow.hide();
        }
      }, 100);
    // Hide when losing focus (clicking outside)
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

  ensureCorrectWindowLevel() {
    const currentPosition = this.settingsService.getWindowPosition();
    if (currentPosition === 'bottom') {
      console.log('🔧 Reapplying bottom position window level');
      this.mainWindow.setAlwaysOnTop(true, 'pop-up-menu');
      
      // Reapply bounds for bottom position on current display
      if (this.currentDisplay) {
        const { x: screenX, y: screenY, width: screenWidth, height: screenHeight } = this.currentDisplay.bounds;
        const bottomBarHeight = 300;
        
        this.mainWindow.setBounds({
          x: screenX,
          y: screenY + screenHeight - bottomBarHeight,
          width: screenWidth,
          height: bottomBarHeight
        });
      }
    } else {
      this.mainWindow.setAlwaysOnTop(true, 'screen-saver');
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

  hideMainWindow() {
    if (this.mainWindow) {
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
}

module.exports = WindowManager;