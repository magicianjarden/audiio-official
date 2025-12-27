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

  // Media processing types
  HLSConversionOptions,
  ConversionResult,
  FFmpegProgress,
  ProgressCallback
} from '@audiio/core';

// Media processing
export { MediaProcessor, getMediaProcessor } from '@audiio/core';

// Base classes
export { BaseMetadataProvider } from './base/BaseMetadataProvider';
export { BaseStreamProvider } from './base/BaseStreamProvider';
export { BaseLyricsProvider } from './base/BaseLyricsProvider';
export { BaseAudioProcessor } from './base/BaseAudioProcessor';

// Registration
export { defineAddon, type AddonDefinition } from './registration';
