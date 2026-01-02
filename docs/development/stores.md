# Zustand Store Patterns

Audiio uses Zustand for state management with 21 specialized stores. This guide covers all stores, patterns, and best practices.

## Overview

Zustand is a minimal state management library. Audiio uses it for:

- **Global state** - Player, library, UI state
- **Persistence** - Saving to localStorage/IndexedDB
- **Cross-component communication** - Shared state between components
- **ML Integration** - TensorFlow.js model management

## Store Overview

Audiio has **21 Zustand stores** organized by domain:

| Category | Stores | Purpose |
|----------|--------|---------|
| Playback & Audio | `player-store`, `smart-queue-store`, `karaoke-store` | Audio playback and queue |
| Library | `library-store` | Likes, playlists, downloads |
| Recommendations | `recommendation-store`, `ml-store` | ML-powered recommendations |
| Content | `search-store`, `trending-store`, `lyrics-store`, `lyrics-search-store` | Search and content |
| Theme & UI | `theme-store`, `ui-store`, `shortcut-store`, `toast-store` | UI state and themes |
| Navigation | `navigation-store`, `artist-store`, `album-store` | Routing and detail views |
| Utilities | `plugin-store`, `settings-store`, `translation-store`, `stats-store` | Settings and utilities |

## Playback & Audio Stores

### player-store

Core audio and video playback state:

```typescript
interface PlayerState {
  // Current playback
  currentTrack: UnifiedTrack | null;
  isPlaying: boolean;
  position: number;
  duration: number;
  volume: number;
  isMuted: boolean;

  // Queue
  queue: UnifiedTrack[];
  queueIndex: number;

  // Modes
  shuffle: boolean;
  repeat: 'off' | 'all' | 'one';

  // Video support
  videoMode: 'off' | 'float' | 'theater';
  videoQuality: string;
  videoStreamInfo: VideoStreamInfo | null;

  // Actions
  play: (track?: UnifiedTrack) => void;
  pause: () => void;
  resume: () => void;
  next: () => void;
  previous: () => void;
  seek: (position: number) => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  toggleShuffle: () => void;
  cycleRepeat: () => void;

  // Queue management
  setQueue: (tracks: UnifiedTrack[], startIndex?: number) => void;
  addToQueue: (tracks: UnifiedTrack[]) => void;
  playNext: (tracks: UnifiedTrack[]) => void;
  removeFromQueue: (index: number) => void;
  reorderQueue: (fromIndex: number, toIndex: number) => void;

  // Video
  playVideo: (track: UnifiedTrack) => Promise<void>;
  closeVideo: () => void;
  setVideoMode: (mode: 'off' | 'float' | 'theater') => void;
}
```

**Key Features:**
- Video mode support (floating, theater)
- Stream prefetching for queue
- Local track detection and handling

### smart-queue-store

Advanced auto-queue with radio mode and ML scoring:

```typescript
interface SmartQueueState {
  // Mode
  mode: 'manual' | 'auto-queue' | 'radio';
  radioSeed: RadioSeed | null;
  sessionHistory: string[]; // Track IDs (max 200)

  // Configuration
  config: {
    minQueueLength: number;
    batchSize: number;
    maxArtistTracks: number;
    enableAudioFeatureMatching: boolean;
  };

  // Radio configuration
  radioConfig: {
    seedArtists: string[];
    seedGenres: string[];
    seedTrack: UnifiedTrack | null;
    explorationLevel: 'conservative' | 'balanced' | 'adventurous' | 'discovery';
  };

  // Actions
  setMode: (mode: 'manual' | 'auto-queue' | 'radio') => void;
  enableAutoQueue: () => void;
  disableAutoQueue: () => void;
  toggleAutoQueue: () => void;
  startRadio: (seed: RadioSeed) => Promise<void>;
  stopRadio: () => void;
  checkAndReplenish: () => Promise<void>;
  fetchMoreTracks: (count: number) => Promise<UnifiedTrack[]>;
  recordTrackPlayed: (trackId: string) => void;
  setQueueSource: (trackId: string, source: QueueSource) => void;
}
```

**7 Recommendation Sources:**
1. Local library (liked tracks)
2. Plugin discovery
3. API similar tracks
4. Smart search
5. Trending
6. Search cache
7. ML recommendations

**Queue Source Types (14):**
- `user-added`, `auto-queue`, `radio`, `artist`, `genre`, `discovery`
- `ml-recommended`, `similar-track`, `trending`, `search`, `playlist`
- `related-artist`, `mood-based`, `audio-similar`

### karaoke-store

Vocal removal with AI processing:

```typescript
interface KaraokeState {
  available: boolean;
  enabled: boolean;
  isProcessing: boolean;
  processingTrackId: string | null;
  vocalReduction: number; // 0-1
  qualityMode: 'auto' | 'quality' | 'balanced' | 'fast';

  // Actions
  toggle: () => void;
  enable: () => void;
  disable: () => void;
  setVocalReduction: (value: number) => void;
  setQualityMode: (mode: 'auto' | 'quality' | 'balanced' | 'fast') => void;
}
```

**Quality Modes:**
- `auto` - Based on hardware capabilities
- `quality` - Best quality, slower
- `balanced` - Good quality, reasonable speed
- `fast` - Fastest processing

## Library Store

### library-store

User's music collection with nested folders:

```typescript
interface LibraryState {
  // Collections
  likedTracks: LikedTrack[];
  dislikedTracks: DislikedTrack[];
  playlists: Playlist[];
  folders: PlaylistFolder[];
  downloads: DownloadItem[];

  // Local music
  localMusicFolders: LocalMusicFolder[];

  // Loading states
  isLoading: boolean;
  isInitialized: boolean;

  // Like/Dislike actions
  likeTrack: (track: UnifiedTrack) => Promise<void>;
  unlikeTrack: (trackId: string) => Promise<void>;
  toggleLike: (track: UnifiedTrack) => void;
  dislikeTrack: (trackId: string, reason?: string) => Promise<void>;
  toggleDislike: (trackId: string) => void;

  // Playlist actions
  createPlaylist: (name: string, description?: string) => Promise<Playlist>;
  deletePlaylist: (playlistId: string) => Promise<void>;
  renamePlaylist: (playlistId: string, name: string) => Promise<void>;
  addToPlaylist: (playlistId: string, tracks: UnifiedTrack[]) => Promise<void>;
  removeFromPlaylist: (playlistId: string, trackId: string) => Promise<void>;
  reorderPlaylist: (playlistId: string, fromIndex: number, toIndex: number) => void;
  movePlaylistToFolder: (playlistId: string, folderId: string | null) => void;

  // Folder actions
  createFolder: (name: string, parentId?: string) => Promise<PlaylistFolder>;
  deleteFolder: (folderId: string) => Promise<void>;
  renameFolder: (folderId: string, name: string) => Promise<void>;
  toggleFolderExpanded: (folderId: string) => void;
  moveFolderToFolder: (folderId: string, targetId: string | null) => void;

  // Local music
  getOrCreateLocalFolderPlaylist: (folderPath: string) => Promise<Playlist>;
  setLocalFolderPlaylistTracks: (playlistId: string, tracks: UnifiedTrack[]) => void;

  // Downloads
  startDownload: (track: UnifiedTrack) => void;
  updateDownloadProgress: (trackId: string, progress: number) => void;
  completeDownload: (trackId: string, filePath: string) => void;
  failDownload: (trackId: string, error: string) => void;
  retryDownload: (trackId: string) => void;
}
```

## Recommendation Stores

### recommendation-store

User preferences and rule-based scoring:

```typescript
interface RecommendationState {
  // Dislike system (16 reasons across 5 categories)
  dislikeReasons: {
    track: ['dont_like_song', 'heard_too_much', 'wrong_version', 'not_in_mood'];
    artist: ['dont_like_artist', 'overplayed_artist', 'problematic'];
    mood: ['too_slow', 'too_fast', 'too_sad', 'too_intense'];
    quality: ['bad_audio', 'wrong_mix'];
    content: ['explicit', 'offensive'];
  };

  // User profile
  artistPreferences: Map<string, {
    score: number; // -100 to 100
    playCount: number;
    listenTime: number;
    likeCount: number;
    dislikeCount: number;
  }>;

  genrePreferences: Map<string, {
    score: number;
    playCount: number;
    likeCount: number;
    dislikeCount: number;
  }>;

  timePatterns: {
    hourlyEnergy: number[]; // 24 values
  };

  // Actions
  recordListen: (track: UnifiedTrack, duration: number) => void;
  recordSkip: (track: UnifiedTrack, position: number) => void;
  calculateScore: (track: UnifiedTrack) => number;
}
```

**Energy Mapping:** 60+ genres with energy levels (0-100)
**Mood Categories:** calm, chill, neutral, upbeat, energetic, intense

### ml-store

TensorFlow.js ML model management:

```typescript
interface MLState {
  modelLoaded: boolean;
  isTraining: boolean;
  trainingProgress: number;
  lastTrainedAt: Date | null;
  metrics: {
    accuracy: number;
    loss: number;
  };

  // Actions
  initializeModel: () => Promise<void>;
  trainModel: () => Promise<void>;
  predictScore: (trackId: string) => Promise<number>;
  getHybridScore: (track: UnifiedTrack) => Promise<number>;
  getHybridRecommendations: (count: number) => Promise<UnifiedTrack[]>;
  checkAndTrain: () => Promise<void>; // Auto-train when enough data
}
```

**Training Requirements:** 50+ listen events
**Scoring:** Combines ML predictions with rule-based scoring

## Content Stores

### search-store

Multi-type search with smart local search:

```typescript
interface SearchState {
  query: string;
  results: {
    tracks: UnifiedTrack[];
    artists: Artist[];
    albums: Album[];
  };
  localResults: UnifiedTrack[];
  isSearching: boolean;
  activeFilter: 'all' | 'tracks' | 'artists' | 'albums' | 'local' | 'lyrics';

  // Actions
  search: (query: string) => Promise<void>;
  searchLocal: (query: string, tracks: UnifiedTrack[]) => void;
  updateLocalIndex: (tracks: UnifiedTrack[]) => void;
  getSuggestions: (query: string) => string[];
  setActiveFilter: (filter: string) => void;
  clearSearch: () => void;
}
```

**Smart Search Features:**
- Fuzzy matching for local library
- Natural language query parsing
- Deduplication of results

### lyrics-store

Synced lyrics with multiple format support:

```typescript
interface LyricsState {
  currentLyrics: LyricsLine[] | null;
  plainText: string | null;
  currentLine: number;
  currentWord: number;
  format: 'lrc' | 'elrc' | 'srt' | 'plain';
  viewMode: 'synced' | 'plain';
  offset: number;
  singAlongEnabled: boolean;

  // Actions
  fetchLyrics: (track: UnifiedTrack) => Promise<void>;
  prefetchLyrics: (track: UnifiedTrack) => void;
  updateCurrentLine: (position: number) => void;
  updateCurrentWord: (position: number) => void;
  seekToLine: (lineIndex: number) => void;
  setOffset: (offset: number) => void;
  adjustOffset: (delta: number) => void;
  setViewMode: (mode: 'synced' | 'plain') => void;
  setSingAlongEnabled: (enabled: boolean) => void;
}
```

**Format Support:**
- LRC (standard synced lyrics)
- ELRC (enhanced with syllable timing)
- SRT (subtitle format)
- Plain text

**Optimization:**
- Pre-computed word timings
- IndexedDB caching
- Background prefetching

### lyrics-search-store

Search through cached lyrics:

```typescript
interface LyricsSearchState {
  cache: Map<string, CachedLyrics>;
  invertedIndex: Map<string, Array<{ trackId: string; lineIndex: number }>>;

  // Actions
  addToCache: (trackId: string, lyrics: LyricsResult) => void;
  removeFromCache: (trackId: string) => void;
  clearCache: () => void;
  search: (query: string) => SearchResult[];
  getCacheStats: () => { trackCount: number; wordCount: number };
}
```

### trending-store

Trending data with promo banners:

```typescript
interface TrendingState {
  dailyTrending: Map<string, TrendingTrack[]>; // Last 7 days
  promoBanners: PromoBanner[];

  // Actions
  updateDailyTrending: (tracks: UnifiedTrack[]) => void;
  getTrendingForDate: (date: string) => TrendingTrack[];
  recordSearch: (query: string) => void;
  getPopularSearches: () => string[];
  addBanner: (banner: PromoBanner) => void;
  removeBanner: (bannerId: string) => void;
  getActiveBanners: () => PromoBanner[];
}
```

**Banner Types:** new-release, featured-artist, playlist, event, custom

## Theme & UI Stores

### theme-store

Complete theme management with 8 built-in themes:

```typescript
interface ThemeState {
  // Current theme
  currentThemeId: string;
  colorMode: 'dark' | 'light' | 'auto';

  // Built-in themes (8)
  builtInThemes: Theme[];

  // Community themes
  installedThemes: Theme[];

  // Theme structure
  colors: {
    background: string;
    backgroundSecondary: string;
    backgroundTertiary: string;
    text: string;
    textSecondary: string;
    textMuted: string;
    accent: string;
    accentHover: string;
    border: string;
    // ... 19 color fields total
  };
  gradients: GradientConfig;
  shadows: ShadowConfig;
  borderRadius: RadiusConfig;
  fonts: FontConfig;
  glassmorphism: GlassmorphismConfig;
  customCSS: string;

  // Actions
  setTheme: (themeId: string) => void;
  setSystemMode: (mode: 'dark' | 'light' | 'auto') => void;
  installTheme: (theme: Theme) => void;
  uninstallTheme: (themeId: string) => void;
  createCustomTheme: (base: string, overrides: Partial<Theme>) => Theme;
  exportTheme: (themeId: string) => string;
  importTheme: (themeJson: string) => void;
  getActiveTheme: () => Theme;
  getEffectiveColorMode: () => 'dark' | 'light';
}
```

**8 Built-in Themes:**
- Dark: `default-dark`, `midnight`, `sunset`, `ocean`, `monochrome-dark`
- Light: `default-light`, `paper`, `monochrome-light`

### ui-store

UI state for player, panels, and modals:

```typescript
interface UIState {
  // Player
  playerMode: 'mini' | 'full';

  // Panels
  queueOpen: boolean;
  lyricsPanelOpen: boolean;
  lyricsPanelExpanded: boolean;
  dislikeModalOpen: boolean;

  // Sidebar
  sidebarCollapsed: boolean;
  sidebarWidth: number; // 200-400px
  playlistsExpanded: boolean;

  // Modals
  createPlaylistModalOpen: boolean;
  createFolderModalOpen: boolean;

  // Actions
  expandPlayer: () => void;
  collapsePlayer: () => void;
  togglePlayer: () => void;
  openQueue: () => void;
  closeQueue: () => void;
  toggleQueue: () => void;
  toggleLyricsPanel: () => void;
  openLyricsPanel: () => void;
  closeLyricsPanel: () => void;
  toggleSidebar: () => void;
  setSidebarWidth: (width: number) => void;
  openCreatePlaylistModal: () => void;
  openCreateFolderModal: () => void;
}
```

### shortcut-store

Keyboard shortcut management:

```typescript
interface ShortcutState {
  shortcuts: Map<string, Shortcut>;
  customMappings: Map<string, string[]>;
  disabledShortcuts: Set<string>;
  showHints: boolean;

  // Actions
  setCustomMapping: (action: string, keys: string[]) => void;
  resetMapping: (action: string) => void;
  resetAllMappings: () => void;
  toggleShortcut: (action: string) => void;
  setShowHints: (show: boolean) => void;
  getEffectiveKeys: (action: string) => string[];
  isShortcutEnabled: (action: string) => boolean;
}
```

**Default Shortcuts (16):**
- Playback: Space (play/pause), N (next), P (previous)
- Volume: Up/Down arrows, M (mute)
- Navigation: Cmd+F (search), Cmd+L (lyrics)
- Queue: Q (toggle queue)

### toast-store

Toast notifications:

```typescript
interface ToastState {
  toasts: Toast[];

  // Actions
  addToast: (toast: Omit<Toast, 'id'>) => string;
  removeToast: (id: string) => void;
  clearToasts: () => void;
}

// Helpers
showToast(message: string, type?: ToastType): void;
showSuccessToast(message: string): void;
showErrorToast(message: string): void;
showActionToast(message: string, action: { label: string; onClick: () => void }): void;
```

**Toast Types:** info, success, warning, error

## Navigation Stores

### navigation-store

View routing and detail context:

```typescript
interface NavigationState {
  currentView: View;
  previousView: View | null;
  detailContext: {
    artistId?: string;
    albumId?: string;
    playlistId?: string;
    pluginId?: string;
    sectionQuery?: StructuredSectionQuery;
  };
  searchQuery: string;
  searchActive: boolean;

  // Actions
  navigate: (view: View) => void;
  openPlaylist: (playlistId: string) => void;
  openPlugin: (pluginId: string) => void;
  openArtist: (artistId: string, source?: string) => void;
  openAlbum: (albumId: string, source?: string) => void;
  openSectionDetail: (query: StructuredSectionQuery) => void;
  goBack: () => void;
  setSearchQuery: (query: string) => void;
  setSearchActive: (active: boolean) => void;
  clearSearch: () => void;
}
```

**Views:** home, likes, dislikes, playlists, downloads, playlist-detail, plugins, plugin-detail, settings, stats, artist-detail, album-detail, section-detail

### artist-store

Artist detail caching:

```typescript
interface ArtistState {
  cache: Map<string, ArtistDetail>;

  // Actions
  fetchArtist: (id: string, source?: string) => Promise<ArtistDetail>;
  getArtist: (id: string) => ArtistDetail | null;
  clearCache: () => void;
}
```

### album-store

Album detail caching:

```typescript
interface AlbumState {
  cache: Map<string, AlbumDetail>;

  // Actions
  fetchAlbum: (id: string, source?: string) => Promise<AlbumDetail>;
  getAlbum: (id: string) => AlbumDetail | null;
  clearCache: () => void;
}
```

## Utility Stores

### plugin-store

Dynamic plugin management (no hardcoded plugins):

```typescript
interface PluginState {
  plugins: Plugin[];
  order: string[];

  // Actions
  syncFromBackend: () => Promise<void>;
  togglePlugin: (pluginId: string) => void;
  enablePlugin: (pluginId: string) => void;
  disablePlugin: (pluginId: string) => void;
  getPluginsByRole: (role: AddonRole) => Plugin[];
  getInstalledPlugins: () => Plugin[];
  hasCapability: (capability: string) => boolean;
  updatePluginSetting: (pluginId: string, key: string, value: unknown) => void;
  getPluginSettings: (pluginId: string) => Record<string, unknown>;
  reorderPlugins: (orderedIds: string[]) => void;
  setPluginOrder: (orderedIds: string[]) => void;
  removePlugin: (pluginId: string) => void;
}
```

**Plugin Roles:** metadata-provider, stream-provider, lyrics-provider, scrobbler, audio-processor, tool
**Categories:** metadata, streaming, lyrics, translation, scrobbling, analysis, audio, tool

### settings-store

Application settings:

```typescript
interface SettingsState {
  // Paths
  downloadFolder: string;
  pluginFolder: string;
  localMusicFolders: string[];

  // Playback
  crossfadeEnabled: boolean;
  crossfadeDuration: number;
  normalizeVolume: boolean;

  // Downloads
  downloadQuality: 'high' | 'medium' | 'low';
  autoDownloadLikes: boolean;

  // Demucs/Karaoke
  demucsConfig: {
    localFiles: boolean;
    cdnUrl: string;
    hqMode: boolean;
    modelPreference: string;
  };

  // Remote access
  customRelayUrl: string | null;
  remoteAccessEnabled: boolean;

  // Actions
  setDownloadFolder: (path: string) => void;
  addLocalMusicFolder: (path: string) => void;
  removeLocalMusicFolder: (path: string) => void;
  updateLocalMusicFolder: (oldPath: string, newPath: string) => void;
  setCrossfadeEnabled: (enabled: boolean) => void;
  setCrossfadeDuration: (duration: number) => void;
  setNormalizeVolume: (normalize: boolean) => void;
  updateDemucsConfig: (config: Partial<DemucsConfig>) => void;
  setCustomRelayUrl: (url: string | null) => void;
  setRemoteAccessEnabled: (enabled: boolean) => void;
}
```

### translation-store

Lyrics translation:

```typescript
interface TranslationState {
  enabled: boolean;
  translations: Map<string, string>;
  isTranslating: boolean;
  progress: number;

  // Actions
  setTranslationEnabled: (enabled: boolean) => void;
  translateLyrics: (lyrics: LyricsLine[]) => Promise<void>;
  clearTranslations: () => void;
  getTranslation: (text: string) => string | null;
  detectLanguage: (text: string) => Promise<string>;
}
```

### stats-store

Listening statistics:

```typescript
interface StatsState {
  listenEntries: ListenEntry[];
  artistStats: Map<string, ArtistStat>;
  genreStats: Map<string, GenreStat>;
  dailyStats: Map<string, DailyStat>;
  hourlyDistribution: number[];
  dayOfWeekDistribution: number[];

  // Actions
  recordListen: (track: UnifiedTrack, duration: number, completed: boolean) => void;
  recordSkip: (track: UnifiedTrack, position: number) => void;
  getStats: (period: 'week' | 'month' | 'year' | 'all') => Stats;
  getSkipStats: () => SkipStats;
  clearHistory: () => void;
}
```

## Common Patterns

### Store Structure

```typescript
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface StoreState {
  // State
  items: Item[];
  isLoading: boolean;

  // Actions
  addItem: (item: Item) => void;
  fetchItems: () => Promise<void>;
}

export const useStore = create<StoreState>()(
  persist(
    (set, get) => ({
      items: [],
      isLoading: false,

      addItem: (item) => set((state) => ({
        items: [...state.items, item],
      })),

      fetchItems: async () => {
        set({ isLoading: true });
        try {
          const items = await window.api.invoke('get-items');
          set({ items, isLoading: false });
        } catch (error) {
          set({ isLoading: false });
          throw error;
        }
      },
    }),
    {
      name: 'store-key',
      partialize: (state) => ({
        items: state.items,
      }),
    }
  )
);
```

### Selectors

```typescript
// Memoized selector
const selectQueueDuration = (state: PlayerState) =>
  state.queue.reduce((acc, track) => acc + track.duration, 0);

// In component
const queueDuration = usePlayerStore(selectQueueDuration);

// Multiple values with shallow comparison
import { shallow } from 'zustand/shallow';

const { isPlaying, volume } = usePlayerStore(
  (state) => ({ isPlaying: state.isPlaying, volume: state.volume }),
  shallow
);
```

### Optimistic Updates

```typescript
likeTrack: async (track) => {
  const previousLikes = get().likedTracks;

  // Optimistic update
  set((state) => ({
    likedTracks: [...state.likedTracks, { track, likedAt: new Date() }],
  }));

  try {
    await window.api.invoke('library:like', track);
  } catch (error) {
    // Rollback
    set({ likedTracks: previousLikes });
    throw error;
  }
},
```

### Outside React

```typescript
// Access store outside components
const state = usePlayerStore.getState();
const currentTrack = state.currentTrack;

// Update store
usePlayerStore.setState({ volume: 0.5 });

// Subscribe to changes
const unsubscribe = usePlayerStore.subscribe((state) => {
  console.log('State changed:', state);
});
```

## Best Practices

### 1. Keep Stores Focused

One store per domain - 21 focused stores vs one monolithic state.

### 2. Use Selectors

Prevent unnecessary re-renders:

```typescript
// Bad - re-renders on any state change
const store = usePlayerStore();

// Good - only re-renders when volume changes
const volume = usePlayerStore((state) => state.volume);
```

### 3. Batch Updates

Minimize re-renders:

```typescript
// Bad - two state updates
set({ isLoading: true });
set({ items: newItems });

// Good - single update
set({ isLoading: true, items: newItems });
```

### 4. Persist Selectively

Only persist what's needed:

```typescript
persist(
  (set, get) => ({ /* ... */ }),
  {
    name: 'store-key',
    partialize: (state) => ({
      // Only persist these fields
      theme: state.currentThemeId,
      volume: state.volume,
    }),
  }
)
```

## Related

- [Architecture](architecture.md) - System design
- [IPC Reference](ipc-reference.md) - Desktop IPC
- [Testing](testing.md) - Testing guide
