/**
 * useTranslatedLyrics - Hook combining lyrics and translation state
 * Provides lyrics with translations attached and controls
 */

import { useEffect, useMemo, useCallback } from 'react';
import { useLyricsStore, type LyricLine } from '../stores/lyrics-store';
import { useTranslationStore } from '../stores/translation-store';
import { usePlayerStore } from '../stores/player-store';
import type { SupportedLanguage } from '../services/translation';

export interface TranslatedLyricLine extends LyricLine {
  translation?: string;
}

interface UseTranslatedLyricsResult {
  // Lyrics with translations attached
  lyrics: TranslatedLyricLine[] | null;
  plainLyrics: string | null;

  // Current state
  currentLineIndex: number;
  nextLineIndex: number;

  // Translation state
  translationEnabled: boolean;
  isTranslating: boolean;
  translationProgress: number;
  sourceLanguage: SupportedLanguage | null;
  translationError: string | null;

  // Controls
  toggleTranslation: () => void;
  setTranslationEnabled: (enabled: boolean) => void;

  // Lyrics controls (pass-through)
  seekToLine: (index: number) => number;
  offset: number;
  adjustOffset: (delta: number) => void;
  resetOffset: () => void;
}

export function useTranslatedLyrics(): UseTranslatedLyricsResult {
  // Lyrics store
  const {
    lyrics: rawLyrics,
    plainLyrics,
    currentLineIndex,
    nextLineIndex,
    offset,
    seekToLine,
    adjustOffset,
    resetOffset
  } = useLyricsStore();

  // Translation store
  const {
    translationEnabled,
    translations,
    sourceLanguage,
    isTranslating,
    translationProgress,
    error: translationError,
    currentTrackId,
    setTranslationEnabled,
    translateLyrics,
    clearTranslations
  } = useTranslationStore();

  // Player store for track ID
  const currentTrack = usePlayerStore(state => state.currentTrack);
  const trackId = currentTrack?.id ?? null;

  // Auto-translate when lyrics are available and translation is enabled
  useEffect(() => {
    if (!translationEnabled || !rawLyrics || !trackId) {
      return;
    }

    // Only translate if track changed or we don't have translations yet
    if (trackId !== currentTrackId || translations.size === 0) {
      console.log('[Translation] Starting translation for track:', trackId);
      translateLyrics(trackId, rawLyrics);
    }
  }, [translationEnabled, rawLyrics, trackId, currentTrackId, translations.size, translateLyrics]);

  // Log when language is detected
  useEffect(() => {
    if (rawLyrics && rawLyrics.length > 0) {
      const detected = useTranslationStore.getState().detectLanguage(rawLyrics);
      console.log('[Translation] Language detected:', detected || 'none (probably English)');
    }
  }, [rawLyrics]);

  // Clear translations when track changes (if not translating new track)
  useEffect(() => {
    if (trackId && trackId !== currentTrackId && !translationEnabled) {
      clearTranslations();
    }
  }, [trackId, currentTrackId, translationEnabled, clearTranslations]);

  // Combine lyrics with translations
  const lyrics = useMemo((): TranslatedLyricLine[] | null => {
    if (!rawLyrics) return null;

    return rawLyrics.map((line, index) => ({
      ...line,
      translation: translationEnabled ? translations.get(index) : undefined
    }));
  }, [rawLyrics, translations, translationEnabled]);

  // Toggle translation
  const toggleTranslation = useCallback(() => {
    const newEnabled = !translationEnabled;
    setTranslationEnabled(newEnabled);

    // If enabling and we have lyrics, start translation
    if (newEnabled && rawLyrics && trackId) {
      translateLyrics(trackId, rawLyrics);
    }
  }, [translationEnabled, setTranslationEnabled, rawLyrics, trackId, translateLyrics]);

  return {
    lyrics,
    plainLyrics,
    currentLineIndex,
    nextLineIndex,
    translationEnabled,
    isTranslating,
    translationProgress,
    sourceLanguage,
    translationError,
    toggleTranslation,
    setTranslationEnabled,
    seekToLine,
    offset,
    adjustOffset,
    resetOffset
  };
}

// Re-export LyricLine type for convenience
export type { LyricLine };
