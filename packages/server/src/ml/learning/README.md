# Learning Components

This directory contains the core learning infrastructure for Audiio's ML recommendation system. These components work together to record user behavior, manage preferences, and schedule automatic model retraining based on accumulated user data.

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Files](#files)
  - [index.ts](#indexts)
  - [storage-helper.ts](#storage-helperts)
  - [event-recorder.ts](#event-recorderts)
  - [preference-store.ts](#preference-storets)
  - [training-scheduler.ts](#training-schedulerts)
- [How Components Work Together](#how-components-work-together)
- [Usage Examples](#usage-examples)
- [Configuration](#configuration)

## Overview

The learning system implements a continuous learning pipeline that:

1. **Records user events** (listens, skips, likes, dislikes) via `EventRecorder`
2. **Maintains user preferences** (artist/genre affinities, temporal patterns) via `PreferenceStore`
3. **Schedules automatic retraining** based on accumulated events via `TrainingScheduler`
4. **Persists state** across sessions using `StorageHelper` as the base class

All components extend `StorageHelper` to provide consistent persistence behavior across browser (localStorage) and Node.js (file-based) environments.

## Architecture

```
                    +------------------+
                    |    MLEngine      |
                    +--------+---------+
                             |
              +--------------+--------------+
              |              |              |
     +--------v------+ +-----v------+ +-----v--------+
     | EventRecorder | |Preference  | |  Training    |
     |               | |  Store     | |  Scheduler   |
     +-------+-------+ +-----+------+ +------+-------+
             |               |               |
             +-------+-------+               |
                     |                       |
             +-------v-------+               |
             | StorageHelper |<--------------+
             +---------------+
                     |
        +------------+------------+
        |                         |
+-------v-------+        +--------v-------+
|  localStorage |        |  NodeStorage   |
|   (browser)   |        |  (Node.js)     |
+---------------+        +----------------+
```

## Files

### index.ts

**Purpose**: Barrel export file that exposes all learning components.

**Exports**:
- `EventRecorder` - Records user events for training
- `PreferenceStore` - Manages user preferences and affinities
- `TrainingScheduler` - Schedules automatic model retraining
- `StorageHelper` - Base class for persistent storage

---

### storage-helper.ts

**Purpose**: Base class providing storage functionality for all learning components.

**Class: `StorageHelper`**

A mixin class that provides consistent storage access across environments.

| Method | Description |
|--------|-------------|
| `setStorage(storage: StorageAdapter)` | Sets a custom storage adapter |
| `getStorage(): StorageAdapter \| null` | Gets the storage adapter, falling back to `localStorage` |

**Key Features**:
- Supports custom `StorageAdapter` injection for Node.js environments
- Falls back to browser `localStorage` when available
- Returns `null` gracefully when no storage is available

**Dependencies**:
- `../storage/node-storage.ts` - `StorageAdapter` type definition

---

### event-recorder.ts

**Purpose**: Records and manages user events for ML model training.

**Class: `EventRecorder`** (extends `StorageHelper`)

Central repository for all user interaction events. Converts raw events into training samples with appropriate labels and weights.

**Storage Key**: `audiio-ml-events`

**Constants**:
- `MAX_EVENTS = 10000` - Maximum events to store

| Method | Description |
|--------|-------------|
| `load(): Promise<void>` | Loads events from storage |
| `save(): Promise<void>` | Persists events to storage |
| `record(event: UserEvent): Promise<void>` | Records a new user event |
| `getEvents(): UserEvent[]` | Returns all stored events |
| `getEventsByType<T>(type): Extract<UserEvent, { type: T }>[]` | Filters events by type |
| `getListenEvents(): ListenEvent[]` | Gets listen events |
| `getDislikeEvents(): DislikeEvent[]` | Gets dislike events |
| `getEventCount(): number` | Returns total event count |
| `getNewEventCount(): number` | Events since last training |
| `subscribe(callback): () => void` | Subscribe to new events |
| `getPositiveSamples(limit?): TrainingSample[]` | Get positive training samples |
| `getNegativeSamples(limit?): TrainingSample[]` | Get negative training samples |
| `getFullDataset(options?): TrainingDataset` | Get complete training dataset |
| `getFeatureStats(): FeatureStats` | Feature statistics for normalization |
| `markTrainingComplete(modelVersion): void` | Mark training as complete |
| `getLastTrainingInfo()` | Get info about last training |
| `updateTrainingResults(accuracy, loss): void` | Record training metrics |
| `clear(): void` | Clear all events |

**Skip Weight Graduation**:
The recorder uses graduated skip weights based on when the skip occurred:

| Skip Position | Label Value | Signal Strength |
|---------------|-------------|-----------------|
| < 10% | 0.0 | Strong negative |
| 10-25% | 0.05 | Strong negative |
| 25-50% | 0.15 | Moderate negative |
| 50-80% | 0.25 | Weak negative |
| > 80% | 0.30 | Very weak negative |

**Dataset Options**:
```typescript
interface DatasetOptions {
  maxSamples?: number;      // Default: 10000
  since?: number;           // Start timestamp
  until?: number;           // End timestamp
  minCompletion?: number;   // Default: 0.1
  balanceClasses?: boolean; // Default: true
}
```

---

### preference-store.ts

**Purpose**: Manages user preferences, affinities, and temporal listening patterns.

**Class: `PreferenceStore`** (extends `StorageHelper`)

Tracks artist and genre affinities, temporal patterns, and user settings for personalization.

**Storage Key**: `audiio-ml-preferences`

**Constants**:
- `DECAY_FACTOR = 0.98` - Daily affinity decay
- `MAX_AFFINITY = 100` - Maximum affinity value
- `MIN_AFFINITY = -100` - Minimum affinity value

| Method | Description |
|--------|-------------|
| `load(): Promise<void>` | Load preferences from storage |
| `save(): Promise<void>` | Persist preferences to storage |
| `updateFromEvent(event): Promise<void>` | Update preferences from user event |
| `getPreferences(): Promise<UserPreferences>` | Get user preferences summary |
| `getArtistAffinity(artistId): Promise<number>` | Get artist affinity (-1 to 1) |
| `getGenreAffinity(genre): Promise<number>` | Get genre affinity (-1 to 1) |
| `getAllArtistAffinities(): Promise<Map<string, number>>` | All artist affinities |
| `getAllGenreAffinities(): Promise<Map<string, number>>` | All genre affinities |
| `getTemporalPatterns(): Promise<TemporalPatterns>` | Get listening patterns |
| `wasRecentlyPlayed(trackId, withinMs?): Promise<boolean>` | Check recent plays |
| `getLastPlayed(trackId): Promise<number \| null>` | Get last play timestamp |
| `getDislikedTracks(): Array<DislikeInfo>` | Get disliked tracks |
| `setExplorationLevel(level): void` | Set discovery level (0-1) |
| `getExplorationLevel(): number` | Get discovery level |
| `setDiversityWeight(weight): void` | Set diversity weight (0-1) |
| `getDiversityWeight(): number` | Get diversity weight |

**Affinity Update Rules**:

| Event Type | Artist Delta | Genre Delta |
|------------|--------------|-------------|
| Completed listen | +5 | +3 |
| Partial listen | +0 to +3 (proportional) | +0 to +2 |
| Early skip | -3 | -2 |
| Late skip | -1 | -0.5 |
| Like | +10 or +15 (strength) | +5 or +8 |
| Dislike | -10 * weight | -5 * weight |

**Tracked Data**:
- `artists: Map<string, ArtistStats>` - Per-artist statistics
- `genres: Map<string, GenreStats>` - Per-genre statistics
- `dislikedTracks: Map<string, DislikeInfo>` - Disliked track registry
- `recentPlays: Map<string, number>` - Recent play timestamps
- `hourlyPlays: number[24]` - Plays per hour
- `hourlyEnergy: number[24]` - Average energy preference by hour
- `dailyPlays: number[7]` - Plays per day of week
- `genresByHour: Record<number, Record<string, number>>` - Genre preferences by hour

---

### training-scheduler.ts

**Purpose**: Manages automatic model retraining based on configurable triggers.

**Class: `TrainingScheduler`**

Schedules and executes model training based on event accumulation, time intervals, and user idle detection.

| Method | Description |
|--------|-------------|
| `start(trainFn): void` | Start the scheduler with training function |
| `stop(): void` | Stop the scheduler |
| `checkAndSchedule(eventCount): void` | Check if training should be scheduled |
| `trainNow(): Promise<void>` | Force immediate training |
| `updateConfig(config): void` | Update scheduler configuration |
| `getNextTrainingTime(): number \| null` | Get next scheduled training time |
| `getStatus()` | Get current scheduler status |

**Default Configuration** (`AutoTrainingConfig`):

| Setting | Default | Description |
|---------|---------|-------------|
| `enabled` | `true` | Enable auto-training |
| `minInterval` | 24 hours | Minimum time between trainings |
| `minNewEvents` | 10 | Minimum new events required |
| `maxInterval` | 7 days | Maximum time between trainings |
| `trainOnStartup` | `false` | Train when app starts |
| `trainWhenIdle` | `true` | Train during user idle |
| `idleThreshold` | 5 minutes | Idle detection threshold |

**Idle Detection**:
In browser environments, the scheduler monitors user activity (mousemove, keydown, click, scroll) to detect idle periods suitable for background training.

---

## How Components Work Together

### 1. Event Flow

When a user interacts with music:

```typescript
// 1. MLEngine receives user event
await mlEngine.recordEvent(event);

// 2. EventRecorder stores the event
await eventRecorder.record(event);

// 3. PreferenceStore updates affinities
await preferenceStore.updateFromEvent(event);

// 4. TrainingScheduler checks if retraining needed
trainingScheduler.checkAndSchedule(eventRecorder.getEventCount());
```

### 2. Training Flow

When training is triggered:

```typescript
// 1. TrainingScheduler invokes training function
trainingScheduler.start(async () => {
  // 2. Get training dataset from EventRecorder
  const dataset = eventRecorder.getFullDataset();

  // 3. Train the model
  await trainer.train(dataset);

  // 4. Mark training complete
  eventRecorder.markTrainingComplete(newModelVersion);
});
```

### 3. Preference Queries

When generating recommendations:

```typescript
// Get user's top preferences
const prefs = await preferenceStore.getPreferences();

// Get specific affinities
const artistAffinity = await preferenceStore.getArtistAffinity(artistId);
const genreAffinity = await preferenceStore.getGenreAffinity(genre);

// Get temporal patterns for context-aware recommendations
const patterns = await preferenceStore.getTemporalPatterns();
```

---

## Usage Examples

### Basic Setup

```typescript
import {
  EventRecorder,
  PreferenceStore,
  TrainingScheduler
} from './learning';

// Create instances
const eventRecorder = new EventRecorder();
const preferenceStore = new PreferenceStore();
const trainingScheduler = new TrainingScheduler();

// Load persisted state
await eventRecorder.load();
await preferenceStore.load();

// Start training scheduler
trainingScheduler.start(async () => {
  const dataset = eventRecorder.getFullDataset();
  await myTrainer.train(dataset);
});
```

### Recording Events

```typescript
// Record a completed listen
await eventRecorder.record({
  type: 'listen',
  timestamp: Date.now(),
  track: currentTrack,
  duration: 180,
  completion: 1.0,
  completed: true,
  source: { type: 'queue' },
  context: {
    hourOfDay: new Date().getHours(),
    dayOfWeek: new Date().getDay(),
    isWeekend: [0, 6].includes(new Date().getDay()),
  },
});
```

### Custom Storage (Node.js)

```typescript
import { NodeStorage } from '../storage/node-storage';

const storage = new NodeStorage('/path/to/data');

const eventRecorder = new EventRecorder();
eventRecorder.setStorage(storage);
await eventRecorder.load();
```

### Subscribing to Events

```typescript
// Subscribe to new events for real-time updates
const unsubscribe = eventRecorder.subscribe((event) => {
  console.log('New event:', event.type);
  updateUI(event);
});

// Later, unsubscribe
unsubscribe();
```

---

## Configuration

### TrainingScheduler Configuration

```typescript
const scheduler = new TrainingScheduler({
  enabled: true,
  minInterval: 12 * 60 * 60 * 1000,  // 12 hours
  minNewEvents: 20,
  maxInterval: 3 * 24 * 60 * 60 * 1000,  // 3 days
  trainOnStartup: true,
  trainWhenIdle: true,
  idleThreshold: 10 * 60 * 1000,  // 10 minutes
});
```

### PreferenceStore Settings

```typescript
// Adjust how adventurous recommendations should be
preferenceStore.setExplorationLevel(0.5);  // 0 = safe, 1 = adventurous

// Adjust variety in recommendations
preferenceStore.setDiversityWeight(0.7);   // 0 = focused, 1 = diverse
```

---

## Related

- `../engine/ml-engine.ts` - Main ML orchestrator that uses these components
- `../types/events.ts` - Event type definitions
- `../types/training.ts` - Training type definitions
- `../storage/node-storage.ts` - Node.js storage adapter
- `../algorithm/trainer.ts` - Neural network trainer
