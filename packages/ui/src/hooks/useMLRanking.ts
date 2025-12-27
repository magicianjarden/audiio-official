/**
 * useMLRanking - Hook for applying ML-based ranking to tracks
 *
 * Provides personalized track ordering using the ML/algo system.
 * Can be used by Discover sections, search results, playlists, etc.
 */

import { useMemo, useCallback } from 'react';
import type { UnifiedTrack } from '@audiio/core';
import { useRecommendationStore } from '../stores/recommendation-store';
import { useMLStore } from '../stores/ml-store';
import { usePlayerStore } from '../stores/player-store';
import {
  batchEnhancedScore,
  type ScoringContext,
  type EnhancedScore
} from '../ml/advanced-scoring';

export interface RankingOptions {
  /** Whether to apply ML ranking (default: true) */
  enabled?: boolean;
  /** Exploration mode: 'exploit' for familiar, 'explore' for new, 'balanced' for mix */
  explorationMode?: 'exploit' | 'explore' | 'balanced';
  /** Minimum score threshold (tracks below this are deprioritized) */
  minScore?: number;
  /** Maximum tracks to return (default: all) */
  limit?: number;
  /** Whether to add randomization for variety */
  shuffle?: boolean;
  /** Shuffle intensity (0-1, default: 0.1) */
  shuffleIntensity?: number;
}

export interface RankedTrack {
  track: UnifiedTrack;
  score: number;
  explanation: string[];
}

export interface UseMLRankingResult {
  /** Rank tracks using ML scoring */
  rankTracks: (tracks: UnifiedTrack[], options?: RankingOptions) => Promise<RankedTrack[]>;
  /** Synchronous ranking using cached scores (faster, less accurate) */
  rankTracksSync: (tracks: UnifiedTrack[], options?: RankingOptions) => RankedTrack[];
  /** Get ML score for a single track */
  getTrackScore: (track: UnifiedTrack) => number;
  /** Whether ML model is ready */
  isMLReady: boolean;
  /** Whether model is currently training */
  isTraining: boolean;
}

/**
 * Hook for ML-based track ranking
 */
export function useMLRanking(): UseMLRankingResult {
  const recStore = useRecommendationStore();
  const mlStore = useMLStore();
  const playerStore = usePlayerStore();

  const isMLReady = mlStore.isModelLoaded;
  const isTraining = mlStore.isTraining;

  /**
   * Build scoring context from current state
   */
  const buildContext = useCallback((
    explorationMode: 'exploit' | 'explore' | 'balanced' = 'balanced'
  ): ScoringContext => {
    const now = new Date();
    const recentTracks = playerStore.queue.slice(
      Math.max(0, playerStore.queueIndex - 5),
      playerStore.queueIndex + 1
    );

    return {
      hour: now.getHours(),
      dayOfWeek: now.getDay(),
      sessionTracks: recentTracks,
      recentGenres: recentTracks.flatMap(t => t.genres || []).slice(0, 10),
      recentArtists: recentTracks.map(t => t.artists[0]?.name).filter(Boolean).slice(0, 5),
      recentEnergy: [],
      explorationMode,
      userMood: 'auto'
    };
  }, [playerStore.queue, playerStore.queueIndex]);

  /**
   * Build user profile for scoring
   */
  const buildUserProfile = useCallback(() => {
    return {
      genrePreferences: recStore.userProfile.genrePreferences as unknown as Record<string, number>,
      artistPreferences: recStore.userProfile.artistPreferences as unknown as Record<string, number>,
      artistHistory: recStore.getArtistHistory(),
      genreHistory: recStore.getGenreHistory(),
      timePatterns: recStore.getTimePatternsForScoring()
    };
  }, [recStore]);

  /**
   * Get base score for a track (ML or rule-based)
   */
  const getTrackScore = useCallback((track: UnifiedTrack): number => {
    if (isMLReady) {
      return mlStore.getHybridScore(track);
    }
    return recStore.calculateTrackScore(track);
  }, [isMLReady, mlStore, recStore]);

  /**
   * Async ranking with full advanced scoring
   */
  const rankTracks = useCallback(async (
    tracks: UnifiedTrack[],
    options: RankingOptions = {}
  ): Promise<RankedTrack[]> => {
    const {
      enabled = true,
      explorationMode = 'balanced',
      minScore,
      limit,
      shuffle = false,
      shuffleIntensity = 0.1
    } = options;

    if (!enabled || tracks.length === 0) {
      return tracks.map(track => ({
        track,
        score: 0,
        explanation: []
      }));
    }

    // Build context and profile
    const context = buildContext(explorationMode);
    const userProfile = buildUserProfile();
    const playCounts = recStore.getPlayCounts();

    // Get base scores
    const baseScores = new Map<string, number>();
    for (const track of tracks) {
      baseScores.set(track.id, getTrackScore(track));
    }

    // Apply advanced scoring
    const enhancedScores = await batchEnhancedScore(
      tracks,
      baseScores,
      context,
      userProfile,
      playCounts
    );

    // Build ranked results
    let ranked: RankedTrack[] = tracks.map(track => {
      const enhanced = enhancedScores.get(track.id);
      return {
        track,
        score: enhanced?.finalScore ?? baseScores.get(track.id) ?? 0,
        explanation: enhanced?.explanation || []
      };
    });

    // Sort by score
    ranked.sort((a, b) => b.score - a.score);

    // Apply minimum score threshold
    if (minScore !== undefined) {
      ranked = ranked.filter(r => r.score >= minScore);
    }

    // Apply shuffle for variety
    if (shuffle && ranked.length > 1) {
      ranked = applyVarietyShuffle(ranked, shuffleIntensity);
    }

    // Apply limit
    if (limit !== undefined && limit > 0) {
      ranked = ranked.slice(0, limit);
    }

    return ranked;
  }, [buildContext, buildUserProfile, recStore, getTrackScore]);

  /**
   * Synchronous ranking (faster, uses cached/simple scores)
   */
  const rankTracksSync = useCallback((
    tracks: UnifiedTrack[],
    options: RankingOptions = {}
  ): RankedTrack[] => {
    const {
      enabled = true,
      minScore,
      limit,
      shuffle = false,
      shuffleIntensity = 0.1
    } = options;

    if (!enabled || tracks.length === 0) {
      return tracks.map(track => ({
        track,
        score: 0,
        explanation: []
      }));
    }

    // Score tracks synchronously
    let ranked: RankedTrack[] = tracks.map(track => ({
      track,
      score: getTrackScore(track),
      explanation: []
    }));

    // Sort by score
    ranked.sort((a, b) => b.score - a.score);

    // Apply minimum score threshold
    if (minScore !== undefined) {
      ranked = ranked.filter(r => r.score >= minScore);
    }

    // Apply shuffle
    if (shuffle && ranked.length > 1) {
      ranked = applyVarietyShuffle(ranked, shuffleIntensity);
    }

    // Apply limit
    if (limit !== undefined && limit > 0) {
      ranked = ranked.slice(0, limit);
    }

    return ranked;
  }, [getTrackScore]);

  return {
    rankTracks,
    rankTracksSync,
    getTrackScore,
    isMLReady,
    isTraining
  };
}

/**
 * Apply controlled shuffling for variety while preserving general ranking
 */
function applyVarietyShuffle(ranked: RankedTrack[], intensity: number): RankedTrack[] {
  const result = [...ranked];
  const maxSwapDistance = Math.ceil(result.length * intensity);

  for (let i = 0; i < result.length; i++) {
    // Only shuffle with nearby items
    const swapRange = Math.min(maxSwapDistance, 3);
    if (Math.random() < intensity && i + swapRange < result.length) {
      const j = i + 1 + Math.floor(Math.random() * swapRange);
      // Only swap if score difference is small
      const scoreDiff = Math.abs(result[i].score - result[j].score);
      if (scoreDiff < 15) {
        [result[i], result[j]] = [result[j], result[i]];
      }
    }
  }

  return result;
}

/**
 * Simple hook to get personalized track recommendations
 */
export function usePersonalizedTracks(
  tracks: UnifiedTrack[],
  limit: number = 20
): { rankedTracks: UnifiedTrack[]; isLoading: boolean } {
  const { rankTracksSync, isMLReady } = useMLRanking();

  const rankedTracks = useMemo(() => {
    if (tracks.length === 0) return [];

    const ranked = rankTracksSync(tracks, {
      limit,
      shuffle: true,
      shuffleIntensity: 0.15
    });

    return ranked.map(r => r.track);
  }, [tracks, limit, rankTracksSync]);

  return {
    rankedTracks,
    isLoading: false
  };
}

export default useMLRanking;
