/**
 * @audiio/sdk - SDK for building Audiio addons
 */

// Re-export core types
export type {
  // Domain types
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
  SearchResult,

  // Addon types
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

  // Extended detail types
  ArtistDetail,
  AlbumDetail,

  // Provider settings types
  DeezerProviderSettings,
  AppleMusicArtworkSettings,

  // Audio processor types
  AudioProcessor,
  AudioProcessorResult,

  // Tool types
  Tool,
  ToolType,
  PluginUIRegistry,

  // Artist enrichment types
  MusicVideo,
  TimelineEntry,
  Concert,
  Setlist,
  ArtistImages,
  ArtistEnrichmentType,
  ArtistEnrichmentData,
  ArtistEnrichmentProvider,

  // Media processing types
  HLSConversionOptions,
  ConversionResult,
  FFmpegProgress,
  ProgressCallback,

  // Pipeline types (for Discover integrations)
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
} from '@audiio/core';

// Media processing
export { MediaProcessor, getMediaProcessor } from '@audiio/core';

// Base classes
export { BaseMetadataProvider } from './base/BaseMetadataProvider';
export { BaseStreamProvider } from './base/BaseStreamProvider';
export { BaseLyricsProvider } from './base/BaseLyricsProvider';
export { BaseAudioProcessor } from './base/BaseAudioProcessor';
export { BaseTool } from './base/BaseTool';
export { BaseArtistEnrichmentProvider } from './base/BaseArtistEnrichmentProvider';

// Registration
export { defineAddon, type AddonDefinition } from './registration';

// Plugin manifest types
export interface PluginManifest {
  /** Unique plugin identifier */
  id: string;
  /** Human-readable plugin name */
  name: string;
  /** Plugin version (semver) */
  version: string;
  /** Plugin description */
  description?: string;
  /** Plugin roles/capabilities */
  roles: ('metadata-provider' | 'stream-provider' | 'lyrics-provider' | 'audio-processor' | 'scrobbler' | 'tool' | 'artist-enrichment')[];
  /** Entry point file (relative to package root) */
  main?: string;
  /** Author name or object */
  author?: string | { name: string; email?: string };
}

/**
 * Audiio plugin package.json extension
 * Add this to your package.json to identify your package as an Audiio plugin
 */
export interface AudiioPluginPackageJson {
  /** Standard npm package name (e.g., "@audiio/plugin-deezer") */
  name: string;
  /** Package version */
  version: string;
  /** Main entry point */
  main: string;
  /** TypeScript types entry point */
  types?: string;
  /** Audiio-specific plugin metadata */
  audiio: {
    /** Plugin type identifier */
    type: 'plugin';
    /** Unique plugin ID (short name, e.g., "deezer") */
    id: string;
    /** Plugin capabilities */
    roles: PluginManifest['roles'];
  };
  /** Required peer dependency */
  peerDependencies: {
    '@audiio/sdk': string;
  };
}

// Plugin templates are available in the `templates` folder.
// Copy them to your plugin project as starting points.
// Templates are NOT exported at runtime - they are reference code only.
