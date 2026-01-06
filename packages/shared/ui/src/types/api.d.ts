import type { UnifiedTrack, StreamInfo, ArtistDetail, AlbumDetail, Album, Artist, TrendingContent, AudioFeatures, AnalysisOptions } from '@audiio/core';

interface AddonInfo {
  id: string;
  name: string;
  roles: string[];
  enabled: boolean;
}

interface AudioAnalyzerStatus {
  available: boolean;
  cacheSize: number;
}

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

// === ML Algorithm Types ===

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
  metrics?: {
    accuracy: number;
    loss: number;
  };
  trainingDuration?: number;
  samplesUsed?: number;
  modelVersion?: string;
}

interface MLAggregatedFeatures {
  trackId: string;
  audio?: {
    bpm?: number;
    key?: string;
    mode?: 'major' | 'minor';
    energy?: number;
    danceability?: number;
    valence?: number;
    acousticness?: number;
    instrumentalness?: number;
    loudness?: number;
    speechiness?: number;
    liveness?: number;
  };
  emotion?: {
    valence: number;
    arousal: number;
    moodCategory: string;
    moodConfidence: number;
  };
  lyrics?: {
    sentiment: number;
    sentimentConfidence: number;
    themes: Array<{ theme: string; confidence: number }>;
    language: string;
  };
  providers: Array<{
    providerId: string;
    providedFeatures: string[];
    confidence: number;
  }>;
  lastUpdated: number;
}

// === Natural Language Search Types ===

interface ParsedFilter {
  type: 'artist' | 'album' | 'genre' | 'year' | 'duration' | 'tag' | 'source' | 'rating' | 'decade';
  operator: 'is' | 'contains' | 'gt' | 'lt' | 'between' | 'not';
  value: string | number | [number, number];
}

interface AudioFeatureRange {
  min?: number;
  max?: number;
}

interface ParsedQuery {
  text: string;
  filters: ParsedFilter[];
  audioFeatures?: {
    energy?: AudioFeatureRange;
    tempo?: AudioFeatureRange;
    valence?: AudioFeatureRange;
    danceability?: AudioFeatureRange;
    acousticness?: AudioFeatureRange;
    instrumentalness?: AudioFeatureRange;
  };
  playBehavior?: {
    minPlays?: number;
    maxPlays?: number;
    playedWithinDays?: number;
    neverPlayed?: boolean;
  };
  similarity?: {
    trackId?: string;
    artistName?: string;
  };
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
  resultCount?: number;
}

interface AudioFilterState {
  energyMin?: number;
  energyMax?: number;
  tempoMin?: number;
  tempoMax?: number;
  valenceMin?: number;
  valenceMax?: number;
  danceabilityMin?: number;
  danceabilityMax?: number;
  acousticnessMin?: number;
  acousticnessMax?: number;
  neverPlayed?: boolean;
  likedOnly?: boolean;
  yearMin?: number;
  yearMax?: number;
  mood?: string;
}

// === Audio Feature Index Types ===

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

// === Integration Types ===

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

interface SpotifyImportStatus {
  isConfigured: boolean;
  isAuthenticated: boolean;
}

interface SpotifyPlaylistInfo {
  id: string;
  name: string;
  description: string | null;
  images: Array<{ url: string; width: number; height: number }>;
  owner: { id: string; display_name: string };
  tracks: { total: number };
  public: boolean;
}

interface SpotifyImportResult {
  playlist?: {
    name: string;
    description?: string;
    trackCount: number;
  };
  tracks: Array<{
    title: string;
    artist: string;
    album: string;
    duration: number;
    isrc?: string;
    spotifyId: string;
    popularity: number;
    artwork?: string;
  }>;
  matched: number;
  unmatched: number;
}

// Import new type definitions (these will be available after build)
// For now, inline the key response types for Window.api

// === Tags Namespace Types ===
interface TagsAPI {
  getAll: () => Promise<{ tags: Array<{ id: string; name: string; color: string; usageCount: number; createdAt: number }> }>;
  create: (name: string, color?: string) => Promise<{ success: boolean; tag?: { id: string; name: string; color: string; usageCount: number; createdAt: number } }>;
  update: (tagId: string, data: { name?: string; color?: string }) => Promise<{ success: boolean }>;
  delete: (tagId: string) => Promise<{ success: boolean }>;
  getTrackTags: (trackId: string) => Promise<{ tags: Array<{ id: string; trackId: string; tagName: string; color?: string; createdAt: number }> }>;
  addToTrack: (trackId: string, tags: string[]) => Promise<{ success: boolean; trackTag?: { id: string; trackId: string; tagName: string; createdAt: number } }>;
  removeFromTrack: (trackId: string, tagName: string) => Promise<{ success: boolean }>;
  getTracksByTag: (tagName: string) => Promise<{ trackIds: string[] }>;
  getEntityTags: (entityType: string, entityId: string) => Promise<{ tags: Array<{ id: string; entityType: string; entityId: string; tagName: string; createdAt: number }> }>;
  addToEntity: (entityType: string, entityId: string, tags: string[]) => Promise<{ success: boolean; entityTag?: unknown }>;
  removeFromEntity: (entityType: string, entityId: string, tagName: string) => Promise<{ success: boolean }>;
}

// === Collections Namespace Types ===
interface CollectionsAPI {
  getAll: () => Promise<{ collections: Array<{ id: string; name: string; description?: string; coverImage?: string; itemCount: number; position: number; createdAt: number; updatedAt: number }> }>;
  get: (collectionId: string) => Promise<{ id: string; name: string; items: unknown[] } | null>;
  create: (data: { name: string; description?: string; color?: string; icon?: string }) => Promise<{ success: boolean; collection?: unknown }>;
  update: (collectionId: string, data: { name?: string; description?: string; coverImage?: string }) => Promise<{ success: boolean }>;
  delete: (collectionId: string) => Promise<{ success: boolean }>;
  addItem: (collectionId: string, item: { type: string; id: string; data?: Record<string, unknown> }) => Promise<{ success: boolean; item?: unknown }>;
  removeItem: (collectionId: string, itemId: string) => Promise<{ success: boolean }>;
  reorderItems: (collectionId: string, itemIds: string[]) => Promise<{ success: boolean }>;
  reorder: (collectionIds: string[]) => Promise<{ success: boolean }>;
  moveItem: (collectionId: string, itemId: string, targetFolderId: string | null) => Promise<{ success: boolean }>;
  createFolder: (collectionId: string, name: string, parentFolderId?: string | null) => Promise<{ success: boolean; item?: unknown }>;
  updateFolder: (collectionId: string, folderId: string, data: { name?: string }) => Promise<{ success: boolean }>;
  deleteFolder: (collectionId: string, folderId: string, moveContentsToParent?: boolean) => Promise<{ success: boolean }>;
}

// === Pinned Items Namespace Types ===
interface PinnedAPI {
  getAll: () => Promise<{ items: Array<{ id: string; itemType: string; itemId: string; itemData: Record<string, unknown>; position: number; pinnedAt: number }> }>;
  add: (itemType: string, itemId: string, data?: Record<string, unknown>) => Promise<{ success: boolean; item?: unknown }>;
  remove: (itemType: string, itemId: string) => Promise<{ success: boolean }>;
  check: (itemType: string, itemId: string) => Promise<{ pinned: boolean }>;
  reorder: (items: Array<{ itemType: string; itemId: string }>) => Promise<{ success: boolean }>;
}

// === Library Views Namespace Types ===
interface LibraryViewsAPI {
  getAll: () => Promise<{ views: Array<{ id: string; name: string; icon?: string; filters: Record<string, unknown>; sortBy?: string; sortOrder?: string; isBuiltIn: boolean; createdAt: number }> }>;
  get: (viewId: string) => Promise<unknown | null>;
  create: (data: { name: string; type?: string; filters?: Record<string, unknown>; sortBy?: string; sortOrder?: string }) => Promise<{ success: boolean; view?: unknown }>;
  update: (viewId: string, data: { name?: string; filters?: Record<string, unknown>; sortBy?: string; sortOrder?: string }) => Promise<{ success: boolean }>;
  delete: (viewId: string) => Promise<{ success: boolean }>;
}

// === Audio Features Namespace Types ===
interface AudioFeaturesAPI {
  get: (trackId: string) => Promise<AudioFeatureData | null>;
  query: (query: AudioFilterState) => Promise<{ tracks: UnifiedTrack[]; total: number }>;
  getSimilar: (trackId: string, count: number) => Promise<{ tracks: UnifiedTrack[] }>;
  getDistributions: () => Promise<Record<string, FeatureDistribution>>;
  getMoods: () => Promise<{ moods: string[] }>;
  getMoodClusters: (mood?: string) => Promise<{ clusters: MoodCluster[] }>;
  getTrackMood: (trackId: string) => Promise<{ trackId: string; mood: string } | null>;
  getStats: () => Promise<{ analyzedCount: number; unanalyzedSample: UnifiedTrack[] }>;
  save: (trackId: string, features: unknown) => Promise<{ success: boolean }>;
  search: (criteria: unknown) => Promise<{ trackIds: string[] }>;
}

// === NLP Search Namespace Types ===
interface NLPSearchAPI {
  natural: (query: string) => Promise<NaturalSearchResult>;
  advanced: (params: { query?: string; artist?: string; album?: string; genre?: string; mood?: string; decade?: string; tags?: string[]; limit?: number; offset?: number }) => Promise<{ tracks: UnifiedTrack[]; total: number }>;
  suggestions: (prefix: string) => Promise<SearchSuggestions>;
  getHistory: () => Promise<{ searches: SearchHistoryEntry[] }>;
  deleteHistoryItem: (id: string) => Promise<{ success: boolean }>;
  clearHistory: () => Promise<{ success: boolean }>;
}

// === Embedding Namespace Types ===
interface EmbeddingAPI {
  get: (trackId: string) => Promise<{ embedding: number[]; trackId: string } | null>;
  findSimilar: (embedding: number[], count: number) => Promise<{ tracks: Array<{ trackId: string; similarity: number }> }>;
}

// === Smart Playlists Namespace Types ===
interface SmartPlaylistsAPI {
  getAll: () => Promise<{ playlists: unknown[] }>;
  get: (playlistId: string) => Promise<unknown | null>;
  create: (data: { name: string; description?: string; rules: unknown[]; combinator?: string; orderBy?: string; orderDirection?: string; limit?: number }) => Promise<{ success: boolean; playlist?: unknown }>;
  update: (playlistId: string, data: unknown) => Promise<{ success: boolean }>;
  delete: (playlistId: string) => Promise<{ success: boolean }>;
  getTracks: (playlistId: string) => Promise<{ playlistId: string; trackIds: string[]; count: number }>;
  preview: (options: { rules: unknown[]; combinator?: string; orderBy?: string; orderDirection?: string; limit?: number }) => Promise<{ tracks: UnifiedTrack[]; count: number }>;
  getRules: () => Promise<{ rules: unknown[] }>;
}

// === Library Folders Namespace Types ===
interface LibraryFoldersAPI {
  getAll: () => Promise<{ folders: unknown[] }>;
  create: (data: { name: string; parentId?: string }) => Promise<{ success: boolean; folder?: unknown }>;
  update: (folderId: string, data: { name?: string }) => Promise<{ success: boolean }>;
  delete: (folderId: string) => Promise<{ success: boolean }>;
  movePlaylist: (playlistId: string, folderId: string | null) => Promise<{ success: boolean }>;
}

// === Library Stats Namespace Types ===
interface LibraryStatsAPI {
  get: () => Promise<{ trackCount: number; artistCount: number; albumCount: number; playlistCount: number; totalDuration: number }>;
  getTrackStats: (trackId: string) => Promise<{ trackId: string; playCount: number; skipCount: number; totalListenTime: number }>;
  getMostPlayed: (limit: number) => Promise<{ tracks: unknown[] }>;
}

// === Tracking Sessions Namespace Types ===
interface TrackingSessionsAPI {
  start: (data?: { context?: string }) => Promise<{ success: boolean; session?: unknown }>;
  end: (sessionId: string) => Promise<{ summary: unknown }>;
  get: (sessionId: string) => Promise<unknown | null>;
  list: (limit?: number) => Promise<{ sessions: unknown[] }>;
  getEvents: (options?: { type?: string; trackId?: string; sessionId?: string; limit?: number; offset?: number }) => Promise<{ events: unknown[] }>;
}

// === Discover Extended Namespace Types ===
interface DiscoverExtendedAPI {
  getGenres: () => Promise<{ genres: unknown[] }>;
  getGenre: (genreId: string) => Promise<{ tracks: UnifiedTrack[] }>;
  getRadio: (trackId: string) => Promise<{ tracks: UnifiedTrack[] }>;
  getSections: () => Promise<{ sections: unknown[] }>;
  getLayout: () => Promise<{ sections: unknown[] }>;
}

// === Plugin Management Namespace Types ===
interface PluginManagementAPI {
  getRepositories: () => Promise<{ repositories: unknown[] }>;
  addRepository: (url: string) => Promise<{ success: boolean }>;
  removeRepository: (repoId: string) => Promise<{ success: boolean }>;
  refreshRepository: (repoId: string) => Promise<{ success: boolean }>;
  getAvailable: () => Promise<{ plugins: unknown[] }>;
  search: (query: string) => Promise<{ plugins: unknown[] }>;
  install: (source: string, type?: 'npm' | 'git' | 'local') => Promise<{ success: boolean; plugin?: unknown }>;
  uninstall: (pluginId: string) => Promise<{ success: boolean }>;
  getUpdates: () => Promise<{ updates: unknown[] }>;
  getRoutes: () => Promise<{ routes: unknown[] }>;
  setEnabled: (addonId: string, enabled: boolean) => Promise<{ success: boolean }>;
}

// === Server Settings Namespace Types ===
interface ServerSettingsAPI {
  get: () => Promise<{ name: string; serverId: string }>;
  update: (settings: unknown) => Promise<{ success: boolean }>;
}

// === Logs Namespace Types ===
interface LogsAPI {
  get: (options?: { level?: string; limit?: number; since?: number }) => Promise<{ logs: unknown[]; stats?: unknown }>;
  clear: () => Promise<{ success: boolean }>;
}

// === Auth Namespace Types ===
interface AuthAPI {
  getIdentity: () => Promise<{ serverId: string; serverName: string; publicKey: string }>;
  getDevices: () => Promise<{ devices: unknown[] }>;
  removeDevice: (deviceId: string) => Promise<{ success: boolean }>;
  updateDevice: (deviceId: string, data: { name?: string; trusted?: boolean }) => Promise<{ success: boolean }>;
}

// === Setup Namespace Types ===
interface SetupAPI {
  getStatus: () => Promise<{ completed: boolean; serverName?: string }>;
  complete: () => Promise<{ success: boolean }>;
}

// === Debug Namespace Types ===
interface DebugAPI {
  getPersistence: () => Promise<{ timestamp: number; library: unknown; ml: unknown }>;
}

// === Enrichment Namespace Types ===
interface EnrichmentAPI {
  getAvailableTypes: () => Promise<{ types: string[] }>;
  getVideos: (artistName: string, limit?: number) => Promise<{ success: boolean; data: unknown[]; source: string }>;
  getAlbumVideos: (albumTitle: string, artistName: string, trackNames?: string[], limit?: number) => Promise<{ success: boolean; data: unknown[]; source: string }>;
  getVideoStream: (videoId: string, source: string, preferredQuality?: string) => Promise<{ success: boolean; data: unknown; source: string }>;
  getTimeline: (artistName: string) => Promise<{ success: boolean; data: unknown[]; source: string }>;
  getSetlists: (artistName: string, mbid?: string, limit?: number) => Promise<{ success: boolean; data: unknown[]; source: string }>;
  getConcerts: (artistName: string) => Promise<{ success: boolean; data: unknown[]; source: string }>;
  getGallery: (mbid?: string, artistName?: string) => Promise<{ success: boolean; data: unknown; source: string }>;
  getMerchandise: (artistName: string) => Promise<{ success: boolean; data: unknown; source: string }>;
}

// === Connection Namespace Types ===
interface ConnectionAPI {
  getState: () => Promise<{ state: 'disconnected' | 'connecting' | 'connected' | 'error'; serverUrl?: string; error?: string }>;
  connect: (serverUrl: string, token?: string) => Promise<{ success: boolean }>;
  disconnect: () => Promise<{ success: boolean }>;
  getSavedServer: () => Promise<{ url: string; serverId: string; serverName: string } | null>;
  onStateChange: (callback: (state: unknown) => void) => () => void;
}

// === Discovery Namespace Types ===
interface DiscoveryAPI {
  getServers: () => Promise<{ servers: unknown[] }>;
  startBrowsing: () => Promise<{ success: boolean }>;
  stopBrowsing: () => Promise<{ success: boolean }>;
  onServerFound: (callback: (server: unknown) => void) => () => void;
  onServerLost: (callback: (serverId: string) => void) => () => void;
}

// === Library Capabilities Namespace Types ===
interface LibraryCapabilitiesAPI {
  get: () => Promise<Record<string, { available: boolean; providers: string[] }>>;
  getImportProviders: () => Promise<{ providers: unknown[] }>;
  getExportFormats: () => Promise<{ formats: unknown[] }>;
}

// === Scrobble Namespace Types (existing but updated) ===
interface ScrobbleAPI {
  submit: (pluginId: string, data: { title: string; artist: string; album?: string; duration: number; timestamp: number; playedMs: number }) => Promise<{ success: boolean }>;
  updateNowPlaying: (pluginId: string, data: { title: string; artist: string; album?: string; duration: number }) => Promise<{ success: boolean }>;
}

declare global {
  interface Window {
    api?: {
      // === NEW TYPED NAMESPACES ===
      tags: TagsAPI;
      collections: CollectionsAPI;
      pinned: PinnedAPI;
      libraryViews: LibraryViewsAPI;
      audioFeatures: AudioFeaturesAPI;
      nlpSearch: NLPSearchAPI;
      embedding: EmbeddingAPI;
      smartPlaylists: SmartPlaylistsAPI;
      libraryFolders: LibraryFoldersAPI;
      libraryStats: LibraryStatsAPI;
      trackingSessions: TrackingSessionsAPI;
      discoverExtended: DiscoverExtendedAPI;
      pluginManagement: PluginManagementAPI;
      serverSettings: ServerSettingsAPI;
      logs: LogsAPI;
      auth: AuthAPI;
      setup: SetupAPI;
      debug: DebugAPI;
      enrichment: EnrichmentAPI;
      connection: ConnectionAPI;
      discovery: DiscoveryAPI;
      libraryCapabilities: LibraryCapabilitiesAPI;
      scrobble: ScrobbleAPI;

      // === LEGACY TOP-LEVEL METHODS (kept for compatibility) ===

      // Search
      search: (query: { query: string; type?: string }) => Promise<UnifiedTrack[]>;

      // Playback
      playTrack: (track: UnifiedTrack) => Promise<StreamInfo>;
      pause: () => Promise<void>;
      resume: () => Promise<void>;
      seek: (position: number) => Promise<void>;
      downloadTrack?: (track: UnifiedTrack) => Promise<DownloadResult>;
      downloadTrack?: (track: UnifiedTrack) => Promise<DownloadResult>;
      onDownloadProgress?: (callback: (event: DownloadProgressEvent) => void) => () => void;

      // Window Controls
      windowMinimize: () => Promise<void>;
      windowMaximize: () => Promise<void>;
      windowClose: () => Promise<void>;
      windowIsMaximized: () => Promise<boolean>;
      onWindowMaximizedChange: (callback: (isMaximized: boolean) => void) => () => void;
      getPlatform: () => Promise<string>;

      // Plugin management
      getAddons?: () => Promise<AddonInfo[]>;
      setAddonEnabled?: (addonId: string, enabled: boolean) => Promise<{ success: boolean; addonId: string; enabled: boolean }>;
      updateAddonSettings?: (addonId: string, settings: Record<string, unknown>) => Promise<{ success: boolean; addonId: string; settings?: Record<string, unknown>; error?: string }>;
      getAddonSettings?: (addonId: string) => Promise<Record<string, unknown> | null>;

      // Artist and Album details
      getArtist?: (id: string, source?: string) => Promise<ArtistDetail | null>;
      getAlbum?: (id: string, source?: string) => Promise<AlbumDetail | null>;

      // Discovery & Trending
      getTrending?: () => Promise<TrendingContent>;
      getSimilarAlbums?: (albumId: string, source?: string) => Promise<Album[]>;
      getSimilarTracks?: (params: { trackId: string; limit?: number }) => Promise<UnifiedTrack[]>;
      prefetchTracks?: (tracks: UnifiedTrack[]) => Promise<Record<string, StreamInfo | null>>;
      getArtistLatestRelease?: (artistId: string, source?: string) => Promise<Album | null>;
      getRecommendedTracks?: (basedOn: 'artist' | 'genre', id: string) => Promise<UnifiedTrack[]>;
      getArtistRadio?: (params: { artistId: string; limit?: number }) => Promise<UnifiedTrack[]>;
      getNewReleases?: (params?: { genre?: string; limit?: number }) => Promise<UnifiedTrack[]>;

      // Audio Analysis
      // Accepts optional track object for stream resolution via plugins
      getAudioFeatures?: (trackId: string, streamUrl?: string, track?: UnifiedTrack) => Promise<AudioFeatures | null>;
      analyzeAudioFile?: (filePath: string, options?: AnalysisOptions) => Promise<AudioFeatures | null>;
      analyzeAudioUrl?: (url: string, options?: AnalysisOptions) => Promise<AudioFeatures | null>;
      setAudioFeatures?: (trackId: string, features: AudioFeatures) => Promise<{ success: boolean }>;
      getCachedAudioFeatures?: (trackIds: string[]) => Promise<Record<string, AudioFeatures | null>>;
      clearAudioFeaturesCache?: () => Promise<{ success: boolean }>;
      checkAudioAnalyzer?: () => Promise<AudioAnalyzerStatus>;

      playerGetLastState?: () => Promise<{ success: boolean; state?: { track: any; position: number } }>;

      // === ML Algorithm APIs ===

      // Score a single track using ML algorithm
      algoScoreTrack?: (trackId: string) => Promise<MLTrackScore | null>;

      // Score multiple tracks
      algoScoreBatch?: (trackIds: string[]) => Promise<MLTrackScore[]>;

      // Get personalized recommendations
      algoGetRecommendations?: (count: number, mode?: string) => Promise<UnifiedTrack[]>;

      // Get similar tracks using ML embeddings
      algoGetSimilar?: (trackId: string, count: number) => Promise<UnifiedTrack[]>;

      // Get artist radio using ML
      algoGetArtistRadio?: (artistId: string, count: number) => Promise<UnifiedTrack[]>;

      // Get genre/mood radio using ML
      algoGetGenreRadio?: (genre: string, count: number) => Promise<UnifiedTrack[]>;

      // Get track radio using ML
      algoGetRadio?: (seedTrackId: string, count: number) => Promise<UnifiedTrack[]>;

      // Get ML-computed audio features
      algoGetFeatures?: (trackId: string) => Promise<MLAggregatedFeatures | null>;

      // Trigger model training
      algoTrain?: () => Promise<MLTrainingResult | null>;

      // Get training status
      algoTrainingStatus?: () => Promise<MLTrainingStatus>;

      // Record user event for learning
      algoRecordEvent?: (event: unknown) => Promise<{ success: boolean }>;

      // Check if ML algorithm is loaded
      isAddonLoaded?: (addonId: string) => Promise<boolean>;

      // Lyrics API
      lyrics?: {
        /** Check if any lyrics provider is available */
        isAvailable: () => Promise<boolean>;
        /** Search for lyrics */
        search: (artist: string, track: string, album?: string) => Promise<{
          syncedLyrics?: string;
          plainLyrics?: string;
        } | null>;
      };

      // Plugin system
      plugins?: {
        /** Get list of loaded plugins */
        getLoadedPlugins: () => Promise<Array<{
          id: string;
          name: string;
          version: string;
          roles: string[];
          source: 'npm' | 'local' | 'user';
        }>>;
        /** Check if a specific plugin role is available */
        hasRole: (role: string) => Promise<boolean>;
        /** Reload all plugins */
        reloadPlugins: () => Promise<void>;
        /** Listen for plugin UI registration */
        onPluginUIRegistered?: (callback: (registration: unknown) => void) => () => void;
      };

      // Karaoke API (vocal removal)
      karaoke?: {
        isAvailable: () => Promise<boolean>;
        processTrack: (trackId: string, audioUrl: string) => Promise<{
          success: boolean;
          instrumentalUrl?: string;
          error?: string;
        }>;
        getCached: (trackId: string) => Promise<{
          success: boolean;
          instrumentalUrl?: string;
        } | null>;
        onAvailabilityChange: (callback: (event: { available: boolean }) => void) => () => void;
        onFullTrackReady?: (callback: (event: { trackId: string; result: unknown }) => void) => () => void;
      };

      // Update algorithm settings
      algoUpdateSettings?: (settings: Record<string, unknown>) => Promise<{ success: boolean }>;

      // Get algorithm settings
      algoGetSettings?: () => Promise<Record<string, unknown>>;

      // Discovery Layout
      getDiscoveryLayout?: () => Promise<{ sections: any[] }>;

      // User Profile & Preferences
      algoGetProfile?: () => Promise<any>;

      // Tracking
      trackEvent?: (event: any) => Promise<void>;

      // Stats
      getStats?: (period: 'week' | 'month' | 'year' | 'all') => Promise<any>;
      clearStats?: () => Promise<boolean>;
      getListenHistory?: (limit?: number) => Promise<{ entries: any[] }>;

      // Dislikes
      dislikeTrack?: (track: UnifiedTrack, reasons: any[]) => Promise<void>;
      removeDislike?: (trackId: string) => Promise<void>;
      getDislikedTracks?: () => Promise<{ tracks: any[] }>;

      // Likes
      getLikedTracks?: () => Promise<{ tracks: any[] }>;
      likeTrack?: (track: UnifiedTrack) => Promise<{ success: boolean }>;
      unlikeTrack?: (trackId: string) => Promise<{ success: boolean }>;
      isTrackLiked?: (trackId: string) => Promise<boolean>;

      // Playlists
      getPlaylists?: () => Promise<{ playlists: any[] }>;
      getPlaylist?: (playlistId: string) => Promise<any | null>;
      createPlaylist?: (name: string, description?: string) => Promise<any | null>;
      deletePlaylist?: (playlistId: string) => Promise<{ success: boolean }>;
      renamePlaylist?: (playlistId: string, name: string) => Promise<{ success: boolean }>;
      addToPlaylist?: (playlistId: string, track: UnifiedTrack) => Promise<{ success: boolean }>;
      removeFromPlaylist?: (playlistId: string, trackId: string) => Promise<{ success: boolean }>;

      // === Advanced Search API ===
      advancedSearch?: {
        /** Natural language search */
        natural: (query: string) => Promise<NaturalSearchResult>;
        /** Advanced search with explicit filters */
        advanced: (params: {
          q?: string;
          artist?: string;
          album?: string;
          genre?: string;
          yearMin?: number;
          yearMax?: number;
          durationMin?: number;
          durationMax?: number;
          tags?: string[];
          source?: string;
          sortBy?: string;
          sortDir?: 'asc' | 'desc';
          limit?: number;
          offset?: number;
        }) => Promise<{ tracks: UnifiedTrack[]; total: number }>;
        /** Get search suggestions */
        suggestions: (prefix: string, limit?: number) => Promise<SearchSuggestions>;
        /** Get search history */
        getHistory: (limit?: number) => Promise<SearchHistoryEntry[]>;
        /** Delete a search history entry */
        deleteHistory: (id: string) => Promise<{ success: boolean }>;
        /** Clear all search history */
        clearHistory: () => Promise<{ success: boolean }>;
      };

      // === Audio Feature Index API ===
      audioFeatureIndex?: {
        /** Get audio features for a track */
        get: (trackId: string) => Promise<AudioFeatureData | null>;
        /** Query tracks by feature ranges */
        query: (criteria: {
          energyMin?: number;
          energyMax?: number;
          tempoMin?: number;
          tempoMax?: number;
          valenceMin?: number;
          valenceMax?: number;
          danceabilityMin?: number;
          danceabilityMax?: number;
          acousticnessMin?: number;
          acousticnessMax?: number;
          instrumentalnessMin?: number;
          instrumentalnessMax?: number;
        }, limit?: number, offset?: number) => Promise<{ tracks: UnifiedTrack[]; total: number }>;
        /** Find similar tracks by audio features */
        findSimilar: (trackId: string, limit?: number) => Promise<{ tracks: UnifiedTrack[] }>;
        /** Get feature distributions */
        getDistributions: () => Promise<Record<string, FeatureDistribution>>;
        /** Get available moods */
        getMoods: () => Promise<Array<{ name: string; description: string }>>;
        /** Get mood clusters with tracks */
        getMoodClusters: (includeTracks?: boolean, trackLimit?: number) => Promise<MoodCluster[]>;
        /** Get mood for a specific track */
        getTrackMood: (trackId: string) => Promise<{ trackId: string; mood: string } | null>;
        /** Get analysis stats */
        getStats: () => Promise<{ analyzedCount: number; unanalyzedSample: string[] }>;
      };

      // === ListenBrainz Integration ===
      listenbrainz?: {
        /** Set authentication token */
        setToken: (token: string) => Promise<{ success: boolean; username?: string; error?: string }>;
        /** Validate current token */
        validateToken: () => Promise<{ valid: boolean; username?: string; error?: string }>;
        /** Get connection status */
        getStatus: () => Promise<ListenBrainzStatus>;
        /** Disconnect (clear token) */
        disconnect: () => Promise<{ success: boolean }>;
        /** Scrobble a track */
        scrobble: (track: UnifiedTrack, playedDuration: number, timestamp?: number) => Promise<{ success: boolean }>;
        /** Update now playing */
        updateNowPlaying: (track: UnifiedTrack) => Promise<{ success: boolean }>;
        /** Submit feedback (love/hate) */
        submitFeedback: (recordingMbid: string, score: 1 | -1 | 0) => Promise<{ success: boolean }>;
        /** Import listening history */
        importListens: (maxCount?: number) => Promise<{
          tracks: Array<{ title: string; artist: string; album?: string; playedAt: Date; mbid?: string }>;
          error?: string;
        }>;
        /** Import loved tracks */
        importLovedTracks: (maxCount?: number) => Promise<{
          tracks: Array<{ title: string; artist: string; album?: string; mbid?: string }>;
          error?: string;
        }>;
        /** Get user statistics */
        getUserStats: (range?: 'week' | 'month' | 'year' | 'all_time') => Promise<ListenBrainzStats | null>;
      };

      // === Spotify Import Integration ===
      spotifyImport?: {
        /** Configure OAuth credentials */
        configure: (clientId: string, clientSecret: string, redirectUri: string) => Promise<{ success: boolean }>;
        /** Get OAuth URL for authentication */
        getAuthUrl: () => Promise<{ url: string | null }>;
        /** Handle OAuth callback */
        handleCallback: (code: string) => Promise<{ success: boolean }>;
        /** Get connection status */
        getStatus: () => Promise<SpotifyImportStatus>;
        /** Disconnect (clear tokens) */
        disconnect: () => Promise<{ success: boolean }>;
        /** Get user's playlists */
        getPlaylists: () => Promise<SpotifyPlaylistInfo[]>;
        /** Import a specific playlist */
        importPlaylist: (playlistId: string) => Promise<SpotifyImportResult>;
        /** Import liked songs */
        importLikedSongs: (maxCount?: number) => Promise<SpotifyImportResult>;
        /** Get followed artists */
        getFollowedArtists: () => Promise<Array<{ id: string; name: string; genres: string[] }>>;
      };
    };
  }
}

export { };
