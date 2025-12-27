/**
 * Base Algorithm - Abstract base class for all algorithm plugins
 *
 * Provides common functionality and helpers that all algorithms can use.
 */

import type {
  AlgorithmPlugin,
  AlgorithmManifest,
  AlgorithmState,
  AlgorithmHealth,
} from '../types/algorithm';
import type { Track, ScoredTrack, AggregatedFeatures } from '../types/track';
import type { TrackScore, ScoringContext, ScoreExplanation } from '../types/scoring';
import type { TrainingDataset, TrainingResult, TrainingStatus, TrainingState } from '../types/training';
import type { UserEvent } from '../types/events';
import type { FeatureProvider } from '../types/providers';
import type { MLCoreEndpoints, UserPreferences, TemporalPatterns } from '../types/endpoints';

export abstract class BaseAlgorithm implements AlgorithmPlugin {
  abstract manifest: AlgorithmManifest;

  protected endpoints!: MLCoreEndpoints;
  protected settings: Record<string, unknown> = {};
  protected state: AlgorithmState;
  protected cache: Map<string, { value: unknown; expires: number }> = new Map();

  private _initialized = false;
  private _trainingState: TrainingState = 'idle';
  private _trainingProgress = 0;

  constructor() {
    this.state = {
      id: '',
      initialized: false,
      active: false,
      settings: {},
      training: {},
      health: {
        status: 'healthy',
        lastCheck: Date.now(),
      },
    };
  }

  // ============================================================================
  // Lifecycle
  // ============================================================================

  async initialize(endpoints: MLCoreEndpoints): Promise<void> {
    if (this._initialized) {
      console.warn(`[${this.manifest.id}] Already initialized`);
      return;
    }

    this.endpoints = endpoints;
    this.state.id = this.manifest.id;

    // Load saved settings
    const savedSettings = await endpoints.storage.get<Record<string, unknown>>('settings');
    if (savedSettings) {
      this.settings = { ...this.getDefaultSettings(), ...savedSettings };
    } else {
      this.settings = this.getDefaultSettings();
    }
    this.state.settings = this.settings;

    // Load training state
    const trainingInfo = await endpoints.training.getLastTrainingInfo();
    if (trainingInfo) {
      this.state.training = {
        lastTrained: trainingInfo.timestamp,
        eventsAtLastTrain: trainingInfo.samplesUsed,
        modelVersion: trainingInfo.modelVersion,
      };
    }

    // Call implementation-specific initialization
    await this.onInitialize();

    this._initialized = true;
    this.state.initialized = true;
    this.state.health = {
      status: 'healthy',
      lastCheck: Date.now(),
    };

    console.log(`[${this.manifest.id}] Initialized successfully`);
  }

  async dispose(): Promise<void> {
    if (!this._initialized) return;

    // Save settings before disposing
    await this.endpoints.storage.set('settings', this.settings);

    // Clear cache
    this.cache.clear();

    // Call implementation-specific cleanup
    await this.onDispose();

    this._initialized = false;
    this.state.initialized = false;

    console.log(`[${this.manifest.id}] Disposed`);
  }

  /** Override to add initialization logic */
  protected abstract onInitialize(): Promise<void>;

  /** Override to add cleanup logic */
  protected abstract onDispose(): Promise<void>;

  // ============================================================================
  // Abstract Methods (must be implemented)
  // ============================================================================

  abstract scoreTrack(
    track: Track,
    features: AggregatedFeatures,
    context: ScoringContext
  ): Promise<TrackScore>;

  abstract rankCandidates(
    candidates: Track[],
    context: ScoringContext
  ): Promise<ScoredTrack[]>;

  // ============================================================================
  // Optional Methods (can be overridden)
  // ============================================================================

  async scoreBatch(
    tracks: Track[],
    context: ScoringContext
  ): Promise<TrackScore[]> {
    // Default implementation: score tracks in parallel
    const featurePromises = tracks.map(t => this.endpoints.features.get(t.id));
    const features = await Promise.all(featurePromises);

    const scorePromises = tracks.map((track, i) =>
      this.scoreTrack(track, features[i], context)
    );

    return Promise.all(scorePromises);
  }

  async train?(data: TrainingDataset): Promise<TrainingResult> {
    throw new Error('Training not implemented');
  }

  getTrainingStatus?(): TrainingStatus {
    return {
      state: this._trainingState,
      progress: this._trainingProgress,
      lastResult: undefined,
    };
  }

  async needsTraining?(): Promise<boolean> {
    if (!this.manifest.capabilities.training) return false;

    const newEvents = await this.endpoints.training.getNewEventCount();
    const lastInfo = await this.endpoints.training.getLastTrainingInfo();

    if (!lastInfo) return newEvents >= (this.manifest.requirements.minListenEvents || 50);

    const daysSinceTraining = (Date.now() - lastInfo.timestamp) / (24 * 60 * 60 * 1000);
    return newEvents >= 10 || daysSinceTraining >= 7;
  }

  async onUserEvent?(event: UserEvent): Promise<void> {
    // Default: no-op. Override to handle events in real-time.
  }

  featureProviders?: FeatureProvider[];

  updateSettings(newSettings: Record<string, unknown>): void {
    this.settings = { ...this.settings, ...newSettings };
    this.state.settings = this.settings;

    // Persist settings
    this.endpoints.storage.set('settings', this.settings).catch(err => {
      console.error(`[${this.manifest.id}] Failed to save settings:`, err);
    });
  }

  getSettings(): Record<string, unknown> {
    return { ...this.settings };
  }

  async explainScore?(trackId: string): Promise<ScoreExplanation> {
    throw new Error('Score explanation not implemented');
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  protected getDefaultSettings(): Record<string, unknown> {
    const defaults: Record<string, unknown> = {};
    for (const setting of this.manifest.settings) {
      defaults[setting.key] = setting.default;
    }
    return defaults;
  }

  protected getSetting<T>(key: string, defaultValue: T): T {
    const value = this.settings[key];
    return value !== undefined ? (value as T) : defaultValue;
  }

  protected async getUserPreferences(): Promise<UserPreferences> {
    return this.endpoints.user.getPreferences();
  }

  protected async getTemporalPatterns(): Promise<TemporalPatterns> {
    return this.endpoints.user.getTemporalPatterns();
  }

  protected async getTrackFeatures(trackId: string): Promise<AggregatedFeatures> {
    const cacheKey = `features:${trackId}`;
    const cached = this.getFromCache<AggregatedFeatures>(cacheKey);
    if (cached) return cached;

    const features = await this.endpoints.features.get(trackId);
    this.setInCache(cacheKey, features, 60 * 60 * 1000); // 1 hour
    return features;
  }

  protected async getArtistAffinity(artistId: string): Promise<number> {
    return this.endpoints.user.getArtistAffinity(artistId);
  }

  protected async getGenreAffinity(genre: string): Promise<number> {
    return this.endpoints.user.getGenreAffinity(genre);
  }

  protected async wasRecentlyPlayed(trackId: string, withinMs = 3600000): Promise<boolean> {
    return this.endpoints.user.wasRecentlyPlayed(trackId, withinMs);
  }

  // ============================================================================
  // Cache Helpers
  // ============================================================================

  protected getFromCache<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expires) {
      this.cache.delete(key);
      return null;
    }

    return entry.value as T;
  }

  protected setInCache<T>(key: string, value: T, ttlMs: number): void {
    this.cache.set(key, {
      value,
      expires: Date.now() + ttlMs,
    });
  }

  protected clearCache(): void {
    this.cache.clear();
  }

  protected invalidateCache(pattern: string): void {
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
      }
    }
  }

  // ============================================================================
  // Training Helpers
  // ============================================================================

  protected setTrainingState(state: TrainingState, progress = 0): void {
    this._trainingState = state;
    this._trainingProgress = progress;
  }

  protected async markTrainingComplete(modelVersion: number): Promise<void> {
    this._trainingState = 'complete';
    this._trainingProgress = 1;
    this.state.training.lastTrained = Date.now();
    this.state.training.modelVersion = modelVersion;

    await this.endpoints.training.markTrainingComplete(modelVersion);
  }

  // ============================================================================
  // Scoring Helpers
  // ============================================================================

  protected createScore(
    trackId: string,
    finalScore: number,
    components: Partial<import('../types/scoring').ScoreComponents>,
    explanation: string[],
    confidence = 0.8
  ): TrackScore {
    return {
      trackId,
      finalScore: Math.max(0, Math.min(100, finalScore)),
      confidence,
      components: components as import('../types/scoring').ScoreComponents,
      explanation,
    };
  }

  protected combineScores(
    scores: Array<{ score: number; weight: number }>,
    penalties: Array<{ score: number; weight: number }> = []
  ): number {
    let total = 0;
    let weightSum = 0;

    for (const { score, weight } of scores) {
      total += score * weight;
      weightSum += weight;
    }

    const baseScore = weightSum > 0 ? total / weightSum : 50;

    // Apply penalties
    let penaltyTotal = 0;
    for (const { score, weight } of penalties) {
      penaltyTotal += score * weight;
    }

    return Math.max(0, Math.min(100, baseScore - penaltyTotal));
  }

  // ============================================================================
  // Health Monitoring
  // ============================================================================

  protected updateHealth(status: 'healthy' | 'degraded' | 'error', message?: string): void {
    this.state.health = {
      status,
      message,
      lastCheck: Date.now(),
    };
  }

  protected getHealth(): AlgorithmHealth {
    return { ...this.state.health };
  }

  // ============================================================================
  // Logging
  // ============================================================================

  protected log(message: string, ...args: unknown[]): void {
    console.log(`[${this.manifest.id}] ${message}`, ...args);
  }

  protected warn(message: string, ...args: unknown[]): void {
    console.warn(`[${this.manifest.id}] ${message}`, ...args);
  }

  protected error(message: string, ...args: unknown[]): void {
    console.error(`[${this.manifest.id}] ${message}`, ...args);
  }
}
