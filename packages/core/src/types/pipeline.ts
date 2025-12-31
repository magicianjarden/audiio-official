/**
 * Plugin Pipeline Types
 * Types for plugins to contribute to Discover "See All" results
 */

import type { UnifiedTrack } from './index';

// ============================================
// Query Types
// ============================================

export type QueryStrategy = 'embedding' | 'search' | 'hybrid' | 'plugin';

export type EmbeddingMethod =
  | 'mood'
  | 'genre'
  | 'seed'
  | 'personalized'
  | 'artist-radio'
  | 'discovery'
  | 'similar';

/**
 * Embedding-based query context
 */
export interface EmbeddingContext {
  method: EmbeddingMethod;
  mood?: string;
  genre?: string;
  seedTrackIds?: string[];
  seedArtistId?: string;
  artistName?: string;
  exploration?: number;
  includeCollaborative?: boolean;
  contextHour?: number;
  contextDayOfWeek?: number;
  energy?: 'low' | 'medium' | 'high';
  excludeTrackIds?: string[];
  excludeArtistIds?: string[];
}

/**
 * Search-based query context
 */
export interface SearchContext {
  query: string;
  filters?: {
    artist?: string;
    album?: string;
    genre?: string;
    year?: number;
    yearRange?: [number, number];
  };
}

/**
 * Structured query for See All views
 */
export interface StructuredSectionQuery {
  strategy: QueryStrategy;
  embedding?: EmbeddingContext;
  search?: SearchContext;
  title: string;
  subtitle?: string;
  sectionType: string;
  pluginHooks?: {
    resultTransformers?: string[];
    dataProviders?: string[];
    queryEnhancers?: string[];
  };
  limit?: number;
  offset?: number;
}

// ============================================
// User Profile Types (for pipeline context)
// ============================================

export interface ArtistPreference {
  playCount: number;
  skipCount: number;
  likeCount: number;
  lastPlayed: number;
  avgListenDuration: number;
}

export interface GenrePreference {
  playCount: number;
  skipCount: number;
  likeCount: number;
  weight: number;
}

export interface UserProfile {
  artistPreferences: Record<string, ArtistPreference>;
  genrePreferences: Record<string, GenrePreference>;
  totalListens: number;
  totalListenTime: number;
  uniqueArtists: number;
  uniqueTracks: number;
}

// ============================================
// Pipeline Context
// ============================================

/**
 * Context passed to pipeline hooks
 */
export interface PipelineContext {
  query: StructuredSectionQuery;
  userProfile: UserProfile;
  currentResults: UnifiedTrack[];
  hour: number;
  dayOfWeek: number;
}

// ============================================
// Pipeline Hook Interfaces
// ============================================

/**
 * Result Transformer - modifies/filters/reorders results
 * Use to: filter by lyrics mood, enforce artist diversity, boost by audio features
 */
export interface ResultTransformer {
  /** Unique identifier (format: "pluginId:transformerId") */
  id: string;
  /** Plugin that registered this transformer */
  pluginId: string;
  /** Execution priority (higher = runs first) */
  priority: number;
  /** Display name */
  name: string;
  /** Description */
  description: string;
  /** Whether enabled by default */
  enabledByDefault: boolean;

  /** Transform results */
  transform(results: UnifiedTrack[], context: PipelineContext): Promise<UnifiedTrack[]>;

  /** Check if transformer applies to this query */
  canTransform(query: StructuredSectionQuery): boolean;
}

/**
 * Data Provider - contributes additional results
 * Use to: fetch from external API, provide cached recommendations
 */
export interface DataProvider {
  /** Unique identifier (format: "pluginId:providerId") */
  id: string;
  /** Plugin that registered this provider */
  pluginId: string;
  /** Execution priority (higher = runs first) */
  priority: number;
  /** Display name */
  name: string;
  /** Description */
  description: string;

  /** Provide additional results */
  provide(context: PipelineContext): Promise<UnifiedTrack[]>;

  /** Check if provider can contribute to this query */
  canProvide(query: StructuredSectionQuery): boolean;
}

/**
 * Query Enhancer - modifies the query before execution
 * Use to: add audio feature filters, expand genre to related genres
 */
export interface QueryEnhancer {
  /** Unique identifier (format: "pluginId:enhancerId") */
  id: string;
  /** Plugin that registered this enhancer */
  pluginId: string;
  /** Execution priority (higher = runs first) */
  priority: number;
  /** Display name */
  name: string;
  /** Description */
  description: string;

  /** Enhance query before execution */
  enhance(
    query: StructuredSectionQuery,
    context: Omit<PipelineContext, 'currentResults'>
  ): StructuredSectionQuery;

  /** Check if enhancer applies to this query */
  canEnhance(query: StructuredSectionQuery): boolean;
}

// ============================================
// Pipeline Result
// ============================================

/**
 * Result from pipeline execution with metadata
 */
export interface PipelineResult {
  tracks: UnifiedTrack[];
  appliedTransformers: string[];
  contributingProviders: string[];
  appliedEnhancers: string[];
  executionTime: number;
}

/**
 * Pipeline configuration
 */
export interface PipelineConfig {
  providerTimeout: number;
  transformerTimeout: number;
  continueOnError: boolean;
  maxProviderResults: number;
}

/**
 * Registration options for pipeline hooks
 */
export interface PipelineRegistrationOptions {
  replace?: boolean;
}

// ============================================
// Plugin Pipeline Registry Interface
// ============================================

/**
 * Interface for registering pipeline hooks
 * Plugins receive this interface to register their hooks
 */
export interface PluginPipelineAPI {
  registerTransformer(
    transformer: ResultTransformer,
    options?: PipelineRegistrationOptions
  ): void;

  registerProvider(
    provider: DataProvider,
    options?: PipelineRegistrationOptions
  ): void;

  registerEnhancer(
    enhancer: QueryEnhancer,
    options?: PipelineRegistrationOptions
  ): void;

  unregisterPlugin(pluginId: string): void;

  setTransformerEnabled(id: string, enabled: boolean): void;

  isTransformerEnabled(id: string): boolean;
}
