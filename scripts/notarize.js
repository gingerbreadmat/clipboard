const { notarize } = require('@electron/notarize');

exports.default = async function notarizing(context) {
  const { electronPlatformName, appOutDir } = context;
  
  if (electronPlatformName !== 'darwin') {
    return;
  }

  // Skip notarization if no credentials are provided
  if (!process.env.APPLE_ID || !process.env.APPLE_ID_PASS) {
    console.log('Skipping notarization: APPLE_ID and APPLE_ID_PASS environment variables not set');
    return;
  }

  const appName = context.packager.appInfo.productFilename;

  console.log('Notarizing app...');
  
  try {
    await notarize({
      appBundleId: 'com.yourname.clipboard-manager',
      appPath: `${appOutDir}/${appName}.app`,
      appleId: process.env.APPLE_ID,
      appleIdPassword: process.env.APPLE_ID_PASS,
      teamId: process.env.APPLE_TEAM_ID, // Optional but recommended
    });
    
    console.log('App notarized successfully');
  } catch (error) {
    console.error('Notarization failed:', error);
    throw error;
  }
};