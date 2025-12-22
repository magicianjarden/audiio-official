/**
 * TranslationToggle - Button to enable/disable lyrics translation
 * Shows only when source language is detected (Japanese, Korean, Spanish)
 */

import React, { useMemo } from 'react';
import { TranslateIcon } from '../Icons/Icons';
import { useTranslatedLyrics } from '../../hooks/useTranslatedLyrics';
import { useLyricsStore } from '../../stores/lyrics-store';
import { detectLanguageFromLines, getLanguageName, type SupportedLanguage } from '../../services/translation';

interface TranslationToggleProps {
  compact?: boolean;
}

export const TranslationToggle: React.FC<TranslationToggleProps> = ({ compact = false }) => {
  const {
    translationEnabled,
    isTranslating,
    translationProgress,
    sourceLanguage: storeLanguage,
    toggleTranslation
  } = useTranslatedLyrics();

  // Get raw lyrics to detect language directly
  const rawLyrics = useLyricsStore(state => state.lyrics);

  // Detect language from lyrics (memoized)
  const detectedLanguage = useMemo((): SupportedLanguage | null => {
    if (!rawLyrics || rawLyrics.length === 0) return null;
    const texts = rawLyrics.map(line => line.text);
    return detectLanguageFromLines(texts);
  }, [rawLyrics]);

  // Use store language if available (translation started), otherwise use detected
  const sourceLanguage = storeLanguage || detectedLanguage;

  // Don't show if no supported language detected
  if (!sourceLanguage) {
    return null;
  }

  const languageName = getLanguageName(sourceLanguage);
  const title = translationEnabled
    ? `Hide ${languageName} translations`
    : `Translate ${languageName} to English`;

  return (
    <button
      className={`translation-toggle ${compact ? 'compact' : ''} ${translationEnabled ? 'active' : ''}`}
      onClick={toggleTranslation}
      title={title}
      disabled={isTranslating}
    >
      <TranslateIcon size={compact ? 14 : 16} />
      {!compact && (
        <span className="translation-toggle-label">
          {isTranslating ? `${translationProgress}%` : 'Translate'}
        </span>
      )}
      {isTranslating && (
        <span className="translation-progress-indicator" />
      )}
    </button>
  );
};

export default TranslationToggle;
