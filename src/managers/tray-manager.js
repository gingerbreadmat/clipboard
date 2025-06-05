const { Tray, Menu, nativeImage, dialog } = require('electron');

class TrayManager {
  constructor(windowManager, storage) {
    this.windowManager = windowManager;
    this.storage = storage;
    this.tray = null;
    console.log('🔧 Tray manager initialized');
  }

  createTray() {
    console.log('🔧 Creating tray icon...');
    
    try {
      // Create a simple tray icon using system template
      const trayIcon = nativeImage.createFromNamedImage('NSTouchBarRecordStartTemplate', [-1, 0, 1]);
      this.tray = new Tray(trayIcon);
      
      this.setupTrayMenu();
      this.setupTrayEvents();
      
      this.tray.setToolTip('Clipboard Manager');
      
      console.log('✅ Tray icon created successfully');
      return this.tray;
    } catch (error) {
      console.error('❌ Failed to create tray icon:', error);
      return null;
    }
  }

  setupTrayMenu() {
    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'Show Clipboard Manager',
        click: () => {
          console.log('🔧 Tray: Show clicked');
          this.windowManager.showMainWindow();
        }
      },
      {
        type: 'separator'
      },
      {
        label: 'Settings',
        click: () => {
          console.log('🔧 Tray: Settings clicked');
          this.windowManager.createSettingsWindow();
        }
      },
      {
        type: 'separator'
      },
      {
        label: 'Clear History',
        click: () => {
          console.log('🔧 Tray: Clear History clicked');
          this.clearHistoryWithConfirmation();
        }
      },
      {
        label: 'Get Statistics',
        click: () => {
          console.log('🔧 Tray: Statistics clicked');
          this.showStatistics();
        }
      },
      {
        type: 'separator'
      },
      {
        label: 'About',
        click: () => {
          console.log('🔧 Tray: About clicked');
          this.showAbout();
        }
      },
      {
        type: 'separator'
      },
      {
        label: 'Quit',
        click: () => {
          console.log('🔧 Tray: Quit clicked');
          this.quitApplication();
        }
      }
    ]);

    this.tray.setContextMenu(contextMenu);
  }

  setupTrayEvents() {
    // Show/hide window on tray click
    this.tray.on('click', () => {
      console.log('🔧 Tray clicked');
      this.windowManager.toggleMainWindow();
    });

    // Handle right-click separately if needed
    this.tray.on('right-click', () => {
      console.log('🔧 Tray right-clicked');
      // Context menu will show automatically
    });

    // Handle double-click
    this.tray.on('double-click', () => {
      console.log('🔧 Tray double-clicked');
      this.windowManager.showMainWindow();
    });
  }

  clearHistoryWithConfirmation() {
    dialog.showMessageBox({
      type: 'warning',
      buttons: ['Cancel', 'Clear History'],
      defaultId: 0,
      title: 'Clear Clipboard History',
      message: 'Are you sure you want to clear all clipboard history?',
      detail: 'This action cannot be undone. Pinned items will be preserved.'
    }).then((result) => {
      if (result.response === 1) { // Clear History button
        try {
          const deletedCount = this.storage.clearHistory();
          console.log(`🧹 Cleared ${deletedCount} clipboard items from tray`);
          
          // Notify main window
          this.windowManager.sendToMainWindow('history-cleared');
          
          // Show success notification
          this.showNotification('History Cleared', `Removed ${deletedCount} clipboard items`);
        } catch (error) {
          console.error('❌ Error clearing history from tray:', error);
          this.showNotification('Error', 'Failed to clear clipboard history');
        }
      }
    });
  }

  showStatistics() {
    try {
      const stats = this.storage.getStats();
      
      const statsMessage = `
Total Items: ${stats.total}
Pinned Items: ${stats.pinned}

Types:
${stats.byType.map(type => `  ${type.type}: ${type.count}`).join('\n')}
      `.trim();
      
      dialog.showMessageBox({
        type: 'info',
        title: 'Clipboard Statistics',
        message: 'Clipboard Manager Statistics',
        detail: statsMessage,
        buttons: ['OK']
      });
    } catch (error) {
      console.error('❌ Error getting statistics:', error);
      this.showNotification('Error', 'Failed to get clipboard statistics');
    }
  }

  showAbout() {
    const { app } = require('electron');
    
    dialog.showMessageBox({
      type: 'info',
      title: 'About Clipboard Manager',
      message: 'Clipboard Manager',
      detail: `
Version: 1.0.0
Electron: ${process.versions.electron}
Node.js: ${process.versions.node}
Chrome: ${process.versions.chrome}

A comprehensive clipboard manager for macOS.
      `.trim(),
      buttons: ['OK']
    });
  }

  quitApplication() {
    const { app } = require('electron');
    
    dialog.showMessageBox({
      type: 'warning',
      buttons: ['Cancel', 'Quit'],
      defaultId: 0,
      title: 'Quit Clipboard Manager',
      message: 'Are you sure you want to quit?',
      detail: 'This will stop clipboard monitoring and close the application.'
    }).then((result) => {
      if (result.response === 1) { // Quit button
        console.log('💀 Quitting application from tray...');
        app.isQuiting = true;
        app.quit();
      }
    });
  }

  showNotification(title, body) {
    if (this.tray) {
      // For now, we'll use the tray tooltip for notifications
      // In a more advanced implementation, you could use system notifications
      const originalTooltip = this.tray.getToolTip();
      this.tray.setToolTip(`${title}: ${body}`);
      
      // Restore original tooltip after 3 seconds
      setTimeout(() => {
        if (this.tray) {
          this.tray.setToolTip(originalTooltip);
        }
      }, 3000);
    }
  }

  updateTrayMenu() {
    if (this.tray) {
      this.setupTrayMenu();
    }
  }

  setTrayIcon(iconPath) {
    if (this.tray) {
      try {
        const icon = nativeImage.createFromPath(iconPath);
        this.tray.setImage(icon);
        console.log('✅ Tray icon updated');
        return true;
      } catch (error) {
        console.error('❌ Failed to update tray icon:', error);
        return false;
      }
    }
    return false;
  }

  setTrayTooltip(tooltip) {
    if (this.tray) {
      this.tray.setToolTip(tooltip);
      return true;
    }
    return false;
  }

  // Update menu based on application state
  updateMenuState(state = {}) {
    if (!this.tray) return;

    const { hasItems = false, isPinned = false } = state;
    
    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'Show Clipboard Manager',
        click: () => {
          console.log('🔧 Tray: Show clicked');
          this.windowManager.showMainWindow();
        }
      },
      {
        type: 'separator'
      },
      {
        label: 'Settings',
        click: () => {
          console.log('🔧 Tray: Settings clicked');
          this.windowManager.createSettingsWindow();
        }
      },
      {
        type: 'separator'
      },
      {
        label: 'Clear History',
        enabled: hasItems,
        click: () => {
          console.log('🔧 Tray: Clear History clicked');
          this.clearHistoryWithConfirmation();
        }
      },
      {
        label: 'Get Statistics',
        click: () => {
          console.log('🔧 Tray: Statistics clicked');
          this.showStatistics();
        }
      },
      {
        type: 'separator'
      },
      {
        label: 'About',
        click: () => {
          console.log('🔧 Tray: About clicked');
          this.showAbout();
        }
      },
      {
        type: 'separator'
      },
      {
        label: 'Quit',
        click: () => {
          console.log('🔧 Tray: Quit clicked');
          this.quitApplication();
        }
      }
    ]);

    this.tray.setContextMenu(contextMenu);
  }

  // Add recent items to menu (optional feature)
  updateMenuWithRecentItems(recentItems = []) {
    if (!this.tray) return;

    const menuTemplate = [
      {
        label: 'Show Clipboard Manager',
        click: () => {
          console.log('🔧 Tray: Show clicked');
          this.windowManager.showMainWindow();
        }
      }
    ];

    // Add recent items if any
    if (recentItems.length > 0) {
      menuTemplate.push({ type: 'separator' });
      menuTemplate.push({
        label: 'Recent Items',
        enabled: false
      });

      recentItems.slice(0, 5).forEach((item, index) => {
        const preview = item.preview || item.content;
        const label = preview.length > 30 ? preview.substring(0, 30) + '...' : preview;
        
        menuTemplate.push({
          label: `${index + 1}. ${label}`,
          click: () => {
            console.log('🔧 Tray: Recent item clicked:', item.id);
            // Copy item to clipboard
            this.copyItemToClipboard(item);
          }
        });
      });
    }

    // Add rest of menu
    menuTemplate.push(
      { type: 'separator' },
      {
        label: 'Settings',
        click: () => {
          console.log('🔧 Tray: Settings clicked');
          this.windowManager.createSettingsWindow();
        }
      },
      { type: 'separator' },
      {
        label: 'Clear History',
        enabled: recentItems.length > 0,
        click: () => {
          console.log('🔧 Tray: Clear History clicked');
          this.clearHistoryWithConfirmation();
        }
      },
      {
        label: 'Get Statistics',
        click: () => {
          console.log('🔧 Tray: Statistics clicked');
          this.showStatistics();
        }
      },
      { type: 'separator' },
      {
        label: 'About',
        click: () => {
          console.log('🔧 Tray: About clicked');
          this.showAbout();
        }
      },
      { type: 'separator' },
      {
        label: 'Quit',
        click: () => {
          console.log('🔧 Tray: Quit clicked');
          this.quitApplication();
        }
      }
    );

    const contextMenu = Menu.buildFromTemplate(menuTemplate);
    this.tray.setContextMenu(contextMenu);
  }

  copyItemToClipboard(item) {
    // This would need to be connected to the IPC system or storage
    console.log('📋 Copying item to clipboard:', item.id);
    
    // Send message to main window to handle the copy
    this.windowManager.sendToMainWindow('copy-item-from-tray', item);
  }

  // Destroy the tray
  destroy() {
    if (this.tray) {
      this.tray.destroy();
      this.tray = null;
      console.log('🔧 Tray destroyed');
    }
  }

  // Get tray instance
  getTray() {
    return this.tray;
  }

  // Check if tray is created
  isCreated() {
    return this.tray !== null;
  }

  // Update tray based on clipboard state
  updateTrayState(clipboardState) {
    if (!this.tray) return;

    const { itemCount = 0, hasItems = false, recentItems = [] } = clipboardState;
    
    // Update tooltip with current state
    this.setTrayTooltip(`Clipboard Manager - ${itemCount} items`);
    
    // Update menu with recent items
    this.updateMenuWithRecentItems(recentItems);
  }

  // Flash tray icon (for notifications)
  flashTray() {
    if (!this.tray) return;

    // Simple flash effect by changing icon briefly
    const originalIcon = this.tray.getImage();
    const flashIcon = nativeImage.createFromNamedImage('NSCaution', [-1, 0, 1]);
    
    this.tray.setImage(flashIcon);
    
    setTimeout(() => {
      if (this.tray) {
        this.tray.setImage(originalIcon);
      }
    }, 200);
  }
}

module.exports = TrayManager;