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

// Mood and emotion types
export type {
  EmotionCategory,
  MoodType
} from './types/mood';
export {
  EMOTION_CATEGORIES,
  MOOD_TYPES
} from './types/mood';

// Pipeline types (for plugin Discover integrations)
export type {
  QueryStrategy,
  EmbeddingMethod,
  EmbeddingContext,
  SearchContext,
  StructuredSectionQuery,
  PipelineContext,
  ResultTransformer,
  DataProvider,
  QueryEnhancer,
  PipelineResult,
  PipelineConfig,
  PipelineRegistrationOptions,
  PluginPipelineAPI
} from './types/pipeline';

export type {
  // Settings schema types
  SettingsFieldType,
  SettingsSchemaItem,
  // Privacy manifest types
  PrivacyDataCategory,
  PrivacyDataUsage,
  PrivacyNetworkAccess,
  PrivacyDataAccess,
  PrivacyManifest,
  // Addon base types
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
  // Extended detail types
  ArtistDetail,
  AlbumDetail,
  AlbumCredits,
  // Trending & discovery types
  TrendingContent,
  Playlist,
  // Audio processor types
  AudioProcessorResult,
  AudioProcessor,
  // Tool types
  ToolType,
  PluginUIRegistry,
  Tool,
  // Artist enrichment types
  MusicVideo,
  VideoStreamInfo,
  TimelineEntry,
  Concert,
  Setlist,
  ArtistImages,
  ArtistEnrichmentType,
  ArtistEnrichmentData,
  ArtistEnrichmentProvider,
  // Library management types - Metadata Enricher
  MetadataEnrichmentResult,
  MetadataEnrichmentQuery,
  MetadataEnricher,
  // Library management types - Artwork Provider
  ArtworkResult,
  ArtworkProvider,
  // Library management types - Fingerprint Provider
  FingerprintResult,
  FingerprintProvider,
  // Library management types - ISRC Resolver
  ISRCLookupResult,
  ISRCResolver,
  // Library management types - Analytics Provider
  TrackAnalytics,
  ArtistAnalytics,
  AnalyticsProvider,
  // Library management types - Smart Playlist Rules
  SmartPlaylistRule,
  SmartPlaylistRuleDefinition,
  SmartPlaylistRulesProvider,
  // Library management types - Duplicate Detector
  DuplicateCandidate,
  DuplicateDetector,
  // Library management types - Import/Export
  ImportSource,
  ImportResult,
  ImportProvider,
  ExportFormat,
  ExportProvider,
  // Library management types - Library Hook
  LibraryEventType,
  LibraryEvent,
  LibraryHook,
  // Search provider types
  SearchResultType,
  SearchProviderOptions,
  SearchProviderResults,
  SearchProvider
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
  AudioAnalyzer,
  getAudioAnalyzer
} from './services/audio-analyzer';

// Utils
export { EventEmitter } from './utils/event-emitter';
export { generateTrackId } from './utils/id-generator';
