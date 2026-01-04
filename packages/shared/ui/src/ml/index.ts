/**
 * ML Module Exports
 */

export {
  // Feature extraction
  extractTrackFeatures,
  extractContextFeatures,
  extractAllFeatures,
  extractBatchFeatures,
  encodeGenres,
  normalizeValue,
  generateLabel,
  generateDislikeLabel,
  prepareTrainingData,

  // Scalers
  initializeScalers,
  getDefaultScalers,

  // Constants
  PRIMARY_GENRES,
  TRACK_FEATURE_DIM,
  CONTEXT_FEATURE_DIM,
  TOTAL_FEATURE_DIM,

  // Types
  type FeatureScalers,
  type TrackFeatures,
  type ExtractedFeatures,
  type PrimaryGenre
} from './feature-extractor';

export {
  // Trainer
  MLTrainer,
  getTrainer,
  resetTrainer,

  // Utilities
  canTrain,
  shouldRetrain,

  // Types
  type TrainingConfig,
  type TrainingMetrics,
  type TrainingProgress
} from './ml-trainer';

export {
  // Advanced scoring
  SCORING_CONFIG,
  registerFeatureProvider,
  unregisterFeatureProvider,
  getFeatureProviders,
  getAudioFeatures,
  getEnhancedScore,
  batchEnhancedScore,
  calculateExplorationBonus,
  calculateSerendipityScore,
  calculateDiversityScore,
  calculateFlowScore,
  calculateTemporalScore,

  // Types
  type AudioFeatures,
  type PluginFeatureProvider,
  type ScoringContext,
  type EnhancedScore
} from './advanced-scoring';

export {
  // Plugin audio provider utilities
  createPluginFeatureProvider,
  registerPluginAudioProvider,
  unregisterPluginAudioProvider,
  initializeAudioProviders,
  cleanupAudioProviders,
  normalizeBpm,
  keyNumberToString,
  estimateEnergyFromFeatures
} from './plugin-audio-provider';

export {
  // ML Integration (bridges new architecture with existing code)
  registerAlgorithmPlugin,
  unregisterAlgorithmPlugin,
  getRegisteredPlugins,
  getActivePlugin,
  setActivePlugin,
  getUnifiedScore,
  initializeMLIntegration,
  cleanupMLIntegration,
  trainWithCurrentData,

  // Types
  type ExternalAlgorithmPlugin
} from './ml-integration';
