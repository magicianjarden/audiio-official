/**
 * SearchDropdown - Instant search results dropdown
 * Shows suggestions, quick results as user types
 * Includes: bang suggestions, cross-page results, NL hints
 */

import React, { useEffect, useRef, useCallback, useState } from 'react';
import {
  useSearchStore,
  ALL_BANGS,
  NL_HINTS,
  SCOPE_CONFIG,
  AVAILABLE_MOODS,
  type SearchArtist,
  type SearchAlbum,
  type CrossPageResult,
  type AudioFilterState,
} from '../../stores/search-store';
import { useNavigationStore } from '../../stores/navigation-store';
import { usePlayerStore } from '../../stores/player-store';
import {
  SearchIcon,
  MusicNoteIcon,
  UserIcon,
  DiscoverIcon,
  ChevronRightIcon,
  PlaylistIcon,
  FolderIcon,
  TagIcon,
  HeartIcon,
  DownloadIcon,
  SparklesIcon,
  FilterIcon,
  CloseIcon,
  ChevronDownIcon,
  ChevronUpIcon,
} from '@audiio/icons';
import type { UnifiedTrack } from '@audiio/core';

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
  const {
    results,
    isSearching,
    suggestions,
    search,
    searchNatural,
    scope,
    activeBang,
    cleanQuery,
    bangSuggestions,
    crossPageResults,
    // New: NL parsing
    serverParsedQuery,
    isNaturalSearch,
    // New: Audio filters
    audioFilters,
    showFilters,
    activeFilterCount,
    setAudioFilters,
    clearAudioFilters,
    setShowFilters,
    searchWithFilters,
  } = useSearchStore();
  const { openArtist, openAlbum, openPlaylist, navigateTo } = useNavigationStore();
  const { play } = usePlayerStore();
  const [debouncedValue, setDebouncedValue] = useState('');

  // Debounce the search input
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Use cleanQuery (without bang) for actual search
    const searchTerm = cleanQuery || inputValue;
    if (searchTerm.length >= 2) {
      debounceTimerRef.current = setTimeout(() => {
        setDebouncedValue(searchTerm);
      }, 300);
    } else {
      setDebouncedValue('');
    }

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [inputValue, cleanQuery]);

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

  // Handle playlist click
  const handlePlaylistClick = useCallback((playlistId: string) => {
    openPlaylist(playlistId);
    onClose();
  }, [openPlaylist, onClose]);

  // Handle collection click
  const handleCollectionClick = useCallback((collectionId: string) => {
    navigateTo('collection-detail', { selectedCollectionId: collectionId });
    onClose();
  }, [navigateTo, onClose]);

  // Handle tag click
  const handleTagClick = useCallback((tagName: string) => {
    navigateTo('tag-detail', { selectedTagName: tagName });
    onClose();
  }, [navigateTo, onClose]);

  // Handle cross-page result click
  const handleCrossPageClick = useCallback((result: CrossPageResult) => {
    switch (result.type) {
      case 'playlist':
        openPlaylist(result.id);
        break;
      case 'collection':
        navigateTo('collection-detail', { selectedCollectionId: result.id });
        break;
      case 'tag':
        navigateTo('tag-detail', { selectedTagName: result.title.replace('#', '') });
        break;
      case 'liked-track':
        navigateTo('likes');
        break;
      case 'download':
        navigateTo('downloads');
        break;
    }
    onClose();
  }, [openPlaylist, navigateTo, onClose]);

  // Handle bang selection
  const handleBangSelect = useCallback((bang: string) => {
    onFullSearch(bang + ' ');
  }, [onFullSearch]);

  // Handle "See all results"
  const handleSeeAll = useCallback(() => {
    onFullSearch(inputValue);
    onClose();
  }, [inputValue, onFullSearch, onClose]);

  // Handle filter changes - MUST be before early return to maintain hook order
  const handleFilterChange = useCallback((key: keyof AudioFilterState, value: unknown) => {
    setAudioFilters({ [key]: value });
  }, [setAudioFilters]);

  const handleMoodSelect = useCallback((mood: string) => {
    setAudioFilters({ mood: audioFilters.mood === mood ? undefined : mood });
  }, [setAudioFilters, audioFilters.mood]);

  const handleApplyFilters = useCallback(() => {
    searchWithFilters();
  }, [searchWithFilters]);

  if (!isOpen) return null;

  // Group cross-page results by type
  const groupedCrossPage = crossPageResults.reduce((acc, r) => {
    if (!acc[r.type]) acc[r.type] = [];
    acc[r.type].push(r);
    return acc;
  }, {} as Record<string, CrossPageResult[]>);

  const hasCrossPageResults = crossPageResults.length > 0;
  const hasBangSuggestions = bangSuggestions.length > 0;
  const showBangHelp = inputValue === '!' || (inputValue.startsWith('!') && !activeBang);

  // Filter results based on scope
  const filteredTracks = scope === 'all' || scope === 'song' ? results.tracks : [];
  const filteredArtists = scope === 'all' || scope === 'artist' ? results.artists : [];
  const filteredAlbums = scope === 'all' || scope === 'album' ? results.albums : [];

  const hasResults = filteredTracks.length > 0 ||
                     filteredArtists.length > 0 ||
                     filteredAlbums.length > 0 ||
                     results.localTracks.length > 0 ||
                     hasCrossPageResults;

  const showSuggestions = suggestions.length > 0 && debouncedValue.length >= 2 && !hasBangSuggestions;
  const showResults = hasResults && debouncedValue.length >= 2;
  const showEmpty = !isSearching && debouncedValue.length >= 2 && !hasResults && !hasBangSuggestions;
  const showPrompt = inputValue.length < 2 && !showBangHelp;

  // Limit results for dropdown
  const topTracks = filteredTracks.slice(0, 4);
  const topArtists = filteredArtists.slice(0, 3);
  const topAlbums = filteredAlbums.slice(0, 3);

  // Icon helper for cross-page results
  const getCrossPageIcon = (type: string) => {
    switch (type) {
      case 'playlist': return <PlaylistIcon size={16} />;
      case 'collection': return <FolderIcon size={16} />;
      case 'tag': return <TagIcon size={16} />;
      case 'liked-track': return <HeartIcon size={16} />;
      case 'download': return <DownloadIcon size={16} />;
      default: return <SearchIcon size={16} />;
    }
  };

  // Check if we have parsed filters to display
  const hasParsedFilters = serverParsedQuery && (
    serverParsedQuery.filters.length > 0 ||
    serverParsedQuery.audioFeatures ||
    serverParsedQuery.playBehavior
  );

  return (
    <div className="search-dropdown" ref={dropdownRef}>
      {/* Scope indicator when bang is active */}
      {activeBang && (
        <div className="search-dropdown-scope">
          <span className="search-dropdown-scope-badge">{activeBang}</span>
          <span>Searching {SCOPE_CONFIG[scope].label}</span>
        </div>
      )}

      {/* Parsed NL Query Display */}
      {hasParsedFilters && (
        <div className="search-dropdown-parsed">
          <div className="search-dropdown-parsed-header">
            <SparklesIcon size={14} />
            <span>Understood:</span>
          </div>
          <div className="search-dropdown-parsed-chips">
            {serverParsedQuery!.filters.map((filter, i) => (
              <span key={i} className="search-dropdown-parsed-chip">
                {filter.type}: {String(filter.value)}
              </span>
            ))}
            {serverParsedQuery!.audioFeatures?.energy && (
              <span className="search-dropdown-parsed-chip">
                energy: {serverParsedQuery!.audioFeatures.energy.min ?? 0}-{serverParsedQuery!.audioFeatures.energy.max ?? 1}
              </span>
            )}
            {serverParsedQuery!.audioFeatures?.tempo && (
              <span className="search-dropdown-parsed-chip">
                tempo: {serverParsedQuery!.audioFeatures.tempo.min ?? 0}-{serverParsedQuery!.audioFeatures.tempo.max ?? 200} BPM
              </span>
            )}
            {serverParsedQuery!.playBehavior?.neverPlayed && (
              <span className="search-dropdown-parsed-chip">never played</span>
            )}
            {serverParsedQuery!.playBehavior?.minPlays && (
              <span className="search-dropdown-parsed-chip">min {serverParsedQuery!.playBehavior.minPlays} plays</span>
            )}
          </div>
        </div>
      )}

      {/* Audio Filters Panel */}
      {showFilters && (
        <div className="search-dropdown-filters">
          <div className="search-dropdown-filters-header">
            <div className="search-dropdown-filters-title">
              <FilterIcon size={14} />
              <span>Filters</span>
              {activeFilterCount > 0 && (
                <span className="search-dropdown-filters-count">{activeFilterCount}</span>
              )}
            </div>
            <button className="search-dropdown-filters-clear" onClick={clearAudioFilters}>
              Clear
            </button>
          </div>

          <div className="search-dropdown-filters-content">
            {/* Mood chips */}
            <div className="search-dropdown-filter-group">
              <label>Mood</label>
              <div className="search-dropdown-mood-chips">
                {AVAILABLE_MOODS.map((mood) => (
                  <button
                    key={mood.id}
                    className={`search-dropdown-mood-chip ${audioFilters.mood === mood.id ? 'active' : ''}`}
                    onClick={() => handleMoodSelect(mood.id)}
                    title={mood.description}
                  >
                    {mood.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Energy slider */}
            <div className="search-dropdown-filter-group">
              <label>Energy: {Math.round((audioFilters.energyMin ?? 0) * 100)}%+</label>
              <input
                type="range"
                min={0}
                max={100}
                value={(audioFilters.energyMin ?? 0) * 100}
                onChange={(e) => handleFilterChange('energyMin', Number(e.target.value) / 100)}
                className="search-dropdown-slider"
              />
            </div>

            {/* Tempo range */}
            <div className="search-dropdown-filter-group">
              <label>Tempo (BPM)</label>
              <div className="search-dropdown-filter-range">
                <input
                  type="number"
                  placeholder="Min"
                  value={audioFilters.tempoMin ?? ''}
                  onChange={(e) => handleFilterChange('tempoMin', e.target.value ? Number(e.target.value) : undefined)}
                  className="search-dropdown-input"
                />
                <span>-</span>
                <input
                  type="number"
                  placeholder="Max"
                  value={audioFilters.tempoMax ?? ''}
                  onChange={(e) => handleFilterChange('tempoMax', e.target.value ? Number(e.target.value) : undefined)}
                  className="search-dropdown-input"
                />
              </div>
            </div>

            {/* Year range */}
            <div className="search-dropdown-filter-group">
              <label>Year</label>
              <div className="search-dropdown-filter-range">
                <input
                  type="number"
                  placeholder="From"
                  value={audioFilters.yearMin ?? ''}
                  onChange={(e) => handleFilterChange('yearMin', e.target.value ? Number(e.target.value) : undefined)}
                  className="search-dropdown-input"
                />
                <span>-</span>
                <input
                  type="number"
                  placeholder="To"
                  value={audioFilters.yearMax ?? ''}
                  onChange={(e) => handleFilterChange('yearMax', e.target.value ? Number(e.target.value) : undefined)}
                  className="search-dropdown-input"
                />
              </div>
            </div>

            {/* Checkboxes */}
            <div className="search-dropdown-filter-group">
              <label className="search-dropdown-checkbox">
                <input
                  type="checkbox"
                  checked={audioFilters.neverPlayed ?? false}
                  onChange={(e) => handleFilterChange('neverPlayed', e.target.checked || undefined)}
                />
                <span>Never played</span>
              </label>
              <label className="search-dropdown-checkbox">
                <input
                  type="checkbox"
                  checked={audioFilters.likedOnly ?? false}
                  onChange={(e) => handleFilterChange('likedOnly', e.target.checked || undefined)}
                />
                <span>Liked only</span>
              </label>
            </div>

            {/* Apply button */}
            <button className="search-dropdown-filters-apply" onClick={handleApplyFilters}>
              Apply Filters
            </button>
          </div>
        </div>
      )}

      {/* Bang suggestions */}
      {showBangHelp && (
        <div className="search-dropdown-section">
          <div className="search-dropdown-section-title">
            <FilterIcon size={14} />
            <span>Quick Filters</span>
          </div>
          {(hasBangSuggestions ? bangSuggestions : ALL_BANGS).slice(0, 6).map((b) => (
            <button
              key={b.bang}
              className="search-dropdown-item bang-item"
              onClick={() => handleBangSelect(b.bang)}
            >
              <div className="search-dropdown-item-art">
                <span className="bang-code">{b.bang}</span>
              </div>
              <div className="search-dropdown-item-info">
                <div className="search-dropdown-item-title">{b.label}</div>
                <div className="search-dropdown-item-subtitle">{b.description}</div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Loading state */}
      {isSearching && !showBangHelp && (
        <div className="search-dropdown-loading">
          <div className="search-dropdown-spinner" />
          <span>Searching...</span>
        </div>
      )}

      {/* Prompt to type more */}
      {showPrompt && !isSearching && (
        <div className="search-dropdown-prompt">
          <SearchIcon size={20} />
          <span>Search songs, artists, albums... (type ! for filters)</span>
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

          {/* Library Section Divider */}
          {hasCrossPageResults && (topTracks.length > 0 || topArtists.length > 0 || topAlbums.length > 0) && (
            <div className="search-dropdown-divider">
              <span>Your Library</span>
            </div>
          )}

          {/* Cross-Page Results (grouped by type) */}
          {Object.entries(groupedCrossPage).map(([type, items]) => (
            <div key={type} className="search-dropdown-section">
              <div className="search-dropdown-section-title">
                {getCrossPageIcon(type)}
                <span>
                  {type === 'playlist' ? 'Playlists' :
                   type === 'collection' ? 'Collections' :
                   type === 'tag' ? 'Tags' :
                   type === 'liked-track' ? 'Liked Songs' :
                   type === 'download' ? 'Downloads' : type}
                </span>
              </div>
              {items.slice(0, 3).map((result) => (
                <button
                  key={result.id}
                  className="search-dropdown-item"
                  onClick={() => handleCrossPageClick(result)}
                >
                  <div className={`search-dropdown-item-art ${type === 'tag' ? 'tag' : ''}`}>
                    {result.artwork ? (
                      <img src={result.artwork} alt="" />
                    ) : (
                      getCrossPageIcon(type)
                    )}
                  </div>
                  <div className="search-dropdown-item-info">
                    <div className="search-dropdown-item-title">{result.title}</div>
                    <div className="search-dropdown-item-subtitle">{result.subtitle}</div>
                  </div>
                </button>
              ))}
            </div>
          ))}

          {/* See all results */}
          <button className="search-dropdown-see-all" onClick={handleSeeAll}>
            <span>See all results for "{cleanQuery || inputValue}"</span>
            <ChevronRightIcon size={16} />
          </button>
        </>
      )}

      {/* NL Hints (when idle) */}
      {showPrompt && !isSearching && (
        <div className="search-dropdown-hints">
          <SparklesIcon size={14} />
          <span>Try: {NL_HINTS[Math.floor(Math.random() * NL_HINTS.length)]}</span>
        </div>
      )}
    </div>
  );
};

export default SearchDropdown;
