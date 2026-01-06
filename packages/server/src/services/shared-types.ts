/**
 * Shared Types for Audio Feature Queries
 *
 * Canonical type definitions used across audio-feature-index, search-service,
 * and ML mood systems for consistency.
 */

/**
 * Range definition for audio features (optional min/max for flexible queries)
 */
export interface FeatureRange {
  min?: number;
  max?: number;
}

/**
 * Query criteria for audio features
 * Used by both AudioFeatureIndex and SearchService
 */
export interface AudioFeatureQuery {
  energy?: FeatureRange;
  tempo?: FeatureRange;
  valence?: FeatureRange;
  danceability?: FeatureRange;
  acousticness?: FeatureRange;
  instrumentalness?: FeatureRange;
  speechiness?: FeatureRange;
  loudness?: FeatureRange;
  key?: number;
  mode?: 'major' | 'minor';
}

/**
 * Mood cluster definition for categorizing tracks
 */
export interface MoodClusterDefinition {
  name: string;
  description: string;
  criteria: AudioFeatureQuery;
}

/**
 * Canonical mood definitions - single source of truth
 * These are derived from MOOD_PROFILES in ml/types/mood.ts but simplified
 * for query-based filtering
 */
export const MOOD_CRITERIA: Record<string, AudioFeatureQuery> = {
  // High energy moods
  energetic: { energy: { min: 0.8 }, valence: { min: 0.5 } },
  upbeat: { energy: { min: 0.6 }, valence: { min: 0.5 } },
  party: { energy: { min: 0.8 }, valence: { min: 0.7 }, danceability: { min: 0.8 } },
  workout: { energy: { min: 0.7 }, tempo: { min: 120, max: 180 } },
  hype: { energy: { min: 0.8 } },
  intense: { energy: { min: 0.7 } },

  // Low energy moods
  chill: { energy: { max: 0.4 }, valence: { min: 0.3, max: 0.7 } },
  calm: { energy: { max: 0.3 } },
  relaxing: { energy: { max: 0.3 }, acousticness: { min: 0.5 } },
  sleep: { energy: { max: 0.2 }, instrumentalness: { min: 0.5 } },
  mellow: { energy: { max: 0.4 } },
  peaceful: { energy: { max: 0.3 }, valence: { min: 0.4, max: 0.7 } },

  // Emotional moods
  happy: { valence: { min: 0.6 }, energy: { min: 0.4 } },
  sad: { valence: { max: 0.4 } },
  melancholy: { valence: { min: 0.2, max: 0.5 }, energy: { min: 0.2, max: 0.5 } },
  angry: { valence: { max: 0.3 }, energy: { min: 0.7 } },
  dark: { valence: { max: 0.3 } },
  bright: { valence: { min: 0.6 } },
  aggressive: { energy: { min: 0.8 }, valence: { max: 0.4 } },

  // Style moods
  acoustic: { acousticness: { min: 0.7 } },
  electronic: { acousticness: { max: 0.2 }, energy: { min: 0.5 } },
  instrumental: { instrumentalness: { min: 0.7 } },
  vocal: { instrumentalness: { max: 0.3 } },

  // Dance moods
  danceable: { danceability: { min: 0.7 }, energy: { min: 0.5 } },
  groovy: { danceability: { min: 0.6 } },

  // Focus moods
  focus: { energy: { max: 0.5 }, speechiness: { max: 0.3 }, instrumentalness: { min: 0.3 } },
};

/**
 * Get mood clusters with descriptions for UI display
 */
export function getMoodClusters(): MoodClusterDefinition[] {
  return [
    { name: 'energetic', description: 'High energy, upbeat tracks', criteria: MOOD_CRITERIA.energetic! },
    { name: 'chill', description: 'Relaxed, low energy tracks', criteria: MOOD_CRITERIA.chill! },
    { name: 'melancholy', description: 'Sad, introspective tracks', criteria: MOOD_CRITERIA.melancholy! },
    { name: 'happy', description: 'Cheerful, positive tracks', criteria: MOOD_CRITERIA.happy! },
    { name: 'aggressive', description: 'Intense, high energy tracks', criteria: MOOD_CRITERIA.aggressive! },
    { name: 'acoustic', description: 'Acoustic, unplugged tracks', criteria: MOOD_CRITERIA.acoustic! },
    { name: 'electronic', description: 'Electronic, synthesized tracks', criteria: MOOD_CRITERIA.electronic! },
    { name: 'instrumental', description: 'Mostly instrumental tracks', criteria: MOOD_CRITERIA.instrumental! },
    { name: 'danceable', description: 'Great for dancing', criteria: MOOD_CRITERIA.danceable! },
    { name: 'focus', description: 'Good for concentration', criteria: MOOD_CRITERIA.focus! },
    { name: 'party', description: 'Get the party started', criteria: MOOD_CRITERIA.party! },
    { name: 'workout', description: 'High energy for exercise', criteria: MOOD_CRITERIA.workout! },
    { name: 'sleep', description: 'Peaceful sounds for rest', criteria: MOOD_CRITERIA.sleep! },
  ];
}

/**
 * Tempo descriptors mapped to BPM ranges
 */
export const TEMPO_RANGES: Record<string, FeatureRange> = {
  slow: { min: 0, max: 90 },
  medium: { min: 90, max: 120 },
  fast: { min: 120, max: 160 },
  uptempo: { min: 140, max: 200 },
};

/**
 * Decade mappings for year-based filtering
 */
export const DECADE_RANGES: Record<string, [number, number]> = {
  '60s': [1960, 1969],
  'sixties': [1960, 1969],
  '70s': [1970, 1979],
  'seventies': [1970, 1979],
  '80s': [1980, 1989],
  'eighties': [1980, 1989],
  '90s': [1990, 1999],
  'nineties': [1990, 1999],
  '2000s': [2000, 2009],
  '2010s': [2010, 2019],
  '2020s': [2020, 2029],
};
