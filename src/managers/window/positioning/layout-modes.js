class LayoutModes {
  constructor() {
    this.currentMode = null;
    this.modeListeners = new Set();
    console.log('📐 Layout Modes initialized');
  }

  /**
   * Detect layout mode based on window dimensions
   */
  detectLayoutMode(windowWidth, windowHeight) {
    let mode = 'portrait'; // Default sidebar mode
    
    // Very wide = landscape (bottom bar)
    if (windowWidth > windowHeight * 1.8) {
      mode = 'landscape';
    }
    // More square/balanced = window mode  
    else if (Math.abs(windowWidth - windowHeight) < windowWidth * 0.3) {
      mode = 'window';
    }
    // Otherwise portrait (sidebar)
    
    console.log(`📐 Detected mode: ${mode} (${windowWidth}x${windowHeight})`);
    
    // Notify if mode changed
    if (this.currentMode !== mode) {
      const previousMode = this.currentMode;
      this.currentMode = mode;
      this.notifyModeChange(mode, previousMode);
    }
    
    return mode;
  }

  /**
   * Get layout characteristics for a position mode
   */
  getLayoutCharacteristics(positionMode, displayBounds) {
    const characteristics = {
      isFullWidth: false,
      isFullHeight: false,
      allowsHorizontalScroll: false,
      allowsVerticalScroll: true,
      preferredOrientation: 'portrait',
      cardLayout: 'vertical-stack',
      headerLayout: 'default'
    };

    switch (positionMode) {
      case 'top':
      case 'bottom':
        characteristics.isFullWidth = true;
        characteristics.isFullHeight = false;
        characteristics.allowsHorizontalScroll = true;
        characteristics.allowsVerticalScroll = false;
        characteristics.preferredOrientation = 'landscape';
        characteristics.cardLayout = 'horizontal-scroll';
        characteristics.headerLayout = 'centered';
        break;

      case 'left':
      case 'right':
        characteristics.isFullWidth = false;
        characteristics.isFullHeight = true;
        characteristics.allowsHorizontalScroll = false;
        characteristics.allowsVerticalScroll = true;
        characteristics.preferredOrientation = 'portrait';
        characteristics.cardLayout = 'vertical-stack';
        characteristics.headerLayout = 'default';
        break;

      case 'window':
        // Determine based on window dimensions
        if (displayBounds) {
          const aspectRatio = displayBounds.width / displayBounds.height;
          if (aspectRatio > 1.5) {
            characteristics.preferredOrientation = 'landscape';
            characteristics.cardLayout = 'grid';
            characteristics.allowsHorizontalScroll = true;
          } else {
            characteristics.preferredOrientation = 'portrait';
            characteristics.cardLayout = 'vertical-stack';
          }
        }
        characteristics.headerLayout = 'default';
        break;

      case 'cursor':
      case 'cursor-edge':
      default:
        // Dynamic based on calculated bounds
        if (displayBounds) {
          const aspectRatio = displayBounds.width / displayBounds.height;
          if (aspectRatio > 1.8) {
            characteristics.isFullWidth = true;
            characteristics.allowsHorizontalScroll = true;
            characteristics.preferredOrientation = 'landscape';
            characteristics.cardLayout = 'horizontal-scroll';
            characteristics.headerLayout = 'centered';
          }
        }
        break;
    }

    console.log(`📐 Layout characteristics for ${positionMode}:`, characteristics);
    return characteristics;
  }

  /**
   * Get responsive dimensions based on layout mode
   */
  getResponsiveDimensions(mode, displayBounds) {
    if (!displayBounds) {
      return this.getDefaultDimensions();
    }

    const { width: screenWidth, height: screenHeight } = displayBounds;
    
    switch (mode) {
      case 'landscape':
        return {
          cardWidth: this.calculateCardWidth(screenWidth, 'landscape'),
          cardHeight: Math.max(200, screenHeight - 120), // Fill most of height
          containerPadding: { x: 16, y: 12 },
          gap: 12,
          headerHeight: 56
        };

      case 'window':
        return {
          cardWidth: this.calculateCardWidth(screenWidth, 'window'),
          cardHeight: this.calculateCardHeight(screenHeight, 'window'),
          containerPadding: { x: 12, y: 12 },
          gap: 16,
          headerHeight: 64
        };

      case 'portrait':
      default:
        return {
          cardWidth: this.calculateCardWidth(screenWidth, 'portrait'),
          cardHeight: this.calculateCardHeight(screenHeight, 'portrait'),
          containerPadding: { x: 12, y: 12 },
          gap: 12,
          headerHeight: 64
        };
    }
  }

  /**
   * Calculate optimal card width for layout mode
   */
  calculateCardWidth(screenWidth, mode) {
    switch (mode) {
      case 'landscape':
        // Cards in horizontal scroll should be consistent width
        return Math.max(240, Math.min(320, screenWidth * 0.2));

      case 'window':
        // Grid layout - fit multiple columns
        const cols = Math.floor(screenWidth / 280);
        const availableWidth = screenWidth - 48; // Account for padding
        return Math.max(260, Math.floor(availableWidth / Math.max(1, cols)) - 16);

      case 'portrait':
      default:
        // Single column - use most of the width
        return Math.max(300, Math.min(400, screenWidth - 32));
    }
  }

  /**
   * Calculate optimal card height for layout mode
   */
  calculateCardHeight(screenHeight, mode) {
    switch (mode) {
      case 'landscape':
        // Use most of available height
        return Math.max(200, screenHeight - 120);

      case 'window':
        // Moderate height for grid layout
        return Math.max(180, Math.min(250, screenHeight * 0.3));

      case 'portrait':
      default:
        // Standard card height
        return Math.max(180, Math.min(220, screenHeight * 0.25));
    }
  }

  /**
   * Get default dimensions when display bounds unavailable
   */
  getDefaultDimensions() {
    return {
      cardWidth: 320,
      cardHeight: 200,
      containerPadding: { x: 12, y: 12 },
      gap: 12,
      headerHeight: 64
    };
  }

  /**
   * Get CSS classes for layout mode
   */
  getCSSClasses(mode, positionMode) {
    const classes = ['clipboard-list'];
    
    if (mode === 'landscape' || positionMode === 'top' || positionMode === 'bottom') {
      classes.push('landscape');
    }
    
    if (mode === 'window' || positionMode === 'window') {
      classes.push('window-mode');
    }
    
    return classes;
  }

  /**
   * Get scroll configuration for layout mode
   */
  getScrollConfiguration(mode, positionMode) {
    const config = {
      horizontal: false,
      vertical: true,
      wheelDirection: 'vertical',
      overflowX: 'hidden',
      overflowY: 'auto'
    };

    if (mode === 'landscape' || positionMode === 'top' || positionMode === 'bottom') {
      config.horizontal = true;
      config.vertical = false;
      config.wheelDirection = 'horizontal';
      config.overflowX = 'auto';
      config.overflowY = 'hidden';
    }

    return config;
  }

  /**
   * Get header configuration for layout mode
   */
  getHeaderConfiguration(mode, positionMode) {
    const config = {
      layout: 'default',
      showStats: true,
      statsPosition: 'separate',
      searchWidth: 'full',
      centerSearch: false
    };

    if (mode === 'landscape' || positionMode === 'top' || positionMode === 'bottom') {
      config.layout = 'horizontal';
      config.statsPosition = 'header';
      config.searchWidth = 'limited';
      config.centerSearch = true;
    }

    return config;
  }

  /**
   * Calculate optimal layout breakpoints
   */
  calculateBreakpoints(displayBounds) {
    if (!displayBounds) {
      return {
        tolandscape: 1400,
        toWindow: 800,
        toPortrait: 400
      };
    }

    const { width, height } = displayBounds;
    
    return {
      toLandscape: Math.round(height * 1.8), // When width > height * 1.8
      toWindow: Math.round(width * 0.7), // When width/height ratio is moderate
      toPortrait: Math.round(width * 0.3) // When height dominates
    };
  }

  /**
   * Check if layout should change based on new dimensions
   */
  shouldChangeLayout(currentMode, newWidth, newHeight) {
    const newMode = this.detectLayoutMode(newWidth, newHeight);
    return currentMode !== newMode;
  }

  /**
   * Get animation preferences for layout transitions
   */
  getTransitionPreferences(fromMode, toMode) {
    return {
      duration: 300,
      easing: 'ease-out',
      staggerCards: fromMode !== toMode,
      fadeContent: true,
      preserveScroll: fromMode === toMode
    };
  }

  /**
   * Add listener for layout mode changes
   */
  addModeChangeListener(callback) {
    this.modeListeners.add(callback);
    console.log(`📐 Added mode change listener (${this.modeListeners.size} total)`);
  }

  /**
   * Remove layout mode change listener
   */
  removeModeChangeListener(callback) {
    this.modeListeners.delete(callback);
    console.log(`📐 Removed mode change listener (${this.modeListeners.size} total)`);
  }

  /**
   * Notify all listeners of mode changes
   */
  notifyModeChange(newMode, previousMode) {
    console.log(`📐 Layout mode changed: ${previousMode} → ${newMode}`);
    
    this.modeListeners.forEach(callback => {
      try {
        callback({
          newMode,
          previousMode,
          timestamp: Date.now()
        });
      } catch (error) {
        console.error('❌ Error in mode change listener:', error);
      }
    });
  }

  /**
   * Get current layout mode
   */
  getCurrentMode() {
    return this.currentMode;
  }

  /**
   * Force set layout mode (for testing)
   */
  setMode(mode) {
    const previousMode = this.currentMode;
    this.currentMode = mode;
    this.notifyModeChange(mode, previousMode);
  }

  /**
   * Get debug information
   */
  getDebugInfo() {
    return {
      currentMode: this.currentMode,
      listenerCount: this.modeListeners.size,
      supportedModes: ['portrait', 'landscape', 'window']
    };
  }

  /**
   * Clean up resources
   */
  destroy() {
    console.log('📐 Destroying layout modes...');
    this.modeListeners.clear();
    this.currentMode = null;
    console.log('✅ Layout modes destroyed');
  }
}

module.exports = LayoutModes;