const PLATFORM_CONFIG = {
  darwin: {
    // macOS specific
    shortcuts: {
      main: 'Cmd+Shift+V',
      settings: 'Cmd+,',
      quit: 'Cmd+Q'
    },
    permissions: {
      accessibility: true,
      screenRecording: false,
      fileSystem: true
    },
    window: {
      vibrancy: 'sidebar',
      titleBarStyle: 'hiddenInset',
      trafficLightPosition: { x: 20, y: 20 }
    }
  },
  
  win32: {
    // Windows specific
    shortcuts: {
      main: 'Ctrl+Shift+V',
      settings: 'Ctrl+,',
      quit: 'Ctrl+Q'
    },
    permissions: {
      accessibility: false,
      screenRecording: false,
      fileSystem: true
    }
  },
  
  linux: {
    // Linux specific
    shortcuts: {
      main: 'Ctrl+Shift+V',
      settings: 'Ctrl+,',
      quit: 'Ctrl+Q'
    },
    permissions: {
      accessibility: false,
      screenRecording: false,
      fileSystem: true
    }
  }
};

function getPlatformConfig() {
  return PLATFORM_CONFIG[process.platform] || PLATFORM_CONFIG.linux;
}

module.exports = {
  PLATFORM_CONFIG,
  getPlatformConfig
};
