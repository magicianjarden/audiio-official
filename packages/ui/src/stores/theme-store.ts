/**
 * Theme store - manages app theming, color modes, and community themes
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ========================================
// Theme Configuration Types
// ========================================

export interface ThemeColors {
  // Background colors
  bgPrimary: string;
  bgSecondary: string;
  bgTertiary: string;
  bgHover: string;
  bgElevated: string;
  bgSurface: string;
  bgOverlay: string;

  // Text colors
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  textInverse: string;
  textOnAccent: string;

  // Accent colors
  accent: string;
  accentHover: string;
  accentGlow: string;
  accentSoft: string;
  accentMuted: string;

  // Border colors
  borderColor: string;
  borderLight: string;
  borderStrong: string;

  // Semantic colors
  colorSuccess: string;
  colorWarning: string;
  colorError: string;
  colorInfo: string;
}

export interface ThemeGradients {
  accent: string;
  surface: string;
  purple?: string;
  pink?: string;
  blue?: string;
  orange?: string;
  red?: string;
  teal?: string;
}

export interface ThemeShadows {
  xs?: string;
  sm?: string;
  md?: string;
  lg?: string;
  xl?: string;
  glow?: string;
  module?: string;
  card?: string;
  elevated?: string;
}

export interface ThemeRadius {
  xs?: string;
  sm?: string;
  md?: string;
  lg?: string;
  xl?: string;
  '2xl'?: string;
  full?: string;
  module?: string;
  card?: string;
  button?: string;
}

export interface ThemeFonts {
  sans?: string;
  mono?: string;
}

export interface ThemeGlass {
  bg?: string;
  bgLight?: string;
  border?: string;
  borderStrong?: string;
  blur?: string;
  blurStrong?: string;
}

export type ColorMode = 'dark' | 'light';
export type SystemMode = 'dark' | 'light' | 'auto';
export type ThemeSource = 'builtin' | 'community';

export interface ThemeConfig {
  id: string;
  name: string;
  author: string;
  version: string;
  description?: string;
  mode: ColorMode;
  preview?: string;
  source: ThemeSource;

  // Core colors
  colors: ThemeColors;

  // Optional customizations
  gradients?: Partial<ThemeGradients>;
  shadows?: Partial<ThemeShadows>;
  radius?: Partial<ThemeRadius>;
  fonts?: ThemeFonts;
  glass?: Partial<ThemeGlass>;

  // Advanced: Custom CSS (sanitized before use)
  customCSS?: string;
}

// ========================================
// Built-in Theme Definitions
// ========================================

const defaultDarkTheme: ThemeConfig = {
  id: 'default-dark',
  name: 'Default Dark',
  author: 'Audiio Team',
  version: '1.0.0',
  description: 'The classic Audiio dark theme with green accent',
  mode: 'dark',
  source: 'builtin',
  colors: {
    bgPrimary: '#0a0a0a',
    bgSecondary: '#141414',
    bgTertiary: '#1c1c1c',
    bgHover: '#252525',
    bgElevated: '#1a1a1a',
    bgSurface: '#121212',
    bgOverlay: 'rgba(0, 0, 0, 0.6)',
    textPrimary: '#ffffff',
    textSecondary: '#a3a3a3',
    textMuted: '#737373',
    textInverse: '#000000',
    textOnAccent: '#ffffff',
    accent: '#1db954',
    accentHover: '#1ed760',
    accentGlow: 'rgba(29, 185, 84, 0.25)',
    accentSoft: 'rgba(29, 185, 84, 0.1)',
    accentMuted: 'rgba(29, 185, 84, 0.5)',
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderLight: 'rgba(255, 255, 255, 0.12)',
    borderStrong: 'rgba(255, 255, 255, 0.18)',
    colorSuccess: '#1db954',
    colorWarning: '#f59e0b',
    colorError: '#ef4444',
    colorInfo: '#3b82f6',
  },
};

const midnightTheme: ThemeConfig = {
  id: 'midnight',
  name: 'Midnight',
  author: 'Audiio Team',
  version: '1.0.0',
  description: 'Deep blues and purples for late night listening',
  mode: 'dark',
  source: 'builtin',
  colors: {
    bgPrimary: '#0a0a14',
    bgSecondary: '#12121e',
    bgTertiary: '#1a1a2e',
    bgHover: '#252540',
    bgElevated: '#161628',
    bgSurface: '#0e0e1a',
    bgOverlay: 'rgba(10, 10, 20, 0.7)',
    textPrimary: '#e8e8ff',
    textSecondary: '#a0a0c0',
    textMuted: '#7878a0',
    textInverse: '#0a0a14',
    textOnAccent: '#ffffff',
    accent: '#8b5cf6',
    accentHover: '#a78bfa',
    accentGlow: 'rgba(139, 92, 246, 0.25)',
    accentSoft: 'rgba(139, 92, 246, 0.1)',
    accentMuted: 'rgba(139, 92, 246, 0.5)',
    borderColor: 'rgba(139, 92, 246, 0.1)',
    borderLight: 'rgba(139, 92, 246, 0.15)',
    borderStrong: 'rgba(139, 92, 246, 0.2)',
    colorSuccess: '#10b981',
    colorWarning: '#f59e0b',
    colorError: '#ef4444',
    colorInfo: '#6366f1',
  },
  gradients: {
    accent: 'linear-gradient(135deg, #8b5cf6 0%, #a855f7 100%)',
  },
};

const sunsetTheme: ThemeConfig = {
  id: 'sunset',
  name: 'Sunset',
  author: 'Audiio Team',
  version: '1.0.0',
  description: 'Warm oranges and reds inspired by golden hour',
  mode: 'dark',
  source: 'builtin',
  colors: {
    bgPrimary: '#0f0a08',
    bgSecondary: '#1a1210',
    bgTertiary: '#241a16',
    bgHover: '#352520',
    bgElevated: '#1e1612',
    bgSurface: '#140e0c',
    bgOverlay: 'rgba(15, 10, 8, 0.7)',
    textPrimary: '#fff5f0',
    textSecondary: '#c0a090',
    textMuted: '#a08070',
    textInverse: '#0f0a08',
    textOnAccent: '#ffffff',
    accent: '#f97316',
    accentHover: '#fb923c',
    accentGlow: 'rgba(249, 115, 22, 0.25)',
    accentSoft: 'rgba(249, 115, 22, 0.1)',
    accentMuted: 'rgba(249, 115, 22, 0.5)',
    borderColor: 'rgba(249, 115, 22, 0.1)',
    borderLight: 'rgba(249, 115, 22, 0.15)',
    borderStrong: 'rgba(249, 115, 22, 0.2)',
    colorSuccess: '#22c55e',
    colorWarning: '#eab308',
    colorError: '#ef4444',
    colorInfo: '#3b82f6',
  },
  gradients: {
    accent: 'linear-gradient(135deg, #f97316 0%, #fb923c 50%, #fbbf24 100%)',
  },
};

const oceanTheme: ThemeConfig = {
  id: 'ocean',
  name: 'Ocean',
  author: 'Audiio Team',
  version: '1.0.0',
  description: 'Cool teals and cyans like deep ocean waters',
  mode: 'dark',
  source: 'builtin',
  colors: {
    bgPrimary: '#080a0a',
    bgSecondary: '#101414',
    bgTertiary: '#161c1c',
    bgHover: '#202828',
    bgElevated: '#121818',
    bgSurface: '#0c1010',
    bgOverlay: 'rgba(8, 10, 10, 0.7)',
    textPrimary: '#f0ffff',
    textSecondary: '#a0c0c0',
    textMuted: '#789090',
    textInverse: '#080a0a',
    textOnAccent: '#ffffff',
    accent: '#14b8a6',
    accentHover: '#2dd4bf',
    accentGlow: 'rgba(20, 184, 166, 0.25)',
    accentSoft: 'rgba(20, 184, 166, 0.1)',
    accentMuted: 'rgba(20, 184, 166, 0.5)',
    borderColor: 'rgba(20, 184, 166, 0.1)',
    borderLight: 'rgba(20, 184, 166, 0.15)',
    borderStrong: 'rgba(20, 184, 166, 0.2)',
    colorSuccess: '#10b981',
    colorWarning: '#f59e0b',
    colorError: '#ef4444',
    colorInfo: '#06b6d4',
  },
  gradients: {
    accent: 'linear-gradient(135deg, #14b8a6 0%, #06b6d4 100%)',
  },
};

const monochromeDarkTheme: ThemeConfig = {
  id: 'monochrome-dark',
  name: 'Monochrome Dark',
  author: 'Audiio Team',
  version: '1.0.0',
  description: 'Elegant grayscale with crisp white accents',
  mode: 'dark',
  source: 'builtin',
  colors: {
    bgPrimary: '#0a0a0a',
    bgSecondary: '#141414',
    bgTertiary: '#1e1e1e',
    bgHover: '#282828',
    bgElevated: '#1a1a1a',
    bgSurface: '#121212',
    bgOverlay: 'rgba(0, 0, 0, 0.7)',
    textPrimary: '#ffffff',
    textSecondary: '#a3a3a3',
    textMuted: '#737373',
    textInverse: '#000000',
    textOnAccent: '#000000',
    accent: '#ffffff',
    accentHover: '#e0e0e0',
    accentGlow: 'rgba(255, 255, 255, 0.15)',
    accentSoft: 'rgba(255, 255, 255, 0.08)',
    accentMuted: 'rgba(255, 255, 255, 0.4)',
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderLight: 'rgba(255, 255, 255, 0.15)',
    borderStrong: 'rgba(255, 255, 255, 0.2)',
    colorSuccess: '#4ade80',
    colorWarning: '#fbbf24',
    colorError: '#f87171',
    colorInfo: '#60a5fa',
  },
  gradients: {
    accent: 'linear-gradient(135deg, #ffffff 0%, #e0e0e0 100%)',
  },
};

const defaultLightTheme: ThemeConfig = {
  id: 'default-light',
  name: 'Default Light',
  author: 'Audiio Team',
  version: '1.0.0',
  description: 'Clean white theme with the classic green accent',
  mode: 'light',
  source: 'builtin',
  colors: {
    bgPrimary: '#ffffff',
    bgSecondary: '#f5f5f5',
    bgTertiary: '#ebebeb',
    bgHover: '#e0e0e0',
    bgElevated: '#ffffff',
    bgSurface: '#fafafa',
    bgOverlay: 'rgba(0, 0, 0, 0.4)',
    textPrimary: '#1a1a1a',
    textSecondary: '#666666',
    textMuted: '#999999',
    textInverse: '#ffffff',
    textOnAccent: '#ffffff',
    accent: '#1db954',
    accentHover: '#1aa34a',
    accentGlow: 'rgba(29, 185, 84, 0.2)',
    accentSoft: 'rgba(29, 185, 84, 0.08)',
    accentMuted: 'rgba(29, 185, 84, 0.4)',
    borderColor: 'rgba(0, 0, 0, 0.08)',
    borderLight: 'rgba(0, 0, 0, 0.05)',
    borderStrong: 'rgba(0, 0, 0, 0.15)',
    colorSuccess: '#16a34a',
    colorWarning: '#d97706',
    colorError: '#dc2626',
    colorInfo: '#2563eb',
  },
  shadows: {
    xs: '0 1px 3px rgba(0, 0, 0, 0.08)',
    sm: '0 2px 8px rgba(0, 0, 0, 0.1)',
    md: '0 4px 16px rgba(0, 0, 0, 0.12)',
    lg: '0 8px 32px rgba(0, 0, 0, 0.15)',
    xl: '0 16px 48px rgba(0, 0, 0, 0.18)',
    module: '0 4px 24px rgba(0, 0, 0, 0.08)',
    card: '0 2px 12px rgba(0, 0, 0, 0.06)',
    elevated: '0 8px 40px rgba(0, 0, 0, 0.12)',
  },
  glass: {
    bg: 'rgba(255, 255, 255, 0.85)',
    bgLight: 'rgba(255, 255, 255, 0.7)',
    border: 'rgba(0, 0, 0, 0.06)',
    borderStrong: 'rgba(0, 0, 0, 0.1)',
  },
};

const paperTheme: ThemeConfig = {
  id: 'paper',
  name: 'Paper',
  author: 'Audiio Team',
  version: '1.0.0',
  description: 'Warm cream and beige tones like aged paper',
  mode: 'light',
  source: 'builtin',
  colors: {
    bgPrimary: '#faf8f5',
    bgSecondary: '#f2efe8',
    bgTertiary: '#e8e4da',
    bgHover: '#ddd8cc',
    bgElevated: '#fffdf8',
    bgSurface: '#f5f2ec',
    bgOverlay: 'rgba(40, 35, 28, 0.4)',
    textPrimary: '#2c2820',
    textSecondary: '#6b6355',
    textMuted: '#9a9080',
    textInverse: '#faf8f5',
    textOnAccent: '#ffffff',
    accent: '#b45309',
    accentHover: '#d97706',
    accentGlow: 'rgba(180, 83, 9, 0.2)',
    accentSoft: 'rgba(180, 83, 9, 0.08)',
    accentMuted: 'rgba(180, 83, 9, 0.4)',
    borderColor: 'rgba(44, 40, 32, 0.08)',
    borderLight: 'rgba(44, 40, 32, 0.05)',
    borderStrong: 'rgba(44, 40, 32, 0.15)',
    colorSuccess: '#15803d',
    colorWarning: '#b45309',
    colorError: '#b91c1c',
    colorInfo: '#1d4ed8',
  },
  gradients: {
    accent: 'linear-gradient(135deg, #b45309 0%, #d97706 100%)',
    surface: 'linear-gradient(180deg, #f2efe8 0%, #faf8f5 100%)',
  },
  shadows: {
    xs: '0 1px 3px rgba(44, 40, 32, 0.06)',
    sm: '0 2px 8px rgba(44, 40, 32, 0.08)',
    md: '0 4px 16px rgba(44, 40, 32, 0.1)',
    lg: '0 8px 32px rgba(44, 40, 32, 0.12)',
    xl: '0 16px 48px rgba(44, 40, 32, 0.14)',
    module: '0 4px 24px rgba(44, 40, 32, 0.06)',
    card: '0 2px 12px rgba(44, 40, 32, 0.05)',
    elevated: '0 8px 40px rgba(44, 40, 32, 0.1)',
  },
  glass: {
    bg: 'rgba(250, 248, 245, 0.85)',
    bgLight: 'rgba(250, 248, 245, 0.7)',
    border: 'rgba(44, 40, 32, 0.06)',
    borderStrong: 'rgba(44, 40, 32, 0.1)',
  },
};

const monochromeLightTheme: ThemeConfig = {
  id: 'monochrome-light',
  name: 'Monochrome Light',
  author: 'Audiio Team',
  version: '1.0.0',
  description: 'Pure white with elegant gray accents',
  mode: 'light',
  source: 'builtin',
  colors: {
    bgPrimary: '#ffffff',
    bgSecondary: '#f8f8f8',
    bgTertiary: '#f0f0f0',
    bgHover: '#e8e8e8',
    bgElevated: '#ffffff',
    bgSurface: '#fcfcfc',
    bgOverlay: 'rgba(0, 0, 0, 0.5)',
    textPrimary: '#1a1a1a',
    textSecondary: '#6a6a6a',
    textMuted: '#9a9a9a',
    textInverse: '#ffffff',
    textOnAccent: '#ffffff',
    accent: '#1a1a1a',
    accentHover: '#333333',
    accentGlow: 'rgba(26, 26, 26, 0.15)',
    accentSoft: 'rgba(26, 26, 26, 0.06)',
    accentMuted: 'rgba(26, 26, 26, 0.35)',
    borderColor: 'rgba(0, 0, 0, 0.08)',
    borderLight: 'rgba(0, 0, 0, 0.04)',
    borderStrong: 'rgba(0, 0, 0, 0.12)',
    colorSuccess: '#16a34a',
    colorWarning: '#ca8a04',
    colorError: '#dc2626',
    colorInfo: '#2563eb',
  },
  gradients: {
    accent: 'linear-gradient(135deg, #1a1a1a 0%, #333333 100%)',
  },
  shadows: {
    xs: '0 1px 3px rgba(0, 0, 0, 0.06)',
    sm: '0 2px 8px rgba(0, 0, 0, 0.08)',
    md: '0 4px 16px rgba(0, 0, 0, 0.1)',
    lg: '0 8px 32px rgba(0, 0, 0, 0.12)',
    xl: '0 16px 48px rgba(0, 0, 0, 0.14)',
    module: '0 4px 24px rgba(0, 0, 0, 0.06)',
    card: '0 2px 12px rgba(0, 0, 0, 0.04)',
    elevated: '0 8px 40px rgba(0, 0, 0, 0.1)',
  },
  glass: {
    bg: 'rgba(255, 255, 255, 0.9)',
    bgLight: 'rgba(255, 255, 255, 0.75)',
    border: 'rgba(0, 0, 0, 0.05)',
    borderStrong: 'rgba(0, 0, 0, 0.08)',
  },
};

// All built-in themes
const builtinThemes: ThemeConfig[] = [
  defaultDarkTheme,
  midnightTheme,
  sunsetTheme,
  oceanTheme,
  monochromeDarkTheme,
  defaultLightTheme,
  paperTheme,
  monochromeLightTheme,
];

// ========================================
// Theme Store State & Actions
// ========================================

interface ThemeState {
  // Current active theme ID
  activeThemeId: string;

  // User's system mode preference
  systemMode: SystemMode;

  // All available themes (built-in + community)
  themes: ThemeConfig[];

  // Community themes only (for easy management)
  communityThemes: ThemeConfig[];

  // Actions
  setTheme: (themeId: string) => void;
  setSystemMode: (mode: SystemMode) => void;
  installTheme: (theme: ThemeConfig) => void;
  uninstallTheme: (themeId: string) => void;
  updateTheme: (themeId: string, updates: Partial<ThemeConfig>) => void;
  getTheme: (themeId: string) => ThemeConfig | undefined;
  getActiveTheme: () => ThemeConfig;
  getEffectiveColorMode: () => ColorMode;
  createCustomTheme: (config: Omit<ThemeConfig, 'id' | 'source'>) => ThemeConfig;
  exportTheme: (themeId: string) => string;
  importTheme: (json: string) => ThemeConfig | null;
}

// Helper to generate unique IDs
const generateThemeId = () => `custom-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

// Get system color scheme preference
const getSystemColorMode = (): ColorMode => {
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return 'dark';
};

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      activeThemeId: 'default-dark',
      systemMode: 'auto',
      themes: [...builtinThemes],
      communityThemes: [],

      setTheme: (themeId) => {
        const theme = get().themes.find((t) => t.id === themeId);
        if (theme) {
          set({ activeThemeId: themeId });
        }
      },

      setSystemMode: (mode) => {
        const { activeThemeId, themes } = get();
        const currentTheme = themes.find((t) => t.id === activeThemeId);

        // Determine the target color mode
        let targetColorMode: ColorMode;
        if (mode === 'auto') {
          targetColorMode = getSystemColorMode();
        } else {
          targetColorMode = mode;
        }

        // If current theme doesn't match target mode, switch to appropriate default
        if (currentTheme && currentTheme.mode !== targetColorMode) {
          const defaultTheme = targetColorMode === 'dark' ? 'default-dark' : 'default-light';
          set({ systemMode: mode, activeThemeId: defaultTheme });
        } else {
          set({ systemMode: mode });
        }
      },

      installTheme: (theme) => {
        // Ensure community themes have proper source
        const communityTheme: ThemeConfig = {
          ...theme,
          source: 'community',
          id: theme.id || generateThemeId(),
        };

        set((state) => ({
          themes: [...state.themes, communityTheme],
          communityThemes: [...state.communityThemes, communityTheme],
        }));
      },

      uninstallTheme: (themeId) => {
        const theme = get().themes.find((t) => t.id === themeId);

        // Don't allow uninstalling built-in themes
        if (theme?.source === 'builtin') {
          return;
        }

        set((state) => {
          // If this was the active theme, switch to default
          const newActiveId = state.activeThemeId === themeId ? 'default-dark' : state.activeThemeId;

          return {
            activeThemeId: newActiveId,
            themes: state.themes.filter((t) => t.id !== themeId),
            communityThemes: state.communityThemes.filter((t) => t.id !== themeId),
          };
        });
      },

      updateTheme: (themeId, updates) => {
        set((state) => ({
          themes: state.themes.map((t) =>
            t.id === themeId ? { ...t, ...updates } : t
          ),
          communityThemes: state.communityThemes.map((t) =>
            t.id === themeId ? { ...t, ...updates } : t
          ),
        }));
      },

      getTheme: (themeId) => {
        return get().themes.find((t) => t.id === themeId);
      },

      getActiveTheme: () => {
        const { activeThemeId, themes, systemMode } = get();

        // If auto mode, determine based on system preference
        if (systemMode === 'auto') {
          const colorMode = getSystemColorMode();
          const currentTheme = themes.find((t) => t.id === activeThemeId);

          // If current theme matches system preference, use it
          if (currentTheme?.mode === colorMode) {
            return currentTheme;
          }

          // Otherwise, return default for that mode
          const defaultId = colorMode === 'dark' ? 'default-dark' : 'default-light';
          return themes.find((t) => t.id === defaultId) || themes[0];
        }

        return themes.find((t) => t.id === activeThemeId) || themes[0];
      },

      getEffectiveColorMode: () => {
        const { systemMode, activeThemeId, themes } = get();

        if (systemMode === 'auto') {
          return getSystemColorMode();
        }

        const currentTheme = themes.find((t) => t.id === activeThemeId);
        return currentTheme?.mode || 'dark';
      },

      createCustomTheme: (config) => {
        const newTheme: ThemeConfig = {
          ...config,
          id: generateThemeId(),
          source: 'community',
        };

        get().installTheme(newTheme);
        return newTheme;
      },

      exportTheme: (themeId) => {
        const theme = get().themes.find((t) => t.id === themeId);
        if (!theme) return '';

        // Remove internal fields for export
        const exportData = {
          ...theme,
          id: theme.source === 'builtin' ? undefined : theme.id,
          source: undefined,
        };

        return JSON.stringify(exportData, null, 2);
      },

      importTheme: (json) => {
        try {
          const parsed = JSON.parse(json);

          // Validate required fields
          if (!parsed.name || !parsed.colors || !parsed.mode) {
            console.error('Invalid theme: missing required fields');
            return null;
          }

          const theme: ThemeConfig = {
            ...parsed,
            id: parsed.id || generateThemeId(),
            source: 'community',
            author: parsed.author || 'Unknown',
            version: parsed.version || '1.0.0',
          };

          get().installTheme(theme);
          return theme;
        } catch (error) {
          console.error('Failed to import theme:', error);
          return null;
        }
      },
    }),
    {
      name: 'audiio-themes',
      partialize: (state) => ({
        activeThemeId: state.activeThemeId,
        systemMode: state.systemMode,
        communityThemes: state.communityThemes,
      }),
      merge: (persisted, current) => {
        const persistedState = persisted as Partial<ThemeState>;

        // Merge community themes with built-in themes
        const allThemes = [
          ...builtinThemes,
          ...(persistedState.communityThemes || []),
        ];

        return {
          ...current,
          ...persistedState,
          themes: allThemes,
        };
      },
    }
  )
);

// ========================================
// System Color Scheme Listener
// ========================================

// Listen for system color scheme changes
if (typeof window !== 'undefined' && window.matchMedia) {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    const store = useThemeStore.getState();

    if (store.systemMode === 'auto') {
      const colorMode: ColorMode = e.matches ? 'dark' : 'light';
      const currentTheme = store.themes.find((t) => t.id === store.activeThemeId);

      // If current theme doesn't match new system preference, switch to default
      if (currentTheme?.mode !== colorMode) {
        const defaultTheme = colorMode === 'dark' ? 'default-dark' : 'default-light';
        store.setTheme(defaultTheme);
      }
    }
  });
}

// Export built-in themes for reference
export { builtinThemes };
