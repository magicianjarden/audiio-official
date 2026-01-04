/**
 * Lyrics Store - Fetch and manage lyrics state with translation support
 */

import { create } from 'zustand';
import { apiFetch } from './auth-store';

export interface LyricsLine {
  time: number;
  text: string;
  translation?: string;
}

export interface Lyrics {
  plain?: string;
  synced?: LyricsLine[];
  source: string;
}

interface LyricsState {
  lyrics: Lyrics | null;
  isLoading: boolean;
  error: string | null;
  currentTrackId: string | null;
  translationEnabled: boolean;
  isTranslating: boolean;
  translationError: string | null;

  fetchLyrics: (track: {
    id: string;
    title: string;
    artists?: { name: string }[];
    album?: { name?: string; title?: string };
    duration?: number;
  }) => Promise<void>;
  clearLyrics: () => void;
  toggleTranslation: () => void;
  translateLyrics: () => Promise<void>;
}

export const useLyricsStore = create<LyricsState>((set, get) => ({
  lyrics: null,
  isLoading: false,
  error: null,
  currentTrackId: null,
  translationEnabled: false,
  isTranslating: false,
  translationError: null,

  fetchLyrics: async (track) => {
    // Don't re-fetch for same track
    if (get().currentTrackId === track.id && get().lyrics) {
      return;
    }

    set({ isLoading: true, error: null, currentTrackId: track.id });

    try {
      const params = new URLSearchParams({
        title: track.title,
        artist: track.artists?.[0]?.name || '',
      });

      if (track.album?.name || track.album?.title) {
        params.set('album', track.album.name || track.album.title || '');
      }

      if (track.duration) {
        params.set('duration', String(Math.round(track.duration)));
      }

      const response = await apiFetch(`/api/lyrics?${params.toString()}`);

      if (!response.ok) {
        if (response.status === 503) {
          throw new Error('No lyrics provider available');
        }
        throw new Error('Failed to fetch lyrics');
      }

      const lyrics = await response.json();

      // Only update if this is still the current track
      if (get().currentTrackId === track.id) {
        set({ lyrics, isLoading: false });

        // Auto-translate if enabled
        if (get().translationEnabled) {
          get().translateLyrics();
        }
      }
    } catch (error) {
      if (get().currentTrackId === track.id) {
        set({
          error: error instanceof Error ? error.message : 'Failed to load lyrics',
          isLoading: false,
          lyrics: null,
        });
      }
    }
  },

  clearLyrics: () => {
    set({ lyrics: null, currentTrackId: null, error: null });
  },

  toggleTranslation: () => {
    const newEnabled = !get().translationEnabled;
    set({ translationEnabled: newEnabled, translationError: null });

    // If enabling and we have lyrics without translations, translate now
    if (newEnabled && get().lyrics?.synced) {
      const hasTranslations = get().lyrics?.synced?.some(l => l.translation);
      if (!hasTranslations) {
        get().translateLyrics();
      }
    }
  },

  translateLyrics: async () => {
    const { lyrics } = get();
    if (!lyrics?.synced || lyrics.synced.length === 0) return;

    // Check if already has translations
    if (lyrics.synced.some(l => l.translation)) return;

    set({ isTranslating: true, translationError: null });

    try {
      // Combine all lyrics into one text block for efficient translation
      const lyricsText = lyrics.synced
        .map(l => l.text)
        .filter(t => t.trim())
        .join('\n');

      if (!lyricsText.trim()) {
        set({ isTranslating: false });
        return;
      }

      const response = await apiFetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: lyricsText,
          target: 'en',
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMsg = errorData.error || 'Translation service unavailable';
        console.warn('Translation failed:', errorMsg);
        set({ isTranslating: false, translationError: errorMsg, translationEnabled: false });
        return;
      }

      const data = await response.json();
      if (!data.translatedText) {
        set({ isTranslating: false, translationError: 'No translation returned', translationEnabled: false });
        return;
      }

      const translatedLines = data.translatedText.split('\n');

      // Map translations back to lyrics lines
      let translationIndex = 0;
      const updatedSynced = lyrics.synced.map(line => {
        if (line.text.trim()) {
          const translation = translatedLines[translationIndex] || '';
          translationIndex++;
          return { ...line, translation };
        }
        return line;
      });

      set({
        lyrics: { ...lyrics, synced: updatedSynced },
        isTranslating: false,
        translationError: null,
      });
    } catch (error) {
      console.error('Translation error:', error);
      set({
        isTranslating: false,
        translationError: 'Failed to connect to translation service',
        translationEnabled: false
      });
    }
  },
}));

/**
 * Get the current lyric line based on playback position
 * @param lyrics - Array of lyrics lines with time in milliseconds
 * @param positionSeconds - Current playback position in seconds
 */
export function getCurrentLyricIndex(lyrics: LyricsLine[], positionSeconds: number): number {
  // Convert position from seconds to milliseconds to match lyrics time format
  const positionMs = positionSeconds * 1000;

  // Find the last line that starts at or before the current position
  for (let i = lyrics.length - 1; i >= 0; i--) {
    if (lyrics[i].time <= positionMs) {
      return i;
    }
  }
  return -1;
}
