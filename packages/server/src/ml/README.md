# ML System

Complete machine learning system for music recommendations, scoring, and personalization in Audiio. This module provides the server's built-in ML engine that powers intelligent queue management, track scoring, and personalized discovery.

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Structure](#structure)
- [Directories](#directories)
  - [algorithm/](#algorithm)
  - [embeddings/](#embeddings)
  - [endpoints/](#endpoints)
  - [engine/](#engine)
  - [learning/](#learning)
  - [mood/](#mood)
  - [providers/](#providers)
  - [queue/](#queue)
  - [storage/](#storage)
  - [types/](#types)
  - [utils/](#utils)
- [Files](#files)
- [Key Concepts](#key-concepts)
- [Usage](#usage)
- [Dependencies](#dependencies)
- [Related](#related)

## Overview

The ML system provides a comprehensive solution for intelligent music recommendations. Key capabilities include:

- **Hybrid Scoring**: Combines rule-based heuristics with neural network predictions for track scoring
- **Vector Embeddings**: 128-dimensional vector representations for tracks enabling semantic similarity search
- **User Taste Profiling**: Builds and maintains user preference models from listening history
- **Collaborative Filtering**: Learns from co-occurrence patterns in playlists and listening sessions
- **Contextual Awareness**: Adjusts recommendations based on time of day, day of week, and activity
- **Smart Queue Management**: Automatic queue replenishment with intelligent candidate selection
- **Training Pipeline**: Event-driven model training with scheduling and persistence
- **Mood Matching**: Matches tracks to predefined mood profiles using audio features

## Architecture

```
                         +----------------------------+
                         |         MLEngine           |
                         |    (Main Orchestrator)     |
                         +-------------+--------------+
                                       |
        +------------------------------+------------------------------+
        |                              |                              |
+-------v--------+          +----------v-----------+         +--------v--------+
| AlgorithmRegistry|         |  FeatureAggregator  |         |   SmartQueue    |
| (Plugin Lifecycle)|        | (Multi-Provider)    |         | (Candidates)    |
+----------------+          +----------+-----------+         +-----------------+
                                       |
        +------------------------------+------------------------------+
        |          |          |          |          |          |
   +----v----+ +---v----+ +---v---+ +----v----+ +---v----+ +---v----+
   |Essentia | |Emotion | |Lyrics | |Embedding| |Genre   | |Finger- |
   |Provider | |Provider| |Provider| |Provider| |Provider| |print   |
   +---------+ +--------+ +--------+ +---------+ +--------+ +--------+
        |
   +----v-----------+
   |  FeatureStore  |
   | (Persistence)  |
   +----------------+

+--------------------+     +-------------------+     +--------------------+
|   EventRecorder    |     | PreferenceStore   |     | TrainingScheduler  |
| (User Events)      |     | (User Affinities) |     | (Auto Training)    |
+--------------------+     +-------------------+     +--------------------+

+--------------------+     +-------------------+     +--------------------+
|   HybridScorer     |     |   NeuralScorer    |     |  RadioGenerator    |
| (Main Scoring)     |     | (TensorFlow.js)   |     | (Infinite Radio)   |
+--------------------+     +-------------------+     +--------------------+

+--------------------+     +-------------------+
|  EmbeddingEngine   |     |   VectorIndex     |
| (Track Vectors)    |     |  (HNSW Search)    |
+--------------------+     +-------------------+
```

## Structure

```
ml/
├── index.ts                 - Main entry point, exports all public APIs
├── algorithm/               - Core scoring algorithms
│   ├── hybrid-scorer.ts     - Main scoring orchestrator
│   ├── neural-scorer.ts     - TensorFlow.js neural network
│   ├── sequential-scorer.ts - DJ-style session flow analysis
│   ├── radio-generator.ts   - Infinite radio playlist generation
│   ├── trainer.ts           - Training orchestration
│   └── index.ts             - Algorithm exports
├── embeddings/              - Vector-based recommendation engine
│   ├── embedding-engine.ts  - Generates track embeddings
│   ├── vector-index.ts      - HNSW approximate nearest neighbor search
│   ├── taste-profile.ts     - User preference modeling
│   ├── cooccurrence.ts      - Collaborative filtering
│   ├── playlist-generator.ts- Intelligent playlist generation
│   ├── types.ts             - Embedding type definitions
│   └── index.ts             - Embeddings exports
├── endpoints/               - Public API for ML plugins
│   └── index.ts             - createEndpoints factory
├── engine/                  - Core orchestration layer
│   ├── ml-engine.ts         - Main orchestrator
│   ├── feature-aggregator.ts- Multi-provider feature aggregation
│   ├── algorithm-registry.ts- Algorithm plugin lifecycle
│   └── index.ts             - Engine exports
├── learning/                - Event recording and training
│   ├── event-recorder.ts    - User event recording
│   ├── preference-store.ts  - User preference management
│   ├── training-scheduler.ts- Automatic training scheduling
│   ├── storage-helper.ts    - Storage abstraction
│   └── index.ts             - Learning exports
├── mood/                    - Mood-based recommendation
│   └── mood-matcher.ts      - Matches tracks to mood profiles
├── providers/               - Feature extraction providers
│   ├── essentia-provider.ts - Audio analysis (Node.js only)
│   ├── emotion-provider.ts  - Emotion/mood detection
│   ├── embedding-provider.ts- Embedding generation
│   ├── lyrics-provider.ts   - Lyrics analysis
│   ├── fingerprint-provider.ts - Audio fingerprinting
│   ├── genre-provider.ts    - Genre classification
│   └── index.ts             - Provider exports
├── queue/                   - Smart queue management
│   ├── smart-queue.ts       - Intelligent queue operations
│   └── index.ts             - Queue exports
├── storage/                 - Persistent storage adapters
│   ├── browser-storage.ts   - Browser localStorage adapter
│   ├── node-storage.ts      - File-based Node.js adapter
│   └── feature-store.ts     - Audio feature persistence
├── types/                   - TypeScript type definitions
│   ├── track.ts             - Track and feature types
│   ├── scoring.ts           - Scoring context and weights
│   ├── algorithm.ts         - Algorithm plugin interface
│   ├── events.ts            - User event types
│   ├── training.ts          - Training data types
│   ├── providers.ts         - Feature provider types
│   ├── endpoints.ts         - MLCoreEndpoints interface
│   ├── mood.ts              - Mood profile types
│   └── index.ts             - Type exports
└── utils/                   - Utility functions
    ├── vector-utils.ts      - Vector math operations
    ├── scoring-utils.ts     - Scoring helpers
    ├── feature-utils.ts     - Feature extraction utilities
    ├── cache-utils.ts       - Memory caching
    ├── ml-utils.ts          - General ML utilities
    └── index.ts             - Utils exports
```

## Directories

### algorithm/

Core scoring and recommendation algorithms. Combines rule-based heuristics with neural network predictions to generate personalized music recommendations.

| File | Purpose |
|------|---------|
| `hybrid-scorer.ts` | Main scoring orchestrator combining 15+ scoring components |
| `neural-scorer.ts` | TensorFlow.js neural network for preference prediction |
| `sequential-scorer.ts` | DJ-style session flow analysis (tempo, energy, genre transitions) |
| `radio-generator.ts` | Generates infinite radio playlists from seeds |
| `trainer.ts` | Orchestrates model training with progress tracking |

**Key Features**:
- Weighted scoring components (preference, ML prediction, mood, temporal, diversity)
- Penalty system (recent play, dislike, repetition, fatigue)
- Dynamic ML weight scaling based on model accuracy
- Batch scoring for performance optimization
- Score explanations for transparency

See [algorithm/README.md](./algorithm/README.md) for detailed documentation.

---

### embeddings/

Vector-based recommendation engine using dense 128-dimensional embeddings for semantic similarity search.

| File | Purpose |
|------|---------|
| `embedding-engine.ts` | Generates track embeddings from audio features/genres |
| `vector-index.ts` | HNSW-based approximate nearest neighbor search |
| `taste-profile.ts` | User preference modeling with contextual profiles |
| `cooccurrence.ts` | Collaborative filtering via co-occurrence tracking |
| `playlist-generator.ts` | High-level playlist generation API |
| `types.ts` | Type definitions, genre/mood vectors |

**Key Features**:
- Pre-defined vectors for 35+ genres and 12 moods
- Contextual taste profiles (morning, evening, weekend)
- Second-order feature interactions (energy * valence for mood)
- Collaborative filtering with proximity weighting
- Multiple playlist generation methods (mood, genre, seed, personalized)

See [embeddings/README.md](./embeddings/README.md) for detailed documentation.

---

### endpoints/

Creates the public API (`MLCoreEndpoints`) for ML algorithm plugins. Provides unified access to features, user data, training data, scoring, storage, and events.

| Endpoint | Description |
|----------|-------------|
| `features` | Access audio, emotion, lyrics, embedding features |
| `user` | Read preferences, history, affinities |
| `training` | Get positive/negative training samples |
| `queue` | Get candidates and submit rankings |
| `scoring` | Submit and retrieve track scores |
| `storage` | Persistent storage and TensorFlow.js model storage |
| `events` | Subscribe to user events and playback changes |
| `library` | Query tracks, playlists, statistics |

See [endpoints/README.md](./endpoints/README.md) for detailed documentation.

---

### engine/

Core orchestration layer coordinating all ML components.

| File | Purpose |
|------|---------|
| `ml-engine.ts` | Main orchestrator, singleton management |
| `feature-aggregator.ts` | Multi-provider feature aggregation with caching |
| `algorithm-registry.ts` | Algorithm plugin registration and lifecycle |

**Key Features**:
- Built-in core algorithm (HybridScorer + NeuralScorer)
- Provider registration modes (override vs supplement)
- Multi-layer caching (memory + persistent FeatureStore)
- Automatic provider initialization by priority
- Similarity search via embeddings

See [engine/README.md](./engine/README.md) for detailed documentation.

---

### learning/

Components for recording user events and learning preferences.

| File | Purpose |
|------|---------|
| `event-recorder.ts` | Records user events (listens, skips, likes, dislikes) |
| `preference-store.ts` | Manages artist/genre affinities and temporal patterns |
| `training-scheduler.ts` | Automatic model retraining scheduling |
| `storage-helper.ts` | Storage abstraction for persistence |

**Key Features**:
- Graduated skip weighting (earlier skips = stronger negative signal)
- Affinity decay over time (0.98 daily factor)
- Temporal pattern tracking (hourly/daily play distribution)
- Class-balanced training dataset generation
- Idle-triggered training support

---

### mood/

Mood-based track matching and filtering.

| File | Purpose |
|------|---------|
| `mood-matcher.ts` | Scores tracks against mood profiles |

**Mood Types**: chill, energetic, happy, sad, angry, romantic, focus, party, workout, sleep, melancholy, uplifting

**Matching Criteria**:
- Audio features (energy, valence, danceability, BPM, acousticness)
- Genre matching (preferred and excluded genres per mood)
- Range-based scoring with distance penalty

---

### providers/

Feature extraction providers for different analysis types.

| Provider | Priority | Capabilities |
|----------|----------|--------------|
| `EssentiaProvider` | 30 | Audio analysis (Node.js only, uses Essentia.js) |
| `GenreProvider` | 28 | Genre classification (metadata + ML fallback) |
| `EmotionProvider` | 25 | Emotion/mood detection from audio |
| `EmbeddingProvider` | 20 | Vector embeddings for similarity |
| `LyricsProvider` | 15 | Lyrics sentiment and theme analysis |
| `FingerprintProvider` | 10 | Audio fingerprinting for identification |

**Provider Interface**:
```typescript
interface FeatureProvider {
  id: string;
  priority: number;
  capabilities: ProviderCapabilities;
  initialize(endpoints: MLCoreEndpoints): Promise<void>;
  dispose(): Promise<void>;
  // Feature extraction methods...
}
```

---

### queue/

Smart queue management for automatic playback continuation.

| File | Purpose |
|------|---------|
| `smart-queue.ts` | Queue operations, candidate retrieval, ranking |

**Queue Modes**:
- `manual`: User controls queue entirely
- `auto`: Automatic replenishment based on preferences
- `radio`: Infinite radio mode from seed

**Candidate Sources**: library, liked, similar, discovery, trending, radio

**Features**:
- Session history tracking (max 200 tracks)
- Artist diversity limiting
- Configurable replenishment thresholds

---

### storage/

Persistent storage adapters for different environments.

| File | Purpose |
|------|---------|
| `browser-storage.ts` | Browser localStorage wrapper + MemoryStorage |
| `node-storage.ts` | File-based JSON storage for Node.js |
| `feature-store.ts` | Typed storage for audio analysis features |

**FeatureStore Features**:
- Analysis versioning (outdated features trigger re-analysis)
- Memory cache + persistent storage
- Debounced persistence (2-second delay)
- Typed access for audio, emotion, genre, embedding

---

### types/

TypeScript type definitions for the entire ML system.

| File | Contains |
|------|----------|
| `track.ts` | `Track`, `AudioFeatures`, `EmotionFeatures`, `LyricsFeatures`, `GenreFeatures` |
| `scoring.ts` | `TrackScore`, `ScoreComponents`, `ScoringContext`, `ScoringWeights` |
| `algorithm.ts` | `AlgorithmPlugin`, `AlgorithmState`, `AlgorithmHealth` |
| `events.ts` | `UserEvent`, `ListenEvent`, `SkipEvent`, `DislikeEvent`, `LikeEvent` |
| `training.ts` | `TrainingSample`, `TrainingDataset`, `FeatureVector` |
| `providers.ts` | `FeatureProvider`, `ProviderCapabilities` |
| `endpoints.ts` | `MLCoreEndpoints`, individual endpoint interfaces |
| `mood.ts` | `MoodType`, `MoodProfile`, `MoodMatchResult` |

---

### utils/

Utility functions used throughout the ML system.

| File | Purpose |
|------|---------|
| `vector-utils.ts` | Vector operations (normalize, cosine similarity, euclidean distance) |
| `scoring-utils.ts` | Scoring helpers and weight calculations |
| `feature-utils.ts` | Feature extraction and normalization |
| `cache-utils.ts` | `MemoryCache` class with TTL support |
| `ml-utils.ts` | General ML utilities |

**Vector Operations**:
- `normalizeVector()` - L2 normalization
- `cosineSimilarity()` - Similarity measure (-1 to 1)
- `euclideanDistance()` - Distance measure
- `averageVectors()` - Average multiple vectors
- `blendVectors()` - Weighted combination

---

## Files

### index.ts

Main entry point that re-exports all public APIs from the ML system.

**Exports**:
- Types: All interfaces from `./types`
- Utilities: All functions from `./utils`
- Algorithm: `HybridScorer`, `NeuralScorer`, `Trainer`, `RadioGenerator`, `SequentialScorer`
- Engine: `MLEngine`, `getMLEngine`, `resetMLEngine`, `AlgorithmRegistry`, `FeatureAggregator`
- Providers: `EmotionProvider`, `EmbeddingProvider`, `LyricsProvider`, `EssentiaProvider`, `FingerprintProvider`
- Learning: `EventRecorder`, `PreferenceStore`, `TrainingScheduler`
- Storage: `BrowserStorage`, `MemoryStorage`, `NodeStorage`, `createStorage`
- Queue: `SmartQueue`
- Endpoints: `createEndpoints`
- Mood: `MoodMatcher`, `getMoodMatcher`
- Embeddings: All classes, singletons, and config defaults

**Used by**: `packages/server/src/services/ml-service.ts`

---

## Key Concepts

### Scoring Components

The HybridScorer combines 15+ weighted components:

| Component | Default Weight | Description |
|-----------|---------------|-------------|
| `basePreference` | 20% | Artist and genre affinity from history |
| `mlPrediction` | 18% (dynamic) | Neural network prediction |
| `audioMatch` | 8% | Audio feature similarity |
| `moodMatch` | 6% | Match to user's current mood |
| `temporalFit` | 5% | Time-of-day appropriateness |
| `trajectoryFit` | 6% | Session direction in embedding space |
| `explorationBonus` | 5% | New artist/genre discovery |
| `diversityScore` | 5% | Variety contribution |

### Provider Priority System

Providers are processed in priority order:
- **Core providers** (priority <= 50): Establish baseline features
- **Plugin providers** (priority > 50): Override or supplement based on mode

### Event Weighting

| Event Type | Weight | Signal |
|------------|--------|--------|
| Like (strength 2) | +1.0 | Strong positive |
| Like (strength 1) | +0.8 | Positive |
| Listen (completed) | +0.5 | Positive |
| Listen (partial) | +0.3 | Weak positive |
| Skip (early) | -0.8 | Strong negative |
| Skip (late) | -0.3 | Weak negative |
| Dislike (bad song) | -1.0 | Strong negative |
| Dislike (not mood) | -0.3 | Context-specific |

---

## Usage

### Basic Initialization

```typescript
import { getMLEngine } from './ml';

const engine = getMLEngine({
  useCoreAlgorithm: true,
  enableAutoTraining: true,
  storagePath: '/path/to/ml-data',
});

await engine.initialize();
```

### Scoring Tracks

```typescript
const context: ScoringContext = {
  sessionTracks: [...],
  currentTrack: track,
  timestamp: new Date(),
  mode: 'balanced',
};

// Single track
const score = await engine.scoreTrack(track, context);

// Batch scoring
const scores = await engine.scoreBatch(tracks, context);
```

### Finding Similar Tracks

```typescript
const similar = await engine.findSimilar(trackId, 20);
```

### Generating Radio

```typescript
const seed: RadioSeed = {
  type: 'artist',
  id: 'artist-123',
  name: 'Artist Name',
};

const tracks = await engine.generateRadio(seed, 20, context);
```

### Recording Events

```typescript
import { EventRecorder } from './ml';

const recorder = new EventRecorder();
await recorder.load();

await recorder.record({
  type: 'listen',
  track: currentTrack,
  timestamp: Date.now(),
  duration: 180,
  completed: true,
  completion: 1.0,
  context: { hourOfDay: 14, dayOfWeek: 3, isWeekend: false },
});
```

### Generating Playlists

```typescript
import { PlaylistGenerator, getEmbeddingEngine, getVectorIndex } from './ml';

const generator = new PlaylistGenerator(
  getEmbeddingEngine(),
  getVectorIndex(),
  getCoOccurrenceMatrix(),
  tasteManager
);

// Mood-based playlist
const playlist = generator.generateMoodPlaylist('chill', {
  limit: 30,
  explorationFactor: 0.3,
});

// Personalized discovery
const discovery = generator.generateDiscoveryPlaylist({
  limit: 25,
  contextHour: new Date().getHours(),
});
```

---

## Dependencies

### External Dependencies

| Package | Used For |
|---------|----------|
| `@tensorflow/tfjs` | Neural network operations (NeuralScorer, EmotionProvider) |

### Internal Dependencies

- `fs`, `path` (Node.js) - File-based storage in NodeStorage

### Peer Dependencies

The ML system is designed to be integrated with:
- `packages/server/src/services/ml-service.ts` - Server-side ML orchestration
- `packages/shared/ui/src/hooks/useSmartQueue.ts` - UI queue management
- `packages/shared/ui/src/stores/recommendation-store.ts` - Recommendation state

---

## Related

- **ML Service**: `packages/server/src/services/ml-service.ts` - Server integration
- **UI ML Hooks**: `packages/shared/ui/src/hooks/` - Client-side ML utilities
- **Recommendation Store**: `packages/shared/ui/src/stores/recommendation-store.ts`
- **Smart Queue Store**: `packages/shared/ui/src/stores/smart-queue-store.ts`
