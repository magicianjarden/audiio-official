/**
 * @audiio/core - Core types and orchestrators for Audiio
 */

// Types
export type {
  Artist,
  Album,
  ArtworkSet,
  AnimatedArtwork,
  Quality,
  StreamInfo,
  StreamSource,
  LyricsLine,
  LyricsResult,
  ExternalIds,
  UnifiedTrack,
  SearchQuery,
  SearchResult
} from './types/index';

export type {
  AudioFeatures,
  AudioData,
  AnalysisOptions,
  BpmResult,
  KeyResult,
  MusicalKey,
  MusicalMode,
  Chromagram,
  AudioFeaturesCacheEntry
} from './types/audio-features';

export type {
  AddonRole,
  AddonManifest,
  BaseAddon,
  MetadataTrack,
  MetadataSearchResult,
  MetadataSearchOptions,
  MetadataProvider,
  StreamTrack,
  StreamSearchOptions,
  StreamProvider,
  LyricsQuery,
  LyricsSearchOptions,
  LyricsProvider,
  ScrobblePayload,
  NowPlayingPayload,
  Scrobbler,
  DeezerProviderSettings,
  AppleMusicArtworkSettings,
  // Extended detail types
  ArtistDetail,
  AlbumDetail,
  AlbumCredits,
  // Trending & discovery types
  TrendingContent,
  Playlist,
  AlbumRelatedContent,
  ArtistFullContent,
  // Audio processor types
  AudioProcessorResult,
  AudioProcessor
} from './types/addon';

// Registry
export { AddonRegistry } from './registry/addon-registry';

// Orchestrators
export { SearchOrchestrator } from './orchestrators/search-orchestrator';
export { TrackResolver } from './orchestrators/track-resolver';
export {
  PlaybackOrchestrator,
  type PlaybackState,
  type PlaybackEvents
} from './orchestrators/playback-orchestrator';
export {
  MetadataOrchestrator,
  type ChartsResult
} from './orchestrators/metadata-orchestrator';

// Services
export { TrackMatcher } from './services/track-matcher';
export {
  MediaProcessor,
  getMediaProcessor,
  type HLSConversionOptions,
  type ConversionResult,
  type FFmpegProgress,
  type ProgressCallback
} from './services/media-processor';
export {
  AudioAnalyzer,
  getAudioAnalyzer
} from './services/audio-analyzer';

// Utils
export { EventEmitter } from './utils/event-emitter';
export { generateTrackId } from './utils/id-generator';
