/**
 * GridSection - Standard responsive grid of track cards
 */

import React from 'react';
import type { UnifiedTrack } from '@audiio/core';
import { TrackCard } from '../TrackCard';
import { usePlayerStore } from '../../../stores/player-store';
import { useTrackContextMenu } from '../../../contexts/ContextMenuContext';

export interface GridSectionProps {
  id: string;
  title: string;
  subtitle?: string;
  tracks: UnifiedTrack[];
  isLoading?: boolean;
  isPersonalized?: boolean;
  maxItems?: number;
  onSeeAll?: () => void;
}

export const GridSection: React.FC<GridSectionProps> = ({
  title,
  subtitle,
  tracks,
  isLoading,
  isPersonalized,
  maxItems = 8,
  onSeeAll,
}) => {
  const { play, setQueue } = usePlayerStore();
  const { showContextMenu } = useTrackContextMenu();

  const displayTracks = tracks?.slice(0, maxItems) || [];

  const handleTrackClick = (track: UnifiedTrack, index: number) => {
    setQueue(displayTracks, index);
    play(track);
  };

  if (!isLoading && (!tracks || tracks.length === 0)) {
    return null;
  }

  return (
    <section className={`discover-section ${isPersonalized ? 'personalized' : ''}`}>
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

      {isLoading ? (
        <div className="discover-section-loading">
          <div className="discover-loading-cards">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="track-card skeleton" style={{ animationDelay: `${i * 100}ms` }} />
            ))}
          </div>
        </div>
      ) : (
        <div className="discover-section-grid">
          {displayTracks.map((track, index) => (
            <TrackCard
              key={track.id}
              track={track}
              onClick={() => handleTrackClick(track, index)}
              onContextMenu={showContextMenu}
              style={{ animationDelay: `${index * 50}ms` }}
            />
          ))}
        </div>
      )}
    </section>
  );
};

export default GridSection;
