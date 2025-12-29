/**
 * SimilarTracksSection - ML-powered similar track recommendations
 * Uses embedding similarity to find tracks like your recent plays
 */

import React, { useMemo } from 'react';
import type { UnifiedTrack } from '@audiio/core';
import { TrackCard } from '../TrackCard';
import { usePlayerStore } from '../../../stores/player-store';
import { useTrackContextMenu } from '../../../contexts/ContextMenuContext';
import { useRecommendationStore } from '../../../stores/recommendation-store';
import { useEmbeddingPlaylist } from '../../../hooks/useEmbeddingPlaylist';
import type { BaseSectionProps } from '../section-registry';

export interface SimilarTracksSectionProps extends BaseSectionProps {
  maxItems?: number;
}

export const SimilarTracksSection: React.FC<SimilarTracksSectionProps> = ({
  id,
  title,
  subtitle,
  onSeeAll,
  maxItems = 8,
}) => {
  const { play, setQueue, currentTrack, playHistory } = usePlayerStore();
  const { showContextMenu } = useTrackContextMenu();
  const { getRecentTracks } = useRecommendationStore();

  const {
    findSimilarTracks,
    getTracksFromPlaylist,
    isReady: embeddingReady,
    tracksIndexed,
  } = useEmbeddingPlaylist();

  // Get a seed track from recent plays or current track
  const seedTrack = useMemo(() => {
    if (currentTrack) return currentTrack;
    const recent = getRecentTracks(5);
    if (recent.length > 0) {
      // Pick a random recent track as seed
      return recent[Math.floor(Math.random() * recent.length)];
    }
    // Fallback to play history
    if (playHistory.length > 0) {
      return playHistory[Math.floor(Math.random() * Math.min(5, playHistory.length))];
    }
    return null;
  }, [currentTrack, getRecentTracks, playHistory]);

  // Find similar tracks
  const tracks = useMemo(() => {
    if (!embeddingReady || tracksIndexed < 1 || !seedTrack) {
      return [];
    }

    const similar = findSimilarTracks(seedTrack.id, maxItems + 1);
    if (!similar || similar.length === 0) {
      return [];
    }

    // Convert to UnifiedTrack format and exclude seed
    return getTracksFromPlaylist({ tracks: similar, metadata: {} })
      .filter(t => t.id !== seedTrack.id)
      .slice(0, maxItems);
  }, [embeddingReady, tracksIndexed, seedTrack, maxItems, findSimilarTracks, getTracksFromPlaylist]);

  const handleTrackClick = (track: UnifiedTrack, index: number) => {
    setQueue(tracks, index);
    play(track);
  };

  const isLoading = !embeddingReady;

  if (!seedTrack || (!isLoading && tracks.length === 0)) {
    return null;
  }

  const sectionTitle = title || `More like "${seedTrack.title}"`;
  const sectionSubtitle = subtitle || `Similar to ${seedTrack.artists?.[0]?.name || 'your recent plays'}`;

  return (
    <section id={id} className="discover-horizontal-section discover-similar-tracks-section">
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

export default SimilarTracksSection;
