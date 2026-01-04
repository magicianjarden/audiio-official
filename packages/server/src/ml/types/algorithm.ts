/**
 * Algorithm plugin interface - the contract for all ML algorithms
 */

import type { Track, ScoredTrack, AggregatedFeatures } from './track';
import type { TrackScore, ScoringContext, ScoreExplanation, RadioSeed } from './scoring';
import type { TrainingDataset, TrainingResult, TrainingStatus } from './training';
import type { UserEvent } from './events';
import type { FeatureProvider } from './providers';
import type { MLCoreEndpoints } from './endpoints';

// ============================================================================
// Algorithm Manifest
// ============================================================================

export interface AlgorithmManifest {
  /** Unique identifier (e.g., "audiio-algo", "community-vibes") */
  id: string;

  /** Human-readable name */
  name: string;

  /** Semantic version */
  version: string;

  /** Author or organization */
  author: string;

  /** Description of the algorithm */
  description: string;

  /** Algorithm capabilities */
  capabilities: AlgorithmCapabilities;

  /** Resource requirements */
  requirements: AlgorithmRequirements;

  /** Configurable settings */
  settings: AlgorithmSettingDefinition[];

  /** Optional icon URL */
  icon?: string;

  /** Optional documentation URL */
  docsUrl?: string;

  /** Optional repository URL */
  repoUrl?: string;
}

export interface AlgorithmCapabilities {
  // === Core Capabilities ===

  /** Can score individual tracks */
  scoring: boolean;

  /** Can efficiently score batches */
  batchScoring: boolean;

  /** Can rank candidates for queue */
  ranking: boolean;

  /** Has trainable ML model */
  training: boolean;

  /** Can generate radio from seed */
  radioGeneration: boolean;

  /** Can find similar tracks */
  similaritySearch: boolean;

  /** Can detect track mood/emotion */
  moodDetection: boolean;

  // === Feature Providers ===

  /** Provides audio feature analysis */
  providesAudioFeatures: boolean;

  /** Provides emotion/mood analysis */
  providesEmotionFeatures: boolean;

  /** Provides lyrics analysis */
  providesLyricsAnalysis: boolean;

  /** Provides audio fingerprinting */
  providesFingerprinting: boolean;

  /** Provides embedding vectors */
  providesEmbeddings: boolean;
}

export interface AlgorithmRequirements {
  // === Data Dependencies ===

  /** Needs access to listen history */
  needsListenHistory: boolean;

  /** Needs access to disliked tracks */
  needsDislikedTracks: boolean;

  /** Needs user preference data */
  needsUserPreferences: boolean;

  /** Needs temporal pattern data */
  needsTemporalPatterns: boolean;

  /** Needs audio features from other providers */
  needsAudioFeatures: boolean;

  /** Needs lyrics data */
  needsLyrics: boolean;

  // === Resource Requirements ===

  /** Estimated model size (e.g., "50MB") */
  estimatedModelSize: string;

  /** Estimated memory usage (e.g., "200MB") */
  estimatedMemoryUsage: string;

  /** Whether GPU acceleration is beneficial */
  requiresGPU: boolean;

  /** Whether WebAssembly is required */
  requiresWASM: boolean;

  // === Minimum Data Requirements ===

  /** Minimum listen events before algorithm works well */
  minListenEvents?: number;

  /** Minimum tracks in library for full functionality */
  minLibrarySize?: number;
}

export interface AlgorithmSettingDefinition {
  /** Setting key */
  key: string;

  /** Display label */
  label: string;

  /** Description */
  description: string;

  /** Setting type */
  type: 'boolean' | 'select' | 'number' | 'range' | 'string';

  /** Default value */
  default: boolean | string | number;

  /** Options for select type */
  options?: Array<{ value: string; label: string }>;

  /** Range for number/range type */
  min?: number;
  max?: number;
  step?: number;

  /** Whether setting requires restart */
  requiresRestart?: boolean;

  /** Category for grouping settings */
  category?: string;
}

// ============================================================================
// Algorithm Plugin Interface
// ============================================================================

export interface AlgorithmPlugin {
  /** Algorithm manifest */
  manifest: AlgorithmManifest;

  // === Lifecycle ===

  /** Initialize the algorithm with core endpoints */
  initialize(endpoints: MLCoreEndpoints): Promise<void>;

  /** Clean up resources */
  dispose(): Promise<void>;

  // === Scoring (Required) ===

  /** Score a single track */
  scoreTrack(
    track: Track,
    features: AggregatedFeatures,
    context: ScoringContext
  ): Promise<TrackScore>;

  /** Score multiple tracks efficiently */
  scoreBatch?(
    tracks: Track[],
    context: ScoringContext
  ): Promise<TrackScore[]>;

  // === Ranking (Required) ===

  /** Rank candidates for queue insertion */
  rankCandidates(
    candidates: Track[],
    context: ScoringContext
  ): Promise<ScoredTrack[]>;

  // === Training (Optional) ===

  /** Train/retrain the model */
  train?(data: TrainingDataset): Promise<TrainingResult>;

  /** Get current training status */
  getTrainingStatus?(): TrainingStatus;

  /** Check if training is needed */
  needsTraining?(): Promise<boolean>;

  // === Radio Generation (Optional) ===

  /** Generate radio playlist from seed */
  generateRadio?(
    seed: RadioSeed,
    count: number,
    context: ScoringContext
  ): Promise<Track[]>;

  // === Similarity (Optional) ===

  /** Find similar tracks */
  findSimilar?(
    trackId: string,
    limit: number
  ): Promise<ScoredTrack[]>;

  /** Get similarity between two tracks */
  getSimilarity?(
    trackId1: string,
    trackId2: string
  ): Promise<number>;

  // === Events (Optional) ===

  /** Handle user events for real-time updates */
  onUserEvent?(event: UserEvent): Promise<void>;

  // === Feature Providers (Optional) ===

  /** Feature providers this algorithm contributes */
  featureProviders?: FeatureProvider[];

  // === Settings ===

  /** Update algorithm settings */
  updateSettings?(settings: Record<string, unknown>): void;

  /** Get current settings */
  getSettings?(): Record<string, unknown>;

  // === Explanation ===

  /** Get detailed explanation for a score */
  explainScore?(trackId: string): Promise<ScoreExplanation>;
}

// ============================================================================
// Algorithm State
// ============================================================================

export interface AlgorithmState {
  /** Algorithm ID */
  id: string;

  /** Whether algorithm is initialized */
  initialized: boolean;

  /** Whether algorithm is currently active */
  active: boolean;

  /** Current settings */
  settings: Record<string, unknown>;

  /** Training state */
  training: {
    lastTrained?: number;
    eventsAtLastTrain?: number;
    modelVersion?: number;
  };

  /** Health status */
  health: AlgorithmHealth;
}

export interface AlgorithmHealth {
  status: 'healthy' | 'degraded' | 'error';
  message?: string;
  lastCheck: number;
  metrics?: {
    avgScoringTime?: number;
    avgTrainingTime?: number;
    errorRate?: number;
  };
}
