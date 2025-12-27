/**
 * Base class for metadata providers with helper methods
 */

import type {
  AddonManifest,
  MetadataProvider,
  MetadataSearchResult,
  MetadataSearchOptions,
  MetadataTrack,
  Artist,
  Album
} from '@audiio/core';

export abstract class BaseMetadataProvider implements MetadataProvider {
  abstract readonly id: string;
  abstract readonly name: string;
  readonly priority: number = 50;

  get manifest(): AddonManifest {
    return {
      id: this.id,
      name: this.name,
      version: '1.0.0',
      roles: ['metadata-provider']
    };
  }

  async initialize(): Promise<void> {
    // Override in subclass if needed
  }

  async dispose(): Promise<void> {
    // Override in subclass if needed
  }

  abstract search(query: string, options?: MetadataSearchOptions): Promise<MetadataSearchResult>;
  abstract getTrack(id: string): Promise<MetadataTrack | null>;
  abstract getArtist(id: string): Promise<Artist | null>;
  abstract getAlbum(id: string): Promise<(Album & { tracks: MetadataTrack[] }) | null>;

  /**
   * Helper: Normalize query for consistent searching
   */
  protected normalizeQuery(query: string): string {
    return query
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  }
}
