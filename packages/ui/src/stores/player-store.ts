/**
 * Player store - manages playback state
 */

import { create } from 'zustand';
import type { UnifiedTrack, StreamInfo } from '@audiio/core';

type RepeatMode = 'off' | 'all' | 'one';

interface PlayerState {
  // State
  currentTrack: UnifiedTrack | null;
  queue: UnifiedTrack[];
  queueIndex: number;
  isPlaying: boolean;
  position: number;     // Current position in ms
  duration: number;     // Total duration in ms
  volume: number;       // 0-1
  isMuted: boolean;
  isLoading: boolean;
  error: string | null;
  shuffle: boolean;
  repeat: RepeatMode;

  // Actions
  play: (track: UnifiedTrack) => Promise<void>;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  seek: (position: number) => void;
  next: () => Promise<void>;
  previous: () => Promise<void>;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  setQueue: (tracks: UnifiedTrack[], startIndex?: number) => void;
  addToQueue: (track: UnifiedTrack) => void;
  playNext: (track: UnifiedTrack) => void;
  removeFromQueue: (trackId: string) => void;
  setPosition: (position: number) => void;
  setIsPlaying: (isPlaying: boolean) => void;
  setStreamInfo: (track: UnifiedTrack, streamInfo: StreamInfo) => void;
  clearError: () => void;
  toggleShuffle: () => void;
  cycleRepeat: () => void;
  reorderQueue: (fromIndex: number, toIndex: number) => void;
}

export type { RepeatMode };

export const usePlayerStore = create<PlayerState>((set, get) => ({
  // Initial state
  currentTrack: null,
  queue: [],
  queueIndex: -1,
  isPlaying: false,
  position: 0,
  duration: 0,
  volume: 1,
  isMuted: false,
  isLoading: false,
  error: null,
  shuffle: false,
  repeat: 'off' as RepeatMode,

  // Actions
  play: async (track) => {
    set({ isLoading: true, error: null });

    try {
      // Check if track already has streamInfo (e.g., local files)
      // Local tracks have streamInfo pre-populated with local-audio:// URLs
      const isLocalTrack = track.id.startsWith('local:') || track._meta?.metadataProvider === 'local-file';

      if (isLocalTrack && track.streamInfo?.url) {
        // Use existing streamInfo for local tracks
        console.log('[PlayerStore] Playing local track with existing streamInfo:', track.streamInfo.url);
        set({
          currentTrack: track,
          isPlaying: true,
          duration: track.duration * 1000,
          position: 0,
          isLoading: false
        });

        // Update queue index if track is in queue
        const { queue } = get();
        const index = queue.findIndex(t => t.id === track.id);
        if (index !== -1) {
          set({ queueIndex: index });
          setTimeout(() => {
            window.dispatchEvent(new CustomEvent('audiio:check-auto-queue'));
          }, 100);
        }
      } else if (window.api) {
        // Request stream resolution via IPC (Electron) for remote tracks
        const streamInfo = await window.api.playTrack(track) as StreamInfo;
        const updatedTrack = { ...track, streamInfo };

        set({
          currentTrack: updatedTrack,
          isPlaying: true,
          duration: track.duration * 1000,
          position: 0,
          isLoading: false
        });

        // Update queue index if track is in queue
        const { queue } = get();
        const index = queue.findIndex(t => t.id === track.id);
        if (index !== -1) {
          set({ queueIndex: index });
          // Trigger auto-queue check when playing from queue
          setTimeout(() => {
            window.dispatchEvent(new CustomEvent('audiio:check-auto-queue'));
          }, 100);
        }
      } else {
        // Fallback for development without Electron
        set({
          currentTrack: track,
          isPlaying: true,
          duration: track.duration * 1000,
          position: 0,
          isLoading: false
        });

        // Update queue index if track is in queue
        const { queue } = get();
        const index = queue.findIndex(t => t.id === track.id);
        if (index !== -1) {
          set({ queueIndex: index });
          // Trigger auto-queue check when playing from queue
          setTimeout(() => {
            window.dispatchEvent(new CustomEvent('audiio:check-auto-queue'));
          }, 100);
        }
      }
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Playback failed',
        isLoading: false
      });
    }
  },

  pause: () => {
    set({ isPlaying: false });
    if (window.api) {
      window.api.pause();
    }
  },

  resume: () => {
    const { currentTrack } = get();
    if (currentTrack) {
      set({ isPlaying: true });
      if (window.api) {
        window.api.resume();
      }
    }
  },

  stop: () => {
    set({ isPlaying: false, position: 0 });
  },

  seek: (position) => {
    set({ position });
    if (window.api) {
      window.api.seek(position);
    }
  },

  next: async () => {
    const { queue, queueIndex, play, shuffle, repeat } = get();

    if (repeat === 'one') {
      // Repeat current track
      const currentTrack = queue[queueIndex];
      if (currentTrack) {
        await play(currentTrack);
      }
      return;
    }

    let nextIndex = queueIndex + 1;

    if (shuffle) {
      // Pick random track from queue (excluding current)
      const availableIndices = queue.map((_, i) => i).filter(i => i !== queueIndex);
      if (availableIndices.length > 0) {
        nextIndex = availableIndices[Math.floor(Math.random() * availableIndices.length)]!;
      }
    }

    if (nextIndex < queue.length) {
      const nextTrack = queue[nextIndex];
      if (nextTrack) {
        await play(nextTrack);
      }
    } else if (repeat === 'all' && queue.length > 0) {
      // Loop back to start
      const firstTrack = queue[0];
      if (firstTrack) {
        await play(firstTrack);
      }
    }

    // Trigger auto-queue check (handled by smart-queue-store listeners)
    // Using setTimeout to avoid blocking the playback
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('audiio:check-auto-queue'));
    }, 100);
  },

  previous: async () => {
    const { queue, queueIndex, position, play, seek } = get();

    // If more than 3 seconds in, restart current track
    if (position > 3000) {
      seek(0);
      return;
    }

    if (queueIndex > 0) {
      const prevTrack = queue[queueIndex - 1];
      if (prevTrack) {
        await play(prevTrack);
      }
    }
  },

  setVolume: (volume) => {
    set({ volume: Math.max(0, Math.min(1, volume)), isMuted: false });
  },

  toggleMute: () => {
    set(state => ({ isMuted: !state.isMuted }));
  },

  setQueue: (tracks, startIndex = 0) => {
    set({ queue: tracks, queueIndex: startIndex });
  },

  addToQueue: (track) => {
    set(state => ({ queue: [...state.queue, track] }));
  },

  playNext: (track) => {
    set(state => {
      // Insert after current track
      const insertPosition = state.queueIndex + 1;
      const newQueue = [
        ...state.queue.slice(0, insertPosition),
        track,
        ...state.queue.slice(insertPosition)
      ];
      return { queue: newQueue };
    });
  },

  removeFromQueue: (trackId) => {
    set(state => {
      const trackIndex = state.queue.findIndex(t => t.id === trackId);
      if (trackIndex === -1) return state;

      const newQueue = state.queue.filter(t => t.id !== trackId);

      // Adjust queueIndex if needed
      let newQueueIndex = state.queueIndex;
      if (trackIndex < state.queueIndex) {
        newQueueIndex = state.queueIndex - 1;
      } else if (trackIndex === state.queueIndex) {
        // Don't allow removing current track
        return state;
      }

      return { queue: newQueue, queueIndex: newQueueIndex };
    });
  },

  setPosition: (position) => {
    set({ position });
  },

  setIsPlaying: (isPlaying) => {
    set({ isPlaying });
  },

  setStreamInfo: (track, streamInfo) => {
    set(state => {
      if (state.currentTrack?.id === track.id) {
        return { currentTrack: { ...state.currentTrack, streamInfo } };
      }
      return state;
    });
  },

  clearError: () => {
    set({ error: null });
  },

  toggleShuffle: () => {
    set(state => ({ shuffle: !state.shuffle }));
  },

  cycleRepeat: () => {
    set(state => {
      const modes: RepeatMode[] = ['off', 'all', 'one'];
      const currentIndex = modes.indexOf(state.repeat);
      const nextIndex = (currentIndex + 1) % modes.length;
      return { repeat: modes[nextIndex] };
    });
  },

  reorderQueue: (fromIndex: number, toIndex: number) => {
    set(state => {
      // Convert relative indices (from "up next" list) to absolute queue indices
      const absoluteFrom = state.queueIndex + 1 + fromIndex;
      const absoluteTo = state.queueIndex + 1 + toIndex;

      const newQueue = [...state.queue];
      const [removed] = newQueue.splice(absoluteFrom, 1);
      if (removed) {
        newQueue.splice(absoluteTo, 0, removed);
      }

      return { queue: newQueue };
    });
  }
}));
