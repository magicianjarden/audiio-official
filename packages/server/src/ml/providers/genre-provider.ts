/**
 * Genre Provider - Plugin-first genre classification with embedding fallback
 *
 * Strategy:
 * 1. Check if plugin/metadata provides genre (source: 'metadata', confidence: 1.0)
 * 2. If no plugin genre, use embedding similarity to find similar tracks with known genres
 * 3. Return the weighted consensus of genres from similar tracks
 *
 * This approach is 100% plugin-driven - genres come from your library's metadata,
 * not hardcoded taxonomy.
 */

import type { GenreFeatures, GenrePrediction, MLCoreEndpoints } from '../types';
import { MemoryCache } from '../utils';
import { cosineSimilarity } from '../utils/vector-utils';

/** Configuration for embedding-based genre inference */
interface GenreInferenceConfig {
  /** Minimum number of similar tracks needed for genre inference */
  minSimilarTracks: number;
  /** Maximum tracks to consider for genre consensus */
  maxSimilarTracks: number;
  /** Minimum similarity score to consider a track (0-1) */
  minSimilarity: number;
  /** Minimum confidence to return a prediction */
  minConfidence: number;
}

const DEFAULT_CONFIG: GenreInferenceConfig = {
  minSimilarTracks: 3,
  maxSimilarTracks: 20,
  minSimilarity: 0.6,
  minConfidence: 0.3,
};

export class GenreProvider {
  private endpoints!: MLCoreEndpoints;
  private cache: MemoryCache<GenreFeatures>;
  private config: GenreInferenceConfig;

  // Genre centroids built from tracks with known genres
  // Map<genre, { centroid: number[], trackCount: number }>
  private genreCentroids: Map<string, { centroid: number[]; trackCount: number }> = new Map();

  constructor(config: Partial<GenreInferenceConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.cache = new MemoryCache<GenreFeatures>(2000, 24 * 60 * 60 * 1000); // 24h cache
  }

  /**
   * Initialize the genre provider
   */
  async initialize(endpoints: MLCoreEndpoints): Promise<void> {
    this.endpoints = endpoints;
    console.log('[GenreProvider] Initialized with plugin-first approach');
  }

  /**
   * Dispose resources
   */
  async dispose(): Promise<void> {
    this.cache.clear();
    this.genreCentroids.clear();
  }

  /**
   * Get genre features for a track
   * Uses plugin-first approach with embedding fallback
   */
  async getGenreFeatures(trackId: string): Promise<GenreFeatures | null> {
    // Check cache
    const cached = this.cache.get(trackId);
    if (cached) return cached;

    try {
      // Strategy 1: Check if we already have genre from metadata/plugins
      // This would come from track metadata loaded by plugins (e.g., local-library, spotify-import)
      const metadataGenre = await this.getGenreFromMetadata(trackId);
      if (metadataGenre) {
        this.cache.set(trackId, metadataGenre);
        return metadataGenre;
      }

      // Strategy 2: Infer genre from embedding similarity
      const inferredGenre = await this.inferGenreFromEmbedding(trackId);
      if (inferredGenre) {
        this.cache.set(trackId, inferredGenre);
        return inferredGenre;
      }

      // No genre could be determined
      return null;
    } catch (error) {
      console.error('[GenreProvider] Error getting genre features:', error);
      return null;
    }
  }

  /**
   * Get genre from track metadata (plugin-provided)
   * This checks the track's metadata from any plugin that provides genre info
   */
  private async getGenreFromMetadata(trackId: string): Promise<GenreFeatures | null> {
    try {
      // Get track data from library - plugins store genre in track metadata
      const track = await this.endpoints.library?.getTrack?.(trackId);
      if (!track) return null;

      // Check if track has genre(s) from plugin metadata
      const genres = track.genres || (track.genre ? [track.genre] : []);
      if (genres.length === 0) return null;

      // Primary genre from metadata
      const primaryGenre = genres[0].toLowerCase();

      // Build predictions from all genres
      const predictions: GenrePrediction[] = genres.map((g, i) => ({
        genre: g.toLowerCase(),
        // First genre gets highest confidence, decreasing for subsequent
        confidence: Math.max(0.5, 1 - (i * 0.1)),
      }));

      return {
        primaryGenre,
        primaryConfidence: 1.0, // Metadata is trusted
        predictions,
        source: 'metadata',
      };
    } catch (error) {
      // No metadata available
      return null;
    }
  }

  /**
   * Infer genre using embedding similarity
   * Finds similar tracks with known genres and builds consensus
   */
  private async inferGenreFromEmbedding(trackId: string): Promise<GenreFeatures | null> {
    try {
      // Get the track's embedding
      const embedding = await this.endpoints.features.getEmbedding(trackId);
      if (!embedding) return null;

      // Find similar tracks using embedding similarity
      const similar = await this.endpoints.features.findSimilarByEmbedding(
        embedding,
        this.config.maxSimilarTracks * 2 // Get more to filter
      );

      if (!similar || similar.length < this.config.minSimilarTracks) {
        return null;
      }

      // Collect genres from similar tracks (excluding the query track)
      const genreVotes: Map<string, { weight: number; count: number }> = new Map();
      let tracksWithGenre = 0;

      for (const { trackId: similarId, similarity } of similar) {
        if (similarId === trackId) continue;
        if (similarity < this.config.minSimilarity) continue;

        // Get genre for this similar track (from metadata)
        const similarTrack = await this.endpoints.library?.getTrack?.(similarId);
        if (!similarTrack) continue;

        const genres = similarTrack.genres || (similarTrack.genre ? [similarTrack.genre] : []);
        if (genres.length === 0) continue;

        tracksWithGenre++;

        // Weight vote by similarity
        for (const genre of genres) {
          const g = genre.toLowerCase();
          const existing = genreVotes.get(g) || { weight: 0, count: 0 };
          existing.weight += similarity;
          existing.count += 1;
          genreVotes.set(g, existing);
        }
      }

      if (tracksWithGenre < this.config.minSimilarTracks) {
        return null;
      }

      // Calculate predictions from votes
      const predictions: GenrePrediction[] = [];
      const totalWeight = Array.from(genreVotes.values()).reduce((sum, v) => sum + v.weight, 0);

      for (const [genre, { weight, count }] of genreVotes.entries()) {
        const confidence = totalWeight > 0 ? weight / totalWeight : 0;
        if (confidence >= this.config.minConfidence) {
          predictions.push({ genre, confidence });
        }
      }

      if (predictions.length === 0) {
        return null;
      }

      // Sort by confidence
      predictions.sort((a, b) => b.confidence - a.confidence);

      return {
        primaryGenre: predictions[0].genre,
        primaryConfidence: predictions[0].confidence,
        predictions: predictions.slice(0, 5), // Top 5
        source: 'ml-predicted',
      };
    } catch (error) {
      console.error('[GenreProvider] Embedding inference failed:', error);
      return null;
    }
  }

  /**
   * Build or update genre centroids from tracks with known genres
   * This allows for faster genre classification without checking similar tracks each time
   */
  async buildGenreCentroids(): Promise<void> {
    try {
      // Get all embeddings from the feature aggregator
      const allEmbeddings = this.endpoints.features.getAllEmbeddings?.();
      if (!allEmbeddings || allEmbeddings.size === 0) {
        console.log('[GenreProvider] No embeddings available for centroid building');
        return;
      }

      // Clear existing centroids
      this.genreCentroids.clear();

      // Temporary storage for centroid calculation
      const genreEmbeddings: Map<string, number[][]> = new Map();

      for (const [trackId, embedding] of allEmbeddings) {
        // Get genre from metadata
        const track = await this.endpoints.library?.getTrack?.(trackId);
        if (!track) continue;

        const genres = track.genres || (track.genre ? [track.genre] : []);
        if (genres.length === 0) continue;

        // Add embedding to each of the track's genres
        for (const genre of genres) {
          const g = genre.toLowerCase();
          const embeddings = genreEmbeddings.get(g) || [];
          embeddings.push(embedding);
          genreEmbeddings.set(g, embeddings);
        }
      }

      // Calculate centroids (average of all embeddings for each genre)
      for (const [genre, embeddings] of genreEmbeddings) {
        if (embeddings.length === 0) continue;

        const dims = embeddings[0].length;
        const centroid = new Array(dims).fill(0);

        for (const emb of embeddings) {
          for (let i = 0; i < dims; i++) {
            centroid[i] += emb[i];
          }
        }

        for (let i = 0; i < dims; i++) {
          centroid[i] /= embeddings.length;
        }

        this.genreCentroids.set(genre, {
          centroid,
          trackCount: embeddings.length,
        });
      }

      console.log(`[GenreProvider] Built ${this.genreCentroids.size} genre centroids`);
    } catch (error) {
      console.error('[GenreProvider] Failed to build centroids:', error);
    }
  }

  /**
   * Classify genre using pre-built centroids (faster than similarity search)
   */
  async classifyUsingCentroids(trackId: string): Promise<GenreFeatures | null> {
    if (this.genreCentroids.size === 0) {
      return null;
    }

    try {
      const embedding = await this.endpoints.features.getEmbedding(trackId);
      if (!embedding) return null;

      const queryVector = new Float32Array(embedding);
      const predictions: GenrePrediction[] = [];

      for (const [genre, { centroid, trackCount }] of this.genreCentroids) {
        const centroidVector = new Float32Array(centroid);
        const similarity = cosineSimilarity(queryVector, centroidVector);

        // Weight by number of tracks in that genre (more data = more reliable)
        const confidence = similarity * Math.min(1, Math.log10(trackCount + 1) / 2);

        if (confidence >= this.config.minConfidence) {
          predictions.push({ genre, confidence });
        }
      }

      if (predictions.length === 0) {
        return null;
      }

      predictions.sort((a, b) => b.confidence - a.confidence);

      return {
        primaryGenre: predictions[0].genre,
        primaryConfidence: predictions[0].confidence,
        predictions: predictions.slice(0, 5),
        source: 'ml-predicted',
      };
    } catch (error) {
      console.error('[GenreProvider] Centroid classification failed:', error);
      return null;
    }
  }

  /**
   * Cache features for a track
   */
  cacheFeatures(trackId: string, features: GenreFeatures): void {
    this.cache.set(trackId, features);
  }

  /**
   * Create genre features from metadata (static helper)
   */
  static fromMetadata(genre: string): GenreFeatures {
    return {
      primaryGenre: genre.toLowerCase(),
      primaryConfidence: 1.0,
      predictions: [{ genre: genre.toLowerCase(), confidence: 1.0 }],
      source: 'metadata',
    };
  }

  /**
   * Get available genres from library (plugin-driven)
   */
  async getAvailableGenres(): Promise<string[]> {
    return Array.from(this.genreCentroids.keys()).sort();
  }

  /**
   * Get genre statistics
   */
  getStats(): { genreCount: number; centroidGenres: string[] } {
    return {
      genreCount: this.genreCentroids.size,
      centroidGenres: Array.from(this.genreCentroids.keys()),
    };
  }
}
