/**
 * API Routes for Mobile Portal
 *
 * Exposes endpoints similar to the desktop IPC handlers,
 * allowing mobile clients to search, control playback, and stream audio.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { AccessManager } from '../services/access-manager';
import type { SessionManager } from '../services/session-manager';

interface RouteContext {
  accessManager: AccessManager;
  sessionManager: SessionManager;
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
 * Transform track to have flat artwork
 */
function transformTrack(track: any): any {
  if (!track) return track;
  return {
    ...track,
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
  const { accessManager, sessionManager, orchestrators } = context;

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
    if (!access) {
      return { error: 'No active access configuration' };
    }

    return {
      localUrl: access.localUrl,
      p2pCode: access.p2pCode,
      relayCode: access.relayCode,
      createdAt: access.createdAt,
      expiresAt: access.expiresAt,
      hasRemoteAccess: !!access.p2pActive,
      relayActive: access.relayActive
    };
  });

  // ========================================
  // Enhanced Authentication (Device-based)
  // ========================================

  // One-time pairing via QR code (no password needed)
  // This may require desktop approval, so it can take up to 60 seconds
  fastify.post('/api/auth/pair', async (request: FastifyRequest, reply: FastifyReply) => {
    const { pairingCode, deviceName } = request.body as {
      pairingCode: string;
      deviceName?: string;
    };

    if (!pairingCode) {
      return reply.code(400).send({ success: false, error: 'Pairing code required' });
    }

    const userAgent = request.headers['user-agent'] || '';

    // Try to pair via accessManager (may return promise if approval required)
    const resultOrPromise = accessManager.consumePairingCode(pairingCode, userAgent);

    // Handle both sync and async results
    const result = resultOrPromise instanceof Promise ? await resultOrPromise : resultOrPromise;

    if (!result.success) {
      return reply.code(401).send({
        success: false,
        error: result.error || 'Invalid or expired pairing code',
        requiresApproval: result.requiresApproval
      });
    }

    // If we got a device token from the callback, return it
    if (result.deviceToken && result.deviceId) {
      console.log(`[Auth] Device paired via QR: ${deviceName || 'Unknown'}`);
      return {
        success: true,
        deviceToken: result.deviceToken,
        deviceId: result.deviceId,
        message: 'Device paired successfully'
      };
    }

    // Fallback: no device manager, create a session anyway
    return { success: true, message: 'Connected via pairing code' };
  });

  // Check if pairing code is valid (for UI feedback)
  fastify.get('/api/auth/pair/check', async (request: FastifyRequest, reply: FastifyReply) => {
    const { code } = request.query as { code: string };

    if (!code) {
      return reply.code(400).send({ valid: false });
    }

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

    if (!orchestrators?.authManager) {
      return reply.code(503).send({ success: false, error: 'Device auth not available' });
    }

    try {
      const result = orchestrators.authManager.validateDeviceToken(deviceToken);
      if (!result.valid) {
        return reply.code(401).send({ success: false, error: 'Invalid or expired device token' });
      }

      return { success: true, deviceId: result.deviceId };
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

    if (!orchestrators?.authManager) {
      return reply.code(503).send({ success: false, error: 'Auth service not available' });
    }

    try {
      const newToken = orchestrators.authManager.refreshDeviceToken(deviceId, token);
      if (!newToken) {
        return reply.code(401).send({ success: false, error: 'Invalid credentials' });
      }

      return {
        success: true,
        deviceToken: `${newToken.deviceId}:${newToken.token}`,
        expiresAt: newToken.expiresAt?.toISOString()
      };
    } catch (error) {
      console.error('Token refresh error:', error);
      return reply.code(500).send({ success: false, error: 'Refresh failed' });
    }
  });

  // Logout (revoke device token)
  fastify.post('/api/auth/logout', async (request: FastifyRequest, reply: FastifyReply) => {
    const { deviceId } = request.body as { deviceId?: string };

    if (!orchestrators?.authManager) {
      return { success: true }; // Nothing to do
    }

    try {
      if (deviceId) {
        orchestrators.authManager.revokeDevice(deviceId);
      }
      return { success: true };
    } catch (error) {
      console.error('Logout error:', error);
      return reply.code(500).send({ success: false, error: 'Logout failed' });
    }
  });

  // List authorized devices (desktop management)
  fastify.get('/api/auth/devices', async (_request: FastifyRequest, reply: FastifyReply) => {
    if (!orchestrators?.authManager) {
      return { devices: [] };
    }

    try {
      const devices = orchestrators.authManager.listDevices();
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

    if (!orchestrators?.authManager) {
      return reply.code(503).send({ error: 'Auth service not available' });
    }

    try {
      const success = orchestrators.authManager.revokeDevice(deviceId);
      return { success };
    } catch (error) {
      console.error('Revoke device error:', error);
      return reply.code(500).send({ error: 'Failed to revoke device' });
    }
  });

  // Get current passphrase (for display in desktop app)
  fastify.get('/api/auth/passphrase', async (_request: FastifyRequest, reply: FastifyReply) => {
    if (!orchestrators?.authManager) {
      // Return current token as fallback
      const access = accessManager.getCurrentAccess();
      return { passphrase: access?.token || '' };
    }

    try {
      const passphrase = orchestrators.authManager.getCurrentPassphrase();
      return { passphrase };
    } catch (error) {
      console.error('Get passphrase error:', error);
      return reply.code(500).send({ error: 'Failed to get passphrase' });
    }
  });

  // Generate new passphrase
  fastify.post('/api/auth/passphrase/regenerate', async (_request: FastifyRequest, reply: FastifyReply) => {
    if (!orchestrators?.authManager) {
      // Rotate legacy token
      const currentAccess = accessManager.getCurrentAccess();
      if (!currentAccess) {
        return reply.code(503).send({ error: 'No active access' });
      }

      const localBase = currentAccess.localUrl.split('?')[0] ?? '';
      const newAccess = await accessManager.rotateAccess(localBase);

      return { passphrase: newAccess.token };
    }

    try {
      const passphrase = orchestrators.authManager.regeneratePassphrase();
      return { passphrase };
    } catch (error) {
      console.error('Regenerate passphrase error:', error);
      return reply.code(500).send({ error: 'Failed to regenerate passphrase' });
    }
  });

  // Set custom password
  fastify.post('/api/auth/password', async (request: FastifyRequest, reply: FastifyReply) => {
    const { password } = request.body as { password: string };

    if (!password) {
      return reply.code(400).send({ error: 'Password required' });
    }

    if (!orchestrators?.authManager) {
      return reply.code(503).send({ error: 'Auth service not available' });
    }

    try {
      const result = orchestrators.authManager.setCustomPassword(password);
      if (!result.success) {
        return reply.code(400).send({ error: result.error });
      }
      return { success: true };
    } catch (error) {
      console.error('Set password error:', error);
      return reply.code(500).send({ error: 'Failed to set password' });
    }
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
      const tracks = orchestrators.libraryBridge.getLikedTracks();
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
      const tracks = orchestrators.libraryBridge.getDislikedTracks?.() || [];
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
      const playlists = orchestrators.libraryBridge.getPlaylists();
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

    const playlist = orchestrators.libraryBridge.getPlaylist(playlistId);
    if (!playlist) {
      return reply.code(404).send({ error: 'Playlist not found' });
    }

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
}
