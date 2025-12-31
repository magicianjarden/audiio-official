/**
 * Lyrics store - manages lyrics fetching and syncing
 *
 * Supports multiple lyrics formats:
 * - Standard LRC: [mm:ss.xx]Text
 * - Enhanced LRC (ELRC): [mm:ss.xx]<mm:ss.xx>Word - syllable-level timing
 * - SRT: Standard subtitle format
 * - Plain text
 *
 * Optimized with:
 * - Persistent IndexedDB cache for instant loads
 * - Pre-computed word timings stored in cache
 * - Background prefetching on track change
 * - Native word timing from ELRC when available
 */

import { create } from 'zustand';
import { lyricsCache } from '../services/lyrics-cache';
import { parseLyrics, type LyricsFormat } from '../utils/lyrics-parser';

export interface LyricLine {
  time: number; // Time in milliseconds
  text: string;
}

export interface WordTiming {
  word: string;
  startTime: number;
  endTime: number;
  lineIndex: number;
  wordIndex: number;
}

export interface LineWithWords extends LyricLine {
  words: WordTiming[];
}

interface LyricsState {
  // State
  lyrics: LyricLine[] | null;
  plainLyrics: string | null;
  currentLineIndex: number;
  isLoading: boolean;
  error: string | null;
  currentTrackId: string | null;
  offset: number; // Offset in milliseconds for sync adjustment
  nextLineIndex: number; // For upcoming line preview

  // Lyrics format info
  lyricsFormat: LyricsFormat | null;
  hasNativeWordTiming: boolean; // True if ELRC with syllable-level timing

  // Sing-along mode state
  singAlongEnabled: boolean;
  linesWithWords: LineWithWords[] | null;
  currentWordIndex: number; // Current word within current line

  // Actions
  fetchLyrics: (artist: string, track: string, trackId: string) => Promise<void>;
  prefetchLyrics: (artist: string, track: string, trackId: string) => Promise<void>; // Background prefetch
  updateCurrentLine: (positionMs: number) => void;
  clearLyrics: () => void;
  seekToLine: (index: number) => number; // Returns time in ms
  setOffset: (offset: number) => void;
  adjustOffset: (delta: number) => void;
  resetOffset: () => void;

  // Sing-along actions
  setSingAlongEnabled: (enabled: boolean) => void;
  updateCurrentWord: (positionMs: number) => void;
  getWordTimingsForLine: (lineIndex: number) => WordTiming[];

  // Atomic update for seeking - updates line AND word together
  updatePositionAtomic: (positionMs: number) => void;
}


/**
 * Binary search to find the current word index within a line
 */
function findCurrentWordIndex(words: WordTiming[], positionMs: number): number {
  if (words.length === 0) return -1;

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    if (word && positionMs >= word.startTime && positionMs < word.endTime) {
      return i;
    }
  }

  // If past all words, return last word
  const lastWord = words[words.length - 1];
  if (lastWord && positionMs >= lastWord.endTime) {
    return words.length - 1;
  }

  return -1;
}

/**
 * Binary search to find the current lyric line index
 */
function findCurrentLineIndex(lyrics: LyricLine[], positionMs: number): number {
  if (lyrics.length === 0) return -1;

  let left = 0;
  let right = lyrics.length - 1;
  let result = -1;

  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    const lyric = lyrics[mid];
    if (lyric && lyric.time <= positionMs) {
      result = mid;
      left = mid + 1;
    } else {
      right = mid - 1;
    }
  }

  return result;
}

export const useLyricsStore = create<LyricsState>((set, get) => ({
  // Initial state
  lyrics: null,
  plainLyrics: null,
  currentLineIndex: -1,
  nextLineIndex: -1,
  isLoading: false,
  error: null,
  currentTrackId: null,
  offset: 0,

  // Lyrics format info
  lyricsFormat: null,
  hasNativeWordTiming: false,

  // Sing-along mode state
  singAlongEnabled: false,
  linesWithWords: null,
  currentWordIndex: -1,

  // Actions
  fetchLyrics: async (artist, track, trackId) => {
    // Don't refetch if already loaded for this track
    if (get().currentTrackId === trackId && get().lyrics) {
      return;
    }

    set({ isLoading: true, error: null, lyrics: null, plainLyrics: null, currentTrackId: trackId });

    try {
      // Check persistent cache first (instant load!)
      const cached = await lyricsCache.get(trackId);
      if (cached && (cached.lyrics || cached.plainLyrics)) {
        console.log('[LyricsStore] Cache hit - instant load');
        set({
          lyrics: cached.lyrics,
          linesWithWords: cached.linesWithWords,
          plainLyrics: cached.plainLyrics,
          isLoading: false,
          currentLineIndex: -1,
          currentWordIndex: -1
        });
        return;
      }

      let data: { syncedLyrics?: string; plainLyrics?: string; duration?: number } | null = null;

      // Use IPC lyrics API (goes through installed lyrics plugin)
      if (window.api?.lyrics?.search) {
        try {
          const result = await window.api.lyrics.search(artist, track);
          if (result) {
            data = result;
          }
        } catch (e) {
          console.log('[LyricsStore] Lyrics search failed:', e);
          set({ isLoading: false, error: 'No lyrics provider available' });
          return;
        }
      } else {
        set({ isLoading: false, error: 'No lyrics provider installed' });
        return;
      }

      if (!data) {
        set({ isLoading: false, error: 'No lyrics available' });
        return;
      }

      // Prefer synced lyrics, fall back to plain
      if (data.syncedLyrics) {
        // Use multi-format parser (auto-detects LRC, ELRC, SRT)
        const trackDurationMs = data.duration ? data.duration * 1000 : undefined;
        const parsed = parseLyrics(data.syncedLyrics, trackDurationMs);

        console.log(`[LyricsStore] Parsed ${parsed.format} format, native word timing: ${parsed.hasNativeWordTiming}`);

        // Store in persistent cache with pre-computed word timings
        lyricsCache.set({
          id: trackId,
          artist,
          title: track,
          syncedLyrics: data.syncedLyrics,
          plainLyrics: data.plainLyrics || null,
          lyrics: parsed.lines,
          linesWithWords: parsed.linesWithWords,
          duration: data.duration || null
        }).catch(err => console.warn('[LyricsStore] Cache write failed:', err));

        set({
          lyrics: parsed.lines,
          linesWithWords: parsed.linesWithWords,
          lyricsFormat: parsed.format,
          hasNativeWordTiming: parsed.hasNativeWordTiming,
          plainLyrics: data.plainLyrics || null,
          isLoading: false,
          currentLineIndex: -1,
          currentWordIndex: -1
        });
      } else if (data.plainLyrics) {
        // Plain lyrics don't need parsing - just store as-is
        // Cache plain lyrics too
        lyricsCache.set({
          id: trackId,
          artist,
          title: track,
          syncedLyrics: null,
          plainLyrics: data.plainLyrics,
          lyrics: null,
          linesWithWords: null,
          duration: data.duration || null
        }).catch(err => console.warn('[LyricsStore] Cache write failed:', err));

        set({
          lyrics: null,
          plainLyrics: data.plainLyrics,
          lyricsFormat: 'plain',
          hasNativeWordTiming: false,
          isLoading: false
        });
      } else {
        set({ isLoading: false, error: 'No lyrics available' });
      }
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to fetch lyrics'
      });
    }
  },

  // Background prefetch - call when track starts playing (before panel opens)
  prefetchLyrics: async (artist, track, trackId) => {
    // Skip if already cached
    const hasCached = await lyricsCache.has(trackId);
    if (hasCached) {
      console.log('[LyricsStore] Prefetch skipped - already cached');
      return;
    }

    // Don't update UI state during prefetch
    try {
      if (!window.api?.lyrics?.search) return;

      console.log('[LyricsStore] Prefetching lyrics in background...');
      const result = await window.api.lyrics.search(artist, track);

      if (result?.syncedLyrics) {
        // Use multi-format parser
        const trackDurationMs = result.duration ? result.duration * 1000 : undefined;
        const parsed = parseLyrics(result.syncedLyrics, trackDurationMs);

        await lyricsCache.set({
          id: trackId,
          artist,
          title: track,
          syncedLyrics: result.syncedLyrics,
          plainLyrics: result.plainLyrics || null,
          lyrics: parsed.lines,
          linesWithWords: parsed.linesWithWords,
          duration: result.duration || null
        });
        console.log(`[LyricsStore] Prefetch complete (${parsed.format}) - cached for instant load`);
      } else if (result?.plainLyrics) {
        await lyricsCache.set({
          id: trackId,
          artist,
          title: track,
          syncedLyrics: null,
          plainLyrics: result.plainLyrics,
          lyrics: null,
          linesWithWords: null,
          duration: result.duration || null
        });
        console.log('[LyricsStore] Prefetch complete (plain lyrics)');
      }
    } catch (err) {
      // Silent fail for prefetch - user didn't ask for it
      console.log('[LyricsStore] Prefetch failed (silent):', err);
    }
  },

  updateCurrentLine: (positionMs) => {
    const { lyrics, offset } = get();
    if (!lyrics) return;

    // Apply offset adjustment
    const adjustedPosition = positionMs + offset;
    const newIndex = findCurrentLineIndex(lyrics, adjustedPosition);
    const { currentLineIndex } = get();

    // Calculate next line index for preview
    const nextIndex = newIndex < lyrics.length - 1 ? newIndex + 1 : -1;

    if (newIndex !== currentLineIndex) {
      set({ currentLineIndex: newIndex, nextLineIndex: nextIndex });
    }
  },

  clearLyrics: () => {
    set({
      lyrics: null,
      plainLyrics: null,
      linesWithWords: null,
      lyricsFormat: null,
      hasNativeWordTiming: false,
      currentLineIndex: -1,
      nextLineIndex: -1,
      currentWordIndex: -1,
      error: null,
      currentTrackId: null
    });
  },

  seekToLine: (index) => {
    const { lyrics, offset } = get();
    if (!lyrics || index < 0 || index >= lyrics.length) {
      return 0;
    }
    const lyric = lyrics[index];
    // Return time adjusted for offset
    return lyric ? Math.max(0, lyric.time - offset) : 0;
  },

  setOffset: (offset) => {
    set({ offset });
  },

  adjustOffset: (delta) => {
    set(state => ({ offset: state.offset + delta }));
  },

  resetOffset: () => {
    set({ offset: 0 });
  },

  // Sing-along actions
  setSingAlongEnabled: (enabled) => {
    set({ singAlongEnabled: enabled });
  },

  updateCurrentWord: (positionMs) => {
    const { linesWithWords, currentLineIndex, offset, singAlongEnabled } = get();
    if (!singAlongEnabled || !linesWithWords || currentLineIndex < 0) {
      if (get().currentWordIndex !== -1) {
        set({ currentWordIndex: -1 });
      }
      return;
    }

    const currentLine = linesWithWords[currentLineIndex];
    if (!currentLine || !currentLine.words.length) {
      if (get().currentWordIndex !== -1) {
        set({ currentWordIndex: -1 });
      }
      return;
    }

    const adjustedPosition = positionMs + offset;
    const newWordIndex = findCurrentWordIndex(currentLine.words, adjustedPosition);

    if (newWordIndex !== get().currentWordIndex) {
      set({ currentWordIndex: newWordIndex });
    }
  },

  getWordTimingsForLine: (lineIndex) => {
    const { linesWithWords } = get();
    if (!linesWithWords || lineIndex < 0 || lineIndex >= linesWithWords.length) {
      return [];
    }
    return linesWithWords[lineIndex]?.words ?? [];
  },

  // Atomic update for seeking - prevents race conditions between line/word updates
  updatePositionAtomic: (positionMs) => {
    const { lyrics, linesWithWords, offset, singAlongEnabled } = get();
    if (!lyrics) return;

    const adjustedPosition = positionMs + offset;

    // Find current line
    const newLineIndex = findCurrentLineIndex(lyrics, adjustedPosition);
    const nextIndex = newLineIndex < lyrics.length - 1 ? newLineIndex + 1 : -1;

    // Find current word within line (if sing-along enabled)
    let newWordIndex = -1;
    if (singAlongEnabled && linesWithWords && newLineIndex >= 0) {
      const currentLine = linesWithWords[newLineIndex];
      if (currentLine?.words.length) {
        newWordIndex = findCurrentWordIndex(currentLine.words, adjustedPosition);
      }
    }

    // Single atomic update to prevent visual glitches
    set({
      currentLineIndex: newLineIndex,
      nextLineIndex: nextIndex,
      currentWordIndex: newWordIndex
    });
  }
}));
