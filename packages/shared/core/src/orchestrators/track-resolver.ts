/**
 * Track Resolver - Resolves streams for unified tracks
 */

import type { UnifiedTrack, StreamInfo, Quality } from '../types/index';
import type { AddonRegistry } from '../registry/addon-registry';
import { TrackMatcher } from '../services/track-matcher';

export class TrackResolver {
  private matcher: TrackMatcher;

  constructor(private registry: AddonRegistry) {
    this.matcher = new TrackMatcher();
  }

  /**
   * Resolve stream for a track from available providers
   * Returns null if no stream provider is available (graceful degradation)
   */
  async resolveStream(
    track: UnifiedTrack,
    preferredQuality?: Quality
  ): Promise<StreamInfo | null> {
    const providers = this.registry.getStreamProviders();

    if (providers.length === 0) {
      console.warn('[TrackResolver] No stream providers available');
      return null;
    }

    // Ensure streamSources is initialized
    if (!track.streamSources) {
      track.streamSources = [];
    }

    // Ensure _meta is initialized
    if (!track._meta) {
      track._meta = {
        metadataProvider: 'unknown',
        lastUpdated: new Date()
      } as UnifiedTrack['_meta'];
    }

    // Try each provider in order
    for (const provider of providers) {
      try {
        // First, try to find the track on this provider
        let streamTrackId: string | null = null;

        // Check if we already have this provider's track ID
        const existingSource = track.streamSources.find(
          s => s.providerId === provider.id && s.available
        );

        if (existingSource) {
          streamTrackId = existingSource.trackId;
        } else if (provider.searchByMetadata) {
          // Search by metadata for best match
          const match = await provider.searchByMetadata({
            title: track.title,
            artist: track.artists?.[0]?.name ?? '',
            album: track.album?.title,
            duration: track.duration,
            isrc: track._meta?.externalIds?.isrc
          });

          if (match) {
            streamTrackId = match.id;

            // Add to stream sources
            track.streamSources.push({
              providerId: provider.id,
              trackId: match.id,
              available: true,
              qualities: match.availableQualities
            });
          }
        } else {
          // Fallback: search by query
          const query = `${track.artists[0]?.name ?? ''} ${track.title}`.trim();
          const searchResults = await provider.search(query, { limit: 10 });

          // Find best match
          const match = this.matcher.findBestStreamMatch(
            {
              id: track.id,
              title: track.title,
              artists: track.artists,
              duration: track.duration,
              _provider: track._meta.metadataProvider
            },
            searchResults
          );

          if (match) {
            streamTrackId = match.id;

            // Add to stream sources
            track.streamSources.push({
              providerId: provider.id,
              trackId: match.id,
              available: true,
              qualities: match.availableQualities
            });

            // Update match confidence
            track._meta.matchConfidence = this.matcher.getLastMatchConfidence();
          }
        }

        // If we found the track, get the stream
        if (streamTrackId) {
          const streamInfo = await provider.getStream(streamTrackId, preferredQuality);

          // Update track with stream info
          track.streamInfo = streamInfo;
          track._meta.lastUpdated = new Date();

          return streamInfo;
        }
      } catch (error) {
        console.error(`[TrackResolver] Provider ${provider.id} failed:`, error instanceof Error ? error.message : error);
        continue;
      }
    }

    return null;
  }

  /**
   * Pre-resolve streams for multiple tracks (for queue preparation)
   */
  async resolveStreamsForTracks(
    tracks: UnifiedTrack[],
    preferredQuality?: Quality
  ): Promise<Map<string, StreamInfo | null>> {
    const results = new Map<string, StreamInfo | null>();

    // Resolve in parallel with concurrency limit
    const concurrency = 3;
    for (let i = 0; i < tracks.length; i += concurrency) {
      const batch = tracks.slice(i, i + concurrency);
      const batchResults = await Promise.all(
        batch.map(track => this.resolveStream(track, preferredQuality))
      );

      batch.forEach((track, index) => {
        results.set(track.id, batchResults[index] ?? null);
      });
    }

    return results;
  }
}
