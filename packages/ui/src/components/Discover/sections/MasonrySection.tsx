/**
 * MasonrySection - Pinterest-style staggered grid with mixed card sizes
 * Displays tracks in a masonry layout with varying card heights
 */

import React, { useState, useEffect } from 'react';
import type { UnifiedTrack } from '@audiio/core';
import { usePlayerStore } from '../../../stores/player-store';
import { useTrackContextMenu } from '../../../contexts/ContextMenuContext';
import { BaseSectionWrapper, useSectionTracks } from './base/BaseSection';
import type { BaseSectionProps } from '../section-registry';
import { PlayIcon, MusicNoteIcon } from '@audiio/icons';

export interface MasonrySectionProps extends BaseSectionProps {
  tracks?: UnifiedTrack[];
}

type CardSize = 'small' | 'medium' | 'large';

interface MasonryCard {
  track: UnifiedTrack;
  size: CardSize;
}

// Determine card size based on index and some randomness
function getCardSize(index: number, total: number): CardSize {
  // First card is always large
  if (index === 0) return 'large';

  // Every 5th card is large
  if (index % 5 === 0) return 'large';

  // Every 3rd card is medium
  if (index % 3 === 0) return 'medium';

  // Rest are small
  return 'small';
}

export const MasonrySection: React.FC<MasonrySectionProps> = ({
  id,
  title,
  subtitle,
  query,
  isPersonalized,
  context,
  tracks: propTracks,
  onSeeAll,
}) => {
  const { play, setQueue, currentTrack, isPlaying } = usePlayerStore();
  const { showContextMenu } = useTrackContextMenu();

  // Use provided tracks or fetch via query
  const { tracks: fetchedTracks, isLoading, error } = useSectionTracks(
    propTracks ? undefined : query,
    { limit: 12 }
  );

  const tracks = propTracks ?? fetchedTracks;

  // Create masonry cards with sizes
  const masonryCards: MasonryCard[] = tracks.map((track, index) => ({
    track,
    size: getCardSize(index, tracks.length),
  }));

  const handleTrackClick = (track: UnifiedTrack) => {
    setQueue(tracks, tracks.indexOf(track));
    play(track);
  };

  if (!isLoading && tracks.length === 0) {
    return null;
  }

  return (
    <BaseSectionWrapper
      id={id}
      type="masonry"
      title={title}
      subtitle={subtitle}
      isPersonalized={isPersonalized}
      isLoading={isLoading}
      error={error}
      context={context}
      onSeeAll={onSeeAll}
      className="masonry-section"
    >
      <div className="masonry-grid">
        {masonryCards.map(({ track, size }, index) => (
          <MasonryCard
            key={track.id}
            track={track}
            size={size}
            index={index}
            isPlaying={currentTrack?.id === track.id && isPlaying}
            onClick={() => handleTrackClick(track)}
            onContextMenu={(e) => showContextMenu(e, track)}
          />
        ))}
      </div>
    </BaseSectionWrapper>
  );
};

interface MasonryCardProps {
  track: UnifiedTrack;
  size: CardSize;
  index: number;
  isPlaying: boolean;
  onClick: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
}

const MasonryCard: React.FC<MasonryCardProps> = ({
  track,
  size,
  index,
  isPlaying,
  onClick,
  onContextMenu,
}) => {
  const artwork = size === 'large'
    ? track.artwork?.large ?? track.artwork?.medium
    : track.artwork?.medium ?? track.artwork?.small;

  return (
    <div
      className={`masonry-card masonry-card--${size} ${isPlaying ? 'playing' : ''}`}
      onClick={onClick}
      onContextMenu={onContextMenu}
      style={{ animationDelay: `${index * 50}ms` }}
    >
      <div className="masonry-card-artwork">
        {artwork ? (
          <img src={artwork} alt={track.title} loading="lazy" />
        ) : (
          <div className="masonry-card-placeholder">
            <MusicNoteIcon size={size === 'large' ? 48 : size === 'medium' ? 32 : 24} />
          </div>
        )}
        <div className="masonry-card-overlay">
          <button className="masonry-card-play">
            <PlayIcon size={size === 'large' ? 32 : 24} />
          </button>
        </div>
        {isPlaying && (
          <div className="masonry-card-playing">
            <span className="playing-bar" />
            <span className="playing-bar" />
            <span className="playing-bar" />
          </div>
        )}
      </div>
      <div className="masonry-card-info">
        <span className="masonry-card-title">{track.title}</span>
        {(size === 'large' || size === 'medium') && (
          <span className="masonry-card-artist">
            {track.artists.map((a) => a.name).join(', ')}
          </span>
        )}
      </div>
    </div>
  );
};

export default MasonrySection;
