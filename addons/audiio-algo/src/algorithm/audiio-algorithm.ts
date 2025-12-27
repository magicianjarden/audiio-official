/**
 * Audiio Algorithm - Official recommendation algorithm
 */

import {
  BaseAlgorithm,
  type AlgorithmManifest,
  type Track,
  type ScoredTrack,
  type AggregatedFeatures,
  type TrackScore,
  type ScoringContext,
  type TrainingDataset,
  type TrainingResult,
  type TrainingStatus,
  type UserEvent,
  type FeatureProvider,
  type RadioSeed,
  type ScoreExplanation,
} from '@audiio/ml-sdk';

import { AUDIIO_ALGO_MANIFEST } from '../manifest';
import { HybridScorer } from '../scoring/hybrid-scorer';
import { NeuralScorer } from '../scoring/neural-scorer';
import { Trainer } from '../training/trainer';
import { RadioGenerator } from './radio-generator';

// Providers (lazy loaded)
import type { EssentiaProvider } from '../providers/essentia/essentia-provider';
import type { EmotionProvider } from '../providers/emotion/emotion-provider';
import type { LyricsProvider } from '../providers/lyrics/lyrics-provider';
import type { FingerprintProvider } from '../providers/fingerprint/fingerprint-provider';
import type { EmbeddingProvider } from '../providers/embeddings/embedding-provider';

export class AudiioAlgorithm extends BaseAlgorithm {
  manifest: AlgorithmManifest = AUDIIO_ALGO_MANIFEST;

  // Core components
  private hybridScorer!: HybridScorer;
  private neuralScorer!: NeuralScorer;
  private trainer!: Trainer;
  private radioGenerator!: RadioGenerator;

  // Providers (lazy loaded)
  private essentiaProvider?: EssentiaProvider;
  private emotionProvider?: EmotionProvider;
  private lyricsProvider?: LyricsProvider;
  private fingerprintProvider?: FingerprintProvider;
  private embeddingProvider?: EmbeddingProvider;

  // Feature providers exposed to core
  featureProviders: FeatureProvider[] = [];

  // ============================================================================
  // Lifecycle
  // ============================================================================

  protected async onInitialize(): Promise<void> {
    this.log('Initializing Audiio Algorithm...');

    // Initialize neural scorer
    this.neuralScorer = new NeuralScorer();
    await this.neuralScorer.initialize(this.endpoints);

    // Initialize hybrid scorer
    this.hybridScorer = new HybridScorer(this.endpoints, this.neuralScorer, this.settings);

    // Initialize trainer
    this.trainer = new Trainer(this.endpoints, this.neuralScorer);

    // Initialize radio generator
    this.radioGenerator = new RadioGenerator(this.endpoints, this.hybridScorer);

    // Initialize providers based on settings
    await this.initializeProviders();

    // Register feature providers with core
    this.registerProviders();

    // Check if training needed
    if (this.getSetting('autoTrain', true)) {
      const needsTraining = await this.needsTraining?.() ?? false;
      if (needsTraining) {
        this.log('Training needed, scheduling...');
        // Train async, don't block initialization
        this.trainAsync();
      }
    }

    this.log('Initialized successfully');
  }

  protected async onDispose(): Promise<void> {
    this.log('Disposing...');

    // Unregister providers
    for (const provider of this.featureProviders) {
      this.endpoints.features.unregister(provider.id);
    }

    // Dispose providers
    await this.essentiaProvider?.dispose?.();
    await this.emotionProvider?.dispose?.();
    await this.lyricsProvider?.dispose?.();
    await this.fingerprintProvider?.dispose?.();
    await this.embeddingProvider?.dispose?.();

    // Dispose components
    await this.neuralScorer.dispose();

    this.log('Disposed');
  }

  // ============================================================================
  // Provider Initialization
  // ============================================================================

  private async initializeProviders(): Promise<void> {
    // Essentia - Audio analysis
    if (this.getSetting('enableAudioAnalysis', true)) {
      try {
        const { EssentiaProvider } = await import('../providers/essentia/essentia-provider');
        this.essentiaProvider = new EssentiaProvider(
          this.getSetting('audioAnalysisQuality', 'balanced')
        );
        await this.essentiaProvider.initialize();
        this.log('Essentia provider initialized');
      } catch (error) {
        this.warn('Failed to initialize Essentia provider:', error);
      }
    }

    // Emotion detection
    if (this.getSetting('enableEmotionDetection', true)) {
      try {
        const { EmotionProvider } = await import('../providers/emotion/emotion-provider');
        this.emotionProvider = new EmotionProvider();
        await this.emotionProvider.initialize(this.endpoints);
        this.log('Emotion provider initialized');
      } catch (error) {
        this.warn('Failed to initialize Emotion provider:', error);
      }
    }

    // Lyrics analysis
    if (this.getSetting('enableLyricsAnalysis', true)) {
      try {
        const { LyricsProvider } = await import('../providers/lyrics/lyrics-provider');
        this.lyricsProvider = new LyricsProvider();
        await this.lyricsProvider.initialize(this.endpoints);
        this.log('Lyrics provider initialized');
      } catch (error) {
        this.warn('Failed to initialize Lyrics provider:', error);
      }
    }

    // Embeddings
    if (this.getSetting('enableEmbeddings', true)) {
      try {
        const { EmbeddingProvider } = await import('../providers/embeddings/embedding-provider');
        this.embeddingProvider = new EmbeddingProvider();
        await this.embeddingProvider.initialize(this.endpoints);
        this.log('Embedding provider initialized');
      } catch (error) {
        this.warn('Failed to initialize Embedding provider:', error);
      }
    }

    // Fingerprinting (lazy - only load when needed)
    // Will be loaded on first fingerprinting request
  }

  private registerProviders(): void {
    // Essentia audio features
    if (this.essentiaProvider) {
      this.featureProviders.push({
        id: 'audiio-algo:essentia',
        priority: 100,
        capabilities: {
          audioAnalysis: true,
          emotionDetection: false,
          lyricsAnalysis: false,
          similarity: false,
          fingerprinting: false,
          embeddings: false,
          canAnalyzeUrl: false,
          canAnalyzeFile: true,
          canAnalyzeBuffer: true,
          supportsRealtime: false,
          requiresWasm: true,
        },
        getAudioFeatures: async (trackId) => {
          return this.essentiaProvider?.getAudioFeatures(trackId) ?? null;
        },
        analyzeAudioBuffer: async (buffer, sampleRate) => {
          return this.essentiaProvider?.analyzeBuffer(buffer, sampleRate) ?? null;
        },
      });
    }

    // Emotion features
    if (this.emotionProvider) {
      this.featureProviders.push({
        id: 'audiio-algo:emotion',
        priority: 100,
        capabilities: {
          audioAnalysis: false,
          emotionDetection: true,
          lyricsAnalysis: false,
          similarity: false,
          fingerprinting: false,
          embeddings: false,
          canAnalyzeUrl: false,
          canAnalyzeFile: false,
          canAnalyzeBuffer: true,
          supportsRealtime: false,
          requiresWasm: false,
        },
        getEmotionFeatures: async (trackId) => {
          return this.emotionProvider?.getEmotionFeatures(trackId) ?? null;
        },
      });
    }

    // Lyrics features
    if (this.lyricsProvider) {
      this.featureProviders.push({
        id: 'audiio-algo:lyrics',
        priority: 100,
        capabilities: {
          audioAnalysis: false,
          emotionDetection: false,
          lyricsAnalysis: true,
          similarity: false,
          fingerprinting: false,
          embeddings: false,
          canAnalyzeUrl: false,
          canAnalyzeFile: false,
          canAnalyzeBuffer: false,
          supportsRealtime: false,
          requiresWasm: false,
        },
        getLyricsFeatures: async (trackId) => {
          return this.lyricsProvider?.getLyricsFeatures(trackId) ?? null;
        },
        analyzeLyrics: async (lyrics) => {
          return this.lyricsProvider?.analyzeLyrics(lyrics) ?? null;
        },
      });
    }

    // Embeddings
    if (this.embeddingProvider) {
      this.featureProviders.push({
        id: 'audiio-algo:embeddings',
        priority: 100,
        capabilities: {
          audioAnalysis: false,
          emotionDetection: false,
          lyricsAnalysis: false,
          similarity: true,
          fingerprinting: false,
          embeddings: true,
          canAnalyzeUrl: false,
          canAnalyzeFile: false,
          canAnalyzeBuffer: false,
          supportsRealtime: false,
          requiresWasm: false,
        },
        getEmbedding: async (trackId) => {
          return this.embeddingProvider?.getEmbedding(trackId) ?? null;
        },
        getSimilarTracks: async (trackId, limit) => {
          return this.embeddingProvider?.findSimilar(trackId, limit) ?? [];
        },
      });
    }

    // Register all providers with core
    for (const provider of this.featureProviders) {
      this.endpoints.features.register(provider);
    }
  }

  // ============================================================================
  // Scoring
  // ============================================================================

  async scoreTrack(
    track: Track,
    features: AggregatedFeatures,
    context: ScoringContext
  ): Promise<TrackScore> {
    return this.hybridScorer.score(track, features, context);
  }

  async scoreBatch(
    tracks: Track[],
    context: ScoringContext
  ): Promise<TrackScore[]> {
    return this.hybridScorer.scoreBatch(tracks, context);
  }

  async rankCandidates(
    candidates: Track[],
    context: ScoringContext
  ): Promise<ScoredTrack[]> {
    const scores = await this.scoreBatch(candidates, context);

    return scores
      .map((score, index) => ({
        ...candidates[index],
        score: {
          trackId: score.trackId,
          finalScore: score.finalScore,
          confidence: score.confidence,
          components: score.components as unknown as Record<string, number | undefined>,
          explanation: score.explanation,
        },
      }))
      .sort((a, b) => b.score.finalScore - a.score.finalScore);
  }

  // ============================================================================
  // Training
  // ============================================================================

  async train(data: TrainingDataset): Promise<TrainingResult> {
    return this.trainer.train(data);
  }

  getTrainingStatus(): TrainingStatus {
    return this.trainer.getStatus();
  }

  async needsTraining(): Promise<boolean> {
    const newEvents = await this.endpoints.training.getNewEventCount();
    const lastInfo = await this.endpoints.training.getLastTrainingInfo();

    if (!lastInfo) {
      return newEvents >= 50;
    }

    const daysSinceTraining = (Date.now() - lastInfo.timestamp) / (24 * 60 * 60 * 1000);
    return newEvents >= 10 || daysSinceTraining >= 7;
  }

  private async trainAsync(): Promise<void> {
    try {
      const dataset = await this.endpoints.training.getFullDataset();
      await this.train(dataset);
    } catch (error) {
      this.error('Async training failed:', error);
    }
  }

  // ============================================================================
  // Radio
  // ============================================================================

  async generateRadio(
    seed: RadioSeed,
    count: number,
    context: ScoringContext
  ): Promise<Track[]> {
    return this.radioGenerator.generate(seed, count, context);
  }

  // ============================================================================
  // Similarity
  // ============================================================================

  async findSimilar(trackId: string, limit: number): Promise<ScoredTrack[]> {
    if (!this.embeddingProvider) {
      return [];
    }

    const similarIds = await this.embeddingProvider.findSimilar(trackId, limit);
    const tracks: ScoredTrack[] = [];

    for (let i = 0; i < similarIds.length; i++) {
      const track = await this.endpoints.library.getTrack(similarIds[i]);
      if (track) {
        tracks.push({
          ...track,
          score: {
            trackId: track.id,
            finalScore: 100 - i * 5, // Decreasing score by position
            confidence: 0.8,
            components: {},
            explanation: ['Similar to selected track'],
          },
        });
      }
    }

    return tracks;
  }

  // ============================================================================
  // Events
  // ============================================================================

  async onUserEvent(event: UserEvent): Promise<void> {
    // Update scorer's real-time state
    this.hybridScorer.handleEvent(event);

    // Clear relevant caches
    if ('track' in event) {
      this.invalidateCache(event.track.id);
    }
  }

  // ============================================================================
  // Fingerprinting (On Demand)
  // ============================================================================

  private async ensureFingerprintProvider(): Promise<FingerprintProvider | null> {
    if (this.fingerprintProvider) {
      return this.fingerprintProvider;
    }

    if (!this.getSetting('enableFingerprinting', true)) {
      return null;
    }

    try {
      const { FingerprintProvider } = await import('../providers/fingerprint/fingerprint-provider');
      this.fingerprintProvider = new FingerprintProvider();
      await this.fingerprintProvider.initialize(this.endpoints);
      this.log('Fingerprint provider initialized on demand');
      return this.fingerprintProvider;
    } catch (error) {
      this.warn('Failed to initialize Fingerprint provider:', error);
      return null;
    }
  }

  async indexLibrary(tracks: Track[]): Promise<void> {
    const provider = await this.ensureFingerprintProvider();
    if (!provider) {
      throw new Error('Fingerprinting not available');
    }
    await provider.indexTracks(tracks);
  }

  async findDuplicates(): Promise<import('@audiio/ml-sdk').DuplicateResult[]> {
    const provider = await this.ensureFingerprintProvider();
    if (!provider) {
      return [];
    }
    return provider.findDuplicates();
  }

  async identifyTrack(audioPath: string): Promise<import('@audiio/ml-sdk').TrackMatch[]> {
    const provider = await this.ensureFingerprintProvider();
    if (!provider) {
      return [];
    }
    return provider.identify(audioPath);
  }

  // ============================================================================
  // Explanation
  // ============================================================================

  async explainScore(trackId: string): Promise<ScoreExplanation> {
    return this.hybridScorer.explain(trackId);
  }
}
