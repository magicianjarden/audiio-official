/**
 * ArtistSectionDetailView - Full page view for artist-based "See All" sections
 * Uses the server's ML/trending API for real artist data
 */

import React, { useMemo } from 'react';
import { useNavigationStore } from '../../stores/navigation-store';
import { useArtistContextMenu } from '../../contexts/ContextMenuContext';
import { useTrending } from '../../hooks/useRecommendations';
import { BackIcon, MusicNoteIcon } from '@audiio/icons';

interface Artist {
  id: string;
  name: string;
  image?: string;
  source: string;
}

export const ArtistSectionDetailView: React.FC = () => {
  const { selectedSectionData, goBack, openArtist } = useNavigationStore();
  const { showContextMenu } = useArtistContextMenu();

  // Use ML-powered trending API for artist data
  const { data, isLoading } = useTrending();

  // Extract unique artists from trending data
  const artists = useMemo((): Artist[] => {
    // First use artists directly from trending if available
    if (data.artists.length > 0) {
      return data.artists.map(artist => ({
        id: artist.id,
        name: artist.name,
        image: artist.artwork?.medium || artist.artwork?.small || artist.artwork?.large,
        source: 'trending'
      }));
    }

    // Fallback: extract unique artists from tracks
    const artistMap = new Map<string, Artist>();
    for (const track of data.tracks) {
      for (const artist of track.artists) {
        if (!artistMap.has(artist.id)) {
          artistMap.set(artist.id, {
            id: artist.id,
            name: artist.name,
            image: artist.artwork?.medium || artist.artwork?.small || artist.artwork?.large,
            source: track._meta?.metadataProvider || 'trending'
          });
        }
      }
    }
    return Array.from(artistMap.values());
  }, [data.artists, data.tracks]);

  const handleArtistClick = (artist: Artist) => {
    openArtist(artist.id, {
      id: artist.id,
      name: artist.name,
      image: artist.image,
      source: artist.source
    });
  };

  if (!selectedSectionData) {
    return (
      <div className="section-detail-view">
        <div className="section-detail-empty">
          <p>Section not found</p>
          <button onClick={goBack}>Go back</button>
        </div>
      </div>
    );
  }

  return (
    <div className="section-detail-view">
      <header className="section-detail-header">
        <button className="back-btn-round" onClick={goBack} aria-label="Go back">
          <BackIcon size={20} />
        </button>
        <div className="section-detail-title-area">
          <h1 className="section-detail-title">{selectedSectionData.title}</h1>
          {selectedSectionData.subtitle && (
            <p className="section-detail-subtitle">{selectedSectionData.subtitle}</p>
          )}
        </div>
      </header>

      <div className="section-detail-content">
        {isLoading ? (
          <div className="artist-detail-grid">
            {Array.from({ length: 20 }).map((_, i) => (
              <div key={i} className="artist-card-skeleton circular" />
            ))}
          </div>
        ) : artists.length > 0 ? (
          <div className="artist-detail-grid">
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
        ) : (
          <div className="section-detail-empty">
            <p>No artists found</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ArtistSectionDetailView;
