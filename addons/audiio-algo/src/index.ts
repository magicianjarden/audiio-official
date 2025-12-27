/**
 * Audiio Algo - Official ML/AI Algorithm Plugin
 *
 * This plugin provides:
 * - Audio feature extraction (Essentia.js)
 * - Emotion/mood detection
 * - Lyrics sentiment analysis
 * - Audio fingerprinting
 * - Track similarity embeddings
 * - Neural network scoring
 * - Radio/playlist generation
 *
 * Third-party developers can create alternative algorithms
 * by implementing the AlgorithmPlugin interface from @audiio/ml-sdk.
 */

// Main algorithm
export { AudiioAlgorithm, RadioGenerator } from './algorithm';
export { AUDIIO_ALGO_MANIFEST } from './manifest';

// Scoring components
export { HybridScorer, NeuralScorer } from './scoring';

// Training
export { Trainer } from './training';

// Feature providers
export {
  EssentiaProvider,
  EmotionProvider,
  LyricsProvider,
  FingerprintProvider,
  EmbeddingProvider,
} from './providers';

// UI Adapter (for integration with existing UI code)
export { createUIPluginAdapter, audiioAlgoUIPlugin } from './adapter';

// Re-export types for convenience
export type {
  AlgorithmPlugin,
  AlgorithmManifest,
  AlgorithmCapabilities,
  AlgorithmRequirements,
  AlgorithmSettingDefinition,
  MLCoreEndpoints,
  Track,
  TrackScore,
  ScoringContext,
  AudioFeatures,
  EmotionFeatures,
  LyricsFeatures,
  AggregatedFeatures,
  TrainingDataset,
  TrainingResult,
} from '@audiio/ml-sdk';

// Import for use in createAudiioAlgorithm
import { AudiioAlgorithm as _AudiioAlgorithm } from './algorithm';

/**
 * Create and return the Audiio Algorithm instance
 */
export function createAudiioAlgorithm(): _AudiioAlgorithm {
  return new _AudiioAlgorithm();
}

/**
 * Plugin metadata for auto-discovery
 */
export const plugin = {
  name: 'audiio-algo',
  version: '1.0.0',
  description: 'Official Audiio ML/AI Algorithm Plugin',
  create: createAudiioAlgorithm,
};

export default plugin;
