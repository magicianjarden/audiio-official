/**
 * Feature Aggregator - Combines features from multiple providers
 *
 * Supports two modes for plugin providers:
 * - override: Provider completely replaces core features for the types it provides
 * - supplement: Provider fills in missing features without overwriting existing ones
 *
 * Core providers (priority 0-50) are always evaluated first.
 * Plugin providers (priority 51+) are then evaluated based on their mode.
 */

import type {
  AggregatedFeatures,
  AudioFeatures,
  EmotionFeatures,
  LyricsFeatures,
  GenreFeatures,
  FeatureProvider,
  ProviderCapabilities,
  FeatureProviderInfo,
  FeatureAggregationConfig,
} from '../types';
import type { StoredFeatures } from '../storage/feature-store';
import { MemoryCache, BatchLoader, LRUCache } from '../utils';
import { cosineSimilarity } from '../utils/vector-utils';

/**
 * Extended provider interface with mode support
 */
export interface ExtendedFeatureProvider extends FeatureProvider {
  /** Provider mode: override replaces core, supplement fills gaps */
  mode?: 'override' | 'supplement';
}

/**
 * Configuration for feature aggregation with mode support
 */
export interface ExtendedAggregationConfig extends FeatureAggregationConfig {
  /** Priority threshold below which providers are considered "core" */
  corePriorityThreshold: number;
}

/**
 * Interface for persistent feature storage
 */
export interface FeatureStoreInterface {
  get(trackId: string): StoredFeatures | null;
  set(trackId: string, features: Partial<StoredFeatures>): void;
  hasValidFeatures(trackId: string): boolean;
  persist(): void;
  dispose(): void;
}

export class FeatureAggregator {
  private providers: Map<string, ExtendedFeatureProvider> = new Map();
  private cache: MemoryCache<AggregatedFeatures>;
  private config: ExtendedAggregationConfig;
  private pendingRequests: Map<string, Promise<AggregatedFeatures>> = new Map();
  private featureStore: FeatureStoreInterface | null = null;
  private batchLoader: BatchLoader<string, AggregatedFeatures>;
  // LRU cache for pairwise similarity scores (size-limited, no TTL)
  private similarityCache: LRUCache<number>;

  constructor(config: Partial<ExtendedAggregationConfig> = {}) {
    this.config = {
      strategy: 'priority',
      conflictResolution: 'highest-priority',
      minConfidence: 0.5,
      cacheDuration: 24 * 60 * 60 * 1000, // 24 hours
      parallelFetch: true,
      providerTimeout: 10000,
      corePriorityThreshold: 50, // Providers with priority <= 50 are core
      ...config,
    };

    this.cache = new MemoryCache<AggregatedFeatures>(5000, this.config.cacheDuration);

    // BatchLoader collects rapid individual requests and processes them together
    // This reduces overhead when many tracks need features simultaneously
    this.batchLoader = new BatchLoader<string, AggregatedFeatures>(
      async (trackIds) => this.getBatch(trackIds),
      50, // batch up to 50 requests
      10  // wait 10ms to collect requests before processing
    );

    // LRU cache for pairwise similarity (avoids recomputing for same track pairs)
    // Size-limited to 10000 pairs, no time expiration
    this.similarityCache = new LRUCache<number>(10000);
  }

  /**
   * Set a persistent feature store for caching features across restarts
   */
  setFeatureStore(store: FeatureStoreInterface): void {
    this.featureStore = store;
    console.log('[FeatureAggregator] Persistent feature store connected');
  }

  /**
   * Register a feature provider
   * @param provider The provider to register
   * @param mode Optional mode: 'override' replaces core features, 'supplement' fills gaps
   */
  register(provider: FeatureProvider | ExtendedFeatureProvider, mode?: 'override' | 'supplement'): void {
    const extendedProvider: ExtendedFeatureProvider = {
      ...provider,
      mode: (provider as ExtendedFeatureProvider).mode ?? mode ?? 'supplement',
    };
    this.providers.set(provider.id, extendedProvider);
    const isCore = provider.priority <= this.config.corePriorityThreshold;
    console.log(`[FeatureAggregator] Registered ${isCore ? 'core' : 'plugin'} provider: ${provider.id} (priority: ${provider.priority}, mode: ${extendedProvider.mode})`);
  }

  /**
   * Unregister a provider
   */
  unregister(providerId: string): void {
    this.providers.delete(providerId);
    console.log(`[FeatureAggregator] Unregistered provider: ${providerId}`);
  }

  /**
   * Get all registered providers
   */
  getProviders(): ExtendedFeatureProvider[] {
    return Array.from(this.providers.values());
  }

  /**
   * Get providers sorted by priority (highest first)
   */
  getProvidersByPriority(): ExtendedFeatureProvider[] {
    return Array.from(this.providers.values())
      .sort((a, b) => b.priority - a.priority);
  }

  /**
   * Get core providers (priority <= threshold)
   */
  getCoreProviders(): ExtendedFeatureProvider[] {
    return Array.from(this.providers.values())
      .filter(p => p.priority <= this.config.corePriorityThreshold)
      .sort((a, b) => b.priority - a.priority);
  }

  /**
   * Get plugin providers (priority > threshold)
   */
  getPluginProviders(): ExtendedFeatureProvider[] {
    return Array.from(this.providers.values())
      .filter(p => p.priority > this.config.corePriorityThreshold)
      .sort((a, b) => b.priority - a.priority);
  }

  /**
   * Get providers with a specific capability
   */
  getProvidersWithCapability(capability: keyof ProviderCapabilities): ExtendedFeatureProvider[] {
    return this.getProvidersByPriority()
      .filter(p => p.capabilities[capability]);
  }

  /**
   * Get aggregated features for a track
   */
  async get(trackId: string): Promise<AggregatedFeatures> {
    // Check memory cache first
    const cached = this.cache.get(trackId);
    if (cached) return cached;

    // Check persistent store
    if (this.featureStore?.hasValidFeatures(trackId)) {
      const stored = this.featureStore.get(trackId);
      if (stored) {
        const features: AggregatedFeatures = {
          trackId,
          audio: stored.audio,
          emotion: stored.emotion,
          lyrics: stored.lyrics,
          genre: stored.genre,
          embedding: stored.embedding,
          providers: [{ providerId: 'persistent-store', providedFeatures: ['restored'], confidence: 1.0 }],
          lastUpdated: stored.lastUpdated,
        };
        this.cache.set(trackId, features);
        return features;
      }
    }

    // Check pending requests (deduplication)
    const pending = this.pendingRequests.get(trackId);
    if (pending) return pending;

    // Create new request
    const promise = this.fetchAndAggregate(trackId);
    this.pendingRequests.set(trackId, promise);

    try {
      const result = await promise;
      this.cache.set(trackId, result);

      // Persist to feature store
      if (this.featureStore) {
        this.featureStore.set(trackId, {
          trackId,
          audio: result.audio,
          emotion: result.emotion,
          lyrics: result.lyrics,
          genre: result.genre,
          embedding: result.embedding,
          lastUpdated: result.lastUpdated,
        });
      }

      return result;
    } finally {
      this.pendingRequests.delete(trackId);
    }
  }

  /**
   * Get features for multiple tracks
   */
  async getBatch(trackIds: string[]): Promise<Map<string, AggregatedFeatures>> {
    const results = new Map<string, AggregatedFeatures>();
    const toFetch: string[] = [];

    // Check cache first
    for (const trackId of trackIds) {
      const cached = this.cache.get(trackId);
      if (cached) {
        results.set(trackId, cached);
      } else {
        toFetch.push(trackId);
      }
    }

    // Fetch missing in parallel
    if (toFetch.length > 0) {
      const promises = toFetch.map(id =>
        this.get(id).then(features => ({ id, features }))
      );

      const fetched = await Promise.all(promises);
      for (const { id, features } of fetched) {
        results.set(id, features);
      }
    }

    return results;
  }

  /**
   * Get features with automatic batching
   * Use this when making many individual requests in a loop - the BatchLoader
   * will collect them and process in batches for better efficiency
   */
  async getWithBatching(trackId: string): Promise<AggregatedFeatures> {
    // Check cache first (avoid batching for cached items)
    const cached = this.cache.get(trackId);
    if (cached) return cached;

    // Use batch loader for cache misses
    return this.batchLoader.load(trackId);
  }

  /**
   * Get only audio features
   */
  async getAudio(trackId: string): Promise<AudioFeatures | null> {
    const features = await this.get(trackId);
    return features.audio ?? null;
  }

  /**
   * Get only emotion features
   */
  async getEmotion(trackId: string): Promise<EmotionFeatures | null> {
    const features = await this.get(trackId);
    return features.emotion ?? null;
  }

  /**
   * Get only lyrics features
   */
  async getLyrics(trackId: string): Promise<LyricsFeatures | null> {
    const features = await this.get(trackId);
    return features.lyrics ?? null;
  }

  /**
   * Get embedding vector
   */
  async getEmbedding(trackId: string): Promise<number[] | null> {
    const features = await this.get(trackId);
    return features.embedding ?? null;
  }

  /**
   * Invalidate cache
   */
  invalidateCache(trackId?: string): void {
    if (trackId) {
      this.cache.delete(trackId);
    } else {
      this.cache.clear();
    }
  }

  /**
   * Get all cached embeddings
   * Returns a Map of trackId -> embedding vector
   */
  getAllEmbeddings(): Map<string, number[]> {
    const result = new Map<string, number[]>();

    // Iterate through cached features and extract embeddings
    for (const [trackId, features] of this.cache.entries()) {
      if (features.embedding) {
        result.set(trackId, features.embedding);
      }
    }

    return result;
  }

  /**
   * Find similar tracks by embedding using cosine similarity
   * @param embedding The query embedding vector
   * @param limit Maximum number of results
   * @param excludeIds Track IDs to exclude from results
   * @returns Array of { trackId, similarity } sorted by similarity descending
   */
  findSimilarByEmbedding(
    embedding: number[],
    limit: number = 20,
    excludeIds: Set<string> = new Set()
  ): Array<{ trackId: string; similarity: number }> {
    const results: Array<{ trackId: string; similarity: number }> = [];

    // Convert query to Float32Array for efficient computation
    const queryVector = new Float32Array(embedding);

    // Iterate through all cached embeddings
    for (const [trackId, features] of this.cache.entries()) {
      if (excludeIds.has(trackId)) continue;
      if (!features.embedding) continue;

      const candidateVector = new Float32Array(features.embedding);
      const similarity = cosineSimilarity(queryVector, candidateVector);

      results.push({ trackId, similarity });
    }

    // Sort by similarity descending and take top N
    results.sort((a, b) => b.similarity - a.similarity);
    return results.slice(0, limit);
  }

  /**
   * Get similarity between two tracks using LRU cache
   * Caches results to avoid recomputing for the same track pairs
   */
  async getSimilarity(trackIdA: string, trackIdB: string): Promise<number> {
    // Create cache key (order-independent)
    const cacheKey = trackIdA < trackIdB
      ? `${trackIdA}:${trackIdB}`
      : `${trackIdB}:${trackIdA}`;

    // Check LRU cache first
    const cached = this.similarityCache.get(cacheKey);
    if (cached !== undefined) {
      return cached;
    }

    // Get embeddings
    const [featuresA, featuresB] = await Promise.all([
      this.get(trackIdA),
      this.get(trackIdB),
    ]);

    if (!featuresA.embedding || !featuresB.embedding) {
      return 0;
    }

    // Calculate similarity
    const vectorA = new Float32Array(featuresA.embedding);
    const vectorB = new Float32Array(featuresB.embedding);
    const similarity = cosineSimilarity(vectorA, vectorB);

    // Cache and return
    this.similarityCache.set(cacheKey, similarity);
    return similarity;
  }

  /**
   * Get genre features for a track
   */
  async getGenre(trackId: string): Promise<GenreFeatures | null> {
    const features = await this.get(trackId);
    return features.genre ?? null;
  }

  /**
   * Prefetch features for tracks
   */
  async prefetch(trackIds: string[]): Promise<void> {
    // Filter out already cached
    const toFetch = trackIds.filter(id => !this.cache.has(id));

    if (toFetch.length === 0) return;

    // Fetch in batches
    const batchSize = 10;
    for (let i = 0; i < toFetch.length; i += batchSize) {
      const batch = toFetch.slice(i, i + batchSize);
      await Promise.all(batch.map(id => this.get(id).catch(() => null)));
    }
  }

  /**
   * Fetch and aggregate features from all providers
   *
   * Processing order:
   * 1. Core providers (priority <= threshold) - establish baseline
   * 2. Plugin providers with mode='override' - replace features
   * 3. Plugin providers with mode='supplement' - fill gaps only
   */
  private async fetchAndAggregate(trackId: string): Promise<AggregatedFeatures> {
    const providerInfos: FeatureProviderInfo[] = [];

    let audio: AudioFeatures | undefined;
    let emotion: EmotionFeatures | undefined;
    let lyrics: LyricsFeatures | undefined;
    let genre: GenreFeatures | undefined;
    let embedding: number[] | undefined;
    let fingerprint: string | undefined;

    // Phase 1: Get core features first
    const coreProviders = this.getCoreProviders();
    const pluginProviders = this.getPluginProviders();

    // Helper to apply features based on mode
    const applyFeatures = (
      result: { provider: ExtendedFeatureProvider; features: Partial<AggregatedFeatures>; providedFeatures: string[] } | null,
      mode: 'override' | 'supplement'
    ) => {
      if (!result) return;

      const { provider, features, providedFeatures } = result;

      if (mode === 'override') {
        // Override mode: replace all features from this provider
        if (features.audio) audio = features.audio;
        if (features.emotion) emotion = features.emotion;
        if (features.lyrics) lyrics = features.lyrics;
        if (features.genre) genre = features.genre;
        if (features.embedding) embedding = features.embedding;
        if (features.fingerprint) fingerprint = features.fingerprint;
      } else {
        // Supplement mode: only fill in missing features
        if (features.audio) audio = audio ? this.mergeAudioFeatures(audio, features.audio) : features.audio;
        if (features.emotion && !emotion) emotion = features.emotion;
        if (features.lyrics && !lyrics) lyrics = features.lyrics;
        if (features.genre && !genre) genre = features.genre;
        if (features.embedding && !embedding) embedding = features.embedding;
        if (features.fingerprint && !fingerprint) fingerprint = features.fingerprint;
      }

      if (providedFeatures.length > 0) {
        providerInfos.push({
          providerId: provider.id,
          providedFeatures,
          confidence: 1.0,
        });
      }
    };

    if (this.config.parallelFetch) {
      // Fetch from core providers in parallel
      const coreResults = await Promise.all(
        coreProviders.map(p => this.fetchFromProvider(trackId, p))
      );

      // Apply core features (supplement mode - fill in gaps)
      for (const result of coreResults) {
        applyFeatures(result, 'supplement');
      }

      // Fetch from plugin providers in parallel
      const pluginResults = await Promise.all(
        pluginProviders.map(p => this.fetchFromProvider(trackId, p))
      );

      // Sort plugin results: override providers first, then supplement
      const sortedPluginResults = pluginResults
        .filter((r): r is NonNullable<typeof r> => r !== null)
        .sort((a, b) => {
          const aMode = a.provider.mode === 'override' ? 0 : 1;
          const bMode = b.provider.mode === 'override' ? 0 : 1;
          if (aMode !== bMode) return aMode - bMode;
          return b.provider.priority - a.provider.priority;
        });

      // Apply plugin features based on their mode
      for (const result of sortedPluginResults) {
        applyFeatures(result, result.provider.mode || 'supplement');
      }
    } else {
      // Sequential mode: process core first, then plugins
      for (const provider of coreProviders) {
        const result = await this.fetchFromProvider(trackId, provider);
        applyFeatures(result, 'supplement');
      }

      // Process override plugins first
      const overridePlugins = pluginProviders.filter(p => p.mode === 'override');
      for (const provider of overridePlugins) {
        const result = await this.fetchFromProvider(trackId, provider);
        applyFeatures(result, 'override');
      }

      // Then supplement plugins
      const supplementPlugins = pluginProviders.filter(p => p.mode !== 'override');
      for (const provider of supplementPlugins) {
        const result = await this.fetchFromProvider(trackId, provider);
        applyFeatures(result, 'supplement');
        // Stop if we have all features
        if (audio && emotion && lyrics && genre && embedding) break;
      }
    }

    return {
      trackId,
      audio,
      emotion,
      lyrics,
      genre,
      embedding,
      fingerprint,
      providers: providerInfos,
      lastUpdated: Date.now(),
    };
  }

  /**
   * Fetch features from a single provider
   */
  private async fetchFromProvider(
    trackId: string,
    provider: ExtendedFeatureProvider
  ): Promise<{
    provider: ExtendedFeatureProvider;
    features: Partial<AggregatedFeatures>;
    providedFeatures: string[];
  } | null> {
    const features: Partial<AggregatedFeatures> = {};
    const providedFeatures: string[] = [];

    const timeout = this.config.providerTimeout;

    try {
      // Audio features
      if (provider.getAudioFeatures && provider.capabilities.audioAnalysis) {
        const audio = await this.withTimeout(
          provider.getAudioFeatures(trackId),
          timeout
        );
        if (audio) {
          features.audio = audio;
          providedFeatures.push('audio');
        }
      }

      // Emotion features
      if (provider.getEmotionFeatures && provider.capabilities.emotionDetection) {
        const emotion = await this.withTimeout(
          provider.getEmotionFeatures(trackId),
          timeout
        );
        if (emotion) {
          features.emotion = emotion;
          providedFeatures.push('emotion');
        }
      }

      // Lyrics features
      if (provider.getLyricsFeatures && provider.capabilities.lyricsAnalysis) {
        const lyrics = await this.withTimeout(
          provider.getLyricsFeatures(trackId),
          timeout
        );
        if (lyrics) {
          features.lyrics = lyrics;
          providedFeatures.push('lyrics');
        }
      }

      // Embeddings
      if (provider.getEmbedding && provider.capabilities.embeddings) {
        const embedding = await this.withTimeout(
          provider.getEmbedding(trackId),
          timeout
        );
        if (embedding) {
          features.embedding = embedding;
          providedFeatures.push('embedding');
        }
      }

      // Genre features
      if (provider.getGenreFeatures && provider.capabilities.genreClassification) {
        const genre = await this.withTimeout(
          provider.getGenreFeatures(trackId),
          timeout
        );
        if (genre) {
          features.genre = genre;
          providedFeatures.push('genre');
        }
      }

      return { provider, features, providedFeatures };
    } catch (error) {
      console.warn(`[FeatureAggregator] Provider ${provider.id} failed:`, error);
      return null;
    }
  }

  /**
   * Merge audio features from multiple providers
   */
  private mergeAudioFeatures(
    existing: AudioFeatures | undefined,
    incoming: AudioFeatures
  ): AudioFeatures {
    if (!existing) return incoming;

    // Merge: keep existing values, fill in missing from incoming
    return {
      bpm: existing.bpm ?? incoming.bpm,
      beatsPerBar: existing.beatsPerBar ?? incoming.beatsPerBar,
      beatStrength: existing.beatStrength ?? incoming.beatStrength,
      key: existing.key ?? incoming.key,
      mode: existing.mode ?? incoming.mode,
      tuning: existing.tuning ?? incoming.tuning,
      energy: existing.energy ?? incoming.energy,
      loudness: existing.loudness ?? incoming.loudness,
      dynamicRange: existing.dynamicRange ?? incoming.dynamicRange,
      brightness: existing.brightness ?? incoming.brightness,
      warmth: existing.warmth ?? incoming.warmth,
      roughness: existing.roughness ?? incoming.roughness,
      valence: existing.valence ?? incoming.valence,
      arousal: existing.arousal ?? incoming.arousal,
      danceability: existing.danceability ?? incoming.danceability,
      acousticness: existing.acousticness ?? incoming.acousticness,
      instrumentalness: existing.instrumentalness ?? incoming.instrumentalness,
      speechiness: existing.speechiness ?? incoming.speechiness,
      liveness: existing.liveness ?? incoming.liveness,
      spectralCentroid: existing.spectralCentroid ?? incoming.spectralCentroid,
      spectralRolloff: existing.spectralRolloff ?? incoming.spectralRolloff,
      spectralFlux: existing.spectralFlux ?? incoming.spectralFlux,
      zeroCrossingRate: existing.zeroCrossingRate ?? incoming.zeroCrossingRate,
      mfcc: existing.mfcc ?? incoming.mfcc,
      analysisConfidence: existing.analysisConfidence ?? incoming.analysisConfidence,
    };
  }

  /**
   * Helper to add timeout to promises
   */
  private async withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number
  ): Promise<T | null> {
    const timeoutPromise = new Promise<null>((resolve) => {
      setTimeout(() => resolve(null), timeoutMs);
    });

    return Promise.race([promise, timeoutPromise]);
  }
}
