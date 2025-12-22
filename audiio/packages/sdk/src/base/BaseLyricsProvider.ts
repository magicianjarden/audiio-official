/**
 * Base class for lyrics providers with helper methods
 */

import type {
  AddonManifest,
  LyricsProvider,
  LyricsQuery,
  LyricsSearchOptions,
  LyricsResult,
  LyricsLine
} from '@audiio/core';

export abstract class BaseLyricsProvider implements LyricsProvider {
  abstract readonly id: string;
  abstract readonly name: string;
  abstract readonly supportsSynced: boolean;

  get manifest(): AddonManifest {
    return {
      id: this.id,
      name: this.name,
      version: '1.0.0',
      roles: ['lyrics-provider']
    };
  }

  async initialize(): Promise<void> {
    // Override in subclass if needed
  }

  async dispose(): Promise<void> {
    // Override in subclass if needed
  }

  abstract getLyrics(query: LyricsQuery, options?: LyricsSearchOptions): Promise<LyricsResult | null>;

  /**
   * Helper: Parse LRC format to synced lyrics
   */
  protected parseLrc(lrc: string): LyricsLine[] {
    const lines: LyricsLine[] = [];
    const regex = /\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)/g;
    let match;

    while ((match = regex.exec(lrc)) !== null) {
      const minutes = parseInt(match[1]!, 10);
      const seconds = parseInt(match[2]!, 10);
      const ms = parseInt(match[3]!.padEnd(3, '0'), 10);
      const time = (minutes * 60 * 1000) + (seconds * 1000) + ms;
      const text = match[4]!.trim();

      if (text) {
        lines.push({ time, text });
      }
    }

    return lines.sort((a, b) => a.time - b.time);
  }

  /**
   * Helper: Convert synced lyrics to plain text
   */
  protected syncedToPlain(synced: LyricsLine[]): string {
    return synced.map(line => line.text).join('\n');
  }
}
