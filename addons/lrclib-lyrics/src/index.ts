/**
 * LRCLib Lyrics Provider
 * Provides synchronized lyrics from LRCLib API
 */

import {
  BaseLyricsProvider,
  type LyricsQuery,
  type LyricsSearchOptions,
  type LyricsResult
} from '@audiio/sdk';

const LRCLIB_API = 'https://lrclib.net/api';

export class LRCLibProvider extends BaseLyricsProvider {
  readonly id = 'lrclib';
  readonly name = 'LRCLib';
  readonly supportsSynced = true;

  async getLyrics(
    query: LyricsQuery,
    _options?: LyricsSearchOptions
  ): Promise<LyricsResult | null> {
    try {
      const params = new URLSearchParams({
        track_name: query.title,
        artist_name: query.artist
      });

      if (query.album) {
        params.set('album_name', query.album);
      }

      if (query.duration) {
        params.set('duration', String(query.duration));
      }

      const response = await fetch(`${LRCLIB_API}/get?${params}`);

      if (!response.ok) {
        return null;
      }

      const data = await response.json() as {
        syncedLyrics?: string;
        plainLyrics?: string;
      };

      if (!data.syncedLyrics && !data.plainLyrics) {
        return null;
      }

      return {
        synced: data.syncedLyrics ? this.parseLrc(data.syncedLyrics) : undefined,
        plain: data.plainLyrics,
        source: 'lrclib'
      };
    } catch {
      return null;
    }
  }
}

export default LRCLibProvider;
