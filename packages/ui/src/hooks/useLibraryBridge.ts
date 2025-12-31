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
  signalLibraryBridgeReady: () => void;
  onLibraryDataRequest: (callback: () => void) => () => void;
  sendLibraryData: (data: {
    likedTracks: UnifiedTrack[];
    playlists: Playlist[];
    dislikedTrackIds: string[];
    dislikedTracks: UnifiedTrack[]; // Full track objects for mobile
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
  // Use getState() pattern - don't subscribe to store updates to avoid re-renders
  // This hook only needs to respond to IPC events, not react to state changes
  const getLibraryState = useLibraryStore.getState;
  const getRecommendationState = useRecommendationStore.getState;
  const previousLikedRef = useRef<string[]>([]);
  const previousPlaylistsRef = useRef<string[]>([]);

  useEffect(() => {
    // Skip if not in Electron environment
    if (!window.api?.onLibraryDataRequest) {
      return;
    }

    // Handle data requests from main process
    const unsubDataRequest = window.api.onLibraryDataRequest(() => {
      const libState = getLibraryState();
      const recState = getRecommendationState();
      const likedTracks = libState.likedTracks;
      const playlists = libState.playlists;
      const dislikedTrackIds = Object.keys(recState.dislikedTracks || {});

      // Extract full track objects from disliked tracks
      const dislikedTracks = Object.values(recState.dislikedTracks || {})
        .map(d => d.track)
        .filter((t): t is UnifiedTrack => t !== undefined);

      window.api?.sendLibraryData({
        likedTracks,
        playlists,
        dislikedTrackIds,
        dislikedTracks
      });
    });

    // Handle library actions from main process (mobile triggers)
    const actionUnsubscribers: (() => void)[] = [];

    // Like action
    if (window.api?.onLibraryAction) {
      actionUnsubscribers.push(
        window.api.onLibraryAction('like', (payload) => {
          const track = payload as UnifiedTrack;
          const lib = getLibraryState();
          if (track && !lib.isLiked(track.id)) {
            lib.likeTrack(track);
          }
        })
      );

      // Unlike action
      actionUnsubscribers.push(
        window.api.onLibraryAction('unlike', (payload) => {
          const trackId = payload as string;
          const lib = getLibraryState();
          if (trackId && lib.isLiked(trackId)) {
            lib.unlikeTrack(trackId);
          }
        })
      );

      // Dislike action
      actionUnsubscribers.push(
        window.api.onLibraryAction('dislike', (payload) => {
          const { track, reasons } = payload as { track: UnifiedTrack; reasons: string[] };
          if (track) {
            getRecommendationState().recordDislike(track, reasons);
          }
        })
      );

      // Remove dislike action
      actionUnsubscribers.push(
        window.api.onLibraryAction('remove-dislike', (payload) => {
          const trackId = payload as string;
          if (trackId) {
            getRecommendationState().removeDislike(trackId);
          }
        })
      );

      // Create playlist action
      actionUnsubscribers.push(
        window.api.onLibraryAction('create-playlist', (payload) => {
          const { name, description } = payload as { name: string; description?: string };
          if (name) {
            const playlist = getLibraryState().createPlaylist(name, description);
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
            getLibraryState().deletePlaylist(playlistId);
          }
        })
      );

      // Rename playlist action
      actionUnsubscribers.push(
        window.api.onLibraryAction('rename-playlist', (payload) => {
          const { playlistId, name } = payload as { playlistId: string; name: string };
          if (playlistId && name) {
            getLibraryState().renamePlaylist(playlistId, name);
          }
        })
      );

      // Add to playlist action
      actionUnsubscribers.push(
        window.api.onLibraryAction('add-to-playlist', (payload) => {
          const { playlistId, track } = payload as { playlistId: string; track: UnifiedTrack };
          if (playlistId && track) {
            getLibraryState().addToPlaylist(playlistId, track);
          }
        })
      );

      // Remove from playlist action
      actionUnsubscribers.push(
        window.api.onLibraryAction('remove-from-playlist', (payload) => {
          const { playlistId, trackId } = payload as { playlistId: string; trackId: string };
          if (playlistId && trackId) {
            getLibraryState().removeFromPlaylist(playlistId, trackId);
          }
        })
      );
    }

    // Signal to main process that bridge is ready
    window.api?.signalLibraryBridgeReady?.();

    return () => {
      unsubDataRequest();
      actionUnsubscribers.forEach(unsub => unsub());
    };
  }, []); // Empty deps - uses getState() for all store access

  // Watch for library changes and notify main process
  // Uses Zustand subscribe() to avoid causing component re-renders
  useEffect(() => {
    if (!window.api?.notifyLibraryChange) return;

    // Initialize refs with current state
    const initialState = getLibraryState();
    previousLikedRef.current = initialState.likedTracks.map(t => t.track.id);
    previousPlaylistsRef.current = initialState.playlists.map(p => p.id);

    // Subscribe to store changes without triggering re-renders
    const unsubscribe = useLibraryStore.subscribe((state) => {
      // NOTE: likedTracks is LibraryTrack[] (wrapper objects), access t.track.id
      const currentLikedIds = state.likedTracks.map(t => t.track.id);
      const currentPlaylistIds = state.playlists.map(p => p.id);

      // Check for liked track changes
      const addedLikes = currentLikedIds.filter(id => !previousLikedRef.current.includes(id));
      const removedLikes = previousLikedRef.current.filter(id => !currentLikedIds.includes(id));

      addedLikes.forEach(id => {
        const libraryTrack = state.likedTracks.find(t => t.track.id === id);
        if (libraryTrack) {
          window.api?.notifyLibraryChange('library-track-liked', libraryTrack.track);
        }
      });

      removedLikes.forEach(id => {
        window.api?.notifyLibraryChange('library-track-unliked', id);
      });

      // Check for playlist changes
      const addedPlaylists = currentPlaylistIds.filter(id => !previousPlaylistsRef.current.includes(id));
      const removedPlaylists = previousPlaylistsRef.current.filter(id => !currentPlaylistIds.includes(id));

      addedPlaylists.forEach(id => {
        const playlist = state.playlists.find(p => p.id === id);
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
    });

    return unsubscribe;
  }, []); // Empty deps - uses subscribe() which handles its own cleanup
}
