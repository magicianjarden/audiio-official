/**
 * UI store - manages player mode and panel states
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { UnifiedTrack } from '@audiio/core';

type PlayerMode = 'mini' | 'full';
type SidebarTab = 'playlists' | 'collections' | 'tags';

interface UIState {
  // State
  playerMode: PlayerMode;
  isQueueOpen: boolean;
  isLyricsVisible: boolean;
  isLyricsPanelOpen: boolean;
  isLyricsPanelExpanded: boolean;
  queueAnchorRect: DOMRect | null;
  dislikeModalTrack: UnifiedTrack | null;

  // Sidebar state
  isSidebarCollapsed: boolean;
  sidebarWidth: number;
  sidebarActiveTab: SidebarTab;
  // Legacy - kept for backwards compatibility
  isPlaylistsExpanded: boolean;
  isTagsExpanded: boolean;
  isCollectionsExpanded: boolean;

  // Inline creation state
  isCreatingPlaylist: boolean;
  isCreatingTag: boolean;
  isCreatingCollection: boolean;

  // Create modal state (legacy - for folder creation)
  isCreatePlaylistModalOpen: boolean;
  isCreateFolderModalOpen: boolean;

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

  // Create modal actions
  openCreatePlaylistModal: () => void;
  closeCreatePlaylistModal: () => void;
  openCreateFolderModal: () => void;
  closeCreateFolderModal: () => void;

  // Sidebar actions
  toggleSidebar: () => void;
  collapseSidebar: () => void;
  expandSidebar: () => void;
  setSidebarWidth: (width: number) => void;
  setSidebarActiveTab: (tab: SidebarTab) => void;
  togglePlaylistsExpanded: () => void;
  toggleTagsExpanded: () => void;
  toggleCollectionsExpanded: () => void;

  // Inline creation actions
  startCreatingPlaylist: () => void;
  stopCreatingPlaylist: () => void;
  startCreatingTag: () => void;
  stopCreatingTag: () => void;
  startCreatingCollection: () => void;
  stopCreatingCollection: () => void;
}

export type { PlayerMode, SidebarTab };

export const useUIStore = create<UIState>()(
  persist(
    (set, get) => ({
      // Initial state
      playerMode: 'mini',
      isQueueOpen: false,
      isLyricsVisible: false,
      isLyricsPanelOpen: false,
      isLyricsPanelExpanded: false,
      queueAnchorRect: null,
      dislikeModalTrack: null,

      // Sidebar state
      isSidebarCollapsed: false,
      sidebarWidth: 260,
      sidebarActiveTab: 'playlists',
      // Legacy - kept for backwards compatibility
      isPlaylistsExpanded: true,
      isTagsExpanded: false,
      isCollectionsExpanded: false,

      // Inline creation state
      isCreatingPlaylist: false,
      isCreatingTag: false,
      isCreatingCollection: false,

      // Create modal state (legacy - for folder creation)
      isCreatePlaylistModalOpen: false,
      isCreateFolderModalOpen: false,

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
      },

      openDislikeModal: (track) => {
        set({ dislikeModalTrack: track });
      },

      closeDislikeModal: () => {
        set({ dislikeModalTrack: null });
      },

      // Create modal actions
      openCreatePlaylistModal: () => {
        set({ isCreatePlaylistModalOpen: true });
      },

      closeCreatePlaylistModal: () => {
        set({ isCreatePlaylistModalOpen: false });
      },

      openCreateFolderModal: () => {
        set({ isCreateFolderModalOpen: true });
      },

      closeCreateFolderModal: () => {
        set({ isCreateFolderModalOpen: false });
      },

      // Sidebar actions
      toggleSidebar: () => {
        set(state => ({ isSidebarCollapsed: !state.isSidebarCollapsed }));
      },

      collapseSidebar: () => {
        set({ isSidebarCollapsed: true });
      },

      expandSidebar: () => {
        set({ isSidebarCollapsed: false });
      },

      setSidebarWidth: (width: number) => {
        set({ sidebarWidth: Math.max(200, Math.min(400, width)) });
      },

      setSidebarActiveTab: (tab) => {
        set({ sidebarActiveTab: tab });
      },

      togglePlaylistsExpanded: () => {
        set(state => ({ isPlaylistsExpanded: !state.isPlaylistsExpanded }));
      },

      toggleTagsExpanded: () => {
        set(state => ({ isTagsExpanded: !state.isTagsExpanded }));
      },

      toggleCollectionsExpanded: () => {
        set(state => ({ isCollectionsExpanded: !state.isCollectionsExpanded }));
      },

      // Inline creation actions
      startCreatingPlaylist: () => {
        set({ isCreatingPlaylist: true, isPlaylistsExpanded: true, sidebarActiveTab: 'playlists' });
      },

      stopCreatingPlaylist: () => {
        set({ isCreatingPlaylist: false });
      },

      startCreatingTag: () => {
        set({ isCreatingTag: true, isTagsExpanded: true, sidebarActiveTab: 'tags' });
      },

      stopCreatingTag: () => {
        set({ isCreatingTag: false });
      },

      startCreatingCollection: () => {
        set({ isCreatingCollection: true, isCollectionsExpanded: true, sidebarActiveTab: 'collections' });
      },

      stopCreatingCollection: () => {
        set({ isCreatingCollection: false });
      }
    }),
    {
      name: 'audiio-ui',
      partialize: (state) => ({
        sidebarWidth: state.sidebarWidth,
        isSidebarCollapsed: state.isSidebarCollapsed,
        sidebarActiveTab: state.sidebarActiveTab,
        isPlaylistsExpanded: state.isPlaylistsExpanded,
        isTagsExpanded: state.isTagsExpanded,
        isCollectionsExpanded: state.isCollectionsExpanded,
      })
    }
  )
);
