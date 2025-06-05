const { ipcMain, clipboard, nativeImage, shell, app } = require('electron');

class IPCManager {
  constructor(storage, windowManager, settingsService, dockService) {
    this.storage = storage;
    this.windowManager = windowManager;
    this.settingsService = settingsService;
    this.dockService = dockService;
    
    this.setupClipboardHandlers();
    this.setupWindowHandlers();
    this.setupSettingsHandlers();
    this.setupThemeHandlers();
    this.setupPositionHandlers();
    this.setupUtilityHandlers();
    
    console.log('✅ IPC Manager initialized with all handlers');
  }

  setupClipboardHandlers() {
    // Get clipboard history
    ipcMain.handle('get-clipboard-history', async () => {
      console.log('🔗 IPC: get-clipboard-history called');
      try {
        const history = this.storage.getHistory();
        console.log(`🔗 IPC: returning history with ${history.length} items`);
        return history;
      } catch (error) {
        console.error('❌ IPC: Error getting clipboard history:', error);
        return [];
      }
    });

    // Search clipboard
    ipcMain.handle('search-clipboard', async (event, query) => {
      console.log('🔍 IPC: search-clipboard called with query:', query);
      try {
        const results = this.storage.search(query);
        console.log(`🔍 IPC: search returned ${results.length} results`);
        return results;
      } catch (error) {
        console.error('❌ IPC: Error searching clipboard:', error);
        return [];
      }
    });

    // Delete clipboard item
    ipcMain.handle('delete-clipboard-item', async (event, id) => {
      console.log('🗑️ IPC: delete-clipboard-item called for ID:', id);
      try {
        const result = this.storage.deleteItem(id);
        console.log('🗑️ IPC: delete result:', result);
        return result;
      } catch (error) {
        console.error('❌ IPC: Error deleting clipboard item:', error);
        return false;
      }
    });

    // Copy to clipboard
    ipcMain.handle('copy-to-clipboard', async (event, content, type) => {
      console.log('📋 IPC: copy-to-clipboard called, type:', type);
      try {
        if (type === 'text' || type === 'html') {
          clipboard.writeText(content);
        } else if (type === 'files') {
          clipboard.writeText(content);
        } else if (type === 'image') {
          if (content.startsWith('data:image/')) {
            try {
              const image = nativeImage.createFromDataURL(content);
              if (!image.isEmpty()) {
                clipboard.writeImage(image);
                console.log('📋 Image copied to clipboard successfully');
              } else {
                console.error('❌ Failed to create image from data URL');
                return false;
              }
            } catch (imageError) {
              console.error('❌ Error creating image from data URL:', imageError);
              return false;
            }
          } else {
            console.error('❌ Invalid image data format');
            return false;
          }
        }
        console.log('✅ Successfully copied to clipboard');
        return true;
      } catch (error) {
        console.error('❌ Error copying to clipboard:', error);
        return false;
      }
    });

    // Pin clipboard item
    ipcMain.handle('pin-clipboard-item', async (event, id, pinned) => {
      console.log('📌 IPC: pin-clipboard-item called for ID:', id, 'pinned:', pinned);
      try {
        const result = this.storage.pinItem(id, pinned);
        console.log('📌 IPC: pin result:', result);
        return result;
      } catch (error) {
        console.error('❌ IPC: Error pinning clipboard item:', error);
        return false;
      }
    });

    // Clear clipboard history
    ipcMain.handle('clear-clipboard-history', async () => {
      console.log('🧹 IPC: clear-clipboard-history called');
      try {
        const result = this.storage.clearHistory();
        console.log('🧹 IPC: cleared', result, 'items');
        
        // Notify UI
        this.windowManager.sendToMainWindow('history-cleared');
        
        return result;
      } catch (error) {
        console.error('❌ IPC: Error clearing clipboard history:', error);
        return 0;
      }
    });

    // Load image from path
    ipcMain.handle('load-image-from-path', async (event, filePath) => {
      console.log('🖼️ IPC: load-image-from-path called for:', filePath);
      try {
        const fs = require('fs');
        
        // Check if file exists and is accessible
        if (!fs.existsSync(filePath)) {
          console.log('❌ File does not exist:', filePath);
          return null;
        }

        // Check file permissions
        try {
          fs.accessSync(filePath, fs.constants.R_OK);
        } catch (accessError) {
          console.log('❌ No read permission for file:', filePath);
          return null;
        }

        // Try to load the image
        const image = nativeImage.createFromPath(filePath);
        if (image.isEmpty()) {
          console.log('❌ Failed to load image from path:', filePath);
          return null;
        }

        const size = image.getSize();
        console.log(`✅ Successfully loaded image: ${size.width}×${size.height} from ${filePath}`);

        // Apply size limits
        let processedImage = image;
        const maxDimension = 1920;
        
        if (size.width > maxDimension || size.height > maxDimension) {
          const scale = Math.min(maxDimension / size.width, maxDimension / size.height);
          const newWidth = Math.round(size.width * scale);
          const newHeight = Math.round(size.height * scale);
          processedImage = image.resize({ width: newWidth, height: newHeight });
          console.log(`📏 Image resized to: ${newWidth}×${newHeight}`);
        }

        const imageBuffer = processedImage.toPNG();
        
        if (imageBuffer.length > 10 * 1024 * 1024) {
          console.log('❌ Image too large after processing');
          return null;
        }

        return {
          dataURL: `data:image/png;base64,${imageBuffer.toString('base64')}`,
          width: size.width,
          height: size.height
        };

      } catch (error) {
        console.error('❌ Error loading image from path:', error);
        return null;
      }
    });
  }

  setupWindowHandlers() {
    // Open settings window
    ipcMain.handle('open-settings', async () => {
      console.log('⚙️ IPC: open-settings called');
      this.windowManager.createSettingsWindow();
    });

    // Close settings window
    ipcMain.handle('close-settings', async () => {
      console.log('⚙️ IPC: close-settings called');
      this.windowManager.closeSettingsWindow();
    });

    // Quit application
    ipcMain.handle('quit-application', async () => {
      console.log('💀 IPC: quit-application called');
      console.log('💀 Quitting application from settings...');
      
      // Set the flag immediately
      app.isQuiting = true;
      
      // Close all windows properly
      const settingsWindow = this.windowManager.getSettingsWindow();
      const mainWindow = this.windowManager.getMainWindow();
      
      if (settingsWindow && !settingsWindow.isDestroyed()) {
        settingsWindow.destroy();
      }
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.destroy();
      }
      
      // Quit the app
      app.quit();
      
      return true;
    });

    // Handle force quit message
    ipcMain.on('force-quit', () => {
      console.log('💀 IPC: force-quit called');
      app.isQuiting = true;
      app.quit();
    });
  }

  setupSettingsHandlers() {
    // Open data folder
    ipcMain.handle('open-data-folder', async () => {
      console.log('📁 IPC: open-data-folder called');
      const userDataPath = app.getPath('userData');
      console.log('📁 Opening folder:', userDataPath);
      shell.openPath(userDataPath);
    });
  }

  setupThemeHandlers() {
    // Get current theme
    ipcMain.handle('get-current-theme', async () => {
      console.log('🎨 IPC: get-current-theme called');
      try {
        const currentTheme = this.settingsService.getTheme();
        console.log('🎨 Current theme from store:', currentTheme);
        return currentTheme;
      } catch (error) {
        console.error('❌ Error getting current theme:', error);
        return 'light';
      }
    });

    // Set theme
    ipcMain.handle('set-theme', async (event, theme) => {
      console.log('🎨 IPC: set-theme called with:', theme);
      try {
        console.log('💾 Storing theme in settings service...');
        this.settingsService.setTheme(theme);
        console.log('✅ Theme stored successfully');
        
        // Apply theme to all open windows
        console.log('📡 Broadcasting theme to all windows...');
        this.windowManager.sendToAllWindows('theme-changed', theme);
        
        console.log('🎨 Theme set to:', theme);
        return true;
      } catch (error) {
        console.error('❌ Failed to set theme:', error);
        return false;
      }
    });
  }

  setupPositionHandlers() {
    // Get current window position
    ipcMain.handle('get-current-position', async () => {
      console.log('📍 IPC: get-current-position called');
      try {
        const currentPosition = this.settingsService.getWindowPosition();
        console.log('📍 Current position from store:', currentPosition);
        return currentPosition;
      } catch (error) {
        console.error('❌ Error getting current position:', error);
        return 'left';
      }
    });

    // Set window position
    ipcMain.handle('set-window-position', async (event, position) => {
      console.log('📍 IPC: set-window-position called with:', position);
      try {
        console.log('💾 Storing position in settings service...');
        this.settingsService.setWindowPosition(position);
        console.log('✅ Position stored successfully');
        
        // Apply position to main window
        const mainWindow = this.windowManager.getMainWindow();
        if (mainWindow && !mainWindow.isDestroyed()) {
          console.log('📱 Applying new position to main window');
          this.windowManager.applyWindowPosition(position);
        }
        
        console.log('📍 Position set to:', position);
        return true;
      } catch (error) {
        console.error('❌ Failed to set position:', error);
        return false;
      }
    });
  }

  setupUtilityHandlers() {
    // Toggle dock visibility
    ipcMain.handle('toggle-dock-visibility', async (event, visible) => {
      console.log('🏠 IPC: toggle-dock-visibility called with:', visible);
      
      try {
        const result = this.dockService.setDockVisibility(visible);
        console.log('🏠 Dock visibility toggled:', result);
        return result;
      } catch (error) {
        console.error('❌ Error toggling dock visibility:', error);
        return false;
      }
    });

    // Get system info (useful for debugging)
    ipcMain.handle('get-system-info', async () => {
      console.log('💻 IPC: get-system-info called');
      try {
        const os = require('os');
        const { screen } = require('electron');
        
        const systemInfo = {
          platform: process.platform,
          arch: process.arch,
          nodeVersion: process.version,
          electronVersion: process.versions.electron,
          chromeVersion: process.versions.chrome,
          osType: os.type(),
          osRelease: os.release(),
          totalMemory: os.totalmem(),
          freeMemory: os.freemem(),
          cpus: os.cpus().length,
          primaryDisplay: screen.getPrimaryDisplay(),
          allDisplays: screen.getAllDisplays(),
          settings: this.settingsService.getDebugInfo(),
          dock: await this.dockService.getDockInfo()
        };
        
        return systemInfo;
      } catch (error) {
        console.error('❌ Error getting system info:', error);
        return null;
      }
    });
  }

  // Utility method to remove all handlers (useful for cleanup)
  removeAllHandlers() {
    console.log('🧹 Removing all IPC handlers...');
    
    // Remove handle listeners
    const handleMethods = [
      'get-clipboard-history',
      'search-clipboard',
      'delete-clipboard-item',
      'copy-to-clipboard',
      'pin-clipboard-item',
      'clear-clipboard-history',
      'load-image-from-path',
      'open-settings',
      'close-settings',
      'quit-application',
      'open-data-folder',
      'get-current-theme',
      'set-theme',
      'get-current-position',
      'set-window-position',
      'toggle-dock-visibility',
      'get-system-info'
    ];
    
    handleMethods.forEach(method => {
      ipcMain.removeHandler(method);
    });
    
    // Remove on listeners
    ipcMain.removeAllListeners('force-quit');
    
    console.log('✅ All IPC handlers removed');
  }
}

module.exports = IPCManager;