/**
 * useRecommendations - Hook for ML-powered recommendations
 *
 * Provides access to the server's ML/recommendation APIs.
 * Replaces hardcoded search queries with real algorithmic recommendations.
 */

import { useState, useEffect, useCallback } from 'react';
import type { UnifiedTrack } from '@audiio/core';

// ========================================
// Types
// ========================================

export type RecommendationMode = 'discovery' | 'familiar' | 'balanced';

export interface RecommendationOptions {
  count?: number;
  mode?: RecommendationMode;
  seedTrackId?: string;
  seedArtistId?: string;
  seedGenre?: string;
  excludeIds?: string[];
}

export interface TrendingData {
  tracks: UnifiedTrack[];
  artists: Array<{
    id: string;
    name: string;
    artwork?: { small?: string; medium?: string; large?: string };
  }>;
}

export interface UseRecommendationsResult<T> {
  data: T;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

// ========================================
// Core Recommendation Hooks
// ========================================

/**
 * Get trending tracks and artists from the server
 */
export function useTrending(): UseRecommendationsResult<TrendingData> {
  const [data, setData] = useState<TrendingData>({ tracks: [], artists: [] });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetch = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      if (window.api?.getTrending) {
        const result = await window.api.getTrending();
        if (result) {
          setData({
            tracks: result.tracks || [],
            artists: result.artists || [],
          });
        }
      }
    } catch (err) {
      console.error('[useTrending] Error:', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch trending'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { data, isLoading, error, refetch: fetch };
}

/**
 * Get ML-powered recommendations based on user's listening history
 */
export function useMLRecommendations(
  count: number = 20,
  mode: RecommendationMode = 'balanced'
): UseRecommendationsResult<UnifiedTrack[]> {
  const [data, setData] = useState<UnifiedTrack[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetch = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      if (window.api?.algoGetRecommendations) {
        const result = await window.api.algoGetRecommendations(count, mode);
        if (result && Array.isArray(result)) {
          setData(result);
        }
      }
    } catch (err) {
      console.error('[useMLRecommendations] Error:', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch recommendations'));
    } finally {
      setIsLoading(false);
    }
  }, [count, mode]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { data, isLoading, error, refetch: fetch };
}

/**
 * Get similar tracks based on a seed track
 */
export function useSimilarTracks(
  trackId: string | null,
  count: number = 20
): UseRecommendationsResult<UnifiedTrack[]> {
  const [data, setData] = useState<UnifiedTrack[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetch = useCallback(async () => {
    if (!trackId) {
      setData([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      if (window.api?.algoGetSimilar) {
        const result = await window.api.algoGetSimilar(trackId, count);
        if (result && Array.isArray(result)) {
          setData(result);
        }
      } else if (window.api?.getSimilarTracks) {
        const result = await window.api.getSimilarTracks(trackId);
        if (result && Array.isArray(result)) {
          setData(result.slice(0, count));
        }
      }
    } catch (err) {
      console.error('[useSimilarTracks] Error:', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch similar tracks'));
    } finally {
      setIsLoading(false);
    }
  }, [trackId, count]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { data, isLoading, error, refetch: fetch };
}

/**
 * Get artist radio - tracks similar to an artist's style
 */
export function useArtistRadio(
  artistId: string | null,
  count: number = 20
): UseRecommendationsResult<UnifiedTrack[]> {
  const [data, setData] = useState<UnifiedTrack[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetch = useCallback(async () => {
    if (!artistId) {
      setData([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      if (window.api?.algoGetArtistRadio) {
        const result = await window.api.algoGetArtistRadio(artistId, count);
        if (result && Array.isArray(result)) {
          setData(result);
        }
      } else if (window.api?.getRecommendedTracks) {
        const result = await window.api.getRecommendedTracks('artist', artistId);
        if (result && Array.isArray(result)) {
          setData(result.slice(0, count));
        }
      }
    } catch (err) {
      console.error('[useArtistRadio] Error:', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch artist radio'));
    } finally {
      setIsLoading(false);
    }
  }, [artistId, count]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { data, isLoading, error, refetch: fetch };
}

/**
 * Get genre/mood radio - tracks matching a genre or mood
 */
export function useGenreRadio(
  genre: string | null,
  count: number = 20
): UseRecommendationsResult<UnifiedTrack[]> {
  const [data, setData] = useState<UnifiedTrack[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetch = useCallback(async () => {
    if (!genre) {
      setData([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      if (window.api?.algoGetGenreRadio) {
        const result = await window.api.algoGetGenreRadio(genre, count);
        if (result && Array.isArray(result)) {
          setData(result);
        }
      } else if (window.api?.getRecommendedTracks) {
        const result = await window.api.getRecommendedTracks('genre', genre);
        if (result && Array.isArray(result)) {
          setData(result.slice(0, count));
        }
      }
    } catch (err) {
      console.error('[useGenreRadio] Error:', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch genre radio'));
    } finally {
      setIsLoading(false);
    }
  }, [genre, count]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { data, isLoading, error, refetch: fetch };
}

/**
 * Get track radio - creates a radio station based on a seed track
 */
export function useTrackRadio(
  trackId: string | null,
  count: number = 20
): UseRecommendationsResult<UnifiedTrack[]> {
  const [data, setData] = useState<UnifiedTrack[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetch = useCallback(async () => {
    if (!trackId) {
      setData([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      if (window.api?.algoGetRadio) {
        const result = await window.api.algoGetRadio(trackId, count);
        if (result && Array.isArray(result)) {
          setData(result);
        }
      }
    } catch (err) {
      console.error('[useTrackRadio] Error:', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch track radio'));
    } finally {
      setIsLoading(false);
    }
  }, [trackId, count]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { data, isLoading, error, refetch: fetch };
}

/**
 * Get smart queue suggestions for auto-play
 */
export function useSmartQueue(
  count: number = 10,
  context?: Record<string, unknown>
): UseRecommendationsResult<UnifiedTrack[]> {
  const [data, setData] = useState<UnifiedTrack[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetch = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      if (window.api?.algoGetNextQueue) {
        const result = await window.api.algoGetNextQueue(count, context);
        if (result && Array.isArray(result)) {
          setData(result);
        }
      }
    } catch (err) {
      console.error('[useSmartQueue] Error:', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch smart queue'));
    } finally {
      setIsLoading(false);
    }
  }, [count, context]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { data, isLoading, error, refetch: fetch };
}

/**
 * Get user's ML profile (preferences, top artists/genres, etc.)
 */
export function useMLProfile() {
  const [profile, setProfile] = useState<{
    topArtists: string[];
    topGenres: string[];
    explorationLevel: number;
    totalListenTime: number;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      try {
        if (window.api?.algoGetProfile) {
          const result = await window.api.algoGetProfile();
          if (result) {
            setProfile(result);
          }
        }
      } catch (err) {
        console.error('[useMLProfile] Error:', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetch();
  }, []);

  return { profile, isLoading };
}

// ========================================
// Convenience Exports
// ========================================

export default {
  useTrending,
  useMLRecommendations,
  useSimilarTracks,
  useArtistRadio,
  useGenreRadio,
  useTrackRadio,
  useSmartQueue,
  useMLProfile,
};
