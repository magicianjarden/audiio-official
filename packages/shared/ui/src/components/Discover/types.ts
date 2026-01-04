/**
 * Structured Query Types for "See All" Enhancement
 * Preserves ML context when navigating from section preview to full view
 */

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
 * Context for embedding-based queries
 * Preserves all ML parameters from section generation
 */
export interface EmbeddingContext {
  /** The embedding generation method to use */
  method: EmbeddingMethod;

  // Method-specific parameters
  /** Mood identifier (for 'mood' method) */
  mood?: string;
  /** Genre identifier (for 'genre' method) */
  genre?: string;
  /** Seed track IDs (for 'seed' and 'similar' methods) */
  seedTrackIds?: string[];
  /** Artist ID (for 'artist-radio' method) */
  seedArtistId?: string;
  /** Artist name for display (for 'artist-radio' method) */
  artistName?: string;

  // Generation parameters
  /** Exploration factor 0-1 (0=familiar, 1=discovery) */
  exploration?: number;
  /** Whether to use collaborative filtering */
  includeCollaborative?: boolean;
  /** Hour of day for contextual taste (0-23) */
  contextHour?: number;
  /** Day of week for contextual taste (0-6) */
  contextDayOfWeek?: number;
  /** Energy level filter */
  energy?: 'low' | 'medium' | 'high';

  // Exclusions
  /** Track IDs to exclude from results */
  excludeTrackIds?: string[];
  /** Artist IDs to exclude from results */
  excludeArtistIds?: string[];
}

/**
 * Context for text search-based queries
 */
export interface SearchContext {
  /** The search query string */
  query: string;
  /** Optional filters to apply */
  filters?: {
    artist?: string;
    album?: string;
    genre?: string;
    year?: number;
    yearRange?: [number, number];
  };
}

/**
 * Plugin hooks for result enhancement (Phase 2)
 */
export interface PluginHooks {
  /** Plugin IDs to run as result transformers */
  resultTransformers?: string[];
  /** Plugin IDs to use as additional data sources */
  dataProviders?: string[];
}

/**
 * Structured query object that preserves full ML context
 * Replaces simple text query strings for "See All" navigation
 */
export interface StructuredSectionQuery {
  /** Strategy for generating results */
  strategy: QueryStrategy;

  /** Embedding context (required if strategy is 'embedding' or 'hybrid') */
  embedding?: EmbeddingContext;

  /** Search context (required if strategy is 'search' or 'hybrid') */
  search?: SearchContext;

  /** Section type for analytics and rendering hints */
  sectionType: string;

  /** Display title */
  title: string;

  /** Display subtitle */
  subtitle?: string;

  /** Plugin hooks for result enhancement (Phase 2) */
  pluginHooks?: PluginHooks;

  /** Maximum results to fetch */
  limit?: number;

  /** Offset for pagination */
  offset?: number;
}

/**
 * Type guard to check if a query uses embedding
 */
export function isEmbeddingQuery(
  query: StructuredSectionQuery
): query is StructuredSectionQuery & { embedding: EmbeddingContext } {
  return (
    (query.strategy === 'embedding' || query.strategy === 'hybrid') &&
    query.embedding !== undefined
  );
}

/**
 * Type guard to check if a query uses search
 */
export function isSearchQuery(
  query: StructuredSectionQuery
): query is StructuredSectionQuery & { search: SearchContext } {
  return (
    (query.strategy === 'search' || query.strategy === 'hybrid') &&
    query.search !== undefined
  );
}
