class MainWindowEvents {
  constructor(settingsService, dockService) {
    this.settingsService = settingsService;
    this.dockService = dockService;
    this.windowManager = null;
    console.log('📱 Main Window Events initialized');
  }

  /**
   * Setup all event handlers for main window
   */
  setupEventHandlers(window, windowManager) {
    this.window = window;
    this.windowManager = windowManager;
    
    this.setupReadyToShowHandler();
    this.setupCloseHandler();
    this.setupShowHandler();
    this.setupBlurHandler();
    this.setupWebContentsHandlers();
    
    console.log('✅ Main window event handlers setup complete');
  }

  /**
   * Handle ready-to-show event
   */
  setupReadyToShowHandler() {
    this.window.once('ready-to-show', () => {
      console.log('✅ Main window ready to show');
      
      const currentPosition = this.settingsService.getWindowPosition();
      console.log('🔧 Ready-to-show: Applying position logic for:', currentPosition);
      
      // Set up space management for macOS
      if (process.platform === 'darwin') {
        try {
          this.window.setVisibleOnAllWorkspaces(false);
          
          // Set collection behavior for proper space handling
          this.window.setCollectionBehavior([
            'moveToActiveSpace',
            'managed',
            'participatesInCycle'
          ]);
          
          console.log('✅ Space management configured');
        } catch (error) {
          console.error('❌ Error configuring space management:', error);
        }
      }
      
      // Set correct window level based on position
      this.applyWindowLevelForPosition(currentPosition);
      
      // Force hide traffic light buttons
      this.hideTrafficLightButtons();
    });
  }

  /**
   * Handle window close event
   */
  setupCloseHandler() {
    this.window.on('close', (event) => {
      const { app } = require('electron');
      if (!app.isQuiting) {
        event.preventDefault();
        this.window.hide();
        console.log('🙈 Main window hidden');
      } else {
        console.log('💀 Main window closing - app is quitting');
      }
    });
  }

  /**
   * Handle window show event
   */
  setupShowHandler() {
    this.window.on('show', () => {
      console.log('👁️ Main window shown');
      
      // Ensure proper space behavior when shown
      if (process.platform === 'darwin') {
        this.window.setVisibleOnAllWorkspaces(false);
        this.window.moveTop();
        
        // Reapply collection behavior to ensure it sticks
        try {
          this.window.setCollectionBehavior([
            'moveToActiveSpace',
            'managed', 
            'participatesInCycle'
          ]);
        } catch (error) {
          console.error('❌ Error reapplying collection behavior:', error);
        }
      }
      
      // Send events to renderer
      this.window.webContents.send('window-shown');
      
      // Apply current theme when window is shown
      const currentTheme = this.settingsService.getTheme();
      this.window.webContents.send('theme-changed', currentTheme);
      
      // Ensure correct window level based on position
      this.ensureCorrectWindowLevel();
    });
  }

  /**
   * Handle window blur event
   */
  setupBlurHandler() {
    this.window.on('blur', () => {
      // Add a small delay to prevent hiding during window repositioning
      setTimeout(() => {
        // Only hide if the window is still unfocused after the delay
        if (this.window && !this.window.isDestroyed() && !this.window.isFocused()) {
          console.log('😴 Main window lost focus, hiding...');
          this.window.hide();
        }
      }, 100);
    });
  }

  /**
   * Setup web contents event handlers
   */
  setupWebContentsHandlers() {
    this.window.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
      console.error('❌ Main window failed to load:', errorCode, errorDescription);
    });

    this.window.webContents.on('did-finish-load', () => {
      console.log('✅ Main window finished loading');
    });

    this.window.webContents.on('dom-ready', () => {
      console.log('✅ Main window DOM ready');
    });
  }

  /**
   * Apply window level for specific position
   */
  applyWindowLevelForPosition(position) {
    if (position === 'bottom') {
      console.log('🔧 Ready-to-show: Using elevated window level for bottom position');
      this.window.setAlwaysOnTop(true, 'pop-up-menu');
    } else {
      console.log('🔧 Ready-to-show: Using standard window level');
      this.window.setAlwaysOnTop(true, 'screen-saver');
    }
  }

  /**
   * Ensure correct window level is maintained
   */
  ensureCorrectWindowLevel() {
    const currentPosition = this.settingsService.getWindowPosition();
    if (currentPosition === 'bottom') {
      console.log('🔧 Reapplying bottom position window level');
      this.window.setAlwaysOnTop(true, 'pop-up-menu');
      
      // Reapply bounds for bottom position on current display
      if (this.windowManager && this.windowManager.currentDisplay) {
        const { x: screenX, y: screenY, width: screenWidth, height: screenHeight } = this.windowManager.currentDisplay.bounds;
        const bottomBarHeight = 300;
        
        this.window.setBounds({
          x: screenX,
          y: screenY + screenHeight - bottomBarHeight,
          width: screenWidth,
          height: bottomBarHeight
        });
      }
    } else {
      this.window.setAlwaysOnTop(true, 'screen-saver');
    }
  }

  /**
   * Hide traffic light buttons on macOS
   */
  hideTrafficLightButtons() {
    try {
      if (process.platform === 'darwin') {
        this.window.setWindowButtonVisibility(false);
        console.log('✅ Traffic light buttons hidden');
      }
    } catch (error) {
      console.log('⚠️ Could not hide window buttons:', error.message);
    }
  }

  /**
   * Handle theme changes
   */
  onThemeChanged(newTheme) {
    if (this.window && this.window.webContents) {
      this.window.webContents.send('theme-changed', newTheme);
      console.log('🎨 Theme change sent to main window:', newTheme);
    }
  }

  /**
   * Handle position changes
   */
  onPositionChanged(newPosition) {
    this.applyWindowLevelForPosition(newPosition);
    this.ensureCorrectWindowLevel();
    console.log('📍 Position change applied to main window:', newPosition);
  }

  /**
   * Handle display changes
   */
  onDisplayChanged(changeData) {
    console.log('📺 Display change detected in main window:', changeData.type);
    
    if (this.window && this.window.webContents) {
      this.window.webContents.send('display-changed', changeData);
    }
    
    // If displays were added/removed, might need to reposition
    if (changeData.type === 'added' || changeData.type === 'removed') {
      console.log('📺 Display configuration changed, may need repositioning');
      // Could trigger repositioning logic through window manager
    }
  }

  /**
   * Handle horizontal scroll setting changes
   */
  onHorizontalScrollChanged(enabled) {
    if (this.window && this.window.webContents) {
      this.window.webContents.send('horizontal-scroll-changed', enabled);
      console.log('🖱️ Horizontal scroll change sent to main window:', enabled);
    }
  }

  /**
   * Handle clipboard item added
   */
  onClipboardItemAdded(item) {
    if (this.window && this.window.webContents) {
      this.window.webContents.send('clipboard-item-added', item);
      console.log('📋 Clipboard item added event sent to main window');
    }
  }

  /**
   * Handle history cleared
   */
  onHistoryCleared() {
    if (this.window && this.window.webContents) {
      this.window.webContents.send('history-cleared');
      console.log('🧹 History cleared event sent to main window');
    }
  }

  /**
   * Handle copy item from tray
   */
  onCopyItemFromTray(item) {
    if (this.window && this.window.webContents) {
      this.window.webContents.send('copy-item-from-tray', item);
      console.log('📋 Copy item from tray event sent to main window');
    }
  }

  /**
   * Setup keyboard event handlers
   */
  setupKeyboardHandlers() {
    // Handle escape key to hide window
    this.window.webContents.on('before-input-event', (event, input) => {
      if (input.key === 'Escape' && input.type === 'keyDown') {
        this.window.hide();
      }
    });
  }

  /**
   * Setup focus management
   */
  setupFocusManagement() {
    this.window.on('focus', () => {
      console.log('🎯 Main window gained focus');
    });

    this.window.on('blur', () => {
      console.log('😴 Main window lost focus');
    });
  }

  /**
   * Setup window state management
   */
  setupWindowStateHandlers() {
    this.window.on('minimize', () => {
      console.log('📦 Main window minimized');
    });

    this.window.on('restore', () => {
      console.log('📤 Main window restored');
    });

    this.window.on('maximize', () => {
      console.log('📏 Main window maximized');
    });

    this.window.on('unmaximize', () => {
      console.log('📐 Main window unmaximized');
    });
  }

  /**
   * Setup resize handling
   */
  setupResizeHandlers() {
    this.window.on('resize', () => {
      const bounds = this.window.getBounds();
      console.log(`📏 Main window resized to: ${bounds.width}x${bounds.height}`);
      
      // Could notify layout detection system here
      if (this.window.webContents) {
        this.window.webContents.send('window-resized', bounds);
      }
    });

    this.window.on('move', () => {
      const bounds = this.window.getBounds();
      console.log(`📍 Main window moved to: (${bounds.x}, ${bounds.y})`);
      
      if (this.window.webContents) {
        this.window.webContents.send('window-moved', bounds);
      }
    });
  }

  /**
   * Setup enter/leave events
   */
  setupMouseEvents() {
    this.window.on('enter-full-screen', () => {
      console.log('🖥️ Main window entered full screen');
    });

    this.window.on('leave-full-screen', () => {
      console.log('🖥️ Main window left full screen');
    });
  }

  /**
   * Force window to front
   */
  bringToFront() {
    if (this.window && !this.window.isDestroyed()) {
      this.window.show();
      this.window.focus();
      this.window.moveTop();
      console.log('⬆️ Main window brought to front');
    }
  }

  /**
   * Flash window for attention
   */
  flashWindow() {
    if (this.window && !this.window.isDestroyed()) {
      if (process.platform === 'win32') {
        this.window.flashFrame(true);
      } else {
        // For other platforms, briefly change opacity
        const originalOpacity = this.window.getOpacity();
        this.window.setOpacity(0.5);
        setTimeout(() => {
          if (this.window && !this.window.isDestroyed()) {
            this.window.setOpacity(originalOpacity);
          }
        }, 150);
      }
      console.log('⚡ Main window flashed for attention');
    }
  }

  /**
   * Get window state for debugging
   */
  getWindowState() {
    if (!this.window || this.window.isDestroyed()) {
      return null;
    }

    return {
      isVisible: this.window.isVisible(),
      isFocused: this.window.isFocused(),
      isMinimized: this.window.isMinimized(),
      isMaximized: this.window.isMaximized(),
      isFullScreen: this.window.isFullScreen(),
      bounds: this.window.getBounds(),
      opacity: this.window.getOpacity(),
      alwaysOnTop: this.window.isAlwaysOnTop(),
      skipTaskbar: this.window.isSkipTaskbar()
    };
  }

  /**
   * Setup all additional event handlers
   */
  setupAllEventHandlers() {
    this.setupKeyboardHandlers();
    this.setupFocusManagement();
    this.setupWindowStateHandlers();
    this.setupResizeHandlers();
    this.setupMouseEvents();
    console.log('✅ All additional main window event handlers setup');
  }

  /**
   * Remove all event listeners
   */
  removeAllListeners() {
    if (this.window && !this.window.isDestroyed()) {
      this.window.removeAllListeners();
      console.log('🗑️ All main window event listeners removed');
    }
  }

  /**
   * Get event handler debug info
   */
  getDebugInfo() {
    return {
      hasWindow: !!this.window && !this.window.isDestroyed(),
      hasWindowManager: !!this.windowManager,
      hasSettingsService: !!this.settingsService,
      hasDockService: !!this.dockService,
      windowState: this.getWindowState(),
      platform: process.platform
    };
  }

  /**
   * Clean up event handlers
   */
  destroy() {
    console.log('📱 Destroying main window events...');
    
    this.removeAllListeners();
    
    // Clear references
    this.window = null;
    this.windowManager = null;
    this.settingsService = null;
    this.dockService = null;
    
    console.log('✅ Main window events destroyed');
  }
}

module.exports = MainWindowEvents;