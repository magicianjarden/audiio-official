/**
 * PlaylistCard Component
 * Displays a playlist preview in grid/list format
 */

import React from 'react';
import type { PlaylistPreview } from '../stores';
import './PlaylistCard.css';

interface PlaylistCardProps {
  playlist: PlaylistPreview;
  isSelected?: boolean;
  onClick?: () => void;
  onImport?: () => void;
  view?: 'grid' | 'list';
}

export const PlaylistCard: React.FC<PlaylistCardProps> = ({
  playlist,
  isSelected = false,
  onClick,
  onImport,
  view = 'grid',
}) => {
  const formatFollowers = (count: number): string => {
    if (count >= 1_000_000) {
      return `${(count / 1_000_000).toFixed(1)}M`;
    }
    if (count >= 1_000) {
      return `${(count / 1_000).toFixed(1)}K`;
    }
    return count.toString();
  };

  const handleImportClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onImport?.();
  };

  if (view === 'list') {
    return (
      <div
        className={`sposify-playlist-card list ${isSelected ? 'selected' : ''}`}
        onClick={onClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && onClick?.()}
      >
        <div className="playlist-icon">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M15 6H3v2h12V6zm0 4H3v2h12v-2zM3 16h8v-2H3v2zM17 6v8.18c-.31-.11-.65-.18-1-.18-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3V8h3V6h-5z" />
          </svg>
        </div>

        <div className="playlist-info">
          <span className="playlist-name" title={playlist.name}>
            {playlist.name}
          </span>
          {playlist.description && (
            <span className="playlist-description" title={playlist.description}>
              {playlist.description}
            </span>
          )}
        </div>

        <div className="playlist-meta">
          <span className="track-count">{playlist.trackCount} tracks</span>
          <span className="followers">{formatFollowers(playlist.followers)} followers</span>
        </div>

        {onImport && (
          <button className="import-btn" onClick={handleImportClick} title="Import playlist">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
            </svg>
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      className={`sposify-playlist-card grid ${isSelected ? 'selected' : ''}`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onClick?.()}
    >
      <div className="playlist-artwork">
        <div className="playlist-icon-large">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M15 6H3v2h12V6zm0 4H3v2h12v-2zM3 16h8v-2H3v2zM17 6v8.18c-.31-.11-.65-.18-1-.18-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3V8h3V6h-5z" />
          </svg>
        </div>

        {onImport && (
          <button className="import-overlay-btn" onClick={handleImportClick} title="Import playlist">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
            </svg>
          </button>
        )}
      </div>

      <div className="playlist-details">
        <span className="playlist-name" title={playlist.name}>
          {playlist.name}
        </span>
        <div className="playlist-stats">
          <span>{playlist.trackCount} tracks</span>
          <span className="separator">|</span>
          <span>{formatFollowers(playlist.followers)}</span>
        </div>
      </div>
    </div>
  );
};

export default PlaylistCard;
