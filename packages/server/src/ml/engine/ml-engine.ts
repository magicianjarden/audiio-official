/**
 * ML Engine - Main orchestrator for the ML system
 *
 * The engine now includes a built-in core algorithm (HybridScorer + NeuralScorer)
 * that runs by default. Plugin algorithms can extend or replace the core.
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
  AggregatedFeatures,
  RadioSeed,
} from '../types';

import { AlgorithmRegistry } from './algorithm-registry';
import { FeatureAggregator, ExtendedFeatureProvider } from './feature-aggregator';
import { EventRecorder } from '../learning/event-recorder';
import { PreferenceStore } from '../learning/preference-store';
import { TrainingScheduler } from '../learning/training-scheduler';
import { SmartQueue } from '../queue/smart-queue';
import { createEndpoints } from '../endpoints';

// Core algorithm components
import { HybridScorer } from '../algorithm/hybrid-scorer';
import { NeuralScorer } from '../algorithm/neural-scorer';
import { Trainer } from '../algorithm/trainer';
import { RadioGenerator } from '../algorithm/radio-generator';

// Core providers (browser-safe)
import { EmotionProvider } from '../providers/emotion-provider';
import { EmbeddingProvider } from '../providers/embedding-provider';
import { LyricsProvider } from '../providers/lyrics-provider';

// EssentiaProvider is loaded dynamically (requires Node.js)
type EssentiaProviderType = import('../providers/essentia-provider').EssentiaProvider;

export interface MLEngineConfig {
  /** Default algorithm ID (if not set, uses core algorithm) */
  defaultAlgorithmId?: string;
  /** Auto-initialize on first use */
  autoInitialize?: boolean;
  /** Enable automatic model training */
  enableAutoTraining?: boolean;
  /** Use core algorithm (default: true) */
  useCoreAlgorithm?: boolean;
  /** Core algorithm settings */
  coreSettings?: Record<string, unknown>;
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

  // Core algorithm components
  private neuralScorer: NeuralScorer | null = null;
  private hybridScorer: HybridScorer | null = null;
  private trainer: Trainer | null = null;
  private radioGenerator: RadioGenerator | null = null;

  // Core providers
  private essentiaProvider: EssentiaProviderType | null = null;
  private emotionProvider: EmotionProvider | null = null;
  private embeddingProvider: EmbeddingProvider | null = null;
  private lyricsProvider: LyricsProvider | null = null;

  constructor(config: MLEngineConfig = {}) {
    this.config = {
      autoInitialize: true,
      enableAutoTraining: true,
      useCoreAlgorithm: true,
      coreSettings: {},
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

    // Initialize core algorithm if enabled
    if (this.config.useCoreAlgorithm) {
      await this.initializeCoreAlgorithm();
    }

    // Initialize all registered plugin algorithms
    if (this.config.autoInitialize) {
      await this.registry.initializeAll();
    }

    // Set default algorithm if specified (plugin takes precedence if set)
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
        // Train core algorithm
        if (this.trainer && this.config.useCoreAlgorithm) {
          const dataset = await this.endpoints.training.getFullDataset();
          await this.trainer.train(dataset);
        }

        // Also train active plugin if it supports training
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
   * Initialize core algorithm components
   */
  private async initializeCoreAlgorithm(): Promise<void> {
    console.log('[MLEngine] Initializing core algorithm...');

    try {
      // Initialize neural scorer
      this.neuralScorer = new NeuralScorer();
      await this.neuralScorer.initialize(this.endpoints);

      // Initialize hybrid scorer
      this.hybridScorer = new HybridScorer(
        this.endpoints,
        this.neuralScorer,
        this.config.coreSettings || {}
      );

      // Initialize trainer
      this.trainer = new Trainer(this.endpoints, this.neuralScorer);

      // Initialize radio generator
      this.radioGenerator = new RadioGenerator(this.endpoints, this.hybridScorer);

      console.log('[MLEngine] Core algorithm initialized');
    } catch (error) {
      console.error('[MLEngine] Failed to initialize core algorithm:', error);
    }

    // Initialize core providers (with lower priority so plugins can override)
    await this.initializeCoreProviders();
  }

  /**
   * Initialize core feature providers
   */
  private async initializeCoreProviders(): Promise<void> {
    console.log('[MLEngine] Initializing core providers...');

    try {
      // Essentia provider (priority 30 - core) - only in Node.js environment
      if (typeof window === 'undefined') {
        try {
          // Dynamic import to avoid bundling in browser
          const { EssentiaProvider } = await import('../providers/essentia-provider');
          this.essentiaProvider = new EssentiaProvider();
          await this.essentiaProvider.initialize();

          // Register as a feature provider wrapper
          this.featureAggregator.register({
            id: 'core-essentia',
            priority: 30,
            capabilities: {
              audioAnalysis: true,
              emotionDetection: false,
              lyricsAnalysis: false,
              embeddings: false,
              similarity: false,
              fingerprinting: false,
              canAnalyzeUrl: false,
              canAnalyzeFile: true,
              canAnalyzeBuffer: true,
              supportsRealtime: false,
              requiresWasm: true,
            },
            getAudioFeatures: async (trackId: string) => this.essentiaProvider?.getAudioFeatures(trackId) ?? null,
          }, 'supplement');

          console.log('[MLEngine] EssentiaProvider initialized (Node.js environment)');
        } catch (error) {
          console.warn('[MLEngine] EssentiaProvider not available:', error);
        }
      } else {
        console.log('[MLEngine] Skipping EssentiaProvider (browser environment)');
      }

      // Emotion provider (priority 25 - core)
      this.emotionProvider = new EmotionProvider();
      await this.emotionProvider.initialize(this.endpoints);

      this.featureAggregator.register({
        id: 'core-emotion',
        priority: 25,
        capabilities: {
          audioAnalysis: false,
          emotionDetection: true,
          lyricsAnalysis: false,
          embeddings: false,
          similarity: false,
          fingerprinting: false,
          canAnalyzeUrl: false,
          canAnalyzeFile: true,
          canAnalyzeBuffer: true,
          supportsRealtime: false,
          requiresWasm: false,
        },
        getEmotionFeatures: async (trackId: string) => this.emotionProvider?.getEmotionFeatures(trackId) ?? null,
      }, 'supplement');

      // Embedding provider (priority 20 - core)
      this.embeddingProvider = new EmbeddingProvider();
      await this.embeddingProvider.initialize(this.endpoints);

      this.featureAggregator.register({
        id: 'core-embedding',
        priority: 20,
        capabilities: {
          audioAnalysis: false,
          emotionDetection: false,
          lyricsAnalysis: false,
          embeddings: true,
          similarity: true,
          fingerprinting: false,
          canAnalyzeUrl: false,
          canAnalyzeFile: false,
          canAnalyzeBuffer: false,
          supportsRealtime: false,
          requiresWasm: false,
        },
        getEmbedding: async (trackId: string) => this.embeddingProvider?.getEmbedding(trackId) ?? null,
      }, 'supplement');

      // Lyrics provider (priority 15 - core)
      this.lyricsProvider = new LyricsProvider();
      await this.lyricsProvider.initialize(this.endpoints);

      this.featureAggregator.register({
        id: 'core-lyrics',
        priority: 15,
        capabilities: {
          audioAnalysis: false,
          emotionDetection: false,
          lyricsAnalysis: true,
          embeddings: false,
          similarity: false,
          fingerprinting: false,
          canAnalyzeUrl: false,
          canAnalyzeFile: false,
          canAnalyzeBuffer: false,
          supportsRealtime: false,
          requiresWasm: false,
        },
        getLyricsFeatures: async (trackId: string) => this.lyricsProvider?.getLyricsFeatures(trackId) ?? null,
      }, 'supplement');

      console.log('[MLEngine] Core providers initialized');
    } catch (error) {
      console.error('[MLEngine] Failed to initialize core providers:', error);
    }
  }

  /**
   * Dispose the ML engine
   */
  async dispose(): Promise<void> {
    console.log('[MLEngine] Disposing...');

    this.trainingScheduler.stop();
    await this.registry.disposeAll();

    // Dispose core components
    if (this.neuralScorer) {
      await this.neuralScorer.dispose();
      this.neuralScorer = null;
    }
    if (this.essentiaProvider) {
      await this.essentiaProvider.dispose();
      this.essentiaProvider = null;
    }
    if (this.emotionProvider) {
      await this.emotionProvider.dispose();
      this.emotionProvider = null;
    }
    if (this.embeddingProvider) {
      await this.embeddingProvider.dispose();
      this.embeddingProvider = null;
    }
    if (this.lyricsProvider) {
      await this.lyricsProvider.dispose();
      this.lyricsProvider = null;
    }

    this.hybridScorer = null;
    this.trainer = null;
    this.radioGenerator = null;

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
   * Uses core algorithm if no plugin is active
   */
  async scoreTrack(track: Track, context: ScoringContext): Promise<TrackScore> {
    const algorithm = this.registry.getActive();

    // Try plugin algorithm first
    if (algorithm) {
      const features = await this.featureAggregator.get(track.id);
      return algorithm.scoreTrack(track, features, context);
    }

    // Fall back to core algorithm
    if (this.hybridScorer) {
      const features = await this.featureAggregator.get(track.id);
      return this.hybridScorer.score(track, features, context);
    }

    // If nothing is available, return default score
    return {
      trackId: track.id,
      finalScore: 50,
      confidence: 0,
      components: {},
      explanation: ['No algorithm available'],
    };
  }

  /**
   * Score multiple tracks
   * Uses core algorithm if no plugin is active
   */
  async scoreBatch(tracks: Track[], context: ScoringContext): Promise<TrackScore[]> {
    const algorithm = this.registry.getActive();

    // Try plugin algorithm first
    if (algorithm) {
      if (algorithm.scoreBatch) {
        return algorithm.scoreBatch(tracks, context);
      }
      // Fallback to individual scoring
      const promises = tracks.map(track => this.scoreTrack(track, context));
      return Promise.all(promises);
    }

    // Fall back to core algorithm
    if (this.hybridScorer) {
      return this.hybridScorer.scoreBatch(tracks, context);
    }

    // If nothing is available, return default scores
    return tracks.map(track => ({
      trackId: track.id,
      finalScore: 50,
      confidence: 0,
      components: {},
      explanation: ['No algorithm available'],
    }));
  }

  /**
   * Rank candidates for queue
   * Uses core algorithm if no plugin is active
   */
  async rankCandidates(candidates: Track[], context: ScoringContext): Promise<ScoredTrack[]> {
    const algorithm = this.registry.getActive();

    // Try plugin algorithm first
    if (algorithm) {
      return algorithm.rankCandidates(candidates, context);
    }

    // Fall back to core algorithm
    if (this.hybridScorer) {
      const scores = await this.hybridScorer.scoreBatch(candidates, context);
      return candidates
        .map((track, i) => {
          const trackScore = scores[i];
          return {
            ...track,
            score: {
              trackId: trackScore.trackId,
              finalScore: trackScore.finalScore,
              confidence: trackScore.confidence,
              components: { ...trackScore.components } as Record<string, number | undefined>,
              explanation: trackScore.explanation,
            },
          };
        })
        .sort((a, b) => (b.score?.finalScore ?? 0) - (a.score?.finalScore ?? 0));
    }

    // If nothing is available, return with default scores
    return candidates.map(track => ({
      ...track,
      score: {
        trackId: track.id,
        finalScore: 50,
        confidence: 0,
        components: {},
        explanation: ['No algorithm available'],
      },
    }));
  }

  /**
   * Check if core algorithm is available
   */
  hasCoreAlgorithm(): boolean {
    return this.hybridScorer !== null && this.neuralScorer !== null;
  }

  /**
   * Get core algorithm training status
   */
  getCoreTrainingStatus(): TrainingStatus | undefined {
    if (!this.trainer) return undefined;
    const status = this.trainer.getStatus();
    return {
      state: status.state,
      progress: status.progress,
      currentEpoch: status.currentEpoch,
      totalEpochs: status.totalEpochs,
      currentLoss: status.currentLoss,
    };
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
    seed: RadioSeed,
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
