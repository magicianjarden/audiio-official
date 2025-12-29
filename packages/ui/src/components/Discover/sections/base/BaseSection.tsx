/**
 * BaseSection - Common wrapper for all Discover page sections
 * Provides loading states, error handling, animations, and consistent styling
 * Includes embedding-enhanced track fetching with search fallback
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import type { BaseSectionProps, SectionData, SelectionContext } from '../../section-registry';
import type { UnifiedTrack } from '@audiio/core';
import { useEmbeddingPlaylist } from '../../../../hooks/useEmbeddingPlaylist';
import { debugLog, debugError } from '../../../../utils/debug';

export interface BaseSectionWrapperProps extends BaseSectionProps {
  children: React.ReactNode;
  isLoading?: boolean;
  error?: string | null;
  className?: string;
  showHeader?: boolean;
  animationDelay?: number;
}

/**
 * Wrapper component that provides consistent section styling and behavior
 */
export const BaseSectionWrapper: React.FC<BaseSectionWrapperProps> = ({
  id,
  title,
  subtitle,
  isPersonalized,
  children,
  isLoading,
  error,
  className = '',
  showHeader = true,
  animationDelay = 0,
  onSeeAll,
}) => {
  if (error) {
    return null; // Silently hide errored sections
  }

  return (
    <section
      id={id}
      className={`discover-section ${isPersonalized ? 'personalized' : ''} ${className}`}
      style={{ animationDelay: `${animationDelay}ms` }}
    >
      {showHeader && (
        <div className="discover-section-header">
          <div className="discover-section-title-row">
            <h2 className="discover-section-title">{title}</h2>
            {subtitle && <span className="discover-section-subtitle">{subtitle}</span>}
          </div>
          {onSeeAll && (
            <button className="discover-section-more" onClick={onSeeAll}>
              See all
            </button>
          )}
        </div>
      )}

      {isLoading ? (
        <div className="discover-section-loading">
          <div className="discover-loading-cards">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="track-card skeleton"
                style={{ animationDelay: `${i * 100}ms` }}
              />
            ))}
          </div>
        </div>
      ) : (
        children
      )}
    </section>
  );
};

/**
 * Hook for sections that need to fetch their own data
 */
export function useSectionData<T extends SectionData>(
  fetcher: (context: SelectionContext) => Promise<T>,
  context: SelectionContext,
  deps: React.DependencyList = []
): {
  data: T | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
} {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await fetcher(context);
      setData(result);
    } catch (err) {
      debugError('[Section]', 'Data fetch failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to load section');
    } finally {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [context.userProfile.totalListens, ...deps]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { data, isLoading, error, refetch: fetch };
}

/**
 * Embedding type configuration for useSectionTracks
 */
export interface EmbeddingConfig {
  type: 'mood' | 'genre' | 'personalized' | 'discovery';
  id?: string; // mood or genre id (e.g., 'chill', 'pop')
  exploration?: number;
}

/**
 * Hook for sections that fetch tracks via embedding (no fallback)
 * Uses embedding-based playlist generation only
 */
export function useSectionTracks(
  _query: string | undefined, // Kept for API compatibility but not used
  options: {
    limit?: number;
    filterDisliked?: boolean;
    shuffle?: boolean;
    embedding?: EmbeddingConfig;
  } = {}
): {
  tracks: UnifiedTrack[];
  isLoading: boolean;
  error: string | null;
  source: 'embedding' | 'none';
} {
  const { limit = 12, embedding } = options;

  // Get embedding playlist functions
  const {
    generateMoodPlaylist,
    generateGenrePlaylist,
    generatePersonalizedPlaylist,
    generateDiscoveryPlaylist,
    getTracksFromPlaylist,
    isReady: embeddingReady,
    tracksIndexed,
  } = useEmbeddingPlaylist();

  // Use embedding-based generation only
  const embeddingTracks = useMemo(() => {
    if (!embedding) {
      debugLog('[useSectionTracks]', 'No embedding config provided');
      return [];
    }

    if (!embeddingReady) {
      debugLog('[useSectionTracks]', 'Embedding not ready yet');
      return [];
    }

    if (tracksIndexed < 1) {
      debugLog('[useSectionTracks]', 'No tracks indexed yet');
      return [];
    }

    let playlist = null;

    switch (embedding.type) {
      case 'mood':
        if (embedding.id) {
          playlist = generateMoodPlaylist(embedding.id, {
            limit,
            exploration: embedding.exploration,
          });
        }
        break;
      case 'genre':
        if (embedding.id) {
          playlist = generateGenrePlaylist(embedding.id, {
            limit,
            exploration: embedding.exploration,
          });
        }
        break;
      case 'personalized':
        playlist = generatePersonalizedPlaylist({
          limit,
          exploration: embedding.exploration,
        });
        break;
      case 'discovery':
        playlist = generateDiscoveryPlaylist({
          limit,
          exploration: embedding.exploration,
        });
        break;
    }

    if (!playlist || playlist.tracks.length === 0) {
      debugLog('[useSectionTracks]', `No tracks from embedding ${embedding.type}:${embedding.id || ''}`);
      return [];
    }

    debugLog(
      '[useSectionTracks]',
      `Embedding ${embedding.type}${embedding.id ? `:${embedding.id}` : ''} returned ${playlist.tracks.length} tracks (indexed: ${tracksIndexed})`
    );
    return getTracksFromPlaylist(playlist);
  }, [
    embedding,
    embeddingReady,
    tracksIndexed,
    limit,
    generateMoodPlaylist,
    generateGenrePlaylist,
    generatePersonalizedPlaylist,
    generateDiscoveryPlaylist,
    getTracksFromPlaylist,
  ]);

  const source: 'embedding' | 'none' = embeddingTracks.length > 0 ? 'embedding' : 'none';

  return {
    tracks: embeddingTracks,
    isLoading: !embeddingReady,
    error: null,
    source
  };
}

/**
 * Skeleton loaders for different section types
 */
export const SectionSkeletons = {
  Grid: ({ count = 4 }: { count?: number }) => (
    <div className="discover-section-grid">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="track-card skeleton"
          style={{ animationDelay: `${i * 100}ms` }}
        />
      ))}
    </div>
  ),

  Horizontal: ({ count = 6 }: { count?: number }) => (
    <div className="horizontal-scroll">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="horizontal-card skeleton"
          style={{ animationDelay: `${i * 50}ms` }}
        />
      ))}
    </div>
  ),

  Masonry: ({ count = 8 }: { count?: number }) => (
    <div className="masonry-grid">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className={`masonry-card skeleton ${i % 3 === 0 ? 'large' : i % 3 === 1 ? 'medium' : 'small'}`}
          style={{ animationDelay: `${i * 75}ms` }}
        />
      ))}
    </div>
  ),

  Banner: () => (
    <div className="banner-section skeleton" />
  ),

  Cards: ({ count = 5 }: { count?: number }) => (
    <div className="stacked-cards-container">
      {Array.from({ length: Math.min(count, 3) }).map((_, i) => (
        <div
          key={i}
          className="stacked-card skeleton"
          style={{
            transform: `translateY(${i * 8}px) scale(${1 - i * 0.05})`,
            zIndex: count - i,
          }}
        />
      ))}
    </div>
  ),
};

export default BaseSectionWrapper;
