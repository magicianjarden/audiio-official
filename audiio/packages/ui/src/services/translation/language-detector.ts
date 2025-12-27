/**
 * Language Detector - Lightweight Unicode-based language detection
 * Supports Japanese, Korean, Chinese, Spanish, French, German, Portuguese, Italian, Russian
 */

import type { SupportedLanguage } from './translation-cache';

// Unicode ranges for script detection
const HIRAGANA_RANGE = /[\u3040-\u309F]/;
const KATAKANA_RANGE = /[\u30A0-\u30FF]/;
const CJK_RANGE = /[\u4E00-\u9FFF]/; // CJK Unified Ideographs (shared by Japanese/Chinese)
const HANGUL_RANGE = /[\uAC00-\uD7AF]/; // Hangul Syllables
const HANGUL_JAMO_RANGE = /[\u1100-\u11FF]/; // Hangul Jamo
const CYRILLIC_RANGE = /[\u0400-\u04FF]/; // Cyrillic (Russian, etc.)

// Language-specific indicators
const SPANISH_CHARS = /[ñ¿¡]/i;
const SPANISH_COMMON_WORDS = /\b(el|la|los|las|de|que|es|en|un|una|por|con|para|como|pero|su|sus|del|al|yo|tu|mi|te|me|se|nos|muy|más|también|sin|sobre|todo|porque|cuando|donde|qué|cómo|sí|ya|así|aquí|ahora|siempre|nunca|nada|algo|cada|otro|misma|bien|mal|mucho|poco)\b/i;

const FRENCH_CHARS = /[çœæ]/i;
const FRENCH_COMMON_WORDS = /\b(le|la|les|de|du|des|un|une|et|est|en|que|qui|pour|dans|ce|cette|pas|sur|avec|plus|tout|tous|bien|mais|ou|où|si|non|oui|je|tu|il|elle|nous|vous|ils|elles|mon|ma|mes|ton|ta|tes|son|sa|ses|notre|votre|leur|comme|quand|très|aussi|même|ici|là|encore|toujours|jamais|rien|quelque|autre|après|avant|entre|sans)\b/i;

const GERMAN_CHARS = /[äöüß]/i;
const GERMAN_COMMON_WORDS = /\b(der|die|das|den|dem|des|ein|eine|einer|eines|und|ist|in|zu|nicht|mit|auf|für|von|an|bei|als|nach|aus|es|sich|auch|so|wie|aber|oder|wenn|nur|noch|mehr|schon|immer|wieder|kann|muss|will|soll|werden|wurde|haben|hat|sein|sind|war|wir|ihr|sie|er|ich|du|mein|dein|sein|ihr|unser|euer)\b/i;

const PORTUGUESE_CHARS = /[ãõç]/i;
const PORTUGUESE_COMMON_WORDS = /\b(o|a|os|as|de|da|do|das|dos|em|na|no|nas|nos|um|uma|uns|umas|que|é|está|são|para|com|por|como|mas|ou|se|não|sim|eu|tu|ele|ela|nós|vós|eles|elas|meu|minha|teu|tua|seu|sua|nosso|nossa|mais|muito|bem|quando|onde|aqui|lá|agora|sempre|nunca|tudo|nada|algo|cada|outro|outra|mesmo|ainda|já)\b/i;

const ITALIAN_CHARS = /[àèìòù]/i;
const ITALIAN_COMMON_WORDS = /\b(il|lo|la|i|gli|le|di|del|della|dei|delle|da|dal|dalla|in|nel|nella|un|uno|una|e|è|che|per|con|su|come|ma|se|non|sì|io|tu|lui|lei|noi|voi|loro|mio|mia|tuo|tua|suo|sua|nostro|nostra|vostro|vostra|più|molto|bene|quando|dove|qui|adesso|sempre|mai|tutto|nulla|qualcosa|ogni|altro|altra|stesso|stessa|ancora|già)\b/i;

const RUSSIAN_COMMON_WORDS = /\b(и|в|не|на|я|что|он|она|с|как|а|то|все|она|так|его|но|да|ты|к|у|же|вы|за|бы|по|только|её|мне|было|вот|от|меня|ещё|нет|о|из|ему|теперь|когда|уже|для|вам|ведь|там|тебя|себя|ничего|ей|может|они|тут|где|есть|надо|ней|него|тогда|кто|этот|этого|быть|всё|раз|чтобы|мой|твой|наш|ваш|их)\b/i;

// Sample size for detection
const SAMPLE_LINES = 5;
const MIN_CONFIDENCE_CHARS = 3;

// English common words for exclusion
const ENGLISH_COMMON_WORDS = /\b(the|and|is|are|was|were|be|been|being|have|has|had|do|does|did|will|would|could|should|can|may|might|must|shall|a|an|to|of|in|for|on|with|at|by|from|as|into|through|during|before|after|above|below|between|under|again|further|then|once|here|there|when|where|why|how|all|each|few|more|most|other|some|such|no|nor|not|only|own|same|so|than|too|very|just|also|now|i|you|he|she|it|we|they|me|him|her|us|them|my|your|his|its|our|their|this|that|these|those|what|which|who|whom|whose|am|oh|yeah|baby|love|know|want|need|feel|think|say|said|like|got|get|go|come|make|take|see|look|give|find|tell|ask|use|seem|try|leave|call|keep|let|begin|show|hear|play|run|move|live|believe|hold|bring|happen|write|sit|stand|lose|pay|meet|include|continue|set|learn|change|lead|understand|watch|follow|stop|create|speak|read|allow|add|spend|grow|open|walk|win|offer|remember|consider|appear|buy|wait|serve|die|send|expect|build|stay|fall|cut|reach|kill|remain|suggest|raise|pass|sell|require|report|decide|pull)\b/gi;

interface DetectionResult {
  language: SupportedLanguage | null;
  confidence: number; // 0-1
  scriptCounts: {
    japanese: number;
    korean: number;
    chinese: number;
    russian: number;
    spanish: number;
    french: number;
    german: number;
    portuguese: number;
    italian: number;
  };
}

/**
 * Per-line language detection result
 */
export interface LineLanguageResult {
  lineIndex: number;
  language: SupportedLanguage | null;
  needsTranslation: boolean;
  isEnglish: boolean;
  confidence: number;
}

/**
 * Detect the language of a single text string
 */
export function detectLanguage(text: string): SupportedLanguage | null {
  const result = analyzeText(text);
  return result.language;
}

/**
 * Detect language from multiple lines (more accurate)
 * Uses first N non-empty lines for detection
 */
export function detectLanguageFromLines(lines: string[]): SupportedLanguage | null {
  // Get first N non-empty lines
  const sampleLines = lines
    .filter(line => line.trim().length > 0)
    .slice(0, SAMPLE_LINES);

  if (sampleLines.length === 0) {
    return null;
  }

  // Combine samples for analysis
  const combinedText = sampleLines.join(' ');
  const result = analyzeText(combinedText);

  // Require minimum confidence
  if (result.confidence < 0.3) {
    return null;
  }

  return result.language;
}

/**
 * Check if a language is supported for translation
 */
export function isSupportedLanguage(lang: string): lang is SupportedLanguage {
  return ['ja', 'ko', 'zh', 'es', 'fr', 'de', 'pt', 'it', 'ru'].includes(lang);
}

/**
 * Get human-readable language name
 */
export function getLanguageName(lang: SupportedLanguage): string {
  const names: Record<SupportedLanguage, string> = {
    ja: 'Japanese',
    ko: 'Korean',
    zh: 'Chinese',
    es: 'Spanish',
    fr: 'French',
    de: 'German',
    pt: 'Portuguese',
    it: 'Italian',
    ru: 'Russian'
  };
  return names[lang];
}

/**
 * Analyze text and return detection result with confidence
 */
function analyzeText(text: string): DetectionResult {
  const counts = {
    japanese: 0,
    korean: 0,
    chinese: 0,
    russian: 0,
    spanish: 0,
    french: 0,
    german: 0,
    portuguese: 0,
    italian: 0
  };

  // Count Japanese characters (Hiragana, Katakana)
  const hiraganaMatches = text.match(new RegExp(HIRAGANA_RANGE.source, 'g')) || [];
  const katakanaMatches = text.match(new RegExp(KATAKANA_RANGE.source, 'g')) || [];
  counts.japanese = hiraganaMatches.length + katakanaMatches.length;

  // Count CJK characters (shared by Japanese and Chinese)
  const cjkMatches = text.match(new RegExp(CJK_RANGE.source, 'g')) || [];

  // If we have Hiragana/Katakana, CJK is Japanese; otherwise it's Chinese
  if (counts.japanese > 0) {
    counts.japanese += cjkMatches.length;
  } else if (cjkMatches.length > 0) {
    counts.chinese = cjkMatches.length;
  }

  // Count Korean characters
  const hangulMatches = text.match(new RegExp(HANGUL_RANGE.source, 'g')) || [];
  const jamoMatches = text.match(new RegExp(HANGUL_JAMO_RANGE.source, 'g')) || [];
  counts.korean = hangulMatches.length + jamoMatches.length;

  // Count Russian (Cyrillic) characters
  const cyrillicMatches = text.match(new RegExp(CYRILLIC_RANGE.source, 'g')) || [];
  if (cyrillicMatches.length > 0) {
    const russianWordMatches = text.match(RUSSIAN_COMMON_WORDS) || [];
    counts.russian = cyrillicMatches.length + (russianWordMatches.length * 2);
  }

  // Count Latin-based language indicators (only if no CJK/Korean/Cyrillic)
  const hasAsianOrCyrillic = counts.japanese > 0 || counts.korean > 0 || counts.chinese > 0 || counts.russian > 0;

  if (!hasAsianOrCyrillic) {
    // Spanish
    const spanishCharMatches = text.match(SPANISH_CHARS) || [];
    const spanishWordMatches = text.match(SPANISH_COMMON_WORDS) || [];
    counts.spanish = spanishCharMatches.length * 3 + spanishWordMatches.length * 2;

    // French
    const frenchCharMatches = text.match(FRENCH_CHARS) || [];
    const frenchWordMatches = text.match(FRENCH_COMMON_WORDS) || [];
    counts.french = frenchCharMatches.length * 3 + frenchWordMatches.length * 2;

    // German
    const germanCharMatches = text.match(GERMAN_CHARS) || [];
    const germanWordMatches = text.match(GERMAN_COMMON_WORDS) || [];
    counts.german = germanCharMatches.length * 3 + germanWordMatches.length * 2;

    // Portuguese
    const portugueseCharMatches = text.match(PORTUGUESE_CHARS) || [];
    const portugueseWordMatches = text.match(PORTUGUESE_COMMON_WORDS) || [];
    counts.portuguese = portugueseCharMatches.length * 3 + portugueseWordMatches.length * 2;

    // Italian
    const italianCharMatches = text.match(ITALIAN_CHARS) || [];
    const italianWordMatches = text.match(ITALIAN_COMMON_WORDS) || [];
    counts.italian = italianCharMatches.length * 3 + italianWordMatches.length * 2;
  }

  // Determine language and confidence
  const allCounts = Object.values(counts);
  const total = allCounts.reduce((a, b) => a + b, 0);

  if (total < MIN_CONFIDENCE_CHARS) {
    return { language: null, confidence: 0, scriptCounts: counts };
  }

  // Script-based languages (highest priority - unambiguous)
  if (counts.japanese > 0 && counts.korean === 0) {
    return {
      language: 'ja',
      confidence: counts.japanese / Math.max(total, text.length * 0.1),
      scriptCounts: counts
    };
  }

  if (counts.korean > 0 && counts.japanese === 0) {
    return {
      language: 'ko',
      confidence: counts.korean / Math.max(total, text.length * 0.1),
      scriptCounts: counts
    };
  }

  if (counts.chinese > 0) {
    return {
      language: 'zh',
      confidence: counts.chinese / Math.max(total, text.length * 0.1),
      scriptCounts: counts
    };
  }

  if (counts.russian > 0) {
    return {
      language: 'ru',
      confidence: counts.russian / Math.max(total, text.length * 0.1),
      scriptCounts: counts
    };
  }

  // Latin-based languages - pick the one with highest score
  const latinScores: [SupportedLanguage, number][] = [
    ['es', counts.spanish],
    ['fr', counts.french],
    ['de', counts.german],
    ['pt', counts.portuguese],
    ['it', counts.italian]
  ];

  const [bestLang, bestScore] = latinScores.reduce((best, current) =>
    current[1] > best[1] ? current : best
  );

  if (bestScore >= MIN_CONFIDENCE_CHARS) {
    // Additional check: should be primarily Latin characters
    const latinChars = text.match(/[a-zA-ZáéíóúüñçàèìòùäöüßãõœæÁÉÍÓÚÜÑÇÀÈÌÒÙÄÖÜẞÃÕŒÆ]/g) || [];
    if (latinChars.length > text.length * 0.4) {
      return {
        language: bestLang,
        confidence: Math.min(bestScore / 15, 1),
        scriptCounts: counts
      };
    }
  }

  return { language: null, confidence: 0, scriptCounts: counts };
}

/**
 * Quick check if text likely needs translation (contains non-English)
 */
export function needsTranslation(text: string): boolean {
  // Check for any supported language characters/patterns
  return (
    HIRAGANA_RANGE.test(text) ||
    KATAKANA_RANGE.test(text) ||
    CJK_RANGE.test(text) ||
    HANGUL_RANGE.test(text) ||
    HANGUL_JAMO_RANGE.test(text) ||
    CYRILLIC_RANGE.test(text) ||
    SPANISH_CHARS.test(text) ||
    SPANISH_COMMON_WORDS.test(text) ||
    FRENCH_CHARS.test(text) ||
    FRENCH_COMMON_WORDS.test(text) ||
    GERMAN_CHARS.test(text) ||
    GERMAN_COMMON_WORDS.test(text) ||
    PORTUGUESE_CHARS.test(text) ||
    PORTUGUESE_COMMON_WORDS.test(text) ||
    ITALIAN_CHARS.test(text) ||
    ITALIAN_COMMON_WORDS.test(text)
  );
}

/**
 * Check if a line is primarily English
 * Returns true if the line appears to be English (no translation needed)
 */
export function isEnglishLine(text: string): boolean {
  if (!text || text.trim().length === 0) return true;

  // If it has CJK/Korean/Cyrillic characters, it's not English
  if (
    HIRAGANA_RANGE.test(text) ||
    KATAKANA_RANGE.test(text) ||
    CJK_RANGE.test(text) ||
    HANGUL_RANGE.test(text) ||
    HANGUL_JAMO_RANGE.test(text) ||
    CYRILLIC_RANGE.test(text)
  ) {
    return false;
  }

  // Count English common words
  const englishMatches = text.match(ENGLISH_COMMON_WORDS) || [];
  const words = text.split(/\s+/).filter(w => w.length > 1);

  if (words.length === 0) return true;

  // If more than 30% of words are common English words, it's English
  const englishRatio = englishMatches.length / words.length;
  if (englishRatio > 0.3) return true;

  // Check for Latin-only text (could be English or Romance language)
  const latinChars = text.match(/[a-zA-Z]/g) || [];
  const nonLatinChars = text.match(/[^a-zA-Z0-9\s.,!?'"()-]/g) || [];

  // If it's purely Latin without special chars, check for foreign word patterns
  if (latinChars.length > 0 && nonLatinChars.length === 0) {
    // Check if it matches any foreign language patterns
    const hasForeignPattern =
      SPANISH_COMMON_WORDS.test(text) ||
      FRENCH_COMMON_WORDS.test(text) ||
      GERMAN_COMMON_WORDS.test(text) ||
      PORTUGUESE_COMMON_WORDS.test(text) ||
      ITALIAN_COMMON_WORDS.test(text);

    // If no foreign patterns and it's Latin-only, assume English
    if (!hasForeignPattern) return true;
  }

  return false;
}

/**
 * Detect language for each line individually
 * Handles multi-language songs (e.g., K-pop with English chorus)
 */
export function detectLanguagePerLine(lines: string[]): LineLanguageResult[] {
  return lines.map((text, lineIndex) => {
    // Empty lines don't need translation
    if (!text || text.trim().length === 0) {
      return {
        lineIndex,
        language: null,
        needsTranslation: false,
        isEnglish: true,
        confidence: 1
      };
    }

    // Check if line is English first
    const english = isEnglishLine(text);
    if (english) {
      return {
        lineIndex,
        language: null,
        needsTranslation: false,
        isEnglish: true,
        confidence: 0.8
      };
    }

    // Detect specific language for non-English lines
    const result = analyzeText(text);

    return {
      lineIndex,
      language: result.language,
      needsTranslation: result.language !== null,
      isEnglish: false,
      confidence: result.confidence
    };
  });
}

/**
 * Get the dominant language from all lines (for display purposes)
 * Returns the most common non-English language detected
 */
export function getDominantLanguage(lines: string[]): SupportedLanguage | null {
  const lineResults = detectLanguagePerLine(lines);

  // Count occurrences of each language
  const languageCounts: Partial<Record<SupportedLanguage, number>> = {};

  for (const result of lineResults) {
    if (result.language) {
      languageCounts[result.language] = (languageCounts[result.language] || 0) + 1;
    }
  }

  // Find the most common language
  let dominantLang: SupportedLanguage | null = null;
  let maxCount = 0;

  for (const [lang, count] of Object.entries(languageCounts)) {
    if (count > maxCount) {
      maxCount = count;
      dominantLang = lang as SupportedLanguage;
    }
  }

  return dominantLang;
}

/**
 * Get lines that need translation (excludes English lines)
 */
export function getLinesNeedingTranslation(lines: string[]): { index: number; text: string; language: SupportedLanguage }[] {
  const lineResults = detectLanguagePerLine(lines);

  return lineResults
    .filter(result => result.needsTranslation && result.language !== null)
    .map(result => ({
      index: result.lineIndex,
      text: lines[result.lineIndex] || '',
      language: result.language!
    }));
}
