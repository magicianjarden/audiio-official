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
      getArtistLatestRelease?: (artistId: string, source?: string) => Promise<Album | null>;
      getRecommendedTracks?: (basedOn: 'artist' | 'genre', id: string) => Promise<UnifiedTrack[]>;

      // Audio Analysis
      getAudioFeatures?: (trackId: string, streamUrl?: string) => Promise<AudioFeatures | null>;
      analyzeAudioFile?: (filePath: string, options?: AnalysisOptions) => Promise<AudioFeatures | null>;
      analyzeAudioUrl?: (url: string, options?: AnalysisOptions) => Promise<AudioFeatures | null>;
      setAudioFeatures?: (trackId: string, features: AudioFeatures) => Promise<{ success: boolean }>;
      getCachedAudioFeatures?: (trackIds: string[]) => Promise<Record<string, AudioFeatures | null>>;
      clearAudioFeaturesCache?: () => Promise<{ success: boolean }>;
      checkAudioAnalyzer?: () => Promise<AudioAnalyzerStatus>;
    };
  }
}

export {};
