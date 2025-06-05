const { screen } = require('electron');

class ScreenUtils {
  static getPrimaryDisplay() {
    return screen.getPrimaryDisplay();
  }

  static getAllDisplays() {
    return screen.getAllDisplays();
  }

  static getScreenDimensions() {
    const display = this.getPrimaryDisplay();
    return {
      width: display.bounds.width,
      height: display.bounds.height,
      x: display.bounds.x,
      y: display.bounds.y
    };
  }

  static getWorkArea() {
    const display = this.getPrimaryDisplay();
    return display.workArea;
  }

  static getScaleFactor() {
    const display = this.getPrimaryDisplay();
    return display.scaleFactor;
  }

  static getDisplayInfo() {
    const display = this.getPrimaryDisplay();
    return {
      id: display.id,
      bounds: display.bounds,
      workArea: display.workArea,
      scaleFactor: display.scaleFactor,
      rotation: display.rotation,
      touchSupport: display.touchSupport,
      accelerometerSupport: display.accelerometerSupport,
      monochrome: display.monochrome,
      colorDepth: display.colorDepth,
      colorSpace: display.colorSpace
    };
  }

  static calculateSidebarBounds(position, sidebarWidth = 350) {
    const { width: screenWidth, height: screenHeight, x: screenX, y: screenY } = this.getScreenDimensions();
    
    switch (position) {
      case 'left':
        return {
          x: screenX,
          y: screenY,
          width: sidebarWidth,
          height: screenHeight
        };
      case 'right':
        return {
          x: screenX + screenWidth - sidebarWidth,
          y: screenY,
          width: sidebarWidth,
          height: screenHeight
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
      default:
        return {
          x: screenX + 100,
          y: screenY + 100,
          width: 400,
          height: 600
        };
    }
  }

  static isPositionValid(bounds) {
    const displays = this.getAllDisplays();
    
    return displays.some(display => {
      const displayBounds = display.bounds;
      return (
        bounds.x >= displayBounds.x &&
        bounds.y >= displayBounds.y &&
        bounds.x + bounds.width <= displayBounds.x + displayBounds.width &&
        bounds.y + bounds.height <= displayBounds.y + displayBounds.height
      );
    });
  }

  static findBestDisplay(bounds) {
    const displays = this.getAllDisplays();
    
    // Find display that contains the center of the bounds
    const centerX = bounds.x + bounds.width / 2;
    const centerY = bounds.y + bounds.height / 2;
    
    return displays.find(display => {
      const { x, y, width, height } = display.bounds;
      return centerX >= x && centerX <= x + width && centerY >= y && centerY <= y + height;
    }) || this.getPrimaryDisplay();
  }

  static constrainToDisplay(bounds, display = null) {
    if (!display) {
      display = this.findBestDisplay(bounds);
    }
    
    const { x: minX, y: minY, width: maxWidth, height: maxHeight } = display.bounds;
    
    return {
      x: Math.max(minX, Math.min(bounds.x, minX + maxWidth - bounds.width)),
      y: Math.max(minY, Math.min(bounds.y, minY + maxHeight - bounds.height)),
      width: Math.min(bounds.width, maxWidth),
      height: Math.min(bounds.height, maxHeight)
    };
  }

  static getDisplayAtPoint(x, y) {
    const displays = this.getAllDisplays();
    return displays.find(display => {
      const { x: dispX, y: dispY, width, height } = display.bounds;
      return x >= dispX && x <= dispX + width && y >= dispY && y <= dispY + height;
    });
  }

  static getCursorPosition() {
    return screen.getCursorScreenPoint();
  }

  static getDisplayNearCursor() {
    const cursor = this.getCursorPosition();
    return this.getDisplayAtPoint(cursor.x, cursor.y) || this.getPrimaryDisplay();
  }

  static addDisplayListener(callback) {
    screen.on('display-added', callback);
    screen.on('display-removed', callback);
    screen.on('display-metrics-changed', callback);
  }

  static removeDisplayListener(callback) {
    screen.removeListener('display-added', callback);
    screen.removeListener('display-removed', callback);
    screen.removeListener('display-metrics-changed', callback);
  }

  static removeAllDisplayListeners() {
    screen.removeAllListeners('display-added');
    screen.removeAllListeners('display-removed');
    screen.removeAllListeners('display-metrics-changed');
  }

  static getMultiDisplayInfo() {
    const displays = this.getAllDisplays();
    const primary = this.getPrimaryDisplay();
    
    return {
      count: displays.length,
      primary: primary.id,
      displays: displays.map(display => ({
        id: display.id,
        isPrimary: display.id === primary.id,
        bounds: display.bounds,
        workArea: display.workArea,
        scaleFactor: display.scaleFactor
      }))
    };
  }
}

module.exports = ScreenUtils;