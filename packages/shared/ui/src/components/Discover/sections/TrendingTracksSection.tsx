/**
 * TrendingTracksSection - Top Charts vertical numbered list
 * Uses the standard TrackRow component for consistent design
 */

import React from 'react';
import type { UnifiedTrack } from '@audiio/core';
import { TrackRow } from '../../TrackRow/TrackRow';
import { usePlayerStore } from '../../../stores/player-store';
import { useTrackContextMenu } from '../../../contexts/ContextMenuContext';
import { useTrending } from '../../../hooks/useRecommendations';

export interface TrendingTracksSectionProps {
  id?: string;
  title?: string;
  subtitle?: string;
  maxItems?: number;
}

export const TrendingTracksSection: React.FC<TrendingTracksSectionProps> = ({
  id,
  title = 'Top Charts',
  subtitle = 'What everyone is listening to',
  maxItems = 10,
}) => {
  const { play, setQueue, currentTrack } = usePlayerStore();
  const { showContextMenu } = useTrackContextMenu();

  const { data, isLoading } = useTrending();
  const tracks = data.tracks.slice(0, maxItems);

  const handleTrackClick = (track: UnifiedTrack, index: number) => {
    setQueue(tracks, index);
    play(track);
  };

  const showEmptyState = !isLoading && tracks.length === 0;

  return (
    <section id={id} className="discover-charts-section">
      <div className="charts-header">
        <h2 className="charts-header-title">{title}</h2>
        {subtitle && <span className="charts-header-subtitle">{subtitle}</span>}
      </div>

      {isLoading ? (
        <div className="charts-list">
          {Array.from({ length: maxItems }).map((_, i) => (
            <div key={i} className="track-row-skeleton skeleton" />
          ))}
        </div>
      ) : showEmptyState ? (
        <div className="discover-empty-state">
          <p>Unable to load charts</p>
        </div>
      ) : (
        <div className="charts-list">
          {tracks.map((track, index) => (
            <TrackRow
              key={track.id}
              track={track}
              index={index + 1}
              isPlaying={currentTrack?.id === track.id}
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
