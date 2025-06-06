// renderer/app.js
const { ipcRenderer } = require('electron');

// File type detection class
class SimpleFileDetector {
  constructor() {
    // File type mappings - focused on visual recognition
    this.fileTypes = {
      // Images - these should get system thumbnails
      'jpg': { icon: '📸', color: '#FF6B6B', name: 'Photo', canThumbnail: true },
      'jpeg': { icon: '📸', color: '#FF6B6B', name: 'Photo', canThumbnail: true },
      'png': { icon: '🖼️', color: '#4ECDC4', name: 'Image', canThumbnail: true },
      'gif': { icon: '🎞️', color: '#9B59B6', name: 'GIF', canThumbnail: true },
      'svg': { icon: '🎨', color: '#3498DB', name: 'Vector', canThumbnail: false },
      'webp': { icon: '🌐', color: '#2ECC71', name: 'WebP', canThumbnail: true },
      'tiff': { icon: '📷', color: '#E74C3C', name: 'TIFF', canThumbnail: true },
      'bmp': { icon: '🖼️', color: '#95A5A6', name: 'Bitmap', canThumbnail: true },
      
      // Documents - PDFs get thumbnails, others get icons
      'pdf': { icon: '📕', color: '#E74C3C', name: 'PDF', canThumbnail: true },
      'doc': { icon: '📄', color: '#2980B9', name: 'Word', canThumbnail: false },
      'docx': { icon: '📄', color: '#2980B9', name: 'Word', canThumbnail: false },
      'xls': { icon: '📊', color: '#27AE60', name: 'Excel', canThumbnail: false },
      'xlsx': { icon: '📊', color: '#27AE60', name: 'Excel', canThumbnail: false },
      'ppt': { icon: '📽️', color: '#E67E22', name: 'PowerPoint', canThumbnail: false },
      'pptx': { icon: '📽️', color: '#E67E22', name: 'PowerPoint', canThumbnail: false },
      'pages': { icon: '📄', color: '#FF9500', name: 'Pages', canThumbnail: false },
      'numbers': { icon: '📊', color: '#FF9500', name: 'Numbers', canThumbnail: false },
      'keynote': { icon: '📽️', color: '#FF9500', name: 'Keynote', canThumbnail: false },
      'txt': { icon: '📝', color: '#95A5A6', name: 'Text', canThumbnail: false },
      'rtf': { icon: '📝', color: '#BDC3C7', name: 'Rich Text', canThumbnail: false },
      
      // Media - videos get thumbnails
      'mp4': { icon: '🎬', color: '#8E44AD', name: 'Video', canThumbnail: true },
      'mov': { icon: '🎥', color: '#9B59B6', name: 'Video', canThumbnail: true },
      'avi': { icon: '📹', color: '#A569BD', name: 'Video', canThumbnail: true },
      'mkv': { icon: '🎞️', color: '#BB8FCE', name: 'Video', canThumbnail: true },
      'webm': { icon: '🌐', color: '#D7BDE2', name: 'Web Video', canThumbnail: true },
      'mp3': { icon: '🎵', color: '#1ABC9C', name: 'Audio', canThumbnail: false },
      'wav': { icon: '🎶', color: '#16A085', name: 'Audio', canThumbnail: false },
      'flac': { icon: '🎼', color: '#48C9B0', name: 'FLAC Audio', canThumbnail: false },
      'm4a': { icon: '🍎', color: '#85E3D0', name: 'iTunes Audio', canThumbnail: false },
      'aac': { icon: '🎧', color: '#76D7C4', name: 'AAC Audio', canThumbnail: false },
      
      // Archives
      'zip': { icon: '🗜️', color: '#F39C12', name: 'Archive', canThumbnail: false },
      'rar': { icon: '📦', color: '#E67E22', name: 'Archive', canThumbnail: false },
      '7z': { icon: '🗃️', color: '#D68910', name: '7-Zip', canThumbnail: false },
      'tar': { icon: '📂', color: '#B7950B', name: 'TAR Archive', canThumbnail: false },
      'gz': { icon: '🗜️', color: '#F4D03F', name: 'GZip', canThumbnail: false },
      'dmg': { icon: '💿', color: '#5DADE2', name: 'Disk Image', canThumbnail: false },
      'iso': { icon: '💽', color: '#85C1E9', name: 'ISO Image', canThumbnail: false },
      
      // Apps - these get their actual icons as thumbnails
      'app': { icon: '📱', color: '#28A745', name: 'App', canThumbnail: true },
      'pkg': { icon: '📦', color: '#17A2B8', name: 'Installer', canThumbnail: false },
      'deb': { icon: '🐧', color: '#6F42C1', name: 'Debian Package', canThumbnail: false },
      'exe': { icon: '🪟', color: '#0D6EFD', name: 'Windows App', canThumbnail: false },
      'msi': { icon: '🛠️', color: '#20C997', name: 'Windows Installer', canThumbnail: false },
      
      // Code
      'js': { icon: '📜', color: '#F7DF1E', name: 'JavaScript', canThumbnail: false },
      'ts': { icon: '📘', color: '#3178C6', name: 'TypeScript', canThumbnail: false },
      'py': { icon: '🐍', color: '#3776AB', name: 'Python', canThumbnail: false },
      'html': { icon: '🌐', color: '#E34F26', name: 'HTML', canThumbnail: false },
      'css': { icon: '🎨', color: '#1572B6', name: 'CSS', canThumbnail: false },
      'json': { icon: '📋', color: '#000000', name: 'JSON', canThumbnail: false },
      'xml': { icon: '📋', color: '#FF6600', name: 'XML', canThumbnail: false },
      'yaml': { icon: '📋', color: '#CB171E', name: 'YAML', canThumbnail: false },
      'yml': { icon: '📋', color: '#CB171E', name: 'YAML', canThumbnail: false }
    };
  }

  // Detect if text content is a file path
  detectFileFromText(text) {
    if (!text || typeof text !== 'string') return null;
    
    const cleanText = text.trim();
    
    // Look for file extensions in various formats
    const patterns = [
      // Standard file paths: /path/to/file.ext
      /([^\/\\]*\.)([a-zA-Z0-9]+)(?:\s|$|"|')/,
      // Just filename: filename.ext
      /^([^\/\\]*\.)([a-zA-Z0-9]+)$/,
      // With quotes: "filename.ext"
      /"([^"]*\.)([a-zA-Z0-9]+)"/,
      // With spaces: file name.ext
      /([a-zA-Z0-9\s_-]*\.)([a-zA-Z0-9]+)(?:\s|$)/
    ];
    
    for (const pattern of patterns) {
      const fileMatch = cleanText.match(pattern);
      if (fileMatch) {
        const fullFilename = fileMatch[1] + fileMatch[2];
        const extension = fileMatch[2].toLowerCase();
        const fileType = this.fileTypes[extension];
        
        if (fileType) {
          return {
            filename: fullFilename,
            extension: extension,
            ...fileType,
            isFile: true,
            path: cleanText
          };
        }
      }
    }
    
    return null;
  }

  // Get file info by extension
  getFileInfo(extension) {
    if (!extension) return null;
    return this.fileTypes[extension.toLowerCase()] || null;
  }
}

class ClipboardManagerUI {
    constructor() {
        this.clipboardItems = [];
        this.currentSearchQuery = '';
        this.selectedItemId = null;
        this.isInitialLoad = true;
        this.horizontalScrollEnabled = true;
        
        // Initialize file detector
        this.fileDetector = new SimpleFileDetector();
        
        this.initializeElements();
        this.bindEvents();
        this.loadTheme();
        this.loadHorizontalScrollSetting();
        
        // Add layout detection
        this.detectAndApplyLayout();
        
        // Listen for window resize to update layout
        window.addEventListener('resize', () => {
            this.detectAndApplyLayout();
        });
        
        // Add horizontal scroll handler
        this.setupHorizontalScrolling();
        
        // Load clipboard history immediately when UI starts
        console.log('UI: Constructor - loading clipboard history immediately');
        this.loadClipboardHistory();
    }

    async loadHorizontalScrollSetting() {
        try {
            this.horizontalScrollEnabled = await ipcRenderer.invoke('get-horizontal-scroll-enabled');
            console.log('🖱️ Horizontal scroll setting loaded:', this.horizontalScrollEnabled);
        } catch (error) {
            console.error('Failed to load horizontal scroll setting:', error);
            this.horizontalScrollEnabled = true;
        }
    }

    setupHorizontalScrolling() {
        this.clipboardList.addEventListener('wheel', (e) => {
            if (this.clipboardList.classList.contains('landscape') && this.horizontalScrollEnabled) {
                e.preventDefault();
                const scrollAmount = e.deltaY;
                this.clipboardList.scrollLeft += scrollAmount;
                console.log('Horizontal scroll applied:', scrollAmount);
            }
        }, { passive: false });
    }

    detectAndApplyLayout() {
        const windowWidth = window.innerWidth;
        const windowHeight = window.innerHeight;
        
        let mode = 'portrait';
        
        if (windowWidth > windowHeight * 1.8) {
            mode = 'landscape';
        } else if (Math.abs(windowWidth - windowHeight) < windowWidth * 0.3) {
            mode = 'window';
        }
        
        console.log(`Window: ${windowWidth}x${windowHeight}, Mode: ${mode}`);
        
        if (this.clipboardList) {
            this.clipboardList.classList.remove('landscape', 'window-mode');
            
            if (mode === 'landscape') {
                this.clipboardList.classList.add('landscape');
                this.applyHorizontalLayout();
                console.log('Applied landscape layout (bottom bar style) - horizontal scrolling enabled');
            } else if (mode === 'window') {
                this.clipboardList.classList.add('window-mode');
                this.applyVerticalLayout();
                console.log('Applied window layout (free window style)');
            } else {
                this.applyVerticalLayout();
                console.log('Applied portrait layout (sidebar style)');
            }
        }
    }

    applyHorizontalLayout() {
        this.moveStatsToHeader();
        document.body.classList.add('horizontal-mode');
        this.updateHeaderForHorizontal();
    }

    applyVerticalLayout() {
        this.restoreStatsBar();
        document.body.classList.remove('horizontal-mode');
        this.updateHeaderForVertical();
    }

    moveStatsToHeader() {
        const header = document.querySelector('.header');
        const statsBar = document.querySelector('.stats-bar');
        const headerContent = document.querySelector('.header-content');
        
        if (header && statsBar && headerContent) {
            let headerStats = header.querySelector('.header-stats');
            if (!headerStats) {
                headerStats = document.createElement('div');
                headerStats.className = 'header-stats';
                
                const settingsBtn = headerContent.querySelector('.settings-btn');
                if (settingsBtn) {
                    headerContent.insertBefore(headerStats, settingsBtn);
                } else {
                    headerContent.appendChild(headerStats);
                }
            }
            
            headerStats.textContent = statsBar.textContent;
            statsBar.style.display = 'none';
        }
    }

    restoreStatsBar() {
        const statsBar = document.querySelector('.stats-bar');
        const headerStats = document.querySelector('.header-stats');
        
        if (statsBar) {
            statsBar.style.display = 'block';
        }
        
        if (headerStats) {
            headerStats.remove();
        }
    }

    updateHeaderForHorizontal() {
        const headerContent = document.querySelector('.header-content');
        if (headerContent) {
            headerContent.classList.add('horizontal-header');
        }
    }

    updateHeaderForVertical() {
        const headerContent = document.querySelector('.header-content');
        if (headerContent) {
            headerContent.classList.remove('horizontal-header');
        }
    }

    initializeElements() {
        this.searchInput = document.getElementById('search-input');
        this.clearSearchBtn = document.getElementById('clear-search');
        this.settingsBtn = document.getElementById('settings');
        this.clipboardList = document.getElementById('clipboard-list');
        this.emptyState = document.getElementById('empty-state');
        this.itemCount = document.getElementById('item-count');
        this.contextMenu = document.getElementById('context-menu');
    }

    async loadTheme() {
        try {
            const currentTheme = await ipcRenderer.invoke('get-current-theme');
            this.applyTheme(currentTheme);
        } catch (error) {
            console.error('Failed to load theme:', error);
        }
    }

    applyTheme(theme) {
        console.log('🎨 Applying theme:', theme);
        document.documentElement.setAttribute('data-theme', theme);
    }

    bindEvents() {
        // Search functionality
        this.searchInput.addEventListener('input', (e) => {
            this.currentSearchQuery = e.target.value;
            this.searchClipboard();
        });

        this.clearSearchBtn.addEventListener('click', () => {
            this.searchInput.value = '';
            this.currentSearchQuery = '';
            this.loadClipboardHistory();
        });

        // Settings button
        this.settingsBtn.addEventListener('click', () => {
            console.log('UI: Settings button clicked');
            ipcRenderer.invoke('open-settings');
        });

        // Context menu
        document.addEventListener('contextmenu', (e) => {
            const clipboardItem = e.target.closest('.clipboard-item');
            if (clipboardItem) {
                e.preventDefault();
                this.selectedItemId = parseInt(clipboardItem.dataset.id);
                this.showContextMenu(e.clientX, e.clientY);
            }
        });

        document.addEventListener('click', () => {
            this.hideContextMenu();
        });

        this.contextMenu.addEventListener('click', (e) => {
            const action = e.target.dataset.action;
            if (action && this.selectedItemId) {
                this.handleContextAction(action, this.selectedItemId);
            }
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.hideContextMenu();
            }
        });

        // IPC events
        ipcRenderer.on('window-shown', () => {
            this.isInitialLoad = true;
            
            if (this.clipboardList) {
                this.clipboardList.style.visibility = 'hidden';
            }
            
            this.detectAndApplyLayout();
            this.loadClipboardHistory();
            this.searchInput.focus();
        });

        ipcRenderer.on('history-cleared', () => {
            this.loadClipboardHistory();
        });

        ipcRenderer.on('clipboard-item-added', (event, item) => {
            console.log('UI: New clipboard item received:', item);
            this.loadClipboardHistory();
        });

        ipcRenderer.on('theme-changed', (event, theme) => {
            console.log('UI: Theme changed to:', theme);
            this.applyTheme(theme);
        });

        ipcRenderer.on('horizontal-scroll-changed', (event, enabled) => {
            console.log('UI: Horizontal scroll setting changed to:', enabled);
            this.horizontalScrollEnabled = enabled;
        });
    }

    async loadClipboardHistory() {
        try {
            console.log('Loading clipboard history...');
            this.clipboardItems = await ipcRenderer.invoke('get-clipboard-history');
            console.log('Loaded items:', this.clipboardItems.length, this.clipboardItems);
            this.renderClipboardItems();
            this.updateStats();
        } catch (error) {
            console.error('Error loading clipboard history:', error);
        }
    }

    async searchClipboard() {
        if (this.currentSearchQuery.trim() === '') {
            this.loadClipboardHistory();
            return;
        }

        try {
            this.clipboardItems = await ipcRenderer.invoke('search-clipboard', this.currentSearchQuery);
            this.renderClipboardItems();
            this.updateStats();
        } catch (error) {
            console.error('Error searching clipboard:', error);
        }
    }

    renderClipboardItems() {
        console.log('Rendering clipboard items:', this.clipboardItems.length);
        
        if (this.clipboardItems.length === 0) {
            console.log('No items, showing empty state');
            this.clipboardList.innerHTML = '';
            this.clipboardList.appendChild(this.emptyState);
            this.clipboardList.style.visibility = 'visible';
            return;
        }

        console.log('Hiding empty state, showing items');
        this.emptyState.style.display = 'none';
        
        const fragment = document.createDocumentFragment();
        
        this.clipboardItems.forEach(item => {
            console.log('Creating element for item:', item);
            const itemElement = this.createClipboardItemElement(item);
            fragment.appendChild(itemElement);
        });

        this.clipboardList.innerHTML = '';
        this.clipboardList.appendChild(fragment);
        
        this.detectAndApplyLayout();
        
        if (this.isInitialLoad) {
            this.clipboardList.offsetHeight;
            this.clipboardList.offsetWidth;
            
            const items = this.clipboardList.querySelectorAll('.clipboard-item');
            items.forEach(item => {
                item.offsetHeight;
                item.offsetWidth;
                item.getBoundingClientRect();
            });
            
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    this.clipboardList.style.visibility = 'visible';
                    this.isInitialLoad = false;
                });
            });
        } else {
            this.clipboardList.style.visibility = 'visible';
        }
    }

    createClipboardItemElement(item) {
        const div = document.createElement('div');
        div.className = `clipboard-item ${item.pinned ? 'pinned' : ''}`;
        div.dataset.id = item.id;
        
        // Click to copy
        div.addEventListener('click', () => {
            this.copyToClipboard(item.content, item.type);
        });

        const timeAgo = this.formatTimeAgo(item.timestamp);
        const size = this.formatSize(item.size);

        div.innerHTML = `
            <div class="item-header">
                <span class="item-type">${item.type}</span>
                <span class="item-time">${timeAgo}</span>
            </div>
            <div class="item-content ${item.type}">
                ${this.formatContent(item.content, item.type, item.preview)}
            </div>
            <div class="item-size">${size}</div>
        `;

        return div;
    }

    formatContent(content, type, preview) {
        if (type === 'image') {
            return `
                <div class="image-preview">
                    <img src="${content}" alt="Clipboard image" class="thumbnail" />
                    <span class="image-info">${preview}</span>
                </div>
            `;
        } else if (type === 'text') {
            // Check if this text is actually a file path
            const fileInfo = this.fileDetector.detectFileFromText(content);
            
            if (fileInfo) {
                return `
                    <div class="file-preview" data-file-type="${fileInfo.extension}">
                        <div class="file-icon" style="color: ${fileInfo.color}; font-size: 24px;">
                            ${fileInfo.icon}
                        </div>
                        <div class="file-details">
                            <div class="file-name">${fileInfo.filename}</div>
                            <div class="file-type">${fileInfo.name}</div>
                            ${fileInfo.canThumbnail ? '<div class="thumbnail-hint">📋 System thumbnail available</div>' : ''}
                        </div>
                    </div>
                `;
            } else {
                // Regular text
                return this.escapeHtml(preview || content);
            }
        } else if (type === 'html') {
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = content;
            const textContent = tempDiv.textContent || tempDiv.innerText || '';
            return this.escapeHtml(textContent.substring(0, 200));
        } else {
            return this.escapeHtml(preview || content);
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
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

    updateStats() {
        const count = this.clipboardItems.length;
        const statsText = `${count} item${count !== 1 ? 's' : ''}`;
        
        this.itemCount.textContent = statsText;
        
        const headerStats = document.querySelector('.header-stats');
        if (headerStats) {
            headerStats.textContent = statsText;
        }
    }

    async copyToClipboard(content, type) {
        try {
            const success = await ipcRenderer.invoke('copy-to-clipboard', content, type);
            if (success) {
                this.showToast('Copied to clipboard!');
            } else {
                this.showToast('Failed to copy', 'error');
            }
        } catch (error) {
            console.error('Error copying to clipboard:', error);
            this.showToast('Failed to copy', 'error');
        }
    }

    showContextMenu(x, y) {
        this.contextMenu.style.left = `${x}px`;
        this.contextMenu.style.top = `${y}px`;
        this.contextMenu.style.display = 'block';

        const selectedItem = this.clipboardItems.find(item => item.id === this.selectedItemId);
        const pinItem = this.contextMenu.querySelector('[data-action="pin"]');
        if (pinItem && selectedItem) {
            pinItem.textContent = selectedItem.pinned ? 'Unpin' : 'Pin';
        }
    }

    hideContextMenu() {
        this.contextMenu.style.display = 'none';
        this.selectedItemId = null;
    }

    async handleContextAction(action, itemId) {
        try {
            switch (action) {
                case 'copy':
                    const item = this.clipboardItems.find(i => i.id === itemId);
                    if (item) {
                        await this.copyToClipboard(item.content, item.type);
                    }
                    break;
                case 'pin':
                    const selectedItem = this.clipboardItems.find(i => i.id === itemId);
                    if (selectedItem) {
                        await ipcRenderer.invoke('pin-clipboard-item', itemId, !selectedItem.pinned);
                        this.loadClipboardHistory();
                    }
                    break;
                case 'delete':
                    if (confirm('Are you sure you want to delete this item?')) {
                        await ipcRenderer.invoke('delete-clipboard-item', itemId);
                        this.loadClipboardHistory();
                    }
                    break;
            }
        } catch (error) {
            console.error('Error handling context action:', error);
        }
        
        this.hideContextMenu();
    }

    showToast(message, type = 'success') {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        
        Object.assign(toast.style, {
            position: 'fixed',
            top: '20px',
            right: '20px',
            background: type === 'error' ? '#FF3B30' : '#34C759',
            color: 'white',
            padding: '12px 20px',
            borderRadius: '8px',
            zIndex: '10000',
            fontSize: '14px',
            fontWeight: '500',
            boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
            transform: 'translateX(100%)',
            transition: 'transform 0.3s ease'
        });

        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.style.transform = 'translateX(0)';
        }, 10);

        setTimeout(() => {
            toast.style.transform = 'translateX(100%)';
            setTimeout(() => {
                document.body.removeChild(toast);
            }, 300);
        }, 2000);
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new ClipboardManagerUI();
});