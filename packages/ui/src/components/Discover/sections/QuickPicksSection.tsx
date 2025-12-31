/**
 * QuickPicksSection - Small tile grid for quick access
 * Similar to Spotify's "Good morning" tiles - shows recently played or recommended
 * Uses the UNIFIED plugin pipeline for data (embedding provider handles personalization)
 */

import React, { useMemo } from 'react';
import type { UnifiedTrack } from '@audiio/core';
import { usePlayerStore } from '../../../stores/player-store';
import { useTrackContextMenu } from '../../../contexts/ContextMenuContext';
import { usePluginData } from '../../../hooks/usePluginData';
import { MusicNoteIcon } from '@audiio/icons';
import type { BaseSectionProps } from '../section-registry';
import type { StructuredSectionQuery } from '../types';

export interface QuickPicksSectionProps extends BaseSectionProps {
  maxItems?: number;
}

export const QuickPicksSection: React.FC<QuickPicksSectionProps> = ({
  id,
  title,
  context,
  maxItems = 6,
}) => {
  const { play, setQueue, currentTrack, isPlaying } = usePlayerStore();
  const { showContextMenu } = useTrackContextMenu();

  // Build structured query for the unified pipeline
  // embeddingProvider will handle this with personalized ML generation
  const structuredQuery = useMemo((): StructuredSectionQuery => ({
    strategy: 'plugin',
    sectionType: 'quick-picks',
    title: title || 'Quick Picks',
    embedding: {
      method: 'personalized',
      exploration: 0.1, // Low exploration for familiar picks
    },
    limit: maxItems,
  }), [title, maxItems]);

  // Use unified plugin pipeline - embeddingProvider handles personalization
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

  // Don't return null - let parent handle if no content
  const showEmptyState = !isLoading && tracks.length === 0;
  if (showEmptyState) {
    return null; // QuickPicks should be hidden if empty since it has no title
  }

  return (
    <section id={id} className="quick-picks-section">
      {title && (
        <div className="discover-section-header">
          <h2 className="discover-section-title">{title}</h2>
        </div>
      )}

      {isLoading ? (
        <div className="quick-picks-grid">
          {Array.from({ length: maxItems }).map((_, i) => (
            <div key={i} className="quick-pick-skeleton" />
          ))}
        </div>
      ) : (
        <div className="quick-picks-grid">
          {tracks.map((track, index) => {
            const isCurrentTrack = currentTrack?.id === track.id;
            const isCurrentlyPlaying = isCurrentTrack && isPlaying;
            const artworkUrl = track.artwork?.small || track.album?.artwork?.small;

            return (
              <div
                key={track.id}
                className={`quick-pick-tile ${isCurrentTrack ? 'playing' : ''}`}
                onClick={() => handleTrackClick(track, index)}
                onContextMenu={(e) => showContextMenu(e, track)}
              >
                <div className="quick-pick-artwork">
                  {artworkUrl ? (
                    <img src={artworkUrl} alt={track.title} loading="lazy" />
                  ) : (
                    <div className="quick-pick-artwork-placeholder">
                      <MusicNoteIcon size={20} />
                    </div>
                  )}
                  {isCurrentlyPlaying && (
                    <div className="quick-pick-playing">
                      <span className="bar" />
                      <span className="bar" />
                      <span className="bar" />
                    </div>
                  )}
                </div>

                <div className="quick-pick-info">
                  <span className="quick-pick-title">{track.title}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};

export default QuickPicksSection;
