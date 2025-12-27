/**
 * TopList - Ranked list of top artists or genres
 */

import React from 'react';
import type { ArtistStats, GenreStats } from '../../stores/stats-store';
import { formatDuration } from '../../stores/stats-store';
import { MusicNoteIcon } from '@audiio/icons';

interface TopArtistsListProps {
  artists: ArtistStats[];
  onArtistClick?: (artistId: string) => void;
}

export const TopArtistsList: React.FC<TopArtistsListProps> = ({
  artists,
  onArtistClick,
}) => {
  if (artists.length === 0) {
    return (
      <div className="top-list-empty">
        <p>No listening data yet</p>
      </div>
    );
  }

  const maxPlays = artists[0]?.playCount || 1;

  return (
    <div className="top-list">
      {artists.map((artist, index) => (
        <div
          key={artist.artistId}
          className="top-list-item"
          onClick={() => onArtistClick?.(artist.artistId)}
        >
          <span className="top-list-rank">{index + 1}</span>
          <div className="top-list-artwork">
            {artist.artwork ? (
              <img src={artist.artwork} alt={artist.artistName} />
            ) : (
              <div className="top-list-artwork-placeholder">
                <MusicNoteIcon size={20} />
              </div>
            )}
          </div>
          <div className="top-list-info">
            <span className="top-list-name">{artist.artistName}</span>
            <span className="top-list-meta">
              {artist.playCount} plays &bull; {formatDuration(artist.totalDuration)}
            </span>
          </div>
          <div className="top-list-bar-container">
            <div
              className="top-list-bar"
              style={{ width: `${(artist.playCount / maxPlays) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
};

interface TopGenresListProps {
  genres: GenreStats[];
}

export const TopGenresList: React.FC<TopGenresListProps> = ({ genres }) => {
  if (genres.length === 0) {
    return (
      <div className="top-list-empty">
        <p>No listening data yet</p>
      </div>
    );
  }

  const maxPlays = genres[0]?.playCount || 1;

  return (
    <div className="top-list genres">
      {genres.map((genre, index) => (
        <div key={genre.genre} className="top-list-item genre-item">
          <span className="top-list-rank">{index + 1}</span>
          <div className="top-list-info">
            <span className="top-list-name">{genre.genre}</span>
            <span className="top-list-meta">
              {genre.playCount} plays
            </span>
          </div>
          <div className="top-list-bar-container">
            <div
              className="top-list-bar"
              style={{ width: `${(genre.playCount / maxPlays) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
};
