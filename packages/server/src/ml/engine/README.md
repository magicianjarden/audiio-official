# ML Engine

The core orchestration layer for Audiio's machine learning recommendation system. This directory contains the main engine that coordinates algorithm plugins, feature providers, scoring, training, and queue management.

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Structure](#structure)
- [Files](#files)
  - [ml-engine.ts](#ml-enginets)
  - [feature-aggregator.ts](#feature-aggregatorts)
  - [algorithm-registry.ts](#algorithm-registryts)
  - [index.ts](#indexts)
- [Key Concepts](#key-concepts)
  - [Provider Registration Modes](#provider-registration-modes)
  - [Embedding-Based Similarity Search](#embedding-based-similarity-search)
  - [FeatureStore Integration](#featurestore-integration)
  - [Genre Provider Strategy](#genre-provider-strategy)
- [Usage](#usage)
- [Dependencies](#dependencies)
- [Related](#related)

## Overview

The ML Engine serves as the central nervous system for Audiio's recommendation and scoring capabilities. It provides:

- **Algorithm Plugin System**: Register and manage multiple scoring algorithms with automatic lifecycle management
- **Feature Aggregation**: Combine audio, emotion, lyrics, genre, and embedding features from multiple providers
- **Core Algorithm**: Built-in HybridScorer + NeuralScorer that runs by default
- **Smart Queue Integration**: Automatic candidate selection for playback queues
- **Training Pipeline**: Event-driven model training with scheduling
- **Persistent Storage**: Features survive server restarts via FeatureStore

## Architecture

```
                    +------------------+
                    |    MLEngine      |
                    |  (Orchestrator)  |
                    +--------+---------+
                             |
         +-------------------+-------------------+
         |                   |                   |
+--------v--------+ +--------v--------+ +--------v--------+
| AlgorithmRegistry| |FeatureAggregator| |   SmartQueue    |
| (Plugin Lifecycle)| |(Multi-Provider) | | (Candidates)    |
+-----------------+ +--------+--------+ +-----------------+
                             |
         +-------------------+-------------------+
         |         |         |         |         |
    +----v---+ +---v----+ +--v---+ +--v----+ +--v----+
    |Essentia| |Emotion | |Lyrics| |Embed  | |Genre  |
    |Provider| |Provider| |Prov. | |Prov.  | |Prov.  |
    +--------+ +--------+ +------+ +-------+ +-------+
         |
    +----v-----------+
    |  FeatureStore  |
    | (Persistence)  |
    +----------------+
```

## Structure

```
engine/
├── ml-engine.ts           - Main orchestrator, singleton management
├── feature-aggregator.ts  - Multi-provider feature aggregation with caching
├── algorithm-registry.ts  - Algorithm plugin registration and lifecycle
└── index.ts               - Public exports
```

## Files

### ml-engine.ts

**Purpose**: Main orchestrator that coordinates all ML components - algorithms, providers, training, and queue management.

**Key Exports**:
- `MLEngine` - Main engine class
- `getMLEngine(config?)` - Singleton factory function
- `resetMLEngine()` - Reset singleton (for testing)
- `MLEngineConfig` - Configuration interface

**Core Features**:

1. **Built-in Core Algorithm**
   - HybridScorer + NeuralScorer combination runs by default
   - Plugin algorithms can extend or replace the core
   - Configurable via `useCoreAlgorithm` option

2. **Core Providers** (initialized automatically):
   | Provider | Priority | Capabilities |
   |----------|----------|--------------|
   | Essentia | 30 | Audio analysis (Node.js only) |
   | Genre | 28 | Genre classification |
   | Emotion | 25 | Emotion detection |
   | Embedding | 20 | Vector embeddings, similarity |
   | Lyrics | 15 | Lyrics analysis |

3. **Scoring Methods**:
   ```typescript
   // Score single track
   await engine.scoreTrack(track, context);

   // Score multiple tracks
   await engine.scoreBatch(tracks, context);

   // Rank candidates for queue
   await engine.rankCandidates(candidates, context);
   ```

4. **Similarity Search**:
   ```typescript
   // Find similar tracks using embeddings
   const similar = await engine.findSimilar(trackId, limit);
   ```

5. **Radio Generation**:
   ```typescript
   // Generate radio from seed (track, artist, genre, or mood)
   const tracks = await engine.generateRadio(seed, count, context);
   ```

**Used by**:
- `packages/server/src/services/ml-service.ts` - Server-side ML orchestration
- `packages/server/src/ml/queue/smart-queue.ts` - Queue candidate generation

**Dependencies**:
- Algorithm components: `HybridScorer`, `NeuralScorer`, `Trainer`, `RadioGenerator`
- Core providers: `EssentiaProvider`, `EmotionProvider`, `EmbeddingProvider`, `LyricsProvider`, `GenreProvider`
- Storage: `FeatureStore`, `NodeStorage`
- Learning: `EventRecorder`, `PreferenceStore`, `TrainingScheduler`

---

### feature-aggregator.ts

**Purpose**: Aggregates features from multiple providers with intelligent caching, conflict resolution, and persistent storage support.

**Key Exports**:
- `FeatureAggregator` - Main aggregator class
- `ExtendedFeatureProvider` - Provider interface with mode support
- `ExtendedAggregationConfig` - Configuration interface
- `FeatureStoreInterface` - Persistent storage interface

**Core Features**:

1. **Provider Registration with Modes**:
   ```typescript
   // Override mode: replaces core features entirely
   aggregator.register(provider, 'override');

   // Supplement mode: fills gaps without overwriting (default)
   aggregator.register(provider, 'supplement');
   ```

2. **Priority-Based Processing**:
   - Core providers (priority <= 50): Establish baseline features
   - Plugin providers (priority > 50): Override or supplement based on mode
   - Higher priority = processed first within each tier

3. **Multi-Layer Caching**:
   - In-memory cache with configurable TTL (default: 24 hours)
   - Persistent FeatureStore for cross-restart survival
   - Request deduplication to prevent redundant fetches

4. **Embedding Similarity Search**:
   ```typescript
   // Find similar tracks by embedding vector
   const similar = aggregator.findSimilarByEmbedding(
     embedding,    // Query vector
     limit,        // Max results (default: 20)
     excludeIds    // Track IDs to exclude
   );
   // Returns: Array<{ trackId: string; similarity: number }>
   ```

5. **Feature Retrieval**:
   ```typescript
   // Get all aggregated features
   const features = await aggregator.get(trackId);

   // Get specific feature types
   const audio = await aggregator.getAudio(trackId);
   const emotion = await aggregator.getEmotion(trackId);
   const lyrics = await aggregator.getLyrics(trackId);
   const embedding = await aggregator.getEmbedding(trackId);
   const genre = await aggregator.getGenre(trackId);
   ```

6. **Batch Operations**:
   ```typescript
   // Get features for multiple tracks
   const featuresMap = await aggregator.getBatch(trackIds);

   // Prefetch features (background)
   await aggregator.prefetch(trackIds);
   ```

**Processing Order**:
1. Core providers (parallel) - establish baseline
2. Plugin providers with `override` mode - replace features
3. Plugin providers with `supplement` mode - fill gaps only

**Used by**:
- `ml-engine.ts` - Feature retrieval for scoring
- `packages/server/src/ml/endpoints/index.ts` - Endpoint creation

**Dependencies**:
- `../utils` - `MemoryCache`
- `../utils/vector-utils` - `cosineSimilarity`

---

### algorithm-registry.ts

**Purpose**: Manages algorithm plugin registration, initialization, activation, and health monitoring.

**Key Exports**:
- `AlgorithmRegistry` - Registry class

**Core Features**:

1. **Lifecycle Management**:
   ```typescript
   // Register algorithm
   await registry.register(algorithm);

   // Initialize specific algorithm
   await registry.initializeAlgorithm(algorithmId);

   // Initialize all registered algorithms
   await registry.initializeAll();

   // Dispose all algorithms
   await registry.disposeAll();
   ```

2. **Activation**:
   ```typescript
   // Set active algorithm (used for scoring)
   registry.setActive(algorithmId);

   // Get active algorithm
   const active = registry.getActive();
   ```

3. **State Tracking**:
   ```typescript
   // Get algorithm state
   const state = registry.getState(algorithmId);
   // Returns: { id, initialized, active, settings, training, health }

   // Get all states
   const states = registry.getAllStates();
   ```

4. **Health Monitoring**:
   ```typescript
   // Get health status
   const health = registry.getHealth(algorithmId);
   // Returns: { status: 'healthy'|'degraded'|'error', message?, lastCheck }

   // Update health
   registry.updateHealth(algorithmId, { status: 'degraded', message: '...' });
   ```

**Auto-Initialization**: When endpoints are set and algorithms are registered, they are automatically initialized.

**Used by**:
- `ml-engine.ts` - Algorithm management

**Dependencies**:
- `../types` - `AlgorithmPlugin`, `AlgorithmState`, `AlgorithmHealth`, `MLCoreEndpoints`

---

### index.ts

**Purpose**: Barrel file that exports the public API for the engine module.

**Exports**:
```typescript
export { MLEngine, getMLEngine, resetMLEngine } from './ml-engine';
export type { MLEngineConfig } from './ml-engine';
export { AlgorithmRegistry } from './algorithm-registry';
export { FeatureAggregator } from './feature-aggregator';
```

**Used by**:
- `packages/server/src/ml/index.ts` - Re-exports for the ML package

## Key Concepts

### Provider Registration Modes

The feature aggregation system supports two modes for plugin providers:

| Mode | Behavior | Use Case |
|------|----------|----------|
| `override` | Completely replaces core features for provided types | Plugin provides superior analysis |
| `supplement` | Only fills in missing features, never overwrites | Plugin adds complementary data |

**Priority Thresholds**:
- Priority <= 50: Core provider (establishes baseline)
- Priority > 50: Plugin provider (respects mode setting)

### Embedding-Based Similarity Search

The `findSimilarByEmbedding()` method enables fast similarity search:

```typescript
// How it works:
// 1. Query embedding is converted to Float32Array
// 2. All cached embeddings are compared using cosine similarity
// 3. Results are sorted by similarity (descending)
// 4. Top N results returned, excluding specified IDs

const similar = aggregator.findSimilarByEmbedding(
  queryEmbedding,
  20,                    // limit
  new Set([currentId])   // exclude current track
);

// Result format:
// [{ trackId: 'abc', similarity: 0.95 }, { trackId: 'def', similarity: 0.87 }, ...]
```

### FeatureStore Integration

The engine integrates with persistent storage for feature caching:

```typescript
// In ml-engine.ts initialization:
if (typeof window === 'undefined' && config.storagePath) {
  const storage = new NodeStorage(storagePath, 'feature-store.json');

  featureStore = new FeatureStore({
    get: (key) => storage.get(key),
    set: (key, value) => storage.set(key, value),
    persist: () => storage.persist(),
  });

  featureAggregator.setFeatureStore(featureStore);
}
```

**Benefits**:
- Features survive server restarts
- Analysis is versioned (outdated features are re-analyzed)
- Debounced persistence (2-second delay) for batch efficiency

### Genre Provider Strategy

The genre provider uses a plugin-first approach:

1. **Check Metadata** (confidence: 1.0)
   - Looks for genre tags from plugins (local-library, spotify-import, etc.)
   - If found, returns immediately with `source: 'metadata'`

2. **Embedding Fallback** (confidence: 0.3-0.9)
   - Finds similar tracks using embedding similarity
   - Collects genres from similar tracks weighted by similarity
   - Returns consensus with `source: 'ml-predicted'`

3. **Centroid Classification** (optional, faster)
   - Pre-build centroids from tracks with known genres
   - Classify by similarity to genre centroids

## Usage

### Basic Initialization

```typescript
import { getMLEngine } from './engine';

// Get or create engine instance
const engine = getMLEngine({
  autoInitialize: true,
  enableAutoTraining: true,
  useCoreAlgorithm: true,
  storagePath: '/path/to/ml-data',
});

// Initialize (loads persisted state, starts providers)
await engine.initialize();
```

### Scoring Tracks

```typescript
const context: ScoringContext = {
  sessionTracks: [...],
  currentTrack: track,
  timestamp: new Date(),
  mode: 'balanced',
  enforceDiversity: true,
};

// Single track
const score = await engine.scoreTrack(track, context);

// Multiple tracks
const scores = await engine.scoreBatch(tracks, context);

// Ranked candidates
const ranked = await engine.rankCandidates(candidates, context);
```

### Finding Similar Tracks

```typescript
// Using engine method (tries algorithm first, then embeddings)
const similar = await engine.findSimilar(trackId, 20);

// Direct embedding similarity via aggregator
const embedding = await engine.getEndpoints().features.getEmbedding(trackId);
const similar = engine.getEndpoints().features.findSimilarByEmbedding(
  embedding,
  20,
  new Set([trackId])
);
```

### Registering Custom Providers

```typescript
// Register a plugin provider that overrides genre classification
engine.registerFeatureProvider({
  id: 'my-genre-plugin',
  priority: 60,  // > 50 = plugin tier
  capabilities: {
    genreClassification: true,
    // ... other capabilities
  },
  getGenreFeatures: async (trackId) => {
    // Custom genre classification logic
    return { primaryGenre: 'rock', ... };
  },
}, 'override');  // or 'supplement'
```

### Cleanup

```typescript
// Dispose engine (persists state, cleans up resources)
await engine.dispose();

// Reset singleton (for testing)
resetMLEngine();
```

## Dependencies

**Internal**:
- `../algorithm/` - HybridScorer, NeuralScorer, Trainer, RadioGenerator
- `../providers/` - EssentiaProvider, EmotionProvider, EmbeddingProvider, LyricsProvider, GenreProvider
- `../storage/` - FeatureStore, NodeStorage
- `../learning/` - EventRecorder, PreferenceStore, TrainingScheduler
- `../queue/` - SmartQueue
- `../endpoints/` - createEndpoints
- `../utils/` - MemoryCache, cosineSimilarity
- `../types/` - All ML type definitions

**External**:
- None (pure TypeScript)

## Related

- [ML Algorithm](../algorithm/README.md) - Scoring algorithm implementations
- [ML Providers](../providers/) - Feature extraction providers
- [ML Storage](../storage/) - Persistent feature storage
- [ML Service](../../services/ml-service.ts) - Server-side ML orchestration
- [ML Types](../types/) - Type definitions
