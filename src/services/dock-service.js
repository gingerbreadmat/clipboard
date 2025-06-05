const { exec } = require('child_process');

class DockService {
  constructor() {
    // Track dock state to avoid unnecessary changes
    this.dockCurrentlyHidden = false;
    console.log('🏠 Dock service initialized');
  }

  setDockVisibility(shouldShow) {
    if (process.platform !== 'darwin') {
      console.log('🏠 Dock management only available on macOS');
      return false;
    }
    
    const shouldHide = !shouldShow;
    
    // Only change dock if the state actually needs to change
    if (shouldHide === this.dockCurrentlyHidden) {
      console.log(`🏠 Dock already in correct state (hidden: ${this.dockCurrentlyHidden})`);
      return true;
    }
    
    if (shouldHide) {
      return this.hideDock();
    } else {
      return this.showDock();
    }
  }

  hideDock() {
    console.log('🏠 Hiding dock for bottom positioning');
    
    return new Promise((resolve) => {
      // Try AppleScript approach first (might avoid restart)
      const appleScript = `
        tell application "System Events"
          tell dock preferences
            set autohide to true
          end tell
        end tell
      `;
      
      exec(`osascript -e '${appleScript}'`, (error) => {
        if (error) {
          console.log('AppleScript failed, falling back to defaults:', error);
          // Fallback to the original method
          exec('defaults write com.apple.dock autohide -bool true && killall Dock', (fallbackError) => {
            if (!fallbackError) {
              this.dockCurrentlyHidden = true;
              console.log('✅ Dock hidden (via defaults)');
              resolve(true);
            } else {
              console.error('❌ Failed to hide dock:', fallbackError);
              resolve(false);
            }
          });
        } else {
          this.dockCurrentlyHidden = true;
          console.log('✅ Dock hidden (via AppleScript)');
          resolve(true);
        }
      });
    });
  }

  showDock() {
    console.log('🏠 Showing dock for non-bottom positioning');
    
    return new Promise((resolve) => {
      // Try AppleScript approach first
      const appleScript = `
        tell application "System Events"
          tell dock preferences
            set autohide to false
          end tell
        end tell
      `;
      
      exec(`osascript -e '${appleScript}'`, (error) => {
        if (error) {
          console.log('AppleScript failed, falling back to defaults:', error);
          // Fallback to the original method
          exec('defaults write com.apple.dock autohide -bool false && killall Dock', (fallbackError) => {
            if (!fallbackError) {
              this.dockCurrentlyHidden = false;
              console.log('✅ Dock shown (via defaults)');
              resolve(true);
            } else {
              console.error('❌ Failed to show dock:', fallbackError);
              resolve(false);
            }
          });
        } else {
          this.dockCurrentlyHidden = false;
          console.log('✅ Dock shown (via AppleScript)');
          resolve(true);
        }
      });
    });
  }

  isDockHidden() {
    return this.dockCurrentlyHidden;
  }

  async getDockPosition() {
    if (process.platform !== 'darwin') {
      return null;
    }

    return new Promise((resolve) => {
      const script = `
        tell application "System Events"
          tell dock preferences
            get screen edge
          end tell
        end tell
      `;
      
      exec(`osascript -e '${script}'`, (error, stdout) => {
        if (error) {
          console.error('❌ Error getting dock position:', error);
          resolve('bottom'); // Default fallback
        } else {
          const position = stdout.trim().toLowerCase();
          console.log('🏠 Dock position:', position);
          resolve(position);
        }
      });
    });
  }

  async getDockSize() {
    if (process.platform !== 'darwin') {
      return null;
    }

    return new Promise((resolve) => {
      const script = `
        tell application "System Events"
          tell dock preferences
            get tilesize
          end tell
        end tell
      `;
      
      exec(`osascript -e '${script}'`, (error, stdout) => {
        if (error) {
          console.error('❌ Error getting dock size:', error);
          resolve(64); // Default fallback
        } else {
          const size = parseInt(stdout.trim());
          console.log('🏠 Dock size:', size);
          resolve(size);
        }
      });
    });
  }

  async getDockInfo() {
    if (process.platform !== 'darwin') {
      return {
        platform: 'non-macos',
        hidden: false,
        position: null,
        size: null
      };
    }

    const [position, size] = await Promise.all([
      this.getDockPosition(),
      this.getDockSize()
    ]);

    return {
      platform: 'macos',
      hidden: this.dockCurrentlyHidden,
      position,
      size
    };
  }

  // Force update dock state (useful for debugging)
  async refreshDockState() {
    if (process.platform !== 'darwin') {
      return false;
    }

    return new Promise((resolve) => {
      const script = `
        tell application "System Events"
          tell dock preferences
            get autohide
          end tell
        end tell
      `;
      
      exec(`osascript -e '${script}'`, (error, stdout) => {
        if (error) {
          console.error('❌ Error refreshing dock state:', error);
          resolve(false);
        } else {
          const isHidden = stdout.trim().toLowerCase() === 'true';
          this.dockCurrentlyHidden = isHidden;
          console.log('🏠 Refreshed dock state - hidden:', isHidden);
          resolve(true);
        }
      });
    });
  }

  // Reset dock to system defaults
  async resetDockToDefaults() {
    if (process.platform !== 'darwin') {
      return false;
    }

    console.log('🏠 Resetting dock to defaults...');
    
    return new Promise((resolve) => {
      exec('defaults delete com.apple.dock && killall Dock', (error) => {
        if (error) {
          console.error('❌ Error resetting dock:', error);
          resolve(false);
        } else {
          this.dockCurrentlyHidden = false; // Assume default is shown
          console.log('✅ Dock reset to defaults');
          resolve(true);
        }
      });
    });
  }
}

module.exports = DockService;