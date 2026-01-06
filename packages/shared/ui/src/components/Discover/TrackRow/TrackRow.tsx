import React, { useState, useEffect } from 'react';
import type { UnifiedTrack } from '@audiio/core';
import { MusicNoteIcon } from '@audiio/icons';
import { useArtwork } from '../../../hooks/useArtwork';

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
  const [imageError, setImageError] = useState(false);

  // Reset error state when track changes
  useEffect(() => {
    setImageError(false);
  }, [track.id]);

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const artistNames = track.artists?.length > 0
    ? track.artists.map(a => a.name).join(', ')
    : 'Unknown Artist';
  const { artworkUrl, isLoading: artworkLoading } = useArtwork(track);


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

      {artworkUrl && !imageError ? (
        <img
          className={`track-artwork ${artworkLoading ? 'loading' : ''}`}
          src={artworkUrl}
          alt={track.title}
          loading="lazy"
          onError={() => setImageError(true)}
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
        {track.duration > 0 ? formatDuration(track.duration) : '--:--'}
      </span>
    </div>
  );
};
