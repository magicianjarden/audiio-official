/**
 * Node Storage - File-based storage adapter for Node.js/Electron main process
 *
 * This file uses Node.js built-in modules (fs, path) and should only be
 * imported in Node.js environments. For browser environments, use the
 * exports from the main package entry point instead.
 */

import * as fs from 'fs';
import * as path from 'path';
import type { StorageAdapter } from './browser-storage';

// Re-export StorageAdapter type for convenience
export type { StorageAdapter } from './browser-storage';

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

  /**
   * Get a JSON value (convenience method for typed access)
   */
  get<T>(key: string): T | null {
    const value = this.getItem(key);
    if (value === null) return null;
    try {
      return JSON.parse(value) as T;
    } catch {
      return null;
    }
  }

  /**
   * Set a JSON value (convenience method for typed access)
   */
  set<T>(key: string, value: T): void {
    this.setItem(key, JSON.stringify(value));
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
 * Create storage adapter for Node.js environment
 */
export function createNodeStorage(storagePath: string, filename?: string): StorageAdapter {
  return new NodeStorage(storagePath, filename);
}
