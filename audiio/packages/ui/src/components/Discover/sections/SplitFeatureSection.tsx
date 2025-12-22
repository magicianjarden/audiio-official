/**
 * SplitFeatureSection - Two side-by-side hero cards
 * Great for comparisons, new vs classic, or dual features
 */

import React, { useState, useEffect } from 'react';
import type { UnifiedTrack } from '@audiio/core';
import { usePlayerStore } from '../../../stores/player-store';
import { useTrackContextMenu } from '../../../contexts/ContextMenuContext';
import { BaseSectionWrapper, useSectionTracks } from './base/BaseSection';
import type { BaseSectionProps } from '../section-registry';
import { PlayIcon, MusicNoteIcon } from '../../Icons/Icons';

export interface SplitFeatureSectionProps extends BaseSectionProps {
  leftTrack?: UnifiedTrack;
  rightTrack?: UnifiedTrack;
  leftLabel?: string;
  rightLabel?: string;
  dividerText?: string;
}

// Extract dominant color from image
async function extractColor(imageUrl: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 50;
        canvas.height = 50;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve('#1db954');
          return;
        }
        ctx.drawImage(img, 0, 0, 50, 50);
        const data = ctx.getImageData(0, 0, 50, 50).data;
        let r = 0, g = 0, b = 0;
        for (let i = 0; i < data.length; i += 4) {
          r += data[i];
          g += data[i + 1];
          b += data[i + 2];
        }
        const pixels = data.length / 4;
        resolve(`rgb(${Math.round(r / pixels)}, ${Math.round(g / pixels)}, ${Math.round(b / pixels)})`);
      } catch {
        resolve('#1db954');
      }
    };
    img.onerror = () => resolve('#1db954');
    img.src = imageUrl;
  });
}

export const SplitFeatureSection: React.FC<SplitFeatureSectionProps> = ({
  id,
  title,
  subtitle,
  query,
  isPersonalized,
  context,
  leftTrack: propLeftTrack,
  rightTrack: propRightTrack,
  leftLabel = 'New Release',
  rightLabel = 'Classic',
  dividerText = 'VS',
  onSeeAll,
}) => {
  const { play, setQueue, currentTrack, isPlaying } = usePlayerStore();
  const { showContextMenu } = useTrackContextMenu();

  // Fetch tracks if not provided
  const { tracks, isLoading, error } = useSectionTracks(
    propLeftTrack && propRightTrack ? undefined : query,
    { limit: 2, shuffle: true }
  );

  const leftTrack = propLeftTrack ?? tracks[0];
  const rightTrack = propRightTrack ?? tracks[1];

  const [leftColor, setLeftColor] = useState('#1db954');
  const [rightColor, setRightColor] = useState('#9b59b6');

  // Extract colors from artwork
  useEffect(() => {
    if (leftTrack?.artwork?.medium) {
      extractColor(leftTrack.artwork.medium).then(setLeftColor);
    }
    if (rightTrack?.artwork?.medium) {
      extractColor(rightTrack.artwork.medium).then(setRightColor);
    }
  }, [leftTrack, rightTrack]);

  const handleTrackClick = (track: UnifiedTrack, side: 'left' | 'right') => {
    const allTracks = [leftTrack, rightTrack].filter(Boolean) as UnifiedTrack[];
    setQueue(allTracks, side === 'left' ? 0 : 1);
    play(track);
  };

  if (!isLoading && (!leftTrack || !rightTrack)) {
    return null;
  }

  return (
    <BaseSectionWrapper
      id={id}
      type="split-feature"
      title={title}
      subtitle={subtitle}
      isPersonalized={isPersonalized}
      isLoading={isLoading}
      error={error}
      context={context}
      onSeeAll={onSeeAll}
      className="split-feature-section"
    >
      <div className="split-feature-container">
        {/* Left Card */}
        {leftTrack && (
          <SplitCard
            track={leftTrack}
            label={leftLabel}
            color={leftColor}
            side="left"
            isPlaying={currentTrack?.id === leftTrack.id && isPlaying}
            onClick={() => handleTrackClick(leftTrack, 'left')}
            onContextMenu={(e) => showContextMenu(e, leftTrack)}
          />
        )}

        {/* Divider */}
        <div className="split-feature-divider">
          <span className="split-feature-divider-text">{dividerText}</span>
        </div>

        {/* Right Card */}
        {rightTrack && (
          <SplitCard
            track={rightTrack}
            label={rightLabel}
            color={rightColor}
            side="right"
            isPlaying={currentTrack?.id === rightTrack.id && isPlaying}
            onClick={() => handleTrackClick(rightTrack, 'right')}
            onContextMenu={(e) => showContextMenu(e, rightTrack)}
          />
        )}
      </div>
    </BaseSectionWrapper>
  );
};

interface SplitCardProps {
  track: UnifiedTrack;
  label: string;
  color: string;
  side: 'left' | 'right';
  isPlaying: boolean;
  onClick: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
}

const SplitCard: React.FC<SplitCardProps> = ({
  track,
  label,
  color,
  side,
  isPlaying,
  onClick,
  onContextMenu,
}) => {
  const artwork = track.artwork?.large ?? track.artwork?.medium;
  const gradientDirection = side === 'left' ? '135deg' : '225deg';

  return (
    <div
      className={`split-card split-card--${side} ${isPlaying ? 'playing' : ''}`}
      onClick={onClick}
      onContextMenu={onContextMenu}
      style={{
        '--card-color': color,
        background: `linear-gradient(${gradientDirection}, ${color}30 0%, transparent 60%)`,
      } as React.CSSProperties}
    >
      <div className="split-card-label">{label}</div>

      <div className="split-card-artwork">
        {artwork ? (
          <img src={artwork} alt={track.title} />
        ) : (
          <div className="split-card-placeholder">
            <MusicNoteIcon size={48} />
          </div>
        )}
      </div>

      <div className="split-card-info">
        <h3 className="split-card-title">{track.title}</h3>
        <p className="split-card-artist">
          {track.artists.map((a) => a.name).join(', ')}
        </p>
      </div>

      <button className="split-card-play">
        <PlayIcon size={24} />
        <span>Play</span>
      </button>

      {isPlaying && (
        <div className="split-card-playing">
          <span className="playing-bar" />
          <span className="playing-bar" />
          <span className="playing-bar" />
        </div>
      )}
    </div>
  );
};

export default SplitFeatureSection;
