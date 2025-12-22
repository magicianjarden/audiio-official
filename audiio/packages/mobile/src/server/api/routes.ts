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

      // Return specific type if requested
      switch (type) {
        case 'artist':
          return { artists: result.artists || [] };
        case 'album':
          return { albums: result.albums || [] };
        case 'track':
          return { tracks: result.tracks || [] };
        default:
          return result;
      }
    } catch (error) {
      console.error('Search error:', error);
      return reply.code(500).send({ error: 'Search failed' });
    }
  });

  fastify.get('/api/trending', async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      // Use metadata provider (Deezer) for charts/trending
      if (orchestrators?.metadata?.getCharts) {
        const charts = await orchestrators.metadata.getCharts(20);
        console.log(`[Mobile API] Trending: ${charts.tracks?.length || 0} tracks, ${charts.artists?.length || 0} artists, ${charts.albums?.length || 0} albums`);
        return {
          tracks: charts.tracks || [],
          artists: charts.artists || [],
          albums: charts.albums || []
        };
      }

      // Fallback to search if no metadata provider
      if (orchestrators?.search) {
        const result = await orchestrators.search.search('top hits 2024', { limit: 20 });
        return {
          tracks: result.tracks || [],
          artists: result.artists || [],
          albums: result.albums || []
        };
      }

      return reply.code(503).send({ error: 'Trending service not available' });
    } catch (error) {
      console.error('[Mobile API] Trending error:', error);
      return reply.code(500).send({ error: 'Failed to fetch trending content' });
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
  // Addons/Plugins Info (read-only)
  // ========================================

  fastify.get('/api/addons', async (_request: FastifyRequest, _reply: FastifyReply) => {
    if (!orchestrators?.registry) {
      return { addons: [] };
    }

    const addonIds = orchestrators.registry.getAllAddonIds();
    const addons = addonIds.map((id: string) => {
      const addon = orchestrators.registry.get(id);
      return {
        id,
        name: addon?.manifest?.name || id,
        roles: addon?.manifest?.roles || [],
        enabled: addon !== null
      };
    });

    return { addons };
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

    // Parse URLs to get base URLs without tokens
    const localBase = currentAccess.localUrl.split('?')[0] ?? '';
    const tunnelBase = currentAccess.tunnelUrl?.split('?')[0];

    const newAccess = await accessManager.rotateAccess(localBase, tunnelBase);

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
      tunnelUrl: access.tunnelUrl,
      createdAt: access.createdAt,
      expiresAt: access.expiresAt,
      hasRemoteAccess: !!access.tunnelUrl
    };
  });

  // ========================================
  // Enhanced Authentication (Device-based)
  // ========================================

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
      const tunnelBase = currentAccess.tunnelUrl?.split('?')[0];
      const newAccess = await accessManager.rotateAccess(localBase, tunnelBase);

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
