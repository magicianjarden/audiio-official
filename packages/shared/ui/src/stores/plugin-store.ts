/**
 * Plugin store - manages installed plugins dynamically
 * NO HARDCODED PLUGINS - everything comes from the backend
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { PrivacyManifest } from '@audiio/core';

// Plugin roles that determine capabilities
export type PluginRole =
  | 'metadata-provider'
  | 'stream-provider'
  | 'lyrics-provider'
  | 'scrobbler'
  | 'audio-processor'
  | 'tool';

// Map roles to UI-friendly categories
const roleToCategoryMap: Record<PluginRole, PluginCategory> = {
  'metadata-provider': 'metadata',
  'stream-provider': 'streaming',
  'lyrics-provider': 'lyrics',
  'scrobbler': 'scrobbling',
  'audio-processor': 'audio',
  'tool': 'tool',
};

export type PluginCategory = 'metadata' | 'streaming' | 'lyrics' | 'translation' | 'scrobbling' | 'analysis' | 'audio' | 'tool' | 'other';

export interface PluginPrivacyAccess {
  type: 'network' | 'storage' | 'playback' | 'library' | 'system';
  label: string;
  description: string;
  required: boolean;
}

export interface PluginSettingDefinition {
  key: string;
  label: string;
  description?: string;
  type: 'boolean' | 'select' | 'multiselect' | 'number' | 'string' | 'color';
  default?: boolean | string | number;
  required?: boolean;
  secret?: boolean;
  placeholder?: string;
  options?: { value: string; label: string }[];
  min?: number;
  max?: number;
  step?: number;
}

export interface Plugin {
  id: string;
  name: string;
  description: string;
  version: string;
  author: string;
  icon?: string;
  category: PluginCategory;
  roles: PluginRole[];
  enabled: boolean;
  installed: boolean;
  homepage?: string;
  repository?: string;
  /** Privacy transparency manifest (Apple-style privacy labels) */
  privacy?: PrivacyManifest;
  /** @deprecated Use privacy manifest instead */
  privacyAccess?: PluginPrivacyAccess[];
  settingsDefinitions?: PluginSettingDefinition[];
  settings?: Record<string, boolean | string | number>;
}

interface PluginState {
  plugins: Plugin[];
  pluginOrder: string[];
  /** Plugin settings stored by ID - persists even if plugin uninstalled */
  pluginSettings: Record<string, Record<string, boolean | string | number>>;
  /** Plugin enabled states stored by ID */
  pluginEnabledStates: Record<string, boolean>;

  // Core actions
  syncFromBackend: () => Promise<void>;
  togglePlugin: (pluginId: string) => void;
  enablePlugin: (pluginId: string) => void;
  disablePlugin: (pluginId: string) => void;

  // Queries
  getPlugin: (pluginId: string) => Plugin | undefined;
  getPluginsByRole: (role: PluginRole) => Plugin[];
  getInstalledPlugins: () => Plugin[];
  hasCapability: (role: PluginRole) => boolean;

  // Settings
  updatePluginSetting: (pluginId: string, key: string, value: boolean | string | number) => void;
  getPluginSettings: (pluginId: string) => Record<string, boolean | string | number> | undefined;

  // Uninstall
  removePlugin: (pluginId: string) => Promise<void>;

  // Ordering
  reorderPlugins: (fromIndex: number, toIndex: number) => void;
  getOrderedPlugins: () => Plugin[];
  setPluginOrder: (order: string[]) => void;
}

// Helper to notify main process of plugin state changes
const notifyMainProcess = async (pluginId: string, enabled: boolean) => {
  if (window.api?.setAddonEnabled) {
    try {
      await window.api.setAddonEnabled(pluginId, enabled);
      console.log(`[PluginStore] Plugin ${pluginId} ${enabled ? 'enabled' : 'disabled'}`);
    } catch (error) {
      console.error(`[PluginStore] Failed to ${enabled ? 'enable' : 'disable'} plugin ${pluginId}:`, error);
    }
  }
};

// Helper to notify main process of order changes
const notifyOrderChange = async (pluginOrder: string[]) => {
  if (window.api?.setAddonOrder) {
    try {
      await window.api.setAddonOrder(pluginOrder);
      console.log('[PluginStore] Plugin order updated');
    } catch (error) {
      console.error('[PluginStore] Failed to update plugin order:', error);
    }
  }
};

// Helper to notify main process of settings changes
const notifySettingsChange = async (pluginId: string, settings: Record<string, boolean | string | number>) => {
  if (window.api?.updateAddonSettings) {
    try {
      await window.api.updateAddonSettings(pluginId, settings);
      console.log(`[PluginStore] Plugin ${pluginId} settings updated`);
    } catch (error) {
      console.error(`[PluginStore] Failed to update plugin ${pluginId} settings:`, error);
    }
  }
};

// Derive category from roles
const getCategoryFromRoles = (roles: PluginRole[]): PluginCategory => {
  if (!roles || roles.length === 0) return 'other';
  const firstRole = roles[0];
  return roleToCategoryMap[firstRole] || 'other';
};

export const usePluginStore = create<PluginState>()(
  persist(
    (set, get) => ({
      plugins: [],
      pluginOrder: [],
      pluginSettings: {},
      pluginEnabledStates: {},

      syncFromBackend: async () => {
        if (!window.api?.getLoadedPlugins) {
          console.log('[PluginStore] API not available');
          return;
        }

        try {
          const loadedPlugins = await window.api.getLoadedPlugins();
          console.log('[PluginStore] Loaded', loadedPlugins.length, 'plugins from backend');

          const { pluginSettings, pluginEnabledStates } = get();

          // Transform backend plugins to UI format
          const plugins: Plugin[] = loadedPlugins.map((p: any) => ({
            id: p.id,
            name: p.name || p.id,
            description: p.description || '',
            version: p.version || '1.0.0',
            author: p.author || 'Unknown',
            icon: p.icon,
            category: getCategoryFromRoles(p.roles || []),
            roles: p.roles || [],
            enabled: pluginEnabledStates[p.id] ?? true, // Default to enabled
            installed: true,
            homepage: p.homepage,
            repository: p.repository,
            privacy: p.privacy,
            privacyAccess: p.privacyAccess,
            settingsDefinitions: p.settingsDefinitions,
            settings: pluginSettings[p.id] || p.settings || {},
          }));

          // Update order to include new plugins
          const currentOrder = get().pluginOrder;
          const newPluginIds = plugins.map(p => p.id).filter(id => !currentOrder.includes(id));
          const newOrder = [...currentOrder.filter(id => plugins.some(p => p.id === id)), ...newPluginIds];

          set({ plugins, pluginOrder: newOrder });

          // Sync enabled states with backend
          for (const plugin of plugins) {
            await notifyMainProcess(plugin.id, plugin.enabled);
          }

          // Sync order with backend
          if (newOrder.length > 0) {
            await notifyOrderChange(newOrder);
          }
        } catch (error) {
          console.error('[PluginStore] Failed to sync from backend:', error);
        }
      },

      togglePlugin: (pluginId) => {
        const plugin = get().plugins.find(p => p.id === pluginId);
        const newEnabled = plugin ? !plugin.enabled : false;

        set((state) => ({
          plugins: state.plugins.map((p) =>
            p.id === pluginId ? { ...p, enabled: newEnabled } : p
          ),
          pluginEnabledStates: {
            ...state.pluginEnabledStates,
            [pluginId]: newEnabled,
          },
        }));

        notifyMainProcess(pluginId, newEnabled);
      },

      enablePlugin: (pluginId) => {
        set((state) => ({
          plugins: state.plugins.map((p) =>
            p.id === pluginId ? { ...p, enabled: true } : p
          ),
          pluginEnabledStates: {
            ...state.pluginEnabledStates,
            [pluginId]: true,
          },
        }));
        notifyMainProcess(pluginId, true);
      },

      disablePlugin: (pluginId) => {
        set((state) => ({
          plugins: state.plugins.map((p) =>
            p.id === pluginId ? { ...p, enabled: false } : p
          ),
          pluginEnabledStates: {
            ...state.pluginEnabledStates,
            [pluginId]: false,
          },
        }));
        notifyMainProcess(pluginId, false);
      },

      getPlugin: (pluginId) => {
        return get().plugins.find((p) => p.id === pluginId);
      },

      getPluginsByRole: (role) => {
        return get().plugins.filter((p) => p.roles.includes(role) && p.enabled && p.installed);
      },

      getInstalledPlugins: () => {
        return get().plugins.filter((p) => p.installed);
      },

      hasCapability: (role) => {
        return get().plugins.some((p) => p.roles.includes(role) && p.enabled && p.installed);
      },

      updatePluginSetting: (pluginId, key, value) => {
        set((state) => {
          const newSettings = {
            ...state.pluginSettings[pluginId],
            [key]: value,
          };
          return {
            plugins: state.plugins.map((p) =>
              p.id === pluginId ? { ...p, settings: { ...p.settings, [key]: value } } : p
            ),
            pluginSettings: {
              ...state.pluginSettings,
              [pluginId]: newSettings,
            },
          };
        });

        // Notify backend
        const settings = get().pluginSettings[pluginId];
        if (settings) {
          notifySettingsChange(pluginId, settings);
        }
      },

      getPluginSettings: (pluginId) => {
        return get().pluginSettings[pluginId] || get().plugins.find(p => p.id === pluginId)?.settings;
      },

      removePlugin: async (pluginId) => {
        try {
          // Call backend to uninstall the plugin
          // The API is under repositories.uninstallPlugin
          if (window.api?.repositories?.uninstallPlugin) {
            const result = await window.api.repositories.uninstallPlugin(pluginId);
            if (!result.success) {
              throw new Error(result.error || 'Uninstall failed');
            }
            console.log(`[PluginStore] Plugin ${pluginId} uninstalled`);
          } else {
            console.warn('[PluginStore] No uninstall API available');
            throw new Error('Uninstall API not available');
          }

          // Remove from local state
          set((state) => ({
            plugins: state.plugins.filter((p) => p.id !== pluginId),
            pluginOrder: state.pluginOrder.filter((id) => id !== pluginId),
          }));
        } catch (error) {
          console.error(`[PluginStore] Failed to uninstall plugin ${pluginId}:`, error);
          throw error;
        }
      },

      reorderPlugins: (fromIndex, toIndex) => {
        set((state) => {
          const newOrder = [...state.pluginOrder];
          const [movedId] = newOrder.splice(fromIndex, 1);
          if (movedId) {
            newOrder.splice(toIndex, 0, movedId);
          }
          notifyOrderChange(newOrder);
          return { pluginOrder: newOrder };
        });
      },

      getOrderedPlugins: () => {
        const { plugins, pluginOrder } = get();
        return [...plugins].sort((a, b) => {
          const aIndex = pluginOrder.indexOf(a.id);
          const bIndex = pluginOrder.indexOf(b.id);
          if (aIndex === -1 && bIndex === -1) return 0;
          if (aIndex === -1) return 1;
          if (bIndex === -1) return -1;
          return aIndex - bIndex;
        });
      },

      setPluginOrder: (order) => {
        set({ pluginOrder: order });
        notifyOrderChange(order);
      },
    }),
    {
      name: 'audiio-plugins',
      partialize: (state) => ({
        pluginOrder: state.pluginOrder,
        pluginSettings: state.pluginSettings,
        pluginEnabledStates: state.pluginEnabledStates,
      }),
      onRehydrateStorage: () => (state) => {
        // Sync with backend after rehydration
        if (state) {
          setTimeout(() => {
            state.syncFromBackend();
          }, 100);
        }
      },
    }
  )
);
