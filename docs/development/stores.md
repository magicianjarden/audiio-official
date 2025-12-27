# Zustand Store Patterns

Audiio uses Zustand for state management. This guide covers patterns and best practices.

## Overview

Zustand is a minimal state management library. Audiio uses it for:

- **Global state** - Player, library, UI state
- **Persistence** - Saving to localStorage/SQLite
- **Cross-component communication** - Shared state between components

## Store Structure

Each store follows this pattern:

```typescript
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface StoreState {
  // State
  items: Item[];
  isLoading: boolean;

  // Actions
  addItem: (item: Item) => void;
  removeItem: (id: string) => void;
  fetchItems: () => Promise<void>;
}

export const useStore = create<StoreState>()((set, get) => ({
  // Initial state
  items: [],
  isLoading: false,

  // Actions
  addItem: (item) => set((state) => ({
    items: [...state.items, item],
  })),

  removeItem: (id) => set((state) => ({
    items: state.items.filter(i => i.id !== id),
  })),

  fetchItems: async () => {
    set({ isLoading: true });
    try {
      const items = await api.getItems();
      set({ items, isLoading: false });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },
}));
```

## Core Stores

### Player Store

Manages playback state:

```typescript
// stores/player-store.ts
interface PlayerState {
  // Current playback
  currentTrack: Track | null;
  isPlaying: boolean;
  position: number;
  duration: number;
  volume: number;

  // Queue
  queue: Track[];
  queueIndex: number;

  // Modes
  shuffle: boolean;
  repeat: 'off' | 'all' | 'one';

  // Actions
  play: (track?: Track) => void;
  pause: () => void;
  next: () => void;
  previous: () => void;
  seek: (position: number) => void;
  setVolume: (volume: number) => void;
  addToQueue: (tracks: Track[]) => void;
  clearQueue: () => void;
  toggleShuffle: () => void;
  setRepeat: (mode: 'off' | 'all' | 'one') => void;
}

export const usePlayerStore = create<PlayerState>()((set, get) => ({
  currentTrack: null,
  isPlaying: false,
  position: 0,
  duration: 0,
  volume: 1,
  queue: [],
  queueIndex: -1,
  shuffle: false,
  repeat: 'off',

  play: (track) => {
    if (track) {
      const queue = get().queue;
      const index = queue.findIndex(t => t.id === track.id);

      if (index >= 0) {
        set({ queueIndex: index, currentTrack: track, isPlaying: true });
      } else {
        set({
          queue: [track],
          queueIndex: 0,
          currentTrack: track,
          isPlaying: true,
        });
      }
    } else {
      set({ isPlaying: true });
    }

    // Notify audio element
    audioManager.play();
  },

  pause: () => {
    set({ isPlaying: false });
    audioManager.pause();
  },

  next: () => {
    const { queue, queueIndex, repeat, shuffle } = get();

    if (queue.length === 0) return;

    let nextIndex: number;

    if (shuffle) {
      nextIndex = Math.floor(Math.random() * queue.length);
    } else {
      nextIndex = queueIndex + 1;

      if (nextIndex >= queue.length) {
        if (repeat === 'all') {
          nextIndex = 0;
        } else {
          set({ isPlaying: false });
          return;
        }
      }
    }

    set({
      queueIndex: nextIndex,
      currentTrack: queue[nextIndex],
      position: 0,
    });
  },

  // ... other actions
}));
```

### Library Store

Manages user's music collection:

```typescript
// stores/library-store.ts
interface LibraryState {
  // Data
  likes: Track[];
  dislikes: Track[];
  playlists: Playlist[];
  downloads: Track[];

  // Loading states
  isLoading: boolean;
  isInitialized: boolean;

  // Actions
  likeTrack: (track: Track) => Promise<void>;
  unlikeTrack: (trackId: string) => Promise<void>;
  dislikeTrack: (track: Track, reason?: string) => Promise<void>;
  createPlaylist: (name: string) => Promise<Playlist>;
  addToPlaylist: (playlistId: string, tracks: Track[]) => Promise<void>;
  downloadTrack: (track: Track) => Promise<void>;

  // Initialization
  initialize: () => Promise<void>;
}

export const useLibraryStore = create<LibraryState>()(
  persist(
    (set, get) => ({
      likes: [],
      dislikes: [],
      playlists: [],
      downloads: [],
      isLoading: false,
      isInitialized: false,

      likeTrack: async (track) => {
        // Optimistic update
        set((state) => ({
          likes: [...state.likes, track],
        }));

        // Persist to backend
        try {
          await ipc.invoke('library:like', track);
        } catch (error) {
          // Rollback on failure
          set((state) => ({
            likes: state.likes.filter(t => t.id !== track.id),
          }));
          throw error;
        }
      },

      initialize: async () => {
        if (get().isInitialized) return;

        set({ isLoading: true });

        try {
          const [likes, dislikes, playlists, downloads] = await Promise.all([
            ipc.invoke('library:getLikes'),
            ipc.invoke('library:getDislikes'),
            ipc.invoke('library:getPlaylists'),
            ipc.invoke('library:getDownloads'),
          ]);

          set({
            likes,
            dislikes,
            playlists,
            downloads,
            isLoading: false,
            isInitialized: true,
          });
        } catch (error) {
          set({ isLoading: false });
          throw error;
        }
      },
    }),
    {
      name: 'library-store',
      partialize: (state) => ({
        // Only persist these fields
        likes: state.likes,
        playlists: state.playlists,
      }),
    }
  )
);
```

### UI Store

Manages UI state:

```typescript
// stores/ui-store.ts
interface UIState {
  // Theme
  theme: 'light' | 'dark' | 'system';
  accentColor: string;

  // Layout
  sidebarCollapsed: boolean;
  queueVisible: boolean;
  lyricsVisible: boolean;

  // Modals
  activeModal: string | null;
  modalData: any;

  // Actions
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  toggleSidebar: () => void;
  toggleQueue: () => void;
  toggleLyrics: () => void;
  openModal: (modal: string, data?: any) => void;
  closeModal: () => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      theme: 'system',
      accentColor: '#3b82f6',
      sidebarCollapsed: false,
      queueVisible: false,
      lyricsVisible: false,
      activeModal: null,
      modalData: null,

      setTheme: (theme) => set({ theme }),

      toggleSidebar: () => set((state) => ({
        sidebarCollapsed: !state.sidebarCollapsed,
      })),

      toggleQueue: () => set((state) => ({
        queueVisible: !state.queueVisible,
      })),

      toggleLyrics: () => set((state) => ({
        lyricsVisible: !state.lyricsVisible,
      })),

      openModal: (modal, data) => set({
        activeModal: modal,
        modalData: data,
      }),

      closeModal: () => set({
        activeModal: null,
        modalData: null,
      }),
    }),
    {
      name: 'ui-store',
      partialize: (state) => ({
        theme: state.theme,
        accentColor: state.accentColor,
        sidebarCollapsed: state.sidebarCollapsed,
      }),
    }
  )
);
```

## Patterns

### Selectors

Use selectors for derived state:

```typescript
// In store
const usePlayerStore = create<PlayerState>()((set, get) => ({
  // ...state

  // Selector
  get hasNext() {
    const { queue, queueIndex } = get();
    return queueIndex < queue.length - 1;
  },
}));

// In component
const hasNext = usePlayerStore((state) => state.queueIndex < state.queue.length - 1);
```

### Computed State

For expensive computations:

```typescript
import { shallow } from 'zustand/shallow';

// Memoized selector
const selectQueueDuration = (state: PlayerState) =>
  state.queue.reduce((acc, track) => acc + track.duration, 0);

// In component - only re-renders when duration changes
const queueDuration = usePlayerStore(selectQueueDuration);

// Multiple values with shallow comparison
const { isPlaying, volume } = usePlayerStore(
  (state) => ({ isPlaying: state.isPlaying, volume: state.volume }),
  shallow
);
```

### Async Actions

Handle async operations:

```typescript
interface StoreState {
  items: Item[];
  isLoading: boolean;
  error: Error | null;

  fetchItems: () => Promise<void>;
}

const useStore = create<StoreState>()((set) => ({
  items: [],
  isLoading: false,
  error: null,

  fetchItems: async () => {
    set({ isLoading: true, error: null });

    try {
      const items = await api.getItems();
      set({ items, isLoading: false });
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error : new Error('Unknown error'),
      });
    }
  },
}));
```

### Optimistic Updates

Update UI immediately, rollback on failure:

```typescript
likeTrack: async (track) => {
  const previousLikes = get().likes;

  // Optimistic update
  set((state) => ({
    likes: [...state.likes, track],
  }));

  try {
    await api.likeTrack(track.id);
  } catch (error) {
    // Rollback
    set({ likes: previousLikes });
    throw error;
  }
},
```

### Subscriptions

React to state changes:

```typescript
// Subscribe to changes
const unsubscribe = usePlayerStore.subscribe(
  (state) => state.currentTrack,
  (track, previousTrack) => {
    if (track && track.id !== previousTrack?.id) {
      // Track changed - update media session
      updateMediaSession(track);
    }
  }
);

// Cleanup
unsubscribe();
```

### Middleware

#### Persist Middleware

Save to localStorage:

```typescript
import { persist, createJSONStorage } from 'zustand/middleware';

const useStore = create<StoreState>()(
  persist(
    (set, get) => ({
      // ... store
    }),
    {
      name: 'store-key',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        // Only persist these fields
        settings: state.settings,
      }),
    }
  )
);
```

#### DevTools Middleware

Debug with Redux DevTools:

```typescript
import { devtools } from 'zustand/middleware';

const useStore = create<StoreState>()(
  devtools(
    (set, get) => ({
      // ... store
    }),
    { name: 'StoreName' }
  )
);
```

### Store Slices

Split large stores into slices:

```typescript
// slices/player-slice.ts
export interface PlayerSlice {
  currentTrack: Track | null;
  isPlaying: boolean;
  play: () => void;
  pause: () => void;
}

export const createPlayerSlice: StateCreator<PlayerSlice> = (set) => ({
  currentTrack: null,
  isPlaying: false,
  play: () => set({ isPlaying: true }),
  pause: () => set({ isPlaying: false }),
});

// slices/queue-slice.ts
export interface QueueSlice {
  queue: Track[];
  addToQueue: (tracks: Track[]) => void;
}

export const createQueueSlice: StateCreator<QueueSlice> = (set) => ({
  queue: [],
  addToQueue: (tracks) => set((state) => ({
    queue: [...state.queue, ...tracks],
  })),
});

// Combined store
type CombinedState = PlayerSlice & QueueSlice;

const useStore = create<CombinedState>()((...args) => ({
  ...createPlayerSlice(...args),
  ...createQueueSlice(...args),
}));
```

## Usage in Components

### Basic Usage

```tsx
function Player() {
  const { currentTrack, isPlaying, play, pause } = usePlayerStore();

  return (
    <div>
      {currentTrack && <span>{currentTrack.title}</span>}
      <button onClick={isPlaying ? pause : play}>
        {isPlaying ? 'Pause' : 'Play'}
      </button>
    </div>
  );
}
```

### With Selectors

```tsx
// Avoid re-renders when unrelated state changes
function VolumeControl() {
  const volume = usePlayerStore((state) => state.volume);
  const setVolume = usePlayerStore((state) => state.setVolume);

  return <Slider value={volume} onChange={setVolume} />;
}
```

### Outside React

```typescript
// Access store outside components
const state = usePlayerStore.getState();
const currentTrack = state.currentTrack;

// Update store
usePlayerStore.setState({ volume: 0.5 });

// Subscribe to changes
usePlayerStore.subscribe((state) => {
  console.log('State changed:', state);
});
```

## Testing

```typescript
import { renderHook, act } from '@testing-library/react';
import { usePlayerStore } from './player-store';

describe('PlayerStore', () => {
  beforeEach(() => {
    // Reset store between tests
    usePlayerStore.setState({
      currentTrack: null,
      isPlaying: false,
      queue: [],
      queueIndex: -1,
    });
  });

  it('plays a track', () => {
    const track = { id: '1', title: 'Test', artist: 'Test', duration: 180 };

    act(() => {
      usePlayerStore.getState().play(track);
    });

    const state = usePlayerStore.getState();
    expect(state.currentTrack).toEqual(track);
    expect(state.isPlaying).toBe(true);
  });

  it('adds to queue', () => {
    const tracks = [
      { id: '1', title: 'Track 1', artist: 'Artist', duration: 180 },
      { id: '2', title: 'Track 2', artist: 'Artist', duration: 200 },
    ];

    act(() => {
      usePlayerStore.getState().addToQueue(tracks);
    });

    expect(usePlayerStore.getState().queue).toHaveLength(2);
  });
});
```

## Best Practices

### 1. Keep Stores Focused

One store per domain:
- `player-store.ts` - Playback only
- `library-store.ts` - User library only
- `ui-store.ts` - UI state only

### 2. Use Selectors

Prevent unnecessary re-renders:

```typescript
// Bad - re-renders on any state change
const store = usePlayerStore();

// Good - only re-renders when volume changes
const volume = usePlayerStore((state) => state.volume);
```

### 3. Batch Updates

Minimize re-renders:

```typescript
// Bad - two state updates
set({ isLoading: true });
set({ items: newItems });

// Good - single update
set({ isLoading: true, items: newItems });
```

### 4. Handle Loading States

Always track async operation states:

```typescript
interface State {
  data: Data | null;
  isLoading: boolean;
  error: Error | null;
}
```

## Related

- [Architecture](architecture.md) - System design
- [IPC Reference](ipc-reference.md) - Desktop IPC
- [Testing](testing.md) - Testing guide

