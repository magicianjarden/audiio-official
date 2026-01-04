/**
 * Browser Storage - Browser-safe storage adapters
 *
 * This file contains storage adapters that work in browser environments
 * without requiring Node.js modules like 'fs' or 'path'.
 */

export interface StorageAdapter {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  clear(): void;
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
 *
 * Note: For Node.js/Electron environments that need file-based storage,
 * import NodeStorage from './node-storage' instead.
 */
export function createStorage(): StorageAdapter {
  // Check if localStorage is available (browser/renderer)
  if (typeof localStorage !== 'undefined') {
    return new BrowserStorage();
  }

  // Fallback to memory storage
  console.warn('[Storage] No persistent storage available, using memory storage');
  return new MemoryStorage();
}
