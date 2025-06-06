// src/services/system-thumbnail-extractor.js
// Enhanced file processing with system thumbnails

class SystemThumbnailExtractor {
  constructor() {
    this.thumbnailCache = new Map();
    this.iconCache = new Map();
  }

  async getFileInfo(filePath) {
    try {
      const fs = require('fs');
      const path = require('path');
      const { nativeImage } = require('electron');
      
      if (!fs.existsSync(filePath)) {
        return null;
      }

      const stats = fs.statSync(filePath);
      const fileName = path.basename(filePath);
      const extension = path.extname(filePath).toLowerCase().substring(1);
      
      const fileInfo = {
        name: fileName,
        extension: extension,
        size: stats.size,
        path: filePath,
        mtime: stats.mtime,
        type: this.getFileType(extension),
        
        // System provided info
        systemIcon: null,
        systemThumbnail: null,
        previewAvailable: false,
        
        // Source app info
        sourceApp: await this.getSourceApplication(),
        
        // Enhanced metadata
        metadata: await this.extractMetadata(filePath, extension)
      };

      // Get system icon/thumbnail
      const thumbnailData = await this.getSystemThumbnail(filePath);
      if (thumbnailData) {
        fileInfo.systemThumbnail = thumbnailData.thumbnail;
        fileInfo.systemIcon = thumbnailData.icon;
        fileInfo.previewAvailable = thumbnailData.hasPreview;
      }

      return fileInfo;
    } catch (error) {
      console.error('Error getting file info:', error);
      return null;
    }
  }

  async getSystemThumbnail(filePath) {
    // Check cache first
    if (this.thumbnailCache.has(filePath)) {
      return this.thumbnailCache.get(filePath);
    }

    try {
      // Method 1: Use macOS Quick Look for thumbnails
      const quickLookThumbnail = await this.getQuickLookThumbnail(filePath);
      if (quickLookThumbnail) {
        const result = {
          thumbnail: quickLookThumbnail,
          icon: quickLookThumbnail, // Same for now
          hasPreview: true,
          source: 'quicklook'
        };
        this.thumbnailCache.set(filePath, result);
        return result;
      }

      // Method 2: Use Finder icon via AppleScript
      const finderIcon = await this.getFinderIcon(filePath);
      if (finderIcon) {
        const result = {
          thumbnail: finderIcon,
          icon: finderIcon,
          hasPreview: false,
          source: 'finder'
        };
        this.thumbnailCache.set(filePath, result);
        return result;
      }

      // Method 3: Use file extension icon
      const extensionIcon = await this.getExtensionIcon(filePath);
      if (extensionIcon) {
        const result = {
          thumbnail: extensionIcon,
          icon: extensionIcon,
          hasPreview: false,
          source: 'extension'
        };
        this.thumbnailCache.set(filePath, result);
        return result;
      }

      return null;
    } catch (error) {
      console.error('Error getting system thumbnail:', error);
      return null;
    }
  }

  async getQuickLookThumbnail(filePath, size = 256) {
    try {
      const { execSync } = require('child_process');
      const path = require('path');
      const fs = require('fs');
      const { nativeImage } = require('electron');
      
      // Create temp file for thumbnail
      const tempDir = require('os').tmpdir();
      const tempFile = path.join(tempDir, `thumb_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.png`);
      
      // Use qlmanage to generate thumbnail
      const command = `qlmanage -t -s ${size} -o "${tempDir}" "${filePath}"`;
      
      try {
        execSync(command, { 
          stdio: 'ignore', // Suppress output
          timeout: 5000 // 5 second timeout
        });
        
        // qlmanage creates files with specific naming
        const baseName = path.basename(filePath);
        const possibleThumbPaths = [
          path.join(tempDir, `${baseName}.png`),
          path.join(tempDir, `${baseName}.jpg`),
          path.join(tempDir, `${baseName}.jpeg`)
        ];
        
        for (const thumbPath of possibleThumbPaths) {
          if (fs.existsSync(thumbPath)) {
            const image = nativeImage.createFromPath(thumbPath);
            if (!image.isEmpty()) {
              // Clean up temp file
              try { fs.unlinkSync(thumbPath); } catch (e) {}
              
              // Convert to data URL
              const buffer = image.toPNG();
              return `data:image/png;base64,${buffer.toString('base64')}`;
            }
          }
        }
      } catch (execError) {
        // qlmanage failed, try alternative
      }
      
      return null;
    } catch (error) {
      console.error('QuickLook thumbnail failed:', error);
      return null;
    }
  }

  async getFinderIcon(filePath) {
    try {
      const { execSync } = require('child_process');
      const path = require('path');
      const fs = require('fs');
      const { nativeImage } = require('electron');
      
      // Use AppleScript to get Finder icon
      const script = `
        tell application "Finder"
          set theFile to POSIX file "${filePath}" as alias
          set theIcon to icon of theFile
          return theIcon
        end tell
      `;
      
      // This is a simplified approach - in practice you'd need to:
      // 1. Use osascript to get icon data
      // 2. Convert the icon to a usable format
      // 3. Return as data URL
      
      // For now, let's use a more direct approach with file command
      const fileOutput = execSync(`file -b "${filePath}"`, { encoding: 'utf8' }).trim();
      
      // Based on file type, we could map to system icons
      // This is where we'd implement more sophisticated icon extraction
      
      return null; // Placeholder - would return actual icon data
    } catch (error) {
      console.error('Finder icon extraction failed:', error);
      return null;
    }
  }

  async getExtensionIcon(filePath) {
    try {
      const path = require('path');
      const { nativeImage } = require('electron');
      
      const extension = path.extname(filePath).toLowerCase().substring(1);
      
      // On macOS, we can use NSWorkspace to get the icon for a file type
      // This would require a native module or more sophisticated integration
      
      // For now, return null and fall back to our emoji system
      return null;
    } catch (error) {
      console.error('Extension icon extraction failed:', error);
      return null;
    }
  }

  async getSourceApplication() {
    try {
      const { execSync } = require('child_process');
      
      // Get the frontmost application when copy occurred
      const script = `
        tell application "System Events"
          set frontApp to name of first process whose frontmost is true
          try
            set frontAppFile to file of first process whose frontmost is true
            set frontAppPath to POSIX path of frontAppFile
            return frontApp & "|" & frontAppPath
          on error
            return frontApp & "|" & ""
          end try
        end tell
      `;
      
      const result = execSync(`osascript -e '${script}'`, { 
        encoding: 'utf8',
        timeout: 2000 
      }).trim();
      
      const [appName, appPath] = result.split('|');
      
      return {
        name: appName || 'Unknown',
        path: appPath || null,
        bundleId: appPath ? await this.getBundleId(appPath) : null
      };
    } catch (error) {
      console.error('Could not get source application:', error);
      return {
        name: 'Unknown',
        path: null,
        bundleId: null
      };
    }
  }

  async getBundleId(appPath) {
    try {
      const { execSync } = require('child_process');
      const result = execSync(`mdls -name kMDItemCFBundleIdentifier -r "${appPath}"`, {
        encoding: 'utf8',
        timeout: 1000
      }).trim();
      
      return result !== '(null)' ? result : null;
    } catch (error) {
      return null;
    }
  }

  async extractMetadata(filePath, extension) {
    const metadata = {
      dimensions: null,
      duration: null,
      colorProfile: null,
      camera: null,
      location: null
    };

    try {
      // For images, get dimensions and EXIF data
      if (this.isImageFile(extension)) {
        metadata.dimensions = await this.getImageDimensions(filePath);
        metadata.camera = await this.getCameraInfo(filePath);
      }
      
      // For videos, get duration and dimensions
      if (this.isVideoFile(extension)) {
        metadata.duration = await this.getVideoDuration(filePath);
        metadata.dimensions = await this.getVideoDimensions(filePath);
      }
      
      // For documents, get page count
      if (this.isDocumentFile(extension)) {
        metadata.pageCount = await this.getPageCount(filePath);
      }
      
    } catch (error) {
      console.error('Error extracting metadata:', error);
    }

    return metadata;
  }

  getFileType(extension) {
    const typeMap = {
      // Images
      'jpg': 'image', 'jpeg': 'image', 'png': 'image', 'gif': 'image', 
      'svg': 'image', 'webp': 'image', 'tiff': 'image', 'bmp': 'image',
      'ico': 'image', 'icns': 'image',
      
      // Documents  
      'pdf': 'document', 'doc': 'document', 'docx': 'document',
      'xls': 'document', 'xlsx': 'document', 'ppt': 'document', 'pptx': 'document',
      'txt': 'document', 'rtf': 'document', 'pages': 'document', 
      'numbers': 'document', 'keynote': 'document',
      
      // Media
      'mp4': 'video', 'mov': 'video', 'avi': 'video', 'mkv': 'video', 'webm': 'video',
      'mp3': 'audio', 'wav': 'audio', 'flac': 'audio', 'aac': 'audio', 'm4a': 'audio',
      
      // Archives
      'zip': 'archive', 'rar': 'archive', '7z': 'archive', 'tar': 'archive', 
      'gz': 'archive', 'dmg': 'archive', 'iso': 'archive',
      
      // Applications
      'app': 'application', 'pkg': 'application', 'deb': 'application', 
      'exe': 'application', 'msi': 'application',
      
      // Code
      'js': 'code', 'ts': 'code', 'py': 'code', 'html': 'code', 'css': 'code',
      'json': 'code', 'xml': 'code', 'yaml': 'code', 'yml': 'code'
    };
    
    return typeMap[extension] || 'unknown';
  }

  isImageFile(extension) {
    return ['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp', 'tiff', 'bmp', 'ico', 'icns'].includes(extension);
  }

  isVideoFile(extension) {
    return ['mp4', 'mov', 'avi', 'mkv', 'webm', 'flv', 'wmv'].includes(extension);
  }

  isDocumentFile(extension) {
    return ['pdf', 'doc', 'docx', 'pages', 'txt', 'rtf'].includes(extension);
  }

  // Additional metadata extraction methods would go here...
  async getImageDimensions(filePath) {
    // Implementation for getting image dimensions
    return null;
  }

  async getCameraInfo(filePath) {
    // Implementation for EXIF camera data
    return null;
  }

  async getVideoDuration(filePath) {
    // Implementation for video duration
    return null;
  }

  async getVideoDimensions(filePath) {
    // Implementation for video dimensions  
    return null;
  }

  async getPageCount(filePath) {
    // Implementation for document page count
    return null;
  }
}

module.exports = SystemThumbnailExtractor;