/**
 * Navigation store - manages active view/page
 */

import { create } from 'zustand';
import type { SearchArtist, SearchAlbum } from './search-store';

export type View =
  | 'home'
  | 'likes'
  | 'dislikes'
  | 'playlists'
  | 'downloads'
  | 'playlist-detail'
  | 'plugins'
  | 'plugin-detail'
  | 'settings'
  | 'stats'
  | 'artist-detail'
  | 'album-detail'
  | 'section-detail'
  | `plugin-view-${string}`; // Dynamic plugin views

export interface SectionDetailData {
  title: string;
  subtitle?: string;
  query: string;
  type: string;
}

interface NavigationState {
  currentView: View;
  selectedPlaylistId: string | null;
  selectedPluginId: string | null;
  selectedArtistId: string | null;
  selectedAlbumId: string | null;
  selectedSectionData: SectionDetailData | null;
  // Cache artist/album data for detail views
  selectedArtistData: SearchArtist | null;
  selectedAlbumData: SearchAlbum | null;
  searchQuery: string;
  isSearchActive: boolean;

  // Actions
  navigate: (view: View) => void;
  navigateTo: (view: View, params?: { playlistId?: string; pluginId?: string; artistId?: string; albumId?: string }) => void;
  openPlaylist: (playlistId: string) => void;
  openPlugin: (pluginId: string) => void;
  openArtist: (artistId: string, artistData?: SearchArtist) => void;
  openAlbum: (albumId: string, albumData?: SearchAlbum) => void;
  openSectionDetail: (data: SectionDetailData) => void;
  setSearchQuery: (query: string) => void;
  setSearchActive: (active: boolean) => void;
  clearSearch: () => void;
  goBack: () => void;
}

export const useNavigationStore = create<NavigationState>((set, get) => ({
  currentView: 'home',
  selectedPlaylistId: null,
  selectedPluginId: null,
  selectedArtistId: null,
  selectedAlbumId: null,
  selectedSectionData: null,
  selectedArtistData: null,
  selectedAlbumData: null,
  searchQuery: '',
  isSearchActive: false,

  navigate: (view) => {
    set({
      currentView: view,
      selectedPlaylistId: null,
      selectedPluginId: null,
      selectedArtistId: null,
      selectedAlbumId: null,
      selectedSectionData: null,
      selectedArtistData: null,
      selectedAlbumData: null,
    });
  },

  openPlaylist: (playlistId) => {
    set({ currentView: 'playlist-detail', selectedPlaylistId: playlistId });
  },

  openPlugin: (pluginId) => {
    set({ currentView: 'plugin-detail', selectedPluginId: pluginId });
  },

  openArtist: (artistId, artistData) => {
    set({
      currentView: 'artist-detail',
      selectedArtistId: artistId,
      selectedArtistData: artistData || null,
    });
  },

  openAlbum: (albumId, albumData) => {
    set({
      currentView: 'album-detail',
      selectedAlbumId: albumId,
      selectedAlbumData: albumData || null,
    });
  },

  openSectionDetail: (data) => {
    set({
      currentView: 'section-detail',
      selectedSectionData: data,
    });
  },

  setSearchQuery: (query) => {
    set({ searchQuery: query, isSearchActive: query.length > 0 });
  },

  setSearchActive: (active) => {
    set({ isSearchActive: active });
  },

  clearSearch: () => {
    set({ searchQuery: '', isSearchActive: false });
  },

  goBack: () => {
    const { currentView } = get();

    // Always clear search when navigating back
    const clearSearch = { searchQuery: '', isSearchActive: false };

    if (currentView === 'playlist-detail') {
      set({ ...clearSearch, currentView: 'playlists', selectedPlaylistId: null });
    } else if (currentView === 'plugin-detail') {
      set({ ...clearSearch, currentView: 'plugins', selectedPluginId: null });
    } else if (currentView === 'artist-detail') {
      set({ ...clearSearch, currentView: 'home', selectedArtistId: null, selectedArtistData: null });
    } else if (currentView === 'album-detail') {
      set({ ...clearSearch, currentView: 'home', selectedAlbumId: null, selectedAlbumData: null });
    } else if (currentView === 'section-detail') {
      set({ ...clearSearch, currentView: 'home', selectedSectionData: null });
    } else if (currentView === 'stats') {
      set({ ...clearSearch, currentView: 'home' });
    } else if (currentView.startsWith('plugin-view-')) {
      set({ ...clearSearch, currentView: 'home' });
    } else {
      // For other views, just clear search and go home
      set({ ...clearSearch, currentView: 'home' });
    }
  },

  // Alias for navigate with optional params (for detail views)
  navigateTo: (view: View, params?: { playlistId?: string; pluginId?: string; artistId?: string; albumId?: string }) => {
    if (params?.playlistId && view === 'playlist-detail') {
      set({ currentView: view, selectedPlaylistId: params.playlistId });
    } else if (params?.pluginId && view === 'plugin-detail') {
      set({ currentView: view, selectedPluginId: params.pluginId });
    } else if (params?.artistId && view === 'artist-detail') {
      set({ currentView: view, selectedArtistId: params.artistId });
    } else if (params?.albumId && view === 'album-detail') {
      set({ currentView: view, selectedAlbumId: params.albumId });
    } else {
      set({
        currentView: view,
        selectedPlaylistId: null,
        selectedPluginId: null,
        selectedArtistId: null,
        selectedAlbumId: null,
      });
    }
  }
}));
