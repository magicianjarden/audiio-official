/**
 * Search store - manages search state with multi-type results
 * Enhanced with smart search (fuzzy matching + natural language filters)
 */

import { create } from 'zustand';
import type { UnifiedTrack } from '@audiio/core';
import {
  SmartSearch,
  parseQuery,
  type ParsedQuery,
  type QueryFilter,
  type SmartSearchResult,
} from '../services/search';

// Re-export for convenience
export type { ParsedQuery, QueryFilter, SmartSearchResult };

export interface SearchArtist {
  id: string;
  name: string;
  image?: string;
  followers?: number;
  source: string;
}

export interface SearchAlbum {
  id: string;
  title: string;
  artist: string;
  artwork?: string;
  year?: number;
  trackCount?: number;
  source: string;
}

interface SearchResults {
  tracks: UnifiedTrack[];
  artists: SearchArtist[];
  albums: SearchAlbum[];
  /** Local library matches from smart search */
  localTracks: SmartSearchResult[];
}

interface SearchState {
  query: string;
  results: SearchResults;
  isSearching: boolean;
  error: string | null;
  activeFilter: 'all' | 'tracks' | 'artists' | 'albums' | 'local' | 'lyrics';
  /** Parsed query with extracted filters */
  parsedQuery: ParsedQuery | null;
  /** Smart search instance for local library */
  smartSearch: SmartSearch;
  /** Suggestions for autocomplete */
  suggestions: string[];

  setQuery: (query: string) => void;
  setActiveFilter: (filter: 'all' | 'tracks' | 'artists' | 'albums' | 'local' | 'lyrics') => void;
  search: (query: string) => Promise<void>;
  searchLocal: (query: string, tracks: UnifiedTrack[]) => SmartSearchResult[];
  updateLocalIndex: (tracks: UnifiedTrack[]) => void;
  getSuggestions: (partial: string) => string[];
  clear: () => void;
}

// Create smart search instance
const smartSearchInstance = new SmartSearch();

export const useSearchStore = create<SearchState>((set, get) => ({
  query: '',
  results: { tracks: [], artists: [], albums: [], localTracks: [] },
  isSearching: false,
  error: null,
  activeFilter: 'all',
  parsedQuery: null,
  smartSearch: smartSearchInstance,
  suggestions: [],

  setQuery: (query) => {
    const parsedQuery = parseQuery(query);
    const suggestions = query.length >= 2 ? smartSearchInstance.getSuggestions(query) : [];
    set({ query, parsedQuery, suggestions });
  },

  setActiveFilter: (filter) => {
    set({ activeFilter: filter });
  },

  search: async (query) => {
    if (!query.trim()) {
      set({ results: { tracks: [], artists: [], albums: [], localTracks: [] }, isSearching: false });
      return;
    }

    const parsedQuery = parseQuery(query);
    set({ isSearching: true, error: null, query, parsedQuery });

    try {
      if (window.api) {
        // Search for tracks, artists, and albums in parallel
        const [tracks, artistResults, albumResults] = await Promise.all([
          window.api.search({ query, type: 'track' }),
          window.api.search({ query, type: 'artist' }).catch(() => []),
          window.api.search({ query, type: 'album' }).catch(() => [])
        ]);

        // Extract unique artists from tracks (most reliable source)
        const artistsFromTracks: SearchArtist[] = [];
        const seenArtistNames = new Set<string>();

        for (const track of tracks || []) {
          for (const artist of track.artists || []) {
            const normalizedName = artist.name.toLowerCase().trim();
            if (!seenArtistNames.has(normalizedName)) {
              seenArtistNames.add(normalizedName);
              artistsFromTracks.push({
                id: artist.id || `artist-${normalizedName.replace(/\s+/g, '-')}`,
                name: artist.name,
                image: artist.artwork?.medium || track.artwork?.medium,
                source: track._meta?.metadataProvider || 'unknown'
              });
            }
          }
        }

        // Extract unique albums from tracks (most reliable source)
        const albumsFromTracks: SearchAlbum[] = [];
        const seenAlbumKeys = new Set<string>();

        for (const track of tracks || []) {
          if (track.album && track.album.title) {
            const albumKey = `${track.album.title.toLowerCase().trim()}-${(track.artists[0]?.name || '').toLowerCase().trim()}`;
            if (!seenAlbumKeys.has(albumKey)) {
              seenAlbumKeys.add(albumKey);
              albumsFromTracks.push({
                id: track.album.id || `album-${albumKey.replace(/\s+/g, '-')}`,
                title: track.album.title,
                artist: track.artists[0]?.name || 'Unknown',
                artwork: track.album.artwork?.medium || track.artwork?.medium,
                year: track.album.releaseDate ? parseInt(track.album.releaseDate.substring(0, 4)) : undefined,
                trackCount: track.album.trackCount,
                source: track._meta?.metadataProvider || 'unknown'
              });
            }
          }
        }

        // Try to use API results if they look valid (have proper structure)
        type ArtistResult = { id: string; name: string; artwork?: { medium?: string } };
        type AlbumResult = { id: string; title: string; artists?: Array<{ name: string }>; artwork?: { medium?: string }; releaseDate?: string; trackCount?: number };

        let finalArtists = artistsFromTracks;
        let finalAlbums = albumsFromTracks;

        // Only use API artist results if they have valid name property
        if (Array.isArray(artistResults) && artistResults.length > 0) {
          const firstResult = artistResults[0] as unknown as ArtistResult;
          if (firstResult && typeof firstResult.name === 'string' && firstResult.name.trim()) {
            const apiArtists: SearchArtist[] = [];
            const apiSeenNames = new Set<string>();
            for (const artist of artistResults as ArtistResult[]) {
              if (artist.name && !apiSeenNames.has(artist.name.toLowerCase().trim())) {
                apiSeenNames.add(artist.name.toLowerCase().trim());
                apiArtists.push({
                  id: artist.id,
                  name: artist.name,
                  image: artist.artwork?.medium,
                  source: 'addon'
                });
              }
            }
            if (apiArtists.length > 0) {
              finalArtists = apiArtists;
            }
          }
        }

        // Only use API album results if they have valid title property
        if (Array.isArray(albumResults) && albumResults.length > 0) {
          const firstResult = albumResults[0] as unknown as AlbumResult;
          if (firstResult && typeof firstResult.title === 'string' && firstResult.title.trim()) {
            const apiAlbums: SearchAlbum[] = [];
            const apiSeenKeys = new Set<string>();
            for (const album of albumResults as AlbumResult[]) {
              if (album.title) {
                const key = `${album.title.toLowerCase().trim()}-${(album.artists?.[0]?.name || '').toLowerCase().trim()}`;
                if (!apiSeenKeys.has(key)) {
                  apiSeenKeys.add(key);
                  apiAlbums.push({
                    id: album.id,
                    title: album.title,
                    artist: album.artists?.[0]?.name || 'Unknown Artist',
                    artwork: album.artwork?.medium,
                    year: album.releaseDate ? parseInt(album.releaseDate.substring(0, 4)) : undefined,
                    trackCount: album.trackCount,
                    source: 'addon'
                  });
                }
              }
            }
            if (apiAlbums.length > 0) {
              finalAlbums = apiAlbums;
            }
          }
        }

        // Also search local library with smart search
        const localResults = smartSearchInstance.search(query, { limit: 20 });

        const trackResults = tracks || [];

        set({
          results: {
            tracks: trackResults,
            artists: finalArtists.slice(0, 12),
            albums: finalAlbums.slice(0, 12),
            localTracks: localResults,
          },
          isSearching: false
        });

        // Dispatch event for embedding system to index search results
        if (trackResults.length > 0) {
          window.dispatchEvent(
            new CustomEvent('audiio:search-results', {
              detail: { tracks: trackResults },
            })
          );
        }
      } else {
        // Development mode - only do local search
        const localResults = smartSearchInstance.search(query, { limit: 50 });
        set({
          results: { tracks: [], artists: [], albums: [], localTracks: localResults },
          isSearching: false,
        });
      }
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Search failed',
        isSearching: false
      });
    }
  },

  searchLocal: (query, tracks) => {
    // One-off local search with provided tracks
    const tempSearcher = new SmartSearch(tracks);
    return tempSearcher.search(query);
  },

  updateLocalIndex: (tracks) => {
    // Update the smart search index with new tracks
    smartSearchInstance.updateIndex(tracks);
  },

  getSuggestions: (partial) => {
    return smartSearchInstance.getSuggestions(partial);
  },

  clear: () => {
    set({
      query: '',
      results: { tracks: [], artists: [], albums: [], localTracks: [] },
      error: null,
      activeFilter: 'all',
      parsedQuery: null,
      suggestions: [],
    });
  }
}));
