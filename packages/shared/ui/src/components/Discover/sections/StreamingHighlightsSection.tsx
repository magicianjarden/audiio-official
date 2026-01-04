/**
 * StreamingHighlightsSection - Shows content from available streaming providers
 * Dynamically adapts to whatever stream-provider plugins are installed
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

export interface StreamingHighlightsSectionProps extends BaseSectionProps {
  maxItems?: number;
}

export const StreamingHighlightsSection: React.FC<StreamingHighlightsSectionProps> = ({
  id,
  title,
  subtitle,
  onSeeAll,
  maxItems = 10,
}) => {
  const { play, setQueue } = usePlayerStore();
  const { showContextMenu } = useTrackContextMenu();
  const { hasCapability, getPluginsByRole } = usePluginStore();

  // Check for streaming providers
  const hasStreamProvider = hasCapability('stream-provider');
  const streamPlugins = getPluginsByRole('stream-provider');
  const enabledStreamPlugins = streamPlugins.filter(p => p.enabled);

  // Build dynamic title based on available providers
  const providerNames = enabledStreamPlugins.map(p => p.name).join(', ');
  const sectionTitle = title || 'Streaming Picks';
  const sectionSubtitle = subtitle || (providerNames ? `From ${providerNames}` : 'From your streaming services');

  // Build structured query for the unified pipeline
  // embeddingProvider will handle this with personalized generation
  const structuredQuery = useMemo((): StructuredSectionQuery => ({
    strategy: 'plugin',
    sectionType: 'streaming-highlights',
    title: sectionTitle,
    subtitle: sectionSubtitle,
    embedding: {
      method: 'personalized',
      exploration: 0.4,
    },
    limit: maxItems,
  }), [sectionTitle, sectionSubtitle, maxItems]);

  // Use unified plugin pipeline - embeddingProvider handles personalization
  const { tracks, isLoading } = usePluginData(structuredQuery, {
    enabled: hasStreamProvider,
    applyMLRanking: true,
    applyTransformers: true,
    limit: maxItems,
  });

  const handleTrackClick = (track: UnifiedTrack, index: number) => {
    setQueue(tracks, index);
    play(track);
  };

  // Only show if we have streaming capability
  if (!hasStreamProvider || (!isLoading && tracks.length === 0)) {
    return null;
  }

  return (
    <section id={id} className="discover-horizontal-section discover-streaming-section">
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
          {[1, 2, 3, 4, 5, 6].map(i => (
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

export default StreamingHighlightsSection;
