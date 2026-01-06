/**
 * Audio Feature Index - SQL-based indexing and querying for audio features
 *
 * Features:
 * - Multi-dimensional feature queries
 * - Similarity-based track finding
 * - Distribution analysis
 * - Mood-based clustering
 */

import type { Database } from 'better-sqlite3';
import { type FeatureRange, type AudioFeatureQuery, getMoodClusters } from './shared-types';

// Re-export shared types for backward compatibility
export type { FeatureRange, AudioFeatureQuery };
export type FeatureQuery = AudioFeatureQuery;

// ============================================================================
// Types
// ============================================================================

export interface AudioFeatureData {
  trackId: string;
  energy: number;
  tempo: number;
  valence: number;
  danceability: number;
  acousticness: number;
  instrumentalness: number;
  speechiness: number;
  loudness: number;
  key: number;
  mode: number;
  timeSignature: number;
  analyzedAt: number;
}

export interface FeatureDistribution {
  feature: string;
  min: number;
  max: number;
  mean: number;
  median: number;
  stdDev: number;
  percentiles: Record<string, number>;
}

export interface MoodCluster {
  name: string;
  description: string;
  centroid: Partial<AudioFeatureData>;
  trackCount: number;
  tracks?: string[];
}

// Use consolidated mood clusters from shared-types
const MOOD_CLUSTERS = getMoodClusters();

// ============================================================================
// Audio Feature Index Class
// ============================================================================

export class AudioFeatureIndex {
  constructor(private db: Database) {}

  // ============================================================================
  // Basic Operations
  // ============================================================================

  /**
   * Get audio features for a single track
   */
  get(trackId: string): AudioFeatureData | null {
    const row = this.db
      .prepare('SELECT * FROM audio_features WHERE track_id = ?')
      .get(trackId) as any | undefined;

    return row ? this.rowToFeature(row) : null;
  }

  /**
   * Get audio features for multiple tracks
   */
  getMany(trackIds: string[]): Map<string, AudioFeatureData> {
    if (trackIds.length === 0) return new Map();

    const placeholders = trackIds.map(() => '?').join(',');
    const rows = this.db
      .prepare(`SELECT * FROM audio_features WHERE track_id IN (${placeholders})`)
      .all(...trackIds) as any[];

    const result = new Map<string, AudioFeatureData>();
    for (const row of rows) {
      result.set(row.track_id, this.rowToFeature(row));
    }
    return result;
  }

  // ============================================================================
  // Feature Queries
  // ============================================================================

  /**
   * Query tracks by audio feature ranges
   */
  query(criteria: FeatureQuery, limit: number = 50, offset: number = 0): string[] {
    const { conditions, params } = this.buildQueryConditions(criteria);

    if (conditions.length === 0) {
      const rows = this.db.prepare(`
        SELECT track_id FROM audio_features LIMIT ? OFFSET ?
      `).all(limit, offset) as Array<{ track_id: string }>;
      return rows.map(r => r.track_id);
    }

    const rows = this.db.prepare(`
      SELECT track_id FROM audio_features
      WHERE ${conditions.join(' AND ')}
      LIMIT ? OFFSET ?
    `).all(...params, limit, offset) as Array<{ track_id: string }>;

    return rows.map(r => r.track_id);
  }

  /**
   * Count tracks matching feature criteria
   */
  count(criteria: FeatureQuery): number {
    const { conditions, params } = this.buildQueryConditions(criteria);

    if (conditions.length === 0) {
      const result = this.db.prepare('SELECT COUNT(*) as count FROM audio_features').get() as { count: number };
      return result.count;
    }

    const result = this.db.prepare(`
      SELECT COUNT(*) as count FROM audio_features
      WHERE ${conditions.join(' AND ')}
    `).get(...params) as { count: number };

    return result.count;
  }

  private buildQueryConditions(criteria: FeatureQuery): { conditions: string[]; params: unknown[] } {
    const conditions: string[] = [];
    const params: unknown[] = [];

    const rangeFeatures: Array<[keyof FeatureQuery, string]> = [
      ['energy', 'energy'],
      ['tempo', 'tempo'],
      ['valence', 'valence'],
      ['danceability', 'danceability'],
      ['acousticness', 'acousticness'],
      ['instrumentalness', 'instrumentalness'],
      ['speechiness', 'speechiness'],
      ['loudness', 'loudness']
    ];

    for (const [key, column] of rangeFeatures) {
      const range = criteria[key] as FeatureRange | undefined;
      if (range) {
        if (range.min !== undefined) {
          conditions.push(`${column} >= ?`);
          params.push(range.min);
        }
        if (range.max !== undefined) {
          conditions.push(`${column} <= ?`);
          params.push(range.max);
        }
      }
    }

    if (criteria.key !== undefined) {
      conditions.push('key = ?');
      params.push(criteria.key);
    }

    if (criteria.mode !== undefined) {
      conditions.push('mode = ?');
      params.push(criteria.mode === 'major' ? 1 : 0);
    }

    return { conditions, params };
  }

  // ============================================================================
  // Similarity Search
  // ============================================================================

  /**
   * Find tracks similar to a reference track based on audio features
   */
  findSimilar(trackId: string, limit: number = 20, excludeSelf: boolean = true): string[] {
    const reference = this.get(trackId);
    if (!reference) return [];

    return this.findSimilarToProfile(reference, limit, excludeSelf ? trackId : undefined);
  }

  /**
   * Find tracks similar to a target feature profile
   */
  findSimilarToProfile(
    profile: Partial<AudioFeatureData>,
    limit: number = 20,
    excludeTrackId?: string
  ): string[] {
    // Default values for missing features
    const target = {
      energy: profile.energy ?? 0.5,
      tempo: profile.tempo ?? 120,
      valence: profile.valence ?? 0.5,
      danceability: profile.danceability ?? 0.5,
      acousticness: profile.acousticness ?? 0.5,
      instrumentalness: profile.instrumentalness ?? 0.5,
      speechiness: profile.speechiness ?? 0.3,
      loudness: profile.loudness ?? -10
    };

    // Feature weights for similarity calculation
    const weights = {
      energy: 1.5,
      tempo: 0.5,
      valence: 1.5,
      danceability: 1.0,
      acousticness: 1.0,
      instrumentalness: 0.8,
      speechiness: 0.5,
      loudness: 0.3
    };

    // Normalize functions
    const normTempo = (t: number) => Math.max(0, Math.min(1, (t - 60) / 140));
    const normLoudness = (l: number) => Math.max(0, Math.min(1, (l + 60) / 60));

    const refNormTempo = normTempo(target.tempo);
    const refNormLoudness = normLoudness(target.loudness);

    // Build weighted Euclidean distance expression
    const distanceExpr = `
      (
        ${weights.energy} * (energy - ?) * (energy - ?) +
        ${weights.tempo} * ((tempo - 60) / 140.0 - ?) * ((tempo - 60) / 140.0 - ?) +
        ${weights.valence} * (valence - ?) * (valence - ?) +
        ${weights.danceability} * (danceability - ?) * (danceability - ?) +
        ${weights.acousticness} * (acousticness - ?) * (acousticness - ?) +
        ${weights.instrumentalness} * (instrumentalness - ?) * (instrumentalness - ?) +
        ${weights.speechiness} * (speechiness - ?) * (speechiness - ?) +
        ${weights.loudness} * ((loudness + 60) / 60.0 - ?) * ((loudness + 60) / 60.0 - ?)
      )
    `;

    const params: unknown[] = [
      target.energy, target.energy,
      refNormTempo, refNormTempo,
      target.valence, target.valence,
      target.danceability, target.danceability,
      target.acousticness, target.acousticness,
      target.instrumentalness, target.instrumentalness,
      target.speechiness, target.speechiness,
      refNormLoudness, refNormLoudness
    ];

    let sql = `
      SELECT track_id, ${distanceExpr} as distance
      FROM audio_features
    `;

    if (excludeTrackId) {
      sql += ' WHERE track_id != ?';
      params.push(excludeTrackId);
    }

    sql += ' ORDER BY distance ASC LIMIT ?';
    params.push(limit);

    const rows = this.db.prepare(sql).all(...params) as Array<{ track_id: string; distance: number }>;
    return rows.map(r => r.track_id);
  }

  // ============================================================================
  // Distribution Analysis
  // ============================================================================

  /**
   * Get statistical distribution of a feature across all tracks
   */
  getFeatureDistribution(feature: string): FeatureDistribution | null {
    const validFeatures = ['energy', 'tempo', 'valence', 'danceability', 'acousticness',
                          'instrumentalness', 'speechiness', 'loudness'];

    if (!validFeatures.includes(feature)) {
      return null;
    }

    // Get basic stats
    const stats = this.db.prepare(`
      SELECT
        MIN(${feature}) as min,
        MAX(${feature}) as max,
        AVG(${feature}) as mean,
        COUNT(*) as count
      FROM audio_features
    `).get() as { min: number; max: number; mean: number; count: number };

    if (stats.count === 0) {
      return null;
    }

    // Get median
    const medianRow = this.db.prepare(`
      SELECT ${feature} as value
      FROM audio_features
      ORDER BY ${feature}
      LIMIT 1 OFFSET ?
    `).get(Math.floor(stats.count / 2)) as { value: number };

    // Calculate percentiles
    const percentilePositions = {
      p10: Math.floor(stats.count * 0.1),
      p25: Math.floor(stats.count * 0.25),
      p50: Math.floor(stats.count * 0.5),
      p75: Math.floor(stats.count * 0.75),
      p90: Math.floor(stats.count * 0.9)
    };

    const percentiles: Record<string, number> = {};
    for (const [name, pos] of Object.entries(percentilePositions)) {
      const row = this.db.prepare(`
        SELECT ${feature} as value
        FROM audio_features
        ORDER BY ${feature}
        LIMIT 1 OFFSET ?
      `).get(pos) as { value: number } | undefined;
      percentiles[name] = row?.value ?? 0;
    }

    // Calculate standard deviation
    const varianceResult = this.db.prepare(`
      SELECT AVG((${feature} - ?) * (${feature} - ?)) as variance
      FROM audio_features
    `).get(stats.mean, stats.mean) as { variance: number };

    const stdDev = Math.sqrt(varianceResult.variance);

    return {
      feature,
      min: stats.min,
      max: stats.max,
      mean: stats.mean,
      median: medianRow.value,
      stdDev,
      percentiles
    };
  }

  /**
   * Get distributions for all features
   */
  getAllDistributions(): Record<string, FeatureDistribution> {
    const features = ['energy', 'tempo', 'valence', 'danceability',
      'acousticness', 'instrumentalness', 'speechiness', 'loudness'];

    const result: Record<string, FeatureDistribution> = {};
    for (const feature of features) {
      const dist = this.getFeatureDistribution(feature);
      if (dist) {
        result[feature] = dist;
      }
    }
    return result;
  }

  // ============================================================================
  // Mood Clustering
  // ============================================================================

  /**
   * Get tracks grouped by mood clusters
   */
  getMoodClusters(includeTracks: boolean = false, trackLimit: number = 50): MoodCluster[] {
    const clusters: MoodCluster[] = [];

    for (const cluster of MOOD_CLUSTERS) {
      const trackIds = this.query(cluster.criteria, trackLimit);
      const count = this.count(cluster.criteria);

      // Calculate centroid (average features of cluster)
      let centroid: Partial<AudioFeatureData> = {};
      if (trackIds.length > 0) {
        const features = this.getMany(trackIds);
        const featureValues = Array.from(features.values());

        centroid = {
          energy: this.average(featureValues.map(f => f.energy)),
          tempo: this.average(featureValues.map(f => f.tempo)),
          valence: this.average(featureValues.map(f => f.valence)),
          danceability: this.average(featureValues.map(f => f.danceability)),
          acousticness: this.average(featureValues.map(f => f.acousticness)),
          instrumentalness: this.average(featureValues.map(f => f.instrumentalness))
        };
      }

      clusters.push({
        name: cluster.name,
        description: cluster.description,
        centroid,
        trackCount: count,
        tracks: includeTracks ? trackIds : undefined
      });
    }

    return clusters;
  }

  /**
   * Get the dominant mood for a track
   */
  getTrackMood(trackId: string): string | null {
    const features = this.get(trackId);
    if (!features) return null;

    let bestMood: string | null = null;
    let bestScore = -1;

    for (const cluster of MOOD_CLUSTERS) {
      const score = this.calculateClusterFit(features, cluster.criteria);
      if (score > bestScore) {
        bestScore = score;
        bestMood = cluster.name;
      }
    }

    return bestMood;
  }

  /**
   * Get moods for multiple tracks
   */
  getTrackMoods(trackIds: string[]): Map<string, string> {
    const features = this.getMany(trackIds);
    const result = new Map<string, string>();

    for (const [trackId, feature] of features) {
      let bestMood: string | null = null;
      let bestScore = -1;

      for (const cluster of MOOD_CLUSTERS) {
        const score = this.calculateClusterFit(feature, cluster.criteria);
        if (score > bestScore) {
          bestScore = score;
          bestMood = cluster.name;
        }
      }

      if (bestMood) {
        result.set(trackId, bestMood);
      }
    }

    return result;
  }

  private calculateClusterFit(features: AudioFeatureData, criteria: FeatureQuery): number {
    let score = 0;
    let checks = 0;

    const checkRange = (value: number, range?: FeatureRange) => {
      if (!range) return;
      checks++;
      if (range.min !== undefined && range.max !== undefined) {
        if (value >= range.min && value <= range.max) score++;
      } else if (range.min !== undefined) {
        if (value >= range.min) score++;
      } else if (range.max !== undefined) {
        if (value <= range.max) score++;
      }
    };

    checkRange(features.energy, criteria.energy);
    checkRange(features.valence, criteria.valence);
    checkRange(features.danceability, criteria.danceability);
    checkRange(features.acousticness, criteria.acousticness);
    checkRange(features.instrumentalness, criteria.instrumentalness);
    checkRange(features.speechiness, criteria.speechiness);

    return checks > 0 ? score / checks : 0;
  }

  // ============================================================================
  // Statistics
  // ============================================================================

  /**
   * Get total count of analyzed tracks
   */
  getAnalyzedCount(): number {
    const result = this.db.prepare('SELECT COUNT(*) as count FROM audio_features').get() as { count: number };
    return result.count;
  }

  /**
   * Get tracks that haven't been analyzed yet
   */
  getUnanalyzedTracks(limit: number = 100): string[] {
    const rows = this.db.prepare(`
      SELECT DISTINCT t.track_id
      FROM (
        SELECT id as track_id FROM liked_tracks
        UNION
        SELECT track_id FROM playlist_tracks
      ) t
      LEFT JOIN audio_features af ON t.track_id = af.track_id
      WHERE af.track_id IS NULL
      LIMIT ?
    `).all(limit) as Array<{ track_id: string }>;

    return rows.map(r => r.track_id);
  }

  /**
   * Get available mood cluster names
   */
  getAvailableMoods(): Array<{ name: string; description: string }> {
    return MOOD_CLUSTERS.map(c => ({ name: c.name, description: c.description }));
  }

  // ============================================================================
  // Helpers
  // ============================================================================

  private rowToFeature(row: any): AudioFeatureData {
    return {
      trackId: row.track_id,
      energy: row.energy,
      tempo: row.tempo,
      valence: row.valence,
      danceability: row.danceability,
      acousticness: row.acousticness,
      instrumentalness: row.instrumentalness,
      speechiness: row.speechiness,
      loudness: row.loudness,
      key: row.key,
      mode: row.mode,
      timeSignature: row.time_signature,
      analyzedAt: row.analyzed_at
    };
  }

  private average(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((a, b) => a + b, 0) / values.length;
  }
}
