/**
 * Lyrics store - manages lyrics fetching and syncing
 * Uses LRCLib API for synced lyrics
 *
 * Also provides word-level timing for sing-along mode by interpolating
 * word positions based on line duration and word lengths.
 */

import { create } from 'zustand';

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

  // Sing-along mode state
  singAlongEnabled: boolean;
  linesWithWords: LineWithWords[] | null;
  currentWordIndex: number; // Current word within current line

  // Actions
  fetchLyrics: (artist: string, track: string, trackId: string) => Promise<void>;
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
 * Interpolate word timings for a line based on word lengths
 * Words are distributed proportionally by character count within the line duration
 */
function interpolateWordTiming(
  line: LyricLine,
  lineIndex: number,
  nextLineTime: number | null,
  trackDuration?: number
): WordTiming[] {
  const text = line.text.trim();
  if (!text) return [];

  const words = text.split(/\s+/);
  if (words.length === 0) return [];

  // Calculate line duration
  // Use next line time, or estimate 5 seconds if last line
  const defaultDuration = 5000;
  const lineDuration = nextLineTime !== null
    ? Math.min(nextLineTime - line.time, 10000) // Cap at 10 seconds
    : Math.min(trackDuration ? trackDuration - line.time : defaultDuration, 10000);

  // Calculate total characters (for proportional timing)
  const totalChars = words.reduce((sum, word) => sum + word.length, 0);
  if (totalChars === 0) return [];

  // Small gap between words (50ms)
  const wordGap = Math.min(50, lineDuration / (words.length * 4));
  const availableDuration = lineDuration - (wordGap * (words.length - 1));

  let currentTime = line.time;
  const wordTimings: WordTiming[] = [];

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    if (!word) continue;

    // Duration proportional to word length
    const wordDuration = (word.length / totalChars) * availableDuration;

    wordTimings.push({
      word,
      startTime: currentTime,
      endTime: currentTime + wordDuration,
      lineIndex,
      wordIndex: i
    });

    currentTime += wordDuration + wordGap;
  }

  return wordTimings;
}

/**
 * Generate word timings for all lyrics lines
 */
function generateLinesWithWords(lyrics: LyricLine[], trackDuration?: number): LineWithWords[] {
  return lyrics.map((line, index) => {
    const nextLine = lyrics[index + 1];
    const nextLineTime = nextLine ? nextLine.time : null;

    return {
      ...line,
      words: interpolateWordTiming(line, index, nextLineTime, trackDuration)
    };
  });
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
      let data: { syncedLyrics?: string; plainLyrics?: string; duration?: number } | null = null;

      // Try IPC lyrics API first (uses installed lyrics plugin)
      if (window.api?.lyrics?.search) {
        try {
          const result = await window.api.lyrics.search(artist, track);
          if (result) {
            data = result;
          }
        } catch (e) {
          console.log('[LyricsStore] IPC lyrics search failed, falling back to direct fetch');
        }
      }

      // Fallback to direct LRCLib API if no plugin or plugin failed
      if (!data) {
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

        data = await response.json();
      }

      if (!data) {
        set({ isLoading: false, error: 'No lyrics available' });
        return;
      }

      // Prefer synced lyrics, fall back to plain
      if (data.syncedLyrics) {
        const parsedLyrics = parseLRC(data.syncedLyrics);
        // Generate word timings for sing-along mode
        const linesWithWords = generateLinesWithWords(parsedLyrics, data.duration ? data.duration * 1000 : undefined);
        set({
          lyrics: parsedLyrics,
          linesWithWords,
          plainLyrics: data.plainLyrics || null,
          isLoading: false,
          currentLineIndex: -1,
          currentWordIndex: -1
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
      linesWithWords: null,
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
