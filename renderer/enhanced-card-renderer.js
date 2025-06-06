// renderer/enhanced-card-renderer.js
// Enhanced card creation with system thumbnails and app info

class EnhancedCardRenderer {
  constructor() {
    this.thumbnailExtractor = new SystemThumbnailExtractor();
  }

  createClipboardItemElement(item) {
    const div = document.createElement('div');
    div.className = `clipboard-item ${item.pinned ? 'pinned' : ''} ${item.type}-item`;
    div.dataset.id = item.id;
    
    // Click to copy
    div.addEventListener('click', () => {
      this.copyToClipboard(item.content, item.type);
    });

    const timeAgo = this.formatTimeAgo(item.timestamp);
    
    // Enhanced content based on type
    if (item.type === 'files' && item.fileInfo) {
      div.innerHTML = this.createFileCard(item, timeAgo);
    } else if (item.type === 'image') {
      div.innerHTML = this.createImageCard(item, timeAgo);
    } else if (item.type === 'text') {
      div.innerHTML = this.createTextCard(item, timeAgo);
    } else {
      div.innerHTML = this.createGenericCard(item, timeAgo);
    }

    return div;
  }

  createFileCard(item, timeAgo) {
    const file = item.fileInfo;
    const size = this.formatSize(item.size);
    
    // Determine what thumbnail/icon to show
    const thumbnailSrc = file.systemThumbnail || file.systemIcon || this.getFallbackIcon(file.extension);
    const isSystemThumbnail = !!file.systemThumbnail;
    
    return `
      <div class="item-header">
        <div class="item-type-badge ${file.type}">
          <span class="type-icon">${this.getTypeIcon(file.type)}</span>
          <span class="type-text">${file.type}</span>
        </div>
        <span class="item-time">${timeAgo}</span>
      </div>
      
      <div class="item-content files">
        <div class="file-preview">
          <div class="file-thumbnail ${isSystemThumbnail ? 'system-thumb' : 'fallback-icon'}">
            ${isSystemThumbnail ? 
              `<img src="${thumbnailSrc}" alt="${file.name}" class="system-thumbnail" />` :
              `<span class="fallback-icon-text">${thumbnailSrc}</span>`
            }
          </div>
          
          <div class="file-details">
            <div class="file-name" title="${file.name}">${file.name}</div>
            <div class="file-meta">
              <span class="file-extension">${file.extension.toUpperCase()}</span>
              <span class="file-size">${size}</span>
              ${file.metadata?.dimensions ? 
                `<span class="file-dimensions">${file.metadata.dimensions.width}×${file.metadata.dimensions.height}</span>` : 
                ''
              }
            </div>
            
            ${file.sourceApp ? `
              <div class="source-app">
                <span class="source-label">from</span>
                <span class="source-name">${file.sourceApp.name}</span>
              </div>
            ` : ''}
          </div>
        </div>
        
        ${file.metadata?.duration ? `
          <div class="media-info">
            <span class="duration">${this.formatDuration(file.metadata.duration)}</span>
          </div>
        ` : ''}
        
        ${file.previewAvailable ? `
          <div class="preview-indicator">
            <span class="preview-text">Preview available</span>
          </div>
        ` : ''}
      </div>
      
      <div class="item-footer">
        <span class="item-size">${size}</span>
        ${file.metadata?.pageCount ? 
          `<span class="page-count">${file.metadata.pageCount} pages</span>` : 
          ''
        }
      </div>
    `;
  }

  createImageCard(item, timeAgo) {
    const size = this.formatSize(item.size);
    
    return `
      <div class="item-header">
        <div class="item-type-badge image">
          <span class="type-icon">📸</span>
          <span class="type-text">image</span>
        </div>
        <span class="item-time">${timeAgo}</span>
      </div>
      
      <div class="item-content image">
        <div class="image-preview">
          <img src="${item.content}" alt="Clipboard image" class="thumbnail" />
          <div class="image-overlay">
            ${item.imageInfo?.dimensions ? `
              <span class="image-dimensions">${item.imageInfo.dimensions}</span>
            ` : ''}
            ${item.sourceApp ? `
              <div class="source-app">
                <span class="source-name">${item.sourceApp.name}</span>
              </div>
            ` : ''}
          </div>
        </div>
      </div>
      
      <div class="item-footer">
        <span class="item-size">${size}</span>
        ${item.imageInfo?.camera ? `
          <span class="camera-info">${item.imageInfo.camera}</span>
        ` : ''}
      </div>
    `;
  }

  createTextCard(item, timeAgo) {
    const size = this.formatSize(item.size);
    const preview = item.preview || item.content;
    const wordCount = item.content.split(/\s+/).length;
    
    return `
      <div class="item-header">
        <div class="item-type-badge text">
          <span class="type-icon">📝</span>
          <span class="type-text">text</span>
        </div>
        <span class="item-time">${timeAgo}</span>
      </div>
      
      <div class="item-content text">
        <div class="text-preview">
          ${this.escapeHtml(preview)}
        </div>
        ${item.sourceApp ? `
          <div class="source-app">
            <span class="source-label">from</span>
            <span class="source-name">${item.sourceApp.name}</span>
          </div>
        ` : ''}
      </div>
      
      <div class="item-footer">
        <span class="item-size">${size}</span>
        <span class="word-count">${wordCount} words</span>
      </div>
    `;
  }

  createGenericCard(item, timeAgo) {
    const size = this.formatSize(item.size);
    const preview = item.preview || item.content;
    
    return `
      <div class="item-header">
        <div class="item-type-badge ${item.type}">
          <span class="type-icon">${this.getTypeIcon(item.type)}</span>
          <span class="type-text">${item.type}</span>
        </div>
        <span class="item-time">${timeAgo}</span>
      </div>
      
      <div class="item-content ${item.type}">
        <div class="content-preview">
          ${this.escapeHtml(preview)}
        </div>
      </div>
      
      <div class="item-footer">
        <span class="item-size">${size}</span>
      </div>
    `;
  }

  getTypeIcon(type) {
    const icons = {
      'image': '🖼️',
      'document': '📄', 
      'video': '🎬',
      'audio': '🎵',
      'archive': '📦',
      'application': '📱',
      'code': '💻',
      'text': '📝',
      'files': '📁'
    };
    return icons[type] || '📄';
  }

  getFallbackIcon(extension) {
    // Only return emoji fallbacks when system thumbnails aren't available
    const fallbacks = {
      'jpg': '📸', 'jpeg': '📸', 'png': '🖼️', 'gif': '🎞️',
      'pdf': '📕', 'doc': '📄', 'docx': '📄',
      'mp4': '🎬', 'mov': '🎥', 'avi': '📹',
      'mp3': '🎵', 'wav': '🎶',
      'zip': '🗜️', 'rar': '📦', '7z': '🗃️',
      'app': '📱', 'dmg': '💿',
      'js': '📜', 'py': '🐍', 'html': '🌐'
    };
    return fallbacks[extension] || '📄';
  }

  formatDuration(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  formatTimeAgo(timestamp) {
    const now = Date.now();
    const diff = now - timestamp;
    
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'Just now';
  }

  formatSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}