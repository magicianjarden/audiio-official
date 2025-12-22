/**
 * UI store - manages player mode and panel states
 */

import { create } from 'zustand';
import type { UnifiedTrack } from '@audiio/core';

type PlayerMode = 'mini' | 'full';

interface UIState {
  // State
  playerMode: PlayerMode;
  isQueueOpen: boolean;
  isLyricsVisible: boolean;
  isLyricsPanelOpen: boolean;
  isLyricsPanelExpanded: boolean;
  queueAnchorRect: DOMRect | null;
  dislikeModalTrack: UnifiedTrack | null;

  // Actions
  expandPlayer: () => void;
  collapsePlayer: () => void;
  togglePlayer: () => void;
  openQueue: (anchorRect: DOMRect) => void;
  closeQueue: () => void;
  toggleQueue: (anchorRect?: DOMRect) => void;
  toggleLyrics: () => void;
  setLyricsVisible: (visible: boolean) => void;
  toggleLyricsPanel: () => void;
  openLyricsPanel: () => void;
  closeLyricsPanel: () => void;
  toggleLyricsPanelExpanded: () => void;
  openDislikeModal: (track: UnifiedTrack) => void;
  closeDislikeModal: () => void;
}

export type { PlayerMode };

export const useUIStore = create<UIState>((set, get) => ({
  // Initial state
  playerMode: 'mini',
  isQueueOpen: false,
  isLyricsVisible: false,
  isLyricsPanelOpen: false,
  isLyricsPanelExpanded: false,
  queueAnchorRect: null,

  // Actions
  expandPlayer: () => {
    set({ playerMode: 'full', isQueueOpen: false, isLyricsPanelOpen: false });
  },

  collapsePlayer: () => {
    set({ playerMode: 'mini' });
  },

  togglePlayer: () => {
    const { playerMode } = get();
    if (playerMode === 'mini') {
      set({ playerMode: 'full', isQueueOpen: false, isLyricsPanelOpen: false });
    } else {
      set({ playerMode: 'mini' });
    }
  },

  openQueue: (anchorRect) => {
    set({ isQueueOpen: true, queueAnchorRect: anchorRect, isLyricsPanelOpen: false });
  },

  closeQueue: () => {
    set({ isQueueOpen: false, queueAnchorRect: null });
  },

  toggleQueue: (anchorRect) => {
    const { isQueueOpen } = get();
    if (isQueueOpen) {
      set({ isQueueOpen: false, queueAnchorRect: null });
    } else if (anchorRect) {
      set({ isQueueOpen: true, queueAnchorRect: anchorRect, isLyricsPanelOpen: false });
    }
  },

  toggleLyrics: () => {
    set(state => ({ isLyricsVisible: !state.isLyricsVisible }));
  },

  setLyricsVisible: (visible) => {
    set({ isLyricsVisible: visible });
  },

  toggleLyricsPanel: () => {
    const { isLyricsPanelOpen } = get();
    set({ isLyricsPanelOpen: !isLyricsPanelOpen, isQueueOpen: false });
  },

  openLyricsPanel: () => {
    set({ isLyricsPanelOpen: true, isQueueOpen: false });
  },

  closeLyricsPanel: () => {
    set({ isLyricsPanelOpen: false, isLyricsPanelExpanded: false });
  },

  toggleLyricsPanelExpanded: () => {
    set(state => ({ isLyricsPanelExpanded: !state.isLyricsPanelExpanded }));
  }
}));
