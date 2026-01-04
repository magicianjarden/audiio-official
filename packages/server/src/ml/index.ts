/**
 * Audiio ML Engine
 *
 * Complete ML system for music recommendations, scoring, and learning.
 * This is the server's built-in ML engine.
 *
 * Includes:
 * - Types and interfaces
 * - Utility functions for scoring, features, caching
 * - Core algorithms (HybridScorer, NeuralScorer, RadioGenerator)
 * - ML Engine orchestrator
 * - Feature providers (Embedding, Emotion, Lyrics, etc.)
 * - Learning system (Event recording, preference store, training)
 * - Smart queue generation
 * - Embeddings and vector similarity
 */

// ============================================
// Types
// ============================================
export * from './types';

// ============================================
// Utilities
// ============================================
export * from './utils';

// ============================================
// Base Classes
// ============================================
export * from './base';

// ============================================
// Core Algorithm
// ============================================
export { HybridScorer } from './algorithm/hybrid-scorer';
export { NeuralScorer } from './algorithm/neural-scorer';
export { Trainer } from './algorithm/trainer';
export { RadioGenerator } from './algorithm/radio-generator';

// ============================================
// Engine
// ============================================
export { MLEngine, getMLEngine, resetMLEngine } from './engine';
export type { MLEngineConfig } from './engine';
export { AlgorithmRegistry } from './engine/algorithm-registry';
export { FeatureAggregator } from './engine/feature-aggregator';
export type { ExtendedFeatureProvider, ExtendedAggregationConfig } from './engine/feature-aggregator';

// ============================================
// Providers
// ============================================
export { EmotionProvider } from './providers/emotion-provider';
export { EmbeddingProvider } from './providers/embedding-provider';
export { LyricsProvider } from './providers/lyrics-provider';
export { EssentiaProvider } from './providers/essentia-provider';
export { FingerprintProvider } from './providers/fingerprint-provider';

// ============================================
// Features
// ============================================
export {
  extractTrackFeatures,
  extractContextFeatures,
  extractAllFeatures,
  extractBatchFeatures,
  initializeScalers,
  getDefaultScalers,
  getDefaultUserInteraction,
  encodeGenres,
  normalizeValue,
  calculateTrackMood,
  PRIMARY_GENRES,
  TRACK_FEATURE_DIM,
  CONTEXT_FEATURE_DIM,
  TOTAL_FEATURE_DIM,
  GENRE_ENERGY_MAP,
} from './features/feature-extractor';
export type {
  FeatureScalers,
  TrackFeatures,
  ExtractedFeatures,
  UserInteractionData,
  PrimaryGenre,
} from './features/feature-extractor';

// ============================================
// Learning
// ============================================
export { EventRecorder } from './learning/event-recorder';
export { PreferenceStore } from './learning/preference-store';
export { TrainingScheduler } from './learning/training-scheduler';

// ============================================
// Storage
// ============================================
export {
  BrowserStorage,
  MemoryStorage,
  createStorage,
  type StorageAdapter,
} from './storage/browser-storage';
export { NodeStorage } from './storage/node-storage';

// ============================================
// Queue
// ============================================
export { SmartQueue } from './queue/smart-queue';

// ============================================
// Endpoints
// ============================================
export { createEndpoints } from './endpoints';

// ============================================
// Mood
// ============================================
export { MoodMatcher, getMoodMatcher } from './mood/mood-matcher';

// ============================================
// Embeddings
// ============================================
export {
  EmbeddingEngine,
  getEmbeddingEngine,
  resetEmbeddingEngine,
  VectorIndex,
  getVectorIndex,
  resetVectorIndex,
  TasteProfileManager,
  CoOccurrenceMatrix,
  getCoOccurrenceMatrix,
  resetCoOccurrenceMatrix,
  PlaylistGenerator,
  DEFAULT_EMBEDDING_CONFIG,
  DEFAULT_INDEX_CONFIG,
  DEFAULT_TASTE_CONFIG,
  DEFAULT_COOCCURRENCE_CONFIG,
  GENRE_VECTORS,
  MOOD_VECTORS,
} from './embeddings';

export type {
  TrackData,
  TrackEmbedding,
  UserTasteProfile,
  SimilarityResult,
  EmbeddingConfig,
  VectorIndexConfig,
  TasteProfileConfig,
  TrackInteraction,
  CoOccurrenceConfig,
  ContextType,
  PlaylistOptions,
  GeneratedPlaylist,
  PlaylistTrack,
  PlaylistMethod,
} from './embeddings';
