/**
 * Language Detector - Lightweight Unicode-based language detection
 * Supports Japanese, Korean, and Spanish detection for lyrics translation
 */

import type { SupportedLanguage } from './translation-cache';

// Unicode ranges for script detection
const HIRAGANA_RANGE = /[\u3040-\u309F]/;
const KATAKANA_RANGE = /[\u30A0-\u30FF]/;
const CJK_RANGE = /[\u4E00-\u9FFF]/; // CJK Unified Ideographs (shared by Japanese/Chinese)
const HANGUL_RANGE = /[\uAC00-\uD7AF]/; // Hangul Syllables
const HANGUL_JAMO_RANGE = /[\u1100-\u11FF]/; // Hangul Jamo

// Spanish-specific indicators
const SPANISH_CHARS = /[ñáéíóúü¿¡]/i;
const SPANISH_COMMON_WORDS = /\b(el|la|los|las|de|que|es|en|un|una|por|con|para|como|pero|su|sus|del|al|este|esta|ese|esa|yo|tu|mi|te|me|se|nos|lo|le|les|muy|más|también|sin|sobre|todo|hace|puede|porque|cuando|donde|quien|cual|cuál|qué|cómo|sí|si|no|ya|así|aquí|ahí|hoy|ayer|ahora|siempre|nunca|nada|algo|alguien|nadie|cada|otro|otra|mismo|misma|bien|mal|mucho|poco|tanto|tan)\b/i;

// Sample size for detection
const SAMPLE_LINES = 5;
const MIN_CONFIDENCE_CHARS = 3;

interface DetectionResult {
  language: SupportedLanguage | null;
  confidence: number; // 0-1
  scriptCounts: {
    japanese: number;
    korean: number;
    spanish: number;
  };
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
  return lang === 'ja' || lang === 'ko' || lang === 'es';
}

/**
 * Get human-readable language name
 */
export function getLanguageName(lang: SupportedLanguage): string {
  const names: Record<SupportedLanguage, string> = {
    ja: 'Japanese',
    ko: 'Korean',
    es: 'Spanish'
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
    spanish: 0
  };

  // Count Japanese characters (Hiragana, Katakana, or CJK with Japanese context)
  const hiraganaMatches = text.match(new RegExp(HIRAGANA_RANGE.source, 'g')) || [];
  const katakanaMatches = text.match(new RegExp(KATAKANA_RANGE.source, 'g')) || [];
  counts.japanese = hiraganaMatches.length + katakanaMatches.length;

  // If we have Hiragana/Katakana, also count CJK as Japanese
  if (counts.japanese > 0) {
    const cjkMatches = text.match(new RegExp(CJK_RANGE.source, 'g')) || [];
    counts.japanese += cjkMatches.length;
  }

  // Count Korean characters
  const hangulMatches = text.match(new RegExp(HANGUL_RANGE.source, 'g')) || [];
  const jamoMatches = text.match(new RegExp(HANGUL_JAMO_RANGE.source, 'g')) || [];
  counts.korean = hangulMatches.length + jamoMatches.length;

  // Count Spanish indicators
  const spanishCharMatches = text.match(SPANISH_CHARS) || [];
  const spanishWordMatches = text.match(SPANISH_COMMON_WORDS) || [];
  counts.spanish = spanishCharMatches.length + (spanishWordMatches.length * 2); // Weight words more

  // Determine language and confidence
  const total = counts.japanese + counts.korean + counts.spanish;

  if (total < MIN_CONFIDENCE_CHARS) {
    return {
      language: null,
      confidence: 0,
      scriptCounts: counts
    };
  }

  // Japanese and Korean are mutually exclusive (different scripts)
  // Spanish requires Latin script (no Japanese/Korean chars)
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

  // Spanish detection (only if no Asian scripts)
  if (counts.spanish > 0 && counts.japanese === 0 && counts.korean === 0) {
    // Additional check: should be primarily Latin characters
    const latinChars = text.match(/[a-zA-ZáéíóúüñÁÉÍÓÚÜÑ]/g) || [];
    if (latinChars.length > text.length * 0.5) {
      return {
        language: 'es',
        confidence: Math.min(counts.spanish / 10, 1), // Cap at 1
        scriptCounts: counts
      };
    }
  }

  return {
    language: null,
    confidence: 0,
    scriptCounts: counts
  };
}

/**
 * Quick check if text likely needs translation (contains non-English)
 */
export function needsTranslation(text: string): boolean {
  // Check for any supported language characters
  return (
    HIRAGANA_RANGE.test(text) ||
    KATAKANA_RANGE.test(text) ||
    CJK_RANGE.test(text) ||
    HANGUL_RANGE.test(text) ||
    HANGUL_JAMO_RANGE.test(text) ||
    SPANISH_CHARS.test(text) ||
    SPANISH_COMMON_WORDS.test(text)
  );
}
