/**
 * HorizontalSection - Scrollable row of cards
 */

import React from 'react';
import type { UnifiedTrack } from '@audiio/core';
import type { SearchArtist, SearchAlbum } from '../../../stores/search-store';
import { TrackCard } from '../TrackCard';
import { useNavigationStore } from '../../../stores/navigation-store';
import { usePlayerStore } from '../../../stores/player-store';
import { useTrackContextMenu, useArtistContextMenu, useAlbumContextMenu } from '../../../contexts/ContextMenuContext';
import { MusicNoteIcon } from '@audiio/icons';

export interface HorizontalSectionProps {
  id: string;
  title: string;
  subtitle?: string;
  tracks?: UnifiedTrack[];
  artists?: SearchArtist[];
  albums?: SearchAlbum[];
  isLoading?: boolean;
  onSeeAll?: () => void;
}

export const HorizontalSection: React.FC<HorizontalSectionProps> = ({
  title,
  subtitle,
  tracks,
  artists,
  albums,
  isLoading,
  onSeeAll,
}) => {
  const { play, setQueue } = usePlayerStore();
  const { openArtist, openAlbum } = useNavigationStore();
  const { showContextMenu: showTrackMenu } = useTrackContextMenu();
  const { showContextMenu: showArtistMenu } = useArtistContextMenu();
  const { showContextMenu: showAlbumMenu } = useAlbumContextMenu();

  const handleTrackClick = (track: UnifiedTrack, index: number) => {
    if (tracks) {
      setQueue(tracks, index);
      play(track);
    }
  };

  const handleArtistClick = (artist: SearchArtist) => {
    openArtist(artist.id, artist);
  };

  const handleAlbumClick = (album: SearchAlbum) => {
    openAlbum(album.id, album);
  };

  const hasContent = (tracks && tracks.length > 0) ||
                     (artists && artists.length > 0) ||
                     (albums && albums.length > 0);

  if (!isLoading && !hasContent) {
    return null;
  }

  return (
    <section className="discover-horizontal-section">
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
            <div key={i} className="discover-card-skeleton" />
          ))}
        </div>
      ) : (
        <div className="discover-horizontal-scroll">
          {/* Render tracks */}
          {tracks?.map((track, index) => (
            <TrackCard
              key={track.id}
              track={track}
              onClick={() => handleTrackClick(track, index)}
              onContextMenu={showTrackMenu}
            />
          ))}

          {/* Render artists */}
          {artists?.map(artist => (
            <div
              key={artist.id}
              className="artist-card"
              onClick={() => handleArtistClick(artist)}
              onContextMenu={(e) => showArtistMenu(e, artist)}
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

          {/* Render albums */}
          {albums?.map(album => (
            <div
              key={album.id}
              className="album-card"
              onClick={() => handleAlbumClick(album)}
              onContextMenu={(e) => showAlbumMenu(e, album)}
            >
              <div className="album-card-image">
                {album.artwork ? (
                  <img src={album.artwork} alt={album.title} />
                ) : (
                  <div className="album-card-placeholder">
                    <MusicNoteIcon size={32} />
                  </div>
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

export default HorizontalSection;
