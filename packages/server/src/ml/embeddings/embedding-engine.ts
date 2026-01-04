/**
 * Embedding Engine
 *
 * Generates and manages track embeddings for vector-based recommendations.
 * This replaces keyword-based search with semantic similarity.
 */

import type {
  TrackEmbedding,
  EmbeddingConfig,
  EmbeddingSource,
  EmbeddingMetadata,
} from './types';
import {
  DEFAULT_EMBEDDING_CONFIG,
  GENRE_VECTORS,
  MOOD_VECTORS,
} from './types';
import type { AudioFeatures } from '../types';

/**
 * Track data for embedding generation
 */
export interface TrackData {
  id: string;
  title?: string;
  artist?: string;
  artistId?: string;
  genres?: string[];
  tags?: string[];
  duration?: number;
  releaseYear?: number;
  audioFeatures?: Partial<AudioFeatures>;
}

/**
 * Embedding Engine - generates vector representations of tracks
 */
export class EmbeddingEngine {
  private config: EmbeddingConfig;
  private embeddings = new Map<string, TrackEmbedding>();
  private genreEmbeddingCache = new Map<string, Float32Array>();
  private version = 1;

  constructor(config: Partial<EmbeddingConfig> = {}) {
    this.config = { ...DEFAULT_EMBEDDING_CONFIG, ...config };
    this.initializeGenreEmbeddings();
  }

  /**
   * Initialize genre embeddings by expanding the base vectors
   */
  private initializeGenreEmbeddings(): void {
    for (const [genre, baseVector] of Object.entries(GENRE_VECTORS)) {
      const expanded = this.expandVector(
        baseVector,
        this.config.genreEmbeddingDimensions
      );
      this.genreEmbeddingCache.set(genre, expanded);
    }
  }

  /**
   * Generate embedding for a track
   */
  generateEmbedding(track: TrackData): TrackEmbedding {
    const now = Date.now();
    const vectors: Float32Array[] = [];
    const metadata: EmbeddingMetadata = {
      audioFeaturesUsed: [],
      genresUsed: [],
      confidenceScore: 0,
    };

    // 1. Generate from audio features if available
    if (track.audioFeatures && this.hasMinimumAudioFeatures(track.audioFeatures)) {
      const audioVector = this.generateAudioFeatureVector(track.audioFeatures);
      vectors.push(audioVector);
      metadata.audioFeaturesUsed = Object.keys(track.audioFeatures).filter(
        (k) => track.audioFeatures![k as keyof AudioFeatures] !== undefined
      );
      metadata.confidenceScore = 0.8;
    }

    // 2. Generate from genres
    if (track.genres && track.genres.length > 0) {
      const genreVector = this.generateGenreVector(track.genres);
      vectors.push(genreVector);
      metadata.genresUsed = track.genres;
      metadata.confidenceScore = Math.max(metadata.confidenceScore ?? 0, 0.6);
    }

    // 3. Generate from tags (similar to genres but may be more specific)
    if (track.tags && track.tags.length > 0) {
      const tagVector = this.generateTagVector(track.tags);
      if (tagVector) {
        vectors.push(tagVector);
      }
    }

    // Combine vectors
    let finalVector: Float32Array;
    if (vectors.length === 0) {
      // No data available, generate a neutral embedding
      finalVector = this.generateNeutralVector();
      metadata.confidenceScore = 0.1;
    } else if (vectors.length === 1) {
      finalVector = vectors[0];
    } else {
      finalVector = this.combineVectors(vectors);
    }

    // Normalize if configured
    if (this.config.normalizeVectors) {
      finalVector = this.normalizeVector(finalVector);
    }

    const embedding: TrackEmbedding = {
      trackId: track.id,
      vector: finalVector,
      version: this.version,
      createdAt: now,
      updatedAt: now,
      source: this.determineSource(track),
      metadata,
    };

    // Cache the embedding
    this.embeddings.set(track.id, embedding);

    return embedding;
  }

  /**
   * Generate embedding from audio features
   */
  private generateAudioFeatureVector(features: Partial<AudioFeatures>): Float32Array {
    const weights = this.config.audioFeatureWeights;
    const dims = this.config.dimensions;
    const vector = new Float32Array(dims);

    // Map audio features to vector dimensions
    // Use a deterministic but spread-out mapping
    const featureValues: [string, number, number][] = [
      ['energy', features.energy ?? 0.5, weights.energy],
      ['valence', features.valence ?? 0.5, weights.valence],
      ['danceability', features.danceability ?? 0.5, weights.danceability],
      ['acousticness', features.acousticness ?? 0.5, weights.acousticness],
      ['instrumentalness', features.instrumentalness ?? 0.5, weights.instrumentalness],
      ['speechiness', features.speechiness ?? 0.1, weights.speechiness],
      ['liveness', features.liveness ?? 0.2, weights.liveness],
      ['bpm', this.normalizeBpm(features.bpm ?? 120), weights.bpm],
      ['loudness', this.normalizeLoudness(features.loudness ?? -10), weights.loudness],
      ['brightness', features.brightness ?? 0.5, weights.brightness],
      ['warmth', features.warmth ?? 0.5, weights.warmth],
    ];

    // Distribute features across vector dimensions using golden ratio spacing
    const phi = (1 + Math.sqrt(5)) / 2;
    for (let i = 0; i < featureValues.length; i++) {
      const [, value, weight] = featureValues[i];
      const baseIdx = Math.floor((i * phi * dims) % dims);
      const spread = Math.floor(dims / featureValues.length);

      // Spread each feature across multiple dimensions
      for (let j = 0; j < spread; j++) {
        const idx = (baseIdx + j) % dims;
        const influence = weight * Math.exp(-j * 0.3); // Decay influence
        vector[idx] += value * influence;
      }
    }

    // Add second-order interactions (combinations of features)
    if (features.energy !== undefined && features.valence !== undefined) {
      const moodInteraction = features.energy * features.valence;
      for (let i = 0; i < 8; i++) {
        vector[(dims - 1 - i) % dims] += moodInteraction * 0.5;
      }
    }

    if (features.danceability !== undefined && features.bpm !== undefined) {
      const grooveInteraction = features.danceability * this.normalizeBpm(features.bpm);
      for (let i = 0; i < 8; i++) {
        vector[(dims - 9 - i) % dims] += grooveInteraction * 0.4;
      }
    }

    return vector;
  }

  /**
   * Generate embedding from genres
   */
  private generateGenreVector(genres: string[]): Float32Array {
    const dims = this.config.dimensions;
    const accumulated = new Float32Array(dims);
    let count = 0;

    for (const genre of genres) {
      const normalized = this.normalizeGenre(genre);
      let genreEmbed = this.genreEmbeddingCache.get(normalized);

      if (!genreEmbed) {
        // Try fuzzy matching
        genreEmbed = this.findClosestGenreEmbedding(normalized);
      }

      if (genreEmbed) {
        for (let i = 0; i < dims; i++) {
          accumulated[i] += genreEmbed[i];
        }
        count++;
      }
    }

    // Average if multiple genres
    if (count > 1) {
      for (let i = 0; i < dims; i++) {
        accumulated[i] /= count;
      }
    }

    return accumulated;
  }

  /**
   * Generate embedding from tags
   */
  private generateTagVector(tags: string[]): Float32Array | null {
    const dims = this.config.dimensions;
    const accumulated = new Float32Array(dims);
    let count = 0;

    for (const tag of tags) {
      const normalized = tag.toLowerCase().trim();

      // Check if tag matches a mood
      const moodVector = MOOD_VECTORS[normalized];
      if (moodVector) {
        const expanded = this.expandVector(moodVector, dims);
        for (let i = 0; i < dims; i++) {
          accumulated[i] += expanded[i];
        }
        count++;
        continue;
      }

      // Check if tag matches a genre
      const genreEmbed = this.genreEmbeddingCache.get(normalized);
      if (genreEmbed) {
        for (let i = 0; i < dims; i++) {
          accumulated[i] += genreEmbed[i];
        }
        count++;
      }
    }

    if (count === 0) return null;

    // Average
    for (let i = 0; i < dims; i++) {
      accumulated[i] /= count;
    }

    return accumulated;
  }

  /**
   * Generate a neutral embedding for tracks with no data
   */
  private generateNeutralVector(): Float32Array {
    const dims = this.config.dimensions;
    const vector = new Float32Array(dims);

    // Fill with small random values centered around 0.5
    for (let i = 0; i < dims; i++) {
      vector[i] = 0.5 + (Math.random() - 0.5) * 0.1;
    }

    return vector;
  }

  /**
   * Combine multiple vectors by weighted averaging
   */
  private combineVectors(vectors: Float32Array[]): Float32Array {
    const dims = this.config.dimensions;
    const result = new Float32Array(dims);

    // Simple average for now - could use learned weights
    for (const vec of vectors) {
      for (let i = 0; i < dims; i++) {
        result[i] += vec[i];
      }
    }

    for (let i = 0; i < dims; i++) {
      result[i] /= vectors.length;
    }

    return result;
  }

  /**
   * Normalize a vector to unit length
   */
  normalizeVector(vector: Float32Array): Float32Array {
    let magnitude = 0;
    for (let i = 0; i < vector.length; i++) {
      magnitude += vector[i] * vector[i];
    }
    magnitude = Math.sqrt(magnitude);

    if (magnitude === 0) return vector;

    const normalized = new Float32Array(vector.length);
    for (let i = 0; i < vector.length; i++) {
      normalized[i] = vector[i] / magnitude;
    }

    return normalized;
  }

  /**
   * Expand a small vector to target dimensions
   */
  private expandVector(smallVector: number[], targetDims: number): Float32Array {
    const expanded = new Float32Array(targetDims);
    const smallLen = smallVector.length;

    // Use interpolation and repetition to expand
    for (let i = 0; i < targetDims; i++) {
      const srcIdx = (i * smallLen) / targetDims;
      const lower = Math.floor(srcIdx);
      const upper = Math.min(lower + 1, smallLen - 1);
      const t = srcIdx - lower;

      expanded[i] = smallVector[lower] * (1 - t) + smallVector[upper] * t;
    }

    return expanded;
  }

  /**
   * Normalize genre string
   */
  private normalizeGenre(genre: string): string {
    return genre
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }

  /**
   * Find closest genre embedding using fuzzy matching
   */
  private findClosestGenreEmbedding(query: string): Float32Array | undefined {
    const normalized = query.toLowerCase();

    // Check for partial matches
    for (const [genre, embedding] of this.genreEmbeddingCache) {
      if (genre.includes(normalized) || normalized.includes(genre)) {
        return embedding;
      }
    }

    // Check for word overlap
    const queryWords = normalized.split(/[-\s]+/);
    for (const [genre, embedding] of this.genreEmbeddingCache) {
      const genreWords = genre.split(/[-\s]+/);
      const overlap = queryWords.filter((w) => genreWords.includes(w));
      if (overlap.length > 0) {
        return embedding;
      }
    }

    return undefined;
  }

  /**
   * Normalize BPM to 0-1 range
   */
  private normalizeBpm(bpm: number): number {
    // Typical range: 60-180 BPM
    return Math.max(0, Math.min(1, (bpm - 60) / 120));
  }

  /**
   * Normalize loudness to 0-1 range
   */
  private normalizeLoudness(loudness: number): number {
    // Typical range: -60 to 0 dB
    return Math.max(0, Math.min(1, (loudness + 60) / 60));
  }

  /**
   * Check if we have minimum audio features for embedding
   */
  private hasMinimumAudioFeatures(features: Partial<AudioFeatures>): boolean {
    const requiredCount = 3;
    let count = 0;

    if (features.energy !== undefined) count++;
    if (features.valence !== undefined) count++;
    if (features.danceability !== undefined) count++;
    if (features.bpm !== undefined) count++;
    if (features.acousticness !== undefined) count++;

    return count >= requiredCount;
  }

  /**
   * Determine embedding source based on available data
   */
  private determineSource(track: TrackData): EmbeddingSource {
    const hasAudio = track.audioFeatures && this.hasMinimumAudioFeatures(track.audioFeatures);
    const hasGenres = track.genres && track.genres.length > 0;

    if (hasAudio && hasGenres) return 'hybrid';
    if (hasAudio) return 'audio-features';
    if (hasGenres) return 'genre-tags';
    return 'genre-tags';
  }

  /**
   * Get a cached embedding
   */
  getEmbedding(trackId: string): TrackEmbedding | undefined {
    return this.embeddings.get(trackId);
  }

  /**
   * Get or generate embedding
   */
  getOrGenerateEmbedding(track: TrackData): TrackEmbedding {
    const existing = this.embeddings.get(track.id);
    if (existing && existing.version === this.version) {
      return existing;
    }
    return this.generateEmbedding(track);
  }

  /**
   * Batch generate embeddings
   */
  generateBatch(tracks: TrackData[]): Map<string, TrackEmbedding> {
    const results = new Map<string, TrackEmbedding>();

    for (const track of tracks) {
      const embedding = this.generateEmbedding(track);
      results.set(track.id, embedding);
    }

    return results;
  }

  /**
   * Update an existing embedding with new data
   */
  updateEmbedding(trackId: string, track: TrackData): TrackEmbedding {
    const existing = this.embeddings.get(trackId);
    const newEmbedding = this.generateEmbedding(track);

    if (existing) {
      // Blend with existing embedding (70% new, 30% old)
      const blended = new Float32Array(this.config.dimensions);
      for (let i = 0; i < this.config.dimensions; i++) {
        blended[i] = newEmbedding.vector[i] * 0.7 + existing.vector[i] * 0.3;
      }
      newEmbedding.vector = this.normalizeVector(blended);
      newEmbedding.createdAt = existing.createdAt;
    }

    this.embeddings.set(trackId, newEmbedding);
    return newEmbedding;
  }

  /**
   * Generate a mood-based query vector
   */
  generateMoodVector(mood: string): Float32Array {
    const moodVec = MOOD_VECTORS[mood.toLowerCase()];
    if (moodVec) {
      const expanded = this.expandVector(moodVec, this.config.dimensions);
      return this.normalizeVector(expanded);
    }

    // Default neutral mood
    return this.generateNeutralVector();
  }

  /**
   * Generate a genre-based query vector
   */
  generateGenreQueryVector(genre: string): Float32Array {
    const normalized = this.normalizeGenre(genre);
    const cached = this.genreEmbeddingCache.get(normalized);

    if (cached) {
      return this.normalizeVector(new Float32Array(cached));
    }

    // Try fuzzy match
    const fuzzy = this.findClosestGenreEmbedding(normalized);
    if (fuzzy) {
      return this.normalizeVector(new Float32Array(fuzzy));
    }

    return this.generateNeutralVector();
  }

  /**
   * Get all cached embeddings
   */
  getAllEmbeddings(): Map<string, TrackEmbedding> {
    return new Map(this.embeddings);
  }

  /**
   * Clear all cached embeddings
   */
  clear(): void {
    this.embeddings.clear();
  }

  /**
   * Get embedding dimensions
   */
  getDimensions(): number {
    return this.config.dimensions;
  }

  /**
   * Export embeddings for persistence
   */
  exportEmbeddings(): Array<{
    trackId: string;
    vector: number[];
    metadata: EmbeddingMetadata | undefined;
  }> {
    const result: Array<{
      trackId: string;
      vector: number[];
      metadata: EmbeddingMetadata | undefined;
    }> = [];

    for (const [trackId, embedding] of this.embeddings) {
      result.push({
        trackId,
        vector: Array.from(embedding.vector),
        metadata: embedding.metadata,
      });
    }

    return result;
  }

  /**
   * Import embeddings from persistence
   */
  importEmbeddings(
    data: Array<{ trackId: string; vector: number[]; metadata?: EmbeddingMetadata }>
  ): void {
    const now = Date.now();

    for (const item of data) {
      const embedding: TrackEmbedding = {
        trackId: item.trackId,
        vector: new Float32Array(item.vector),
        version: this.version,
        createdAt: now,
        updatedAt: now,
        source: 'hybrid',
        metadata: item.metadata,
      };
      this.embeddings.set(item.trackId, embedding);
    }
  }
}

// Singleton instance
let engineInstance: EmbeddingEngine | null = null;

export function getEmbeddingEngine(config?: Partial<EmbeddingConfig>): EmbeddingEngine {
  if (!engineInstance) {
    engineInstance = new EmbeddingEngine(config);
  }
  return engineInstance;
}

export function resetEmbeddingEngine(): void {
  engineInstance = null;
}
