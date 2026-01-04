/**
 * usePluginData - Unified hook for fetching data through the plugin pipeline
 *
 * This hook provides a single entry point for Discover sections to get data.
 * It runs through the plugin pipeline: providers → ML ranking → transformers
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type { UnifiedTrack } from '@audiio/core';
import type { StructuredSectionQuery } from '../components/Discover/types';
import type { SeeAllContext, PipelineResult } from '../components/Discover/plugin-pipeline';
import { pluginPipelineRegistry } from '../components/Discover/plugin-pipeline-registry';
import { useRecommendationStore } from '../stores/recommendation-store';
import { useMLRanking } from './useMLRanking';
import { indexTracksStandalone } from './useEmbeddingPlaylist';

/**
 * Stable query key for dependency comparison
 * Prevents infinite loops from query object recreation
 */
function getQueryKey(query: StructuredSectionQuery | null): string {
  if (!query) return 'null';
  // Create stable key from important query fields
  return JSON.stringify({
    strategy: query.strategy,
    sectionType: query.sectionType,
    title: query.title,
    search: query.search?.query,
    limit: query.limit,
    embeddingMethod: query.embedding?.method,
    embeddingGenre: query.embedding?.genre,
    embeddingMood: query.embedding?.mood,
    embeddingSeedArtist: query.embedding?.seedArtistId,
  });
}

export interface UsePluginDataOptions {
  /** Whether to enable the hook */
  enabled?: boolean;
  /** Whether to apply ML ranking after providers */
  applyMLRanking?: boolean;
  /** Whether to run transformers */
  applyTransformers?: boolean;
  /** Maximum results to return */
  limit?: number;
  /** Fallback data fetcher if no providers respond */
  fallbackFetcher?: () => Promise<UnifiedTrack[]>;
  /** Dependencies that trigger refetch */
  deps?: unknown[];
}

export interface UsePluginDataResult {
  /** Fetched and processed tracks */
  tracks: UnifiedTrack[];
  /** Whether data is being fetched */
  isLoading: boolean;
  /** Error if fetch failed */
  error: Error | null;
  /** Refetch function */
  refetch: () => Promise<void>;
  /** Pipeline execution metadata */
  metadata: PipelineResult | null;
}

/**
 * Hook for fetching data through the plugin pipeline
 */
export function usePluginData(
  query: StructuredSectionQuery | null,
  options: UsePluginDataOptions = {}
): UsePluginDataResult {
  const {
    enabled = true,
    applyMLRanking = true,
    applyTransformers = true,
    limit = 50,
    fallbackFetcher,
    deps = [],
  } = options;

  const [tracks, setTracks] = useState<UnifiedTrack[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [metadata, setMetadata] = useState<PipelineResult | null>(null);

  // Use getState() for stable reference - prevents rerenders
  const recStoreRef = useRecommendationStore;
  const { rankTracks } = useMLRanking();

  // Create stable query key to prevent infinite loops from object recreation
  const queryKey = useMemo(() => getQueryKey(query), [query]);

  // Store query in ref so we always have latest without dependency
  const queryRef = useRef(query);
  queryRef.current = query;

  // Track if component is mounted
  const mountedRef = useRef(true);
  const fetchIdRef = useRef(0);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const fetchData = useCallback(async () => {
    // Use ref to get current query value (stable callback)
    const currentQuery = queryRef.current;

    if (!enabled || !currentQuery) {
      setTracks([]);
      setIsLoading(false);
      return;
    }

    const fetchId = ++fetchIdRef.current;
    setIsLoading(true);
    setError(null);

    const now = new Date();
    // Get userProfile at call time for stability
    const currentUserProfile = recStoreRef.getState().userProfile;
    const context: Omit<SeeAllContext, 'currentResults'> = {
      query: currentQuery,
      userProfile: currentUserProfile,
      hour: now.getHours(),
      dayOfWeek: now.getDay(),
    };

    try {
      console.log(`[usePluginData] Fetching for ${currentQuery.sectionType}...`);

      // 1. Run plugin pipeline
      const pipelineResult = await pluginPipelineRegistry.executePipeline(
        [], // Start with empty base results
        currentQuery,
        context
      );

      // Check if this fetch is still relevant
      if (!mountedRef.current || fetchId !== fetchIdRef.current) {
        return;
      }

      let resultTracks = pipelineResult.tracks;

      console.log(`[usePluginData] Pipeline returned ${resultTracks.length} tracks from providers: [${pipelineResult.contributingProviders.join(', ')}]`);

      // 2. If no results from pipeline, try fallback
      if (resultTracks.length === 0 && fallbackFetcher) {
        console.log('[usePluginData] No pipeline results, trying fallback...');
        resultTracks = await fallbackFetcher();

        if (!mountedRef.current || fetchId !== fetchIdRef.current) {
          return;
        }
      }

      // 2.5. Auto-index ALL results into embedding system
      // This builds up the ML index with API results (trending, search, etc.)
      // so the embedding provider can use them for personalized recommendations
      if (resultTracks.length > 0) {
        const indexed = indexTracksStandalone(resultTracks);
        if (indexed > 0) {
          console.log(`[usePluginData] Auto-indexed ${indexed} new tracks into embedding system`);
        }
      }

      // 3. Apply ML ranking if enabled
      if (applyMLRanking && resultTracks.length > 0) {
        console.log(`[usePluginData] Applying ML ranking to ${resultTracks.length} tracks...`);
        try {
          const ranked = await rankTracks(resultTracks, {
            enabled: true,
            explorationMode: currentQuery.embedding?.exploration && currentQuery.embedding.exploration > 0.5 ? 'explore' : 'balanced',
            limit: limit * 2, // Get extra for filtering
            shuffle: true,
            shuffleIntensity: 0.1,
          });
          resultTracks = ranked.map((r) => r.track);
        } catch (rankError) {
          console.warn('[usePluginData] ML ranking failed, using unranked results:', rankError);
          // Continue with unranked results
        }
      }

      // 4. Apply transformers if not already done and enabled
      if (applyTransformers && pipelineResult.appliedTransformers.length === 0 && resultTracks.length > 0) {
        const transformResult = await pluginPipelineRegistry.runTransformers(
          resultTracks,
          { ...context, currentResults: resultTracks }
        );
        resultTracks = transformResult.tracks;
        pipelineResult.appliedTransformers.push(...transformResult.appliedTransformers);
      }

      // 5. Apply limit
      resultTracks = resultTracks.slice(0, limit);

      if (!mountedRef.current || fetchId !== fetchIdRef.current) {
        return;
      }

      console.log(`[usePluginData] Final result: ${resultTracks.length} tracks`);
      setTracks(resultTracks);
      setMetadata(pipelineResult);
      setError(null);
    } catch (err) {
      console.error('[usePluginData] Fetch error:', err);
      if (mountedRef.current && fetchId === fetchIdRef.current) {
        setError(err instanceof Error ? err : new Error(String(err)));
        setTracks([]);
      }
    } finally {
      if (mountedRef.current && fetchId === fetchIdRef.current) {
        setIsLoading(false);
      }
    }
  // Use queryKey for stable dependency - only re-fetch when query content actually changes
  }, [queryKey, enabled, applyMLRanking, applyTransformers, limit, fallbackFetcher, rankTracks]);

  // Refetch when query or deps change
  useEffect(() => {
    fetchData();
  }, [fetchData, ...deps]);

  const refetch = useCallback(async () => {
    await fetchData();
  }, [fetchData]);

  return {
    tracks,
    isLoading,
    error,
    refetch,
    metadata,
  };
}

/**
 * Simplified hook for sections that just need tracks
 */
export function useSectionData(
  sectionType: string,
  options: {
    enabled?: boolean;
    limit?: number;
    query?: string;
    title?: string;
    fallbackFetcher?: () => Promise<UnifiedTrack[]>;
  } = {}
): UsePluginDataResult {
  const { enabled = true, limit = 12, query: textQuery, title, fallbackFetcher } = options;

  // Memoize structured query to prevent object recreation triggering refetch
  const structuredQuery = useMemo((): StructuredSectionQuery | null => {
    if (!enabled) return null;
    return {
      strategy: 'plugin' as const,
      sectionType,
      title: title || sectionType,
      search: textQuery ? { query: textQuery } : undefined,
      limit,
    };
  }, [enabled, sectionType, title, textQuery, limit]);

  return usePluginData(structuredQuery, {
    enabled,
    limit,
    fallbackFetcher,
  });
}

export default usePluginData;
