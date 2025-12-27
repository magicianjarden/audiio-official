/**
 * ML Engine - Main orchestrator for the ML system
 */

import type {
  AlgorithmPlugin,
  AlgorithmState,
  Track,
  ScoredTrack,
  TrackScore,
  ScoringContext,
  UserEvent,
  TrainingResult,
  TrainingStatus,
  MLCoreEndpoints,
  FeatureProvider,
} from '@audiio/ml-sdk';

import { AlgorithmRegistry } from './algorithm-registry';
import { FeatureAggregator } from './feature-aggregator';
import { EventRecorder } from '../learning/event-recorder';
import { PreferenceStore } from '../learning/preference-store';
import { TrainingScheduler } from '../learning/training-scheduler';
import { SmartQueue } from '../queue/smart-queue';
import { createEndpoints } from '../endpoints';

export interface MLEngineConfig {
  defaultAlgorithmId?: string;
  autoInitialize?: boolean;
  enableAutoTraining?: boolean;
}

export class MLEngine {
  private registry: AlgorithmRegistry;
  private featureAggregator: FeatureAggregator;
  private eventRecorder: EventRecorder;
  private preferenceStore: PreferenceStore;
  private trainingScheduler: TrainingScheduler;
  private smartQueue: SmartQueue;
  private endpoints: MLCoreEndpoints;
  private config: MLEngineConfig;
  private initialized = false;

  constructor(config: MLEngineConfig = {}) {
    this.config = {
      autoInitialize: true,
      enableAutoTraining: true,
      ...config,
    };

    this.registry = new AlgorithmRegistry();
    this.featureAggregator = new FeatureAggregator();
    this.eventRecorder = new EventRecorder();
    this.preferenceStore = new PreferenceStore();
    this.trainingScheduler = new TrainingScheduler();
    this.smartQueue = new SmartQueue();

    // Create endpoints with references to internal components
    this.endpoints = createEndpoints({
      featureAggregator: this.featureAggregator,
      eventRecorder: this.eventRecorder,
      preferenceStore: this.preferenceStore,
      smartQueue: this.smartQueue,
      registry: this.registry,
    });

    this.registry.setEndpoints(this.endpoints);
  }

  // ============================================================================
  // Lifecycle
  // ============================================================================

  /**
   * Initialize the ML engine
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      console.warn('[MLEngine] Already initialized');
      return;
    }

    console.log('[MLEngine] Initializing...');

    // Load persisted state
    await this.eventRecorder.load();
    await this.preferenceStore.load();

    // Initialize all registered algorithms
    if (this.config.autoInitialize) {
      await this.registry.initializeAll();
    }

    // Set default algorithm if specified
    if (this.config.defaultAlgorithmId && this.registry.has(this.config.defaultAlgorithmId)) {
      this.registry.setActive(this.config.defaultAlgorithmId);
    } else if (this.registry.size > 0) {
      // Auto-select first algorithm
      const firstId = this.registry.getAllIds()[0];
      this.registry.setActive(firstId);
    }

    // Start training scheduler if enabled
    if (this.config.enableAutoTraining) {
      this.trainingScheduler.start(async () => {
        const active = this.registry.getActive();
        if (active?.train) {
          const dataset = await this.endpoints.training.getFullDataset();
          await active.train(dataset);
        }
      });
    }

    this.initialized = true;
    console.log('[MLEngine] Initialized successfully');
  }

  /**
   * Dispose the ML engine
   */
  async dispose(): Promise<void> {
    console.log('[MLEngine] Disposing...');

    this.trainingScheduler.stop();
    await this.registry.disposeAll();

    // Persist state
    await this.eventRecorder.save();
    await this.preferenceStore.save();

    this.initialized = false;
    console.log('[MLEngine] Disposed');
  }

  // ============================================================================
  // Algorithm Management
  // ============================================================================

  /**
   * Register an algorithm plugin
   */
  async registerAlgorithm(algorithm: AlgorithmPlugin): Promise<void> {
    await this.registry.register(algorithm);

    // Register any feature providers from the algorithm
    if (algorithm.featureProviders) {
      for (const provider of algorithm.featureProviders) {
        this.featureAggregator.register(provider);
      }
    }

    // If this is the only algorithm, make it active
    if (this.registry.size === 1) {
      this.registry.setActive(algorithm.manifest.id);
    }
  }

  /**
   * Unregister an algorithm
   */
  async unregisterAlgorithm(algorithmId: string): Promise<void> {
    const algorithm = this.registry.get(algorithmId);

    // Unregister feature providers
    if (algorithm?.featureProviders) {
      for (const provider of algorithm.featureProviders) {
        this.featureAggregator.unregister(provider.id);
      }
    }

    await this.registry.unregister(algorithmId);
  }

  /**
   * Set the active algorithm
   */
  setActiveAlgorithm(algorithmId: string): void {
    this.registry.setActive(algorithmId);
  }

  /**
   * Get the active algorithm
   */
  getActiveAlgorithm(): AlgorithmPlugin | null {
    return this.registry.getActive();
  }

  /**
   * Get all registered algorithms
   */
  getAlgorithms(): AlgorithmPlugin[] {
    return this.registry.getAll();
  }

  /**
   * Get algorithm states
   */
  getAlgorithmStates(): AlgorithmState[] {
    return this.registry.getAllStates();
  }

  // ============================================================================
  // Scoring
  // ============================================================================

  /**
   * Score a single track
   */
  async scoreTrack(track: Track, context: ScoringContext): Promise<TrackScore> {
    const algorithm = this.registry.getActive();
    if (!algorithm) {
      throw new Error('No active algorithm');
    }

    const features = await this.featureAggregator.get(track.id);
    return algorithm.scoreTrack(track, features, context);
  }

  /**
   * Score multiple tracks
   */
  async scoreBatch(tracks: Track[], context: ScoringContext): Promise<TrackScore[]> {
    const algorithm = this.registry.getActive();
    if (!algorithm) {
      throw new Error('No active algorithm');
    }

    if (algorithm.scoreBatch) {
      return algorithm.scoreBatch(tracks, context);
    }

    // Fallback to individual scoring
    const promises = tracks.map(track => this.scoreTrack(track, context));
    return Promise.all(promises);
  }

  /**
   * Rank candidates for queue
   */
  async rankCandidates(candidates: Track[], context: ScoringContext): Promise<ScoredTrack[]> {
    const algorithm = this.registry.getActive();
    if (!algorithm) {
      throw new Error('No active algorithm');
    }

    return algorithm.rankCandidates(candidates, context);
  }

  // ============================================================================
  // Queue
  // ============================================================================

  /**
   * Get next tracks for queue
   */
  async getNextTracks(count: number, context: ScoringContext): Promise<Track[]> {
    const algorithm = this.registry.getActive();
    if (!algorithm) {
      return [];
    }

    const candidates = await this.smartQueue.getCandidates({
      count: count * 3, // Get more candidates for better selection
      sources: ['library', 'liked', 'similar', 'discovery'],
      scoringContext: context,
    });

    const ranked = await algorithm.rankCandidates(candidates, context);
    return ranked.slice(0, count).map(st => ({ ...st, score: undefined } as Track));
  }

  /**
   * Get the smart queue manager
   */
  getSmartQueue(): SmartQueue {
    return this.smartQueue;
  }

  // ============================================================================
  // Events & Learning
  // ============================================================================

  /**
   * Record a user event
   */
  async recordEvent(event: UserEvent): Promise<void> {
    // Record the event
    await this.eventRecorder.record(event);

    // Update preferences
    await this.preferenceStore.updateFromEvent(event);

    // Notify all algorithms
    const algorithms = this.registry.getAll();
    for (const algorithm of algorithms) {
      if (algorithm.onUserEvent) {
        try {
          await algorithm.onUserEvent(event);
        } catch (error) {
          console.error(`[MLEngine] Algorithm ${algorithm.manifest.id} failed to handle event:`, error);
        }
      }
    }

    // Check if training needed
    if (this.config.enableAutoTraining) {
      this.trainingScheduler.checkAndSchedule(
        await this.eventRecorder.getEventCount()
      );
    }
  }

  // ============================================================================
  // Training
  // ============================================================================

  /**
   * Train a specific algorithm
   */
  async trainAlgorithm(algorithmId: string): Promise<TrainingResult> {
    const algorithm = this.registry.get(algorithmId);
    if (!algorithm) {
      throw new Error(`Algorithm ${algorithmId} not found`);
    }

    if (!algorithm.train) {
      throw new Error(`Algorithm ${algorithmId} does not support training`);
    }

    const dataset = await this.endpoints.training.getFullDataset();
    return algorithm.train(dataset);
  }

  /**
   * Train the active algorithm
   */
  async train(): Promise<TrainingResult> {
    const active = this.registry.getActive();
    if (!active) {
      throw new Error('No active algorithm');
    }

    return this.trainAlgorithm(active.manifest.id);
  }

  /**
   * Get training status for an algorithm
   */
  getTrainingStatus(algorithmId: string): TrainingStatus | undefined {
    const algorithm = this.registry.get(algorithmId);
    return algorithm?.getTrainingStatus?.();
  }

  // ============================================================================
  // Feature Providers
  // ============================================================================

  /**
   * Register a feature provider
   */
  registerFeatureProvider(provider: FeatureProvider): void {
    this.featureAggregator.register(provider);
  }

  /**
   * Unregister a feature provider
   */
  unregisterFeatureProvider(providerId: string): void {
    this.featureAggregator.unregister(providerId);
  }

  /**
   * Get all feature providers
   */
  getFeatureProviders(): FeatureProvider[] {
    return this.featureAggregator.getProviders();
  }

  // ============================================================================
  // Endpoints Access
  // ============================================================================

  /**
   * Get the endpoints for direct access
   */
  getEndpoints(): MLCoreEndpoints {
    return this.endpoints;
  }

  // ============================================================================
  // Radio
  // ============================================================================

  /**
   * Generate radio playlist from seed
   */
  async generateRadio(
    seed: import('@audiio/ml-sdk').RadioSeed,
    count: number,
    context: ScoringContext
  ): Promise<Track[]> {
    const algorithm = this.registry.getActive();
    if (!algorithm) {
      return [];
    }

    if (algorithm.generateRadio) {
      return algorithm.generateRadio(seed, count, context);
    }

    // Fallback: use ranking with seed-based candidates
    const candidates = await this.smartQueue.getCandidates({
      count: count * 3,
      sources: ['similar', 'radio'],
      radioSeed: seed,
      scoringContext: context,
    });

    const ranked = await algorithm.rankCandidates(candidates, context);
    return ranked.slice(0, count).map(st => ({ ...st, score: undefined } as Track));
  }

  // ============================================================================
  // Similarity
  // ============================================================================

  /**
   * Find similar tracks
   */
  async findSimilar(trackId: string, limit: number): Promise<ScoredTrack[]> {
    const algorithm = this.registry.getActive();
    if (!algorithm) {
      return [];
    }

    if (algorithm.findSimilar) {
      return algorithm.findSimilar(trackId, limit);
    }

    // Fallback: use embedding similarity if available
    const embedding = await this.featureAggregator.getEmbedding(trackId);
    if (!embedding) {
      return [];
    }

    // TODO: Implement embedding search in feature aggregator
    return [];
  }
}

// Singleton instance
let engineInstance: MLEngine | null = null;

/**
 * Get or create the ML engine instance
 */
export function getMLEngine(config?: MLEngineConfig): MLEngine {
  if (!engineInstance) {
    engineInstance = new MLEngine(config);
  }
  return engineInstance;
}

/**
 * Reset the ML engine (for testing)
 */
export function resetMLEngine(): void {
  if (engineInstance) {
    engineInstance.dispose();
    engineInstance = null;
  }
}
