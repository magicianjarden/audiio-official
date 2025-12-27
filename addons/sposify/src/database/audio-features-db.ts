/**
 * Sposify Audio Features Database Queries
 * Provides pre-computed Spotify audio features for tracks
 */

import type { AudioFeatures, DbAudioFeatures } from '../types';
import { getSposifyDatabase } from './sposify-db';

export class AudioFeaturesDatabase {
  private cache: Map<string, AudioFeatures> = new Map();
  private maxCacheSize = 10000;

  /**
   * Get audio features by Spotify ID
   */
  getBySpotifyId(spotifyId: string): AudioFeatures | null {
    // Check cache first
    const cached = this.cache.get(spotifyId);
    if (cached) return cached;

    const db = getSposifyDatabase();
    const dbFeatures = db.getAudioFeatures(spotifyId);

    if (!dbFeatures) return null;

    const features = this.convertDbToAudioFeatures(dbFeatures);
    this.addToCache(spotifyId, features);
    return features;
  }

  /**
   * Get audio features by ISRC
   */
  getByIsrc(isrc: string): AudioFeatures | null {
    const db = getSposifyDatabase();
    const dbFeatures = db.getAudioFeaturesByIsrc(isrc);

    if (!dbFeatures) return null;

    const features = this.convertDbToAudioFeatures(dbFeatures);
    this.addToCache(dbFeatures.spotify_id, features);
    return features;
  }

  /**
   * Get audio features for multiple tracks (batch)
   */
  getBatch(spotifyIds: string[]): Map<string, AudioFeatures> {
    const result = new Map<string, AudioFeatures>();
    const uncached: string[] = [];

    // Check cache first
    for (const id of spotifyIds) {
      const cached = this.cache.get(id);
      if (cached) {
        result.set(id, cached);
      } else {
        uncached.push(id);
      }
    }

    // Fetch uncached from database
    if (uncached.length > 0) {
      const db = getSposifyDatabase();
      const dbResults = db.getAudioFeaturesBatch(uncached);

      for (const [id, dbFeatures] of dbResults) {
        const features = this.convertDbToAudioFeatures(dbFeatures);
        result.set(id, features);
        this.addToCache(id, features);
      }
    }

    return result;
  }

  /**
   * Get audio features by track metadata (searches then gets features)
   */
  getByMetadata(title: string, artist: string): AudioFeatures | null {
    const db = getSposifyDatabase();
    const tracks = db.searchTracks(title, artist, 1);

    if (tracks.length === 0) return null;

    return this.getBySpotifyId(tracks[0].spotify_id);
  }

  /**
   * Find tracks with similar audio features
   */
  findSimilar(features: AudioFeatures, limit = 20): Array<{ spotifyId: string; similarity: number }> {
    const db = getSposifyDatabase().getRawDb();
    if (!db) return [];

    // Calculate similarity based on key features
    // Uses Euclidean distance on normalized features
    const results = db.prepare(`
      SELECT spotify_id,
        (
          ABS(danceability - ?) +
          ABS(energy - ?) +
          ABS(valence - ?) +
          ABS(acousticness - ?) +
          ABS(instrumentalness - ?) +
          ABS((tempo / 200.0) - ?)
        ) as distance
      FROM audio_features
      WHERE spotify_id != ?
      ORDER BY distance ASC
      LIMIT ?
    `).all(
      features.danceability,
      features.energy,
      features.valence,
      features.acousticness,
      features.instrumentalness,
      features.tempo / 200.0,
      features.spotifyId,
      limit
    ) as Array<{ spotify_id: string; distance: number }>;

    // Convert distance to similarity (0-1, higher is more similar)
    return results.map(r => ({
      spotifyId: r.spotify_id,
      similarity: Math.max(0, 1 - r.distance / 6), // 6 features, max distance ~6
    }));
  }

  /**
   * Find tracks by audio feature ranges
   */
  findByFeatureRange(options: {
    minEnergy?: number;
    maxEnergy?: number;
    minDanceability?: number;
    maxDanceability?: number;
    minValence?: number;
    maxValence?: number;
    minTempo?: number;
    maxTempo?: number;
    key?: number;
    mode?: number;
    limit?: number;
  }): string[] {
    const db = getSposifyDatabase().getRawDb();
    if (!db) return [];

    const conditions: string[] = [];
    const params: number[] = [];

    if (options.minEnergy !== undefined) {
      conditions.push('energy >= ?');
      params.push(options.minEnergy);
    }
    if (options.maxEnergy !== undefined) {
      conditions.push('energy <= ?');
      params.push(options.maxEnergy);
    }
    if (options.minDanceability !== undefined) {
      conditions.push('danceability >= ?');
      params.push(options.minDanceability);
    }
    if (options.maxDanceability !== undefined) {
      conditions.push('danceability <= ?');
      params.push(options.maxDanceability);
    }
    if (options.minValence !== undefined) {
      conditions.push('valence >= ?');
      params.push(options.minValence);
    }
    if (options.maxValence !== undefined) {
      conditions.push('valence <= ?');
      params.push(options.maxValence);
    }
    if (options.minTempo !== undefined) {
      conditions.push('tempo >= ?');
      params.push(options.minTempo);
    }
    if (options.maxTempo !== undefined) {
      conditions.push('tempo <= ?');
      params.push(options.maxTempo);
    }
    if (options.key !== undefined) {
      conditions.push('key = ?');
      params.push(options.key);
    }
    if (options.mode !== undefined) {
      conditions.push('mode = ?');
      params.push(options.mode);
    }

    if (conditions.length === 0) return [];

    const limit = options.limit || 100;
    const results = db.prepare(`
      SELECT spotify_id FROM audio_features
      WHERE ${conditions.join(' AND ')}
      LIMIT ?
    `).all(...params, limit) as Array<{ spotify_id: string }>;

    return results.map(r => r.spotify_id);
  }

  /**
   * Get average features for a set of tracks (for playlist analysis)
   */
  getAverageFeatures(spotifyIds: string[]): Partial<AudioFeatures> | null {
    if (spotifyIds.length === 0) return null;

    const features = this.getBatch(spotifyIds);
    if (features.size === 0) return null;

    const sums = {
      tempo: 0,
      danceability: 0,
      energy: 0,
      loudness: 0,
      speechiness: 0,
      acousticness: 0,
      instrumentalness: 0,
      liveness: 0,
      valence: 0,
    };

    for (const f of features.values()) {
      sums.tempo += f.tempo;
      sums.danceability += f.danceability;
      sums.energy += f.energy;
      sums.loudness += f.loudness;
      sums.speechiness += f.speechiness;
      sums.acousticness += f.acousticness;
      sums.instrumentalness += f.instrumentalness;
      sums.liveness += f.liveness;
      sums.valence += f.valence;
    }

    const count = features.size;
    return {
      tempo: sums.tempo / count,
      danceability: sums.danceability / count,
      energy: sums.energy / count,
      loudness: sums.loudness / count,
      speechiness: sums.speechiness / count,
      acousticness: sums.acousticness / count,
      instrumentalness: sums.instrumentalness / count,
      liveness: sums.liveness / count,
      valence: sums.valence / count,
    };
  }

  /**
   * Convert database record to AudioFeatures type
   */
  private convertDbToAudioFeatures(db: DbAudioFeatures): AudioFeatures {
    return {
      spotifyId: db.spotify_id,
      tempo: db.tempo || 0,
      key: db.key || 0,
      mode: db.mode || 0,
      timeSignature: db.time_signature || 4,
      danceability: db.danceability || 0,
      energy: db.energy || 0,
      loudness: db.loudness || 0,
      speechiness: db.speechiness || 0,
      acousticness: db.acousticness || 0,
      instrumentalness: db.instrumentalness || 0,
      liveness: db.liveness || 0,
      valence: db.valence || 0,
    };
  }

  /**
   * Add to cache with LRU eviction
   */
  private addToCache(id: string, features: AudioFeatures): void {
    if (this.cache.size >= this.maxCacheSize) {
      // Remove oldest entry (first key)
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }
    this.cache.set(id, features);
  }

  /**
   * Clear the cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Set max cache size
   */
  setMaxCacheSize(size: number): void {
    this.maxCacheSize = size;
    // Evict if over new limit
    while (this.cache.size > this.maxCacheSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }
  }
}

// Singleton
let instance: AudioFeaturesDatabase | null = null;

export function getAudioFeaturesDatabase(): AudioFeaturesDatabase {
  if (!instance) {
    instance = new AudioFeaturesDatabase();
  }
  return instance;
}
