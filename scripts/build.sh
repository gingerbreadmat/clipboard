#!/bin/bash

# Build script for Clipboard Manager
# This script ensures proper universal builds for macOS distribution

set -e  # Exit on any error

echo "🚀 Starting Clipboard Manager build process..."

# Check if we're on macOS
if [[ "$OSTYPE" != "darwin"* ]]; then
  echo "❌ This build script must be run on macOS"
  exit 1
fi

# Clean previous builds
echo "🧹 Cleaning previous builds..."
rm -rf dist/
rm -rf build/
rm -rf node_modules/.cache/

# Install dependencies
echo "📦 Installing dependencies..."
npm ci

# Build native modules for universal architecture
echo "🔨 Building native modules for universal architecture..."

# Remove existing native builds
rm -rf build/

# Build for x64
echo "Building for x64..."
npm run build-native -- --arch=x64

# Build for arm64  
echo "Building for arm64..."
npm run build-native -- --arch=arm64

# Create universal binary
echo "Creating universal binary..."
if [ -f "build/Release/macos_window_manager.node" ]; then
  # Backup x64 version
  cp build/Release/macos_window_manager.node build/Release/macos_window_manager_x64.node
  
  # Build arm64 version
  npm run build-native -- --arch=arm64
  cp build/Release/macos_window_manager.node build/Release/macos_window_manager_arm64.node
  
  # Create universal binary
  lipo -create \
    build/Release/macos_window_manager_x64.node \
    build/Release/macos_window_manager_arm64.node \
    -output build/Release/macos_window_manager.node
    
  echo "✅ Universal binary created"
else
  echo "⚠️  Native module not found, continuing without universal binary"
fi

# Rebuild all native dependencies for electron
echo "🔄 Rebuilding native dependencies for Electron..."
npx electron-rebuild --arch=universal

# Create app icon if it doesn't exist
if [ ! -f "assets/icon.icns" ]; then
  echo "⚠️  Creating placeholder icon..."
  mkdir -p assets
  # You should replace this with your actual icon
  echo "📝 Please add your app icon at assets/icon.icns"
  # Create a simple placeholder (you'll need to replace this)
  touch assets/icon.icns
fi

# Build the app
echo "🏗️  Building Electron app..."
npx electron-builder --mac --universal

# Check if DMG was created
if [ -f "dist/Clipboard Manager-*.dmg" ]; then
  echo "✅ Build completed successfully!"
  echo "📦 DMG file created in dist/ folder"
  
  # List the created files
  ls -la dist/
  
  echo ""
  echo "🎉 Build complete! Your app should now work on any macOS machine."
  echo ""
  echo "Note: For distribution outside the Mac App Store, you'll need:"
  echo "  1. Developer ID Certificate for code signing"
  echo "  2. Notarization (if you have Apple ID credentials set)"
  echo "  3. Test on both Intel and Apple Silicon Macs"
  
else
  echo "❌ Build failed - DMG file not found"
  exit 1
fi