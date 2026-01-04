/**
 * Plugin Audio Feature Provider
 *
 * Example implementation showing how plugins can contribute audio features
 * to the recommendation system. Plugins can register as feature providers
 * to supply BPM, key, energy, and other audio analysis data.
 *
 * Usage by plugins:
 * 1. Implement the PluginFeatureProvider interface
 * 2. Call registerFeatureProvider() when plugin initializes
 * 3. Call unregisterFeatureProvider() when plugin is disabled
 */

import {
  registerFeatureProvider,
  unregisterFeatureProvider,
  type AudioFeatures,
  type PluginFeatureProvider
} from './advanced-scoring';

// ============================================
// Plugin Integration Helpers
// ============================================

/**
 * Create a feature provider from plugin configuration
 * Plugins call this to register their audio analysis capabilities
 */
export function createPluginFeatureProvider(
  pluginId: string,
  priority: number,
  handlers: {
    getAudioFeatures?: (trackId: string) => Promise<AudioFeatures | null>;
    getSimilarTracks?: (trackId: string, limit: number) => Promise<string[]>;
    getArtistSimilarity?: (artistId1: string, artistId2: string) => Promise<number>;
  }
): PluginFeatureProvider {
  return {
    pluginId,
    priority,
    getAudioFeatures: handlers.getAudioFeatures || (async () => null),
    getSimilarTracks: handlers.getSimilarTracks,
    getArtistSimilarity: handlers.getArtistSimilarity
  };
}

/**
 * Register a plugin as an audio feature provider
 */
export function registerPluginAudioProvider(provider: PluginFeatureProvider): void {
  registerFeatureProvider(provider);
  console.log(`[PluginAudio] Registered provider: ${provider.pluginId} (priority: ${provider.priority})`);
}

/**
 * Unregister a plugin's audio provider
 */
export function unregisterPluginAudioProvider(pluginId: string): void {
  unregisterFeatureProvider(pluginId);
  console.log(`[PluginAudio] Unregistered provider: ${pluginId}`);
}

// ============================================
// Example: Metadata Provider Implementation
// ============================================

/**
 * Example provider showing how a metadata plugin would provide audio features
 * NOTE: These are DOCUMENTATION EXAMPLES only - actual provider registration
 * is done dynamically in usePluginAudioFeatures.ts based on installed plugins
 */
export const metadataProviderExample: PluginFeatureProvider = {
  pluginId: 'example-metadata', // Dynamic: uses actual plugin ID at runtime
  priority: 100, // High priority for metadata providers

  async getAudioFeatures(_trackId: string): Promise<AudioFeatures | null> {
    // In real implementation, this would:
    // 1. Look up track in the metadata service via ISRC or search
    // 2. Call the service's audio-features endpoint
    // 3. Return normalized features
    return null; // Plugin not active
  },

  async getSimilarTracks(_trackId: string, _limit: number): Promise<string[]> {
    // In real implementation:
    // const recs = await api.getRecommendations({ seed_tracks: [trackId] });
    // return recs.tracks.map(t => t.id);
    return [];
  }
};

// ============================================
// Example: Local Audio Analysis Provider
// ============================================

/**
 * Example provider that could analyze audio files locally
 * Uses libraries like Essentia.js or Meyda for browser-based analysis
 */
export const localAnalysisProviderExample: PluginFeatureProvider = {
  pluginId: 'example-local-analysis', // Dynamic at runtime
  priority: 50, // Medium priority

  async getAudioFeatures(_trackId: string): Promise<AudioFeatures | null> {
    // In real implementation, this would:
    // 1. Get audio buffer from the player or file
    // 2. Run Essentia.js or Meyda analysis
    // 3. Extract tempo, spectral features, etc.
    return null; // Plugin not active
  }
};

// ============================================
// Example: Scrobbler Provider Implementation
// ============================================

/**
 * Example provider using a scrobbler service for similarity data
 */
export const scrobblerProviderExample: PluginFeatureProvider = {
  pluginId: 'example-scrobbler', // Dynamic at runtime
  priority: 75,

  async getAudioFeatures(_trackId: string): Promise<AudioFeatures | null> {
    // Scrobblers typically don't provide audio features
    return null;
  },

  async getSimilarTracks(_trackId: string, _limit: number): Promise<string[]> {
    // In real implementation:
    // const similar = await api.track.getSimilar(artist, track);
    // return similar.map(t => t.mbid || `${t.artist}-${t.name}`);
    return [];
  },

  async getArtistSimilarity(_artistId1: string, _artistId2: string): Promise<number> {
    // In real implementation:
    // const similar = await api.artist.getSimilar(artist1);
    // const match = similar.find(a => a.name === artist2);
    // return match ? match.match : 0;
    return 0;
  }
};

// ============================================
// Feature Normalization Helpers
// ============================================

/**
 * Normalize BPM to 0-1 range (assuming 60-200 BPM range)
 */
export function normalizeBpm(bpm: number): number {
  return Math.max(0, Math.min(1, (bpm - 60) / 140));
}

/**
 * Convert Spotify key number to string
 */
export function keyNumberToString(key: number, mode: number): string {
  const keys = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const keyName = keys[key] || 'C';
  return mode === 0 ? `${keyName}m` : keyName;
}

/**
 * Estimate energy from audio features
 */
export function estimateEnergyFromFeatures(features: Partial<AudioFeatures>): number {
  const weights = {
    energy: 0.4,
    loudness: 0.2,
    bpm: 0.2,
    danceability: 0.2
  };

  let score = 0;
  let totalWeight = 0;

  if (features.energy !== undefined) {
    score += features.energy * weights.energy;
    totalWeight += weights.energy;
  }

  if (features.loudness !== undefined) {
    // Normalize loudness from dB (-60 to 0) to 0-1
    const normalizedLoudness = (features.loudness + 60) / 60;
    score += normalizedLoudness * weights.loudness;
    totalWeight += weights.loudness;
  }

  if (features.bpm !== undefined) {
    score += normalizeBpm(features.bpm) * weights.bpm;
    totalWeight += weights.bpm;
  }

  if (features.danceability !== undefined) {
    score += features.danceability * weights.danceability;
    totalWeight += weights.danceability;
  }

  return totalWeight > 0 ? score / totalWeight : 0.5;
}

// ============================================
// Plugin System Integration
// ============================================

/**
 * Initialize audio providers from enabled plugins
 * Called when the app starts or when plugins change
 */
export async function initializeAudioProviders(): Promise<void> {
  // This would be called by the plugin system when plugins are loaded
  // Each plugin that supports audio features would register its provider

  // Example integration with plugin store:
  // const pluginStore = usePluginStore.getState();
  // const enabledPlugins = pluginStore.plugins.filter(p => p.enabled);
  //
  // for (const plugin of enabledPlugins) {
  //   if (plugin.capabilities?.audioFeatures) {
  //     const provider = await plugin.createFeatureProvider();
  //     registerPluginAudioProvider(provider);
  //   }
  // }

  console.log('[PluginAudio] Audio providers initialized');
}

/**
 * Clean up audio providers when app closes
 */
export function cleanupAudioProviders(): void {
  // Unregister all providers
  // This would iterate through registered providers and remove them
  console.log('[PluginAudio] Audio providers cleaned up');
}

export default {
  createPluginFeatureProvider,
  registerPluginAudioProvider,
  unregisterPluginAudioProvider,
  initializeAudioProviders,
  cleanupAudioProviders,
  normalizeBpm,
  keyNumberToString,
  estimateEnergyFromFeatures
};
