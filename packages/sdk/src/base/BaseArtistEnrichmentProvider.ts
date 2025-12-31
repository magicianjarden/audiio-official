/**
 * Base Artist Enrichment Provider
 *
 * Abstract base class for artist enrichment plugins.
 * Provides supplementary artist data like videos, concerts, setlists, etc.
 */

import type {
  AddonManifest,
  ArtistEnrichmentProvider,
  ArtistEnrichmentType,
  MusicVideo,
  TimelineEntry,
  Setlist,
  Concert,
  ArtistImages
} from '@audiio/core';

export abstract class BaseArtistEnrichmentProvider implements ArtistEnrichmentProvider {
  abstract readonly id: string;
  abstract readonly name: string;
  abstract readonly enrichmentType: ArtistEnrichmentType;

  get manifest(): AddonManifest {
    return {
      id: this.id,
      name: this.name,
      version: '1.0.0',
      description: `Artist enrichment provider: ${this.name}`,
      roles: ['artist-enrichment']
    };
  }

  async initialize(): Promise<void> {
    // Default: no-op, override if needed
  }

  async dispose(): Promise<void> {
    // Default: no-op, override if needed
  }

  // Optional methods - implement based on enrichmentType
  getArtistVideos?(artistName: string, limit?: number): Promise<MusicVideo[]>;
  getArtistTimeline?(artistName: string): Promise<TimelineEntry[]>;
  getArtistSetlists?(artistName: string, mbid?: string, limit?: number): Promise<Setlist[]>;
  getUpcomingConcerts?(artistName: string): Promise<Concert[]>;
  getArtistGallery?(mbid: string): Promise<ArtistImages>;
  getMerchandiseUrl?(artistName: string): Promise<string | null>;
  searchArtist?(artistName: string): Promise<{ id: string; name: string } | null>;
}
