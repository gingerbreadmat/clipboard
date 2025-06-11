const { app, systemPreferences } = require('electron');

class PermissionManager {
  constructor() {
    this.platform = process.platform;
    console.log('🔐 Permission manager initialized');
  }

  async requestRequiredPermissions() {
    if (this.platform === 'darwin') {
      await this.requestMacOSPermissions();
    }
    // Add other platforms as needed
  }

  async requestMacOSPermissions() {
    console.log('🍎 macOS detected, checking permissions...');
    
    // Set about panel
    app.setAboutPanelOptions({
      applicationName: 'Clipboard Manager',
      applicationVersion: '1.0.0',
      credits: 'A comprehensive clipboard manager for macOS'
    });

    // Check accessibility permissions
    await this.checkAccessibilityPermissions();
  }

  async checkAccessibilityPermissions() {
    try {
      const hasPermissions = systemPreferences.isTrustedAccessibilityClient(false);
      
      if (!hasPermissions) {
        console.log('🔐 Requesting accessibility permissions...');
        systemPreferences.isTrustedAccessibilityClient(true);
      } else {
        console.log('✅ Accessibility permissions already granted');
      }
      
      return hasPermissions;
    } catch (error) {
      console.error('❌ Error checking accessibility permissions:', error);
      return false;
    }
  }

  async checkScreenRecordingPermissions() {
    // Future: Add screen recording permission check if needed
    return true;
  }

  async checkFileSystemPermissions() {
    // Future: Add file system permission check if needed
    return true;
  }
}

module.exports = PermissionManager;
