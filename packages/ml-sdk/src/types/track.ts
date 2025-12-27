/**
 * Core track types used throughout the ML system
 */

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

export interface DuplicateGroup {
  tracks: Track[];
  confidence: number;
  matchType: 'exact' | 'similar' | 'different-quality';
}

export interface AudioFeatures {
  // Rhythm
  bpm?: number;
  beatsPerBar?: number;
  beatStrength?: number;

  // Tonal
  key?: MusicalKey;
  mode?: 'major' | 'minor';
  tuning?: number; // Hz, typically 440

  // Energy & Dynamics
  energy?: number; // 0-1
  loudness?: number; // dB
  dynamicRange?: number;

  // Timbre
  brightness?: number; // 0-1, spectral centroid normalized
  warmth?: number; // 0-1
  roughness?: number; // 0-1

  // Mood (audio-derived)
  valence?: number; // 0-1, positivity
  arousal?: number; // 0-1, intensity

  // Composition
  danceability?: number; // 0-1
  acousticness?: number; // 0-1
  instrumentalness?: number; // 0-1
  speechiness?: number; // 0-1
  liveness?: number; // 0-1

  // Spectral
  spectralCentroid?: number;
  spectralRolloff?: number;
  spectralFlux?: number;
  zeroCrossingRate?: number;

  // MFCC (for ML models)
  mfcc?: number[];

  // Confidence
  analysisConfidence?: number;
}

export type MusicalKey =
  | 'C' | 'C#' | 'Db' | 'D' | 'D#' | 'Eb'
  | 'E' | 'F' | 'F#' | 'Gb' | 'G' | 'G#'
  | 'Ab' | 'A' | 'A#' | 'Bb' | 'B';

export interface EmotionFeatures {
  // Russell's circumplex model
  valence: number; // 0-1, pleasure dimension
  arousal: number; // 0-1, activation dimension
  dominance?: number; // 0-1, control dimension

  // Categorical mood
  moodCategory: MoodCategory;
  moodConfidence: number;

  // Secondary moods
  secondaryMoods?: MoodCategory[];
}

export type MoodCategory =
  | 'happy' | 'sad' | 'angry' | 'fearful'
  | 'calm' | 'energetic' | 'tense' | 'melancholic'
  | 'euphoric' | 'peaceful' | 'aggressive' | 'romantic'
  | 'nostalgic' | 'hopeful' | 'dark' | 'uplifting';

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
  syncedLyrics?: SyncedLyric[];
}

export interface LyricsTheme {
  theme: string;
  confidence: number;
}

export interface SyncedLyric {
  time: number; // seconds
  text: string;
}

export interface AggregatedFeatures {
  trackId: string;

  // Core audio features
  audio?: AudioFeatures;

  // Emotion/mood features
  emotion?: EmotionFeatures;

  // Lyrics-derived features
  lyrics?: LyricsFeatures;

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
