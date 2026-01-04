/**
 * FocusModeSection - ML-powered focus/productivity music
 * Uses mood embeddings to find instrumental, ambient, and focus-friendly tracks
 * Uses the UNIFIED plugin pipeline for data (embedding provider handles mood)
 */

import React, { useMemo } from 'react';
import type { UnifiedTrack } from '@audiio/core';
import { TrackCard } from '../TrackCard';
import { usePlayerStore } from '../../../stores/player-store';
import { useTrackContextMenu } from '../../../contexts/ContextMenuContext';
import { usePluginData } from '../../../hooks/usePluginData';
import type { BaseSectionProps } from '../section-registry';
import type { StructuredSectionQuery } from '../types';

export interface FocusModeSectionProps extends BaseSectionProps {
  maxItems?: number;
  focusType?: 'study' | 'work' | 'creative' | 'relax';
}

// Map focus types to mood descriptors
const focusMoodMap: Record<string, string> = {
  study: 'focus',
  work: 'focus',
  creative: 'chill',
  relax: 'chill',
};

const focusTitles: Record<string, { title: string; subtitle: string }> = {
  study: { title: 'Study Session', subtitle: 'Focus-enhancing music' },
  work: { title: 'Deep Work', subtitle: 'Music for productivity' },
  creative: { title: 'Creative Flow', subtitle: 'Inspiring background music' },
  relax: { title: 'Wind Down', subtitle: 'Peaceful and calming' },
};

export const FocusModeSection: React.FC<FocusModeSectionProps> = ({
  id,
  title,
  subtitle,
  onSeeAll,
  maxItems = 8,
  focusType = 'work',
}) => {
  const { play, setQueue } = usePlayerStore();
  const { showContextMenu } = useTrackContextMenu();

  const defaultTitles = focusTitles[focusType] || focusTitles.work;
  const sectionTitle = title || defaultTitles.title;
  const sectionSubtitle = subtitle || defaultTitles.subtitle;
  const mood = focusMoodMap[focusType] || 'focus';

  // Build structured query for the unified pipeline
  // embeddingProvider will handle this with mood-based generation
  const structuredQuery = useMemo((): StructuredSectionQuery => ({
    strategy: 'plugin',
    sectionType: 'focus-mode',
    title: sectionTitle,
    subtitle: sectionSubtitle,
    embedding: {
      method: 'mood',
      mood,
      exploration: 0.3, // Lower exploration for consistent focus music
    },
    limit: maxItems,
  }), [sectionTitle, sectionSubtitle, mood, maxItems]);

  // Use unified plugin pipeline - embeddingProvider handles mood generation
  const { tracks, isLoading } = usePluginData(structuredQuery, {
    enabled: true,
    applyMLRanking: true,
    applyTransformers: true,
    limit: maxItems,
  });

  const handleTrackClick = (track: UnifiedTrack, index: number) => {
    setQueue(tracks, index);
    play(track);
  };

  if (!isLoading && tracks.length === 0) {
    return null;
  }

  return (
    <section id={id} className="discover-horizontal-section discover-focus-section">
      <div className="discover-section-header">
        <div className="discover-section-title-row">
          <h2 className="discover-section-title">{sectionTitle}</h2>
          <span className="discover-section-subtitle">{sectionSubtitle}</span>
        </div>
        {onSeeAll && (
          <button className="discover-section-more" onClick={onSeeAll}>
            See all
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="discover-horizontal-scroll">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="discover-card-skeleton" />
          ))}
        </div>
      ) : (
        <div className="discover-horizontal-scroll">
          {tracks.map((track, index) => (
            <TrackCard
              key={track.id}
              track={track}
              onClick={() => handleTrackClick(track, index)}
              onContextMenu={showContextMenu}
            />
          ))}
        </div>
      )}
    </section>
  );
};

export default FocusModeSection;
