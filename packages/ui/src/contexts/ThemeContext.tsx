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
    bgPrimary: '--bg-primary',
    bgSecondary: '--bg-secondary',
    bgTertiary: '--bg-tertiary',
    bgHover: '--bg-hover',
    bgElevated: '--bg-elevated',
    bgSurface: '--bg-surface',
    bgOverlay: '--bg-overlay',
    textPrimary: '--text-primary',
    textSecondary: '--text-secondary',
    textMuted: '--text-muted',
    textInverse: '--text-inverse',
    accent: '--accent',
    accentHover: '--accent-hover',
    accentGlow: '--accent-glow',
    accentSoft: '--accent-soft',
    accentMuted: '--accent-muted',
    borderColor: '--border-color',
    borderLight: '--border-light',
    borderStrong: '--border-strong',
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
    // Colors
    '--bg-primary', '--bg-secondary', '--bg-tertiary', '--bg-hover',
    '--bg-elevated', '--bg-surface', '--bg-overlay',
    '--text-primary', '--text-secondary', '--text-muted', '--text-inverse',
    '--accent', '--accent-hover', '--accent-glow', '--accent-soft', '--accent-muted',
    '--border-color', '--border-light', '--border-strong',
    '--color-success', '--color-warning', '--color-error', '--color-info',
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
  const activeThemeId = useThemeStore((state) => state.activeThemeId);
  const systemMode = useThemeStore((state) => state.systemMode);
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

  // Re-apply theme when activeThemeId or systemMode changes
  useEffect(() => {
    applyCurrentTheme(true);
  }, [activeThemeId, systemMode]);

  // Listen for system color scheme changes when in auto mode
  useEffect(() => {
    if (systemMode !== 'auto') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const handleChange = () => {
      applyCurrentTheme(true);
    };

    mediaQuery.addEventListener('change', handleChange);

    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, [systemMode, applyCurrentTheme]);

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
