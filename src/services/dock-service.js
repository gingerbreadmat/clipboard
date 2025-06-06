// Enhanced src/services/dock-service.js with better position detection and restoration

const { exec } = require('child_process');

class DockService {
  constructor() {
    // Track dock state to avoid unnecessary changes
    this.dockCurrentlyHidden = false;
    this.originalDockState = null;
    this.lastKnownPosition = 'bottom';
    this.lastKnownSize = 64;
    
    // Cache to avoid repeated expensive AppleScript calls
    this.dockInfoCache = null;
    this.cacheExpiry = 0;
    this.cacheTimeout = 5000; // Cache for 5 seconds
    
    console.log('🏠 Dock service initialized');
    
    // Initialize dock state detection (async)
    this.initializeDockState();
  }

  async initializeDockState() {
    try {
      console.log('🏠 Detecting initial dock state...');
      await this.refreshDockState();
      
      // Store the original state for restoration
      this.originalDockState = {
        hidden: this.dockCurrentlyHidden,
        position: this.lastKnownPosition,
        size: this.lastKnownSize
      };
      
      console.log('💾 Original dock state stored:', this.originalDockState);
    } catch (error) {
      console.error('❌ Failed to initialize dock state:', error);
      // Set reasonable defaults
      this.originalDockState = {
        hidden: false,
        position: 'bottom',
        size: 64
      };
    }
  }

  async setDockVisibility(shouldShow) {
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
    
    // Clear cache since we're changing dock state
    this.clearCache();
    
    if (shouldHide) {
      return this.hideDock();
    } else {
      return this.showDock();
    }
  }

  // Get dock info with fresh data (bypasses cache) - for critical operations
  async getDockInfoFresh() {
    this.clearCache();
    return this.getDockInfo();
  }

  // Clear the dock info cache
  clearCache() {
    this.dockInfoCache = null;
    this.cacheExpiry = 0;
    console.log('🏠 Dock info cache cleared');
  }

  async hideDock() {
    console.log('🏠 Hiding dock for positioning');
    
    return new Promise((resolve) => {
      // Try multiple approaches for better compatibility
      const methods = [
        // Method 1: AppleScript with dock preferences
        () => {
          const appleScript = `
            tell application "System Events"
              tell dock preferences
                set autohide to true
              end tell
            end tell
          `;
          
          return new Promise((resolveMethod) => {
            exec(`osascript -e '${appleScript}'`, (error) => {
              if (!error) {
                console.log('✅ Dock hidden via AppleScript (dock preferences)');
                resolveMethod(true);
              } else {
                console.log('❌ AppleScript dock preferences failed:', error.message);
                resolveMethod(false);
              }
            });
          });
        },
        
        // Method 2: Direct defaults command
        () => {
          return new Promise((resolveMethod) => {
            exec('defaults write com.apple.dock autohide -bool true && killall Dock', (error) => {
              if (!error) {
                console.log('✅ Dock hidden via defaults command');
                resolveMethod(true);
              } else {
                console.log('❌ Defaults command failed:', error.message);
                resolveMethod(false);
              }
            });
          });
        },
        
        // Method 3: Alternative AppleScript approach
        () => {
          const appleScript = `
            tell application "System Events"
              set dockHidden to autohide of dock preferences
              if dockHidden is false then
                set autohide of dock preferences to true
              end if
            end tell
          `;
          
          return new Promise((resolveMethod) => {
            exec(`osascript -e '${appleScript}'`, (error) => {
              if (!error) {
                console.log('✅ Dock hidden via alternative AppleScript');
                resolveMethod(true);
              } else {
                console.log('❌ Alternative AppleScript failed:', error.message);
                resolveMethod(false);
              }
            });
          });
        }
      ];
      
      // Try methods sequentially until one succeeds
      const tryNextMethod = async (index) => {
        if (index >= methods.length) {
          console.error('❌ All dock hiding methods failed');
          resolve(false);
          return;
        }
        
        try {
          const success = await methods[index]();
          if (success) {
            this.dockCurrentlyHidden = true;
            this.clearCache(); // Clear cache since state changed
            resolve(true);
          } else {
            tryNextMethod(index + 1);
          }
        } catch (error) {
          console.error(`❌ Method ${index + 1} threw error:`, error);
          tryNextMethod(index + 1);
        }
      };
      
      tryNextMethod(0);
    });
  }

  async showDock() {
    console.log('🏠 Showing dock');
    
    return new Promise((resolve) => {
      // Try multiple approaches for better compatibility
      const methods = [
        // Method 1: AppleScript with dock preferences
        () => {
          const appleScript = `
            tell application "System Events"
              tell dock preferences
                set autohide to false
              end tell
            end tell
          `;
          
          return new Promise((resolveMethod) => {
            exec(`osascript -e '${appleScript}'`, (error) => {
              if (!error) {
                console.log('✅ Dock shown via AppleScript (dock preferences)');
                resolveMethod(true);
              } else {
                console.log('❌ AppleScript dock preferences failed:', error.message);
                resolveMethod(false);
              }
            });
          });
        },
        
        // Method 2: Direct defaults command
        () => {
          return new Promise((resolveMethod) => {
            exec('defaults write com.apple.dock autohide -bool false && killall Dock', (error) => {
              if (!error) {
                console.log('✅ Dock shown via defaults command');
                resolveMethod(true);
              } else {
                console.log('❌ Defaults command failed:', error.message);
                resolveMethod(false);
              }
            });
          });
        }
      ];
      
      // Try methods sequentially until one succeeds
      const tryNextMethod = async (index) => {
        if (index >= methods.length) {
          console.error('❌ All dock showing methods failed');
          resolve(false);
          return;
        }
        
        try {
          const success = await methods[index]();
          if (success) {
            this.dockCurrentlyHidden = false;
            this.clearCache(); // Clear cache since state changed
            resolve(true);
          } else {
            tryNextMethod(index + 1);
          }
        } catch (error) {
          console.error(`❌ Method ${index + 1} threw error:`, error);
          tryNextMethod(index + 1);
        }
      };
      
      tryNextMethod(0);
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
          resolve(this.lastKnownPosition); // Return cached value
        } else {
          const position = stdout.trim().toLowerCase();
          this.lastKnownPosition = position;
          console.log('🏠 Dock position detected:', position);
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
      // Try multiple property names for dock size
      const scripts = [
        // Method 1: tile size (with space)
        `tell application "System Events"
          tell dock preferences
            get tile size
          end tell
        end tell`,
        
        // Method 2: size property
        `tell application "System Events"
          tell dock preferences
            get size
          end tell
        end tell`,
        
        // Method 3: defaults read
        `defaults read com.apple.dock tilesize`
      ];
      
      const tryScript = (index) => {
        if (index >= scripts.length) {
          console.log('🏠 Using default dock size (64px)');
          this.lastKnownSize = 64;
          resolve(64);
          return;
        }
        
        const isDefaults = index === 2;
        const command = isDefaults ? scripts[index] : `osascript -e '${scripts[index]}'`;
        
        exec(command, (error, stdout) => {
          if (error) {
            console.log(`🏠 Dock size method ${index + 1} failed, trying next...`);
            tryScript(index + 1);
          } else {
            const size = parseInt(stdout.trim());
            if (!isNaN(size) && size > 0) {
              this.lastKnownSize = size;
              console.log('🏠 Dock size detected:', size);
              resolve(size);
            } else {
              tryScript(index + 1);
            }
          }
        });
      };
      
      tryScript(0);
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

    // Use cache if available and not expired
    const now = Date.now();
    if (this.dockInfoCache && now < this.cacheExpiry) {
      console.log('🏠 Using cached dock info');
      return this.dockInfoCache;
    }

    console.log('🏠 Refreshing dock info...');

    // Update current state first
    await this.refreshDockState();

    // Get position and size in parallel for speed
    const [position, size] = await Promise.all([
      this.getDockPosition(),
      this.getDockSize()
    ]);

    const dockInfo = {
      platform: 'macos',
      hidden: this.dockCurrentlyHidden,
      position,
      size
    };

    // Cache the result
    this.dockInfoCache = dockInfo;
    this.cacheExpiry = now + this.cacheTimeout;

    return dockInfo;
  }

  // Force update dock state (useful for debugging and initialization)
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
          const stateChanged = isHidden !== this.dockCurrentlyHidden;
          
          this.dockCurrentlyHidden = isHidden;
          
          if (stateChanged) {
            console.log('🏠 Dock state changed - hidden:', isHidden);
          } else {
            console.log('🏠 Dock state confirmed - hidden:', isHidden);
          }
          
          resolve(true);
        }
      });
    });
  }

  // Enhanced reset dock to defaults with better error handling
  async resetDockToDefaults() {
    if (process.platform !== 'darwin') {
      return false;
    }

    console.log('🏠 Resetting dock to system defaults...');
    
    return new Promise((resolve) => {
      // Method 1: Try to restore to original state first
      if (this.originalDockState) {
        console.log('🔄 Attempting to restore to original dock state...');
        
        const restoreScript = `
          tell application "System Events"
            tell dock preferences
              set autohide to ${this.originalDockState.hidden ? 'true' : 'false'}
            end tell
          end tell
        `;
        
        exec(`osascript -e '${restoreScript}'`, (error) => {
          if (!error) {
            this.dockCurrentlyHidden = this.originalDockState.hidden;
            console.log('✅ Dock restored to original state');
            resolve(true);
            return;
          } else {
            console.log('❌ Failed to restore to original state, trying full reset...');
            this.performFullDockReset(resolve);
          }
        });
      } else {
        this.performFullDockReset(resolve);
      }
    });
  }

  performFullDockReset(resolve) {
    console.log('🔄 Performing full dock reset...');
    
    // Method 2: Full reset using defaults delete
    exec('defaults delete com.apple.dock && killall Dock', (error) => {
      if (error) {
        console.error('❌ Full dock reset failed:', error);
        
        // Method 3: Fallback - just ensure dock is visible
        console.log('🔄 Fallback - ensuring dock visibility...');
        exec('defaults write com.apple.dock autohide -bool false && killall Dock', (fallbackError) => {
          if (!fallbackError) {
            this.dockCurrentlyHidden = false;
            console.log('✅ Dock visibility restored (fallback)');
            resolve(true);
          } else {
            console.error('❌ Even fallback dock restoration failed:', fallbackError);
            resolve(false);
          }
        });
      } else {
        this.dockCurrentlyHidden = false; // Assume default is shown
        console.log('✅ Dock reset to system defaults');
        resolve(true);
      }
    });
  }

  // Get original dock state
  getOriginalDockState() {
    return this.originalDockState;
  }

  // Restore to original state
  async restoreToOriginalState() {
    if (!this.originalDockState) {
      console.log('⚠️ No original dock state to restore');
      return false;
    }

    console.log('🔄 Restoring dock to original state:', this.originalDockState);

    try {
      const success = await this.setDockVisibility(!this.originalDockState.hidden);
      if (success) {
        console.log('✅ Dock restored to original visibility state');
        return true;
      } else {
        console.error('❌ Failed to restore dock to original state');
        return false;
      }
    } catch (error) {
      console.error('❌ Error restoring dock to original state:', error);
      return false;
    }
  }

  // Check if dock conflicts with a given position
  async wouldConflictWithPosition(windowPosition) {
    const dockPosition = await this.getDockPosition();
    
    // Define conflict matrix
    const conflicts = {
      'bottom': ['bottom'],
      'top': ['top'],
      'left': ['left'],
      'right': ['right']
    };
    
    const conflictingPositions = conflicts[dockPosition] || [];
    const wouldConflict = conflictingPositions.includes(windowPosition);
    
    console.log(`🏠 Dock at ${dockPosition}, window at ${windowPosition}, conflict: ${wouldConflict}`);
    
    return wouldConflict;
  }

  // Calculate available screen space considering dock
  async getAvailableScreenSpace(display) {
    const dockInfo = await this.getDockInfo();
    
    if (dockInfo.platform !== 'macos' || dockInfo.hidden) {
      // If not macOS or dock is hidden, return full display bounds
      return display.bounds;
    }
    
    const { x, y, width, height } = display.bounds;
    const dockSize = dockInfo.size || 64;
    
    let availableSpace = { x, y, width, height };
    
    // Adjust based on dock position
    switch (dockInfo.position) {
      case 'left':
        availableSpace.x += dockSize;
        availableSpace.width -= dockSize;
        break;
      case 'right':
        availableSpace.width -= dockSize;
        break;
      case 'bottom':
        availableSpace.height -= dockSize;
        break;
      case 'top':
        availableSpace.y += dockSize;
        availableSpace.height -= dockSize;
        break;
    }
    
    console.log(`🏠 Available space (dock ${dockInfo.position}): ${availableSpace.width}x${availableSpace.height} at (${availableSpace.x}, ${availableSpace.y})`);
    
    return availableSpace;
  }

  // Enhanced debug info
  async getDebugInfo() {
    const dockInfo = await this.getDockInfo();
    
    return {
      current: dockInfo,
      original: this.originalDockState,
      cached: {
        hidden: this.dockCurrentlyHidden,
        position: this.lastKnownPosition,
        size: this.lastKnownSize
      },
      platform: process.platform
    };
  }
}

module.exports = DockService;