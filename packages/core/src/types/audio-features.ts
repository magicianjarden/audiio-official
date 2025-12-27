/**
 * Audio Features Types
 * Defines the structure for audio analysis results
 */

/**
 * Musical key representation
 */
export type MusicalKey =
  | 'C' | 'C#' | 'D' | 'D#' | 'E' | 'F'
  | 'F#' | 'G' | 'G#' | 'A' | 'A#' | 'B';

/**
 * Musical mode
 */
export type MusicalMode = 'major' | 'minor';

/**
 * Audio features extracted from a track
 * Compatible with Spotify's audio features format
 */
export interface AudioFeatures {
  /** Tempo in beats per minute (60-200 typical range) */
  bpm?: number;

  /** Confidence of BPM detection (0-1) */
  bpmConfidence?: number;

  /** Musical key (C, C#, D, etc.) */
  key?: MusicalKey;

  /** Musical mode (major or minor) */
  mode?: MusicalMode;

  /** Confidence of key detection (0-1) */
  keyConfidence?: number;

  /** Energy level (0-1) - intensity and activity */
  energy?: number;

  /** Danceability (0-1) - how suitable for dancing */
  danceability?: number;

  /** Acousticness (0-1) - likelihood of being acoustic */
  acousticness?: number;

  /** Instrumentalness (0-1) - likelihood of no vocals */
  instrumentalness?: number;

  /** Valence (0-1) - musical positiveness/happiness */
  valence?: number;

  /** Loudness in dB (typically -60 to 0) */
  loudness?: number;

  /** Speechiness (0-1) - presence of spoken words */
  speechiness?: number;

  /** Liveness (0-1) - likelihood of being live recording */
  liveness?: number;

  /** Duration in seconds */
  duration?: number;

  /** Time signature (beats per bar, typically 3-7) */
  timeSignature?: number;

  /** Analysis timestamp */
  analyzedAt?: Date;

  /** Source of the analysis */
  source?: 'local' | 'spotify' | 'lastfm' | 'plugin';
}

/**
 * Raw audio data for analysis
 */
export interface AudioData {
  /** Sample rate in Hz */
  sampleRate: number;

  /** Number of channels */
  channels: number;

  /** Audio samples (mono or interleaved) */
  samples: Float32Array;

  /** Duration in seconds */
  duration: number;
}

/**
 * Options for audio analysis
 */
export interface AnalysisOptions {
  /** Analyze BPM (default: true) */
  analyzeBpm?: boolean;

  /** Analyze key/mode (default: true) */
  analyzeKey?: boolean;

  /** Analyze energy features (default: true) */
  analyzeEnergy?: boolean;

  /** Analyze speech/vocal content (default: true) */
  analyzeVocals?: boolean;

  /** Maximum duration to analyze in seconds (default: 60) */
  maxDuration?: number;

  /** Skip to position in seconds before analyzing (default: 30) */
  skipToPosition?: number;
}

/**
 * Cache entry for audio features
 */
export interface AudioFeaturesCacheEntry {
  trackId: string;
  features: AudioFeatures;
  cachedAt: Date;
  source: string;
}

/**
 * BPM detection result with confidence
 */
export interface BpmResult {
  bpm: number;
  confidence: number;
  alternativeBpms?: number[];
}

/**
 * Key detection result with confidence
 */
export interface KeyResult {
  key: MusicalKey;
  mode: MusicalMode;
  confidence: number;
  correlation: number;
}

/**
 * Chromagram (pitch class profile) for key detection
 */
export interface Chromagram {
  /** 12 pitch class values (C, C#, D, ... B) */
  pitchClasses: Float32Array;
}
