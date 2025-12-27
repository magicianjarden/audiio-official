/**
 * Sposify Zustand Store
 * State management for Sposify plugin UI
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Types for the store
export interface ParsedSpotifyData {
  history: Array<{
    trackName: string;
    artistName: string;
    albumName?: string;
    endTime: string;
    msPlayed: number;
    skipped?: boolean;
  }>;
  likedTracks: Array<{
    trackName: string;
    artistName: string;
    albumName?: string;
    spotifyUri?: string;
  }>;
  playlists: Array<{
    name: string;
    description?: string;
    tracks: Array<{
      trackName: string;
      artistName: string;
      albumName?: string;
    }>;
  }>;
  bannedTracks: Array<{
    trackName: string;
    artistName: string;
  }>;
  stats: {
    totalHistoryEntries: number;
    uniqueTracksPlayed: number;
    totalPlaytimeMs: number;
    dateRange: { start: string; end: string } | null;
    likedTracksCount: number;
    playlistsCount: number;
  };
}

export interface MatchedTrack {
  original: {
    trackName: string;
    artistName: string;
    albumName?: string;
  };
  spotifyId: string;
  isrc?: string;
  confidence: number;
  matchedBy: 'isrc' | 'exact' | 'normalized' | 'fuzzy';
}

export interface MatchedPlaylist {
  name: string;
  description?: string;
  matchedTracks: MatchedTrack[];
  unmatchedTracks: Array<{ trackName: string; artistName: string }>;
  matchRate: number;
}

export interface ImportOptions {
  importHistory: boolean;
  importLikedTracks: boolean;
  importPlaylists: boolean;
  importBannedAsDisliked: boolean;
  mergeHistory: boolean;
  playlistPrefix: string;
  minConfidence: number;
}

export interface ImportStats {
  historyImported: number;
  tracksLiked: number;
  tracksDisliked: number;
  playlistsCreated: number;
  duration: number;
  importedAt: number;
}

export interface AudioFeatures {
  spotifyId: string;
  tempo: number;
  key: number;
  mode: number;
  danceability: number;
  energy: number;
  loudness: number;
  speechiness: number;
  acousticness: number;
  instrumentalness: number;
  liveness: number;
  valence: number;
}

export interface PlaylistPreview {
  playlistId: string;
  name: string;
  description: string | null;
  owner: string | null;
  followers: number;
  trackCount: number;
}

export type ImportPhase = 'idle' | 'selecting' | 'parsing' | 'matching' | 'previewing' | 'importing' | 'complete' | 'error';

interface SposifyState {
  // Database status
  databaseReady: boolean;
  databaseVersion: string | null;
  trackCount: number;
  playlistCount: number;
  lastChecked: number | null;

  // Import wizard state
  wizardOpen: boolean;
  wizardStep: number;
  importPhase: ImportPhase;
  importProgress: number;
  importError: string | null;

  // Selected files
  selectedFiles: string[];
  selectedFolder: string | null;

  // Parsed data
  parsedData: ParsedSpotifyData | null;

  // Matched data
  matchedLikedTracks: MatchedTrack[];
  unmatchedLikedTracks: Array<{ trackName: string; artistName: string }>;
  matchedPlaylists: MatchedPlaylist[];
  matchStats: {
    likedTracksMatchRate: number;
    historyMatchRate: number;
    averagePlaylistMatchRate: number;
  } | null;

  // Import options
  importOptions: ImportOptions;

  // Import results
  lastImportStats: ImportStats | null;

  // Playlist browser
  playlistSearchQuery: string;
  playlistSearchResults: PlaylistPreview[];
  playlistBrowserLoading: boolean;
  selectedPlaylistId: string | null;

  // Audio features cache
  audioFeaturesCache: Record<string, AudioFeatures>;

  // Actions
  initializeDatabase: () => Promise<void>;
  checkDatabaseStatus: () => Promise<void>;

  // Wizard actions
  openWizard: () => void;
  closeWizard: () => void;
  resetWizard: () => void;
  setWizardStep: (step: number) => void;
  nextStep: () => void;
  prevStep: () => void;

  // File selection
  selectFiles: () => Promise<void>;
  selectFolder: () => Promise<void>;
  clearSelection: () => void;

  // Import flow
  parseSelectedFiles: () => Promise<void>;
  matchParsedData: () => Promise<void>;
  executeImport: () => Promise<void>;

  // Import options
  updateImportOptions: (options: Partial<ImportOptions>) => void;

  // Playlist browser
  searchPlaylists: (query: string) => Promise<void>;
  browseTopPlaylists: () => Promise<void>;
  selectPlaylist: (playlistId: string | null) => void;
  importPlaylist: (playlistId: string) => Promise<void>;

  // Audio features
  getAudioFeatures: (spotifyId: string) => Promise<AudioFeatures | null>;
  getAudioFeaturesBatch: (spotifyIds: string[]) => Promise<void>;

  // Utility
  clearError: () => void;
}

// Default import options
const defaultImportOptions: ImportOptions = {
  importHistory: true,
  importLikedTracks: true,
  importPlaylists: true,
  importBannedAsDisliked: false,
  mergeHistory: true,
  playlistPrefix: '[Spotify] ',
  minConfidence: 0.7,
};

export const useSposifyStore = create<SposifyState>()(
  persist(
    (set, get) => ({
      // Initial state
      databaseReady: false,
      databaseVersion: null,
      trackCount: 0,
      playlistCount: 0,
      lastChecked: null,

      wizardOpen: false,
      wizardStep: 0,
      importPhase: 'idle',
      importProgress: 0,
      importError: null,

      selectedFiles: [],
      selectedFolder: null,

      parsedData: null,

      matchedLikedTracks: [],
      unmatchedLikedTracks: [],
      matchedPlaylists: [],
      matchStats: null,

      importOptions: defaultImportOptions,

      lastImportStats: null,

      playlistSearchQuery: '',
      playlistSearchResults: [],
      playlistBrowserLoading: false,
      selectedPlaylistId: null,

      audioFeaturesCache: {},

      // Database initialization
      initializeDatabase: async () => {
        try {
          const status = await window.api.sposify.init();
          set({
            databaseReady: status.ready,
            databaseVersion: status.version,
            trackCount: status.trackCount,
            playlistCount: status.playlistCount,
            lastChecked: Date.now(),
          });
        } catch (error) {
          console.error('[Sposify] Failed to initialize database:', error);
          set({ databaseReady: false });
        }
      },

      checkDatabaseStatus: async () => {
        try {
          const status = await window.api.sposify.getStatus();
          set({
            databaseReady: status.ready,
            databaseVersion: status.version,
            trackCount: status.trackCount,
            playlistCount: status.playlistCount,
            lastChecked: Date.now(),
          });
        } catch (error) {
          console.error('[Sposify] Failed to check database status:', error);
        }
      },

      // Wizard actions
      openWizard: () => {
        set({
          wizardOpen: true,
          wizardStep: 0,
          importPhase: 'idle',
          importProgress: 0,
          importError: null,
        });
      },

      closeWizard: () => {
        set({ wizardOpen: false });
      },

      resetWizard: () => {
        set({
          wizardStep: 0,
          importPhase: 'idle',
          importProgress: 0,
          importError: null,
          selectedFiles: [],
          selectedFolder: null,
          parsedData: null,
          matchedLikedTracks: [],
          unmatchedLikedTracks: [],
          matchedPlaylists: [],
          matchStats: null,
          importOptions: defaultImportOptions,
        });
      },

      setWizardStep: (step) => {
        set({ wizardStep: step });
      },

      nextStep: () => {
        set((state) => ({ wizardStep: state.wizardStep + 1 }));
      },

      prevStep: () => {
        set((state) => ({ wizardStep: Math.max(0, state.wizardStep - 1) }));
      },

      // File selection
      selectFiles: async () => {
        try {
          set({ importPhase: 'selecting' });
          const files = await window.api.sposify.selectExportFiles();
          if (files && files.length > 0) {
            set({
              selectedFiles: files,
              selectedFolder: null,
              importPhase: 'idle',
            });
          } else {
            set({ importPhase: 'idle' });
          }
        } catch (error) {
          console.error('[Sposify] File selection error:', error);
          set({ importPhase: 'idle', importError: 'Failed to select files' });
        }
      },

      selectFolder: async () => {
        try {
          set({ importPhase: 'selecting' });
          const folder = await window.api.sposify.selectExportFolder();
          if (folder) {
            set({
              selectedFolder: folder,
              selectedFiles: [],
              importPhase: 'idle',
            });
          } else {
            set({ importPhase: 'idle' });
          }
        } catch (error) {
          console.error('[Sposify] Folder selection error:', error);
          set({ importPhase: 'idle', importError: 'Failed to select folder' });
        }
      },

      clearSelection: () => {
        set({
          selectedFiles: [],
          selectedFolder: null,
          parsedData: null,
        });
      },

      // Import flow
      parseSelectedFiles: async () => {
        const state = get();
        try {
          set({ importPhase: 'parsing', importProgress: 0, importError: null });

          let data: ParsedSpotifyData;
          if (state.selectedFolder) {
            data = await window.api.sposify.parseExportFolder(state.selectedFolder);
          } else if (state.selectedFiles.length > 0) {
            data = await window.api.sposify.parseExport(state.selectedFiles);
          } else {
            throw new Error('No files or folder selected');
          }

          set({
            parsedData: data,
            importPhase: 'idle',
            importProgress: 1,
          });
        } catch (error) {
          console.error('[Sposify] Parse error:', error);
          set({
            importPhase: 'error',
            importError: error instanceof Error ? error.message : 'Failed to parse files',
          });
        }
      },

      matchParsedData: async () => {
        const state = get();
        if (!state.parsedData) return;

        try {
          set({ importPhase: 'matching', importProgress: 0 });

          // Match liked tracks
          const matchResult = await window.api.sposify.matchTracks(state.parsedData.likedTracks);

          set({
            matchedLikedTracks: matchResult.matched,
            unmatchedLikedTracks: matchResult.unmatched,
            matchStats: {
              likedTracksMatchRate: matchResult.matchRate,
              historyMatchRate: 0, // Will be calculated during import
              averagePlaylistMatchRate: 0, // Will be calculated during import
            },
            importPhase: 'previewing',
            importProgress: 1,
          });
        } catch (error) {
          console.error('[Sposify] Match error:', error);
          set({
            importPhase: 'error',
            importError: error instanceof Error ? error.message : 'Failed to match tracks',
          });
        }
      },

      executeImport: async () => {
        const state = get();
        try {
          set({ importPhase: 'importing', importProgress: 0 });

          // Set up progress listener
          const unsubscribe = window.api.sposify.onImportProgress((progress) => {
            set({ importProgress: progress.progress });
          });

          const result = await window.api.sposify.importToLibrary({
            matchedLikedTracks: state.matchedLikedTracks,
            matchedHistory: [], // Will be processed server-side
            matchedPlaylists: state.matchedPlaylists,
            options: state.importOptions,
          });

          unsubscribe();

          set({
            importPhase: 'complete',
            importProgress: 1,
            lastImportStats: {
              ...result,
              importedAt: Date.now(),
            },
          });
        } catch (error) {
          console.error('[Sposify] Import error:', error);
          set({
            importPhase: 'error',
            importError: error instanceof Error ? error.message : 'Failed to import data',
          });
        }
      },

      // Import options
      updateImportOptions: (options) => {
        set((state) => ({
          importOptions: { ...state.importOptions, ...options },
        }));
      },

      // Playlist browser
      searchPlaylists: async (query) => {
        try {
          set({ playlistSearchQuery: query, playlistBrowserLoading: true });
          const result = await window.api.sposify.searchPlaylists(query, { limit: 50 });
          set({
            playlistSearchResults: result.playlists,
            playlistBrowserLoading: false,
          });
        } catch (error) {
          console.error('[Sposify] Playlist search error:', error);
          set({ playlistBrowserLoading: false });
        }
      },

      browseTopPlaylists: async () => {
        try {
          set({ playlistBrowserLoading: true });
          const playlists = await window.api.sposify.getTopPlaylists(100);
          set({
            playlistSearchResults: playlists,
            playlistBrowserLoading: false,
          });
        } catch (error) {
          console.error('[Sposify] Browse playlists error:', error);
          set({ playlistBrowserLoading: false });
        }
      },

      selectPlaylist: (playlistId) => {
        set({ selectedPlaylistId: playlistId });
      },

      importPlaylist: async (playlistId) => {
        // TODO: Implement playlist import to library
        console.log('[Sposify] Import playlist:', playlistId);
      },

      // Audio features
      getAudioFeatures: async (spotifyId) => {
        const cached = get().audioFeaturesCache[spotifyId];
        if (cached) return cached;

        try {
          const features = await window.api.sposify.getAudioFeatures(spotifyId);
          if (features) {
            set((state) => ({
              audioFeaturesCache: {
                ...state.audioFeaturesCache,
                [spotifyId]: features,
              },
            }));
          }
          return features;
        } catch (error) {
          console.error('[Sposify] Get audio features error:', error);
          return null;
        }
      },

      getAudioFeaturesBatch: async (spotifyIds) => {
        const uncached = spotifyIds.filter((id) => !get().audioFeaturesCache[id]);
        if (uncached.length === 0) return;

        try {
          const features = await window.api.sposify.getAudioFeaturesBatch(uncached);
          set((state) => ({
            audioFeaturesCache: {
              ...state.audioFeaturesCache,
              ...features,
            },
          }));
        } catch (error) {
          console.error('[Sposify] Get audio features batch error:', error);
        }
      },

      // Utility
      clearError: () => {
        set({ importError: null, importPhase: 'idle' });
      },
    }),
    {
      name: 'sposify-store',
      partialize: (state) => ({
        // Only persist essential data
        lastImportStats: state.lastImportStats,
        importOptions: state.importOptions,
        databaseReady: state.databaseReady,
        trackCount: state.trackCount,
        playlistCount: state.playlistCount,
      }),
    }
  )
);

// Setup progress type
export interface SetupProgress {
  phase: 'checking' | 'downloading' | 'extracting' | 'building' | 'verifying' | 'complete' | 'error';
  progress: number;
  message: string;
  bytesDownloaded?: number;
  totalBytes?: number;
  speed?: number;
}

// Declare window.api types
declare global {
  interface Window {
    api: {
      sposify: {
        init: () => Promise<{ ready: boolean; version: string; trackCount: number; playlistCount: number }>;
        rebuildDatabase: () => Promise<{ ready: boolean; version: string; trackCount: number; playlistCount: number }>;
        getStatus: () => Promise<{ ready: boolean; version: string; trackCount: number; playlistCount: number }>;
        selectExportFiles: () => Promise<string[] | null>;
        selectExportFolder: () => Promise<string | null>;
        parseExport: (filePaths: string[]) => Promise<ParsedSpotifyData>;
        parseExportFolder: (folderPath: string) => Promise<ParsedSpotifyData>;
        matchTracks: (tracks: Array<{ trackName: string; artistName: string; albumName?: string }>) => Promise<{
          matched: MatchedTrack[];
          unmatched: Array<{ trackName: string; artistName: string }>;
          matchRate: number;
        }>;
        importToLibrary: (data: unknown) => Promise<ImportStats>;
        getAudioFeatures: (spotifyId: string) => Promise<AudioFeatures | null>;
        getAudioFeaturesBatch: (spotifyIds: string[]) => Promise<Record<string, AudioFeatures>>;
        searchPlaylists: (query: string, options?: { limit?: number }) => Promise<{ playlists: PlaylistPreview[] }>;
        getTopPlaylists: (limit?: number) => Promise<PlaylistPreview[]>;
        onImportProgress: (callback: (progress: { phase: string; progress: number }) => void) => () => void;
        onSetupProgress: (callback: (progress: SetupProgress) => void) => () => void;
      };
    };
  }
}

export default useSposifyStore;
