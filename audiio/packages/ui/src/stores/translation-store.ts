/**
 * Translation Store - Manages lyrics translation state
 * Uses cache-first approach with LibreTranslate fallback
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { translationService, type SupportedLanguage } from '../services/translation';

interface TranslationState {
  // Settings (persisted)
  translationEnabled: boolean;

  // Current track state
  currentTrackId: string | null;
  translations: Map<number, string>; // lineIndex -> translated text
  sourceLanguage: SupportedLanguage | null;

  // Loading states
  isDetecting: boolean;
  isTranslating: boolean;
  translationProgress: number; // 0-100
  error: string | null;

  // Actions
  setTranslationEnabled: (enabled: boolean) => void;
  translateLyrics: (trackId: string, lines: { time: number; text: string }[]) => Promise<void>;
  clearTranslations: () => void;
  getTranslation: (lineIndex: number) => string | undefined;
  detectLanguage: (lines: { time: number; text: string }[]) => SupportedLanguage | null;
}

// Helper to convert Map to/from plain object for persistence
const mapToObject = (map: Map<number, string>): Record<number, string> => {
  const obj: Record<number, string> = {};
  map.forEach((value, key) => {
    obj[key] = value;
  });
  return obj;
};

const objectToMap = (obj: Record<number, string>): Map<number, string> => {
  return new Map(Object.entries(obj).map(([k, v]) => [Number(k), v]));
};

export const useTranslationStore = create<TranslationState>()(
  persist(
    (set, get) => ({
      // Initial state
      translationEnabled: false,
      currentTrackId: null,
      translations: new Map(),
      sourceLanguage: null,
      isDetecting: false,
      isTranslating: false,
      translationProgress: 0,
      error: null,

      // Actions
      setTranslationEnabled: (enabled) => {
        set({ translationEnabled: enabled });
      },

      translateLyrics: async (trackId, lines) => {
        const state = get();

        // Don't retranslate same track
        if (state.currentTrackId === trackId && state.translations.size > 0) {
          return;
        }

        // Clear previous and start fresh
        set({
          currentTrackId: trackId,
          translations: new Map(),
          sourceLanguage: null,
          isDetecting: true,
          isTranslating: false,
          translationProgress: 0,
          error: null
        });

        try {
          // Detect language first
          const detectedLang = translationService.detectLanguage(lines);

          if (!detectedLang) {
            // No supported language found
            set({
              isDetecting: false,
              sourceLanguage: null
            });
            return;
          }

          set({
            isDetecting: false,
            sourceLanguage: detectedLang,
            isTranslating: true
          });

          // Translate lyrics
          const result = await translationService.translateLyrics(
            trackId,
            lines,
            (progress) => {
              set({ translationProgress: progress });
            }
          );

          if (result) {
            set({
              translations: result.translations,
              isTranslating: false,
              translationProgress: 100
            });
          } else {
            set({
              isTranslating: false,
              error: 'Translation failed'
            });
          }
        } catch (error) {
          console.error('Translation error:', error);
          set({
            isDetecting: false,
            isTranslating: false,
            error: error instanceof Error ? error.message : 'Translation failed'
          });
        }
      },

      clearTranslations: () => {
        set({
          currentTrackId: null,
          translations: new Map(),
          sourceLanguage: null,
          isDetecting: false,
          isTranslating: false,
          translationProgress: 0,
          error: null
        });
      },

      getTranslation: (lineIndex) => {
        return get().translations.get(lineIndex);
      },

      detectLanguage: (lines) => {
        return translationService.detectLanguage(lines);
      }
    }),
    {
      name: 'audiio-translation-settings',
      // Only persist settings, not runtime state
      partialize: (state) => ({
        translationEnabled: state.translationEnabled
      }),
      // Custom storage to handle Map serialization
      storage: {
        getItem: (name) => {
          const str = localStorage.getItem(name);
          if (!str) return null;
          const parsed = JSON.parse(str);
          return {
            state: {
              ...parsed.state,
              // Restore defaults for non-persisted state
              currentTrackId: null,
              translations: new Map(),
              sourceLanguage: null,
              isDetecting: false,
              isTranslating: false,
              translationProgress: 0,
              error: null
            },
            version: parsed.version
          };
        },
        setItem: (name, value) => {
          localStorage.setItem(name, JSON.stringify(value));
        },
        removeItem: (name) => {
          localStorage.removeItem(name);
        }
      }
    }
  )
);
