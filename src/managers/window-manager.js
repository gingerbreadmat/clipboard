const { BrowserWindow, screen } = require('electron');
const path = require('path');

class WindowManager {
  constructor(settingsService, dockService) {
    this.settingsService = settingsService;
    this.dockService = dockService;
    this.mainWindow = null;
    this.settingsWindow = null;
    this.nativeWindowManager = null;
    
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
    
    // Get the primary display's FULL bounds (includes dock/menu bar areas)
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width: screenWidth, height: screenHeight } = primaryDisplay.bounds;
    const { x: screenX, y: screenY } = primaryDisplay.bounds;
    
    console.log(`📺 Screen dimensions: ${screenWidth}x${screenHeight} at (${screenX}, ${screenY})`);
    
    // Get stored position
    const storedPosition = this.settingsService.getWindowPosition();
    console.log('📍 Using stored position:', storedPosition);
    
    // Calculate initial bounds
    const initialBounds = this.calculateWindowBounds(storedPosition, {
      screenX, screenY, screenWidth, screenHeight
    });
    
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
      transparent: true,
      vibrancy: 'sidebar',
      alwaysOnTop: true,
      skipTaskbar: true,
      level: 'screen-saver'
    });

    console.log('📄 Loading index.html...');
    this.mainWindow.loadFile('renderer/index.html');

    this.setupMainWindowEventHandlers();
    
    return this.mainWindow;
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
    
    this.settingsWindow = new BrowserWindow({
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
      this.mainWindow.webContents.send('window-shown');
      
      // Apply current theme when window is shown
      const currentTheme = this.settingsService.getTheme();
      this.mainWindow.webContents.send('theme-changed', currentTheme);
      
      // Ensure correct window level based on position
      this.ensureCorrectWindowLevel();
    });

    // Hide when losing focus (clicking outside)
    this.mainWindow.on('blur', () => {
      console.log('😴 Main window lost focus, hiding...');
      this.mainWindow.hide();
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

  calculateWindowBounds(position, screen) {
    const { screenX, screenY, screenWidth, screenHeight } = screen;
    const sidebarWidth = 350;
    const sidebarHeight = screenHeight;
    
    switch (position) {
      case 'right':
        return {
          x: screenX + screenWidth - sidebarWidth,
          y: screenY,
          width: sidebarWidth,
          height: sidebarHeight
        };
      case 'top':
        return {
          x: screenX,
          y: screenY,
          width: screenWidth,
          height: 300
        };
      case 'bottom':
        return {
          x: screenX,
          y: screenY + screenHeight - 300,
          width: screenWidth,
          height: 300
        };
      case 'window':
        return {
          x: screenX + 100,
          y: screenY + 100,
          width: 400,
          height: 600
        };
      default: // 'left'
        return {
          x: screenX,
          y: screenY,
          width: sidebarWidth,
          height: sidebarHeight
        };
    }
  }

  applyWindowPosition(position) {
    console.log('📍 Applying window position:', position);
    
    if (!this.mainWindow) return;
    
    // Get the primary display bounds
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width: screenWidth, height: screenHeight } = primaryDisplay.bounds;
    const { x: screenX, y: screenY } = primaryDisplay.bounds;
    
    // Get the work area (excludes dock/menu bar)
    const workArea = primaryDisplay.workArea;
    console.log('📺 Screen bounds:', { screenWidth, screenHeight, screenX, screenY });
    console.log('💼 Work area:', workArea);
    
    // Use native APIs to get more accurate screen info if available
    if (this.nativeWindowManager) {
      try {
        const nativeScreenInfo = this.nativeWindowManager.getScreenInfo();
        console.log('🔍 Native screen info:', nativeScreenInfo);
      } catch (error) {
        console.log('⚠️ Could not get native screen info:', error);
      }
    }
    
    const newBounds = this.calculateWindowBounds(position, {
      screenX, screenY, screenWidth, screenHeight
    });
    
    if (position === 'bottom') {
      console.log('🚨 DEBUG: Entering bottom case in NEW CODE');
      
      // NATIVE API APPROACH - Try this first!
      if (this.nativeWindowManager && process.platform === 'darwin') {
        console.log('🔧 Using native APIs to position window over dock');
        
        // Set initial bounds
        this.mainWindow.setBounds(newBounds);
        
        setTimeout(() => {
          try {
            const windowId = this.mainWindow.getNativeWindowHandle().readInt32LE(0);
            console.log('🔍 Window ID:', windowId);
            
            const success = this.nativeWindowManager.forceWindowOverDock(
              windowId,
              newBounds.x,
              newBounds.y,
              newBounds.width,
              newBounds.height
            );
            
            if (success) {
              console.log('✅ Successfully positioned window over dock using native APIs - NO FLASHING!');
            } else {
              console.log('❌ Native positioning failed, falling back to dock hiding');
              // Fallback to dock hiding approach
              this.mainWindow.setAlwaysOnTop(true, 'pop-up-menu');
              this.dockService.setDockVisibility(false);
            }
          } catch (error) {
            console.error('❌ Error using native window positioning:', error);
            console.log('🔄 Falling back to dock hiding approach');
            // Fallback to dock hiding approach
            this.mainWindow.setAlwaysOnTop(true, 'pop-up-menu');
            this.dockService.setDockVisibility(false);
          }
        }, 100);
        
        return; // Exit early - don't do regular positioning
      } else {
        console.log('⚠️ Native APIs not available, falling back to dock hiding approach');
        // Fallback to the dock hiding approach
        setTimeout(() => {
          this.mainWindow.setAlwaysOnTop(true, 'pop-up-menu');
          this.dockService.setDockVisibility(false);
        }, 100);
        return; // Exit early
      }
    }
    
    console.log('📍 Setting window bounds:', newBounds);
    this.mainWindow.setBounds(newBounds);
    
    // For non-window modes, ensure it stays as a sidebar
    if (position !== 'window') {
      this.mainWindow.setResizable(false);
      this.mainWindow.setMovable(false);
      this.mainWindow.setMinimizable(false);
      this.mainWindow.setMaximizable(false);
      
      // Use different window levels based on position
      if (position === 'bottom') {
        // Use highest window level but DON'T hide dock to avoid flashing
        this.mainWindow.setAlwaysOnTop(true, 'status'); // Try 'status' level
      } else {
        // For non-bottom positions, restore dock if it was hidden
        this.dockService.setDockVisibility(true);
        this.mainWindow.setAlwaysOnTop(true, 'screen-saver');
      }
    }
  }

  ensureCorrectWindowLevel() {
    const currentPosition = this.settingsService.getWindowPosition();
    if (currentPosition === 'bottom') {
      console.log('🔧 Reapplying bottom position window level');
      this.mainWindow.setAlwaysOnTop(true, 'pop-up-menu');
      
      // Reapply bounds for bottom position
      const primaryDisplay = screen.getPrimaryDisplay();
      const { width: screenWidth, height: screenHeight } = primaryDisplay.bounds;
      const { x: screenX, y: screenY } = primaryDisplay.bounds;
      const bottomBarHeight = 300;
      
      this.mainWindow.setBounds({
        x: screenX,
        y: screenY + screenHeight - bottomBarHeight,
        width: screenWidth,
        height: bottomBarHeight
      });
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

  // Utility methods
  showMainWindow() {
    if (this.mainWindow) {
      this.mainWindow.show();
      this.mainWindow.focus();
    }
  }

  hideMainWindow() {
    if (this.mainWindow) {
      this.mainWindow.hide();
    }
  }

  toggleMainWindow() {
    if (this.mainWindow) {
      if (this.mainWindow.isVisible()) {
        this.hideMainWindow();
      } else {
        this.showMainWindow();
      }
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