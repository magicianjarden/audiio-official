/**
 * Audiio Standalone Server
 *
 * A headless server that can run independently of the desktop app.
 * Owns its own orchestrators, plugins, and library database.
 *
 * Use cases:
 * - Docker deployment
 * - NAS/home server
 * - Cloud hosting
 */

import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import rateLimit from '@fastify/rate-limit';
import * as QRCode from 'qrcode';
import { networkInterfaces } from 'os';
import { readFileSync } from 'fs';
import { join } from 'path';

import {
  AddonRegistry,
  SearchOrchestrator,
  TrackResolver,
  PlaybackOrchestrator,
  MetadataOrchestrator
} from '@audiio/core';

import { ServerConfig } from './config';
import { PluginLoader } from './services/plugin-loader';
import { LibraryDatabase } from './services/library-db';
import { TrackingService } from './services/tracking-service';
import { StatsService } from './services/stats-service';
import { PluginRouter } from './services/plugin-router';
import { pluginRepositoryService } from './services/plugin-repository';
import { pluginInstaller } from './services/plugin-installer';
import { mlService } from './services/ml-service';
import { AuthService, initAuthService } from './services/auth-service';
import { DiscoveryService, initDiscoveryService } from './services/discovery-service';
import { registerAuthMiddleware } from './services/auth-middleware';
import { PathAuthorizationService, initPathAuthService } from './services/path-authorization';
import { initPluginSandbox, getPluginSandbox } from './services/plugin-sandbox';

export interface StandaloneServerOptions {
  config: ServerConfig;
  onReady?: (info: ServerInfo) => void;
}

export interface ServerInfo {
  localUrl: string;
  port: number;
  serverId: string;
  serverName: string;
  p2pCode?: string;
  qrCode?: string;
}

export class StandaloneServer {
  private fastify: FastifyInstance;
  private config: ServerConfig;
  private isRunning = false;

  // Core components (owned by this server)
  private registry: AddonRegistry;
  private searchOrchestrator: SearchOrchestrator;
  private trackResolver: TrackResolver;
  private playbackOrchestrator: PlaybackOrchestrator;
  private metadataOrchestrator: MetadataOrchestrator;
  private pluginLoader: PluginLoader;
  private libraryDb: LibraryDatabase;
  private trackingService: TrackingService;
  private statsService: StatsService;
  private pluginRouter!: PluginRouter;
  private authService: AuthService;
  private discoveryService: DiscoveryService | null = null;
  private pathAuthService: PathAuthorizationService;

  constructor(private options: StandaloneServerOptions) {
    this.config = options.config;
    this.fastify = Fastify({
      logger: this.config.logging.level === 'debug'
    });

    // Initialize core components
    this.registry = new AddonRegistry();
    this.searchOrchestrator = new SearchOrchestrator(this.registry);
    this.trackResolver = new TrackResolver(this.registry);
    this.playbackOrchestrator = new PlaybackOrchestrator(this.trackResolver);
    this.metadataOrchestrator = new MetadataOrchestrator(this.registry);

    // Initialize plugin loader
    this.pluginLoader = new PluginLoader(this.registry, {
      pluginsDir: this.config.plugins.directory
    });

    // Initialize library database
    this.libraryDb = new LibraryDatabase(this.config.storage.database);

    // Initialize tracking and stats services (uses same db connection)
    this.trackingService = new TrackingService((this.libraryDb as any).db);
    this.statsService = new StatsService((this.libraryDb as any).db);

    // Wire up ML service with tracking
    mlService.setTrackingService(this.trackingService);

    // Initialize auth service
    const { dirname, join } = require('path');
    const dataDir = dirname(this.config.storage.database);
    this.authService = initAuthService(dataDir, this.config.server.name || 'Audiio Server');

    // Initialize path authorization service
    const pathAuthDbPath = join(dataDir, 'path-auth.db');
    this.pathAuthService = initPathAuthService(pathAuthDbPath);

    // Initialize plugin sandbox with path authorization
    initPluginSandbox({
      dataDir: join(dataDir, 'plugins'),
      logExecution: this.config.logging.level === 'debug'
    });
  }

  /**
   * Start the server
   */
  async start(): Promise<ServerInfo> {
    if (this.isRunning) {
      throw new Error('Server is already running');
    }

    console.log('[Server] Starting Audiio Standalone Server...');

    // Load plugins
    if (this.config.plugins.autoload) {
      console.log('[Server] Loading plugins...');
      const results = await this.pluginLoader.loadAllPlugins();
      const loaded = results.filter(r => r.success).length;
      console.log(`[Server] Loaded ${loaded}/${results.length} plugins`);
    }

    // Register Fastify plugins
    await this.registerPlugins();

    // Initialize plugin router (must be after Fastify plugins)
    this.pluginRouter = new PluginRouter(this.fastify);
    this.pluginLoader.setPluginRouter(this.pluginRouter);

    // Register auth middleware (enforceAuth: false for development)
    registerAuthMiddleware(this.fastify, {
      enforceAuth: this.config.auth.requirePairing
    });

    // Register API routes
    await this.registerRoutes();

    // Start listening
    let actualPort = this.config.server.port;
    const maxAttempts = 10;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        await this.fastify.listen({
          port: actualPort,
          host: this.config.server.host
        });
        break;
      } catch (err: any) {
        if (err.code === 'EADDRINUSE' && attempt < maxAttempts - 1) {
          console.log(`[Server] Port ${actualPort} in use, trying ${actualPort + 1}...`);
          actualPort++;
        } else {
          throw err;
        }
      }
    }

    this.isRunning = true;

    // Generate server info
    const localIp = this.getLocalIP();
    const localUrl = `http://${localIp}:${actualPort}`;

    let qrCode: string | undefined;
    try {
      qrCode = await QRCode.toDataURL(localUrl, {
        width: 256,
        margin: 2,
        color: { dark: '#ffffff', light: '#00000000' },
        errorCorrectionLevel: 'M'
      });
    } catch {
      // QR generation failed
    }

    const identity = this.authService.getPublicIdentity();
    const info: ServerInfo = {
      localUrl,
      port: actualPort,
      serverId: identity.serverId,
      serverName: identity.serverName,
      qrCode
    };

    // Start local network discovery (mDNS)
    this.discoveryService = initDiscoveryService({
      port: actualPort,
      serverId: identity.serverId,
      serverName: identity.serverName,
      serverPublicKey: identity.publicKey
    });
    await this.discoveryService.startAdvertising();

    // Log startup info
    console.log('\n========================================');
    console.log('Audiio Standalone Server Ready!');
    console.log('========================================');
    console.log(`Server:   ${identity.serverName}`);
    console.log(`ID:       ${identity.serverId}`);
    console.log(`Local:    ${localUrl}`);
    console.log(`Host:     ${this.config.server.host}`);
    console.log(`Port:     ${actualPort}`);
    console.log(`Plugins:  ${this.pluginLoader.getLoadedPlugins().length} loaded`);
    console.log(`Database: ${this.config.storage.database}`);
    console.log(`mDNS:     ${this.discoveryService.isActive() ? 'advertising' : 'disabled'}`);
    console.log('========================================\n');

    // Print library stats
    const stats = this.libraryDb.getStats();
    console.log('[Library] Stats:', stats);

    this.options.onReady?.(info);

    return info;
  }

  /**
   * Stop the server
   */
  async stop(): Promise<void> {
    if (!this.isRunning) return;

    console.log('[Server] Stopping...');

    // Stop discovery first
    if (this.discoveryService) {
      await this.discoveryService.close();
    }

    await this.fastify.close();
    this.libraryDb.close();
    this.authService.close();
    this.isRunning = false;

    console.log('[Server] Stopped');
  }

  /**
   * Register Fastify plugins
   */
  private async registerPlugins(): Promise<void> {
    // CORS - allow all origins for dev
    await this.fastify.register(cors, {
      origin: '*',
      credentials: false,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
      allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Origin', 'X-Requested-With'],
      exposedHeaders: ['Content-Range', 'Accept-Ranges', 'Content-Length']
    });

    // Rate limiting
    await this.fastify.register(rateLimit, {
      max: 100,
      timeWindow: '1 minute'
    });

    // WebSocket
    await this.fastify.register(websocket);
  }

  /**
   * Register API routes
   */
  private async registerRoutes(): Promise<void> {
    // Health check
    this.fastify.get('/health', async () => ({
      status: 'ok',
      version: '0.1.0',
      uptime: process.uptime()
    }));

    // Admin UI - serve at /audiio and root
    const adminHtmlPath = join(__dirname, 'admin', 'index.html');
    let adminHtml: string;
    try {
      adminHtml = readFileSync(adminHtmlPath, 'utf-8');
    } catch {
      // Development fallback - try relative path
      try {
        adminHtml = readFileSync(join(__dirname, '..', 'src', 'admin', 'index.html'), 'utf-8');
      } catch {
        adminHtml = '<html><body><h1>Admin UI not found</h1></body></html>';
      }
    }

    this.fastify.get('/audiio', async (_, reply) => {
      reply.header('Content-Type', 'text/html');
      return adminHtml;
    });

    this.fastify.get('/audiio/*', async (_, reply) => {
      reply.header('Content-Type', 'text/html');
      return adminHtml;
    });

    // Serve admin at root as well (for when accessed directly)
    this.fastify.get('/', async (_, reply) => {
      reply.header('Content-Type', 'text/html');
      return adminHtml;
    });

    // Server info
    this.fastify.get('/api/info', async () => ({
      name: 'Audiio Server',
      version: '0.1.0',
      plugins: this.pluginLoader.getLoadedPlugins().map(p => ({
        id: p.manifest.id,
        name: p.manifest.name,
        version: p.manifest.version,
        roles: p.manifest.roles,
        enabled: this.registry.isEnabled(p.manifest.id)
      })),
      library: this.libraryDb.getStats()
    }));

    // Search
    this.fastify.get('/api/search', async (request) => {
      const { q, limit } = request.query as { q?: string; limit?: string };

      if (!q) {
        return { tracks: [], artists: [], albums: [] };
      }

      try {
        const results = await this.searchOrchestrator.search(
          q,
          { limit: parseInt(limit || '20', 10) }
        );
        return results;
      } catch (error) {
        console.error('[Search] Error:', error);
        return { tracks: [], artists: [], albums: [], error: 'Search failed' };
      }
    });

    // Stream resolution
    this.fastify.get('/api/stream/resolve', async (request, reply) => {
      const { trackId, title, artist, isrc } = request.query as {
        trackId?: string;
        title?: string;
        artist?: string;
        isrc?: string;
      };

      console.log('[Stream] Resolve request:', { trackId, title, artist, isrc });

      if (!trackId && !title) {
        return reply.code(400).send({ error: 'trackId or title required' });
      }

      try {
        // Build a proper track object for the resolver
        const track = {
          id: trackId || `stream:${Date.now()}`,
          title: title || '',
          artists: artist ? [{ id: 'unknown', name: artist }] : [],
          duration: 0,
          streamSources: [],
          _meta: {
            metadataProvider: 'stream-resolve',
            lastUpdated: new Date(),
            externalIds: isrc ? { isrc } : undefined
          }
        };

        console.log('[Stream] Calling trackResolver for:', track.title, 'by', track.artists[0]?.name);
        const stream = await this.trackResolver.resolveStream(track as any);

        if (!stream) {
          console.log('[Stream] No stream found');
          return reply.code(404).send({ error: 'No stream found' });
        }

        console.log('[Stream] Stream resolved:', stream.url?.slice(0, 50) + '...');

        // Return stream info with proxied URL
        const proxyUrl = `/api/stream/proxy?url=${encodeURIComponent(stream.url)}`;
        return {
          ...stream,
          url: proxyUrl, // Use proxy URL to bypass CORS
          originalUrl: stream.url
        };
      } catch (error) {
        console.error('[Stream] Error:', error);
        return reply.code(500).send({ error: 'Stream resolution failed' });
      }
    });

    // Stream proxy - bypasses CORS by proxying audio through the server
    this.fastify.get('/api/stream/proxy', async (request, reply) => {
      const { url } = request.query as { url?: string };

      if (!url) {
        return reply.code(400).send({ error: 'URL required' });
      }

      try {
        console.log('[StreamProxy] Proxying:', url.slice(0, 80) + '...');

        // Fetch the audio stream
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': '*/*',
            'Accept-Language': 'en-US,en;q=0.9',
            'Range': request.headers.range || 'bytes=0-'
          }
        });

        if (!response.ok && response.status !== 206) {
          console.error('[StreamProxy] Fetch failed:', response.status, response.statusText);
          return reply.code(response.status).send({ error: 'Stream fetch failed' });
        }

        // Forward relevant headers
        const contentType = response.headers.get('content-type');
        const contentLength = response.headers.get('content-length');
        const contentRange = response.headers.get('content-range');
        const acceptRanges = response.headers.get('accept-ranges');

        reply.header('Access-Control-Allow-Origin', '*');
        reply.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
        reply.header('Access-Control-Allow-Headers', 'Range');
        reply.header('Access-Control-Expose-Headers', 'Content-Range, Accept-Ranges, Content-Length');

        if (contentType) reply.header('Content-Type', contentType);
        if (contentLength) reply.header('Content-Length', contentLength);
        if (contentRange) reply.header('Content-Range', contentRange);
        if (acceptRanges) reply.header('Accept-Ranges', acceptRanges);

        // Set appropriate status code
        reply.code(response.status === 206 ? 206 : 200);

        // Stream the response body
        if (response.body) {
          return reply.send(response.body);
        } else {
          // Fallback for environments without streaming
          const buffer = await response.arrayBuffer();
          return reply.send(Buffer.from(buffer));
        }
      } catch (error) {
        console.error('[StreamProxy] Error:', error);
        return reply.code(500).send({ error: 'Stream proxy failed' });
      }
    });

    // Trending/Charts
    this.fastify.get('/api/trending', async () => {
      try {
        return await this.metadataOrchestrator.getCharts();
      } catch (error) {
        console.error('[Trending] Error:', error);
        return { tracks: [], albums: [], artists: [] };
      }
    });

    // Artist details
    this.fastify.get('/api/artist/:artistId', async (request, reply) => {
      const { artistId } = request.params as { artistId: string };

      try {
        const artist = await this.metadataOrchestrator.getArtist(artistId);
        if (!artist) {
          return reply.code(404).send({ error: 'Artist not found' });
        }
        return artist;
      } catch (error) {
        console.error('[Artist] Error:', error);
        return reply.code(500).send({ error: 'Failed to get artist' });
      }
    });

    // Album details
    this.fastify.get('/api/album/:albumId', async (request, reply) => {
      const { albumId } = request.params as { albumId: string };

      try {
        const album = await this.metadataOrchestrator.getAlbum(albumId);
        if (!album) {
          return reply.code(404).send({ error: 'Album not found' });
        }
        return album;
      } catch (error) {
        console.error('[Album] Error:', error);
        return reply.code(500).send({ error: 'Failed to get album' });
      }
    });

    // Library: Liked tracks
    this.fastify.get('/api/library/likes', async () => {
      return {
        tracks: this.libraryDb.getLikedTracks(),
        synced: true
      };
    });

    this.fastify.post('/api/library/likes', async (request) => {
      const { track } = request.body as { track: any };
      if (!track) {
        return { success: false, error: 'Track required' };
      }
      this.libraryDb.likeTrack(track);
      return { success: true };
    });

    this.fastify.delete('/api/library/likes/:trackId', async (request) => {
      const { trackId } = request.params as { trackId: string };
      this.libraryDb.unlikeTrack(trackId);
      return { success: true };
    });

    this.fastify.get('/api/library/likes/:trackId', async (request) => {
      const { trackId } = request.params as { trackId: string };
      return { liked: this.libraryDb.isTrackLiked(trackId), synced: true };
    });

    // Library: Disliked tracks
    this.fastify.get('/api/library/dislikes', async () => {
      return {
        tracks: this.libraryDb.getDislikedTracks(),
        synced: true
      };
    });

    this.fastify.post('/api/library/dislikes', async (request) => {
      const { track, reasons } = request.body as { track: any; reasons?: string[] };
      if (!track) {
        return { success: false, error: 'Track required' };
      }
      this.libraryDb.dislikeTrack(track, reasons || []);
      return { success: true };
    });

    this.fastify.delete('/api/library/dislikes/:trackId', async (request) => {
      const { trackId } = request.params as { trackId: string };
      this.libraryDb.removeDislike(trackId);
      return { success: true };
    });

    // Library: Playlists
    this.fastify.get('/api/library/playlists', async () => {
      return {
        playlists: this.libraryDb.getPlaylists(),
        synced: true
      };
    });

    this.fastify.get('/api/library/playlists/:playlistId', async (request, reply) => {
      const { playlistId } = request.params as { playlistId: string };
      const playlist = this.libraryDb.getPlaylist(playlistId);
      if (!playlist) {
        return reply.code(404).send({ error: 'Playlist not found' });
      }
      return playlist;
    });

    this.fastify.post('/api/library/playlists', async (request) => {
      const { name, description } = request.body as { name: string; description?: string };
      if (!name) {
        return { success: false, error: 'Name required' };
      }
      const playlist = this.libraryDb.createPlaylist(name, description);
      return { success: true, playlist };
    });

    this.fastify.delete('/api/library/playlists/:playlistId', async (request) => {
      const { playlistId } = request.params as { playlistId: string };
      this.libraryDb.deletePlaylist(playlistId);
      return { success: true };
    });

    this.fastify.put('/api/library/playlists/:playlistId', async (request) => {
      const { playlistId } = request.params as { playlistId: string };
      const { name } = request.body as { name: string };
      if (!name) {
        return { success: false, error: 'Name required' };
      }
      this.libraryDb.renamePlaylist(playlistId, name);
      return { success: true };
    });

    this.fastify.post('/api/library/playlists/:playlistId/tracks', async (request) => {
      const { playlistId } = request.params as { playlistId: string };
      const { track } = request.body as { track: any };
      if (!track) {
        return { success: false, error: 'Track required' };
      }
      this.libraryDb.addToPlaylist(playlistId, track);
      return { success: true };
    });

    this.fastify.delete('/api/library/playlists/:playlistId/tracks/:trackId', async (request) => {
      const { playlistId, trackId } = request.params as { playlistId: string; trackId: string };
      this.libraryDb.removeFromPlaylist(playlistId, trackId);
      return { success: true };
    });

    // Recommendations
    this.fastify.get('/api/discover', async (request) => {
      const { limit } = request.query as { limit?: string };
      const l = parseInt(limit || '10', 10);

      return {
        recentlyPlayed: this.libraryDb.getRecentlyPlayed(l),
        quickPicks: this.libraryDb.getQuickPicks(l),
        forYou: this.libraryDb.getForYou(l),
        mixes: this.libraryDb.getMixes(6)
      };
    });

    // Record play (for recommendations)
    this.fastify.post('/api/library/history', async (request) => {
      const { track, duration } = request.body as { track: any; duration?: number };
      if (!track) {
        return { success: false, error: 'Track required' };
      }
      this.libraryDb.recordPlay(track, duration || 0);
      return { success: true };
    });

    // Addons/Plugins - List loaded
    this.fastify.get('/api/addons', async () => {
      return {
        addons: this.pluginLoader.getLoadedPlugins().map(p => ({
          id: p.manifest.id,
          name: p.manifest.name,
          version: p.manifest.version,
          description: p.manifest.description,
          roles: p.manifest.roles,
          source: p.source
        }))
      };
    });

    // Plugin enable/disable
    this.fastify.post('/api/addons/:addonId/enabled', async (request, reply) => {
      const { addonId } = request.params as { addonId: string };
      const { enabled } = request.body as { enabled: boolean };

      if (typeof enabled !== 'boolean') {
        return reply.code(400).send({ error: 'enabled (boolean) required' });
      }

      this.registry.setEnabled(addonId, enabled);
      return { success: true, addonId, enabled };
    });

    // Plugin settings
    this.fastify.get('/api/addons/:addonId/settings', async (request, reply) => {
      const { addonId } = request.params as { addonId: string };
      const addon = this.registry.get(addonId) as any;

      if (!addon) {
        return reply.code(404).send({ error: 'Addon not found' });
      }

      if (!addon.getSettings) {
        return { settings: null };
      }

      return { settings: addon.getSettings() };
    });

    this.fastify.post('/api/addons/:addonId/settings', async (request, reply) => {
      const { addonId } = request.params as { addonId: string };
      const { settings } = request.body as { settings: Record<string, unknown> };

      const addon = this.registry.get(addonId) as any;
      if (!addon) {
        return reply.code(404).send({ error: 'Addon not found' });
      }

      if (!addon.updateSettings) {
        return reply.code(400).send({ error: 'Addon does not support settings' });
      }

      addon.updateSettings(settings);
      return { success: true };
    });

    // ========================================
    // Plugin Repositories
    // ========================================

    this.fastify.get('/api/plugins/repositories', async () => {
      return { repositories: pluginRepositoryService.getRepositories() };
    });

    this.fastify.post('/api/plugins/repositories', async (request, reply) => {
      const { url } = request.body as { url: string };
      if (!url) {
        return reply.code(400).send({ error: 'URL required' });
      }

      const result = await pluginRepositoryService.addRepository(url);
      if (!result.success) {
        return reply.code(400).send({ error: result.error });
      }

      return result;
    });

    this.fastify.delete('/api/plugins/repositories/:repoId', async (request) => {
      const { repoId } = request.params as { repoId: string };
      const success = pluginRepositoryService.removeRepository(repoId);
      return { success };
    });

    this.fastify.post('/api/plugins/repositories/:repoId/refresh', async (request) => {
      const { repoId } = request.params as { repoId: string };
      return await pluginRepositoryService.refreshRepository(repoId);
    });

    // Available plugins from repositories
    this.fastify.get('/api/plugins/available', async () => {
      const plugins = await pluginRepositoryService.getAvailablePlugins();
      return { plugins };
    });

    this.fastify.get('/api/plugins/search', async (request) => {
      const { q } = request.query as { q?: string };
      if (!q) {
        return { plugins: [] };
      }
      const plugins = await pluginRepositoryService.searchPlugins(q);
      return { plugins };
    });

    // Plugin installation
    this.fastify.post('/api/plugins/install', async (request, reply) => {
      const { downloadUrl } = request.body as { downloadUrl: string };

      if (!downloadUrl) {
        return reply.code(400).send({ error: 'downloadUrl required' });
      }

      try {
        const result = await pluginInstaller.install(downloadUrl);
        if (!result.success) {
          return reply.code(400).send({ error: result.error });
        }

        // Reload plugins to pick up the newly installed one
        await this.pluginLoader.reloadPlugins();

        return result;
      } catch (error) {
        console.error('[Plugin Install] Error:', error);
        return reply.code(500).send({ error: 'Installation failed' });
      }
    });

    this.fastify.post('/api/plugins/:pluginId/uninstall', async (request, reply) => {
      const { pluginId } = request.params as { pluginId: string };

      try {
        // Unload from loader first
        await this.pluginLoader.unloadPlugin(pluginId);

        // Then remove files
        const result = await pluginInstaller.uninstall(pluginId);
        return result;
      } catch (error) {
        console.error('[Plugin Uninstall] Error:', error);
        return reply.code(500).send({ error: 'Uninstall failed' });
      }
    });

    this.fastify.get('/api/plugins/updates', async () => {
      const installed = this.pluginLoader.getLoadedPlugins().map(p => ({
        id: p.manifest.id,
        version: p.manifest.version
      }));

      const updates = await pluginRepositoryService.checkUpdates(installed);
      return { updates };
    });

    // Plugin routes - list all registered plugin routes
    this.fastify.get('/api/plugins/routes', async () => {
      return { routes: this.pluginRouter.getAllRoutes() };
    });

    this.fastify.get('/api/plugins/:pluginId/routes', async (request) => {
      const { pluginId } = request.params as { pluginId: string };
      return { routes: this.pluginRouter.getPluginRoutes(pluginId) };
    });

    // ========================================
    // ML/Algorithm Routes
    // ========================================

    this.fastify.get('/api/algo/status', async () => {
      return {
        available: mlService.isAlgorithmLoaded(),
        initialized: mlService.isInitialized(),
        training: mlService.getTrainingStatus()
      };
    });

    this.fastify.get('/api/algo/recommendations', async (request, reply) => {
      const { count } = request.query as { count?: string };
      const limit = parseInt(count || '20', 10);

      if (!mlService.isAlgorithmLoaded()) {
        return reply.code(503).send({ error: 'Algorithm not loaded' });
      }

      try {
        const recommendations = await mlService.getRecommendations({ count: limit });
        return { recommendations };
      } catch (error) {
        console.error('[ML] Recommendations error:', error);
        return reply.code(500).send({ error: 'Failed to get recommendations' });
      }
    });

    this.fastify.get('/api/algo/similar/:trackId', async (request, reply) => {
      const { trackId } = request.params as { trackId: string };
      const { count } = request.query as { count?: string };
      const limit = parseInt(count || '10', 10);

      if (!mlService.isAlgorithmLoaded()) {
        return reply.code(503).send({ error: 'Algorithm not loaded' });
      }

      try {
        const tracks = await mlService.getSimilarTracks(trackId, limit);
        return { tracks };
      } catch (error) {
        console.error('[ML] Similar tracks error:', error);
        return reply.code(500).send({ error: 'Failed to get similar tracks' });
      }
    });

    this.fastify.post('/api/algo/event', async (request, reply) => {
      const event = request.body as any;

      if (!event?.type || !event?.track) {
        return reply.code(400).send({ error: 'type and track required' });
      }

      try {
        await mlService.recordEvent({
          ...event,
          timestamp: Date.now()
        });
        return { success: true };
      } catch (error) {
        console.error('[ML] Record event error:', error);
        return reply.code(500).send({ error: 'Failed to record event' });
      }
    });

    this.fastify.get('/api/algo/features/:trackId', async (request, reply) => {
      const { trackId } = request.params as { trackId: string };

      try {
        const features = await mlService.getAudioFeatures(trackId);
        if (!features) {
          return reply.code(404).send({ error: 'Features not available' });
        }
        return { features };
      } catch (error) {
        console.error('[ML] Features error:', error);
        return reply.code(500).send({ error: 'Failed to get features' });
      }
    });

    this.fastify.post('/api/algo/train', async (request, reply) => {
      try {
        const result = await mlService.train({ type: 'manual' });
        return { success: true, result };
      } catch (error) {
        console.error('[ML] Training error:', error);
        return reply.code(500).send({ error: 'Training failed' });
      }
    });

    // ML Training Status
    this.fastify.get('/api/algo/training/status', async () => {
      return {
        status: mlService.getTrainingStatus(),
        mlStatus: mlService.getStatus()
      };
    });

    this.fastify.get('/api/algo/training/history', async () => {
      return await mlService.getTrainingHistory();
    });

    // ML User Profile
    this.fastify.get('/api/algo/profile', async () => {
      return await mlService.getUserProfile();
    });

    this.fastify.post('/api/algo/preferences', async (request) => {
      const prefs = request.body as { explorationLevel?: number; diversityWeight?: number };
      await mlService.updatePreferences(prefs);
      return { success: true };
    });

    // ML Radio Generation
    this.fastify.get('/api/algo/radio/track/:trackId', async (request) => {
      const { trackId } = request.params as { trackId: string };
      const { count } = request.query as { count?: string };
      const tracks = await mlService.generateTrackRadio(trackId, parseInt(count || '50', 10));
      return { tracks };
    });

    this.fastify.get('/api/algo/radio/artist/:artistId', async (request) => {
      const { artistId } = request.params as { artistId: string };
      const { count } = request.query as { count?: string };
      const tracks = await mlService.generateArtistRadio(artistId, parseInt(count || '50', 10));
      return { tracks };
    });

    this.fastify.get('/api/algo/radio/genre/:genre', async (request) => {
      const { genre } = request.params as { genre: string };
      const { count } = request.query as { count?: string };
      const tracks = await mlService.generateGenreRadio(decodeURIComponent(genre), parseInt(count || '50', 10));
      return { tracks };
    });

    this.fastify.get('/api/algo/radio/mood/:mood', async (request) => {
      const { mood } = request.params as { mood: string };
      const { count } = request.query as { count?: string };
      const tracks = await mlService.generateMoodRadio(decodeURIComponent(mood), parseInt(count || '50', 10));
      return { tracks };
    });

    // ML Scoring
    this.fastify.get('/api/algo/score/:trackId', async (request) => {
      const { trackId } = request.params as { trackId: string };
      const score = await mlService.scoreTrack(trackId);
      return { score };
    });

    this.fastify.post('/api/algo/score/batch', async (request) => {
      const { trackIds } = request.body as { trackIds: string[] };
      const scores = await mlService.scoreBatch(trackIds || []);
      return { scores };
    });

    // ML Queue Candidates
    this.fastify.post('/api/algo/queue/next', async (request) => {
      const { count, currentTrackId, recentTrackIds, recentArtists, enforceVariety } = request.body as {
        count?: number;
        currentTrackId?: string;
        recentTrackIds?: string[];
        recentArtists?: string[];
        enforceVariety?: boolean;
      };

      const tracks = await mlService.getNextQueueCandidates(count || 10, {
        currentTrackId,
        recentTrackIds: recentTrackIds || [],
        recentArtists: recentArtists || [],
        enforceVariety
      });

      return { tracks };
    });

    // ML Embeddings
    this.fastify.get('/api/algo/embedding/:trackId', async (request, reply) => {
      const { trackId } = request.params as { trackId: string };
      const embedding = await mlService.getTrackEmbedding(trackId);
      if (!embedding) {
        return reply.code(404).send({ error: 'Embedding not found' });
      }
      return { embedding };
    });

    this.fastify.post('/api/algo/embedding/similar', async (request) => {
      const { embedding, count } = request.body as { embedding: number[]; count?: number };
      const similar = await mlService.findSimilarByEmbedding(embedding || [], count || 10);
      return { tracks: similar };
    });

    // ========================================
    // Tracking Routes
    // ========================================

    // Record single event
    this.fastify.post('/api/tracking/event', async (request) => {
      const event = request.body as any;

      if (!event?.type || !event?.sessionId) {
        return { success: false, error: 'type and sessionId required' };
      }

      this.trackingService.recordEvent({
        ...event,
        timestamp: event.timestamp || Date.now()
      });

      return { success: true };
    });

    // Record batch of events
    this.fastify.post('/api/tracking/batch', async (request) => {
      const { events } = request.body as { events: any[] };

      if (!events || !Array.isArray(events)) {
        return { success: false, error: 'events array required' };
      }

      this.trackingService.recordBatch(events);
      return { success: true, count: events.length };
    });

    // Session management
    this.fastify.post('/api/tracking/session', async (request) => {
      const { deviceId, deviceType, deviceName } = request.body as {
        deviceId?: string;
        deviceType?: string;
        deviceName?: string;
      };

      const session = this.trackingService.startSession(deviceId, deviceType, deviceName);
      return { session };
    });

    this.fastify.post('/api/tracking/session/:sessionId/end', async (request) => {
      const { sessionId } = request.params as { sessionId: string };
      const summary = this.trackingService.endSession(sessionId);
      return { summary };
    });

    this.fastify.get('/api/tracking/session/:sessionId', async (request) => {
      const { sessionId } = request.params as { sessionId: string };
      const summary = this.trackingService.getSessionSummary(sessionId);
      return { summary };
    });

    // Get recent sessions
    this.fastify.get('/api/tracking/sessions', async (request) => {
      const { limit } = request.query as { limit?: string };
      const sessions = this.trackingService.getSessions(parseInt(limit || '10', 10));
      return { sessions };
    });

    // Get events
    this.fastify.get('/api/tracking/events', async (request) => {
      const { startTime, endTime, types, sessionId, trackId, limit, offset } = request.query as {
        startTime?: string;
        endTime?: string;
        types?: string;
        sessionId?: string;
        trackId?: string;
        limit?: string;
        offset?: string;
      };

      const events = this.trackingService.getEvents({
        startTime: startTime ? parseInt(startTime, 10) : undefined,
        endTime: endTime ? parseInt(endTime, 10) : undefined,
        types: types ? types.split(',') as any : undefined,
        sessionId,
        trackId,
        limit: limit ? parseInt(limit, 10) : 100,
        offset: offset ? parseInt(offset, 10) : undefined
      });

      return { events };
    });

    // ========================================
    // Stats Routes
    // ========================================

    // Overview stats
    this.fastify.get('/api/stats/overview', async () => {
      return this.statsService.getOverview();
    });

    // Listening stats by period
    this.fastify.get('/api/stats/listening', async (request) => {
      const { period } = request.query as { period?: 'day' | 'week' | 'month' | 'year' | 'all' };
      return this.statsService.getListeningStats(period || 'week');
    });

    // Top items
    this.fastify.get('/api/stats/top/artists', async (request) => {
      const { limit, period } = request.query as { limit?: string; period?: 'week' | 'month' | 'year' | 'all' };
      return { artists: this.statsService.getTopArtists(parseInt(limit || '10', 10), period) };
    });

    this.fastify.get('/api/stats/top/tracks', async (request) => {
      const { limit, period } = request.query as { limit?: string; period?: 'week' | 'month' | 'year' | 'all' };
      return { tracks: this.statsService.getTopTracks(parseInt(limit || '10', 10), period) };
    });

    this.fastify.get('/api/stats/top/genres', async (request) => {
      const { limit, period } = request.query as { limit?: string; period?: 'week' | 'month' | 'year' | 'all' };
      return { genres: this.statsService.getTopGenres(parseInt(limit || '10', 10), period) };
    });

    this.fastify.get('/api/stats/top/albums', async (request) => {
      const { limit, period } = request.query as { limit?: string; period?: 'week' | 'month' | 'year' | 'all' };
      return { albums: this.statsService.getTopAlbums(parseInt(limit || '10', 10), period) };
    });

    // Listening patterns
    this.fastify.get('/api/stats/patterns', async () => {
      return this.statsService.getListeningPatterns();
    });

    // Streaks
    this.fastify.get('/api/stats/streaks', async () => {
      return this.statsService.getStreaks();
    });

    // Refresh stats
    this.fastify.post('/api/stats/refresh', async () => {
      this.statsService.refreshAggregates();
      return { success: true };
    });

    // ========================================
    // Lyrics Routes
    // ========================================

    this.fastify.get('/api/lyrics', async (request, reply) => {
      const { title, artist, album, duration } = request.query as {
        title?: string;
        artist?: string;
        album?: string;
        duration?: string;
      };

      if (!title || !artist) {
        return reply.code(400).send({ error: 'title and artist required' });
      }

      // Get lyrics providers from registry
      const lyricsProviders = (this.registry as any).getLyricsProviders?.() || [];
      if (lyricsProviders.length === 0) {
        return reply.code(503).send({ error: 'No lyrics provider available' });
      }

      try {
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
            continue;
          }
        }
        return reply.code(404).send({ error: 'No lyrics found' });
      } catch (error) {
        console.error('[Lyrics] Error:', error);
        return reply.code(500).send({ error: 'Failed to fetch lyrics' });
      }
    });

    // ========================================
    // Artist Enrichment Routes
    // ========================================

    this.fastify.get('/api/enrichment/types', async () => {
      const types = (this.registry as any).getAvailableEnrichmentTypes?.() || [];
      return { types };
    });

    this.fastify.get('/api/enrichment/videos/:artistName', async (request, reply) => {
      const { artistName } = request.params as { artistName: string };
      const { limit } = request.query as { limit?: string };

      const providers = (this.registry as any).getArtistEnrichmentProvidersByType?.('videos') || [];
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
        console.error('[Enrichment] Videos error:', error);
        return reply.code(500).send({ success: false, error: 'Failed to fetch videos' });
      }
    });

    this.fastify.get('/api/enrichment/timeline/:artistName', async (request, reply) => {
      const { artistName } = request.params as { artistName: string };

      const providers = (this.registry as any).getArtistEnrichmentProvidersByType?.('timeline') || [];
      if (providers.length === 0) {
        return { success: false, data: [], error: 'No timeline provider' };
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
        console.error('[Enrichment] Timeline error:', error);
        return reply.code(500).send({ success: false, error: 'Failed to fetch timeline' });
      }
    });

    this.fastify.get('/api/enrichment/setlists/:artistName', async (request, reply) => {
      const { artistName } = request.params as { artistName: string };
      const { mbid, limit } = request.query as { mbid?: string; limit?: string };

      const providers = (this.registry as any).getArtistEnrichmentProvidersByType?.('setlists') || [];
      if (providers.length === 0) {
        return { success: false, data: [], error: 'No setlist provider' };
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
        console.error('[Enrichment] Setlists error:', error);
        return reply.code(500).send({ success: false, error: 'Failed to fetch setlists' });
      }
    });

    this.fastify.get('/api/enrichment/concerts/:artistName', async (request, reply) => {
      const { artistName } = request.params as { artistName: string };

      const providers = (this.registry as any).getArtistEnrichmentProvidersByType?.('concerts') || [];
      if (providers.length === 0) {
        return { success: false, data: [], error: 'No concert provider' };
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
        console.error('[Enrichment] Concerts error:', error);
        return reply.code(500).send({ success: false, error: 'Failed to fetch concerts' });
      }
    });

    this.fastify.get('/api/enrichment/gallery/:artistName', async (request, reply) => {
      const { artistName } = request.params as { artistName: string };
      const { mbid } = request.query as { mbid?: string };

      const providers = (this.registry as any).getArtistEnrichmentProvidersByType?.('gallery') || [];
      if (providers.length === 0) {
        return { success: false, data: null, error: 'No gallery provider' };
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
        console.error('[Enrichment] Gallery error:', error);
        return reply.code(500).send({ success: false, error: 'Failed to fetch gallery' });
      }
    });

    this.fastify.get('/api/enrichment/merchandise/:artistName', async (request, reply) => {
      const { artistName } = request.params as { artistName: string };

      const providers = (this.registry as any).getArtistEnrichmentProvidersByType?.('merchandise') || [];
      if (providers.length === 0) {
        return { success: false, data: null, error: 'No merchandise provider' };
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
        console.error('[Enrichment] Merchandise error:', error);
        return reply.code(500).send({ success: false, error: 'Failed to fetch merchandise' });
      }
    });

    // ========================================
    // Genre Discovery Routes
    // ========================================

    this.fastify.get('/api/discover/genres', async () => {
      if ((this.metadataOrchestrator as any).getGenres) {
        try {
          const genres = await (this.metadataOrchestrator as any).getGenres();
          return { genres };
        } catch {
          // Fall through to defaults
        }
      }

      // Default genres
      return {
        genres: [
          { id: 'pop', name: 'Pop' },
          { id: 'rock', name: 'Rock' },
          { id: 'hip-hop', name: 'Hip Hop' },
          { id: 'r-n-b', name: 'R&B' },
          { id: 'electronic', name: 'Electronic' },
          { id: 'jazz', name: 'Jazz' },
          { id: 'classical', name: 'Classical' },
          { id: 'country', name: 'Country' }
        ]
      };
    });

    this.fastify.get('/api/discover/genre/:genreId', async (request, reply) => {
      const { genreId } = request.params as { genreId: string };
      const { limit } = request.query as { limit?: string };

      try {
        if ((this.metadataOrchestrator as any).getGenreTracks) {
          const tracks = await (this.metadataOrchestrator as any).getGenreTracks(genreId, parseInt(limit || '20', 10));
          return { tracks };
        }

        // Fallback: search by genre name
        const result = await this.searchOrchestrator.search(genreId.replace(/-/g, ' '), { limit: parseInt(limit || '20', 10) });
        return { tracks: result.tracks || [] };
      } catch (error) {
        console.error('[Discover] Genre tracks error:', error);
        return reply.code(500).send({ error: 'Failed to fetch genre tracks' });
      }
    });

    this.fastify.get('/api/discover/radio/:trackId', async (request, reply) => {
      const { trackId } = request.params as { trackId: string };
      const { limit } = request.query as { limit?: string };

      try {
        // Try ML service first
        if (mlService.isAlgorithmLoaded()) {
          const similar = await mlService.getSimilarTracks(trackId, parseInt(limit || '20', 10));
          if (similar && similar.length > 0) {
            return { tracks: similar, source: 'ml' };
          }
        }

        // Fallback to metadata provider
        if ((this.metadataOrchestrator as any).getRadio) {
          const tracks = await (this.metadataOrchestrator as any).getRadio(trackId, parseInt(limit || '20', 10));
          return { tracks, source: 'metadata' };
        }

        return reply.code(503).send({ error: 'Radio not available' });
      } catch (error) {
        console.error('[Discover] Radio error:', error);
        return reply.code(500).send({ error: 'Failed to get radio tracks' });
      }
    });

    // ========================================
    // Discover Sections (for mobile home page)
    // ========================================

    this.fastify.get('/api/discover/sections', async () => {
      const sections: any[] = [];

      // Recently played
      const recentlyPlayed = this.libraryDb.getRecentlyPlayed(10);
      if (recentlyPlayed.length > 0) {
        sections.push({
          id: 'recently-played',
          type: 'recently-played',
          title: 'Recently Played',
          subtitle: 'Pick up where you left off',
          tracks: recentlyPlayed
        });
      }

      // Quick picks
      const quickPicks = this.libraryDb.getQuickPicks(10);
      if (quickPicks.length > 0) {
        sections.push({
          id: 'quick-picks',
          type: 'quick-picks',
          title: 'Quick Picks',
          subtitle: 'Based on your listening',
          tracks: quickPicks
        });
      }

      // For You
      const forYou = this.libraryDb.getForYou(12);
      if (forYou.length > 0) {
        sections.push({
          id: 'for-you',
          type: 'recommended',
          title: 'For You',
          subtitle: 'Personalized picks',
          tracks: forYou
        });
      }

      // ML recommendations
      if (mlService.isAlgorithmLoaded()) {
        try {
          const recommendations = await mlService.getRecommendations({ count: 12 });
          if (recommendations.length > 0) {
            sections.push({
              id: 'ml-recommendations',
              type: 'ml-powered',
              title: 'Discover Weekly',
              subtitle: 'AI-curated for you',
              tracks: recommendations,
              isPluginPowered: true
            });
          }
        } catch {
          // Skip ML section
        }
      }

      // Trending
      try {
        const charts = await this.metadataOrchestrator.getCharts();
        if (charts.tracks && charts.tracks.length > 0) {
          sections.push({
            id: 'trending',
            type: 'trending',
            title: 'Trending Now',
            subtitle: "What's hot",
            tracks: charts.tracks.slice(0, 12)
          });
        }
        if (charts.artists && charts.artists.length > 0) {
          sections.push({
            id: 'popular-artists',
            type: 'artists',
            title: 'Popular Artists',
            artists: charts.artists.slice(0, 10)
          });
        }
      } catch {
        // Skip trending
      }

      // Genre browse
      sections.push({
        id: 'browse-genres',
        type: 'genres',
        title: 'Browse by Genre',
        genres: [
          { id: 'pop', name: 'Pop', color: '#E91E63' },
          { id: 'rock', name: 'Rock', color: '#F44336' },
          { id: 'hip-hop', name: 'Hip Hop', color: '#9C27B0' },
          { id: 'electronic', name: 'Electronic', color: '#3F51B5' }
        ]
      });

      return { sections };
    });

    // ========================================
    // Authentication Routes
    // ========================================

    // Get server identity (public info)
    this.fastify.get('/api/auth/identity', async () => {
      return this.authService.getPublicIdentity();
    });

    // Generate pairing token + QR data
    this.fastify.post('/api/auth/pairing-token', async (request) => {
      const { relayUrl } = request.body as { relayUrl?: string };
      const localUrl = `http://${this.getLocalIP()}:${this.config.server.port}`;

      const { token, qrData } = this.authService.createPairingToken({
        localUrl,
        relayUrl
      });

      return {
        token: token.token,
        expiresAt: token.expiresAt,
        qrData,
        // Also include JSON string for easy QR generation
        qrString: JSON.stringify(qrData)
      };
    });

    // Complete device pairing
    this.fastify.post('/api/auth/pair', async (request, reply) => {
      const { pairingToken, deviceId, devicePublicKey, deviceName, deviceType } = request.body as {
        pairingToken: string;
        deviceId: string;
        devicePublicKey: string;
        deviceName: string;
        deviceType?: 'mobile' | 'desktop' | 'web';
      };

      if (!pairingToken || !deviceId || !devicePublicKey || !deviceName) {
        return reply.code(400).send({ error: 'Missing required fields' });
      }

      const ip = request.ip;
      const result = this.authService.pairDevice({
        pairingToken,
        deviceId,
        devicePublicKey,
        deviceName,
        deviceType,
        ip
      });

      if (!result.success) {
        return reply.code(400).send({ error: result.error });
      }

      return {
        success: true,
        sessionToken: result.sessionToken,
        server: this.authService.getPublicIdentity()
      };
    });

    // Request auth challenge
    this.fastify.post('/api/auth/challenge', async (request, reply) => {
      const { deviceId } = request.body as { deviceId: string };

      if (!deviceId) {
        return reply.code(400).send({ error: 'deviceId required' });
      }

      const result = this.authService.createChallenge(deviceId);
      if (!result.success) {
        return reply.code(401).send({ error: result.error });
      }

      return {
        challenge: result.challenge,
        server: this.authService.getPublicIdentity()
      };
    });

    // Verify challenge signature
    this.fastify.post('/api/auth/verify', async (request, reply) => {
      const { deviceId, signature } = request.body as {
        deviceId: string;
        signature: string;
      };

      if (!deviceId || !signature) {
        return reply.code(400).send({ error: 'deviceId and signature required' });
      }

      const ip = request.ip;
      const result = this.authService.verifyChallenge({ deviceId, signature, ip });

      if (!result.success) {
        return reply.code(401).send({ error: result.error });
      }

      return {
        success: true,
        sessionToken: result.sessionToken
      };
    });

    // Validate session token
    this.fastify.post('/api/auth/validate', async (request, reply) => {
      const { sessionToken } = request.body as { sessionToken: string };

      if (!sessionToken) {
        return reply.code(400).send({ error: 'sessionToken required' });
      }

      const result = this.authService.validateSession(sessionToken);
      return {
        valid: result.valid,
        deviceId: result.deviceId
      };
    });

    // ========================================
    // Device Management Routes
    // ========================================

    // List trusted devices
    this.fastify.get('/api/auth/devices', async () => {
      const devices = this.authService.getDevices();
      return {
        devices: devices.map(d => ({
          deviceId: d.deviceId,
          deviceName: d.deviceName,
          deviceType: d.deviceType,
          trustedAt: d.trustedAt,
          lastSeen: d.lastSeen,
          lastIp: d.lastIp
        }))
      };
    });

    // Revoke a device
    this.fastify.delete('/api/auth/devices/:deviceId', async (request, reply) => {
      const { deviceId } = request.params as { deviceId: string };

      const success = this.authService.revokeDevice(deviceId);
      if (!success) {
        return reply.code(404).send({ error: 'Device not found' });
      }

      return { success: true };
    });

    // Rename a device
    this.fastify.patch('/api/auth/devices/:deviceId', async (request, reply) => {
      const { deviceId } = request.params as { deviceId: string };
      const { deviceName } = request.body as { deviceName: string };

      if (!deviceName) {
        return reply.code(400).send({ error: 'deviceName required' });
      }

      const success = this.authService.renameDevice(deviceId, deviceName);
      if (!success) {
        return reply.code(404).send({ error: 'Device not found' });
      }

      return { success: true };
    });

    // Check if a specific device is trusted
    this.fastify.get('/api/auth/devices/:deviceId/trusted', async (request) => {
      const { deviceId } = request.params as { deviceId: string };
      return { trusted: this.authService.isDeviceTrusted(deviceId) };
    });

    // ========================================
    // Discovery Routes
    // ========================================

    // Get discovery status
    this.fastify.get('/api/discovery/status', async () => {
      return {
        advertising: this.discoveryService?.isActive() || false,
        discoveredServers: this.discoveryService?.getDiscoveredServers() || []
      };
    });

    // Start browsing for other servers
    this.fastify.post('/api/discovery/browse', async () => {
      if (!this.discoveryService) {
        return { success: false, error: 'Discovery not available' };
      }

      await this.discoveryService.startBrowsing();
      return { success: true };
    });

    // Stop browsing
    this.fastify.post('/api/discovery/browse/stop', async () => {
      if (this.discoveryService) {
        await this.discoveryService.stopBrowsing();
      }
      return { success: true };
    });

    // Get discovered servers
    this.fastify.get('/api/discovery/servers', async () => {
      return {
        servers: this.discoveryService?.getDiscoveredServers() || []
      };
    });

    // ========================================
    // Settings Routes
    // ========================================

    this.fastify.post('/api/settings/server', async (request, reply) => {
      const { name } = request.body as { name?: string };

      if (!name || !name.trim()) {
        return reply.code(400).send({ error: 'name required' });
      }

      // Update server name in auth service
      this.authService.updateServerName(name.trim());
      return { success: true, name: name.trim() };
    });

    this.fastify.get('/api/settings/server', async () => {
      const identity = this.authService.getPublicIdentity();
      return {
        name: identity.serverName,
        serverId: identity.serverId
      };
    });

    // ========================================
    // Folder Authorization Routes (like Plex/Navidrome)
    // ========================================

    // Get all authorized paths
    this.fastify.get('/api/folders', async () => {
      const paths = this.pathAuthService.getAllPaths();
      return { paths };
    });

    // Get authorized paths for a specific plugin
    this.fastify.get('/api/folders/:pluginId', async (request) => {
      const { pluginId } = request.params as { pluginId: string };
      const paths = this.pathAuthService.getPathsForPlugin(pluginId);
      return { paths };
    });

    // Add a new authorized path for a plugin
    this.fastify.post('/api/folders', async (request, reply) => {
      const { pluginId, path, name, permissions } = request.body as {
        pluginId: string;
        path: string;
        name?: string;
        permissions?: 'read' | 'readwrite';
      };

      if (!pluginId || !path) {
        reply.code(400);
        return { error: 'pluginId and path are required' };
      }

      const result = await this.pathAuthService.addPath({
        pluginId,
        path,
        name,
        permissions,
        addedBy: 'admin'
      });

      if (!result.success) {
        reply.code(400);
        return { error: result.error };
      }

      // Update the plugin's sandbox to include the new path
      const sandbox = getPluginSandbox();
      if (sandbox) {
        await sandbox.updateAllowedPaths(pluginId);
      }

      return { success: true, path: result.path };
    });

    // Remove/revoke an authorized path
    this.fastify.delete('/api/folders/:pathId', async (request, reply) => {
      const { pathId } = request.params as { pathId: string };

      const success = this.pathAuthService.revokePath(pathId);
      if (!success) {
        reply.code(404);
        return { error: 'Path not found' };
      }

      return { success: true };
    });

    // Get pending path authorization requests
    this.fastify.get('/api/folders/requests/pending', async () => {
      const requests = this.pathAuthService.getPendingRequests();
      return { requests };
    });

    // Approve a path authorization request
    this.fastify.post('/api/folders/requests/:requestId/approve', async (request, reply) => {
      const { requestId } = request.params as { requestId: string };

      const result = await this.pathAuthService.approveRequest(requestId);
      if (!result.success) {
        reply.code(400);
        return { error: result.error };
      }

      return { success: true };
    });

    // Deny a path authorization request
    this.fastify.post('/api/folders/requests/:requestId/deny', async (request, reply) => {
      const { requestId } = request.params as { requestId: string };

      const success = this.pathAuthService.denyRequest(requestId);
      if (!success) {
        reply.code(404);
        return { error: 'Request not found' };
      }

      return { success: true };
    });

    // Validate a path (check if it exists and is accessible)
    this.fastify.post('/api/folders/validate', async (request, reply) => {
      const { path } = request.body as { path: string };

      if (!path) {
        reply.code(400);
        return { error: 'path is required' };
      }

      const result = await this.pathAuthService.validatePath(path);
      return result;
    });

    // Browse directories (for folder picker UI)
    this.fastify.get('/api/folders/browse', async (request) => {
      const { path: browsePath } = request.query as { path?: string };
      const targetPath = browsePath || (process.platform === 'win32' ? 'C:\\' : '/');

      try {
        const fs = require('fs/promises');
        const pathModule = require('path');
        const entries = await fs.readdir(targetPath, { withFileTypes: true });

        const directories = entries
          .filter((entry: any) => entry.isDirectory() && !entry.name.startsWith('.'))
          .map((entry: any) => ({
            name: entry.name,
            path: pathModule.join(targetPath, entry.name)
          }))
          .sort((a: any, b: any) => a.name.localeCompare(b.name));

        return {
          currentPath: targetPath,
          parent: pathModule.dirname(targetPath),
          directories
        };
      } catch (error) {
        return {
          currentPath: targetPath,
          parent: null,
          directories: [],
          error: 'Cannot read directory'
        };
      }
    });

    console.log('[Server] Routes registered');
  }

  /**
   * Get local IP address
   */
  private getLocalIP(): string {
    const nets = networkInterfaces();

    for (const name of Object.keys(nets)) {
      for (const net of nets[name] || []) {
        if (net.family === 'IPv4' && !net.internal) {
          return net.address;
        }
      }
    }

    return 'localhost';
  }

  /**
   * Get orchestrators (for external access)
   */
  getOrchestrators() {
    return {
      search: this.searchOrchestrator,
      trackResolver: this.trackResolver,
      playback: this.playbackOrchestrator,
      metadata: this.metadataOrchestrator,
      registry: this.registry,
      libraryBridge: this.libraryDb
    };
  }

  /**
   * Get library database
   */
  getLibraryDb(): LibraryDatabase {
    return this.libraryDb;
  }

  /**
   * Get plugin loader
   */
  getPluginLoader(): PluginLoader {
    return this.pluginLoader;
  }

  /**
   * Get auth service
   */
  getAuthService(): AuthService {
    return this.authService;
  }
}
