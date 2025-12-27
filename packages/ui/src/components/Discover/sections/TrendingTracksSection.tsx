/**
 * TrendingTracksSection - Horizontal scroll of trending/popular tracks
 * Now with ML-based personalized ranking for better recommendations
 */

import React, { useState, useEffect } from 'react';
import type { UnifiedTrack } from '@audiio/core';
import { TrackCard } from '../TrackCard';
import { usePlayerStore } from '../../../stores/player-store';
import { useTrackContextMenu } from '../../../contexts/ContextMenuContext';
import { useMLRanking } from '../../../hooks';
import type { BaseSectionProps } from '../section-registry';
import { debugError } from '../../../utils/debug';

export interface TrendingTracksSectionProps extends BaseSectionProps {
  maxItems?: number;
}

export const TrendingTracksSection: React.FC<TrendingTracksSectionProps> = ({
  id,
  title,
  subtitle,
  query,
  onSeeAll,
  isPersonalized,
  maxItems = 12,
}) => {
  const [tracks, setTracks] = useState<UnifiedTrack[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { play, setQueue } = usePlayerStore();
  const { showContextMenu } = useTrackContextMenu();
  const { rankTracks, isMLReady } = useMLRanking();

  useEffect(() => {
    let mounted = true;

    const fetchTrending = async () => {
      setIsLoading(true);
      try {
        let fetchedTracks: UnifiedTrack[] = [];

        // Try getTrending API first
        if (window.api?.getTrending) {
          const trending = await window.api.getTrending();
          if (trending?.tracks?.length > 0) {
            // Convert MetadataTrack to UnifiedTrack format
            fetchedTracks = trending.tracks.slice(0, maxItems * 2).map(track => ({
              ...track,
              streamSources: [],
              _meta: {
                metadataProvider: track._provider || 'trending',
                matchConfidence: 1,
                externalIds: track.externalIds || {},
                lastUpdated: new Date()
              }
            })) as UnifiedTrack[];
          }
        }

        // Fallback to search
        if (fetchedTracks.length === 0 && window.api?.search) {
          const searchQuery = query || 'top hits 2024 trending popular';
          const results = await window.api.search({ query: searchQuery, type: 'track' });
          fetchedTracks = (results || []).slice(0, maxItems * 2);
        }

        if (!mounted) return;

        // Apply ML ranking if personalized and ML is ready
        if (isPersonalized && fetchedTracks.length > 0) {
          const ranked = await rankTracks(fetchedTracks, {
            enabled: true,
            explorationMode: 'balanced',
            limit: maxItems,
            shuffle: true,
            shuffleIntensity: 0.1
          });
          setTracks(ranked.map(r => r.track));
        } else {
          // For non-personalized, apply light ranking for relevance
          const ranked = await rankTracks(fetchedTracks, {
            enabled: true,
            explorationMode: 'explore', // More variety for trending
            limit: maxItems,
            shuffle: true,
            shuffleIntensity: 0.15
          });
          setTracks(ranked.map(r => r.track));
        }
      } catch (error) {
        debugError('[TrendingTracksSection]', 'Failed to fetch:', error);
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    fetchTrending();

    return () => {
      mounted = false;
    };
  }, [query, maxItems, isPersonalized, rankTracks]);

  const handleTrackClick = (track: UnifiedTrack, index: number) => {
    setQueue(tracks, index);
    play(track);
  };

  // Don't hide section completely - show placeholder if empty
  const showEmptyState = !isLoading && tracks.length === 0;

  return (
    <section id={id} className="discover-horizontal-section discover-trending-section">
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

      {isLoading ? (
        <div className="discover-horizontal-scroll">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="discover-card-skeleton" />
          ))}
        </div>
      ) : showEmptyState ? (
        <div className="discover-empty-state">
          <p>Unable to load trending tracks</p>
        </div>
      ) : (
        <div className="discover-horizontal-scroll">
          {tracks.map((track, index) => (
            <TrackCard
              key={track.id}
              track={track}
              onClick={() => handleTrackClick(track, index)}
              onContextMenu={showContextMenu}
            />
          ))}
        </div>
      )}
    </section>
  );
};

export default TrendingTracksSection;
