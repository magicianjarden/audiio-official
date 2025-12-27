# Audiio ML Architecture

This document explains how the Audiio ML system works, including the core components, plugin system, and data flow.

## Overview

The Audiio ML system is a **three-layer architecture** designed for extensibility and performance:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           UI / Frontend                                  │
│  - useAudiioAlgo hook                                                   │
│  - Plugin settings page                                                 │
│  - Queue/recommendation displays                                        │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         @audiio/ml-core                                  │
│  - AlgorithmOrchestrator (loads/manages algorithm plugins)              │
│  - FeatureAggregator (merges features from multiple providers)          │
│  - EventRecorder (records user events for training)                     │
│  - QueueManager (applies scoring to queue ordering)                     │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      Algorithm Plugins                                   │
│  - audiio-algo (official algorithm)                                     │
│  - Third-party algorithms (built with @audiio/ml-sdk)                   │
└─────────────────────────────────────────────────────────────────────────┘
```

## Package Structure

### @audiio/ml-sdk

The SDK for building algorithm plugins. Contains:

- **Types**: All TypeScript interfaces and types
- **Base classes**: `BaseAlgorithm` for extending
- **Utilities**: Caching, math helpers, scoring utilities
- **No dependencies on TensorFlow or WASM** (those are added by plugins)

```
packages/ml-sdk/src/
├── types/              # TypeScript interfaces
│   ├── algorithm.ts    # AlgorithmManifest, BaseAlgorithm
│   ├── track.ts        # Track, AudioFeatures, EmotionFeatures
│   ├── scoring.ts      # TrackScore, ScoringContext
│   ├── training.ts     # TrainingDataset, UserEvent
│   └── endpoints.ts    # AlgorithmEndpoints (IPC to core)
├── utils/              # Utility functions
│   ├── memory-cache.ts # In-memory caching
│   ├── math.ts         # Normalization, distance functions
│   └── scoring-utils.ts # Score aggregation helpers
└── index.ts            # Public exports
```

### @audiio/ml-core

The orchestration layer running in Electron's main process. Contains:

- **AlgorithmOrchestrator**: Loads and manages algorithm plugins
- **FeatureAggregator**: Combines features from multiple providers
- **EventRecorder**: Persists user events (plays, skips, likes)
- **QueueManager**: Applies scoring to reorder queues

```
packages/ml-core/src/
├── orchestrator/       # Algorithm loading and management
├── features/           # Feature aggregation
├── learning/           # Event recording and training data
├── endpoints/          # IPC bridge implementation
└── index.ts
```

### audiio-algo (Official Algorithm)

The official algorithm plugin with all features:

```
addons/audiio-algo/src/
├── algorithm/          # Main algorithm class
├── scoring/            # Hybrid and neural scorers
├── training/           # Model training logic
├── providers/          # Feature providers
│   ├── essentia/       # Audio analysis (WASM)
│   ├── emotion/        # Mood detection (TensorFlow.js)
│   ├── lyrics/         # Lyrics sentiment analysis
│   ├── fingerprint/    # Chromaprint fingerprinting
│   └── embeddings/     # Track embeddings for similarity
└── manifest.ts         # Plugin manifest
```

## Data Flow

### 1. Feature Extraction

When a track plays, features are extracted from multiple sources:

```
Track plays
    │
    ├──► Essentia (WASM) ──► BPM, key, energy, danceability
    │
    ├──► Emotion model ──► Valence, arousal, mood category
    │
    ├──► Lyrics provider ──► Sentiment, themes, language
    │
    └──► Embedding model ──► 128-dim vector for similarity
              │
              ▼
      FeatureAggregator
              │
              ▼
      AggregatedFeatures
```

### 2. Scoring

When the queue needs ordering, tracks are scored:

```
Queue request
    │
    ├──► ScoringContext (current state, history, time)
    │
    └──► For each track:
              │
              ├──► Preference score (user history)
              ├──► Temporal score (time-of-day patterns)
              ├──► Exploration score (novelty bonus)
              ├──► Flow score (energy transitions)
              └──► Neural score (ML prediction)
                        │
                        ▼
                HybridScorer.combine()
                        │
                        ▼
                  TrackScore
```

### 3. Training

The model learns from user interactions:

```
User action (play, skip, like, dislike)
    │
    ▼
EventRecorder
    │
    ├──► Persists to IndexedDB
    │
    └──► When threshold reached:
              │
              ▼
         Trainer.train()
              │
              ├──► Prepare dataset
              ├──► Train neural model
              ├──► Validate on held-out data
              └──► Save model weights
```

## Key Concepts

### Algorithm Manifest

Every algorithm plugin must export a manifest describing its capabilities:

```typescript
const manifest: AlgorithmManifest = {
  id: 'my-algo',
  name: 'My Algorithm',
  version: '1.0.0',
  capabilities: {
    scoring: true,
    training: true,
    radioGeneration: false,
    // ...
  },
  requirements: {
    needsListenHistory: true,
    estimatedModelSize: '10MB',
    requiresWASM: false,
    // ...
  },
  settings: [
    { key: 'explorationLevel', type: 'select', ... }
  ]
};
```

### Feature Providers

Algorithms can register feature providers that contribute to the aggregated features:

```typescript
const provider: FeatureProvider = {
  id: 'my-algo:audio',
  priority: 100,
  capabilities: {
    audioAnalysis: true,
    emotionDetection: false,
    // ...
  },
  getAudioFeatures: async (trackId) => { ... },
  analyzeAudioBuffer: async (buffer, sampleRate) => { ... },
};

// Register with core
endpoints.features.register(provider);
```

### Scoring Context

The context provides information about the current state for scoring:

```typescript
interface ScoringContext {
  userId: string;
  sessionId: string;
  currentTrack?: Track;
  recentTracks: Track[];        // Last N played
  queuePosition: number;
  timeOfDay: number;            // 0-24
  dayOfWeek: number;            // 0-6
  isExplicitAllowed: boolean;
  sessionMood?: MoodCategory;
  targetEnergy?: number;
}
```

### Track Score

The result of scoring a track:

```typescript
interface TrackScore {
  trackId: string;
  finalScore: number;           // 0-100
  confidence: number;           // 0-1
  components: {
    preference: number;
    temporal: number;
    exploration: number;
    flow: number;
    neural: number;
  };
  explanation: string[];        // Human-readable reasons
}
```

## Plugin Integration

### In the UI

The plugin appears in Settings > Plugins with toggleable settings:

1. Plugin is registered in `plugin-store.ts`
2. Settings are synced to main process via IPC
3. `useAudiioAlgo` hook provides React integration

### In Main Process

The algorithm is loaded by `AlgorithmOrchestrator`:

1. Reads algorithm from `addons/audiio-algo/`
2. Calls `algorithm.initialize(endpoints)`
3. Registers feature providers
4. Receives scoring requests via IPC

### IPC Bridge

Communication between renderer and main:

```typescript
// Renderer (UI)
const score = await window.api.algoScoreTrack(trackId);

// Main process
ipcMain.handle('algo:scoreTrack', async (_, trackId) => {
  return orchestrator.scoreTrack(trackId);
});
```

## Performance Considerations

### Caching

- Features are cached with configurable TTL
- Scores are cached per session
- Model weights are cached in IndexedDB

### Lazy Loading

- WASM modules load on first use
- TensorFlow.js models load when needed
- Fingerprinting loads on demand

### Background Processing

- Training runs on idle
- Audio analysis uses Web Workers
- Embeddings computed in batches

## Future Extensions

The architecture supports:

- **Multiple algorithms**: Users can install different algorithms
- **Algorithm switching**: Compare results from different algorithms
- **Custom providers**: Third-party feature providers
- **Remote models**: Cloud-based scoring for complex models
