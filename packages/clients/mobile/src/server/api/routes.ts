/**
 * API Routes for Mobile Portal
 *
 * Exposes endpoints similar to the desktop IPC handlers,
 * allowing mobile clients to search, control playback, and stream audio.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { AccessManager } from '../services/access-manager';
import type { SessionManager } from '../services/session-manager';
import type { PairingService } from '../services/pairing-service';

interface RouteContext {
  accessManager: AccessManager;
  sessionManager: SessionManager;
  pairingService?: PairingService;
  orchestrators?: {
    search?: any;
    trackResolver?: any;
    playback?: any;
    registry?: any;
    metadata?: any;
    authManager?: any;
    libraryBridge?: any;
    mlService?: any;
  };
}

// Type for artwork that could be an object or string
interface ArtworkSet {
  small?: string;
  medium?: string;
  large?: string;
  original?: string;
}

/**
 * Extract artwork URL from ArtworkSet object or return string as-is
 */
function extractArtwork(artwork: ArtworkSet | string | undefined): string | undefined {
  if (!artwork) return undefined;
  if (typeof artwork === 'string') return artwork;
  return artwork.large || artwork.medium || artwork.small || artwork.original;
}

/**
 * Transform artist response to have flat image property
 */
function transformArtist(artist: any): any {
  if (!artist) return artist;

  const transformed = {
    ...artist,
    // Extract image from artwork object
    image: artist.image || extractArtwork(artist.artwork),
  };

  // Transform albums array if present
  if (artist.albums) {
    transformed.albums = artist.albums.map((album: any) => ({
      ...album,
      artwork: extractArtwork(album.artwork),
      // Extract year from releaseDate
      year: album.year || (album.releaseDate ? album.releaseDate.substring(0, 4) : undefined),
      // Ensure source is set
      source: album.source || artist.source,
    }));
  }

  // Transform singles array if present
  if (artist.singles) {
    transformed.singles = artist.singles.map((album: any) => ({
      ...album,
      artwork: extractArtwork(album.artwork),
      year: album.year || (album.releaseDate ? album.releaseDate.substring(0, 4) : undefined),
      source: album.source || artist.source,
    }));
  }

  // Transform topTracks if present
  if (artist.topTracks) {
    transformed.topTracks = artist.topTracks.map((track: any) => ({
      ...track,
      artwork: extractArtwork(track.artwork),
      album: track.album ? {
        ...track.album,
        artwork: extractArtwork(track.album.artwork),
      } : track.album,
    }));
  }

  // Transform similarArtists if present
  if (artist.similarArtists) {
    transformed.similarArtists = artist.similarArtists.map((a: any) => ({
      ...a,
      image: a.image || extractArtwork(a.artwork),
    }));
  }

  return transformed;
}

/**
 * Transform album response to have flat artwork property
 */
function transformAlbum(album: any): any {
  if (!album) return album;

  // Extract artist info from artists array
  const primaryArtist = album.artists?.[0];

  const transformed = {
    ...album,
    artwork: extractArtwork(album.artwork),
    // Flatten artist info for mobile pages
    artist: album.artist || primaryArtist?.name || 'Unknown Artist',
    artistId: album.artistId || primaryArtist?.id,
    // Extract year from releaseDate if not set
    year: album.year || (album.releaseDate ? album.releaseDate.substring(0, 4) : undefined),
  };

  // Transform tracks array if present
  if (album.tracks) {
    transformed.tracks = album.tracks.map((track: any) => ({
      ...track,
      artwork: extractArtwork(track.artwork),
      // Also flatten artist on tracks
      artist: track.artist || track.artists?.[0]?.name,
    }));
  }

  return transformed;
}

/**
 * Transform track to have flat artwork and ensure artists array exists
 */
function transformTrack(track: any): any {
  if (!track) return track;

  // Ensure artists array exists with proper format
  let artists = track.artists;

  // Check if artists is valid and has proper structure
  if (!artists || !Array.isArray(artists) || artists.length === 0) {
    // Try to extract artist info from various possible sources
    if (track.artist) {
      // Single artist string or object
      artists = typeof track.artist === 'string'
        ? [{ id: 'unknown', name: track.artist }]
        : Array.isArray(track.artist) ? track.artist : [track.artist];
    } else if (track.artistName) {
      artists = [{ id: 'unknown', name: track.artistName }];
    } else if (track.album?.artist) {
      artists = typeof track.album.artist === 'string'
        ? [{ id: 'unknown', name: track.album.artist }]
        : [track.album.artist];
    } else if (track.album?.artists && Array.isArray(track.album.artists)) {
      artists = track.album.artists;
    } else if (track._meta?.artist) {
      artists = [{ id: 'unknown', name: track._meta.artist }];
    } else if (track._meta?.artistName) {
      artists = [{ id: 'unknown', name: track._meta.artistName }];
    }
  } else if (Array.isArray(artists)) {
    // Validate artist objects have name property
    artists = artists.map(a => {
      if (typeof a === 'string') {
        return { id: 'unknown', name: a };
      }
      if (a && typeof a === 'object' && !a.name && a.id) {
        // Artist object without name - try to use id or fallback
        return { ...a, name: a.displayName || a.id || 'Unknown Artist' };
      }
      return a;
    }).filter(a => a && a.name);
  }

  // Ensure source is set for playback - check multiple possible locations
  // No hardcoded defaults - source must come from the track data
  const source = track.source
    || track._meta?.source
    || track._meta?.metadataProvider
    || track.streamSources?.[0]?.provider
    || track.provider;

  return {
    ...track,
    artists: artists && artists.length > 0 ? artists : [{ id: 'unknown', name: 'Unknown Artist' }],
    ...(source && { source }), // Only include source if it exists
    artwork: extractArtwork(track.artwork),
    album: track.album ? {
      ...track.album,
      artwork: extractArtwork(track.album.artwork),
    } : track.album,
  };
}

/**
 * Transform charts/trending response
 */
function transformCharts(charts: { tracks?: any[]; artists?: any[]; albums?: any[] }): any {
  return {
    tracks: (charts.tracks || []).map(transformTrack),
    artists: (charts.artists || []).map((a: any) => ({
      ...a,
      image: a.image || extractArtwork(a.artwork),
    })),
    albums: (charts.albums || []).map((a: any) => ({
      ...a,
      artwork: extractArtwork(a.artwork),
    })),
  };
}

export function registerApiRoutes(fastify: FastifyInstance, context: RouteContext) {
  const { accessManager, sessionManager, pairingService, orchestrators } = context;

  // Health check (public)
  fastify.get('/api/health', async () => {
    return {
      status: 'ok',
      timestamp: Date.now(),
      activeSessions: sessionManager.getActiveCount()
    };
  });

  // ========================================
  // Search & Discovery
  // ========================================

  fastify.get('/api/search', async (request: FastifyRequest, reply: FastifyReply) => {
    const { q, type, limit } = request.query as { q: string; type?: string; limit?: string };

    if (!q) {
      return reply.code(400).send({ error: 'Query parameter "q" is required' });
    }

    if (!orchestrators?.search) {
      return reply.code(503).send({ error: 'Search service not available' });
    }

    try {
      const result = await orchestrators.search.search(q, {
        limit: parseInt(limit || '25', 10)
      });

      // Transform artwork objects to flat URL strings for mobile
      const transformed = transformCharts({
        tracks: result.tracks || [],
        artists: result.artists || [],
        albums: result.albums || []
      });

      // Return specific type if requested
      switch (type) {
        case 'artist':
          return { artists: transformed.artists };
        case 'album':
          return { albums: transformed.albums };
        case 'track':
          return { tracks: transformed.tracks };
        default:
          return transformed;
      }
    } catch (error) {
      console.error('Search error:', error);
      return reply.code(500).send({ error: 'Search failed' });
    }
  });

  // Get artist details
  fastify.get('/api/artist/:artistId', async (request: FastifyRequest, reply: FastifyReply) => {
    const { artistId } = request.params as { artistId: string };
    const { name, source } = request.query as { name?: string; source?: string };

    try {
      // Use the metadata orchestrator for artist details
      if (orchestrators?.metadata?.getArtist) {
        const artist = await orchestrators.metadata.getArtist(artistId, source);
        if (artist) {
          // Transform artwork objects to flat URL strings for mobile
          return transformArtist(artist);
        }
      }

      // Fallback: search for artist by name and get top tracks
      if (name && orchestrators?.search) {
        const [artistSearch, trackSearch] = await Promise.all([
          orchestrators.search.search(name, { limit: 1 }),
          orchestrators.search.search(`${name} top songs`, { limit: 10 })
        ]);

        const artistInfo = artistSearch.artists?.[0];
        return {
          id: artistId,
          name: artistInfo?.name || name,
          image: artistInfo?.image,
          followers: artistInfo?.followers,
          genres: artistInfo?.genres || [],
          bio: artistInfo?.bio,
          source: source || orchestrators.metadata?.getPrimaryProviderId?.() || 'deezer',
          topTracks: trackSearch.tracks || [],
          albums: [],
          singles: [],
          similarArtists: []
        };
      }

      return reply.code(404).send({ error: 'Artist not found' });
    } catch (error) {
      console.error('[Mobile API] Artist error:', error);
      return reply.code(500).send({ error: 'Failed to fetch artist details' });
    }
  });

  // Get album details
  fastify.get('/api/album/:albumId', async (request: FastifyRequest, reply: FastifyReply) => {
    const { albumId } = request.params as { albumId: string };
    const { source } = request.query as { source?: string };

    try {
      // Use the metadata orchestrator for album details
      if (orchestrators?.metadata?.getAlbum) {
        const album = await orchestrators.metadata.getAlbum(albumId, source);
        if (album) {
          // Transform artwork objects to flat URL strings for mobile
          return transformAlbum(album);
        }
      }

      return reply.code(404).send({ error: 'Album not found' });
    } catch (error) {
      console.error('[Mobile API] Album error:', error);
      return reply.code(500).send({ error: 'Failed to fetch album details' });
    }
  });

  fastify.get('/api/trending', async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      // Use metadata provider (Deezer) for charts/trending
      if (orchestrators?.metadata?.getCharts) {
        const charts = await orchestrators.metadata.getCharts(20);
        console.log(`[Mobile API] Trending: ${charts.tracks?.length || 0} tracks, ${charts.artists?.length || 0} artists, ${charts.albums?.length || 0} albums`);
        // Transform artwork objects to flat URL strings for mobile
        return transformCharts(charts);
      }

      // Fallback to search if no metadata provider
      if (orchestrators?.search) {
        const result = await orchestrators.search.search('top hits 2024', { limit: 20 });
        return transformCharts({
          tracks: result.tracks || [],
          artists: result.artists || [],
          albums: result.albums || []
        });
      }

      return reply.code(503).send({ error: 'Trending service not available' });
    } catch (error) {
      console.error('[Mobile API] Trending error:', error);
      return reply.code(500).send({ error: 'Failed to fetch trending content' });
    }
  });

  // Discover - Rich personalized content for home page
  fastify.get('/api/discover', async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const response: {
        recentlyPlayed?: any[];
        quickPicks?: any[];
        tracks?: any[];
        artists?: any[];
        albums?: any[];
        forYou?: any[];
        mixes?: any[];
      } = {};

      // Get recently played from library bridge if available
      if (orchestrators?.libraryBridge?.getRecentlyPlayed) {
        try {
          response.recentlyPlayed = await orchestrators.libraryBridge.getRecentlyPlayed(6);
        } catch {
          response.recentlyPlayed = [];
        }
      }

      // Get quick picks / recommendations
      if (orchestrators?.libraryBridge?.getQuickPicks) {
        try {
          response.quickPicks = await orchestrators.libraryBridge.getQuickPicks(8);
        } catch {
          response.quickPicks = [];
        }
      }

      // Get for you / personalized tracks
      if (orchestrators?.libraryBridge?.getForYou) {
        try {
          response.forYou = await orchestrators.libraryBridge.getForYou(10);
        } catch {
          response.forYou = [];
        }
      }

      // Get mixes (daily mix, artist radio, etc.)
      if (orchestrators?.libraryBridge?.getMixes) {
        try {
          response.mixes = await orchestrators.libraryBridge.getMixes(6);
        } catch {
          response.mixes = [];
        }
      }

      // Get trending/charts as fallback content
      if (orchestrators?.metadata?.getCharts) {
        try {
          const charts = await orchestrators.metadata.getCharts(15);
          const transformed = transformCharts(charts);
          response.tracks = transformed.tracks;
          response.artists = transformed.artists;
          response.albums = transformed.albums;
        } catch {
          // Fallback to search
          if (orchestrators?.search) {
            const result = await orchestrators.search.search('popular music 2024', { limit: 15 });
            const transformed = transformCharts({
              tracks: result.tracks || [],
              artists: result.artists || [],
              albums: result.albums || []
            });
            response.tracks = transformed.tracks;
            response.artists = transformed.artists;
            response.albums = transformed.albums;
          }
        }
      } else if (orchestrators?.search) {
        // Use search as primary fallback
        const result = await orchestrators.search.search('top hits', { limit: 15 });
        const transformed = transformCharts({
          tracks: result.tracks || [],
          artists: result.artists || [],
          albums: result.albums || []
        });
        response.tracks = transformed.tracks;
        response.artists = transformed.artists;
        response.albums = transformed.albums;
      }

      console.log(`[Mobile API] Discover: ${response.recentlyPlayed?.length || 0} recent, ${response.tracks?.length || 0} tracks, ${response.artists?.length || 0} artists`);
      return response;
    } catch (error) {
      console.error('[Mobile API] Discover error:', error);
      return reply.code(500).send({ error: 'Failed to fetch discover content' });
    }
  });

  // Discover sections - Structured sections for mobile home page
  fastify.get('/api/discover/sections', async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const sections: Array<{
        id: string;
        type: string;
        title: string;
        subtitle?: string;
        tracks?: any[];
        artists?: any[];
        albums?: any[];
        genres?: any[];
        isPluginPowered?: boolean;
        pluginName?: string;
      }> = [];

      // Recently played section
      if (orchestrators?.libraryBridge?.getRecentlyPlayed) {
        try {
          const recentTracks = await orchestrators.libraryBridge.getRecentlyPlayed(10);
          if (recentTracks && recentTracks.length > 0) {
            sections.push({
              id: 'recently-played',
              type: 'recently-played',
              title: 'Recently Played',
              subtitle: 'Pick up where you left off',
              tracks: recentTracks.map(transformTrack)
            });
          }
        } catch (e) {
          console.error('[Mobile API] Failed to get recently played:', e);
        }
      }

      // Quick picks section
      if (orchestrators?.libraryBridge?.getQuickPicks) {
        try {
          const quickPicks = await orchestrators.libraryBridge.getQuickPicks(10);
          if (quickPicks && quickPicks.length > 0) {
            sections.push({
              id: 'quick-picks',
              type: 'quick-picks',
              title: 'Quick Picks',
              subtitle: 'Based on your listening',
              tracks: quickPicks.map(transformTrack)
            });
          }
        } catch (e) {
          console.error('[Mobile API] Failed to get quick picks:', e);
        }
      }

      // For You / Personalized recommendations
      if (orchestrators?.libraryBridge?.getForYou) {
        try {
          const forYou = await orchestrators.libraryBridge.getForYou(12);
          if (forYou && forYou.length > 0) {
            sections.push({
              id: 'for-you',
              type: 'recommended',
              title: 'For You',
              subtitle: 'Personalized picks',
              tracks: forYou.map(transformTrack)
            });
          }
        } catch (e) {
          console.error('[Mobile API] Failed to get for you:', e);
        }
      }

      // ML-powered recommendations section
      if (orchestrators?.mlService?.isAlgorithmLoaded?.()) {
        try {
          const recommendations = await orchestrators.mlService.getRecommendations(12);
          if (recommendations && recommendations.length > 0) {
            sections.push({
              id: 'ml-recommendations',
              type: 'ml-powered',
              title: 'Discover Weekly',
              subtitle: 'AI-curated for you',
              tracks: recommendations.map(transformTrack),
              isPluginPowered: true,
              pluginName: 'ML Algorithm'
            });
          }
        } catch (e) {
          console.error('[Mobile API] Failed to get ML recommendations:', e);
        }
      }

      // Trending/Charts section
      if (orchestrators?.metadata?.getCharts) {
        try {
          const charts = await orchestrators.metadata.getCharts(12);
          if (charts.tracks && charts.tracks.length > 0) {
            sections.push({
              id: 'trending',
              type: 'trending',
              title: 'Trending Now',
              subtitle: 'What\'s hot',
              tracks: charts.tracks.map(transformTrack)
            });
          }
          if (charts.artists && charts.artists.length > 0) {
            sections.push({
              id: 'popular-artists',
              type: 'artists',
              title: 'Popular Artists',
              artists: charts.artists.map((a: any) => ({
                ...a,
                image: a.image || extractArtwork(a.artwork)
              }))
            });
          }
          if (charts.albums && charts.albums.length > 0) {
            sections.push({
              id: 'new-releases',
              type: 'new-releases',
              title: 'New Releases',
              albums: charts.albums.map((a: any) => ({
                ...a,
                artwork: extractArtwork(a.artwork)
              }))
            });
          }
        } catch (e) {
          console.error('[Mobile API] Failed to get charts:', e);
        }
      }

      // Mixes section (Daily Mix, Genre Radio, etc.)
      if (orchestrators?.libraryBridge?.getMixes) {
        try {
          const mixes = await orchestrators.libraryBridge.getMixes(6);
          if (mixes && mixes.length > 0) {
            sections.push({
              id: 'mixes',
              type: 'mixes',
              title: 'Made For You',
              subtitle: 'Your personal mixes',
              tracks: mixes.map(transformTrack)
            });
          }
        } catch (e) {
          console.error('[Mobile API] Failed to get mixes:', e);
        }
      }

      // Get sections from registered plugins if available
      if (orchestrators?.registry?.getHomeSections) {
        try {
          const pluginSections = await orchestrators.registry.getHomeSections();
          if (pluginSections && pluginSections.length > 0) {
            for (const ps of pluginSections) {
              sections.push({
                id: ps.id || `plugin-${sections.length}`,
                type: ps.type || 'plugin',
                title: ps.title,
                subtitle: ps.subtitle,
                tracks: ps.tracks?.map(transformTrack),
                artists: ps.artists?.map((a: any) => ({
                  ...a,
                  image: a.image || extractArtwork(a.artwork)
                })),
                albums: ps.albums?.map((a: any) => ({
                  ...a,
                  artwork: extractArtwork(a.artwork)
                })),
                isPluginPowered: true,
                pluginName: ps.pluginName || ps.source
              });
            }
          }
        } catch (e) {
          console.error('[Mobile API] Failed to get plugin sections:', e);
        }
      }

      // Genre browse section (always show if we have genres)
      try {
        const defaultGenres = [
          { id: 'pop', name: 'Pop', color: '#E91E63' },
          { id: 'rock', name: 'Rock', color: '#F44336' },
          { id: 'hip-hop', name: 'Hip Hop', color: '#9C27B0' },
          { id: 'r-n-b', name: 'R&B', color: '#673AB7' },
          { id: 'electronic', name: 'Electronic', color: '#3F51B5' },
          { id: 'jazz', name: 'Jazz', color: '#2196F3' },
          { id: 'classical', name: 'Classical', color: '#009688' },
          { id: 'country', name: 'Country', color: '#FF9800' }
        ];

        sections.push({
          id: 'browse-genres',
          type: 'genres',
          title: 'Browse by Genre',
          genres: defaultGenres
        });
      } catch (e) {
        console.error('[Mobile API] Failed to add genre section:', e);
      }

      // Fallback: If no sections, use search to get some content
      if (sections.length <= 1 && orchestrators?.search) {
        try {
          const result = await orchestrators.search.search('popular music', { limit: 12 });
          const transformed = transformCharts({
            tracks: result.tracks || [],
            artists: result.artists || [],
            albums: result.albums || []
          });

          if (transformed.tracks.length > 0) {
            sections.push({
              id: 'discover-tracks',
              type: 'trending',
              title: 'Discover',
              subtitle: 'Popular tracks',
              tracks: transformed.tracks
            });
          }
        } catch (e) {
          console.error('[Mobile API] Failed to get fallback content:', e);
        }
      }

      console.log(`[Mobile API] Discover sections: ${sections.length} sections`);
      return { sections };
    } catch (error) {
      console.error('[Mobile API] Discover sections error:', error);
      return reply.code(500).send({ error: 'Failed to fetch discover sections' });
    }
  });

  // ========================================
  // Playback Control
  // ========================================

  fastify.post('/api/playback/play', async (request: FastifyRequest, reply: FastifyReply) => {
    const { track } = request.body as { track: any };

    if (!track) {
      return reply.code(400).send({ error: 'Track data required' });
    }

    if (!orchestrators?.playback) {
      return reply.code(503).send({ error: 'Playback service not available' });
    }

    try {
      const streamInfo = await orchestrators.playback.play(track);
      return { success: true, streamInfo };
    } catch (error) {
      console.error('Play error:', error);
      return reply.code(500).send({ error: 'Failed to start playback' });
    }
  });

  fastify.post('/api/playback/pause', async (_request: FastifyRequest, reply: FastifyReply) => {
    if (!orchestrators?.playback) {
      return reply.code(503).send({ error: 'Playback service not available' });
    }

    orchestrators.playback.pause();
    return { success: true };
  });

  fastify.post('/api/playback/resume', async (_request: FastifyRequest, reply: FastifyReply) => {
    if (!orchestrators?.playback) {
      return reply.code(503).send({ error: 'Playback service not available' });
    }

    orchestrators.playback.resume();
    return { success: true };
  });

  fastify.post('/api/playback/seek', async (request: FastifyRequest, reply: FastifyReply) => {
    const { position } = request.body as { position: number };

    if (typeof position !== 'number') {
      return reply.code(400).send({ error: 'Position required' });
    }

    if (!orchestrators?.playback) {
      return reply.code(503).send({ error: 'Playback service not available' });
    }

    orchestrators.playback.seek(position);
    return { success: true };
  });

  fastify.get('/api/playback/state', async (_request: FastifyRequest, _reply: FastifyReply) => {
    if (!orchestrators?.playback) {
      return {
        isPlaying: false,
        currentTrack: null,
        position: 0,
        duration: 0,
        volume: 1
      };
    }

    return orchestrators.playback.getState();
  });

  // ========================================
  // Audio Streaming
  // ========================================

  /**
   * Resolve stream URL without triggering desktop playback
   * Used by mobile for local playback mode
   */
  fastify.post('/api/stream/resolve', async (request: FastifyRequest, reply: FastifyReply) => {
    const { track } = request.body as { track: any };

    if (!track) {
      return reply.code(400).send({ error: 'Track data required' });
    }

    if (!orchestrators?.trackResolver) {
      return reply.code(503).send({ error: 'Stream service not available' });
    }

    try {
      // Resolve stream URL without starting desktop playback
      // Use resolveStream method (not resolve)
      const streamInfo = await orchestrators.trackResolver.resolveStream(track);

      if (!streamInfo?.url) {
        return reply.code(404).send({ error: 'Stream not found' });
      }

      return { success: true, streamInfo };
    } catch (error) {
      console.error('Stream resolve error:', error);
      return reply.code(500).send({ error: 'Failed to resolve stream' });
    }
  });

  fastify.get('/api/stream/:trackId', async (request: FastifyRequest, reply: FastifyReply) => {
    const { trackId } = request.params as { trackId: string };

    if (!orchestrators?.trackResolver) {
      return reply.code(503).send({ error: 'Stream service not available' });
    }

    try {
      // Resolve stream URL for the track
      // In production, this would proxy the stream through the server
      // to avoid exposing the actual stream URL to the client
      const streamInfo = await orchestrators.trackResolver.resolve({ id: trackId });

      if (!streamInfo?.url) {
        return reply.code(404).send({ error: 'Stream not found' });
      }

      // For now, redirect to the stream URL
      // In production, implement proper proxying with range request support
      return reply.redirect(streamInfo.url);
    } catch (error) {
      console.error('Stream error:', error);
      return reply.code(500).send({ error: 'Failed to get stream' });
    }
  });

  // ========================================
  // Addons/Plugins Management
  // ========================================

  fastify.get('/api/addons', async (_request: FastifyRequest, _reply: FastifyReply) => {
    if (!orchestrators?.registry) {
      return { addons: [] };
    }

    // Use getAllAddonInfo to get full info including disabled addons
    const addons = orchestrators.registry.getAllAddonInfo?.() || [];

    // Fall back to old method if getAllAddonInfo doesn't exist
    if (addons.length === 0) {
      const addonIds = orchestrators.registry.getAllAddonIds?.() || [];
      const legacyAddons = addonIds.map((id: string) => {
        const addon = orchestrators.registry.get(id);
        const info = orchestrators.registry.getAddonInfo?.(id);
        return info || {
          id,
          name: addon?.manifest?.name || id,
          roles: addon?.manifest?.roles || [],
          enabled: addon !== null
        };
      });
      return { addons: legacyAddons };
    }

    return { addons };
  });

  // Get addon settings
  fastify.get('/api/addons/:addonId/settings', async (request: FastifyRequest, reply: FastifyReply) => {
    const { addonId } = request.params as { addonId: string };

    if (!orchestrators?.registry) {
      return reply.code(503).send({ error: 'Registry not available' });
    }

    const addon = orchestrators.registry.get(addonId) as { getSettings?: () => Record<string, unknown> } | null;
    if (!addon) {
      return reply.code(404).send({ error: 'Addon not found or disabled' });
    }

    if (!addon.getSettings) {
      return { settings: null, message: 'Addon has no configurable settings' };
    }

    return { settings: addon.getSettings() };
  });

  // Update addon settings
  fastify.post('/api/addons/:addonId/settings', async (request: FastifyRequest, reply: FastifyReply) => {
    const { addonId } = request.params as { addonId: string };
    const { settings } = request.body as { settings: Record<string, unknown> };

    if (!settings) {
      return reply.code(400).send({ error: 'Settings object required' });
    }

    if (!orchestrators?.registry) {
      return reply.code(503).send({ error: 'Registry not available' });
    }

    const addon = orchestrators.registry.get(addonId) as {
      updateSettings?: (s: Record<string, unknown>) => void;
      getSettings?: () => Record<string, unknown>;
    } | null;

    if (!addon) {
      return reply.code(404).send({ error: 'Addon not found or disabled' });
    }

    if (!addon.updateSettings) {
      return reply.code(400).send({ error: 'Addon does not support settings updates' });
    }

    addon.updateSettings(settings);
    return { success: true, settings: addon.getSettings?.() || settings };
  });

  // Enable/disable addon
  fastify.post('/api/addons/:addonId/enabled', async (request: FastifyRequest, reply: FastifyReply) => {
    const { addonId } = request.params as { addonId: string };
    const { enabled } = request.body as { enabled: boolean };

    if (typeof enabled !== 'boolean') {
      return reply.code(400).send({ error: 'enabled (boolean) required' });
    }

    if (!orchestrators?.registry) {
      return reply.code(503).send({ error: 'Registry not available' });
    }

    orchestrators.registry.setEnabled(addonId, enabled);
    return { success: true, addonId, enabled };
  });

  // Reorder addons (bulk)
  fastify.post('/api/addons/order', async (request: FastifyRequest, reply: FastifyReply) => {
    const { orderedIds } = request.body as { orderedIds: string[] };

    if (!Array.isArray(orderedIds)) {
      return reply.code(400).send({ error: 'orderedIds (array of strings) required' });
    }

    if (!orchestrators?.registry) {
      return reply.code(503).send({ error: 'Registry not available' });
    }

    orchestrators.registry.setAddonOrder(orderedIds);
    return { success: true, order: orderedIds };
  });

  // Get addon priorities
  fastify.get('/api/addons/priorities', async (_request: FastifyRequest, reply: FastifyReply) => {
    if (!orchestrators?.registry) {
      return reply.code(503).send({ error: 'Registry not available' });
    }

    const priorities = orchestrators.registry.getAddonPriorities();
    return { priorities: Object.fromEntries(priorities) };
  });

  // ========================================
  // Lyrics (uses registry.getLyricsProviders)
  // ========================================

  fastify.get('/api/lyrics', async (request: FastifyRequest, reply: FastifyReply) => {
    const { title, artist, album, duration } = request.query as {
      title?: string;
      artist?: string;
      album?: string;
      duration?: string;
    };

    if (!title || !artist) {
      return reply.code(400).send({ error: 'title and artist are required' });
    }

    if (!orchestrators?.registry) {
      return reply.code(503).send({ error: 'Registry not available' });
    }

    // Get lyrics providers from registry (sorted by priority)
    const lyricsProviders = orchestrators.registry.getLyricsProviders?.() || [];
    if (lyricsProviders.length === 0) {
      return reply.code(503).send({ error: 'No lyrics provider available' });
    }

    try {
      // Try each provider in order until one returns results
      for (const provider of lyricsProviders) {
        try {
          const lyrics = await provider.getLyrics({
            title,
            artist,
            album,
            duration: duration ? parseInt(duration, 10) : undefined
          });
          if (lyrics) {
            return lyrics;
          }
        } catch {
          // Try next provider
          continue;
        }
      }

      return reply.code(404).send({ error: 'No lyrics found' });
    } catch (error) {
      console.error('[Mobile API] Lyrics error:', error);
      return reply.code(500).send({ error: 'Failed to fetch lyrics' });
    }
  });

  // ========================================
  // Translation (LibreTranslate API)
  // ========================================

  fastify.post('/api/translate', async (request: FastifyRequest, reply: FastifyReply) => {
    const { text, source, target } = request.body as {
      text: string;
      source?: string;
      target: string;
    };

    if (!text || !target) {
      return reply.code(400).send({ error: 'text and target language are required' });
    }

    // Split text into lines to handle long lyrics (MyMemory has limits)
    const lines = text.split('\n').filter(l => l.trim());
    const translatedLines: string[] = [];

    try {
      // Translate in batches to avoid hitting API limits
      const batchSize = 10;
      for (let i = 0; i < lines.length; i += batchSize) {
        const batch = lines.slice(i, i + batchSize);
        const batchText = batch.join('\n');

        // Use MyMemory API (free, no API key required)
        const langPair = `${source || 'autodetect'}|${target}`;
        const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(batchText)}&langpair=${encodeURIComponent(langPair)}`;

        const response = await fetch(url);

        if (!response.ok) {
          console.error('[Mobile API] MyMemory API error:', response.status);
          // Try LibreTranslate as fallback
          const libreResponse = await fetch('https://translate.argosopentech.com/translate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              q: batchText,
              source: source || 'auto',
              target,
              format: 'text'
            })
          });

          if (!libreResponse.ok) {
            return reply.code(503).send({ error: 'Translation service unavailable' });
          }

          const libreData = await libreResponse.json() as { translatedText: string };
          translatedLines.push(...libreData.translatedText.split('\n'));
          continue;
        }

        const data = await response.json() as {
          responseStatus: number;
          responseData: { translatedText: string };
          matches?: Array<{ translation: string }>;
        };

        if (data.responseStatus !== 200 || !data.responseData?.translatedText) {
          console.error('[Mobile API] MyMemory API invalid response:', data);
          return reply.code(503).send({ error: 'Translation service returned invalid response' });
        }

        translatedLines.push(...data.responseData.translatedText.split('\n'));
      }

      return { translatedText: translatedLines.join('\n') };
    } catch (error) {
      console.error('[Mobile API] Translation error:', error);
      return reply.code(500).send({ error: 'Translation failed' });
    }
  });

  // ========================================
  // ML/Algorithm (recommendations, features)
  // ========================================

  // Check ML service status
  fastify.get('/api/algo/status', async (_request: FastifyRequest, _reply: FastifyReply) => {
    if (!orchestrators?.mlService) {
      return { available: false, reason: 'ML service not configured' };
    }

    const isLoaded = orchestrators.mlService.isAlgorithmLoaded?.() ?? false;
    const trainingStatus = orchestrators.mlService.getTrainingStatus?.() ?? null;

    return {
      available: isLoaded,
      initialized: orchestrators.mlService.isInitialized?.() ?? false,
      training: trainingStatus
    };
  });

  // Get personalized recommendations
  fastify.get('/api/algo/recommendations', async (request: FastifyRequest, reply: FastifyReply) => {
    const { count } = request.query as { count?: string };
    const limit = parseInt(count || '20', 10);

    if (!orchestrators?.mlService) {
      return reply.code(503).send({ error: 'ML service not available' });
    }

    if (!orchestrators.mlService.isAlgorithmLoaded?.()) {
      return reply.code(503).send({ error: 'Algorithm not loaded' });
    }

    try {
      const recommendations = await orchestrators.mlService.getRecommendations(limit);
      return { recommendations };
    } catch (error) {
      console.error('[Mobile API] Recommendations error:', error);
      return reply.code(500).send({ error: 'Failed to get recommendations' });
    }
  });

  // Get similar tracks
  fastify.get('/api/algo/similar/:trackId', async (request: FastifyRequest, reply: FastifyReply) => {
    const { trackId } = request.params as { trackId: string };
    const { count } = request.query as { count?: string };
    const limit = parseInt(count || '10', 10);

    if (!orchestrators?.mlService) {
      return reply.code(503).send({ error: 'ML service not available' });
    }

    if (!orchestrators.mlService.isAlgorithmLoaded?.()) {
      return reply.code(503).send({ error: 'Algorithm not loaded' });
    }

    try {
      const similar = await orchestrators.mlService.getSimilarTracks(trackId, limit);
      return { tracks: similar };
    } catch (error) {
      console.error('[Mobile API] Similar tracks error:', error);
      return reply.code(500).send({ error: 'Failed to get similar tracks' });
    }
  });

  // Record ML event (skip, listen, like, dislike)
  fastify.post('/api/algo/event', async (request: FastifyRequest, reply: FastifyReply) => {
    const event = request.body as {
      type: 'skip' | 'listen' | 'like' | 'dislike';
      track: any;
      [key: string]: any;
    };

    if (!event?.type || !event?.track) {
      return reply.code(400).send({ error: 'type and track are required' });
    }

    if (!orchestrators?.mlService) {
      return reply.code(503).send({ error: 'ML service not available' });
    }

    try {
      await orchestrators.mlService.recordEvent({
        ...event,
        timestamp: Date.now(),
        context: {
          ...event.context,
          device: 'mobile'
        }
      });
      return { success: true };
    } catch (error) {
      console.error('[Mobile API] Record event error:', error);
      return reply.code(500).send({ error: 'Failed to record event' });
    }
  });

  // Get audio features for a track
  fastify.get('/api/algo/features/:trackId', async (request: FastifyRequest, reply: FastifyReply) => {
    const { trackId } = request.params as { trackId: string };

    if (!orchestrators?.mlService) {
      return reply.code(503).send({ error: 'ML service not available' });
    }

    try {
      const features = await orchestrators.mlService.getAudioFeatures?.(trackId);
      if (!features) {
        return reply.code(404).send({ error: 'Features not available for this track' });
      }
      return { features };
    } catch (error) {
      console.error('[Mobile API] Audio features error:', error);
      return reply.code(500).send({ error: 'Failed to get audio features' });
    }
  });

  // ========================================
  // Session Management
  // ========================================

  fastify.get('/api/sessions', async () => {
    return {
      sessions: sessionManager.getAllSessions(),
      total: sessionManager.getActiveCount()
    };
  });

  fastify.delete('/api/sessions/:sessionId', async (request: FastifyRequest, _reply: FastifyReply) => {
    const { sessionId } = request.params as { sessionId: string };
    sessionManager.endSession(sessionId);
    return { success: true };
  });

  // ========================================
  // Access Management
  // ========================================

  fastify.post('/api/access/rotate', async () => {
    const currentAccess = accessManager.getCurrentAccess();
    if (!currentAccess) {
      return { error: 'No active access configuration' };
    }

    // Parse URL to get base URL without tokens
    const localBase = currentAccess.localUrl.split('?')[0] ?? '';

    const newAccess = await accessManager.rotateAccess(localBase);

    // End all existing sessions since token changed
    sessionManager.endSessionsForToken(currentAccess.token);

    return {
      success: true,
      newToken: newAccess.token,
      message: 'Access token rotated. All existing sessions have been disconnected.'
    };
  });

  fastify.get('/api/access/info', async () => {
    const access = accessManager.getCurrentAccess();

    // Get pairing info from PairingService
    const pairingCode = pairingService?.getCurrentCode();

    return {
      // Pairing code (WORD-WORD-NUMBER format)
      pairingCode: pairingCode?.code || access?.pairingCode,
      pairingCodeExpiresAt: pairingCode?.expiresAt,
      qrCode: pairingCode?.qrCode || access?.qrCode,

      // Local access
      localUrl: pairingCode?.localUrl || access?.localUrl?.split('?')[0],

      // Remote access (P2P/Relay)
      p2pCode: access?.p2pCode,
      relayCode: access?.relayCode,
      relayUrl: pairingService?.getRelayUrl() || 'wss://audiio-relay.fly.dev',
      hasRemoteAccess: !!access?.p2pActive,
      relayActive: access?.relayActive,

      // Metadata
      createdAt: access?.createdAt,
      expiresAt: access?.expiresAt
    };
  });

  // Refresh pairing code
  fastify.post('/api/access/refresh', async (_request: FastifyRequest, reply: FastifyReply) => {
    if (pairingService) {
      const code = await pairingService.refreshCode();
      if (code) {
        return {
          success: true,
          pairingCode: code.code,
          expiresAt: code.expiresAt,
          qrCode: code.qrCode
        };
      }
    }

    // Fallback to legacy
    const currentAccess = accessManager.getCurrentAccess();
    if (!currentAccess) {
      return reply.code(503).send({ error: 'No active access' });
    }

    const newCode = await accessManager.regeneratePairingCode();
    return {
      success: true,
      pairingCode: newCode
    };
  });

  // Get/Set custom relay URL
  fastify.get('/api/access/relay', async () => {
    return {
      url: pairingService?.getRelayUrl() || 'wss://audiio-relay.fly.dev',
      default: 'wss://audiio-relay.fly.dev'
    };
  });

  fastify.post('/api/access/relay', async (request: FastifyRequest, reply: FastifyReply) => {
    const { url } = request.body as { url: string };

    if (!url) {
      return reply.code(400).send({ error: 'URL required' });
    }

    // Validate URL format
    try {
      new URL(url);
    } catch {
      return reply.code(400).send({ error: 'Invalid URL format' });
    }

    if (pairingService) {
      pairingService.setRelayUrl(url);
      return { success: true, url };
    }

    return reply.code(503).send({ error: 'Pairing service not available' });
  });

  // ========================================
  // Enhanced Authentication (Device-based)
  // ========================================

  // Simplified pairing via WORD-WORD-NUMBER code
  // Auto-approves immediately - no desktop confirmation needed
  fastify.post('/api/auth/pair', async (request: FastifyRequest, reply: FastifyReply) => {
    const { code, deviceName } = request.body as {
      code: string;
      deviceName?: string;
    };

    // Support both 'code' and 'pairingCode' for backwards compatibility
    const pairingCode = code || (request.body as any).pairingCode;

    if (!pairingCode) {
      return reply.code(400).send({ success: false, error: 'Pairing code required' });
    }

    const userAgent = request.headers['user-agent'] || '';

    console.log(`[Auth] Pairing attempt with code: ${pairingCode}`);

    // Use PairingService if available (new flow)
    if (pairingService) {
      // Debug: check if code is valid before pairing
      const isValid = pairingService.isCodeValid(pairingCode);
      console.log(`[Auth] Code validation result: ${isValid}`);

      const result = pairingService.pair(pairingCode, {
        name: deviceName,
        userAgent
      });

      if (!result.success) {
        console.log(`[Auth] Pairing failed: ${result.error}`);
        return reply.code(401).send({
          success: false,
          error: result.error || 'Invalid or expired pairing code'
        });
      }

      console.log(`[Auth] Device paired: ${deviceName || 'Unknown'} (${result.deviceId})`);
      return {
        success: true,
        deviceToken: result.deviceToken,
        deviceId: result.deviceId,
        localUrl: result.localUrl,
        // Include server identity for persistent reconnection
        serverId: result.serverId,
        serverName: result.serverName,
        relayCode: result.relayCode,
        message: 'Device paired successfully'
      };
    }

    // Fallback to legacy accessManager flow
    const resultOrPromise = accessManager.consumePairingCode(pairingCode, userAgent);
    const result = resultOrPromise instanceof Promise ? await resultOrPromise : resultOrPromise;

    if (!result.success) {
      return reply.code(401).send({
        success: false,
        error: result.error || 'Invalid or expired pairing code'
      });
    }

    if (result.deviceToken && result.deviceId) {
      return {
        success: true,
        deviceToken: result.deviceToken,
        deviceId: result.deviceId,
        message: 'Device paired successfully'
      };
    }

    return { success: true, message: 'Connected via pairing code' };
  });

  // Check if pairing code is valid (for UI feedback)
  fastify.get('/api/auth/pair/check', async (request: FastifyRequest, reply: FastifyReply) => {
    const { code } = request.query as { code: string };

    if (!code) {
      return reply.code(400).send({ valid: false });
    }

    // Use PairingService if available
    if (pairingService) {
      return { valid: pairingService.isCodeValid(code) };
    }

    // Fallback to legacy
    const valid = accessManager.isPairingCodeValid(code);
    return { valid };
  });

  // Login with passphrase/password
  fastify.post('/api/auth/login', async (request: FastifyRequest, reply: FastifyReply) => {
    const { password, deviceName, rememberDevice } = request.body as {
      password: string;
      deviceName?: string;
      rememberDevice?: boolean;
    };

    if (!password) {
      return reply.code(400).send({ success: false, error: 'Password required' });
    }

    if (!orchestrators?.authManager) {
      // Fall back to legacy token auth
      const isValid = accessManager.validateToken(password);
      if (isValid) {
        return { success: true };
      }
      return reply.code(401).send({ success: false, error: 'Invalid password' });
    }

    try {
      const result = await orchestrators.authManager.login(
        password,
        deviceName || 'Unknown Device',
        request.headers['user-agent'] || '',
        rememberDevice || false
      );

      if (!result.success) {
        return reply.code(401).send(result);
      }

      return result;
    } catch (error) {
      console.error('Login error:', error);
      return reply.code(500).send({ success: false, error: 'Login failed' });
    }
  });

  // Authenticate with device token
  fastify.post('/api/auth/device', async (request: FastifyRequest, reply: FastifyReply) => {
    const { deviceToken } = request.body as { deviceToken: string };

    if (!deviceToken) {
      return reply.code(400).send({ success: false, error: 'Device token required' });
    }

    try {
      // Use PairingService if available
      if (pairingService) {
        const result = pairingService.validateDeviceToken(deviceToken);
        if (!result.valid) {
          return reply.code(401).send({ success: false, error: 'Invalid or expired device token' });
        }
        return { success: true, deviceId: result.deviceId };
      }

      // Fallback to legacy authManager
      if (orchestrators?.authManager) {
        const result = orchestrators.authManager.validateDeviceToken(deviceToken);
        if (!result.valid) {
          return reply.code(401).send({ success: false, error: 'Invalid or expired device token' });
        }
        return { success: true, deviceId: result.deviceId };
      }

      return reply.code(503).send({ success: false, error: 'Device auth not available' });
    } catch (error) {
      console.error('Device auth error:', error);
      return reply.code(500).send({ success: false, error: 'Authentication failed' });
    }
  });

  // Refresh device token
  fastify.post('/api/auth/refresh', async (request: FastifyRequest, reply: FastifyReply) => {
    const { deviceId, token } = request.body as { deviceId: string; token: string };

    if (!deviceId || !token) {
      return reply.code(400).send({ success: false, error: 'Device ID and token required' });
    }

    try {
      // Use PairingService if available
      if (pairingService) {
        const newToken = pairingService.refreshDeviceToken(deviceId, token);
        if (!newToken) {
          return reply.code(401).send({ success: false, error: 'Invalid credentials' });
        }
        return {
          success: true,
          deviceToken: `${newToken.deviceId}:${newToken.token}`,
          expiresAt: newToken.expiresAt?.toISOString()
        };
      }

      // Fallback to legacy authManager
      if (orchestrators?.authManager) {
        const newToken = orchestrators.authManager.refreshDeviceToken(deviceId, token);
        if (!newToken) {
          return reply.code(401).send({ success: false, error: 'Invalid credentials' });
        }
        return {
          success: true,
          deviceToken: `${newToken.deviceId}:${newToken.token}`,
          expiresAt: newToken.expiresAt?.toISOString()
        };
      }

      return reply.code(503).send({ success: false, error: 'Auth service not available' });
    } catch (error) {
      console.error('Token refresh error:', error);
      return reply.code(500).send({ success: false, error: 'Refresh failed' });
    }
  });

  // Logout (revoke device token)
  fastify.post('/api/auth/logout', async (request: FastifyRequest, reply: FastifyReply) => {
    const { deviceId } = request.body as { deviceId?: string };

    try {
      if (deviceId) {
        // Use PairingService if available
        if (pairingService) {
          pairingService.revokeDevice(deviceId);
        } else if (orchestrators?.authManager) {
          orchestrators.authManager.revokeDevice(deviceId);
        }
      }
      return { success: true };
    } catch (error) {
      console.error('Logout error:', error);
      return reply.code(500).send({ success: false, error: 'Logout failed' });
    }
  });

  // List authorized devices (desktop management)
  fastify.get('/api/auth/devices', async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      let devices: any[] = [];

      // Use PairingService if available
      if (pairingService) {
        devices = pairingService.getDevices();
      } else if (orchestrators?.authManager) {
        devices = orchestrators.authManager.listDevices();
      }

      return {
        devices: devices.map((d: { id: string; name: string; createdAt: Date; lastAccessAt: Date; expiresAt?: Date | null }) => ({
          id: d.id,
          name: d.name,
          createdAt: d.createdAt.toISOString(),
          lastAccessAt: d.lastAccessAt.toISOString(),
          expiresAt: d.expiresAt?.toISOString() || null
        }))
      };
    } catch (error) {
      console.error('List devices error:', error);
      return reply.code(500).send({ error: 'Failed to list devices' });
    }
  });

  // Revoke a device
  fastify.delete('/api/auth/devices/:deviceId', async (request: FastifyRequest, reply: FastifyReply) => {
    const { deviceId } = request.params as { deviceId: string };

    try {
      let success = false;

      // Use PairingService if available
      if (pairingService) {
        success = pairingService.revokeDevice(deviceId);
      } else if (orchestrators?.authManager) {
        success = orchestrators.authManager.revokeDevice(deviceId);
      } else {
        return reply.code(503).send({ error: 'Auth service not available' });
      }

      return { success };
    } catch (error) {
      console.error('Revoke device error:', error);
      return reply.code(500).send({ error: 'Failed to revoke device' });
    }
  });

  // Get current pairing code (DEPRECATED: use /api/access/info instead)
  // Kept for backwards compatibility - returns pairing code as "passphrase"
  fastify.get('/api/auth/passphrase', async (_request: FastifyRequest, _reply: FastifyReply) => {
    // Return pairing code from PairingService
    if (pairingService) {
      const code = pairingService.getCurrentCode();
      return { passphrase: code?.code || '' };
    }

    // Fallback to legacy
    if (orchestrators?.authManager) {
      const passphrase = orchestrators.authManager.getCurrentPassphrase();
      return { passphrase };
    }

    const access = accessManager.getCurrentAccess();
    return { passphrase: access?.pairingCode || access?.token || '' };
  });

  // Regenerate pairing code (DEPRECATED: use /api/access/refresh instead)
  fastify.post('/api/auth/passphrase/regenerate', async (_request: FastifyRequest, reply: FastifyReply) => {
    // Refresh pairing code from PairingService
    if (pairingService) {
      const code = await pairingService.refreshCode();
      return { passphrase: code?.code || '' };
    }

    // Fallback to legacy
    if (orchestrators?.authManager) {
      const passphrase = orchestrators.authManager.regeneratePassphrase();
      return { passphrase };
    }

    const currentAccess = accessManager.getCurrentAccess();
    if (!currentAccess) {
      return reply.code(503).send({ error: 'No active access' });
    }

    const localBase = currentAccess.localUrl.split('?')[0] ?? '';
    const newAccess = await accessManager.rotateAccess(localBase);
    return { passphrase: newAccess.token };
  });

  // DEPRECATED: Custom password no longer supported in simplified flow
  // Kept for backwards compatibility - returns error
  fastify.post('/api/auth/password', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.code(410).send({
      error: 'Custom passwords are no longer supported. Use pairing codes instead.',
      deprecated: true
    });
  });

  // Get auth settings
  fastify.get('/api/auth/settings', async (_request: FastifyRequest, reply: FastifyReply) => {
    if (!orchestrators?.authManager) {
      return {
        useCustomPassword: false,
        defaultExpirationDays: 30,
        requirePasswordEveryTime: false
      };
    }

    try {
      const settings = orchestrators.authManager.getSettings();
      return settings;
    } catch (error) {
      console.error('Get auth settings error:', error);
      return reply.code(500).send({ error: 'Failed to get settings' });
    }
  });

  // Update auth settings
  fastify.post('/api/auth/settings', async (request: FastifyRequest, reply: FastifyReply) => {
    const settings = request.body as {
      defaultExpirationDays?: number | null;
      requirePasswordEveryTime?: boolean;
    };

    if (!orchestrators?.authManager) {
      return reply.code(503).send({ error: 'Auth service not available' });
    }

    try {
      orchestrators.authManager.updateSettings(settings);
      return { success: true };
    } catch (error) {
      console.error('Update auth settings error:', error);
      return reply.code(500).send({ error: 'Failed to update settings' });
    }
  });

  // ========================================
  // Library Management (Sync with Desktop)
  // ========================================

  // Get liked tracks
  fastify.get('/api/library/likes', async (_request: FastifyRequest, reply: FastifyReply) => {
    if (!orchestrators?.libraryBridge) {
      return { tracks: [], synced: false };
    }

    try {
      const rawTracks = orchestrators.libraryBridge.getLikedTracks();
      const tracks = (rawTracks || []).map(transformTrack);
      return { tracks, synced: true };
    } catch (error) {
      console.error('[Library API] Get likes error:', error);
      return reply.code(500).send({ error: 'Failed to get liked tracks' });
    }
  });

  // Like a track
  fastify.post('/api/library/likes', async (request: FastifyRequest, reply: FastifyReply) => {
    const { track } = request.body as { track: any };

    if (!track) {
      return reply.code(400).send({ error: 'Track data required' });
    }

    if (!orchestrators?.libraryBridge) {
      return reply.code(503).send({ error: 'Library sync not available' });
    }

    try {
      await orchestrators.libraryBridge.likeTrack(track);
      return { success: true };
    } catch (error) {
      console.error('[Library API] Like track error:', error);
      return reply.code(500).send({ error: 'Failed to like track' });
    }
  });

  // Unlike a track
  fastify.delete('/api/library/likes/:trackId', async (request: FastifyRequest, reply: FastifyReply) => {
    const { trackId } = request.params as { trackId: string };

    if (!orchestrators?.libraryBridge) {
      return reply.code(503).send({ error: 'Library sync not available' });
    }

    try {
      await orchestrators.libraryBridge.unlikeTrack(trackId);
      return { success: true };
    } catch (error) {
      console.error('[Library API] Unlike track error:', error);
      return reply.code(500).send({ error: 'Failed to unlike track' });
    }
  });

  // Check if track is liked
  fastify.get('/api/library/likes/:trackId', async (request: FastifyRequest, _reply: FastifyReply) => {
    const { trackId } = request.params as { trackId: string };

    if (!orchestrators?.libraryBridge) {
      return { liked: false, synced: false };
    }

    const liked = orchestrators.libraryBridge.isTrackLiked(trackId);
    return { liked, synced: true };
  });

  // Get disliked tracks
  fastify.get('/api/library/dislikes', async (_request: FastifyRequest, reply: FastifyReply) => {
    if (!orchestrators?.libraryBridge) {
      return { tracks: [], synced: false };
    }

    try {
      const rawTracks = orchestrators.libraryBridge.getDislikedTracks?.() || [];
      const tracks = rawTracks.map(transformTrack);
      return { tracks, synced: true };
    } catch (error) {
      console.error('[Library API] Get dislikes error:', error);
      return reply.code(500).send({ error: 'Failed to get disliked tracks' });
    }
  });

  // Dislike a track
  fastify.post('/api/library/dislikes', async (request: FastifyRequest, reply: FastifyReply) => {
    const { track, reasons } = request.body as { track: any; reasons: string[] };

    if (!track) {
      return reply.code(400).send({ error: 'Track data required' });
    }

    if (!orchestrators?.libraryBridge) {
      return reply.code(503).send({ error: 'Library sync not available' });
    }

    try {
      await orchestrators.libraryBridge.dislikeTrack(track, reasons || []);
      return { success: true };
    } catch (error) {
      console.error('[Library API] Dislike track error:', error);
      return reply.code(500).send({ error: 'Failed to dislike track' });
    }
  });

  // Remove dislike
  fastify.delete('/api/library/dislikes/:trackId', async (request: FastifyRequest, reply: FastifyReply) => {
    const { trackId } = request.params as { trackId: string };

    if (!orchestrators?.libraryBridge) {
      return reply.code(503).send({ error: 'Library sync not available' });
    }

    try {
      await orchestrators.libraryBridge.removeDislike(trackId);
      return { success: true };
    } catch (error) {
      console.error('[Library API] Remove dislike error:', error);
      return reply.code(500).send({ error: 'Failed to remove dislike' });
    }
  });

  // Get all playlists
  fastify.get('/api/library/playlists', async (_request: FastifyRequest, reply: FastifyReply) => {
    if (!orchestrators?.libraryBridge) {
      return { playlists: [], synced: false };
    }

    try {
      const rawPlaylists = orchestrators.libraryBridge.getPlaylists();
      // Transform tracks in each playlist
      const playlists = (rawPlaylists || []).map((p: any) => ({
        ...p,
        tracks: (p.tracks || []).map(transformTrack)
      }));
      return { playlists, synced: true };
    } catch (error) {
      console.error('[Library API] Get playlists error:', error);
      return reply.code(500).send({ error: 'Failed to get playlists' });
    }
  });

  // Get a specific playlist
  fastify.get('/api/library/playlists/:playlistId', async (request: FastifyRequest, reply: FastifyReply) => {
    const { playlistId } = request.params as { playlistId: string };

    if (!orchestrators?.libraryBridge) {
      return reply.code(503).send({ error: 'Library sync not available' });
    }

    const rawPlaylist = orchestrators.libraryBridge.getPlaylist(playlistId);
    if (!rawPlaylist) {
      return reply.code(404).send({ error: 'Playlist not found' });
    }

    // Transform tracks in playlist
    const playlist = {
      ...rawPlaylist,
      tracks: (rawPlaylist.tracks || []).map(transformTrack)
    };

    return { playlist };
  });

  // Create a playlist
  fastify.post('/api/library/playlists', async (request: FastifyRequest, reply: FastifyReply) => {
    const { name, description } = request.body as { name: string; description?: string };

    if (!name) {
      return reply.code(400).send({ error: 'Playlist name required' });
    }

    if (!orchestrators?.libraryBridge) {
      return reply.code(503).send({ error: 'Library sync not available' });
    }

    try {
      const playlist = await orchestrators.libraryBridge.createPlaylist(name, description);
      if (!playlist) {
        return reply.code(500).send({ error: 'Failed to create playlist' });
      }
      return { success: true, playlist };
    } catch (error) {
      console.error('[Library API] Create playlist error:', error);
      return reply.code(500).send({ error: 'Failed to create playlist' });
    }
  });

  // Delete a playlist
  fastify.delete('/api/library/playlists/:playlistId', async (request: FastifyRequest, reply: FastifyReply) => {
    const { playlistId } = request.params as { playlistId: string };

    if (!orchestrators?.libraryBridge) {
      return reply.code(503).send({ error: 'Library sync not available' });
    }

    try {
      await orchestrators.libraryBridge.deletePlaylist(playlistId);
      return { success: true };
    } catch (error) {
      console.error('[Library API] Delete playlist error:', error);
      return reply.code(500).send({ error: 'Failed to delete playlist' });
    }
  });

  // Rename a playlist
  fastify.put('/api/library/playlists/:playlistId', async (request: FastifyRequest, reply: FastifyReply) => {
    const { playlistId } = request.params as { playlistId: string };
    const { name } = request.body as { name: string };

    if (!name) {
      return reply.code(400).send({ error: 'New name required' });
    }

    if (!orchestrators?.libraryBridge) {
      return reply.code(503).send({ error: 'Library sync not available' });
    }

    try {
      await orchestrators.libraryBridge.renamePlaylist(playlistId, name);
      return { success: true };
    } catch (error) {
      console.error('[Library API] Rename playlist error:', error);
      return reply.code(500).send({ error: 'Failed to rename playlist' });
    }
  });

  // Add track to playlist
  fastify.post('/api/library/playlists/:playlistId/tracks', async (request: FastifyRequest, reply: FastifyReply) => {
    const { playlistId } = request.params as { playlistId: string };
    const { track } = request.body as { track: any };

    if (!track) {
      return reply.code(400).send({ error: 'Track data required' });
    }

    if (!orchestrators?.libraryBridge) {
      return reply.code(503).send({ error: 'Library sync not available' });
    }

    try {
      await orchestrators.libraryBridge.addToPlaylist(playlistId, track);
      return { success: true };
    } catch (error) {
      console.error('[Library API] Add to playlist error:', error);
      return reply.code(500).send({ error: 'Failed to add to playlist' });
    }
  });

  // Remove track from playlist
  fastify.delete('/api/library/playlists/:playlistId/tracks/:trackId', async (request: FastifyRequest, reply: FastifyReply) => {
    const { playlistId, trackId } = request.params as { playlistId: string; trackId: string };

    if (!orchestrators?.libraryBridge) {
      return reply.code(503).send({ error: 'Library sync not available' });
    }

    try {
      await orchestrators.libraryBridge.removeFromPlaylist(playlistId, trackId);
      return { success: true };
    } catch (error) {
      console.error('[Library API] Remove from playlist error:', error);
      return reply.code(500).send({ error: 'Failed to remove from playlist' });
    }
  });

  // ========================================
  // Artist Enrichment (Plugin-powered)
  // ========================================

  // Get available enrichment types
  fastify.get('/api/enrichment/types', async (_request: FastifyRequest, _reply: FastifyReply) => {
    if (!orchestrators?.registry?.getAvailableEnrichmentTypes) {
      return { types: [] };
    }

    const types = orchestrators.registry.getAvailableEnrichmentTypes();
    return { types };
  });

  // Get music videos for artist
  fastify.get('/api/enrichment/videos/:artistName', async (request: FastifyRequest, reply: FastifyReply) => {
    const { artistName } = request.params as { artistName: string };
    const { limit } = request.query as { limit?: string };

    if (!orchestrators?.registry) {
      return reply.code(503).send({ error: 'Registry not available' });
    }

    const providers = orchestrators.registry.getArtistEnrichmentProvidersByType?.('videos') || [];
    if (providers.length === 0) {
      return { success: false, data: [], error: 'No video provider available' };
    }

    try {
      for (const provider of providers) {
        if (provider.getVideos) {
          const videos = await provider.getVideos(decodeURIComponent(artistName), parseInt(limit || '8', 10));
          if (videos && videos.length > 0) {
            return { success: true, data: videos, source: provider.manifest.id };
          }
        }
      }
      return { success: true, data: [] };
    } catch (error) {
      console.error('[Enrichment API] Videos error:', error);
      return reply.code(500).send({ success: false, error: 'Failed to fetch videos' });
    }
  });

  // Get artist timeline
  fastify.get('/api/enrichment/timeline/:artistName', async (request: FastifyRequest, reply: FastifyReply) => {
    const { artistName } = request.params as { artistName: string };

    if (!orchestrators?.registry) {
      return reply.code(503).send({ error: 'Registry not available' });
    }

    const providers = orchestrators.registry.getArtistEnrichmentProvidersByType?.('timeline') || [];
    if (providers.length === 0) {
      return { success: false, data: [], error: 'No timeline provider available' };
    }

    try {
      for (const provider of providers) {
        if (provider.getTimeline) {
          const timeline = await provider.getTimeline(decodeURIComponent(artistName));
          if (timeline && timeline.length > 0) {
            return { success: true, data: timeline, source: provider.manifest.id };
          }
        }
      }
      return { success: true, data: [] };
    } catch (error) {
      console.error('[Enrichment API] Timeline error:', error);
      return reply.code(500).send({ success: false, error: 'Failed to fetch timeline' });
    }
  });

  // Get setlists
  fastify.get('/api/enrichment/setlists/:artistName', async (request: FastifyRequest, reply: FastifyReply) => {
    const { artistName } = request.params as { artistName: string };
    const { mbid, limit } = request.query as { mbid?: string; limit?: string };

    if (!orchestrators?.registry) {
      return reply.code(503).send({ error: 'Registry not available' });
    }

    const providers = orchestrators.registry.getArtistEnrichmentProvidersByType?.('setlists') || [];
    if (providers.length === 0) {
      return { success: false, data: [], error: 'No setlist provider available' };
    }

    try {
      for (const provider of providers) {
        if (provider.getSetlists) {
          const setlists = await provider.getSetlists(decodeURIComponent(artistName), mbid, parseInt(limit || '5', 10));
          if (setlists && setlists.length > 0) {
            return { success: true, data: setlists, source: provider.manifest.id };
          }
        }
      }
      return { success: true, data: [] };
    } catch (error) {
      console.error('[Enrichment API] Setlists error:', error);
      return reply.code(500).send({ success: false, error: 'Failed to fetch setlists' });
    }
  });

  // Get concerts
  fastify.get('/api/enrichment/concerts/:artistName', async (request: FastifyRequest, reply: FastifyReply) => {
    const { artistName } = request.params as { artistName: string };

    if (!orchestrators?.registry) {
      return reply.code(503).send({ error: 'Registry not available' });
    }

    const providers = orchestrators.registry.getArtistEnrichmentProvidersByType?.('concerts') || [];
    if (providers.length === 0) {
      return { success: false, data: [], error: 'No concert provider available' };
    }

    try {
      for (const provider of providers) {
        if (provider.getConcerts) {
          const concerts = await provider.getConcerts(decodeURIComponent(artistName));
          if (concerts && concerts.length > 0) {
            return { success: true, data: concerts, source: provider.manifest.id };
          }
        }
      }
      return { success: true, data: [] };
    } catch (error) {
      console.error('[Enrichment API] Concerts error:', error);
      return reply.code(500).send({ success: false, error: 'Failed to fetch concerts' });
    }
  });

  // Get gallery/images
  fastify.get('/api/enrichment/gallery/:artistName', async (request: FastifyRequest, reply: FastifyReply) => {
    const { artistName } = request.params as { artistName: string };
    const { mbid } = request.query as { mbid?: string };

    if (!orchestrators?.registry) {
      return reply.code(503).send({ error: 'Registry not available' });
    }

    const providers = orchestrators.registry.getArtistEnrichmentProvidersByType?.('gallery') || [];
    if (providers.length === 0) {
      return { success: false, data: null, error: 'No gallery provider available' };
    }

    try {
      for (const provider of providers) {
        if (provider.getGallery) {
          const gallery = await provider.getGallery(mbid, decodeURIComponent(artistName));
          if (gallery) {
            return { success: true, data: gallery, source: provider.manifest.id };
          }
        }
      }
      return { success: true, data: null };
    } catch (error) {
      console.error('[Enrichment API] Gallery error:', error);
      return reply.code(500).send({ success: false, error: 'Failed to fetch gallery' });
    }
  });

  // Get merchandise link
  fastify.get('/api/enrichment/merchandise/:artistName', async (request: FastifyRequest, reply: FastifyReply) => {
    const { artistName } = request.params as { artistName: string };

    if (!orchestrators?.registry) {
      return reply.code(503).send({ error: 'Registry not available' });
    }

    const providers = orchestrators.registry.getArtistEnrichmentProvidersByType?.('merchandise') || [];
    if (providers.length === 0) {
      return { success: false, data: null, error: 'No merchandise provider available' };
    }

    try {
      for (const provider of providers) {
        if (provider.getMerchandise) {
          const merchUrl = await provider.getMerchandise(decodeURIComponent(artistName));
          if (merchUrl) {
            return { success: true, data: merchUrl, source: provider.manifest.id };
          }
        }
      }
      return { success: true, data: null };
    } catch (error) {
      console.error('[Enrichment API] Merchandise error:', error);
      return reply.code(500).send({ success: false, error: 'Failed to fetch merchandise' });
    }
  });

  // ========================================
  // Genre & Mood Discovery
  // ========================================

  // Get available genres
  fastify.get('/api/discover/genres', async (_request: FastifyRequest, reply: FastifyReply) => {
    if (!orchestrators?.metadata?.getGenres) {
      // Return default genres if no provider
      return {
        genres: [
          { id: 'pop', name: 'Pop' },
          { id: 'rock', name: 'Rock' },
          { id: 'hip-hop', name: 'Hip Hop' },
          { id: 'r-n-b', name: 'R&B' },
          { id: 'electronic', name: 'Electronic' },
          { id: 'jazz', name: 'Jazz' },
          { id: 'classical', name: 'Classical' },
          { id: 'country', name: 'Country' },
          { id: 'latin', name: 'Latin' },
          { id: 'metal', name: 'Metal' }
        ]
      };
    }

    try {
      const genres = await orchestrators.metadata.getGenres();
      return { genres };
    } catch (error) {
      console.error('[Discover API] Genres error:', error);
      return reply.code(500).send({ error: 'Failed to fetch genres' });
    }
  });

  // Get tracks by genre
  fastify.get('/api/discover/genre/:genreId', async (request: FastifyRequest, reply: FastifyReply) => {
    const { genreId } = request.params as { genreId: string };
    const { limit } = request.query as { limit?: string };

    try {
      // Try to get genre-specific charts/tracks
      if (orchestrators?.metadata?.getGenreTracks) {
        const tracks = await orchestrators.metadata.getGenreTracks(genreId, parseInt(limit || '20', 10));
        return { tracks: tracks.map(transformTrack) };
      }

      // Fallback: search by genre name
      if (orchestrators?.search) {
        const result = await orchestrators.search.search(genreId.replace(/-/g, ' '), { limit: parseInt(limit || '20', 10) });
        return { tracks: (result.tracks || []).map(transformTrack) };
      }

      return reply.code(503).send({ error: 'Genre discovery not available' });
    } catch (error) {
      console.error('[Discover API] Genre tracks error:', error);
      return reply.code(500).send({ error: 'Failed to fetch genre tracks' });
    }
  });

  // Get radio/similar tracks based on a seed track
  fastify.get('/api/discover/radio/:trackId', async (request: FastifyRequest, reply: FastifyReply) => {
    const { trackId } = request.params as { trackId: string };
    const { limit } = request.query as { limit?: string };

    try {
      // Try ML service first
      if (orchestrators?.mlService?.getSimilarTracks) {
        const similar = await orchestrators.mlService.getSimilarTracks(trackId, parseInt(limit || '20', 10));
        if (similar && similar.length > 0) {
          return { tracks: similar.map(transformTrack), source: 'ml' };
        }
      }

      // Fallback to metadata provider radio
      if (orchestrators?.metadata?.getRadio) {
        const tracks = await orchestrators.metadata.getRadio(trackId, parseInt(limit || '20', 10));
        return { tracks: tracks.map(transformTrack), source: 'metadata' };
      }

      return reply.code(503).send({ error: 'Radio not available' });
    } catch (error) {
      console.error('[Discover API] Radio error:', error);
      return reply.code(500).send({ error: 'Failed to get radio tracks' });
    }
  });
}
