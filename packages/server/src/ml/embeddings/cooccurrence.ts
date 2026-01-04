/**
 * Co-occurrence Matrix
 *
 * Tracks which songs appear together in playlists, queues, and listening sessions.
 * This enables collaborative filtering without needing millions of users -
 * we learn from the user's own patterns and can incorporate community data later.
 */

import type { CoOccurrence, CoOccurrenceContext } from './types';

/**
 * Configuration for co-occurrence tracking
 */
export interface CoOccurrenceConfig {
  maxPairs: number; // Maximum number of pairs to track
  decayFactor: number; // Daily decay factor for old pairs
  minCount: number; // Minimum count to keep a pair
  sessionWindow: number; // Time window for session grouping (ms)
  maxSessionTracks: number; // Max tracks to consider per session
}

/**
 * Default configuration
 */
export const DEFAULT_COOCCURRENCE_CONFIG: CoOccurrenceConfig = {
  maxPairs: 50000,
  decayFactor: 0.98,
  minCount: 2,
  sessionWindow: 30 * 60 * 1000, // 30 minutes
  maxSessionTracks: 20,
};

/**
 * Context type for co-occurrence
 */
export type ContextType = 'queue' | 'playlist' | 'session' | 'radio';

/**
 * Co-occurrence entry with efficient storage
 */
interface CoOccurrenceEntry {
  count: number;
  contexts: Map<ContextType, number>;
  lastSeen: number;
  firstSeen: number;
}

/**
 * Co-occurrence Matrix Manager
 *
 * Tracks pairs of songs that appear together, enabling
 * "users who liked X also liked Y" style recommendations.
 */
export class CoOccurrenceMatrix {
  private config: CoOccurrenceConfig;
  // Use a map with composite key "trackA:trackB" (sorted)
  private matrix = new Map<string, CoOccurrenceEntry>();
  private lastDecay = Date.now();

  constructor(config: Partial<CoOccurrenceConfig> = {}) {
    this.config = { ...DEFAULT_COOCCURRENCE_CONFIG, ...config };
  }

  /**
   * Generate a consistent key for a track pair
   */
  private getPairKey(trackA: string, trackB: string): string {
    // Sort to ensure consistent key regardless of order
    return trackA < trackB ? `${trackA}:${trackB}` : `${trackB}:${trackA}`;
  }

  /**
   * Record co-occurrence of tracks in a session/playlist
   */
  recordCoOccurrence(
    trackIds: string[],
    context: ContextType,
    weight = 1
  ): void {
    if (trackIds.length < 2) return;

    const now = Date.now();

    // Limit tracks to prevent explosion
    const tracks = trackIds.slice(0, this.config.maxSessionTracks);

    // Record all pairs (O(n²) but limited by maxSessionTracks)
    for (let i = 0; i < tracks.length; i++) {
      for (let j = i + 1; j < tracks.length; j++) {
        const key = this.getPairKey(tracks[i], tracks[j]);

        let entry = this.matrix.get(key);
        if (!entry) {
          entry = {
            count: 0,
            contexts: new Map(),
            lastSeen: now,
            firstSeen: now,
          };
          this.matrix.set(key, entry);
        }

        // Proximity bonus: tracks closer together get higher weight
        const distance = j - i;
        const proximityWeight = weight * Math.exp(-distance * 0.1);

        entry.count += proximityWeight;
        entry.lastSeen = now;
        entry.contexts.set(
          context,
          (entry.contexts.get(context) || 0) + proximityWeight
        );
      }
    }

    // Apply decay if needed
    this.maybeApplyDecay();

    // Prune if too large
    if (this.matrix.size > this.config.maxPairs) {
      this.prune();
    }
  }

  /**
   * Record sequential play (A played after B)
   */
  recordSequentialPlay(
    previousTrackId: string,
    currentTrackId: string,
    context: ContextType = 'session'
  ): void {
    if (previousTrackId === currentTrackId) return;

    const key = this.getPairKey(previousTrackId, currentTrackId);
    const now = Date.now();

    let entry = this.matrix.get(key);
    if (!entry) {
      entry = {
        count: 0,
        contexts: new Map(),
        lastSeen: now,
        firstSeen: now,
      };
      this.matrix.set(key, entry);
    }

    // Sequential plays get higher weight
    entry.count += 1.5;
    entry.lastSeen = now;
    entry.contexts.set(context, (entry.contexts.get(context) || 0) + 1.5);
  }

  /**
   * Record a "like" of track B after playing track A
   */
  recordLikeAfterPlay(playedTrackId: string, likedTrackId: string): void {
    if (playedTrackId === likedTrackId) return;

    const key = this.getPairKey(playedTrackId, likedTrackId);
    const now = Date.now();

    let entry = this.matrix.get(key);
    if (!entry) {
      entry = {
        count: 0,
        contexts: new Map(),
        lastSeen: now,
        firstSeen: now,
      };
      this.matrix.set(key, entry);
    }

    // Like after play is a strong signal
    entry.count += 3;
    entry.lastSeen = now;
    entry.contexts.set('session', (entry.contexts.get('session') || 0) + 3);
  }

  /**
   * Get co-occurrence score for a pair
   */
  getScore(trackA: string, trackB: string): number {
    const key = this.getPairKey(trackA, trackB);
    const entry = this.matrix.get(key);
    return entry ? entry.count : 0;
  }

  /**
   * Get all tracks that co-occur with a given track
   */
  getRelatedTracks(
    trackId: string,
    limit = 50
  ): Array<{ trackId: string; score: number }> {
    const results: Array<{ trackId: string; score: number }> = [];

    for (const [key, entry] of this.matrix) {
      const [a, b] = key.split(':');
      if (a === trackId) {
        results.push({ trackId: b, score: entry.count });
      } else if (b === trackId) {
        results.push({ trackId: a, score: entry.count });
      }
    }

    // Sort by score and limit
    return results.sort((a, b) => b.score - a.score).slice(0, limit);
  }

  /**
   * Get related tracks for multiple seed tracks
   */
  getRelatedTracksMultiple(
    trackIds: string[],
    limit = 50
  ): Array<{ trackId: string; score: number }> {
    const scores = new Map<string, number>();
    const seedSet = new Set(trackIds);

    for (const seedId of trackIds) {
      const related = this.getRelatedTracks(seedId, limit * 2);
      for (const { trackId, score } of related) {
        // Skip seed tracks
        if (seedSet.has(trackId)) continue;

        scores.set(trackId, (scores.get(trackId) || 0) + score);
      }
    }

    return Array.from(scores.entries())
      .map(([trackId, score]) => ({ trackId, score }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  /**
   * Generate collaborative embedding from co-occurrence
   *
   * This creates a vector representing the track's "position"
   * in the collaborative space based on what it co-occurs with.
   */
  generateCollaborativeEmbedding(
    trackId: string,
    dimensions: number
  ): Float32Array | null {
    const related = this.getRelatedTracks(trackId, 100);
    if (related.length < 3) return null;

    // Use a simple hash-based embedding
    const vector = new Float32Array(dimensions);
    let totalWeight = 0;

    for (const { trackId: relatedId, score } of related) {
      // Hash the related track ID to get deterministic positions
      const hash = this.hashString(relatedId);
      const weight = Math.log1p(score);

      for (let i = 0; i < dimensions; i++) {
        // Use hash to determine contribution to each dimension
        const contribution = ((hash * (i + 1) * 2654435761) % 1000) / 1000 - 0.5;
        vector[i] += contribution * weight;
      }
      totalWeight += weight;
    }

    // Normalize
    if (totalWeight > 0) {
      for (let i = 0; i < dimensions; i++) {
        vector[i] /= totalWeight;
      }
    }

    // Normalize to unit length
    let magnitude = 0;
    for (let i = 0; i < dimensions; i++) {
      magnitude += vector[i] * vector[i];
    }
    magnitude = Math.sqrt(magnitude);

    if (magnitude > 0) {
      for (let i = 0; i < dimensions; i++) {
        vector[i] /= magnitude;
      }
    }

    return vector;
  }

  /**
   * Simple string hash
   */
  private hashString(str: string): number {
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) + hash) ^ str.charCodeAt(i);
    }
    return Math.abs(hash);
  }

  /**
   * Apply decay to old entries
   */
  private maybeApplyDecay(): void {
    const now = Date.now();
    const daysSinceLast = (now - this.lastDecay) / (24 * 60 * 60 * 1000);

    if (daysSinceLast < 1) return;

    const decay = Math.pow(this.config.decayFactor, Math.floor(daysSinceLast));

    for (const [key, entry] of this.matrix) {
      entry.count *= decay;

      // Remove if below threshold
      if (entry.count < this.config.minCount) {
        this.matrix.delete(key);
      }
    }

    this.lastDecay = now;
  }

  /**
   * Prune matrix to max size
   */
  private prune(): void {
    if (this.matrix.size <= this.config.maxPairs) return;

    // Sort entries by score and recency
    const entries = Array.from(this.matrix.entries()).map(([key, entry]) => {
      const recencyBonus = Math.exp(-(Date.now() - entry.lastSeen) / (7 * 24 * 60 * 60 * 1000));
      return {
        key,
        priority: entry.count * recencyBonus,
      };
    });

    entries.sort((a, b) => a.priority - b.priority);

    // Remove lowest priority entries
    const toRemove = entries.slice(0, entries.length - this.config.maxPairs);
    for (const { key } of toRemove) {
      this.matrix.delete(key);
    }
  }

  /**
   * Get matrix statistics
   */
  getStats(): {
    pairCount: number;
    avgScore: number;
    topPairs: Array<{ pair: string; score: number }>;
  } {
    let totalScore = 0;
    const pairs: Array<{ pair: string; score: number }> = [];

    for (const [key, entry] of this.matrix) {
      totalScore += entry.count;
      pairs.push({ pair: key, score: entry.count });
    }

    pairs.sort((a, b) => b.score - a.score);

    return {
      pairCount: this.matrix.size,
      avgScore: this.matrix.size > 0 ? totalScore / this.matrix.size : 0,
      topPairs: pairs.slice(0, 10),
    };
  }

  /**
   * Export for persistence
   */
  export(): Array<{
    key: string;
    count: number;
    contexts: Record<string, number>;
    lastSeen: number;
    firstSeen: number;
  }> {
    const result: Array<{
      key: string;
      count: number;
      contexts: Record<string, number>;
      lastSeen: number;
      firstSeen: number;
    }> = [];

    for (const [key, entry] of this.matrix) {
      result.push({
        key,
        count: entry.count,
        contexts: Object.fromEntries(entry.contexts),
        lastSeen: entry.lastSeen,
        firstSeen: entry.firstSeen,
      });
    }

    return result;
  }

  /**
   * Import from persistence
   */
  import(
    data: Array<{
      key: string;
      count: number;
      contexts: Record<string, number>;
      lastSeen: number;
      firstSeen: number;
    }>
  ): void {
    this.matrix.clear();

    for (const item of data) {
      this.matrix.set(item.key, {
        count: item.count,
        contexts: new Map(Object.entries(item.contexts) as [ContextType, number][]),
        lastSeen: item.lastSeen,
        firstSeen: item.firstSeen,
      });
    }

    this.lastDecay = Date.now();
  }

  /**
   * Clear all data
   */
  clear(): void {
    this.matrix.clear();
    this.lastDecay = Date.now();
  }

  /**
   * Get size
   */
  size(): number {
    return this.matrix.size;
  }
}

// Singleton
let instance: CoOccurrenceMatrix | null = null;

export function getCoOccurrenceMatrix(
  config?: Partial<CoOccurrenceConfig>
): CoOccurrenceMatrix {
  if (!instance) {
    instance = new CoOccurrenceMatrix(config);
  }
  return instance;
}

export function resetCoOccurrenceMatrix(): void {
  instance = null;
}
