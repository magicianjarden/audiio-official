/**
 * Library Store - Manages library data synced from desktop
 *
 * Fetches liked tracks, playlists from the desktop via API and caches locally.
 * All changes are synced back to the desktop.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { tunnelFetch } from './auth-store';

// Track type matching desktop's UnifiedTrack
export interface Track {
  id: string;
  title: string;
  artists: Array<{ id: string; name: string }>;
  album?: {
    id: string;
    title: string;
    artwork?: {
      small?: string;
      medium?: string;
      large?: string;
      original?: string;
    };
  };
  artwork?: {
    small?: string;
    medium?: string;
    large?: string;
    original?: string;
  };
  duration: number;
  _meta?: {
    metadataProvider?: string;
    [key: string]: unknown;
  };
}

// Playlist type matching desktop
export interface Playlist {
  id: string;
  name: string;
  description?: string;
  artwork?: string;
  tracks: Track[];
  createdAt: Date | string;
  updatedAt: Date | string;
}

interface LibraryState {
  // Data
  likedTracks: Track[];
  dislikedTracks: Track[];
  playlists: Playlist[];
  dislikedTrackIds: string[];

  // State
  isLoading: boolean;
  isSynced: boolean;
  lastSyncAt: number | null;
  error: string | null;

  // Actions
  fetchLibrary: () => Promise<void>;
  refreshLibrary: () => Promise<void>;

  // Likes
  likeTrack: (track: Track) => Promise<boolean>;
  unlikeTrack: (trackId: string) => Promise<boolean>;
  toggleLike: (track: Track) => Promise<boolean>;
  isLiked: (trackId: string) => boolean;

  // Dislikes
  dislikeTrack: (track: Track, reasons: string[]) => Promise<boolean>;
  removeDislike: (trackId: string) => Promise<boolean>;
  isDisliked: (trackId: string) => boolean;

  // Playlists
  createPlaylist: (name: string, description?: string) => Promise<Playlist | null>;
  deletePlaylist: (playlistId: string) => Promise<boolean>;
  renamePlaylist: (playlistId: string, name: string) => Promise<boolean>;
  addToPlaylist: (playlistId: string, track: Track) => Promise<boolean>;
  removeFromPlaylist: (playlistId: string, trackId: string) => Promise<boolean>;
  getPlaylist: (playlistId: string) => Playlist | undefined;

  // Utils
  clearError: () => void;
}

export const useLibraryStore = create<LibraryState>()(
  persist(
    (set, get) => ({
      // Initial state
      likedTracks: [],
      dislikedTracks: [],
      playlists: [],
      dislikedTrackIds: [],
      isLoading: false,
      isSynced: false,
      lastSyncAt: null,
      error: null,

      // Fetch library data from desktop
      fetchLibrary: async () => {
        const { isLoading } = get();
        if (isLoading) return;

        set({ isLoading: true, error: null });

        try {
          // Fetch likes, dislikes, and playlists in parallel
          const [likesRes, dislikesRes, playlistsRes] = await Promise.all([
            tunnelFetch('/api/library/likes'),
            tunnelFetch('/api/library/dislikes'),
            tunnelFetch('/api/library/playlists')
          ]);

          const likesData = await likesRes.json();
          const dislikesData = await dislikesRes.json();
          const playlistsData = await playlistsRes.json();

          set({
            likedTracks: likesData.tracks || [],
            dislikedTracks: dislikesData.tracks || [],
            dislikedTrackIds: (dislikesData.tracks || []).map((t: Track) => t.id),
            playlists: playlistsData.playlists || [],
            isSynced: likesData.synced && playlistsData.synced,
            lastSyncAt: Date.now(),
            isLoading: false
          });
        } catch (error) {
          console.error('[LibraryStore] Fetch error:', error);
          set({
            isLoading: false,
            error: 'Failed to sync library'
          });
        }
      },

      // Force refresh library
      refreshLibrary: async () => {
        set({ isLoading: true });
        await get().fetchLibrary();
      },

      // Like a track
      likeTrack: async (track) => {
        // Optimistic update
        const currentLikes = get().likedTracks;
        if (!currentLikes.find(t => t.id === track.id)) {
          set({ likedTracks: [...currentLikes, track] });
        }

        try {
          const response = await tunnelFetch('/api/library/likes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ track })
          });

          if (!response.ok) {
            // Rollback
            set({ likedTracks: currentLikes });
            return false;
          }

          return true;
        } catch (error) {
          console.error('[LibraryStore] Like error:', error);
          set({ likedTracks: currentLikes });
          return false;
        }
      },

      // Unlike a track
      unlikeTrack: async (trackId) => {
        const currentLikes = get().likedTracks;
        // Optimistic update
        set({ likedTracks: currentLikes.filter(t => t.id !== trackId) });

        try {
          const response = await tunnelFetch(`/api/library/likes/${trackId}`, {
            method: 'DELETE'
          });

          if (!response.ok) {
            // Rollback
            set({ likedTracks: currentLikes });
            return false;
          }

          return true;
        } catch (error) {
          console.error('[LibraryStore] Unlike error:', error);
          set({ likedTracks: currentLikes });
          return false;
        }
      },

      // Toggle like status
      toggleLike: async (track) => {
        if (get().isLiked(track.id)) {
          return get().unlikeTrack(track.id);
        }
        return get().likeTrack(track);
      },

      // Check if track is liked
      isLiked: (trackId) => {
        return get().likedTracks.some(t => t.id === trackId);
      },

      // Dislike a track
      dislikeTrack: async (track, reasons) => {
        const currentDislikes = get().dislikedTrackIds;
        const currentDislikedTracks = get().dislikedTracks;
        if (!currentDislikes.includes(track.id)) {
          set({
            dislikedTrackIds: [...currentDislikes, track.id],
            dislikedTracks: [...currentDislikedTracks, track]
          });
        }

        try {
          const response = await tunnelFetch('/api/library/dislikes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ track, reasons })
          });

          return response.ok;
        } catch (error) {
          console.error('[LibraryStore] Dislike error:', error);
          set({
            dislikedTrackIds: currentDislikes,
            dislikedTracks: currentDislikedTracks
          });
          return false;
        }
      },

      // Remove dislike
      removeDislike: async (trackId) => {
        const currentDislikes = get().dislikedTrackIds;
        const currentDislikedTracks = get().dislikedTracks;
        set({
          dislikedTrackIds: currentDislikes.filter(id => id !== trackId),
          dislikedTracks: currentDislikedTracks.filter(t => t.id !== trackId)
        });

        try {
          const response = await tunnelFetch(`/api/library/dislikes/${trackId}`, {
            method: 'DELETE'
          });

          if (!response.ok) {
            set({
              dislikedTrackIds: currentDislikes,
              dislikedTracks: currentDislikedTracks
            });
            return false;
          }

          return true;
        } catch (error) {
          console.error('[LibraryStore] Remove dislike error:', error);
          set({
            dislikedTrackIds: currentDislikes,
            dislikedTracks: currentDislikedTracks
          });
          return false;
        }
      },

      // Check if track is disliked
      isDisliked: (trackId) => {
        return get().dislikedTrackIds.includes(trackId);
      },

      // Create a playlist
      createPlaylist: async (name, description) => {
        try {
          const response = await tunnelFetch('/api/library/playlists', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, description })
          });

          const data = await response.json();

          if (data.success && data.playlist) {
            const currentPlaylists = get().playlists;
            set({ playlists: [...currentPlaylists, data.playlist] });
            return data.playlist;
          }

          return null;
        } catch (error) {
          console.error('[LibraryStore] Create playlist error:', error);
          return null;
        }
      },

      // Delete a playlist
      deletePlaylist: async (playlistId) => {
        const currentPlaylists = get().playlists;
        set({ playlists: currentPlaylists.filter(p => p.id !== playlistId) });

        try {
          const response = await tunnelFetch(`/api/library/playlists/${playlistId}`, {
            method: 'DELETE'
          });

          if (!response.ok) {
            set({ playlists: currentPlaylists });
            return false;
          }

          return true;
        } catch (error) {
          console.error('[LibraryStore] Delete playlist error:', error);
          set({ playlists: currentPlaylists });
          return false;
        }
      },

      // Rename a playlist
      renamePlaylist: async (playlistId, name) => {
        const currentPlaylists = get().playlists;
        const playlistIndex = currentPlaylists.findIndex(p => p.id === playlistId);

        if (playlistIndex < 0) return false;

        // Optimistic update
        const updatedPlaylists = [...currentPlaylists];
        updatedPlaylists[playlistIndex] = {
          ...updatedPlaylists[playlistIndex],
          name,
          updatedAt: new Date().toISOString()
        };
        set({ playlists: updatedPlaylists });

        try {
          const response = await tunnelFetch(`/api/library/playlists/${playlistId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name })
          });

          if (!response.ok) {
            set({ playlists: currentPlaylists });
            return false;
          }

          return true;
        } catch (error) {
          console.error('[LibraryStore] Rename playlist error:', error);
          set({ playlists: currentPlaylists });
          return false;
        }
      },

      // Add track to playlist
      addToPlaylist: async (playlistId, track) => {
        const currentPlaylists = get().playlists;
        const playlistIndex = currentPlaylists.findIndex(p => p.id === playlistId);

        if (playlistIndex < 0) return false;

        const playlist = currentPlaylists[playlistIndex];

        // Check if already in playlist
        if (playlist.tracks.some(t => t.id === track.id)) return true;

        // Optimistic update
        const updatedPlaylists = [...currentPlaylists];
        updatedPlaylists[playlistIndex] = {
          ...playlist,
          tracks: [...playlist.tracks, track],
          updatedAt: new Date().toISOString()
        };
        set({ playlists: updatedPlaylists });

        try {
          const response = await tunnelFetch(`/api/library/playlists/${playlistId}/tracks`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ track })
          });

          if (!response.ok) {
            set({ playlists: currentPlaylists });
            return false;
          }

          return true;
        } catch (error) {
          console.error('[LibraryStore] Add to playlist error:', error);
          set({ playlists: currentPlaylists });
          return false;
        }
      },

      // Remove track from playlist
      removeFromPlaylist: async (playlistId, trackId) => {
        const currentPlaylists = get().playlists;
        const playlistIndex = currentPlaylists.findIndex(p => p.id === playlistId);

        if (playlistIndex < 0) return false;

        const playlist = currentPlaylists[playlistIndex];

        // Optimistic update
        const updatedPlaylists = [...currentPlaylists];
        updatedPlaylists[playlistIndex] = {
          ...playlist,
          tracks: playlist.tracks.filter(t => t.id !== trackId),
          updatedAt: new Date().toISOString()
        };
        set({ playlists: updatedPlaylists });

        try {
          const response = await tunnelFetch(`/api/library/playlists/${playlistId}/tracks/${trackId}`, {
            method: 'DELETE'
          });

          if (!response.ok) {
            set({ playlists: currentPlaylists });
            return false;
          }

          return true;
        } catch (error) {
          console.error('[LibraryStore] Remove from playlist error:', error);
          set({ playlists: currentPlaylists });
          return false;
        }
      },

      // Get a playlist by ID
      getPlaylist: (playlistId) => {
        return get().playlists.find(p => p.id === playlistId);
      },

      // Clear error
      clearError: () => {
        set({ error: null });
      }
    }),
    {
      name: 'audiio-mobile-library',
      partialize: (state) => ({
        likedTracks: state.likedTracks,
        dislikedTracks: state.dislikedTracks,
        playlists: state.playlists,
        dislikedTrackIds: state.dislikedTrackIds,
        lastSyncAt: state.lastSyncAt
      })
    }
  )
);

// Dislike reasons (matching desktop)
export const DISLIKE_REASONS = [
  { id: 'not_my_taste', label: "Not my taste" },
  { id: 'heard_too_much', label: "Heard it too much" },
  { id: 'wrong_mood', label: "Not right for my mood" },
  { id: 'explicit', label: "Too explicit" },
  { id: 'poor_quality', label: "Poor audio quality" },
  { id: 'wrong_artist', label: "Don't like this artist" },
  { id: 'wrong_genre', label: "Don't like this genre" },
  { id: 'other', label: "Other reason" }
] as const;

export type DislikeReason = typeof DISLIKE_REASONS[number]['id'];
