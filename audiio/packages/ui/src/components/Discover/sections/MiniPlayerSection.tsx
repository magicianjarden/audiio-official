/**
 * MiniPlayerSection - Ultra-compact row of artwork squares for quick sampling
 * Hover/click plays track, perfect for quick discovery
 */

import React, { useState, useRef, useEffect } from 'react';
import type { UnifiedTrack } from '@audiio/core';
import { usePlayerStore } from '../../../stores/player-store';
import { useTrackContextMenu } from '../../../contexts/ContextMenuContext';
import { BaseSectionWrapper, useSectionTracks } from './base/BaseSection';
import type { BaseSectionProps } from '../section-registry';
import { PlayIcon, PauseIcon, MusicNoteIcon } from '../../Icons/Icons';

export interface MiniPlayerSectionProps extends BaseSectionProps {
  tracks?: UnifiedTrack[];
  previewOnHover?: boolean;
}

export const MiniPlayerSection: React.FC<MiniPlayerSectionProps> = ({
  id,
  title,
  subtitle,
  query,
  isPersonalized,
  context,
  tracks: propTracks,
  previewOnHover = false,
  onSeeAll,
}) => {
  const { play, pause, setQueue, currentTrack, isPlaying } = usePlayerStore();
  const { showContextMenu } = useTrackContextMenu();

  // Use provided tracks or fetch via query
  const { tracks: fetchedTracks, isLoading, error } = useSectionTracks(
    propTracks ? undefined : query,
    { limit: 12 }
  );

  const tracks = propTracks ?? fetchedTracks;
  const [hoveredTrack, setHoveredTrack] = useState<string | null>(null);

  const handleTrackClick = (track: UnifiedTrack) => {
    if (currentTrack?.id === track.id && isPlaying) {
      pause();
    } else {
      setQueue(tracks, tracks.indexOf(track));
      play(track);
    }
  };

  if (!isLoading && tracks.length === 0) {
    return null;
  }

  return (
    <BaseSectionWrapper
      id={id}
      type="mini-player"
      title={title}
      subtitle={subtitle}
      isPersonalized={isPersonalized}
      isLoading={isLoading}
      error={error}
      context={context}
      onSeeAll={onSeeAll}
      className="mini-player-section"
    >
      <div className="mini-player-row">
        {tracks.map((track, index) => (
          <MiniPlayerCard
            key={track.id}
            track={track}
            index={index}
            isPlaying={currentTrack?.id === track.id && isPlaying}
            isHovered={hoveredTrack === track.id}
            onHover={() => setHoveredTrack(track.id)}
            onLeave={() => setHoveredTrack(null)}
            onClick={() => handleTrackClick(track)}
            onContextMenu={(e) => showContextMenu(e, track)}
          />
        ))}
      </div>

      {/* Hover info tooltip */}
      {hoveredTrack && (
        <TrackTooltip
          track={tracks.find((t) => t.id === hoveredTrack)}
        />
      )}
    </BaseSectionWrapper>
  );
};

interface MiniPlayerCardProps {
  track: UnifiedTrack;
  index: number;
  isPlaying: boolean;
  isHovered: boolean;
  onHover: () => void;
  onLeave: () => void;
  onClick: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
}

const MiniPlayerCard: React.FC<MiniPlayerCardProps> = ({
  track,
  index,
  isPlaying,
  isHovered,
  onHover,
  onLeave,
  onClick,
  onContextMenu,
}) => {
  const artwork = track.artwork?.small ?? track.artwork?.medium;

  return (
    <div
      className={`mini-player-card ${isPlaying ? 'playing' : ''} ${isHovered ? 'hovered' : ''}`}
      style={{ animationDelay: `${index * 30}ms` }}
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
      onClick={onClick}
      onContextMenu={onContextMenu}
    >
      <div className="mini-player-artwork">
        {artwork ? (
          <img src={artwork} alt={track.title} loading="lazy" />
        ) : (
          <div className="mini-player-placeholder">
            <MusicNoteIcon size={20} />
          </div>
        )}

        <div className="mini-player-overlay">
          {isPlaying ? (
            <PauseIcon size={20} />
          ) : (
            <PlayIcon size={20} />
          )}
        </div>

        {isPlaying && (
          <div className="mini-player-playing">
            <span className="playing-bar" />
            <span className="playing-bar" />
            <span className="playing-bar" />
          </div>
        )}
      </div>
    </div>
  );
};

interface TrackTooltipProps {
  track?: UnifiedTrack;
}

const TrackTooltip: React.FC<TrackTooltipProps> = ({ track }) => {
  if (!track) return null;

  return (
    <div className="mini-player-tooltip">
      <span className="tooltip-title">{track.title}</span>
      <span className="tooltip-artist">
        {track.artists.map((a) => a.name).join(', ')}
      </span>
    </div>
  );
};

export default MiniPlayerSection;
