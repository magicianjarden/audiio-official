/**
 * Embeddings Module
 *
 * Vector-based recommendation engine for Audiio.
 * Replaces keyword search with semantic similarity.
 */

// Types
export * from './types';

// Core components
export {
  EmbeddingEngine,
  getEmbeddingEngine,
  resetEmbeddingEngine,
  type TrackData,
} from './embedding-engine';

export {
  VectorIndex,
  getVectorIndex,
  resetVectorIndex,
  type VectorIndexConfig,
  DEFAULT_INDEX_CONFIG,
} from './vector-index';

export {
  TasteProfileManager,
  type TasteProfileConfig,
  type TrackInteraction,
  DEFAULT_TASTE_CONFIG,
} from './taste-profile';

export {
  CoOccurrenceMatrix,
  getCoOccurrenceMatrix,
  resetCoOccurrenceMatrix,
  type CoOccurrenceConfig,
  type ContextType,
  DEFAULT_COOCCURRENCE_CONFIG,
} from './cooccurrence';

export {
  PlaylistGenerator,
  type PlaylistOptions,
  type GeneratedPlaylist,
  type PlaylistTrack,
  type PlaylistMethod,
  type PlaylistStats,
} from './playlist-generator';
