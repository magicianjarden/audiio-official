/**
 * Plugin Store - Manages plugin state for mobile
 *
 * Syncs with desktop via REST API endpoints.
 * Provides UI state for plugin management on mobile.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { apiFetch } from './auth-store';

// Plugin category colors (matching desktop)
export const CATEGORY_COLORS: Record<string, string> = {
  metadata: '#8b5cf6',    // purple
  streaming: '#ef4444',   // red
  lyrics: '#3b82f6',      // blue
  translation: '#3b82f6', // blue
  scrobbling: '#f59e0b',  // amber
  analysis: '#10b981',    // green
  other: '#6b7280'        // gray
};

export interface PluginSettingDefinition {
  key: string;
  label: string;
  description: string;
  type: 'boolean' | 'select' | 'number' | 'string';
  default: boolean | string | number;
  options?: { value: string; label: string }[];
  min?: number;
  max?: number;
}

export interface Plugin {
  id: string;
  name: string;
  description?: string;
  version?: string;
  author?: string;
  category?: string;
  roles: string[];
  enabled: boolean;
  settings?: Record<string, unknown>;
  settingsDefinitions?: PluginSettingDefinition[];
}

interface PluginState {
  plugins: Plugin[];
  isLoading: boolean;
  error: string | null;
  selectedPluginId: string | null;

  // Actions
  fetchPlugins: () => Promise<void>;
  selectPlugin: (id: string | null) => void;
  togglePlugin: (id: string) => Promise<boolean>;
  updatePluginSettings: (id: string, settings: Record<string, unknown>) => Promise<boolean>;
  getPlugin: (id: string) => Plugin | undefined;
  reorderPlugins: (orderedIds: string[]) => Promise<boolean>;
}

// Plugin metadata definitions (matches desktop)
const PLUGIN_METADATA: Record<string, Partial<Plugin>> = {
  'deezer': {
    name: 'Deezer',
    description: 'Stream music and get metadata from Deezer',
    version: '1.0.0',
    author: 'Audiio',
    category: 'metadata',
    settingsDefinitions: [
      { key: 'fetchArtwork', label: 'Fetch Artwork', description: 'Download album and artist artwork', type: 'boolean', default: true },
      { key: 'fetchArtistInfo', label: 'Fetch Artist Info', description: 'Get detailed artist information', type: 'boolean', default: true },
      { key: 'fetchAlbumInfo', label: 'Fetch Album Info', description: 'Get detailed album information', type: 'boolean', default: true },
      { key: 'fetchExternalIds', label: 'Fetch External IDs', description: 'Get ISRC and other identifiers', type: 'boolean', default: true }
    ]
  },
  'lrclib': {
    name: 'LRCLib Lyrics',
    description: 'Fetch synchronized lyrics from LRCLib',
    version: '1.0.0',
    author: 'Audiio',
    category: 'lyrics'
  },
  'youtube-music': {
    name: 'YouTube Music',
    description: 'Stream audio from YouTube Music',
    version: '1.0.0',
    author: 'Audiio',
    category: 'streaming'
  },
  'spotify-metadata': {
    name: 'Spotify Metadata',
    description: 'Get metadata from Spotify',
    version: '1.0.0',
    author: 'Audiio',
    category: 'metadata'
  },
  'applemusic-artwork': {
    name: 'Apple Music Artwork',
    description: 'High-quality artwork from Apple Music',
    version: '1.0.0',
    author: 'Audiio',
    category: 'metadata'
  },
  'lastfm-scrobbler': {
    name: 'Last.fm Scrobbler',
    description: 'Scrobble tracks to Last.fm',
    version: '1.0.0',
    author: 'Audiio',
    category: 'scrobbling'
  },
  'audiio-algo': {
    name: 'Audiio Algorithm',
    description: 'ML-powered recommendations and audio analysis',
    version: '1.0.0',
    author: 'Audiio',
    category: 'analysis'
  },
  'sposify': {
    name: 'Sposify',
    description: 'Spotify integration for discovery',
    version: '1.0.0',
    author: 'Audiio',
    category: 'streaming'
  }
};

export const usePluginStore = create<PluginState>()(
  persist(
    (set, get) => ({
      plugins: [],
      isLoading: false,
      error: null,
      selectedPluginId: null,

      fetchPlugins: async () => {
        set({ isLoading: true, error: null });

        try {
          // Fetch plugin list
          const response = await apiFetch('/api/addons');
          if (!response.ok) {
            throw new Error('Failed to fetch plugins');
          }

          const data = await response.json();
          const addons = data.addons || [];

          // Fetch settings for each plugin
          const pluginsWithSettings = await Promise.all(
            addons.map(async (addon: { id: string; name: string; roles: string[]; enabled: boolean }) => {
              const metadata = PLUGIN_METADATA[addon.id] || {};
              let settings: Record<string, unknown> | undefined;

              // Try to fetch settings for this addon
              try {
                const settingsRes = await apiFetch(`/api/addons/${addon.id}/settings`);
                if (settingsRes.ok) {
                  const settingsData = await settingsRes.json();
                  settings = settingsData.settings || undefined;
                }
              } catch {
                // Settings not available
              }

              return {
                id: addon.id,
                name: metadata.name || addon.name,
                description: metadata.description,
                version: metadata.version,
                author: metadata.author,
                category: metadata.category || getCategoryFromRoles(addon.roles),
                roles: addon.roles,
                enabled: addon.enabled,
                settings,
                settingsDefinitions: metadata.settingsDefinitions
              } as Plugin;
            })
          );

          set({ plugins: pluginsWithSettings, isLoading: false });
        } catch (error) {
          console.error('[PluginStore] Fetch error:', error);
          set({ error: String(error), isLoading: false });
        }
      },

      selectPlugin: (id) => {
        set({ selectedPluginId: id });
      },

      togglePlugin: async (id) => {
        const plugin = get().plugins.find(p => p.id === id);
        if (!plugin) return false;

        const newEnabled = !plugin.enabled;

        // Optimistic update
        set({
          plugins: get().plugins.map(p =>
            p.id === id ? { ...p, enabled: newEnabled } : p
          )
        });

        try {
          const response = await apiFetch(`/api/addons/${id}/enabled`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ enabled: newEnabled })
          });

          if (!response.ok) {
            throw new Error('Failed to toggle plugin');
          }

          return true;
        } catch (error) {
          console.error('[PluginStore] Toggle error:', error);
          // Revert on failure
          set({
            plugins: get().plugins.map(p =>
              p.id === id ? { ...p, enabled: !newEnabled } : p
            )
          });
          return false;
        }
      },

      updatePluginSettings: async (id, settings) => {
        try {
          const response = await apiFetch(`/api/addons/${id}/settings`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ settings })
          });

          if (!response.ok) {
            throw new Error('Failed to update settings');
          }

          const data = await response.json();

          // Update local state
          set({
            plugins: get().plugins.map(p =>
              p.id === id ? { ...p, settings: data.settings || settings } : p
            )
          });

          return true;
        } catch (error) {
          console.error('[PluginStore] Settings update error:', error);
          return false;
        }
      },

      getPlugin: (id) => {
        return get().plugins.find(p => p.id === id);
      },

      reorderPlugins: async (orderedIds) => {
        try {
          const response = await apiFetch('/api/addons/order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ orderedIds })
          });

          if (!response.ok) {
            throw new Error('Failed to reorder plugins');
          }

          // Reorder local state
          const { plugins } = get();
          const orderedPlugins = orderedIds
            .map(id => plugins.find(p => p.id === id))
            .filter((p): p is Plugin => p !== undefined);

          // Add any plugins not in the order list at the end
          const remaining = plugins.filter(p => !orderedIds.includes(p.id));
          set({ plugins: [...orderedPlugins, ...remaining] });

          return true;
        } catch (error) {
          console.error('[PluginStore] Reorder error:', error);
          return false;
        }
      }
    }),
    {
      name: 'audiio-mobile-plugins',
      partialize: (state) => ({
        plugins: state.plugins.map(p => ({
          id: p.id,
          enabled: p.enabled,
          settings: p.settings
        }))
      })
    }
  )
);

// Helper to infer category from roles
function getCategoryFromRoles(roles: string[]): string {
  if (roles.includes('metadata-provider')) return 'metadata';
  if (roles.includes('stream-provider')) return 'streaming';
  if (roles.includes('lyrics-provider')) return 'lyrics';
  if (roles.includes('scrobbler')) return 'scrobbling';
  return 'other';
}

// Selectors for fine-grained updates
export const usePlugins = () => usePluginStore(state => state.plugins);
export const useSelectedPlugin = () => {
  const selectedId = usePluginStore(state => state.selectedPluginId);
  const plugins = usePluginStore(state => state.plugins);
  return plugins.find(p => p.id === selectedId);
};
export const usePluginLoading = () => usePluginStore(state => state.isLoading);
