class WindowLifecycle {
  constructor() {
    this.windows = new Map();
    this.lifecycleListeners = new Set();
    console.log('🔄 Window Lifecycle initialized');
  }

  /**
   * Register a window for lifecycle management
   */
  registerWindow(window, type, metadata = {}) {
    if (!window || window.isDestroyed()) {
      console.error('❌ Cannot register destroyed window');
      return false;
    }

    const windowId = window.id;
    const windowInfo = {
      id: windowId,
      type,
      window,
      metadata,
      createdAt: Date.now(),
      state: 'created',
      events: []
    };

    this.windows.set(windowId, windowInfo);
    console.log(`🔄 Window registered: ${type} (ID: ${windowId})`);
    return true;
  }

  /**
   * Add lifecycle change listener
   */
  addLifecycleListener(callback) {
    this.lifecycleListeners.add(callback);
  }

  /**
   * Remove lifecycle change listener
   */
  removeLifecycleListener(callback) {
    this.lifecycleListeners.delete(callback);
  }

  /**
   * Clean up all resources
   */
  destroy() {
    console.log('🔄 Destroying window lifecycle...');
    this.lifecycleListeners.clear();
    this.windows.clear();
    console.log('✅ Window lifecycle destroyed');
  }
}

module.exports = WindowLifecycle;