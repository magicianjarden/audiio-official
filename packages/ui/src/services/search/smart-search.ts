/**
 * Smart Search - Fuzzy search service using Fuse.js
 *
 * Provides intelligent local library search with:
 * - Fuzzy matching for typos
 * - Natural language query parsing
 * - Weighted scoring across multiple fields
 * - Filter support (artist, album, genre, year)
 */

import Fuse from 'fuse.js';
import type { UnifiedTrack } from '@audiio/core';
import { parseQuery, type ParsedQuery, type QueryFilter } from './query-parser';

export interface SmartSearchResult {
  track: UnifiedTrack;
  score: number;
  matches: MatchInfo[];
}

export interface MatchInfo {
  field: string;
  value: string;
  indices: [number, number][];
}

export interface SmartSearchOptions {
  /** Maximum results to return (default: 50) */
  limit?: number;
  /** Minimum score threshold 0-1 (default: 0.3) */
  threshold?: number;
  /** Include score in results (default: true) */
  includeScore?: boolean;
  /** Include match info (default: false) */
  includeMatches?: boolean;
}

// Fuse.js configuration for optimal music search
const FUSE_OPTIONS: Fuse.IFuseOptions<UnifiedTrack> = {
  // Search these fields with weighted importance
  keys: [
    { name: 'title', weight: 0.35 },
    { name: 'artists.name', weight: 0.30 },
    { name: 'album.title', weight: 0.20 },
    { name: 'genre', weight: 0.10 },
    { name: 'album.releaseDate', weight: 0.05 },
  ],
  // Fuzzy matching settings
  threshold: 0.4, // 0 = exact match, 1 = match anything
  distance: 100, // How far to search for a match
  minMatchCharLength: 2,
  // Performance settings
  ignoreLocation: true, // Match anywhere in string
  useExtendedSearch: true,
  // Include match details
  includeScore: true,
  includeMatches: true,
};

/**
 * SmartSearch class - provides fuzzy search over a track library
 */
export class SmartSearch {
  private fuse: Fuse<UnifiedTrack>;
  private tracks: UnifiedTrack[];

  constructor(tracks: UnifiedTrack[] = []) {
    this.tracks = tracks;
    this.fuse = new Fuse(tracks, FUSE_OPTIONS);
  }

  /**
   * Update the searchable track library
   */
  updateIndex(tracks: UnifiedTrack[]): void {
    this.tracks = tracks;
    this.fuse = new Fuse(tracks, FUSE_OPTIONS);
  }

  /**
   * Add tracks to the index without rebuilding
   */
  addTracks(tracks: UnifiedTrack[]): void {
    for (const track of tracks) {
      if (!this.tracks.some(t => t.id === track.id)) {
        this.tracks.push(track);
      }
    }
    this.fuse = new Fuse(this.tracks, FUSE_OPTIONS);
  }

  /**
   * Search with natural language query support
   */
  search(query: string, options: SmartSearchOptions = {}): SmartSearchResult[] {
    const {
      limit = 50,
      threshold = 0.3,
      includeScore = true,
      includeMatches = false,
    } = options;

    if (!query?.trim()) {
      return [];
    }

    // Parse query for filters
    const parsed = parseQuery(query);

    // If we only have filters and no text, do filtered browse
    if (!parsed.text && parsed.filters.length > 0) {
      return this.filterOnly(parsed.filters, limit);
    }

    // Perform fuzzy search on the text portion
    const results = this.fuse.search(parsed.text, { limit: limit * 2 });

    // Map to our result format
    let mapped: SmartSearchResult[] = results
      .filter(result => {
        // Filter by score threshold
        const score = 1 - (result.score || 0);
        return score >= threshold;
      })
      .map(result => ({
        track: result.item,
        score: 1 - (result.score || 0),
        matches: includeMatches
          ? this.extractMatches(result.matches || [])
          : [],
      }));

    // Apply filters
    if (parsed.filters.length > 0) {
      mapped = this.applyFilters(mapped, parsed.filters);
    }

    return mapped.slice(0, limit);
  }

  /**
   * Quick search - just returns tracks without score/match info
   */
  quickSearch(query: string, limit = 20): UnifiedTrack[] {
    const results = this.search(query, { limit, includeMatches: false });
    return results.map(r => r.track);
  }

  /**
   * Search with parsed query (for when filters are already extracted)
   */
  searchWithParsed(
    parsed: ParsedQuery,
    options: SmartSearchOptions = {}
  ): SmartSearchResult[] {
    const { limit = 50, threshold = 0.3, includeMatches = false } = options;

    // If no text, just filter
    if (!parsed.text) {
      return this.filterOnly(parsed.filters, limit);
    }

    const results = this.fuse.search(parsed.text, { limit: limit * 2 });

    let mapped: SmartSearchResult[] = results
      .filter(result => {
        const score = 1 - (result.score || 0);
        return score >= threshold;
      })
      .map(result => ({
        track: result.item,
        score: 1 - (result.score || 0),
        matches: includeMatches
          ? this.extractMatches(result.matches || [])
          : [],
      }));

    if (parsed.filters.length > 0) {
      mapped = this.applyFilters(mapped, parsed.filters);
    }

    return mapped.slice(0, limit);
  }

  /**
   * Get autocomplete suggestions based on partial input
   */
  getSuggestions(partial: string, limit = 5): string[] {
    if (!partial || partial.length < 2) return [];

    const results = this.fuse.search(partial, { limit: limit * 3 });
    const suggestions = new Set<string>();

    for (const result of results) {
      const track = result.item;

      // Add track title if it matches
      if (track.title.toLowerCase().includes(partial.toLowerCase())) {
        suggestions.add(track.title);
      }

      // Add artist names if they match
      for (const artist of track.artists) {
        if (artist.name.toLowerCase().includes(partial.toLowerCase())) {
          suggestions.add(artist.name);
        }
      }

      // Add album if it matches
      if (
        track.album?.title &&
        track.album.title.toLowerCase().includes(partial.toLowerCase())
      ) {
        suggestions.add(track.album.title);
      }

      if (suggestions.size >= limit) break;
    }

    return Array.from(suggestions).slice(0, limit);
  }

  /**
   * Filter tracks without text search
   */
  private filterOnly(filters: QueryFilter[], limit: number): SmartSearchResult[] {
    let filtered = [...this.tracks];

    for (const filter of filters) {
      filtered = this.applyFilter(filtered, filter);
    }

    return filtered.slice(0, limit).map(track => ({
      track,
      score: 1,
      matches: [],
    }));
  }

  /**
   * Apply filters to search results
   */
  private applyFilters(
    results: SmartSearchResult[],
    filters: QueryFilter[]
  ): SmartSearchResult[] {
    return results.filter(result => {
      for (const filter of filters) {
        if (!this.matchesFilter(result.track, filter)) {
          return false;
        }
      }
      return true;
    });
  }

  /**
   * Apply a single filter to a track list
   */
  private applyFilter(tracks: UnifiedTrack[], filter: QueryFilter): UnifiedTrack[] {
    return tracks.filter(track => this.matchesFilter(track, filter));
  }

  /**
   * Check if a track matches a filter
   */
  private matchesFilter(track: UnifiedTrack, filter: QueryFilter): boolean {
    const value = filter.value.toLowerCase();

    switch (filter.type) {
      case 'artist':
        return track.artists.some(a =>
          a.name.toLowerCase().includes(value)
        );

      case 'album':
        return track.album?.title?.toLowerCase().includes(value) ?? false;

      case 'genre':
        return track.genre?.toLowerCase().includes(value) ?? false;

      case 'year':
        const year = track.album?.releaseDate?.substring(0, 4);
        return year === value;

      case 'liked':
        // This would need integration with library store
        // For now, return true (caller should handle)
        return true;

      case 'playlist':
        // This would need integration with library store
        // For now, return true (caller should handle)
        return true;

      default:
        return true;
    }
  }

  /**
   * Extract match information for highlighting
   */
  private extractMatches(
    fuseMatches: readonly Fuse.FuseResultMatch[]
  ): MatchInfo[] {
    return fuseMatches.map(match => ({
      field: match.key || '',
      value: match.value || '',
      indices: match.indices as [number, number][],
    }));
  }

  /**
   * Get index stats
   */
  getStats(): { trackCount: number } {
    return {
      trackCount: this.tracks.length,
    };
  }
}

// Singleton instance for app-wide use
let smartSearchInstance: SmartSearch | null = null;

/**
 * Get or create the smart search singleton
 */
export function getSmartSearch(): SmartSearch {
  if (!smartSearchInstance) {
    smartSearchInstance = new SmartSearch();
  }
  return smartSearchInstance;
}

/**
 * Initialize smart search with tracks
 */
export function initSmartSearch(tracks: UnifiedTrack[]): SmartSearch {
  if (!smartSearchInstance) {
    smartSearchInstance = new SmartSearch(tracks);
  } else {
    smartSearchInstance.updateIndex(tracks);
  }
  return smartSearchInstance;
}

/**
 * Convenience function for one-off searches
 */
export function smartSearch(
  query: string,
  tracks: UnifiedTrack[],
  options?: SmartSearchOptions
): SmartSearchResult[] {
  const searcher = new SmartSearch(tracks);
  return searcher.search(query, options);
}

export { parseQuery, type ParsedQuery, type QueryFilter };
