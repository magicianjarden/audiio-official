/**
 * TrendingArtistsSection - Circular artist cards showing popular artists
 */

import React, { useState, useEffect } from 'react';
import { useNavigationStore } from '../../../stores/navigation-store';
import { useArtistContextMenu } from '../../../contexts/ContextMenuContext';
import { MusicNoteIcon } from '@audiio/icons';
import type { BaseSectionProps } from '../section-registry';
import { debugError } from '../../../utils/debug';

interface TrendingArtist {
  id: string;
  name: string;
  image?: string;
  source: string;
}

export interface TrendingArtistsSectionProps extends BaseSectionProps {
  maxItems?: number;
}

export const TrendingArtistsSection: React.FC<TrendingArtistsSectionProps> = ({
  id,
  title,
  subtitle,
  onSeeAll,
  maxItems = 10,
}) => {
  const [artists, setArtists] = useState<TrendingArtist[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { openArtist } = useNavigationStore();
  const { showContextMenu } = useArtistContextMenu();

  useEffect(() => {
    let mounted = true;

    const fetchTrendingArtists = async () => {
      setIsLoading(true);
      try {
        // Try getTrending API first
        if (window.api?.getTrending) {
          const trending = await window.api.getTrending();
          if (mounted && trending?.artists?.length > 0) {
            const mappedArtists = trending.artists.slice(0, maxItems).map(a => ({
              id: a.id,
              name: a.name,
              image: a.artwork?.medium || a.artwork?.small,
              source: 'trending'
            }));
            setArtists(mappedArtists);
            setIsLoading(false);
            return;
          }
        }

        // Fallback: Extract artists from trending tracks
        if (window.api?.search) {
          const results = await window.api.search({ query: 'top hits 2024 popular', type: 'track' });
          if (mounted && results?.length > 0) {
            // Extract unique artists from tracks
            const artistMap = new Map<string, TrendingArtist>();
            for (const track of results) {
              for (const artist of track.artists) {
                if (!artistMap.has(artist.id)) {
                  artistMap.set(artist.id, {
                    id: artist.id,
                    name: artist.name,
                    image: artist.artwork?.medium || artist.artwork?.small,
                    source: track._meta?.metadataProvider || 'search'
                  });
                }
                if (artistMap.size >= maxItems) break;
              }
              if (artistMap.size >= maxItems) break;
            }
            setArtists(Array.from(artistMap.values()));
          }
        }
      } catch (error) {
        debugError('[TrendingArtistsSection]', 'Failed to fetch:', error);
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    fetchTrendingArtists();

    return () => {
      mounted = false;
    };
  }, [maxItems]);

  const handleArtistClick = (artist: TrendingArtist) => {
    openArtist(artist.id, {
      id: artist.id,
      name: artist.name,
      image: artist.image,
      source: artist.source
    });
  };

  if (!isLoading && artists.length === 0) {
    return null;
  }

  return (
    <section id={id} className="discover-horizontal-section discover-trending-artists-section">
      <div className="discover-section-header">
        <div className="discover-section-title-row">
          <h2 className="discover-section-title">{title}</h2>
          {subtitle && <span className="discover-section-subtitle">{subtitle}</span>}
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
            <div key={i} className="artist-card-skeleton circular" />
          ))}
        </div>
      ) : (
        <div className="discover-horizontal-scroll">
          {artists.map(artist => (
            <div
              key={artist.id}
              className="artist-card circular"
              onClick={() => handleArtistClick(artist)}
              onContextMenu={(e) => showContextMenu(e, {
                id: artist.id,
                name: artist.name,
                image: artist.image,
                source: artist.source
              })}
            >
              <div className="artist-card-image">
                {artist.image ? (
                  <img src={artist.image} alt={artist.name} />
                ) : (
                  <div className="artist-card-placeholder">
                    <MusicNoteIcon size={32} />
                  </div>
                )}
              </div>
              <div className="artist-card-name">{artist.name}</div>
              <div className="artist-card-type">Artist</div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
};

export default TrendingArtistsSection;
