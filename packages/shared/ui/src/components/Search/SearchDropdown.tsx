/**
 * SearchDropdown - Instant search results dropdown
 * Shows suggestions, quick results as user types
 */

import React, { useEffect, useRef, useCallback, useState } from 'react';
import { useSearchStore } from '../../stores/search-store';
import { useNavigationStore } from '../../stores/navigation-store';
import { usePlayerStore } from '../../stores/player-store';
import {
  SearchIcon,
  MusicNoteIcon,
  UserIcon,
  DiscoverIcon,
  ChevronRightIcon,
} from '@audiio/icons';
import type { UnifiedTrack } from '@audiio/core';
import type { SearchArtist, SearchAlbum } from '../../stores/search-store';

interface SearchDropdownProps {
  isOpen: boolean;
  onClose: () => void;
  onFullSearch: (query: string) => void;
  inputValue: string;
}

export const SearchDropdown: React.FC<SearchDropdownProps> = ({
  isOpen,
  onClose,
  onFullSearch,
  inputValue,
}) => {
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { results, isSearching, suggestions, search } = useSearchStore();
  const { openArtist, openAlbum } = useNavigationStore();
  const { play, addToQueue } = usePlayerStore();
  const [debouncedValue, setDebouncedValue] = useState('');
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce the search input
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    if (inputValue.length >= 2) {
      debounceTimerRef.current = setTimeout(() => {
        setDebouncedValue(inputValue);
      }, 300);
    } else {
      setDebouncedValue('');
    }

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [inputValue]);

  // Trigger search when debounced value changes
  useEffect(() => {
    if (debouncedValue.length >= 2) {
      search(debouncedValue);
    }
  }, [debouncedValue, search]);

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        // Don't close if clicking on the search input
        const target = e.target as HTMLElement;
        if (target.closest('.search-bar')) return;
        onClose();
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  // Handle track click
  const handleTrackClick = useCallback((track: UnifiedTrack) => {
    play(track);
    onClose();
  }, [play, onClose]);

  // Handle artist click
  const handleArtistClick = useCallback((artist: SearchArtist) => {
    openArtist(artist.id, artist);
    onClose();
  }, [openArtist, onClose]);

  // Handle album click
  const handleAlbumClick = useCallback((album: SearchAlbum) => {
    openAlbum(album.id, album);
    onClose();
  }, [openAlbum, onClose]);

  // Handle "See all results"
  const handleSeeAll = useCallback(() => {
    onFullSearch(inputValue);
    onClose();
  }, [inputValue, onFullSearch, onClose]);

  if (!isOpen) return null;

  const hasResults = results.tracks.length > 0 ||
                     results.artists.length > 0 ||
                     results.albums.length > 0 ||
                     results.localTracks.length > 0;

  const showSuggestions = suggestions.length > 0 && inputValue.length >= 2;
  const showResults = hasResults && debouncedValue.length >= 2;
  const showEmpty = !isSearching && debouncedValue.length >= 2 && !hasResults;
  const showPrompt = inputValue.length < 2;

  // Limit results for dropdown
  const topTracks = results.tracks.slice(0, 4);
  const topArtists = results.artists.slice(0, 3);
  const topAlbums = results.albums.slice(0, 3);

  return (
    <div className="search-dropdown" ref={dropdownRef}>
      {/* Loading state */}
      {isSearching && (
        <div className="search-dropdown-loading">
          <div className="search-dropdown-spinner" />
          <span>Searching...</span>
        </div>
      )}

      {/* Prompt to type more */}
      {showPrompt && !isSearching && (
        <div className="search-dropdown-prompt">
          <SearchIcon size={20} />
          <span>Type to search for songs, artists, or albums</span>
        </div>
      )}

      {/* No results */}
      {showEmpty && (
        <div className="search-dropdown-empty">
          <span>No results found for "{debouncedValue}"</span>
        </div>
      )}

      {/* Suggestions */}
      {showSuggestions && !showResults && !isSearching && (
        <div className="search-dropdown-section">
          <div className="search-dropdown-section-title">Suggestions</div>
          {suggestions.slice(0, 5).map((suggestion, i) => (
            <button
              key={i}
              className="search-dropdown-suggestion"
              onClick={() => onFullSearch(suggestion)}
            >
              <SearchIcon size={14} />
              <span>{suggestion}</span>
            </button>
          ))}
        </div>
      )}

      {/* Results */}
      {showResults && !isSearching && (
        <>
          {/* Tracks */}
          {topTracks.length > 0 && (
            <div className="search-dropdown-section">
              <div className="search-dropdown-section-title">
                <MusicNoteIcon size={14} />
                <span>Songs</span>
              </div>
              {topTracks.map((track) => (
                <button
                  key={track.id}
                  className="search-dropdown-item"
                  onClick={() => handleTrackClick(track)}
                >
                  <div className="search-dropdown-item-art">
                    {track.artwork?.small ? (
                      <img src={track.artwork.small} alt="" />
                    ) : (
                      <MusicNoteIcon size={16} />
                    )}
                  </div>
                  <div className="search-dropdown-item-info">
                    <div className="search-dropdown-item-title">{track.title}</div>
                    <div className="search-dropdown-item-subtitle">
                      {track.artists.map(a => a.name).join(', ')}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Artists */}
          {topArtists.length > 0 && (
            <div className="search-dropdown-section">
              <div className="search-dropdown-section-title">
                <UserIcon size={14} />
                <span>Artists</span>
              </div>
              {topArtists.map((artist) => (
                <button
                  key={artist.id}
                  className="search-dropdown-item"
                  onClick={() => handleArtistClick(artist)}
                >
                  <div className="search-dropdown-item-art artist">
                    {artist.image ? (
                      <img src={artist.image} alt="" />
                    ) : (
                      <UserIcon size={16} />
                    )}
                  </div>
                  <div className="search-dropdown-item-info">
                    <div className="search-dropdown-item-title">{artist.name}</div>
                    <div className="search-dropdown-item-subtitle">Artist</div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Albums */}
          {topAlbums.length > 0 && (
            <div className="search-dropdown-section">
              <div className="search-dropdown-section-title">
                <DiscoverIcon size={14} />
                <span>Albums</span>
              </div>
              {topAlbums.map((album) => (
                <button
                  key={album.id}
                  className="search-dropdown-item"
                  onClick={() => handleAlbumClick(album)}
                >
                  <div className="search-dropdown-item-art">
                    {album.artwork ? (
                      <img src={album.artwork} alt="" />
                    ) : (
                      <DiscoverIcon size={16} />
                    )}
                  </div>
                  <div className="search-dropdown-item-info">
                    <div className="search-dropdown-item-title">{album.title}</div>
                    <div className="search-dropdown-item-subtitle">{album.artist}</div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* See all results */}
          <button className="search-dropdown-see-all" onClick={handleSeeAll}>
            <span>See all results for "{inputValue}"</span>
            <ChevronRightIcon size={16} />
          </button>
        </>
      )}
    </div>
  );
};

export default SearchDropdown;
