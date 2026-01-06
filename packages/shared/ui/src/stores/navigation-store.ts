/**
 * Navigation store - manages active view/page
 */

import { create } from 'zustand';
import type { SearchArtist, SearchAlbum } from './search-store';
import type { StructuredSectionQuery } from '../components/Discover/types';

export type View =
  | 'home'
  | 'likes'
  | 'dislikes'
  | 'playlists'
  | 'collections'
  | 'collection-detail'
  | 'tags'
  | 'tag-detail'
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
  type: string;
  /** @deprecated Use structuredQuery instead for ML-aware "See All" */
  query?: string;
  /** Structured query for ML-aware "See All" navigation */
  structuredQuery?: StructuredSectionQuery;
}

interface NavigationState {
  currentView: View;
  selectedPlaylistId: string | null;
  selectedCollectionId: string | null;
  selectedPluginId: string | null;
  selectedArtistId: string | null;
  selectedAlbumId: string | null;
  selectedTagName: string | null;
  selectedSectionData: SectionDetailData | null;
  // Cache artist/album data for detail views
  selectedArtistData: SearchArtist | null;
  selectedAlbumData: SearchAlbum | null;
  searchQuery: string;
  isSearchActive: boolean;
  // Playlist rules editor modal state
  isPlaylistRulesEditorOpen: boolean;

  // Actions
  navigate: (view: View) => void;
  navigateTo: (view: View, params?: { playlistId?: string; collectionId?: string; selectedCollectionId?: string; pluginId?: string; artistId?: string; albumId?: string }) => void;
  openPlaylist: (playlistId: string) => void;
  openPlaylistRulesEditor: () => void;
  closePlaylistRulesEditor: () => void;
  openCollection: (collectionId: string) => void;
  openTagDetail: (tagName: string) => void;
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
  selectedCollectionId: null,
  selectedPluginId: null,
  selectedArtistId: null,
  selectedAlbumId: null,
  selectedTagName: null,
  selectedSectionData: null,
  selectedArtistData: null,
  selectedAlbumData: null,
  searchQuery: '',
  isSearchActive: false,
  isPlaylistRulesEditorOpen: false,

  navigate: (view) => {
    set({
      currentView: view,
      selectedPlaylistId: null,
      selectedCollectionId: null,
      selectedPluginId: null,
      selectedArtistId: null,
      selectedAlbumId: null,
      selectedTagName: null,
      selectedSectionData: null,
      selectedArtistData: null,
      selectedAlbumData: null,
    });
  },

  openPlaylist: (playlistId) => {
    set({ currentView: 'playlist-detail', selectedPlaylistId: playlistId });
  },

  openPlaylistRulesEditor: () => {
    set({ isPlaylistRulesEditorOpen: true });
  },

  closePlaylistRulesEditor: () => {
    set({ isPlaylistRulesEditorOpen: false });
  },

  openCollection: (collectionId) => {
    set({ currentView: 'collection-detail', selectedCollectionId: collectionId });
  },

  openTagDetail: (tagName) => {
    set({ currentView: 'tag-detail', selectedTagName: tagName });
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
    } else if (currentView === 'collection-detail') {
      set({ ...clearSearch, currentView: 'collections', selectedCollectionId: null });
    } else if (currentView === 'tag-detail') {
      set({ ...clearSearch, currentView: 'tags', selectedTagName: null });
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
  navigateTo: (view: View, params?: { playlistId?: string; collectionId?: string; selectedCollectionId?: string; pluginId?: string; artistId?: string; albumId?: string }) => {
    if (params?.playlistId && view === 'playlist-detail') {
      set({ currentView: view, selectedPlaylistId: params.playlistId });
    } else if ((params?.collectionId || params?.selectedCollectionId) && view === 'collection-detail') {
      set({ currentView: view, selectedCollectionId: params.collectionId || params.selectedCollectionId });
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
        selectedCollectionId: null,
        selectedPluginId: null,
        selectedArtistId: null,
        selectedAlbumId: null,
      });
    }
  }
}));
