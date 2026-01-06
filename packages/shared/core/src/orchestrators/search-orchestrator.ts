/**
 * Search Orchestrator - Coordinates unified search across providers
 */

import type { UnifiedTrack, SearchResult, ArtworkSet } from '../types/index';
import type { MetadataTrack, MetadataSearchOptions, BaseAddon } from '../types/addon';
import type { AddonRegistry } from '../registry/addon-registry';
import { generateTrackId } from '../utils/id-generator';

/** Interface for artwork providers like Apple Music */
interface ArtworkProvider extends BaseAddon {
  getArtworkSet?(query: { album: string; artist: string; track?: string }): Promise<ArtworkSet | null>;
  getAnimatedArtworkAsMP4?(query: { album: string; artist: string; track?: string }, options?: unknown): Promise<AnimatedArtworkResult | null>;
}

/** Result from animated artwork conversion */
interface AnimatedArtworkResult {
  mp4Path: string;
  aspectRatio: 'tall' | 'square';
  previewFrameUrl?: string;
  staticUrl: string;
  albumId: string;
}

export class SearchOrchestrator {
  constructor(private registry: AddonRegistry) {}

  /**
   * Search for tracks across metadata providers
   * Returns unified tracks ready for playback
   * Returns empty results if no provider is available (graceful degradation)
   */
  async search(query: string, options?: MetadataSearchOptions): Promise<SearchResult> {
    const provider = this.registry.getPrimaryMetadataProvider();

    if (!provider) {
      console.warn('[SearchOrchestrator] No metadata provider available - returning empty results');
      return {
        tracks: [],
        albums: [],
        artists: [],
        query,
        source: 'none'
      };
    }

    const result = await provider.search(query, options);

    // Convert metadata tracks to unified tracks (handle undefined result.tracks)
    let tracks = (result?.tracks || []).map(track =>
      this.toUnifiedTrack(track, provider.id)
    );

    // Enhance artwork from secondary providers if primary didn't provide it
    tracks = await this.enhanceArtwork(tracks);

    return {
      tracks,
      albums: result?.albums || [],
      artists: result?.artists || [],
      query,
      source: 'unified'
    };
  }

  /**
   * Get artwork providers dynamically from registry
   * Returns all providers that have getArtworkSet method
   */
  private getArtworkProviders(): ArtworkProvider[] {
    const providers: ArtworkProvider[] = [];
    const allIds = this.registry.getAllAddonIds();

    for (const id of allIds) {
      const addon = this.registry.get<ArtworkProvider>(id);
      if (addon?.getArtworkSet) {
        providers.push(addon);
      }
    }

    if (providers.length > 0) {
      console.log(`[SearchOrchestrator] Found ${providers.length} artwork providers:`,
        providers.map(p => p.manifest?.id));
    }

    return providers;
  }

  /**
   * Enhance tracks with artwork from secondary providers (like Apple Music)
   * Uses priority-ordered providers and supports animated artwork
   */
  private async enhanceArtwork(tracks: UnifiedTrack[]): Promise<UnifiedTrack[]> {
    // Get artwork providers in priority order
    const artworkProviders = this.getArtworkProviders();

    console.log(`[SearchOrchestrator] Found ${artworkProviders.length} artwork providers:`,
      artworkProviders.map(p => p.manifest.id));

    if (artworkProviders.length === 0) {
      return tracks;
    }

    // Enhance tracks that are missing artwork
    const enhancedTracks = await Promise.all(
      tracks.map(async (track) => {
        // Skip if track already has artwork (both static and animated)
        if ((track.artwork?.medium || track.artwork?.large) && track.artwork?.animated) {
          return track;
        }

        const artistName = track.artists[0]?.name || '';
        const albumTitle = track.album?.title || '';

        if (!artistName || !albumTitle) {
          return track;
        }

        const query = {
          album: albumTitle,
          artist: artistName,
          track: track.title
        };

        // Try each provider in priority order until we get artwork
        for (const provider of artworkProviders) {
          try {
            // Try to get artwork (may include animated)
            const artwork = await provider.getArtworkSet?.(query);

            if (artwork) {
              console.log(`[SearchOrchestrator] Got artwork from ${provider.manifest.id} for "${track.title}"`,
                { hasAnimated: !!artwork.animated, animated: artwork.animated });

              // Merge with existing artwork (keep existing if present)
              const mergedArtwork: ArtworkSet = {
                small: artwork.small || track.artwork?.small,
                medium: artwork.medium || track.artwork?.medium,
                large: artwork.large || track.artwork?.large,
                original: artwork.original || track.artwork?.original,
                animated: artwork.animated || track.artwork?.animated
              };

              return {
                ...track,
                artwork: mergedArtwork,
                album: track.album ? { ...track.album, artwork: mergedArtwork } : track.album
              };
            }
          } catch (error) {
            console.error(`Artwork enhancement from ${provider.manifest.id} failed:`, error);
            // Continue to next provider
          }
        }

        return track;
      })
    );

    return enhancedTracks;
  }

  /**
   * Convert a metadata track to a unified track
   */
  private toUnifiedTrack(track: MetadataTrack, providerId: string): UnifiedTrack {
    return {
      id: generateTrackId(),
      title: track.title,
      artists: track.artists,
      album: track.album,
      duration: track.duration,
      artwork: track.artwork,
      genres: track.genres,
      releaseDate: track.releaseDate,
      explicit: track.explicit,
      streamSources: [], // Will be populated by TrackResolver
      _meta: {
        metadataProvider: providerId,
        matchConfidence: 1.0,
        externalIds: {
          ...track.externalIds,
          [providerId]: track.id
        },
        lastUpdated: new Date()
      }
    };
  }
}
