const { ipcRenderer } = require('electron');

class ClipboardManagerUI {
    constructor() {
        this.clipboardItems = [];
        this.currentSearchQuery = '';
        this.selectedItemId = null;
        
        this.initializeElements();
        this.bindEvents();
        this.loadTheme();
        
        // Load clipboard history immediately when UI starts
        console.log('UI: Constructor - loading clipboard history immediately');
        this.loadClipboardHistory();
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
            this.loadClipboardHistory();
            this.searchInput.focus();
        });

        ipcRenderer.on('history-cleared', () => {
            this.loadClipboardHistory();
        });

        ipcRenderer.on('clipboard-item-added', (event, item) => {
            console.log('UI: New clipboard item received:', item);
            this.loadClipboardHistory(); // Refresh the list
        });

        // Theme change events
        ipcRenderer.on('theme-changed', (event, theme) => {
            console.log('UI: Theme changed to:', theme);
            this.applyTheme(theme);
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

        // Add error handling for image loading
        if (item.type === 'image') {
            const img = div.querySelector('.thumbnail');
            if (img) {
                img.addEventListener('error', () => {
                    console.log('Image thumbnail failed to load');
                    img.classList.add('error');
                    const imageInfo = div.querySelector('.image-info');
                    if (imageInfo) {
                        imageInfo.textContent = '🖼️ Image (preview failed)';
                    }
                });
                
                img.addEventListener('load', () => {
                    console.log('Image thumbnail loaded successfully');
                });
            }
        }

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
        } else if (type === 'files') {
            // Smart icon selection based on preview content
            let icon = '📁';
            if (preview.includes('GIF:') || preview.includes('Animated GIF:')) icon = '🎞️';
            else if (preview.includes('DMG:')) icon = '💿';
            else if (preview.includes('PDF:')) icon = '📕';
            else if (preview.includes('Video:')) icon = '🎬';
            else if (preview.includes('App:')) icon = '📱';
            else if (preview.includes('Archive:')) icon = '🗜️';
            else if (preview.includes('Unsupported Image:')) icon = '🖼️';
            
            return `
                <div class="files-preview ${this.getFileTypeClass(preview)}">
                    <span class="file-icon">${icon}</span>
                    <span class="file-info">${preview}</span>
                </div>
            `;
        } else if (type === 'html') {
            // Strip HTML tags for preview
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = content;
            const textContent = tempDiv.textContent || tempDiv.innerText || '';
            return this.escapeHtml(textContent.substring(0, 200));
        } else {
            return this.escapeHtml(preview || content);
        }
    }

    getFileTypeClass(preview) {
        if (preview.includes('GIF:') || preview.includes('Animated GIF:')) return 'file-gif';
        if (preview.includes('DMG:')) return 'file-dmg';
        if (preview.includes('PDF:')) return 'file-pdf';
        if (preview.includes('Video:')) return 'file-video';
        if (preview.includes('App:')) return 'file-app';
        if (preview.includes('Archive:')) return 'file-archive';
        return 'file-generic';
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
        this.itemCount.textContent = `${count} item${count !== 1 ? 's' : ''}`;
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

        // Update pin text
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

    async clearHistory() {
        try {
            await ipcRenderer.invoke('clear-clipboard-history');
            this.loadClipboardHistory();
        } catch (error) {
            console.error('Error clearing history:', error);
        }
    }

    showToast(message, type = 'success') {
        // Create a simple toast notification
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
        
        // Animate in
        setTimeout(() => {
            toast.style.transform = 'translateX(0)';
        }, 10);

        // Animate out and remove
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