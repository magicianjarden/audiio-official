/**
 * BaseSection - Common wrapper for all Discover page sections
 * Provides loading states, error handling, animations, and consistent styling
 * Uses the UNIFIED plugin pipeline for track fetching
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import type { BaseSectionProps, SectionData, SelectionContext } from '../../section-registry';
import type { UnifiedTrack } from '@audiio/core';
import { usePluginData } from '../../../../hooks/usePluginData';
import type { StructuredSectionQuery } from '../../types';
import { debugLog, debugError } from '../../../../utils/debug';

export interface BaseSectionWrapperProps extends BaseSectionProps {
  children: React.ReactNode;
  isLoading?: boolean;
  error?: string | null;
  className?: string;
  showHeader?: boolean;
  animationDelay?: number;
  showWhyExplanation?: boolean;
}

/**
 * Wrapper component that provides consistent section styling and behavior
 */
export const BaseSectionWrapper: React.FC<BaseSectionWrapperProps> = ({
  id,
  title,
  subtitle,
  isPersonalized,
  whyExplanation,
  children,
  isLoading,
  error,
  className = '',
  showHeader = true,
  animationDelay = 0,
  showWhyExplanation = true,
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
          <div className="discover-section-actions">
            {showWhyExplanation && whyExplanation && (
              <span className="discover-section-why" title={whyExplanation}>
                {whyExplanation}
              </span>
            )}
            {onSeeAll && (
              <button className="discover-section-more" onClick={onSeeAll}>
                See all
              </button>
            )}
          </div>
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
 * Hook for sections that fetch tracks via the unified plugin pipeline
 * Uses the embeddingProvider through usePluginData for ML-powered generation
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
  source: 'embedding' | 'plugin' | 'none';
} {
  const { limit = 12, embedding } = options;

  // Build structured query for the unified pipeline
  const structuredQuery = useMemo((): StructuredSectionQuery => {
    // Map embedding config to structured query format
    let method: string = 'personalized';
    let mood: string | undefined;
    let genre: string | undefined;

    if (embedding) {
      switch (embedding.type) {
        case 'mood':
          method = 'mood';
          mood = embedding.id;
          break;
        case 'genre':
          method = 'genre';
          genre = embedding.id;
          break;
        case 'discovery':
          method = 'discovery';
          break;
        case 'personalized':
        default:
          method = 'personalized';
          break;
      }
    }

    return {
      strategy: 'plugin',
      sectionType: 'generic',
      title: 'Section',
      embedding: {
        method,
        mood,
        genre,
        exploration: embedding?.exploration ?? 0.2,
      },
      limit,
    };
  }, [embedding, limit]);

  // Use unified plugin pipeline - embeddingProvider handles generation
  const { tracks, isLoading } = usePluginData(structuredQuery, {
    enabled: !!embedding,
    applyMLRanking: true,
    applyTransformers: true,
    limit,
  });

  const source: 'embedding' | 'plugin' | 'none' = tracks.length > 0 ? 'embedding' : 'none';

  return {
    tracks,
    isLoading,
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
