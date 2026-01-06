# ML Utilities

Core utility functions for the Audiio ML recommendation system. This module provides foundational tools for feature normalization, scoring calculations, neural network training, caching, vector operations, and audio processing.

## Table of Contents

- [Overview](#overview)
- [Structure](#structure)
- [Files](#files)
  - [index.ts](#indexts)
  - [feature-utils.ts](#feature-utilsts)
  - [scoring-utils.ts](#scoring-utilsts)
  - [ml-utils.ts](#ml-utilsts)
  - [cache-utils.ts](#cache-utilsts)
  - [vector-utils.ts](#vector-utilsts)
  - [audio-processor.ts](#audio-processorts)
- [Usage Examples](#usage-examples)
- [Dependencies](#dependencies)
- [Related Modules](#related-modules)

## Overview

The utilities module serves as the foundation for the ML recommendation system, providing:

1. **Feature Engineering** - Normalization and encoding of audio features, genres, moods, and temporal data for ML model input
2. **Scoring Algorithms** - Calculation of recommendation scores including temporal fit, diversity, exploration, and recency
3. **Neural Network Helpers** - TensorFlow.js utilities for model building, training, and inference
4. **Caching Infrastructure** - In-memory caching with TTL, LRU eviction, and async loading support
5. **Vector Mathematics** - Operations for embedding similarity calculations (cosine similarity, normalization, blending)
6. **Audio Analysis** - DSP operations using Essentia.js WASM with pure JS fallbacks

These utilities are imported throughout the ML system by scorers, providers, the feature aggregator, and the embedding engine.

## Structure

```
utils/
├── index.ts              - Barrel exports + re-exports from types
├── feature-utils.ts      - Feature normalization and encoding
├── scoring-utils.ts      - Score calculation and combination
├── ml-utils.ts           - TensorFlow.js model utilities
├── cache-utils.ts        - Caching classes (Memory, LRU, Async, BatchLoader)
├── vector-utils.ts       - Vector math for embeddings
└── audio-processor.ts    - Audio DSP with Essentia WASM
```

## Files

### index.ts

**Purpose**: Barrel file that exports all utilities and re-exports event/mood utilities from the types module.

**Exports**:
- All exports from `feature-utils.ts`
- All exports from `scoring-utils.ts`
- All exports from `ml-utils.ts`
- All exports from `cache-utils.ts`
- All exports from `vector-utils.ts`
- All exports from `audio-processor.ts`
- Re-exports from `../types/events`: `isPositiveSignal`, `isNegativeSignal`, `getEventWeight`, `DISLIKE_REASON_WEIGHTS`
- Re-exports from `../types/mood`: `MOOD_PROFILES`, `getMoodProfiles`, `getMoodProfile`

**Used by**: All ML modules import utilities through this index.

---

### feature-utils.ts

**Purpose**: Helpers for normalizing and encoding features for ML model input.

**Key Exports**:

| Function | Description |
|----------|-------------|
| `normalize(value, min, max)` | Min-max normalize a value to 0-1 range |
| `zNormalize(value, mean, std)` | Z-score (standard) normalization |
| `logNormalize(value, maxValue)` | Log-normalize counts (play counts, etc.) |
| `normalizeBpm(bpm)` | Normalize BPM to 0-1 (60-200 range) |
| `normalizeDuration(seconds)` | Normalize duration to 0-1 (0-600s range) |
| `normalizeLoudness(db)` | Normalize loudness from dB to 0-1 |
| `normalizeYear(year)` | Normalize release year (1950-current) |
| `normalizeAudioFeatures(features)` | Normalize all audio features (min-max) |
| `zNormalizeAudioFeatures(features)` | Z-score normalize audio features |
| `normalizeKey(key)` | Convert musical key to normalized 0-1 |
| `keyToNumber(key)` | Convert key name to pitch class (0-11) |
| `getHarmonicCompatibility(key1, mode1, key2, mode2)` | Circle of Fifths compatibility score |
| `encodeHour(hour)` | Cyclical sin/cos encoding for hour |
| `encodeDay(day)` | Cyclical sin/cos encoding for day of week |
| `encodeGenres(genres)` | Multi-hot encode genres (16 categories) |
| `encodeMood(mood)` | One-hot encode mood category |
| `valenceArousalToMood(valence, arousal)` | Map valence/arousal to mood (Russell's model) |
| `buildFeatureVector(track, features, context, stats)` | Construct complete feature vector for ML |
| `flattenFeatureVector(features)` | Flatten FeatureVector to number array |
| `getFeatureVectorDimension()` | Get expected dimension of flattened vector |

**Dependencies**: Types from `../types/track`, `../types/training`, `../types/events`

**Used by**:
- `embedding-provider.ts` - Building feature vectors for embedding generation
- `hybrid-scorer.ts` - Normalizing audio features for scoring
- `neural-scorer.ts` - Preparing input features for neural network
- `event-recorder.ts` - Encoding features for training samples

---

### scoring-utils.ts

**Purpose**: Helpers for calculating and combining recommendation scores.

**Key Exports**:

| Function | Description |
|----------|-------------|
| `calculateWeightedScore(components, weights)` | Combine score components with weights |
| `combineScores(scores)` | Weighted average of multiple scores |
| `applyPenalties(baseScore, penalties)` | Apply penalty deductions to score |
| `DEFAULT_ENERGY_CURVE` | 24-hour energy preference curve |
| `getExpectedEnergy(hour)` | Get expected energy for time of day |
| `getTimeOfDayLabel(hour)` | Get label (morning, afternoon, etc.) |
| `calculateTemporalFit(hour, energy, curve)` | Score track energy vs time preference |
| `calculateEnhancedTemporalFit(hour, energy, valence, history)` | Enhanced temporal scoring with mood |
| `calculateSessionFlowScore(energy, session, maxJump)` | Score energy transition smoothness |
| `calculateDiversityScore(track, artists, genres, ...)` | Score contribution to variety |
| `calculateExplorationBonus(isNewArtist, isNewGenre, ...)` | Epsilon-greedy exploration bonus |
| `calculateSerendipityScore(track, topGenres, topArtists, ...)` | Unexpected but fitting score |
| `calculateRecentPlayPenalty(lastPlayedMs, now)` | Penalty for recently played tracks |
| `calculateRecencyScore(lastPlayedMs, halfLife)` | Exponential decay recency score |
| `calculateAudioMatchScore(features1, features2, weights)` | Audio feature similarity score |
| `generateExplanation(components, thresholds)` | Generate human-readable explanation |
| `softmax(scores, temperature)` | Convert scores to probabilities |
| `weightedRandomSelect(items, scores, count)` | Probabilistic selection based on scores |

**Constants**:
- `DEFAULT_ENERGY_CURVE`: 24-element array of preferred energy by hour (0.10-0.85)

**Dependencies**: Types from `../types/scoring`, `../types/track`

**Used by**:
- `hybrid-scorer.ts` - All score calculation functions
- `neural-scorer.ts` - Temporal and diversity scoring
- `sequential-scorer.ts` - Session flow calculations
- `radio-generator.ts` - `weightedRandomSelect` for track selection

---

### ml-utils.ts

**Purpose**: TensorFlow.js helpers for building and training neural network models.

**Key Exports**:

| Function | Description |
|----------|-------------|
| `createFeedforwardModel(inputDim, hidden, outputDim, options)` | Create a dense neural network |
| `createRecommendationModel(inputDim)` | Create default Audiio architecture (64-128-64-32) |
| `compileForBinaryClassification(model, lr)` | Compile with binary crossentropy |
| `compileForRegression(model, lr)` | Compile with MSE loss |
| `trainModel(model, x, y, options)` | Train model and return metrics |
| `calculateClassWeights(labels)` | Balance weights for imbalanced data |
| `shuffleArrays(arr1, arr2)` | Fisher-Yates shuffle in unison |
| `trainValSplit(data, split)` | Split data into train/validation |
| `predictBatch(model, features)` | Batch inference |
| `getModelSummary(model)` | Get model summary as string |
| `calculateModelChecksum(model)` | Integrity checksum from weights |
| `disposeTensors(...tensors)` | Safe tensor disposal |
| `getMemoryInfo()` | Get TensorFlow.js memory usage |
| `createEarlyStoppingCallback(patience, monitor)` | Early stopping callback |
| `createProgressCallback(onProgress, epochs)` | Training progress callback |

**Interfaces**:
- `TrainOptions` - Training configuration (epochs, batch size, validation split, etc.)

**Dependencies**: `@tensorflow/tfjs`, types from `../types/training`

**Used by**:
- `neural-scorer.ts` - Model creation and training
- `trainer.ts` - Training pipeline
- `training-scheduler.ts` - Scheduled model training

---

### cache-utils.ts

**Purpose**: Caching utilities for features, scores, and expensive computations.

**Key Exports**:

| Class/Function | Description |
|----------------|-------------|
| `MemoryCache<T>` | TTL-based cache with LRU eviction |
| `LRUCache<T>` | Simple LRU cache without TTL |
| `AsyncCache<T>` | Cache with async loading function |
| `BatchLoader<K, V>` | Batches individual loads into bulk requests |
| `createCacheKey(...parts)` | Create consistent cache keys |
| `parseCacheKey(key)` | Parse cache key back to parts |

**MemoryCache Methods**:
- `get(key)` / `set(key, value, ttl?)` / `has(key)` / `delete(key)`
- `invalidateByPattern(regex)` - Bulk invalidation
- `cleanup()` - Remove expired entries
- `entries()` / `keys()` - Iteration
- `getStats()` - Hit rate and size statistics

**AsyncCache Methods**:
- `get(key)` - Get or load value
- `getBatch(keys)` - Parallel batch loading
- `invalidate(key)` / `invalidateByPattern(regex)`

**BatchLoader Features**:
- Collects individual `load(key)` calls
- Flushes when batch size reached or after delay
- Reduces API/database round trips

**Used by**:
- `feature-aggregator.ts` - `MemoryCache`, `BatchLoader`, `LRUCache`
- `embedding-provider.ts` - `AsyncCache` for embedding vectors
- `emotion-provider.ts` - `MemoryCache` for emotion analysis
- `essentia-provider.ts` - `MemoryCache` for audio features
- `fingerprint-provider.ts` - `MemoryCache` for audio fingerprints
- `genre-provider.ts` - `MemoryCache` for genre embeddings
- `lyrics-provider.ts` - `MemoryCache` for lyrics features

---

### vector-utils.ts

**Purpose**: Vector mathematics for embedding operations and similarity calculations.

**Key Exports**:

| Function | Description |
|----------|-------------|
| `normalizeVector(vector)` | L2 normalize to unit length |
| `cosineSimilarity(a, b)` | Cosine similarity (-1 to 1) |
| `euclideanDistance(a, b)` | Euclidean distance between vectors |
| `vectorMagnitude(vector)` | L2 norm of vector |
| `addVectors(a, b)` | Element-wise addition |
| `scaleVector(vector, scalar)` | Scalar multiplication |
| `averageVectors(vectors)` | Compute centroid |
| `blendVectors(a, b, weightA, weightB)` | Weighted combination |

**Type Support**: Functions accept both `Float32Array` and `number[]` where practical.

**Used by**:
- `embedding-engine.ts` - `normalizeVector` for embedding normalization
- `vector-index.ts` - `cosineSimilarity`, `euclideanDistance` for nearest neighbor search
- `playlist-generator.ts` - `normalizeVector`, `averageVectors`, `blendVectors` for playlist creation
- `taste-profile.ts` - `normalizeVector`, `cosineSimilarity` for taste similarity
- `genre-provider.ts` - `cosineSimilarity` for genre matching
- `endpoints/index.ts` - `cosineSimilarity` for API similarity calculations
- `feature-aggregator.ts` - `cosineSimilarity` for feature comparison

---

### audio-processor.ts

**Purpose**: Unified audio DSP using Essentia.js WASM with pure JavaScript fallbacks.

**Key Exports**:

| Export | Description |
|--------|-------------|
| `getAudioProcessor()` | Get singleton AudioProcessor instance |
| `resetAudioProcessor()` | Reset singleton (for testing) |
| `AudioProcessor` (class) | The implementation class |

**AudioProcessor Methods**:

| Method | Description |
|--------|-------------|
| `initialize()` | Load Essentia WASM module |
| `isEssentiaAvailable()` | Check if Essentia loaded successfully |
| `resample(data, fromRate, toRate)` | Resample audio to target sample rate |
| `computeMelSpectrogram(data, options)` | Compute mel spectrogram |
| `computeFFTMagnitude(frame)` | Compute FFT magnitude spectrum |
| `applyHannWindow(frame)` | Apply Hann window to audio frame |
| `extractMFCC(data, numCoeffs)` | Extract MFCC features |
| `analyzeAudio(data, sampleRate)` | Full audio analysis (BPM, key, energy, etc.) |
| `dispose()` | Cleanup resources |

**Interfaces**:
- `MelSpectrogramOptions` - Sample rate, window size, hop size, mel bands, frequency range
- `AudioAnalysisResult` - BPM, key, mode, energy, loudness, danceability, spectral centroid, ZCR, MFCC

**Algorithm Details**:
- Uses Essentia.js algorithms when available: `RhythmExtractor`, `KeyExtractor`, `Energy`, `Loudness`, `Danceability`, `SpectralCentroidTime`, `ZeroCrossingRate`, `MelBands`, `MFCC`
- Falls back to pure JS implementations: linear interpolation resampling, Cooley-Tukey FFT, manual mel filterbank
- Resamples to 44100 Hz for Essentia compatibility

**Used by**:
- `essentia-provider.ts` - Audio feature extraction
- `emotion-provider.ts` - Valence/arousal analysis
- `fingerprint-provider.ts` - Audio fingerprinting

---

## Usage Examples

### Feature Normalization

```typescript
import {
  normalizeAudioFeatures,
  buildFeatureVector,
  flattenFeatureVector,
  encodeGenres,
  encodeHour,
} from '../utils';

// Normalize raw audio features
const normalizedFeatures = normalizeAudioFeatures({
  bpm: 128,
  energy: 0.8,
  valence: 0.6,
  danceability: 0.75,
  key: 'G',
  mode: 'major',
});

// Build complete feature vector for ML
const featureVector = buildFeatureVector(track, audioFeatures, context, {
  playCount: 15,
  skipRatio: 0.1,
  completionRatio: 0.85,
  artistAffinity: 0.7,
  genreAffinity: 0.5,
});

// Flatten for neural network input
const mlInput = flattenFeatureVector(featureVector);
```

### Scoring Calculations

```typescript
import {
  calculateWeightedScore,
  calculateTemporalFit,
  calculateDiversityScore,
  calculateExplorationBonus,
  weightedRandomSelect,
  DEFAULT_ENERGY_CURVE,
} from '../utils';
import { DEFAULT_SCORING_WEIGHTS } from '../types/scoring';

// Calculate temporal fit for current hour
const temporalScore = calculateTemporalFit(
  new Date().getHours(),
  track.audioFeatures?.energy ?? 0.5,
  DEFAULT_ENERGY_CURVE
);

// Calculate diversity contribution
const diversityScore = calculateDiversityScore(
  track,
  sessionArtists,
  sessionGenres,
  2,  // max same artist
  3   // target genre variety
);

// Calculate final weighted score
const finalScore = calculateWeightedScore(
  {
    basePreference: 75,
    mlPrediction: 0.82,
    temporalFit: temporalScore,
    diversityScore,
    recentPlayPenalty: 5,
  },
  DEFAULT_SCORING_WEIGHTS
);

// Probabilistic track selection
const selectedTracks = weightedRandomSelect(candidates, scores, 10);
```

### ML Model Training

```typescript
import * as tf from '@tensorflow/tfjs';
import {
  createRecommendationModel,
  compileForBinaryClassification,
  trainModel,
  calculateClassWeights,
  createEarlyStoppingCallback,
  getFeatureVectorDimension,
} from '../utils';

// Create model
const inputDim = getFeatureVectorDimension();
const model = createRecommendationModel(inputDim);
compileForBinaryClassification(model, 0.001);

// Prepare data
const classWeights = calculateClassWeights(labels);

// Train with early stopping
const metrics = await trainModel(model, xTensor, yTensor, {
  epochs: 50,
  batchSize: 32,
  validationSplit: 0.2,
  classWeight: classWeights,
  callbacks: createEarlyStoppingCallback(10, 'val_loss'),
});

console.log(`Final accuracy: ${metrics.accuracy}`);
```

### Caching

```typescript
import { MemoryCache, AsyncCache, BatchLoader, createCacheKey } from '../utils';

// Simple TTL cache
const featureCache = new MemoryCache<AudioFeatures>(1000, 3600000); // 1hr TTL
featureCache.set(createCacheKey('features', trackId), features);
const cached = featureCache.get(createCacheKey('features', trackId));

// Async cache with loader
const embeddingCache = new AsyncCache<Float32Array>(
  async (trackId) => await computeEmbedding(trackId),
  1000,
  3600000
);
const embedding = await embeddingCache.get(trackId);

// Batch loader for database queries
const trackLoader = new BatchLoader<string, Track>(
  async (ids) => await db.getTracksByIds(ids),
  50,  // batch size
  10   // delay ms
);

// These will be batched together
const [track1, track2, track3] = await Promise.all([
  trackLoader.load('id1'),
  trackLoader.load('id2'),
  trackLoader.load('id3'),
]);
```

### Vector Operations

```typescript
import {
  cosineSimilarity,
  normalizeVector,
  averageVectors,
  blendVectors,
} from '../utils/vector-utils';

// Find similar tracks
const similarity = cosineSimilarity(embedding1, embedding2);

// Create taste profile from liked tracks
const tasteProfile = normalizeVector(
  averageVectors(likedTrackEmbeddings)
);

// Blend current taste with exploration
const explorationVector = blendVectors(
  tasteProfile,
  randomVector,
  0.8,  // 80% taste
  0.2   // 20% exploration
);
```

### Audio Processing

```typescript
import { getAudioProcessor } from '../utils';

const processor = getAudioProcessor();
await processor.initialize();

// Full audio analysis
const analysis = await processor.analyzeAudio(audioBuffer, 44100);
console.log(`BPM: ${analysis.bpm}, Key: ${analysis.key} ${analysis.mode}`);

// Compute mel spectrogram for ML input
const melSpec = processor.computeMelSpectrogram(audioBuffer, {
  sampleRate: 22050,
  nMels: 128,
  windowSize: 2048,
  hopSize: 512,
});
```

## Dependencies

**External**:
- `@tensorflow/tfjs` - Neural network operations (ml-utils.ts)
- `essentia.js` - Audio DSP WASM module (audio-processor.ts, optional)

**Internal Types**:
- `../types/track` - `Track`, `AudioFeatures`, `MusicalKey`, `MoodCategory`
- `../types/training` - `FeatureVector`, `NormalizedAudioFeatures`, `TrainingMetrics`
- `../types/scoring` - `ScoreComponents`, `ScoringWeights`, `TrackScore`
- `../types/events` - `ListenContext`, event utilities
- `../types/mood` - `MOOD_PROFILES`, mood utilities

## Related Modules

| Module | Relationship |
|--------|--------------|
| `../algorithm/` | Scorers use scoring-utils and feature-utils |
| `../providers/` | All providers use cache-utils; audio providers use audio-processor |
| `../embeddings/` | Embedding engine uses vector-utils and cache-utils |
| `../engine/` | Feature aggregator uses cache-utils extensively |
| `../learning/` | Event recorder and preference store use feature-utils |
| `../types/` | Types are imported; events/mood are re-exported through index |
