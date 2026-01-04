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

declare global {
  interface Window {
    api?: {
      // Search
      search: (query: { query: string; type?: string }) => Promise<UnifiedTrack[]>;

      // Playback
      playTrack: (track: UnifiedTrack) => Promise<StreamInfo>;
      pause: () => Promise<void>;
      resume: () => Promise<void>;
      seek: (position: number) => Promise<void>;
      downloadTrack?: (track: UnifiedTrack) => Promise<DownloadResult>;
      onDownloadProgress?: (callback: (event: DownloadProgressEvent) => void) => () => void;

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
      getSimilarTracks?: (trackId: string, source?: string) => Promise<UnifiedTrack[]>;
      prefetchTracks?: (tracks: UnifiedTrack[]) => Promise<Record<string, StreamInfo | null>>;
      getArtistLatestRelease?: (artistId: string, source?: string) => Promise<Album | null>;
      getRecommendedTracks?: (basedOn: 'artist' | 'genre', id: string) => Promise<UnifiedTrack[]>;

      // Audio Analysis
      // Accepts optional track object for stream resolution via plugins
      getAudioFeatures?: (trackId: string, streamUrl?: string, track?: UnifiedTrack) => Promise<AudioFeatures | null>;
      analyzeAudioFile?: (filePath: string, options?: AnalysisOptions) => Promise<AudioFeatures | null>;
      analyzeAudioUrl?: (url: string, options?: AnalysisOptions) => Promise<AudioFeatures | null>;
      setAudioFeatures?: (trackId: string, features: AudioFeatures) => Promise<{ success: boolean }>;
      getCachedAudioFeatures?: (trackIds: string[]) => Promise<Record<string, AudioFeatures | null>>;
      clearAudioFeaturesCache?: () => Promise<{ success: boolean }>;
      checkAudioAnalyzer?: () => Promise<AudioAnalyzerStatus>;

      // === ML Algorithm APIs ===

      // Score a single track using ML algorithm
      algoScoreTrack?: (trackId: string) => Promise<MLTrackScore | null>;

      // Score multiple tracks
      algoScoreBatch?: (trackIds: string[]) => Promise<MLTrackScore[]>;

      // Get personalized recommendations
      algoGetRecommendations?: (count: number) => Promise<string[]>;

      // Get similar tracks using ML embeddings
      algoGetSimilar?: (trackId: string, count: number) => Promise<string[]>;

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
    };
  }
}

export {};
