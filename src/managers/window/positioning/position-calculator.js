class PositionCalculator {
  constructor() {
    console.log('📐 Position Calculator initialized');
  }

  /**
   * Calculate window bounds based on position mode and cursor location
   */
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
          bounds = this.calculateCursorProximityBounds(cursorPosition, display, popupWidth, popupHeight);
          break;
          
        case 'cursor-edge':
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

  /**
   * Calculate bounds near cursor with smart positioning
   */
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

  /**
   * Calculate bounds at nearest edge to cursor
   */
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

  /**
   * Validate bounds to prevent setBounds errors
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
   * Fallback positioning when normal positioning fails
   */
  createFallbackBounds(display) {
    console.log('🔄 Creating fallback bounds for display:', display.id);
    
    const { x: screenX, y: screenY, width: screenWidth, height: screenHeight } = display.bounds;
    const fallbackBounds = {
      x: Math.round(screenX + (screenWidth - 400) / 2),
      y: Math.round(screenY + (screenHeight - 600) / 2),
      width: 400,
      height: 600
    };
    
    if (this.isValidBounds(fallbackBounds)) {
      console.log('✅ Fallback bounds created:', fallbackBounds);
      return fallbackBounds;
    } else {
      console.error('❌ Even fallback bounds are invalid:', fallbackBounds);
      return null;
    }
  }

  /**
   * Constrain bounds to ensure they're within a display
   */
  constrainBoundsToDisplay(bounds, display) {
    if (!bounds || !display || !display.bounds) {
      return bounds;
    }

    const { x: screenX, y: screenY, width: screenWidth, height: screenHeight } = display.bounds;
    
    // Ensure the window fits within the display
    const constrainedBounds = {
      x: Math.max(screenX, Math.min(bounds.x, screenX + screenWidth - bounds.width)),
      y: Math.max(screenY, Math.min(bounds.y, screenY + screenHeight - bounds.height)),
      width: Math.min(bounds.width, screenWidth),
      height: Math.min(bounds.height, screenHeight)
    };

    // Round all values
    constrainedBounds.x = Math.round(constrainedBounds.x);
    constrainedBounds.y = Math.round(constrainedBounds.y);
    constrainedBounds.width = Math.round(constrainedBounds.width);
    constrainedBounds.height = Math.round(constrainedBounds.height);

    console.log('📐 Constrained bounds to display:', constrainedBounds);
    return constrainedBounds;
  }

  /**
   * Calculate sidebar dimensions based on display
   */
  calculateSidebarDimensions(display) {
    if (!display || !display.bounds) {
      return { width: 350, height: 600 };
    }

    const { width: screenWidth, height: screenHeight } = display.bounds;
    
    // Responsive sidebar width based on display size
    let sidebarWidth = 350;
    if (screenWidth < 1200) {
      sidebarWidth = 300;
    } else if (screenWidth > 2000) {
      sidebarWidth = 400;
    }

    return {
      width: sidebarWidth,
      height: screenHeight
    };
  }

  /**
   * Calculate popup/window dimensions based on display
   */
  calculatePopupDimensions(display) {
    if (!display || !display.bounds) {
      return { width: 400, height: 600 };
    }

    const { width: screenWidth, height: screenHeight } = display.bounds;
    
    // Responsive popup size based on display
    let popupWidth = 400;
    let popupHeight = 600;
    
    if (screenWidth < 1200) {
      popupWidth = 350;
      popupHeight = 500;
    } else if (screenWidth > 2000) {
      popupWidth = 500;
      popupHeight = 700;
    }

    // Ensure popup doesn't exceed 50% of screen size
    popupWidth = Math.min(popupWidth, screenWidth * 0.5);
    popupHeight = Math.min(popupHeight, screenHeight * 0.5);

    return {
      width: Math.round(popupWidth),
      height: Math.round(popupHeight)
    };
  }
}

module.exports = PositionCalculator;