# ML Endpoints

This module creates the public API for ML algorithm plugins. It provides a unified interface (`MLCoreEndpoints`) that algorithm plugins use to access features, user data, training data, queue operations, scoring, storage, events, and library information.

## Table of Contents

- [Overview](#overview)
- [Structure](#structure)
- [Files](#files)
- [Exported Interfaces](#exported-interfaces)
- [Endpoint Implementations](#endpoint-implementations)
- [Usage](#usage)
- [Integration with Plugin System](#integration-with-plugin-system)
- [Dependencies](#dependencies)

## Overview

The endpoints module serves as the bridge between the ML engine's internal components and external algorithm plugins. Rather than exposing internal implementation details, this module provides a clean, well-defined API that plugins can depend on for:

- **Feature extraction** - Access audio, emotion, lyrics, and embedding features
- **User data** - Read preferences, listen history, and affinities
- **Training data** - Get positive/negative samples for model training
- **Queue management** - Get candidates and submit rankings
- **Score submission** - Submit and retrieve track scores
- **Persistent storage** - Store algorithm state and TensorFlow.js models
- **Event subscription** - React to user events and playback changes
- **Library access** - Query tracks, playlists, and library statistics

## Structure

```
endpoints/
└── index.ts         - Main module with createEndpoints factory and interface exports
```

## Files

### index.ts

- **Purpose**: Factory function that creates the `MLCoreEndpoints` implementation by wiring together internal ML components
- **Exports**:
  - `createEndpoints` - Factory function
  - `LibraryDataSource` - Interface for library data access
  - `EventCallbacks` - Interface for event subscriptions
- **Used by**: `MLEngine` in `packages/server/src/ml/engine/ml-engine.ts`
- **Dependencies**:
  - `@tensorflow/tfjs` - For model storage
  - `../types` - Type definitions for endpoints and features
  - `../utils/vector-utils` - Cosine similarity calculation
  - Internal component types (`FeatureAggregator`, `EventRecorder`, `PreferenceStore`, `SmartQueue`, `AlgorithmRegistry`)

## Exported Interfaces

### LibraryDataSource

Interface that the plugin system implements to provide library data to the ML system:

```typescript
export interface LibraryDataSource {
  getAllTracks(): Promise<Track[]>;
  getTrack(trackId: string): Promise<Track | null>;
  getTracksByArtist(artistId: string): Promise<Track[]>;
  getTracksByGenre(genre: string): Promise<Track[]>;
  getLikedTracks(): Promise<Track[]>;
  getPlaylistTracks(playlistId: string): Promise<Track[]>;
  getPlaylists(): Promise<PlaylistInfo[]>;
  search(query: string, limit?: number): Promise<Track[]>;
  getStats(): Promise<LibraryStats>;
}
```

This interface allows the ML system to remain decoupled from the actual library storage implementation. The plugin system provides a concrete implementation that reads from whatever data source it uses (database, API, etc.).

### EventCallbacks

Interface for subscribing to queue and playback changes:

```typescript
export interface EventCallbacks {
  onQueueChange?: (callback: (queue: Track[]) => void) => () => void;
  onPlaybackChange?: (callback: (track: Track | null, isPlaying: boolean) => void) => () => void;
}
```

These callbacks enable algorithm plugins to react to real-time playback events without coupling to specific player implementations.

## Endpoint Implementations

### FeatureEndpoint

Provides access to track features through the `FeatureAggregator`:

| Method | Description |
|--------|-------------|
| `get(trackId)` | Get aggregated features for a track |
| `getBatch(trackIds)` | Get features for multiple tracks |
| `getAudio(trackId)` | Get audio features (tempo, energy, etc.) |
| `getEmotion(trackId)` | Get emotion/mood features |
| `getLyrics(trackId)` | Get lyrics analysis features |
| `getEmbedding(trackId)` | Get embedding vector for similarity |
| `extract(trackId)` | Alias for `get()` |
| `findSimilarByEmbedding(embedding, count)` | Find tracks with similar embeddings |
| `register(provider)` | Register a feature provider |
| `unregister(providerId)` | Remove a feature provider |
| `getProviders()` | List all registered providers |
| `invalidateCache(trackId?)` | Clear cached features |
| `prefetch(trackIds)` | Pre-load features for tracks |

### UserEndpoint

Provides access to user data through `PreferenceStore` and `EventRecorder`:

| Method | Description |
|--------|-------------|
| `getPreferences()` | Get user preferences summary |
| `getListenHistory(options)` | Get listen events with filtering |
| `getDislikedTracks()` | Get all disliked tracks with reasons |
| `getArtistAffinity(artistId)` | Get affinity score (-1 to 1) for artist |
| `getGenreAffinity(genre)` | Get affinity score (-1 to 1) for genre |
| `getAllArtistAffinities()` | Get all artist affinity scores |
| `getAllGenreAffinities()` | Get all genre affinity scores |
| `getTemporalPatterns()` | Get listening patterns by time |
| `getSessionStats()` | Get current session statistics |
| `wasRecentlyPlayed(trackId, withinMs)` | Check if track was recently played |
| `getLastPlayed(trackId)` | Get last play timestamp |
| `getStats()` | Get aggregate user statistics |
| `updatePreferences(preferences)` | Update exploration/diversity settings |

### TrainingEndpoint

Provides training data access through `EventRecorder`:

| Method | Description |
|--------|-------------|
| `getPositiveSamples(limit)` | Get positive training samples (liked, completed) |
| `getNegativeSamples(limit)` | Get negative training samples (skipped, disliked) |
| `getFullDataset(options)` | Get complete training dataset |
| `getFeatureStats()` | Get feature statistics for normalization |
| `onNewData(callback)` | Subscribe to new training data |
| `getNewEventCount()` | Get events since last training |
| `markTrainingComplete(modelVersion)` | Mark training as done |
| `getLastTrainingInfo()` | Get info about last training run |

### QueueEndpoint

Provides queue operations through `SmartQueue`:

| Method | Description |
|--------|-------------|
| `getCandidates(context)` | Get candidate tracks for queue |
| `submitRanking(tracks)` | Submit ranked tracks for queue insertion |
| `getCurrentQueue()` | Get current queue |
| `getSessionHistory()` | Get recently played tracks |
| `getConfig()` | Get queue configuration |
| `isInQueue(trackId)` | Check if track is queued |
| `wasPlayedInSession(trackId)` | Check if track was played this session |

### ScoringEndpoint

Provides score management with in-memory caching:

| Method | Description |
|--------|-------------|
| `submitScore(trackId, score, algorithmId)` | Submit a score |
| `submitBatchScores(scores, algorithmId)` | Submit multiple scores |
| `getOtherAlgorithmScores(trackId)` | Get scores from other algorithms |
| `getFinalScore(trackId)` | Get the active algorithm's score |
| `getStats()` | Get scoring statistics |

### StorageEndpoint

Provides persistent storage per algorithm:

| Method | Description |
|--------|-------------|
| `get<T>(key)` | Get a value from storage |
| `set<T>(key, value)` | Set a value (persists to localStorage) |
| `delete(key)` | Delete a value |
| `has(key)` | Check if key exists |
| `keys(prefix?)` | Get all keys with optional prefix filter |
| `clear()` | Clear all storage for this algorithm |
| `getModelStorage()` | Get TensorFlow.js model storage interface |

The `ModelStorage` interface provides:
- `save(key, model)` - Save a TensorFlow.js LayersModel to IndexedDB
- `load(key)` - Load a model from IndexedDB
- `delete(key)` - Delete a stored model
- `exists(key)` - Check if model exists
- `getModelUrl(key)` - Get the IndexedDB URL for tf.loadLayersModel

### EventEndpoint

Provides event subscription:

| Method | Description |
|--------|-------------|
| `onUserEvent(callback)` | Subscribe to all user events |
| `on(type, callback)` | Subscribe to specific event type |
| `onQueueChange(callback)` | Subscribe to queue changes |
| `onPlaybackChange(callback)` | Subscribe to playback changes |

### LibraryEndpoint

Provides library access through `LibraryDataSource`:

| Method | Description |
|--------|-------------|
| `getAllTracks()` | Get all tracks in library |
| `getTrack(trackId)` | Get track by ID |
| `getTracksByArtist(artistId)` | Get tracks by artist |
| `getTracksByGenre(genre)` | Get tracks by genre |
| `getLikedTracks()` | Get liked tracks |
| `getPlaylistTracks(playlistId)` | Get tracks in playlist |
| `getPlaylists()` | Get all playlists |
| `search(query, limit?)` | Search library |
| `getStats()` | Get library statistics |

## Usage

### Creating Endpoints with Dependency Injection

The `createEndpoints` function uses dependency injection to wire together the ML system components:

```typescript
import { createEndpoints } from './endpoints';
import type { MLCoreEndpoints } from '../types';

// Create endpoints with all required dependencies
const endpoints: MLCoreEndpoints = createEndpoints({
  // Required dependencies (internal ML components)
  featureAggregator: featureAggregatorInstance,
  eventRecorder: eventRecorderInstance,
  preferenceStore: preferenceStoreInstance,
  smartQueue: smartQueueInstance,
  registry: algorithmRegistryInstance,

  // Optional dependencies (provided by plugin system)
  libraryDataSource: {
    getAllTracks: () => libraryDb.getAllTracks(),
    getTrack: (id) => libraryDb.getTrack(id),
    // ... implement other methods
  },
  eventCallbacks: {
    onQueueChange: (cb) => playerStore.subscribeToQueue(cb),
    onPlaybackChange: (cb) => playerStore.subscribeToPlayback(cb),
  },
});
```

### Using Endpoints in an Algorithm Plugin

Algorithm plugins receive the endpoints object during initialization:

```typescript
import type { AlgorithmPlugin, MLCoreEndpoints } from '@audiio/ml-sdk';

const myAlgorithm: AlgorithmPlugin = {
  manifest: { /* ... */ },

  async initialize(endpoints: MLCoreEndpoints) {
    // Store reference for later use
    this.endpoints = endpoints;

    // Load persisted state
    const savedModel = await endpoints.storage.get('model-weights');

    // Subscribe to events
    endpoints.events.onUserEvent((event) => {
      if (event.type === 'listen') {
        this.updateModel(event);
      }
    });

    // Get user preferences
    const prefs = await endpoints.user.getPreferences();
    this.explorationLevel = prefs.explorationLevel ?? 0.3;
  },

  async scoreTrack(track, features, context) {
    // Use features from the endpoint
    const embedding = await this.endpoints.features.getEmbedding(track.id);
    const artistAffinity = await this.endpoints.user.getArtistAffinity(track.artistId);

    // Calculate score...
    return { final: score, factors: { /* ... */ } };
  },

  async dispose() {
    // Save state before shutdown
    await this.endpoints.storage.set('model-weights', this.model.getWeights());
  }
};
```

## Integration with Plugin System

The endpoints module integrates with the plugin system through two optional interfaces:

### LibraryDataSource Integration

The plugin system (or application layer) provides a `LibraryDataSource` implementation that connects the ML system to the actual music library:

```typescript
// In the application/plugin layer
const libraryDataSource: LibraryDataSource = {
  getAllTracks: () => libraryDb.getTracks(),
  getTrack: (id) => libraryDb.findTrack(id),
  getTracksByArtist: (artistId) => libraryDb.tracksByArtist(artistId),
  getTracksByGenre: (genre) => libraryDb.tracksByGenre(genre),
  getLikedTracks: () => libraryDb.getLiked(),
  getPlaylistTracks: (id) => libraryDb.getPlaylistTracks(id),
  getPlaylists: () => libraryDb.getPlaylists(),
  search: (query, limit) => libraryDb.search(query, limit),
  getStats: () => libraryDb.computeStats(),
};

// Pass to createEndpoints
const endpoints = createEndpoints({
  /* ... other deps ... */
  libraryDataSource,
});
```

### EventCallbacks Integration

For real-time updates, the application provides callbacks to subscribe to player/queue events:

```typescript
const eventCallbacks: EventCallbacks = {
  onQueueChange: (callback) => {
    // Subscribe to queue store changes
    const unsubscribe = queueStore.subscribe((state) => {
      callback(state.queue);
    });
    return unsubscribe;
  },
  onPlaybackChange: (callback) => {
    // Subscribe to player state changes
    const unsubscribe = playerStore.subscribe((state) => {
      callback(state.currentTrack, state.isPlaying);
    });
    return unsubscribe;
  },
};
```

### Default Behavior Without Integration

If `libraryDataSource` is not provided, the library endpoint methods return empty results:
- `getAllTracks()` returns `[]`
- `getTrack(id)` returns `null`
- `getStats()` returns zeroed `LibraryStats`

If `eventCallbacks` is not provided, the event subscription methods return no-op unsubscribe functions.

## Dependencies

### External Dependencies

- `@tensorflow/tfjs` - Used for model storage in IndexedDB

### Internal Dependencies

- **FeatureAggregator** (`../engine/feature-aggregator.ts`) - Combines features from multiple providers
- **EventRecorder** (`../learning/event-recorder.ts`) - Records user events for training
- **PreferenceStore** (`../learning/preference-store.ts`) - Manages user preferences and affinities
- **SmartQueue** (`../queue/smart-queue.ts`) - Intelligent queue management
- **AlgorithmRegistry** (`../engine/algorithm-registry.ts`) - Manages algorithm plugin lifecycle

### Type Dependencies

Types are imported from `../types`:
- `MLCoreEndpoints` - Main endpoints interface
- `FeatureEndpoint`, `UserEndpoint`, `TrainingEndpoint`, etc. - Individual endpoint interfaces
- `Track`, `TrackScore`, `AggregatedFeatures` - Core data types
- `UserEvent`, `ListenEvent` - Event types

## Related

- [ML Engine](../engine/README.md) - Main orchestrator that uses these endpoints
- [Types](../types/README.md) - Type definitions for all interfaces
- [Learning](../learning/README.md) - Event recording and preference management
- [Queue](../queue/README.md) - Smart queue implementation
