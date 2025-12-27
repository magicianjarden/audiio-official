/**
 * MetadataOrchestrator - Routes metadata requests to appropriate providers
 *
 * Uses the registry to discover metadata providers and routes requests
 * based on priority or specific source. Implements fallback logic when
 * the primary provider fails.
 */

import type { AddonRegistry } from '../registry/addon-registry';
import type { MetadataProvider, MetadataTrack } from '../types/addon';
import type { Artist, Album } from '../types/index';

export interface ChartsResult {
  tracks: MetadataTrack[];
  artists: Artist[];
  albums: Album[];
}

export class MetadataOrchestrator {
  constructor(private registry: AddonRegistry) {}

  /**
   * Get provider by source ID, or fall back to primary
   */
  private getProvider(source?: string): MetadataProvider | null {
    if (source) {
      const specific = this.registry.get<MetadataProvider>(source);
      if (specific) return specific;
    }
    return this.registry.getPrimaryMetadataProvider();
  }

  /**
   * Get artist details
   */
  async getArtist(id: string, source?: string): Promise<Artist | null> {
    const provider = this.getProvider(source);
    if (!provider) {
      console.warn('[MetadataOrchestrator] No metadata provider available');
      return null;
    }

    try {
      return await provider.getArtist(id);
    } catch (error) {
      console.error(`[MetadataOrchestrator] getArtist failed for ${provider.id}:`, error);

      // Try fallback to other providers
      const allProviders = this.registry.getMetadataProviders();
      for (const fallback of allProviders) {
        if (fallback.id === provider.id) continue;
        try {
          const result = await fallback.getArtist(id);
          if (result) return result;
        } catch {
          continue;
        }
      }
      return null;
    }
  }

  /**
   * Get album details with tracks
   */
  async getAlbum(id: string, source?: string): Promise<(Album & { tracks: MetadataTrack[] }) | null> {
    const provider = this.getProvider(source);
    if (!provider) {
      console.warn('[MetadataOrchestrator] No metadata provider available');
      return null;
    }

    try {
      return await provider.getAlbum(id);
    } catch (error) {
      console.error(`[MetadataOrchestrator] getAlbum failed for ${provider.id}:`, error);

      // Try fallback to other providers
      const allProviders = this.registry.getMetadataProviders();
      for (const fallback of allProviders) {
        if (fallback.id === provider.id) continue;
        try {
          const result = await fallback.getAlbum(id);
          if (result) return result;
        } catch {
          continue;
        }
      }
      return null;
    }
  }

  /**
   * Get track details
   */
  async getTrack(id: string, source?: string): Promise<MetadataTrack | null> {
    const provider = this.getProvider(source);
    if (!provider) {
      console.warn('[MetadataOrchestrator] No metadata provider available');
      return null;
    }

    try {
      return await provider.getTrack(id);
    } catch (error) {
      console.error(`[MetadataOrchestrator] getTrack failed for ${provider.id}:`, error);

      // Try fallback to other providers
      const allProviders = this.registry.getMetadataProviders();
      for (const fallback of allProviders) {
        if (fallback.id === provider.id) continue;
        try {
          const result = await fallback.getTrack(id);
          if (result) return result;
        } catch {
          continue;
        }
      }
      return null;
    }
  }

  /**
   * Get charts/trending content from primary provider
   */
  async getCharts(limit: number = 20): Promise<ChartsResult> {
    const provider = this.registry.getPrimaryMetadataProvider();
    if (!provider) {
      console.warn('[MetadataOrchestrator] No metadata provider available for charts');
      return { tracks: [], artists: [], albums: [] };
    }

    // Check if provider supports getCharts (not all do)
    const providerWithCharts = provider as MetadataProvider & {
      getCharts?: (limit: number) => Promise<ChartsResult>;
    };

    if (providerWithCharts.getCharts) {
      try {
        return await providerWithCharts.getCharts(limit);
      } catch (error) {
        console.error(`[MetadataOrchestrator] getCharts failed for ${provider.id}:`, error);
      }
    }

    return { tracks: [], artists: [], albums: [] };
  }

  /**
   * Get similar tracks based on a track
   */
  async getSimilarTracks(trackId: string, source?: string, limit: number = 10): Promise<MetadataTrack[]> {
    const provider = this.getProvider(source);
    if (!provider) return [];

    // Check if provider supports getSimilarTracks
    const providerWithSimilar = provider as MetadataProvider & {
      getSimilarTracks?: (trackId: string, limit: number) => Promise<MetadataTrack[]>;
    };

    if (providerWithSimilar.getSimilarTracks) {
      try {
        return await providerWithSimilar.getSimilarTracks(trackId, limit);
      } catch (error) {
        console.error(`[MetadataOrchestrator] getSimilarTracks failed:`, error);
      }
    }

    // Fallback: get track, search for similar by artist
    try {
      const track = await this.getTrack(trackId, source);
      if (track?.artists?.[0]) {
        const artistName = track.artists[0].name;
        const searchResult = await provider.search(artistName, { limit });
        return searchResult?.tracks || [];
      }
    } catch {
      // ignore
    }

    return [];
  }

  /**
   * Get similar albums
   */
  async getSimilarAlbums(albumId: string, source?: string, limit: number = 10): Promise<Album[]> {
    const provider = this.getProvider(source);
    if (!provider) return [];

    // Check if provider supports getSimilarAlbums
    const providerWithSimilar = provider as MetadataProvider & {
      getSimilarAlbums?: (albumId: string, limit: number) => Promise<Album[]>;
    };

    if (providerWithSimilar.getSimilarAlbums) {
      try {
        return await providerWithSimilar.getSimilarAlbums(albumId, limit);
      } catch (error) {
        console.error(`[MetadataOrchestrator] getSimilarAlbums failed:`, error);
      }
    }

    // Fallback: get album artist and find their other albums
    try {
      const album = await this.getAlbum(albumId, source);
      if (album?.artists?.[0]) {
        const artist = await this.getArtist(album.artists[0].id, source);
        if (artist && 'albums' in artist) {
          const artistWithAlbums = artist as Artist & { albums?: Album[] };
          return (artistWithAlbums.albums || [])
            .filter((a: Album) => a.id !== albumId)
            .slice(0, limit);
        }
      }
    } catch {
      // ignore
    }

    return [];
  }

  /**
   * Get artist radio (tracks similar to artist's style)
   */
  async getArtistRadio(artistId: string, source?: string, limit: number = 20): Promise<MetadataTrack[]> {
    const provider = this.getProvider(source);
    if (!provider) return [];

    // Check if provider supports getArtistRadio
    const providerWithRadio = provider as MetadataProvider & {
      getArtistRadio?: (artistId: string, limit: number) => Promise<MetadataTrack[]>;
    };

    if (providerWithRadio.getArtistRadio) {
      try {
        return await providerWithRadio.getArtistRadio(artistId, limit);
      } catch (error) {
        console.error(`[MetadataOrchestrator] getArtistRadio failed:`, error);
      }
    }

    // Fallback: get artist top tracks
    try {
      const artist = await this.getArtist(artistId, source);
      if (artist && 'topTracks' in artist) {
        const artistWithTracks = artist as Artist & { topTracks?: MetadataTrack[] };
        return (artistWithTracks.topTracks || []).slice(0, limit);
      }
    } catch {
      // ignore
    }

    return [];
  }

  /**
   * Get the ID of the primary metadata provider
   */
  getPrimaryProviderId(): string | null {
    const provider = this.registry.getPrimaryMetadataProvider();
    return provider?.id || null;
  }
}
