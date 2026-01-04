/**
 * Cache Utilities - Helpers for caching feature data and scores
 */

// ============================================================================
// In-Memory Cache
// ============================================================================

export interface CacheEntry<T> {
  value: T;
  expires: number;
  accessCount: number;
  lastAccess: number;
}

export class MemoryCache<T> {
  private cache = new Map<string, CacheEntry<T>>();
  private maxSize: number;
  private defaultTtlMs: number;

  constructor(maxSize = 1000, defaultTtlMs = 3600000) {
    this.maxSize = maxSize;
    this.defaultTtlMs = defaultTtlMs;
  }

  get(key: string): T | null {
    const entry = this.cache.get(key);

    if (!entry) return null;

    if (Date.now() > entry.expires) {
      this.cache.delete(key);
      return null;
    }

    // Update access stats
    entry.accessCount++;
    entry.lastAccess = Date.now();

    return entry.value;
  }

  set(key: string, value: T, ttlMs?: number): void {
    // Evict if necessary
    if (this.cache.size >= this.maxSize) {
      this.evictLRU();
    }

    this.cache.set(key, {
      value,
      expires: Date.now() + (ttlMs ?? this.defaultTtlMs),
      accessCount: 1,
      lastAccess: Date.now(),
    });
  }

  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;

    if (Date.now() > entry.expires) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  invalidateByPattern(pattern: string | RegExp): number {
    let count = 0;
    const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern;

    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
        count++;
      }
    }

    return count;
  }

  private evictLRU(): void {
    let oldestKey: string | null = null;
    let oldestAccess = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccess < oldestAccess) {
        oldestAccess = entry.lastAccess;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }

  cleanup(): number {
    const now = Date.now();
    let count = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expires) {
        this.cache.delete(key);
        count++;
      }
    }

    return count;
  }

  /**
   * Get all non-expired entries as an iterator
   */
  *entries(): IterableIterator<[string, T]> {
    const now = Date.now();

    for (const [key, entry] of this.cache.entries()) {
      if (now <= entry.expires) {
        yield [key, entry.value];
      }
    }
  }

  /**
   * Get all keys
   */
  keys(): IterableIterator<string> {
    return this.cache.keys();
  }

  /**
   * Get the current size of the cache
   */
  get size(): number {
    return this.cache.size;
  }

  getStats(): CacheStats {
    let hitCount = 0;
    let totalAccess = 0;

    for (const entry of this.cache.values()) {
      hitCount += entry.accessCount - 1; // First access doesn't count as hit
      totalAccess += entry.accessCount;
    }

    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hitRate: totalAccess > 0 ? hitCount / totalAccess : 0,
    };
  }
}

export interface CacheStats {
  size: number;
  maxSize: number;
  hitRate: number;
}

// ============================================================================
// LRU Cache with Size Limit
// ============================================================================

export class LRUCache<T> {
  private cache = new Map<string, T>();
  private maxSize: number;

  constructor(maxSize = 100) {
    this.maxSize = maxSize;
  }

  get(key: string): T | undefined {
    const value = this.cache.get(key);

    if (value !== undefined) {
      // Move to end (most recently used)
      this.cache.delete(key);
      this.cache.set(key, value);
    }

    return value;
  }

  set(key: string, value: T): void {
    // Remove if exists (to update position)
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }

    // Evict oldest if at capacity
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }

    this.cache.set(key, value);
  }

  has(key: string): boolean {
    return this.cache.has(key);
  }

  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  get size(): number {
    return this.cache.size;
  }

  keys(): IterableIterator<string> {
    return this.cache.keys();
  }

  values(): IterableIterator<T> {
    return this.cache.values();
  }
}

// ============================================================================
// Async Cache with Loading
// ============================================================================

export class AsyncCache<T> {
  private cache = new MemoryCache<T>();
  private pending = new Map<string, Promise<T>>();
  private loader: (key: string) => Promise<T>;

  constructor(
    loader: (key: string) => Promise<T>,
    maxSize = 1000,
    defaultTtlMs = 3600000
  ) {
    this.loader = loader;
    this.cache = new MemoryCache<T>(maxSize, defaultTtlMs);
  }

  async get(key: string): Promise<T> {
    // Check cache first
    const cached = this.cache.get(key);
    if (cached !== null) return cached;

    // Check if already loading
    const pending = this.pending.get(key);
    if (pending) return pending;

    // Load and cache
    const promise = this.loader(key).then(value => {
      this.cache.set(key, value);
      this.pending.delete(key);
      return value;
    }).catch(err => {
      this.pending.delete(key);
      throw err;
    });

    this.pending.set(key, promise);
    return promise;
  }

  async getBatch(keys: string[]): Promise<Map<string, T>> {
    const results = new Map<string, T>();
    const toLoad: string[] = [];

    // Check cache for each key
    for (const key of keys) {
      const cached = this.cache.get(key);
      if (cached !== null) {
        results.set(key, cached);
      } else {
        toLoad.push(key);
      }
    }

    // Load missing in parallel
    if (toLoad.length > 0) {
      const loaded = await Promise.all(
        toLoad.map(key => this.get(key).then(value => ({ key, value })))
      );

      for (const { key, value } of loaded) {
        results.set(key, value);
      }
    }

    return results;
  }

  set(key: string, value: T, ttlMs?: number): void {
    this.cache.set(key, value, ttlMs);
  }

  invalidate(key: string): void {
    this.cache.delete(key);
    this.pending.delete(key);
  }

  invalidateByPattern(pattern: string | RegExp): number {
    return this.cache.invalidateByPattern(pattern);
  }

  clear(): void {
    this.cache.clear();
    this.pending.clear();
  }

  cleanup(): number {
    return this.cache.cleanup();
  }
}

// ============================================================================
// Batch Loader
// ============================================================================

export class BatchLoader<K, V> {
  private pending = new Map<K, { resolve: (v: V) => void; reject: (e: Error) => void }[]>();
  private batchFn: (keys: K[]) => Promise<Map<K, V>>;
  private batchSize: number;
  private delayMs: number;
  private timeout: ReturnType<typeof setTimeout> | null = null;

  constructor(
    batchFn: (keys: K[]) => Promise<Map<K, V>>,
    batchSize = 50,
    delayMs = 10
  ) {
    this.batchFn = batchFn;
    this.batchSize = batchSize;
    this.delayMs = delayMs;
  }

  load(key: K): Promise<V> {
    return new Promise((resolve, reject) => {
      const callbacks = this.pending.get(key) || [];
      callbacks.push({ resolve, reject });
      this.pending.set(key, callbacks);

      if (this.pending.size >= this.batchSize) {
        this.flush();
      } else if (!this.timeout) {
        this.timeout = setTimeout(() => this.flush(), this.delayMs);
      }
    });
  }

  private async flush(): Promise<void> {
    if (this.timeout) {
      clearTimeout(this.timeout);
      this.timeout = null;
    }

    const batch = new Map(this.pending);
    this.pending.clear();

    if (batch.size === 0) return;

    try {
      const results = await this.batchFn(Array.from(batch.keys()));

      for (const [key, callbacks] of batch.entries()) {
        const value = results.get(key);
        for (const { resolve, reject } of callbacks) {
          if (value !== undefined) {
            resolve(value);
          } else {
            reject(new Error(`No value for key: ${String(key)}`));
          }
        }
      }
    } catch (error) {
      for (const callbacks of batch.values()) {
        for (const { reject } of callbacks) {
          reject(error as Error);
        }
      }
    }
  }
}

// ============================================================================
// Cache Key Utilities
// ============================================================================

export function createCacheKey(...parts: (string | number | boolean | undefined)[]): string {
  return parts.filter(p => p !== undefined).join(':');
}

export function parseCacheKey(key: string): string[] {
  return key.split(':');
}
