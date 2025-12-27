# ML Recommendation System

Technical documentation for Audiio's machine learning recommendation engine.

## Overview

Audiio uses ML to provide personalized music recommendations:

- **Content-based** - Based on track features
- **Collaborative** - Based on user behavior
- **Hybrid** - Combining both approaches

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                   Recommendation Engine                      │
│                                                              │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐   │
│  │  Feature      │  │   Embedding   │  │  User Profile │   │
│  │  Extraction   │  │   Model       │  │   Builder     │   │
│  └───────┬───────┘  └───────┬───────┘  └───────┬───────┘   │
│          │                  │                  │            │
│          └──────────────────┼──────────────────┘            │
│                             │                               │
│                    ┌────────▼────────┐                      │
│                    │  Recommendation │                      │
│                    │    Generator    │                      │
│                    └────────┬────────┘                      │
│                             │                               │
│                    ┌────────▼────────┐                      │
│                    │   Re-ranking    │                      │
│                    │   & Filtering   │                      │
│                    └─────────────────┘                      │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Components

### Feature Extraction

Extract audio features from tracks:

```typescript
// packages/ml-core/src/features.ts
interface AudioFeatures {
  tempo: number;           // BPM
  key: number;             // 0-11 (C to B)
  mode: number;            // 0 = minor, 1 = major
  energy: number;          // 0-1
  danceability: number;    // 0-1
  valence: number;         // 0-1 (mood)
  acousticness: number;    // 0-1
  instrumentalness: number; // 0-1
  speechiness: number;     // 0-1
  loudness: number;        // dB
}

export async function extractFeatures(audioUrl: string): Promise<AudioFeatures> {
  // Use Web Audio API for analysis
  const audioContext = new AudioContext();
  const response = await fetch(audioUrl);
  const arrayBuffer = await response.arrayBuffer();
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

  // Analyze audio
  const tempo = await analyzeTempo(audioBuffer);
  const key = await analyzeKey(audioBuffer);
  const energy = await analyzeEnergy(audioBuffer);
  // ... more analysis

  return {
    tempo,
    key,
    mode: key.mode,
    energy,
    danceability: calculateDanceability(tempo, energy),
    valence: calculateValence(key, energy),
    acousticness: await analyzeAcousticness(audioBuffer),
    instrumentalness: await analyzeInstrumentalness(audioBuffer),
    speechiness: await analyzeSpeechiness(audioBuffer),
    loudness: await analyzeLoudness(audioBuffer),
  };
}
```

### Embedding Model

Generate vector embeddings for tracks:

```typescript
// packages/ml-core/src/embeddings.ts
import * as tf from '@tensorflow/tfjs';

interface TrackEmbedding {
  trackId: string;
  vector: number[];       // 128-dimensional
  features: AudioFeatures;
}

export class EmbeddingModel {
  private model: tf.LayersModel | null = null;

  async load(): Promise<void> {
    this.model = await tf.loadLayersModel('file://model/embedding-model.json');
  }

  async embed(features: AudioFeatures): Promise<number[]> {
    if (!this.model) throw new Error('Model not loaded');

    const input = tf.tensor2d([[
      features.tempo / 200,  // Normalize
      features.energy,
      features.danceability,
      features.valence,
      features.acousticness,
      features.instrumentalness,
      features.speechiness,
      (features.loudness + 60) / 60,  // Normalize
      features.key / 12,
      features.mode,
    ]]);

    const embedding = this.model.predict(input) as tf.Tensor;
    const vector = await embedding.data();

    input.dispose();
    embedding.dispose();

    return Array.from(vector);
  }

  async findSimilar(
    queryVector: number[],
    candidates: TrackEmbedding[],
    limit: number = 10
  ): Promise<{ trackId: string; similarity: number }[]> {
    const similarities = candidates.map(candidate => ({
      trackId: candidate.trackId,
      similarity: this.cosineSimilarity(queryVector, candidate.vector),
    }));

    return similarities
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }
}
```

### User Profile

Build user taste profile from listening history:

```typescript
// packages/ml-core/src/user-profile.ts
interface UserProfile {
  userId: string;
  tasteVector: number[];          // Aggregated from liked tracks
  genreWeights: Record<string, number>;
  artistWeights: Record<string, number>;
  recentlyPlayed: string[];       // Track IDs
  listenHistory: ListenEntry[];
}

interface ListenEntry {
  trackId: string;
  timestamp: Date;
  duration: number;
  completed: boolean;
  rating?: 'like' | 'dislike';
}

export class UserProfileBuilder {
  private embeddingModel: EmbeddingModel;

  async buildProfile(userId: string, history: ListenEntry[]): Promise<UserProfile> {
    // Weight recent listens more heavily
    const weightedHistory = history.map((entry, i) => ({
      ...entry,
      weight: this.calculateWeight(entry, history.length - i),
    }));

    // Get embeddings for liked tracks
    const likedTracks = weightedHistory.filter(e => e.rating === 'like');
    const likedEmbeddings = await Promise.all(
      likedTracks.map(e => this.getTrackEmbedding(e.trackId))
    );

    // Compute weighted average for taste vector
    const tasteVector = this.computeWeightedAverage(
      likedEmbeddings.map(e => e.vector),
      likedTracks.map(e => e.weight)
    );

    // Build genre and artist weights
    const genreWeights = this.buildGenreWeights(weightedHistory);
    const artistWeights = this.buildArtistWeights(weightedHistory);

    return {
      userId,
      tasteVector,
      genreWeights,
      artistWeights,
      recentlyPlayed: history.slice(0, 50).map(e => e.trackId),
      listenHistory: history,
    };
  }

  private calculateWeight(entry: ListenEntry, recency: number): number {
    let weight = 1;

    // Recency decay
    weight *= Math.exp(-recency / 100);

    // Completion bonus
    if (entry.completed) weight *= 1.5;

    // Rating multiplier
    if (entry.rating === 'like') weight *= 2;
    if (entry.rating === 'dislike') weight *= -1;

    return weight;
  }

  private computeWeightedAverage(vectors: number[][], weights: number[]): number[] {
    const dimension = vectors[0].length;
    const result = new Array(dimension).fill(0);
    let totalWeight = 0;

    for (let i = 0; i < vectors.length; i++) {
      const weight = weights[i];
      totalWeight += Math.abs(weight);

      for (let j = 0; j < dimension; j++) {
        result[j] += vectors[i][j] * weight;
      }
    }

    return result.map(v => v / totalWeight);
  }
}
```

### Recommendation Generator

Generate recommendations from profile:

```typescript
// packages/ml-core/src/recommender.ts
interface Recommendation {
  trackId: string;
  score: number;
  reason: RecommendationReason;
}

type RecommendationReason =
  | { type: 'similar-to-liked'; likedTrackId: string }
  | { type: 'artist-you-like'; artistId: string }
  | { type: 'genre-match'; genre: string }
  | { type: 'trending' }
  | { type: 'new-release' };

export class RecommendationGenerator {
  private embeddingModel: EmbeddingModel;
  private trackIndex: TrackIndex;

  async generateRecommendations(
    profile: UserProfile,
    count: number = 50
  ): Promise<Recommendation[]> {
    const recommendations: Recommendation[] = [];

    // 1. Similar to taste vector
    const similarTracks = await this.findSimilarToTaste(profile, count * 2);
    recommendations.push(...similarTracks);

    // 2. From favorite artists
    const artistTracks = await this.findFromFavoriteArtists(profile, count / 2);
    recommendations.push(...artistTracks);

    // 3. Trending in preferred genres
    const trending = await this.findTrendingInGenres(profile, count / 2);
    recommendations.push(...trending);

    // 4. New releases
    const newReleases = await this.findNewReleases(profile, count / 4);
    recommendations.push(...newReleases);

    // De-duplicate and filter
    const filtered = this.filterRecommendations(recommendations, profile);

    // Re-rank
    const reranked = this.rerank(filtered, profile);

    return reranked.slice(0, count);
  }

  private async findSimilarToTaste(
    profile: UserProfile,
    count: number
  ): Promise<Recommendation[]> {
    const candidates = await this.trackIndex.getAll();
    const similar = await this.embeddingModel.findSimilar(
      profile.tasteVector,
      candidates,
      count
    );

    return similar.map(s => ({
      trackId: s.trackId,
      score: s.similarity,
      reason: { type: 'similar-to-liked', likedTrackId: 'aggregated' },
    }));
  }

  private filterRecommendations(
    recommendations: Recommendation[],
    profile: UserProfile
  ): Recommendation[] {
    const recentlyPlayed = new Set(profile.recentlyPlayed);
    const disliked = new Set(
      profile.listenHistory
        .filter(e => e.rating === 'dislike')
        .map(e => e.trackId)
    );

    return recommendations.filter(r =>
      !recentlyPlayed.has(r.trackId) && !disliked.has(r.trackId)
    );
  }

  private rerank(
    recommendations: Recommendation[],
    profile: UserProfile
  ): Recommendation[] {
    return recommendations.map(r => ({
      ...r,
      score: this.computeFinalScore(r, profile),
    })).sort((a, b) => b.score - a.score);
  }

  private computeFinalScore(rec: Recommendation, profile: UserProfile): number {
    let score = rec.score;

    // Boost based on reason
    switch (rec.reason.type) {
      case 'similar-to-liked':
        score *= 1.2;
        break;
      case 'artist-you-like':
        score *= 1.3;
        break;
      case 'new-release':
        score *= 1.1;
        break;
    }

    // Diversity factor (reduce score for same artist)
    // ... implementation

    return score;
  }
}
```

### Discovery Sections

Generate different recommendation sections:

```typescript
// packages/ui/src/stores/recommendation-store.ts
interface DiscoverySection {
  id: string;
  title: string;
  type: 'horizontal' | 'large-cards' | 'list';
  tracks: Track[];
  reason?: string;
}

export const useRecommendationStore = create<RecommendationState>()((set, get) => ({
  sections: [],
  isLoading: false,

  generateDiscovery: async () => {
    set({ isLoading: true });

    const profile = await getUserProfile();
    const recommender = new RecommendationGenerator();

    const sections: DiscoverySection[] = [];

    // Quick Picks
    const quickPicks = await recommender.generateQuickPicks(profile, 10);
    sections.push({
      id: 'quick-picks',
      title: 'Quick Picks',
      type: 'horizontal',
      tracks: quickPicks,
    });

    // Because You Like [Artist]
    const topArtists = getTopArtists(profile, 3);
    for (const artist of topArtists) {
      const similar = await recommender.findSimilarToArtist(artist.id, 10);
      sections.push({
        id: `because-${artist.id}`,
        title: `Because you like ${artist.name}`,
        type: 'horizontal',
        tracks: similar,
        reason: `Similar to ${artist.name}`,
      });
    }

    // Weekly Rotation
    const weekly = await recommender.generateWeeklyMix(profile, 30);
    sections.push({
      id: 'weekly-rotation',
      title: 'Your Weekly Rotation',
      type: 'large-cards',
      tracks: weekly,
    });

    // New Releases
    const newReleases = await recommender.findNewReleases(profile, 15);
    sections.push({
      id: 'new-releases',
      title: 'New Releases For You',
      type: 'horizontal',
      tracks: newReleases,
    });

    set({ sections, isLoading: false });
  },
}));
```

## Training

### Data Collection

```typescript
// Collect training data from user interactions
interface TrainingExample {
  trackA: TrackEmbedding;
  trackB: TrackEmbedding;
  label: number;  // 1 = similar (user liked both), 0 = different
}

async function collectTrainingData(): Promise<TrainingExample[]> {
  const examples: TrainingExample[] = [];

  for (const user of users) {
    const likedTracks = await getLikedTracks(user.id);

    // Positive examples: pairs of liked tracks
    for (let i = 0; i < likedTracks.length; i++) {
      for (let j = i + 1; j < likedTracks.length; j++) {
        examples.push({
          trackA: await getEmbedding(likedTracks[i]),
          trackB: await getEmbedding(likedTracks[j]),
          label: 1,
        });
      }
    }

    // Negative examples: liked vs random
    const randomTracks = await getRandomTracks(likedTracks.length);
    for (let i = 0; i < likedTracks.length; i++) {
      examples.push({
        trackA: await getEmbedding(likedTracks[i]),
        trackB: await getEmbedding(randomTracks[i]),
        label: 0,
      });
    }
  }

  return examples;
}
```

### Model Training

```typescript
// Train embedding model
async function trainEmbeddingModel(examples: TrainingExample[]): Promise<void> {
  const model = tf.sequential({
    layers: [
      tf.layers.dense({ inputShape: [10], units: 64, activation: 'relu' }),
      tf.layers.dense({ units: 128, activation: 'relu' }),
      tf.layers.dense({ units: 128, activation: 'linear' }),
    ],
  });

  model.compile({
    optimizer: tf.train.adam(0.001),
    loss: 'contrastiveLoss',
  });

  const xs = tf.tensor2d(examples.map(e => [...e.trackA.features, ...e.trackB.features]));
  const ys = tf.tensor1d(examples.map(e => e.label));

  await model.fit(xs, ys, {
    epochs: 100,
    batchSize: 32,
    validationSplit: 0.2,
  });

  await model.save('file://model/embedding-model');
}
```

## Caching

```typescript
// Cache embeddings and recommendations
class RecommendationCache {
  private cache: LRUCache<string, any>;

  constructor() {
    this.cache = new LRUCache({ max: 1000 });
  }

  getCachedRecommendations(userId: string): Recommendation[] | null {
    const key = `recommendations:${userId}`;
    return this.cache.get(key) || null;
  }

  cacheRecommendations(userId: string, recommendations: Recommendation[]): void {
    const key = `recommendations:${userId}`;
    this.cache.set(key, recommendations, { ttl: 3600000 }); // 1 hour
  }

  getEmbedding(trackId: string): number[] | null {
    return this.cache.get(`embedding:${trackId}`) || null;
  }

  cacheEmbedding(trackId: string, embedding: number[]): void {
    this.cache.set(`embedding:${trackId}`, embedding, { ttl: 86400000 }); // 24 hours
  }
}
```

## Performance

### Batch Processing

```typescript
// Process embeddings in batches
async function batchEmbed(tracks: Track[]): Promise<TrackEmbedding[]> {
  const batchSize = 32;
  const results: TrackEmbedding[] = [];

  for (let i = 0; i < tracks.length; i += batchSize) {
    const batch = tracks.slice(i, i + batchSize);
    const features = await Promise.all(batch.map(extractFeatures));
    const embeddings = await embeddingModel.embedBatch(features);

    results.push(...embeddings.map((vector, j) => ({
      trackId: batch[j].id,
      vector,
      features: features[j],
    })));
  }

  return results;
}
```

### Approximate Nearest Neighbors

```typescript
// Use HNSW for fast similarity search
import { HierarchicalNSW } from 'hnswlib-node';

class TrackIndex {
  private index: HierarchicalNSW;

  constructor(dimension: number = 128) {
    this.index = new HierarchicalNSW('cosine', dimension);
    this.index.initIndex(100000); // Max 100k tracks
  }

  addTrack(trackId: string, embedding: number[]): void {
    const id = this.trackIdToInt(trackId);
    this.index.addPoint(embedding, id);
  }

  findSimilar(embedding: number[], k: number): string[] {
    const result = this.index.searchKnn(embedding, k);
    return result.neighbors.map(id => this.intToTrackId(id));
  }
}
```

## Related

- [Architecture](architecture.md) - System design
- [Stores](stores.md) - State management
- [Testing](testing.md) - Testing ML components

