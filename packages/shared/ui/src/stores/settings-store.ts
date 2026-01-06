/**
 * Settings Store - Client-side preferences only
 *
 * Media folders and downloads are managed server-side via library-store.
 * This store handles playback preferences and other client-local settings.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SettingsState {
  // Playback settings
  crossfadeEnabled: boolean;
  crossfadeDuration: number; // seconds
  normalizeVolume: boolean;

  // Download quality preference (client preference, used when initiating downloads)
  downloadQuality: 'high' | 'medium' | 'low';
  autoDownloadLikes: boolean;

  // Actions
  setCrossfadeEnabled: (enabled: boolean) => void;
  setCrossfadeDuration: (duration: number) => void;
  setNormalizeVolume: (enabled: boolean) => void;
  setDownloadQuality: (quality: 'high' | 'medium' | 'low') => void;
  setAutoDownloadLikes: (enabled: boolean) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      // Initial state - playback preferences
      crossfadeEnabled: false,
      crossfadeDuration: 3,
      normalizeVolume: true,

      downloadQuality: 'high',
      autoDownloadLikes: false,

      // Actions
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
    }),
    {
      name: 'audiio-settings',
      partialize: (state) => ({
        crossfadeEnabled: state.crossfadeEnabled,
        crossfadeDuration: state.crossfadeDuration,
        normalizeVolume: state.normalizeVolume,
        downloadQuality: state.downloadQuality,
        autoDownloadLikes: state.autoDownloadLikes,
      }),
    }
  )
);
