/**
 * PlaylistBrowser Component
 * Browse and search Sposify bundled playlists
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSposifyStore } from '../stores';
import { PlaylistCard } from './PlaylistCard';
import './PlaylistBrowser.css';

type ViewMode = 'grid' | 'list';
type SortOption = 'followers' | 'tracks' | 'name';

interface PlaylistBrowserProps {
  onClose?: () => void;
}

export const PlaylistBrowser: React.FC<PlaylistBrowserProps> = ({ onClose }) => {
  const {
    databaseReady,
    playlistSearchQuery,
    playlistSearchResults,
    playlistBrowserLoading,
    selectedPlaylistId,
    searchPlaylists,
    browseTopPlaylists,
    selectPlaylist,
    importPlaylist,
  } = useSposifyStore();

  const [searchInput, setSearchInput] = useState(playlistSearchQuery);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [sortBy, setSortBy] = useState<SortOption>('followers');
  const searchTimeoutRef = useRef<NodeJS.Timeout>();

  // Load top playlists on mount if no search results
  useEffect(() => {
    if (databaseReady && playlistSearchResults.length === 0 && !playlistSearchQuery) {
      browseTopPlaylists();
    }
  }, [databaseReady, playlistSearchResults.length, playlistSearchQuery, browseTopPlaylists]);

  // Debounced search
  const handleSearchChange = useCallback(
    (value: string) => {
      setSearchInput(value);

      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }

      searchTimeoutRef.current = setTimeout(() => {
        if (value.trim()) {
          searchPlaylists(value.trim());
        } else {
          browseTopPlaylists();
        }
      }, 300);
    },
    [searchPlaylists, browseTopPlaylists]
  );

  // Sort playlists
  const sortedPlaylists = [...playlistSearchResults].sort((a, b) => {
    switch (sortBy) {
      case 'followers':
        return b.followers - a.followers;
      case 'tracks':
        return b.trackCount - a.trackCount;
      case 'name':
        return a.name.localeCompare(b.name);
      default:
        return 0;
    }
  });

  const handleImport = async (playlistId: string) => {
    await importPlaylist(playlistId);
  };

  if (!databaseReady) {
    return (
      <div className="sposify-playlist-browser">
        <div className="browser-empty-state">
          <div className="empty-icon">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
            </svg>
          </div>
          <h3>Database Not Ready</h3>
          <p>Please wait for the Sposify database to initialize.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="sposify-playlist-browser">
      <header className="browser-header">
        <div className="header-title">
          <h2>Playlist Discovery</h2>
          <span className="playlist-count">{playlistSearchResults.length.toLocaleString()} playlists</span>
        </div>

        {onClose && (
          <button className="close-btn" onClick={onClose} title="Close">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
            </svg>
          </button>
        )}
      </header>

      <div className="browser-toolbar">
        <div className="search-box">
          <svg className="search-icon" viewBox="0 0 24 24" fill="currentColor">
            <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
          </svg>
          <input
            type="text"
            placeholder="Search playlists..."
            value={searchInput}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="search-input"
          />
          {searchInput && (
            <button
              className="clear-search-btn"
              onClick={() => {
                setSearchInput('');
                browseTopPlaylists();
              }}
            >
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
              </svg>
            </button>
          )}
        </div>

        <div className="toolbar-actions">
          <div className="sort-select">
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value as SortOption)}>
              <option value="followers">Most Followers</option>
              <option value="tracks">Most Tracks</option>
              <option value="name">Name A-Z</option>
            </select>
          </div>

          <div className="view-toggle">
            <button
              className={`view-btn ${viewMode === 'grid' ? 'active' : ''}`}
              onClick={() => setViewMode('grid')}
              title="Grid view"
            >
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M3 3v8h8V3H3zm6 6H5V5h4v4zm-6 4v8h8v-8H3zm6 6H5v-4h4v4zm4-16v8h8V3h-8zm6 6h-4V5h4v4zm-6 4v8h8v-8h-8zm6 6h-4v-4h4v4z" />
              </svg>
            </button>
            <button
              className={`view-btn ${viewMode === 'list' ? 'active' : ''}`}
              onClick={() => setViewMode('list')}
              title="List view"
            >
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M4 14h4v-4H4v4zm0 5h4v-4H4v4zM4 9h4V5H4v4zm5 5h12v-4H9v4zm0 5h12v-4H9v4zM9 5v4h12V5H9z" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <div className="browser-content">
        {playlistBrowserLoading ? (
          <div className="browser-loading">
            <div className="loading-spinner" />
            <span>Searching playlists...</span>
          </div>
        ) : sortedPlaylists.length === 0 ? (
          <div className="browser-empty-state">
            <div className="empty-icon">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M15 6H3v2h12V6zm0 4H3v2h12v-2zM3 16h8v-2H3v2zM17 6v8.18c-.31-.11-.65-.18-1-.18-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3V8h3V6h-5z" />
              </svg>
            </div>
            <h3>No Playlists Found</h3>
            <p>Try a different search term or browse top playlists.</p>
          </div>
        ) : (
          <div className={`playlist-grid ${viewMode}`}>
            {sortedPlaylists.map((playlist) => (
              <PlaylistCard
                key={playlist.playlistId}
                playlist={playlist}
                isSelected={selectedPlaylistId === playlist.playlistId}
                onClick={() => selectPlaylist(playlist.playlistId)}
                onImport={() => handleImport(playlist.playlistId)}
                view={viewMode}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default PlaylistBrowser;
