/**
 * FocusModeSection - ML-powered focus/productivity music
 * Uses mood embeddings to find instrumental, ambient, and focus-friendly tracks
 */

import React, { useMemo } from 'react';
import type { UnifiedTrack } from '@audiio/core';
import { TrackCard } from '../TrackCard';
import { usePlayerStore } from '../../../stores/player-store';
import { useTrackContextMenu } from '../../../contexts/ContextMenuContext';
import { useEmbeddingPlaylist } from '../../../hooks/useEmbeddingPlaylist';
import type { BaseSectionProps } from '../section-registry';

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

  const {
    generateMoodPlaylist,
    getTracksFromPlaylist,
    isReady: embeddingReady,
    tracksIndexed,
  } = useEmbeddingPlaylist();

  // Generate focus tracks using mood embeddings
  const tracks = useMemo(() => {
    if (!embeddingReady || tracksIndexed < 1) {
      return [];
    }

    const mood = focusMoodMap[focusType] || 'focus';
    const playlist = generateMoodPlaylist(mood, {
      limit: maxItems,
      exploration: 0.3, // Lower exploration for consistent focus music
    });

    if (!playlist || playlist.tracks.length === 0) {
      return [];
    }

    return getTracksFromPlaylist(playlist);
  }, [embeddingReady, tracksIndexed, maxItems, focusType, generateMoodPlaylist, getTracksFromPlaylist]);

  const handleTrackClick = (track: UnifiedTrack, index: number) => {
    setQueue(tracks, index);
    play(track);
  };

  const isLoading = !embeddingReady;

  if (!isLoading && tracks.length === 0) {
    return null;
  }

  const defaultTitles = focusTitles[focusType] || focusTitles.work;
  const sectionTitle = title || defaultTitles.title;
  const sectionSubtitle = subtitle || defaultTitles.subtitle;

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
