/**
 * Translation Service - Orchestrates translation workflow
 * Flow: Detect language -> Check cache -> Batch uncached -> Call API -> Cache results
 */

import { translationCache, type SupportedLanguage } from './translation-cache';
import { detectLanguageFromLines } from './language-detector';
import { libreTranslateClient } from './libre-translate-client';

export interface LyricLine {
  time: number;
  text: string;
}

export interface TranslationResult {
  translations: Map<number, string>;
  sourceLanguage: SupportedLanguage;
  fromCache: boolean;
  linesTranslated: number;
  linesCached: number;
}

export type TranslationProgress = (progress: number) => void;

class TranslationService {
  private initialized = false;

  /**
   * Initialize the translation service (call once on app start)
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    await translationCache.initialize();

    // Clean up expired entries on startup
    const deleted = await translationCache.clearExpired();
    if (deleted > 0) {
      console.log(`Translation cache: cleaned ${deleted} expired entries`);
    }

    this.initialized = true;
  }

  /**
   * Main entry point: Translate lyrics for a track
   */
  async translateLyrics(
    trackId: string,
    lines: LyricLine[],
    onProgress?: TranslationProgress
  ): Promise<TranslationResult | null> {
    await this.initialize();

    // Extract text from lyrics
    const texts = lines.map(line => line.text);

    // Detect source language
    const sourceLanguage = detectLanguageFromLines(texts);
    if (!sourceLanguage) {
      // No supported language detected (likely English or unknown)
      return null;
    }

    // Check cache for existing translations
    const cachedTranslations = await translationCache.getBatchTranslations(trackId);

    // If we have all translations cached, return early
    if (cachedTranslations.size === lines.length) {
      return {
        translations: cachedTranslations,
        sourceLanguage,
        fromCache: true,
        linesTranslated: 0,
        linesCached: cachedTranslations.size
      };
    }

    // Find lines that need translation
    const uncachedLines: { index: number; text: string }[] = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line && !cachedTranslations.has(i) && line.text.trim().length > 0) {
        uncachedLines.push({ index: i, text: line.text });
      }
    }

    // If nothing to translate, return cached
    if (uncachedLines.length === 0) {
      return {
        translations: cachedTranslations,
        sourceLanguage,
        fromCache: true,
        linesTranslated: 0,
        linesCached: cachedTranslations.size
      };
    }

    // Translate uncached lines
    const translations = new Map(cachedTranslations);
    let translated = 0;

    const textsToTranslate = uncachedLines.map(l => l.text);
    const translatedTexts = await libreTranslateClient.translateBatch(
      textsToTranslate,
      sourceLanguage,
      'en',
      (completed, total) => {
        // Calculate overall progress including cached
        const cacheProgress = cachedTranslations.size / lines.length;
        const translateProgress = (completed / total) * (1 - cacheProgress);
        onProgress?.(Math.round((cacheProgress + translateProgress) * 100));
      }
    );

    // Cache and store results
    for (let i = 0; i < uncachedLines.length; i++) {
      const uncachedLine = uncachedLines[i];
      const translatedText = translatedTexts[i];

      if (uncachedLine && translatedText && translatedText.length > 0) {
        const originalLine = lines[uncachedLine.index];
        if (originalLine) {
          translations.set(uncachedLine.index, translatedText);
          translated++;

          // Cache the translation
          await translationCache.setTranslation(
            trackId,
            uncachedLine.index,
            originalLine.text,
            translatedText,
            sourceLanguage
          );
        }
      }
    }

    onProgress?.(100);

    return {
      translations,
      sourceLanguage,
      fromCache: false,
      linesTranslated: translated,
      linesCached: cachedTranslations.size
    };
  }

  /**
   * Check if lyrics should be translated (has supported language)
   */
  shouldTranslate(lines: LyricLine[]): boolean {
    const texts = lines.map(line => line.text);
    const language = detectLanguageFromLines(texts);
    return language !== null;
  }

  /**
   * Get detected language for lyrics
   */
  detectLanguage(lines: LyricLine[]): SupportedLanguage | null {
    const texts = lines.map(line => line.text);
    return detectLanguageFromLines(texts);
  }

  /**
   * Get cached translations for a track (if available)
   */
  async getCachedTranslations(trackId: string): Promise<Map<number, string> | null> {
    await this.initialize();
    const cached = await translationCache.getBatchTranslations(trackId);
    return cached.size > 0 ? cached : null;
  }

  /**
   * Check if a track has cached translations
   */
  async hasCachedTranslations(trackId: string): Promise<boolean> {
    await this.initialize();
    return translationCache.hasTrack(trackId);
  }

  /**
   * Clear translations for a specific track
   */
  async clearTrackTranslations(trackId: string): Promise<void> {
    await this.initialize();
    await translationCache.clearTrack(trackId);
  }

  /**
   * Clear all cached translations
   */
  async clearAllTranslations(): Promise<void> {
    await this.initialize();
    await translationCache.clearAll();
  }

  /**
   * Get cache statistics
   */
  async getCacheStats(): Promise<{ entries: number; oldestEntry: number | null }> {
    await this.initialize();
    return translationCache.getCacheStats();
  }
}

// Singleton instance
export const translationService = new TranslationService();
