/**
 * Embedding System Types
 *
 * Types for the vector-based recommendation engine.
 */

/**
 * A track embedding - a dense vector representation of a track
 */
export interface TrackEmbedding {
  trackId: string;
  vector: Float32Array;
  version: number;
  createdAt: number;
  updatedAt: number;
  source: EmbeddingSource;
  metadata?: EmbeddingMetadata;
}

/**
 * Source of embedding generation
 */
export type EmbeddingSource =
  | 'audio-features' // Generated from audio analysis
  | 'genre-tags' // Generated from genre/tag data
  | 'collaborative' // Generated from co-occurrence patterns
  | 'hybrid' // Combination of sources
  | 'external'; // Provided by external service

/**
 * Additional metadata about an embedding
 */
export interface EmbeddingMetadata {
  audioFeaturesUsed?: string[];
  genresUsed?: string[];
  confidenceScore?: number;
  sourceProvider?: string;
}

/**
 * User taste profile - aggregated embedding representing user preferences
 */
export interface UserTasteProfile {
  userId: string;
  vector: Float32Array;
  version: number;
  updatedAt: number;
  stats: TasteProfileStats;
  contextProfiles?: ContextualProfiles;
}

/**
 * Statistics about the taste profile
 */
export interface TasteProfileStats {
  tracksContributed: number;
  likesContributed: number;
  totalListenTime: number;
  genreDistribution: Record<string, number>;
  artistDistribution: Record<string, number>;
}

/**
 * Contextual taste profiles (time-based variations)
 */
export interface ContextualProfiles {
  morning?: Float32Array; // 6-12
  afternoon?: Float32Array; // 12-18
  evening?: Float32Array; // 18-22
  night?: Float32Array; // 22-6
  weekday?: Float32Array;
  weekend?: Float32Array;
}

/**
 * Vector search result
 */
export interface SimilarityResult {
  trackId: string;
  score: number; // 0-1, higher is more similar
  distance: number; // Euclidean distance
}

/**
 * Configuration for embedding generation
 */
export interface EmbeddingConfig {
  dimensions: number; // Vector dimensions (default: 128)
  audioFeatureWeights: AudioFeatureWeights;
  genreEmbeddingDimensions: number;
  normalizeVectors: boolean;
  minConfidenceThreshold: number;
}

/**
 * Weights for audio features when generating embeddings
 */
export interface AudioFeatureWeights {
  energy: number;
  valence: number;
  danceability: number;
  acousticness: number;
  instrumentalness: number;
  speechiness: number;
  liveness: number;
  bpm: number;
  loudness: number;
  brightness: number;
  warmth: number;
}

/**
 * Default audio feature weights
 */
export const DEFAULT_AUDIO_WEIGHTS: AudioFeatureWeights = {
  energy: 1.5,
  valence: 1.5,
  danceability: 1.2,
  acousticness: 1.0,
  instrumentalness: 0.8,
  speechiness: 0.6,
  liveness: 0.4,
  bpm: 1.0,
  loudness: 0.5,
  brightness: 0.8,
  warmth: 0.8,
};

/**
 * Default embedding configuration
 */
export const DEFAULT_EMBEDDING_CONFIG: EmbeddingConfig = {
  dimensions: 128,
  audioFeatureWeights: DEFAULT_AUDIO_WEIGHTS,
  genreEmbeddingDimensions: 32,
  normalizeVectors: true,
  minConfidenceThreshold: 0.3,
};

/**
 * Genre taxonomy for embedding generation
 */
export const GENRE_VECTORS: Record<string, number[]> = {
  // Electronic family
  electronic: [1, 0.8, 0.9, 0.1, 0.9, 0.1, 0.3],
  edm: [1, 0.9, 1, 0.05, 0.95, 0.05, 0.4],
  house: [0.85, 0.8, 0.95, 0.1, 0.9, 0.1, 0.5],
  techno: [0.9, 0.6, 0.85, 0.05, 0.95, 0.05, 0.3],
  dubstep: [0.95, 0.5, 0.8, 0.05, 0.95, 0.1, 0.2],
  ambient: [0.2, 0.5, 0.1, 0.3, 0.95, 0.02, 0.1],
  trance: [0.85, 0.75, 0.8, 0.1, 0.9, 0.05, 0.3],
  dnb: [0.95, 0.7, 0.75, 0.05, 0.9, 0.1, 0.2],

  // Rock family
  rock: [0.7, 0.6, 0.5, 0.3, 0.3, 0.1, 0.4],
  'indie-rock': [0.6, 0.55, 0.45, 0.4, 0.35, 0.1, 0.3],
  'alt-rock': [0.65, 0.5, 0.45, 0.35, 0.3, 0.1, 0.35],
  metal: [0.95, 0.3, 0.4, 0.1, 0.2, 0.15, 0.3],
  punk: [0.85, 0.6, 0.55, 0.2, 0.15, 0.2, 0.5],
  'classic-rock': [0.65, 0.65, 0.5, 0.35, 0.25, 0.1, 0.4],

  // Pop family
  pop: [0.7, 0.8, 0.75, 0.3, 0.2, 0.15, 0.3],
  'synth-pop': [0.75, 0.75, 0.8, 0.15, 0.7, 0.1, 0.25],
  'indie-pop': [0.55, 0.7, 0.6, 0.45, 0.35, 0.1, 0.25],
  'dance-pop': [0.8, 0.85, 0.9, 0.2, 0.5, 0.1, 0.35],
  kpop: [0.75, 0.85, 0.85, 0.25, 0.4, 0.15, 0.3],

  // Hip-hop family
  'hip-hop': [0.75, 0.7, 0.7, 0.15, 0.3, 0.7, 0.3],
  rap: [0.8, 0.65, 0.65, 0.1, 0.25, 0.85, 0.25],
  trap: [0.85, 0.6, 0.75, 0.1, 0.6, 0.6, 0.2],
  lofi: [0.3, 0.6, 0.4, 0.4, 0.7, 0.1, 0.1],

  // R&B/Soul family
  rnb: [0.5, 0.7, 0.65, 0.35, 0.3, 0.3, 0.3],
  soul: [0.45, 0.75, 0.55, 0.5, 0.2, 0.2, 0.35],
  funk: [0.7, 0.85, 0.85, 0.35, 0.25, 0.15, 0.4],

  // Jazz family
  jazz: [0.4, 0.6, 0.35, 0.6, 0.4, 0.1, 0.45],
  'smooth-jazz': [0.3, 0.65, 0.3, 0.55, 0.45, 0.05, 0.35],
  bebop: [0.55, 0.55, 0.3, 0.65, 0.5, 0.05, 0.4],

  // Classical
  classical: [0.3, 0.5, 0.1, 0.9, 0.95, 0.02, 0.4],
  orchestral: [0.45, 0.55, 0.1, 0.85, 0.95, 0.02, 0.35],

  // Folk/Acoustic
  folk: [0.35, 0.6, 0.35, 0.85, 0.3, 0.15, 0.3],
  acoustic: [0.3, 0.6, 0.35, 0.95, 0.4, 0.1, 0.25],
  country: [0.5, 0.7, 0.55, 0.7, 0.2, 0.2, 0.35],

  // World
  latin: [0.7, 0.85, 0.85, 0.45, 0.25, 0.2, 0.4],
  reggae: [0.5, 0.8, 0.65, 0.4, 0.3, 0.15, 0.35],
  afrobeats: [0.75, 0.85, 0.85, 0.35, 0.3, 0.2, 0.35],

  // Other
  blues: [0.45, 0.55, 0.4, 0.6, 0.25, 0.15, 0.4],
  gospel: [0.55, 0.8, 0.5, 0.5, 0.2, 0.25, 0.5],
  soundtrack: [0.4, 0.5, 0.15, 0.7, 0.75, 0.05, 0.3],
};

/**
 * Mood to vector mapping for mood-based queries
 */
export const MOOD_VECTORS: Record<string, number[]> = {
  chill: [0.25, 0.6, 0.35, 0.5, 0.6, 0.1, 0.15],
  energetic: [0.95, 0.8, 0.85, 0.15, 0.5, 0.2, 0.35],
  happy: [0.7, 0.9, 0.75, 0.35, 0.35, 0.15, 0.3],
  sad: [0.25, 0.25, 0.2, 0.6, 0.45, 0.15, 0.2],
  angry: [0.9, 0.2, 0.5, 0.15, 0.2, 0.25, 0.25],
  romantic: [0.35, 0.75, 0.45, 0.55, 0.35, 0.15, 0.25],
  focus: [0.35, 0.5, 0.25, 0.5, 0.75, 0.05, 0.1],
  party: [0.9, 0.9, 0.95, 0.15, 0.5, 0.2, 0.45],
  workout: [0.95, 0.75, 0.8, 0.1, 0.6, 0.15, 0.3],
  sleep: [0.1, 0.4, 0.1, 0.6, 0.85, 0.02, 0.05],
  melancholy: [0.3, 0.35, 0.25, 0.55, 0.4, 0.1, 0.15],
  uplifting: [0.75, 0.9, 0.7, 0.35, 0.4, 0.15, 0.35],
};
