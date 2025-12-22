/**
 * usePluginAudioFeatures - Hook that connects plugins to the ML audio feature system
 *
 * This hook watches the plugin store and automatically:
 * - Registers audio feature providers when plugins are enabled
 * - Unregisters providers when plugins are disabled
 * - Caches audio features for better performance
 */

import { useEffect, useRef } from 'react';
import { usePluginStore } from '../stores/plugin-store';
import {
  registerPluginAudioProvider,
  unregisterPluginAudioProvider,
  createPluginFeatureProvider,
  keyNumberToString
} from '../ml/plugin-audio-provider';
import type { AudioFeatures } from '../ml/advanced-scoring';

// Audio features cache (persists across renders)
const audioFeaturesCache = new Map<string, AudioFeatures>();

/**
 * Plugin IDs that support audio features
 */
const AUDIO_FEATURE_PLUGINS = ['spotify-metadata', 'local-audio-analysis'];

/**
 * Whether local audio analysis provider is registered
 */
let localAnalysisRegistered = false;

/**
 * Create a Spotify audio feature provider
 * Connects to the main process API for Spotify data
 */
function createSpotifyProvider() {
  return createPluginFeatureProvider('spotify-metadata', 100, {
    async getAudioFeatures(trackId: string): Promise<AudioFeatures | null> {
      // Check cache first
      const cached = audioFeaturesCache.get(trackId);
      if (cached) {
        return cached;
      }

      try {
        // Call main process to get audio features
        if (window.api?.getAudioFeatures) {
          const features = await window.api.getAudioFeatures(trackId);
          if (features) {
            const normalized: AudioFeatures = {
              bpm: features.tempo,
              energy: features.energy,
              danceability: features.danceability,
              acousticness: features.acousticness,
              instrumentalness: features.instrumentalness,
              valence: features.valence,
              loudness: features.loudness,
              speechiness: features.speechiness,
              key: keyNumberToString(features.key, features.mode),
              mode: features.mode === 1 ? 'major' : 'minor'
            };

            // Cache the result
            audioFeaturesCache.set(trackId, normalized);
            return normalized;
          }
        }
      } catch (error) {
        console.warn('[SpotifyProvider] Failed to get audio features:', error);
      }

      return null;
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
        console.warn('[SpotifyProvider] Failed to get similar tracks:', error);
      }
      return [];
    }
  });
}

/**
 * Create a Last.fm similarity provider
 * Uses Last.fm for artist/track similarity data
 */
function createLastfmProvider() {
  return createPluginFeatureProvider('lastfm-scrobbler', 75, {
    async getAudioFeatures(_trackId: string): Promise<AudioFeatures | null> {
      // Last.fm doesn't provide audio features
      return null;
    },

    async getSimilarTracks(trackId: string, limit: number): Promise<string[]> {
      try {
        if (window.api?.getLastfmSimilar) {
          const similar = await window.api.getLastfmSimilar(trackId, limit);
          return similar || [];
        }
      } catch (error) {
        console.warn('[LastfmProvider] Failed to get similar tracks:', error);
      }
      return [];
    },

    async getArtistSimilarity(artistId1: string, artistId2: string): Promise<number> {
      try {
        if (window.api?.getArtistSimilarity) {
          return await window.api.getArtistSimilarity(artistId1, artistId2);
        }
      } catch (error) {
        console.warn('[LastfmProvider] Failed to get artist similarity:', error);
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

      try {
        // Try to get from the main process cache
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

            // Cache the result
            audioFeaturesCache.set(trackId, normalized);
            return normalized;
          }
        }
      } catch (error) {
        console.warn('[LocalAnalysisProvider] Failed to get audio features:', error);
      }

      return null;
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

    // Check each audio-feature capable plugin
    for (const plugin of plugins) {
      const isAudioPlugin = AUDIO_FEATURE_PLUGINS.includes(plugin.id) ||
                           plugin.id === 'lastfm-scrobbler';

      if (!isAudioPlugin) continue;

      const shouldBeRegistered = plugin.enabled && plugin.installed;
      const isCurrentlyRegistered = currentlyRegistered.has(plugin.id);

      if (shouldBeRegistered && !isCurrentlyRegistered) {
        // Register the provider
        let provider;
        switch (plugin.id) {
          case 'spotify-metadata':
            provider = createSpotifyProvider();
            break;
          case 'lastfm-scrobbler':
            provider = createLastfmProvider();
            break;
          case 'local-audio-analysis':
            // Local analysis is handled separately via initializeLocalAnalysis
            // Skip here to avoid duplicate registration
            continue;
          default:
            continue;
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
 */
export async function triggerAudioAnalysis(
  trackId: string,
  streamUrl?: string
): Promise<AudioFeatures | null> {
  // Check cache first
  const cached = audioFeaturesCache.get(trackId);
  if (cached) {
    return cached;
  }

  try {
    if (window.api?.getAudioFeatures) {
      const features = await window.api.getAudioFeatures(trackId, streamUrl);
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
 * Clear the audio features cache
 */
export function clearAudioFeaturesCache(): void {
  audioFeaturesCache.clear();
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
