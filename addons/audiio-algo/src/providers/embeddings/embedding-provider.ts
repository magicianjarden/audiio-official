/**
 * Embedding Provider - Track embeddings for similarity search
 *
 * Uses a small neural network to generate embedding vectors for tracks.
 */

import * as tf from '@tensorflow/tfjs';
import type { Track, AggregatedFeatures, MLCoreEndpoints } from '@audiio/ml-sdk';
import { MemoryCache, flattenFeatureVector, buildFeatureVector, getFeatureVectorDimension } from '@audiio/ml-sdk';

const MODEL_KEY = 'embedding-model';
const EMBEDDING_DIM = 64;

export class EmbeddingProvider {
  private model: tf.LayersModel | null = null;
  private endpoints!: MLCoreEndpoints;
  private embeddingIndex: Map<string, number[]> = new Map();
  private cache: MemoryCache<number[]>;

  constructor() {
    this.cache = new MemoryCache<number[]>(5000, 24 * 60 * 60 * 1000);
  }

  /**
   * Initialize the embedding provider
   */
  async initialize(endpoints: MLCoreEndpoints): Promise<void> {
    this.endpoints = endpoints;

    // Load existing model
    const modelStorage = endpoints.storage.getModelStorage();
    const existingModel = await modelStorage.load(MODEL_KEY);

    if (existingModel) {
      this.model = existingModel;
      console.log('[EmbeddingProvider] Loaded existing model');
    } else {
      this.model = this.createModel();
      console.log('[EmbeddingProvider] Created new model');
    }

    // Load embedding index
    const savedIndex = await endpoints.storage.get<Array<[string, number[]]>>('embedding-index');
    if (savedIndex) {
      this.embeddingIndex = new Map(savedIndex);
      console.log(`[EmbeddingProvider] Loaded ${this.embeddingIndex.size} embeddings`);
    }
  }

  /**
   * Dispose resources
   */
  async dispose(): Promise<void> {
    // Save embedding index
    await this.endpoints.storage.set(
      'embedding-index',
      Array.from(this.embeddingIndex.entries())
    );

    if (this.model) {
      this.model.dispose();
      this.model = null;
    }
    this.cache.clear();
  }

  /**
   * Get embedding for a track
   */
  async getEmbedding(trackId: string): Promise<number[] | null> {
    // Check cache
    const cached = this.cache.get(trackId);
    if (cached) return cached;

    // Check index
    const indexed = this.embeddingIndex.get(trackId);
    if (indexed) {
      this.cache.set(trackId, indexed);
      return indexed;
    }

    // Generate embedding
    const features = await this.endpoints.features.get(trackId);
    if (!features) return null;

    const embedding = await this.generateEmbedding(features);
    if (embedding) {
      this.embeddingIndex.set(trackId, embedding);
      this.cache.set(trackId, embedding);
    }

    return embedding;
  }

  /**
   * Generate embedding from features
   */
  async generateEmbedding(features: AggregatedFeatures): Promise<number[] | null> {
    if (!this.model) return null;

    try {
      // Build feature vector
      const track: Track = {
        id: features.trackId,
        title: '',
        artist: '',
        duration: 0,
      };

      const featureVector = buildFeatureVector(
        track,
        features.audio,
        {
          hourOfDay: new Date().getHours(),
          dayOfWeek: new Date().getDay(),
          isWeekend: [0, 6].includes(new Date().getDay()),
        },
        {
          playCount: 0,
          skipRatio: 0,
          completionRatio: 0.5,
          artistAffinity: 0,
          genreAffinity: 0,
        }
      );

      const flatFeatures = flattenFeatureVector(featureVector);

      // Get embedding from model
      const inputTensor = tf.tensor2d([flatFeatures], [1, flatFeatures.length]);
      const embeddingTensor = this.model.predict(inputTensor) as tf.Tensor;
      const rawEmbedding = Array.from(await embeddingTensor.data());

      // L2 normalize the embedding
      const norm = Math.sqrt(rawEmbedding.reduce((sum, v) => sum + v * v, 0)) || 1e-10;
      const embedding = rawEmbedding.map(v => v / norm);

      // Cleanup
      inputTensor.dispose();
      embeddingTensor.dispose();

      return embedding;
    } catch (error) {
      console.error('[EmbeddingProvider] Failed to generate embedding:', error);
      return null;
    }
  }

  /**
   * Find similar tracks by embedding
   */
  async findSimilar(trackId: string, limit: number): Promise<string[]> {
    const embedding = await this.getEmbedding(trackId);
    if (!embedding) return [];

    return this.searchByEmbedding(embedding, limit, trackId);
  }

  /**
   * Search by embedding similarity
   */
  searchByEmbedding(embedding: number[], limit: number, excludeId?: string): string[] {
    const similarities: Array<{ id: string; similarity: number }> = [];

    for (const [id, embeddingB] of this.embeddingIndex) {
      if (id === excludeId) continue;

      const similarity = this.cosineSimilarity(embedding, embeddingB);
      similarities.push({ id, similarity });
    }

    return similarities
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit)
      .map(s => s.id);
  }

  /**
   * Index track embeddings
   */
  async indexTracks(tracks: Track[]): Promise<void> {
    console.log(`[EmbeddingProvider] Indexing ${tracks.length} tracks...`);

    for (const track of tracks) {
      if (this.embeddingIndex.has(track.id)) continue;

      const features = await this.endpoints.features.get(track.id);
      if (features) {
        const embedding = await this.generateEmbedding(features);
        if (embedding) {
          this.embeddingIndex.set(track.id, embedding);
        }
      }
    }

    // Save index
    await this.endpoints.storage.set(
      'embedding-index',
      Array.from(this.embeddingIndex.entries())
    );

    console.log(`[EmbeddingProvider] Indexed ${this.embeddingIndex.size} tracks`);
  }

  /**
   * Create embedding model
   */
  private createModel(): tf.LayersModel {
    const inputDim = getFeatureVectorDimension();

    const model = tf.sequential();

    // Encoder layers
    model.add(tf.layers.dense({
      inputShape: [inputDim],
      units: 128,
      activation: 'relu',
      kernelInitializer: 'heNormal',
    }));
    model.add(tf.layers.batchNormalization());

    model.add(tf.layers.dense({
      units: 64,
      activation: 'relu',
      kernelInitializer: 'heNormal',
    }));
    model.add(tf.layers.batchNormalization());

    // Embedding layer - L2 normalization will be done post-prediction
    model.add(tf.layers.dense({
      units: EMBEDDING_DIM,
      activation: 'linear',
      name: 'embedding',
    }));

    model.compile({
      optimizer: tf.train.adam(0.001),
      loss: 'meanSquaredError',
    });

    return model;
  }

  /**
   * Calculate cosine similarity
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    normA = Math.sqrt(normA);
    normB = Math.sqrt(normB);

    if (normA === 0 || normB === 0) return 0;

    return dotProduct / (normA * normB);
  }
}
