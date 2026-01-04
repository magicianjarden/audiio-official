/**
 * Home Page - Spotify-like Discover experience with integrated search
 *
 * Features:
 * - Time-based greeting
 * - Integrated search with live results (like host Discover)
 * - Plugin-powered sections from desktop
 * - Pull-to-refresh
 */

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { tunnelFetch } from '../stores/auth-store';
import { getArtworkUrl } from '../utils/artwork';
import { triggerHaptic } from '../utils/haptics';
import { MusicNoteIcon, SearchIcon, ClearIcon } from '@audiio/icons';
import { TrackList } from '../components/TrackList';
import { PullToRefresh } from '../components/PullToRefresh';
import { ConnectionDot } from '../components/ConnectionBanner';
import { MobileSectionRenderer, SectionData } from '../components/sections';
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

interface SectionsResponse {
  sections: SectionData[];
}

interface SearchResults {
  tracks?: Track[];
  artists?: Artist[];
  albums?: Album[];
}

export function HomePage() {
  const navigate = useNavigate();
  const [sections, setSections] = useState<SectionData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResults | null>(null);
  const [isSearching, setIsSearching] = useState(false);
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
    fetchSections();
  }, []);

  const fetchSections = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await tunnelFetch('/api/discover/sections');
      const data: SectionsResponse = await response.json();
      setSections(data.sections || []);
    } catch (err) {
      // Fallback to legacy discover if sections endpoint doesn't exist
      try {
        const response = await tunnelFetch('/api/discover');
        const data = await response.json();
        // Convert legacy discover data to sections format
        const legacySections: SectionData[] = [];
        if (data.recentlyPlayed?.length) {
          legacySections.push({
            id: 'recently-played',
            type: 'recently-played',
            title: 'Recently Played',
            tracks: data.recentlyPlayed
          });
        }
        if (data.quickPicks?.length || data.forYou?.length) {
          legacySections.push({
            id: 'quick-picks',
            type: 'quick-picks',
            title: 'Quick Picks',
            tracks: data.quickPicks || data.forYou
          });
        }
        if (data.tracks?.length) {
          legacySections.push({
            id: 'trending',
            type: 'trending',
            title: 'Trending Now',
            tracks: data.tracks
          });
        }
        setSections(legacySections);
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
      const response = await tunnelFetch('/api/discover/sections');
      const data: SectionsResponse = await response.json();
      setSections(data.sections || []);
    } catch (err) {
      try {
        const response = await tunnelFetch('/api/discover');
        const data = await response.json();
        const legacySections: SectionData[] = [];
        if (data.recentlyPlayed?.length) {
          legacySections.push({
            id: 'recently-played',
            type: 'recently-played',
            title: 'Recently Played',
            tracks: data.recentlyPlayed
          });
        }
        if (data.tracks?.length) {
          legacySections.push({
            id: 'trending',
            type: 'trending',
            title: 'Trending Now',
            tracks: data.tracks
          });
        }
        setSections(legacySections);
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

  const hasContent = sections.length > 0;

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
            <MobileSectionRenderer sections={[]} isLoading />
          ) : error ? (
            <div className={styles.error}>
              <p>{error}</p>
              <button onClick={fetchSections}>Retry</button>
            </div>
          ) : !hasContent ? (
            <div className={styles.empty}>
              <MusicNoteIcon size={48} />
              <h2>Welcome to Audiio</h2>
              <p>Start playing music on your desktop app to see personalized recommendations here.</p>
            </div>
          ) : (
            <MobileSectionRenderer sections={sections} />
          )}
        </div>
      </PullToRefresh>
    </div>
  );
}
