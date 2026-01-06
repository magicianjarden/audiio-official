/**
 * Embedding API type definitions
 */

import type { Timestamp } from './common.types';

/** Track embedding vector */
export interface TrackEmbedding {
  trackId: string;
  vector: number[];
  dimensions: number;
  version: number;
  source: EmbeddingSource;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  metadata?: EmbeddingMetadata;
}

/** Source of the embedding */
export type EmbeddingSource = 'audio' | 'metadata' | 'hybrid' | 'collaborative';

/** Additional embedding metadata */
export interface EmbeddingMetadata {
  modelVersion?: string;
  confidence?: number;
  audioFeatureWeights?: Record<string, number>;
}

/** Similar track result */
export interface SimilarTrackResult {
  trackId: string;
  similarity: number;  // 0-1
  distance?: number;   // Lower is more similar
}

// Response types
export interface EmbeddingGetResponse {
  embedding: number[];
  trackId: string;
  dimensions: number;
  source?: EmbeddingSource;
}

export interface EmbeddingSimilarResponse {
  tracks: SimilarTrackResult[];
}
