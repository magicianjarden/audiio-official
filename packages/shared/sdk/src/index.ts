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

  // Settings schema types
  SettingsFieldType,
  SettingsSchemaItem,

  // Privacy manifest types
  PrivacyDataCategory,
  PrivacyDataUsage,
  PrivacyNetworkAccess,
  PrivacyDataAccess,
  PrivacyManifest,

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

  // Audio processor types
  AudioProcessor,
  AudioProcessorResult,

  // Tool types
  Tool,
  ToolType,
  PluginUIRegistry,

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
  // Playlist type (for search providers)
  Playlist,

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
  PluginPipelineAPI,

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
} from '@audiio/core';

// Base classes
export { BaseMetadataProvider } from './base/BaseMetadataProvider';
export { BaseStreamProvider } from './base/BaseStreamProvider';
export { BaseLyricsProvider } from './base/BaseLyricsProvider';
export { BaseAudioProcessor } from './base/BaseAudioProcessor';
export { BaseTool } from './base/BaseTool';
export { BaseArtistEnrichmentProvider } from './base/BaseArtistEnrichmentProvider';

// Registration
export { defineAddon, type AddonDefinition } from './registration';

// Route types for plugins with custom routes
export type {
  PluginRouteMethod,
  PluginRouteHandler,
  PluginRouteRequest,
  PluginRouteReply,
  PluginRouteSchema,
  PluginWithRoutes,
  RegisteredPluginRoute
} from './types/routes';

// Sandbox types for secure plugin execution
export type {
  SandboxedFS,
  SandboxedFetch,
  PluginCapabilities,
  SandboxContext,
  PluginInitOptions,
  SandboxedPlugin,
  PluginCapabilityManifest
} from './types/sandbox';

// Plugin manifest types
import type { SettingsSchemaItem, AddonRole } from '@audiio/core';

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
  roles: AddonRole[];
  /** Entry point file (relative to package root) */
  main?: string;
  /** Author name or object */
  author?: string | { name: string; email?: string };
  /** Settings schema for plugin configuration UI */
  settingsSchema?: SettingsSchemaItem[];
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

// ============================================
// Base Classes for Library Management Plugins
// ============================================

// Note: Base classes for new provider types can be created in the base/ folder
// following the pattern of BaseMetadataProvider, BaseStreamProvider, etc.
// Plugin authors can extend these base classes or implement interfaces directly.

