/**
 * Plugin store - manages installed plugins and their state
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type PluginCategory = 'metadata' | 'streaming' | 'lyrics' | 'scrobbling' | 'other';

// Map UI plugin IDs to actual addon IDs in the main process
const pluginToAddonId: Record<string, string> = {
  'deezer-metadata': 'deezer',
  'youtube-music': 'youtube-music',
  'lrclib-lyrics': 'lrclib-lyrics',
  'lastfm-scrobbler': 'lastfm-scrobbler',
  'spotify-metadata': 'spotify-metadata',
  'applemusic-artwork': 'applemusic-artwork',
};

// Helper to notify main process of plugin state changes
const notifyMainProcess = async (pluginId: string, enabled: boolean) => {
  const addonId = pluginToAddonId[pluginId] || pluginId;
  if (window.api?.setAddonEnabled) {
    try {
      await window.api.setAddonEnabled(addonId, enabled);
      console.log(`Plugin ${pluginId} (addon: ${addonId}) ${enabled ? 'enabled' : 'disabled'}`);
    } catch (error) {
      console.error(`Failed to ${enabled ? 'enable' : 'disable'} plugin ${pluginId}:`, error);
    }
  }
};

// Sync all plugin states with main process (called on app startup)
const syncPluginStatesWithMainProcess = async (plugins: Plugin[], pluginOrder: string[]) => {
  if (!window.api?.setAddonEnabled) return;

  console.log('Syncing plugin states with main process...');
  for (const plugin of plugins) {
    if (plugin.installed) {
      const addonId = pluginToAddonId[plugin.id] || plugin.id;
      try {
        await window.api.setAddonEnabled(addonId, plugin.enabled);
      } catch (error) {
        console.error(`Failed to sync plugin ${plugin.id}:`, error);
      }
    }
  }

  // Sync plugin order
  if (pluginOrder.length > 0 && window.api?.setAddonOrder) {
    try {
      const orderedAddonIds = pluginOrder.map(id => pluginToAddonId[id] || id);
      await window.api.setAddonOrder(orderedAddonIds);
      console.log('Plugin order synced');
    } catch (error) {
      console.error('Failed to sync plugin order:', error);
    }
  }

  console.log('Plugin states synced');
};

// Notify main process of plugin order changes
const notifyOrderChange = async (pluginOrder: string[]) => {
  if (window.api?.setAddonOrder) {
    try {
      const orderedAddonIds = pluginOrder.map(id => pluginToAddonId[id] || id);
      await window.api.setAddonOrder(orderedAddonIds);
      console.log('Plugin order updated:', orderedAddonIds);
    } catch (error) {
      console.error('Failed to update plugin order:', error);
    }
  }
};

export interface PluginPrivacyAccess {
  type: 'network' | 'storage' | 'playback' | 'library' | 'system';
  label: string;
  description: string;
  required: boolean;
}

export interface PluginSettingDefinition {
  key: string;
  label: string;
  description: string;
  type: 'boolean' | 'select' | 'number';
  default: boolean | string | number;
  options?: { value: string; label: string }[];
  min?: number;
  max?: number;
}

export interface Plugin {
  id: string;
  name: string;
  description: string;
  version: string;
  author: string;
  icon?: string;
  category: PluginCategory;
  enabled: boolean;
  installed: boolean;
  homepage?: string;
  repository?: string;
  privacyAccess: PluginPrivacyAccess[];
  settingsDefinitions?: PluginSettingDefinition[];
  settings?: Record<string, boolean | string | number>;
}

interface PluginState {
  plugins: Plugin[];
  /** Ordered plugin IDs (first = highest priority) */
  pluginOrder: string[];

  // Actions
  addPlugin: (plugin: Omit<Plugin, 'enabled' | 'installed'>) => void;
  removePlugin: (pluginId: string) => void;
  togglePlugin: (pluginId: string) => void;
  enablePlugin: (pluginId: string) => void;
  disablePlugin: (pluginId: string) => void;
  getPlugin: (pluginId: string) => Plugin | undefined;
  updatePluginSetting: (pluginId: string, key: string, value: boolean | string | number) => void;
  getPluginSettings: (pluginId: string) => Record<string, boolean | string | number> | undefined;
  /** Reorder plugins by moving from one index to another */
  reorderPlugins: (fromIndex: number, toIndex: number) => void;
  /** Get plugins sorted by user-defined order */
  getOrderedPlugins: () => Plugin[];
  /** Set the complete plugin order */
  setPluginOrder: (order: string[]) => void;
}

// Helper to notify main process of plugin settings changes
const notifySettingsChange = async (pluginId: string, settings: Record<string, boolean | string | number>) => {
  const addonId = pluginToAddonId[pluginId] || pluginId;
  if (window.api?.updateAddonSettings) {
    try {
      await window.api.updateAddonSettings(addonId, settings);
      console.log(`Plugin ${pluginId} settings updated`);
    } catch (error) {
      console.error(`Failed to update plugin ${pluginId} settings:`, error);
    }
  }
};

// Sample plugins for demo
const defaultPlugins: Plugin[] = [
  {
    id: 'deezer-metadata',
    name: 'Deezer Metadata',
    description: 'Provides high-quality metadata, album artwork, and track information from Deezer\'s extensive music database.',
    version: '1.0.0',
    author: 'Audiio Team',
    category: 'metadata',
    enabled: true,
    installed: true,
    privacyAccess: [
      { type: 'network', label: 'Network Access', description: 'Connects to Deezer API to fetch track metadata and artwork', required: true },
      { type: 'playback', label: 'Playback Info', description: 'Reads current track info to search for metadata', required: true },
    ],
    settingsDefinitions: [
      { key: 'fetchArtwork', label: 'Fetch Artwork', description: 'Fetch album and artist artwork from Deezer', type: 'boolean', default: true },
      { key: 'fetchArtistInfo', label: 'Fetch Artist Info', description: 'Fetch detailed artist information and artwork', type: 'boolean', default: true },
      { key: 'fetchAlbumInfo', label: 'Fetch Album Info', description: 'Fetch album metadata (release date, track count)', type: 'boolean', default: true },
      { key: 'fetchExternalIds', label: 'Fetch External IDs', description: 'Fetch ISRC and other external identifiers', type: 'boolean', default: true },
    ],
    settings: {
      fetchArtwork: true,
      fetchArtistInfo: true,
      fetchAlbumInfo: true,
      fetchExternalIds: true,
    }
  },
  {
    id: 'applemusic-artwork',
    name: 'Apple Music Artwork',
    description: 'Fetches animated album artwork from Apple Music. Disable Deezer artwork fetching to see animated artwork.',
    version: '1.0.0',
    author: 'Audiio Team',
    category: 'metadata',
    enabled: false,
    installed: true,
    privacyAccess: [
      { type: 'network', label: 'Network Access', description: 'Connects to iTunes API to search for albums and fetch artwork', required: true },
      { type: 'playback', label: 'Playback Info', description: 'Reads current track info to search for matching artwork', required: true },
    ],
    settingsDefinitions: [
      { key: 'artworkType', label: 'Artwork Type', description: 'Prefer animated or static artwork', type: 'select', default: 'animated', options: [
        { value: 'animated', label: 'Animated (Video)' },
        { value: 'static', label: 'Static (Image)' },
      ]},
      { key: 'aspectRatio', label: 'Aspect Ratio', description: 'Preferred aspect ratio for animated artwork', type: 'select', default: 'tall', options: [
        { value: 'tall', label: 'Tall (Portrait)' },
        { value: 'square', label: 'Square' },
      ]},
      { key: 'loopCount', label: 'Loop Count', description: 'Number of times to loop animated artwork', type: 'number', default: 2, min: 1, max: 10 },
      { key: 'includeAudio', label: 'Include Audio', description: 'Include audio track in animated artwork', type: 'boolean', default: false },
    ],
    settings: {
      artworkType: 'animated',
      aspectRatio: 'tall',
      loopCount: 2,
      includeAudio: false,
    }
  },
  {
    id: 'youtube-music',
    name: 'YouTube Music',
    description: 'Stream audio from YouTube Music. Access millions of tracks, official releases, and exclusive content.',
    version: '1.2.0',
    author: 'Audiio Team',
    category: 'streaming',
    enabled: true,
    installed: true,
    privacyAccess: [
      { type: 'network', label: 'Network Access', description: 'Streams audio content from YouTube servers', required: true },
      { type: 'playback', label: 'Playback Control', description: 'Controls audio playback and manages stream quality', required: true },
      { type: 'storage', label: 'Cache Storage', description: 'Caches audio data for smoother playback', required: false },
    ]
  },
  {
    id: 'lrclib-lyrics',
    name: 'LRCLIB Lyrics',
    description: 'Displays synchronized lyrics from LRCLIB, the open lyrics database. Supports both synced and plain lyrics.',
    version: '1.0.0',
    author: 'Audiio Team',
    category: 'lyrics',
    enabled: true,
    installed: true,
    privacyAccess: [
      { type: 'network', label: 'Network Access', description: 'Fetches lyrics from LRCLIB servers', required: true },
      { type: 'playback', label: 'Playback Info', description: 'Reads current track and position for lyrics sync', required: true },
    ]
  },
  {
    id: 'lastfm-scrobbler',
    name: 'Last.fm Scrobbler',
    description: 'Scrobble your listening history to Last.fm. Track your music taste and get personalized recommendations.',
    version: '2.0.0',
    author: 'Community',
    category: 'scrobbling',
    enabled: false,
    installed: true,
    privacyAccess: [
      { type: 'network', label: 'Network Access', description: 'Sends listening data to Last.fm servers', required: true },
      { type: 'playback', label: 'Playback History', description: 'Tracks what songs you listen to and for how long', required: true },
      { type: 'library', label: 'Library Access', description: 'Reads your liked songs for recommendations', required: false },
    ]
  },
  {
    id: 'spotify-metadata',
    name: 'Spotify Metadata',
    description: 'Enhanced metadata from Spotify including popularity scores, audio features (BPM, energy, key), and related artists for better ML recommendations.',
    version: '1.2.0',
    author: 'Audiio Team',
    category: 'metadata',
    enabled: false,
    installed: true,
    privacyAccess: [
      { type: 'network', label: 'Network Access', description: 'Connects to Spotify API for metadata and audio features', required: true },
      { type: 'playback', label: 'Playback Info', description: 'Reads current track for metadata lookup', required: true },
    ],
    settingsDefinitions: [
      { key: 'fetchAudioFeatures', label: 'Fetch Audio Features', description: 'Get BPM, energy, key, danceability for ML recommendations', type: 'boolean', default: true },
      { key: 'fetchPopularity', label: 'Fetch Popularity', description: 'Get track popularity scores from Spotify', type: 'boolean', default: true },
      { key: 'fetchSimilarTracks', label: 'Fetch Similar Tracks', description: 'Use Spotify recommendations for similar track discovery', type: 'boolean', default: true },
      { key: 'fetchArtistInfo', label: 'Fetch Artist Info', description: 'Get related artists and genre information', type: 'boolean', default: true },
      { key: 'cacheResults', label: 'Cache Results', description: 'Cache audio features locally for faster access', type: 'boolean', default: true },
    ],
    settings: {
      fetchAudioFeatures: true,
      fetchPopularity: true,
      fetchSimilarTracks: true,
      fetchArtistInfo: true,
      cacheResults: true,
    }
  },
  {
    id: 'local-audio-analysis',
    name: 'Local Audio Analysis',
    description: 'Analyze audio files locally for BPM, key, energy, and other features using FFmpeg. Works offline with no external API calls.',
    version: '1.0.0',
    author: 'Audiio Team',
    category: 'analysis',
    enabled: true,
    installed: true,
    privacyAccess: [
      { type: 'playback', label: 'Playback Info', description: 'Analyzes currently playing audio for features', required: true },
    ],
    settingsDefinitions: [
      { key: 'analyzeOnPlay', label: 'Analyze On Play', description: 'Automatically analyze tracks when they start playing', type: 'boolean', default: true },
      { key: 'analyzeBpm', label: 'Detect BPM', description: 'Detect tempo using beat detection algorithms', type: 'boolean', default: true },
      { key: 'analyzeKey', label: 'Detect Key', description: 'Detect musical key using chromagram analysis', type: 'boolean', default: true },
      { key: 'analyzeEnergy', label: 'Analyze Energy', description: 'Calculate energy, loudness, and danceability', type: 'boolean', default: true },
      { key: 'cacheResults', label: 'Cache Results', description: 'Store analysis results for faster access', type: 'boolean', default: true },
    ],
    settings: {
      analyzeOnPlay: true,
      analyzeBpm: true,
      analyzeKey: true,
      analyzeEnergy: true,
      cacheResults: true,
    }
  },
];

// Default plugin order (by ID)
const defaultPluginOrder = defaultPlugins.map(p => p.id);

export const usePluginStore = create<PluginState>()(
  persist(
    (set, get) => ({
      plugins: defaultPlugins,
      pluginOrder: defaultPluginOrder,

      addPlugin: (pluginData) => {
        const newPlugin: Plugin = {
          ...pluginData,
          enabled: false,
          installed: true,
        };
        set((state) => ({
          plugins: [...state.plugins, newPlugin],
          pluginOrder: [...state.pluginOrder, newPlugin.id],
        }));
      },

      removePlugin: (pluginId) => {
        set((state) => ({
          plugins: state.plugins.filter((p) => p.id !== pluginId),
          pluginOrder: state.pluginOrder.filter((id) => id !== pluginId),
        }));
      },

      togglePlugin: (pluginId) => {
        const plugin = get().plugins.find(p => p.id === pluginId);
        const newEnabled = plugin ? !plugin.enabled : false;

        set((state) => ({
          plugins: state.plugins.map((p) =>
            p.id === pluginId ? { ...p, enabled: newEnabled } : p
          ),
        }));

        // Notify main process of the change
        notifyMainProcess(pluginId, newEnabled);
      },

      enablePlugin: (pluginId) => {
        set((state) => ({
          plugins: state.plugins.map((p) =>
            p.id === pluginId ? { ...p, enabled: true } : p
          ),
        }));

        // Notify main process
        notifyMainProcess(pluginId, true);
      },

      disablePlugin: (pluginId) => {
        set((state) => ({
          plugins: state.plugins.map((p) =>
            p.id === pluginId ? { ...p, enabled: false } : p
          ),
        }));

        // Notify main process
        notifyMainProcess(pluginId, false);
      },

      getPlugin: (pluginId) => {
        return get().plugins.find((p) => p.id === pluginId);
      },

      updatePluginSetting: (pluginId, key, value) => {
        set((state) => ({
          plugins: state.plugins.map((p) => {
            if (p.id === pluginId) {
              const newSettings = { ...p.settings, [key]: value };
              return { ...p, settings: newSettings };
            }
            return p;
          }),
        }));

        // Get updated settings and notify main process
        const plugin = get().plugins.find(p => p.id === pluginId);
        if (plugin?.settings) {
          notifySettingsChange(pluginId, plugin.settings);
        }
      },

      getPluginSettings: (pluginId) => {
        const plugin = get().plugins.find((p) => p.id === pluginId);
        return plugin?.settings;
      },

      reorderPlugins: (fromIndex, toIndex) => {
        set((state) => {
          const newOrder = [...state.pluginOrder];
          const [movedId] = newOrder.splice(fromIndex, 1);
          if (movedId) {
            newOrder.splice(toIndex, 0, movedId);
          }
          // Notify main process of the change
          notifyOrderChange(newOrder);
          return { pluginOrder: newOrder };
        });
      },

      getOrderedPlugins: () => {
        const { plugins, pluginOrder } = get();
        // Sort plugins by order, with unordered plugins at the end
        const orderedPlugins = [...plugins].sort((a, b) => {
          const aIndex = pluginOrder.indexOf(a.id);
          const bIndex = pluginOrder.indexOf(b.id);
          // If not in order array, put at end
          if (aIndex === -1 && bIndex === -1) return 0;
          if (aIndex === -1) return 1;
          if (bIndex === -1) return -1;
          return aIndex - bIndex;
        });
        return orderedPlugins;
      },

      setPluginOrder: (order) => {
        set({ pluginOrder: order });
        notifyOrderChange(order);
      },
    }),
    {
      name: 'audiio-plugins',
      partialize: (state) => ({
        plugins: state.plugins.map(p => ({
          id: p.id,
          enabled: p.enabled,
          installed: p.installed,
          settings: p.settings,
        })),
        pluginOrder: state.pluginOrder,
      }),
      merge: (persisted, current) => {
        const persistedState = persisted as {
          plugins: Array<{ id: string; enabled: boolean; installed: boolean; settings?: Record<string, boolean | string | number> }>;
          pluginOrder?: string[];
        };
        return {
          ...current,
          plugins: current.plugins.map((plugin) => {
            const saved = persistedState?.plugins?.find((p) => p.id === plugin.id);
            if (saved) {
              return {
                ...plugin,
                enabled: saved.enabled,
                installed: saved.installed,
                settings: saved.settings ?? plugin.settings
              };
            }
            return plugin;
          }),
          pluginOrder: persistedState?.pluginOrder ?? current.pluginOrder,
        };
      },
      onRehydrateStorage: () => (state) => {
        // Sync plugin states with main process after rehydration
        if (state?.plugins) {
          // Small delay to ensure window.api is available
          setTimeout(() => {
            syncPluginStatesWithMainProcess(state.plugins, state.pluginOrder);
          }, 100);
        }
      },
    }
  )
);
