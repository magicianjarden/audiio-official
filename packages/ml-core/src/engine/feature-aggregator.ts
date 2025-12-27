/**
 * Feature Aggregator - Combines features from multiple providers
 */

import type {
  AggregatedFeatures,
  AudioFeatures,
  EmotionFeatures,
  LyricsFeatures,
  FeatureProvider,
  ProviderCapabilities,
  FeatureProviderInfo,
  FeatureAggregationConfig,
  DEFAULT_AGGREGATION_CONFIG,
} from '@audiio/ml-sdk';
import { MemoryCache } from '@audiio/ml-sdk';

export class FeatureAggregator {
  private providers: Map<string, FeatureProvider> = new Map();
  private cache: MemoryCache<AggregatedFeatures>;
  private config: FeatureAggregationConfig;
  private pendingRequests: Map<string, Promise<AggregatedFeatures>> = new Map();

  constructor(config: Partial<FeatureAggregationConfig> = {}) {
    this.config = {
      strategy: 'priority',
      conflictResolution: 'highest-priority',
      minConfidence: 0.5,
      cacheDuration: 24 * 60 * 60 * 1000, // 24 hours
      parallelFetch: true,
      providerTimeout: 10000,
      ...config,
    };

    this.cache = new MemoryCache<AggregatedFeatures>(5000, this.config.cacheDuration);
  }

  /**
   * Register a feature provider
   */
  register(provider: FeatureProvider): void {
    this.providers.set(provider.id, provider);
    console.log(`[FeatureAggregator] Registered provider: ${provider.id} (priority: ${provider.priority})`);
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
  getProviders(): FeatureProvider[] {
    return Array.from(this.providers.values());
  }

  /**
   * Get providers sorted by priority (highest first)
   */
  getProvidersByPriority(): FeatureProvider[] {
    return Array.from(this.providers.values())
      .sort((a, b) => b.priority - a.priority);
  }

  /**
   * Get providers with a specific capability
   */
  getProvidersWithCapability(capability: keyof ProviderCapabilities): FeatureProvider[] {
    return this.getProvidersByPriority()
      .filter(p => p.capabilities[capability]);
  }

  /**
   * Get aggregated features for a track
   */
  async get(trackId: string): Promise<AggregatedFeatures> {
    // Check cache
    const cached = this.cache.get(trackId);
    if (cached) return cached;

    // Check pending requests (deduplication)
    const pending = this.pendingRequests.get(trackId);
    if (pending) return pending;

    // Create new request
    const promise = this.fetchAndAggregate(trackId);
    this.pendingRequests.set(trackId, promise);

    try {
      const result = await promise;
      this.cache.set(trackId, result);
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
   */
  private async fetchAndAggregate(trackId: string): Promise<AggregatedFeatures> {
    const providers = this.getProvidersByPriority();
    const providerInfos: FeatureProviderInfo[] = [];

    let audio: AudioFeatures | undefined;
    let emotion: EmotionFeatures | undefined;
    let lyrics: LyricsFeatures | undefined;
    let embedding: number[] | undefined;
    let fingerprint: string | undefined;

    if (this.config.parallelFetch) {
      // Fetch from all providers in parallel
      const results = await Promise.all(
        providers.map(p => this.fetchFromProvider(trackId, p))
      );

      for (const result of results) {
        if (!result) continue;

        const { provider, features, providedFeatures } = result;

        // Merge based on strategy
        if (this.config.strategy === 'priority') {
          // First provider wins for each feature type
          if (features.audio && !audio) audio = features.audio;
          if (features.emotion && !emotion) emotion = features.emotion;
          if (features.lyrics && !lyrics) lyrics = features.lyrics;
          if (features.embedding && !embedding) embedding = features.embedding;
          if (features.fingerprint && !fingerprint) fingerprint = features.fingerprint;
        } else {
          // Merge strategy - combine all features
          if (features.audio) audio = this.mergeAudioFeatures(audio, features.audio);
          if (features.emotion) emotion = features.emotion ?? emotion;
          if (features.lyrics) lyrics = features.lyrics ?? lyrics;
          if (features.embedding) embedding = features.embedding ?? embedding;
          if (features.fingerprint) fingerprint = features.fingerprint ?? fingerprint;
        }

        if (providedFeatures.length > 0) {
          providerInfos.push({
            providerId: provider.id,
            providedFeatures,
            confidence: 1.0, // TODO: Calculate actual confidence
          });
        }
      }
    } else {
      // Fetch sequentially from highest priority
      for (const provider of providers) {
        const result = await this.fetchFromProvider(trackId, provider);
        if (!result) continue;

        const { features, providedFeatures } = result;

        // Set features if not already set
        if (features.audio && !audio) audio = features.audio;
        if (features.emotion && !emotion) emotion = features.emotion;
        if (features.lyrics && !lyrics) lyrics = features.lyrics;
        if (features.embedding && !embedding) embedding = features.embedding;
        if (features.fingerprint && !fingerprint) fingerprint = features.fingerprint;

        if (providedFeatures.length > 0) {
          providerInfos.push({
            providerId: provider.id,
            providedFeatures,
            confidence: 1.0,
          });
        }

        // Stop if we have all features
        if (audio && emotion && lyrics && embedding) break;
      }
    }

    return {
      trackId,
      audio,
      emotion,
      lyrics,
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
    provider: FeatureProvider
  ): Promise<{
    provider: FeatureProvider;
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
