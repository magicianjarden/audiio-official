/**
 * Smart Queue Hooks - React hooks for auto-queue and radio mode
 */

import { useEffect, useCallback, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { usePlayerStore } from '../stores/player-store';
import { useSmartQueueStore, type RadioSeed } from '../stores/smart-queue-store';
import { useRecommendationStore } from '../stores/recommendation-store';
import { useMLStore } from '../stores/ml-store';
import type { UnifiedTrack } from '@audiio/core';

// ============================================
// useAutoQueue Hook
// ============================================

interface UseAutoQueueOptions {
  availableTracks: UnifiedTrack[];
  enabled?: boolean;
}

/**
 * Hook that manages auto-queue functionality
 * Listens for queue changes and replenishes when needed
 */
export function useAutoQueue({ availableTracks, enabled = true }: UseAutoQueueOptions) {
  const { queue, queueIndex, currentTrack } = usePlayerStore();
  const { mode, config, checkAndReplenish, recordTrackPlayed } = useSmartQueueStore();

  const prevTrackRef = useRef<string | null>(null);

  // Check queue on track changes
  useEffect(() => {
    if (!enabled) return;
    if (mode === 'manual' && !config.autoQueueEnabled) return;
    if (!currentTrack) return;

    // Record when track changes
    if (currentTrack.id !== prevTrackRef.current) {
      prevTrackRef.current = currentTrack.id;
      recordTrackPlayed(currentTrack);
    }

    // Check if we need more tracks
    const remainingTracks = queue.length - queueIndex - 1;
    if (remainingTracks <= config.autoQueueThreshold) {
      checkAndReplenish(availableTracks);
    }
  }, [queueIndex, currentTrack?.id, mode, config.autoQueueEnabled, enabled]);

  // Listen for manual check events (from player-store)
  useEffect(() => {
    if (!enabled) return;

    const handler = () => {
      if (mode !== 'manual' || config.autoQueueEnabled) {
        checkAndReplenish(availableTracks);
      }
    };

    window.addEventListener('audiio:check-auto-queue', handler);
    return () => window.removeEventListener('audiio:check-auto-queue', handler);
  }, [availableTracks, checkAndReplenish, mode, config.autoQueueEnabled, enabled]);

  return {
    isActive: mode !== 'manual' || config.autoQueueEnabled,
    mode,
    config
  };
}

// ============================================
// useRadioMode Hook
// ============================================

interface UseRadioModeOptions {
  availableTracks: UnifiedTrack[];
}

/**
 * Hook that provides radio mode functionality
 */
export function useRadioMode({ availableTracks }: UseRadioModeOptions) {
  const { currentTrack } = usePlayerStore();
  const {
    mode,
    radioSeed,
    radioTracksPlayed,
    startRadio,
    stopRadio,
    radioConfig
  } = useSmartQueueStore();

  const isRadioMode = mode === 'radio';

  // Start radio from a track
  const startTrackRadio = useCallback(async (seedTrack: UnifiedTrack) => {
    const seed: RadioSeed = {
      type: 'track',
      id: seedTrack.id,
      name: `${seedTrack.title} Radio`,
      artwork: seedTrack.artwork?.medium || seedTrack.artwork?.small,
      genres: seedTrack.genres,
      artistIds: (seedTrack.artists || []).map(a => a.id || a.name)
    };

    // Find similar tracks for initial queue
    const similarTracks = availableTracks.filter(t =>
      t.id !== seedTrack.id &&
      (
        t.artists?.some(a => seedTrack.artists?.some(sa => sa.name === a.name)) ||
        t.genres?.some(g => seedTrack.genres?.includes(g))
      )
    );

    await startRadio(seed, [seedTrack, ...similarTracks.slice(0, 20)]);
  }, [availableTracks, startRadio]);

  // Start radio from an artist
  const startArtistRadio = useCallback(async (
    artistName: string,
    artistId?: string,
    genres?: string[]
  ) => {
    const seed: RadioSeed = {
      type: 'artist',
      id: artistId || artistName.toLowerCase().replace(/\s+/g, '-'),
      name: `${artistName} Radio`,
      genres
    };

    // Find tracks by this artist and similar
    const artistTracks = availableTracks.filter(t =>
      t.artists?.some(a => a.name.toLowerCase() === artistName.toLowerCase())
    );

    const similarTracks = availableTracks.filter(t =>
      !artistTracks.includes(t) &&
      genres?.some(g => t.genres?.some(tg =>
        tg.toLowerCase().includes(g.toLowerCase())
      ))
    );

    await startRadio(seed, [...artistTracks.slice(0, 10), ...similarTracks.slice(0, 15)]);
  }, [availableTracks, startRadio]);

  // Start radio from a genre
  const startGenreRadio = useCallback(async (genre: string) => {
    const seed: RadioSeed = {
      type: 'genre',
      id: genre.toLowerCase(),
      name: `${genre} Radio`,
      genres: [genre]
    };

    // Find tracks in this genre
    const genreTracks = availableTracks.filter(t =>
      t.genres?.some(g =>
        g.toLowerCase().includes(genre.toLowerCase()) ||
        genre.toLowerCase().includes(g.toLowerCase())
      )
    );

    await startRadio(seed, genreTracks.slice(0, 25));
  }, [availableTracks, startRadio]);

  // Start radio from current track
  const startRadioFromCurrent = useCallback(async () => {
    if (currentTrack) {
      await startTrackRadio(currentTrack);
    }
  }, [currentTrack, startTrackRadio]);

  return {
    isRadioMode,
    radioSeed,
    radioTracksPlayed,
    radioConfig,
    startTrackRadio,
    startArtistRadio,
    startGenreRadio,
    startRadioFromCurrent,
    stopRadio
  };
}

// ============================================
// useMLRecommendations Hook
// ============================================

interface UseMLRecommendationsOptions {
  tracks: UnifiedTrack[];
  limit?: number;
  enabled?: boolean;
}

/**
 * Hook that provides ML-enhanced recommendations
 */
export function useMLRecommendations({
  tracks,
  limit = 20,
  enabled = true
}: UseMLRecommendationsOptions) {
  const {
    isModelLoaded,
    isTraining,
    trainingProgress,
    trainingMetrics,
    modelVersion,
    getHybridRecommendations,
    initializeModel,
    trainModel,
    checkAndTrain
  } = useMLStore();

  // Only subscribe to length - avoids re-renders when array contents change
  const listenHistoryLength = useRecommendationStore((s) => s.listenHistory.length);

  // Initialize model on mount
  useEffect(() => {
    if (enabled) {
      initializeModel();
    }
  }, [enabled, initializeModel]);

  // Check if training is needed when listen history changes
  useEffect(() => {
    if (enabled && tracks.length > 0 && listenHistoryLength >= 50) {
      checkAndTrain(tracks);
    }
  }, [enabled, listenHistoryLength, tracks, checkAndTrain]);

  // Get recommendations
  const recommendations = enabled && tracks.length > 0
    ? getHybridRecommendations(tracks, limit)
    : [];

  // Manual training trigger
  const triggerTraining = useCallback(async () => {
    if (tracks.length > 0) {
      await trainModel(tracks);
    }
  }, [tracks, trainModel]);

  return {
    recommendations,
    isModelLoaded,
    isTraining,
    trainingProgress,
    trainingMetrics,
    modelVersion,
    canTrain: listenHistoryLength >= 50,
    triggerTraining
  };
}

// ============================================
// Combined Hook
// ============================================

interface UseSmartPlaybackOptions {
  availableTracks: UnifiedTrack[];
  autoQueueEnabled?: boolean;
  mlEnabled?: boolean;
}

/**
 * Combined hook for all smart playback features
 */
export function useSmartPlayback({
  availableTracks,
  autoQueueEnabled = true,
  mlEnabled = true
}: UseSmartPlaybackOptions) {
  const autoQueue = useAutoQueue({
    availableTracks,
    enabled: autoQueueEnabled
  });

  const radio = useRadioMode({
    availableTracks
  });

  const ml = useMLRecommendations({
    tracks: availableTracks,
    enabled: mlEnabled
  });

  return {
    autoQueue,
    radio,
    ml
  };
}

export default useSmartPlayback;
