# Utils

Shared utility functions and classes used across the core package.

---

## event-emitter.ts

A lightweight, type-safe event emitter implementation for pub/sub communication patterns.

### Purpose

Provides a generic event system that enables decoupled communication between components. Used by orchestrators and services to broadcast state changes and events.

### API

#### `EventEmitter<TEvents>`

Generic class where `TEvents` is a type mapping event names to their payload types.

| Method | Description |
|--------|-------------|
| `on(event, handler)` | Subscribe to an event. Returns an unsubscribe function. |
| `once(event, handler)` | Subscribe to an event for a single emission only. |
| `off(event, handler)` | Unsubscribe a specific handler from an event. |
| `emit(event, data)` | Emit an event with data to all subscribers. |
| `removeAllListeners(event?)` | Remove all listeners for an event, or all events if none specified. |

### Usage

```typescript
import { EventEmitter } from '@audiio/core';

// Define event types
interface PlayerEvents {
  play: { trackId: string };
  pause: void;
  progress: { position: number; duration: number };
}

// Create emitter
const emitter = new EventEmitter<PlayerEvents>();

// Subscribe
const unsubscribe = emitter.on('play', (data) => {
  console.log('Playing track:', data.trackId);
});

// Emit
emitter.emit('play', { trackId: 'abc-123' });

// Cleanup
unsubscribe();
```

---

## id-generator.ts

Generates unique identifiers for tracks and other entities.

### Purpose

Provides a consistent way to generate UUIDs throughout the application, primarily used for assigning unique IDs to tracks when they're added to the library.

### API

#### `generateTrackId(): string`

Returns a UUID v4 string in the format `xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx`.

### Usage

```typescript
import { generateTrackId } from '@audiio/core';

const id = generateTrackId();
// => "a1b2c3d4-e5f6-4789-a012-b3c4d5e6f789"
```
