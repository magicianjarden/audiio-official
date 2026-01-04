/**
 * LyricsHighlightSection - Shows tracks with notable lyrics
 * Dynamically uses any available lyrics-provider plugin
 * Uses the UNIFIED plugin pipeline for data (embedding provider handles personalization)
 */

import React, { useMemo } from 'react';
import type { UnifiedTrack } from '@audiio/core';
import { TrackCard } from '../TrackCard';
import { usePlayerStore } from '../../../stores/player-store';
import { useTrackContextMenu } from '../../../contexts/ContextMenuContext';
import { usePluginStore } from '../../../stores/plugin-store';
import { usePluginData } from '../../../hooks/usePluginData';
import type { BaseSectionProps } from '../section-registry';
import type { StructuredSectionQuery } from '../types';

export interface LyricsHighlightSectionProps extends BaseSectionProps {
  maxItems?: number;
}

export const LyricsHighlightSection: React.FC<LyricsHighlightSectionProps> = ({
  id,
  title = 'Lyrical Gems',
  subtitle,
  onSeeAll,
  maxItems = 8,
}) => {
  const { play, setQueue } = usePlayerStore();
  const { showContextMenu } = useTrackContextMenu();
  const { hasCapability, getPluginsByRole } = usePluginStore();

  // Check if any lyrics provider is available
  const hasLyricsProvider = hasCapability('lyrics-provider');
  const lyricsPlugins = getPluginsByRole('lyrics-provider');

  const sectionTitle = title;
  const sectionSubtitle = subtitle || `Powered by ${lyricsPlugins[0]?.name || 'lyrics provider'}`;

  // Build structured query for the unified pipeline
  // embeddingProvider will handle this with personalized generation
  const structuredQuery = useMemo((): StructuredSectionQuery => ({
    strategy: 'plugin',
    sectionType: 'lyrics-highlight',
    title: sectionTitle,
    subtitle: sectionSubtitle,
    embedding: {
      method: 'personalized',
      exploration: 0.25,
    },
    limit: maxItems,
  }), [sectionTitle, sectionSubtitle, maxItems]);

  // Use unified plugin pipeline - embeddingProvider handles personalization
  const { tracks, isLoading } = usePluginData(structuredQuery, {
    enabled: hasLyricsProvider,
    applyMLRanking: true,
    applyTransformers: true,
    limit: maxItems,
  });

  const handleTrackClick = (track: UnifiedTrack, index: number) => {
    setQueue(tracks, index);
    play(track);
  };

  // Hide if no lyrics capability or no tracks
  if (!hasLyricsProvider || (!isLoading && tracks.length === 0)) {
    return null;
  }

  return (
    <section id={id} className="discover-horizontal-section discover-lyrics-section">
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
    </section>
  );
};

export default LyricsHighlightSection;
