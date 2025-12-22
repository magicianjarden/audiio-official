/**
 * Theme utilities for importing, validating, and sanitizing themes
 */

import type { ThemeConfig, ThemeColors } from '../stores/theme-store';

// ========================================
// GitHub URL Parsing
// ========================================

interface GitHubRepo {
  owner: string;
  repo: string;
  branch?: string;
}

/**
 * Parse a GitHub URL into owner/repo parts
 * Supports various formats:
 * - https://github.com/user/repo
 * - github.com/user/repo
 * - user/repo
 */
export function parseGitHubUrl(url: string): GitHubRepo | null {
  // Clean up the URL
  let cleanUrl = url.trim();

  // Handle shorthand format: user/repo
  if (/^[a-zA-Z0-9_-]+\/[a-zA-Z0-9_.-]+$/.test(cleanUrl)) {
    const parts = cleanUrl.split('/');
    const owner = parts[0] ?? '';
    const repo = parts[1] ?? '';
    return { owner, repo };
  }

  // Handle full URLs
  try {
    // Add protocol if missing
    if (!cleanUrl.startsWith('http')) {
      cleanUrl = 'https://' + cleanUrl;
    }

    const urlObj = new URL(cleanUrl);

    // Verify it's a GitHub URL
    if (!urlObj.hostname.includes('github.com')) {
      return null;
    }

    // Extract path parts: /owner/repo
    const pathParts = urlObj.pathname.split('/').filter(Boolean);

    if (pathParts.length < 2) {
      return null;
    }

    const owner = pathParts[0] ?? '';
    const repo = pathParts[1] ?? '';

    // Check if a branch is specified in the URL
    let branch: string | undefined;
    if (pathParts.length > 3 && pathParts[2] === 'tree') {
      branch = pathParts[3];
    }

    return { owner, repo: repo.replace(/\.git$/, ''), branch };
  } catch {
    return null;
  }
}

/**
 * Convert a GitHub repo to a raw content URL for the theme manifest
 */
export function getGitHubRawUrl(repo: GitHubRepo, filename = 'audiio-theme.json'): string {
  const branch = repo.branch || 'main';
  return `https://raw.githubusercontent.com/${repo.owner}/${repo.repo}/${branch}/${filename}`;
}

// ========================================
// Theme Validation
// ========================================

const REQUIRED_THEME_FIELDS = ['name', 'colors'] as const;
const REQUIRED_COLOR_FIELDS: (keyof ThemeColors)[] = [
  'bgPrimary',
  'bgSecondary',
  'textPrimary',
  'textSecondary',
  'accent',
];

interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validate a theme configuration object
 */
export function validateTheme(theme: unknown): ValidationResult {
  const errors: string[] = [];

  if (!theme || typeof theme !== 'object') {
    return { valid: false, errors: ['Theme must be an object'] };
  }

  const t = theme as Record<string, unknown>;

  // Check required fields
  for (const field of REQUIRED_THEME_FIELDS) {
    if (!t[field]) {
      errors.push(`Missing required field: ${field}`);
    }
  }

  // Validate name
  if (t.name && typeof t.name !== 'string') {
    errors.push('Theme name must be a string');
  }

  // Validate colors
  if (t.colors) {
    if (typeof t.colors !== 'object') {
      errors.push('Colors must be an object');
    } else {
      const colors = t.colors as Record<string, unknown>;

      // Check required color fields
      for (const colorField of REQUIRED_COLOR_FIELDS) {
        if (!colors[colorField]) {
          errors.push(`Missing required color: ${colorField}`);
        } else if (!isValidColor(colors[colorField] as string)) {
          errors.push(`Invalid color value for ${colorField}: ${colors[colorField]}`);
        }
      }
    }
  }

  // Validate mode
  if (t.mode && !['light', 'dark'].includes(t.mode as string)) {
    errors.push('Mode must be "light" or "dark"');
  }

  // Validate customCSS size
  if (t.customCSS && typeof t.customCSS === 'string') {
    if (t.customCSS.length > 50000) {
      errors.push('Custom CSS must be less than 50KB');
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Check if a string is a valid CSS color value
 */
export function isValidColor(value: string): boolean {
  if (!value || typeof value !== 'string') return false;

  // Hex colors
  if (/^#([0-9A-Fa-f]{3}){1,2}$/.test(value)) return true;
  if (/^#([0-9A-Fa-f]{4}){1,2}$/.test(value)) return true;

  // RGB/RGBA
  if (/^rgba?\s*\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*(,\s*[\d.]+)?\s*\)$/i.test(value)) return true;

  // HSL/HSLA
  if (/^hsla?\s*\(\s*\d+\s*,\s*[\d.]+%?\s*,\s*[\d.]+%?\s*(,\s*[\d.]+)?\s*\)$/i.test(value)) return true;

  // Named colors (basic check)
  const namedColors = [
    'transparent', 'currentColor', 'inherit',
    'black', 'white', 'red', 'green', 'blue', 'yellow', 'orange', 'purple',
    'gray', 'grey', 'pink', 'cyan', 'magenta',
  ];
  if (namedColors.includes(value.toLowerCase())) return true;

  return false;
}

// ========================================
// CSS Sanitization
// ========================================

/**
 * Blocked CSS patterns that could be used for XSS or other attacks
 */
const BLOCKED_CSS_PATTERNS = [
  /expression\s*\(/gi,           // IE expression()
  /javascript\s*:/gi,            // javascript: URLs
  /vbscript\s*:/gi,              // vbscript: URLs
  /behavior\s*:/gi,              // IE behavior
  /@import/gi,                   // External imports
  /url\s*\(\s*["']?data:/gi,     // Data URLs (potential XSS)
  /-moz-binding/gi,              // Firefox XBL bindings
  /binding\s*:/gi,               // IE binding
];

/**
 * Sanitize custom CSS to prevent XSS and other attacks
 * @param css - The raw CSS string
 * @returns Sanitized CSS string
 */
export function sanitizeCSS(css: string): string {
  if (!css || typeof css !== 'string') return '';

  let sanitized = css;

  // Remove blocked patterns
  for (const pattern of BLOCKED_CSS_PATTERNS) {
    sanitized = sanitized.replace(pattern, '/* blocked */');
  }

  // Scope all selectors to .audiio-app to prevent affecting other pages
  // This is a simple implementation - a full CSS parser would be more robust
  sanitized = scopeCSS(sanitized, '.audiio-app');

  return sanitized;
}

/**
 * Scope CSS selectors to a parent selector
 */
function scopeCSS(css: string, scope: string): string {
  // Split into rules (simplified - doesn't handle nested @rules well)
  const lines = css.split('\n');
  const result: string[] = [];
  let inBlock = false;
  let blockContent = '';
  let selector = '';

  for (const line of lines) {
    const trimmed = line.trim();

    // Handle @rules (media queries, keyframes, etc.) - pass through
    if (trimmed.startsWith('@')) {
      result.push(line);
      continue;
    }

    if (trimmed.includes('{')) {
      // Start of a rule block
      const parts = trimmed.split('{');
      selector = (parts[0] ?? '').trim();

      // Skip if already scoped or is a root selector
      if (!selector.startsWith(scope) && !selector.startsWith(':root')) {
        // Scope the selector
        selector = selector
          .split(',')
          .map((s) => {
            const trimmedS = s.trim();
            // Handle pseudo-elements and pseudo-classes on body/html
            if (trimmedS.startsWith('body') || trimmedS.startsWith('html')) {
              return `${scope} ${trimmedS}`;
            }
            return `${scope} ${trimmedS}`;
          })
          .join(', ');
      }

      result.push(`${selector} {`);
      inBlock = true;
      blockContent = parts.slice(1).join('{');

      if (blockContent.includes('}')) {
        // Single line rule
        result.push(blockContent);
        inBlock = false;
        blockContent = '';
      }
    } else if (inBlock) {
      if (trimmed.includes('}')) {
        result.push(line);
        inBlock = false;
        blockContent = '';
      } else {
        result.push(line);
      }
    } else {
      result.push(line);
    }
  }

  return result.join('\n');
}

// ========================================
// Theme Fetching
// ========================================

/**
 * Fetch a theme from a GitHub repository
 */
export async function fetchThemeFromGitHub(url: string): Promise<ThemeConfig | null> {
  const repo = parseGitHubUrl(url);

  if (!repo) {
    throw new Error('Invalid GitHub URL format');
  }

  // Try different manifest filenames
  const manifestNames = ['audiio-theme.json', 'theme.json', '.audiio-theme.json'];

  for (const filename of manifestNames) {
    try {
      const rawUrl = getGitHubRawUrl(repo, filename);
      const response = await fetch(rawUrl);

      if (response.ok) {
        const theme = await response.json();
        const validation = validateTheme(theme);

        if (!validation.valid) {
          throw new Error(`Invalid theme: ${validation.errors.join(', ')}`);
        }

        // Sanitize custom CSS if present
        if (theme.customCSS) {
          theme.customCSS = sanitizeCSS(theme.customCSS);
        }

        return theme as ThemeConfig;
      }
    } catch (error) {
      // Try next filename
      continue;
    }
  }

  throw new Error('Could not find a valid theme manifest in the repository');
}

/**
 * Fetch a theme from a direct URL
 */
export async function fetchThemeFromUrl(url: string): Promise<ThemeConfig | null> {
  try {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.statusText}`);
    }

    const theme = await response.json();
    const validation = validateTheme(theme);

    if (!validation.valid) {
      throw new Error(`Invalid theme: ${validation.errors.join(', ')}`);
    }

    // Sanitize custom CSS if present
    if (theme.customCSS) {
      theme.customCSS = sanitizeCSS(theme.customCSS);
    }

    return theme as ThemeConfig;
  } catch (error) {
    throw new Error(`Failed to fetch theme: ${error}`);
  }
}

// ========================================
// Color Utilities
// ========================================

/**
 * Convert hex color to RGB components
 */
export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1] ?? '0', 16),
        g: parseInt(result[2] ?? '0', 16),
        b: parseInt(result[3] ?? '0', 16),
      }
    : null;
}

/**
 * Convert RGB to hex
 */
export function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map((x) => {
    const hex = Math.max(0, Math.min(255, Math.round(x))).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }).join('');
}

/**
 * Adjust the brightness of a color
 */
export function adjustBrightness(hex: string, percent: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;

  const adjust = (value: number) => Math.min(255, Math.max(0, value + (value * percent) / 100));

  return rgbToHex(adjust(rgb.r), adjust(rgb.g), adjust(rgb.b));
}

/**
 * Get a contrasting text color (black or white) for a background
 */
export function getContrastColor(bgHex: string): string {
  const rgb = hexToRgb(bgHex);
  if (!rgb) return '#ffffff';

  // Calculate luminance
  const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;

  return luminance > 0.5 ? '#000000' : '#ffffff';
}

/**
 * Generate a palette of colors from a base color
 */
export function generatePalette(baseColor: string) {
  return {
    lightest: adjustBrightness(baseColor, 60),
    lighter: adjustBrightness(baseColor, 30),
    light: adjustBrightness(baseColor, 15),
    base: baseColor,
    dark: adjustBrightness(baseColor, -15),
    darker: adjustBrightness(baseColor, -30),
    darkest: adjustBrightness(baseColor, -50),
  };
}
