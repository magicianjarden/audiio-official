import React from 'react';
import type { UnifiedTrack } from '@audiio/core';
import { MusicNoteIcon } from '../Icons/Icons';

interface TrackRowProps {
  track: UnifiedTrack;
  index: number;
  isPlaying?: boolean;
  onClick: () => void;
  onContextMenu?: (e: React.MouseEvent, track: UnifiedTrack) => void;
  compact?: boolean;
}

export const TrackRow: React.FC<TrackRowProps> = ({
  track,
  index,
  isPlaying = false,
  onClick,
  onContextMenu,
  compact = false
}) => {
  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const artistNames = track.artists.map(a => a.name).join(', ');
  const artworkUrl = track.artwork?.medium ?? track.album?.artwork?.medium;

  const handleContextMenu = (e: React.MouseEvent) => {
    if (onContextMenu) {
      onContextMenu(e, track);
    }
  };

  return (
    <div
      className={`track-row ${isPlaying ? 'playing' : ''} ${compact ? 'compact' : ''}`}
      onClick={onClick}
      onContextMenu={handleContextMenu}
    >
      <span className="track-number">{index}</span>

      {artworkUrl ? (
        <img
          className="track-artwork"
          src={artworkUrl}
          alt={track.title}
          loading="lazy"
        />
      ) : (
        <div className="track-artwork-placeholder">
          <MusicNoteIcon size={20} />
        </div>
      )}

      <div className="track-info">
        <div className="track-title">{track.title}</div>
        <div className="track-artist">{artistNames}</div>
      </div>

      <span className="track-duration">
        {formatDuration(track.duration)}
      </span>
    </div>
  );
};
