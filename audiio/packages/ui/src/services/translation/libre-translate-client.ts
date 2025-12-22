/**
 * LibreTranslate Client - API client for free translation services
 * Uses IPC in Electron to avoid CORS issues
 */

import type { SupportedLanguage } from './translation-cache';

// Check if running in Electron with IPC available
const isElectron = typeof window !== 'undefined' && 'api' in window && typeof (window as any).api?.translateText === 'function';

// Configuration
const RATE_LIMIT_DELAY = 150; // 150ms between requests to avoid rate limits
const BATCH_SIZE = 10; // Max lines per batch request

interface IPCTranslateResult {
  success: boolean;
  translatedText?: string;
  error?: string;
}

class LibreTranslateClient {
  private lastRequestTime = 0;

  /**
   * Translate a single text string
   * Uses IPC in Electron (CORS-free)
   */
  async translate(
    text: string,
    source: SupportedLanguage,
    target: string = 'en'
  ): Promise<string> {
    await this.rateLimit();

    // Use IPC in Electron (no CORS issues)
    if (isElectron) {
      console.log(`[Translation] Translating via IPC: "${text.substring(0, 30)}..."`);
      const result = await (window as any).api.translateText(text, source, target) as IPCTranslateResult;
      if (result.success && result.translatedText) {
        return result.translatedText;
      }
      throw new Error(result.error || 'Translation failed');
    }

    // Not in Electron - can't translate (CORS)
    console.warn('[Translation] IPC not available, translation disabled');
    throw new Error('Translation requires Electron - not available in browser dev mode');
  }

  /**
   * Translate multiple texts in batch
   * Serializes with rate limiting
   */
  async translateBatch(
    texts: string[],
    source: SupportedLanguage,
    target: string = 'en',
    onProgress?: (completed: number, total: number) => void
  ): Promise<string[]> {
    const results: string[] = [];
    const total = texts.length;

    for (let i = 0; i < texts.length; i++) {
      const text = texts[i];
      if (!text || text.trim().length === 0) {
        results.push('');
        onProgress?.(i + 1, total);
        continue;
      }

      try {
        const translated = await this.translate(text, source, target);
        results.push(translated);
      } catch (error) {
        console.warn(`[Translation] Failed for line ${i}:`, error);
        results.push(''); // Empty string for failed translations
      }

      onProgress?.(i + 1, total);
    }

    return results;
  }

  /**
   * Check if translation service is available
   */
  isAvailable(): boolean {
    return isElectron;
  }

  private async rateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;

    if (timeSinceLastRequest < RATE_LIMIT_DELAY) {
      await this.sleep(RATE_LIMIT_DELAY - timeSinceLastRequest);
    }

    this.lastRequestTime = Date.now();
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Singleton instance
export const libreTranslateClient = new LibreTranslateClient();

// Export batch size for use in translation service
export { BATCH_SIZE };
