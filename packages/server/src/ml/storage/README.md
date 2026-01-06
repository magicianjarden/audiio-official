# ML Storage Module

Provides persistent storage adapters for the Audiio ML system, enabling features and machine learning data to survive server restarts. The module implements a layered storage architecture with environment-specific adapters and a high-level typed API for ML feature caching.

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Structure](#structure)
- [Files](#files)
  - [index.ts](#indexts)
  - [browser-storage.ts](#browser-storagets)
  - [node-storage.ts](#node-storagets)
  - [feature-store.ts](#feature-storets)
- [Interfaces](#interfaces)
- [Usage](#usage)
- [Dependencies](#dependencies)
- [Related](#related)

## Overview

The storage module solves the problem of persisting ML-computed features (audio analysis, genre predictions, embeddings, emotion data) across application sessions. Without persistence, expensive audio analysis would need to be recomputed every time the server restarts.

Key capabilities:

- **Environment Agnostic**: Adapters for Node.js (file-based), browser (localStorage), and testing (in-memory)
- **Typed Feature Access**: High-level API with TypeScript types for all ML feature categories
- **Debounced Persistence**: Automatic batching of writes to reduce I/O overhead
- **Version-Aware Caching**: Automatic invalidation when analysis algorithms are upgraded
- **Two-Layer Caching**: Memory cache for fast reads, persistent storage for durability

## Architecture

```
+------------------+     +------------------+     +------------------+
|   ML Engine      |     | Feature          |     |  Learning        |
|   ml-engine.ts   |     | Aggregator       |     |  Components      |
+--------+---------+     +--------+---------+     +--------+---------+
         |                        |                        |
         v                        v                        v
+------------------------------------------------------------------+
|                        FeatureStore                               |
|  - Memory cache (Map<string, StoredFeatures>)                    |
|  - Dirty tracking (Set<string>)                                  |
|  - Debounced persistence (2s delay)                              |
+----------------------------------+-------------------------------+
                                   |
                                   v
+------------------------------------------------------------------+
|                    FeatureStoreAdapter Interface                  |
|  get<T>(key): T | null                                           |
|  set<T>(key, value): void                                        |
|  persist(): void                                                 |
+----------------------------------+-------------------------------+
                                   |
         +-------------------------+-------------------------+
         |                         |                         |
         v                         v                         v
+----------------+       +----------------+       +----------------+
|  NodeStorage   |       | BrowserStorage |       | MemoryStorage  |
|  (File-based)  |       | (localStorage) |       | (In-memory)    |
+----------------+       +----------------+       +----------------+
         |
         v
+----------------+
| JSON File      |
| ml-storage.json|
+----------------+
```

## Structure

```
storage/
├── index.ts           - Barrel file exporting all storage adapters and types
├── browser-storage.ts - Browser-safe adapters (BrowserStorage, MemoryStorage)
├── node-storage.ts    - File-based JSON storage for Node.js/Electron
└── feature-store.ts   - High-level typed API for ML feature caching
```

## Files

### index.ts

- **Purpose**: Barrel file that aggregates and re-exports all storage adapters and types from the module
- **Exports**:
  - Classes: `BrowserStorage`, `MemoryStorage`, `NodeStorage`, `FeatureStore`
  - Types: `StorageAdapter`, `StoredFeatures`, `FeatureStoreAdapter`
- **Used by**: `../index.ts` (ML module root), consumers importing storage components

The barrel provides a clean public API while allowing internal module organization.

---

### browser-storage.ts

- **Purpose**: Provides browser-compatible storage adapters that do not depend on Node.js modules
- **Exports**:
  - `StorageAdapter` (interface) - Common contract for all storage implementations
  - `BrowserStorage` (class) - localStorage wrapper with error handling
  - `MemoryStorage` (class) - In-memory Map-based storage for testing
- **Used by**: `node-storage.ts` (imports `StorageAdapter` type), test suites, browser environments
- **Dependencies**: None (browser-native only)

#### StorageAdapter Interface

```typescript
interface StorageAdapter {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  clear(): void;
}
```

This interface mirrors the Web Storage API, making it trivial to swap implementations.

#### BrowserStorage Class

Wraps `localStorage` with try-catch blocks to gracefully handle:
- Storage quota exceeded errors
- Private browsing mode restrictions
- SSR environments where `localStorage` is undefined

#### MemoryStorage Class

Uses a `Map<string, string>` for fast in-memory storage. Ideal for:
- Unit testing without side effects
- Temporary caches that do not need persistence
- Environments without filesystem or localStorage access

---

### node-storage.ts

- **Purpose**: File-based JSON storage for Node.js and Electron main process environments
- **Exports**:
  - `NodeStorage` (class) - Persistent file-based storage with debounced writes
  - `StorageAdapter` (type re-export) - For convenience when importing
- **Used by**:
  - `../services/ml-service.ts` - Server-side ML initialization
  - `../engine/ml-engine.ts` - Feature store backing
  - `../learning/README.md` - Documentation examples
- **Dependencies**: Node.js `fs`, `path` modules

#### NodeStorage Class

```typescript
class NodeStorage implements StorageAdapter {
  constructor(storagePath: string, filename?: string);

  // StorageAdapter methods
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  clear(): void;

  // Extended typed API
  get<T>(key: string): T | null;
  set<T>(key: string, value: T): void;

  // Lifecycle
  persist(): void;   // Force immediate save
  dispose(): void;   // Cleanup and final persist
}
```

**Key Features**:

1. **Debounced Writes**: Changes are batched and written after 1 second of inactivity
2. **Automatic Directory Creation**: Creates parent directories if they do not exist
3. **Typed Access**: `get<T>()` and `set<T>()` methods handle JSON serialization
4. **Dirty Tracking**: Only writes when data has changed
5. **Graceful Shutdown**: `dispose()` ensures data is persisted before process exit

**Storage Format**: Data is stored as pretty-printed JSON for debuggability:

```json
{
  "key1": "value1",
  "feature:track123": "{\"trackId\":\"track123\",\"audio\":{...}}"
}
```

---

### feature-store.ts

- **Purpose**: High-level typed API for storing and retrieving ML-computed audio features
- **Exports**:
  - `StoredFeatures` (interface) - Shape of persisted feature data
  - `FeatureStoreAdapter` (interface) - Required storage backend contract
  - `FeatureStore` (class) - Main feature caching implementation
- **Used by**:
  - `../engine/ml-engine.ts` - Primary consumer for feature persistence
  - `../engine/feature-aggregator.ts` - Uses `StoredFeatures` type
- **Dependencies**: `../types` (AudioFeatures, EmotionFeatures, GenreFeatures, LyricsFeatures)

#### StoredFeatures Interface

```typescript
interface StoredFeatures {
  trackId: string;
  audio?: AudioFeatures;      // BPM, key, energy, danceability, etc.
  emotion?: EmotionFeatures;  // Valence, arousal, mood category
  genre?: GenreFeatures;      // Primary genre, predictions
  lyrics?: LyricsFeatures;    // Sentiment, themes, language
  embedding?: number[];       // Vector for similarity search
  lastUpdated: number;        // Unix timestamp
  analysisVersion: number;    // Algorithm version for cache invalidation
}
```

#### FeatureStoreAdapter Interface

```typescript
interface FeatureStoreAdapter {
  get<T>(key: string): T | null;
  set<T>(key: string, value: T): void;
  persist(): void;
}
```

This interface is implemented by `NodeStorage` (via its extended API).

#### FeatureStore Class

```typescript
class FeatureStore {
  constructor(storage: FeatureStoreAdapter);

  // Full feature access
  get(trackId: string): StoredFeatures | null;
  set(trackId: string, features: Partial<StoredFeatures>): void;

  // Typed accessors for specific feature types
  getAudio(trackId: string): AudioFeatures | null;
  setAudio(trackId: string, audio: AudioFeatures): void;

  getGenre(trackId: string): GenreFeatures | null;
  setGenre(trackId: string, genre: GenreFeatures): void;

  getEmotion(trackId: string): EmotionFeatures | null;
  setEmotion(trackId: string, emotion: EmotionFeatures): void;

  getEmbedding(trackId: string): number[] | null;
  setEmbedding(trackId: string, embedding: number[]): void;

  // Validation
  hasValidFeatures(trackId: string): boolean;

  // Statistics
  getStats(): { cached: number; dirty: number };

  // Lifecycle
  persist(): void;
  dispose(): void;
}
```

**Key Features**:

1. **Two-Layer Caching**:
   - Memory cache (`Map<string, StoredFeatures>`) for instant reads
   - Persistent storage for durability across restarts

2. **Merge Semantics**: `set()` merges new features with existing data, allowing incremental updates

3. **Version-Aware Invalidation**:
   - Each entry stores an `analysisVersion` number
   - When `CURRENT_ANALYSIS_VERSION` is incremented, old entries are treated as missing
   - Ensures users get fresh analysis when algorithms improve

4. **Debounced Persistence**:
   - Dirty entries tracked in a `Set<string>`
   - Persistence scheduled with 2-second debounce
   - Reduces disk I/O for batch operations

5. **Index Maintenance**: Maintains a `feature-index` key listing all cached track IDs

## Interfaces

### Storage Adapter Hierarchy

```
StorageAdapter (browser-storage.ts)
├── BrowserStorage  - localStorage wrapper
├── MemoryStorage   - Map-based in-memory
└── NodeStorage     - File-based JSON (extends with typed get/set)

FeatureStoreAdapter (feature-store.ts)
└── Subset of NodeStorage's extended API
```

### Type Flow

```
ML Types (../types/track.ts)
├── AudioFeatures
├── EmotionFeatures
├── GenreFeatures
├── LyricsFeatures
└── → StoredFeatures (feature-store.ts)
      └── → FeatureStore cache
```

## Usage

### Basic NodeStorage Usage

```typescript
import { NodeStorage } from './storage';

// Initialize with storage directory
const storage = new NodeStorage('/path/to/data', 'ml-storage.json');

// String-based access (StorageAdapter interface)
storage.setItem('key', 'value');
const value = storage.getItem('key');

// Typed access (extended API)
storage.set<{ count: number }>('stats', { count: 42 });
const stats = storage.get<{ count: number }>('stats');

// Cleanup on shutdown
process.on('exit', () => storage.dispose());
```

### FeatureStore Integration

```typescript
import { NodeStorage, FeatureStore } from './storage';
import type { AudioFeatures, GenreFeatures } from '../types';

// Create storage backend
const storage = new NodeStorage('/path/to/data', 'feature-store.json');

// Create feature store with adapter
const featureStore = new FeatureStore({
  get: (key) => storage.get(key),
  set: (key, value) => storage.set(key, value),
  persist: () => storage.persist(),
});

// Store audio features for a track
featureStore.setAudio('track-123', {
  bpm: 120,
  key: 'C',
  mode: 'major',
  energy: 0.8,
  danceability: 0.75,
});

// Store genre predictions
featureStore.setGenre('track-123', {
  primaryGenre: 'electronic',
  primaryConfidence: 0.85,
  predictions: [
    { genre: 'electronic', confidence: 0.85 },
    { genre: 'house', confidence: 0.72 },
  ],
  source: 'ml-predicted',
});

// Check if features are valid (not outdated)
if (featureStore.hasValidFeatures('track-123')) {
  const features = featureStore.get('track-123');
  console.log(`Track has ${features?.embedding?.length || 0}D embedding`);
}

// Get statistics
const stats = featureStore.getStats();
console.log(`Cached: ${stats.cached}, Dirty: ${stats.dirty}`);

// Force persistence and cleanup
featureStore.dispose();
```

### Testing with MemoryStorage

```typescript
import { MemoryStorage, FeatureStore } from './storage';

// Create in-memory storage for tests
const memoryStorage = new MemoryStorage();

// Wrap in adapter interface
const featureStore = new FeatureStore({
  get: (key) => {
    const value = memoryStorage.getItem(key);
    return value ? JSON.parse(value) : null;
  },
  set: (key, value) => memoryStorage.setItem(key, JSON.stringify(value)),
  persist: () => {}, // No-op for memory storage
});

// Use in tests without filesystem side effects
featureStore.setAudio('test-track', { bpm: 128 });
```

## Dependencies

### External Dependencies

- **Node.js `fs`**: File system operations (NodeStorage only)
- **Node.js `path`**: Path manipulation (NodeStorage only)

### Internal Dependencies

- `../types/track.ts`: Feature type definitions (AudioFeatures, EmotionFeatures, GenreFeatures, LyricsFeatures)

### Dependents (Used By)

| File | Usage |
|------|-------|
| `../engine/ml-engine.ts` | Creates FeatureStore for persistent feature caching |
| `../engine/feature-aggregator.ts` | Uses StoredFeatures type, receives FeatureStore via setter |
| `../services/ml-service.ts` | Initializes NodeStorage for server-side ML |
| `../learning/storage-helper.ts` | Uses StorageAdapter type for learning components |
| `../learning/event-recorder.ts` | Uses StorageHelper (which uses StorageAdapter) |
| `../learning/preference-store.ts` | Uses StorageHelper (which uses StorageAdapter) |
| `../index.ts` | Re-exports all storage components |

## Related

- **[../engine/](../engine/README.md)**: ML Engine that consumes FeatureStore
- **[../learning/](../learning/README.md)**: Learning components using StorageAdapter
- **[../types/](../types/)**: Type definitions for stored features
- **[../../services/ml-service.ts](../../services/ml-service.ts)**: Server-side ML initialization
