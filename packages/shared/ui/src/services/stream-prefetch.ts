/**
 * Stream Prefetch Service
 *
 * Pre-resolves stream URLs for upcoming queue tracks to eliminate playback latency.
 * Caches resolved streams with expiration tracking.
 */

import type { UnifiedTrack, StreamInfo } from '@audiio/core';

interface CachedStream {
  streamInfo: StreamInfo;
  resolvedAt: number;
  expiresAt: number;
}

// Safety buffer before actual expiration (30 minutes)
const EXPIRATION_BUFFER_MS = 30 * 60 * 1000;

// Maximum cache size (LRU eviction)
const MAX_CACHE_SIZE = 20;

// Minimum time between prefetch attempts for same track
const PREFETCH_DEBOUNCE_MS = 5000;

class StreamPrefetchService {
  private cache = new Map<string, CachedStream>();
  private pendingPrefetch = new Set<string>();
  private lastPrefetchAttempt = new Map<string, number>();

  /**
   * Get cached stream info if available and not expired
   */
  getCached(trackId: string): StreamInfo | null {
    const cached = this.cache.get(trackId);
    if (!cached) return null;

    // Check if expired (with safety buffer)
    if (this.isExpiredEntry(cached)) {
      this.cache.delete(trackId);
      return null;
    }

    return cached.streamInfo;
  }

  /**
   * Check if a track's cached stream is expired
   */
  isExpired(trackId: string): boolean {
    const cached = this.cache.get(trackId);
    if (!cached) return true;
    return this.isExpiredEntry(cached);
  }

  /**
   * Pre-fetch streams for multiple tracks (non-blocking)
   * Filters out local tracks, already cached, and pending prefetches
   */
  async prefetch(tracks: UnifiedTrack[]): Promise<void> {
    if (!window.api?.prefetchTracks) {
      console.warn('[StreamPrefetch] prefetchTracks API not available');
      return;
    }

    // Filter tracks that need prefetching
    const tracksToPrefetch = tracks.filter(track => {
      // Skip local tracks (they don't need stream resolution)
      if (this.isLocalTrack(track)) return false;

      // Skip if already cached and valid
      if (this.getCached(track.id)) return false;

      // Skip if already being prefetched
      if (this.pendingPrefetch.has(track.id)) return false;

      // Skip if recently attempted (debounce)
      const lastAttempt = this.lastPrefetchAttempt.get(track.id);
      if (lastAttempt && Date.now() - lastAttempt < PREFETCH_DEBOUNCE_MS) {
        return false;
      }

      return true;
    });

    if (tracksToPrefetch.length === 0) return;

    // Mark as pending
    tracksToPrefetch.forEach(t => {
      this.pendingPrefetch.add(t.id);
      this.lastPrefetchAttempt.set(t.id, Date.now());
    });

    console.log(`[StreamPrefetch] Prefetching ${tracksToPrefetch.length} tracks`);

    try {
      // Call IPC to resolve streams
      const results = await window.api.prefetchTracks(tracksToPrefetch);

      // Cache successful results
      const now = Date.now();
      let cached = 0;

      for (const track of tracksToPrefetch) {
        const streamInfo = results[track.id];
        if (streamInfo) {
          this.addToCache(track.id, streamInfo, now);
          cached++;
        }
      }

      console.log(`[StreamPrefetch] Cached ${cached}/${tracksToPrefetch.length} streams`);
    } catch (error) {
      console.warn('[StreamPrefetch] Prefetch failed:', error);
    } finally {
      // Remove from pending
      tracksToPrefetch.forEach(t => this.pendingPrefetch.delete(t.id));
    }
  }

  /**
   * Manually add a stream to cache (e.g., after playback resolution)
   */
  addToCache(trackId: string, streamInfo: StreamInfo, resolvedAt?: number): void {
    const now = resolvedAt ?? Date.now();

    // Determine expiration time
    // YouTube URLs typically expire in 6 hours
    const expiresAt = streamInfo.expiresAt ?? (now + 6 * 60 * 60 * 1000);

    // Enforce cache size limit (LRU eviction)
    if (this.cache.size >= MAX_CACHE_SIZE) {
      this.evictOldest();
    }

    this.cache.set(trackId, {
      streamInfo,
      resolvedAt: now,
      expiresAt,
    });
  }

  /**
   * Remove a track from cache
   */
  remove(trackId: string): void {
    this.cache.delete(trackId);
    this.pendingPrefetch.delete(trackId);
  }

  /**
   * Clear all cached streams
   */
  clear(): void {
    this.cache.clear();
    this.pendingPrefetch.clear();
    this.lastPrefetchAttempt.clear();
  }

  /**
   * Remove expired entries from cache
   */
  cleanup(): void {
    const now = Date.now();
    const expiredIds: string[] = [];

    this.cache.forEach((cached, trackId) => {
      if (this.isExpiredEntry(cached)) {
        expiredIds.push(trackId);
      }
    });

    expiredIds.forEach(id => this.cache.delete(id));

    if (expiredIds.length > 0) {
      console.log(`[StreamPrefetch] Cleaned up ${expiredIds.length} expired entries`);
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): { size: number; pending: number } {
    return {
      size: this.cache.size,
      pending: this.pendingPrefetch.size,
    };
  }

  // --- Private methods ---

  private isLocalTrack(track: UnifiedTrack): boolean {
    return (
      track.id.startsWith('local:') ||
      track._meta?.metadataProvider === 'local-file' ||
      track.streamInfo?.url?.startsWith('local-audio://') ||
      track.streamInfo?.url?.startsWith('file://')
    );
  }

  private isExpiredEntry(cached: CachedStream): boolean {
    const now = Date.now();
    // Consider expired if within safety buffer of actual expiration
    return now >= cached.expiresAt - EXPIRATION_BUFFER_MS;
  }

  private evictOldest(): void {
    // Find oldest entry by resolvedAt
    let oldestId: string | null = null;
    let oldestTime = Infinity;

    this.cache.forEach((cached, trackId) => {
      if (cached.resolvedAt < oldestTime) {
        oldestTime = cached.resolvedAt;
        oldestId = trackId;
      }
    });

    if (oldestId) {
      this.cache.delete(oldestId);
    }
  }
}

// Singleton instance
export const streamPrefetch = new StreamPrefetchService();

// Periodic cleanup (every 5 minutes)
if (typeof window !== 'undefined') {
  setInterval(() => {
    streamPrefetch.cleanup();
  }, 5 * 60 * 1000);
}
