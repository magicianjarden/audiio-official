# Hooks

React hooks for the Audiio UI. All hooks are actively used throughout the application.

## Usage Status

| Hook | Status | Used In |
|------|--------|---------|
| useAlbumEnrichment | Active | AlbumDetailView |
| useArtistEnrichment | Active | ArtistDetailView |
| useArtwork | Active | Player, TrackRow, Queue components |
| useDownloadProgress | Active | App.tsx |
| useEmbeddingPlaylist | Active | EmbeddingManager, core-providers, Discover |
| useKeyboardShortcuts | Active | App.tsx (GlobalShortcutManager) |
| useLibraryBridge | Active | App.tsx |
| useMLRanking | Active | QueuePopover |
| usePluginAudioFeatures | Active | App.tsx |
| usePluginData | Active | BaseSection, HeroSection |
| useRecommendationExplanation | Active | RecommendationExplanation components |
| useRecommendations | Active | ArtistSectionDetailView, TrendingTracksSection |
| useScrobbling | Active | App.tsx |
| useSkipTracking | Active | App.tsx (SkipTrackingManager) |
| useSmartQueue | Active | App.tsx |
| useTranslatedLyrics | Active | TranslationToggle, LyricsPanel, LyricsDisplay |

---

## Hook Descriptions

### useAlbumEnrichment

Fetches album-specific enrichment data from plugins, currently supporting music videos that match the album.

```typescript
const { data, loading, errors } = useAlbumEnrichment(albumTitle, artistName, {
  enabled: true,
  trackNames: ['Track 1', 'Track 2'],
  limit: 8
});
```

**Returns:** `{ data: { videos: MusicVideo[] }, loading, errors }`

---

### useArtistEnrichment

Fetches supplementary artist data from enrichment plugins including videos, concerts, setlists, timeline, gallery images, and merchandise links.

```typescript
const { data, loading, errors, availableTypes, refetch } = useArtistEnrichment(artistName, {
  enabled: true,
  mbid: 'musicbrainz-id'
});
```

**Returns:** Videos, timeline, setlists, concerts, gallery, merchandise URL with loading/error states for each.

---

### useArtwork

Resolves track artwork URLs, handling both regular HTTP URLs and embedded artwork from local files (`embedded-art://` protocol).

```typescript
const { artworkUrl, isLoading } = useArtwork(track);
```

**Exports:**
- `useArtwork(track)` - Hook for single track
- `batchResolveArtwork(tracks)` - Resolve multiple tracks in parallel
- `clearArtworkCache()` - Clear the cache

---

### useDownloadProgress

Listens for download progress events from the main process and updates the library store accordingly.

```typescript
useDownloadProgress(); // No return, manages side effects
```

Handles `downloading`, `completed`, and `failed` status events.

---

### useEmbeddingPlaylist

Provides playlist generation using the server's ML API. All computation is server-side.

```typescript
const {
  isReady,
  indexTracks,
  recordPlay,
  recordLike,
  generateMoodPlaylist,
  generateGenrePlaylist,
  generateSeedPlaylist,
  generatePersonalizedPlaylist,
  generateArtistRadio,
  generateDiscoveryPlaylist,
  findSimilarTracks,
  getTracksFromPlaylist,
  getTasteStats
} = useEmbeddingPlaylist();
```

**Convenience hooks:**
- `useMoodPlaylist(mood, tracks, options)`
- `useGenrePlaylist(genre, tracks, options)`
- `useSimilarTracks(seedTrackId, tracks, limit)`

**Standalone functions:**
- `setServerUrl(url)` / `getServerUrl()`
- `indexTracksStandalone(tracks)`
- `generateEmbeddingPlaylist(method, options)`
- `getAllIndexedTracks()`

---

### useKeyboardShortcuts

Handles all app-wide keyboard shortcuts in a centralized location. Supports customizable shortcuts via the shortcut store.

```typescript
useGlobalKeyboardShortcuts(); // Call in App component
```

**Component export:**
```typescript
<GlobalShortcutManager /> // Add to App for global shortcuts
```

**Supported shortcuts:** Play/pause, seek, next/previous, volume, mute, shuffle, repeat, full player, queue, lyrics, search focus.

---

### useLibraryBridge

Connects UI library stores to the main process for mobile sync. Handles data requests, library actions, and change notifications.

```typescript
useLibraryBridge(); // No return, manages IPC communication
```

**Handles actions:** like, unlike, dislike, remove-dislike, create/delete/rename playlist, add/remove from playlist.

---

### useMLRanking

Applies server-backed ML ranking to tracks for personalized ordering.

```typescript
const {
  rankTracks,      // Async - calls server
  rankTracksSync,  // Sync - uses heuristics
  getTrackScore,
  isMLReady,
  isTraining
} = useMLRanking();
```

**Convenience hook:**
```typescript
const { rankedTracks, isLoading } = usePersonalizedTracks(tracks, limit);
```

---

### usePluginAudioFeatures

Connects plugins to the ML audio feature system. Automatically registers/unregisters audio feature providers based on plugin state.

```typescript
usePluginAudioFeatures(); // No return, manages plugin providers
```

**Exports:**
- `getCachedAudioFeatures(trackId)` - Get cached features
- `triggerAudioAnalysis(trackId, streamUrl?, track?)` - Trigger analysis
- `clearAudioFeaturesCache()` - Clear cache
- `getAudioFeaturesCacheStats()` - Get cache stats

---

### usePluginData

Unified hook for fetching data through the plugin pipeline (providers -> ML ranking -> transformers).

```typescript
const { tracks, isLoading, error, refetch, metadata } = usePluginData(query, {
  enabled: true,
  applyMLRanking: true,
  applyTransformers: true,
  limit: 50,
  fallbackFetcher: async () => []
});
```

**Simplified hook:**
```typescript
const result = useSectionData(sectionType, { enabled, limit, query, title });
```

---

### useRecommendationExplanation

Fetches and displays explanations for why a track was recommended, showing scoring factors.

```typescript
const {
  explanation,
  isLoading,
  error,
  fetchExplanation,
  clearExplanation
} = useRecommendationExplanation();
```

**Explanation factors:** Taste match, AI prediction, sound profile, mood match, harmonic flow, time of day, session flow, activity match, discovery, serendipity, variety, freshness, artist variety.

---

### useRecommendations

Provides ML-powered recommendations from the server's recommendation APIs.

```typescript
// Trending tracks and artists
const { data, isLoading, error, refetch } = useTrending();

// ML recommendations based on history
const result = useMLRecommendations(count, mode);

// Similar tracks
const result = useSimilarTracks(trackId, count);

// Artist radio
const result = useArtistRadio(artistId, count);

// Genre radio
const result = useGenreRadio(genre, count);

// Track radio
const result = useTrackRadio(trackId, count);

// Smart queue suggestions
const result = useSmartQueue(count, context);

// User ML profile
const { profile, isLoading } = useMLProfile();
```

---

### useScrobbling

Automatically handles scrobbling via enabled scrobbler plugins. Watches player state and triggers scrobbles based on plugin settings.

```typescript
useScrobbling(); // Call in App or Player component
```

**Features:**
- Sends "now playing" updates
- Scrobbles after threshold % played or 4 minutes
- Respects per-plugin settings
- Works with any scrobbler plugin (ListenBrainz, Last.fm, etc.)

---

### useSkipTracking

Detects and records skip events when users change tracks before completion. Used for ML training.

```typescript
useSkipTracking({ enabled: true, onSkip: (trackId, percentage, earlySkip) => {} });
```

**Component export:**
```typescript
<SkipTrackingManager /> // Add to App for global skip tracking
```

**Thresholds:**
- Completion: 80%
- Early skip: < 25%
- Minimum position: 1 second

---

### useSmartQueue

React hooks for auto-queue and radio mode functionality.

```typescript
// Auto-queue management
const { isActive, mode, config } = useAutoQueue({ availableTracks, enabled });

// Radio mode
const {
  isRadioMode,
  radioSeed,
  startTrackRadio,
  startArtistRadio,
  startGenreRadio,
  startRadioFromCurrent,
  stopRadio
} = useRadioMode({ availableTracks });

// ML recommendations
const {
  recommendations,
  isModelLoaded,
  isTraining,
  canTrain,
  triggerTraining
} = useMLRecommendations({ tracks, limit, enabled });

// Combined hook
const { autoQueue, radio, ml } = useSmartPlayback({
  availableTracks,
  autoQueueEnabled: true,
  mlEnabled: true
});
```

---

### useTranslatedLyrics

Combines lyrics and translation state, providing lyrics with translations attached.

```typescript
const {
  lyrics,              // LyricLine[] with optional translation
  plainLyrics,
  currentLineIndex,
  nextLineIndex,
  translationEnabled,
  isTranslating,
  translationProgress,
  sourceLanguage,
  translationError,
  toggleTranslation,
  setTranslationEnabled,
  seekToLine,
  offset,
  adjustOffset,
  resetOffset
} = useTranslatedLyrics();
```

Auto-translates when enabled and lyrics are available. Supports language detection.
