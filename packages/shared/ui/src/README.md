# Audiio UI Package

Shared React UI layer for the Audiio music player. This package is used by both the desktop (Electron) and web clients.

## Directory Structure

```
src/
├── App.tsx                 # Main application component & routing
├── main.tsx                # React entry point
├── styles.css              # Global CSS & design tokens
│
├── components/             # React components (by feature)
├── contexts/               # React Context providers
├── hooks/                  # Custom React hooks
├── ml/                     # Client-side ML plugin integration
├── registry/               # Plugin UI registration system
├── services/               # Client-side services (caching, search, translation)
├── stores/                 # Zustand state management
├── types/                  # TypeScript type definitions
└── utils/                  # Utility functions
```

---

## Entry Points

### `main.tsx`
React DOM entry point. Renders `<App />` into `#root`.

### `App.tsx`
Main application component that handles:
- **Routing** - View switching based on `navigation-store`
- **Layout** - TitleBar, Sidebar, main content area, Player
- **Providers** - ThemeProvider, ContextMenuProvider, RecommendationExplanationProvider
- **Global Managers** - AutoQueueManager, GlobalShortcutManager, SkipTrackingManager, EmbeddingManager
- **Modals** - AddToPlaylist, AddToCollection, TagTrack, Dislike, VideoPlayer
- **Initialization** - Plugin UIs, core providers, builtin transformers

---

## Components

Organized by feature area:

| Directory | Purpose | Key Components |
|-----------|---------|----------------|
| `Album/` | Album detail pages | `AlbumDetailView`, `CreditsModal` |
| `Artist/` | Artist pages with enrichment | `ArtistDetailView`, sections (Videos, Concerts, Setlists, Timeline, Gallery, Merchandise) |
| `Collections/` | User collections | `CollectionsView`, `CollectionView`, `CollectionCard` |
| `Connection/` | Server connection UI | `ConnectionScreen` |
| `ContextMenu/` | Right-click menus | `ContextMenu` |
| `Discover/` | Homepage & discovery | `Discover`, `HeroSection`, `TrendingTracksSection`, `TrackCard`, `SectionDetailView` |
| `DiscoverySlider/` | Discovery exploration | `DiscoverySlider` |
| `Library/` | Library views | `LikesView`, `DislikesView`, `PlaylistsView`, `PlaylistDetailView`, `DownloadsView` |
| `Lyrics/` | Lyrics display | `SingAlongLine` |
| `Modals/` | Modal dialogs | `AddToPlaylistModal`, `AddToCollectionModal`, `TagTrackModal`, `DislikeModal`, `VideoPlayerModal`, `InputModal` |
| `Player/` | Audio player | `Player`, `FullPlayer`, `LyricsPanel`, `LyricsDisplay`, `TranslationToggle` |
| `Plugins/` | Plugin management | `PluginsView`, `PluginDetailView` |
| `Queue/` | Play queue | `QueuePopover`, `QueueView` |
| `RecommendationExplanation/` | ML explanation UI | `RecommendationExplanation`, `ExplanationModal` |
| `Search/` | Search functionality | `FloatingSearch`, `SearchDropdown`, `SearchBar`, `SearchResults`, `AdvancedSearch` |
| `Settings/` | App settings | `SettingsView`, `AudioSettings`, `ConnectionSettings`, `StorageSettings`, `ThemeEditorModal` |
| `Sidebar/` | Navigation sidebar | `Sidebar` |
| `Stats/` | Listening statistics | `StatsView`, `StatCard`, `TopList`, charts (`BarChart`, `HeatMap`) |
| `Tags/` | Tag management | `TagManager`, `TagDetailView`, `TagBadge`, `TagSelector` |
| `TitleBar/` | Window controls | `TitleBar` |
| `TrackRow/` | Track list item | `TrackRow` |
| `common/` | Shared components | `Toast`, `Skeleton`, `StickyHeader`, `PlaylistCover`, `ColorPicker`, `ExternalLinks` |

---

## Stores (Zustand)

State management using Zustand. All stores use the pattern `use[Name]Store`.

| Store | Purpose |
|-------|---------|
| `advanced-search-store` | Natural language search queries & history |
| `album-store` | Album detail data & similar albums |
| `artist-store` | Artist detail data & discography |
| `audio-features-store` | Audio feature data & mood clusters |
| `collection-store` | User collections, folders, pinned items |
| `connection-store` | Server connection status |
| `integrations-store` | ListenBrainz, Spotify import |
| `library-store` | Likes, playlists, downloads |
| `lyrics-store` | Lyrics fetching & caching |
| `ml-store` | ML training status & scoring |
| `navigation-store` | Current view & navigation history |
| `player-store` | Playback state, queue, current track |
| `plugin-store` | Plugin list, settings, repositories |
| `recommendation-store` | ML recommendations, dislikes, discovery layout |
| `search-store` | Search results & smart search |
| `settings-store` | User preferences |
| `shortcut-store` | Keyboard shortcuts |
| `smart-queue-store` | Auto-queue & radio mode |
| `stats-store` | Listening statistics |
| `tag-store` | User tags |
| `theme-store` | Theme configuration |
| `toast-store` | Toast notifications |
| `translation-store` | Lyrics translation state |
| `ui-store` | UI state (modals, panels, full player) |

---

## Hooks

Custom React hooks for reusable logic. See [`hooks/README.md`](./hooks/README.md) for detailed documentation.

| Hook | Purpose |
|------|---------|
| `useAlbumEnrichment` | Fetch album videos from plugins |
| `useArtistEnrichment` | Fetch artist videos, concerts, setlists, etc. |
| `useArtwork` | Resolve artwork URLs (handles embedded art) |
| `useDownloadProgress` | Listen for download events |
| `useEmbeddingPlaylist` | ML playlist generation |
| `useKeyboardShortcuts` | Global keyboard shortcuts |
| `useLibraryBridge` | IPC bridge for mobile sync |
| `useMLRanking` | Apply ML ranking to tracks |
| `usePluginAudioFeatures` | Connect plugins to audio feature system |
| `usePluginData` | Fetch data through plugin pipeline |
| `useRecommendationExplanation` | ML recommendation explanations |
| `useRecommendations` | ML recommendations, radio, trending |
| `useScrobbling` | Automatic scrobbling |
| `useSkipTracking` | Track skip events for ML |
| `useSmartQueue` | Auto-queue and radio mode |
| `useTranslatedLyrics` | Lyrics with translations |

---

## Contexts

React Context providers for global state. See [`contexts/README.md`](./contexts/README.md).

| Context | Purpose |
|---------|---------|
| `ThemeContext` | Theme CSS variables, color mode |
| `ContextMenuContext` | Right-click context menus |

---

## Services

Client-side services for caching and processing. See [`services/README.md`](./services/README.md).

| Service | Purpose |
|---------|---------|
| `lyrics-cache.ts` | IndexedDB cache for lyrics with word timings |
| `stream-prefetch.ts` | Pre-resolve stream URLs for queue |
| `search/` | Fuzzy search with natural language parsing |
| `translation/` | Lyrics translation (detection, caching, API) |

---

## Utils

Utility functions. See [`utils/README.md`](./utils/README.md).

| Utility | Purpose |
|---------|---------|
| `color-extraction.ts` | 5-color palette from artwork |
| `color-extractor.ts` | 3-color palette for player |
| `debug.ts` | Development-only logging |
| `lyrics-parser.ts` | Parse LRC, ELRC, SRT lyrics |
| `syllable-timing.ts` | Word timing for karaoke |
| `theme-utils.ts` | Theme import & validation |

---

## Types

TypeScript type definitions. See [`types/README.md`](./types/README.md).

| File | Purpose |
|------|---------|
| `api.d.ts` | `window.api` IPC bridge types (ML, downloads, search, integrations) |

---

## ML

Client-side ML plugin integration. See [`ml/README.md`](./ml/README.md).

| File | Purpose |
|------|---------|
| `plugin-audio-provider.ts` | Registry for plugin audio feature providers |
| `index.ts` | Barrel exports |

> **Note:** ML training/scoring happens server-side. This module only handles plugin-provided audio features.

---

## Registry

Plugin UI registration system. See [`registry/README.md`](./registry/README.md).

| File | Purpose |
|------|---------|
| `plugin-ui-registry.ts` | Singleton registry for plugin views, nav items, modals |
| `init-plugin-ui.ts` | Initialization and cleanup |
| `index.ts` | Barrel exports |

---

## Data Flow

```
User Action
    │
    ▼
Component ──► Hook ──► Store ──► window.api (IPC) ──► Server
    │                    │
    │                    ▼
    │              Local State
    │                    │
    └────────────────────┘
           Re-render
```

---

## Key Patterns

### Store Access
```typescript
import { usePlayerStore } from './stores/player-store';

// In component
const { currentTrack, isPlaying, play, pause } = usePlayerStore();

// Outside component
const track = usePlayerStore.getState().currentTrack;
```

### IPC Calls
```typescript
// All server communication goes through window.api
const result = await window.api.search({ query: 'artist name', type: 'track' });
const features = await window.api.getAudioFeatures(trackId);
await window.api.likeTrack(track);
```

### Plugin Pipeline
```typescript
// Discover sections use the plugin pipeline
const { tracks, isLoading } = usePluginData('trending', {
  applyMLRanking: true,
  applyTransformers: true,
  limit: 50
});
```

---

## Styles

`styles.css` contains:
- CSS custom properties (design tokens)
- Global styles and resets
- Component-specific styles
- Animation keyframes
- Responsive breakpoints

Theme colors are applied dynamically via `ThemeContext`.
