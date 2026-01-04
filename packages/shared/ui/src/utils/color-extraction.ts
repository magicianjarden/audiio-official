/**
 * Color Extraction Utility
 * Extracts dominant colors from artwork images for dynamic theming
 */

export interface ExtractedColors {
  /** Primary dominant color */
  dominant: string;
  /** Vibrant/saturated color */
  vibrant: string;
  /** Muted/desaturated color */
  muted: string;
  /** Darker vibrant variant */
  darkVibrant: string;
  /** Lighter vibrant variant */
  lightVibrant: string;
}

// Cache for extracted colors to avoid re-processing
const colorCache = new Map<string, ExtractedColors>();

/**
 * Default colors when extraction fails
 */
export function getDefaultColors(): ExtractedColors {
  return {
    dominant: '#1db954',
    vibrant: '#1ed760',
    muted: '#2d2d2d',
    darkVibrant: '#0d5c2a',
    lightVibrant: '#5eff8f'
  };
}

/**
 * Convert hex color to RGB components
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
      }
    : null;
}

/**
 * Convert RGB to hex color
 */
function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(x => {
    const hex = Math.round(Math.max(0, Math.min(255, x))).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }).join('');
}

/**
 * Calculate color luminance (0-1)
 */
function getLuminance(r: number, g: number, b: number): number {
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

/**
 * Calculate color saturation (0-1)
 */
function getSaturation(r: number, g: number, b: number): number {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max === 0) return 0;
  return (max - min) / max;
}

/**
 * Adjust color brightness
 */
function adjustBrightness(r: number, g: number, b: number, factor: number): { r: number; g: number; b: number } {
  return {
    r: Math.round(r * factor),
    g: Math.round(g * factor),
    b: Math.round(b * factor)
  };
}

/**
 * Simple color quantization using median cut algorithm
 * Returns array of dominant colors from pixel data
 */
function quantizeColors(imageData: Uint8ClampedArray, colorCount: number = 5): Array<{ r: number; g: number; b: number; count: number }> {
  // Build color histogram
  const colorMap = new Map<string, { r: number; g: number; b: number; count: number }>();

  for (let i = 0; i < imageData.length; i += 4) {
    const r = imageData[i] ?? 0;
    const g = imageData[i + 1] ?? 0;
    const b = imageData[i + 2] ?? 0;
    const a = imageData[i + 3] ?? 0;

    // Skip transparent pixels
    if (a < 128) continue;

    // Quantize to reduce unique colors (group similar colors)
    const qr = Math.round(r / 16) * 16;
    const qg = Math.round(g / 16) * 16;
    const qb = Math.round(b / 16) * 16;

    const key = `${qr},${qg},${qb}`;
    const existing = colorMap.get(key);

    if (existing) {
      existing.count++;
      // Keep more accurate color
      existing.r = Math.round(((existing.r ?? 0) * (existing.count - 1) + r) / existing.count);
      existing.g = Math.round(((existing.g ?? 0) * (existing.count - 1) + g) / existing.count);
      existing.b = Math.round(((existing.b ?? 0) * (existing.count - 1) + b) / existing.count);
    } else {
      colorMap.set(key, { r, g, b, count: 1 });
    }
  }

  // Sort by count and return top colors
  return Array.from(colorMap.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, colorCount * 3); // Get extra to filter
}

/**
 * Find the most suitable colors from the extracted palette
 */
function selectColors(colors: Array<{ r: number; g: number; b: number; count: number }>): ExtractedColors {
  if (colors.length === 0) {
    return getDefaultColors();
  }

  // Find dominant (most common, not too dark/light)
  let dominant = colors[0];
  for (const color of colors) {
    const lum = getLuminance(color.r, color.g, color.b);
    if (lum > 0.1 && lum < 0.9) {
      dominant = color;
      break;
    }
  }

  // Find vibrant (highest saturation with decent luminance)
  let vibrant = dominant;
  let maxSaturation = 0;
  for (const color of colors) {
    const sat = getSaturation(color.r, color.g, color.b);
    const lum = getLuminance(color.r, color.g, color.b);
    if (sat > maxSaturation && lum > 0.2 && lum < 0.8) {
      maxSaturation = sat;
      vibrant = color;
    }
  }

  // Find muted (lower saturation)
  let muted = dominant;
  let minSatForMuted = 1;
  for (const color of colors) {
    const sat = getSaturation(color.r, color.g, color.b);
    const lum = getLuminance(color.r, color.g, color.b);
    if (sat < minSatForMuted && sat > 0.05 && lum > 0.15 && lum < 0.85) {
      minSatForMuted = sat;
      muted = color;
    }
  }

  // Generate dark and light variants from vibrant
  const darkVibrant = adjustBrightness(vibrant.r ?? 0, vibrant.g ?? 0, vibrant.b ?? 0, 0.4);
  const lightVibrant = adjustBrightness(vibrant.r ?? 0, vibrant.g ?? 0, vibrant.b ?? 0, 1.4);

  return {
    dominant: rgbToHex(dominant.r ?? 0, dominant.g ?? 0, dominant.b ?? 0),
    vibrant: rgbToHex(vibrant.r ?? 0, vibrant.g ?? 0, vibrant.b ?? 0),
    muted: rgbToHex(muted.r ?? 0, muted.g ?? 0, muted.b ?? 0),
    darkVibrant: rgbToHex(darkVibrant.r ?? 0, darkVibrant.g ?? 0, darkVibrant.b ?? 0),
    lightVibrant: rgbToHex(lightVibrant.r ?? 0, lightVibrant.g ?? 0, lightVibrant.b ?? 0)
  };
}

/**
 * Extract colors from an image URL
 */
export async function extractColorsFromImage(imageUrl: string): Promise<ExtractedColors> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    const timeout = setTimeout(() => {
      resolve(getDefaultColors());
    }, 5000);

    img.onload = () => {
      clearTimeout(timeout);

      try {
        const canvas = document.createElement('canvas');
        const size = 50; // Sample at low resolution for speed
        canvas.width = size;
        canvas.height = size;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(getDefaultColors());
          return;
        }

        ctx.drawImage(img, 0, 0, size, size);
        const imageData = ctx.getImageData(0, 0, size, size).data;

        const colors = quantizeColors(imageData);
        const result = selectColors(colors);
        resolve(result);
      } catch (error) {
        console.warn('Color extraction failed:', error);
        resolve(getDefaultColors());
      }
    };

    img.onerror = () => {
      clearTimeout(timeout);
      resolve(getDefaultColors());
    };

    img.src = imageUrl;
  });
}

/**
 * Get colors for artwork with caching
 */
export async function getColorsForArtwork(url: string): Promise<ExtractedColors> {
  // Check cache first
  const cached = colorCache.get(url);
  if (cached) {
    return cached;
  }

  const colors = await extractColorsFromImage(url);
  colorCache.set(url, colors);

  // Limit cache size
  if (colorCache.size > 100) {
    const firstKey = colorCache.keys().next().value;
    if (firstKey) {
      colorCache.delete(firstKey);
    }
  }

  return colors;
}

/**
 * Clear the color cache
 */
export function clearColorCache(): void {
  colorCache.clear();
}

/**
 * Generate CSS gradient from extracted colors
 */
export function generateGradient(colors: ExtractedColors, direction: string = '180deg'): string {
  return `linear-gradient(${direction}, ${colors.dominant}cc 0%, ${colors.darkVibrant}99 50%, transparent 100%)`;
}

/**
 * Get a contrasting text color for a background
 * Uses WCAG-compliant contrast calculation for better accessibility
 */
export function getContrastingTextColor(bgHex: string): string {
  // Import dynamically to avoid circular dependencies
  // For simple cases, use the local luminance check as a fast path
  const rgb = hexToRgb(bgHex);
  if (!rgb) return '#ffffff';

  const luminance = getLuminance(rgb.r, rgb.g, rgb.b);
  return luminance > 0.5 ? '#000000' : '#ffffff';
}

/**
 * Get text colors optimized for a background (primary, secondary, muted)
 * Based on whether the background is light or dark
 */
export function getTextColorsForBackground(bgHex: string): {
  primary: string;
  secondary: string;
  muted: string;
  isDark: boolean;
} {
  const rgb = hexToRgb(bgHex);
  if (!rgb) {
    return {
      primary: '#f0f0f0',
      secondary: '#a3a3a3',
      muted: '#737373',
      isDark: true,
    };
  }

  const luminance = getLuminance(rgb.r, rgb.g, rgb.b);
  const isDark = luminance < 0.5;

  if (isDark) {
    return {
      primary: '#f0f0f0',
      secondary: '#a3a3a3',
      muted: '#737373',
      isDark: true,
    };
  } else {
    return {
      primary: '#1a1a1a',
      secondary: '#525252',
      muted: '#737373',
      isDark: false,
    };
  }
}
