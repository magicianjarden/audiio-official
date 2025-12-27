/**
 * Search Page - Search for tracks, artists, albums
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { tunnelFetch } from '../stores/auth-store';
import { triggerHaptic } from '../utils/haptics';
import { TrackList } from '../components/TrackList';
import styles from './SearchPage.module.css';

interface SearchResults {
  tracks?: any[];
  artists?: any[];
  albums?: any[];
}

export function SearchPage() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResults | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [activeTab, setActiveTab] = useState<'tracks' | 'artists' | 'albums'>('tracks');
  const searchTimeout = useRef<NodeJS.Timeout>();
  const inputRef = useRef<HTMLInputElement>(null);

  const handleArtistClick = (artist: any) => {
    triggerHaptic('light');
    navigate(`/artist/${artist.id}?name=${encodeURIComponent(artist.name)}&source=${artist.source || 'deezer'}`);
  };

  const handleAlbumClick = (album: any) => {
    triggerHaptic('light');
    navigate(`/album/${album.id}?name=${encodeURIComponent(album.name)}&source=${album.source || 'deezer'}`);
  };

  // Debounced search
  const handleSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults(null);
      return;
    }

    setIsSearching(true);

    try {
      const response = await tunnelFetch(`/api/search?q=${encodeURIComponent(searchQuery)}`);
      const data = await response.json();
      setResults(data);
    } catch (error) {
      console.error('Search error:', error);
      setResults(null);
    } finally {
      setIsSearching(false);
    }
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);

    // Debounce search
    if (searchTimeout.current) {
      clearTimeout(searchTimeout.current);
    }

    searchTimeout.current = setTimeout(() => {
      handleSearch(value);
    }, 300);
  };

  const handleClear = () => {
    setQuery('');
    setResults(null);
    inputRef.current?.focus();
  };

  useEffect(() => {
    return () => {
      if (searchTimeout.current) {
        clearTimeout(searchTimeout.current);
      }
    };
  }, []);

  const trackCount = results?.tracks?.length || 0;
  const artistCount = results?.artists?.length || 0;
  const albumCount = results?.albums?.length || 0;

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.searchBar}>
          <SearchIcon />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={handleInputChange}
            placeholder="Search songs, artists, albums..."
            className={styles.input}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
          />
          {query && (
            <button className={styles.clearButton} onClick={handleClear}>
              <ClearIcon />
            </button>
          )}
        </div>
      </header>

      {results && (trackCount > 0 || artistCount > 0 || albumCount > 0) && (
        <div className={styles.tabs}>
          <button
            className={`${styles.tab} ${activeTab === 'tracks' ? styles.active : ''}`}
            onClick={() => setActiveTab('tracks')}
          >
            Tracks ({trackCount})
          </button>
          <button
            className={`${styles.tab} ${activeTab === 'artists' ? styles.active : ''}`}
            onClick={() => setActiveTab('artists')}
          >
            Artists ({artistCount})
          </button>
          <button
            className={`${styles.tab} ${activeTab === 'albums' ? styles.active : ''}`}
            onClick={() => setActiveTab('albums')}
          >
            Albums ({albumCount})
          </button>
        </div>
      )}

      <div className={styles.content}>
        {isSearching ? (
          <div className={styles.loading}>
            <div className={styles.spinner} />
          </div>
        ) : !query ? (
          <div className={styles.placeholder}>
            <SearchIcon />
            <p>Search for your favorite music</p>
          </div>
        ) : !results || (trackCount === 0 && artistCount === 0 && albumCount === 0) ? (
          <div className={styles.noResults}>
            <p>No results found for "{query}"</p>
          </div>
        ) : (
          <>
            {activeTab === 'tracks' && results.tracks && (
              <TrackList tracks={results.tracks} />
            )}
            {activeTab === 'artists' && results.artists && (
              <div className={styles.artistList}>
                {results.artists.map((artist: any) => (
                  <button
                    key={artist.id}
                    className={styles.artistItem}
                    onClick={() => handleArtistClick(artist)}
                  >
                    <div className={styles.artistAvatar}>
                      {artist.image ? (
                        <img src={artist.image} alt={artist.name} />
                      ) : (
                        <div className={styles.avatarPlaceholder} />
                      )}
                    </div>
                    <span className={styles.artistName}>{artist.name}</span>
                  </button>
                ))}
              </div>
            )}
            {activeTab === 'albums' && results.albums && (
              <div className={styles.albumList}>
                {results.albums.map((album: any) => (
                  <button
                    key={album.id}
                    className={styles.albumItem}
                    onClick={() => handleAlbumClick(album)}
                  >
                    <div className={styles.albumArtwork}>
                      {album.artwork ? (
                        <img src={album.artwork} alt={album.name} />
                      ) : (
                        <div className={styles.artworkPlaceholder} />
                      )}
                    </div>
                    <div className={styles.albumInfo}>
                      <span className={styles.albumName}>{album.name}</span>
                      <span className={styles.albumArtist}>{album.artists?.[0]?.name}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function SearchIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
    </svg>
  );
}

function ClearIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
    </svg>
  );
}
