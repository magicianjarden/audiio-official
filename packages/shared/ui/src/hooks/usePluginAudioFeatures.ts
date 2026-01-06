/**
 * usePluginAudioFeatures - Hook that connects plugins to the ML audio feature system
 *
 * This hook watches the plugin store and automatically:
 * - Registers audio feature providers when plugins are enabled
 * - Unregisters providers when plugins are disabled
 * - Caches audio features for better performance
 *
 * Uses capability-based detection - any plugin that provides audio features
 * will be automatically registered.
 */

import { useEffect, useRef } from 'react';
import { usePluginStore } from '../stores/plugin-store';
import {
  registerPluginAudioProvider,
  unregisterPluginAudioProvider,
  createPluginFeatureProvider,
  keyNumberToString
} from '../ml/plugin-audio-provider';
import type { AudioFeatures } from '@audiio/core';

// Audio features cache (persists across renders)
const audioFeaturesCache = new Map<string, AudioFeatures>();

// Client-side request deduplication - tracks in-flight requests
const inFlightRequests = new Map<string, Promise<AudioFeatures | null>>();

// Client-side failure cache - prevents repeated requests for tracks that failed
const failedTrackIds = new Set<string>();

/**
 * Plugin roles that can provide audio features
 * Metadata providers and scrobblers can provide features
 */
const AUDIO_FEATURE_ROLES = ['metadata-provider', 'scrobbler'] as const;

/**
 * Whether local audio analysis provider is registered
 */
let localAnalysisRegistered = false;

/**
 * Create a metadata provider for audio features
 * Connects to the main process API for audio data from any metadata provider
 */
function createMetadataFeatureProvider(pluginId: string, priority: number = 100) {
  return createPluginFeatureProvider(pluginId, priority, {
    async getAudioFeatures(trackId: string): Promise<AudioFeatures | null> {
      // Check cache first
      const cached = audioFeaturesCache.get(trackId);
      if (cached) {
        return cached;
      }

      // Skip if already known to fail
      if (failedTrackIds.has(trackId)) {
        return null;
      }

      // Check for in-flight request (deduplication)
      const inFlight = inFlightRequests.get(trackId);
      if (inFlight) {
        return inFlight;
      }

      // Create request promise
      const requestPromise = (async (): Promise<AudioFeatures | null> => {
        try {
          if (window.api?.getAudioFeatures) {
            const features = await window.api.getAudioFeatures(trackId);
            if (features) {
              const normalized: AudioFeatures = {
                bpm: features.tempo || features.bpm,
                energy: features.energy,
                danceability: features.danceability,
                acousticness: features.acousticness,
                instrumentalness: features.instrumentalness,
                valence: features.valence,
                loudness: features.loudness,
                speechiness: features.speechiness,
                key: features.key ? (typeof features.key === 'number' ? keyNumberToString(features.key, features.mode) : features.key) : undefined,
                mode: typeof features.mode === 'number' ? (features.mode === 1 ? 'major' : 'minor') : features.mode
              };

              audioFeaturesCache.set(trackId, normalized);
              return normalized;
            }
          }
          // No features available - mark as failed to prevent retry
          failedTrackIds.add(trackId);
          return null;
        } catch (error) {
          console.warn(`[${pluginId}] Failed to get audio features:`, error);
          failedTrackIds.add(trackId);
          return null;
        } finally {
          inFlightRequests.delete(trackId);
        }
      })();

      inFlightRequests.set(trackId, requestPromise);
      return requestPromise;
    },

    async getSimilarTracks(trackId: string, limit: number): Promise<string[]> {
      try {
        if (window.api?.getSimilarTracks) {
          const similar = await window.api.getSimilarTracks(trackId, limit);
          if (similar && Array.isArray(similar)) {
            return similar.map(t => typeof t === 'string' ? t : t.id);
          }
        }
      } catch (error) {
        console.warn(`[${pluginId}] Failed to get similar tracks:`, error);
      }
      return [];
    }
  });
}

/**
 * Create a scrobbler-based similarity provider
 * Uses scrobbler services for artist/track similarity data
 */
function createScrobblerFeatureProvider(pluginId: string, priority: number = 75) {
  return createPluginFeatureProvider(pluginId, priority, {
    async getAudioFeatures(_trackId: string): Promise<AudioFeatures | null> {
      // Scrobblers typically don't provide audio features
      return null;
    },

    async getSimilarTracks(trackId: string, limit: number): Promise<string[]> {
      try {
        // Use the generic similar tracks API
        if (window.api?.getSimilarTracks) {
          const similar = await window.api.getSimilarTracks(trackId, limit);
          return similar || [];
        }
      } catch (error) {
        console.warn(`[${pluginId}] Failed to get similar tracks:`, error);
      }
      return [];
    },

    async getArtistSimilarity(artistId1: string, artistId2: string): Promise<number> {
      try {
        if (window.api?.getArtistSimilarity) {
          return await window.api.getArtistSimilarity(artistId1, artistId2);
        }
      } catch (error) {
        console.warn(`[${pluginId}] Failed to get artist similarity:`, error);
      }
      return 0;
    }
  });
}

/**
 * Create a local audio analysis provider
 * Uses FFmpeg-based analysis for BPM, key, energy, etc.
 * This is a fallback provider with lower priority
 */
function createLocalAnalysisProvider() {
  return createPluginFeatureProvider('local-audio-analysis', 25, {
    async getAudioFeatures(trackId: string): Promise<AudioFeatures | null> {
      // Check cache first
      const cached = audioFeaturesCache.get(trackId);
      if (cached) {
        return cached;
      }

      // Skip if already known to fail (handled by metadata provider)
      if (failedTrackIds.has(trackId)) {
        return null;
      }

      // Check for in-flight request (deduplication)
      const inFlight = inFlightRequests.get(trackId);
      if (inFlight) {
        return inFlight;
      }

      // Create request promise
      const requestPromise = (async (): Promise<AudioFeatures | null> => {
        try {
          if (window.api?.getAudioFeatures) {
            const features = await window.api.getAudioFeatures(trackId);
            if (features) {
              const normalized: AudioFeatures = {
                bpm: features.bpm,
                energy: features.energy,
                danceability: features.danceability,
                acousticness: features.acousticness,
                instrumentalness: features.instrumentalness,
                valence: features.valence,
                loudness: features.loudness,
                speechiness: features.speechiness,
                key: features.key,
                mode: features.mode
              };

              audioFeaturesCache.set(trackId, normalized);
              return normalized;
            }
          }
          // No features - mark as failed
          failedTrackIds.add(trackId);
          return null;
        } catch (error) {
          console.warn('[LocalAnalysisProvider] Failed to get audio features:', error);
          failedTrackIds.add(trackId);
          return null;
        } finally {
          inFlightRequests.delete(trackId);
        }
      })();

      inFlightRequests.set(trackId, requestPromise);
      return requestPromise;
    },

    async getSimilarTracks(_trackId: string, _limit: number): Promise<string[]> {
      // Local analysis doesn't provide similar tracks
      return [];
    }
  });
}

/**
 * Initialize local audio analysis provider
 * This runs once on app start and provides fallback audio features
 */
async function initializeLocalAnalysis(): Promise<void> {
  if (localAnalysisRegistered) return;

  try {
    // Check if audio analyzer is available
    if (window.api?.checkAudioAnalyzer) {
      const status = await window.api.checkAudioAnalyzer();
      if (status?.available) {
        const provider = createLocalAnalysisProvider();
        registerPluginAudioProvider(provider);
        localAnalysisRegistered = true;
        console.log('[PluginAudioFeatures] Registered local audio analysis provider');
      } else {
        console.log('[PluginAudioFeatures] Local audio analysis not available (FFmpeg missing)');
      }
    }
  } catch (error) {
    console.warn('[PluginAudioFeatures] Failed to initialize local analysis:', error);
  }
}

/**
 * Hook to manage plugin audio feature providers
 * Automatically registers/unregisters providers based on plugin state
 */
export function usePluginAudioFeatures(): void {
  const plugins = usePluginStore(state => state.plugins);
  const registeredRef = useRef<Set<string>>(new Set());

  // Initialize local audio analysis on mount
  useEffect(() => {
    initializeLocalAnalysis();
  }, []);

  useEffect(() => {
    const currentlyRegistered = registeredRef.current;

    // Check each plugin for audio feature capability based on roles
    for (const plugin of plugins) {
      // Check if plugin has a role that can provide audio features
      const isMetadataProvider = plugin.roles?.includes('metadata-provider');
      const isScrobbler = plugin.roles?.includes('scrobbler');
      const canProvideFeatures = isMetadataProvider || isScrobbler;

      if (!canProvideFeatures) continue;

      const shouldBeRegistered = plugin.enabled && plugin.installed;
      const isCurrentlyRegistered = currentlyRegistered.has(plugin.id);

      if (shouldBeRegistered && !isCurrentlyRegistered) {
        // Register the provider based on role
        let provider;
        if (isMetadataProvider) {
          // Metadata providers get higher priority
          provider = createMetadataFeatureProvider(plugin.id, 100);
        } else if (isScrobbler) {
          // Scrobblers get lower priority (mainly for similarity)
          provider = createScrobblerFeatureProvider(plugin.id, 75);
        }

        if (provider) {
          registerPluginAudioProvider(provider);
          currentlyRegistered.add(plugin.id);
          console.log(`[PluginAudioFeatures] Registered provider: ${plugin.id}`);
        }
      } else if (!shouldBeRegistered && isCurrentlyRegistered) {
        // Unregister the provider
        unregisterPluginAudioProvider(plugin.id);
        currentlyRegistered.delete(plugin.id);
        console.log(`[PluginAudioFeatures] Unregistered provider: ${plugin.id}`);
      }
    }
  }, [plugins]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      const currentlyRegistered = registeredRef.current;
      for (const pluginId of currentlyRegistered) {
        unregisterPluginAudioProvider(pluginId);
      }
      currentlyRegistered.clear();
    };
  }, []);
}

/**
 * Get cached audio features for a track
 */
export function getCachedAudioFeatures(trackId: string): AudioFeatures | null {
  return audioFeaturesCache.get(trackId) || null;
}

/**
 * Trigger audio analysis for a track during playback
 * Call this when a track starts playing to analyze in background
 * Pass the full track object to enable stream resolution via plugins
 */
export async function triggerAudioAnalysis(
  trackId: string,
  streamUrl?: string,
  track?: unknown
): Promise<AudioFeatures | null> {
  // Check cache first
  const cached = audioFeaturesCache.get(trackId);
  if (cached) {
    return cached;
  }

  try {
    if (window.api?.getAudioFeatures) {
      // Pass track object to enable stream resolution via plugins
      const features = await window.api.getAudioFeatures(trackId, streamUrl, track);
      if (features) {
        audioFeaturesCache.set(trackId, features);
        console.log(`[AudioAnalysis] Analyzed track ${trackId}:`, {
          bpm: features.bpm,
          key: features.key,
          energy: features.energy?.toFixed(2)
        });
        return features;
      }
    }
  } catch (error) {
    console.warn('[AudioAnalysis] Failed to analyze track:', error);
  }

  return null;
}

/**
 * Clear the audio features cache and allow retry of failed tracks
 */
export function clearAudioFeaturesCache(): void {
  audioFeaturesCache.clear();
  failedTrackIds.clear();
  inFlightRequests.clear();
}

/**
 * Get cache statistics
 */
export function getAudioFeaturesCacheStats(): { size: number; trackIds: string[] } {
  return {
    size: audioFeaturesCache.size,
    trackIds: Array.from(audioFeaturesCache.keys())
  };
}

export default usePluginAudioFeatures;
