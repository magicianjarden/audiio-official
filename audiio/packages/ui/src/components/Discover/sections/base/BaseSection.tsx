/**
 * BaseSection - Common wrapper for all Discover page sections
 * Provides loading states, error handling, animations, and consistent styling
 */

import React, { useState, useEffect, useCallback } from 'react';
import type { BaseSectionProps, SectionData, SelectionContext } from '../../section-registry';
import type { UnifiedTrack } from '@audiio/core';

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
            {isPersonalized && (
              <span className="discover-section-personalized-tag">For You</span>
            )}
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
      console.error('[Section] Data fetch failed:', err);
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
 * Hook for sections that fetch tracks via search API
 */
export function useSectionTracks(
  query: string | undefined,
  options: {
    limit?: number;
    filterDisliked?: boolean;
    shuffle?: boolean;
  } = {}
): {
  tracks: UnifiedTrack[];
  isLoading: boolean;
  error: string | null;
} {
  const [tracks, setTracks] = useState<UnifiedTrack[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { limit = 12, shuffle = false } = options;

  useEffect(() => {
    if (!query) {
      setTracks([]);
      setIsLoading(false);
      return;
    }

    let mounted = true;

    const fetchTracks = async () => {
      setIsLoading(true);
      setError(null);

      try {
        if (window.api) {
          let result = await window.api.search({ query, type: 'track' });

          if (shuffle) {
            result = [...result].sort(() => Math.random() - 0.5);
          }

          if (mounted) {
            setTracks(result.slice(0, limit));
          }
        }
      } catch (err) {
        console.error('[Section] Track fetch failed:', err);
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Failed to load tracks');
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    fetchTracks();

    return () => {
      mounted = false;
    };
  }, [query, limit, shuffle]);

  return { tracks, isLoading, error };
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
