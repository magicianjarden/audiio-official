import React from 'react';
import type { UnifiedTrack } from '@audiio/core';
import { usePlayerStore } from '../../stores/player-store';
import { useLibraryStore } from '../../stores/library-store';
import {
  PlayIcon,
  PauseIcon,
  HeartIcon,
  HeartOutlineIcon,
  MusicNoteIcon
} from '@audiio/icons';
import { WhyButton } from '../RecommendationExplanation';

interface TrackCardProps {
  track: UnifiedTrack;
  onClick: () => void;
  onContextMenu?: (e: React.MouseEvent, track: UnifiedTrack) => void;
  style?: React.CSSProperties;
  showLike?: boolean;
}

export const TrackCard: React.FC<TrackCardProps> = ({ track, onClick, onContextMenu, style }) => {
  const { currentTrack, isPlaying } = usePlayerStore();
  const { isLiked, toggleLike } = useLibraryStore();

  const isCurrentTrack = currentTrack?.id === track.id;
  const trackIsLiked = isLiked(track.id);
  const artworkUrl = track.artwork?.medium ?? track.album?.artwork?.medium;
  const artistNames = track.artists?.map(a => a.name).join(', ') ?? 'Unknown Artist';

  const handleLikeClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleLike(track);
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    if (onContextMenu) {
      onContextMenu(e, track);
    }
  };

  return (
    <div
      className={`track-card ${isCurrentTrack ? 'playing' : ''}`}
      onClick={onClick}
      onContextMenu={handleContextMenu}
      style={style}
    >
      <WhyButton track={track} />
      <div className="track-card-artwork">
        {artworkUrl ? (
          <img
            src={artworkUrl}
            alt={track.title}
            loading="lazy"
          />
        ) : (
          <div className="track-card-artwork-placeholder">
            <MusicNoteIcon size={48} />
          </div>
        )}
        <div className="track-card-overlay">
          <button className="track-card-play">
            {isCurrentTrack && isPlaying ? <PauseIcon size={24} /> : <PlayIcon size={24} />}
          </button>
        </div>
      </div>
      <div className="track-card-info">
        <div className="track-card-title">{track.title}</div>
        <div className="track-card-artist">{artistNames}</div>
      </div>
      <button
        className={`track-card-like ${trackIsLiked ? 'liked' : ''}`}
        onClick={handleLikeClick}
        title={trackIsLiked ? 'Remove from Liked Songs' : 'Add to Liked Songs'}
      >
        {trackIsLiked ? <HeartIcon size={16} /> : <HeartOutlineIcon size={16} />}
      </button>
    </div>
  );
};
