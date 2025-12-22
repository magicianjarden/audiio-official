/**
 * ArtistRadioSection - "More like [Artist Name]" based on user's top artist
 * Uses ML ranking for intelligent track ordering
 */

import React, { useState, useEffect } from 'react';
import type { UnifiedTrack } from '@audiio/core';
import { TrackCard } from '../TrackCard';
import { usePlayerStore } from '../../../stores/player-store';
import { useTrackContextMenu } from '../../../contexts/ContextMenuContext';
import { useMLRanking } from '../../../hooks';
import type { BaseSectionProps } from '../section-registry';

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
  const [tracks, setTracks] = useState<UnifiedTrack[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [artistName, setArtistName] = useState<string>('');
  const { play, setQueue } = usePlayerStore();
  const { showContextMenu } = useTrackContextMenu();
  const { rankTracks } = useMLRanking();

  useEffect(() => {
    let mounted = true;

    const fetchArtistRadio = async () => {
      setIsLoading(true);

      // Get top artist from context
      const topArtist = context?.topArtists?.[0];
      if (!topArtist) {
        setIsLoading(false);
        return;
      }

      setArtistName(topArtist);

      try {
        let fetchedTracks: UnifiedTrack[] = [];

        // Try getRecommendedTracks API first
        if (window.api?.getRecommendedTracks) {
          const recommended = await window.api.getRecommendedTracks('artist', topArtist);
          if (recommended?.length > 0) {
            fetchedTracks = recommended;
          }
        }

        // Fallback to search
        if (fetchedTracks.length === 0 && window.api?.search) {
          const searchQuery = `${topArtist} similar music style`;
          const results = await window.api.search({ query: searchQuery, type: 'track' });
          // Filter out tracks by the same artist for variety
          fetchedTracks = (results || []).filter(track =>
            !track.artists.some(a => a.name.toLowerCase() === topArtist.toLowerCase())
          );
        }

        if (!mounted || fetchedTracks.length === 0) {
          if (mounted) setIsLoading(false);
          return;
        }

        // Apply ML ranking with balanced exploration for artist radio
        const ranked = await rankTracks(fetchedTracks, {
          enabled: true,
          explorationMode: 'balanced',
          limit: maxItems,
          shuffle: true,
          shuffleIntensity: 0.2 // Good variety for radio-style section
        });

        if (mounted) {
          setTracks(ranked.map(r => r.track));
        }
      } catch (error) {
        console.error('[ArtistRadioSection] Failed to fetch:', error);
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    fetchArtistRadio();

    return () => {
      mounted = false;
    };
  }, [context?.topArtists, maxItems, rankTracks]);

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
