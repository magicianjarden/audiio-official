/**
 * WCAG-Compliant Contrast Utilities
 *
 * Provides functions for calculating color contrast ratios and ensuring
 * text readability on dynamic backgrounds (e.g., album art, gradients).
 *
 * Based on WCAG 2.1 guidelines:
 * - AA Normal Text: 4.5:1
 * - AA Large Text: 3:1
 * - AAA Normal Text: 7:1
 * - AAA Large Text: 4.5:1
 */

// ========================================
// Color Parsing Utilities
// ========================================

/**
 * Parse a color string to RGB values
 * Supports: hex (#fff, #ffffff), rgb(), rgba()
 */
export function parseColor(color: string): { r: number; g: number; b: number } | null {
  if (!color) return null;

  // Hex format
  const hexMatch = color.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
  if (hexMatch) {
    return {
      r: parseInt(hexMatch[1], 16),
      g: parseInt(hexMatch[2], 16),
      b: parseInt(hexMatch[3], 16),
    };
  }

  // Short hex format (#fff)
  const shortHexMatch = color.match(/^#?([a-f\d])([a-f\d])([a-f\d])$/i);
  if (shortHexMatch) {
    return {
      r: parseInt(shortHexMatch[1] + shortHexMatch[1], 16),
      g: parseInt(shortHexMatch[2] + shortHexMatch[2], 16),
      b: parseInt(shortHexMatch[3] + shortHexMatch[3], 16),
    };
  }

  // RGB/RGBA format
  const rgbMatch = color.match(/rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (rgbMatch) {
    return {
      r: parseInt(rgbMatch[1], 10),
      g: parseInt(rgbMatch[2], 10),
      b: parseInt(rgbMatch[3], 10),
    };
  }

  return null;
}

/**
 * Convert RGB to hex string
 */
export function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

// ========================================
// WCAG Luminance & Contrast Calculations
// ========================================

/**
 * Calculate relative luminance of a color per WCAG 2.1
 * https://www.w3.org/WAI/GL/wiki/Relative_luminance
 *
 * @returns Luminance value between 0 (black) and 1 (white)
 */
export function getRelativeLuminance(r: number, g: number, b: number): number {
  // Convert 0-255 to 0-1
  const rsRGB = r / 255;
  const gsRGB = g / 255;
  const bsRGB = b / 255;

  // Apply gamma correction
  const rLinear = rsRGB <= 0.03928 ? rsRGB / 12.92 : Math.pow((rsRGB + 0.055) / 1.055, 2.4);
  const gLinear = gsRGB <= 0.03928 ? gsRGB / 12.92 : Math.pow((gsRGB + 0.055) / 1.055, 2.4);
  const bLinear = bsRGB <= 0.03928 ? bsRGB / 12.92 : Math.pow((bsRGB + 0.055) / 1.055, 2.4);

  // Calculate luminance
  return 0.2126 * rLinear + 0.7152 * gLinear + 0.0722 * bLinear;
}

/**
 * Calculate luminance from a color string
 */
export function getLuminanceFromColor(color: string): number {
  const rgb = parseColor(color);
  if (!rgb) return 0;
  return getRelativeLuminance(rgb.r, rgb.g, rgb.b);
}

/**
 * Calculate contrast ratio between two colors per WCAG 2.1
 * https://www.w3.org/WAI/GL/wiki/Contrast_ratio
 *
 * @returns Contrast ratio between 1:1 (same color) and 21:1 (black/white)
 */
export function getContrastRatio(color1: string, color2: string): number {
  const l1 = getLuminanceFromColor(color1);
  const l2 = getLuminanceFromColor(color2);

  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);

  return (lighter + 0.05) / (darker + 0.05);
}

// ========================================
// WCAG Compliance Checks
// ========================================

/**
 * WCAG 2.1 compliance levels
 */
export type WCAGLevel = 'AAA' | 'AA' | 'A' | 'fail';

/**
 * Get the WCAG compliance level for a contrast ratio
 *
 * @param ratio - The contrast ratio to check
 * @param isLargeText - Whether the text is large (>= 18pt or >= 14pt bold)
 */
export function getWCAGLevel(ratio: number, isLargeText = false): WCAGLevel {
  if (isLargeText) {
    // Large text has lower thresholds
    if (ratio >= 4.5) return 'AAA';
    if (ratio >= 3) return 'AA';
  } else {
    // Normal text
    if (ratio >= 7) return 'AAA';
    if (ratio >= 4.5) return 'AA';
  }
  return 'fail';
}

/**
 * Check if contrast meets WCAG AA requirements
 */
export function meetsWCAG_AA(foreground: string, background: string, isLargeText = false): boolean {
  const ratio = getContrastRatio(foreground, background);
  const threshold = isLargeText ? 3 : 4.5;
  return ratio >= threshold;
}

/**
 * Check if contrast meets WCAG AAA requirements
 */
export function meetsWCAG_AAA(foreground: string, background: string, isLargeText = false): boolean {
  const ratio = getContrastRatio(foreground, background);
  const threshold = isLargeText ? 4.5 : 7;
  return ratio >= threshold;
}

// ========================================
// Accessible Color Selection
// ========================================

/**
 * Get the best text color (black or white) for a given background
 *
 * @param background - The background color
 * @param preferLight - Prefer light text when contrast is similar (for dark themes)
 * @returns The optimal text color and its contrast ratio
 */
export function getAccessibleTextColor(
  background: string,
  preferLight = true
): { color: string; ratio: number } {
  const whiteRatio = getContrastRatio('#ffffff', background);
  const blackRatio = getContrastRatio('#000000', background);

  // If both pass AA and preference is set, use preference
  if (whiteRatio >= 4.5 && blackRatio >= 4.5) {
    return preferLight
      ? { color: '#ffffff', ratio: whiteRatio }
      : { color: '#000000', ratio: blackRatio };
  }

  // Otherwise, use the one with better contrast
  return whiteRatio >= blackRatio
    ? { color: '#ffffff', ratio: whiteRatio }
    : { color: '#000000', ratio: blackRatio };
}

/**
 * Determine if a background color is "dark" (luminance < 0.5)
 * This is a quick check for deciding text color direction
 */
export function isColorDark(color: string): boolean {
  return getLuminanceFromColor(color) < 0.5;
}

/**
 * Determine if a background color is "very dark" (luminance < 0.15)
 * Useful for full player/karaoke where we always want white text
 */
export function isColorVeryDark(color: string): boolean {
  return getLuminanceFromColor(color) < 0.15;
}

// ========================================
// Color Adjustment for Contrast
// ========================================

/**
 * Lighten a color by a percentage
 */
export function lighten(color: string, amount: number): string {
  const rgb = parseColor(color);
  if (!rgb) return color;

  const factor = 1 + amount / 100;
  return rgbToHex(
    rgb.r * factor,
    rgb.g * factor,
    rgb.b * factor
  );
}

/**
 * Darken a color by a percentage
 */
export function darken(color: string, amount: number): string {
  const rgb = parseColor(color);
  if (!rgb) return color;

  const factor = 1 - amount / 100;
  return rgbToHex(
    rgb.r * factor,
    rgb.g * factor,
    rgb.b * factor
  );
}

/**
 * Adjust a foreground color to meet a minimum contrast ratio against a background
 *
 * @param foreground - The foreground color to adjust
 * @param background - The background color (fixed)
 * @param targetRatio - The minimum contrast ratio to achieve (default: 4.5 for AA)
 * @param maxIterations - Maximum adjustment iterations
 * @returns The adjusted color, or original if already sufficient
 */
export function ensureContrast(
  foreground: string,
  background: string,
  targetRatio = 4.5,
  maxIterations = 10
): string {
  let currentRatio = getContrastRatio(foreground, background);

  if (currentRatio >= targetRatio) {
    return foreground;
  }

  const bgLuminance = getLuminanceFromColor(background);
  const shouldLighten = bgLuminance < 0.5; // Dark background = lighten foreground

  let adjustedColor = foreground;
  let step = 10;

  for (let i = 0; i < maxIterations && currentRatio < targetRatio; i++) {
    adjustedColor = shouldLighten
      ? lighten(adjustedColor, step)
      : darken(adjustedColor, step);

    currentRatio = getContrastRatio(adjustedColor, background);

    // Reduce step size as we get closer
    if (currentRatio > targetRatio * 0.8) {
      step = 5;
    }
  }

  // If we still don't meet the target, fall back to black or white
  if (currentRatio < targetRatio) {
    return getAccessibleTextColor(background).color;
  }

  return adjustedColor;
}

// ========================================
// Color Mixing
// ========================================

/**
 * Mix two colors together
 *
 * @param color1 - First color
 * @param color2 - Second color
 * @param weight - Weight of color1 (0-100, default 50)
 */
export function mixColors(color1: string, color2: string, weight = 50): string {
  const rgb1 = parseColor(color1);
  const rgb2 = parseColor(color2);

  if (!rgb1 || !rgb2) return color1;

  const w = weight / 100;
  return rgbToHex(
    rgb1.r * w + rgb2.r * (1 - w),
    rgb1.g * w + rgb2.g * (1 - w),
    rgb1.b * w + rgb2.b * (1 - w)
  );
}

/**
 * Create an overlay color that ensures text readability
 * Useful for dynamic backgrounds (album art, etc.)
 *
 * @param background - The background color
 * @param textColor - The text color that needs to be readable
 * @param targetRatio - Minimum contrast ratio to achieve
 * @returns An overlay color (rgba) that when applied will ensure readability
 */
export function getReadabilityOverlay(
  background: string,
  textColor = '#ffffff',
  targetRatio = 4.5
): { color: string; opacity: number } {
  const currentRatio = getContrastRatio(textColor, background);

  if (currentRatio >= targetRatio) {
    return { color: 'transparent', opacity: 0 };
  }

  // Determine overlay color based on text color
  const textLuminance = getLuminanceFromColor(textColor);
  const overlayColor = textLuminance > 0.5 ? '#000000' : '#ffffff';

  // Binary search for optimal opacity
  let low = 0;
  let high = 100;
  let bestOpacity = 0;

  while (high - low > 1) {
    const mid = Math.floor((low + high) / 2);
    const mixedBg = mixColors(overlayColor, background, mid);
    const ratio = getContrastRatio(textColor, mixedBg);

    if (ratio >= targetRatio) {
      bestOpacity = mid;
      high = mid;
    } else {
      low = mid;
    }
  }

  return {
    color: overlayColor,
    opacity: bestOpacity / 100,
  };
}
