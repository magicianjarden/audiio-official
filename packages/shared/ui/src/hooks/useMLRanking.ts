/**
 * useMLRanking - Hook for applying server-backed ML ranking to tracks
 *
 * Provides personalized track ordering using the server's ML/algo system.
 * All scoring happens on the server - this hook orchestrates the calls.
 */

import { useMemo, useCallback, useState } from 'react';
import type { UnifiedTrack } from '@audiio/core';
import { useMLStore } from '../stores/ml-store';

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
  /** Rank tracks using server ML scoring */
  rankTracks: (tracks: UnifiedTrack[], options?: RankingOptions) => Promise<RankedTrack[]>;
  /** Synchronous ranking using cached/simple scores (faster, less accurate) */
  rankTracksSync: (tracks: UnifiedTrack[], options?: RankingOptions) => RankedTrack[];
  /** Get ML score for a single track (async - calls server) */
  getTrackScore: (track: UnifiedTrack) => Promise<number>;
  /** Whether ML is available (server connected) */
  isMLReady: boolean;
  /** Whether model is currently training on server */
  isTraining: boolean;
}

/**
 * Hook for ML-based track ranking
 * All scoring is done on the server
 */
export function useMLRanking(): UseMLRankingResult {
  const mlStore = useMLStore;

  // Subscribe to loading states
  const isMLReady = useMLStore((s) => s.isModelLoaded);
  const isTraining = useMLStore((s) => s.isTraining);

  /**
   * Get ML score for a single track (from server)
   */
  const getTrackScore = useCallback(async (track: UnifiedTrack): Promise<number> => {
    try {
      if (window.api?.algoScoreTrack) {
        const result = await window.api.algoScoreTrack(track.id);
        return result?.finalScore ?? 50;
      }
    } catch (error) {
      console.error('[useMLRanking] Score failed:', error);
    }
    return 50; // Neutral score
  }, []);

  /**
   * Async ranking with server ML scoring
   */
  const rankTracks = useCallback(async (
    tracks: UnifiedTrack[],
    options: RankingOptions = {}
  ): Promise<RankedTrack[]> => {
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

    // Filter out invalid tracks
    const validTracks = tracks.filter(track =>
      track &&
      track.id &&
      typeof track.id === 'string'
    );

    if (validTracks.length === 0) {
      return tracks.map(track => ({
        track,
        score: 0,
        explanation: []
      }));
    }

    // Get scores from server
    const scoreMap = new Map<string, number>();
    const explanationMap = new Map<string, string[]>();

    try {
      if (window.api?.algoScoreBatch) {
        const trackIds = validTracks.map(t => t.id);
        const results = await window.api.algoScoreBatch(trackIds);

        if (results && Array.isArray(results)) {
          results.forEach((r: any) => {
            if (r?.trackId && typeof r.finalScore === 'number') {
              scoreMap.set(r.trackId, r.finalScore);
              if (r.explanation && Array.isArray(r.explanation)) {
                explanationMap.set(r.trackId, r.explanation);
              }
            }
          });
        }
      }
    } catch (error) {
      console.error('[useMLRanking] Batch scoring failed:', error);
    }

    // Build ranked results
    let ranked: RankedTrack[] = validTracks.map(track => ({
      track,
      score: scoreMap.get(track.id) ?? 50,
      explanation: explanationMap.get(track.id) || []
    }));

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
  }, []);

  /**
   * Synchronous ranking (uses simple genre/energy heuristics)
   * For when you need immediate results without server call
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

    // Simple sync scoring based on track properties
    // (Real scoring happens on server - this is just for fast sorting)
    let ranked: RankedTrack[] = tracks.map(track => {
      let score = 50; // Neutral

      // Simple heuristics for sync ranking
      if (track.popularity) {
        score += track.popularity * 0.3;
      }
      if (track.artists?.length > 0) {
        score += 5; // Has artist info
      }
      if (track.genres?.length > 0) {
        score += 3; // Has genre info
      }
      if (track.artwork) {
        score += 2; // Has artwork
      }

      return {
        track,
        score: Math.min(100, Math.max(0, score)),
        explanation: []
      };
    });

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
  }, []);

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
    const swapRange = Math.min(maxSwapDistance, 3);
    if (Math.random() < intensity && i + swapRange < result.length) {
      const j = i + 1 + Math.floor(Math.random() * swapRange);
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
