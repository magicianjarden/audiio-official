/**
 * ThemeProvider - Applies theme CSS variables and manages theme state
 */

import React, { useEffect, useCallback, useRef } from 'react';
import { useThemeStore, type ThemeConfig, type ColorMode } from '../stores/theme-store';

// ========================================
// CSS Variable Application
// ========================================

/**
 * Convert camelCase to kebab-case for CSS variable names
 */
const toKebabCase = (str: string): string => {
  return str.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
};

/**
 * Apply theme colors as CSS variables to :root
 */
const applyThemeColors = (colors: ThemeConfig['colors']) => {
  const root = document.documentElement;

  // Map theme color keys to CSS variable names
  const colorMappings: Record<string, string> = {
    // Background colors
    bgPrimary: '--bg-primary',
    bgSecondary: '--bg-secondary',
    bgTertiary: '--bg-tertiary',
    bgHover: '--bg-hover',
    bgElevated: '--bg-elevated',
    bgSurface: '--bg-surface',
    bgOverlay: '--bg-overlay',
    // Text colors (expanded hierarchy)
    textHero: '--text-hero',
    textPrimary: '--text-primary',
    textSecondary: '--text-secondary',
    textTertiary: '--text-tertiary',
    textMuted: '--text-muted',
    textInverse: '--text-inverse',
    textOnAccent: '--text-on-accent',
    // Accent colors
    accent: '--accent',
    accentHover: '--accent-hover',
    accentGlow: '--accent-glow',
    accentSoft: '--accent-soft',
    accentMuted: '--accent-muted',
    // Lyrics accent (separate from main accent)
    lyricsAccent: '--lyrics-accent',
    lyricsAccentGlow: '--lyrics-accent-glow',
    // Border colors
    borderColor: '--border-color',
    borderLight: '--border-light',
    borderStrong: '--border-strong',
    // Scrollbar colors
    scrollbarThumb: '--scrollbar-thumb',
    scrollbarThumbHover: '--scrollbar-thumb-hover',
    // Overlay colors
    overlayLight: '--overlay-light',
    overlayMedium: '--overlay-medium',
    overlayStrong: '--overlay-strong',
    // Semantic colors
    colorSuccess: '--color-success',
    colorWarning: '--color-warning',
    colorError: '--color-error',
    colorInfo: '--color-info',
  };

  Object.entries(colorMappings).forEach(([key, cssVar]) => {
    const value = colors[key as keyof typeof colors];
    if (value) {
      root.style.setProperty(cssVar, value);
    }
  });
};

// ========================================
// Color Derivation Utilities
// ========================================

/**
 * Convert hex color to HSL components
 */
const hexToHSL = (hex: string): { h: number; s: number; l: number } => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return { h: 0, s: 0, l: 0 };

  let r = parseInt(result[1], 16) / 255;
  let g = parseInt(result[2], 16) / 255;
  let b = parseInt(result[3], 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }

  return { h: h * 360, s: s * 100, l: l * 100 };
};

/**
 * Convert HSL to hex color
 */
const hslToHex = (h: number, s: number, l: number): string => {
  h = ((h % 360) + 360) % 360; // Normalize hue
  s = Math.max(0, Math.min(100, s)) / 100;
  l = Math.max(0, Math.min(100, l)) / 100;

  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs((h / 60) % 2 - 1));
  const m = l - c / 2;

  let r = 0, g = 0, b = 0;

  if (h >= 0 && h < 60) { r = c; g = x; b = 0; }
  else if (h >= 60 && h < 120) { r = x; g = c; b = 0; }
  else if (h >= 120 && h < 180) { r = 0; g = c; b = x; }
  else if (h >= 180 && h < 240) { r = 0; g = x; b = c; }
  else if (h >= 240 && h < 300) { r = x; g = 0; b = c; }
  else { r = c; g = 0; b = x; }

  const toHex = (n: number) => Math.round((n + m) * 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

/**
 * Apply derived colors (energy levels, genre colors) based on the accent
 * These are auto-generated from the theme's accent color for visual cohesion
 */
const applyDerivedColors = (accent: string) => {
  const root = document.documentElement;
  const hsl = hexToHSL(accent);

  // Energy colors: hue rotation with varying saturation/lightness
  // Calm (cool) to Intense (warm) spectrum
  root.style.setProperty('--color-energy-calm', hslToHex(hsl.h - 60, hsl.s * 0.7, hsl.l));
  root.style.setProperty('--color-energy-chill', hslToHex(hsl.h - 30, hsl.s * 0.85, hsl.l));
  root.style.setProperty('--color-energy-balanced', accent);
  root.style.setProperty('--color-energy-upbeat', hslToHex(hsl.h + 30, hsl.s, Math.min(hsl.l * 1.05, 85)));
  root.style.setProperty('--color-energy-intense', hslToHex(hsl.h + 60, Math.min(hsl.s * 1.1, 100), hsl.l * 0.95));

  // Genre colors: distributed across color wheel for visual variety
  // Each genre gets a unique hue offset while maintaining similar saturation
  const genreColors = [
    { name: 'rock', offset: 0 },
    { name: 'pop', offset: 24 },
    { name: 'hiphop', offset: 48 },
    { name: 'electronic', offset: 72 },
    { name: 'rnb', offset: 96 },
    { name: 'jazz', offset: 120 },
    { name: 'classical', offset: 144 },
    { name: 'country', offset: 168 },
    { name: 'metal', offset: 192 },
    { name: 'folk', offset: 216 },
    { name: 'blues', offset: 240 },
    { name: 'reggae', offset: 264 },
    { name: 'latin', offset: 288 },
    { name: 'indie', offset: 312 },
    { name: 'ambient', offset: 336 },
  ];

  genreColors.forEach(({ name, offset }) => {
    const genreHue = (hsl.h + offset) % 360;
    root.style.setProperty(`--color-genre-${name}`, hslToHex(genreHue, 70, 50));
  });
};

/**
 * Apply theme gradients as CSS variables
 */
const applyThemeGradients = (gradients?: ThemeConfig['gradients']) => {
  if (!gradients) return;

  const root = document.documentElement;

  const gradientMappings: Record<string, string> = {
    accent: '--gradient-accent',
    surface: '--gradient-surface',
    purple: '--gradient-purple',
    pink: '--gradient-pink',
    blue: '--gradient-blue',
    orange: '--gradient-orange',
    red: '--gradient-red',
    teal: '--gradient-teal',
  };

  Object.entries(gradientMappings).forEach(([key, cssVar]) => {
    const value = gradients[key as keyof typeof gradients];
    if (value) {
      root.style.setProperty(cssVar, value);
    }
  });
};

/**
 * Apply theme shadows as CSS variables
 */
const applyThemeShadows = (shadows?: ThemeConfig['shadows']) => {
  if (!shadows) return;

  const root = document.documentElement;

  const shadowMappings: Record<string, string> = {
    xs: '--shadow-xs',
    sm: '--shadow-sm',
    md: '--shadow-md',
    lg: '--shadow-lg',
    xl: '--shadow-xl',
    glow: '--shadow-glow',
    module: '--shadow-module',
    card: '--shadow-card',
    elevated: '--shadow-elevated',
  };

  Object.entries(shadowMappings).forEach(([key, cssVar]) => {
    const value = shadows[key as keyof typeof shadows];
    if (value) {
      root.style.setProperty(cssVar, value);
    }
  });
};

/**
 * Apply theme glass effects as CSS variables
 */
const applyThemeGlass = (glass?: ThemeConfig['glass']) => {
  if (!glass) return;

  const root = document.documentElement;

  const glassMappings: Record<string, string> = {
    bg: '--glass-bg',
    bgLight: '--glass-bg-light',
    border: '--glass-border',
    borderStrong: '--glass-border-strong',
    blur: '--glass-blur',
    blurStrong: '--glass-blur-strong',
  };

  Object.entries(glassMappings).forEach(([key, cssVar]) => {
    const value = glass[key as keyof typeof glass];
    if (value) {
      root.style.setProperty(cssVar, value);
    }
  });
};

/**
 * Apply theme radius as CSS variables
 */
const applyThemeRadius = (radius?: ThemeConfig['radius']) => {
  if (!radius) return;

  const root = document.documentElement;

  const radiusMappings: Record<string, string> = {
    xs: '--radius-xs',
    sm: '--radius-sm',
    md: '--radius-md',
    lg: '--radius-lg',
    xl: '--radius-xl',
    '2xl': '--radius-2xl',
    full: '--radius-full',
    module: '--radius-module',
    card: '--radius-card',
    button: '--radius-button',
  };

  Object.entries(radiusMappings).forEach(([key, cssVar]) => {
    const value = radius[key as keyof typeof radius];
    if (value) {
      root.style.setProperty(cssVar, value);
    }
  });
};

/**
 * Apply theme fonts as CSS variables
 */
const applyThemeFonts = (fonts?: ThemeConfig['fonts']) => {
  if (!fonts) return;

  const root = document.documentElement;

  if (fonts.sans) {
    root.style.setProperty('--font-sans', fonts.sans);
  }
  if (fonts.mono) {
    root.style.setProperty('--font-mono', fonts.mono);
  }
};

// Custom CSS style element ID
const CUSTOM_CSS_ID = 'audiio-theme-custom-css';

/**
 * Apply custom CSS from theme (sanitized)
 */
const applyCustomCSS = (themeId: string, customCSS?: string) => {
  // Remove any existing custom CSS
  const existingStyle = document.getElementById(CUSTOM_CSS_ID);
  if (existingStyle) {
    existingStyle.remove();
  }

  if (!customCSS) return;

  // Sanitize the CSS
  const sanitizedCSS = sanitizeCustomCSS(customCSS);

  if (sanitizedCSS) {
    const styleElement = document.createElement('style');
    styleElement.id = CUSTOM_CSS_ID;
    styleElement.setAttribute('data-theme-id', themeId);
    styleElement.textContent = sanitizedCSS;
    document.head.appendChild(styleElement);
  }
};

/**
 * Sanitize custom CSS to prevent XSS and other security issues
 */
const sanitizeCustomCSS = (css: string): string => {
  // Block dangerous patterns
  const blockedPatterns = [
    /expression\s*\(/gi,           // IE expression()
    /javascript\s*:/gi,            // javascript: URLs
    /behavior\s*:/gi,              // IE behavior
    /@import/gi,                   // External imports
    /url\s*\(\s*["']?data:/gi,     // Data URLs (potential XSS)
    /-moz-binding/gi,              // Firefox XBL
    /vbscript\s*:/gi,              // VBScript
  ];

  let sanitized = css;

  // Remove blocked patterns
  blockedPatterns.forEach((pattern) => {
    sanitized = sanitized.replace(pattern, '/* blocked */');
  });

  // Limit CSS size
  if (sanitized.length > 50000) {
    console.warn('Custom CSS exceeds 50KB limit, truncating');
    sanitized = sanitized.substring(0, 50000);
  }

  // Scope all selectors to .app container for safety
  // This is a simple implementation - production would need a proper CSS parser
  try {
    // Add .app prefix to selectors that don't already have it
    // This prevents themes from affecting elements outside the app
    const scopedCSS = sanitized.replace(
      /([^\r\n,{}]+)(\s*\{)/g,
      (match, selector, brace) => {
        // Skip if already scoped or is a keyframe/media query
        if (
          selector.trim().startsWith('.app') ||
          selector.trim().startsWith('@') ||
          selector.trim().startsWith(':root') ||
          selector.trim().startsWith('from') ||
          selector.trim().startsWith('to') ||
          /^\d+%$/.test(selector.trim())
        ) {
          return match;
        }
        return `.app ${selector.trim()}${brace}`;
      }
    );
    return scopedCSS;
  } catch {
    // If scoping fails, return the sanitized but unscoped CSS
    return sanitized;
  }
};

/**
 * Clear all theme-related inline styles from root
 * This ensures old theme values don't persist when switching themes
 */
const clearThemeStyles = () => {
  const root = document.documentElement;

  // All CSS variables that themes can set
  const themeVariables = [
    // Background colors
    '--bg-primary', '--bg-secondary', '--bg-tertiary', '--bg-hover',
    '--bg-elevated', '--bg-surface', '--bg-overlay',
    // Text colors (expanded)
    '--text-hero', '--text-primary', '--text-secondary', '--text-tertiary',
    '--text-muted', '--text-inverse', '--text-on-accent',
    // Accent colors
    '--accent', '--accent-hover', '--accent-glow', '--accent-soft', '--accent-muted',
    // Lyrics accent
    '--lyrics-accent', '--lyrics-accent-glow',
    // Border colors
    '--border-color', '--border-light', '--border-strong',
    // Scrollbar colors
    '--scrollbar-thumb', '--scrollbar-thumb-hover',
    // Overlay colors
    '--overlay-light', '--overlay-medium', '--overlay-strong',
    // Semantic colors
    '--color-success', '--color-warning', '--color-error', '--color-info',
    // Energy colors (derived)
    '--color-energy-calm', '--color-energy-chill', '--color-energy-balanced',
    '--color-energy-upbeat', '--color-energy-intense',
    // Genre colors (derived)
    '--color-genre-rock', '--color-genre-pop', '--color-genre-hiphop',
    '--color-genre-electronic', '--color-genre-rnb', '--color-genre-jazz',
    '--color-genre-classical', '--color-genre-country', '--color-genre-metal',
    '--color-genre-folk', '--color-genre-blues', '--color-genre-reggae',
    '--color-genre-latin', '--color-genre-indie', '--color-genre-ambient',
    // Gradients
    '--gradient-accent', '--gradient-surface', '--gradient-purple', '--gradient-pink',
    '--gradient-blue', '--gradient-orange', '--gradient-red', '--gradient-teal',
    // Shadows
    '--shadow-xs', '--shadow-sm', '--shadow-md', '--shadow-lg', '--shadow-xl',
    '--shadow-glow', '--shadow-module', '--shadow-card', '--shadow-elevated',
    // Glass
    '--glass-bg', '--glass-bg-light', '--glass-border', '--glass-border-strong',
    '--glass-blur', '--glass-blur-strong',
    // Radius
    '--radius-xs', '--radius-sm', '--radius-md', '--radius-lg', '--radius-xl',
    '--radius-2xl', '--radius-full', '--radius-module', '--radius-card', '--radius-button',
    // Fonts
    '--font-sans', '--font-mono',
    // Mode
    '--color-mode',
  ];

  themeVariables.forEach((variable) => {
    root.style.removeProperty(variable);
  });
};

/**
 * Apply all theme properties
 */
const applyTheme = (theme: ThemeConfig) => {
  const root = document.documentElement;

  // Clear old theme styles first to prevent stale values
  clearThemeStyles();

  // Set color mode attribute for CSS selectors
  root.setAttribute('data-theme', theme.mode);
  root.style.setProperty('--color-mode', theme.mode);

  // Apply all theme properties
  applyThemeColors(theme.colors);
  applyDerivedColors(theme.colors.accent); // Generate energy/genre colors from accent
  applyThemeGradients(theme.gradients);
  applyThemeShadows(theme.shadows);
  applyThemeGlass(theme.glass);
  applyThemeRadius(theme.radius);
  applyThemeFonts(theme.fonts);
  applyCustomCSS(theme.id, theme.customCSS);
};

// ========================================
// ThemeProvider Component
// ========================================

interface ThemeProviderProps {
  children: React.ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const getActiveTheme = useThemeStore((state) => state.getActiveTheme);
  const autoMode = useThemeStore((state) => state.autoMode);
  const preferredDarkThemeId = useThemeStore((state) => state.preferredDarkThemeId);
  const preferredLightThemeId = useThemeStore((state) => state.preferredLightThemeId);
  const manualThemeId = useThemeStore((state) => state.manualThemeId);
  const lastAppliedThemeRef = useRef<string | null>(null);

  // Apply theme - always apply when called from effects
  const applyCurrentTheme = useCallback((forceApply = false) => {
    const theme = getActiveTheme();
    const themeKey = `${theme.id}-${theme.mode}`;

    // Apply if theme changed or forced
    if (forceApply || lastAppliedThemeRef.current !== themeKey) {
      applyTheme(theme);
      lastAppliedThemeRef.current = themeKey;
    }
  }, [getActiveTheme]);

  // Initial theme application
  useEffect(() => {
    applyCurrentTheme(true);
  }, []);

  // Re-apply theme when theme preferences change
  useEffect(() => {
    applyCurrentTheme(true);
  }, [autoMode, preferredDarkThemeId, preferredLightThemeId, manualThemeId]);

  // Listen for system color scheme changes when in auto mode
  useEffect(() => {
    if (!autoMode) return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const handleChange = () => {
      applyCurrentTheme(true);
    };

    mediaQuery.addEventListener('change', handleChange);

    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, [autoMode, applyCurrentTheme]);

  return <>{children}</>;
};

// ========================================
// Theme Hooks
// ========================================

/**
 * Hook to get the current theme
 */
export const useCurrentTheme = () => {
  return useThemeStore((state) => state.getActiveTheme());
};

/**
 * Hook to get the current color mode
 */
export const useColorMode = (): ColorMode => {
  return useThemeStore((state) => state.getEffectiveColorMode());
};

/**
 * Hook to check if dark mode is active
 */
export const useIsDarkMode = (): boolean => {
  return useColorMode() === 'dark';
};

export default ThemeProvider;
