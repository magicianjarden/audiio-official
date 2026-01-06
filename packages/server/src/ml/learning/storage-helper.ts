/**
 * Storage Helper - Shared storage handling for ML learning components
 */

import type { StorageAdapter } from '../storage/node-storage';

/**
 * Mixin class providing storage functionality
 */
export class StorageHelper {
  protected storage: StorageAdapter | null = null;

  /**
   * Set storage adapter (call before load)
   */
  setStorage(storage: StorageAdapter): void {
    this.storage = storage;
  }

  /**
   * Get storage adapter (falls back to localStorage if available)
   */
  protected getStorage(): StorageAdapter | null {
    if (this.storage) return this.storage;
    if (typeof localStorage !== 'undefined') {
      return {
        getItem: (key) => localStorage.getItem(key),
        setItem: (key, value) => localStorage.setItem(key, value),
        removeItem: (key) => localStorage.removeItem(key),
        clear: () => localStorage.clear(),
      };
    }
    return null;
  }
}
