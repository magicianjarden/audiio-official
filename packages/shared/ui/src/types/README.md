# UI Types

Type definitions for the Electron IPC bridge (`window.api`).

## api.d.ts

**Purpose:** Declares the global `window.api` interface that bridges the renderer process (UI) to the main process (server). All IPC calls are typed here.

---

## Type Categories

### Core Types (re-exported from @audiio/core)
- `UnifiedTrack` - Standard track format
- `StreamInfo` - Stream URL and metadata
- `ArtistDetail`, `AlbumDetail`, `Artist`, `Album`
- `TrendingContent`, `AudioFeatures`, `AnalysisOptions`

---

### Addon/Plugin Types

```typescript
interface AddonInfo {
  id: string;
  name: string;
  roles: string[];
  enabled: boolean;
}
```

**Used by:** `stores/plugin-store.ts`

---

### Download Types

```typescript
interface DownloadProgressEvent {
  trackId: string;
  progress: number;
  status: 'downloading' | 'completed' | 'failed';
  filePath?: string;
  error?: string;
}

interface DownloadResult {
  success: boolean;
  filePath?: string;
  error?: string;
}
```

**Used by:** `hooks/useDownloadProgress.ts`

---

### ML Algorithm Types

```typescript
interface MLTrackScore {
  trackId: string;
  finalScore: number;
  confidence: number;
  components: Record<string, number | undefined>;
  explanation: string[];
}

interface MLTrainingStatus {
  isTraining: boolean;
  progress: number;
  phase: 'idle' | 'preparing' | 'training' | 'validating' | 'saving';
  message?: string;
  lastTrainedAt?: number;
  modelVersion?: string;
}

interface MLTrainingResult {
  success: boolean;
  metrics?: { accuracy: number; loss: number };
  trainingDuration?: number;
  samplesUsed?: number;
  modelVersion?: string;
}

interface MLAggregatedFeatures {
  trackId: string;
  audio?: { bpm, key, mode, energy, danceability, valence, ... };
  emotion?: { valence, arousal, moodCategory, moodConfidence };
  lyrics?: { sentiment, themes, language };
  providers: Array<{ providerId, providedFeatures, confidence }>;
  lastUpdated: number;
}
```

**Used by:** `stores/ml-store.ts`, `stores/recommendation-store.ts`, `stores/smart-queue-store.ts`

---

### Natural Language Search Types

```typescript
interface ParsedFilter {
  type: 'artist' | 'album' | 'genre' | 'year' | 'duration' | 'tag' | 'source' | 'rating' | 'decade';
  operator: 'is' | 'contains' | 'gt' | 'lt' | 'between' | 'not';
  value: string | number | [number, number];
}

interface ParsedQuery {
  text: string;
  filters: ParsedFilter[];
  audioFeatures?: { energy?, tempo?, valence?, ... };
  playBehavior?: { minPlays?, maxPlays?, playedWithinDays?, neverPlayed? };
  similarity?: { trackId?, artistName? };
}

interface NaturalSearchResult {
  parsedQuery: ParsedQuery;
  tracks: UnifiedTrack[];
  total: number;
  suggestions: string[];
}

interface SearchSuggestions {
  tracks: string[];
  artists: string[];
  albums: string[];
  tags: string[];
  recentSearches: string[];
}

interface SearchHistoryEntry {
  id: string;
  query: string;
  timestamp: number;
  resultCount: number;
}
```

**Used by:** `stores/advanced-search-store.ts`

---

### Audio Feature Index Types

```typescript
interface AudioFeatureData {
  trackId: string;
  energy: number;
  tempo: number;
  valence: number;
  danceability: number;
  acousticness: number;
  instrumentalness: number;
  speechiness: number;
  loudness: number;
  key: number;
  mode: number;
  timeSignature: number;
  analyzedAt: number;
}

interface FeatureDistribution {
  feature: string;
  min: number;
  max: number;
  mean: number;
  median: number;
  stdDev: number;
  percentiles: Record<string, number>;
}

interface MoodCluster {
  name: string;
  description: string;
  centroid: Partial<AudioFeatureData>;
  trackCount: number;
  tracks?: string[];
}
```

**Used by:** `stores/audio-features-store.ts`

---

### Integration Types

#### ListenBrainz
```typescript
interface ListenBrainzStatus {
  isConnected: boolean;
  username?: string;
  totalScrobbles?: number;
}

interface ListenBrainzStats {
  totalListens?: number;
  topArtists?: Array<{ name: string; count: number }>;
  topTracks?: Array<{ title: string; artist: string; count: number }>;
}
```

#### Spotify Import
```typescript
interface SpotifyImportStatus {
  isConfigured: boolean;
  isAuthenticated: boolean;
}

interface SpotifyPlaylistInfo {
  id: string;
  name: string;
  description: string | null;
  images: Array<{ url, width, height }>;
  owner: { id, display_name };
  tracks: { total: number };
  public: boolean;
}

interface SpotifyImportResult {
  playlist?: { name, description?, trackCount };
  tracks: Array<{ title, artist, album, duration, isrc?, spotifyId, popularity, artwork? }>;
  matched: number;
  unmatched: number;
}
```

**Used by:** `stores/integrations-store.ts`, `hooks/useScrobbling.ts`

---

## window.api Methods

### Search & Playback
| Method | Description | Used By |
|--------|-------------|---------|
| `search(query)` | Search for tracks | `album-store.ts`, `artist-store.ts` |
| `playTrack(track)` | Get stream URL and play | `player-store.ts` |
| `pause()` | Pause playback | `player-store.ts` |
| `resume()` | Resume playback | `player-store.ts` |
| `seek(position)` | Seek to position | `player-store.ts` |
| `downloadTrack(track)` | Download track locally | Download components |
| `prefetchTracks(tracks)` | Pre-resolve stream URLs | `stream-prefetch.ts` |

### Window Controls
| Method | Description | Used By |
|--------|-------------|---------|
| `windowMinimize()` | Minimize window | `TitleBar.tsx` |
| `windowMaximize()` | Maximize/restore window | `TitleBar.tsx` |
| `windowClose()` | Close window | `TitleBar.tsx` |
| `windowIsMaximized()` | Check maximized state | `TitleBar.tsx` |
| `getPlatform()` | Get OS platform | Various |

### Plugin Management
| Method | Description | Used By |
|--------|-------------|---------|
| `getAddons()` | List all addons | `plugin-store.ts` |
| `setAddonEnabled(id, enabled)` | Enable/disable addon | `plugin-store.ts` |
| `updateAddonSettings(id, settings)` | Update addon config | `plugin-store.ts` |
| `getAddonSettings(id)` | Get addon config | `plugin-store.ts` |
| `plugins.getLoadedPlugins()` | List loaded plugins | `plugin-store.ts` |
| `plugins.reloadPlugins()` | Reload all plugins | `plugin-store.ts` |

### Artist & Album
| Method | Description | Used By |
|--------|-------------|---------|
| `getArtist(id, source?)` | Get artist details | `artist-store.ts` |
| `getAlbum(id, source?)` | Get album details | `album-store.ts` |
| `getSimilarAlbums(albumId, source?)` | Get similar albums | `album-store.ts` |
| `getSimilarTracks(params)` | Get similar tracks | `usePluginAudioFeatures.ts`, `useRecommendations.ts` |

### Discovery & Recommendations
| Method | Description | Used By |
|--------|-------------|---------|
| `getTrending()` | Get trending content | `useRecommendations.ts` |
| `getRecommendedTracks(basedOn, id)` | Get recommendations | `useRecommendations.ts` |
| `getArtistRadio(params)` | Artist-based radio | `useRecommendations.ts` |
| `getNewReleases(params?)` | Get new releases | Discover sections |
| `getDiscoveryLayout()` | Get homepage layout | `recommendation-store.ts` |

### ML Algorithm
| Method | Description | Used By |
|--------|-------------|---------|
| `algoScoreTrack(trackId)` | Score single track | `ml-store.ts`, `recommendation-store.ts` |
| `algoScoreBatch(trackIds)` | Score multiple tracks | `ml-store.ts`, `smart-queue-store.ts` |
| `algoGetRecommendations(count, mode?)` | ML recommendations | `useRecommendations.ts` |
| `algoGetSimilar(trackId, count)` | ML similar tracks | `useRecommendations.ts` |
| `algoGetArtistRadio(artistId, count)` | ML artist radio | `smart-queue-store.ts`, `useRecommendations.ts` |
| `algoGetGenreRadio(genre, count)` | ML genre radio | `smart-queue-store.ts`, `useRecommendations.ts` |
| `algoGetRadio(seedTrackId, count)` | ML track radio | `smart-queue-store.ts`, `useRecommendations.ts` |
| `algoGetFeatures(trackId)` | Get ML features | ML components |
| `algoTrain()` | Trigger training | `ml-store.ts` |
| `algoTrainingStatus()` | Get training status | `ml-store.ts` |
| `algoGetProfile()` | Get user profile | `recommendation-store.ts` |
| `algoGetNextQueue(count, context)` | Smart queue tracks | `smart-queue-store.ts` |

### Audio Analysis
| Method | Description | Used By |
|--------|-------------|---------|
| `getAudioFeatures(trackId, streamUrl?, track?)` | Get audio features | `usePluginAudioFeatures.ts` |
| `analyzeAudioFile(filePath, options?)` | Analyze local file | Analysis components |
| `analyzeAudioUrl(url, options?)` | Analyze from URL | Analysis components |
| `checkAudioAnalyzer()` | Check analyzer status | `usePluginAudioFeatures.ts` |

### Lyrics
| Method | Description | Used By |
|--------|-------------|---------|
| `lyrics.isAvailable()` | Check if available | `lyrics-store.ts` |
| `lyrics.search(artist, track, album?)` | Search for lyrics | `lyrics-store.ts` |

### Karaoke
| Method | Description | Used By |
|--------|-------------|---------|
| `karaoke.isAvailable()` | Check if available | Karaoke components |
| `karaoke.processTrack(trackId, audioUrl)` | Process vocal removal | Karaoke components |
| `karaoke.getCached(trackId)` | Get cached instrumental | Karaoke components |

### Library (Likes, Dislikes, Playlists)
| Method | Description | Used By |
|--------|-------------|---------|
| `getLikedTracks()` | Get liked tracks | `library-store.ts` |
| `likeTrack(track)` | Like a track | `library-store.ts` |
| `unlikeTrack(trackId)` | Unlike a track | `library-store.ts` |
| `dislikeTrack(track, reasons)` | Dislike with reasons | `recommendation-store.ts` |
| `removeDislike(trackId)` | Remove dislike | `recommendation-store.ts` |
| `getDislikedTracks()` | Get dislikes | `recommendation-store.ts` |
| `getPlaylists()` | List playlists | `library-store.ts` |
| `createPlaylist(name, description?)` | Create playlist | `library-store.ts` |
| `addToPlaylist(playlistId, track)` | Add to playlist | `library-store.ts` |

### Stats & Tracking
| Method | Description | Used By |
|--------|-------------|---------|
| `trackEvent(event)` | Record user event | `recommendation-store.ts` |
| `getStats(period)` | Get listening stats | `stats-store.ts` |
| `getListenHistory(limit?)` | Get history | `stats-store.ts` |

### Advanced Search (window.api.advancedSearch)
| Method | Description | Used By |
|--------|-------------|---------|
| `natural(query)` | Natural language search | `advanced-search-store.ts` |
| `advanced(params)` | Filtered search | `advanced-search-store.ts` |
| `suggestions(prefix, limit?)` | Autocomplete | `advanced-search-store.ts` |
| `getHistory(limit?)` | Search history | `advanced-search-store.ts` |
| `clearHistory()` | Clear history | `advanced-search-store.ts` |

### Audio Feature Index (window.api.audioFeatureIndex)
| Method | Description | Used By |
|--------|-------------|---------|
| `get(trackId)` | Get features | `audio-features-store.ts` |
| `query(criteria, limit?, offset?)` | Query by features | `audio-features-store.ts` |
| `findSimilar(trackId, limit?)` | Find similar | `audio-features-store.ts` |
| `getDistributions()` | Get distributions | `audio-features-store.ts` |
| `getMoods()` | Available moods | `audio-features-store.ts` |
| `getMoodClusters(includeTracks?, trackLimit?)` | Mood clusters | `audio-features-store.ts` |

### ListenBrainz (window.api.listenbrainz)
| Method | Description | Used By |
|--------|-------------|---------|
| `setToken(token)` | Authenticate | `integrations-store.ts` |
| `getStatus()` | Connection status | `integrations-store.ts` |
| `scrobble(track, duration, timestamp?)` | Scrobble track | `useScrobbling.ts` |
| `updateNowPlaying(track)` | Update now playing | `useScrobbling.ts` |
| `importListens(maxCount?)` | Import history | `integrations-store.ts` |
| `importLovedTracks(maxCount?)` | Import loved | `integrations-store.ts` |

### Spotify Import (window.api.spotifyImport)
| Method | Description | Used By |
|--------|-------------|---------|
| `configure(clientId, clientSecret, redirectUri)` | Set OAuth | `integrations-store.ts` |
| `getAuthUrl()` | Get auth URL | `integrations-store.ts` |
| `handleCallback(code)` | Handle OAuth | `integrations-store.ts` |
| `getStatus()` | Connection status | `integrations-store.ts` |
| `getPlaylists()` | Get user playlists | `integrations-store.ts` |
| `importPlaylist(playlistId)` | Import playlist | `integrations-store.ts` |
| `importLikedSongs(maxCount?)` | Import likes | `integrations-store.ts` |

---

## Usage Pattern

```typescript
// Check if API exists (renderer process only)
if (window.api?.someMethod) {
  const result = await window.api.someMethod(params);
}

// Import types for use in stores/hooks
import type { AudioFeatureData, MoodCluster } from '../types/api';
```

---

## Files Importing from api.d.ts

| File | Imports |
|------|---------|
| `stores/advanced-search-store.ts` | `ParsedFilter`, `ParsedQuery`, `NaturalSearchResult`, `SearchSuggestions`, `SearchHistoryEntry` |
| `stores/audio-features-store.ts` | `UnifiedTrack`, `AudioFeatureData`, `MoodCluster`, `FeatureDistribution` |
| `stores/integrations-store.ts` | `UnifiedTrack`, `SpotifyPlaylistInfo`, `SpotifyImportResult` |
| `hooks/useScrobbling.ts` | `UnifiedTrack` |
