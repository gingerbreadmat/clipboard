class ServiceRegistry {
  constructor() {
    this.services = new Map();
    this.initialized = new Set();
    console.log('📋 Service registry created');
  }

  register(name, serviceInstance) {
    if (this.services.has(name)) {
      console.warn(`⚠️ Service '${name}' already registered, overwriting`);
    }
    
    this.services.set(name, serviceInstance);
    console.log(`✅ Service registered: ${name}`);
    return this;
  }

  get(name) {
    if (!this.services.has(name)) {
      throw new Error(`❌ Service '${name}' not found in registry`);
    }
    return this.services.get(name);
  }

  has(name) {
    return this.services.has(name);
  }

  markInitialized(name) {
    this.initialized.add(name);
    console.log(`🎯 Service initialized: ${name}`);
  }

  isInitialized(name) {
    return this.initialized.has(name);
  }

  getAll() {
    return Array.from(this.services.keys());
  }

  getInitialized() {
    return Array.from(this.initialized);
  }

  cleanup() {
    console.log('🧹 Cleaning up services...');
    
    // Cleanup in reverse order of initialization
    const services = Array.from(this.initialized).reverse();
    
    for (const serviceName of services) {
      try {
        const service = this.get(serviceName);
        if (service && typeof service.cleanup === 'function') {
          service.cleanup();
          console.log(`🧹 Cleaned up: ${serviceName}`);
        }
      } catch (error) {
        console.error(`❌ Error cleaning up ${serviceName}:`, error);
      }
    }
    
    this.services.clear();
    this.initialized.clear();
    console.log('✅ Service registry cleanup completed');
  }
}

module.exports = ServiceRegistry;
