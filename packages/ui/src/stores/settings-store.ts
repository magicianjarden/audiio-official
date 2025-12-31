/**
 * Settings Store - App configuration and folder paths
 * Persisted to localStorage with sync to main process
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface LocalMusicFolder {
  id: string;
  path: string;
  name: string;
  trackCount: number;
  lastScanned: number | null;
  isScanning: boolean;
}

export type DemucsModelType = 'htdemucs' | 'htdemucs_6s';

export interface DemucsResourceConfig {
  /** Use local files from public/demucs if available */
  useLocalFiles: boolean;
  /** Custom CDN base URL (defaults to local or fallback) */
  cdnBaseUrl: string | null;
  /** Preferred model */
  preferredModel: DemucsModelType;
  /** Enable HQ mode by default when available */
  autoEnableHQ: boolean;
}

interface SettingsState {
  // Folder paths
  downloadFolder: string | null;
  pluginFolder: string | null;
  localMusicFolders: LocalMusicFolder[];

  // Playback settings
  crossfadeEnabled: boolean;
  crossfadeDuration: number; // seconds
  normalizeVolume: boolean;

  // Download settings
  downloadQuality: 'high' | 'medium' | 'low';
  autoDownloadLikes: boolean;

  // Demucs / Vocal Removal settings
  demucsConfig: DemucsResourceConfig;

  // Demucs Component (optional install)
  demucsInstalled: boolean;
  demucsEnabled: boolean;
  demucsVersion: string | null;

  // Actions
  setDownloadFolder: (path: string | null) => void;
  setPluginFolder: (path: string | null) => void;
  addLocalMusicFolder: (folder: Omit<LocalMusicFolder, 'id' | 'trackCount' | 'lastScanned' | 'isScanning'>) => void;
  removeLocalMusicFolder: (id: string) => void;
  updateLocalMusicFolder: (id: string, updates: Partial<LocalMusicFolder>) => void;
  setCrossfadeEnabled: (enabled: boolean) => void;
  setCrossfadeDuration: (duration: number) => void;
  setNormalizeVolume: (enabled: boolean) => void;
  setDownloadQuality: (quality: 'high' | 'medium' | 'low') => void;
  setAutoDownloadLikes: (enabled: boolean) => void;
  updateDemucsConfig: (updates: Partial<DemucsResourceConfig>) => void;
  setDemucsInstalled: (installed: boolean) => void;
  setDemucsEnabled: (enabled: boolean) => void;
  setDemucsVersion: (version: string | null) => void;
}

// Generate unique ID for folders
const generateId = () => `folder-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

// Sync settings with main process
const syncWithMainProcess = async (key: string, value: unknown) => {
  if (window.api?.updateSettings) {
    try {
      await window.api.updateSettings(key, value);
    } catch (error) {
      console.error(`Failed to sync setting ${key}:`, error);
    }
  }
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      // Initial state
      downloadFolder: null, // null = use system default
      pluginFolder: null,
      localMusicFolders: [],

      crossfadeEnabled: false,
      crossfadeDuration: 3,
      normalizeVolume: true,

      downloadQuality: 'high',
      autoDownloadLikes: false,

      demucsConfig: {
        useLocalFiles: true, // Try local public/demucs first
        cdnBaseUrl: null, // null = use local or fallback
        preferredModel: 'htdemucs',
        autoEnableHQ: true,
      },

      // Demucs Component state
      demucsInstalled: false,
      demucsEnabled: true, // Enabled by default when installed
      demucsVersion: null,

      // Actions
      setDownloadFolder: (path) => {
        set({ downloadFolder: path });
        syncWithMainProcess('downloadFolder', path);
      },

      setPluginFolder: (path) => {
        set({ pluginFolder: path });
        syncWithMainProcess('pluginFolder', path);
      },

      addLocalMusicFolder: (folder) => {
        const newFolder: LocalMusicFolder = {
          ...folder,
          id: generateId(),
          trackCount: 0,
          lastScanned: null,
          isScanning: false,
        };
        set((state) => ({
          localMusicFolders: [...state.localMusicFolders, newFolder],
        }));
        syncWithMainProcess('localMusicFolders', get().localMusicFolders);
      },

      removeLocalMusicFolder: (id) => {
        set((state) => ({
          localMusicFolders: state.localMusicFolders.filter((f) => f.id !== id),
        }));
        syncWithMainProcess('localMusicFolders', get().localMusicFolders);
      },

      updateLocalMusicFolder: (id, updates) => {
        set((state) => ({
          localMusicFolders: state.localMusicFolders.map((f) =>
            f.id === id ? { ...f, ...updates } : f
          ),
        }));
      },

      setCrossfadeEnabled: (enabled) => {
        set({ crossfadeEnabled: enabled });
      },

      setCrossfadeDuration: (duration) => {
        set({ crossfadeDuration: duration });
      },

      setNormalizeVolume: (enabled) => {
        set({ normalizeVolume: enabled });
      },

      setDownloadQuality: (quality) => {
        set({ downloadQuality: quality });
      },

      setAutoDownloadLikes: (enabled) => {
        set({ autoDownloadLikes: enabled });
      },

      updateDemucsConfig: (updates) => {
        set((state) => ({
          demucsConfig: { ...state.demucsConfig, ...updates },
        }));
        syncWithMainProcess('demucsConfig', get().demucsConfig);
      },

      setDemucsInstalled: (installed) => {
        set({ demucsInstalled: installed });
        syncWithMainProcess('demucsInstalled', installed);
      },

      setDemucsEnabled: (enabled) => {
        set({ demucsEnabled: enabled });
        syncWithMainProcess('demucsEnabled', enabled);
      },

      setDemucsVersion: (version) => {
        set({ demucsVersion: version });
        syncWithMainProcess('demucsVersion', version);
      },
    }),
    {
      name: 'audiio-settings',
      partialize: (state) => ({
        downloadFolder: state.downloadFolder,
        pluginFolder: state.pluginFolder,
        localMusicFolders: state.localMusicFolders.map((f) => ({
          ...f,
          isScanning: false, // Don't persist scanning state
        })),
        crossfadeEnabled: state.crossfadeEnabled,
        crossfadeDuration: state.crossfadeDuration,
        normalizeVolume: state.normalizeVolume,
        downloadQuality: state.downloadQuality,
        autoDownloadLikes: state.autoDownloadLikes,
        demucsConfig: state.demucsConfig,
        demucsInstalled: state.demucsInstalled,
        demucsEnabled: state.demucsEnabled,
        demucsVersion: state.demucsVersion,
      }),
    }
  )
);
