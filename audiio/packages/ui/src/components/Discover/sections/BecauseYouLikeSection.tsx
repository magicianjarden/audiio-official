/**
 * BecauseYouLikeSection - "Because you like [Artist]" personalized recommendations
 * Can have multiple instances, each based on a different top artist
 * Uses ML ranking for intelligent track ordering
 */

import React, { useState, useEffect } from 'react';
import type { UnifiedTrack } from '@audiio/core';
import { TrackCard } from '../TrackCard';
import { usePlayerStore } from '../../../stores/player-store';
import { useTrackContextMenu } from '../../../contexts/ContextMenuContext';
import { useMLRanking } from '../../../hooks';
import type { BaseSectionProps } from '../section-registry';

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
  const [tracks, setTracks] = useState<UnifiedTrack[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [artistName, setArtistName] = useState<string>('');
  const { play, setQueue } = usePlayerStore();
  const { showContextMenu } = useTrackContextMenu();
  const { rankTracks } = useMLRanking();

  useEffect(() => {
    let mounted = true;

    const fetchRecommendations = async () => {
      setIsLoading(true);

      // Get artist at specified index from context
      const targetArtist = context?.topArtists?.[artistIndex];
      if (!targetArtist) {
        setIsLoading(false);
        return;
      }

      setArtistName(targetArtist);

      try {
        let fetchedTracks: UnifiedTrack[] = [];

        // Try getRecommendedTracks API first
        if (window.api?.getRecommendedTracks) {
          const recommended = await window.api.getRecommendedTracks('artist', targetArtist);
          if (recommended?.length > 0) {
            fetchedTracks = recommended;
          }
        }

        // Fallback to search
        if (fetchedTracks.length === 0 && window.api?.search) {
          const searchQuery = `${targetArtist} fans also like similar`;
          const results = await window.api.search({ query: searchQuery, type: 'track' });
          fetchedTracks = results || [];
        }

        if (!mounted || fetchedTracks.length === 0) {
          if (mounted) setIsLoading(false);
          return;
        }

        // Apply ML ranking with serendipity for personalized discovery
        const ranked = await rankTracks(fetchedTracks, {
          enabled: true,
          explorationMode: 'balanced',
          limit: maxItems,
          shuffle: true,
          shuffleIntensity: 0.2 // More variety for discovery
        });

        setTracks(ranked.map(r => r.track));
      } catch (error) {
        console.error('[BecauseYouLikeSection] Failed to fetch:', error);
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    fetchRecommendations();

    return () => {
      mounted = false;
    };
  }, [context?.topArtists, artistIndex, maxItems, rankTracks]);

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
          <span className="discover-section-personalized-tag">For You</span>
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
