/**
 * Feature Extractor - Transforms tracks and user behavior into ML features
 *
 * Extracts track features + context features for use in the recommendation neural network.
 */

import type { Track, AudioFeatures, AggregatedFeatures } from '../types';

// Primary genres for one-hot encoding (8 categories)
export const PRIMARY_GENRES = [
  'pop',
  'rock',
  'hip-hop',
  'electronic',
  'r&b',
  'jazz',
  'classical',
  'other'
] as const;

export type PrimaryGenre = typeof PRIMARY_GENRES[number];

// Feature dimensions
export const TRACK_FEATURE_DIM = 18;
export const CONTEXT_FEATURE_DIM = 4;
export const TOTAL_FEATURE_DIM = TRACK_FEATURE_DIM + CONTEXT_FEATURE_DIM;

// Genre energy mapping for estimating audio features from metadata
export const GENRE_ENERGY_MAP: Record<string, { energy: number; valence: number }> = {
  // High energy genres
  'electronic': { energy: 85, valence: 70 },
  'edm': { energy: 90, valence: 75 },
  'house': { energy: 85, valence: 72 },
  'techno': { energy: 88, valence: 60 },
  'dance': { energy: 82, valence: 75 },
  'hip-hop': { energy: 75, valence: 65 },
  'rap': { energy: 78, valence: 60 },
  'rock': { energy: 75, valence: 65 },
  'metal': { energy: 90, valence: 45 },
  'punk': { energy: 85, valence: 55 },

  // Medium energy genres
  'pop': { energy: 65, valence: 70 },
  'r&b': { energy: 55, valence: 60 },
  'rnb': { energy: 55, valence: 60 },
  'soul': { energy: 50, valence: 55 },
  'funk': { energy: 70, valence: 75 },
  'indie': { energy: 55, valence: 50 },
  'alternative': { energy: 60, valence: 50 },
  'country': { energy: 55, valence: 60 },
  'reggae': { energy: 55, valence: 70 },

  // Low energy genres
  'jazz': { energy: 45, valence: 55 },
  'blues': { energy: 40, valence: 40 },
  'classical': { energy: 35, valence: 50 },
  'ambient': { energy: 25, valence: 55 },
  'folk': { energy: 40, valence: 55 },
  'acoustic': { energy: 35, valence: 55 },
  'chill': { energy: 30, valence: 60 },
  'lofi': { energy: 35, valence: 55 },

  // Default
  'other': { energy: 50, valence: 50 }
};

// ============================================
// Types
// ============================================

export interface FeatureScalers {
  duration: { min: number; max: number; mean: number; std: number };
  playCount: { min: number; max: number };
  releaseYear: { min: number; max: number };
}

export interface TrackFeatures {
  raw: number[];
  normalized: number[];
}

export interface ExtractedFeatures {
  trackFeatures: number[];
  contextFeatures: number[];
  combined: number[];
}

export interface UserInteractionData {
  playCount: number;
  skipRatio: number;
  completionRatio: number;
  lastPlayedRecency: number;
  artistFamiliarity: number;
}

// ============================================
// Feature Extraction Functions
// ============================================

/**
 * Calculate mood (energy/valence) from track genres
 */
export function calculateTrackMood(track: Track): { energy: number; valence: number } {
  const genres = track.genres || [];
  if (genres.length === 0) {
    return GENRE_ENERGY_MAP['other'];
  }

  let totalEnergy = 0;
  let totalValence = 0;
  let matchCount = 0;

  for (const genre of genres) {
    const normalized = genre.toLowerCase().replace(/[^a-z]/g, '');
    const mapping = GENRE_ENERGY_MAP[normalized];
    if (mapping) {
      totalEnergy += mapping.energy;
      totalValence += mapping.valence;
      matchCount++;
    }
  }

  if (matchCount === 0) {
    return GENRE_ENERGY_MAP['other'];
  }

  return {
    energy: totalEnergy / matchCount,
    valence: totalValence / matchCount
  };
}

/**
 * Encode track genres as a one-hot vector over primary genres
 */
export function encodeGenres(genres: string[]): number[] {
  const vector = new Array(PRIMARY_GENRES.length).fill(0);

  for (const genre of genres) {
    const normalized = genre.toLowerCase();

    // Find matching primary genre
    const idx = PRIMARY_GENRES.findIndex(g => {
      // Handle common variations
      if (g === 'hip-hop') {
        return normalized.includes('hip') || normalized.includes('rap');
      }
      if (g === 'r&b') {
        return normalized.includes('r&b') || normalized.includes('rnb') || normalized.includes('soul');
      }
      if (g === 'electronic') {
        return normalized.includes('electro') || normalized.includes('edm') ||
               normalized.includes('house') || normalized.includes('techno') ||
               normalized.includes('dance');
      }
      return normalized.includes(g) || g.includes(normalized);
    });

    if (idx !== -1) {
      vector[idx] = 1;
    } else {
      // Unknown genre goes to 'other'
      vector[PRIMARY_GENRES.length - 1] = 1;
    }
  }

  // If no genres matched, mark as 'other'
  if (vector.every(v => v === 0)) {
    vector[PRIMARY_GENRES.length - 1] = 1;
  }

  return vector;
}

/**
 * Normalize a value to [0, 1] range using min-max scaling
 */
export function normalizeValue(value: number, min: number, max: number): number {
  if (max === min) return 0.5;
  return Math.max(0, Math.min(1, (value - min) / (max - min)));
}

/**
 * Extract all features for a single track
 */
export function extractTrackFeatures(
  track: Track,
  audioFeatures: AudioFeatures | undefined,
  userInteraction: UserInteractionData,
  scalers: FeatureScalers
): TrackFeatures {
  // 1. Genre one-hot encoding (8 features)
  const genreVector = encodeGenres(track.genres || []);

  // 2. Energy and valence (2 features)
  // Prefer audio features, fall back to genre estimate
  let energy: number;
  let valence: number;

  if (audioFeatures?.energy !== undefined) {
    energy = audioFeatures.energy;
    valence = audioFeatures.valence ?? 0.5;
  } else {
    const mood = calculateTrackMood(track);
    energy = mood.energy / 100;
    valence = mood.valence / 100;
  }

  // 3. Duration normalized (1 feature)
  const durationNorm = normalizeValue(
    track.duration,
    scalers.duration.min,
    scalers.duration.max
  );

  // 4. Explicit flag (1 feature)
  const explicit = (track as any).explicit ? 1 : 0;

  // 5. Release year normalized (1 feature)
  const releaseDate = (track as any).releaseDate;
  const releaseYear = releaseDate
    ? new Date(releaseDate).getFullYear()
    : 2020;
  const releaseYearNorm = normalizeValue(
    releaseYear,
    scalers.releaseYear.min,
    scalers.releaseYear.max
  );

  // 6. User interaction features (5 features)
  const playCount = Math.log1p(userInteraction.playCount) / Math.log1p(100);

  // Combine all features (18 total)
  const raw = [
    ...genreVector,                      // 8 features
    energy,                              // 1 feature
    valence,                             // 1 feature
    durationNorm,                        // 1 feature
    explicit,                            // 1 feature
    releaseYearNorm,                     // 1 feature
    playCount,                           // 1 feature
    userInteraction.skipRatio,           // 1 feature
    userInteraction.completionRatio,     // 1 feature
    userInteraction.lastPlayedRecency,   // 1 feature
    userInteraction.artistFamiliarity    // 1 feature
  ];

  return { raw, normalized: raw }; // Features are already normalized
}

/**
 * Extract context features (time-based)
 */
export function extractContextFeatures(hour?: number): number[] {
  const h = hour ?? new Date().getHours();
  const dayOfWeek = new Date().getDay();

  // Cyclical encoding for time (prevents discontinuity at midnight)
  const hourSin = Math.sin((h * 2 * Math.PI) / 24);
  const hourCos = Math.cos((h * 2 * Math.PI) / 24);
  const daySin = Math.sin((dayOfWeek * 2 * Math.PI) / 7);
  const dayCos = Math.cos((dayOfWeek * 2 * Math.PI) / 7);

  return [hourSin, hourCos, daySin, dayCos];
}

/**
 * Extract all features for a track (combined track + context)
 */
export function extractAllFeatures(
  track: Track,
  audioFeatures: AudioFeatures | undefined,
  userInteraction: UserInteractionData,
  scalers: FeatureScalers,
  hour?: number
): ExtractedFeatures {
  const trackFeatures = extractTrackFeatures(track, audioFeatures, userInteraction, scalers);
  const contextFeatures = extractContextFeatures(hour);

  return {
    trackFeatures: trackFeatures.normalized,
    contextFeatures,
    combined: [...trackFeatures.normalized, ...contextFeatures]
  };
}

/**
 * Batch extract features for multiple tracks
 */
export function extractBatchFeatures(
  tracks: Track[],
  getAudioFeatures: (trackId: string) => AudioFeatures | undefined,
  getUserInteraction: (trackId: string) => UserInteractionData,
  scalers: FeatureScalers,
  hour?: number
): number[][] {
  const contextFeatures = extractContextFeatures(hour);

  return tracks.map(track => {
    const audioFeatures = getAudioFeatures(track.id);
    const userInteraction = getUserInteraction(track.id);
    const trackFeatures = extractTrackFeatures(track, audioFeatures, userInteraction, scalers);
    return [...trackFeatures.normalized, ...contextFeatures];
  });
}

// ============================================
// Scaler Initialization
// ============================================

/**
 * Calculate standard deviation
 */
function calculateStd(values: number[]): number {
  if (values.length === 0) return 1;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
  const avgSquaredDiff = squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
  return Math.sqrt(avgSquaredDiff) || 1;
}

/**
 * Initialize feature scalers from a set of tracks
 */
export function initializeScalers(tracks: Track[]): FeatureScalers {
  // Extract durations
  const durations = tracks
    .map(t => t.duration)
    .filter(d => d > 0);

  // Extract release years
  const years = tracks
    .map(t => {
      const releaseDate = (t as any).releaseDate;
      return releaseDate ? new Date(releaseDate).getFullYear() : null;
    })
    .filter((y): y is number => y !== null && y > 1900 && y <= new Date().getFullYear() + 1);

  // Calculate statistics
  const durationMean = durations.length > 0
    ? durations.reduce((a, b) => a + b, 0) / durations.length
    : 180000;

  return {
    duration: {
      min: Math.min(...durations, 30000),      // 30 second floor
      max: Math.max(...durations, 600000),     // 10 minute ceiling
      mean: durationMean,
      std: calculateStd(durations)
    },
    playCount: {
      min: 0,
      max: 100
    },
    releaseYear: {
      min: Math.min(...years, 1950),
      max: Math.max(...years, new Date().getFullYear())
    }
  };
}

/**
 * Default scalers when no tracks are available
 */
export function getDefaultScalers(): FeatureScalers {
  return {
    duration: {
      min: 30000,      // 30 seconds
      max: 600000,     // 10 minutes
      mean: 180000,    // 3 minutes
      std: 60000       // 1 minute
    },
    playCount: {
      min: 0,
      max: 100
    },
    releaseYear: {
      min: 1950,
      max: new Date().getFullYear()
    }
  };
}

/**
 * Get default user interaction data for new tracks
 */
export function getDefaultUserInteraction(): UserInteractionData {
  return {
    playCount: 0,
    skipRatio: 0.5,
    completionRatio: 0.5,
    lastPlayedRecency: 0,
    artistFamiliarity: 0
  };
}
