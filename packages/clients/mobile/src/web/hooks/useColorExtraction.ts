/**
 * useColorExtraction - Extract dominant colors from artwork
 *
 * Features:
 * - Extracts primary and secondary colors from images
 * - Caches colors per image URL
 * - Returns fallback colors while loading
 * - Smooth color transitions
 */

import { useState, useEffect, useRef } from 'react';

interface ExtractedColors {
  primary: string;
  secondary: string;
  isLoading: boolean;
}

// Simple cache to avoid re-extracting colors
const colorCache = new Map<string, { primary: string; secondary: string }>();

// Default fallback colors
const DEFAULT_COLORS = {
  primary: '#1a1a2e',
  secondary: '#16213e',
};

/**
 * Extract dominant colors from an image using canvas
 */
async function extractColors(imageUrl: string): Promise<{ primary: string; secondary: string }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          resolve(DEFAULT_COLORS);
          return;
        }

        // Sample at a smaller size for performance
        const sampleSize = 50;
        canvas.width = sampleSize;
        canvas.height = sampleSize;

        ctx.drawImage(img, 0, 0, sampleSize, sampleSize);

        const imageData = ctx.getImageData(0, 0, sampleSize, sampleSize);
        const data = imageData.data;

        // Simple color extraction - sample from different regions
        const colors: [number, number, number][] = [];

        // Sample from top-left quadrant (for header gradient)
        for (let i = 0; i < sampleSize / 2; i++) {
          for (let j = 0; j < sampleSize / 2; j++) {
            const idx = (i * sampleSize + j) * 4;
            if (data[idx + 3] > 128) { // Only consider non-transparent pixels
              colors.push([data[idx], data[idx + 1], data[idx + 2]]);
            }
          }
        }

        if (colors.length === 0) {
          resolve(DEFAULT_COLORS);
          return;
        }

        // Calculate average color
        const avgColor = colors.reduce(
          (acc, [r, g, b]) => [acc[0] + r, acc[1] + g, acc[2] + b],
          [0, 0, 0]
        ).map(v => Math.round(v / colors.length));

        // Create a slightly darker secondary color
        const darkenFactor = 0.7;
        const secondary = avgColor.map(v => Math.round(v * darkenFactor));

        // Ensure colors are dark enough for a good player background
        const maxBrightness = 80;
        const primaryAdjusted = adjustBrightness(avgColor, maxBrightness);
        const secondaryAdjusted = adjustBrightness(secondary, maxBrightness * 0.7);

        resolve({
          primary: rgbToHex(primaryAdjusted),
          secondary: rgbToHex(secondaryAdjusted),
        });
      } catch {
        resolve(DEFAULT_COLORS);
      }
    };

    img.onerror = () => {
      resolve(DEFAULT_COLORS);
    };

    img.src = imageUrl;
  });
}

/**
 * Adjust brightness to not exceed a maximum value
 */
function adjustBrightness(rgb: number[], maxBrightness: number): number[] {
  const brightness = (rgb[0] + rgb[1] + rgb[2]) / 3;

  if (brightness > maxBrightness) {
    const factor = maxBrightness / brightness;
    return rgb.map(v => Math.round(v * factor));
  }

  return rgb;
}

/**
 * Convert RGB array to hex string
 */
function rgbToHex(rgb: number[]): string {
  return '#' + rgb.map(v => v.toString(16).padStart(2, '0')).join('');
}

/**
 * Hook to extract colors from artwork URL
 */
export function useColorExtraction(imageUrl: string | null): ExtractedColors {
  const [colors, setColors] = useState<ExtractedColors>({
    ...DEFAULT_COLORS,
    isLoading: !!imageUrl,
  });

  const lastUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (!imageUrl) {
      setColors({ ...DEFAULT_COLORS, isLoading: false });
      return;
    }

    // Skip if same URL
    if (imageUrl === lastUrlRef.current) {
      return;
    }

    lastUrlRef.current = imageUrl;

    // Check cache first
    const cached = colorCache.get(imageUrl);
    if (cached) {
      setColors({ ...cached, isLoading: false });
      return;
    }

    // Extract colors
    setColors(prev => ({ ...prev, isLoading: true }));

    extractColors(imageUrl).then((extracted) => {
      // Only update if URL hasn't changed
      if (imageUrl === lastUrlRef.current) {
        colorCache.set(imageUrl, extracted);
        setColors({ ...extracted, isLoading: false });
      }
    });
  }, [imageUrl]);

  return colors;
}

/**
 * Clear the color cache (useful for memory management)
 */
export function clearColorCache(): void {
  colorCache.clear();
}
