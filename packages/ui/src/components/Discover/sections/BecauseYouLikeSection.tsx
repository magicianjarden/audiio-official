/**
 * BecauseYouLikeSection - "Because you like [Artist]" personalized recommendations
 * Uses the plugin pipeline for data fetching and ML ranking
 */

import React from 'react';
import type { UnifiedTrack } from '@audiio/core';
import { TrackCard } from '../TrackCard';
import { usePlayerStore } from '../../../stores/player-store';
import { useTrackContextMenu } from '../../../contexts/ContextMenuContext';
import { usePluginData } from '../../../hooks/usePluginData';
import type { BaseSectionProps } from '../section-registry';
import type { StructuredSectionQuery } from '../types';

export interface BecauseYouLikeSectionProps extends BaseSectionProps {
  artistIndex?: number; // Which top artist to use (0, 1, 2, etc.)
  maxItems?: number;
}

export const BecauseYouLikeSection: React.FC<BecauseYouLikeSectionProps> = ({
  id,
  title,
  context,
  onSeeAll,
  artistIndex = 0,
  maxItems = 8,
}) => {
  const { play, setQueue } = usePlayerStore();
  const { showContextMenu } = useTrackContextMenu();

  // Get target artist from context with rotation for variety
  // Rotate through top artists based on current date + artistIndex offset
  const artistCount = context?.topArtists?.length || 0;
  const dayOfYear = Math.floor(Date.now() / (1000 * 60 * 60 * 24));
  const rotatedIndex = artistCount > 0 ? (dayOfYear + artistIndex) % artistCount : artistIndex;

  const targetArtist = context?.topArtists?.[rotatedIndex];
  const artistId = targetArtist?.toLowerCase().replace(/\s+/g, '-');
  const artistName = targetArtist || '';

  // Build structured query for plugin pipeline
  const structuredQuery: StructuredSectionQuery | null = artistId
    ? {
        strategy: 'plugin',
        sectionType: 'because-you-like',
        title: title || `Because you like ${artistName}`,
        embedding: {
          method: 'artist-radio',
          seedArtistId: artistId,
          artistName: artistName,
          exploration: 0.3,
          includeCollaborative: true,
        },
        limit: maxItems,
      }
    : null;

  // Use plugin pipeline for data fetching
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

  // Hide section if no artist or no tracks
  if (!artistName || (!isLoading && tracks.length === 0)) {
    return null;
  }

  const sectionTitle = title || `Because you like ${artistName}`;

  return (
    <section id={id} className="discover-horizontal-section discover-because-you-like-section">
      <div className="discover-section-header">
        <div className="discover-section-title-row">
          <h2 className="discover-section-title">{sectionTitle}</h2>
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

export default BecauseYouLikeSection;
