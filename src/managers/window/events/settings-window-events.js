const { BrowserWindow } = require('electron');

class SettingsWindowFactory {
  constructor(settingsService, displayDetector) {
    this.settingsService = settingsService;
    this.displayDetector = displayDetector;
    console.log('⚙️ Settings Window Factory initialized');
  }

  createSettingsWindow(currentDisplay = null) {
    console.log('⚙️ Creating settings window...');
    
    const targetDisplay = currentDisplay || this.displayDetector.getPrimaryDisplay();
    const { x: screenX, y: screenY, width: screenWidth, height: screenHeight } = targetDisplay.bounds;
    
    const currentTheme = this.settingsService.getTheme();
    const backgroundColor = currentTheme === 'dark' ? '#282828' : '#ffffff';
    
    const windowWidth = 500;
    const windowHeight = 800;
    const x = screenX + (screenWidth - windowWidth) / 2;
    const y = screenY + (screenHeight - windowHeight) / 2;
    
    const settingsWindow = new BrowserWindow({
      x: Math.round(x),
      y: Math.round(y),
      width: windowWidth,
      height: windowHeight,
      show: false,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false
      },
      backgroundColor: backgroundColor
    });

    settingsWindow.loadFile('renderer/settings.html');
    
    return {
      window: settingsWindow,
      bounds: { x, y, width: windowWidth, height: windowHeight },
      display: targetDisplay,
      theme: currentTheme
    };
  }

  destroy() {
    console.log('⚙️ Destroying settings window factory...');
  }
}

module.exports = SettingsWindowFactory;