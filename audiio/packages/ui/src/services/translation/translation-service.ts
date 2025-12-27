/**
 * Translation Service - Orchestrates translation workflow
 * Flow: Detect language -> Check cache -> Batch uncached -> Call API -> Cache results
 */

import { translationCache, type SupportedLanguage } from './translation-cache';
import {
  detectLanguageFromLines,
  detectLanguagePerLine,
  getDominantLanguage,
  isEnglishLine,
  type LineLanguageResult
} from './language-detector';
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
   * Now uses per-line language detection for multi-language songs
   */
  async translateLyrics(
    trackId: string,
    lines: LyricLine[],
    onProgress?: TranslationProgress
  ): Promise<TranslationResult | null> {
    await this.initialize();

    // Extract text from lyrics
    const texts = lines.map(line => line.text);

    // Use per-line language detection for multi-language support
    const lineResults = detectLanguagePerLine(texts);

    // Find lines that actually need translation (non-English)
    const linesToTranslate = lineResults.filter(r => r.needsTranslation && r.language !== null);

    // If no lines need translation, return null
    if (linesToTranslate.length === 0) {
      console.log('[Translation] No non-English lines detected, skipping translation');
      return null;
    }

    // Get dominant language for metadata (most common non-English language)
    const sourceLanguage = getDominantLanguage(texts);
    if (!sourceLanguage) {
      return null;
    }

    console.log(`[Translation] Detected ${linesToTranslate.length}/${lines.length} non-English lines`);

    // Check cache for existing translations
    const cachedTranslations = await translationCache.getBatchTranslations(trackId);

    // Build initial translations map (include English lines as-is)
    const translations = new Map(cachedTranslations);

    // Count how many non-English lines are already cached
    let cachedCount = 0;
    for (const lineResult of linesToTranslate) {
      if (cachedTranslations.has(lineResult.lineIndex)) {
        cachedCount++;
      }
    }

    // If all non-English lines are cached, return early
    if (cachedCount === linesToTranslate.length) {
      return {
        translations,
        sourceLanguage,
        fromCache: true,
        linesTranslated: 0,
        linesCached: cachedCount
      };
    }

    // Find uncached non-English lines
    const uncachedLines: { index: number; text: string; language: SupportedLanguage }[] = [];
    for (const lineResult of linesToTranslate) {
      const line = lines[lineResult.lineIndex];
      if (line && !cachedTranslations.has(lineResult.lineIndex) && line.text.trim().length > 0) {
        uncachedLines.push({
          index: lineResult.lineIndex,
          text: line.text,
          language: lineResult.language!
        });
      }
    }

    // If nothing to translate, return cached
    if (uncachedLines.length === 0) {
      return {
        translations,
        sourceLanguage,
        fromCache: true,
        linesTranslated: 0,
        linesCached: cachedCount
      };
    }

    // Group lines by language for batch translation
    const linesByLanguage = new Map<SupportedLanguage, typeof uncachedLines>();
    for (const line of uncachedLines) {
      const langLines = linesByLanguage.get(line.language) || [];
      langLines.push(line);
      linesByLanguage.set(line.language, langLines);
    }

    let translated = 0;
    const totalToTranslate = uncachedLines.length;

    // Translate each language group
    for (const [language, langLines] of linesByLanguage) {
      const textsToTranslate = langLines.map(l => l.text);

      console.log(`[Translation] Translating ${langLines.length} lines from ${language}`);

      const translatedTexts = await libreTranslateClient.translateBatch(
        textsToTranslate,
        language,
        'en',
        (completed, _total) => {
          // Calculate overall progress
          const progress = ((cachedCount + translated + completed) / (cachedCount + totalToTranslate)) * 100;
          onProgress?.(Math.round(progress));
        }
      );

      // Cache and store results
      for (let i = 0; i < langLines.length; i++) {
        const lineInfo = langLines[i];
        const translatedText = translatedTexts[i];

        if (lineInfo && translatedText && translatedText.length > 0) {
          const originalLine = lines[lineInfo.index];
          if (originalLine) {
            translations.set(lineInfo.index, translatedText);
            translated++;

            // Cache the translation
            await translationCache.setTranslation(
              trackId,
              lineInfo.index,
              originalLine.text,
              translatedText,
              language
            );
          }
        }
      }
    }

    onProgress?.(100);

    return {
      translations,
      sourceLanguage,
      fromCache: false,
      linesTranslated: translated,
      linesCached: cachedCount
    };
  }

  /**
   * Check if lyrics should be translated (has any non-English lines)
   */
  shouldTranslate(lines: LyricLine[]): boolean {
    const texts = lines.map(line => line.text);
    const lineResults = detectLanguagePerLine(texts);
    // Return true if any line needs translation
    return lineResults.some(r => r.needsTranslation);
  }

  /**
   * Get detected language for lyrics (dominant language)
   */
  detectLanguage(lines: LyricLine[]): SupportedLanguage | null {
    const texts = lines.map(line => line.text);
    return getDominantLanguage(texts);
  }

  /**
   * Get per-line language analysis
   */
  analyzeLineLanguages(lines: LyricLine[]): LineLanguageResult[] {
    const texts = lines.map(line => line.text);
    return detectLanguagePerLine(texts);
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
