/**
 * LibreTranslate Client - API client for free translation services
 * Uses IPC in Electron to avoid CORS issues
 * Optimized for speed with parallel requests
 */

import type { SupportedLanguage } from './translation-cache';

// Check if running in Electron with IPC available
const isElectron = typeof window !== 'undefined' && 'api' in window && typeof (window as any).api?.translateText === 'function';

// Configuration - optimized for speed
const CONCURRENCY_LIMIT = 5; // Max parallel requests
const MIN_DELAY_BETWEEN_BATCHES = 50; // Small delay between batches to avoid rate limits
const BATCH_SIZE = 10; // Max lines per batch request

interface IPCTranslateResult {
  success: boolean;
  translatedText?: string;
  error?: string;
}

class LibreTranslateClient {

  /**
   * Translate a single text string
   * Uses IPC in Electron (CORS-free)
   */
  async translate(
    text: string,
    source: SupportedLanguage,
    target: string = 'en'
  ): Promise<string> {
    // Use IPC in Electron (no CORS issues)
    if (isElectron) {
      const result = await (window as any).api.translateText(text, source, target) as IPCTranslateResult;
      if (result.success && result.translatedText) {
        return result.translatedText;
      }
      throw new Error(result.error || 'Translation failed');
    }

    // Not in Electron - can't translate (CORS)
    throw new Error('Translation requires Electron - not available in browser dev mode');
  }

  /**
   * Translate multiple texts in parallel batches
   * Uses concurrency control for speed without overwhelming the API
   */
  async translateBatch(
    texts: string[],
    source: SupportedLanguage,
    target: string = 'en',
    onProgress?: (completed: number, total: number) => void
  ): Promise<string[]> {
    const results: string[] = new Array(texts.length).fill('');
    const total = texts.length;
    let completed = 0;

    // Filter and track which indices need translation
    const toTranslate: { index: number; text: string }[] = [];
    for (let i = 0; i < texts.length; i++) {
      const text = texts[i];
      if (text && text.trim().length > 0) {
        toTranslate.push({ index: i, text });
      } else {
        completed++;
      }
    }

    onProgress?.(completed, total);

    // Process in parallel with concurrency limit
    const translateOne = async (item: { index: number; text: string }) => {
      try {
        const translated = await this.translate(item.text, source, target);
        results[item.index] = translated;
      } catch (error) {
        console.warn(`[Translation] Failed for line ${item.index}:`, error);
        results[item.index] = '';
      }
      completed++;
      onProgress?.(completed, total);
    };

    // Process with concurrency control
    const chunks: { index: number; text: string }[][] = [];
    for (let i = 0; i < toTranslate.length; i += CONCURRENCY_LIMIT) {
      chunks.push(toTranslate.slice(i, i + CONCURRENCY_LIMIT));
    }

    for (const chunk of chunks) {
      await Promise.all(chunk.map(translateOne));
      // Small delay between batches to be nice to the API
      if (chunks.indexOf(chunk) < chunks.length - 1) {
        await this.sleep(MIN_DELAY_BETWEEN_BATCHES);
      }
    }

    return results;
  }

  /**
   * Check if translation service is available
   */
  isAvailable(): boolean {
    return isElectron;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Singleton instance
export const libreTranslateClient = new LibreTranslateClient();

// Export batch size for use in translation service
export { BATCH_SIZE };
