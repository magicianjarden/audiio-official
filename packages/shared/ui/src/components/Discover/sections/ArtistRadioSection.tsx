/**
 * ArtistRadioSection - "More like [Artist Name]" based on user's top artist
 * Uses ML ranking for intelligent track ordering
 * Uses the UNIFIED plugin pipeline for data (embedding provider handles artist-radio)
 */

import React, { useMemo } from 'react';
import type { UnifiedTrack } from '@audiio/core';
import { TrackCard } from '../TrackCard';
import { usePlayerStore } from '../../../stores/player-store';
import { useTrackContextMenu } from '../../../contexts/ContextMenuContext';
import { usePluginData } from '../../../hooks/usePluginData';
import type { BaseSectionProps } from '../section-registry';
import type { StructuredSectionQuery } from '../types';

export interface ArtistRadioSectionProps extends BaseSectionProps {
  artistName?: string;
  maxItems?: number;
}

export const ArtistRadioSection: React.FC<ArtistRadioSectionProps> = ({
  id,
  title,
  subtitle,
  context,
  onSeeAll,
  maxItems = 10,
}) => {
  const { play, setQueue } = usePlayerStore();
  const { showContextMenu } = useTrackContextMenu();

  // Rotate through top artists based on current date to add variety
  // This ensures different artists are featured on different days
  const artistCount = context?.topArtists?.length || 0;
  const dayOfYear = Math.floor(Date.now() / (1000 * 60 * 60 * 24));
  const artistIndex = artistCount > 0 ? dayOfYear % artistCount : 0;

  const topArtist = context?.topArtists?.[artistIndex];
  const artistId = topArtist?.toLowerCase().replace(/\s+/g, '-');
  const artistName = topArtist || '';

  // Build structured query for the unified pipeline
  // embeddingProvider will handle this with artist-radio generation
  const structuredQuery = useMemo((): StructuredSectionQuery => ({
    strategy: 'plugin',
    sectionType: 'artist-radio',
    title: title || `More like ${artistName}`,
    subtitle: subtitle || 'Based on your listening',
    embedding: {
      method: 'artist-radio',
      seedArtistId: artistId || '',
      artistName: artistName,
      exploration: 0.3,
    },
    limit: maxItems,
  }), [title, subtitle, artistName, artistId, maxItems]);

  // Use unified plugin pipeline - embeddingProvider handles artist-radio
  const { tracks, isLoading } = usePluginData(structuredQuery, {
    enabled: !!artistId,
    applyMLRanking: true,
    applyTransformers: true,
    limit: maxItems,
  });

  const handleTrackClick = (track: UnifiedTrack, index: number) => {
    setQueue(tracks, index);
    play(track);
  };

  // Hide section if no top artist or no tracks
  if (!artistName || (!isLoading && tracks.length === 0)) {
    return null;
  }

  const sectionTitle = title || `More like ${artistName}`;
  const sectionSubtitle = subtitle || 'Based on your listening';

  return (
    <section id={id} className="discover-horizontal-section discover-artist-radio-section">
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

export default ArtistRadioSection;
