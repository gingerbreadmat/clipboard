const { screen } = require('electron');

class DisplayDetector {
  constructor() {
    this.displays = [];
    this.primaryDisplay = null;
    this.changeListeners = new Set();
    this.lastDisplayCount = 0;
    
    this.initializeDisplays();
    this.setupDisplayListeners();
    
    console.log('📺 Display Detector initialized');
  }

  /**
   * Initialize display information
   */
  initializeDisplays() {
    try {
      this.displays = screen.getAllDisplays();
      this.primaryDisplay = screen.getPrimaryDisplay();
      this.lastDisplayCount = this.displays.length;
      
      console.log(`📺 Initialized with ${this.displays.length} displays`);
      console.log(`📺 Primary display: ${this.primaryDisplay.id}`);
      
      this.displays.forEach((display, index) => {
        console.log(`📺 Display ${index + 1}: ${display.bounds.width}x${display.bounds.height} at (${display.bounds.x}, ${display.bounds.y})`);
      });
    } catch (error) {
      console.error('❌ Error initializing displays:', error);
      // Fallback to empty arrays
      this.displays = [];
      this.primaryDisplay = null;
    }
  }

  /**
   * Setup listeners for display changes
   */
  setupDisplayListeners() {
    screen.on('display-added', (event, newDisplay) => {
      console.log('📺 Display added:', newDisplay.id);
      this.handleDisplayAdded(newDisplay);
    });

    screen.on('display-removed', (event, oldDisplay) => {
      console.log('📺 Display removed:', oldDisplay.id);
      this.handleDisplayRemoved(oldDisplay);
    });

    screen.on('display-metrics-changed', (event, display, changedMetrics) => {
      console.log('📺 Display metrics changed:', display.id, changedMetrics);
      this.handleDisplayMetricsChanged(display, changedMetrics);
    });
  }

  /**
   * Handle display added event
   */
  handleDisplayAdded(newDisplay) {
    this.refreshDisplays();
    this.notifyDisplayChange({
      type: 'added',
      display: newDisplay,
      allDisplays: this.displays
    });
  }

  /**
   * Handle display removed event
   */
  handleDisplayRemoved(oldDisplay) {
    this.refreshDisplays();
    this.notifyDisplayChange({
      type: 'removed',
      display: oldDisplay,
      allDisplays: this.displays
    });
  }

  /**
   * Handle display metrics changed event
   */
  handleDisplayMetricsChanged(display, changedMetrics) {
    this.refreshDisplays();
    this.notifyDisplayChange({
      type: 'metrics-changed',
      display: display,
      changedMetrics: changedMetrics,
      allDisplays: this.displays
    });
  }

  /**
   * Refresh display information
   */
  refreshDisplays() {
    try {
      const oldDisplayCount = this.displays.length;
      this.displays = screen.getAllDisplays();
      this.primaryDisplay = screen.getPrimaryDisplay();
      
      const newDisplayCount = this.displays.length;
      
      if (oldDisplayCount !== newDisplayCount) {
        console.log(`📺 Display count changed: ${oldDisplayCount} → ${newDisplayCount}`);
      }
      
      this.lastDisplayCount = newDisplayCount;
      
    } catch (error) {
      console.error('❌ Error refreshing displays:', error);
    }
  }

  /**
   * Get all displays with metadata
   */
  getAllDisplays() {
    return this.displays.map(display => ({
      id: display.id,
      isPrimary: display.id === this.primaryDisplay?.id,
      bounds: display.bounds,
      workArea: display.workArea,
      scaleFactor: display.scaleFactor,
      rotation: display.rotation,
      touchSupport: display.touchSupport,
      accelerometerSupport: display.accelerometerSupport,
      monochrome: display.monochrome,
      colorDepth: display.colorDepth,
      colorSpace: display.colorSpace
    }));
  }

  /**
   * Get primary display
   */
  getPrimaryDisplay() {
    return this.primaryDisplay;
  }

  /**
   * Get display by ID
   */
  getDisplayById(displayId) {
    return this.displays.find(display => display.id === displayId);
  }

  /**
   * Get display at specific coordinates
   */
  getDisplayAtPoint(x, y) {
    return this.displays.find(display => {
      const { x: dispX, y: dispY, width, height } = display.bounds;
      return x >= dispX && x <= dispX + width && y >= dispY && y <= dispY + height;
    });
  }

  /**
   * Get the largest display by area
   */
  getLargestDisplay() {
    if (this.displays.length === 0) return null;
    
    return this.displays.reduce((largest, current) => {
      const currentArea = current.bounds.width * current.bounds.height;
      const largestArea = largest.bounds.width * largest.bounds.height;
      return currentArea > largestArea ? current : largest;
    });
  }

  /**
   * Get the display with the highest resolution
   */
  getHighestResolutionDisplay() {
    if (this.displays.length === 0) return null;
    
    return this.displays.reduce((highest, current) => {
      const currentPixels = current.bounds.width * current.bounds.height * current.scaleFactor;
      const highestPixels = highest.bounds.width * highest.bounds.height * highest.scaleFactor;
      return currentPixels > highestPixels ? current : highest;
    });
  }

  /**
   * Check if point is within any display
   */
  isPointOnAnyDisplay(x, y) {
    return this.displays.some(display => {
      const { x: dispX, y: dispY, width, height } = display.bounds;
      return x >= dispX && x <= dispX + width && y >= dispY && y <= dispY + height;
    });
  }

  /**
   * Get display configuration info
   */
  getDisplayConfiguration() {
    const displays = this.getAllDisplays();
    const totalArea = displays.reduce((area, display) => {
      return area + (display.bounds.width * display.bounds.height);
    }, 0);
    
    const arrangement = this.analyzeDisplayArrangement();
    
    return {
      displayCount: displays.length,
      totalArea,
      arrangement,
      hasMultipleDisplays: displays.length > 1,
      hasHighDPI: displays.some(d => d.scaleFactor > 1),
      hasVariableScaling: new Set(displays.map(d => d.scaleFactor)).size > 1,
      resolutions: displays.map(d => `${d.bounds.width}x${d.bounds.height}`),
      scalingFactors: displays.map(d => d.scaleFactor),
      primary: this.primaryDisplay?.id
    };
  }

  /**
   * Analyze how displays are arranged (horizontal, vertical, mixed)
   */
  analyzeDisplayArrangement() {
    if (this.displays.length <= 1) {
      return 'single';
    }

    const positions = this.displays.map(d => ({
      id: d.id,
      x: d.bounds.x,
      y: d.bounds.y,
      right: d.bounds.x + d.bounds.width,
      bottom: d.bounds.y + d.bounds.height
    }));

    // Sort by position
    const sortedByX = [...positions].sort((a, b) => a.x - b.x);
    const sortedByY = [...positions].sort((a, b) => a.y - b.y);

    // Check if displays are primarily arranged horizontally
    const isHorizontal = sortedByX.every((pos, index) => {
      if (index === 0) return true;
      const prev = sortedByX[index - 1];
      return Math.abs(pos.y - prev.y) < 100; // Allow some tolerance
    });

    // Check if displays are primarily arranged vertically
    const isVertical = sortedByY.every((pos, index) => {
      if (index === 0) return true;
      const prev = sortedByY[index - 1];
      return Math.abs(pos.x - prev.x) < 100; // Allow some tolerance
    });

    if (isHorizontal && !isVertical) return 'horizontal';
    if (isVertical && !isHorizontal) return 'vertical';
    if (isHorizontal && isVertical) return 'grid';
    return 'mixed';
  }

  /**
   * Find the best display for positioning a window
   */
  findBestDisplayForWindow(preferredDisplayId = null, cursorPosition = null) {
    // 1. Try preferred display if specified
    if (preferredDisplayId) {
      const preferred = this.getDisplayById(preferredDisplayId);
      if (preferred) {
        console.log(`📺 Using preferred display: ${preferredDisplayId}`);
        return preferred;
      }
    }

    // 2. Try display at cursor position
    if (cursorPosition) {
      const cursorDisplay = this.getDisplayAtPoint(cursorPosition.x, cursorPosition.y);
      if (cursorDisplay) {
        console.log(`📺 Using cursor display: ${cursorDisplay.id}`);
        return cursorDisplay;
      }
    }

    // 3. Fall back to primary display
    if (this.primaryDisplay) {
      console.log(`📺 Using primary display: ${this.primaryDisplay.id}`);
      return this.primaryDisplay;
    }

    // 4. Last resort: first available display
    if (this.displays.length > 0) {
      console.log(`📺 Using first available display: ${this.displays[0].id}`);
      return this.displays[0];
    }

    console.error('❌ No displays available');
    return null;
  }

  /**
   * Get comprehensive display info for debugging
   */
  getDisplayDebugInfo() {
    return {
      displays: this.getAllDisplays(),
      primary: this.primaryDisplay?.id,
      configuration: this.getDisplayConfiguration(),
      lastCount: this.lastDisplayCount,
      listenerCount: this.changeListeners.size,
      supportsHiDPI: this.displays.some(d => d.scaleFactor > 1),
      totalResolution: this.displays.reduce((total, d) => {
        return total + (d.bounds.width * d.bounds.height);
      }, 0)
    };
  }

  /**
   * Check if display configuration has changed since last check
   */
  hasDisplayConfigurationChanged() {
    const currentDisplays = screen.getAllDisplays();
    
    if (currentDisplays.length !== this.displays.length) {
      return true;
    }

    // Check if any display bounds have changed
    return currentDisplays.some(current => {
      const stored = this.displays.find(d => d.id === current.id);
      if (!stored) return true;
      
      return (
        stored.bounds.x !== current.bounds.x ||
        stored.bounds.y !== current.bounds.y ||
        stored.bounds.width !== current.bounds.width ||
        stored.bounds.height !== current.bounds.height ||
        stored.scaleFactor !== current.scaleFactor
      );
    });
  }

  /**
   * Validate that a display still exists
   */
  isDisplayValid(displayId) {
    return this.displays.some(display => display.id === displayId);
  }

  /**
   * Get recommended display for specific positioning mode
   */
  getRecommendedDisplayForMode(mode, cursorPosition = null) {
    switch (mode) {
      case 'cursor':
      case 'cursor-edge':
        // Use display at cursor
        return this.getDisplayAtPoint(cursorPosition?.x || 0, cursorPosition?.y || 0) || this.primaryDisplay;
      
      case 'window':
        // Use largest display for free windows
        return this.getLargestDisplay() || this.primaryDisplay;
      
      default:
        // Use primary for fixed positioning
        return this.primaryDisplay;
    }
  }

  /**
   * Add listener for display changes
   */
  addDisplayChangeListener(callback) {
    this.changeListeners.add(callback);
    console.log(`📺 Added display change listener (${this.changeListeners.size} total)`);
  }

  /**
   * Remove display change listener
   */
  removeDisplayChangeListener(callback) {
    this.changeListeners.delete(callback);
    console.log(`📺 Removed display change listener (${this.changeListeners.size} total)`);
  }

  /**
   * Notify all listeners of display changes
   */
  notifyDisplayChange(changeData) {
    console.log('📺 Notifying display change:', changeData.type);
    
    this.changeListeners.forEach(callback => {
      try {
        callback(changeData);
      } catch (error) {
        console.error('❌ Error in display change listener:', error);
      }
    });
  }

  /**
   * Force refresh of all display information
   */
  forceRefresh() {
    console.log('📺 Force refreshing display information...');
    this.refreshDisplays();
    
    this.notifyDisplayChange({
      type: 'force-refresh',
      allDisplays: this.displays
    });
  }

  /**
   * Clean up resources
   */
  destroy() {
    console.log('📺 Destroying display detector...');
    
    // Remove all screen listeners
    screen.removeAllListeners('display-added');
    screen.removeAllListeners('display-removed'); 
    screen.removeAllListeners('display-metrics-changed');
    
    // Clear internal state
    this.changeListeners.clear();
    this.displays = [];
    this.primaryDisplay = null;
    
    console.log('✅ Display detector destroyed');
  }
}

module.exports = DisplayDetector;