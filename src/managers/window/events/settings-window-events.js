const { BrowserWindow } = require('electron');

class SettingsWindowFactory {
  constructor(settingsService, displayDetector) {
    this.settingsService = settingsService;
    this.displayDetector = displayDetector;
    console.log('⚙️ Settings Window Factory initialized');
  }

  /**
   * Create the settings window
   */
  createSettingsWindow(currentDisplay = null) {
    console.log('⚙️ Creating settings window...');
    
    // Use provided display or detect current display
    const targetDisplay = currentDisplay || this.displayDetector.getPrimaryDisplay();
    const { x: screenX, y: screenY, width: screenWidth, height: screenHeight } = targetDisplay.bounds;
    
    // Get current theme
    const currentTheme = this.settingsService.getTheme();
    const backgroundColor = currentTheme === 'dark' ? '#282828' : '#ffffff';
    
    // Calculate centered position
    const windowWidth = 500;
    const windowHeight = 800;
    const x = screenX + (screenWidth - windowWidth) / 2;
    const y = screenY + (screenHeight - windowHeight) / 2;
    
    const settingsWindow = new BrowserWindow({
      x: Math.round(x),
      y: Math.round(y),
      width: windowWidth,
      height: windowHeight,
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
      backgroundColor: backgroundColor,
      alwaysOnTop: false,
      skipTaskbar: false,
      frame: true,
      parent: null,
      modal: false
    });

    console.log('⚙️ Loading settings.html...');
    settingsWindow.loadFile('renderer/settings.html');
    
    console.log('✅ Settings window created');
    
    return {
      window: settingsWindow,
      bounds: { x, y, width: windowWidth, height: windowHeight },
      display: targetDisplay,
      theme: currentTheme
    };
  }

  /**
   * Clean up factory resources
   */
  destroy() {
    console.log('⚙️ Destroying settings window factory...');
    
    // Clear references
    this.settingsService = null;
    this.displayDetector = null;
    
    console.log('✅ Settings window factory destroyed');
  }
}

module.exports = SettingsWindowFactory;