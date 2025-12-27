/**
 * Feature provider types for algorithm plugins
 */

import type { AudioFeatures, EmotionFeatures, LyricsFeatures, Track, TrackMatch } from './track';

// ============================================================================
// Unified Feature Provider
// ============================================================================

export interface FeatureProvider {
  /** Unique provider ID (e.g., "audiio-algo:essentia") */
  id: string;

  /** Priority (higher = tried first) */
  priority: number;

  /** Provider capabilities */
  capabilities: ProviderCapabilities;

  // === Audio Features ===

  /** Get audio features for a track */
  getAudioFeatures?(trackId: string): Promise<AudioFeatures | null>;

  /** Analyze audio from URL */
  analyzeAudioUrl?(url: string): Promise<AudioFeatures | null>;

  /** Analyze audio from file path */
  analyzeAudioFile?(filePath: string): Promise<AudioFeatures | null>;

  /** Analyze audio from buffer */
  analyzeAudioBuffer?(buffer: ArrayBuffer, sampleRate: number): Promise<AudioFeatures | null>;

  // === Emotion/Mood Features ===

  /** Get emotion features for a track */
  getEmotionFeatures?(trackId: string): Promise<EmotionFeatures | null>;

  /** Analyze emotion from audio buffer */
  analyzeEmotionFromAudio?(buffer: ArrayBuffer, sampleRate: number): Promise<EmotionFeatures | null>;

  // === Lyrics Features ===

  /** Get lyrics features for a track */
  getLyricsFeatures?(trackId: string): Promise<LyricsFeatures | null>;

  /** Analyze lyrics text directly */
  analyzeLyrics?(lyrics: string): Promise<LyricsFeatures | null>;

  // === Similarity ===

  /** Find similar tracks */
  getSimilarTracks?(trackId: string, limit: number): Promise<string[]>;

  /** Get similarity score between two tracks (0-1) */
  getTrackSimilarity?(trackId1: string, trackId2: string): Promise<number>;

  /** Get artist similarity (0-1) */
  getArtistSimilarity?(artistId1: string, artistId2: string): Promise<number>;

  // === Fingerprinting ===

  /** Generate fingerprint from audio file */
  generateFingerprint?(filePath: string): Promise<string | null>;

  /** Generate fingerprint from audio buffer */
  generateFingerprintFromBuffer?(buffer: ArrayBuffer, sampleRate: number): Promise<string | null>;

  /** Identify track from fingerprint */
  identifyByFingerprint?(fingerprint: string): Promise<TrackMatch[]>;

  /** Find duplicates in library */
  findDuplicates?(trackIds: string[]): Promise<DuplicateResult[]>;

  // === Embeddings ===

  /** Get embedding vector for a track */
  getEmbedding?(trackId: string): Promise<number[] | null>;

  /** Generate embedding from audio */
  generateEmbedding?(buffer: ArrayBuffer, sampleRate: number): Promise<number[] | null>;

  /** Search by embedding similarity */
  searchByEmbedding?(embedding: number[], limit: number): Promise<string[]>;
}

export interface ProviderCapabilities {
  audioAnalysis: boolean;
  emotionDetection: boolean;
  lyricsAnalysis: boolean;
  similarity: boolean;
  fingerprinting: boolean;
  embeddings: boolean;

  /** Can analyze from URL (streaming) */
  canAnalyzeUrl: boolean;

  /** Can analyze from file path (local) */
  canAnalyzeFile: boolean;

  /** Can analyze from buffer (in-memory) */
  canAnalyzeBuffer: boolean;

  /** Supports real-time analysis */
  supportsRealtime: boolean;

  /** Requires WASM */
  requiresWasm: boolean;
}

export interface DuplicateResult {
  /** Original track ID */
  originalId: string;

  /** Duplicate track ID */
  duplicateId: string;

  /** Similarity confidence (0-1) */
  confidence: number;

  /** Type of duplicate */
  type: 'exact' | 'similar' | 'remaster' | 'live' | 'acoustic';
}

// ============================================================================
// Provider Registry
// ============================================================================

export interface ProviderRegistry {
  /** Register a feature provider */
  register(provider: FeatureProvider): void;

  /** Unregister a provider */
  unregister(providerId: string): void;

  /** Get provider by ID */
  get(providerId: string): FeatureProvider | undefined;

  /** Get all providers */
  getAll(): FeatureProvider[];

  /** Get providers sorted by priority */
  getByPriority(): FeatureProvider[];

  /** Get providers with specific capability */
  getWithCapability(capability: keyof ProviderCapabilities): FeatureProvider[];
}

// ============================================================================
// Feature Aggregation
// ============================================================================

export interface FeatureAggregationConfig {
  /** Strategy for combining features from multiple providers */
  strategy: 'priority' | 'merge' | 'vote';

  /** For 'merge' strategy: how to resolve conflicts */
  conflictResolution: 'highest-priority' | 'average' | 'most-confident';

  /** Minimum confidence to include feature */
  minConfidence: number;

  /** Cache duration in ms */
  cacheDuration: number;

  /** Whether to fetch in parallel */
  parallelFetch: boolean;

  /** Timeout per provider in ms */
  providerTimeout: number;
}

export const DEFAULT_AGGREGATION_CONFIG: FeatureAggregationConfig = {
  strategy: 'priority',
  conflictResolution: 'highest-priority',
  minConfidence: 0.5,
  cacheDuration: 24 * 60 * 60 * 1000, // 24 hours
  parallelFetch: true,
  providerTimeout: 10000, // 10 seconds
};

// ============================================================================
// Provider Statistics
// ============================================================================

export interface ProviderStats {
  providerId: string;

  /** Number of successful requests */
  successCount: number;

  /** Number of failed requests */
  errorCount: number;

  /** Average response time in ms */
  avgResponseTime: number;

  /** Cache hit rate (0-1) */
  cacheHitRate: number;

  /** Last error */
  lastError?: {
    message: string;
    timestamp: number;
  };

  /** Features this provider has contributed */
  featuresProvided: {
    audio: number;
    emotion: number;
    lyrics: number;
    similarity: number;
    fingerprint: number;
    embedding: number;
  };
}
