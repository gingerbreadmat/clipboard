/**
 * PositionCalculator - Calculates window positions based on cursor and display configuration
 * Extracted from WindowManager for better separation of concerns
 */
class PositionCalculator {
  constructor(dockService) {
    this.dockService = dockService;
    this.originalDockState = null;
    console.log('📐 PositionCalculator initialized');
  }

  /**
   * Calculates window bounds based on position mode, display, and cursor
   * @param {string} position - Position mode (cursor, cursor-edge, left, right, top, bottom, window)
   * @param {Object} display - Target display object
   * @param {Object} cursorPosition - Current cursor position
   * @returns {Object|null} Window bounds or null if calculation fails
   */
  async calculateBounds(position, display, cursorPosition) {
    if (!display || !display.bounds) {
      console.error('❌ Invalid display object');
      return null;
    }
    
    // Store original dock state for restoration later
    await this.storeOriginalDockState();
    
    const { x: screenX, y: screenY, width: screenWidth, height: screenHeight } = display.bounds;
    
    // Validate display bounds
    if (!Number.isFinite(screenX) || !Number.isFinite(screenY) || !Number.isFinite(screenWidth) || !Number.isFinite(screenHeight)) {
      console.error('❌ Invalid display bounds:', display.bounds);
      return null;
    }
    
    // Use full screen space (covering dock if needed)
    const availableSpace = {
      x: screenX,
      y: screenY,
      width: screenWidth,
      height: screenHeight
    };
    
    console.log(`📐 Using full screen space: ${availableSpace.width}x${availableSpace.height} at (${availableSpace.x}, ${availableSpace.y})`);
    
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
          console.warn(`⚠️ Unknown position mode: ${position}, using left`);
          bounds = {
            x: Math.round(screenX),
            y: Math.round(screenY),
            width: Math.round(sidebarWidth),
            height: Math.round(screenHeight)
          };
          break;
      }
      
      if (bounds && this.isValidBounds(bounds)) {
        console.log(`✅ Calculated bounds for ${position}: ${bounds.width}x${bounds.height} at (${bounds.x}, ${bounds.y})`);
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

  /**
   * Calculates bounds near the cursor position
   * @param {Object} cursorPosition - Cursor coordinates
   * @param {Object} availableSpace - Available screen space
   * @param {number} windowWidth - Desired window width
   * @param {number} windowHeight - Desired window height
   * @returns {Object} Window bounds
   */
  calculateCursorProximityBounds(cursorPosition, availableSpace, windowWidth, windowHeight) {
    const margin = 20;
    
    if (!cursorPosition || typeof cursorPosition.x !== 'number' || typeof cursorPosition.y !== 'number') {
      console.warn('⚠️ Invalid cursor position, using available space center');
      cursorPosition = {
        x: availableSpace.x + availableSpace.width / 2,
        y: availableSpace.y + availableSpace.height / 2
      };
    }
    
    // Default position: bottom-right of cursor
    let x = Math.round(cursorPosition.x + margin);
    let y = Math.round(cursorPosition.y + margin);
    
    // Adjust if window would go off-screen
    if (x + windowWidth > availableSpace.x + availableSpace.width) {
      x = Math.round(cursorPosition.x - windowWidth - margin); // Place to the left instead
    }
    
    if (y + windowHeight > availableSpace.y + availableSpace.height) {
      y = Math.round(cursorPosition.y - windowHeight - margin); // Place above instead
    }
    
    // Ensure window stays within screen bounds with some padding
    const padding = 10;
    x = Math.max(availableSpace.x + padding, Math.min(x, availableSpace.x + availableSpace.width - windowWidth - padding));
    y = Math.max(availableSpace.y + padding, Math.min(y, availableSpace.y + availableSpace.height - windowHeight - padding));
    
    console.log(`🎯 Cursor proximity bounds: ${windowWidth}x${windowHeight} at (${x}, ${y})`);
    
    return { x, y, width: windowWidth, height: windowHeight };
  }

  /**
   * Calculates bounds for the nearest screen edge to cursor
   * @param {Object} cursorPosition - Cursor coordinates
   * @param {Object} availableSpace - Available screen space
   * @param {number} sidebarWidth - Sidebar width for edge positioning
   * @returns {Object} Window bounds
   */
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
    
    // Calculate distances to each edge
    const distanceToLeft = Math.abs(cursorPosition.x - availableSpace.x);
    const distanceToRight = Math.abs((availableSpace.x + availableSpace.width) - cursorPosition.x);
    const distanceToTop = Math.abs(cursorPosition.y - availableSpace.y);
    const distanceToBottom = Math.abs((availableSpace.y + availableSpace.height) - cursorPosition.y);
    
    // Find the nearest edge
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

  /**
   * Stores the original dock state for later restoration
   */
  async storeOriginalDockState() {
    if (this.originalDockState) return; // Already stored
    
    try {
      if (this.dockService) {
        const dockInfo = await this.dockService.getDockInfo();
        this.originalDockState = {
          hidden: dockInfo.hidden,
          position: dockInfo.position,
          size: dockInfo.size
        };
        console.log('💾 Stored original dock state:', this.originalDockState);
      }
    } catch (error) {
      console.log('⚠️ Could not detect dock state, using defaults:', error.message);
      this.originalDockState = { hidden: false, position: 'bottom', size: 64 };
    }
  }

  /**
   * Restores the original dock state
   */
  async restoreOriginalDockState() {
    if (!this.originalDockState || !this.dockService) return;
    
    console.log('🔄 Restoring original dock state...');
    
    try {
      await this.dockService.setDockVisibility(!this.originalDockState.hidden);
      console.log('✅ Original dock state restored');
    } catch (error) {
      console.log('⚠️ Could not restore original dock state:', error.message);
    }
  }

  /**
   * Validates that bounds are reasonable
   * @param {Object} bounds - Bounds to validate
   * @returns {boolean} True if bounds are valid
   */
  isValidBounds(bounds) {
    return (
      typeof bounds.x === 'number' && !isNaN(bounds.x) && isFinite(bounds.x) &&
      typeof bounds.y === 'number' && !isNaN(bounds.y) && isFinite(bounds.y) &&
      typeof bounds.width === 'number' && !isNaN(bounds.width) && isFinite(bounds.width) && bounds.width > 0 &&
      typeof bounds.height === 'number' && !isNaN(bounds.height) && isFinite(bounds.height) && bounds.height > 0
    );
  }

  /**
   * Gets fallback bounds for a display
   * @param {Object} display - Target display
   * @returns {Object} Fallback bounds
   */
  getFallbackBounds(display) {
    const { x: screenX, y: screenY, width: screenWidth, height: screenHeight } = display.bounds;
    
    return {
      x: Math.round(screenX + (screenWidth - 400) / 2),
      y: Math.round(screenY + (screenHeight - 600) / 2),
      width: 400,
      height: 600
    };
  }

  /**
   * Calculates bounds for a specific position mode
   * @param {string} mode - Position mode
   * @param {Object} display - Target display
   * @param {Object} options - Additional options (width, height, etc.)
   * @returns {Object} Calculated bounds
   */
  calculateForMode(mode, display, options = {}) {
    const { width = 350, height = 600 } = options;
    const { x: screenX, y: screenY, width: screenWidth, height: screenHeight } = display.bounds;
    
    switch (mode) {
      case 'center':
        return {
          x: Math.round(screenX + (screenWidth - width) / 2),
          y: Math.round(screenY + (screenHeight - height) / 2),
          width: Math.round(width),
          height: Math.round(height)
        };
      
      case 'top-left':
        return {
          x: Math.round(screenX + 20),
          y: Math.round(screenY + 20),
          width: Math.round(width),
          height: Math.round(height)
        };
      
      case 'top-right':
        return {
          x: Math.round(screenX + screenWidth - width - 20),
          y: Math.round(screenY + 20),
          width: Math.round(width),
          height: Math.round(height)
        };
      
      case 'bottom-left':
        return {
          x: Math.round(screenX + 20),
          y: Math.round(screenY + screenHeight - height - 20),
          width: Math.round(width),
          height: Math.round(height)
        };
      
      case 'bottom-right':
        return {
          x: Math.round(screenX + screenWidth - width - 20),
          y: Math.round(screenY + screenHeight - height - 20),
          width: Math.round(width),
          height: Math.round(height)
        };
      
      default:
        return this.getFallbackBounds(display);
    }
  }

  /**
   * Checks if position requires dock management
   * @param {string} position - Position mode
   * @returns {boolean} True if dock management is needed
   */
  requiresDockManagement(position) {
    return ['bottom', 'left', 'right', 'top'].includes(position);
  }

  /**
   * Gets recommended position based on cursor location and screen layout
   * @param {Object} cursorPosition - Current cursor position
   * @param {Object} display - Target display
   * @returns {string} Recommended position mode
   */
  getRecommendedPosition(cursorPosition, display) {
    if (!cursorPosition || !display) return 'cursor';
    
    const { x: screenX, y: screenY, width: screenWidth, height: screenHeight } = display.bounds;
    
    // Calculate relative position within screen
    const relativeX = (cursorPosition.x - screenX) / screenWidth;
    const relativeY = (cursorPosition.y - screenY) / screenHeight;
    
    // Determine which edge is closest
    const distances = {
      left: relativeX,
      right: 1 - relativeX,
      top: relativeY,
      bottom: 1 - relativeY
    };
    
    const closest = Object.entries(distances).reduce((min, [edge, distance]) => 
      distance < min.distance ? { edge, distance } : min,
      { edge: 'left', distance: 1 }
    );
    
    // If cursor is very close to an edge (within 10% of screen), suggest edge mode
    if (closest.distance < 0.1) {
      return closest.edge;
    }
    
    // If cursor is in center area, suggest cursor mode
    if (relativeX > 0.2 && relativeX < 0.8 && relativeY > 0.2 && relativeY < 0.8) {
      return 'cursor';
    }
    
    // Otherwise suggest cursor-edge for smart positioning
    return 'cursor-edge';
  }

  /**
   * Cleanup method
   */
  cleanup() {
    console.log('🧹 PositionCalculator cleanup...');
    // Restore dock state if needed
    this.restoreOriginalDockState();
  }
}

module.exports = PositionCalculator;