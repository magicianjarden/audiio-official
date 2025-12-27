# Testing Guide

Write and run tests for Audiio.

## Overview

Audiio uses the following testing tools:

| Tool | Purpose |
|------|---------|
| Vitest | Unit and integration tests |
| Playwright | E2E testing |
| Testing Library | React component testing |

## Running Tests

### All Tests

```bash
npm test
```

### Watch Mode

```bash
npm test -- --watch
```

### Specific Package

```bash
npm test --workspace=@audiio/ui
npm test --workspace=@audiio/core
```

### Coverage

```bash
npm test -- --coverage
```

## Project Structure

```
packages/
├── core/
│   └── src/
│       ├── index.ts
│       └── __tests__/
│           └── index.test.ts
├── ui/
│   └── src/
│       ├── components/
│       │   └── Player/
│       │       ├── Player.tsx
│       │       └── Player.test.tsx
│       └── stores/
│           ├── player-store.ts
│           └── player-store.test.ts
└── e2e/
    └── tests/
        └── playback.spec.ts
```

## Unit Tests

### Testing Functions

```typescript
// core/src/__tests__/utils.test.ts
import { describe, it, expect } from 'vitest';
import { formatDuration, normalizeString } from '../utils';

describe('formatDuration', () => {
  it('formats seconds to mm:ss', () => {
    expect(formatDuration(0)).toBe('0:00');
    expect(formatDuration(65)).toBe('1:05');
    expect(formatDuration(3661)).toBe('1:01:01');
  });

  it('handles edge cases', () => {
    expect(formatDuration(-1)).toBe('0:00');
    expect(formatDuration(Infinity)).toBe('0:00');
  });
});

describe('normalizeString', () => {
  it('lowercases and removes special characters', () => {
    expect(normalizeString('Hello World!')).toBe('hello world');
    expect(normalizeString("Don't Stop")).toBe('dont stop');
  });
});
```

### Testing Async Functions

```typescript
import { describe, it, expect, vi } from 'vitest';
import { searchTracks } from '../api';

describe('searchTracks', () => {
  it('returns tracks for valid query', async () => {
    const tracks = await searchTracks('beatles');

    expect(tracks).toBeInstanceOf(Array);
    expect(tracks.length).toBeGreaterThan(0);
    expect(tracks[0]).toHaveProperty('id');
    expect(tracks[0]).toHaveProperty('title');
  });

  it('returns empty array for no results', async () => {
    const tracks = await searchTracks('xyznonexistent123');
    expect(tracks).toEqual([]);
  });

  it('handles errors gracefully', async () => {
    vi.spyOn(global, 'fetch').mockRejectedValue(new Error('Network error'));

    const tracks = await searchTracks('test');
    expect(tracks).toEqual([]);
  });
});
```

### Mocking

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock module
vi.mock('../api', () => ({
  searchTracks: vi.fn(),
}));

import { searchTracks } from '../api';

describe('SearchService', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('calls API with correct parameters', async () => {
    (searchTracks as any).mockResolvedValue([]);

    await searchService.search('test query');

    expect(searchTracks).toHaveBeenCalledWith('test query', { limit: 25 });
  });
});
```

## Component Tests

### Basic Component Test

```typescript
// components/Player/Player.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Player } from './Player';

describe('Player', () => {
  it('renders current track', () => {
    const track = {
      id: '1',
      title: 'Test Song',
      artist: 'Test Artist',
      duration: 180,
    };

    render(<Player currentTrack={track} />);

    expect(screen.getByText('Test Song')).toBeInTheDocument();
    expect(screen.getByText('Test Artist')).toBeInTheDocument();
  });

  it('shows play button when paused', () => {
    render(<Player isPlaying={false} />);

    expect(screen.getByRole('button', { name: /play/i })).toBeInTheDocument();
  });

  it('shows pause button when playing', () => {
    render(<Player isPlaying={true} />);

    expect(screen.getByRole('button', { name: /pause/i })).toBeInTheDocument();
  });
});
```

### Testing Interactions

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Player } from './Player';

describe('Player interactions', () => {
  it('calls onPlay when play button clicked', () => {
    const onPlay = vi.fn();
    render(<Player isPlaying={false} onPlay={onPlay} />);

    fireEvent.click(screen.getByRole('button', { name: /play/i }));

    expect(onPlay).toHaveBeenCalledTimes(1);
  });

  it('calls onSeek when progress bar clicked', () => {
    const onSeek = vi.fn();
    render(<Player duration={100} onSeek={onSeek} />);

    const progressBar = screen.getByRole('slider');
    fireEvent.change(progressBar, { target: { value: '50' } });

    expect(onSeek).toHaveBeenCalledWith(50);
  });
});
```

### Testing with Zustand Stores

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { usePlayerStore } from '../../stores/player-store';
import { NowPlaying } from './NowPlaying';

describe('NowPlaying', () => {
  beforeEach(() => {
    // Reset store before each test
    usePlayerStore.setState({
      currentTrack: null,
      isPlaying: false,
    });
  });

  it('shows nothing when no track', () => {
    const { container } = render(<NowPlaying />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows track when playing', () => {
    act(() => {
      usePlayerStore.setState({
        currentTrack: {
          id: '1',
          title: 'Test',
          artist: 'Artist',
          duration: 180,
        },
        isPlaying: true,
      });
    });

    render(<NowPlaying />);

    expect(screen.getByText('Test')).toBeInTheDocument();
  });
});
```

## Store Tests

```typescript
// stores/player-store.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { usePlayerStore } from './player-store';

describe('PlayerStore', () => {
  beforeEach(() => {
    usePlayerStore.setState({
      currentTrack: null,
      isPlaying: false,
      queue: [],
      queueIndex: -1,
      volume: 1,
    });
  });

  describe('play', () => {
    it('plays a track', () => {
      const track = { id: '1', title: 'Test', artist: 'Test', duration: 180 };

      act(() => {
        usePlayerStore.getState().play(track);
      });

      const state = usePlayerStore.getState();
      expect(state.currentTrack).toEqual(track);
      expect(state.isPlaying).toBe(true);
      expect(state.queue).toContain(track);
    });

    it('resumes when called without track', () => {
      usePlayerStore.setState({
        currentTrack: { id: '1', title: 'Test', artist: 'Test', duration: 180 },
        isPlaying: false,
      });

      act(() => {
        usePlayerStore.getState().play();
      });

      expect(usePlayerStore.getState().isPlaying).toBe(true);
    });
  });

  describe('queue management', () => {
    it('adds tracks to queue', () => {
      const tracks = [
        { id: '1', title: 'Track 1', artist: 'Artist', duration: 180 },
        { id: '2', title: 'Track 2', artist: 'Artist', duration: 200 },
      ];

      act(() => {
        usePlayerStore.getState().addToQueue(tracks);
      });

      expect(usePlayerStore.getState().queue).toHaveLength(2);
    });

    it('removes track from queue', () => {
      usePlayerStore.setState({
        queue: [
          { id: '1', title: 'Track 1', artist: 'Artist', duration: 180 },
          { id: '2', title: 'Track 2', artist: 'Artist', duration: 200 },
        ],
        queueIndex: 0,
      });

      act(() => {
        usePlayerStore.getState().removeFromQueue(1);
      });

      expect(usePlayerStore.getState().queue).toHaveLength(1);
    });
  });
});
```

## Integration Tests

```typescript
// tests/integration/library.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestServer } from '../helpers';

describe('Library Integration', () => {
  let server: any;

  beforeAll(async () => {
    server = await createTestServer();
  });

  afterAll(async () => {
    await server.close();
  });

  it('likes and unlikes a track', async () => {
    const track = {
      id: 'test-1',
      title: 'Test Track',
      artist: 'Test Artist',
      duration: 180,
    };

    // Like track
    const likeResponse = await server.inject({
      method: 'POST',
      url: '/api/library/like',
      payload: track,
    });
    expect(likeResponse.statusCode).toBe(200);

    // Get likes
    const likesResponse = await server.inject({
      method: 'GET',
      url: '/api/library/likes',
    });
    const likes = JSON.parse(likesResponse.payload);
    expect(likes).toContainEqual(expect.objectContaining({ id: track.id }));

    // Unlike track
    const unlikeResponse = await server.inject({
      method: 'DELETE',
      url: `/api/library/likes/${track.id}`,
    });
    expect(unlikeResponse.statusCode).toBe(200);
  });
});
```

## E2E Tests

### Setup Playwright

```typescript
// playwright.config.ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e/tests',
  timeout: 30000,
  use: {
    baseURL: 'http://localhost:3000',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run dev',
    port: 3000,
    reuseExistingServer: !process.env.CI,
  },
});
```

### E2E Test Example

```typescript
// e2e/tests/playback.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Playback', () => {
  test('plays a track from search', async ({ page }) => {
    await page.goto('/');

    // Search for a track
    await page.click('[data-testid="search-button"]');
    await page.fill('[data-testid="search-input"]', 'test song');
    await page.press('[data-testid="search-input"]', 'Enter');

    // Wait for results
    await page.waitForSelector('[data-testid="search-results"]');

    // Click first result
    await page.click('[data-testid="track-row"]:first-child');

    // Verify playback
    await expect(page.locator('[data-testid="now-playing"]')).toBeVisible();
    await expect(page.locator('[data-testid="play-button"]')).toHaveAttribute(
      'aria-label',
      'Pause'
    );
  });

  test('controls playback with keyboard', async ({ page }) => {
    await page.goto('/');

    // Start playback
    await page.keyboard.press('Space');
    await expect(page.locator('[data-testid="is-playing"]')).toBeVisible();

    // Pause
    await page.keyboard.press('Space');
    await expect(page.locator('[data-testid="is-paused"]')).toBeVisible();

    // Skip next
    await page.keyboard.press('ArrowRight');
    // ... verify next track
  });
});
```

## Test Utilities

### Test Factories

```typescript
// tests/factories.ts
export function createTrack(overrides?: Partial<Track>): Track {
  return {
    id: `track-${Math.random().toString(36).slice(2)}`,
    title: 'Test Track',
    artist: 'Test Artist',
    duration: 180,
    ...overrides,
  };
}

export function createPlaylist(overrides?: Partial<Playlist>): Playlist {
  return {
    id: `playlist-${Math.random().toString(36).slice(2)}`,
    name: 'Test Playlist',
    tracks: [],
    createdAt: new Date(),
    ...overrides,
  };
}
```

### Custom Matchers

```typescript
// tests/matchers.ts
import { expect } from 'vitest';

expect.extend({
  toBeValidTrack(received) {
    const pass =
      received.id &&
      received.title &&
      received.artist &&
      typeof received.duration === 'number';

    return {
      pass,
      message: () =>
        pass
          ? `Expected ${received} not to be a valid track`
          : `Expected ${received} to be a valid track`,
    };
  },
});

// Usage
expect(track).toBeValidTrack();
```

### Test Helpers

```typescript
// tests/helpers.ts
import { render } from '@testing-library/react';

export function renderWithStore(component: React.ReactElement) {
  // Reset stores
  usePlayerStore.setState(initialPlayerState);
  useLibraryStore.setState(initialLibraryState);

  return render(component);
}

export async function waitForStoreUpdate(store: any, condition: (state: any) => boolean) {
  return new Promise<void>((resolve) => {
    const unsubscribe = store.subscribe((state: any) => {
      if (condition(state)) {
        unsubscribe();
        resolve();
      }
    });
  });
}
```

## CI Configuration

```yaml
# .github/workflows/test.yml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - run: npm ci

      - run: npm run build:all

      - run: npm test -- --coverage

      - uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info

  e2e:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - run: npm ci

      - run: npx playwright install --with-deps

      - run: npm run test:e2e

      - uses: actions/upload-artifact@v3
        if: failure()
        with:
          name: playwright-report
          path: playwright-report/
```

## Best Practices

### 1. Test Behavior, Not Implementation

```typescript
// Bad - testing implementation
it('sets isPlaying to true', () => {
  store.play();
  expect(store.isPlaying).toBe(true);
});

// Good - testing behavior
it('starts playing when play is called', () => {
  store.play(track);
  // Verify audio is actually playing
  expect(audioElement.paused).toBe(false);
});
```

### 2. Use Descriptive Names

```typescript
// Bad
it('works', () => { ... });

// Good
it('displays error message when search fails', () => { ... });
```

### 3. Isolate Tests

```typescript
beforeEach(() => {
  // Reset state
  vi.resetAllMocks();
  useStore.setState(initialState);
});
```

### 4. Test Edge Cases

```typescript
describe('formatDuration', () => {
  it('handles zero', () => { ... });
  it('handles negative numbers', () => { ... });
  it('handles very large numbers', () => { ... });
  it('handles NaN', () => { ... });
});
```

## Related

- [Architecture](architecture.md) - System design
- [Stores](stores.md) - State management
- [Contributing](../../CONTRIBUTING.md) - Contribution guide

