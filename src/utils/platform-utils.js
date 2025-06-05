const os = require('os');

class PlatformUtils {
  static isMacOS() {
    return process.platform === 'darwin';
  }

  static isWindows() {
    return process.platform === 'win32';
  }

  static isLinux() {
    return process.platform === 'linux';
  }

  static getPlatformName() {
    switch (process.platform) {
      case 'darwin': return 'macOS';
      case 'win32': return 'Windows';
      case 'linux': return 'Linux';
      default: return process.platform;
    }
  }

  static getSystemInfo() {
    return {
      platform: process.platform,
      platformName: this.getPlatformName(),
      arch: process.arch,
      nodeVersion: process.version,
      electronVersion: process.versions.electron,
      chromeVersion: process.versions.chrome,
      osType: os.type(),
      osRelease: os.release(),
      osVersion: os.version ? os.version() : 'Unknown',
      totalMemory: os.totalmem(),
      freeMemory: os.freemem(),
      cpuCount: os.cpus().length,
      uptime: os.uptime(),
      homeDir: os.homedir(),
      tmpDir: os.tmpdir()
    };
  }

  static supportsNativeWindowManagement() {
    return this.isMacOS();
  }

  static supportsDockManagement() {
    return this.isMacOS();
  }

  static supportsSystemTray() {
    // All major platforms support system tray
    return true;
  }

  static supportsGlobalShortcuts() {
    // All major platforms support global shortcuts
    return true;
  }

  static getDefaultShortcutModifier() {
    return this.isMacOS() ? 'Cmd' : 'Ctrl';
  }

  static formatShortcut(keys) {
    const modifier = this.getDefaultShortcutModifier();
    return keys.replace('CmdOrCtrl', modifier);
  }

  static getPreferredTheme() {
    if (this.isMacOS()) {
      try {
        const { nativeTheme } = require('electron');
        return nativeTheme.shouldUseDarkColors ? 'dark' : 'light';
      } catch (error) {
        console.log('Could not detect system theme, defaulting to light');
        return 'light';
      }
    }
    return 'light';
  }

  static async checkAccessibilityPermissions() {
    if (!this.isMacOS()) {
      return true; // Not applicable on non-macOS
    }

    try {
      const { systemPreferences } = require('electron');
      return systemPreferences.isTrustedAccessibilityClient(false);
    } catch (error) {
      console.error('Error checking accessibility permissions:', error);
      return false;
    }
  }

  static async requestAccessibilityPermissions() {
    if (!this.isMacOS()) {
      return true; // Not applicable on non-macOS
    }

    try {
      const { systemPreferences } = require('electron');
      return systemPreferences.isTrustedAccessibilityClient(true);
    } catch (error) {
      console.error('Error requesting accessibility permissions:', error);
      return false;
    }
  }

  static getClipboardFormats() {
    const { clipboard } = require('electron');
    return clipboard.availableFormats();
  }

  static supportsVibrancy() {
    return this.isMacOS();
  }

  static getVibrancyType() {
    if (!this.isMacOS()) return null;
    
    // Different vibrancy types for different macOS versions
    return 'sidebar';
  }

  static async executeAppleScript(script) {
    if (!this.isMacOS()) {
      throw new Error('AppleScript is only available on macOS');
    }

    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);

    try {
      const { stdout } = await execAsync(`osascript -e '${script}'`);
      return stdout.trim();
    } catch (error) {
      console.error('AppleScript execution failed:', error);
      throw error;
    }
  }
}

module.exports = PlatformUtils;