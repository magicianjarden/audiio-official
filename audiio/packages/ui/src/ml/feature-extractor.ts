/**
 * Feature Extractor - Transforms tracks and user behavior into ML features
 *
 * Extracts 18-dimensional track features + 4-dimensional context features
 * for use in the recommendation neural network.
 */

import type { UnifiedTrack } from '@audiio/core';
import type { ListenEvent, UserProfile, DislikedTrack, DislikeReason } from '../stores/recommendation-store';
import { GENRE_ENERGY_MAP, calculateTrackMood } from '../stores/recommendation-store';

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

// ============================================
// Feature Extraction Functions
// ============================================

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
 * Calculate skip ratio from listen history
 */
function calculateSkipRatio(history: ListenEvent[]): number {
  if (history.length === 0) return 0.5; // Neutral for unknown
  const skips = history.filter(e => e.skipped).length;
  return skips / history.length;
}

/**
 * Calculate completion ratio from listen history
 */
function calculateCompletionRatio(history: ListenEvent[]): number {
  if (history.length === 0) return 0.5; // Neutral for unknown
  const completed = history.filter(e => e.completed).length;
  return completed / history.length;
}

/**
 * Calculate recency score (how recently the track was played)
 * Returns 1.0 if just played, decays towards 0 over time
 */
function calculateRecency(history: ListenEvent[]): number {
  if (history.length === 0) return 0; // Never played
  const lastListen = Math.max(...history.map(e => e.timestamp));
  const hoursSince = (Date.now() - lastListen) / (1000 * 60 * 60);
  // Decay: 1.0 at 0 hours, 0.5 at 24 hours, approaching 0 at 168 hours (1 week)
  return Math.exp(-hoursSince / 48);
}

/**
 * Calculate artist familiarity score based on user's listening history
 */
function calculateArtistFamiliarity(
  track: UnifiedTrack,
  userProfile: UserProfile
): number {
  let maxScore = 0;

  for (const artist of track.artists) {
    const artistId = artist.id || artist.name.toLowerCase().replace(/\s+/g, '-');
    const pref = userProfile.artistPreferences[artistId];

    if (pref) {
      // Convert score from [-100, 100] to [0, 1]
      const normalizedScore = (pref.score + 100) / 200;
      maxScore = Math.max(maxScore, normalizedScore);
    }
  }

  return maxScore;
}

/**
 * Extract all features for a single track
 */
export function extractTrackFeatures(
  track: UnifiedTrack,
  userProfile: UserProfile,
  listenHistory: ListenEvent[],
  scalers: FeatureScalers
): TrackFeatures {
  // 1. Genre one-hot encoding (8 features)
  const genreVector = encodeGenres(track.genres || []);

  // 2. Energy and valence from genre mapping (2 features)
  const mood = calculateTrackMood(track);
  const energy = mood.energy / 100;
  const valence = mood.valence / 100;

  // 3. Duration normalized (1 feature)
  const durationNorm = normalizeValue(
    track.duration,
    scalers.duration.min,
    scalers.duration.max
  );

  // 4. Explicit flag (1 feature)
  const explicit = track.explicit ? 1 : 0;

  // 5. Release year normalized (1 feature)
  const releaseYear = track.releaseDate
    ? new Date(track.releaseDate).getFullYear()
    : 2020; // Default to 2020 if unknown
  const releaseYearNorm = normalizeValue(
    releaseYear,
    scalers.releaseYear.min,
    scalers.releaseYear.max
  );

  // 6. User interaction features (4 features)
  const trackHistory = listenHistory.filter(e => e.trackId === track.id);
  const playCount = Math.log1p(trackHistory.length) / Math.log1p(100); // Log normalized, capped at 100
  const skipRatio = calculateSkipRatio(trackHistory);
  const completionRatio = calculateCompletionRatio(trackHistory);
  const lastPlayedRecency = calculateRecency(trackHistory);

  // 7. Artist familiarity (1 feature)
  const artistFamiliarity = calculateArtistFamiliarity(track, userProfile);

  // Combine all features (18 total)
  const raw = [
    ...genreVector,         // 8 features
    energy,                 // 1 feature
    valence,                // 1 feature
    durationNorm,           // 1 feature
    explicit,               // 1 feature
    releaseYearNorm,        // 1 feature
    playCount,              // 1 feature
    skipRatio,              // 1 feature
    completionRatio,        // 1 feature
    lastPlayedRecency,      // 1 feature
    artistFamiliarity       // 1 feature
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
  track: UnifiedTrack,
  userProfile: UserProfile,
  listenHistory: ListenEvent[],
  scalers: FeatureScalers,
  hour?: number
): ExtractedFeatures {
  const trackFeatures = extractTrackFeatures(track, userProfile, listenHistory, scalers);
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
  tracks: UnifiedTrack[],
  userProfile: UserProfile,
  listenHistory: ListenEvent[],
  scalers: FeatureScalers,
  hour?: number
): number[][] {
  const contextFeatures = extractContextFeatures(hour);

  return tracks.map(track => {
    const trackFeatures = extractTrackFeatures(track, userProfile, listenHistory, scalers);
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
export function initializeScalers(tracks: UnifiedTrack[]): FeatureScalers {
  // Extract durations
  const durations = tracks
    .map(t => t.duration)
    .filter(d => d > 0);

  // Extract release years
  const years = tracks
    .map(t => t.releaseDate ? new Date(t.releaseDate).getFullYear() : null)
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

// ============================================
// Training Label Generation
// ============================================

/**
 * Dislike reason weights - how strongly each reason indicates dispreference
 * Higher weight = stronger negative signal (label closer to 0)
 */
const DISLIKE_REASON_WEIGHTS: Record<DislikeReason, number> = {
  'not_my_taste': 0.95,      // Very strong negative - fundamentally doesn't like it
  'dont_like_artist': 0.90,  // Strong negative - affects all artist tracks
  'explicit_content': 0.85,  // Strong preference signal
  'heard_too_much': 0.40,    // Mild - might like it again later (fatigue, not dislike)
  'bad_audio_quality': 0.30, // Weak - not about the music itself
  'wrong_mood': 0.35,        // Contextual - might like in different context
  'too_long': 0.50,          // Moderate - preference for shorter tracks
  'too_short': 0.50,         // Moderate - preference for longer tracks
  'other': 0.60,             // Default moderate weight
};

/**
 * Generate training label from a listen event
 * Returns a value between 0 and 1 indicating user preference
 */
export function generateLabel(event: ListenEvent): number {
  // Completed listen = high preference
  if (event.completed) return 1.0;

  // Skipped = low preference
  if (event.skipped) return 0.0;

  // Partial listen = proportional to how much was listened
  if (event.totalDuration > 0) {
    return Math.min(1, event.duration / event.totalDuration);
  }

  return 0.5; // Unknown
}

/**
 * Generate negative training label from dislike reasons
 * Combines multiple reasons into a weighted negative label
 * Returns a value between 0 and 0.2 (strong to mild negative)
 */
export function generateDislikeLabel(reasons: DislikeReason[]): number {
  if (reasons.length === 0) return 0.1; // Default negative if no reasons

  // Calculate weighted average of reason severities
  let totalWeight = 0;
  let weightedSum = 0;

  for (const reason of reasons) {
    const weight = DISLIKE_REASON_WEIGHTS[reason] || 0.6;
    totalWeight += 1;
    weightedSum += weight;
  }

  // Average severity (0-1 scale, where 1 = maximum dislike)
  const avgSeverity = weightedSum / totalWeight;

  // Convert to label: high severity -> low label (closer to 0)
  // Scale: 0.0 (max dislike) to 0.2 (mild dislike)
  return Math.max(0, 0.2 * (1 - avgSeverity));
}

/**
 * Prepare training data from listen history and disliked tracks
 * Now includes disliked tracks as strong negative examples
 */
export function prepareTrainingData(
  tracks: Map<string, UnifiedTrack>,
  listenHistory: ListenEvent[],
  userProfile: UserProfile,
  scalers: FeatureScalers,
  dislikedTracks?: Record<string, DislikedTrack>
): { inputs: number[][]; labels: number[] } {
  const inputs: number[][] = [];
  const labels: number[] = [];

  // Process listen history (positive and neutral examples)
  for (const event of listenHistory) {
    const track = tracks.get(event.trackId);
    if (!track) continue;

    // Skip if this track was later disliked (will be added as negative)
    if (dislikedTracks && dislikedTracks[event.trackId]) continue;

    // Extract features at the time of the listen event
    const eventHour = new Date(event.timestamp).getHours();
    const features = extractAllFeatures(track, userProfile, listenHistory, scalers, eventHour);

    inputs.push(features.combined);
    labels.push(generateLabel(event));
  }

  // Process disliked tracks (negative examples)
  if (dislikedTracks) {
    for (const [trackId, disliked] of Object.entries(dislikedTracks)) {
      // Try to get track from provided tracks map
      let track = tracks.get(trackId);

      // If not in map, try to reconstruct minimal track from disliked data
      if (!track && disliked.trackData) {
        track = {
          id: trackId,
          title: disliked.trackData.title,
          artists: disliked.trackData.artists.map(name => ({ name, id: name })),
          genres: disliked.trackData.genres,
          duration: 0,
          streamSources: [],
          _meta: {
            metadataProvider: 'dislike-data',
            matchConfidence: 1,
            externalIds: {},
            lastUpdated: new Date()
          }
        } as UnifiedTrack;
      }

      if (!track) continue;

      // Extract features at the time of dislike
      const dislikeHour = new Date(disliked.timestamp).getHours();
      const features = extractAllFeatures(track, userProfile, listenHistory, scalers, dislikeHour);

      // Generate weighted negative label based on reasons
      const label = generateDislikeLabel(disliked.reasons);

      inputs.push(features.combined);
      labels.push(label);

      // Log for debugging
      console.log(`[MLTraining] Added disliked track "${disliked.trackData.title}" with label ${label.toFixed(3)} (reasons: ${disliked.reasons.join(', ')})`);
    }
  }

  return { inputs, labels };
}
