const APP_CONFIG = {
  // Application metadata
  APP_NAME: 'Clipboard Manager',
  APP_VERSION: '1.0.0',
  APP_DESCRIPTION: 'A comprehensive clipboard manager for macOS',
  
  // Window configuration
  WINDOW: {
    DEFAULT_WIDTH: 350,
    DEFAULT_HEIGHT: 600,
    MIN_WIDTH: 300,
    MIN_HEIGHT: 400,
    MAX_ITEMS_DISPLAYED: 100
  },
  
  // Clipboard monitoring
  CLIPBOARD: {
    POLL_INTERVAL: 500, // ms
    COOLDOWN_PERIOD: 1000, // ms
    MAX_HISTORY_ITEMS: 1000,
    MAX_IMAGE_SIZE: 10 * 1024 * 1024, // 10MB
    MAX_IMAGE_DIMENSION: 1920
  },
  
  // Storage configuration
  STORAGE: {
    DATABASE_NAME: 'clipboard.db',
    BACKUP_ENABLED: true,
    CLEANUP_INTERVAL: 24 * 60 * 60 * 1000 // 24 hours
  },
  
  // Performance settings
  PERFORMANCE: {
    DEBOUNCE_SEARCH: 150, // ms
    VIRTUAL_SCROLL_THRESHOLD: 50,
    IMAGE_LAZY_LOADING: true
  }
};

module.exports = APP_CONFIG;
