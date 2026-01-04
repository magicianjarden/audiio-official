/**
 * EmbeddingSectionDetailView - ML-aware "See All" view
 * Handles structured queries with embedding support, preserving ML context
 */

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import type { UnifiedTrack } from '@audiio/core';
import { useNavigationStore } from '../../stores/navigation-store';
import { useSearchStore } from '../../stores/search-store';
import { usePlayerStore } from '../../stores/player-store';
import { useRecommendationStore } from '../../stores/recommendation-store';
import { useTrackContextMenu } from '../../contexts/ContextMenuContext';
import { useEmbeddingPlaylist } from '../../hooks/useEmbeddingPlaylist';
import { BackIcon } from '@audiio/icons';
import { TrackCard } from './TrackCard';
import type { StructuredSectionQuery, EmbeddingContext } from './types';
import { isEmbeddingQuery } from './types';
import { pluginPipelineRegistry } from './plugin-pipeline-registry';

interface Props {
  /** Override the query from navigation store (for testing) */
  overrideQuery?: StructuredSectionQuery;
}

export const EmbeddingSectionDetailView: React.FC<Props> = ({ overrideQuery }) => {
  const { selectedSectionData, goBack } = useNavigationStore();
  const { search, results, isSearching: searchLoading } = useSearchStore();
  const { play, setQueue } = usePlayerStore();
  const userProfile = useRecommendationStore((state) => state.userProfile);
  const { showContextMenu } = useTrackContextMenu();

  const {
    generateMoodPlaylist,
    generateGenrePlaylist,
    generateArtistRadio,
    generateSeedPlaylist,
    generateDiscoveryPlaylist,
    generatePersonalizedPlaylist,
    findSimilarTracks,
    getTracksFromPlaylist,
    isReady: embeddingReady,
    tracksIndexed,
  } = useEmbeddingPlaylist();

  const [tracks, setTracks] = useState<UnifiedTrack[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadedCount, setLoadedCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  // Pipeline metadata for debugging/analytics (future use)
  const [_pipelineMetadata, setPipelineMetadata] = useState<{
    appliedTransformers: string[];
    contributingProviders: string[];
    appliedEnhancers: string[];
    executionTime: number;
  } | null>(null);

  // Get the query - either from props or navigation store
  const structuredQuery = overrideQuery ?? selectedSectionData?.structuredQuery;

  /**
   * Generate results from embedding context
   */
  const generateEmbeddingResults = useCallback(
    (ctx: EmbeddingContext, limit: number): UnifiedTrack[] => {
      const options = {
        limit,
        exploration: ctx.exploration,
        includeCollaborative: ctx.includeCollaborative,
        excludeTrackIds: ctx.excludeTrackIds,
        excludeArtistIds: ctx.excludeArtistIds,
      };

      let playlist = null;

      switch (ctx.method) {
        case 'mood':
          if (ctx.mood) {
            playlist = generateMoodPlaylist(ctx.mood, options);
          }
          break;

        case 'genre':
          if (ctx.genre) {
            playlist = generateGenrePlaylist(ctx.genre, options);
          }
          break;

        case 'artist-radio':
          if (ctx.seedArtistId) {
            playlist = generateArtistRadio(ctx.seedArtistId, options);
          }
          break;

        case 'seed':
          if (ctx.seedTrackIds?.length) {
            playlist = generateSeedPlaylist(ctx.seedTrackIds, options);
          }
          break;

        case 'discovery':
          playlist = generateDiscoveryPlaylist({
            ...options,
            exploration: ctx.exploration ?? 0.7,
          });
          break;

        case 'personalized':
          playlist = generatePersonalizedPlaylist(options);
          break;

        case 'similar':
          if (ctx.seedTrackIds?.[0]) {
            const similarTracks = findSimilarTracks(ctx.seedTrackIds[0], limit);
            // Convert PlaylistTrack[] to UnifiedTrack[] using track cache
            // Create a minimal GeneratedPlaylist structure
            return getTracksFromPlaylist({
              tracks: similarTracks,
              method: 'seed-tracks',
              queryVector: new Float32Array(128),
              stats: {
                candidatesConsidered: limit,
                embeddingSearchTime: 0,
                collaborativeBoost: 0,
                avgSimilarity: 0,
              },
            });
          }
          break;
      }

      return playlist ? getTracksFromPlaylist(playlist) : [];
    },
    [
      generateMoodPlaylist,
      generateGenrePlaylist,
      generateArtistRadio,
      generateSeedPlaylist,
      generateDiscoveryPlaylist,
      generatePersonalizedPlaylist,
      findSimilarTracks,
      getTracksFromPlaylist,
    ]
  );

  /**
   * Run plugin pipeline on base results
   */
  const runPluginPipeline = useCallback(
    async (baseResults: UnifiedTrack[], query: StructuredSectionQuery): Promise<UnifiedTrack[]> => {
      // Skip pipeline if no hooks registered
      const stats = pluginPipelineRegistry.getStats();
      if (stats.transformers === 0 && stats.providers === 0 && stats.enhancers === 0) {
        return baseResults;
      }

      const hour = new Date().getHours();
      const dayOfWeek = new Date().getDay();

      try {
        const result = await pluginPipelineRegistry.executePipeline(
          baseResults,
          query,
          { userProfile, hour, dayOfWeek }
        );

        // Store metadata for display/debugging
        setPipelineMetadata({
          appliedTransformers: result.appliedTransformers,
          contributingProviders: result.contributingProviders,
          appliedEnhancers: result.appliedEnhancers,
          executionTime: result.executionTime,
        });

        console.log(
          `[EmbeddingSectionDetailView] Pipeline executed in ${result.executionTime.toFixed(1)}ms:`,
          `${result.appliedEnhancers.length} enhancers,`,
          `${result.contributingProviders.length} providers,`,
          `${result.appliedTransformers.length} transformers`
        );

        return result.tracks;
      } catch (err) {
        console.error('[EmbeddingSectionDetailView] Pipeline error:', err);
        // Return base results on pipeline failure
        return baseResults;
      }
    },
    [userProfile]
  );

  /**
   * Generate results based on query strategy
   */
  const generateResults = useCallback(
    async (query: StructuredSectionQuery) => {
      const limit = query.limit ?? 50;
      setIsLoading(true);
      setError(null);
      setPipelineMetadata(null);

      try {
        let baseResults: UnifiedTrack[] = [];

        switch (query.strategy) {
          case 'embedding':
            if (query.embedding) {
              if (!embeddingReady) {
                setError('ML system not ready');
                return;
              }
              if (tracksIndexed < 1) {
                setError('No tracks indexed for ML recommendations');
                return;
              }
              baseResults = generateEmbeddingResults(query.embedding, limit);
            }
            break;

          case 'search':
            if (query.search?.query) {
              await search(query.search.query);
              // Results will come through useEffect watching results
              return; // Exit early - search results handled by effect
            }
            break;

          case 'hybrid':
            // Try embedding first, fall back to search
            if (query.embedding && embeddingReady && tracksIndexed > 0) {
              baseResults = generateEmbeddingResults(query.embedding, limit);
            }
            // Fall back to search if no embedding results
            if (baseResults.length === 0 && query.search?.query) {
              await search(query.search.query);
              return; // Exit early - search results handled by effect
            }
            break;

          case 'plugin':
            // Pure plugin strategy - run pipeline with empty base results
            baseResults = [];
            break;
        }

        // Run plugin pipeline on results (enhancers, providers, transformers)
        const finalResults = await runPluginPipeline(baseResults, query);
        setTracks(finalResults);
        setLoadedCount(finalResults.length);
      } catch (err) {
        console.error('[EmbeddingSectionDetailView] Error generating results:', err);
        setError(err instanceof Error ? err.message : 'Failed to load results');
      } finally {
        setIsLoading(false);
      }
    },
    [embeddingReady, tracksIndexed, generateEmbeddingResults, search, runPluginPipeline]
  );

  // Generate results when query changes
  useEffect(() => {
    if (structuredQuery) {
      generateResults(structuredQuery);
    }
  }, [structuredQuery, generateResults]);

  // Update tracks from search results (for search/hybrid strategies)
  useEffect(() => {
    const processSearchResults = async () => {
      if (
        structuredQuery &&
        (structuredQuery.strategy === 'search' ||
          (structuredQuery.strategy === 'hybrid' && tracks.length === 0))
      ) {
        if (results?.tracks) {
          // Run search results through plugin pipeline
          const finalTracks = await runPluginPipeline(results.tracks, structuredQuery);
          setTracks(finalTracks);
          setLoadedCount(finalTracks.length);
          setIsLoading(false);
        }
      }
    };
    processSearchResults();
  }, [results?.tracks, structuredQuery, tracks.length, runPluginPipeline]);

  /**
   * Handle track click - play and set queue
   */
  const handleTrackClick = useCallback(
    (track: UnifiedTrack, index: number) => {
      setQueue(tracks, index);
      play(track);
    },
    [tracks, setQueue, play]
  );

  /**
   * Load more results (for embedding queries)
   */
  const handleLoadMore = useCallback(async () => {
    if (!structuredQuery || !isEmbeddingQuery(structuredQuery)) return;

    const currentLimit = structuredQuery.limit ?? 50;
    const newLimit = currentLimit + 50;

    const moreTracks = generateEmbeddingResults(structuredQuery.embedding, newLimit);
    // Run through pipeline
    const finalTracks = await runPluginPipeline(moreTracks, {
      ...structuredQuery,
      limit: newLimit,
    });
    setTracks(finalTracks);
    setLoadedCount(finalTracks.length);
  }, [structuredQuery, generateEmbeddingResults, runPluginPipeline]);

  // Determine loading state
  const showLoading =
    isLoading || (structuredQuery?.strategy === 'search' && searchLoading);

  // Get display info
  const title = structuredQuery?.title ?? selectedSectionData?.title ?? 'Results';
  const subtitle = structuredQuery?.subtitle ?? selectedSectionData?.subtitle;

  // Show info about the query strategy
  const strategyInfo = useMemo(() => {
    if (!structuredQuery) return null;

    switch (structuredQuery.strategy) {
      case 'embedding':
        return structuredQuery.embedding?.method
          ? `ML: ${structuredQuery.embedding.method}`
          : 'ML-enhanced';
      case 'hybrid':
        return 'Smart results';
      case 'search':
        return 'Search results';
      case 'plugin':
        return 'Plugin results';
      default:
        return null;
    }
  }, [structuredQuery]);

  // Empty state when no data
  if (!selectedSectionData && !overrideQuery) {
    return (
      <div className="section-detail-view">
        <div className="section-detail-empty">
          <p>Section not found</p>
          <button onClick={goBack}>Go back</button>
        </div>
      </div>
    );
  }

  return (
    <div className="section-detail-view">
      <header className="section-detail-header">
        <button className="back-btn-round" onClick={goBack} aria-label="Go back">
          <BackIcon size={20} />
        </button>
        <div className="section-detail-title-area">
          <h1 className="section-detail-title">{title}</h1>
          {subtitle && <p className="section-detail-subtitle">{subtitle}</p>}
          {strategyInfo && (
            <span className="section-detail-strategy-badge">{strategyInfo}</span>
          )}
        </div>
      </header>

      <div className="section-detail-content">
        {error ? (
          <div className="section-detail-empty">
            <p>{error}</p>
            <button onClick={goBack}>Go back</button>
          </div>
        ) : showLoading ? (
          <div className="section-detail-grid">
            {Array.from({ length: 20 }).map((_, i) => (
              <div key={i} className="discover-card-skeleton" />
            ))}
          </div>
        ) : tracks.length > 0 ? (
          <>
            <div className="section-detail-grid">
              {tracks.map((track, index) => (
                <TrackCard
                  key={track.id}
                  track={track}
                  onClick={() => handleTrackClick(track, index)}
                  onContextMenu={showContextMenu}
                />
              ))}
            </div>

            {/* Load More button for embedding queries */}
            {isEmbeddingQuery(structuredQuery!) && loadedCount >= (structuredQuery?.limit ?? 50) && (
              <div className="section-detail-load-more">
                <button
                  className="section-detail-load-more-btn"
                  onClick={handleLoadMore}
                >
                  Load More
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="section-detail-empty">
            <p>No tracks found</p>
            {structuredQuery?.strategy === 'embedding' && tracksIndexed < 1 && (
              <p className="section-detail-empty-hint">
                Play some music to enable ML recommendations
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default EmbeddingSectionDetailView;
