/**
 * Library store - manages user's library (likes, playlists, downloads, folders)
 *
 * All data is fetched from and synced to the server.
 * No local persistence - client is stateless.
 */

import { create } from 'zustand';
import type { UnifiedTrack } from '@audiio/core';
import { showSuccessToast, showErrorToast } from './toast-store';

// Playlist folder interface - supports nested folders
export interface PlaylistFolder {
  id: string;
  name: string;
  parentId: string | null;  // null = root level
  order: number;
  isExpanded: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Rule definition for smart/rule-based playlists
export interface PlaylistRule {
  id?: string; // Client-side rule ID
  field: string;
  operator: string;
  value: unknown;
  pluginId?: string; // For plugin-provided rules
}

// Rule definition metadata for rule builder UI
export interface RuleDefinition {
  field: string;
  label: string;
  type: 'string' | 'number' | 'boolean' | 'date' | 'duration';
  category: 'metadata' | 'library' | 'playback' | 'audio';
  operators: string[];
}

export interface Playlist {
  id: string;
  name: string;
  description?: string;
  artwork?: string;
  tracks: UnifiedTrack[];          // Manual tracks (always present)
  folderId: string | null;          // null = root level, string = inside folder
  order: number;
  createdAt: Date;
  updatedAt: Date;
  localFolderId?: string;           // Links to media folder ID for auto-generated playlists
  isMediaFolder?: boolean;          // True if this represents a server media folder
  mediaFolderType?: 'audio' | 'video'; // Type of media folder
  trackCount?: number;              // For media folders, track count from server

  // Rule fields (optional - if present, playlist has smart/auto behavior)
  rules?: PlaylistRule[];           // If present, playlist is "smart"
  combinator?: 'and' | 'or';        // How rules combine
  orderBy?: string;                 // Sort field for rule results
  orderDirection?: 'asc' | 'desc';  // Sort direction
  limit?: number;                   // Max tracks from rules
  source?: 'local' | 'streams' | 'all'; // Where to search: local library, streaming plugins, or both
  lastEvaluatedAt?: number;         // Timestamp of last rule evaluation
  ruleTrackCount?: number;          // Count of tracks matched by rules
  ruleTracks?: UnifiedTrack[];      // Cached tracks from rules (populated on evaluate)
}

// Helper to check if playlist has rules (is "smart")
export function isRuleBasedPlaylist(playlist: Playlist): boolean {
  return Array.isArray(playlist.rules) && playlist.rules.length > 0;
}

export interface Download {
  id: string;
  track: UnifiedTrack | null;
  status: 'queued' | 'downloading' | 'processing' | 'completed' | 'failed' | 'cancelled';
  progress: number; // 0-100
  filePath?: string;
  filename: string;
  error?: string;
  startedAt: Date;
  completedAt?: Date;
  speed?: number; // bytes/sec
  eta?: number; // seconds remaining
}

// Library track with metadata (timestamp, etc.)
export interface LibraryTrack {
  track: UnifiedTrack;
  addedAt: number; // Unix timestamp in milliseconds
}

interface LibraryState {
  // Liked tracks (with timestamps)
  likedTracks: LibraryTrack[];

  // Disliked tracks (with timestamps)
  dislikedTracks: LibraryTrack[];

  // Playlists (includes media folder playlists)
  playlists: Playlist[];

  // Folders
  folders: PlaylistFolder[];

  // Downloads
  downloads: Download[];

  // Loading states
  isLoading: boolean;
  isInitialized: boolean;

  // Initialization
  initialize: () => Promise<void>;
  refreshLibrary: () => Promise<void>;

  // Actions - Likes (synced to server)
  likeTrack: (track: UnifiedTrack) => Promise<void>;
  unlikeTrack: (trackId: string) => Promise<void>;
  isLiked: (trackId: string) => boolean;
  toggleLike: (track: UnifiedTrack) => Promise<void>;

  // Actions - Dislikes (synced to server)
  dislikeTrack: (track: UnifiedTrack, reasons?: string[]) => Promise<void>;
  undislikeTrack: (trackId: string) => Promise<void>;
  isDisliked: (trackId: string) => boolean;
  toggleDislike: (track: UnifiedTrack) => Promise<void>;

  // Actions - Playlists (synced to server)
  createPlaylist: (name: string, description?: string, options?: {
    folderId?: string | null;
    rules?: PlaylistRule[];
    combinator?: 'and' | 'or';
    orderBy?: string;
    orderDirection?: 'asc' | 'desc';
    limit?: number;
    source?: 'local' | 'streams' | 'all';
  }) => Promise<Playlist | null>;
  updatePlaylist: (playlistId: string, data: Partial<{
    name: string;
    description: string;
    rules: PlaylistRule[] | null;
    combinator: 'and' | 'or';
    orderBy: string | null;
    orderDirection: 'asc' | 'desc';
    limit: number | null;
    source: 'local' | 'streams' | 'all' | null;
  }>) => Promise<void>;
  deletePlaylist: (playlistId: string) => Promise<void>;
  renamePlaylist: (playlistId: string, name: string) => Promise<void>;
  addToPlaylist: (playlistId: string, track: UnifiedTrack) => Promise<void>;
  removeFromPlaylist: (playlistId: string, trackId: string) => Promise<void>;
  reorderPlaylist: (playlistId: string, fromIndex: number, toIndex: number) => void;
  movePlaylistToFolder: (playlistId: string, folderId: string | null) => void;

  // Actions - Playlist Rules (for smart/hybrid playlists)
  ruleDefinitions: RuleDefinition[];
  fetchRuleDefinitions: () => Promise<void>;
  evaluatePlaylistRules: (playlistId: string) => Promise<UnifiedTrack[]>;
  previewPlaylistRules: (rules: PlaylistRule[], options?: {
    combinator?: 'and' | 'or';
    orderBy?: string;
    orderDirection?: 'asc' | 'desc';
    limit?: number;
    source?: 'local' | 'streams' | 'all';
  }) => Promise<UnifiedTrack[]>;
  addPlaylistRule: (playlistId: string, rule: Omit<PlaylistRule, 'id'>) => void;
  updatePlaylistRule: (playlistId: string, ruleId: string, data: Partial<PlaylistRule>) => void;
  removePlaylistRule: (playlistId: string, ruleId: string) => void;
  clearPlaylistRules: (playlistId: string) => Promise<void>;

  // Actions - Media Folder Playlists
  refreshMediaFolders: () => Promise<void>;
  getMediaFolderTracks: (folderId: string) => Promise<UnifiedTrack[]>;

  // Actions - Track Metadata Updates
  updateTrackDuration: (trackId: string, duration: number) => void;

  // Actions - Folders (local only - for UI organization)
  createFolder: (name: string, parentId?: string | null) => PlaylistFolder;
  deleteFolder: (folderId: string) => void;
  renameFolder: (folderId: string, name: string) => void;
  toggleFolderExpanded: (folderId: string) => void;
  moveFolderToFolder: (folderId: string, parentId: string | null) => void;
  reorderSidebarItems: (items: Array<{ id: string; type: 'playlist' | 'folder'; order: number; parentId: string | null }>) => void;

  // Actions - Downloads (synced to server)
  startDownload: (track: UnifiedTrack, options?: { folderId?: string }) => Promise<void>;
  cancelDownload: (downloadId: string) => Promise<void>;
  removeDownload: (downloadId: string) => void;
  retryDownload: (downloadId: string) => Promise<void>;
  getDownload: (trackId: string) => Download | undefined;
  refreshDownloads: () => Promise<void>;
}

export const useLibraryStore = create<LibraryState>()((set, get) => ({
  // Initial state
  likedTracks: [],
  dislikedTracks: [],
  playlists: [],
  folders: [],
  downloads: [],
  ruleDefinitions: [],
  isLoading: false,
  isInitialized: false,

  // Initialize - fetch all data from server
  initialize: async () => {
    if (get().isInitialized) return;

    set({ isLoading: true });

    try {
      await Promise.all([
        get().refreshLibrary(),
        get().refreshMediaFolders(),
        get().refreshDownloads(),
        get().fetchRuleDefinitions(),
      ]);
    } catch (error) {
      console.error('[LibraryStore] Initialization error:', error);
    } finally {
      set({ isLoading: false, isInitialized: true });
    }
  },

  // Refresh library data from server
  refreshLibrary: async () => {
    try {
      // Fetch likes, dislikes, playlists in parallel
      const [likesRes, dislikesRes, playlistsRes] = await Promise.all([
        window.api?.getLikedTracks?.() || { tracks: [] },
        window.api?.getDislikedTracks?.() || { tracks: [] },
        window.api?.getPlaylists?.() || { playlists: [] },
      ]);

      // Transform server data to LibraryTrack format
      const likedTracks: LibraryTrack[] = (likesRes.tracks || []).map((t: any) => ({
        track: t,
        addedAt: t.likedAt || Date.now(),
      }));

      const dislikedTracks: LibraryTrack[] = (dislikesRes.tracks || []).map((t: any) => ({
        track: t,
        addedAt: t.dislikedAt || Date.now(),
      }));

      // Transform playlists (including rule fields for smart/hybrid playlists)
      const userPlaylists: Playlist[] = (playlistsRes.playlists || []).map((p: any, index: number) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        artwork: p.tracks?.[0]?.artwork,
        tracks: p.tracks || [],
        folderId: p.folderId || null,
        order: index,
        createdAt: new Date(p.createdAt),
        updatedAt: new Date(p.updatedAt),
        // Rule fields (smart/hybrid playlist support)
        rules: p.rules || undefined,
        combinator: p.combinator || undefined,
        orderBy: p.orderBy || undefined,
        orderDirection: p.orderDirection || undefined,
        limit: p.limit || undefined,
        source: p.source || undefined, // 'local' | 'streams' | 'all'
        lastEvaluatedAt: p.lastEvaluated || undefined,
        ruleTrackCount: p.ruleTrackCount || undefined,
      }));

      // Preserve media folder playlists - they're managed by refreshMediaFolders
      // This prevents race condition when both run in parallel
      set((state) => ({
        likedTracks,
        dislikedTracks,
        playlists: [
          ...userPlaylists,
          ...state.playlists.filter(p => p.isMediaFolder),
        ],
      }));
    } catch (error) {
      console.error('[LibraryStore] Failed to refresh library:', error);
    }
  },

  // Refresh media folders as playlists
  // Loads tracks from database (no rescan needed - Plex-like behavior)
  refreshMediaFolders: async () => {
    try {
      const res = await window.api?.getMediaFolders?.();
      if (!res?.folders) return;

      // Get server URL for building artwork URLs
      const connectionState = await window.api?.connection?.getState?.();
      const serverUrl = connectionState?.serverUrl || '';

      // Filter to audio/video folders only
      const mediaFolders = res.folders.filter((f: any) => f.type === 'audio' || f.type === 'video');

      // Load tracks for all media folders in parallel (from database, not rescanning)
      const folderTracksPromises = mediaFolders.map(async (folder: any) => {
        const tracksRes = await window.api?.getFolderTracks?.(folder.id);
        return { folderId: folder.id, tracks: tracksRes?.tracks || [] };
      });

      const folderTracksResults = await Promise.all(folderTracksPromises);
      const folderTracksMap = new Map(folderTracksResults.map(r => [r.folderId, r.tracks]));


      const mediaFolderPlaylists: Playlist[] = mediaFolders.map((folder: any, index: number) => {
        const rawTracks = folderTracksMap.get(folder.id) || [];

        // Transform tracks to UnifiedTrack format
        const tracks: UnifiedTrack[] = rawTracks.map((t: any) => {
          let artworkUrl: string | undefined;
          if (t.hasArtwork || t.artworkPath) {
            artworkUrl = `${serverUrl}/api/media/tracks/${encodeURIComponent(t.id)}/artwork`;
          }

          // Handle artists - check for empty array (which is truthy in JS)
          const transformedArtists = t.artists?.length > 0
            ? t.artists.map((name: string) => ({ id: name, name }))
            : [{ id: 'unknown', name: 'Unknown Artist' }];

          return {
            id: t.id,
            title: t.title || 'Unknown Title',
            artists: transformedArtists,
            album: t.album ? { id: t.album, title: t.album } : undefined,
            duration: t.duration || 0,
            artwork: artworkUrl ? { medium: artworkUrl, small: artworkUrl, large: artworkUrl } : undefined,
            isLocal: true,
            localPath: t.filePath,
            isVideo: t.isVideo,
            streamInfo: {
              url: `local-audio://${encodeURIComponent(t.filePath)}`,
              quality: 'lossless',
              mimeType: t.isVideo ? 'video/mp4' : 'audio/mpeg',
              expiresAt: null,
            },
            _meta: {
              metadataProvider: 'local-file',
              lastUpdated: new Date(),
            },
          };
        });

        return {
          id: `media-folder:${folder.id}`,
          name: folder.name,
          description: `${folder.type === 'video' ? 'Videos' : 'Music'} from ${folder.path}`,
          artwork: tracks[0]?.artwork?.medium,
          tracks, // Tracks loaded upfront from database
          folderId: null,
          order: 1000 + index,
          createdAt: new Date(folder.createdAt),
          updatedAt: new Date(folder.updatedAt),
          localFolderId: folder.id,
          isMediaFolder: true,
          mediaFolderType: folder.type,
          trackCount: tracks.length,
        };
      });

      set((state) => ({
        playlists: [
          ...state.playlists.filter(p => !p.isMediaFolder),
          ...mediaFolderPlaylists,
        ],
      }));
    } catch (error) {
      console.error('[LibraryStore] Failed to refresh media folders:', error);
    }
  },

  // Get tracks for a media folder
  getMediaFolderTracks: async (folderId: string) => {
    try {
      const res = await window.api?.getFolderTracks?.(folderId);
      if (!res?.tracks) return [];

      // Get server URL for building absolute artwork URLs
      const connectionState = await window.api?.connection?.getState?.();
      const serverUrl = connectionState?.serverUrl || '';

      // Transform local tracks to UnifiedTrack format
      // IMPORTANT: Must include streamInfo and _meta for direct local playback
      const tracks: UnifiedTrack[] = res.tracks.map((t: any) => {
        // Build artwork URL - use API endpoint since browser can't access local file paths
        // Must be absolute URL since renderer is on different origin than server
        let artworkUrl: string | undefined;
        if (t.hasArtwork || t.artworkPath) {
          // Use the artwork API endpoint with the track ID
          artworkUrl = `${serverUrl}/api/media/tracks/${encodeURIComponent(t.id)}/artwork`;
        }

        // Handle artists - check for empty array (which is truthy in JS)
        const transformedArtists = t.artists?.length > 0
          ? t.artists.map((name: string) => ({ id: name, name }))
          : [{ id: 'unknown', name: 'Unknown Artist' }];

        return {
          id: t.id, // Already starts with 'local:' from media-folders.ts
          title: t.title || 'Unknown Title',
          artists: transformedArtists,
          album: t.album ? { id: t.album, title: t.album } : undefined,
          duration: t.duration || 0,
          // useArtwork hook expects artwork.medium/small/large format
          artwork: artworkUrl ? { medium: artworkUrl, small: artworkUrl, large: artworkUrl } : undefined,
          isLocal: true,
          localPath: t.filePath,
          isVideo: t.isVideo,
          // Include streamInfo for direct local playback - avoids plugin search
          streamInfo: {
            url: `local-audio://${encodeURIComponent(t.filePath)}`,
            quality: 'lossless',
            mimeType: t.isVideo ? 'video/mp4' : 'audio/mpeg',
            expiresAt: null, // Local files never expire
          },
          // Include _meta to identify as local track
          _meta: {
            metadataProvider: 'local-file',
            lastUpdated: new Date(),
          },
        };
      });

      // Update the playlist with tracks
      set((state) => ({
        playlists: state.playlists.map(p =>
          p.localFolderId === folderId
            ? { ...p, tracks }
            : p
        ),
      }));

      return tracks;
    } catch (error) {
      console.error('[LibraryStore] Failed to get folder tracks:', error);
      return [];
    }
  },

  // Update track duration in all playlists when discovered from playback
  updateTrackDuration: (trackId: string, duration: number) => {
    set((state) => ({
      playlists: state.playlists.map(playlist => ({
        ...playlist,
        tracks: playlist.tracks.map(track =>
          track.id === trackId
            ? { ...track, duration }
            : track
        ),
      })),
      // Also update in liked tracks if present
      likedTracks: state.likedTracks.map(lt =>
        lt.track.id === trackId
          ? { ...lt, track: { ...lt.track, duration } }
          : lt
      ),
    }));
  },

  // Refresh downloads from server
  refreshDownloads: async () => {
    try {
      const [activeRes, historyRes] = await Promise.all([
        window.api?.getActiveDownloads?.() || { active: [], queued: [] },
        window.api?.getDownloadHistory?.() || { downloads: [] },
      ]);

      const downloads: Download[] = [
        ...(activeRes.active || []).map((d: any) => ({
          id: d.id,
          track: null,
          status: d.status,
          progress: d.progress,
          filename: d.filename,
          filePath: d.filePath,
          speed: d.speed,
          eta: d.eta,
          startedAt: new Date(),
        })),
        ...(activeRes.queued || []).map((d: any) => ({
          id: d.id,
          track: null,
          status: 'queued' as const,
          progress: 0,
          filename: d.filename,
          startedAt: new Date(),
        })),
        ...(historyRes.downloads || [])
          .filter((d: any) => d.status === 'completed' || d.status === 'failed')
          .slice(0, 50) // Limit history
          .map((d: any) => ({
            id: d.id,
            track: d.track_data ? JSON.parse(d.track_data) : null,
            status: d.status,
            progress: d.progress || 100,
            filename: d.filename,
            filePath: d.file_path,
            error: d.error,
            startedAt: new Date(d.created_at),
            completedAt: d.completed_at ? new Date(d.completed_at) : undefined,
          })),
      ];

      set({ downloads });
    } catch (error) {
      console.error('[LibraryStore] Failed to refresh downloads:', error);
    }
  },

  // Likes
  likeTrack: async (track) => {
    // Optimistic update
    const libraryTrack: LibraryTrack = { track, addedAt: Date.now() };
    set((state) => ({
      likedTracks: state.likedTracks.some(t => t.track.id === track.id)
        ? state.likedTracks
        : [libraryTrack, ...state.likedTracks],
    }));

    // Sync to server
    try {
      await window.api?.likeTrack?.(track);
    } catch (error) {
      console.error('[LibraryStore] Failed to like track:', error);
      // Rollback on failure
      set((state) => ({
        likedTracks: state.likedTracks.filter(t => t.track.id !== track.id),
      }));
    }
  },

  unlikeTrack: async (trackId) => {
    // Get current track for rollback
    const current = get().likedTracks.find(t => t.track.id === trackId);

    // Optimistic update
    set((state) => ({
      likedTracks: state.likedTracks.filter(t => t.track.id !== trackId),
    }));

    // Sync to server
    try {
      await window.api?.unlikeTrack?.(trackId);
    } catch (error) {
      console.error('[LibraryStore] Failed to unlike track:', error);
      // Rollback on failure
      if (current) {
        set((state) => ({
          likedTracks: [current, ...state.likedTracks],
        }));
      }
    }
  },

  isLiked: (trackId) => {
    return get().likedTracks.some(t => t.track.id === trackId);
  },

  toggleLike: async (track) => {
    const { isLiked, likeTrack, unlikeTrack } = get();
    if (isLiked(track.id)) {
      await unlikeTrack(track.id);
    } else {
      await likeTrack(track);
    }
  },

  // Dislikes
  dislikeTrack: async (track, reasons = []) => {
    const libraryTrack: LibraryTrack = { track, addedAt: Date.now() };
    set((state) => ({
      dislikedTracks: state.dislikedTracks.some(t => t.track.id === track.id)
        ? state.dislikedTracks
        : [libraryTrack, ...state.dislikedTracks],
    }));

    try {
      await window.api?.dislikeTrack?.(track, reasons);
    } catch (error) {
      console.error('[LibraryStore] Failed to dislike track:', error);
      set((state) => ({
        dislikedTracks: state.dislikedTracks.filter(t => t.track.id !== track.id),
      }));
    }
  },

  undislikeTrack: async (trackId) => {
    const current = get().dislikedTracks.find(t => t.track.id === trackId);

    set((state) => ({
      dislikedTracks: state.dislikedTracks.filter(t => t.track.id !== trackId),
    }));

    try {
      await window.api?.removeDislike?.(trackId);
    } catch (error) {
      console.error('[LibraryStore] Failed to undislike track:', error);
      if (current) {
        set((state) => ({
          dislikedTracks: [current, ...state.dislikedTracks],
        }));
      }
    }
  },

  isDisliked: (trackId) => {
    return get().dislikedTracks.some(t => t.track.id === trackId);
  },

  toggleDislike: async (track) => {
    const { isDisliked, dislikeTrack, undislikeTrack } = get();
    if (isDisliked(track.id)) {
      await undislikeTrack(track.id);
    } else {
      await dislikeTrack(track);
    }
  },

  // Playlists
  createPlaylist: async (name, description, options = {}) => {
    try {
      const result = await window.api?.createPlaylist?.(name, description, options);
      if (!result?.playlist) return null;

      const p = result.playlist;
      const playlist: Playlist = {
        id: p.id,
        name: p.name,
        description: p.description,
        tracks: [],
        folderId: options.folderId || null,
        order: get().playlists.filter(pl => !pl.isMediaFolder).length,
        createdAt: new Date(p.createdAt),
        updatedAt: new Date(p.updatedAt),
        // Rule fields
        rules: p.rules || options.rules,
        combinator: p.combinator || options.combinator,
        orderBy: p.orderBy || options.orderBy,
        orderDirection: p.orderDirection || options.orderDirection,
        limit: p.limit || options.limit,
        source: p.source || options.source,
      };

      set((state) => ({
        playlists: [playlist, ...state.playlists],
      }));

      return playlist;
    } catch (error) {
      console.error('[LibraryStore] Failed to create playlist:', error);
      return null;
    }
  },

  updatePlaylist: async (playlistId, data) => {
    // Optimistic update
    set((state) => ({
      playlists: state.playlists.map(p =>
        p.id === playlistId
          ? { ...p, ...data, updatedAt: new Date() }
          : p
      ),
    }));

    try {
      await window.api?.updatePlaylist?.(playlistId, data);
    } catch (error) {
      console.error('[LibraryStore] Failed to update playlist:', error);
      // Could rollback here
    }
  },

  deletePlaylist: async (playlistId) => {
    // Don't delete media folder playlists this way
    const playlist = get().playlists.find(p => p.id === playlistId);
    if (playlist?.isMediaFolder) return;

    set((state) => ({
      playlists: state.playlists.filter(p => p.id !== playlistId),
    }));

    try {
      await window.api?.deletePlaylist?.(playlistId);
    } catch (error) {
      console.error('[LibraryStore] Failed to delete playlist:', error);
      // Could rollback here
    }
  },

  renamePlaylist: async (playlistId, name) => {
    set((state) => ({
      playlists: state.playlists.map(p =>
        p.id === playlistId
          ? { ...p, name, updatedAt: new Date() }
          : p
      ),
    }));

    try {
      await window.api?.renamePlaylist?.(playlistId, name);
    } catch (error) {
      console.error('[LibraryStore] Failed to rename playlist:', error);
    }
  },

  addToPlaylist: async (playlistId, track) => {
    set((state) => ({
      playlists: state.playlists.map(p => {
        if (p.id !== playlistId) return p;
        if (p.tracks.some(t => t.id === track.id)) return p;
        return { ...p, tracks: [...p.tracks, track], updatedAt: new Date() };
      }),
    }));

    try {
      await window.api?.addToPlaylist?.(playlistId, track);
    } catch (error) {
      console.error('[LibraryStore] Failed to add to playlist:', error);
    }
  },

  removeFromPlaylist: async (playlistId, trackId) => {
    set((state) => ({
      playlists: state.playlists.map(p =>
        p.id === playlistId
          ? { ...p, tracks: p.tracks.filter(t => t.id !== trackId), updatedAt: new Date() }
          : p
      ),
    }));

    try {
      await window.api?.removeFromPlaylist?.(playlistId, trackId);
    } catch (error) {
      console.error('[LibraryStore] Failed to remove from playlist:', error);
    }
  },

  reorderPlaylist: (playlistId, fromIndex, toIndex) => {
    set((state) => ({
      playlists: state.playlists.map(p => {
        if (p.id !== playlistId) return p;
        const tracks = [...p.tracks];
        const [removed] = tracks.splice(fromIndex, 1);
        if (removed) {
          tracks.splice(toIndex, 0, removed);
        }
        return { ...p, tracks, updatedAt: new Date() };
      }),
    }));
    // TODO: Sync reorder to server if needed
  },

  movePlaylistToFolder: (playlistId, folderId) => {
    const { playlists } = get();
    const siblingPlaylists = playlists.filter(p => p.folderId === folderId && p.id !== playlistId);
    const maxOrder = siblingPlaylists.reduce((max, p) => Math.max(max, p.order), -1);

    set((state) => ({
      playlists: state.playlists.map(p =>
        p.id === playlistId
          ? { ...p, folderId, order: maxOrder + 1, updatedAt: new Date() }
          : p
      ),
    }));
  },

  // Rule methods for smart/hybrid playlists
  fetchRuleDefinitions: async () => {
    try {
      const res = await window.api?.getPlaylistRules?.();
      if (res?.rules) {
        set({ ruleDefinitions: res.rules });
      }
    } catch (error) {
      console.error('[LibraryStore] Failed to fetch rule definitions:', error);
    }
  },

  evaluatePlaylistRules: async (playlistId) => {
    try {
      const res = await window.api?.evaluatePlaylistRules?.(playlistId);
      if (!res?.tracks) return [];

      // Update the playlist with evaluated tracks
      set((state) => ({
        playlists: state.playlists.map(p =>
          p.id === playlistId
            ? {
                ...p,
                ruleTracks: res.tracks,
                ruleTrackCount: res.count,
                lastEvaluatedAt: Date.now(),
              }
            : p
        ),
      }));

      return res.tracks;
    } catch (error) {
      console.error('[LibraryStore] Failed to evaluate playlist rules:', error);
      return [];
    }
  },

  previewPlaylistRules: async (rules, options = {}) => {
    try {
      const res = await window.api?.previewPlaylistRules?.({
        rules,
        combinator: options.combinator || 'and',
        orderBy: options.orderBy,
        orderDirection: options.orderDirection,
        limit: options.limit,
        source: options.source || 'local',
      });
      return res?.tracks || [];
    } catch (error) {
      console.error('[LibraryStore] Failed to preview playlist rules:', error);
      return [];
    }
  },

  addPlaylistRule: (playlistId, rule) => {
    const newRule: PlaylistRule = {
      ...rule,
      id: `rule_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    };

    set((state) => ({
      playlists: state.playlists.map(p =>
        p.id === playlistId
          ? {
              ...p,
              rules: [...(p.rules || []), newRule],
              combinator: p.combinator || 'and',
              source: p.source || 'local', // Default to local when first rule added
              updatedAt: new Date(),
            }
          : p
      ),
    }));
  },

  updatePlaylistRule: (playlistId, ruleId, data) => {
    set((state) => ({
      playlists: state.playlists.map(p =>
        p.id === playlistId
          ? {
              ...p,
              rules: (p.rules || []).map(r =>
                r.id === ruleId ? { ...r, ...data } : r
              ),
              updatedAt: new Date(),
            }
          : p
      ),
    }));
  },

  removePlaylistRule: (playlistId, ruleId) => {
    set((state) => ({
      playlists: state.playlists.map(p =>
        p.id === playlistId
          ? {
              ...p,
              rules: (p.rules || []).filter(r => r.id !== ruleId),
              updatedAt: new Date(),
            }
          : p
      ),
    }));
  },

  clearPlaylistRules: async (playlistId) => {
    // Clear rules locally
    set((state) => ({
      playlists: state.playlists.map(p =>
        p.id === playlistId
          ? {
              ...p,
              rules: undefined,
              combinator: undefined,
              orderBy: undefined,
              orderDirection: undefined,
              limit: undefined,
              source: undefined,
              ruleTracks: undefined,
              ruleTrackCount: undefined,
              lastEvaluatedAt: undefined,
              updatedAt: new Date(),
            }
          : p
      ),
    }));

    // Sync to server
    try {
      await window.api?.updatePlaylist?.(playlistId, { rules: null });
    } catch (error) {
      console.error('[LibraryStore] Failed to clear playlist rules:', error);
    }
  },

  // Folders (local UI organization only)
  createFolder: (name, parentId = null) => {
    const { folders } = get();
    const siblingFolders = folders.filter(f => f.parentId === parentId);
    const maxOrder = siblingFolders.reduce((max, f) => Math.max(max, f.order), -1);

    const folder: PlaylistFolder = {
      id: crypto.randomUUID(),
      name,
      parentId,
      order: maxOrder + 1,
      isExpanded: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    set((state) => ({
      folders: [...state.folders, folder],
    }));
    return folder;
  },

  deleteFolder: (folderId) => {
    const getDescendantIds = (id: string, folders: PlaylistFolder[]): string[] => {
      const children = folders.filter(f => f.parentId === id);
      return [id, ...children.flatMap(c => getDescendantIds(c.id, folders))];
    };

    const { folders, playlists } = get();
    const folderIdsToDelete = getDescendantIds(folderId, folders);

    set({
      folders: folders.filter(f => !folderIdsToDelete.includes(f.id)),
      playlists: playlists.map(p =>
        folderIdsToDelete.includes(p.folderId ?? '')
          ? { ...p, folderId: null, updatedAt: new Date() }
          : p
      ),
    });
  },

  renameFolder: (folderId, name) => {
    set((state) => ({
      folders: state.folders.map(f =>
        f.id === folderId
          ? { ...f, name, updatedAt: new Date() }
          : f
      ),
    }));
  },

  toggleFolderExpanded: (folderId) => {
    set((state) => ({
      folders: state.folders.map(f =>
        f.id === folderId
          ? { ...f, isExpanded: !f.isExpanded }
          : f
      ),
    }));
  },

  moveFolderToFolder: (folderId, parentId) => {
    const getDescendantIds = (id: string, folders: PlaylistFolder[]): string[] => {
      const children = folders.filter(f => f.parentId === id);
      return [id, ...children.flatMap(c => getDescendantIds(c.id, folders))];
    };

    const { folders } = get();
    const descendantIds = getDescendantIds(folderId, folders);

    if (parentId && descendantIds.includes(parentId)) {
      return;
    }

    const siblingFolders = folders.filter(f => f.parentId === parentId && f.id !== folderId);
    const maxOrder = siblingFolders.reduce((max, f) => Math.max(max, f.order), -1);

    set((state) => ({
      folders: state.folders.map(f =>
        f.id === folderId
          ? { ...f, parentId, order: maxOrder + 1, updatedAt: new Date() }
          : f
      ),
    }));
  },

  reorderSidebarItems: (items) => {
    set((state) => {
      const playlistUpdates = new Map(
        items
          .filter(i => i.type === 'playlist')
          .map(i => [i.id, { order: i.order, folderId: i.parentId }])
      );
      const folderUpdates = new Map(
        items
          .filter(i => i.type === 'folder')
          .map(i => [i.id, { order: i.order, parentId: i.parentId }])
      );

      return {
        playlists: state.playlists.map(p => {
          const update = playlistUpdates.get(p.id);
          return update
            ? { ...p, order: update.order, folderId: update.folderId, updatedAt: new Date() }
            : p;
        }),
        folders: state.folders.map(f => {
          const update = folderUpdates.get(f.id);
          return update
            ? { ...f, order: update.order, parentId: update.parentId, updatedAt: new Date() }
            : f;
        }),
      };
    });
  },

  // Downloads
  startDownload: async (track, options = {}) => {
    try {
      console.log('[LibraryStore] Starting download for:', track.title);

      // Resolve stream URL first
      const streamInfo = await window.api?.playTrack?.(track);
      if (!streamInfo?.url) {
        console.error('[LibraryStore] Failed to resolve stream URL for download');
        throw new Error('Could not resolve stream URL');
      }

      console.log('[LibraryStore] Stream resolved, starting download...');

      // Get artwork URL if available
      const artworkUrl = typeof track.artwork === 'string'
        ? track.artwork
        : track.artwork?.url;

      // Start download on server
      const result = await window.api?.startDownload?.({
        url: streamInfo.url,
        folderId: options.folderId,
        filename: `${track.artists?.[0]?.name || 'Unknown'} - ${track.title}`,
        extension: '.mp3',
        metadata: {
          title: track.title,
          artists: track.artists?.map(a => a.name) || [],
          album: track.album?.title,
          artworkUrl,
        },
        sourceType: 'audio',
        trackData: track,
      });

      console.log('[LibraryStore] Download API response:', result);

      if (result?.success && result.downloadId) {
        // Add to local downloads list
        const download: Download = {
          id: result.downloadId,
          track,
          status: 'queued',
          progress: 0,
          filename: `${track.artists?.[0]?.name || 'Unknown'} - ${track.title}.mp3`,
          startedAt: new Date(),
        };

        set((state) => ({
          downloads: [download, ...state.downloads],
        }));
        console.log('[LibraryStore] Download queued:', result.downloadId);
        showSuccessToast(`Downloading "${track.title}"`);
      } else {
        // API returned failure
        const errorMsg = result?.error || 'Unknown error';
        console.error('[LibraryStore] Download API failed:', errorMsg);
        showErrorToast(`Download failed: ${errorMsg}`);
      }
    } catch (error) {
      console.error('[LibraryStore] Failed to start download:', error);
      showErrorToast(`Download failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  },

  cancelDownload: async (downloadId) => {
    set((state) => ({
      downloads: state.downloads.map(d =>
        d.id === downloadId
          ? { ...d, status: 'cancelled' as const }
          : d
      ),
    }));

    try {
      await window.api?.cancelDownload?.(downloadId);
    } catch (error) {
      console.error('[LibraryStore] Failed to cancel download:', error);
    }
  },

  removeDownload: (downloadId) => {
    set((state) => ({
      downloads: state.downloads.filter(d => d.id !== downloadId),
    }));
  },

  retryDownload: async (downloadId) => {
    const download = get().downloads.find(d => d.id === downloadId);
    if (download?.track) {
      get().removeDownload(downloadId);
      await get().startDownload(download.track);
    }
  },

  getDownload: (trackId) => {
    return get().downloads.find(d => d.track?.id === trackId);
  },
}));
