# Audiio ML SDK - Developer Guide

This guide shows you how to build a custom recommendation algorithm for Audiio using the ML SDK.

## Quick Start

### 1. Create Your Algorithm Package

```bash
mkdir my-algo
cd my-algo
npm init -y
npm install @audiio/ml-sdk
```

### 2. Create the Manifest

```typescript
// src/manifest.ts
import type { AlgorithmManifest } from '@audiio/ml-sdk';

export const MY_ALGO_MANIFEST: AlgorithmManifest = {
  id: 'my-algo',
  name: 'My Custom Algorithm',
  version: '1.0.0',
  author: 'Your Name',
  description: 'A custom recommendation algorithm',

  capabilities: {
    scoring: true,
    batchScoring: true,
    ranking: true,
    training: false,      // Set true if you implement training
    radioGeneration: false,
    similaritySearch: false,
    moodDetection: false,
    providesAudioFeatures: false,
    providesEmotionFeatures: false,
    providesLyricsAnalysis: false,
    providesFingerprinting: false,
    providesEmbeddings: false,
  },

  requirements: {
    needsListenHistory: true,
    needsDislikedTracks: true,
    needsUserPreferences: true,
    needsTemporalPatterns: false,
    needsAudioFeatures: true,  // We'll use features from other providers
    needsLyrics: false,
    estimatedModelSize: '1MB',
    estimatedMemoryUsage: '50MB',
    requiresGPU: false,
    requiresWASM: false,
    minListenEvents: 10,
    minLibrarySize: 5,
  },

  settings: [
    {
      key: 'diversityLevel',
      label: 'Diversity',
      description: 'How much variety to include',
      type: 'select',
      default: 'medium',
      options: [
        { value: 'low', label: 'Less variety' },
        { value: 'medium', label: 'Balanced' },
        { value: 'high', label: 'More variety' },
      ],
      category: 'General',
    },
  ],
};
```

### 3. Implement the Algorithm

```typescript
// src/algorithm.ts
import {
  BaseAlgorithm,
  type AlgorithmManifest,
  type Track,
  type ScoredTrack,
  type AggregatedFeatures,
  type TrackScore,
  type ScoringContext,
} from '@audiio/ml-sdk';

import { MY_ALGO_MANIFEST } from './manifest';

export class MyAlgorithm extends BaseAlgorithm {
  manifest: AlgorithmManifest = MY_ALGO_MANIFEST;

  // Called once when the algorithm loads
  protected async onInitialize(): Promise<void> {
    this.log('My Algorithm initialized!');
  }

  // Called when the algorithm is unloaded
  protected async onDispose(): Promise<void> {
    this.log('My Algorithm disposed');
  }

  // Score a single track
  async scoreTrack(
    track: Track,
    features: AggregatedFeatures,
    context: ScoringContext
  ): Promise<TrackScore> {
    const score = this.calculateScore(track, features, context);

    return {
      trackId: track.id,
      finalScore: score,
      confidence: 0.7,
      components: {
        base: score,
      },
      explanation: ['Scored by My Algorithm'],
    };
  }

  // Score multiple tracks
  async scoreBatch(
    tracks: Track[],
    context: ScoringContext
  ): Promise<TrackScore[]> {
    const scores: TrackScore[] = [];

    for (const track of tracks) {
      // Get features from core
      const features = await this.endpoints.features.getAggregatedFeatures(track.id);
      const score = await this.scoreTrack(track, features, context);
      scores.push(score);
    }

    return scores;
  }

  // Rank candidates
  async rankCandidates(
    candidates: Track[],
    context: ScoringContext
  ): Promise<ScoredTrack[]> {
    const scores = await this.scoreBatch(candidates, context);

    return scores
      .map((score, index) => ({
        ...candidates[index],
        score: {
          trackId: score.trackId,
          finalScore: score.finalScore,
          confidence: score.confidence,
          components: score.components as Record<string, number | undefined>,
          explanation: score.explanation,
        },
      }))
      .sort((a, b) => b.score.finalScore - a.score.finalScore);
  }

  // Your scoring logic
  private calculateScore(
    track: Track,
    features: AggregatedFeatures,
    context: ScoringContext
  ): number {
    let score = 50; // Base score

    // Boost if user has listened to this artist before
    const artistPlays = this.getArtistPlayCount(track.artist, context);
    if (artistPlays > 0) {
      score += Math.min(artistPlays * 2, 20);
    }

    // Boost based on energy matching
    if (features.audio?.energy !== undefined && context.targetEnergy !== undefined) {
      const energyMatch = 1 - Math.abs(features.audio.energy - context.targetEnergy);
      score += energyMatch * 15;
    }

    // Apply diversity setting
    const diversity = this.getSetting('diversityLevel', 'medium');
    if (diversity === 'high') {
      // Add randomness for variety
      score += (Math.random() - 0.5) * 20;
    }

    return Math.max(0, Math.min(100, score));
  }

  private getArtistPlayCount(artist: string, context: ScoringContext): number {
    return context.recentTracks.filter(t => t.artist === artist).length;
  }
}
```

### 4. Export Your Algorithm

```typescript
// src/index.ts
export { MyAlgorithm } from './algorithm';
export { MY_ALGO_MANIFEST } from './manifest';
```

### 5. Build and Package

```json
// package.json
{
  "name": "my-algo",
  "version": "1.0.0",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc"
  },
  "peerDependencies": {
    "@audiio/ml-sdk": "^1.0.0"
  }
}
```

## Using Algorithm Endpoints

The `endpoints` object provides access to Audiio's core services:

### Library Access

```typescript
// Get track by ID
const track = await this.endpoints.library.getTrack('track-123');

// Search tracks
const results = await this.endpoints.library.searchTracks({
  query: 'rock',
  limit: 50,
});

// Get all tracks
const allTracks = await this.endpoints.library.getAllTracks();
```

### User Data

```typescript
// Get listening history
const history = await this.endpoints.user.getListenHistory({
  limit: 100,
  since: Date.now() - 7 * 24 * 60 * 60 * 1000, // Last 7 days
});

// Get liked tracks
const liked = await this.endpoints.user.getLikedTrackIds();

// Get disliked tracks
const disliked = await this.endpoints.user.getDislikedTrackIds();

// Get preferences
const prefs = await this.endpoints.user.getPreferences();
```

### Feature Access

```typescript
// Get aggregated features for a track
const features = await this.endpoints.features.getAggregatedFeatures('track-123');

// Register your own feature provider
this.endpoints.features.register({
  id: 'my-algo:custom-features',
  priority: 100,
  capabilities: {
    audioAnalysis: true,
    // ...
  },
  getAudioFeatures: async (trackId) => {
    // Your feature extraction logic
    return { bpm: 120, energy: 0.8 };
  },
});
```

### Training Data

```typescript
// Get recent user events
const events = await this.endpoints.training.getRecentEvents(1000);

// Get full training dataset
const dataset = await this.endpoints.training.getFullDataset();

// Save trained model
await this.endpoints.storage.saveModel('my-model', modelData);

// Load trained model
const model = await this.endpoints.storage.loadModel('my-model');
```

## Implementing Training

If your algorithm supports training:

```typescript
class MyTrainableAlgorithm extends BaseAlgorithm {
  private modelWeights: number[] = [];

  manifest = {
    // ...
    capabilities: {
      training: true,
      // ...
    },
  };

  async train(data: TrainingDataset): Promise<TrainingResult> {
    this.log(`Training on ${data.events.length} events`);

    // Prepare training data
    const samples = this.prepareTrainingSamples(data);

    // Train your model
    for (let epoch = 0; epoch < 10; epoch++) {
      const loss = this.trainEpoch(samples);
      this.log(`Epoch ${epoch + 1}: loss = ${loss}`);
    }

    // Save model
    await this.endpoints.storage.saveModel('weights', {
      weights: this.modelWeights,
      version: Date.now(),
    });

    return {
      success: true,
      metrics: {
        accuracy: 0.85,
        loss: 0.15,
      },
      trainingDuration: 5000,
      samplesUsed: samples.length,
      modelVersion: `v${Date.now()}`,
    };
  }

  getTrainingStatus(): TrainingStatus {
    return {
      isTraining: false,
      progress: 0,
      phase: 'idle',
    };
  }

  async needsTraining(): Promise<boolean> {
    const newEvents = await this.endpoints.training.getNewEventCount();
    return newEvents >= 20;
  }
}
```

## Adding Feature Providers

Contribute features to the shared pool:

```typescript
protected async onInitialize(): Promise<void> {
  // Register audio feature provider
  this.endpoints.features.register({
    id: 'my-algo:audio',
    priority: 50,  // Lower = lower priority, higher providers override
    capabilities: {
      audioAnalysis: true,
      emotionDetection: false,
      lyricsAnalysis: false,
      similarity: false,
      fingerprinting: false,
      embeddings: false,
      canAnalyzeUrl: false,
      canAnalyzeFile: true,
      canAnalyzeBuffer: true,
      supportsRealtime: false,
      requiresWasm: false,
    },
    getAudioFeatures: async (trackId) => {
      // Return cached or computed features
      return this.myAudioAnalyzer.analyze(trackId);
    },
    analyzeAudioBuffer: async (buffer, sampleRate) => {
      return this.myAudioAnalyzer.analyzeBuffer(buffer, sampleRate);
    },
  });
}

protected async onDispose(): Promise<void> {
  // Unregister when disposing
  this.endpoints.features.unregister('my-algo:audio');
}
```

## Handling User Events

React to user actions in real-time:

```typescript
async onUserEvent(event: UserEvent): Promise<void> {
  switch (event.type) {
    case 'play':
      this.updatePlayCount(event.track.id);
      break;

    case 'skip':
      // User skipped early - might not like this
      if (event.progress < 0.3) {
        this.decreasePreference(event.track.id);
      }
      break;

    case 'like':
      this.increasePreference(event.track.id);
      this.boostSimilarTracks(event.track.id);
      break;

    case 'dislike':
      this.markDisliked(event.track.id);
      break;
  }

  // Invalidate cached scores
  this.invalidateCache(event.track.id);
}
```

## Best Practices

### 1. Use Caching

```typescript
import { MemoryCache } from '@audiio/ml-sdk';

class MyAlgorithm extends BaseAlgorithm {
  private scoreCache = new MemoryCache<TrackScore>(1000, 300000); // 5 min TTL

  async scoreTrack(track, features, context) {
    const cached = this.scoreCache.get(track.id);
    if (cached) return cached;

    const score = await this.computeScore(track, features, context);
    this.scoreCache.set(track.id, score);
    return score;
  }
}
```

### 2. Handle Missing Features

```typescript
private calculateScore(features: AggregatedFeatures): number {
  let score = 50;

  // Safely access optional features
  if (features.audio?.energy !== undefined) {
    score += features.audio.energy * 10;
  }

  if (features.emotion?.valence !== undefined) {
    score += features.emotion.valence * 5;
  }

  return score;
}
```

### 3. Provide Explanations

```typescript
private buildExplanation(track: Track, components: Record<string, number>): string[] {
  const explanations: string[] = [];

  if (components.artistAffinity > 10) {
    explanations.push(`You often listen to ${track.artist}`);
  }

  if (components.genreMatch > 15) {
    explanations.push(`Matches your ${track.genre} preferences`);
  }

  if (components.discovery > 5) {
    explanations.push('Discover something new');
  }

  return explanations;
}
```

### 4. Use Settings Properly

```typescript
// Read settings with defaults
const level = this.getSetting('diversityLevel', 'medium');

// React to setting changes (implement if needed)
onSettingChange(key: string, value: unknown): void {
  if (key === 'diversityLevel') {
    this.diversityMultiplier = this.calculateDiversityMultiplier(value);
    this.invalidateCache(); // Scores will change
  }
}
```

## Testing Your Algorithm

```typescript
// test/algorithm.test.ts
import { MyAlgorithm } from '../src/algorithm';

describe('MyAlgorithm', () => {
  let algorithm: MyAlgorithm;

  beforeEach(async () => {
    algorithm = new MyAlgorithm();
    await algorithm.initialize(mockEndpoints);
  });

  it('should score tracks', async () => {
    const score = await algorithm.scoreTrack(
      mockTrack,
      mockFeatures,
      mockContext
    );

    expect(score.finalScore).toBeGreaterThanOrEqual(0);
    expect(score.finalScore).toBeLessThanOrEqual(100);
    expect(score.confidence).toBeGreaterThan(0);
  });

  it('should rank candidates correctly', async () => {
    const ranked = await algorithm.rankCandidates(mockTracks, mockContext);

    // Should be sorted by score descending
    for (let i = 1; i < ranked.length; i++) {
      expect(ranked[i - 1].score.finalScore)
        .toBeGreaterThanOrEqual(ranked[i].score.finalScore);
    }
  });
});
```

## Distribution

Once built, your algorithm can be:

1. **Bundled with Audiio**: Add to `addons/` directory
2. **Published to npm**: Users install and configure
3. **Shared as addon file**: Distributed as `.audiio-addon` package

See the [Addon Packaging Guide](./PACKAGING.md) for details.
