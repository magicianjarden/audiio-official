/**
 * Lyrics Search Store - Caches lyrics and enables searching through them
 *
 * This is a Core UI feature that builds an inverted index from lyrics
 * fetched by the lyrics plugin (LRCLIB) to enable searching.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { LyricLine } from './lyrics-store';

export interface CachedLyrics {
  trackId: string;
  title: string;
  artist: string;
  lyrics: LyricLine[] | null;
  plainLyrics: string | null;
  cachedAt: number;
}

export interface LyricsSearchResult {
  trackId: string;
  title: string;
  artist: string;
  matchedLine: string;
  lineIndex: number;
  score: number;
  context: string[]; // Surrounding lines for context
}

interface InvertedIndexEntry {
  trackId: string;
  lineIndex: number;
  position: number; // Word position in line
}

interface LyricsSearchState {
  /** Cached lyrics by track ID */
  cache: Map<string, CachedLyrics>;
  /** Inverted index: word -> tracks/lines containing it */
  invertedIndex: Map<string, InvertedIndexEntry[]>;
  /** Search results */
  searchResults: LyricsSearchResult[];
  /** Search query */
  searchQuery: string;
  /** Loading state */
  isSearching: boolean;

  // Actions
  addToCache: (lyrics: CachedLyrics) => void;
  removeFromCache: (trackId: string) => void;
  search: (query: string) => LyricsSearchResult[];
  clearSearch: () => void;
  getCacheStats: () => { trackCount: number; wordCount: number };
  clearCache: () => void;
}

/**
 * Normalize text for indexing (lowercase, remove punctuation)
 */
function normalizeText(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 1); // Ignore single characters
}

/**
 * Calculate simple relevance score based on match quality
 */
function calculateScore(query: string, line: string): number {
  const queryLower = query.toLowerCase();
  const lineLower = line.toLowerCase();

  // Exact phrase match gets highest score
  if (lineLower.includes(queryLower)) {
    return 1.0;
  }

  // Count word matches
  const queryWords = normalizeText(query);
  const lineWords = normalizeText(line);
  let matchCount = 0;

  for (const qWord of queryWords) {
    if (lineWords.some(lWord => lWord.includes(qWord) || qWord.includes(lWord))) {
      matchCount++;
    }
  }

  return queryWords.length > 0 ? matchCount / queryWords.length : 0;
}

export const useLyricsSearchStore = create<LyricsSearchState>()(
  persist(
    (set, get) => ({
      cache: new Map(),
      invertedIndex: new Map(),
      searchResults: [],
      searchQuery: '',
      isSearching: false,

      addToCache: (lyrics) => {
        const { cache, invertedIndex } = get();

        // Add to cache
        const newCache = new Map(cache);
        newCache.set(lyrics.trackId, lyrics);

        // Build inverted index for this track
        const newIndex = new Map(invertedIndex);
        const lyricsToIndex = lyrics.lyrics ||
          (lyrics.plainLyrics ? lyrics.plainLyrics.split('\n').map((text, i) => ({
            time: i * 1000,
            text
          })) : []);

        for (let lineIndex = 0; lineIndex < lyricsToIndex.length; lineIndex++) {
          const line = lyricsToIndex[lineIndex];
          if (!line?.text) continue;

          const words = normalizeText(line.text);

          for (let position = 0; position < words.length; position++) {
            const word = words[position];
            if (!word || word.length < 2) continue;

            const existing = newIndex.get(word) || [];
            // Avoid duplicates for same track/line
            const alreadyIndexed = existing.some(
              e => e.trackId === lyrics.trackId && e.lineIndex === lineIndex
            );

            if (!alreadyIndexed) {
              newIndex.set(word, [
                ...existing,
                { trackId: lyrics.trackId, lineIndex, position }
              ]);
            }
          }
        }

        set({ cache: newCache, invertedIndex: newIndex });
      },

      removeFromCache: (trackId) => {
        const { cache, invertedIndex } = get();

        // Remove from cache
        const newCache = new Map(cache);
        newCache.delete(trackId);

        // Remove from inverted index
        const newIndex = new Map(invertedIndex);
        for (const [word, entries] of newIndex) {
          const filtered = entries.filter(e => e.trackId !== trackId);
          if (filtered.length === 0) {
            newIndex.delete(word);
          } else {
            newIndex.set(word, filtered);
          }
        }

        set({ cache: newCache, invertedIndex: newIndex });
      },

      search: (query) => {
        if (!query || query.trim().length < 2) {
          set({ searchResults: [], searchQuery: query, isSearching: false });
          return [];
        }

        set({ isSearching: true, searchQuery: query });

        const { cache, invertedIndex } = get();
        const queryWords = normalizeText(query);

        // Find all tracks/lines that contain any of the query words
        const matchingEntries = new Map<string, Set<number>>(); // trackId -> lineIndices

        for (const word of queryWords) {
          // Find exact and partial word matches in index
          for (const [indexedWord, entries] of invertedIndex) {
            if (indexedWord.includes(word) || word.includes(indexedWord)) {
              for (const entry of entries) {
                if (!matchingEntries.has(entry.trackId)) {
                  matchingEntries.set(entry.trackId, new Set());
                }
                matchingEntries.get(entry.trackId)!.add(entry.lineIndex);
              }
            }
          }
        }

        // Build results with scoring
        const results: LyricsSearchResult[] = [];

        for (const [trackId, lineIndices] of matchingEntries) {
          const cached = cache.get(trackId);
          if (!cached) continue;

          const allLines = cached.lyrics ||
            (cached.plainLyrics ? cached.plainLyrics.split('\n').map((text, i) => ({
              time: i * 1000,
              text
            })) : []);

          for (const lineIndex of lineIndices) {
            const line = allLines[lineIndex];
            if (!line?.text) continue;

            const score = calculateScore(query, line.text);
            if (score < 0.3) continue; // Threshold

            // Get context (1 line before and after)
            const context: string[] = [];
            if (lineIndex > 0 && allLines[lineIndex - 1]?.text) {
              context.push(allLines[lineIndex - 1]!.text);
            }
            context.push(line.text);
            if (lineIndex < allLines.length - 1 && allLines[lineIndex + 1]?.text) {
              context.push(allLines[lineIndex + 1]!.text);
            }

            results.push({
              trackId,
              title: cached.title,
              artist: cached.artist,
              matchedLine: line.text,
              lineIndex,
              score,
              context,
            });
          }
        }

        // Sort by score descending
        results.sort((a, b) => b.score - a.score);

        // Limit results
        const limitedResults = results.slice(0, 50);

        set({ searchResults: limitedResults, isSearching: false });
        return limitedResults;
      },

      clearSearch: () => {
        set({ searchResults: [], searchQuery: '', isSearching: false });
      },

      getCacheStats: () => {
        const { cache, invertedIndex } = get();
        return {
          trackCount: cache.size,
          wordCount: invertedIndex.size,
        };
      },

      clearCache: () => {
        set({
          cache: new Map(),
          invertedIndex: new Map(),
          searchResults: [],
          searchQuery: '',
        });
      },
    }),
    {
      name: 'audiio-lyrics-cache',
      // Custom serialization for Map
      storage: {
        getItem: (name) => {
          const str = localStorage.getItem(name);
          if (!str) return null;

          const parsed = JSON.parse(str);
          return {
            state: {
              ...parsed.state,
              cache: new Map(parsed.state.cache || []),
              invertedIndex: new Map(parsed.state.invertedIndex || []),
            },
            version: parsed.version,
          };
        },
        setItem: (name, value) => {
          const toStore = {
            state: {
              ...value.state,
              cache: Array.from(value.state.cache.entries()),
              invertedIndex: Array.from(value.state.invertedIndex.entries()),
              // Don't persist search state
              searchResults: [],
              searchQuery: '',
              isSearching: false,
            },
            version: value.version,
          };
          localStorage.setItem(name, JSON.stringify(toStore));
        },
        removeItem: (name) => localStorage.removeItem(name),
      },
      partialize: (state) => ({
        cache: state.cache,
        invertedIndex: state.invertedIndex,
      }),
    }
  )
);
