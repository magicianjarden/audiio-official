/**
 * Lyrics store - manages lyrics fetching and syncing
 * Uses LRCLib API for synced lyrics
 */

import { create } from 'zustand';

export interface LyricLine {
  time: number; // Time in milliseconds
  text: string;
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

  // Actions
  fetchLyrics: (artist: string, track: string, trackId: string) => Promise<void>;
  updateCurrentLine: (positionMs: number) => void;
  clearLyrics: () => void;
  seekToLine: (index: number) => number; // Returns time in ms
  setOffset: (offset: number) => void;
  adjustOffset: (delta: number) => void;
  resetOffset: () => void;
}

/**
 * Parse LRC format lyrics into structured array
 * Format: [mm:ss.xx]Lyric text
 */
function parseLRC(lrc: string): LyricLine[] {
  const lines: LyricLine[] = [];
  const regex = /\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)$/;

  for (const line of lrc.split('\n')) {
    const match = regex.exec(line.trim());
    if (match && match[1] && match[2] && match[3]) {
      const minutes = parseInt(match[1], 10);
      const seconds = parseInt(match[2], 10);
      // Handle both .xx and .xxx formats
      let centiseconds = parseInt(match[3], 10);
      if (match[3].length === 2) {
        centiseconds *= 10; // Convert centiseconds to milliseconds
      }
      const text = match[4]?.trim() ?? '';

      const time = (minutes * 60 + seconds) * 1000 + centiseconds;
      lines.push({ time, text });
    }
  }

  // Sort by time (should already be sorted, but just in case)
  lines.sort((a, b) => a.time - b.time);

  return lines;
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

  // Actions
  fetchLyrics: async (artist, track, trackId) => {
    // Don't refetch if already loaded for this track
    if (get().currentTrackId === trackId && get().lyrics) {
      return;
    }

    set({ isLoading: true, error: null, lyrics: null, plainLyrics: null, currentTrackId: trackId });

    try {
      const params = new URLSearchParams({
        artist_name: artist,
        track_name: track
      });

      const response = await fetch(`https://lrclib.net/api/get?${params.toString()}`);

      if (!response.ok) {
        if (response.status === 404) {
          set({ isLoading: false, error: 'Lyrics not found' });
          return;
        }
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      // Prefer synced lyrics, fall back to plain
      if (data.syncedLyrics) {
        const parsedLyrics = parseLRC(data.syncedLyrics);
        set({
          lyrics: parsedLyrics,
          plainLyrics: data.plainLyrics || null,
          isLoading: false,
          currentLineIndex: -1
        });
      } else if (data.plainLyrics) {
        set({
          lyrics: null,
          plainLyrics: data.plainLyrics,
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
      currentLineIndex: -1,
      nextLineIndex: -1,
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
  }
}));
