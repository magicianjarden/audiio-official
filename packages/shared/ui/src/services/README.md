# UI Services

Client-side services for the Audiio UI layer. These provide caching, search, and translation functionality.

## Directory Structure

```
services/
├── lyrics-cache.ts          # IndexedDB cache for lyrics with word timings
├── stream-prefetch.ts       # Pre-resolves stream URLs for queue tracks
├── search/                  # Smart search with fuzzy matching
│   ├── index.ts
│   ├── query-parser.ts      # Natural language query parsing
│   └── smart-search.ts      # Fuse.js-based fuzzy search
└── translation/             # Lyrics translation system
    ├── index.ts
    ├── language-detector.ts # Unicode-based language detection
    ├── libre-translate-client.ts
    ├── translation-cache.ts # IndexedDB cache for translations
    └── translation-service.ts
```

---

## lyrics-cache.ts

**Purpose:** Persistent IndexedDB cache for lyrics with pre-computed word timings.

**Features:**
- Two-tier caching: in-memory hot cache (50 entries) + IndexedDB persistence
- LRU eviction with 30-day expiry
- Lookup by track ID or artist/title fallback
- Stores raw LRC, parsed lyrics, and word timing data

**Exported:**
- `lyricsCache` - Singleton instance
- `WordTiming`, `LyricLine`, `LineWithWords`, `LyricsCacheEntry` - Types

**Used By:**
- `stores/lyrics-store.ts` - Caches fetched lyrics to avoid re-fetching

**Key Methods:**
```typescript
await lyricsCache.get(trackId)           // Get cached lyrics
await lyricsCache.set(entry)             // Store lyrics with word timings
await lyricsCache.getByArtistTitle(artist, title)  // Fallback lookup
await lyricsCache.clearExpired()         // Cleanup old entries
```

---

## stream-prefetch.ts

**Purpose:** Pre-resolves stream URLs for upcoming queue tracks to eliminate playback latency.

**Features:**
- Caches resolved `StreamInfo` with expiration tracking
- LRU eviction (max 20 entries)
- Debounces repeated prefetch attempts (5s)
- Skips local tracks (no resolution needed)
- Auto-cleanup every 5 minutes

**Exported:**
- `streamPrefetch` - Singleton instance

**Used By:**
- `stores/player-store.ts` - Prefetches next tracks in queue

**Key Methods:**
```typescript
streamPrefetch.getCached(trackId)        // Get cached stream URL
streamPrefetch.prefetch(tracks)          // Pre-resolve multiple tracks
streamPrefetch.addToCache(trackId, streamInfo)  // Manual cache add
streamPrefetch.isExpired(trackId)        // Check if cached URL expired
```

---

## search/

### query-parser.ts

**Purpose:** Parses natural language search queries into structured filters.

**Supported Patterns:**
| Pattern | Filter Type | Example |
|---------|-------------|---------|
| `by [artist]` | artist | "by Taylor Swift" |
| `from [album]` | album | "from 1989" |
| `genre:[genre]` | genre | "genre:pop" |
| `2020` or `year:2020` | year | "2020" |
| `liked` or `favorites` | liked | "liked" |
| `playlist:[name]` | playlist | "playlist:chill" |

**Exported:**
- `parseQuery(query)` - Parse query into `ParsedQuery`
- `buildQueryFromFilters(filters)` - Reconstruct query string
- `hasNaturalLanguageFilters(query)` - Quick check for filter patterns
- `ParsedQuery`, `QueryFilter` - Types

### smart-search.ts

**Purpose:** Fuzzy search using Fuse.js with weighted field scoring.

**Features:**
- Weighted search fields: title (35%), artist (30%), album (20%), genre (10%), year (5%)
- Fuzzy matching for typos (threshold: 0.4)
- Natural language query parsing integration
- Autocomplete suggestions
- Filter support (artist, album, genre, year)

**Exported:**
- `SmartSearch` - Class for instance-based search
- `getSmartSearch()` - Get singleton instance
- `initSmartSearch(tracks)` - Initialize with track library
- `smartSearch(query, tracks, options)` - One-off search function
- `SmartSearchResult`, `SmartSearchOptions`, `MatchInfo` - Types

**Used By:**
- `stores/search-store.ts` - Powers library search

**Key Methods:**
```typescript
const searcher = new SmartSearch(tracks);
const results = searcher.search("thriller by michael", { limit: 20 });
const suggestions = searcher.getSuggestions("thril", 5);
```

---

## translation/

### language-detector.ts

**Purpose:** Lightweight Unicode-based language detection without external dependencies.

**Supported Languages:**
- Japanese (ja) - Hiragana, Katakana, CJK
- Korean (ko) - Hangul
- Chinese (zh) - CJK without Japanese markers
- Russian (ru) - Cyrillic
- Spanish (es), French (fr), German (de), Portuguese (pt), Italian (it) - Common words/characters

**Exported:**
- `detectLanguage(text)` - Single string detection
- `detectLanguageFromLines(lines)` - Multi-line detection (more accurate)
- `detectLanguagePerLine(lines)` - Per-line detection for mixed-language songs
- `getDominantLanguage(lines)` - Most common non-English language
- `isEnglishLine(text)` - Check if line is English
- `needsTranslation(text)` - Quick check for non-English content
- `getLanguageName(lang)` - Human-readable name
- `isSupportedLanguage(lang)` - Type guard
- `SupportedLanguage`, `LineLanguageResult` - Types

**Used By:**
- `translation-service.ts` - Determines what needs translation
- `components/Player/TranslationToggle.tsx` - Shows language name

### translation-cache.ts

**Purpose:** IndexedDB cache for translated lyrics with 30-day expiry.

**Schema:**
```typescript
interface TranslationCacheEntry {
  id: string;              // `${trackId}-${lineIndex}`
  trackId: string;
  lineIndex: number;
  originalText: string;
  translatedText: string;
  sourceLanguage: SupportedLanguage;
  targetLanguage: string;  // Usually 'en'
  createdAt: number;
  provider: 'libre-translate' | 'manual';
}
```

**Exported:**
- `translationCache` - Singleton instance
- `SupportedLanguage`, `TranslationCacheEntry` - Types

### libre-translate-client.ts

**Purpose:** API client for LibreTranslate service via Electron IPC.

**Features:**
- Uses IPC to avoid CORS (translation happens in main process)
- Parallel batch translation with concurrency control (5 concurrent)
- Progress callbacks for UI updates

**Exported:**
- `libreTranslateClient` - Singleton instance
- `BATCH_SIZE` - Lines per batch (10)

**Key Methods:**
```typescript
await libreTranslateClient.translate(text, 'ja', 'en')
await libreTranslateClient.translateBatch(texts, 'ko', 'en', onProgress)
libreTranslateClient.isAvailable()  // Check if in Electron
```

### translation-service.ts

**Purpose:** Orchestrates the full translation workflow.

**Flow:**
1. Detect language per-line (handles mixed-language songs)
2. Check cache for existing translations
3. Batch translate uncached lines by language
4. Cache results for future use

**Exported:**
- `translationService` - Singleton instance
- `LyricLine`, `TranslationResult`, `TranslationProgress` - Types

**Used By:**
- `stores/translation-store.ts` - Manages translation state
- `hooks/useTranslatedLyrics.ts` - Hook for components

**Key Methods:**
```typescript
await translationService.translateLyrics(trackId, lines, onProgress)
translationService.shouldTranslate(lines)    // Quick check
translationService.detectLanguage(lines)     // Get dominant language
await translationService.getCachedTranslations(trackId)
await translationService.clearTrackTranslations(trackId)
```

---

## Usage Summary

| Service | Store/Hook | Component |
|---------|------------|-----------|
| `lyricsCache` | `lyrics-store.ts` | Lyrics display |
| `streamPrefetch` | `player-store.ts` | Playback |
| `search/*` | `search-store.ts` | Search UI |
| `translation/*` | `translation-store.ts`, `useTranslatedLyrics.ts` | `TranslationToggle.tsx`, Lyrics |
