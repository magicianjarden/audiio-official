/**
 * @audiio/ml-core
 *
 * Core ML engine and orchestrator for Audiio.
 *
 * This package provides:
 * - ML Engine for orchestrating algorithm plugins
 * - Algorithm Registry for managing plugins
 * - Feature Aggregator for combining data from providers
 * - Smart Queue for intelligent playback
 * - Event recording and preference learning
 * - Training scheduler for automatic model updates
 *
 * @example
 * ```typescript
 * import { getMLEngine } from '@audiio/ml-core';
 * import { AudiioAlgorithm } from '@audiio/algo';
 *
 * const engine = getMLEngine();
 *
 * // Register the official algorithm
 * await engine.registerAlgorithm(new AudiioAlgorithm());
 *
 * // Initialize
 * await engine.initialize();
 *
 * // Score tracks
 * const score = await engine.scoreTrack(track, context);
 *
 * // Get next tracks for queue
 * const nextTracks = await engine.getNextTracks(10, context);
 *
 * // Record user events
 * await engine.recordEvent({
 *   type: 'listen',
 *   track,
 *   duration: 180,
 *   completed: true,
 *   // ...
 * });
 * ```
 */

// Engine
export { MLEngine, getMLEngine, resetMLEngine } from './engine';
export type { MLEngineConfig } from './engine';

export { AlgorithmRegistry } from './engine/algorithm-registry';
export { FeatureAggregator } from './engine/feature-aggregator';

// Learning
export { EventRecorder } from './learning/event-recorder';
export { PreferenceStore } from './learning/preference-store';
export { TrainingScheduler } from './learning/training-scheduler';

// Storage
export {
  NodeStorage,
  BrowserStorage,
  MemoryStorage,
  createStorage,
  type StorageAdapter,
} from './storage/node-storage';

// Queue
export { SmartQueue } from './queue/smart-queue';

// Endpoints
export { createEndpoints } from './endpoints';

// Mood
export { MoodMatcher, getMoodMatcher } from './mood/mood-matcher';
export type { AudioFeatures, TrackWithFeatures } from './mood/mood-matcher';

// Embeddings - Vector-based recommendation engine
export {
  // Core components
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
  // Types
  type TrackData,
  type TrackEmbedding,
  type UserTasteProfile,
  type SimilarityResult,
  type EmbeddingConfig,
  type VectorIndexConfig,
  type TasteProfileConfig,
  type TrackInteraction,
  type CoOccurrenceConfig,
  type ContextType,
  type PlaylistOptions,
  type GeneratedPlaylist,
  type PlaylistTrack,
  type PlaylistMethod,
  // Constants
  DEFAULT_EMBEDDING_CONFIG,
  DEFAULT_INDEX_CONFIG,
  DEFAULT_TASTE_CONFIG,
  DEFAULT_COOCCURRENCE_CONFIG,
  GENRE_VECTORS,
  MOOD_VECTORS,
} from './embeddings';

// Re-export SDK types for convenience
export type {
  AlgorithmPlugin,
  AlgorithmManifest,
  Track,
  ScoredTrack,
  TrackScore,
  ScoringContext,
  UserEvent,
  MLCoreEndpoints,
  FeatureProvider,
} from '@audiio/ml-sdk';
