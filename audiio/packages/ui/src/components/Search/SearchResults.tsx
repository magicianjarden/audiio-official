import React from 'react';
import { useSearchStore, type SearchArtist, type SearchAlbum } from '../../stores/search-store';
import { usePlayerStore } from '../../stores/player-store';
import { useNavigationStore } from '../../stores/navigation-store';
import { useTrackContextMenu, useArtistContextMenu, useAlbumContextMenu } from '../../contexts/ContextMenuContext';
import { TrackRow } from '../TrackRow/TrackRow';
import { MusicNoteIcon, PlayIcon, ChevronRightIcon } from '../Icons/Icons';
import type { UnifiedTrack } from '@audiio/core';

interface ArtistCardProps {
  artist: SearchArtist;
  onClick?: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
}

const ArtistCard: React.FC<ArtistCardProps> = ({ artist, onClick, onContextMenu }) => (
  <div className="artist-card" onClick={onClick} onContextMenu={onContextMenu}>
    <div className="artist-card-image">
      {artist.image ? (
        <img src={artist.image} alt={artist.name} />
      ) : (
        <div className="artist-card-placeholder">
          <MusicNoteIcon size={32} />
        </div>
      )}
    </div>
    <div className="artist-card-info">
      <span className="artist-card-name">{artist.name}</span>
      <span className="artist-card-type">Artist</span>
    </div>
  </div>
);

interface AlbumCardProps {
  album: SearchAlbum;
  onClick?: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
}

const AlbumCard: React.FC<AlbumCardProps> = ({ album, onClick, onContextMenu }) => (
  <div className="album-card" onClick={onClick} onContextMenu={onContextMenu}>
    <div className="album-card-image">
      {album.artwork ? (
        <img src={album.artwork} alt={album.title} />
      ) : (
        <div className="album-card-placeholder">
          <MusicNoteIcon size={32} />
        </div>
      )}
      <div className="album-card-play">
        <PlayIcon size={24} />
      </div>
    </div>
    <div className="album-card-info">
      <span className="album-card-title">{album.title}</span>
      <span className="album-card-artist">{album.artist}</span>
      {album.year && <span className="album-card-year">{album.year}</span>}
    </div>
  </div>
);

export const SearchResults: React.FC = () => {
  const { results, isSearching, error, query, activeFilter, setActiveFilter } = useSearchStore();
  const { play, setQueue, currentTrack } = usePlayerStore();
  const { openArtist, openAlbum } = useNavigationStore();
  const { showContextMenu: showTrackContextMenu } = useTrackContextMenu();
  const { showContextMenu: showArtistContextMenu } = useArtistContextMenu();
  const { showContextMenu: showAlbumContextMenu } = useAlbumContextMenu();

  const handleTrackClick = async (track: UnifiedTrack, index: number) => {
    setQueue(results.tracks, index);
    await play(track);
  };

  const handleArtistClick = (artist: SearchArtist) => {
    openArtist(artist.id, artist);
  };

  const handleAlbumClick = (album: SearchAlbum) => {
    openAlbum(album.id, album);
  };

  const filters = [
    { id: 'all', label: 'All' },
    { id: 'tracks', label: 'Songs' },
    { id: 'artists', label: 'Artists' },
    { id: 'albums', label: 'Albums' }
  ] as const;

  const hasResults = results.tracks.length > 0 || results.artists.length > 0 || results.albums.length > 0;
  const topResult = results.tracks[0] || null;

  if (isSearching) {
    return (
      <div className="search-results">
        <div className="search-results-loading">
          <div className="search-loading-spinner" />
          <span>Searching...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="search-results">
        <div className="search-results-error">{error}</div>
      </div>
    );
  }

  if (!query) {
    return (
      <div className="search-results">
        <div className="search-results-empty">
          Search for tracks, artists, or albums
        </div>
      </div>
    );
  }

  if (!hasResults) {
    return (
      <div className="search-results">
        <div className="search-results-empty">
          No results found for "{query}"
        </div>
      </div>
    );
  }

  return (
    <div className="search-results">
      {/* Filter Tabs */}
      <div className="search-filters">
        {filters.map(filter => (
          <button
            key={filter.id}
            className={`search-filter-btn ${activeFilter === filter.id ? 'active' : ''}`}
            onClick={() => setActiveFilter(filter.id)}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {/* All Results View */}
      {activeFilter === 'all' && (
        <div className="search-results-all">
          {/* Top Result + Songs Row */}
          <div className="search-top-section">
            {/* Top Result */}
            {topResult && (
              <div className="search-top-result">
                <h3 className="search-section-title">Top Result</h3>
                <div className="top-result-card" onClick={() => handleTrackClick(topResult, 0)}>
                  <div className="top-result-image">
                    {topResult.artwork?.medium ? (
                      <img src={topResult.artwork.medium} alt={topResult.title} />
                    ) : (
                      <div className="top-result-placeholder">
                        <MusicNoteIcon size={48} />
                      </div>
                    )}
                  </div>
                  <div className="top-result-info">
                    <span className="top-result-title">{topResult.title}</span>
                    <div className="top-result-meta">
                      <span className="top-result-artist">
                        {topResult.artists.map(a => a.name).join(', ')}
                      </span>
                      <span className="top-result-type">Song</span>
                    </div>
                  </div>
                  <button className="top-result-play">
                    <PlayIcon size={24} />
                  </button>
                </div>
              </div>
            )}

            {/* Songs Preview */}
            {results.tracks.length > 0 && (
              <div className="search-songs-preview">
                <h3 className="search-section-title">Songs</h3>
                <div className="search-songs-list">
                  {results.tracks.slice(0, 4).map((track, index) => (
                    <div
                      key={track.id}
                      className={`search-song-row ${currentTrack?.id === track.id ? 'playing' : ''}`}
                      onClick={() => handleTrackClick(track, index)}
                      onContextMenu={(e) => showTrackContextMenu(e, track)}
                    >
                      <div className="search-song-image">
                        {track.artwork?.small ? (
                          <img src={track.artwork.small} alt={track.title} />
                        ) : (
                          <MusicNoteIcon size={16} />
                        )}
                      </div>
                      <div className="search-song-info">
                        <span className="search-song-title">{track.title}</span>
                        <span className="search-song-artist">
                          {track.artists.map(a => a.name).join(', ')}
                        </span>
                      </div>
                      <span className="search-song-duration">
                        {formatDuration(track.duration)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Artists Section - Horizontal Scroll */}
          {results.artists.length > 0 && (
            <div className="search-section">
              <div className="search-section-header">
                <h3 className="search-section-title">Artists</h3>
                {results.artists.length > 6 && (
                  <button className="search-see-all" onClick={() => setActiveFilter('artists')}>
                    See All <ChevronRightIcon size={14} />
                  </button>
                )}
              </div>
              <div className="search-horizontal-scroll">
                {results.artists.map(artist => (
                  <ArtistCard
                    key={artist.id}
                    artist={artist}
                    onClick={() => handleArtistClick(artist)}
                    onContextMenu={(e) => showArtistContextMenu(e, artist)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Albums Section - Horizontal Scroll */}
          {results.albums.length > 0 && (
            <div className="search-section">
              <div className="search-section-header">
                <h3 className="search-section-title">Albums</h3>
                {results.albums.length > 6 && (
                  <button className="search-see-all" onClick={() => setActiveFilter('albums')}>
                    See All <ChevronRightIcon size={14} />
                  </button>
                )}
              </div>
              <div className="search-horizontal-scroll">
                {results.albums.map(album => (
                  <AlbumCard
                    key={album.id}
                    album={album}
                    onClick={() => handleAlbumClick(album)}
                    onContextMenu={(e) => showAlbumContextMenu(e, album)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tracks Only View */}
      {activeFilter === 'tracks' && (
        <div className="search-tracks-view">
          <div className="results-list">
            {results.tracks.map((track, index) => (
              <TrackRow
                key={track.id}
                track={track}
                index={index + 1}
                isPlaying={currentTrack?.id === track.id}
                onClick={() => handleTrackClick(track, index)}
                onContextMenu={showTrackContextMenu}
              />
            ))}
          </div>
        </div>
      )}

      {/* Artists Only View */}
      {activeFilter === 'artists' && (
        <div className="search-artists-view">
          <div className="search-artists-grid large">
            {results.artists.map(artist => (
              <ArtistCard
                key={artist.id}
                artist={artist}
                onClick={() => handleArtistClick(artist)}
                onContextMenu={(e) => showArtistContextMenu(e, artist)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Albums Only View */}
      {activeFilter === 'albums' && (
        <div className="search-albums-view">
          <div className="search-albums-grid large">
            {results.albums.map(album => (
              <AlbumCard
                key={album.id}
                album={album}
                onClick={() => handleAlbumClick(album)}
                onContextMenu={(e) => showAlbumContextMenu(e, album)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

function formatDuration(ms?: number): string {
  if (!ms) return '--:--';
  const totalSeconds = Math.floor(ms / 1000);
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
