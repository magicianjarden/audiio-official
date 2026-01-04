/**
 * TranslationToggle - Button to enable/disable lyrics translation
 * Shows only when source language is detected (Japanese, Korean, Spanish)
 */

import React, { useMemo } from 'react';
import { TranslateIcon } from '@audiio/icons';
import { useTranslatedLyrics } from '../../hooks/useTranslatedLyrics';
import { useLyricsStore } from '../../stores/lyrics-store';
import { usePluginStore } from '../../stores/plugin-store';
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

  // Translation is available if lyrics provider exists (translation uses external APIs)
  // TODO: Add 'translation-provider' role when translation plugins are implemented
  const hasLyricsProvider = usePluginStore(state => state.hasCapability('lyrics-provider'));
  const isPluginEnabled = hasLyricsProvider; // Translation works when lyrics are available

  // Get raw lyrics to detect language directly
  const rawLyrics = useLyricsStore(state => state.lyrics);

  // Detect language from lyrics (memoized)
  // Include isPluginEnabled to force recalculation when plugin state changes
  const detectedLanguage = useMemo((): SupportedLanguage | null => {
    // If plugin is disabled, don't bother detecting
    if (!isPluginEnabled) return null;
    if (!rawLyrics || rawLyrics.length === 0) return null;
    const texts = rawLyrics.map(line => line.text);
    return detectLanguageFromLines(texts);
  }, [rawLyrics, isPluginEnabled]);

  // Use store language if available (translation started), otherwise use detected
  const sourceLanguage = storeLanguage || detectedLanguage;

  // Don't show if plugin disabled or no supported language detected
  if (!isPluginEnabled || !sourceLanguage) {
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
