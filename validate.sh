// Phase 1 Test Script - test-phase1.js
// Run this with: node test-phase1.js

const fs = require('fs');
const path = require('path');

console.log('🧪 Phase 1 Structure Validation');
console.log('================================');

// Test 1: Check directory structure
function testDirectoryStructure() {
  console.log('\n📁 Testing directory structure...');
  
  const requiredDirs = [
    'src',
    'src/bootstrap',
    'src/config',
    'src/managers',
    'src/services',
    'src/storage'
  ];
  
  let allExist = true;
  
  requiredDirs.forEach(dir => {
    if (fs.existsSync(dir)) {
      console.log(`  ✅ ${dir}/`);
    } else {
      console.log(`  ❌ ${dir}/ (missing)`);
      allExist = false;
    }
  });
  
  return allExist;
}

// Test 2: Check required files
function testRequiredFiles() {
  console.log('\n📄 Testing required files...');
  
  const requiredFiles = [
    'main.js',
    'src/app.js',
    'src/bootstrap/service-registry.js',
    'src/bootstrap/app-initializer.js',
    'src/bootstrap/permission-manager.js',
    'src/config/app-config.js',
    'src/config/platform-config.js',
    'src/storage/index.js'
  ];
  
  let allExist = true;
  
  requiredFiles.forEach(file => {
    if (fs.existsSync(file)) {
      console.log(`  ✅ ${file}`);
    } else {
      console.log(`  ❌ ${file} (missing)`);
      allExist = false;
    }
  });
  
  return allExist;
}

// Test 3: Validate file syntax
function testFileSyntax() {
  console.log('\n🔍 Testing file syntax...');
  
  const jsFiles = [
    'main.js',
    'src/app.js',
    'src/bootstrap/service-registry.js',
    'src/bootstrap/app-initializer.js',
    'src/bootstrap/permission-manager.js',
    'src/config/app-config.js',
    'src/config/platform-config.js'
  ];
  
  let allValid = true;
  
  jsFiles.forEach(file => {
    if (fs.existsSync(file)) {
      try {
        const content = fs.readFileSync(file, 'utf8');
        // Basic syntax check - try to parse as JS
        new Function(content);
        console.log(`  ✅ ${file} (syntax valid)`);
      } catch (error) {
        console.log(`  ❌ ${file} (syntax error: ${error.message})`);
        allValid = false;
      }
    } else {
      console.log(`  ⚠️ ${file} (file not found)`);
    }
  });
  
  return allValid;
}

// Test 4: Check module exports
function testModuleExports() {
  console.log('\n🔗 Testing module exports...');
  
  const modules = [
    { file: 'src/app.js', expectedExport: 'function' },
    { file: 'src/bootstrap/service-registry.js', expectedExport: 'function' },
    { file: 'src/bootstrap/app-initializer.js', expectedExport: 'function' },
    { file: 'src/bootstrap/permission-manager.js', expectedExport: 'function' },
    { file: 'src/config/app-config.js', expectedExport: 'object' },
    { file: 'src/config/platform-config.js', expectedExport: 'object' }
  ];
  
  let allValid = true;
  
  modules.forEach(({ file, expectedExport }) => {
    if (fs.existsSync(file)) {
      try {
        // Clear require cache
        delete require.cache[path.resolve(file)];
        const exported = require(`./${file}`);
        const actualType = typeof exported;
        
        if (actualType === expectedExport) {
          console.log(`  ✅ ${file} (exports ${actualType})`);
        } else {
          console.log(`  ❌ ${file} (expected ${expectedExport}, got ${actualType})`);
          allValid = false;
        }
      } catch (error) {
        console.log(`  ❌ ${file} (require error: ${error.message})`);
        allValid = false;
      }
    } else {
      console.log(`  ⚠️ ${file} (file not found)`);
    }
  });
  
  return allValid;
}

// Test 5: Validate service registry functionality
function testServiceRegistry() {
  console.log('\n🏗️ Testing ServiceRegistry functionality...');
  
  try {
    // Clear require cache
    delete require.cache[path.resolve('src/bootstrap/service-registry.js')];
    const ServiceRegistry = require('./src/bootstrap/service-registry.js');
    
    const registry = new ServiceRegistry();
    
    // Test registration
    const testService = { name: 'test', cleanup: () => {} };
    registry.register('testService', testService);
    
    // Test retrieval
    const retrieved = registry.get('testService');
    if (retrieved === testService) {
      console.log('  ✅ Service registration and retrieval works');
    } else {
      console.log('  ❌ Service registration/retrieval failed');
      return false;
    }
    
    // Test initialization tracking
    registry.markInitialized('testService');
    if (registry.isInitialized('testService')) {
      console.log('  ✅ Initialization tracking works');
    } else {
      console.log('  ❌ Initialization tracking failed');
      return false;
    }
    
    // Test cleanup
    registry.cleanup();
    console.log('  ✅ Cleanup completed without errors');
    
    return true;
  } catch (error) {
    console.log(`  ❌ ServiceRegistry test failed: ${error.message}`);
    return false;
  }
}

// Test 6: Check configuration loading
function testConfiguration() {
  console.log('\n⚙️ Testing configuration loading...');
  
  try {
    // Test app config
    delete require.cache[path.resolve('src/config/app-config.js')];
    const appConfig = require('./src/config/app-config.js');
    
    if (appConfig.APP_NAME && appConfig.WINDOW && appConfig.CLIPBOARD) {
      console.log('  ✅ App configuration structure valid');
    } else {
      console.log('  ❌ App configuration missing required properties');
      return false;
    }
    
    // Test platform config
    delete require.cache[path.resolve('src/config/platform-config.js')];
    const { getPlatformConfig } = require('./src/config/platform-config.js');
    
    const currentPlatformConfig = getPlatformConfig();
    if (currentPlatformConfig && currentPlatformConfig.shortcuts) {
      console.log('  ✅ Platform configuration valid');
    } else {
      console.log('  ❌ Platform configuration invalid');
      return false;
    }
    
    return true;
  } catch (error) {
    console.log(`  ❌ Configuration test failed: ${error.message}`);
    return false;
  }
}

// Run all tests
async function runAllTests() {
  console.log('Starting comprehensive Phase 1 validation...\n');
  
  const results = {
    directories: testDirectoryStructure(),
    files: testRequiredFiles(),
    syntax: testFileSyntax(),
    exports: testModuleExports(),
    serviceRegistry: testServiceRegistry(),
    configuration: testConfiguration()
  };
  
  console.log('\n📊 Test Results Summary');
  console.log('========================');
  
  let allPassed = true;
  Object.entries(results).forEach(([test, passed]) => {
    const status = passed ? '✅' : '❌';
    console.log(`${status} ${test}: ${passed ? 'PASSED' : 'FAILED'}`);
    if (!passed) allPassed = false;
  });
  
  console.log('\n' + '='.repeat(50));
  
  if (allPassed) {
    console.log('🎉 ALL TESTS PASSED! Phase 1 structure is valid.');
    console.log('✅ Ready to proceed with Phase 2 (Window Management)');
    console.log('\nNext steps:');
    console.log('1. Test the app with: npm start');
    console.log('2. Verify all functionality works as expected');
    console.log('3. Fix any import issues in existing files');
    console.log('4. Proceed to Phase 2 refactoring');
  } else {
    console.log('❌ SOME TESTS FAILED! Please fix issues before proceeding.');
    console.log('\nTo fix issues:');
    console.log('1. Check file permissions and paths');
    console.log('2. Verify all files were created correctly');
    console.log('3. Check syntax errors in failed files');
    console.log('4. Re-run this test script');
  }
  
  console.log('\n📝 Additional manual checks needed:');
  console.log('- Run "npm start" to test actual app functionality');
  console.log('- Verify clipboard monitoring still works');
  console.log('- Test window positioning and settings');
  console.log('- Check that all existing features work');
  
  return allPassed;
}

// Execute tests
runAllTests().catch(error => {
  console.error('Test execution failed:', error);
  process.exit(1);
});

// Export for programmatic use
module.exports = {
  testDirectoryStructure,
  testRequiredFiles,
  testFileSyntax,
  testModuleExports,
  testServiceRegistry,
  testConfiguration,
  runAllTests
};