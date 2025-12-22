/**
 * Library Bridge Hook - Connects UI library stores to main process for mobile sync
 *
 * This hook:
 * 1. Listens for data requests from main process and responds with library state
 * 2. Listens for action requests from main process (triggered by mobile)
 * 3. Notifies main process when library changes occur
 */

import { useEffect, useRef } from 'react';
import { useLibraryStore } from '../stores/library-store';
import { useRecommendationStore } from '../stores/recommendation-store';
import type { UnifiedTrack, Playlist } from '@audiio/sdk';

// Type for the preload API
interface LibraryBridgeAPI {
  onLibraryDataRequest: (callback: () => void) => () => void;
  sendLibraryData: (data: {
    likedTracks: UnifiedTrack[];
    playlists: Playlist[];
    dislikedTrackIds: string[];
  }) => void;
  notifyLibraryChange: (type: string, data: unknown) => void;
  onLibraryAction: (
    action: string,
    callback: (payload: unknown) => void
  ) => () => void;
}

declare global {
  interface Window {
    api?: LibraryBridgeAPI;
  }
}

export function useLibraryBridge(): void {
  const libraryStore = useLibraryStore();
  const recommendationStore = useRecommendationStore();
  const previousLikedRef = useRef<string[]>([]);
  const previousPlaylistsRef = useRef<string[]>([]);

  useEffect(() => {
    // Skip if not in Electron environment
    if (!window.api?.onLibraryDataRequest) {
      return;
    }

    // Handle data requests from main process
    const unsubDataRequest = window.api.onLibraryDataRequest(() => {
      const likedTracks = libraryStore.likedTracks;
      const playlists = libraryStore.playlists;
      const dislikedTrackIds = Object.keys(recommendationStore.dislikedTracks || {});

      window.api?.sendLibraryData({
        likedTracks,
        playlists,
        dislikedTrackIds
      });
    });

    // Handle library actions from main process (mobile triggers)
    const actionUnsubscribers: (() => void)[] = [];

    // Like action
    if (window.api?.onLibraryAction) {
      actionUnsubscribers.push(
        window.api.onLibraryAction('like', (payload) => {
          const track = payload as UnifiedTrack;
          if (track && !libraryStore.isLiked(track.id)) {
            libraryStore.likeTrack(track);
          }
        })
      );

      // Unlike action
      actionUnsubscribers.push(
        window.api.onLibraryAction('unlike', (payload) => {
          const trackId = payload as string;
          if (trackId && libraryStore.isLiked(trackId)) {
            libraryStore.unlikeTrack(trackId);
          }
        })
      );

      // Dislike action
      actionUnsubscribers.push(
        window.api.onLibraryAction('dislike', (payload) => {
          const { track, reasons } = payload as { track: UnifiedTrack; reasons: string[] };
          if (track) {
            recommendationStore.recordDislike(track, reasons);
          }
        })
      );

      // Remove dislike action
      actionUnsubscribers.push(
        window.api.onLibraryAction('remove-dislike', (payload) => {
          const trackId = payload as string;
          if (trackId) {
            recommendationStore.removeDislike(trackId);
          }
        })
      );

      // Create playlist action
      actionUnsubscribers.push(
        window.api.onLibraryAction('create-playlist', (payload) => {
          const { name, description } = payload as { name: string; description?: string };
          if (name) {
            const playlist = libraryStore.createPlaylist(name, description);
            // Notify back with created playlist
            window.api?.notifyLibraryChange('library-playlist-created', playlist);
          }
        })
      );

      // Delete playlist action
      actionUnsubscribers.push(
        window.api.onLibraryAction('delete-playlist', (payload) => {
          const playlistId = payload as string;
          if (playlistId) {
            libraryStore.deletePlaylist(playlistId);
          }
        })
      );

      // Rename playlist action
      actionUnsubscribers.push(
        window.api.onLibraryAction('rename-playlist', (payload) => {
          const { playlistId, name } = payload as { playlistId: string; name: string };
          if (playlistId && name) {
            libraryStore.renamePlaylist(playlistId, name);
          }
        })
      );

      // Add to playlist action
      actionUnsubscribers.push(
        window.api.onLibraryAction('add-to-playlist', (payload) => {
          const { playlistId, track } = payload as { playlistId: string; track: UnifiedTrack };
          if (playlistId && track) {
            libraryStore.addToPlaylist(playlistId, track);
          }
        })
      );

      // Remove from playlist action
      actionUnsubscribers.push(
        window.api.onLibraryAction('remove-from-playlist', (payload) => {
          const { playlistId, trackId } = payload as { playlistId: string; trackId: string };
          if (playlistId && trackId) {
            libraryStore.removeFromPlaylist(playlistId, trackId);
          }
        })
      );
    }

    return () => {
      unsubDataRequest();
      actionUnsubscribers.forEach(unsub => unsub());
    };
  }, [libraryStore, recommendationStore]);

  // Watch for library changes and notify main process
  useEffect(() => {
    if (!window.api?.notifyLibraryChange) return;

    const currentLikedIds = libraryStore.likedTracks.map(t => t.id);
    const currentPlaylistIds = libraryStore.playlists.map(p => p.id);

    // Check for liked track changes
    const addedLikes = currentLikedIds.filter(id => !previousLikedRef.current.includes(id));
    const removedLikes = previousLikedRef.current.filter(id => !currentLikedIds.includes(id));

    addedLikes.forEach(id => {
      const track = libraryStore.likedTracks.find(t => t.id === id);
      if (track) {
        window.api?.notifyLibraryChange('library-track-liked', track);
      }
    });

    removedLikes.forEach(id => {
      window.api?.notifyLibraryChange('library-track-unliked', id);
    });

    // Check for playlist changes
    const addedPlaylists = currentPlaylistIds.filter(id => !previousPlaylistsRef.current.includes(id));
    const removedPlaylists = previousPlaylistsRef.current.filter(id => !currentPlaylistIds.includes(id));

    addedPlaylists.forEach(id => {
      const playlist = libraryStore.playlists.find(p => p.id === id);
      if (playlist) {
        window.api?.notifyLibraryChange('library-playlist-created', playlist);
      }
    });

    removedPlaylists.forEach(id => {
      window.api?.notifyLibraryChange('library-playlist-deleted', id);
    });

    // Update refs
    previousLikedRef.current = currentLikedIds;
    previousPlaylistsRef.current = currentPlaylistIds;
  }, [libraryStore.likedTracks, libraryStore.playlists]);
}
