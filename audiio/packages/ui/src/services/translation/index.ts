/**
 * Translation Services - Public API exports
 */

export { translationService } from './translation-service';
export type { LyricLine, TranslationResult, TranslationProgress } from './translation-service';

export { translationCache } from './translation-cache';
export type { SupportedLanguage, TranslationCacheEntry } from './translation-cache';

export {
  detectLanguage,
  detectLanguageFromLines,
  isSupportedLanguage,
  getLanguageName,
  needsTranslation
} from './language-detector';

export { libreTranslateClient } from './libre-translate-client';
