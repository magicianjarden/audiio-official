/**
 * Node Storage - File-based storage adapter for Node.js/Electron main process
 *
 * Provides a localStorage-like API backed by the file system.
 */

import * as fs from 'fs';
import * as path from 'path';

export interface StorageAdapter {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  clear(): void;
}

/**
 * File-based storage for Node.js environments
 */
export class NodeStorage implements StorageAdapter {
  private data: Map<string, string> = new Map();
  private filePath: string;
  private saveTimeout: NodeJS.Timeout | null = null;
  private isDirty = false;

  constructor(storagePath: string, filename = 'ml-storage.json') {
    this.filePath = path.join(storagePath, filename);
    this.load();
  }

  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.data.set(key, value);
    this.scheduleSave();
  }

  removeItem(key: string): void {
    this.data.delete(key);
    this.scheduleSave();
  }

  clear(): void {
    this.data.clear();
    this.scheduleSave();
  }

  /**
   * Load data from file
   */
  private load(): void {
    try {
      if (fs.existsSync(this.filePath)) {
        const content = fs.readFileSync(this.filePath, 'utf-8');
        const parsed = JSON.parse(content);
        this.data = new Map(Object.entries(parsed));
        console.log(`[NodeStorage] Loaded ${this.data.size} items from ${this.filePath}`);
      }
    } catch (error) {
      console.warn('[NodeStorage] Failed to load storage:', error);
    }
  }

  /**
   * Schedule a save operation (debounced)
   */
  private scheduleSave(): void {
    this.isDirty = true;

    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }

    this.saveTimeout = setTimeout(() => {
      this.persist();
    }, 1000); // Debounce saves by 1 second
  }

  /**
   * Persist data to file immediately
   */
  persist(): void {
    if (!this.isDirty) return;

    try {
      // Ensure directory exists
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      const content = JSON.stringify(Object.fromEntries(this.data), null, 2);
      fs.writeFileSync(this.filePath, content, 'utf-8');
      this.isDirty = false;
      console.log(`[NodeStorage] Saved ${this.data.size} items to ${this.filePath}`);
    } catch (error) {
      console.error('[NodeStorage] Failed to save storage:', error);
    }
  }

  /**
   * Force immediate save and cleanup
   */
  dispose(): void {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }
    this.persist();
  }
}

/**
 * Browser storage adapter (wraps localStorage)
 */
export class BrowserStorage implements StorageAdapter {
  getItem(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  setItem(key: string, value: string): void {
    try {
      localStorage.setItem(key, value);
    } catch (error) {
      console.warn('[BrowserStorage] Failed to set item:', error);
    }
  }

  removeItem(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.warn('[BrowserStorage] Failed to remove item:', error);
    }
  }

  clear(): void {
    try {
      localStorage.clear();
    } catch (error) {
      console.warn('[BrowserStorage] Failed to clear:', error);
    }
  }
}

/**
 * In-memory storage (for testing or when no persistence needed)
 */
export class MemoryStorage implements StorageAdapter {
  private data = new Map<string, string>();

  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.data.set(key, value);
  }

  removeItem(key: string): void {
    this.data.delete(key);
  }

  clear(): void {
    this.data.clear();
  }
}

/**
 * Create appropriate storage adapter based on environment
 */
export function createStorage(storagePath?: string): StorageAdapter {
  // Check if we're in Node.js (Electron main process)
  if (typeof window === 'undefined' && storagePath) {
    return new NodeStorage(storagePath);
  }

  // Check if localStorage is available (browser/renderer)
  if (typeof localStorage !== 'undefined') {
    return new BrowserStorage();
  }

  // Fallback to memory storage
  console.warn('[Storage] No persistent storage available, using memory storage');
  return new MemoryStorage();
}
