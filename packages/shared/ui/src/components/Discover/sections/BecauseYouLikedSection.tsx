/**
 * BecauseYouLikedSection - Seed-based recommendations
 * Shows tracks similar to a specific track the user has liked.
 * Uses the ML similar tracks API for recommendations.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { usePlayerStore } from '../../../stores/player-store';
import { useLibraryStore } from '../../../stores/library-store';
import { useTrackContextMenu } from '../../../contexts/ContextMenuContext';
import { useSimilarTracks } from '../../../hooks/useRecommendations';
import { TrackCard } from '../TrackCard';
import { PlayIcon, ChevronRightIcon } from '@audiio/icons';

export interface BecauseYouLikedSectionProps {
  id: string;
  title?: string;
  subtitle?: string;
  seedTrackId?: string;
  maxItems?: number;
  onSeeAll?: () => void;
}

export const BecauseYouLikedSection: React.FC<BecauseYouLikedSectionProps> = ({
  id,
  maxItems = 6,
  onSeeAll,
}) => {
  const { play, setQueue } = usePlayerStore();
  const { likedTracks } = useLibraryStore();
  const { showContextMenu } = useTrackContextMenu();
  const [isVisible, setIsVisible] = useState(false);

  // Pick a random liked track as seed
  const seedTrack = useMemo(() => {
    if (likedTracks.length === 0) return null;
    const recentLiked = likedTracks.slice(0, 10);
    const randomIndex = Math.floor(Math.random() * recentLiked.length);
    return recentLiked[randomIndex]?.track;
  }, [likedTracks]);

  // Use the ML similar tracks API directly
  const { data: rawTracks, isLoading } = useSimilarTracks(seedTrack?.id || null, maxItems + 1);

  // Filter out the seed track
  const tracks = useMemo(() => {
    if (!seedTrack) return rawTracks.slice(0, maxItems);
    return rawTracks.filter(t => t.id !== seedTrack.id).slice(0, maxItems);
  }, [rawTracks, seedTrack, maxItems]);

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 100);
    return () => clearTimeout(timer);
  }, []);

  const handlePlayTrack = (index: number) => {
    setQueue(tracks, index);
    play(tracks[index]!);
  };

  const handlePlayAll = () => {
    if (tracks.length > 0) {
      setQueue(tracks, 0);
      play(tracks[0]!);
    }
  };

  if (!seedTrack || (!isLoading && tracks.length === 0)) {
    return null;
  }

  return (
    <section
      id={id}
      className={`discover-section ${isVisible ? 'is-visible' : ''}`}
      style={{ animationDelay: '100ms' }}
    >
      <div className="discover-section-header">
        <div className="discover-section-title-row">
          <h2 className="discover-section-title">Because you liked</h2>
          <span className="discover-section-subtitle">{seedTrack.title}</span>
        </div>
        <div className="discover-section-actions">
          <button className="pill-btn pill-btn--sm" onClick={handlePlayAll}>
            <PlayIcon size={14} />
            <span>Play all</span>
          </button>
          {onSeeAll && (
            <button className="discover-section-more" onClick={onSeeAll}>
              See all <ChevronRightIcon size={16} />
            </button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="discover-section-grid">
          {Array.from({ length: maxItems }).map((_, i) => (
            <div key={i} className="track-card skeleton" style={{ animationDelay: `${i * 50}ms` }} />
          ))}
        </div>
      ) : (
        <div className="discover-section-grid">
          {tracks.map((track, index) => (
            <TrackCard
              key={track.id}
              track={track}
              onClick={() => handlePlayTrack(index)}
              onContextMenu={showContextMenu}
              style={{ animationDelay: `${index * 50}ms` }}
            />
          ))}
        </div>
      )}
    </section>
  );
};

export default BecauseYouLikedSection;
