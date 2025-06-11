const { screen } = require('electron');

class CursorTracker {
  constructor() {
    this.lastCursorPosition = null;
    this.lastDisplayId = null;
    this.cursorListeners = new Set();
    console.log('🖱️ Cursor Tracker initialized');
  }

  /**
   * Get current cursor position
   */
  getCurrentCursorPosition() {
    try {
      const position = screen.getCursorScreenPoint();
      this.lastCursorPosition = position;
      console.log(`🖱️ Current cursor position: ${position.x}, ${position.y}`);
      return position;
    } catch (error) {
      console.error('❌ Error getting cursor position:', error);
      return this.lastCursorPosition || { x: 0, y: 0 };
    }
  }

  /**
   * Get the display that contains the cursor
   */
  getDisplayAtCursor(cursorPosition = null) {
    if (!cursorPosition) {
      cursorPosition = this.getCurrentCursorPosition();
    }

    const displays = screen.getAllDisplays();
    
    // Find the display that contains the cursor
    const targetDisplay = displays.find(display => {
      const { x, y, width, height } = display.bounds;
      return cursorPosition.x >= x && 
             cursorPosition.x < x + width && 
             cursorPosition.y >= y && 
             cursorPosition.y < y + height;
    });
    
    if (targetDisplay) {
      if (this.lastDisplayId !== targetDisplay.id) {
        console.log(`📺 Cursor moved to display: ${targetDisplay.id}`);
        this.lastDisplayId = targetDisplay.id;
        this.notifyCursorDisplayChange(targetDisplay);
      }
      return targetDisplay;
    }
    
    // Fallback to primary display if cursor position detection fails
    console.warn('⚠️ Cursor position not found on any display, using primary');
    const primaryDisplay = screen.getPrimaryDisplay();
    this.lastDisplayId = primaryDisplay.id;
    return primaryDisplay;
  }

  /**
   * Check if cursor has moved to a different display
   */
  hasDisplayChanged(previousDisplayId) {
    const currentDisplay = this.getDisplayAtCursor();
    return currentDisplay.id !== previousDisplayId;
  }

  /**
   * Get cursor position relative to a specific display
   */
  getCursorRelativeToDisplay(display, cursorPosition = null) {
    if (!cursorPosition) {
      cursorPosition = this.getCurrentCursorPosition();
    }

    if (!display || !display.bounds) {
      console.error('❌ Invalid display for relative cursor calculation');
      return { x: 0, y: 0 };
    }

    const relativePosition = {
      x: cursorPosition.x - display.bounds.x,
      y: cursorPosition.y - display.bounds.y
    };

    console.log(`🖱️ Cursor relative to display ${display.id}: ${relativePosition.x}, ${relativePosition.y}`);
    return relativePosition;
  }

  /**
   * Get cursor position as percentage of display dimensions
   */
  getCursorPercentageOnDisplay(display, cursorPosition = null) {
    const relativePosition = this.getCursorRelativeToDisplay(display, cursorPosition);
    
    if (!display || !display.bounds) {
      return { x: 0.5, y: 0.5 }; // Center if invalid
    }

    const percentage = {
      x: Math.max(0, Math.min(1, relativePosition.x / display.bounds.width)),
      y: Math.max(0, Math.min(1, relativePosition.y / display.bounds.height))
    };

    return percentage;
  }

  /**
   * Determine which edge of the display the cursor is closest to
   */
  getNearestDisplayEdge(display, cursorPosition = null) {
    const relativePosition = this.getCursorRelativeToDisplay(display, cursorPosition);
    
    if (!display || !display.bounds) {
      return 'left'; // Default
    }

    const { width, height } = display.bounds;
    
    // Calculate distances to each edge
    const distanceToLeft = relativePosition.x;
    const distanceToRight = width - relativePosition.x;
    const distanceToTop = relativePosition.y;
    const distanceToBottom = height - relativePosition.y;
    
    const minDistance = Math.min(distanceToLeft, distanceToRight, distanceToTop, distanceToBottom);
    
    if (minDistance === distanceToLeft) {
      return 'left';
    } else if (minDistance === distanceToRight) {
      return 'right';
    } else if (minDistance === distanceToTop) {
      return 'top';
    } else {
      return 'bottom';
    }
  }

  /**
   * Check if cursor is in a corner of the display
   */
  isInDisplayCorner(display, cursorPosition = null, cornerThreshold = 0.2) {
    const percentage = this.getCursorPercentageOnDisplay(display, cursorPosition);
    
    // Check if cursor is within corner threshold from any corner
    const isNearLeftEdge = percentage.x <= cornerThreshold;
    const isNearRightEdge = percentage.x >= (1 - cornerThreshold);
    const isNearTopEdge = percentage.y <= cornerThreshold;
    const isNearBottomEdge = percentage.y >= (1 - cornerThreshold);
    
    if (isNearLeftEdge && isNearTopEdge) return 'top-left';
    if (isNearRightEdge && isNearTopEdge) return 'top-right';
    if (isNearLeftEdge && isNearBottomEdge) return 'bottom-left';
    if (isNearRightEdge && isNearBottomEdge) return 'bottom-right';
    
    return null; // Not in a corner
  }

  /**
   * Start tracking cursor movement for real-time updates
   */
  startTracking(intervalMs = 100) {
    if (this.trackingInterval) {
      this.stopTracking();
    }

    console.log(`🖱️ Starting cursor tracking with ${intervalMs}ms interval`);
    
    this.trackingInterval = setInterval(() => {
      const currentPosition = this.getCurrentCursorPosition();
      const currentDisplay = this.getDisplayAtCursor(currentPosition);
      
      // Notify listeners of cursor updates
      this.notifyCursorUpdate(currentPosition, currentDisplay);
    }, intervalMs);
  }

  /**
   * Stop tracking cursor movement
   */
  stopTracking() {
    if (this.trackingInterval) {
      clearInterval(this.trackingInterval);
      this.trackingInterval = null;
      console.log('🖱️ Stopped cursor tracking');
    }
  }

  /**
   * Add listener for cursor updates
   */
  addCursorListener(callback) {
    this.cursorListeners.add(callback);
    console.log(`🖱️ Added cursor listener (${this.cursorListeners.size} total)`);
  }

  /**
   * Remove cursor listener
   */
  removeCursorListener(callback) {
    this.cursorListeners.delete(callback);
    console.log(`🖱️ Removed cursor listener (${this.cursorListeners.size} total)`);
  }

  /**
   * Notify all listeners of cursor updates
   */
  notifyCursorUpdate(position, display) {
    this.cursorListeners.forEach(callback => {
      try {
        callback({
          position,
          display,
          relative: this.getCursorRelativeToDisplay(display, position),
          percentage: this.getCursorPercentageOnDisplay(display, position),
          nearestEdge: this.getNearestDisplayEdge(display, position),
          corner: this.isInDisplayCorner(display, position)
        });
      } catch (error) {
        console.error('❌ Error in cursor listener:', error);
      }
    });
  }

  /**
   * Notify listeners when cursor changes displays
   */
  notifyCursorDisplayChange(newDisplay) {
    this.cursorListeners.forEach(callback => {
      try {
        if (callback.onDisplayChange) {
          callback.onDisplayChange(newDisplay, this.lastDisplayId);
        }
      } catch (error) {
        console.error('❌ Error in display change listener:', error);
      }
    });
  }

  /**
   * Get cursor information for debugging
   */
  getCursorDebugInfo() {
    const position = this.getCurrentCursorPosition();
    const display = this.getDisplayAtCursor(position);
    
    return {
      position,
      display: {
        id: display.id,
        bounds: display.bounds,
        isPrimary: display === screen.getPrimaryDisplay()
      },
      relative: this.getCursorRelativeToDisplay(display, position),
      percentage: this.getCursorPercentageOnDisplay(display, position),
      nearestEdge: this.getNearestDisplayEdge(display, position),
      corner: this.isInDisplayCorner(display, position),
      isTracking: !!this.trackingInterval,
      listenerCount: this.cursorListeners.size
    };
  }

  /**
   * Predict where cursor might move based on velocity (future enhancement)
   */
  predictCursorMovement(historyMs = 500) {
    // This could be enhanced to track cursor velocity and predict movement
    // For now, just return current position
    return this.getCurrentCursorPosition();
  }

  /**
   * Check if cursor is moving rapidly (for optimization)
   */
  isCursorMovingRapidly(threshold = 50) {
    // This could track cursor velocity to optimize when to update window positioning
    // For now, always return false
    return false;
  }

  /**
   * Clean up resources
   */
  destroy() {
    console.log('🖱️ Destroying cursor tracker...');
    this.stopTracking();
    this.cursorListeners.clear();
    this.lastCursorPosition = null;
    this.lastDisplayId = null;
    console.log('✅ Cursor tracker destroyed');
  }
}

module.exports = CursorTracker;