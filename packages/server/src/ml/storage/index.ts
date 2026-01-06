/**
 * ML Storage Module
 *
 * Provides storage adapters for persisting ML features and data.
 * - NodeStorage: File-based JSON storage for server environments
 * - BrowserStorage: localStorage wrapper (available but typically unused in server)
 * - MemoryStorage: In-memory storage for testing
 * - FeatureStore: High-level typed API for ML feature caching
 */

// Storage adapters
export { BrowserStorage, MemoryStorage } from './browser-storage';
export type { StorageAdapter } from './browser-storage';

// Node.js storage
export { NodeStorage } from './node-storage';

// Feature store
export { FeatureStore } from './feature-store';
export type { StoredFeatures, FeatureStoreAdapter } from './feature-store';
