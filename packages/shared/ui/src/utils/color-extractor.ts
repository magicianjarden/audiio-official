/**
 * Color Extractor - Extracts dominant colors from artwork for dynamic backgrounds
 */

export interface ExtractedColors {
  primary: string;
  secondary: string;
  accent: string;
  isDark: boolean;
}

// Cache for extracted colors to avoid re-processing
const colorCache = new Map<string, ExtractedColors>();

/**
 * Extract dominant colors from an image URL
 */
export async function extractColorsFromImage(imageUrl: string): Promise<ExtractedColors> {
  // Check cache first
  if (colorCache.has(imageUrl)) {
    return colorCache.get(imageUrl)!;
  }

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          resolve(getDefaultColors());
          return;
        }

        // Sample at reduced size for performance
        const sampleSize = 50;
        canvas.width = sampleSize;
        canvas.height = sampleSize;

        ctx.drawImage(img, 0, 0, sampleSize, sampleSize);
        const imageData = ctx.getImageData(0, 0, sampleSize, sampleSize);
        const colors = getColorsFromImageData(imageData);

        colorCache.set(imageUrl, colors);
        resolve(colors);
      } catch {
        resolve(getDefaultColors());
      }
    };

    img.onerror = () => {
      resolve(getDefaultColors());
    };

    img.src = imageUrl;
  });
}

/**
 * Analyze image data to extract colors
 */
function getColorsFromImageData(imageData: ImageData): ExtractedColors {
  const { data } = imageData;
  const colorBuckets: Map<string, { r: number; g: number; b: number; count: number }> = new Map();

  // Sample pixels and bucket by similar colors
  for (let i = 0; i < data.length; i += 16) { // Skip pixels for speed
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];

    if (a < 128) continue; // Skip transparent pixels

    // Quantize to reduce color space
    const qr = Math.floor(r / 32) * 32;
    const qg = Math.floor(g / 32) * 32;
    const qb = Math.floor(b / 32) * 32;
    const key = `${qr},${qg},${qb}`;

    const existing = colorBuckets.get(key);
    if (existing) {
      existing.r += r;
      existing.g += g;
      existing.b += b;
      existing.count++;
    } else {
      colorBuckets.set(key, { r, g, b, count: 1 });
    }
  }

  // Sort by frequency and filter out very dark/light colors
  const sortedColors = Array.from(colorBuckets.values())
    .filter(c => {
      const avg = (c.r + c.g + c.b) / (3 * c.count);
      return avg > 30 && avg < 220; // Filter extremes
    })
    .sort((a, b) => b.count - a.count)
    .map(c => ({
      r: Math.round(c.r / c.count),
      g: Math.round(c.g / c.count),
      b: Math.round(c.b / c.count),
      count: c.count
    }));

  if (sortedColors.length === 0) {
    return getDefaultColors();
  }

  // Pick primary, secondary, and accent colors
  const primary = sortedColors[0];
  const secondary = sortedColors[Math.min(1, sortedColors.length - 1)];

  // Find a vibrant accent color
  const accent = findVibrantColor(sortedColors) || sortedColors[Math.min(2, sortedColors.length - 1)];

  // Determine if the image is predominantly dark
  const avgLuminance = (primary.r * 0.299 + primary.g * 0.587 + primary.b * 0.114) / 255;
  const isDark = avgLuminance < 0.5;

  return {
    primary: rgbToHex(primary.r, primary.g, primary.b),
    secondary: rgbToHex(secondary.r, secondary.g, secondary.b),
    accent: rgbToHex(accent.r, accent.g, accent.b),
    isDark
  };
}

/**
 * Find the most vibrant (saturated) color from sorted colors
 */
function findVibrantColor(colors: Array<{ r: number; g: number; b: number; count: number }>) {
  let maxSaturation = 0;
  let vibrantColor = null;

  for (const color of colors.slice(0, 10)) {
    const max = Math.max(color.r, color.g, color.b);
    const min = Math.min(color.r, color.g, color.b);
    const saturation = max === 0 ? 0 : (max - min) / max;

    if (saturation > maxSaturation && saturation > 0.3) {
      maxSaturation = saturation;
      vibrantColor = color;
    }
  }

  return vibrantColor;
}

/**
 * Convert RGB to hex
 */
function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
}

/**
 * Darken a hex color
 */
export function darkenColor(hex: string, percent: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.max(0, Math.floor((num >> 16) * (1 - percent)));
  const g = Math.max(0, Math.floor(((num >> 8) & 0x00ff) * (1 - percent)));
  const b = Math.max(0, Math.floor((num & 0x0000ff) * (1 - percent)));
  return rgbToHex(r, g, b);
}

/**
 * Lighten a hex color
 */
export function lightenColor(hex: string, percent: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.min(255, Math.floor((num >> 16) + (255 - (num >> 16)) * percent));
  const g = Math.min(255, Math.floor(((num >> 8) & 0x00ff) + (255 - ((num >> 8) & 0x00ff)) * percent));
  const b = Math.min(255, Math.floor((num & 0x0000ff) + (255 - (num & 0x0000ff)) * percent));
  return rgbToHex(r, g, b);
}

/**
 * Default colors when extraction fails
 * Uses CSS variable values if available, otherwise dark fallbacks
 */
function getDefaultColors(): ExtractedColors {
  // Try to get theme colors from CSS variables (only in browser context)
  if (typeof document !== 'undefined') {
    const style = getComputedStyle(document.documentElement);
    const bgPrimary = style.getPropertyValue('--bg-primary').trim();
    const bgSecondary = style.getPropertyValue('--bg-secondary').trim();
    const accent = style.getPropertyValue('--accent').trim();

    if (bgPrimary && bgSecondary && accent) {
      // Determine if theme is dark based on bg-primary luminance
      const hex = bgPrimary.replace('#', '');
      if (hex.length === 6) {
        const r = parseInt(hex.slice(0, 2), 16);
        const g = parseInt(hex.slice(2, 4), 16);
        const b = parseInt(hex.slice(4, 6), 16);
        const luminance = (r * 0.299 + g * 0.587 + b * 0.114) / 255;

        return {
          primary: bgPrimary,
          secondary: bgSecondary,
          accent: accent,
          isDark: luminance < 0.5
        };
      }
    }
  }

  // Fallback to dark theme defaults
  return {
    primary: '#1a1a2e',
    secondary: '#16213e',
    accent: '#1db954',
    isDark: true
  };
}

/**
 * Clear the color cache
 */
export function clearColorCache(): void {
  colorCache.clear();
}
