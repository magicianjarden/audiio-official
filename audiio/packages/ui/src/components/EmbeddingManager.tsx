/**
 * EmbeddingManager - Manages the embedding-based recommendation system
 *
 * This component:
 * - Indexes library tracks (liked + playlists) on mount
 * - Records play events for taste profile learning
 * - Records likes for preference learning
 * - Records co-occurrence when tracks are played together
 *
 * It runs silently in the background and doesn't render any UI.
 */

import React, { useEffect, useRef, useCallback } from 'react';
import { useEmbeddingPlaylist } from '../hooks/useEmbeddingPlaylist';
import { useLibraryStore } from '../stores/library-store';
import { usePlayerStore } from '../stores/player-store';
import type { UnifiedTrack } from '@audiio/core';

/**
 * Deduplicates tracks by ID
 */
function deduplicateById(tracks: UnifiedTrack[]): UnifiedTrack[] {
  const seen = new Set<string>();
  return tracks.filter((track) => {
    if (seen.has(track.id)) return false;
    seen.add(track.id);
    return true;
  });
}

export const EmbeddingManager: React.FC = () => {
  const {
    indexTracks,
    recordPlay,
    recordLike,
    recordSession,
    isReady,
    tracksIndexed,
  } = useEmbeddingPlaylist();

  const { likedTracks, playlists } = useLibraryStore();

  // Track previous state for detecting changes
  const prevTrackRef = useRef<UnifiedTrack | null>(null);
  const playStartTimeRef = useRef<number>(0);
  const prevLikedCountRef = useRef<number>(0);
  const sessionTracksRef = useRef<string[]>([]);

  // ============================================================================
  // Index library tracks on mount and when library changes
  // ============================================================================
  useEffect(() => {
    console.log(`[EmbeddingManager] Index effect running:`, {
      isReady,
      likedTracksCount: likedTracks.length,
      playlistsCount: playlists.length,
      tracksIndexed,
    });

    if (!isReady) {
      console.log('[EmbeddingManager] Not ready yet, skipping index');
      return;
    }

    // Combine liked tracks with playlist tracks
    const allTracks: UnifiedTrack[] = [...likedTracks];
    for (const playlist of playlists) {
      if (playlist.tracks) {
        allTracks.push(...playlist.tracks);
      }
    }

    // Deduplicate and index
    const uniqueTracks = deduplicateById(allTracks);

    if (uniqueTracks.length > 0) {
      indexTracks(uniqueTracks);
      console.log(
        `[EmbeddingManager] Indexed ${uniqueTracks.length} library tracks (total: ${tracksIndexed})`
      );
    } else {
      console.log('[EmbeddingManager] No library tracks to index - library is empty');
      console.log('[EmbeddingManager] Tracks will be indexed as you play music or search');
    }
  }, [isReady, likedTracks, playlists, indexTracks, tracksIndexed]);

  // ============================================================================
  // Record play events when currentTrack changes
  // ============================================================================
  useEffect(() => {
    // Subscribe to player store changes
    const unsubscribe = usePlayerStore.subscribe((state) => {
      const { currentTrack, isPlaying, position, duration } = state;

      // Track started playing
      if (currentTrack && isPlaying && currentTrack.id !== prevTrackRef.current?.id) {
        // Record the previous track's play if it was playing
        if (prevTrackRef.current && playStartTimeRef.current > 0) {
          const listenDuration = Date.now() - playStartTimeRef.current;
          const trackDuration = prevTrackRef.current.duration * 1000; // Convert to ms
          const completed = listenDuration >= trackDuration * 0.8;

          recordPlay(prevTrackRef.current, listenDuration / 1000, completed);

          // Add to session for co-occurrence
          sessionTracksRef.current.push(prevTrackRef.current.id);

          // Record session co-occurrence every 5 tracks
          if (sessionTracksRef.current.length >= 5) {
            recordSession(sessionTracksRef.current);
            sessionTracksRef.current = sessionTracksRef.current.slice(-2); // Keep last 2 for continuity
          }
        }

        // Start tracking new track
        prevTrackRef.current = currentTrack;
        playStartTimeRef.current = Date.now();

        // Index the new track if not already indexed
        indexTracks([currentTrack]);
      }

      // Track stopped/paused - record partial play
      if (prevTrackRef.current && !isPlaying && playStartTimeRef.current > 0) {
        const listenDuration = Date.now() - playStartTimeRef.current;
        if (listenDuration > 5000) {
          // Only record if played for more than 5 seconds
          const trackDuration = prevTrackRef.current.duration * 1000;
          const completed = listenDuration >= trackDuration * 0.8;

          recordPlay(prevTrackRef.current, listenDuration / 1000, completed);
        }
        playStartTimeRef.current = 0; // Reset so we don't double-record
      }
    });

    return () => unsubscribe();
  }, [indexTracks, recordPlay, recordSession]);

  // ============================================================================
  // Record likes when likedTracks changes
  // ============================================================================
  useEffect(() => {
    if (!isReady) return;

    const currentCount = likedTracks.length;
    const prevCount = prevLikedCountRef.current;

    // Detect newly liked tracks
    if (currentCount > prevCount) {
      // Get the newly added tracks (assuming they're added at the end or we check all)
      const newlyLiked = likedTracks.slice(prevCount);

      for (const track of newlyLiked) {
        recordLike(track);
        console.log(`[EmbeddingManager] Recorded like for: ${track.title}`);
      }
    }

    prevLikedCountRef.current = currentCount;
  }, [isReady, likedTracks, recordLike]);

  // ============================================================================
  // Opportunistically index search results when they come in
  // ============================================================================
  useEffect(() => {
    const handleSearchResults = (event: CustomEvent<{ tracks: UnifiedTrack[] }>) => {
      if (event.detail?.tracks?.length > 0) {
        const beforeCount = tracksIndexed;
        indexTracks(event.detail.tracks);
        console.log(
          `[EmbeddingManager] Indexed ${event.detail.tracks.length} tracks from search (was: ${beforeCount}, now: ${tracksIndexed})`
        );
      }
    };

    // Listen for search result events (can be dispatched by search components)
    window.addEventListener(
      'audiio:search-results' as any,
      handleSearchResults as EventListener
    );

    return () => {
      window.removeEventListener(
        'audiio:search-results' as any,
        handleSearchResults as EventListener
      );
    };
  }, [indexTracks, tracksIndexed]);

  // ============================================================================
  // Log stats periodically (debug)
  // ============================================================================
  useEffect(() => {
    if (!isReady) return;

    // Log initial state
    console.log(`[EmbeddingManager] Ready. Tracks indexed: ${tracksIndexed}`);

    // Periodic stats logging (every 5 minutes in development)
    if (process.env.NODE_ENV === 'development') {
      const interval = setInterval(() => {
        console.log(`[EmbeddingManager] Stats: ${tracksIndexed} tracks indexed`);
      }, 5 * 60 * 1000);

      return () => clearInterval(interval);
    }
  }, [isReady, tracksIndexed]);

  // This component doesn't render anything
  return null;
};

export default EmbeddingManager;
