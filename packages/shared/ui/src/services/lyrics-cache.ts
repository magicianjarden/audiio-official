/**
 * Lyrics Cache - IndexedDB wrapper for persistent lyrics storage
 * Stores lyrics with pre-computed word timings to avoid recomputation
 * Uses LRU eviction with 30 day expiry
 */

const DB_NAME = 'audiio-lyrics';
const DB_VERSION = 1;
const STORE_NAME = 'lyrics';
const CACHE_EXPIRY_DAYS = 30;

export interface WordTiming {
  word: string;
  startTime: number;
  endTime: number;
  lineIndex: number;
  wordIndex: number;
}

export interface LyricLine {
  time: number;
  text: string;
}

export interface LineWithWords extends LyricLine {
  words: WordTiming[];
}

export interface LyricsCacheEntry {
  id: string;                           // trackId
  artist: string;
  title: string;
  syncedLyrics: string | null;          // Raw LRC format
  plainLyrics: string | null;
  lyrics: LyricLine[] | null;           // Parsed lyrics
  linesWithWords: LineWithWords[] | null; // Pre-computed word timings
  duration: number | null;
  createdAt: number;
  accessedAt: number;                   // For LRU tracking
}

class LyricsCache {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;
  private memoryCache = new Map<string, LyricsCacheEntry>(); // Hot cache
  private readonly MAX_MEMORY_ENTRIES = 50;

  async initialize(): Promise<void> {
    if (this.db) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error('[LyricsCache] Failed to open:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log('[LyricsCache] Initialized');
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('createdAt', 'createdAt', { unique: false });
          store.createIndex('accessedAt', 'accessedAt', { unique: false });
          store.createIndex('artistTitle', ['artist', 'title'], { unique: false });
        }
      };
    });

    return this.initPromise;
  }

  private async ensureDb(): Promise<IDBDatabase> {
    await this.initialize();
    if (!this.db) {
      throw new Error('Lyrics cache not initialized');
    }
    return this.db;
  }

  /**
   * Get lyrics from cache (memory first, then IndexedDB)
   */
  async get(trackId: string): Promise<LyricsCacheEntry | null> {
    // Check memory cache first (hot path)
    const memCached = this.memoryCache.get(trackId);
    if (memCached && !this.isExpired(memCached.createdAt)) {
      return memCached;
    }

    try {
      const db = await this.ensureDb();

      return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(trackId);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const entry = request.result as LyricsCacheEntry | undefined;
          if (entry && !this.isExpired(entry.createdAt)) {
            // Update access time for LRU
            entry.accessedAt = Date.now();
            store.put(entry);

            // Add to memory cache
            this.addToMemoryCache(entry);
            resolve(entry);
          } else {
            resolve(null);
          }
        };
      });
    } catch (error) {
      console.error('[LyricsCache] Get error:', error);
      return null;
    }
  }

  /**
   * Search by artist/title (fallback when trackId not found)
   */
  async getByArtistTitle(artist: string, title: string): Promise<LyricsCacheEntry | null> {
    try {
      const db = await this.ensureDb();
      const normalizedArtist = artist.toLowerCase().trim();
      const normalizedTitle = title.toLowerCase().trim();

      return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const index = store.index('artistTitle');
        const request = index.get([normalizedArtist, normalizedTitle]);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const entry = request.result as LyricsCacheEntry | undefined;
          if (entry && !this.isExpired(entry.createdAt)) {
            resolve(entry);
          } else {
            resolve(null);
          }
        };
      });
    } catch (error) {
      console.error('[LyricsCache] GetByArtistTitle error:', error);
      return null;
    }
  }

  /**
   * Store lyrics in cache with pre-computed word timings
   */
  async set(entry: Omit<LyricsCacheEntry, 'createdAt' | 'accessedAt'>): Promise<void> {
    try {
      const db = await this.ensureDb();
      const now = Date.now();

      const fullEntry: LyricsCacheEntry = {
        ...entry,
        artist: entry.artist.toLowerCase().trim(),
        title: entry.title.toLowerCase().trim(),
        createdAt: now,
        accessedAt: now
      };

      return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.put(fullEntry);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          // Add to memory cache
          this.addToMemoryCache(fullEntry);
          console.log(`[LyricsCache] Cached lyrics for: ${entry.artist} - ${entry.title}`);
          resolve();
        };
      });
    } catch (error) {
      console.error('[LyricsCache] Set error:', error);
    }
  }

  /**
   * Check if lyrics exist in cache (fast check)
   */
  async has(trackId: string): Promise<boolean> {
    if (this.memoryCache.has(trackId)) {
      return true;
    }

    try {
      const db = await this.ensureDb();

      return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.count(IDBKeyRange.only(trackId));

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result > 0);
      });
    } catch {
      return false;
    }
  }

  /**
   * Delete specific entry
   */
  async delete(trackId: string): Promise<void> {
    this.memoryCache.delete(trackId);

    try {
      const db = await this.ensureDb();

      return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.delete(trackId);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve();
      });
    } catch (error) {
      console.error('[LyricsCache] Delete error:', error);
    }
  }

  /**
   * Clear expired entries (call periodically)
   */
  async clearExpired(): Promise<number> {
    try {
      const db = await this.ensureDb();
      const expiryTime = Date.now() - (CACHE_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
      let deletedCount = 0;

      return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const index = store.index('createdAt');
        const request = index.openCursor(IDBKeyRange.upperBound(expiryTime));

        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const cursor = request.result;
          if (cursor) {
            const entry = cursor.value as LyricsCacheEntry;
            this.memoryCache.delete(entry.id);
            cursor.delete();
            deletedCount++;
            cursor.continue();
          } else {
            console.log(`[LyricsCache] Cleared ${deletedCount} expired entries`);
            resolve(deletedCount);
          }
        };
      });
    } catch (error) {
      console.error('[LyricsCache] ClearExpired error:', error);
      return 0;
    }
  }

  /**
   * Get cache stats
   */
  async getStats(): Promise<{ entries: number; memoryEntries: number }> {
    try {
      const db = await this.ensureDb();

      return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.count();

        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          resolve({
            entries: request.result,
            memoryEntries: this.memoryCache.size
          });
        };
      });
    } catch {
      return { entries: 0, memoryEntries: this.memoryCache.size };
    }
  }

  /**
   * Clear all cached lyrics
   */
  async clearAll(): Promise<void> {
    this.memoryCache.clear();

    try {
      const db = await this.ensureDb();

      return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.clear();

        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          console.log('[LyricsCache] Cleared all entries');
          resolve();
        };
      });
    } catch (error) {
      console.error('[LyricsCache] ClearAll error:', error);
    }
  }

  private addToMemoryCache(entry: LyricsCacheEntry): void {
    // Evict oldest if at capacity
    if (this.memoryCache.size >= this.MAX_MEMORY_ENTRIES) {
      const oldestKey = this.memoryCache.keys().next().value;
      if (oldestKey) {
        this.memoryCache.delete(oldestKey);
      }
    }
    this.memoryCache.set(entry.id, entry);
  }

  private isExpired(createdAt: number): boolean {
    const expiryTime = CACHE_EXPIRY_DAYS * 24 * 60 * 60 * 1000;
    return Date.now() - createdAt > expiryTime;
  }

  async close(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
      this.initPromise = null;
    }
    this.memoryCache.clear();
  }
}

// Singleton instance
export const lyricsCache = new LyricsCache();
