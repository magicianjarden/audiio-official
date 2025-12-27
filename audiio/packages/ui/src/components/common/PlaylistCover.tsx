/**
 * PlaylistCover - Auto-generated playlist cover art
 *
 * Features:
 * - Mosaic of up to 4 album arts from tracks
 * - Gradient fallback for empty/small playlists
 * - Customizable size and style
 */

import React, { useMemo } from 'react';
import type { UnifiedTrack } from '@audiio/core';
import { MusicNoteIcon } from '@audiio/icons';

interface PlaylistCoverProps {
  tracks: UnifiedTrack[];
  name?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

// Generate a consistent gradient based on playlist name
function getGradientFromName(name: string = ''): string {
  const gradients = [
    'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
    'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
    'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
    'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
    'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)',
    'linear-gradient(135deg, #5ee7df 0%, #b490ca 100%)',
    'linear-gradient(135deg, #d299c2 0%, #fef9d7 100%)',
    'linear-gradient(135deg, #f5af19 0%, #f12711 100%)',
    'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  ];

  // Simple hash from name
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }

  return gradients[Math.abs(hash) % gradients.length];
}

// Get unique artwork URLs from tracks
function getUniqueArtwork(tracks: UnifiedTrack[], maxCount: number = 4): string[] {
  const seen = new Set<string>();
  const artwork: string[] = [];

  for (const track of tracks) {
    const url = track.artwork?.medium ?? track.album?.artwork?.medium;
    if (url !== undefined && !seen.has(url)) {
      seen.add(url);
      artwork.push(url);
      if (artwork.length >= maxCount) break;
    }
  }

  return artwork;
}

const sizeClasses = {
  xs: 'playlist-cover-xs',
  sm: 'playlist-cover-sm',
  md: 'playlist-cover-md',
  lg: 'playlist-cover-lg',
  xl: 'playlist-cover-xl',
};

export const PlaylistCover: React.FC<PlaylistCoverProps> = ({
  tracks,
  name = '',
  size = 'md',
  className = '',
}) => {
  const artwork = useMemo(() => getUniqueArtwork(tracks, 4), [tracks]);
  const gradient = useMemo(() => getGradientFromName(name), [name]);

  const sizeClass = sizeClasses[size];
  const baseClass = `playlist-cover ${sizeClass} ${className}`;

  // No artwork - show gradient with icon
  if (artwork.length === 0) {
    const iconSize = size === 'xs' ? 12 : size === 'sm' ? 24 : size === 'md' ? 32 : size === 'lg' ? 48 : 64;
    return (
      <div className={`${baseClass} playlist-cover-gradient`} style={{ background: gradient }}>
        <MusicNoteIcon size={iconSize} />
      </div>
    );
  }

  // Single artwork
  if (artwork.length === 1) {
    return (
      <div className={`${baseClass} playlist-cover-single`}>
        <img src={artwork[0]} alt={name} loading="lazy" />
      </div>
    );
  }

  // 2 artwork - split horizontal
  if (artwork.length === 2) {
    return (
      <div className={`${baseClass} playlist-cover-duo`}>
        <img src={artwork[0]} alt="" loading="lazy" />
        <img src={artwork[1]} alt="" loading="lazy" />
      </div>
    );
  }

  // 3 artwork - one large, two small
  if (artwork.length === 3) {
    return (
      <div className={`${baseClass} playlist-cover-trio`}>
        <img src={artwork[0]} alt="" loading="lazy" className="playlist-cover-main" />
        <div className="playlist-cover-side">
          <img src={artwork[1]} alt="" loading="lazy" />
          <img src={artwork[2]} alt="" loading="lazy" />
        </div>
      </div>
    );
  }

  // 4 artwork - mosaic grid
  return (
    <div className={`${baseClass} playlist-cover-mosaic`}>
      {artwork.map((url, i) => (
        <img key={i} src={url} alt="" loading="lazy" />
      ))}
    </div>
  );
};

export default PlaylistCover;
