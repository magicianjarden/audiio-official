/**
 * Feature Utilities - Helpers for feature normalization and encoding
 */

import type { AudioFeatures, MusicalKey, MoodCategory } from '../types/track';
import type { FeatureVector, NormalizedAudioFeatures, FeatureStats } from '../types/training';
import type { ListenContext } from '../types/events';

// ============================================================================
// Normalization
// ============================================================================

/**
 * Normalize a value to 0-1 range using min-max scaling
 */
export function normalize(value: number, min: number, max: number): number {
  if (max === min) return 0.5;
  return Math.max(0, Math.min(1, (value - min) / (max - min)));
}

/**
 * Normalize a value using z-score (standard scaling)
 */
export function zNormalize(value: number, mean: number, std: number): number {
  if (std === 0) return 0;
  return (value - mean) / std;
}

/**
 * Log-normalize a value (for counts, play counts, etc.)
 */
export function logNormalize(value: number, maxValue = 1000): number {
  return Math.log1p(value) / Math.log1p(maxValue);
}

/**
 * Normalize BPM to 0-1 range (60-200 BPM typical range)
 */
export function normalizeBpm(bpm: number): number {
  return normalize(bpm, 60, 200);
}

/**
 * Normalize duration to 0-1 range (0-600 seconds = 10 minutes)
 */
export function normalizeDuration(durationSeconds: number): number {
  return normalize(durationSeconds, 0, 600);
}

/**
 * Normalize loudness from dB to 0-1
 */
export function normalizeLoudness(loudnessDb: number): number {
  // Typical range: -60 dB to 0 dB
  return normalize(loudnessDb, -60, 0);
}

/**
 * Normalize release year to 0-1
 */
export function normalizeYear(year: number): number {
  const currentYear = new Date().getFullYear();
  return normalize(year, 1950, currentYear);
}

// ============================================================================
// Audio Feature Normalization
// ============================================================================

/**
 * Normalize audio features for ML input (min-max normalization)
 */
export function normalizeAudioFeatures(
  features: AudioFeatures | undefined
): NormalizedAudioFeatures {
  return {
    bpm: features?.bpm ? normalizeBpm(features.bpm) : 0.5,
    energy: features?.energy ?? 0.5,
    valence: features?.valence ?? 0.5,
    danceability: features?.danceability ?? 0.5,
    acousticness: features?.acousticness ?? 0.5,
    instrumentalness: features?.instrumentalness ?? 0.5,
    loudness: features?.loudness ? normalizeLoudness(features.loudness) : 0.5,
    duration: 0.5, // Will be set separately if available
    speechiness: features?.speechiness ?? 0,
    liveness: features?.liveness ?? 0.3,
    key: features?.key ? normalizeKey(features.key) : 0,
    mode: features?.mode === 'major' ? 1 : 0,
  };
}

// Typical statistics for z-score normalization (derived from large music datasets)
const AUDIO_FEATURE_STATS = {
  bpm: { mean: 120, std: 30 },
  loudness: { mean: -10, std: 5 },
  duration: { mean: 210, std: 60 }, // ~3.5 minutes average
};

/**
 * Z-score normalize audio features (alternative to min-max)
 * Better for features with outliers, centers values around 0
 */
export function zNormalizeAudioFeatures(
  features: AudioFeatures | undefined
): NormalizedAudioFeatures {
  // Z-score normalize BPM and loudness, clip to reasonable range, then scale to 0-1
  const zBpm = features?.bpm
    ? (zNormalize(features.bpm, AUDIO_FEATURE_STATS.bpm.mean, AUDIO_FEATURE_STATS.bpm.std) + 2) / 4
    : 0.5;

  const zLoudness = features?.loudness
    ? (zNormalize(features.loudness, AUDIO_FEATURE_STATS.loudness.mean, AUDIO_FEATURE_STATS.loudness.std) + 2) / 4
    : 0.5;

  return {
    bpm: Math.max(0, Math.min(1, zBpm)),
    energy: features?.energy ?? 0.5,
    valence: features?.valence ?? 0.5,
    danceability: features?.danceability ?? 0.5,
    acousticness: features?.acousticness ?? 0.5,
    instrumentalness: features?.instrumentalness ?? 0.5,
    loudness: Math.max(0, Math.min(1, zLoudness)),
    duration: 0.5, // Will be set separately if available
    speechiness: features?.speechiness ?? 0,
    liveness: features?.liveness ?? 0.3,
    key: features?.key ? normalizeKey(features.key) : 0,
    mode: features?.mode === 'major' ? 1 : 0,
  };
}

// ============================================================================
// Key and Music Theory
// ============================================================================

const KEY_MAP: Record<MusicalKey, number> = {
  'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3,
  'E': 4, 'F': 5, 'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8,
  'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11,
};

/**
 * Convert musical key to normalized value (0-1)
 */
export function normalizeKey(key: MusicalKey): number {
  return KEY_MAP[key] / 11;
}

/**
 * Get key number (0-11) from key name
 */
export function keyToNumber(key: MusicalKey): number {
  return KEY_MAP[key];
}

/**
 * Calculate harmonic compatibility using Circle of Fifths
 * Returns 0-1 where 1 is perfect compatibility
 */
export function getHarmonicCompatibility(
  key1: MusicalKey,
  mode1: 'major' | 'minor',
  key2: MusicalKey,
  mode2: 'major' | 'minor'
): number {
  const CIRCLE_OF_FIFTHS = [0, 7, 2, 9, 4, 11, 6, 1, 8, 3, 10, 5];

  const pos1 = CIRCLE_OF_FIFTHS.indexOf(KEY_MAP[key1]);
  const pos2 = CIRCLE_OF_FIFTHS.indexOf(KEY_MAP[key2]);

  // Distance on circle of fifths
  const distance = Math.min(
    Math.abs(pos1 - pos2),
    12 - Math.abs(pos1 - pos2)
  );

  // Same mode bonus
  const modeBonus = mode1 === mode2 ? 0.1 : 0;

  // Relative major/minor bonus
  const relativePairBonus =
    (mode1 === 'minor' && mode2 === 'major' && (KEY_MAP[key1] + 3) % 12 === KEY_MAP[key2]) ||
    (mode1 === 'major' && mode2 === 'minor' && (KEY_MAP[key2] + 3) % 12 === KEY_MAP[key1])
      ? 0.2
      : 0;

  // Distance scoring
  const distanceScore = Math.max(0, 1 - distance / 6);

  return Math.min(1, distanceScore + modeBonus + relativePairBonus);
}

// ============================================================================
// Cyclical Encoding
// ============================================================================

/**
 * Encode hour of day as cyclical features (sin/cos)
 * This prevents the midnight discontinuity problem
 */
export function encodeHour(hour: number): { sin: number; cos: number } {
  const radians = (hour / 24) * 2 * Math.PI;
  return {
    sin: Math.sin(radians),
    cos: Math.cos(radians),
  };
}

/**
 * Encode day of week as cyclical features
 */
export function encodeDay(day: number): { sin: number; cos: number } {
  const radians = (day / 7) * 2 * Math.PI;
  return {
    sin: Math.sin(radians),
    cos: Math.cos(radians),
  };
}

// ============================================================================
// Genre Encoding
// ============================================================================

const PRIMARY_GENRES = [
  'pop', 'rock', 'hip-hop', 'electronic', 'r&b',
  'jazz', 'classical', 'country', 'metal', 'indie',
  'folk', 'latin', 'reggae', 'blues', 'soul', 'other',
];

/**
 * Multi-hot encode genres (supports multiple genre tags)
 */
export function encodeGenres(genres: string[] | undefined): number[] {
  const encoding = new Array(PRIMARY_GENRES.length).fill(0);

  if (!genres || genres.length === 0) {
    encoding[encoding.length - 1] = 1;
    return encoding;
  }

  for (const genre of genres) {
    const normalizedGenre = genre.toLowerCase();
    const index = PRIMARY_GENRES.findIndex(g =>
      normalizedGenre.includes(g) || g.includes(normalizedGenre)
    );

    if (index >= 0) {
      encoding[index] = 1;
    }
  }

  // If no matches, mark as 'other'
  if (encoding.every(v => v === 0)) {
    encoding[encoding.length - 1] = 1;
  }

  return encoding;
}

// ============================================================================
// Mood Encoding
// ============================================================================

const MOOD_CATEGORIES: MoodCategory[] = [
  'happy', 'sad', 'angry', 'fearful', 'calm', 'energetic',
  'tense', 'melancholic', 'euphoric', 'peaceful', 'aggressive',
  'romantic', 'nostalgic', 'hopeful', 'dark', 'uplifting',
];

/**
 * One-hot encode a mood
 */
export function encodeMood(mood: MoodCategory | undefined): number[] {
  const encoding = new Array(MOOD_CATEGORIES.length).fill(0);

  if (mood) {
    const index = MOOD_CATEGORIES.indexOf(mood);
    if (index >= 0) encoding[index] = 1;
  }

  return encoding;
}

/**
 * Map valence/arousal to mood category
 */
export function valenceArousalToMood(valence: number, arousal: number): MoodCategory {
  // Russell's circumplex model quadrants
  if (valence >= 0.5 && arousal >= 0.5) {
    return arousal > 0.7 ? 'euphoric' : 'happy';
  } else if (valence >= 0.5 && arousal < 0.5) {
    return arousal < 0.3 ? 'peaceful' : 'calm';
  } else if (valence < 0.5 && arousal >= 0.5) {
    return arousal > 0.7 ? 'aggressive' : 'tense';
  } else {
    return valence < 0.3 ? 'sad' : 'melancholic';
  }
}

// ============================================================================
// Feature Vector Construction
// ============================================================================

/**
 * Build a complete feature vector for a track
 */
export function buildFeatureVector(
  track: import('../types/track').Track,
  audioFeatures: AudioFeatures | undefined,
  context: ListenContext,
  userStats: {
    playCount: number;
    skipRatio: number;
    completionRatio: number;
    lastPlayedMs?: number;
    artistAffinity: number;
    genreAffinity: number;
  }
): FeatureVector {
  const normalizedAudio = normalizeAudioFeatures(audioFeatures);
  const hourEncoding = encodeHour(context.hourOfDay);
  const dayEncoding = encodeDay(context.dayOfWeek);

  return {
    genreEncoding: encodeGenres(track.genres || (track.genre ? [track.genre] : undefined)),
    audio: {
      ...normalizedAudio,
      duration: normalizeDuration(track.duration),
    },
    playCount: logNormalize(userStats.playCount),
    skipRatio: userStats.skipRatio,
    completionRatio: userStats.completionRatio,
    recencyScore: userStats.lastPlayedMs
      ? Math.exp(-userStats.lastPlayedMs / (7 * 24 * 60 * 60 * 1000)) // 7-day half-life
      : 0,
    artistAffinity: (userStats.artistAffinity + 1) / 2, // -1 to 1 -> 0 to 1
    genreAffinity: (userStats.genreAffinity + 1) / 2,
    hourSin: hourEncoding.sin,
    hourCos: hourEncoding.cos,
    daySin: dayEncoding.sin,
    dayCos: dayEncoding.cos,
    isWeekend: context.isWeekend ? 1 : 0,
  };
}

/**
 * Flatten feature vector to array for ML input
 */
export function flattenFeatureVector(features: FeatureVector): number[] {
  return [
    ...features.genreEncoding,
    features.audio.bpm,
    features.audio.energy,
    features.audio.valence,
    features.audio.danceability,
    features.audio.acousticness,
    features.audio.instrumentalness,
    features.audio.loudness,
    features.audio.duration,
    features.audio.speechiness,
    features.audio.liveness,
    features.audio.key,
    features.audio.mode,
    features.playCount,
    features.skipRatio,
    features.completionRatio,
    features.recencyScore,
    features.artistAffinity,
    features.genreAffinity,
    features.hourSin,
    features.hourCos,
    features.daySin,
    features.dayCos,
    features.isWeekend,
  ];
}

/**
 * Get the dimension of a flattened feature vector
 */
export function getFeatureVectorDimension(): number {
  return PRIMARY_GENRES.length + 12 + 6 + 5; // genres + audio + user + context
}
