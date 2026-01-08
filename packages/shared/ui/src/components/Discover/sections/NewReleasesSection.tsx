/**
 * NewReleasesSection - Fresh drops from this week
 * Grid layout showing recently added/released tracks.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { usePlayerStore } from '../../../stores/player-store';
import { useTrackContextMenu } from '../../../contexts/ContextMenuContext';
import { usePluginData } from '../../../hooks/usePluginData';
import { TrackCard } from '../TrackCard';
import { PlayIcon, SparklesIcon, ChevronRightIcon } from '@audiio/icons';
import type { StructuredSectionQuery } from '../types';

export interface NewReleasesSectionProps {
  id: string;
  title?: string;
  subtitle?: string;
  maxItems?: number;
  onSeeAll?: () => void;
}

export const NewReleasesSection: React.FC<NewReleasesSectionProps> = ({
  id,
  title = 'New Releases',
  subtitle = 'Fresh drops this week',
  maxItems = 6,
  onSeeAll,
}) => {
  const { play, setQueue } = usePlayerStore();
  const { showContextMenu } = useTrackContextMenu();
  const [isVisible, setIsVisible] = useState(false);

  const structuredQuery = useMemo((): StructuredSectionQuery => ({
    strategy: 'plugin',
    sectionType: 'new-releases',
    title,
    embedding: {
      method: 'discovery',
      exploration: 0.3,
      temporalContext: 'recent',
    },
    filters: {
      releasedWithinDays: 30,
    },
    sort: {
      field: 'releaseDate',
      order: 'desc',
    },
    limit: maxItems,
  }), [title, maxItems]);

  const { tracks, isLoading } = usePluginData(structuredQuery, {
    enabled: true,
    applyMLRanking: false,
    applyTransformers: true,
    limit: maxItems,
  });

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 150);
    return () => clearTimeout(timer);
  }, []);

  const handlePlayTrack = (index: number) => {
    setQueue(tracks, index);
    play(tracks[index]!);
  };

  const handlePlayAll = () => {
    if (tracks.length > 0) {
      setQueue(tracks, 0);
      play(tracks[0]!);
    }
  };

  const showEmptyState = !isLoading && tracks.length === 0;

  if (showEmptyState) return null;

  return (
    <section
      id={id}
      className={`discover-section ${isVisible ? 'is-visible' : ''}`}
      style={{ animationDelay: '150ms' }}
    >
      <div className="discover-section-header">
        <div className="discover-section-title-row">
          <SparklesIcon size={20} className="discover-section-icon" />
          <h2 className="discover-section-title">{title}</h2>
          <span className="discover-section-subtitle">{subtitle}</span>
        </div>
        <div className="discover-section-actions">
          <button className="pill-btn pill-btn--sm" onClick={handlePlayAll}>
            <PlayIcon size={14} />
            <span>Play all</span>
          </button>
          {onSeeAll && (
            <button className="discover-section-more" onClick={onSeeAll}>
              See all <ChevronRightIcon size={16} />
            </button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="discover-section-grid">
          {Array.from({ length: maxItems }).map((_, i) => (
            <div key={i} className="track-card skeleton" style={{ animationDelay: `${i * 50}ms` }} />
          ))}
        </div>
      ) : (
        <div className="discover-section-grid">
          {tracks.map((track, index) => (
            <TrackCard
              key={track.id}
              track={track}
              onClick={() => handlePlayTrack(index)}
              onContextMenu={showContextMenu}
              style={{ animationDelay: `${index * 50}ms` }}
            />
          ))}
        </div>
      )}
    </section>
  );
};

export default NewReleasesSection;
