const Database = require('better-sqlite3');
const path = require('path');
const { app } = require('electron');
const Fuse = require('fuse.js');

class Storage {
  constructor() {
    console.log('💾 Storage: Initializing...');
    
    try {
      const userDataPath = app.getPath('userData');
      console.log('💾 Storage: User data path:', userDataPath);
      
      this.dbPath = path.join(userDataPath, 'clipboard.db');
      console.log('💾 Storage: Database path:', this.dbPath);
      
      this.db = new Database(this.dbPath);
      console.log('💾 Storage: Database connection established');
      
      this.initDatabase();
      console.log('💾 Storage: Database initialized successfully');
    } catch (error) {
      console.error('❌ Storage: Initialization failed:', error);
      throw error;
    }
  }

  initDatabase() {
    try {
      console.log('💾 Storage: Creating tables...');
      
      // Create clipboard_items table if it doesn't exist
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS clipboard_items (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          content TEXT NOT NULL,
          type TEXT NOT NULL,
          timestamp INTEGER NOT NULL,
          hash TEXT UNIQUE NOT NULL,
          preview TEXT,
          size INTEGER DEFAULT 0,
          pinned INTEGER DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
      console.log('💾 Storage: clipboard_items table created');

      // Create index for faster searches
      this.db.exec(`
        CREATE INDEX IF NOT EXISTS idx_timestamp ON clipboard_items(timestamp DESC);
        CREATE INDEX IF NOT EXISTS idx_hash ON clipboard_items(hash);
        CREATE INDEX IF NOT EXISTS idx_pinned ON clipboard_items(pinned DESC, timestamp DESC);
      `);
      console.log('💾 Storage: Indexes created');

      // Check existing data
      const count = this.db.prepare('SELECT COUNT(*) as count FROM clipboard_items').get();
      console.log(`💾 Storage: Found ${count.count} existing items in database`);
      
    } catch (error) {
      console.error('❌ Storage: Database initialization failed:', error);
      throw error;
    }
  }

  addItem(item) {
    try {
      console.log('💾 Storage: Adding item:', {
        type: item.type,
        preview: item.preview?.substring(0, 50) + '...',
        size: item.size,
        timestamp: item.timestamp
      });
      
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO clipboard_items 
        (content, type, timestamp, hash, preview, size) 
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      
      const result = stmt.run(
        item.content,
        item.type,
        item.timestamp,
        item.hash,
        item.preview,
        item.size
      );

      console.log('💾 Storage: Item added with ID:', result.lastInsertRowid);

      // Keep only the last 1000 items (excluding pinned)
      this.cleanupOldItems();
      
      return result.lastInsertRowid;
    } catch (error) {
      console.error('❌ Storage: Error adding clipboard item:', error);
      return null;
    }
  }

  getHistory(limit = 100) {
    try {
      console.log('💾 Storage: Getting history with limit:', limit);
      const stmt = this.db.prepare(`
        SELECT * FROM clipboard_items 
        ORDER BY pinned DESC, timestamp DESC 
        LIMIT ?
      `);
      
      const results = stmt.all(limit);
      console.log('💾 Storage: Found', results.length, 'items in database');
      
      // Log some basic stats
      const typeStats = {};
      results.forEach(item => {
        typeStats[item.type] = (typeStats[item.type] || 0) + 1;
      });
      console.log('💾 Storage: Item types:', typeStats);
      
      return results;
    } catch (error) {
      console.error('❌ Storage: Error getting clipboard history:', error);
      return [];
    }
  }

  search(query, limit = 50) {
    try {
      console.log('💾 Storage: Searching for:', query);
      
      if (!query || query.trim() === '') {
        console.log('💾 Storage: Empty query, returning history');
        return this.getHistory(limit);
      }

      // Get all items for fuzzy search
      const allItems = this.db.prepare(`
        SELECT * FROM clipboard_items 
        ORDER BY pinned DESC, timestamp DESC
      `).all();

      console.log('💾 Storage: Searching through', allItems.length, 'items');

      // Configure Fuse.js for fuzzy search
      const fuse = new Fuse(allItems, {
        keys: ['content', 'preview'],
        threshold: 0.4, // Adjust for search sensitivity
        includeScore: true
      });

      const results = fuse.search(query);
      const searchResults = results.slice(0, limit).map(result => result.item);
      
      console.log('💾 Storage: Search returned', searchResults.length, 'results');
      return searchResults;
    } catch (error) {
      console.error('❌ Storage: Error searching clipboard:', error);
      return [];
    }
  }

  deleteItem(id) {
    try {
      console.log('💾 Storage: Deleting item with ID:', id);
      const stmt = this.db.prepare('DELETE FROM clipboard_items WHERE id = ?');
      const result = stmt.run(id);
      const success = result.changes > 0;
      console.log('💾 Storage: Delete result:', success);
      return success;
    } catch (error) {
      console.error('❌ Storage: Error deleting clipboard item:', error);
      return false;
    }
  }

  pinItem(id, pinned = true) {
    try {
      console.log('💾 Storage: Pinning item', id, 'to', pinned);
      const stmt = this.db.prepare('UPDATE clipboard_items SET pinned = ? WHERE id = ?');
      const result = stmt.run(pinned ? 1 : 0, id);
      const success = result.changes > 0;
      console.log('💾 Storage: Pin result:', success);
      return success;
    } catch (error) {
      console.error('❌ Storage: Error pinning clipboard item:', error);
      return false;
    }
  }

  clearHistory() {
    try {
      console.log('💾 Storage: Clearing history (keeping pinned items)...');
      // Only clear non-pinned items
      const stmt = this.db.prepare('DELETE FROM clipboard_items WHERE pinned = 0');
      const result = stmt.run();
      console.log(`💾 Storage: Cleared ${result.changes} clipboard items`);
      return result.changes;
    } catch (error) {
      console.error('❌ Storage: Error clearing clipboard history:', error);
      return 0;
    }
  }

  cleanupOldItems() {
    try {
      // Keep only the last 1000 non-pinned items
      const stmt = this.db.prepare(`
        DELETE FROM clipboard_items 
        WHERE pinned = 0 
        AND id NOT IN (
          SELECT id FROM clipboard_items 
          WHERE pinned = 0 
          ORDER BY timestamp DESC 
          LIMIT 1000
        )
      `);
      
      const result = stmt.run();
      if (result.changes > 0) {
        console.log(`💾 Storage: Cleaned up ${result.changes} old clipboard items`);
      }
    } catch (error) {
      console.error('❌ Storage: Error cleaning up old items:', error);
    }
  }

  getStats() {
    try {
      console.log('💾 Storage: Getting stats...');
      const totalItems = this.db.prepare('SELECT COUNT(*) as count FROM clipboard_items').get();
      const pinnedItems = this.db.prepare('SELECT COUNT(*) as count FROM clipboard_items WHERE pinned = 1').get();
      const typeStats = this.db.prepare(`
        SELECT type, COUNT(*) as count 
        FROM clipboard_items 
        GROUP BY type 
        ORDER BY count DESC
      `).all();

      const stats = {
        total: totalItems.count,
        pinned: pinnedItems.count,
        byType: typeStats
      };

      console.log('💾 Storage: Stats:', stats);
      return stats;
    } catch (error) {
      console.error('❌ Storage: Error getting stats:', error);
      return null;
    }
  }

  close() {
    try {
      if (this.db) {
        console.log('💾 Storage: Closing database connection...');
        this.db.close();
        console.log('💾 Storage: Database closed successfully');
      }
    } catch (error) {
      console.error('❌ Storage: Error closing database:', error);
    }
  }
}

module.exports = Storage;