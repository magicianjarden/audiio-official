/**
 * Karaoke Store - Apple Music "Sing" style karaoke mode
 *
 * Features:
 * - Vocal reduction slider (0 = full vocals, 1 = no vocals)
 * - Processing handled by KaraokeProcessor addon via IPC
 */

import { create } from 'zustand';

export type KaraokeQualityMode = 'auto' | 'quality' | 'balanced' | 'fast';

interface KaraokeState {
  // State
  isAvailable: boolean;      // Server is running and responsive
  isEnabled: boolean;        // User has enabled karaoke mode
  isProcessing: boolean;     // Currently processing a track
  vocalReduction: number;    // 0-1, how much to reduce vocals (1 = full karaoke)
  qualityMode: KaraokeQualityMode; // Quality/speed tradeoff
  processedTracks: Set<string>; // Track IDs with cached instrumentals
  currentInstrumentalUrl: string | null; // Current track's instrumental URL

  // Legacy aliases for existing code compatibility
  isVocalRemovalEnabled: boolean; // Alias for isEnabled

  // Actions
  setAvailable: (available: boolean) => void;
  toggle: () => void;
  toggleVocalRemoval: () => void; // Alias for toggle
  enable: () => void;
  disable: () => void;
  setProcessing: (processing: boolean) => void;
  setVocalReduction: (level: number) => void;
  setQualityMode: (mode: KaraokeQualityMode) => void;
  addProcessedTrack: (trackId: string) => void;
  setCurrentInstrumentalUrl: (url: string | null) => void;
  reset: () => void;
}

export const useKaraokeStore = create<KaraokeState>()((set, get) => ({
  // Initial state
  isAvailable: false,
  isEnabled: false,
  isProcessing: false,
  vocalReduction: 1, // Default to full karaoke when enabled
  qualityMode: 'auto', // Auto-detect best settings
  processedTracks: new Set(),
  currentInstrumentalUrl: null,

  // Computed alias
  get isVocalRemovalEnabled() {
    return get().isEnabled;
  },

  // Actions
  setAvailable: (available) => {
    set({ isAvailable: available });
    // Disable karaoke if server becomes unavailable
    if (!available && get().isEnabled) {
      set({ isEnabled: false, isProcessing: false });
    }
  },

  toggle: () => {
    const { isAvailable, isEnabled } = get();
    if (!isAvailable) return;
    set({ isEnabled: !isEnabled });
    if (isEnabled) {
      // Disabling - reset processing state
      set({ isProcessing: false, currentInstrumentalUrl: null });
    }
  },

  toggleVocalRemoval: () => {
    get().toggle();
  },

  enable: () => {
    if (get().isAvailable) {
      set({ isEnabled: true });
    }
  },

  disable: () => {
    set({ isEnabled: false, isProcessing: false, currentInstrumentalUrl: null });
  },

  setProcessing: (processing) => {
    set({ isProcessing: processing });
  },

  setVocalReduction: (level) => {
    set({ vocalReduction: Math.max(0, Math.min(1, level)) });
  },

  setQualityMode: (mode) => {
    set({ qualityMode: mode });
  },

  addProcessedTrack: (trackId) => {
    set((state) => ({
      processedTracks: new Set(state.processedTracks).add(trackId)
    }));
  },

  setCurrentInstrumentalUrl: (url) => {
    set({ currentInstrumentalUrl: url });
  },

  reset: () => {
    set({
      isEnabled: false,
      isProcessing: false,
      vocalReduction: 1,
      qualityMode: 'auto',
      currentInstrumentalUrl: null
    });
  }
}));

export default useKaraokeStore;
