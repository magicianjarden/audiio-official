/**
 * Core track types used throughout the ML system
 */

import type {
  AudioFeatures as CoreAudioFeatures,
  EmotionCategory,
  MusicalKey
} from '@audiio/core';

// Re-export for backwards compatibility
export type { EmotionCategory, MusicalKey };
/** @deprecated Use EmotionCategory instead */
export type MoodCategory = EmotionCategory;

export interface Track {
  id: string;
  title: string;
  artist: string;
  artistId?: string;
  album?: string;
  albumId?: string;
  duration: number; // seconds
  genre?: string;
  genres?: string[];
  releaseYear?: number;
  explicit?: boolean;
  artworkUrl?: string;

  // Source information
  source?: 'local' | 'streaming' | 'unknown';
  sourceId?: string;

  // Optional pre-computed features (if available from metadata)
  precomputedFeatures?: Partial<AudioFeatures>;
}

// ScoredTrack uses inline type to avoid circular dependency with scoring.ts
export interface ScoredTrack extends Track {
  score: {
    trackId: string;
    finalScore: number;
    confidence: number;
    components: Record<string, number | undefined>;
    explanation: string[];
  };
}

export interface TrackMatch {
  track: Track;
  confidence: number;
  matchType: 'fingerprint' | 'metadata' | 'embedding';
}

// Note: DuplicateGroup was removed as unused dead code
// Use DuplicateResult from providers.ts for duplicate detection

/**
 * Extended audio features for ML processing.
 * Extends the core AudioFeatures with ML-specific fields.
 */
export interface AudioFeaturesML extends CoreAudioFeatures {
  // Extended rhythm
  beatsPerBar?: number;
  beatStrength?: number;
  tuning?: number; // Hz, typically 440

  // Dynamics
  dynamicRange?: number;

  // Timbre (0-1 normalized)
  brightness?: number; // spectral centroid normalized
  warmth?: number;
  roughness?: number;

  // Emotion (Russell's circumplex)
  arousal?: number; // 0-1, intensity

  // Spectral analysis
  spectralCentroid?: number;
  spectralRolloff?: number;
  spectralFlux?: number;
  zeroCrossingRate?: number;

  // ML model input
  mfcc?: number[];

  // Confidence
  analysisConfidence?: number;
}

/** @deprecated Use AudioFeaturesML instead */
export type AudioFeatures = AudioFeaturesML;

export interface EmotionFeatures {
  // Russell's circumplex model
  valence: number; // 0-1, pleasure dimension
  arousal: number; // 0-1, activation dimension
  dominance?: number; // 0-1, control dimension

  // Categorical mood (uses EmotionCategory from @audiio/core)
  moodCategory: EmotionCategory;
  moodConfidence: number;

  // Secondary moods
  secondaryMoods?: EmotionCategory[];
}

export interface LyricsFeatures {
  // Sentiment
  sentiment: number; // -1 to 1
  sentimentConfidence: number;

  // Themes (top detected themes)
  themes: LyricsTheme[];

  // Emotional intensity
  emotionalIntensity: number; // 0-1

  // Language
  language: string;

  // Optional: raw lyrics for further processing
  lyrics?: string;
  syncedLyrics?: Array<{ time: number; text: string }>;
}

export interface LyricsTheme {
  theme: string;
  confidence: number;
}

export interface GenreFeatures {
  /** Primary predicted genre */
  primaryGenre: string;
  /** Confidence of primary prediction (0-1) */
  primaryConfidence: number;
  /** All genre predictions with confidence scores */
  predictions: GenrePrediction[];
  /** Whether this was ML-predicted or from metadata */
  source: 'metadata' | 'ml-predicted';
}

export interface GenrePrediction {
  genre: string;
  confidence: number;
}

export interface AggregatedFeatures {
  trackId: string;

  // Core audio features
  audio?: AudioFeatures;

  // Emotion/mood features
  emotion?: EmotionFeatures;

  // Lyrics-derived features
  lyrics?: LyricsFeatures;

  // Genre classification
  genre?: GenreFeatures;

  // Embedding vector for similarity search
  embedding?: number[];

  // Fingerprint for identification
  fingerprint?: string;

  // Provider information
  providers: FeatureProviderInfo[];

  // Timestamp
  lastUpdated: number;
}

export interface FeatureProviderInfo {
  providerId: string;
  providedFeatures: string[];
  confidence: number;
}
