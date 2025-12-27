# IPC Reference

Complete reference for Inter-Process Communication between Electron's main and renderer processes.

## Overview

Audiio uses Electron's IPC for communication:

- **Renderer → Main**: UI requests actions (play, search, etc.)
- **Main → Renderer**: Backend sends updates (track changed, download progress)

## IPC Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                       Renderer Process                       │
│                                                              │
│  React Components  ──►  ipcRenderer  ──►  Preload Bridge    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                        Main Process                          │
│                                                              │
│      IPC Handlers  ◄──  ipcMain  ◄──  Service Layer         │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Preload API

The preload script exposes a safe API to the renderer:

```typescript
// preload.ts
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('api', {
  // Invoke (request/response)
  invoke: (channel: string, ...args: any[]) => ipcRenderer.invoke(channel, ...args),

  // Send (fire and forget)
  send: (channel: string, ...args: any[]) => ipcRenderer.send(channel, ...args),

  // Listen for events
  on: (channel: string, callback: (...args: any[]) => void) => {
    const subscription = (_event: any, ...args: any[]) => callback(...args);
    ipcRenderer.on(channel, subscription);
    return () => ipcRenderer.removeListener(channel, subscription);
  },

  // Listen once
  once: (channel: string, callback: (...args: any[]) => void) => {
    ipcRenderer.once(channel, (_event, ...args) => callback(...args));
  },
});
```

## Channel Reference

### Library Channels

#### `library:getLikes`

Get all liked tracks.

```typescript
// Renderer
const likes = await window.api.invoke('library:getLikes');
// Returns: Track[]

// Main
ipcMain.handle('library:getLikes', async () => {
  return libraryService.getLikes();
});
```

#### `library:like`

Like a track.

```typescript
// Renderer
await window.api.invoke('library:like', track);

// Main
ipcMain.handle('library:like', async (event, track: Track) => {
  await libraryService.like(track);
  // Emit to all windows
  BrowserWindow.getAllWindows().forEach(win => {
    win.webContents.send('library:liked', track);
  });
});
```

#### `library:unlike`

Remove a like.

```typescript
await window.api.invoke('library:unlike', trackId);
```

#### `library:dislike`

Dislike a track.

```typescript
await window.api.invoke('library:dislike', { track, reason });
```

#### `library:getPlaylists`

Get all playlists.

```typescript
const playlists = await window.api.invoke('library:getPlaylists');
// Returns: Playlist[]
```

#### `library:createPlaylist`

Create a new playlist.

```typescript
const playlist = await window.api.invoke('library:createPlaylist', {
  name: 'My Playlist',
  description: 'Optional description',
});
// Returns: Playlist
```

#### `library:addToPlaylist`

Add tracks to playlist.

```typescript
await window.api.invoke('library:addToPlaylist', {
  playlistId: 'playlist-123',
  tracks: [track1, track2],
});
```

#### `library:removeFromPlaylist`

Remove tracks from playlist.

```typescript
await window.api.invoke('library:removeFromPlaylist', {
  playlistId: 'playlist-123',
  trackIds: ['track-1', 'track-2'],
});
```

### Player Channels

#### `player:getStream`

Get stream URL for a track.

```typescript
const stream = await window.api.invoke('player:getStream', track);
// Returns: { url: string, format: string, headers?: Record<string, string> }
```

#### `player:updateProgress`

Update playback progress (for scrobblers).

```typescript
window.api.send('player:updateProgress', {
  track,
  position: 120,
  duration: 240,
});
```

#### `player:trackEnded`

Notify when track finishes.

```typescript
window.api.send('player:trackEnded', {
  track,
  playedDuration: 235,
  completed: true,
});
```

### Search Channels

#### `search:tracks`

Search for tracks.

```typescript
const results = await window.api.invoke('search:tracks', {
  query: 'song name',
  limit: 25,
});
// Returns: Track[]
```

#### `search:artists`

Search for artists.

```typescript
const artists = await window.api.invoke('search:artists', { query, limit });
// Returns: Artist[]
```

#### `search:albums`

Search for albums.

```typescript
const albums = await window.api.invoke('search:albums', { query, limit });
// Returns: Album[]
```

### Addon Channels

#### `addon:getAll`

Get all installed addons.

```typescript
const addons = await window.api.invoke('addon:getAll');
// Returns: AddonInfo[]
```

#### `addon:enable`

Enable an addon.

```typescript
await window.api.invoke('addon:enable', addonId);
```

#### `addon:disable`

Disable an addon.

```typescript
await window.api.invoke('addon:disable', addonId);
```

#### `addon:getSettings`

Get addon settings.

```typescript
const settings = await window.api.invoke('addon:getSettings', addonId);
```

#### `addon:updateSettings`

Update addon settings.

```typescript
await window.api.invoke('addon:updateSettings', {
  addonId,
  settings: { key: 'value' },
});
```

### Lyrics Channels

#### `lyrics:get`

Get lyrics for a track.

```typescript
const lyrics = await window.api.invoke('lyrics:get', track);
// Returns: Lyrics | null
```

### Download Channels

#### `download:start`

Start downloading a track.

```typescript
await window.api.invoke('download:start', track);
```

#### `download:cancel`

Cancel a download.

```typescript
await window.api.invoke('download:cancel', trackId);
```

#### `download:progress`

Listen for download progress.

```typescript
const unsubscribe = window.api.on('download:progress', (data) => {
  console.log(`${data.trackId}: ${data.progress}%`);
});

// Cleanup
unsubscribe();
```

### Settings Channels

#### `settings:get`

Get a setting value.

```typescript
const value = await window.api.invoke('settings:get', 'theme');
```

#### `settings:set`

Set a setting value.

```typescript
await window.api.invoke('settings:set', { key: 'theme', value: 'dark' });
```

#### `settings:getAll`

Get all settings.

```typescript
const settings = await window.api.invoke('settings:getAll');
```

### Window Channels

#### `window:minimize`

Minimize window.

```typescript
window.api.send('window:minimize');
```

#### `window:maximize`

Toggle maximize.

```typescript
window.api.send('window:maximize');
```

#### `window:close`

Close window.

```typescript
window.api.send('window:close');
```

### System Channels

#### `system:openExternal`

Open URL in default browser.

```typescript
await window.api.invoke('system:openExternal', 'https://audiio.app');
```

#### `system:getVersion`

Get app version.

```typescript
const version = await window.api.invoke('system:getVersion');
// Returns: "1.0.0"
```

## Events (Main → Renderer)

### `library:liked`

Track was liked.

```typescript
window.api.on('library:liked', (track) => {
  console.log('Liked:', track.title);
});
```

### `library:unliked`

Track was unliked.

```typescript
window.api.on('library:unliked', (trackId) => {
  console.log('Unliked:', trackId);
});
```

### `player:stateChanged`

Playback state changed.

```typescript
window.api.on('player:stateChanged', (state) => {
  // state: { isPlaying, track, position, duration }
});
```

### `download:progress`

Download progress update.

```typescript
window.api.on('download:progress', ({ trackId, progress, speed }) => {
  console.log(`${trackId}: ${progress}% at ${speed}/s`);
});
```

### `download:complete`

Download finished.

```typescript
window.api.on('download:complete', ({ trackId, path }) => {
  console.log(`Downloaded to: ${path}`);
});
```

### `download:error`

Download failed.

```typescript
window.api.on('download:error', ({ trackId, error }) => {
  console.error(`Download failed: ${error}`);
});
```

### `addon:loaded`

Addon was loaded.

```typescript
window.api.on('addon:loaded', (addonInfo) => {
  console.log('Addon loaded:', addonInfo.name);
});
```

### `update:available`

App update available.

```typescript
window.api.on('update:available', (info) => {
  console.log('Update available:', info.version);
});
```

## Implementing Handlers

### Main Process Handler

```typescript
// main/handlers/library-handlers.ts
import { ipcMain, BrowserWindow } from 'electron';
import { libraryService } from '../services/library-service';

export function registerLibraryHandlers() {
  ipcMain.handle('library:getLikes', async () => {
    return libraryService.getLikes();
  });

  ipcMain.handle('library:like', async (event, track: Track) => {
    await libraryService.like(track);

    // Notify all windows
    BrowserWindow.getAllWindows().forEach(win => {
      win.webContents.send('library:liked', track);
    });

    return { success: true };
  });

  ipcMain.handle('library:createPlaylist', async (event, data) => {
    const playlist = await libraryService.createPlaylist(data.name, data.description);
    return playlist;
  });
}
```

### Renderer Hook

```typescript
// hooks/useIpc.ts
import { useEffect, useCallback } from 'react';

export function useIpcListener<T>(channel: string, callback: (data: T) => void) {
  useEffect(() => {
    const unsubscribe = window.api.on(channel, callback);
    return () => unsubscribe();
  }, [channel, callback]);
}

export function useIpcInvoke<T, R>(channel: string) {
  return useCallback(
    async (data: T): Promise<R> => {
      return window.api.invoke(channel, data);
    },
    [channel]
  );
}
```

## Error Handling

### In Handler

```typescript
ipcMain.handle('library:like', async (event, track) => {
  try {
    await libraryService.like(track);
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
});
```

### In Renderer

```typescript
async function likeTrack(track: Track) {
  try {
    const result = await window.api.invoke('library:like', track);
    if (!result.success) {
      throw new Error(result.error);
    }
  } catch (error) {
    console.error('Failed to like track:', error);
    showError('Failed to like track');
  }
}
```

## TypeScript Types

```typescript
// types/ipc.ts
export interface IpcApi {
  invoke<T>(channel: string, ...args: any[]): Promise<T>;
  send(channel: string, ...args: any[]): void;
  on<T>(channel: string, callback: (data: T) => void): () => void;
  once<T>(channel: string, callback: (data: T) => void): void;
}

declare global {
  interface Window {
    api: IpcApi;
  }
}

// Type-safe channel definitions
export type IpcChannels = {
  'library:getLikes': { args: []; return: Track[] };
  'library:like': { args: [Track]; return: { success: boolean } };
  'search:tracks': { args: [{ query: string; limit?: number }]; return: Track[] };
  // ... more channels
};
```

## Security Considerations

### Channel Validation

Always validate channel names:

```typescript
const ALLOWED_CHANNELS = ['library:', 'player:', 'search:', 'addon:', 'settings:'];

contextBridge.exposeInMainWorld('api', {
  invoke: (channel: string, ...args: any[]) => {
    if (!ALLOWED_CHANNELS.some(prefix => channel.startsWith(prefix))) {
      throw new Error(`Invalid channel: ${channel}`);
    }
    return ipcRenderer.invoke(channel, ...args);
  },
});
```

### Input Validation

Validate all inputs in handlers:

```typescript
ipcMain.handle('library:createPlaylist', async (event, data) => {
  if (!data.name || typeof data.name !== 'string') {
    throw new Error('Invalid playlist name');
  }

  if (data.name.length > 100) {
    throw new Error('Playlist name too long');
  }

  return libraryService.createPlaylist(data.name);
});
```

## Related

- [Architecture](architecture.md) - System design
- [Stores](stores.md) - State management
- [Mobile Server](mobile-server.md) - REST API

