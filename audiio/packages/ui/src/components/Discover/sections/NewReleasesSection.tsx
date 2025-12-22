/**
 * NewReleasesSection - Latest album/track releases, filtered by user's genres
 */

import React, { useState, useEffect } from 'react';
import type { Album } from '@audiio/core';
import { useNavigationStore } from '../../../stores/navigation-store';
import { useAlbumContextMenu } from '../../../contexts/ContextMenuContext';
import { MusicNoteIcon } from '../../Icons/Icons';
import type { BaseSectionProps } from '../section-registry';

interface NewReleaseAlbum {
  id: string;
  title: string;
  artist: string;
  artwork?: string;
  year?: number;
  source: string;
}

export interface NewReleasesSectionProps extends BaseSectionProps {
  maxItems?: number;
}

export const NewReleasesSection: React.FC<NewReleasesSectionProps> = ({
  id,
  title,
  subtitle,
  context,
  onSeeAll,
  maxItems = 10,
}) => {
  const [albums, setAlbums] = useState<NewReleaseAlbum[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { openAlbum } = useNavigationStore();
  const { showContextMenu } = useAlbumContextMenu();

  useEffect(() => {
    let mounted = true;

    const fetchNewReleases = async () => {
      setIsLoading(true);

      try {
        if (window.api?.search) {
          // Build search query based on user's genres if available
          const topGenre = context?.topGenres?.[0];
          const searchQuery = topGenre
            ? `${topGenre} new releases 2024`
            : 'new releases 2024 popular';

          const results = await window.api.search({ query: searchQuery, type: 'album' });

          if (mounted && results?.length > 0) {
            // Map and deduplicate albums
            const albumMap = new Map<string, NewReleaseAlbum>();
            for (const item of results) {
              // Handle different response formats
              const album = item as unknown as Album & { artists?: Array<{ name: string }> };
              if (album.id && !albumMap.has(album.id)) {
                albumMap.set(album.id, {
                  id: album.id,
                  title: album.title,
                  artist: album.artists?.[0]?.name || 'Unknown Artist',
                  artwork: album.artwork?.medium || album.artwork?.small,
                  year: album.releaseDate ? parseInt(album.releaseDate.substring(0, 4)) : undefined,
                  source: 'search'
                });
              }
              if (albumMap.size >= maxItems) break;
            }
            setAlbums(Array.from(albumMap.values()));
          }
        }
      } catch (error) {
        console.error('[NewReleasesSection] Failed to fetch:', error);
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    fetchNewReleases();

    return () => {
      mounted = false;
    };
  }, [context?.topGenres, maxItems]);

  const handleAlbumClick = (album: NewReleaseAlbum) => {
    openAlbum(album.id, {
      id: album.id,
      title: album.title,
      artist: album.artist,
      artwork: album.artwork,
      year: album.year,
      source: album.source
    });
  };

  if (!isLoading && albums.length === 0) {
    return null;
  }

  return (
    <section id={id} className="discover-horizontal-section discover-new-releases-section">
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
            <div key={i} className="album-card-skeleton" />
          ))}
        </div>
      ) : (
        <div className="discover-horizontal-scroll">
          {albums.map(album => (
            <div
              key={album.id}
              className="album-card"
              onClick={() => handleAlbumClick(album)}
              onContextMenu={(e) => showContextMenu(e, {
                id: album.id,
                title: album.title,
                artist: album.artist,
                artwork: album.artwork,
                year: album.year,
                source: album.source
              })}
            >
              <div className="album-card-image">
                {album.artwork ? (
                  <img src={album.artwork} alt={album.title} />
                ) : (
                  <div className="album-card-placeholder">
                    <MusicNoteIcon size={32} />
                  </div>
                )}
                {album.year && album.year >= new Date().getFullYear() && (
                  <span className="album-new-badge">NEW</span>
                )}
              </div>
              <div className="album-card-title">{album.title}</div>
              <div className="album-card-artist">{album.artist}</div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
};

export default NewReleasesSection;
