/**
 * Home Page - Spotify-like Discover experience with integrated search
 *
 * Features:
 * - Time-based greeting
 * - Integrated search with live results (like host Discover)
 * - Recently played section
 * - Quick picks / recommendations
 * - Featured artists (clickable, navigates to artist page)
 * - Featured albums (clickable, navigates to album page)
 * - Pull-to-refresh
 */

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useConnectionStatus, usePlaybackControls, useQueueControls } from '../stores/player-store';
import { tunnelFetch } from '../stores/auth-store';
import { getArtworkUrl } from '../utils/artwork';
import { triggerHaptic } from '../utils/haptics';
import { MusicNoteIcon, SearchIcon, ClearIcon } from '@audiio/icons';
import { TrackList } from '../components/TrackList';
import { PullToRefresh } from '../components/PullToRefresh';
import { ConnectionDot } from '../components/ConnectionBanner';
import styles from './HomePage.module.css';

interface Track {
  id: string;
  title: string;
  artists: { id: string; name: string }[];
  album?: { id: string; name: string; artwork?: unknown };
  artwork?: unknown;
  duration?: number;
  source?: string;
}

interface Artist {
  id: string;
  name: string;
  image?: string;
  source?: string;
}

interface Album {
  id: string;
  title?: string;
  name?: string;
  artwork?: unknown;
  artists?: { id: string; name: string }[];
  source?: string;
}

interface DiscoverData {
  recentlyPlayed?: Track[];
  quickPicks?: Track[];
  tracks?: Track[];
  artists?: Artist[];
  albums?: Album[];
  forYou?: Track[];
  mixes?: Array<{
    id: string;
    name: string;
    description: string;
    artwork?: string;
    tracks: Track[];
  }>;
}

interface SearchResults {
  tracks?: Track[];
  artists?: Artist[];
  albums?: Album[];
}

export function HomePage() {
  const navigate = useNavigate();
  const [discover, setDiscover] = useState<DiscoverData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { isConnected } = useConnectionStatus();
  const { play } = usePlaybackControls();
  const { setQueue } = useQueueControls();

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResults | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const searchTimeout = useRef<NodeJS.Timeout>();
  const inputRef = useRef<HTMLInputElement>(null);

  // Time-based greeting
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  useEffect(() => {
    fetchDiscover();
  }, []);

  const fetchDiscover = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await tunnelFetch('/api/discover');
      const data = await response.json();
      setDiscover(data);
    } catch (err) {
      // Fallback to trending if discover endpoint doesn't exist
      try {
        const response = await tunnelFetch('/api/trending');
        const data = await response.json();
        setDiscover(data);
      } catch {
        setError('Failed to load content');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = useCallback(async () => {
    setError(null);
    try {
      const response = await tunnelFetch('/api/discover');
      const data = await response.json();
      setDiscover(data);
    } catch (err) {
      try {
        const response = await tunnelFetch('/api/trending');
        const data = await response.json();
        setDiscover(data);
      } catch {
        setError('Failed to load content');
      }
    }
  }, []);

  // Debounced search
  const handleSearch = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults(null);
      return;
    }

    setIsSearching(true);
    try {
      const response = await tunnelFetch(`/api/search?q=${encodeURIComponent(query)}`);
      const data = await response.json();
      setSearchResults(data);
    } catch (error) {
      console.error('Search error:', error);
      setSearchResults(null);
    } finally {
      setIsSearching(false);
    }
  }, []);

  const handleSearchInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchQuery(value);

    // Clear previous timeout
    if (searchTimeout.current) {
      clearTimeout(searchTimeout.current);
    }

    // Debounce search
    searchTimeout.current = setTimeout(() => {
      handleSearch(value);
    }, 300);
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    setSearchResults(null);
    inputRef.current?.focus();
  };

  const handleSearchFocus = () => {
    setIsSearchFocused(true);
  };

  const handleSearchBlur = () => {
    // Delay to allow click events to fire
    setTimeout(() => setIsSearchFocused(false), 200);
  };

  // Cleanup search timeout
  useEffect(() => {
    return () => {
      if (searchTimeout.current) {
        clearTimeout(searchTimeout.current);
      }
    };
  }, []);

  // Check if we're showing search results
  const showingSearch = searchQuery.trim().length > 0;

  const handleArtistClick = (artist: Artist) => {
    triggerHaptic('light');
    navigate(`/artist/${artist.id}?name=${encodeURIComponent(artist.name)}&source=${artist.source || 'deezer'}`);
  };

  const handleAlbumClick = (album: Album) => {
    triggerHaptic('light');
    const albumName = album.title || album.name || '';
    navigate(`/album/${album.id}?name=${encodeURIComponent(albumName)}&source=${album.source || 'deezer'}`);
  };

  const handleMixPlay = (mix: { tracks: Track[] }) => {
    if (mix.tracks.length > 0) {
      triggerHaptic('medium');
      setQueue(mix.tracks, 0);
      play(mix.tracks[0]);
    }
  };

  // Combine tracks from different sources
  const recentlyPlayed = discover?.recentlyPlayed || [];
  const quickPicks = discover?.quickPicks || discover?.forYou || discover?.tracks?.slice(0, 8) || [];
  const artists = discover?.artists || [];
  const albums = discover?.albums || [];
  const mixes = discover?.mixes || [];

  const hasContent = recentlyPlayed.length > 0 || quickPicks.length > 0 ||
                     artists.length > 0 || albums.length > 0;

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.headerTop}>
          <h1 className={styles.greeting}>{getGreeting()}</h1>
          <div className={styles.connectionStatus}>
            <ConnectionDot />
          </div>
        </div>

        {/* Integrated Search Bar */}
        <div className={styles.searchBar}>
          <SearchIcon size={20} />
          <input
            ref={inputRef}
            type="text"
            value={searchQuery}
            onChange={handleSearchInput}
            onFocus={handleSearchFocus}
            onBlur={handleSearchBlur}
            placeholder="Search songs, artists, albums..."
            className={styles.searchInput}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
          />
          {searchQuery && (
            <button className={styles.clearButton} onClick={handleClearSearch}>
              <ClearIcon size={18} />
            </button>
          )}
        </div>
      </header>

      <PullToRefresh onRefresh={handleRefresh} disabled={isLoading || showingSearch}>
        <div className={styles.content}>
          {/* Search Results */}
          {showingSearch ? (
            isSearching ? (
              <div className={styles.loading}>
                <div className={styles.spinner} />
                <p>Searching...</p>
              </div>
            ) : searchResults && (searchResults.tracks?.length || searchResults.artists?.length || searchResults.albums?.length) ? (
              <>
                {/* Search Tracks */}
                {searchResults.tracks && searchResults.tracks.length > 0 && (
                  <section className={styles.section}>
                    <h2 className={styles.sectionTitle}>Songs</h2>
                    <TrackList tracks={searchResults.tracks.slice(0, 5)} />
                  </section>
                )}

                {/* Search Artists */}
                {searchResults.artists && searchResults.artists.length > 0 && (
                  <section className={styles.section}>
                    <h2 className={styles.sectionTitle}>Artists</h2>
                    <div className={styles.artistScroll}>
                      {searchResults.artists.slice(0, 10).map((artist) => (
                        <button
                          key={artist.id}
                          className={styles.artistCard}
                          onClick={() => handleArtistClick(artist)}
                        >
                          <div className={styles.artistImage}>
                            {artist.image ? (
                              <img src={artist.image} alt={artist.name} />
                            ) : (
                              <div className={styles.artistPlaceholder}>
                                <MusicNoteIcon size={24} />
                              </div>
                            )}
                          </div>
                          <span className={styles.artistName}>{artist.name}</span>
                        </button>
                      ))}
                    </div>
                  </section>
                )}

                {/* Search Albums */}
                {searchResults.albums && searchResults.albums.length > 0 && (
                  <section className={styles.section}>
                    <h2 className={styles.sectionTitle}>Albums</h2>
                    <div className={styles.albumScroll}>
                      {searchResults.albums.slice(0, 10).map((album) => {
                        const albumArtwork = getArtworkUrl(album.artwork, 'medium');
                        const albumName = album.title || album.name || '';
                        return (
                          <button
                            key={album.id}
                            className={styles.albumCard}
                            onClick={() => handleAlbumClick(album)}
                          >
                            <div className={styles.albumArtwork}>
                              {albumArtwork ? (
                                <img src={albumArtwork} alt={albumName} />
                              ) : (
                                <div className={styles.albumPlaceholder}>
                                  <MusicNoteIcon size={24} />
                                </div>
                              )}
                            </div>
                            <span className={styles.albumName}>{albumName}</span>
                            <span className={styles.albumArtist}>{album.artists?.[0]?.name}</span>
                          </button>
                        );
                      })}
                    </div>
                  </section>
                )}

                {/* More Tracks */}
                {searchResults.tracks && searchResults.tracks.length > 5 && (
                  <section className={styles.section}>
                    <h2 className={styles.sectionTitle}>More Songs</h2>
                    <TrackList tracks={searchResults.tracks.slice(5, 15)} />
                  </section>
                )}
              </>
            ) : (
              <div className={styles.noResults}>
                <MusicNoteIcon size={48} />
                <p>No results found for "{searchQuery}"</p>
              </div>
            )
          ) : isLoading ? (
            <div className={styles.loading}>
              <div className={styles.spinner} />
              <p>Loading your music...</p>
            </div>
          ) : error ? (
            <div className={styles.error}>
              <p>{error}</p>
              <button onClick={fetchDiscover}>Retry</button>
            </div>
          ) : !hasContent ? (
            <div className={styles.empty}>
              <MusicNoteIcon size={48} />
              <h2>Welcome to Audiio</h2>
              <p>Start playing music on your desktop app to see personalized recommendations here.</p>
            </div>
          ) : (
            <>
              {/* Recently Played */}
              {recentlyPlayed.length > 0 && (
                <section className={styles.section}>
                  <h2 className={styles.sectionTitle}>Recently Played</h2>
                  <div className={styles.recentGrid}>
                    {recentlyPlayed.slice(0, 6).map((track) => {
                      const artwork = getArtworkUrl(track.artwork || track.album?.artwork, 'small');
                      return (
                        <button
                          key={track.id}
                          className={styles.recentCard}
                          onClick={() => {
                            triggerHaptic('light');
                            setQueue([track], 0);
                            play(track);
                          }}
                        >
                          <div className={styles.recentArtwork}>
                            {artwork ? (
                              <img src={artwork} alt={track.title} />
                            ) : (
                              <div className={styles.placeholder}>
                                <MusicNoteIcon size={16} />
                              </div>
                            )}
                          </div>
                          <span className={styles.recentTitle}>{track.title}</span>
                        </button>
                      );
                    })}
                  </div>
                </section>
              )}

              {/* Quick Picks */}
              {quickPicks.length > 0 && (
                <section className={styles.section}>
                  <h2 className={styles.sectionTitle}>Quick Picks</h2>
                  <TrackList tracks={quickPicks.slice(0, 5)} />
                </section>
              )}

              {/* Your Mixes */}
              {mixes.length > 0 && (
                <section className={styles.section}>
                  <h2 className={styles.sectionTitle}>Made For You</h2>
                  <div className={styles.mixScroll}>
                    {mixes.slice(0, 6).map((mix) => (
                      <button
                        key={mix.id}
                        className={styles.mixCard}
                        onClick={() => handleMixPlay(mix)}
                      >
                        <div className={styles.mixArtwork}>
                          {mix.artwork ? (
                            <img src={mix.artwork} alt={mix.name} />
                          ) : (
                            <div className={styles.mixGradient}>
                              <MusicNoteIcon size={32} />
                            </div>
                          )}
                        </div>
                        <span className={styles.mixName}>{mix.name}</span>
                        <span className={styles.mixDesc}>{mix.description}</span>
                      </button>
                    ))}
                  </div>
                </section>
              )}

              {/* Featured Artists */}
              {artists.length > 0 && (
                <section className={styles.section}>
                  <h2 className={styles.sectionTitle}>Popular Artists</h2>
                  <div className={styles.artistScroll}>
                    {artists.slice(0, 10).map((artist) => (
                      <button
                        key={artist.id}
                        className={styles.artistCard}
                        onClick={() => handleArtistClick(artist)}
                      >
                        <div className={styles.artistImage}>
                          {artist.image ? (
                            <img src={artist.image} alt={artist.name} />
                          ) : (
                            <div className={styles.artistPlaceholder}>
                              <MusicNoteIcon size={24} />
                            </div>
                          )}
                        </div>
                        <span className={styles.artistName}>{artist.name}</span>
                      </button>
                    ))}
                  </div>
                </section>
              )}

              {/* Featured Albums */}
              {albums.length > 0 && (
                <section className={styles.section}>
                  <h2 className={styles.sectionTitle}>Popular Albums</h2>
                  <div className={styles.albumScroll}>
                    {albums.slice(0, 10).map((album) => {
                      const albumArtwork = getArtworkUrl(album.artwork, 'medium');
                      const albumName = album.title || album.name || '';
                      return (
                        <button
                          key={album.id}
                          className={styles.albumCard}
                          onClick={() => handleAlbumClick(album)}
                        >
                          <div className={styles.albumArtwork}>
                            {albumArtwork ? (
                              <img src={albumArtwork} alt={albumName} />
                            ) : (
                              <div className={styles.albumPlaceholder}>
                                <MusicNoteIcon size={24} />
                              </div>
                            )}
                          </div>
                          <span className={styles.albumName}>{albumName}</span>
                          <span className={styles.albumArtist}>{album.artists?.[0]?.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </section>
              )}

              {/* More Tracks */}
              {discover?.tracks && discover.tracks.length > 8 && (
                <section className={styles.section}>
                  <h2 className={styles.sectionTitle}>More to Explore</h2>
                  <TrackList tracks={discover.tracks.slice(8, 18)} />
                </section>
              )}
            </>
          )}
        </div>
      </PullToRefresh>
    </div>
  );
}
