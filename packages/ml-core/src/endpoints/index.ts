/**
 * Endpoints - Creates the public API for algorithm plugins
 */

import type {
  MLCoreEndpoints,
  FeatureEndpoint,
  UserEndpoint,
  TrainingEndpoint,
  QueueEndpoint,
  ScoringEndpoint,
  StorageEndpoint,
  EventEndpoint,
  LibraryEndpoint,
  ModelStorage,
  FeatureProvider,
  Track,
  TrackScore,
  UserPreferences,
  TemporalPatterns,
  TrainingDataset,
  FeatureStats,
  QueueConfig,
  ScoringContext,
  DatasetOptions,
  HistoryOptions,
  QueueCandidateContext,
} from '@audiio/ml-sdk';

import type { FeatureAggregator } from '../engine/feature-aggregator';
import type { EventRecorder } from '../learning/event-recorder';
import type { PreferenceStore } from '../learning/preference-store';
import type { SmartQueue } from '../queue/smart-queue';
import type { AlgorithmRegistry } from '../engine/algorithm-registry';

import * as tf from '@tensorflow/tfjs';

interface EndpointDependencies {
  featureAggregator: FeatureAggregator;
  eventRecorder: EventRecorder;
  preferenceStore: PreferenceStore;
  smartQueue: SmartQueue;
  registry: AlgorithmRegistry;
}

/**
 * Create the MLCoreEndpoints implementation
 */
export function createEndpoints(deps: EndpointDependencies): MLCoreEndpoints {
  const {
    featureAggregator,
    eventRecorder,
    preferenceStore,
    smartQueue,
    registry,
  } = deps;

  // Storage for algorithm data
  const algorithmStorage = new Map<string, Map<string, unknown>>();

  // Event listeners
  const eventListeners = new Set<(event: import('@audiio/ml-sdk').UserEvent) => void>();

  // ============================================================================
  // Feature Endpoint
  // ============================================================================

  const features: FeatureEndpoint = {
    get: (trackId) => featureAggregator.get(trackId),
    getBatch: (trackIds) => featureAggregator.getBatch(trackIds),
    getAudio: (trackId) => featureAggregator.getAudio(trackId),
    getEmotion: (trackId) => featureAggregator.getEmotion(trackId),
    getLyrics: (trackId) => featureAggregator.getLyrics(trackId),
    getEmbedding: (trackId) => featureAggregator.getEmbedding(trackId),
    register: (provider) => featureAggregator.register(provider),
    unregister: (providerId) => featureAggregator.unregister(providerId),
    getProviders: () => featureAggregator.getProviders(),
    invalidateCache: (trackId) => featureAggregator.invalidateCache(trackId),
    prefetch: (trackIds) => featureAggregator.prefetch(trackIds),
  };

  // ============================================================================
  // User Endpoint
  // ============================================================================

  const user: UserEndpoint = {
    getPreferences: () => preferenceStore.getPreferences(),
    getListenHistory: (options) => {
      const events = eventRecorder.getListenEvents();
      let filtered = events;

      if (options?.since) {
        filtered = filtered.filter(e => e.timestamp >= options.since!);
      }
      if (options?.until) {
        filtered = filtered.filter(e => e.timestamp <= options.until!);
      }
      if (options?.completedOnly) {
        filtered = filtered.filter(e => e.completed);
      }
      if (options?.limit) {
        filtered = filtered.slice(-options.limit);
      }

      return Promise.resolve(filtered);
    },
    getDislikedTracks: async () => {
      const disliked = preferenceStore.getDislikedTracks();
      return disliked.map(d => ({
        trackId: d.trackId,
        track: { id: d.trackId, title: '', artist: '', duration: 0 } as Track,
        reason: d.reason,
        timestamp: d.timestamp,
        artistId: d.artistId,
      }));
    },
    getArtistAffinity: (artistId) => preferenceStore.getArtistAffinity(artistId),
    getGenreAffinity: (genre) => preferenceStore.getGenreAffinity(genre),
    getAllArtistAffinities: () => preferenceStore.getAllArtistAffinities(),
    getAllGenreAffinities: () => preferenceStore.getAllGenreAffinities(),
    getTemporalPatterns: () => preferenceStore.getTemporalPatterns(),
    getSessionStats: async () => ({
      sessionId: 'current',
      startTime: Date.now(),
      tracksPlayed: smartQueue.getSessionHistory().length,
      uniqueArtists: new Set(smartQueue.getSessionHistory().map(t => t.artistId)).size,
      genresPlayed: smartQueue.getSessionGenres(),
      averageEnergy: 0.5,
      skipRate: 0,
    }),
    wasRecentlyPlayed: (trackId, withinMs) =>
      preferenceStore.wasRecentlyPlayed(trackId, withinMs),
    getLastPlayed: (trackId) => preferenceStore.getLastPlayed(trackId),
  };

  // ============================================================================
  // Training Endpoint
  // ============================================================================

  const training: TrainingEndpoint = {
    getPositiveSamples: (limit) =>
      Promise.resolve(eventRecorder.getPositiveSamples(limit)),
    getNegativeSamples: (limit) =>
      Promise.resolve(eventRecorder.getNegativeSamples(limit)),
    getFullDataset: (options) =>
      Promise.resolve(eventRecorder.getFullDataset(options)),
    getFeatureStats: () => Promise.resolve(eventRecorder.getFeatureStats()),
    onNewData: (callback) => {
      return eventRecorder.subscribe(event => {
        const sample = eventRecorder.getPositiveSamples(1)[0];
        if (sample) callback(sample);
      });
    },
    getNewEventCount: () => Promise.resolve(eventRecorder.getNewEventCount()),
    markTrainingComplete: async (modelVersion) => {
      eventRecorder.markTrainingComplete(modelVersion);
    },
    getLastTrainingInfo: () =>
      Promise.resolve(eventRecorder.getLastTrainingInfo()),
  };

  // ============================================================================
  // Queue Endpoint
  // ============================================================================

  const queue: QueueEndpoint = {
    getCandidates: (context) => smartQueue.getCandidates(context),
    submitRanking: (tracks) => smartQueue.submitRanking(tracks),
    getCurrentQueue: () => smartQueue.getCurrentQueue(),
    getSessionHistory: () => smartQueue.getSessionHistory(),
    getConfig: () => smartQueue.getConfig(),
    isInQueue: (trackId) => smartQueue.isInQueue(trackId),
    wasPlayedInSession: (trackId) => smartQueue.wasPlayedInSession(trackId),
  };

  // ============================================================================
  // Scoring Endpoint
  // ============================================================================

  const scoreCache = new Map<string, { score: TrackScore; timestamp: number }>();

  const scoring: ScoringEndpoint = {
    submitScore: (trackId, score, algorithmId) => {
      scoreCache.set(`${algorithmId}:${trackId}`, { score, timestamp: Date.now() });
    },
    submitBatchScores: (scores, algorithmId) => {
      for (const [trackId, score] of scores) {
        scoreCache.set(`${algorithmId}:${trackId}`, { score, timestamp: Date.now() });
      }
    },
    getOtherAlgorithmScores: async (trackId) => {
      const results: import('@audiio/ml-sdk').AlgorithmScoreEntry[] = [];

      for (const [key, { score, timestamp }] of scoreCache) {
        if (key.endsWith(`:${trackId}`)) {
          const algorithmId = key.split(':')[0];
          results.push({ algorithmId, score, timestamp });
        }
      }

      return results;
    },
    getFinalScore: async (trackId) => {
      const activeId = registry.getActiveId();
      if (!activeId) return null;

      const cached = scoreCache.get(`${activeId}:${trackId}`);
      return cached?.score ?? null;
    },
    getStats: async () => ({
      totalScores: scoreCache.size,
      avgScoringTime: 0,
      distribution: { low: 0, medium: 0, high: 0 },
      cacheHitRate: 0,
    }),
  };

  // ============================================================================
  // Storage Endpoint
  // ============================================================================

  const createStorage = (algorithmId: string): StorageEndpoint => {
    const getAlgorithmStorage = () => {
      let storage = algorithmStorage.get(algorithmId);
      if (!storage) {
        storage = new Map();
        algorithmStorage.set(algorithmId, storage);
      }
      return storage;
    };

    return {
      get: async <T>(key: string) => {
        const storage = getAlgorithmStorage();
        return (storage.get(key) as T) ?? null;
      },
      set: async <T>(key: string, value: T) => {
        const storage = getAlgorithmStorage();
        storage.set(key, value);

        // Persist to localStorage
        try {
          const storageKey = `audiio-algo-${algorithmId}`;
          const data = Object.fromEntries(storage);
          localStorage.setItem(storageKey, JSON.stringify(data));
        } catch (error) {
          console.warn('[Storage] Failed to persist:', error);
        }
      },
      delete: async (key: string) => {
        const storage = getAlgorithmStorage();
        storage.delete(key);
      },
      has: async (key: string) => {
        const storage = getAlgorithmStorage();
        return storage.has(key);
      },
      keys: async (prefix?: string) => {
        const storage = getAlgorithmStorage();
        const keys = Array.from(storage.keys());
        return prefix ? keys.filter(k => k.startsWith(prefix)) : keys;
      },
      clear: async () => {
        algorithmStorage.delete(algorithmId);
      },
      getModelStorage: (): ModelStorage => ({
        save: async (key, model) => {
          await model.save(`indexeddb://audiio-model-${algorithmId}-${key}`);
        },
        load: async (key) => {
          try {
            return await tf.loadLayersModel(`indexeddb://audiio-model-${algorithmId}-${key}`);
          } catch {
            return null;
          }
        },
        delete: async (key) => {
          try {
            await tf.io.removeModel(`indexeddb://audiio-model-${algorithmId}-${key}`);
          } catch {
            // Ignore
          }
        },
        exists: async (key) => {
          try {
            const models = await tf.io.listModels();
            return `indexeddb://audiio-model-${algorithmId}-${key}` in models;
          } catch {
            return false;
          }
        },
        getModelUrl: (key) => {
          // Return the IndexedDB URL for model storage
          return `indexeddb://audiio-model-${algorithmId}-${key}`;
        },
      }),
    };
  };

  // Default storage (will be replaced per-algorithm)
  const storage = createStorage('default');

  // ============================================================================
  // Event Endpoint
  // ============================================================================

  const events: EventEndpoint = {
    onUserEvent: (callback) => {
      eventListeners.add(callback);
      return () => eventListeners.delete(callback);
    },
    on: (type, callback) => {
      const wrappedCallback = (event: import('@audiio/ml-sdk').UserEvent) => {
        if (event.type === type) {
          callback(event as any);
        }
      };
      eventListeners.add(wrappedCallback);
      return () => eventListeners.delete(wrappedCallback);
    },
    onQueueChange: (callback) => {
      // TODO: Implement queue change subscription
      return () => {};
    },
    onPlaybackChange: (callback) => {
      // TODO: Implement playback change subscription
      return () => {};
    },
  };

  // ============================================================================
  // Library Endpoint
  // ============================================================================

  const library: LibraryEndpoint = {
    getAllTracks: async () => [],
    getTrack: async (trackId) => null,
    getTracksByArtist: async (artistId) => [],
    getTracksByGenre: async (genre) => [],
    getLikedTracks: async () => [],
    getPlaylistTracks: async (playlistId) => [],
    getPlaylists: async () => [],
    search: async (query, limit) => [],
    getStats: async () => ({
      totalTracks: 0,
      totalArtists: 0,
      totalAlbums: 0,
      totalPlaylists: 0,
      totalDuration: 0,
      genreDistribution: new Map(),
    }),
  };

  return {
    features,
    user,
    training,
    queue,
    scoring,
    storage,
    events,
    library,
  };
}
