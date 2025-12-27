/**
 * Translation Cache - IndexedDB wrapper for persistent translation storage
 * Stores translations with LRU eviction (30 day expiry)
 */

const DB_NAME = 'audiio-translations';
const DB_VERSION = 1;
const STORE_NAME = 'translations';
const CACHE_EXPIRY_DAYS = 30;

export type SupportedLanguage = 'ja' | 'ko' | 'zh' | 'es' | 'fr' | 'de' | 'pt' | 'it' | 'ru';

export interface TranslationCacheEntry {
  id: string;              // `${trackId}-${lineIndex}`
  trackId: string;
  lineIndex: number;
  originalText: string;
  translatedText: string;
  sourceLanguage: SupportedLanguage;
  targetLanguage: string;
  createdAt: number;
  provider: 'libre-translate' | 'manual';
}

class TranslationCache {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  async initialize(): Promise<void> {
    if (this.db) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error('Failed to open translation cache:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('trackId', 'trackId', { unique: false });
          store.createIndex('createdAt', 'createdAt', { unique: false });
        }
      };
    });

    return this.initPromise;
  }

  private async ensureDb(): Promise<IDBDatabase> {
    await this.initialize();
    if (!this.db) {
      throw new Error('Translation cache not initialized');
    }
    return this.db;
  }

  private generateId(trackId: string, lineIndex: number): string {
    return `${trackId}-${lineIndex}`;
  }

  async getTranslation(trackId: string, lineIndex: number): Promise<string | null> {
    const db = await this.ensureDb();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(this.generateId(trackId, lineIndex));

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const entry = request.result as TranslationCacheEntry | undefined;
        if (entry && !this.isExpired(entry.createdAt)) {
          resolve(entry.translatedText);
        } else {
          resolve(null);
        }
      };
    });
  }

  async getBatchTranslations(trackId: string): Promise<Map<number, string>> {
    const db = await this.ensureDb();
    const translations = new Map<number, string>();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const index = store.index('trackId');
      const request = index.openCursor(IDBKeyRange.only(trackId));

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) {
          const entry = cursor.value as TranslationCacheEntry;
          if (!this.isExpired(entry.createdAt)) {
            translations.set(entry.lineIndex, entry.translatedText);
          }
          cursor.continue();
        } else {
          resolve(translations);
        }
      };
    });
  }

  async setTranslation(
    trackId: string,
    lineIndex: number,
    originalText: string,
    translatedText: string,
    sourceLanguage: SupportedLanguage,
    targetLanguage: string = 'en',
    provider: 'libre-translate' | 'manual' = 'libre-translate'
  ): Promise<void> {
    const db = await this.ensureDb();

    const entry: TranslationCacheEntry = {
      id: this.generateId(trackId, lineIndex),
      trackId,
      lineIndex,
      originalText,
      translatedText,
      sourceLanguage,
      targetLanguage,
      createdAt: Date.now(),
      provider
    };

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(entry);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async setBatchTranslations(entries: Omit<TranslationCacheEntry, 'id' | 'createdAt'>[]): Promise<void> {
    const db = await this.ensureDb();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);

      transaction.onerror = () => reject(transaction.error);
      transaction.oncomplete = () => resolve();

      for (const entry of entries) {
        const fullEntry: TranslationCacheEntry = {
          ...entry,
          id: this.generateId(entry.trackId, entry.lineIndex),
          createdAt: Date.now()
        };
        store.put(fullEntry);
      }
    });
  }

  async hasTrack(trackId: string): Promise<boolean> {
    const translations = await this.getBatchTranslations(trackId);
    return translations.size > 0;
  }

  async clearTrack(trackId: string): Promise<void> {
    const db = await this.ensureDb();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const index = store.index('trackId');
      const request = index.openCursor(IDBKeyRange.only(trackId));

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        } else {
          resolve();
        }
      };
    });
  }

  async clearAll(): Promise<void> {
    const db = await this.ensureDb();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.clear();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async clearExpired(): Promise<number> {
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
          cursor.delete();
          deletedCount++;
          cursor.continue();
        } else {
          resolve(deletedCount);
        }
      };
    });
  }

  async getCacheStats(): Promise<{ entries: number; oldestEntry: number | null }> {
    const db = await this.ensureDb();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const countRequest = store.count();

      let entries = 0;
      let oldestEntry: number | null = null;

      countRequest.onsuccess = () => {
        entries = countRequest.result;
      };

      const index = store.index('createdAt');
      const cursorRequest = index.openCursor();

      cursorRequest.onsuccess = () => {
        const cursor = cursorRequest.result;
        if (cursor && oldestEntry === null) {
          oldestEntry = (cursor.value as TranslationCacheEntry).createdAt;
        }
      };

      transaction.oncomplete = () => resolve({ entries, oldestEntry });
      transaction.onerror = () => reject(transaction.error);
    });
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
  }
}

// Singleton instance
export const translationCache = new TranslationCache();
