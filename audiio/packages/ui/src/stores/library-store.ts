/**
 * Library store - manages user's library (likes, playlists, downloads)
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { UnifiedTrack } from '@audiio/core';

export interface Playlist {
  id: string;
  name: string;
  description?: string;
  artwork?: string;
  tracks: UnifiedTrack[];
  createdAt: Date;
  updatedAt: Date;
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

interface LibraryState {
  // Liked tracks
  likedTracks: UnifiedTrack[];

  // Disliked tracks
  dislikedTracks: UnifiedTrack[];

  // Playlists
  playlists: Playlist[];

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
  createPlaylist: (name: string, description?: string) => Playlist;
  deletePlaylist: (playlistId: string) => void;
  renamePlaylist: (playlistId: string, name: string) => void;
  addToPlaylist: (playlistId: string, track: UnifiedTrack) => void;
  removeFromPlaylist: (playlistId: string, trackId: string) => void;
  reorderPlaylist: (playlistId: string, fromIndex: number, toIndex: number) => void;

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
      downloads: [],

      // Likes
      likeTrack: (track) => {
        set((state) => {
          if (state.likedTracks.some(t => t.id === track.id)) {
            return state;
          }
          return { likedTracks: [track, ...state.likedTracks] };
        });
      },

      unlikeTrack: (trackId) => {
        set((state) => ({
          likedTracks: state.likedTracks.filter(t => t.id !== trackId)
        }));
      },

      isLiked: (trackId) => {
        return get().likedTracks.some(t => t.id === trackId);
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
          if (state.dislikedTracks.some(t => t.id === track.id)) {
            return state;
          }
          return { dislikedTracks: [track, ...state.dislikedTracks] };
        });
      },

      undislikeTrack: (trackId) => {
        set((state) => ({
          dislikedTracks: state.dislikedTracks.filter(t => t.id !== trackId)
        }));
      },

      isDisliked: (trackId) => {
        return get().dislikedTracks.some(t => t.id === trackId);
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
      createPlaylist: (name, description) => {
        const playlist: Playlist = {
          id: crypto.randomUUID(),
          name,
          description,
          tracks: [],
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
      partialize: (state) => ({
        likedTracks: state.likedTracks,
        dislikedTracks: state.dislikedTracks,
        playlists: state.playlists,
        downloads: state.downloads.filter(d => d.status === 'completed')
      })
    }
  )
);
