/**
 * Search store - manages search state with multi-type results
 * Enhanced with smart search (fuzzy matching + natural language filters)
 *
 * Features:
 * - Bang system (!p, !c, !t, !a, !al, !s, !l, !d) for filtered search
 * - Cross-page search (playlists, collections, tags, liked tracks, downloads)
 * - Natural language hints and parsing
 * - Keyboard shortcut support
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

// Import server-side types
import type {
  ParsedQuery as ServerParsedQuery,
  SearchHistoryEntry,
  AudioFilterState,
  SearchSuggestions,
  MoodCluster,
} from '../types/api';

// Re-export these types
export type { SearchHistoryEntry, AudioFilterState, SearchSuggestions, MoodCluster };

// ============================================================================
// Lazy Store Loaders (avoid circular dependencies & repeated require calls)
// ============================================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _libraryStore: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _collectionStore: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _tagStore: any = null;

function getLibraryStore() {
  if (!_libraryStore) {
    _libraryStore = require('./library-store').useLibraryStore;
  }
  return _libraryStore;
}

function getCollectionStore() {
  if (!_collectionStore) {
    _collectionStore = require('./collection-store').useCollectionStore;
  }
  return _collectionStore;
}

function getTagStore() {
  if (!_tagStore) {
    _tagStore = require('./tag-store').useTagStore;
  }
  return _tagStore;
}

// Available moods for filtering
export const AVAILABLE_MOODS = [
  { id: 'energetic', label: 'Energetic', description: 'High energy, positive vibes' },
  { id: 'chill', label: 'Chill', description: 'Relaxed, calm atmosphere' },
  { id: 'happy', label: 'Happy', description: 'Upbeat, positive mood' },
  { id: 'melancholy', label: 'Melancholy', description: 'Sad, emotional tracks' },
  { id: 'acoustic', label: 'Acoustic', description: 'Natural, unplugged sound' },
  { id: 'electronic', label: 'Electronic', description: 'Synth-driven, modern' },
  { id: 'danceable', label: 'Danceable', description: 'Great for dancing' },
  { id: 'focus', label: 'Focus', description: 'Good for concentration' },
] as const;

// ============================================================================
// Bang System Types
// ============================================================================

export type SearchScope =
  | 'all'
  | 'playlist'
  | 'collection'
  | 'tag'
  | 'artist'
  | 'album'
  | 'song'
  | 'liked'
  | 'download';

export interface BangInfo {
  bang: string;
  scope: SearchScope;
  label: string;
  description: string;
}

// Bang definitions
const BANG_MAP: Record<string, SearchScope> = {
  '!p': 'playlist', '!playlist': 'playlist', '!playlists': 'playlist',
  '!c': 'collection', '!col': 'collection', '!collection': 'collection',
  '!t': 'tag', '!tag': 'tag', '!tags': 'tag', '!#': 'tag',
  '!a': 'artist', '!artist': 'artist', '!artists': 'artist',
  '!al': 'album', '!album': 'album', '!albums': 'album',
  '!s': 'song', '!song': 'song', '!track': 'song', '!tracks': 'song',
  '!l': 'liked', '!like': 'liked', '!liked': 'liked', '!heart': 'liked',
  '!d': 'download', '!dl': 'download', '!downloads': 'download',
  '!all': 'all', '!everything': 'all',
};

export const SCOPE_CONFIG: Record<SearchScope, { label: string; icon: string }> = {
  all: { label: 'Everything', icon: 'SearchIcon' },
  playlist: { label: 'Playlists', icon: 'PlaylistIcon' },
  collection: { label: 'Collections', icon: 'FolderIcon' },
  tag: { label: 'Tags', icon: 'TagIcon' },
  artist: { label: 'Artists', icon: 'UserIcon' },
  album: { label: 'Albums', icon: 'DiscoverIcon' },
  song: { label: 'Songs', icon: 'MusicNoteIcon' },
  liked: { label: 'Liked Songs', icon: 'HeartIcon' },
  download: { label: 'Downloads', icon: 'DownloadIcon' },
};

export const ALL_BANGS: BangInfo[] = [
  { bang: '!p', scope: 'playlist', label: 'Playlists', description: 'Search playlists' },
  { bang: '!c', scope: 'collection', label: 'Collections', description: 'Search collections' },
  { bang: '!t', scope: 'tag', label: 'Tags', description: 'Search tags' },
  { bang: '!a', scope: 'artist', label: 'Artists', description: 'Search artists' },
  { bang: '!al', scope: 'album', label: 'Albums', description: 'Search albums' },
  { bang: '!s', scope: 'song', label: 'Songs', description: 'Search songs' },
  { bang: '!l', scope: 'liked', label: 'Liked', description: 'Search liked songs' },
  { bang: '!d', scope: 'download', label: 'Downloads', description: 'Search downloads' },
];

// ============================================================================
// Cross-Page Search Types
// ============================================================================

export interface CrossPageResult {
  type: 'playlist' | 'collection' | 'tag' | 'liked-track' | 'download';
  id: string;
  title: string;
  subtitle?: string;
  artwork?: string;
  count?: number;
  matchScore: number;
}

// ============================================================================
// Natural Language Hints
// ============================================================================

export const NL_HINTS = [
  'chill acoustic songs',
  'upbeat 90s rock',
  'never played jazz',
  'songs by [artist]',
  'similar to [artist]',
  '#workout energetic',
];

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

// Plugin-provided result types
export interface SearchVideo {
  id: string;
  title: string;
  thumbnail: string;
  publishedAt?: string;
  viewCount?: number;
  duration?: string;
  url: string;
  source: string;
}

export interface SearchPlaylist {
  id: string;
  name: string;
  description?: string;
  trackCount: number;
  artwork?: string;
  isSmartPlaylist: boolean;
  source: string;
}

export interface SearchConcert {
  id: string;
  datetime: string;
  venue: {
    name: string;
    city: string;
    region?: string;
    country: string;
  };
  lineup: string[];
  ticketUrl?: string;
  source: string;
}

interface SearchResults {
  tracks: UnifiedTrack[];
  artists: SearchArtist[];
  albums: SearchAlbum[];
  /** Local library matches from smart search */
  localTracks: SmartSearchResult[];
  /** Plugin-provided video results */
  videos: SearchVideo[];
  /** Plugin-provided playlist results */
  playlists: SearchPlaylist[];
  /** Plugin-provided concert results */
  concerts: SearchConcert[];
}

// ============================================================================
// Helper Functions
// ============================================================================

/** Parse query for bangs - returns scope and clean query */
function parseBang(input: string): { scope: SearchScope; query: string; bangUsed?: string } {
  const trimmed = input.trim();
  if (!trimmed) return { scope: 'all', query: '' };

  const match = trimmed.match(/^(![\w#]+)\s*(.*)/i);
  if (match) {
    const [, bang, rest] = match;
    const scope = BANG_MAP[bang!.toLowerCase()];
    if (scope) {
      return { scope, query: rest?.trim() || '', bangUsed: bang };
    }
  }
  return { scope: 'all', query: trimmed };
}

/** Get bang suggestions for partial input */
export function getBangSuggestions(input: string): BangInfo[] {
  if (!input.startsWith('!')) return [];
  const partial = input.toLowerCase();
  const seen = new Set<SearchScope>();
  return ALL_BANGS.filter(b => {
    if (b.bang.startsWith(partial) && !seen.has(b.scope)) {
      seen.add(b.scope);
      return true;
    }
    return false;
  }).slice(0, 6);
}

/** Calculate fuzzy match score */
function matchScore(text: string, query: string): number {
  const t = text.toLowerCase();
  const q = query.toLowerCase();
  if (t === q) return 100;
  if (t.startsWith(q)) return 90;
  const idx = t.indexOf(q);
  if (idx !== -1) return 70 - (idx / t.length) * 20;
  const words = t.split(/\s+/);
  for (let i = 0; i < words.length; i++) {
    if (words[i].startsWith(q)) return 60 - i * 5;
  }
  return 0;
}

/** Count active audio filters */
function countActiveFilters(filters: AudioFilterState): number {
  let count = 0;
  if (filters.energyMin !== undefined || filters.energyMax !== undefined) count++;
  if (filters.tempoMin !== undefined || filters.tempoMax !== undefined) count++;
  if (filters.valenceMin !== undefined || filters.valenceMax !== undefined) count++;
  if (filters.danceabilityMin !== undefined || filters.danceabilityMax !== undefined) count++;
  if (filters.acousticnessMin !== undefined || filters.acousticnessMax !== undefined) count++;
  if (filters.neverPlayed) count++;
  if (filters.likedOnly) count++;
  if (filters.yearMin !== undefined || filters.yearMax !== undefined) count++;
  if (filters.mood) count++;
  return count;
}

/** Initial empty audio filters */
const initialAudioFilters: AudioFilterState = {};

// ============================================================================
// Store Interface
// ============================================================================

interface SearchState {
  query: string;
  results: SearchResults;
  isSearching: boolean;
  error: string | null;
  activeFilter: 'all' | 'tracks' | 'artists' | 'albums' | 'local' | 'lyrics';
  /** Parsed query with extracted filters (client-side) */
  parsedQuery: ParsedQuery | null;
  /** Smart search instance for local library */
  smartSearch: SmartSearch;
  /** Suggestions for autocomplete */
  suggestions: string[];

  // === Bang System ===
  /** Current search scope from bang */
  scope: SearchScope;
  /** The bang that was used (e.g., "!p") */
  activeBang: string | null;
  /** Clean query without bang prefix */
  cleanQuery: string;
  /** Bang suggestions based on current input */
  bangSuggestions: BangInfo[];

  // === Cross-Page Results ===
  /** Results from playlists, collections, tags, etc. */
  crossPageResults: CrossPageResult[];

  // === Search History ===
  /** Search history entries */
  searchHistory: SearchHistoryEntry[];
  /** Whether history popover is open */
  showHistory: boolean;
  /** Loading state for history */
  isLoadingHistory: boolean;

  // === Natural Language Search ===
  /** Server-parsed query with audio features, moods, etc. */
  serverParsedQuery: ServerParsedQuery | null;
  /** Whether using natural language search mode */
  isNaturalSearch: boolean;

  // === Audio Filters ===
  /** Current audio filter state */
  audioFilters: AudioFilterState;
  /** Whether filter panel is visible */
  showFilters: boolean;
  /** Count of active filters */
  activeFilterCount: number;

  // === Actions ===
  setQuery: (query: string) => void;
  setActiveFilter: (filter: 'all' | 'tracks' | 'artists' | 'albums' | 'local' | 'lyrics') => void;
  search: (query: string) => Promise<void>;
  searchLocal: (query: string, tracks: UnifiedTrack[]) => SmartSearchResult[];
  updateLocalIndex: (tracks: UnifiedTrack[]) => void;
  getSuggestions: (partial: string) => string[];
  clear: () => void;

  // === Cross-Page Search ===
  searchCrossPage: (query: string) => void;

  // === Search History Actions ===
  loadHistory: () => Promise<void>;
  clearHistory: () => Promise<void>;
  removeHistoryItem: (id: string) => Promise<void>;
  setShowHistory: (show: boolean) => void;
  useHistoryItem: (entry: SearchHistoryEntry) => void;

  // === Natural Language Search Actions ===
  searchNatural: (query: string) => Promise<void>;

  // === Audio Filter Actions ===
  setAudioFilters: (filters: Partial<AudioFilterState>) => void;
  clearAudioFilters: () => void;
  setShowFilters: (show: boolean) => void;
  searchWithFilters: () => Promise<void>;
}

// Create smart search instance
const smartSearchInstance = new SmartSearch();

// Helper to fetch plugin search data (videos, playlists, concerts)
async function fetchPluginSearchData(query: string): Promise<{
  videos: SearchVideo[];
  playlists: SearchPlaylist[];
  concerts: SearchConcert[];
}> {
  const baseUrl = window.api?.getServerUrl?.() || 'http://localhost:3333';

  // Fetch all plugin data in parallel
  const [videosRes, playlistsRes, concertsRes] = await Promise.allSettled([
    fetch(`${baseUrl}/api/search/videos?q=${encodeURIComponent(query)}&limit=8`).then(r => r.json()),
    fetch(`${baseUrl}/api/search/playlists?q=${encodeURIComponent(query)}&limit=6`).then(r => r.json()),
    fetch(`${baseUrl}/api/search/concerts?q=${encodeURIComponent(query)}&limit=4`).then(r => r.json()),
  ]);

  return {
    videos: videosRes.status === 'fulfilled' ? (videosRes.value?.videos || []) : [],
    playlists: playlistsRes.status === 'fulfilled' ? (playlistsRes.value?.playlists || []) : [],
    concerts: concertsRes.status === 'fulfilled' ? (concertsRes.value?.concerts || []) : [],
  };
}

export const useSearchStore = create<SearchState>((set, get) => ({
  query: '',
  results: { tracks: [], artists: [], albums: [], localTracks: [], videos: [], playlists: [], concerts: [] },
  isSearching: false,
  error: null,
  activeFilter: 'all',
  parsedQuery: null,
  smartSearch: smartSearchInstance,
  suggestions: [],

  // Bang system state
  scope: 'all',
  activeBang: null,
  cleanQuery: '',
  bangSuggestions: [],

  // Cross-page results
  crossPageResults: [],

  // Search history
  searchHistory: [],
  showHistory: false,
  isLoadingHistory: false,

  // Natural language search
  serverParsedQuery: null,
  isNaturalSearch: false,

  // Audio filters
  audioFilters: initialAudioFilters,
  showFilters: false,
  activeFilterCount: 0,

  setQuery: (query) => {
    // Parse for bangs
    const { scope, query: cleanQuery, bangUsed } = parseBang(query);
    const bangSuggestions = getBangSuggestions(query);

    // Parse for NL filters
    const parsedQuery = parseQuery(cleanQuery);
    const suggestions = cleanQuery.length >= 2 ? smartSearchInstance.getSuggestions(cleanQuery) : [];

    set({
      query,
      cleanQuery,
      scope,
      activeBang: bangUsed || null,
      bangSuggestions,
      parsedQuery,
      suggestions,
    });

    // Trigger cross-page search if query is long enough
    if (cleanQuery.length >= 2) {
      get().searchCrossPage(cleanQuery);
    } else {
      set({ crossPageResults: [] });
    }
  },

  setActiveFilter: (filter) => {
    set({ activeFilter: filter });
  },

  search: async (query) => {
    if (!query.trim()) {
      set({ results: { tracks: [], artists: [], albums: [], localTracks: [], videos: [], playlists: [], concerts: [] }, isSearching: false });
      return;
    }

    const parsedQuery = parseQuery(query);
    const { scope } = get();
    set({ isSearching: true, error: null, query, parsedQuery });

    try {
      if (window.api) {
        // Only search types based on scope
        const shouldSearchTracks = scope === 'all' || scope === 'song';
        const shouldSearchArtists = scope === 'all' || scope === 'artist';
        const shouldSearchAlbums = scope === 'all' || scope === 'album';

        // Search only the relevant types in parallel
        const [tracks, artistResults, albumResults] = await Promise.all([
          shouldSearchTracks ? window.api.search({ query, type: 'track' }) : Promise.resolve([]),
          shouldSearchArtists ? window.api.search({ query, type: 'artist' }).catch(() => []) : Promise.resolve([]),
          shouldSearchAlbums ? window.api.search({ query, type: 'album' }).catch(() => []) : Promise.resolve([])
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

        // Deduplicate tracks by ID (API may return duplicates)
        const seenTrackIds = new Set<string>();
        const trackResults = (tracks || []).filter((track: UnifiedTrack) => {
          if (seenTrackIds.has(track.id)) return false;
          seenTrackIds.add(track.id);
          return true;
        });

        // Set initial results immediately (tracks, artists, albums)
        set({
          results: {
            tracks: trackResults,
            artists: finalArtists.slice(0, 12),
            albums: finalAlbums.slice(0, 12),
            localTracks: localResults,
            videos: [],
            playlists: [],
            concerts: [],
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

        // Fetch plugin data in the background (don't block main results)
        fetchPluginSearchData(query).then(pluginData => {
          const current = get().results;
          set({
            results: {
              ...current,
              videos: pluginData.videos,
              playlists: pluginData.playlists,
              concerts: pluginData.concerts,
            }
          });
        }).catch(err => {
          console.warn('[SearchStore] Plugin data fetch failed:', err);
        });

      } else {
        // Development mode - only do local search
        const localResults = smartSearchInstance.search(query, { limit: 50 });
        set({
          results: { tracks: [], artists: [], albums: [], localTracks: localResults, videos: [], playlists: [], concerts: [] },
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
      cleanQuery: '',
      scope: 'all',
      activeBang: null,
      bangSuggestions: [],
      results: { tracks: [], artists: [], albums: [], localTracks: [], videos: [], playlists: [], concerts: [] },
      crossPageResults: [],
      error: null,
      activeFilter: 'all',
      parsedQuery: null,
      suggestions: [],
      serverParsedQuery: null,
      isNaturalSearch: false,
      audioFilters: initialAudioFilters,
      activeFilterCount: 0,
    });
  },

  searchCrossPage: (query: string) => {
    try {
      // Use cached lazy loaders to avoid repeated require() calls
      const useLibraryStore = getLibraryStore();
      const useCollectionStore = getCollectionStore();
      const useTagStore = getTagStore();

      // Guard against uninitialized stores
      if (!useLibraryStore || !useCollectionStore || !useTagStore) {
        return;
      }

      const results: CrossPageResult[] = [];
      const { scope } = get();

      // Search playlists
      if (scope === 'all' || scope === 'playlist') {
        const { playlists } = useLibraryStore.getState();
        (playlists || []).forEach((p: { id: string; name: string; tracks?: unknown[]; artwork?: string }) => {
          const score = matchScore(p.name, query);
          if (score > 0) {
            results.push({
              type: 'playlist',
              id: p.id,
              title: p.name,
              subtitle: `${p.tracks?.length || 0} songs`,
              artwork: p.artwork,
              count: p.tracks?.length || 0,
              matchScore: score,
            });
          }
        });
      }

      // Search collections
      if (scope === 'all' || scope === 'collection') {
        const { collections } = useCollectionStore.getState();
        (collections || []).forEach((c: { id: string; name: string; description?: string; itemCount: number; coverImage?: string }) => {
          const score = matchScore(c.name, query);
          if (score > 0) {
            results.push({
              type: 'collection',
              id: c.id,
              title: c.name,
              subtitle: c.description || `${c.itemCount} items`,
              artwork: c.coverImage,
              count: c.itemCount,
              matchScore: score,
            });
          }
        });
      }

      // Search tags
      if (scope === 'all' || scope === 'tag') {
        const { tags } = useTagStore.getState();
        (tags || []).forEach((t: { id: string; name: string; usageCount: number }) => {
          const score = matchScore(t.name, query);
          if (score > 0) {
            results.push({
              type: 'tag',
              id: t.id,
              title: `#${t.name}`,
              subtitle: `${t.usageCount} tracks`,
              count: t.usageCount,
              matchScore: score,
            });
          }
        });
      }

      // Search liked tracks
      if (scope === 'all' || scope === 'liked') {
        const { likedTracks } = useLibraryStore.getState();
        const likedMatches: CrossPageResult[] = [];
        (likedTracks || []).slice(0, 100).forEach((lt: { track: UnifiedTrack }) => {
          const titleScore = matchScore(lt.track?.title || '', query);
          const artistScore = matchScore(lt.track?.artists?.map((a: { name: string }) => a.name).join(' ') || '', query);
          const score = Math.max(titleScore, artistScore * 0.9);
          if (score > 0) {
            likedMatches.push({
              type: 'liked-track',
              id: lt.track?.id || '',
              title: lt.track?.title || 'Unknown',
              subtitle: lt.track?.artists?.map((a: { name: string }) => a.name).join(', ') || 'Unknown Artist',
              artwork: lt.track?.artwork?.small,
              matchScore: score,
            });
          }
        });
        likedMatches.sort((a, b) => b.matchScore - a.matchScore).slice(0, 5).forEach(m => results.push(m));
      }

      // Search downloads
      if (scope === 'all' || scope === 'download') {
        const { downloads } = useLibraryStore.getState();
        (downloads || []).forEach((dl: { id: string; track?: UnifiedTrack; filename: string; status: string }) => {
          if (!dl.track) return;
          const score = matchScore(dl.track.title || dl.filename, query);
          if (score > 0) {
            results.push({
              type: 'download',
              id: dl.id,
              title: dl.track.title || dl.filename,
              subtitle: dl.status === 'completed' ? 'Downloaded' : dl.status,
              artwork: dl.track.artwork?.small,
              matchScore: score,
            });
          }
        });
      }

      // Sort by score and limit
      results.sort((a, b) => b.matchScore - a.matchScore);
      set({ crossPageResults: results.slice(0, 15) });
    } catch (error) {
      // Silently handle errors during cross-page search to prevent crashes
      console.warn('[SearchStore] Cross-page search error:', error);
      set({ crossPageResults: [] });
    }
  },

  // =========================================================================
  // Search History Actions
  // =========================================================================

  loadHistory: async () => {
    set({ isLoadingHistory: true });
    try {
      const history = await window.api?.advancedSearch?.getHistory(20);
      if (history) {
        set({ searchHistory: history, isLoadingHistory: false });
      } else {
        set({ isLoadingHistory: false });
      }
    } catch (error) {
      console.error('[SearchStore] Failed to load history:', error);
      set({ isLoadingHistory: false });
    }
  },

  clearHistory: async () => {
    try {
      await window.api?.advancedSearch?.clearHistory();
      set({ searchHistory: [] });
    } catch (error) {
      console.error('[SearchStore] Failed to clear history:', error);
    }
  },

  removeHistoryItem: async (id: string) => {
    try {
      await window.api?.advancedSearch?.deleteHistory(id);
      set({
        searchHistory: get().searchHistory.filter((h) => h.id !== id),
      });
    } catch (error) {
      console.error('[SearchStore] Failed to remove history item:', error);
    }
  },

  setShowHistory: (show: boolean) => {
    set({ showHistory: show });
    // Load history when opening
    if (show && get().searchHistory.length === 0) {
      get().loadHistory();
    }
  },

  useHistoryItem: (entry: SearchHistoryEntry) => {
    set({ query: entry.query, showHistory: false });
    get().searchNatural(entry.query);
  },

  // =========================================================================
  // Natural Language Search Actions
  // =========================================================================

  searchNatural: async (query: string) => {
    if (!query.trim()) return;

    set({
      isSearching: true,
      isNaturalSearch: true,
      query,
      error: null,
    });

    try {
      const result = await window.api?.advancedSearch?.natural(query);

      if (result) {
        set({
          results: {
            tracks: result.tracks,
            artists: [],
            albums: [],
            localTracks: [],
          },
          serverParsedQuery: result.parsedQuery,
          isSearching: false,
        });

        // Dispatch event for embedding system
        if (result.tracks.length > 0) {
          window.dispatchEvent(
            new CustomEvent('audiio:search-results', {
              detail: { tracks: result.tracks },
            })
          );
        }
      } else {
        // Fallback to regular search if natural search not available
        set({ isNaturalSearch: false });
        get().search(query);
      }
    } catch (error) {
      console.error('[SearchStore] Natural search failed:', error);
      set({
        error: error instanceof Error ? error.message : 'Search failed',
        isSearching: false,
        isNaturalSearch: false,
      });
      // Fallback to regular search
      get().search(query);
    }
  },

  // =========================================================================
  // Audio Filter Actions
  // =========================================================================

  setAudioFilters: (updates: Partial<AudioFilterState>) => {
    const newFilters = { ...get().audioFilters, ...updates };
    set({
      audioFilters: newFilters,
      activeFilterCount: countActiveFilters(newFilters),
    });
  },

  clearAudioFilters: () => {
    set({
      audioFilters: initialAudioFilters,
      activeFilterCount: 0,
    });
  },

  setShowFilters: (show: boolean) => {
    set({ showFilters: show });
  },

  searchWithFilters: async () => {
    const { query, audioFilters } = get();

    set({ isSearching: true, error: null });

    try {
      // Build filter params
      const params: Record<string, unknown> = {
        q: query || undefined,
        limit: 50,
        offset: 0,
      };

      // Add audio feature filters
      if (audioFilters.energyMin !== undefined) params.energyMin = audioFilters.energyMin;
      if (audioFilters.energyMax !== undefined) params.energyMax = audioFilters.energyMax;
      if (audioFilters.tempoMin !== undefined) params.tempoMin = audioFilters.tempoMin;
      if (audioFilters.tempoMax !== undefined) params.tempoMax = audioFilters.tempoMax;
      if (audioFilters.valenceMin !== undefined) params.valenceMin = audioFilters.valenceMin;
      if (audioFilters.valenceMax !== undefined) params.valenceMax = audioFilters.valenceMax;
      if (audioFilters.yearMin !== undefined) params.yearMin = audioFilters.yearMin;
      if (audioFilters.yearMax !== undefined) params.yearMax = audioFilters.yearMax;

      // Use audio feature index for mood/feature queries
      if (audioFilters.mood || Object.keys(audioFilters).some(k => k.includes('Min') || k.includes('Max'))) {
        const featureResult = await window.api?.audioFeatureIndex?.query({
          energyMin: audioFilters.energyMin,
          energyMax: audioFilters.energyMax,
          tempoMin: audioFilters.tempoMin,
          tempoMax: audioFilters.tempoMax,
          valenceMin: audioFilters.valenceMin,
          valenceMax: audioFilters.valenceMax,
          danceabilityMin: audioFilters.danceabilityMin,
          danceabilityMax: audioFilters.danceabilityMax,
          acousticnessMin: audioFilters.acousticnessMin,
          acousticnessMax: audioFilters.acousticnessMax,
        }, 50, 0);

        if (featureResult) {
          set({
            results: {
              tracks: featureResult.tracks,
              artists: [],
              albums: [],
              localTracks: [],
            },
            isSearching: false,
          });
          return;
        }
      }

      // Fallback to advanced search
      const result = await window.api?.advancedSearch?.advanced(params as any);

      if (result) {
        set({
          results: {
            tracks: result.tracks,
            artists: [],
            albums: [],
            localTracks: [],
          },
          isSearching: false,
        });
      } else {
        set({ isSearching: false });
      }
    } catch (error) {
      console.error('[SearchStore] Filter search failed:', error);
      set({
        error: error instanceof Error ? error.message : 'Search failed',
        isSearching: false,
      });
    }
  },
}));
