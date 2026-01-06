# UI Utilities

Utility functions for color extraction, lyrics parsing, debugging, and theming.

## Directory Structure

```
utils/
├── color-extraction.ts   # Extract palette from artwork (5-color)
├── color-extractor.ts    # Extract colors from artwork (3-color, simpler)
├── debug.ts              # Development-only logging
├── lyrics-parser.ts      # Multi-format lyrics parser (LRC, ELRC, SRT)
├── syllable-timing.ts    # Word timing calculation for karaoke
└── theme-utils.ts        # Theme import, validation, CSS utilities
```

---

## color-extraction.ts

**Purpose:** Extracts a 5-color palette from artwork images for dynamic theming using median-cut quantization.

**Exports:**
```typescript
interface ExtractedColors {
  dominant: string;      // Primary dominant color
  vibrant: string;       // Most saturated color
  muted: string;         // Desaturated color
  darkVibrant: string;   // Darker vibrant variant
  lightVibrant: string;  // Lighter vibrant variant
}

getDefaultColors(): ExtractedColors
extractColorsFromImage(imageUrl: string): Promise<ExtractedColors>
getColorsForArtwork(url: string): Promise<ExtractedColors>  // Cached version
clearColorCache(): void
generateGradient(colors: ExtractedColors, direction?: string): string
getContrastingTextColor(bgHex: string): string
getTextColorsForBackground(bgHex: string): { primary, secondary, muted, isDark }
```

**Used By:**
| Component | Usage |
|-----------|-------|
| `AlbumDetailView.tsx` | Album page gradient background |
| `ArtistDetailView.tsx` | Artist page dynamic colors |
| `CollectionView.tsx` | Collection header styling |
| `HeroSection.tsx` | Discover hero gradient |
| `PlaylistDetailView.tsx` | Playlist page theming |
| `StickyHeader.tsx` | Type import for `ExtractedColors` |

**How It Works:**
1. Loads image at 50x50 for performance
2. Quantizes colors (groups similar pixels)
3. Selects dominant, vibrant, muted based on luminance/saturation
4. Generates dark/light variants from vibrant
5. Caches results (max 100 entries)

---

## color-extractor.ts

**Purpose:** Simpler 3-color extraction for full player backgrounds.

**Exports:**
```typescript
interface ExtractedColors {
  primary: string;    // Most common color
  secondary: string;  // Second most common
  accent: string;     // Most vibrant/saturated
  isDark: boolean;    // Is image predominantly dark
}

extractColorsFromImage(imageUrl: string): Promise<ExtractedColors>
darkenColor(hex: string, percent: number): string
lightenColor(hex: string, percent: number): string
clearColorCache(): void
```

**Used By:**
| Component | Usage |
|-----------|-------|
| `FullPlayer.tsx` | Player background gradient |

**Difference from color-extraction.ts:**
- Returns 3 colors vs 5
- Different interface (`primary/secondary/accent` vs `dominant/vibrant/muted`)
- Falls back to CSS variables if extraction fails
- Used specifically for player, other file for detail views

---

## debug.ts

**Purpose:** Development-only logging to keep production console clean.

**Exports:**
```typescript
debugLog(prefix: string, message: string, data?: unknown): void   // Only in dev
debugWarn(prefix: string, message: string, data?: unknown): void  // Only in dev
debugError(prefix: string, message: string, error?: unknown): void // Always logs
```

**Used By:**
| Component | Usage |
|-----------|-------|
| `BaseSection.tsx` | Discover section debug logging |

**Example:**
```typescript
debugLog('[MoodPlaylist]', 'Loading tracks', { count: 10 });
// Output in dev: [MoodPlaylist] Loading tracks { count: 10 }
// Output in prod: (nothing)
```

---

## lyrics-parser.ts

**Purpose:** Multi-format lyrics parser with automatic format detection.

**Supported Formats:**
| Format | Description | Example |
|--------|-------------|---------|
| LRC | Standard line-timed | `[01:23.45]Lyrics text` |
| ELRC | Enhanced with word timing | `[01:23.45]<01:23.50>Word<01:23.80>Word` |
| SRT | Subtitle format | `00:01:23,450 --> 00:01:25,000` |
| Plain | No timestamps | Just text |

**Exports:**
```typescript
type LyricsFormat = 'lrc' | 'elrc' | 'srt' | 'plain' | 'unknown';

interface ParsedLyrics {
  format: LyricsFormat;
  lines: LyricLine[];
  linesWithWords: LineWithWords[];
  hasNativeWordTiming: boolean;
}

detectFormat(content: string): LyricsFormat
parseLyrics(content: string, trackDuration?: number): ParsedLyrics
convertToLRC(lyrics: LyricLine[]): string
convertToELRC(linesWithWords: LineWithWords[]): string
```

**Used By:**
| Store | Usage |
|-------|-------|
| `lyrics-store.ts` | Parse fetched lyrics for display |

**Flow:**
1. `detectFormat()` checks first 20 lines for format markers
2. Routes to appropriate parser (parseELRC, parseLRC, parseSRT, parsePlainText)
3. For non-ELRC formats, uses `syllable-timing.ts` to interpolate word timings
4. Returns both line-level and word-level timing data

---

## syllable-timing.ts

**Purpose:** Calculates word-level timing for karaoke/sing-along mode when lyrics only have line timestamps.

**Algorithm:**
1. Count syllables per word (with English exception dictionary)
2. Weight by vowel content (vowels take longer to sing)
3. Detect "held" words (last in line, before punctuation, open vowels)
4. Account for punctuation pauses
5. Apply minimum duration constraints
6. Distribute time proportionally across words

**Exports:**
```typescript
interface WordTimingConfig {
  minMsPerSyllable: number;      // Default: 150ms
  baseWordGap: number;           // Default: 40ms
  heldWordMultiplier: number;    // Default: 1.4x
  useVowelWeighting: boolean;    // Default: true
  anticipationOffset: number;    // Default: 50ms (highlight early)
}

interface TimedWord {
  word: string;
  syllables: number;
  weight: number;
  duration: number;
  startTime: number;
  endTime: number;
  isHeld: boolean;
  pauseAfter: number;
}

countSyllables(word: string): number
getWordWeight(word: string): number
isLikelyHeldWord(word: string, isLastInLine: boolean, isBeforePause: boolean): boolean
getPauseDuration(wordWithPunctuation: string, baseGap: number): number
getMinimumDuration(syllables: number): number
calculateWordTimings(lineText: string, lineStartTime: number, lineDuration: number, config?): TimedWord[]

DEFAULT_TIMING_CONFIG: WordTimingConfig
```

**Used By:**
| File | Usage |
|------|-------|
| `lyrics-parser.ts` | Interpolate word timings for LRC/SRT |

**Syllable Exception Dictionary:**
Includes 100+ common English words, contractions ("don't", "I'm"), and informal song words ("gonna", "wanna", "yeah") for accurate syllable counting.

---

## theme-utils.ts

**Purpose:** Theme import, validation, sanitization, and CSS utilities.

**Features:**
- Parse GitHub URLs (full URL, shorthand `user/repo`)
- Validate theme JSON structure
- Sanitize custom CSS (block XSS patterns, scope selectors)
- Fetch themes from GitHub repos or direct URLs
- CSS variable utilities

**Exports:**
```typescript
// GitHub URL parsing
parseGitHubUrl(url: string): GitHubRepo | null
getGitHubRawUrl(repo: GitHubRepo, filename?: string): string

// Theme validation
validateTheme(theme: unknown): { valid: boolean; errors: string[] }
isValidColor(value: string): boolean

// CSS sanitization
sanitizeCSS(css: string): string  // Blocks XSS, scopes to .audiio-app

// Theme fetching
fetchThemeFromGitHub(url: string): Promise<ThemeConfig | null>
fetchThemeFromUrl(url: string): Promise<ThemeConfig | null>

// CSS variable utilities
getCSSVariable(variableName: string, fallback?: string): string
getAccentColor(): string
getCSSVariables(variableNames: string[]): Record<string, string>

// Color utilities
hexToRgb(hex: string): { r, g, b } | null
rgbToHex(r: number, g: number, b: number): string
adjustBrightness(hex: string, percent: number): string
getContrastColor(bgHex: string): string
generatePalette(baseColor: string): { lightest, lighter, light, base, dark, darker, darkest }
```

**Used By:**
| Component | Usage |
|-----------|-------|
| `SettingsView.tsx` | Import themes from GitHub URLs |

**Security:**
Blocks dangerous CSS patterns:
- `expression()`, `javascript:`, `vbscript:`
- `@import`, `data:` URLs
- `-moz-binding`, IE `behavior:`

All custom CSS is scoped to `.audiio-app` to prevent affecting other elements.

---

## Usage Summary

| Utility | Purpose | Primary Consumer |
|---------|---------|------------------|
| `color-extraction.ts` | 5-color palette extraction | Detail views (Album, Artist, Playlist) |
| `color-extractor.ts` | 3-color extraction | Full Player |
| `debug.ts` | Dev-only logging | Discover sections |
| `lyrics-parser.ts` | Parse LRC/ELRC/SRT | Lyrics store |
| `syllable-timing.ts` | Word timing interpolation | lyrics-parser.ts |
| `theme-utils.ts` | Theme import/validation | Settings |
