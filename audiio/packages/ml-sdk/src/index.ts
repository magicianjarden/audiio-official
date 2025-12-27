/**
 * @audiio/ml-sdk
 *
 * SDK for building Audiio ML algorithm plugins.
 *
 * This package provides:
 * - Type definitions for the algorithm plugin interface
 * - Base classes for building algorithms
 * - Utility functions for feature extraction, scoring, and ML operations
 * - Testing utilities for algorithm development
 *
 * @example
 * ```typescript
 * import {
 *   BaseAlgorithm,
 *   AlgorithmManifest,
 *   TrackScore,
 *   normalizeAudioFeatures,
 * } from '@audiio/ml-sdk';
 *
 * class MyAlgorithm extends BaseAlgorithm {
 *   manifest: AlgorithmManifest = {
 *     id: 'my-algorithm',
 *     name: 'My Algorithm',
 *     version: '1.0.0',
 *     // ...
 *   };
 *
 *   async scoreTrack(track, features, context): Promise<TrackScore> {
 *     // Your scoring logic
 *   }
 *
 *   async rankCandidates(candidates, context): Promise<ScoredTrack[]> {
 *     // Your ranking logic
 *   }
 * }
 * ```
 */

// Types
export * from './types';

// Base classes
export * from './base';

// Utilities
export * from './utils';

// Re-export commonly used types for convenience
export type {
  // Core types
  Track,
  ScoredTrack,
  AudioFeatures,
  EmotionFeatures,
  LyricsFeatures,
  AggregatedFeatures,
  MoodCategory,
  MusicalKey,

  // Algorithm types
  AlgorithmPlugin,
  AlgorithmManifest,
  AlgorithmCapabilities,
  AlgorithmRequirements,
  AlgorithmSettingDefinition,

  // Scoring types
  TrackScore,
  ScoreComponents,
  ScoringContext,
  ScoringWeights,
  RadioSeed,

  // Training types
  TrainingDataset,
  TrainingSample,
  TrainingResult,
  TrainingStatus,
  TrainingConfig,

  // Event types
  UserEvent,
  ListenEvent,
  SkipEvent,
  DislikeEvent,
  LikeEvent,

  // Provider types
  FeatureProvider,
  ProviderCapabilities,

  // Endpoint types
  MLCoreEndpoints,
  UserPreferences,
  TemporalPatterns,
} from './types';
