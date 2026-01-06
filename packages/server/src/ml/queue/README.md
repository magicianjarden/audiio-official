# Queue Module

Server-side candidate retrieval for ML-powered queue replenishment.

## Overview

The Queue module provides the `SmartQueue` class, which is responsible for retrieving and filtering candidate tracks for queue replenishment. This is a **server-side component** that handles data retrieval and session tracking, while actual queue state management is handled client-side.

### Key Responsibilities

- Fetching candidates from configurable sources (library, similar tracks, radio)
- Tracking session history to avoid repetition
- Maintaining artist/genre diversity tracking
- Filtering out already-played tracks

### Architecture Note

The queue system follows a **split architecture**:

| Component | Location | Responsibility |
|-----------|----------|----------------|
| `SmartQueue` | Server (`packages/server/src/ml/queue/`) | Candidate retrieval, session tracking |
| `smart-queue-store` | Client (`packages/shared/ui/src/stores/`) | Queue state, UI, playback control |

This separation allows the server to handle data-intensive operations (similarity queries, large library scans) while the client maintains responsive UI state.

## Structure

```
queue/
  index.ts         - Module exports
  smart-queue.ts   - SmartQueue class implementation
```

## Files

### index.ts

- **Purpose**: Barrel export for the queue module
- **Exports**: `SmartQueue`
- **Used by**: `../index.ts`, `../engine/ml-engine.ts`

### smart-queue.ts

- **Purpose**: Core candidate retrieval logic for queue replenishment
- **Exports**: `SmartQueue` class
- **Used by**: `MLEngine`, `MLService`
- **Dependencies**: Types from `../types` (Track, ScoringContext, QueueCandidateContext, CandidateSource)

## SmartQueue Class

### Constructor

```typescript
const smartQueue = new SmartQueue();
```

Creates a new SmartQueue instance with empty session history.

### Data Providers

The SmartQueue uses a dependency injection pattern for data access. Providers must be configured before candidate retrieval will work.

#### setLibraryProvider

```typescript
setLibraryProvider(provider: () => Promise<Track[]>): void
```

Sets the provider for fetching all available tracks from the user's library.

**Example:**
```typescript
smartQueue.setLibraryProvider(async () => {
  const tracks = libraryService.getAllTracks();
  return tracks.map(convertToMLTrack);
});
```

#### setSimilarProvider

```typescript
setSimilarProvider(provider: (trackId: string, limit: number) => Promise<Track[]>): void
```

Sets the provider for finding similar tracks to a given track ID.

**Example:**
```typescript
smartQueue.setSimilarProvider(async (trackId, limit) => {
  const similarIds = await embeddingService.findSimilar(trackId, limit);
  return similarIds.map(id => library.getTrack(id));
});
```

### Session Tracking Methods

#### recordPlayed

```typescript
recordPlayed(track: Track): void
```

Records a track as played in the current session. This prevents the track from appearing in future candidate lists and contributes to artist diversity tracking.

**Example:**
```typescript
// When a track starts playing
playerStore.subscribe(state => {
  if (state.currentTrack) {
    smartQueue.recordPlayed(state.currentTrack);
  }
});
```

#### getSessionHistory

```typescript
getSessionHistory(): Track[]
```

Returns a copy of all tracks played in the current session (limited to most recent 200).

#### wasPlayedInSession

```typescript
wasPlayedInSession(trackId: string): boolean
```

Checks if a specific track has been played in the current session.

#### getSessionArtists

```typescript
getSessionArtists(): string[]
```

Returns list of unique artist IDs played in the current session.

#### getSessionGenres

```typescript
getSessionGenres(): string[]
```

Returns list of unique genres played in the current session.

#### resetSession

```typescript
resetSession(): void
```

Clears all session history. Call when the user starts a fresh listening session.

### Candidate Retrieval

#### getCandidates

```typescript
async getCandidates(context: QueueCandidateContext): Promise<Track[]>
```

Main method for retrieving candidate tracks for queue replenishment.

**Parameters:**

```typescript
interface QueueCandidateContext {
  // How many candidates to return
  count: number;

  // Source preferences (processed in order)
  sources: CandidateSource[];

  // Exclude these track IDs
  exclude?: string[];

  // Radio seed if in radio mode
  radioSeed?: RadioSeed;

  // Current scoring context
  scoringContext: ScoringContext;
}

type CandidateSource =
  | 'library'   // User's local library
  | 'similar'   // Similar to current track
  | 'radio';    // Radio-specific (uses radioSeed)
```

**Behavior:**

1. Collects all explicit exclusions
2. Adds session history to exclusions (prevents repetition)
3. Iterates through sources in priority order
4. Fetches candidates from each source until count is reached
5. Deduplicates candidates across sources

**Example:**
```typescript
const candidates = await smartQueue.getCandidates({
  count: 20,
  sources: ['similar', 'library'],
  exclude: currentQueueIds,
  scoringContext: {
    currentTrack: nowPlaying,
    sessionTracks: [...],
    queuedTracks: [...],
    // ... other context
  }
});
```

## Usage Patterns

### Basic Setup (in MLService)

```typescript
import { SmartQueue } from '../ml/queue';

class MLService {
  private smartQueue: SmartQueue;

  async initialize() {
    this.smartQueue = new SmartQueue();

    // Configure library provider
    this.smartQueue.setLibraryProvider(async () => {
      return this.libraryService.getAllTracks();
    });

    // Configure similar tracks provider
    this.smartQueue.setSimilarProvider(async (trackId, limit) => {
      return this.embeddingService.findSimilar(trackId, limit);
    });
  }
}
```

### Queue Replenishment Flow

```typescript
// Server-side: Get candidates
async function getQueueCandidates(request: ReplenishRequest) {
  const candidates = await smartQueue.getCandidates({
    count: request.batchSize,
    sources: ['similar', 'library'],
    exclude: request.currentQueueIds,
    scoringContext: buildScoringContext(request)
  });

  // Score candidates using ML
  const scored = await mlEngine.scoreTracks(candidates, context);

  // Return top candidates
  return scored.slice(0, request.batchSize);
}

// Client-side: Add to queue
async function replenishQueue() {
  const candidates = await api.getQueueCandidates({
    batchSize: 10,
    currentQueueIds: queue.map(t => t.id)
  });

  queue.push(...candidates);
}
```

### Radio Mode

```typescript
const radioTracks = await smartQueue.getCandidates({
  count: 10,
  sources: ['radio', 'similar'],
  radioSeed: {
    type: 'track',
    id: seedTrackId,
    name: seedTrack.title
  },
  scoringContext: context
});
```

## Configuration Constants

| Constant | Value | Description |
|----------|-------|-------------|
| `MAX_SESSION_HISTORY` | 200 | Maximum tracks to keep in session history |

## Integration Points

### MLEngine

The `SmartQueue` is instantiated and managed by `MLEngine`:

```typescript
// In MLEngine constructor
this.smartQueue = new SmartQueue();

// Exposed via getter
getSmartQueue(): SmartQueue {
  return this.smartQueue;
}
```

### MLService

`MLService` configures the SmartQueue providers during initialization:

```typescript
const smartQueue = this.engine.getSmartQueue();
smartQueue.setLibraryProvider(/* ... */);
smartQueue.setSimilarProvider(/* ... */);
```

### Endpoints

The `QueueEndpoint` interface wraps SmartQueue methods:

```typescript
interface QueueEndpoint {
  getCandidates(context: QueueCandidateContext): Promise<Track[]>;
  getSessionHistory(): Track[];
  wasPlayedInSession(trackId: string): boolean;
}
```

## Related Modules

- `../types/endpoints.ts` - Type definitions for QueueCandidateContext, CandidateSource
- `../types/scoring.ts` - ScoringContext, RadioSeed types
- `../engine/ml-engine.ts` - Instantiates and manages SmartQueue
- `../../services/ml-service.ts` - Configures SmartQueue providers
- `packages/shared/ui/src/stores/smart-queue-store.ts` - Client-side queue state management

## Design Decisions

### Why Server-Side?

1. **Library Access**: The server has direct access to the full track library and database
2. **Similarity Queries**: Embedding-based similarity search is computationally intensive
3. **Session Isolation**: Server can maintain session state across client reconnects
4. **Caching**: Server can cache similarity results and library snapshots

### Why Dependency Injection for Providers?

1. **Decoupling**: SmartQueue doesn't depend on specific database/service implementations
2. **Testing**: Easy to mock providers for unit tests
3. **Flexibility**: Different deployments can provide data differently
