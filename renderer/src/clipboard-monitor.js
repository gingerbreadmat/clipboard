const { clipboard, nativeImage } = require('electron');
const crypto = require('crypto');

class ClipboardMonitor {
  constructor(storage, mainWindow = null) {
    this.storage = storage;
    this.mainWindow = mainWindow;
    this.lastClipboardHash = '';
    this.interval = null;
    this.pollInterval = 500; // Check every 500ms
    this.lastProcessedTime = 0;
    this.cooldownPeriod = 1000; // 1 second cooldown
  }

  start() {
    this.interval = setInterval(async () => {
      await this.checkClipboard();
    }, this.pollInterval);
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  async checkClipboard() {
    try {
      const now = Date.now();
      
      // Add cooldown to prevent rapid processing of same content
      if (now - this.lastProcessedTime < this.cooldownPeriod) {
        return;
      }

      const formats = clipboard.availableFormats();
      
      if (formats.length === 0) {
        return;
      }

      let content = null;
      let type = 'unknown';
      let hash = '';
      let preview = '';

      // PRIORITY 1: Check for direct image data (works for: web images, Preview right-click copy)
      if (formats.some(format => format.includes('image'))) {
        const image = clipboard.readImage();
        
        if (!image.isEmpty()) {
          const originalBuffer = image.toPNG();
          const quickHash = this.generateHash(originalBuffer.toString('base64'));
          
          if (quickHash === this.lastClipboardHash) {
            return;
          }
          
          const size = image.getSize();
          
          content = this.processImage(image, originalBuffer);
          type = 'image';
          hash = quickHash;
          preview = `Image (${size.width}×${size.height})`;
        }
      }

      // PRIORITY 2: Check for file URIs (text/uri-list format and alternatives)
      if (!content && formats.includes('text/uri-list')) {
        try {
          // Try multiple methods to read file URIs
          let uriList = null;
          
          // Method 1: Direct read
          try {
            uriList = clipboard.read('text/uri-list');
          } catch (e) {
            // Silent fail, try next method
          }
          
          // Method 2: Try NSFilenamesPboardType
          if (!uriList || !uriList.trim()) {
            try {
              uriList = clipboard.read('NSFilenamesPboardType');
            } catch (e) {
              // Silent fail, try next method
            }
          }
          
          // Method 3: Use applescript as fallback
          if (!uriList || !uriList.trim()) {
            try {
              const { execSync } = require('child_process');
              const script = `
                tell application "System Events"
                  try
                    set clipInfo to (clipboard info)
                    set fileURLs to {}
                    repeat with clipType in clipInfo
                      if (class of clipType) as string contains "furl" then
                        set fileURLs to (the clipboard as «class furl»)
                        exit repeat
                      end if
                    end repeat
                    
                    if fileURLs is not {} then
                      set filePaths to {}
                      repeat with fileURL in fileURLs
                        set filePath to POSIX path of fileURL
                        set end of filePaths to ("file://" & filePath)
                      end repeat
                      return (filePaths as string)
                    else
                      return ""
                    end if
                  on error
                    return ""
                  end try
                end tell
              `;
              
              const result = execSync(`osascript -e '${script}'`, { 
                encoding: 'utf8', 
                timeout: 2000,
                stdio: ['pipe', 'pipe', 'ignore']
              }).trim();
              
              if (result) {
                uriList = result.replace(/,/g, '\n');
              }
            } catch (e) {
              // Silent fail
            }
          }
          
          if (uriList && uriList.trim()) {
            let filePaths = [];
            
            // Check if it's XML plist format (common on macOS)
            if (uriList.includes('<?xml') && uriList.includes('<string>')) {
              // Extract file paths from XML plist
              const stringMatches = uriList.match(/<string>([^<]+)<\/string>/g);
              if (stringMatches) {
                filePaths = stringMatches.map(match => {
                  const path = match.replace(/<\/?string>/g, '');
                  return decodeURIComponent(path);
                });
              }
            } else {
              // Standard URI list format
              const uris = uriList.split(/[\n,]/).filter(uri => uri.trim() && !uri.startsWith('#'));
              filePaths = uris.map(uri => {
                let path = uri.trim();
                if (path.startsWith('file://')) {
                  path = decodeURIComponent(path.replace('file://', ''));
                }
                return path;
              });
            }
            
            for (const filePath of filePaths) {
              if (/\.(png|jpg|jpeg|gif|bmp|tiff|webp|svg)$/i.test(filePath)) {
                try {
                  const fs = require('fs');
                  
                  if (fs.existsSync(filePath)) {
                    const { nativeImage } = require('electron');
                    const fileImage = nativeImage.createFromPath(filePath);
                    
                    if (!fileImage.isEmpty()) {
                      const originalBuffer = fileImage.toPNG();
                      const quickHash = this.generateHash(originalBuffer.toString('base64'));
                      
                      if (quickHash === this.lastClipboardHash) {
                        return;
                      }
                      
                      const size = fileImage.getSize();
                      
                      content = this.processImage(fileImage, originalBuffer);
                      type = 'image';
                      hash = quickHash;
                      preview = `Image (${size.width}×${size.height}) - ${filePath.split('/').pop()}`;
                      break;
                    } else {
                      // For unsupported image files, still capture as file reference
                      const fs = require('fs');
                      try {
                        const stats = fs.statSync(filePath);
                        const fileName = filePath.split('/').pop();
                        
                        const fileHash = this.generateHash(filePath + stats.size);
                        if (fileHash === this.lastClipboardHash) {
                          return;
                        }
                        
                        content = filePath;
                        type = 'files';
                        hash = fileHash;
                        preview = `Unsupported Image: ${fileName} (${this.formatFileSize(stats.size)})`;
                        break;
                      } catch (statsError) {
                        // Silent fail
                      }
                    }
                  }
                } catch (fileError) {
                  // Silent fail
                }
              }
            }
            
            // If no image found, store as file paths (but only if not already processed)
            if (!content && filePaths.length > 0) {
              const filePathsString = filePaths.join('\n');
              const quickHash = this.generateHash(filePathsString);
              
              if (quickHash === this.lastClipboardHash) {
                return;
              }
              
              const fileNames = filePaths.map(p => p.split('/').pop()).join(', ');
              content = filePathsString;
              type = 'files';
              hash = quickHash;
              preview = `Files: ${fileNames}`;
            }
          }
        } catch (uriError) {
          // Silent fail
        }
      }

      // PRIORITY 3: Check for text content (but be smart about it)
      if (!content && formats.includes('text/plain')) {
        const textContent = clipboard.readText();
        
        if (textContent) {
          // Skip ONLY screenshot filenames that are exactly this pattern
          if (textContent.match(/^Screenshot \d{4}-\d{2}-\d{2} at \d{2}\.\d{2}\.\d{2}$/) && 
              textContent.trim().length < 50) {
            return;
          }
          
          // Check if this might be a file path that we can access
          if (textContent.includes('/') && /\.(png|jpg|jpeg|gif|bmp|tiff|webp|svg|dmg|pkg|pdf|mp4|mov|avi|app|zip|rar|7z)$/i.test(textContent)) {
            try {
              const fs = require('fs');
              const cleanPath = textContent.trim();
              
              if (fs.existsSync(cleanPath)) {
                const stats = fs.statSync(cleanPath);
                const fileName = cleanPath.split('/').pop();
                const fileExt = fileName.toLowerCase().includes('.') ? 
                  fileName.toLowerCase().split('.').pop() : '';
                
                // Process the file using our advanced processing
                let processedContent = await this.processSpecialFile(cleanPath, fileExt, stats);
                
                if (processedContent) {
                  const fileHash = this.generateHash(cleanPath + stats.size);
                  if (fileHash === this.lastClipboardHash) {
                    return;
                  }
                  
                  content = processedContent.content || cleanPath;
                  type = processedContent.type || 'files';
                  hash = fileHash;
                  preview = processedContent.preview;
                }
              } else {
                // File doesn't exist or not accessible, store as text
                content = textContent;
                type = 'text';
                hash = this.generateHash(content);
                preview = textContent.length > 100 ? textContent.substring(0, 100) + '...' : textContent;
              }
            } catch (pathError) {
              // Store as regular text
              content = textContent;
              type = 'text';
              hash = this.generateHash(content);
              preview = textContent.length > 100 ? textContent.substring(0, 100) + '...' : textContent;
            }
          } else {
            // Regular text content
            content = textContent;
            type = 'text';
            hash = this.generateHash(content);
            preview = textContent.length > 100 ? textContent.substring(0, 100) + '...' : textContent;
          }
        }
      }

      // PRIORITY 4: Check for HTML content
      if (!content && formats.includes('text/html')) {
        const htmlContent = clipboard.readHTML();
        if (htmlContent) {
          content = htmlContent;
          type = 'html';
          hash = this.generateHash(content);
          
          // Create text preview from HTML
          const tempDiv = require('jsdom') ? 
            new (require('jsdom').JSDOM)(htmlContent).window.document.body :
            { textContent: htmlContent.replace(/<[^>]*>/g, '') };
          const textContent = tempDiv.textContent || htmlContent.replace(/<[^>]*>/g, '');
          preview = textContent.length > 100 ? textContent.substring(0, 100) + '...' : textContent;
        }
      }

      // Only process if we found content and it's different
      if (content && hash !== this.lastClipboardHash) {
        this.lastClipboardHash = hash;
        this.lastProcessedTime = now;
        
        const clipboardItem = {
          content: content,
          type: type,
          timestamp: Date.now(),
          hash: hash,
          preview: preview,
          size: this.calculateSize(content)
        };

        this.storage.addItem(clipboardItem);
        
        // Notify the UI
        if (this.mainWindow && this.mainWindow.webContents) {
          this.mainWindow.webContents.send('clipboard-item-added', clipboardItem);
        }
      }
    } catch (error) {
      console.error('❌ Error checking clipboard:', error);
    }
  }

  async processSpecialFile(filePath, fileExt, stats) {
    const fileName = filePath.split('/').pop();
    const fileSize = this.formatFileSize(stats.size);
    
    try {
      switch (fileExt) {
        case 'gif':
          return await this.processGIF(filePath, fileName, fileSize);
        
        case 'dmg':
        case 'pkg':
          return await this.processDMG(filePath, fileName, fileSize);
        
        case 'pdf':
          return await this.processPDF(filePath, fileName, fileSize);
        
        case 'mp4':
        case 'mov':
        case 'avi':
          return await this.processVideo(filePath, fileName, fileSize);
        
        case 'app':
          return await this.processApp(filePath, fileName, fileSize);
        
        case 'zip':
        case 'rar':
        case '7z':
          return await this.processArchive(filePath, fileName, fileSize);
        
        default:
          return {
            content: filePath,
            type: 'files',
            preview: `📄 ${fileName} (${fileSize})`
          };
      }
    } catch (error) {
      return {
        content: filePath,
        type: 'files',
        preview: `📄 ${fileName} (${fileSize})`
      };
    }
  }

  async processGIF(filePath, fileName, fileSize) {
    try {
      // For now, treat GIFs as special files without frame extraction
      // This avoids dependency on FFmpeg and keeps it simple
      return {
        content: filePath,
        type: 'files',
        preview: `🎞️ GIF: ${fileName} (${fileSize})`
      };
      
    } catch (error) {
      return {
        content: filePath,
        type: 'files',
        preview: `🖼️ GIF: ${fileName} (${fileSize})`
      };
    }
  }

  async processDMG(filePath, fileName, fileSize) {
    try {
      // Simplified DMG processing without mounting (safer)
      const appName = fileName.replace(/[-_].*/, '').replace('.dmg', '');
      
      return {
        content: filePath,
        type: 'files',
        preview: `💿 ${appName}: ${fileName} (${fileSize})`
      };
      
    } catch (error) {
      return {
        content: filePath,
        type: 'files',
        preview: `💿 ${fileName} (${fileSize})`
      };
    }
  }

  async processPDF(filePath, fileName, fileSize) {
    // For PDF, we'd ideally extract the first page as an image
    // This would require additional dependencies like pdf-poppler
    return {
      content: filePath,
      type: 'files',
      preview: `📕 PDF: ${fileName} (${fileSize})`
    };
  }

  async processVideo(filePath, fileName, fileSize) {
    try {
      // Try to extract thumbnail using ffmpeg
      const { execSync } = require('child_process');
      const tempPath = `/tmp/video_thumb_${Date.now()}.png`;
      
      try {
        execSync(`ffmpeg -i "${filePath}" -ss 00:00:01 -vframes 1 "${tempPath}" 2>/dev/null`);
        
        const { nativeImage } = require('electron');
        const thumbImage = nativeImage.createFromPath(tempPath);
        
        if (!thumbImage.isEmpty()) {
          const processedImage = this.processImage(thumbImage, thumbImage.toPNG());
          
          // Clean up temp file
          require('fs').unlinkSync(tempPath);
          
          return {
            content: processedImage,
            type: 'image',
            preview: `🎬 Video: ${fileName} (${fileSize})`
          };
        }
      } catch (ffmpegError) {
        // FFmpeg not available for video processing
      }
      
      return {
        content: filePath,
        type: 'files',
        preview: `🎬 Video: ${fileName} (${fileSize})`
      };
      
    } catch (error) {
      return {
        content: filePath,
        type: 'files',
        preview: `🎬 ${fileName} (${fileSize})`
      };
    }
  }

  async processApp(filePath, fileName, fileSize) {
    try {
      // Extract app icon and info
      const appName = fileName.replace('.app', '');
      
      // Try to get app info
      const { execSync } = require('child_process');
      try {
        const plistPath = `${filePath}/Contents/Info.plist`;
        const plistExists = require('fs').existsSync(plistPath);
        
        if (plistExists) {
          // Could extract version, bundle ID, etc. from Info.plist
          return {
            content: filePath,
            type: 'files',
            preview: `📱 App: ${appName} (${fileSize})`
          };
        }
      } catch (plistError) {
        // Could not read app Info.plist
      }
      
      return {
        content: filePath,
        type: 'files',
        preview: `📱 ${appName} (${fileSize})`
      };
      
    } catch (error) {
      return {
        content: filePath,
        type: 'files',
        preview: `📱 ${fileName} (${fileSize})`
      };
    }
  }

  async processArchive(filePath, fileName, fileSize) {
    return {
      content: filePath,
      type: 'files',
      preview: `🗜️ Archive: ${fileName} (${fileSize})`
    };
  }

  formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  processImage(image, originalBuffer) {
    try {
      const size = image.getSize();
      let processedImage = image;
      let imageBuffer = originalBuffer;
      
      // Resize if too large
      const maxDimension = 1920;
      if (size.width > maxDimension || size.height > maxDimension) {
        const scale = Math.min(maxDimension / size.width, maxDimension / size.height);
        const newWidth = Math.round(size.width * scale);
        const newHeight = Math.round(size.height * scale);
        processedImage = image.resize({ width: newWidth, height: newHeight });
        imageBuffer = processedImage.toPNG();
      }
      
      // Check size limit
      if (imageBuffer.length > 10 * 1024 * 1024) {
        return null;
      }
      
      return `data:image/png;base64,${imageBuffer.toString('base64')}`;
    } catch (error) {
      console.error('❌ Error processing image:', error);
      return null;
    }
  }

  generateHash(content) {
    return crypto.createHash('md5').update(content).digest('hex');
  }

  generatePreview(content, type) {
    if (type === 'text' || type === 'html') {
      // Limit preview to first 100 characters
      return content.length > 100 ? content.substring(0, 100) + '...' : content;
    } else if (type === 'image') {
      // For images, get dimensions if possible
      try {
        const { nativeImage } = require('electron');
        const img = nativeImage.createFromDataURL(content);
        const size = img.getSize();
        return `Image (${size.width}×${size.height})`;
      } catch (error) {
        return 'Image';
      }
    }
    return 'Unknown content';
  }

  calculateSize(content) {
    return new Blob([content]).size;
  }
}

module.exports = ClipboardMonitor;