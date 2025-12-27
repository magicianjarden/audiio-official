# Scrobbler

Build addons that track listening history and integrate with external services.

## Overview

Scrobblers track what users listen to and can:

- Send play data to external services (Last.fm, ListenBrainz)
- Maintain local listening history
- Calculate listening statistics
- Enable social features (Discord Rich Presence)

## Interface

```typescript
interface Scrobbler {
  // Called when track starts playing
  onTrackStart(track: Track, context: PlayContext): Promise<void>;

  // Called periodically during playback
  onProgress?(track: Track, position: number, duration: number): Promise<void>;

  // Called when track completes or stops
  onTrackEnd(track: Track, playInfo: PlayInfo): Promise<void>;

  // Called when playback state changes
  onStateChange?(state: 'playing' | 'paused' | 'stopped'): Promise<void>;

  // Get scrobble history
  getHistory?(limit?: number): Promise<ScrobbleEntry[]>;
}

interface PlayContext {
  source: 'queue' | 'playlist' | 'album' | 'radio' | 'search';
  playlistId?: string;
  albumId?: string;
  artistRadioId?: string;
}

interface PlayInfo {
  startTime: Date;
  endTime: Date;
  duration: number;         // Actual play time in seconds
  completed: boolean;       // Played past threshold
  skipped: boolean;         // User skipped
  position: number;         // Final position in seconds
}

interface ScrobbleEntry {
  track: Track;
  timestamp: Date;
  duration: number;
  source?: string;
}
```

## Basic Implementation

```typescript
import { BaseAddon, Scrobbler, Track, PlayContext, PlayInfo } from '@audiio/sdk';

export default class LastFmScrobbler extends BaseAddon implements Scrobbler {
  static manifest = {
    id: 'lastfm-scrobbler',
    name: 'Last.fm Scrobbler',
    version: '1.0.0',
    roles: ['scrobbler'],
    settings: [
      {
        key: 'apiKey',
        type: 'string',
        label: 'API Key',
        required: true,
      },
      {
        key: 'apiSecret',
        type: 'string',
        label: 'API Secret',
        required: true,
        secret: true,
      },
      {
        key: 'sessionKey',
        type: 'string',
        label: 'Session Key',
        secret: true,
      },
      {
        key: 'scrobbleThreshold',
        type: 'number',
        label: 'Scrobble Threshold (%)',
        description: 'Minimum % of track to play before scrobbling',
        min: 30,
        max: 90,
        default: 50,
      },
    ],
  };

  private currentTrack: Track | null = null;
  private startTime: Date | null = null;
  private nowPlayingSent: boolean = false;

  async initialize(): Promise<void> {
    // Verify credentials
    const sessionKey = this.getSetting<string>('sessionKey');
    if (!sessionKey) {
      this.log.info('Not logged in to Last.fm');
    }
  }

  async onTrackStart(track: Track, context: PlayContext): Promise<void> {
    this.currentTrack = track;
    this.startTime = new Date();
    this.nowPlayingSent = false;

    // Update "Now Playing"
    await this.updateNowPlaying(track);
  }

  async onProgress(track: Track, position: number, duration: number): Promise<void> {
    // Send now playing update if not sent yet and played > 10 seconds
    if (!this.nowPlayingSent && position > 10) {
      await this.updateNowPlaying(track);
      this.nowPlayingSent = true;
    }
  }

  async onTrackEnd(track: Track, playInfo: PlayInfo): Promise<void> {
    if (!this.shouldScrobble(playInfo)) {
      this.log.debug('Track not scrobbled (below threshold)');
      return;
    }

    await this.scrobble(track, playInfo);
    this.currentTrack = null;
    this.startTime = null;
  }

  private shouldScrobble(playInfo: PlayInfo): boolean {
    const threshold = this.getSetting<number>('scrobbleThreshold') || 50;
    const playedPercent = (playInfo.duration / playInfo.position) * 100;

    // Scrobble if:
    // 1. Played more than threshold %
    // 2. Track is longer than 30 seconds
    // 3. Played at least 4 minutes OR half the track
    return (
      playedPercent >= threshold &&
      playInfo.position > 30 &&
      (playInfo.duration >= 240 || playInfo.duration >= playInfo.position / 2)
    );
  }

  private async updateNowPlaying(track: Track): Promise<void> {
    try {
      await this.lastFmRequest('track.updateNowPlaying', {
        artist: track.artist,
        track: track.title,
        album: track.album,
        duration: track.duration,
      });
    } catch (error) {
      this.log.warn('Failed to update now playing', error);
    }
  }

  private async scrobble(track: Track, playInfo: PlayInfo): Promise<void> {
    try {
      await this.lastFmRequest('track.scrobble', {
        artist: track.artist,
        track: track.title,
        album: track.album,
        timestamp: Math.floor(playInfo.startTime.getTime() / 1000),
        duration: track.duration,
      });

      this.log.info(`Scrobbled: ${track.artist} - ${track.title}`);
    } catch (error) {
      this.log.error('Scrobble failed', error);
      // Queue for retry
      await this.queueForRetry(track, playInfo);
    }
  }

  private async lastFmRequest(method: string, params: Record<string, any>): Promise<any> {
    const apiKey = this.getSetting<string>('apiKey');
    const apiSecret = this.getSetting<string>('apiSecret');
    const sessionKey = this.getSetting<string>('sessionKey');

    const allParams = {
      method,
      api_key: apiKey,
      sk: sessionKey,
      ...params,
    };

    // Sign request
    const signature = this.signRequest(allParams, apiSecret);
    allParams.api_sig = signature;
    allParams.format = 'json';

    const response = await this.fetch('https://ws.audioscrobbler.com/2.0/', {
      method: 'POST',
      body: new URLSearchParams(allParams),
    });

    if (response.error) {
      throw new Error(response.message);
    }

    return response;
  }

  private signRequest(params: Record<string, any>, secret: string): string {
    const sorted = Object.keys(params)
      .filter(k => k !== 'format')
      .sort()
      .map(k => `${k}${params[k]}`)
      .join('');

    return this.md5(sorted + secret);
  }

  private async queueForRetry(track: Track, playInfo: PlayInfo): Promise<void> {
    const queue = await this.cache.get<ScrobbleEntry[]>('retry_queue') || [];
    queue.push({
      track,
      timestamp: playInfo.startTime,
      duration: playInfo.duration,
    });
    await this.cache.set('retry_queue', queue);
  }
}
```

## Offline Queue

Handle scrobbles when offline:

```typescript
class OfflineQueueMixin {
  private queue: ScrobbleEntry[] = [];
  private isOnline: boolean = true;

  async initialize(): Promise<void> {
    // Load pending scrobbles
    this.queue = await this.cache.get<ScrobbleEntry[]>('offline_queue') || [];

    // Listen for online status
    window.addEventListener('online', () => this.processQueue());
    window.addEventListener('offline', () => this.isOnline = false);

    // Process any pending
    if (this.queue.length > 0) {
      await this.processQueue();
    }
  }

  protected async queueScrobble(entry: ScrobbleEntry): Promise<void> {
    this.queue.push(entry);
    await this.cache.set('offline_queue', this.queue);

    if (this.isOnline) {
      await this.processQueue();
    }
  }

  private async processQueue(): Promise<void> {
    while (this.queue.length > 0) {
      const entry = this.queue[0];

      try {
        await this.sendScrobble(entry);
        this.queue.shift();
        await this.cache.set('offline_queue', this.queue);
      } catch (error) {
        if (this.isNetworkError(error)) {
          // Stop processing, will retry when back online
          break;
        }
        // Other error - skip this entry
        this.queue.shift();
        this.log.error('Failed to scrobble, skipping', error);
      }
    }
  }
}
```

## Local History

Track listening history locally:

```typescript
class LocalHistoryScrobbler extends BaseAddon implements Scrobbler {
  async onTrackEnd(track: Track, playInfo: PlayInfo): Promise<void> {
    if (!playInfo.completed) return;

    const entry: ScrobbleEntry = {
      track,
      timestamp: playInfo.startTime,
      duration: playInfo.duration,
      source: 'audiio',
    };

    // Store in local database
    await this.storeEntry(entry);

    // Update statistics
    await this.updateStats(track, playInfo);
  }

  async getHistory(limit: number = 50): Promise<ScrobbleEntry[]> {
    const entries = await this.cache.get<ScrobbleEntry[]>('history') || [];
    return entries.slice(0, limit);
  }

  private async storeEntry(entry: ScrobbleEntry): Promise<void> {
    const history = await this.cache.get<ScrobbleEntry[]>('history') || [];
    history.unshift(entry);

    // Keep last 1000 entries
    if (history.length > 1000) {
      history.pop();
    }

    await this.cache.set('history', history);
  }

  private async updateStats(track: Track, playInfo: PlayInfo): Promise<void> {
    // Update play count
    const playCount = await this.cache.get<number>(`plays:${track.id}`) || 0;
    await this.cache.set(`plays:${track.id}`, playCount + 1);

    // Update artist play count
    const artistPlays = await this.cache.get<number>(`artist:${track.artist}`) || 0;
    await this.cache.set(`artist:${track.artist}`, artistPlays + 1);

    // Update total listening time
    const totalTime = await this.cache.get<number>('total_time') || 0;
    await this.cache.set('total_time', totalTime + playInfo.duration);
  }

  async getStats(): Promise<ListeningStats> {
    return {
      totalTracks: await this.cache.get<number>('total_tracks') || 0,
      totalTime: await this.cache.get<number>('total_time') || 0,
      topArtists: await this.getTopArtists(),
      topTracks: await this.getTopTracks(),
    };
  }
}
```

## Discord Rich Presence

```typescript
import { Client } from 'discord-rpc';

class DiscordPresence extends BaseAddon implements Scrobbler {
  static manifest = {
    id: 'discord-presence',
    name: 'Discord Rich Presence',
    version: '1.0.0',
    roles: ['scrobbler'],
    settings: [
      {
        key: 'showAlbumArt',
        type: 'boolean',
        label: 'Show Album Art',
        default: true,
      },
      {
        key: 'showTimeElapsed',
        type: 'boolean',
        label: 'Show Time Elapsed',
        default: true,
      },
    ],
  };

  private client: Client | null = null;
  private clientId = 'YOUR_DISCORD_APP_ID';

  async initialize(): Promise<void> {
    try {
      this.client = new Client({ transport: 'ipc' });
      await this.client.login({ clientId: this.clientId });
      this.log.info('Connected to Discord');
    } catch (error) {
      this.log.warn('Discord not available');
    }
  }

  async destroy(): Promise<void> {
    if (this.client) {
      await this.client.clearActivity();
      this.client.destroy();
    }
  }

  async onTrackStart(track: Track, context: PlayContext): Promise<void> {
    if (!this.client) return;

    const showArt = this.getSetting<boolean>('showAlbumArt');
    const showTime = this.getSetting<boolean>('showTimeElapsed');

    await this.client.setActivity({
      details: track.title,
      state: `by ${track.artist}`,
      largeImageKey: showArt && track.artwork ? track.artwork : 'audiio_logo',
      largeImageText: track.album || track.title,
      smallImageKey: 'play_icon',
      smallImageText: 'Playing',
      startTimestamp: showTime ? Date.now() : undefined,
      buttons: [
        { label: 'Listen on Audiio', url: 'https://audiio.app' },
      ],
    });
  }

  async onStateChange(state: 'playing' | 'paused' | 'stopped'): Promise<void> {
    if (!this.client) return;

    if (state === 'stopped') {
      await this.client.clearActivity();
    }
  }

  async onTrackEnd(track: Track, playInfo: PlayInfo): Promise<void> {
    // Nothing special for Discord on track end
  }
}
```

## ListenBrainz

Open-source alternative to Last.fm:

```typescript
class ListenBrainzScrobbler extends BaseAddon implements Scrobbler {
  static manifest = {
    id: 'listenbrainz',
    name: 'ListenBrainz',
    version: '1.0.0',
    roles: ['scrobbler'],
    settings: [
      {
        key: 'userToken',
        type: 'string',
        label: 'User Token',
        description: 'Get from listenbrainz.org/profile',
        required: true,
        secret: true,
      },
    ],
  };

  private readonly baseUrl = 'https://api.listenbrainz.org/1';

  async onTrackStart(track: Track, context: PlayContext): Promise<void> {
    await this.submitListen(track, 'playing_now');
  }

  async onTrackEnd(track: Track, playInfo: PlayInfo): Promise<void> {
    if (this.shouldScrobble(playInfo)) {
      await this.submitListen(track, 'single', playInfo.startTime);
    }
  }

  private async submitListen(
    track: Track,
    type: 'playing_now' | 'single',
    timestamp?: Date
  ): Promise<void> {
    const token = this.getSetting<string>('userToken');
    if (!token) return;

    const payload = {
      listen_type: type,
      payload: [{
        listened_at: timestamp ? Math.floor(timestamp.getTime() / 1000) : undefined,
        track_metadata: {
          artist_name: track.artist,
          track_name: track.title,
          release_name: track.album,
          additional_info: {
            listening_from: 'audiio',
            duration_ms: track.duration * 1000,
            isrc: track.isrc,
          },
        },
      }],
    };

    await this.fetch(`${this.baseUrl}/submit-listens`, {
      method: 'POST',
      headers: {
        'Authorization': `Token ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
  }
}
```

## Settings

```typescript
static manifest = {
  // ...
  settings: [
    {
      key: 'enabled',
      type: 'boolean',
      label: 'Enable Scrobbling',
      default: true,
    },
    {
      key: 'scrobbleThreshold',
      type: 'number',
      label: 'Minimum Play %',
      description: 'Track must be played this % to scrobble',
      min: 25,
      max: 100,
      default: 50,
    },
    {
      key: 'privateMode',
      type: 'boolean',
      label: 'Private Mode',
      description: 'Don\'t send to external services',
      default: false,
    },
  ],
};
```

## Testing

```typescript
import { describe, it, expect, vi } from 'vitest';
import MyScrobbler from './index';

describe('MyScrobbler', () => {
  const scrobbler = new MyScrobbler();

  const mockTrack = {
    id: 'test:1',
    title: 'Test Track',
    artist: 'Test Artist',
    duration: 180,
  };

  describe('onTrackStart', () => {
    it('sends now playing update', async () => {
      const spy = vi.spyOn(scrobbler, 'updateNowPlaying');

      await scrobbler.onTrackStart(mockTrack, { source: 'queue' });

      expect(spy).toHaveBeenCalledWith(mockTrack);
    });
  });

  describe('onTrackEnd', () => {
    it('scrobbles when threshold met', async () => {
      const spy = vi.spyOn(scrobbler, 'scrobble');

      await scrobbler.onTrackEnd(mockTrack, {
        startTime: new Date(),
        endTime: new Date(),
        duration: 120,  // 66% of 180s
        completed: true,
        skipped: false,
        position: 180,
      });

      expect(spy).toHaveBeenCalled();
    });

    it('does not scrobble when skipped early', async () => {
      const spy = vi.spyOn(scrobbler, 'scrobble');

      await scrobbler.onTrackEnd(mockTrack, {
        startTime: new Date(),
        endTime: new Date(),
        duration: 30,  // Only 16% of 180s
        completed: false,
        skipped: true,
        position: 30,
      });

      expect(spy).not.toHaveBeenCalled();
    });
  });
});
```

## Best Practices

### 1. Handle Rate Limits

```typescript
private rateLimiter = new RateLimiter(5, 1000);

async scrobble(track: Track, playInfo: PlayInfo): Promise<void> {
  await this.rateLimiter.acquire();
  await this.sendScrobble(track, playInfo);
}
```

### 2. Batch Offline Scrobbles

```typescript
async processOfflineQueue(): Promise<void> {
  const queue = await this.getOfflineQueue();

  // Batch up to 50 scrobbles
  const batches = this.chunk(queue, 50);

  for (const batch of batches) {
    await this.submitBatch(batch);
  }
}
```

### 3. Validate Before Scrobbling

```typescript
private isValidTrack(track: Track): boolean {
  return !!(
    track.title &&
    track.artist &&
    track.duration > 30
  );
}
```

## Related

- [Metadata Provider](metadata-provider.md) - Provide track info
- [SDK Reference](../../sdk/README.md) - Full API

