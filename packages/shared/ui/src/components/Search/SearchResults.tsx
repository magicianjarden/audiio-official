import React from 'react';
import { useSearchStore, type SearchArtist, type SearchAlbum, type SearchVideo, type SearchPlaylist, type SearchConcert } from '../../stores/search-store';
import { usePlayerStore } from '../../stores/player-store';
import { useNavigationStore } from '../../stores/navigation-store';
import { useTrackContextMenu, useArtistContextMenu, useAlbumContextMenu } from '../../contexts/ContextMenuContext';
import { TrackRow } from '../TrackRow/TrackRow';
import { MusicNoteIcon, PlayIcon, ChevronRightIcon, YouTubeIcon, PlaylistIcon, MicIcon, ExternalLinkIcon, ClockIcon } from '@audiio/icons';
import type { UnifiedTrack } from '@audiio/core';

/**
 * SearchResults - Displays search results with consistent library-view pattern
 * Integrates with FloatingSearch for filters and actions
 */

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

interface VideoCardProps {
  video: SearchVideo;
  onClick?: () => void;
}

const VideoCard: React.FC<VideoCardProps> = ({ video, onClick }) => (
  <div className="video-card" onClick={onClick}>
    <div className="video-card-thumbnail">
      {video.thumbnail ? (
        <img src={video.thumbnail} alt={video.title} />
      ) : (
        <div className="video-card-placeholder">
          <YouTubeIcon size={32} />
        </div>
      )}
      {video.duration && (
        <span className="video-card-duration">{video.duration}</span>
      )}
      <div className="video-card-play">
        <PlayIcon size={24} />
      </div>
    </div>
    <div className="video-card-info">
      <span className="video-card-title">{video.title}</span>
      {video.viewCount && (
        <span className="video-card-views">{formatViewCount(video.viewCount)} views</span>
      )}
    </div>
  </div>
);

interface PlaylistCardProps {
  playlist: SearchPlaylist;
  onClick?: () => void;
}

const PlaylistCardSmall: React.FC<PlaylistCardProps> = ({ playlist, onClick }) => (
  <div className="playlist-card-small" onClick={onClick}>
    <div className="playlist-card-small-artwork">
      {playlist.artwork ? (
        <img src={playlist.artwork} alt={playlist.name} />
      ) : (
        <div className="playlist-card-small-placeholder">
          <PlaylistIcon size={24} />
        </div>
      )}
    </div>
    <div className="playlist-card-small-info">
      <span className="playlist-card-small-name">{playlist.name}</span>
      <span className="playlist-card-small-count">{playlist.trackCount} songs</span>
    </div>
    {playlist.isSmartPlaylist && (
      <span className="playlist-card-small-smart">Smart</span>
    )}
  </div>
);

interface ConcertCardProps {
  concert: SearchConcert;
  onClick?: () => void;
}

const ConcertCard: React.FC<ConcertCardProps> = ({ concert, onClick }) => {
  const date = new Date(concert.datetime);
  const formattedDate = date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const formattedTime = date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });

  return (
    <div className="concert-card" onClick={onClick}>
      <div className="concert-card-date">
        <span className="concert-card-month">{date.toLocaleDateString('en-US', { month: 'short' })}</span>
        <span className="concert-card-day">{date.getDate()}</span>
      </div>
      <div className="concert-card-info">
        <span className="concert-card-venue">{concert.venue.name}</span>
        <span className="concert-card-location">
          {concert.venue.city}{concert.venue.region ? `, ${concert.venue.region}` : ''}, {concert.venue.country}
        </span>
        <span className="concert-card-lineup">{concert.lineup.slice(0, 3).join(' • ')}</span>
      </div>
      {concert.ticketUrl && (
        <a
          href={concert.ticketUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="concert-card-tickets"
          onClick={(e) => e.stopPropagation()}
        >
          Tickets <ExternalLinkIcon size={12} />
        </a>
      )}
    </div>
  );
};

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

  const handleVideoClick = (video: SearchVideo) => {
    window.open(video.url, '_blank', 'noopener,noreferrer');
  };

  const handlePlaylistClick = (playlist: SearchPlaylist) => {
    // Navigate to playlist detail view using navigation store
    const { openPlaylist } = useNavigationStore.getState();
    if (openPlaylist) {
      openPlaylist(playlist.id);
    }
  };

  const hasResults = results.tracks.length > 0 || results.artists.length > 0 || results.albums.length > 0 ||
    results.videos.length > 0 || results.playlists.length > 0 || results.concerts.length > 0;
  const topResult = results.tracks[0] || null;

  // Loading state
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

  // Error state
  if (error) {
    return (
      <div className="search-results">
        <div className="search-results-error">{error}</div>
      </div>
    );
  }

  // Empty query state
  if (!query) {
    return (
      <div className="search-results">
        <div className="search-results-empty">
          Search for tracks, artists, or albums
        </div>
      </div>
    );
  }

  // No results state
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

      {/* All Results View - Modern Layout */}
      {activeFilter === 'all' && (
        <div className="search-results-all">
          {/* Hero Top Result */}
          {topResult && (
            <div className="search-hero" onClick={() => handleTrackClick(topResult, 0)}>
              <div className="search-hero-bg">
                {topResult.artwork?.large && (
                  <img src={topResult.artwork.large} alt="" aria-hidden="true" />
                )}
              </div>
              <div className="search-hero-content">
                <div className="search-hero-artwork">
                  {topResult.artwork?.medium ? (
                    <img src={topResult.artwork.medium} alt={topResult.title} />
                  ) : (
                    <div className="search-hero-placeholder">
                      <MusicNoteIcon size={48} />
                    </div>
                  )}
                </div>
                <div className="search-hero-info">
                  <span className="search-hero-label">Top Result</span>
                  <h2 className="search-hero-title">{topResult.title}</h2>
                  <p className="search-hero-artist">{topResult.artists.map(a => a.name).join(', ')}</p>
                  <div className="search-hero-tags">
                    <span className="search-hero-tag">Song</span>
                    {topResult.album?.name && (
                      <span className="search-hero-tag">{topResult.album.name}</span>
                    )}
                  </div>
                </div>
                <button className="search-hero-play" onClick={(e) => { e.stopPropagation(); handleTrackClick(topResult, 0); }}>
                  <PlayIcon size={28} />
                </button>
              </div>
            </div>
          )}

          {/* Songs Section */}
          {results.tracks.length > 0 && (
            <div className="search-section">
              <div className="search-section-header">
                <h3 className="search-section-title">Songs</h3>
                {results.tracks.length > 6 && (
                  <button className="search-see-all" onClick={() => setActiveFilter('tracks')}>
                    See All <ChevronRightIcon size={14} />
                  </button>
                )}
              </div>
              <div className="search-songs-grid">
                {results.tracks.slice(0, 6).map((track, index) => (
                  <div
                    key={track.id}
                    className={`search-song-card ${currentTrack?.id === track.id ? 'playing' : ''}`}
                    onClick={() => handleTrackClick(track, index)}
                    onContextMenu={(e) => showTrackContextMenu(e, track)}
                  >
                    <div className="search-song-card-artwork">
                      {track.artwork?.small ? (
                        <img src={track.artwork.small} alt={track.title} />
                      ) : (
                        <div className="search-song-card-placeholder">
                          <MusicNoteIcon size={20} />
                        </div>
                      )}
                      <div className="search-song-card-play">
                        <PlayIcon size={18} />
                      </div>
                    </div>
                    <div className="search-song-card-info">
                      <span className="search-song-card-title">{track.title}</span>
                      <span className="search-song-card-artist">
                        {track.artists.map(a => a.name).join(', ')}
                      </span>
                    </div>
                    <span className="search-song-card-duration">
                      {formatDuration(track.duration)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Artists Section - Grid */}
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
              <div className="search-artists-grid">
                {results.artists.slice(0, 6).map(artist => (
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

          {/* Albums Section - Grid */}
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
              <div className="search-albums-grid">
                {results.albums.slice(0, 6).map(album => (
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

          {/* Videos Section - Horizontal Scroll */}
          {results.videos.length > 0 && (
            <div className="search-section">
              <div className="search-section-header">
                <h3 className="search-section-title">
                  <YouTubeIcon size={18} />
                  Videos
                </h3>
              </div>
              <div className="search-videos-grid">
                {results.videos.slice(0, 8).map(video => (
                  <VideoCard
                    key={video.id}
                    video={video}
                    onClick={() => handleVideoClick(video)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Playlists Section - Compact List */}
          {results.playlists.length > 0 && (
            <div className="search-section">
              <div className="search-section-header">
                <h3 className="search-section-title">
                  <PlaylistIcon size={18} />
                  Playlists
                </h3>
              </div>
              <div className="search-playlists-list">
                {results.playlists.slice(0, 6).map(playlist => (
                  <PlaylistCardSmall
                    key={playlist.id}
                    playlist={playlist}
                    onClick={() => handlePlaylistClick(playlist)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Concerts Section - Event Cards */}
          {results.concerts.length > 0 && (
            <div className="search-section">
              <div className="search-section-header">
                <h3 className="search-section-title">
                  <MicIcon size={18} />
                  Upcoming Shows
                </h3>
              </div>
              <div className="search-concerts-list">
                {results.concerts.slice(0, 4).map(concert => (
                  <ConcertCard
                    key={concert.id}
                    concert={concert}
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

function formatDuration(seconds?: number): string {
  if (!seconds) return '--:--';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function formatViewCount(count: number): string {
  if (count >= 1000000) {
    return `${(count / 1000000).toFixed(1)}M`;
  }
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}K`;
  }
  return count.toString();
}
