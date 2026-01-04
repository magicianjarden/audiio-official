/**
 * Library store - manages user's library (likes, playlists, downloads, folders)
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { UnifiedTrack } from '@audiio/core';

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

export interface Playlist {
  id: string;
  name: string;
  description?: string;
  artwork?: string;
  tracks: UnifiedTrack[];
  folderId: string | null;  // null = root level, string = inside folder
  order: number;
  createdAt: Date;
  updatedAt: Date;
  localFolderId?: string;  // Links to local music folder ID for auto-generated playlists
}

export interface Download {
  track: UnifiedTrack;
  status: 'pending' | 'downloading' | 'completed' | 'failed';
  progress: number; // 0-100
  filePath?: string;
  error?: string;
  startedAt: Date;
  completedAt?: Date;
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

  // Playlists
  playlists: Playlist[];

  // Folders
  folders: PlaylistFolder[];

  // Downloads
  downloads: Download[];

  // Actions - Likes
  likeTrack: (track: UnifiedTrack) => void;
  unlikeTrack: (trackId: string) => void;
  isLiked: (trackId: string) => boolean;
  toggleLike: (track: UnifiedTrack) => void;

  // Actions - Dislikes
  dislikeTrack: (track: UnifiedTrack) => void;
  undislikeTrack: (trackId: string) => void;
  isDisliked: (trackId: string) => boolean;
  toggleDislike: (track: UnifiedTrack) => void;

  // Actions - Playlists
  createPlaylist: (name: string, description?: string, folderId?: string | null) => Playlist;
  deletePlaylist: (playlistId: string) => void;
  renamePlaylist: (playlistId: string, name: string) => void;
  addToPlaylist: (playlistId: string, track: UnifiedTrack) => void;
  removeFromPlaylist: (playlistId: string, trackId: string) => void;
  reorderPlaylist: (playlistId: string, fromIndex: number, toIndex: number) => void;
  movePlaylistToFolder: (playlistId: string, folderId: string | null) => void;

  // Actions - Local Music Playlists
  getOrCreateLocalFolderPlaylist: (localFolderId: string, folderName: string) => Playlist;
  setLocalFolderPlaylistTracks: (localFolderId: string, folderName: string, tracks: UnifiedTrack[]) => void;
  deleteLocalFolderPlaylist: (localFolderId: string) => void;
  getLocalFolderTracks: (localFolderId: string) => UnifiedTrack[];

  // Actions - Folders
  createFolder: (name: string, parentId?: string | null) => PlaylistFolder;
  deleteFolder: (folderId: string) => void;
  renameFolder: (folderId: string, name: string) => void;
  toggleFolderExpanded: (folderId: string) => void;
  moveFolderToFolder: (folderId: string, parentId: string | null) => void;
  reorderSidebarItems: (items: Array<{ id: string; type: 'playlist' | 'folder'; order: number; parentId: string | null }>) => void;

  // Actions - Downloads
  startDownload: (track: UnifiedTrack) => void;
  updateDownloadProgress: (trackId: string, progress: number) => void;
  completeDownload: (trackId: string, filePath: string) => void;
  failDownload: (trackId: string, error: string) => void;
  removeDownload: (trackId: string) => void;
  retryDownload: (trackId: string) => void;
  getDownload: (trackId: string) => Download | undefined;
}

export const useLibraryStore = create<LibraryState>()(
  persist(
    (set, get) => ({
      // Initial state
      likedTracks: [],
      dislikedTracks: [],
      playlists: [],
      folders: [],
      downloads: [],

      // Likes
      likeTrack: (track) => {
        set((state) => {
          if (state.likedTracks.some(t => t.track.id === track.id)) {
            return state;
          }
          const libraryTrack: LibraryTrack = {
            track,
            addedAt: Date.now()
          };
          return { likedTracks: [libraryTrack, ...state.likedTracks] };
        });
      },

      unlikeTrack: (trackId) => {
        set((state) => ({
          likedTracks: state.likedTracks.filter(t => t.track.id !== trackId)
        }));
      },

      isLiked: (trackId) => {
        return get().likedTracks.some(t => t.track.id === trackId);
      },

      toggleLike: (track) => {
        const { isLiked, likeTrack, unlikeTrack } = get();
        if (isLiked(track.id)) {
          unlikeTrack(track.id);
        } else {
          likeTrack(track);
        }
      },

      // Dislikes
      dislikeTrack: (track) => {
        set((state) => {
          if (state.dislikedTracks.some(t => t.track.id === track.id)) {
            return state;
          }
          const libraryTrack: LibraryTrack = {
            track,
            addedAt: Date.now()
          };
          return { dislikedTracks: [libraryTrack, ...state.dislikedTracks] };
        });
      },

      undislikeTrack: (trackId) => {
        set((state) => ({
          dislikedTracks: state.dislikedTracks.filter(t => t.track.id !== trackId)
        }));
      },

      isDisliked: (trackId) => {
        return get().dislikedTracks.some(t => t.track.id === trackId);
      },

      toggleDislike: (track) => {
        const { isDisliked, dislikeTrack, undislikeTrack } = get();
        if (isDisliked(track.id)) {
          undislikeTrack(track.id);
        } else {
          dislikeTrack(track);
        }
      },

      // Playlists
      createPlaylist: (name, description, folderId = null) => {
        const { playlists } = get();
        // Calculate next order for this folder level
        const siblingPlaylists = playlists.filter(p => p.folderId === folderId);
        const maxOrder = siblingPlaylists.reduce((max, p) => Math.max(max, p.order), -1);

        const playlist: Playlist = {
          id: crypto.randomUUID(),
          name,
          description,
          tracks: [],
          folderId,
          order: maxOrder + 1,
          createdAt: new Date(),
          updatedAt: new Date()
        };
        set((state) => ({
          playlists: [playlist, ...state.playlists]
        }));
        return playlist;
      },

      deletePlaylist: (playlistId) => {
        set((state) => ({
          playlists: state.playlists.filter(p => p.id !== playlistId)
        }));
      },

      renamePlaylist: (playlistId, name) => {
        set((state) => ({
          playlists: state.playlists.map(p =>
            p.id === playlistId
              ? { ...p, name, updatedAt: new Date() }
              : p
          )
        }));
      },

      addToPlaylist: (playlistId, track) => {
        set((state) => ({
          playlists: state.playlists.map(p => {
            if (p.id !== playlistId) return p;
            if (p.tracks.some(t => t.id === track.id)) return p;
            return {
              ...p,
              tracks: [...p.tracks, track],
              updatedAt: new Date()
            };
          })
        }));
      },

      removeFromPlaylist: (playlistId, trackId) => {
        set((state) => ({
          playlists: state.playlists.map(p =>
            p.id === playlistId
              ? {
                  ...p,
                  tracks: p.tracks.filter(t => t.id !== trackId),
                  updatedAt: new Date()
                }
              : p
          )
        }));
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
          })
        }));
      },

      movePlaylistToFolder: (playlistId, folderId) => {
        const { playlists } = get();
        // Calculate next order in target folder
        const siblingPlaylists = playlists.filter(p => p.folderId === folderId && p.id !== playlistId);
        const maxOrder = siblingPlaylists.reduce((max, p) => Math.max(max, p.order), -1);

        set((state) => ({
          playlists: state.playlists.map(p =>
            p.id === playlistId
              ? { ...p, folderId, order: maxOrder + 1, updatedAt: new Date() }
              : p
          )
        }));
      },

      // Local Music Playlists
      getOrCreateLocalFolderPlaylist: (localFolderId, folderName) => {
        const { playlists } = get();

        // Look for existing playlist linked to this local folder
        const existing = playlists.find(p => p.localFolderId === localFolderId);
        if (existing) {
          return existing;
        }

        // Calculate next order at root level
        const siblingPlaylists = playlists.filter(p => p.folderId === null);
        const maxOrder = siblingPlaylists.reduce((max, p) => Math.max(max, p.order), -1);

        // Create new playlist for this local folder
        const playlist: Playlist = {
          id: crypto.randomUUID(),
          name: `Local: ${folderName}`,
          description: `Music from ${folderName}`,
          tracks: [],
          folderId: null,
          order: maxOrder + 1,
          createdAt: new Date(),
          updatedAt: new Date(),
          localFolderId
        };

        set((state) => ({
          playlists: [playlist, ...state.playlists]
        }));

        return playlist;
      },

      setLocalFolderPlaylistTracks: (localFolderId, folderName, tracks) => {
        const { playlists } = get();

        // Find or create the playlist for this folder
        let playlist = playlists.find(p => p.localFolderId === localFolderId);

        if (!playlist) {
          // Create the playlist first
          playlist = get().getOrCreateLocalFolderPlaylist(localFolderId, folderName);
        }

        // Update the playlist with the new tracks (replaces all tracks)
        set((state) => ({
          playlists: state.playlists.map(p =>
            p.localFolderId === localFolderId
              ? { ...p, tracks, updatedAt: new Date() }
              : p
          )
        }));
      },

      deleteLocalFolderPlaylist: (localFolderId) => {
        set((state) => ({
          playlists: state.playlists.filter(p => p.localFolderId !== localFolderId)
        }));
      },

      getLocalFolderTracks: (localFolderId) => {
        const { playlists } = get();
        const playlist = playlists.find(p => p.localFolderId === localFolderId);
        return playlist?.tracks || [];
      },

      // Folders
      createFolder: (name, parentId = null) => {
        const { folders } = get();
        // Calculate next order for this folder level
        const siblingFolders = folders.filter(f => f.parentId === parentId);
        const maxOrder = siblingFolders.reduce((max, f) => Math.max(max, f.order), -1);

        const folder: PlaylistFolder = {
          id: crypto.randomUUID(),
          name,
          parentId,
          order: maxOrder + 1,
          isExpanded: true,
          createdAt: new Date(),
          updatedAt: new Date()
        };
        set((state) => ({
          folders: [...state.folders, folder]
        }));
        return folder;
      },

      deleteFolder: (folderId) => {
        // Get all descendant folder IDs recursively
        const getDescendantIds = (id: string, folders: PlaylistFolder[]): string[] => {
          const children = folders.filter(f => f.parentId === id);
          return [id, ...children.flatMap(c => getDescendantIds(c.id, folders))];
        };

        const { folders, playlists } = get();
        const folderIdsToDelete = getDescendantIds(folderId, folders);

        set({
          // Remove all descendant folders
          folders: folders.filter(f => !folderIdsToDelete.includes(f.id)),
          // Move playlists in deleted folders to root
          playlists: playlists.map(p =>
            folderIdsToDelete.includes(p.folderId ?? '')
              ? { ...p, folderId: null, updatedAt: new Date() }
              : p
          )
        });
      },

      renameFolder: (folderId, name) => {
        set((state) => ({
          folders: state.folders.map(f =>
            f.id === folderId
              ? { ...f, name, updatedAt: new Date() }
              : f
          )
        }));
      },

      toggleFolderExpanded: (folderId) => {
        set((state) => ({
          folders: state.folders.map(f =>
            f.id === folderId
              ? { ...f, isExpanded: !f.isExpanded }
              : f
          )
        }));
      },

      moveFolderToFolder: (folderId, parentId) => {
        // Prevent moving folder into itself or its descendants
        const getDescendantIds = (id: string, folders: PlaylistFolder[]): string[] => {
          const children = folders.filter(f => f.parentId === id);
          return [id, ...children.flatMap(c => getDescendantIds(c.id, folders))];
        };

        const { folders } = get();
        const descendantIds = getDescendantIds(folderId, folders);

        // Can't move into self or descendant
        if (parentId && descendantIds.includes(parentId)) {
          return;
        }

        // Calculate next order in target folder
        const siblingFolders = folders.filter(f => f.parentId === parentId && f.id !== folderId);
        const maxOrder = siblingFolders.reduce((max, f) => Math.max(max, f.order), -1);

        set((state) => ({
          folders: state.folders.map(f =>
            f.id === folderId
              ? { ...f, parentId, order: maxOrder + 1, updatedAt: new Date() }
              : f
          )
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
            })
          };
        });
      },

      // Downloads
      startDownload: (track) => {
        set((state) => {
          // Don't add if already exists
          if (state.downloads.some(d => d.track.id === track.id)) {
            return state;
          }
          const download: Download = {
            track,
            status: 'pending',
            progress: 0,
            startedAt: new Date()
          };
          return { downloads: [download, ...state.downloads] };
        });

        // Trigger download via IPC
        if (window.api?.downloadTrack) {
          window.api.downloadTrack(track);
        }
      },

      updateDownloadProgress: (trackId, progress) => {
        set((state) => ({
          downloads: state.downloads.map(d =>
            d.track.id === trackId
              ? { ...d, status: 'downloading' as const, progress }
              : d
          )
        }));
      },

      completeDownload: (trackId, filePath) => {
        set((state) => ({
          downloads: state.downloads.map(d =>
            d.track.id === trackId
              ? {
                  ...d,
                  status: 'completed' as const,
                  progress: 100,
                  filePath,
                  completedAt: new Date()
                }
              : d
          )
        }));
      },

      failDownload: (trackId, error) => {
        set((state) => ({
          downloads: state.downloads.map(d =>
            d.track.id === trackId
              ? { ...d, status: 'failed' as const, error }
              : d
          )
        }));
      },

      removeDownload: (trackId) => {
        set((state) => ({
          downloads: state.downloads.filter(d => d.track.id !== trackId)
        }));
      },

      retryDownload: (trackId) => {
        const download = get().downloads.find(d => d.track.id === trackId);
        if (download) {
          set((state) => ({
            downloads: state.downloads.map(d =>
              d.track.id === trackId
                ? { ...d, status: 'pending' as const, progress: 0, error: undefined }
                : d
            )
          }));
          if (window.api?.downloadTrack) {
            window.api.downloadTrack(download.track);
          }
        }
      },

      getDownload: (trackId) => {
        return get().downloads.find(d => d.track.id === trackId);
      }
    }),
    {
      name: 'audiio-library',
      version: 3,
      migrate: (persistedState: unknown, version: number) => {
        let state = persistedState as Record<string, unknown>;

        if (version < 2) {
          // Migration from v1 to v2: Add folderId and order to playlists
          const playlists = (state.playlists as Array<Record<string, unknown>> || []).map((p, i) => ({
            ...p,
            folderId: p.folderId ?? null,
            order: p.order ?? i
          }));
          state = {
            ...state,
            playlists,
            folders: []
          };
        }

        if (version < 3) {
          // Migration from v2 to v3: Wrap liked/disliked tracks with timestamps
          const migrateToLibraryTrack = (tracks: unknown[]): LibraryTrack[] => {
            if (!Array.isArray(tracks)) return [];
            return tracks
              .filter(item => item != null) // Filter out null/undefined
              .map((item, index) => {
                // Check if already migrated (has track property)
                if (item && typeof item === 'object' && 'track' in item && 'addedAt' in item) {
                  const libTrack = item as LibraryTrack;
                  // Validate the track itself exists
                  if (libTrack.track?.id) {
                    return libTrack;
                  }
                  return null; // Invalid track
                }
                // Old format - just a track, add timestamp
                const track = item as UnifiedTrack;
                if (!track?.id) return null; // Skip invalid tracks
                return {
                  track,
                  addedAt: Date.now() - (tracks.length - index) * 1000
                };
              })
              .filter((item): item is LibraryTrack => item !== null);
          };

          state = {
            ...state,
            likedTracks: migrateToLibraryTrack(state.likedTracks as unknown[]),
            dislikedTracks: migrateToLibraryTrack(state.dislikedTracks as unknown[])
          };
        }

        return state;
      },
      partialize: (state) => ({
        likedTracks: state.likedTracks,
        dislikedTracks: state.dislikedTracks,
        playlists: state.playlists,
        folders: state.folders,
        downloads: state.downloads.filter(d => d.status === 'completed')
      })
    }
  )
);
