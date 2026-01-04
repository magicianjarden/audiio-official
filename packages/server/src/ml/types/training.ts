/**
 * Training types for ML model training
 */

import type { Track, AudioFeatures, EmotionFeatures, LyricsFeatures } from './track';
import type { ListenContext } from './events';

// ============================================================================
// Training Data
// ============================================================================

export interface TrainingDataset {
  /** Positive samples (liked, completed listens) */
  positive: TrainingSample[];

  /** Negative samples (skipped, disliked) */
  negative: TrainingSample[];

  /** Partial samples (partial listens) */
  partial: TrainingSample[];

  /** Dataset metadata */
  metadata: DatasetMetadata;
}

export interface TrainingSample {
  /** Track information */
  track: Track;

  /** Feature vector (pre-extracted) */
  features: FeatureVector;

  /** Training label (0-1) */
  label: number;

  /** Sample weight (for importance weighting) */
  weight: number;

  /** Context when this sample was recorded */
  context: ListenContext;

  /** Timestamp of the event */
  timestamp: number;
}

export interface FeatureVector {
  // === Track Features ===

  /** One-hot encoded genre (variable length) */
  genreEncoding: number[];

  /** Audio features (normalized) */
  audio: NormalizedAudioFeatures;

  /** Emotion features (if available) */
  emotion?: NormalizedEmotionFeatures;

  /** Lyrics features (if available) */
  lyrics?: NormalizedLyricsFeatures;

  // === User-Track Features ===

  /** How often user has played this track (log-normalized) */
  playCount: number;

  /** User's skip ratio for this track */
  skipRatio: number;

  /** User's completion ratio for this track */
  completionRatio: number;

  /** Recency of last play (exponential decay) */
  recencyScore: number;

  /** User's affinity for this artist (normalized) */
  artistAffinity: number;

  /** User's affinity for this genre (normalized) */
  genreAffinity: number;

  // === Context Features ===

  /** Hour of day (cyclical encoding) */
  hourSin: number;
  hourCos: number;

  /** Day of week (cyclical encoding) */
  daySin: number;
  dayCos: number;

  /** Is weekend */
  isWeekend: number;
}

export interface NormalizedAudioFeatures {
  bpm: number;          // Normalized to 0-1
  energy: number;       // Already 0-1
  valence: number;      // Already 0-1
  danceability: number; // Already 0-1
  acousticness: number; // Already 0-1
  instrumentalness: number; // Already 0-1
  loudness: number;     // Normalized to 0-1
  duration: number;     // Normalized to 0-1
  speechiness: number;  // Already 0-1
  liveness: number;     // Already 0-1
  key: number;          // Normalized 0-1 (0-11)
  mode: number;         // 0 or 1
}

export interface NormalizedEmotionFeatures {
  valence: number;
  arousal: number;
  dominance: number;
}

export interface NormalizedLyricsFeatures {
  sentiment: number;    // -1 to 1 -> 0 to 1
  intensity: number;
}

export interface DatasetMetadata {
  /** Total number of samples */
  totalSamples: number;

  /** Number of unique tracks */
  uniqueTracks: number;

  /** Number of unique artists */
  uniqueArtists: number;

  /** Time range of samples */
  timeRange: {
    start: number;
    end: number;
  };

  /** Class balance */
  classBalance: {
    positive: number;
    negative: number;
    partial: number;
  };

  /** Feature statistics for normalization */
  featureStats: FeatureStats;
}

export interface FeatureStats {
  /** Min/max/mean/std for each numeric feature */
  [featureName: string]: {
    min: number;
    max: number;
    mean: number;
    std: number;
  };
}

// ============================================================================
// Training Results
// ============================================================================

export interface TrainingResult {
  /** Whether training was successful */
  success: boolean;

  /** Error message if failed */
  error?: string;

  /** Training metrics */
  metrics: TrainingMetrics;

  /** Model information */
  model: ModelInfo;

  /** Training duration in ms */
  duration: number;

  /** Timestamp of training completion */
  completedAt: number;
}

export interface TrainingMetrics {
  /** Final training loss */
  loss: number;

  /** Final training accuracy */
  accuracy: number;

  /** Validation loss */
  valLoss: number;

  /** Validation accuracy */
  valAccuracy: number;

  /** Number of epochs trained */
  epochs: number;

  /** Loss history per epoch */
  lossHistory: number[];

  /** Accuracy history per epoch */
  accuracyHistory: number[];

  /** Validation metrics history */
  valHistory?: {
    loss: number[];
    accuracy: number[];
  };

  /** Optional additional metrics */
  custom?: Record<string, number>;
}

export interface ModelInfo {
  /** Model version */
  version: number;

  /** Number of parameters */
  parameters: number;

  /** Model architecture summary */
  architecture: string;

  /** Input feature dimension */
  inputDimension: number;

  /** Output dimension */
  outputDimension: number;

  /** Checksum for integrity */
  checksum?: string;
}

// ============================================================================
// Training Status
// ============================================================================

export interface TrainingStatus {
  /** Current training state */
  state: TrainingState;

  /** Progress (0-1) if training */
  progress?: number;

  /** Current epoch if training */
  currentEpoch?: number;

  /** Total epochs if training */
  totalEpochs?: number;

  /** Current loss if training */
  currentLoss?: number;

  /** Estimated time remaining in ms */
  estimatedTimeRemaining?: number;

  /** Last training result */
  lastResult?: TrainingResult;

  /** When training is next scheduled */
  nextScheduledTraining?: number;
}

export type TrainingState =
  | 'idle'
  | 'preparing'
  | 'training'
  | 'validating'
  | 'saving'
  | 'complete'
  | 'error';

// ============================================================================
// Training Configuration
// ============================================================================

export interface TrainingConfig {
  /** Number of epochs */
  epochs: number;

  /** Batch size */
  batchSize: number;

  /** Learning rate */
  learningRate: number;

  /** Validation split (0-1) */
  validationSplit: number;

  /** Early stopping patience */
  patience?: number;

  /** Minimum samples required to train */
  minSamples: number;

  /** Maximum samples to use (for memory) */
  maxSamples?: number;

  /** Whether to shuffle data */
  shuffle: boolean;

  /** L2 regularization */
  l2Regularization?: number;

  /** Dropout rate */
  dropoutRate?: number;

  /** Whether to use class weights */
  useClassWeights: boolean;
}

export const DEFAULT_TRAINING_CONFIG: TrainingConfig = {
  epochs: 50,
  batchSize: 32,
  learningRate: 0.001,
  validationSplit: 0.2,
  patience: 10,
  minSamples: 50,
  maxSamples: 10000,
  shuffle: true,
  l2Regularization: 0.01,
  dropoutRate: 0.3,
  useClassWeights: true,
};

// ============================================================================
// Auto-Training Configuration
// ============================================================================

export interface AutoTrainingConfig {
  /** Whether auto-training is enabled */
  enabled: boolean;

  /** Minimum time between trainings (ms) */
  minInterval: number;

  /** Minimum new events before retraining */
  minNewEvents: number;

  /** Maximum time between trainings (ms) */
  maxInterval: number;

  /** Whether to train on app startup */
  trainOnStartup: boolean;

  /** Whether to train when idle */
  trainWhenIdle: boolean;

  /** Idle threshold (ms of inactivity) */
  idleThreshold: number;
}

export const DEFAULT_AUTO_TRAINING_CONFIG: AutoTrainingConfig = {
  enabled: true,
  minInterval: 24 * 60 * 60 * 1000, // 24 hours
  minNewEvents: 10,
  maxInterval: 7 * 24 * 60 * 60 * 1000, // 7 days
  trainOnStartup: false,
  trainWhenIdle: true,
  idleThreshold: 5 * 60 * 1000, // 5 minutes
};
