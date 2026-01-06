# Audiio UI Stores Documentation

This document details all Zustand stores used in the Audiio UI layer (`packages/shared/ui/src/stores/`). Each store manages a specific domain of application state.

---

## Table of Contents

1. [album-store](#album-store)
2. [artist-store](#artist-store)
3. [connection-store](#connection-store)
4. [lyrics-store](#lyrics-store)
5. [ml-store](#ml-store)
6. [shortcut-store](#shortcut-store)
7. [theme-store](#theme-store)
8. [toast-store](#toast-store)
9. [translation-store](#translation-store)
10. [advanced-search-store](#advanced-search-store)
11. [tag-store](#tag-store)
12. [collection-store](#collection-store)
13. [player-store](#player-store)
14. [library-store](#library-store)
15. [ui-store](#ui-store)
16. [settings-store](#settings-store)
17. [plugin-store](#plugin-store)
18. [search-store](#search-store)
19. [navigation-store](#navigation-store)
20. [stats-store](#stats-store)
21. [recommendation-store](#recommendation-store)
22. [smart-queue-store](#smart-queue-store)

---

## album-store

**File:** `album-store.ts`

**Purpose:** Manages album detail data fetching and caching for the album detail view.

**Key State:**
- `albumCache` - Map of album ID to album details
- `loadingAlbumId` - Currently loading album
- `error` - Error state

**Key Actions:**
- `fetchAlbum(albumId, albumData)` - Fetches full album details including tracks, similar albums, and artist info
- `getAlbum(albumId)` - Returns cached album data
- `clearCache()` - Clears the album cache

**Used In:**
- `components/Album/AlbumDetailView.tsx`

---

## artist-store

**File:** `artist-store.ts`

**Purpose:** Manages artist detail data fetching and caching for the artist detail view.

**Key State:**
- `artistCache` - Map of artist ID to artist details
- `loadingArtistId` - Currently loading artist
- `error` - Error state

**Key Actions:**
- `fetchArtist(artistId, artistName, initialData)` - Fetches full artist details including top tracks, albums, singles, EPs, compilations, and similar artists
- `getArtist(artistId)` - Returns cached artist data
- `clearCache()` - Clears the artist cache

**Used In:**
- `components/Artist/ArtistDetailView.tsx`

---

## connection-store

**File:** `connection-store.ts`

**Purpose:** Manages connection state between the UI and backend server. Handles both "client mode" (thin client + remote server) and "desktop mode" (full desktop app).

**Key State:**
- `state` - Connection state (connected, serverUrl, serverName, latency, error)
- `isClientMode` - Whether running as thin client
- `isLoading` - Loading state

**Key Actions:**
- `connect(serverUrl, token)` - Connects to a server
- `disconnect()` - Disconnects from server
- `checkConnection()` - Checks current connection status

**Used In:**
- `App.tsx`
- `components/Settings/SettingsView.tsx`
- `components/Settings/ConnectionSettings.tsx`
- `components/Connection/ConnectionScreen.tsx`

---

## lyrics-store

**File:** `lyrics-store.ts`

**Purpose:** Manages lyrics fetching, parsing, and synchronized display. Supports multiple formats (LRC, Enhanced LRC, SRT, plain text) with word-level timing for karaoke/sing-along mode.

**Key State:**
- `lyrics` - Parsed lyric lines with timestamps
- `plainLyrics` - Plain text lyrics fallback
- `currentLineIndex` / `nextLineIndex` - Current playback position
- `linesWithWords` - Word-level timing data for sing-along
- `singAlongEnabled` - Karaoke mode toggle
- `viewMode` - 'synced' or 'plain' display mode
- `offset` - Manual sync adjustment

**Key Actions:**
- `fetchLyrics(artist, track, trackId)` - Fetches and parses lyrics
- `prefetchLyrics(artist, track, trackId)` - Background prefetch
- `updateCurrentLine(positionMs)` - Updates current line based on playback position
- `updateCurrentWord(positionMs)` - Updates word-level highlighting
- `seekToLine(index)` - Jump to specific line
- `setSingAlongEnabled(enabled)` - Toggle karaoke mode

**Used In:**
- `App.tsx`
- `components/Player/FullPlayer.tsx`
- `components/Player/LyricsPanel.tsx`
- `components/Player/LyricsDisplay.tsx`
- `components/Lyrics/SingAlongLine.tsx`
- `hooks/useTranslatedLyrics.ts`
- `utils/lyrics-parser.ts`

---

## ml-store

**File:** `ml-store.ts`

**Purpose:** Server-backed ML functionality. All ML computation happens on the server - this store provides access to server endpoints for scoring and recommendations.

**Key State:**
- `isModelLoaded` - Whether ML model is ready
- `isTraining` - Training in progress
- `modelVersion` / `lastTrainedAt` - Model metadata
- `trainingStatus` - Current training phase and progress
- `trainingMetrics` - Training results

**Key Actions:**
- `initialize()` - Fetch ML status from server
- `trainModel()` - Trigger server-side training
- `predictScore(track, hour)` - Get ML score for a track
- `predictBatchScores(tracks, hour)` - Batch scoring
- `getHybridRecommendations(candidates, limit, hour)` - Get ML-enhanced recommendations

**Used In:**
- `components/Stats/StatsView.tsx`
- `hooks/useSmartQueue.ts`
- `hooks/useMLRanking.ts`

---

## shortcut-store

**File:** `shortcut-store.ts`

**Purpose:** Manages keyboard shortcut configuration and persistence. Allows custom key mappings and enabling/disabling shortcuts.

**Key State:**
- `customMappings` - User-defined key overrides
- `disabledShortcuts` - Disabled shortcut IDs
- `showHints` - Whether to show shortcut hints in UI

**Key Actions:**
- `setCustomMapping(id, keys)` - Set custom key binding
- `resetMapping(id)` - Reset to default
- `toggleShortcut(id)` - Enable/disable shortcut
- `getEffectiveKeys(id)` - Get current key binding for action
- `isShortcutEnabled(id)` - Check if shortcut is enabled

**Exports:**
- `DEFAULT_SHORTCUTS` - Default key mappings
- `SHORTCUT_DEFINITIONS` - Shortcut metadata
- `formatShortcut(keys)` - Format keys for display

**Used In:**
- `hooks/useKeyboardShortcuts.ts`

**Persistence:** LocalStorage (`audiio-shortcuts`)

---

## theme-store

**File:** `theme-store.ts`

**Purpose:** Manages app theming, color modes, and community themes. Includes 8 built-in themes (4 dark, 4 light) with full color, gradient, shadow, and glass customization.

**Key State:**
- `autoMode` - Auto-switch based on system preference
- `preferredDarkThemeId` / `preferredLightThemeId` - Preferred themes per mode
- `manualThemeId` - Manual theme selection
- `themes` - All available themes (built-in + community)
- `communityThemes` - User-installed themes

**Key Actions:**
- `setTheme(themeId)` - Set active theme
- `setAutoMode(enabled)` - Toggle auto/manual mode
- `installTheme(theme)` - Install community theme
- `uninstallTheme(themeId)` - Remove community theme
- `getActiveTheme()` - Get currently active theme
- `createCustomTheme(config)` - Create new custom theme
- `exportTheme(themeId)` / `importTheme(json)` - Theme import/export

**Built-in Themes:**
- Dark: Audiio Dark, Midnight, Sunset, Ocean, Monochrome Dark
- Light: Audiio Light, Paper, Monochrome Light

**Used In:**
- `components/Settings/SettingsView.tsx`
- `components/Settings/ThemeEditorModal.tsx`
- `contexts/ThemeContext.tsx`
- `utils/theme-utils.ts`

**Persistence:** LocalStorage (`audiio-themes`)

---

## toast-store

**File:** `toast-store.ts`

**Purpose:** Manages toast notification display with auto-dismiss and optional action buttons.

**Key State:**
- `toasts` - Array of active toast notifications

**Key Actions:**
- `addToast(toast)` - Add new toast
- `removeToast(id)` - Remove specific toast
- `clearToasts()` - Remove all toasts

**Convenience Functions:**
- `showToast(message, type, duration)`
- `showSuccessToast(message)`
- `showErrorToast(message)`
- `showInfoToast(message)`
- `showActionToast(message, action, duration)` - Toast with action button

**Used In:**
- `components/common/Toast.tsx`
- `components/ContextMenu/ContextMenu.tsx`
- `stores/library-store.ts`
- `stores/tag-store.ts`
- `stores/collection-store.ts`
- `components/Artist/ArtistDetailView.tsx`
- `components/Settings/StorageSettings.tsx`

---

## translation-store

**File:** `translation-store.ts`

**Purpose:** Manages lyrics translation state using cache-first approach with LibreTranslate fallback.

**Key State:**
- `translationEnabled` - Whether translation is enabled
- `translations` - Map of line index to translated text
- `sourceLanguage` - Detected source language
- `isDetecting` / `isTranslating` - Loading states
- `translationProgress` - 0-100 progress

**Key Actions:**
- `setTranslationEnabled(enabled)` - Toggle translation
- `translateLyrics(trackId, lines)` - Translate lyrics lines
- `getTranslation(lineIndex)` - Get translation for specific line
- `detectLanguage(lines)` - Detect language of lyrics

**Used In:**
- `hooks/useTranslatedLyrics.ts`

**Persistence:** LocalStorage (`audiio-translation-settings`) - only `translationEnabled` is persisted

---

## advanced-search-store

**File:** `advanced-search-store.ts`

**Purpose:** Natural language and filter-based search with audio feature filtering, search history, and suggestions.

**Key State:**
- `query` - Current search query
- `filters` - Active search filters (artist, album, genre, year, duration, audio features, etc.)
- `parsedQuery` - NL-parsed query structure
- `results` - Search results
- `suggestions` - Autocomplete suggestions
- `searchHistory` - Recent searches
- `showFilters` - UI toggle for filter panel

**Key Actions:**
- `searchNatural(query)` - Natural language search
- `searchAdvanced()` - Filter-based search
- `loadMore()` - Pagination
- `setFilters(filters)` - Update search filters
- `loadSuggestions(prefix)` - Get autocomplete suggestions
- `useHistoryItem(entry)` - Use a history entry

**Used In:**
- `components/Search/AdvancedSearch.tsx`

**Persistence:** LocalStorage (`audiio-advanced-search`) - only search history

---

## tag-store

**File:** `tag-store.ts`

**Purpose:** Manages user tags for tracks, albums, artists, and playlists. All data synced with server.

**Key State:**
- `tags` - All available tags
- `trackTagsCache` - Cache of track tags
- `entityTagsCache` - Cache of entity (album/artist/playlist) tags
- `isLoading` / `isInitialized` - Loading states

**Key Actions:**
- `initialize()` - Fetch tags from server
- `createTag(name, color)` - Create new tag
- `updateTag(tagId, data)` - Update tag
- `deleteTag(tagId)` - Delete tag
- `addTagToTrack(trackId, tagName, color)` - Tag a track
- `removeTagFromTrack(trackId, tagName)` - Untag a track
- `getTracksByTag(tagName)` - Get all tracks with tag
- `hasTag(trackId, tagName)` - Check if track has tag
- `getTagSuggestions(partial)` - Autocomplete
- `getPopularTags(limit)` - Get most-used tags

**Used In:**
- `App.tsx`
- `components/Tags/TagDetailView.tsx`
- `components/Tags/TagManager.tsx`
- `components/Tags/TagSelector.tsx`
- `components/ContextMenu/ContextMenu.tsx`
- `components/Modals/TagTrackModal.tsx`
- `components/Sidebar/Sidebar.tsx`
- `contexts/ContextMenuContext.tsx`
- `stores/search-store.ts`

---

## collection-store

**File:** `collection-store.ts`

**Purpose:** Manages user collections (flexible "hubs" containing albums, artists, playlists, tracks, tags, folders) and pinned sidebar items.

**Key State:**
- `collections` - All user collections
- `pinnedItems` - Pinned sidebar items
- `libraryViews` - Custom library views
- `isLoading` / `isInitialized` - Loading states

**Key Actions:**
- `initialize()` - Fetch all data from server
- `createCollection(name, description)` - Create collection
- `addToCollection(collectionId, itemType, itemId, itemData)` - Add item
- `removeFromCollection(collectionId, itemId)` - Remove item
- `createFolderInCollection(collectionId, name)` - Create folder within collection
- `pinItem(itemType, itemId, itemData)` - Pin to sidebar
- `unpinItem(itemType, itemId)` - Unpin from sidebar
- `isPinned(itemType, itemId)` - Check if pinned
- `createLibraryView(data)` - Create custom library view

**Used In:**
- `App.tsx`
- `components/Collections/CollectionsView.tsx`
- `components/Collections/CollectionView.tsx`
- `components/Collections/CollectionCard.tsx`
- `components/ContextMenu/ContextMenu.tsx`
- `components/Modals/AddToCollectionModal.tsx`
- `components/Sidebar/Sidebar.tsx`
- `stores/search-store.ts`

---

## player-store

**File:** `player-store.ts`

**Purpose:** Manages audio and video playback state, queue, and controls.

**Key State:**
- **Audio:** `currentTrack`, `queue`, `queueIndex`, `isPlaying`, `position`, `duration`, `volume`, `isMuted`, `shuffle`, `repeat`
- **Video:** `videoMode`, `currentVideo`, `videoStreamInfo`, `isVideoPlaying`, `videoPosition`, `videoQuality`
- `isLoading` / `error` - Loading and error states

**Key Actions:**
- `initialize()` - Restore last playback state
- `play(track)` - Play a track (resolves stream URL via IPC)
- `pause()` / `resume()` / `stop()` - Playback controls
- `seek(position)` - Seek to position
- `next()` / `previous()` - Navigation
- `setVolume(volume)` / `toggleMute()` - Volume control
- `setQueue(tracks, startIndex)` - Set queue
- `addToQueue(track)` / `playNext(track)` - Queue management
- `toggleShuffle()` / `cycleRepeat()` - Playback modes
- `reorderQueue(fromIndex, toIndex)` - Drag-drop reorder
- `playVideo(video, quality)` / `closeVideo()` - Video playback
- `setVideoMode(mode)` - Float/theater mode

**Used In:**
- `App.tsx`
- `components/Player/Player.tsx`
- `components/Player/FullPlayer.tsx`
- `components/Queue/QueueView.tsx`
- `components/Queue/QueuePopover.tsx`
- `hooks/useSmartQueue.ts`
- Many other components

---

## library-store

**File:** `library-store.ts`

**Purpose:** Manages user's library including likes, dislikes, playlists (manual + smart/rule-based), media folder playlists, and downloads. All data synced with server.

**Key State:**
- `likedTracks` - Liked tracks with timestamps
- `dislikedTracks` - Disliked tracks with timestamps
- `playlists` - User playlists (includes media folder playlists)
- `folders` - Playlist folders for organization
- `downloads` - Download queue and history
- `ruleDefinitions` - Available rule types for smart playlists

**Key Actions:**
- `initialize()` - Fetch all library data
- `likeTrack(track)` / `unlikeTrack(trackId)` / `toggleLike(track)` - Like management
- `dislikeTrack(track, reasons)` / `undislikeTrack(trackId)` - Dislike management
- `createPlaylist(name, description, options)` - Create playlist (supports rules for smart playlists)
- `addToPlaylist(playlistId, track)` / `removeFromPlaylist(playlistId, trackId)` - Playlist management
- `evaluatePlaylistRules(playlistId)` - Evaluate smart playlist rules
- `previewPlaylistRules(rules, options)` - Preview rule results
- `refreshMediaFolders()` - Sync media folder playlists
- `startDownload(track, options)` / `cancelDownload(downloadId)` - Download management

**Used In:**
- `App.tsx`
- `components/Library/LikesView.tsx`
- `components/Library/DislikesView.tsx`
- `components/Library/PlaylistsView.tsx`
- `components/Library/PlaylistDetailView.tsx`
- `components/Library/DownloadsView.tsx`
- `components/ContextMenu/ContextMenu.tsx`
- `components/Modals/AddToPlaylistModal.tsx`
- `components/Sidebar/Sidebar.tsx`
- Many other components

---

## ui-store

**File:** `ui-store.ts`

**Purpose:** Manages UI state including player mode, panel visibility, sidebar state, and modal states.

**Key State:**
- `playerMode` - 'mini' or 'full'
- `isQueueOpen` / `isLyricsPanelOpen` / `isLyricsPanelExpanded` - Panel states
- `isSidebarCollapsed` / `sidebarWidth` / `sidebarActiveTab` - Sidebar state
- `isPlaylistsExpanded` / `isTagsExpanded` / `isCollectionsExpanded` - Section expansion
- `isCreatingPlaylist` / `isCreatingTag` / `isCreatingCollection` - Inline creation modes
- `dislikeModalTrack` - Track for dislike modal

**Key Actions:**
- `expandPlayer()` / `collapsePlayer()` / `togglePlayer()` - Player mode
- `openQueue(anchorRect)` / `closeQueue()` / `toggleQueue()` - Queue popover
- `toggleLyricsPanel()` / `openLyricsPanel()` / `closeLyricsPanel()` - Lyrics panel
- `toggleSidebar()` / `setSidebarWidth(width)` / `setSidebarActiveTab(tab)` - Sidebar
- `startCreatingPlaylist()` / `stopCreatingPlaylist()` - Inline creation
- `openDislikeModal(track)` / `closeDislikeModal()` - Dislike modal

**Used In:**
- `App.tsx`
- `components/Player/Player.tsx`
- `components/Player/FullPlayer.tsx`
- `components/Sidebar/Sidebar.tsx`
- `components/Modals/DislikeModal.tsx`
- Many other components

**Persistence:** LocalStorage (`audiio-ui`) - sidebar state only

---

## settings-store

**File:** `settings-store.ts`

**Purpose:** Client-side playback and audio preferences. Media folders and downloads are managed server-side via library-store.

**Key State:**
- `crossfadeEnabled` / `crossfadeDuration` - Crossfade settings
- `normalizeVolume` - Volume normalization
- `downloadQuality` - Download quality preference
- `autoDownloadLikes` - Auto-download liked tracks

**Key Actions:**
- `setCrossfadeEnabled(enabled)` / `setCrossfadeDuration(duration)` - Crossfade
- `setNormalizeVolume(enabled)` - Normalization
- `setDownloadQuality(quality)` - Download quality
- `setAutoDownloadLikes(enabled)` - Auto-download toggle

**Used In:**
- `components/Settings/SettingsView.tsx`
- `components/Settings/StorageSettings.tsx`
- `components/Settings/AudioSettings.tsx`

**Persistence:** LocalStorage (`audiio-settings`)

---

## plugin-store

**File:** `plugin-store.ts`

**Purpose:** Manages installed plugins dynamically. No hardcoded plugins - everything comes from the backend.

**Key State:**
- `plugins` - All loaded plugins with metadata
- `pluginOrder` - Plugin priority order
- `pluginSettings` - Per-plugin settings
- `pluginEnabledStates` - Per-plugin enabled/disabled

**Key Actions:**
- `syncFromBackend()` - Fetch plugins from backend
- `togglePlugin(pluginId)` / `enablePlugin(pluginId)` / `disablePlugin(pluginId)` - Toggle state
- `getPlugin(pluginId)` - Get plugin by ID
- `getPluginsByRole(role)` - Get plugins with specific role
- `hasCapability(role)` - Check if capability is available
- `updatePluginSetting(pluginId, key, value)` - Update plugin setting
- `removePlugin(pluginId)` - Uninstall plugin
- `reorderPlugins(fromIndex, toIndex)` - Change plugin priority
- `getOrderedPlugins()` - Get plugins in priority order

**Plugin Roles:** `metadata-provider`, `stream-provider`, `lyrics-provider`, `scrobbler`, `audio-processor`, `tool`

**Used In:**
- `App.tsx`
- `components/Plugins/PluginsView.tsx`
- `components/Plugins/PluginDetailView.tsx`
- `hooks/usePluginData.ts`
- `hooks/usePluginAudioFeatures.ts`

**Persistence:** LocalStorage (`audiio-plugins`) - order, settings, enabled states only

---

## search-store

**File:** `search-store.ts`

**Purpose:** Manages search state with multi-type results, bang system for filtered search, and cross-page search.

**Key State:**
- `query` / `cleanQuery` - Search query
- `results` - Track, artist, album, and local results
- `scope` - Current search scope (from bang)
- `activeBang` - Active bang command
- `bangSuggestions` - Bang autocomplete
- `crossPageResults` - Results from playlists, collections, tags, etc.
- `parsedQuery` - NL-parsed query
- `smartSearch` - SmartSearch instance for local library
- `activeFilter` - 'all', 'tracks', 'artists', 'albums', 'local', 'lyrics'

**Bang System:**
- `!p` / `!playlist` - Search playlists
- `!c` / `!collection` - Search collections
- `!t` / `!tag` - Search tags
- `!a` / `!artist` - Search artists
- `!al` / `!album` - Search albums
- `!s` / `!song` - Search songs
- `!l` / `!liked` - Search liked songs
- `!d` / `!download` - Search downloads

**Key Actions:**
- `setQuery(query)` - Set query (triggers bang parsing)
- `search(query)` - Execute search
- `searchLocal(query, tracks)` - Search local library
- `updateLocalIndex(tracks)` - Update smart search index
- `searchCrossPage(query)` - Search playlists, collections, tags

**Used In:**
- `App.tsx`
- `components/Search/SearchBar.tsx`
- `components/Search/SearchDropdown.tsx`
- `components/Search/SearchResults.tsx`
- `components/Discover/Discover.tsx`
- Many other components

---

## navigation-store

**File:** `navigation-store.ts`

**Purpose:** Manages active view/page and navigation state.

**Key State:**
- `currentView` - Current view ('home', 'likes', 'playlists', 'artist-detail', etc.)
- `selectedPlaylistId` / `selectedCollectionId` / `selectedPluginId` - Selected item IDs
- `selectedArtistId` / `selectedAlbumId` / `selectedTagName` - Detail view selections
- `selectedArtistData` / `selectedAlbumData` - Cached data for detail views
- `selectedSectionData` - Section detail data
- `searchQuery` / `isSearchActive` - Search state
- `isPlaylistRulesEditorOpen` - Rules editor modal

**Key Actions:**
- `navigate(view)` - Navigate to view
- `navigateTo(view, params)` - Navigate with parameters
- `openPlaylist(playlistId)` / `openCollection(collectionId)` - Open detail views
- `openArtist(artistId, artistData)` / `openAlbum(albumId, albumData)` - Artist/album detail
- `openTagDetail(tagName)` / `openPlugin(pluginId)` - Other detail views
- `openSectionDetail(data)` - Open section "See All" view
- `goBack()` - Navigate back

**Used In:**
- `App.tsx`
- `components/Sidebar/Sidebar.tsx`
- `components/TitleBar/TitleBar.tsx`
- `components/Discover/Discover.tsx`
- Many other components

---

## stats-store

**File:** `stats-store.ts`

**Purpose:** Server-backed listening statistics. Sends tracking events to server and fetches stats for display.

**Key State:**
- `cachedStats` - Stats by period (week, month, year, all)
- `cacheTimestamp` - When cache was last updated
- `listenHistory` - Recent listen entries
- `skipStats` - Skip statistics

**Key Actions:**
- `recordListen(track, duration, completed, skipped)` - Record listen event
- `recordSkip(track, listenedDuration, totalDuration)` - Record skip
- `fetchStats(period)` - Fetch stats from server
- `getStats(period)` - Get cached stats (no fetch)
- `fetchListenHistory()` - Fetch recent history
- `clearHistory()` - Clear all history

**Stats Include:** Total listen time, track counts, top artists, top genres, daily stats, hourly distribution, day-of-week distribution, listening streaks

**Helper Functions:**
- `formatDuration(seconds)` - Format duration for display
- `formatDate(timestamp)` - Format date for display
- `getDayName(day)` - Get day name from index

**Used In:**
- `components/Stats/StatsView.tsx`
- `components/Stats/TopList.tsx`
- `components/Stats/charts/HeatMap.tsx`
- `hooks/useSkipTracking.ts`
- `hooks/useScrobbling.ts`

---

## recommendation-store

**File:** `recommendation-store.ts`

**Purpose:** Server-backed recommendation system. Provides access to user preferences, dislike tracking, and ML-based recommendations.

**Key State:**
- `dislikedTracks` - Map of disliked track IDs to dislike data
- `userProfile` - Cached user profile (artist/genre preferences, time patterns)
- `discoveryLayout` - Discovery page section layout
- `isLoading` / `lastFetched` / `error` - Fetch state

**Dislike Reasons:** Categories include track-specific, artist-specific, mood/context, quality/technical, content, and other.

**Key Actions:**
- `recordListen(track, duration, completed, skipped)` - Record listen event
- `recordDislike(track, reasons)` - Record dislike with reasons
- `recordSkip(trackId, data)` - Record skip event
- `removeDislike(trackId)` - Remove dislike
- `isDisliked(trackId)` / `getDislikeReasons(trackId)` - Query dislikes
- `calculateTrackScore(track, context)` - Get ML score
- `getRecommendedTracks(candidates, limit, context)` - Get recommendations
- `getTopGenres(limit)` / `getTopArtists(limit)` - Get user preferences
- `getPersonalizedQueries()` - Get personalized discovery queries
- `sortTracksByEnergy(tracks, direction)` - Sort by energy level
- `fetchUserProfile()` / `fetchDislikedTracks()` / `fetchDiscoveryLayout()` - Fetch data

**Exports:**
- `DISLIKE_REASONS` - All dislike reason options
- `DISLIKE_CATEGORIES` - Category labels
- `GENRE_ENERGY_MAP` - Genre to energy level mapping
- `calculateTrackMood(track)` - Calculate mood/energy for track

**Used In:**
- `App.tsx`
- `components/Discover/Discover.tsx`
- `components/Discover/sections/HeroSection.tsx`
- `components/Modals/DislikeModal.tsx`
- `hooks/useRecommendationExplanation.ts`
- `hooks/useSmartQueue.ts`
- `hooks/useSkipTracking.ts`

---

## smart-queue-store

**File:** `smart-queue-store.ts`

**Purpose:** Auto-queue and Radio Mode functionality. Automatically adds tracks when queue runs low, supports radio mode from seeds (track, artist, genre).

**Key State:**
- `mode` - 'manual', 'auto-queue', or 'radio'
- `radioSeed` - Current radio seed (track, artist, or genre)
- `radioTracksPlayed` - Tracks played in current radio session
- `sessionHistory` - Played tracks/artists for avoiding repetition
- `config` - Auto-queue configuration
- `radioConfig` - Radio mode configuration
- `queueSources` - Why each track was added (for "Playing because...")
- `isAutoQueueFetching` / `autoQueueError` - Fetch state

**Queue Source Types:** `manual`, `artist`, `album`, `genre`, `similar`, `radio`, `mood`, `discovery`, `trending`, `search`, `liked`, `playlist`, `ml`, `auto`

**Key Actions:**
- `enableAutoQueue()` / `disableAutoQueue()` / `toggleAutoQueue()` - Toggle auto-queue
- `startRadio(seed, availableTracks)` - Start radio from seed
- `stopRadio()` - Stop radio mode
- `checkAndReplenish(availableTracks)` - Check queue and add tracks if needed
- `fetchMoreTracks(availableTracks)` - Fetch tracks from server
- `recordTrackPlayed(track)` - Record track in session history
- `determineTrackSource(track, currentTrack)` - Determine why track was added
- `setQueueSource(trackId, source)` / `getQueueSource(trackId)` - Track source management

**Hooks:**
- `useQueueMode()` - Get current queue mode
- `useRadioState()` - Get radio state
- `useAutoQueueStatus()` - Get auto-queue status
- `useQueueSources()` - Get all queue sources
- `useTrackSource(trackId)` - Get source for specific track

**Exports:**
- `QUEUE_SOURCE_LEGEND` - Labels/colors for each source type

**Used In:**
- `App.tsx`
- `components/Queue/QueueView.tsx`
- `components/Queue/QueuePopover.tsx`
- `hooks/useSmartQueue.ts`

**Persistence:** LocalStorage (`audiio-smart-queue`) - config only, not session state
