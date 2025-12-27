/**
 * MoodGradientSection - Cards positioned along a color/mood spectrum
 * Displays tracks arranged by energy level from calm to energetic
 */

import React, { useMemo } from 'react';
import type { UnifiedTrack } from '@audiio/core';
import { usePlayerStore } from '../../../stores/player-store';
import { useTrackContextMenu } from '../../../contexts/ContextMenuContext';
import { useRecommendationStore, calculateTrackMood, type EnergyLevel } from '../../../stores/recommendation-store';
import { BaseSectionWrapper, useSectionTracks } from './base/BaseSection';
import type { BaseSectionProps } from '../section-registry';
import { PlayIcon, MusicNoteIcon } from '@audiio/icons';

export interface MoodGradientSectionProps extends BaseSectionProps {
  tracks?: UnifiedTrack[];
}

// Colors for energy levels - using CSS variables for theme support
const ENERGY_COLORS: Record<EnergyLevel, string> = {
  'very-low': 'var(--color-energy-calm)',
  'low': 'var(--color-energy-chill)',
  'medium': 'var(--color-energy-balanced)',
  'high': 'var(--color-energy-upbeat)',
  'very-high': 'var(--color-energy-intense)',
};

const ENERGY_LABELS: Record<EnergyLevel, string> = {
  'very-low': 'Calm',
  'low': 'Chill',
  'medium': 'Balanced',
  'high': 'Upbeat',
  'very-high': 'Intense',
};

export const MoodGradientSection: React.FC<MoodGradientSectionProps> = ({
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
  const { sortTracksByEnergy } = useRecommendationStore();

  // Use provided tracks or fetch via query
  const { tracks: fetchedTracks, isLoading, error } = useSectionTracks(
    propTracks ? undefined : query,
    { limit: 10 }
  );

  const tracks = propTracks ?? fetchedTracks;

  // Sort tracks by energy and calculate mood data
  const sortedTracks = useMemo(() => {
    return sortTracksByEnergy(tracks, 'asc').map((track) => ({
      track,
      mood: calculateTrackMood(track),
    }));
  }, [tracks, sortTracksByEnergy]);

  const handleTrackClick = (track: UnifiedTrack) => {
    const allTracks = sortedTracks.map((t) => t.track);
    setQueue(allTracks, allTracks.indexOf(track));
    play(track);
  };

  if (!isLoading && tracks.length === 0) {
    return null;
  }

  return (
    <BaseSectionWrapper
      id={id}
      type="mood-gradient"
      title={title}
      subtitle={subtitle}
      isPersonalized={isPersonalized}
      isLoading={isLoading}
      error={error}
      context={context}
      onSeeAll={onSeeAll}
      className="mood-gradient-section"
    >
      {/* Gradient bar background */}
      <div className="mood-gradient-container">
        <div className="mood-gradient-bar">
          {/* Gradient background */}
          <div
            className="mood-gradient-background"
            style={{
              background: `linear-gradient(90deg, ${ENERGY_COLORS['very-low']} 0%, ${ENERGY_COLORS['low']} 25%, ${ENERGY_COLORS['medium']} 50%, ${ENERGY_COLORS['high']} 75%, ${ENERGY_COLORS['very-high']} 100%)`,
            }}
          />

          {/* Track container for proper positioning */}
          <div className="mood-track-container">
            {/* Track cards positioned along gradient */}
            {sortedTracks.map(({ track, mood }, index) => (
              <MoodCard
                key={track.id}
                track={track}
                energyLevel={mood.energyLevel}
                index={index}
                totalTracks={sortedTracks.length}
                isPlaying={currentTrack?.id === track.id && isPlaying}
                onClick={() => handleTrackClick(track)}
                onContextMenu={(e) => showContextMenu(e, track)}
              />
            ))}
          </div>
        </div>

        {/* Energy level labels */}
        <div className="mood-gradient-labels">
          <span className="mood-label" style={{ color: ENERGY_COLORS['very-low'] }}>
            {ENERGY_LABELS['very-low']}
          </span>
          <span className="mood-label" style={{ color: ENERGY_COLORS['medium'] }}>
            {ENERGY_LABELS['medium']}
          </span>
          <span className="mood-label" style={{ color: ENERGY_COLORS['very-high'] }}>
            {ENERGY_LABELS['very-high']}
          </span>
        </div>
      </div>
    </BaseSectionWrapper>
  );
};

interface MoodCardProps {
  track: UnifiedTrack;
  energyLevel: EnergyLevel;
  index: number;
  totalTracks: number;
  isPlaying: boolean;
  onClick: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
}

const MoodCard: React.FC<MoodCardProps> = ({
  track,
  energyLevel,
  index,
  totalTracks,
  isPlaying,
  onClick,
  onContextMenu,
}) => {
  const artwork = track.artwork?.small ?? track.artwork?.medium;
  const color = ENERGY_COLORS[energyLevel];

  // Calculate horizontal position with padding from edges
  // Reserve ~36px on each side (half card width) to prevent overflow
  const edgePadding = 4; // percentage from each edge
  const usableWidth = 100 - (edgePadding * 2);
  const spreadPosition = edgePadding + (index / Math.max(totalTracks - 1, 1)) * usableWidth;

  // Create a smooth wave pattern for vertical offset
  // Uses sine wave for organic flow - amplitude of 18px
  const waveOffset = Math.sin((index / Math.max(totalTracks - 1, 1)) * Math.PI * 2) * 18;

  return (
    <div
      className={`mood-card ${isPlaying ? 'playing' : ''}`}
      style={{
        left: `${spreadPosition}%`,
        transform: `translateX(-50%) translateY(${waveOffset}px)`,
        '--card-color': color,
        animationDelay: `${index * 60}ms`,
      } as React.CSSProperties}
      onClick={onClick}
      onContextMenu={onContextMenu}
    >
      <div
        className="mood-card-glow"
        style={{ background: `radial-gradient(circle, ${color}50 0%, transparent 70%)` }}
      />

      <div className="mood-card-artwork">
        {artwork ? (
          <img src={artwork} alt={track.title} loading="lazy" />
        ) : (
          <div className="mood-card-placeholder">
            <MusicNoteIcon size={24} />
          </div>
        )}

        <div className="mood-card-overlay">
          <PlayIcon size={20} />
        </div>

        {isPlaying && (
          <div className="mood-card-playing">
            <span className="playing-bar" />
            <span className="playing-bar" />
            <span className="playing-bar" />
          </div>
        )}
      </div>

      <div className="mood-card-info">
        <span className="mood-card-title">{track.title}</span>
        <span
          className="mood-card-energy"
          style={{ color }}
        >
          {ENERGY_LABELS[energyLevel]}
        </span>
      </div>
    </div>
  );
};

export default MoodGradientSection;
