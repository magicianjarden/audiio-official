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
import { logService, log } from './services/log-service';
import { signalPathService } from './services/signal-path';
import { MediaFoldersService } from './services/media-folders';
import { LocalScannerService } from './services/local-scanner';
import { DownloadService } from './services/download-service';
import { FolderWatcherService } from './services/folder-watcher';
import { SearchService } from './services/search-service';
import { AudioFeatureIndex } from './services/audio-feature-index';

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
  private mediaFoldersService: MediaFoldersService;
  private localScannerService: LocalScannerService;
  private downloadService: DownloadService;
  private folderWatcherService: FolderWatcherService;
  private searchService: SearchService;
  private audioFeatureIndex: AudioFeatureIndex;

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

    // Set the same plugins directory on the installer
    pluginInstaller.setPluginsDir(this.config.plugins.directory);

    // Initialize library database
    this.libraryDb = new LibraryDatabase(this.config.storage.database);

    // Migrate smart playlists to unified playlist model if needed
    if (this.libraryDb.needsSmartPlaylistMigration()) {
      console.log('[Server] Migrating smart playlists to unified model...');
      this.libraryDb.migrateSmartPlaylistsToUnified();
    }

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

    // Initialize media folders service (uses same db connection as library)
    this.mediaFoldersService = new MediaFoldersService((this.libraryDb as any).db);

    // Initialize local scanner service
    this.localScannerService = new LocalScannerService(this.mediaFoldersService);

    // Initialize download service
    this.downloadService = new DownloadService(this.mediaFoldersService);

    // Auto-rescan audio folder when downloads complete (for dual-purpose folders)
    this.downloadService.on('download-progress', (progress: any) => {
      console.log('[Server] Download progress event:', progress.status, progress.id);

      if (progress.status === 'completed') {
        console.log('[Server] Download completed! File path:', progress.filePath);

        if (!progress.filePath) {
          console.log('[Server] No file path in completed event - cannot rescan');
          return;
        }

        // Check if this file is in an audio folder (dual-purpose folder)
        const audioFolders = this.mediaFoldersService.getFolders('audio');
        console.log('[Server] Audio folders:', audioFolders.map(f => f.path));

        const containingAudioFolder = audioFolders.find(folder =>
          progress.filePath.toLowerCase().startsWith(folder.path.toLowerCase())
        );

        if (containingAudioFolder) {
          console.log('[Server] File in audio folder, triggering rescan:', containingAudioFolder.name);
          // Trigger a rescan of the audio folder
          this.localScannerService.scanFolder(containingAudioFolder.id, { forceRescan: false })
            .then(result => {
              console.log('[Server] Rescan complete:', result);
              // Update the folder's track count
              const tracks = this.mediaFoldersService.getLocalTracks(containingAudioFolder.id);
              this.mediaFoldersService.updateTrackCount(containingAudioFolder.id, tracks.length);
              console.log('[Server] Updated track count to:', tracks.length);
            })
            .catch(error => {
              console.error('[Server] Rescan failed:', error);
            });
        } else {
          console.log('[Server] File not in any audio folder');
        }
      }
    });

    // Initialize folder watcher service (for automatic scanning)
    this.folderWatcherService = new FolderWatcherService(
      this.mediaFoldersService,
      this.localScannerService
    );

    // Initialize search service (uses same db connection)
    this.searchService = new SearchService((this.libraryDb as any).db);

    // Initialize audio feature index (uses same db connection)
    this.audioFeatureIndex = new AudioFeatureIndex((this.libraryDb as any).db);
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

      // Apply saved settings to plugins
      this.applyPersistedPluginSettings();
    }

    // Initialize ML service (after plugins are loaded)
    try {
      console.log('[Server] Initializing ML service...');
      await mlService.initialize({
        storagePath: join(this.config.storage.database, '..', 'ml-data'),
        enableAutoTraining: true,
      });
      console.log('[Server] ML service initialized');
    } catch (error) {
      console.error('[Server] ML service initialization failed (non-fatal):', error);
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
   * Apply persisted settings to all loaded plugins
   */
  private applyPersistedPluginSettings(): void {
    console.log('[Server] Checking for persisted plugin settings...');
    const allSettings = this.libraryDb.getAllPluginSettings();
    console.log(`[Server] Found ${allSettings.length} plugins with saved settings`);

    for (const { pluginId, settings, enabled } of allSettings) {
      const addon = this.registry.get(pluginId) as any;
      if (addon && addon.updateSettings && Object.keys(settings).length > 0) {
        try {
          // Log which settings are being applied (without exposing secrets)
          const settingKeys = Object.keys(settings);
          console.log(`[Server] Applying ${settingKeys.length} settings to ${pluginId}:`, settingKeys.join(', '));
          addon.updateSettings(settings);
        } catch (error) {
          console.error(`[Server] Failed to apply settings to ${pluginId}:`, error);
        }
      }

      // Apply enabled state
      if (addon) {
        this.registry.setEnabled(pluginId, enabled);
      }
    }
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
      max: 300,
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

    // Natural language search
    this.fastify.post('/api/search/natural', async (request, reply) => {
      const { query } = request.body as { query?: string };

      if (!query) {
        return reply.code(400).send({ error: 'Query required' });
      }

      try {
        // Parse natural language query
        const parsedQuery = this.searchService.parseNaturalQuery(query);

        // Execute search
        const { trackIds, total } = this.searchService.searchTracks(parsedQuery, {
          limit: 50,
          offset: 0
        });

        // Resolve track IDs to full track data
        const tracks = this.libraryDb.getTracksByIds(trackIds);

        // Save search to history
        this.searchService.saveSearch(query, total);

        return {
          parsedQuery,
          tracks,
          total,
          suggestions: this.searchService.getSuggestions(query, 5).recentSearches
        };
      } catch (error) {
        console.error('[Search/Natural] Error:', error);
        return reply.code(500).send({ error: 'Search failed' });
      }
    });

    // Advanced search with filters
    this.fastify.get('/api/search/advanced', async (request) => {
      const {
        q,
        artist,
        album,
        genre,
        yearMin,
        yearMax,
        durationMin,
        durationMax,
        tags,
        source,
        sortBy,
        sortDir,
        limit,
        offset
      } = request.query as Record<string, string | undefined>;

      // Build parsed query from parameters
      const parsedQuery: any = {
        text: q || '',
        filters: [],
        audioFeatures: undefined,
        playBehavior: undefined
      };

      // Add filters based on query params
      if (artist) {
        parsedQuery.filters.push({ type: 'artist', operator: 'contains', value: artist });
      }
      if (album) {
        parsedQuery.filters.push({ type: 'album', operator: 'contains', value: album });
      }
      if (genre) {
        parsedQuery.filters.push({ type: 'genre', operator: 'contains', value: genre });
      }
      if (yearMin && yearMax) {
        parsedQuery.filters.push({ type: 'year', operator: 'between', value: [parseInt(yearMin), parseInt(yearMax)] });
      } else if (yearMin) {
        parsedQuery.filters.push({ type: 'year', operator: 'gt', value: parseInt(yearMin) });
      } else if (yearMax) {
        parsedQuery.filters.push({ type: 'year', operator: 'lt', value: parseInt(yearMax) });
      }
      if (durationMin) {
        parsedQuery.filters.push({ type: 'duration', operator: 'gt', value: parseInt(durationMin) });
      }
      if (durationMax) {
        parsedQuery.filters.push({ type: 'duration', operator: 'lt', value: parseInt(durationMax) });
      }
      if (tags) {
        const tagList = tags.split(',');
        for (const tag of tagList) {
          parsedQuery.filters.push({ type: 'tag', operator: 'is', value: tag.trim() });
        }
      }
      if (source) {
        parsedQuery.filters.push({ type: 'source', operator: 'is', value: source });
      }

      try {
        const { trackIds, total } = this.searchService.searchTracks(parsedQuery, {
          limit: parseInt(limit || '50', 10),
          offset: parseInt(offset || '0', 10),
          sortBy: (sortBy as any) || 'relevance',
          sortDirection: (sortDir as any) || 'desc'
        });

        const tracks = this.libraryDb.getTracksByIds(trackIds);
        return { tracks, total };
      } catch (error) {
        console.error('[Search/Advanced] Error:', error);
        return { tracks: [], total: 0, error: 'Search failed' };
      }
    });

    // Search suggestions
    this.fastify.get('/api/search/suggestions', async (request) => {
      const { q, limit } = request.query as { q?: string; limit?: string };

      if (!q) {
        return { tracks: [], artists: [], albums: [], tags: [], recentSearches: [] };
      }

      return this.searchService.getSuggestions(q, parseInt(limit || '10', 10));
    });

    // Search history
    this.fastify.get('/api/search/history', async (request) => {
      const { limit } = request.query as { limit?: string };
      return this.searchService.getSearchHistory(parseInt(limit || '20', 10));
    });

    this.fastify.delete('/api/search/history/:id', async (request, reply) => {
      const { id } = request.params as { id: string };
      this.searchService.deleteSearchHistory(id);
      return { success: true };
    });

    this.fastify.delete('/api/search/history', async () => {
      this.searchService.clearSearchHistory();
      return { success: true };
    });

    // Plugin-provided search data routes

    // Search for videos (from search-providers and artist-enrichment plugins)
    this.fastify.get('/api/search/videos', async (request) => {
      const { q, limit } = request.query as { q?: string; limit?: string };

      if (!q) {
        return { videos: [] };
      }

      try {
        const maxResults = parseInt(limit || '8', 10);
        const allVideos: any[] = [];

        // Query search providers first (new interface)
        const searchProviders = this.registry.getSearchProviders();
        for (const provider of searchProviders) {
          if (provider.searchVideos) {
            try {
              const videos = await provider.searchVideos(q, { limit: maxResults });
              allVideos.push(...videos);
            } catch (err) {
              console.warn(`[Search/Videos] Provider ${provider.id} failed:`, err);
            }
          }
        }

        // Fall back to artist-enrichment providers (backward compatibility)
        if (allVideos.length === 0) {
          const enrichmentProviders = this.registry.getByRole<any>('artist-enrichment');
          const videoProvider = enrichmentProviders.find(p => p.enrichmentType === 'videos');

          if (videoProvider?.getArtistVideos) {
            const videos = await videoProvider.getArtistVideos(q, maxResults);
            allVideos.push(...videos);
          }
        }

        // Deduplicate by ID and limit results
        const seen = new Set<string>();
        const uniqueVideos = allVideos.filter(v => {
          if (seen.has(v.id)) return false;
          seen.add(v.id);
          return true;
        }).slice(0, maxResults);

        return { videos: uniqueVideos };
      } catch (error) {
        console.error('[Search/Videos] Error:', error);
        return { videos: [], error: 'Video search failed' };
      }
    });

    // Search for playlists (from search-providers, library, and import providers)
    this.fastify.get('/api/search/playlists', async (request) => {
      const { q, limit } = request.query as { q?: string; limit?: string };

      if (!q) {
        return { playlists: [] };
      }

      try {
        const maxResults = parseInt(limit || '6', 10);
        const queryLower = q.toLowerCase();
        const allPlaylists: any[] = [];

        // Query search providers first (new interface)
        const searchProviders = this.registry.getSearchProviders();
        for (const provider of searchProviders) {
          if (provider.searchPlaylists) {
            try {
              const playlists = await provider.searchPlaylists(q, { limit: maxResults });
              allPlaylists.push(...playlists.map(p => ({ ...p, source: provider.id })));
            } catch (err) {
              console.warn(`[Search/Playlists] Provider ${provider.id} failed:`, err);
            }
          }
        }

        // Search library playlists
        const libraryPlaylists = this.libraryDb.getPlaylists();
        const matchingLibraryPlaylists = libraryPlaylists
          .filter(p =>
            p.name.toLowerCase().includes(queryLower) ||
            (p.description && p.description.toLowerCase().includes(queryLower))
          )
          .map(p => ({
            id: p.id,
            name: p.name,
            description: p.description,
            trackCount: p.tracks?.length || 0,
            isSmartPlaylist: Array.isArray(p.rules) && p.rules.length > 0,
            source: 'library'
          }));

        allPlaylists.push(...matchingLibraryPlaylists);

        // Deduplicate by ID and limit results
        const seen = new Set<string>();
        const uniquePlaylists = allPlaylists.filter(p => {
          if (seen.has(p.id)) return false;
          seen.add(p.id);
          return true;
        }).slice(0, maxResults);

        return { playlists: uniquePlaylists };
      } catch (error) {
        console.error('[Search/Playlists] Error:', error);
        return { playlists: [], error: 'Playlist search failed' };
      }
    });

    // Search for concerts (from search-providers and artist-enrichment plugins)
    this.fastify.get('/api/search/concerts', async (request) => {
      const { q, limit } = request.query as { q?: string; limit?: string };

      if (!q) {
        return { concerts: [] };
      }

      try {
        const maxResults = parseInt(limit || '4', 10);
        const allConcerts: any[] = [];

        // Query search providers first (new interface)
        const searchProviders = this.registry.getSearchProviders();
        for (const provider of searchProviders) {
          if (provider.searchConcerts) {
            try {
              const concerts = await provider.searchConcerts(q, { limit: maxResults });
              allConcerts.push(...concerts);
            } catch (err) {
              console.warn(`[Search/Concerts] Provider ${provider.id} failed:`, err);
            }
          }
        }

        // Fall back to artist-enrichment providers (backward compatibility)
        if (allConcerts.length === 0) {
          const enrichmentProviders = this.registry.getByRole<any>('artist-enrichment');
          for (const provider of enrichmentProviders) {
            if (provider.getUpcomingConcerts) {
              try {
                const concerts = await provider.getUpcomingConcerts(q);
                if (concerts && concerts.length > 0) {
                  allConcerts.push(...concerts);
                  break; // Got results, stop searching
                }
              } catch (err) {
                // Continue to next provider
              }
            }
          }
        }

        // Deduplicate by ID and limit results
        const seen = new Set<string>();
        const uniqueConcerts = allConcerts.filter(c => {
          if (seen.has(c.id)) return false;
          seen.add(c.id);
          return true;
        }).slice(0, maxResults);

        return { concerts: uniqueConcerts };
      } catch (error) {
        console.error('[Search/Concerts] Error:', error);
        return { concerts: [], error: 'Concert search failed' };
      }
    });

    // Audio Feature Index routes
    this.fastify.get('/api/audio-features/:trackId', async (request, reply) => {
      const { trackId } = request.params as { trackId: string };
      const features = this.audioFeatureIndex.get(trackId);
      if (!features) {
        return reply.code(404).send({ error: 'Audio features not found' });
      }
      return features;
    });

    this.fastify.get('/api/audio-features/query', async (request) => {
      const {
        energyMin, energyMax,
        tempoMin, tempoMax,
        valenceMin, valenceMax,
        danceabilityMin, danceabilityMax,
        acousticnessMin, acousticnessMax,
        instrumentalnessMin, instrumentalnessMax,
        limit, offset
      } = request.query as Record<string, string | undefined>;

      const criteria: any = {};

      if (energyMin || energyMax) {
        criteria.energy = {};
        if (energyMin) criteria.energy.min = parseFloat(energyMin);
        if (energyMax) criteria.energy.max = parseFloat(energyMax);
      }
      if (tempoMin || tempoMax) {
        criteria.tempo = {};
        if (tempoMin) criteria.tempo.min = parseFloat(tempoMin);
        if (tempoMax) criteria.tempo.max = parseFloat(tempoMax);
      }
      if (valenceMin || valenceMax) {
        criteria.valence = {};
        if (valenceMin) criteria.valence.min = parseFloat(valenceMin);
        if (valenceMax) criteria.valence.max = parseFloat(valenceMax);
      }
      if (danceabilityMin || danceabilityMax) {
        criteria.danceability = {};
        if (danceabilityMin) criteria.danceability.min = parseFloat(danceabilityMin);
        if (danceabilityMax) criteria.danceability.max = parseFloat(danceabilityMax);
      }
      if (acousticnessMin || acousticnessMax) {
        criteria.acousticness = {};
        if (acousticnessMin) criteria.acousticness.min = parseFloat(acousticnessMin);
        if (acousticnessMax) criteria.acousticness.max = parseFloat(acousticnessMax);
      }
      if (instrumentalnessMin || instrumentalnessMax) {
        criteria.instrumentalness = {};
        if (instrumentalnessMin) criteria.instrumentalness.min = parseFloat(instrumentalnessMin);
        if (instrumentalnessMax) criteria.instrumentalness.max = parseFloat(instrumentalnessMax);
      }

      const trackIds = this.audioFeatureIndex.query(
        criteria,
        parseInt(limit || '50', 10),
        parseInt(offset || '0', 10)
      );

      const tracks = this.libraryDb.getTracksByIds(trackIds);
      const total = this.audioFeatureIndex.count(criteria);

      return { tracks, total };
    });

    this.fastify.get('/api/audio-features/similar/:trackId', async (request) => {
      const { trackId } = request.params as { trackId: string };
      const { limit } = request.query as { limit?: string };

      const similarIds = this.audioFeatureIndex.findSimilar(
        trackId,
        parseInt(limit || '20', 10)
      );

      const tracks = this.libraryDb.getTracksByIds(similarIds);
      return { tracks };
    });

    this.fastify.get('/api/audio-features/distributions', async () => {
      return this.audioFeatureIndex.getAllDistributions();
    });

    this.fastify.get('/api/audio-features/moods', async () => {
      return this.audioFeatureIndex.getAvailableMoods();
    });

    this.fastify.get('/api/audio-features/moods/clusters', async (request) => {
      const { includeTracks, trackLimit } = request.query as {
        includeTracks?: string;
        trackLimit?: string;
      };

      return this.audioFeatureIndex.getMoodClusters(
        includeTracks === 'true',
        parseInt(trackLimit || '50', 10)
      );
    });

    this.fastify.get('/api/audio-features/mood/:trackId', async (request, reply) => {
      const { trackId } = request.params as { trackId: string };
      const mood = this.audioFeatureIndex.getTrackMood(trackId);
      if (!mood) {
        return reply.code(404).send({ error: 'Track or features not found' });
      }
      return { trackId, mood };
    });

    this.fastify.get('/api/audio-features/stats', async () => {
      return {
        analyzedCount: this.audioFeatureIndex.getAnalyzedCount(),
        unanalyzedSample: this.audioFeatureIndex.getUnanalyzedTracks(10)
      };
    });

    // Stream resolution
    this.fastify.get('/api/stream/resolve', async (request, reply) => {
      const { trackId, title, artist, isrc } = request.query as {
        trackId?: string;
        title?: string;
        artist?: string;
        isrc?: string;
      };

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

        const stream = await this.trackResolver.resolveStream(track as any);

        if (!stream) {
          return reply.code(404).send({ error: 'No stream found' });
        }

        // Return stream info with proxied URL
        const proxyUrl = `/api/stream/proxy?url=${encodeURIComponent(stream.url)}`;
        return {
          ...stream,
          url: proxyUrl, // Use proxy URL to bypass CORS
          originalUrl: stream.url
        };
      } catch (error) {
        console.error('[Stream] Resolution failed:', error instanceof Error ? error.message : error);
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
        console.error('[StreamProxy] Failed:', error instanceof Error ? error.message : error);
        return reply.code(500).send({ error: 'Stream proxy failed' });
      }
    });

    // Local file streaming - serves audio/video files from the local filesystem
    this.fastify.get('/api/stream/local', async (request, reply) => {
      const { path: filePath } = request.query as { path?: string };

      if (!filePath) {
        return reply.code(400).send({ error: 'File path required' });
      }

      // Decode the path (it comes URL-encoded)
      const decodedPath = decodeURIComponent(filePath);

      console.log('[LocalStream] Serving:', decodedPath);

      // Security check: Only allow files from registered media folders
      const folders = this.mediaFoldersService.getFolders();
      const isInAllowedFolder = folders.some(folder =>
        decodedPath.toLowerCase().startsWith(folder.path.toLowerCase())
      );

      if (!isInAllowedFolder) {
        console.error('[LocalStream] Access denied - path not in registered folders:', decodedPath);
        return reply.code(403).send({ error: 'Access denied - file not in registered media folder' });
      }

      // Check file exists
      const fs = await import('fs');
      const path = await import('path');

      if (!fs.existsSync(decodedPath)) {
        console.error('[LocalStream] File not found:', decodedPath);
        return reply.code(404).send({ error: 'File not found' });
      }

      try {
        const stat = fs.statSync(decodedPath);
        const ext = path.extname(decodedPath).toLowerCase();

        // Determine content type
        const mimeTypes: Record<string, string> = {
          '.mp3': 'audio/mpeg',
          '.flac': 'audio/flac',
          '.wav': 'audio/wav',
          '.m4a': 'audio/mp4',
          '.ogg': 'audio/ogg',
          '.opus': 'audio/opus',
          '.aac': 'audio/aac',
          '.wma': 'audio/x-ms-wma',
          '.mp4': 'video/mp4',
          '.mkv': 'video/x-matroska',
          '.avi': 'video/x-msvideo',
          '.webm': 'video/webm',
          '.mov': 'video/quicktime',
        };

        const contentType = mimeTypes[ext] || 'application/octet-stream';
        const fileSize = stat.size;

        // Handle range requests for seeking
        const range = request.headers.range;

        if (range) {
          const parts = range.replace(/bytes=/, '').split('-');
          const start = parseInt(parts[0], 10);
          const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
          const chunkSize = end - start + 1;

          reply.code(206);
          reply.header('Content-Range', `bytes ${start}-${end}/${fileSize}`);
          reply.header('Accept-Ranges', 'bytes');
          reply.header('Content-Length', chunkSize);
          reply.header('Content-Type', contentType);

          const stream = fs.createReadStream(decodedPath, { start, end });
          return reply.send(stream);
        } else {
          reply.header('Content-Length', fileSize);
          reply.header('Content-Type', contentType);
          reply.header('Accept-Ranges', 'bytes');

          const stream = fs.createReadStream(decodedPath);
          return reply.send(stream);
        }
      } catch (error) {
        console.error('[LocalStream] Error streaming file:', error);
        return reply.code(500).send({ error: 'Failed to stream file' });
      }
    });

    // Player State
    this.fastify.get('/api/player/last-played', async () => {
      try {
        const state = this.trackingService.getLastPlaybackState();
        return { success: true, state };
      } catch (error) {
        console.error('[PlayerState] Error:', error);
        return { success: false, error: 'Failed to get last playback state' };
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
      const tracks = this.libraryDb.getLikedTracks();
      console.log('[Library] Returning', tracks.length, 'liked tracks');
      return {
        tracks,
        synced: true
      };
    });

    this.fastify.post('/api/library/likes', async (request) => {
      const { track } = request.body as { track: any };
      if (!track) {
        return { success: false, error: 'Track required' };
      }
      console.log('[Library] Liking track:', track.id, track.title);
      this.libraryDb.likeTrack(track);

      // Verify persistence
      const isLiked = this.libraryDb.isTrackLiked(track.id);
      console.log('[Library] Track liked successfully:', isLiked);

      return { success: true, verified: isLiked };
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
      const { name, description, folderId, rules, combinator, orderBy, orderDirection, limit } = request.body as {
        name: string;
        description?: string;
        folderId?: string;
        rules?: Array<{ field: string; operator: string; value: unknown }>;
        combinator?: 'and' | 'or';
        orderBy?: string;
        orderDirection?: 'asc' | 'desc';
        limit?: number;
      };
      if (!name) {
        return { success: false, error: 'Name required' };
      }
      const playlist = this.libraryDb.createPlaylist(name, description, {
        folderId,
        rules,
        combinator,
        orderBy,
        orderDirection,
        limit
      });
      return { success: true, playlist };
    });

    this.fastify.delete('/api/library/playlists/:playlistId', async (request) => {
      const { playlistId } = request.params as { playlistId: string };
      this.libraryDb.deletePlaylist(playlistId);
      return { success: true };
    });

    this.fastify.put('/api/library/playlists/:playlistId', async (request) => {
      const { playlistId } = request.params as { playlistId: string };
      const data = request.body as Partial<{
        name: string;
        description: string;
        folderId: string | null;
        rules: Array<{ field: string; operator: string; value: unknown }> | null;
        combinator: 'and' | 'or';
        orderBy: string | null;
        orderDirection: 'asc' | 'desc';
        limit: number | null;
      }>;

      this.libraryDb.updatePlaylist(playlistId, data);
      const updated = this.libraryDb.getPlaylist(playlistId);
      return { success: true, playlist: updated };
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

    // Evaluate playlist rules (returns matching tracks for playlists with rules)
    this.fastify.get('/api/library/playlists/:playlistId/evaluate', async (request, reply) => {
      const { playlistId } = request.params as { playlistId: string };
      const playlist = this.libraryDb.getPlaylist(playlistId);

      if (!playlist) {
        return reply.code(404).send({ error: 'Playlist not found' });
      }

      if (!playlist.rules || playlist.rules.length === 0) {
        // No rules - return empty (manual tracks are in playlist.tracks)
        return { trackIds: [], tracks: [], count: 0, source: 'local' };
      }

      const { trackIds, count, source } = this.libraryDb.evaluatePlaylistRules(playlistId);
      const tracks = this.libraryDb.getTracksByIds(trackIds);

      // TODO: For 'streams' or 'all' source, integrate with plugin search
      // This would query streaming providers for tracks matching the rules
      // For now, only local evaluation is fully implemented

      return { trackIds, tracks, count, source };
    });

    // Preview playlist rules (without saving)
    this.fastify.post('/api/library/playlists/preview', async (request) => {
      const { rules, combinator, orderBy, orderDirection, limit, source } = request.body as {
        rules: Array<{ field: string; operator: string; value: unknown }>;
        combinator?: 'and' | 'or';
        orderBy?: string;
        orderDirection?: 'asc' | 'desc';
        limit?: number;
        source?: 'local' | 'streams' | 'all';
      };

      if (!rules || rules.length === 0) {
        return { trackIds: [], tracks: [], count: 0, source: source || 'local' };
      }

      const effectiveSource = source || 'local';

      // For 'local' and 'all', evaluate against local library
      let trackIds: string[] = [];
      if (effectiveSource === 'local' || effectiveSource === 'all') {
        trackIds = this.libraryDb.evaluateSmartPlaylistRules(
          rules,
          combinator || 'and',
          orderBy,
          orderDirection,
          effectiveSource === 'all' ? undefined : limit
        );
      }

      // TODO: For 'streams' or 'all' source, integrate with plugin search
      // This would query streaming providers for tracks matching the rules
      // For now, only local evaluation is fully implemented

      const tracks = this.libraryDb.getTracksByIds(trackIds);
      return { trackIds, tracks, count: tracks.length, source: effectiveSource };
    });

    // Get available rule definitions for playlist rule builder
    this.fastify.get('/api/library/playlists/rules', async () => {
      return {
        rules: this.libraryDb.getRuleDefinitions()
      };
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

    // Dynamic Discovery Layout - personalized based on user activity
    this.fastify.get('/api/discover/layout', async () => {
      try {
        // Get library stats to determine what sections to show
        const stats = this.libraryDb.getStats();
        const hasHistory = stats.historyCount > 0;
        const hasLikes = stats.likedCount > 0;
        const hasPlaylists = stats.playlistCount > 0;

        // Build sections dynamically based on user activity
        const sections: Array<{
          id: string;
          type: string;
          title: string;
          subtitle?: string;
          isPersonalized: boolean;
          priority: number;
        }> = [];

        let priority = 0;

        // Hero section always shows
        sections.push({
          id: 'hero-1',
          type: 'hero',
          title: hasHistory ? 'Made For You' : 'Discover Music',
          subtitle: hasHistory ? 'Personalized picks' : 'Start listening to get recommendations',
          isPersonalized: hasHistory,
          priority: priority++
        });

        // Quick picks - show if user has likes or history
        if (hasLikes || hasHistory) {
          sections.push({
            id: 'quick-picks-1',
            type: 'quick-picks',
            title: '',
            isPersonalized: true,
            priority: priority++
          });
        }

        // Jump Back In - only show if there's listening history
        if (hasHistory) {
          sections.push({
            id: 'jump-back-in-1',
            type: 'compact-list',
            title: 'Jump Back In',
            subtitle: 'Your recent listens',
            isPersonalized: true,
            priority: priority++
          });
        }

        // Top Mix - only if enough likes/history to make it meaningful
        if (hasLikes && stats.likedCount >= 5) {
          sections.push({
            id: 'top-mix-1',
            type: 'top-mix',
            title: 'Your Top Mix',
            subtitle: 'Songs you love',
            isPersonalized: true,
            priority: priority++
          });
        }

        // New Releases - always show
        sections.push({
          id: 'new-releases-1',
          type: 'new-releases',
          title: 'New Releases',
          subtitle: 'Fresh music for you',
          isPersonalized: false,
          priority: priority++
        });

        // Trending - always show
        sections.push({
          id: 'trending-1',
          type: 'trending-tracks',
          title: 'Trending Now',
          subtitle: 'What everyone is listening to',
          isPersonalized: false,
          priority: priority++
        });

        // Artists - always show
        sections.push({
          id: 'artists-1',
          type: 'trending-artists',
          title: 'Popular Artists',
          isPersonalized: false,
          priority: priority++
        });

        // Moods - always show
        sections.push({
          id: 'moods-1',
          type: 'mood-playlist',
          title: 'Vibe Check',
          subtitle: 'Music for every mood',
          isPersonalized: false,
          priority: priority++
        });

        // Charts - always show at end
        sections.push({
          id: 'charts-1',
          type: 'chart-list',
          title: 'Top Charts',
          isPersonalized: false,
          priority: priority++
        });

        // If user has playlists, add a "Your Playlists" section
        if (hasPlaylists) {
          sections.push({
            id: 'your-playlists-1',
            type: 'user-playlists',
            title: 'Your Playlists',
            isPersonalized: true,
            priority: priority++
          });
        }

        return { sections, stats: { hasHistory, hasLikes, hasPlaylists } };
      } catch (error) {
        console.error('[Discover] Layout generation error:', error);
        // Return a minimal fallback layout
        return {
          sections: [
            { id: 'trending-1', type: 'trending-tracks', title: 'Trending Now', isPersonalized: false, priority: 0 },
            { id: 'artists-1', type: 'trending-artists', title: 'Popular Artists', isPersonalized: false, priority: 1 },
            { id: 'charts-1', type: 'chart-list', title: 'Top Charts', isPersonalized: false, priority: 2 }
          ],
          error: 'Failed to generate personalized layout'
        };
      }
    });

    // Record play (for recommendations)
    this.fastify.post('/api/library/history', async (request) => {
      const { track, duration } = request.body as { track: any; duration?: number };
      if (!track) {
        return { success: false, error: 'Track required' };
      }
      this.libraryDb.recordPlay(track, duration || 0);
      // Also update play stats
      this.libraryDb.incrementPlayCount(track.id, duration || 0);
      return { success: true };
    });

    // Record skip
    this.fastify.post('/api/library/skip', async (request) => {
      const { trackId } = request.body as { trackId: string };
      if (!trackId) {
        return { success: false, error: 'trackId required' };
      }
      this.libraryDb.incrementSkipCount(trackId);
      return { success: true };
    });

    // ========================================
    // Smart Playlists
    // ========================================

    this.fastify.get('/api/library/smart-playlists', async () => {
      return {
        playlists: this.libraryDb.getSmartPlaylists(),
        synced: true
      };
    });

    this.fastify.get('/api/library/smart-playlists/:playlistId', async (request, reply) => {
      const { playlistId } = request.params as { playlistId: string };
      const playlist = this.libraryDb.getSmartPlaylist(playlistId);
      if (!playlist) {
        return reply.code(404).send({ error: 'Smart playlist not found' });
      }
      return playlist;
    });

    this.fastify.post('/api/library/smart-playlists', async (request) => {
      const data = request.body as {
        name: string;
        description?: string;
        rules: Array<{ field: string; operator: string; value: unknown; pluginId?: string }>;
        combinator?: 'and' | 'or';
        orderBy?: string;
        orderDirection?: 'asc' | 'desc';
        limit?: number;
        folderId?: string;
      };

      if (!data.name || !data.rules || !Array.isArray(data.rules)) {
        return { success: false, error: 'Name and rules required' };
      }

      const playlist = this.libraryDb.createSmartPlaylist(data);
      return { success: true, playlist };
    });

    this.fastify.put('/api/library/smart-playlists/:playlistId', async (request) => {
      const { playlistId } = request.params as { playlistId: string };
      const data = request.body as Partial<{
        name: string;
        description: string;
        rules: Array<{ field: string; operator: string; value: unknown; pluginId?: string }>;
        combinator: 'and' | 'or';
        orderBy: string;
        orderDirection: 'asc' | 'desc';
        limit: number;
        folderId: string;
      }>;

      this.libraryDb.updateSmartPlaylist(playlistId, data);
      return { success: true };
    });

    this.fastify.delete('/api/library/smart-playlists/:playlistId', async (request) => {
      const { playlistId } = request.params as { playlistId: string };
      this.libraryDb.deleteSmartPlaylist(playlistId);
      return { success: true };
    });

    // Evaluate smart playlist (returns matching tracks)
    this.fastify.get('/api/library/smart-playlists/:playlistId/tracks', async (request, reply) => {
      const { playlistId } = request.params as { playlistId: string };
      const playlist = this.libraryDb.getSmartPlaylist(playlistId);

      if (!playlist) {
        return reply.code(404).send({ error: 'Smart playlist not found' });
      }

      // Evaluate the rules
      const trackIds = this.libraryDb.evaluateSmartPlaylistRules(
        playlist.rules,
        playlist.combinator,
        playlist.orderBy,
        playlist.orderDirection,
        playlist.limit
      );

      // Update last evaluated timestamp and track count
      this.libraryDb.updateSmartPlaylist(playlistId, {
        lastEvaluated: Date.now(),
        trackCount: trackIds.length
      });

      // Return track IDs (client can resolve them)
      return {
        playlistId,
        trackIds,
        count: trackIds.length,
        evaluatedAt: Date.now()
      };
    });

    // Preview smart playlist rules (without saving)
    this.fastify.post('/api/library/smart-playlists/preview', async (request) => {
      const { rules, combinator, orderBy, orderDirection, limit } = request.body as {
        rules: Array<{ field: string; operator: string; value: unknown }>;
        combinator: 'and' | 'or';
        orderBy?: string;
        orderDirection?: 'asc' | 'desc';
        limit?: number;
      };

      if (!rules || !Array.isArray(rules) || rules.length === 0) {
        return { tracks: [], count: 0 };
      }

      // Evaluate the rules
      const trackIds = this.libraryDb.evaluateSmartPlaylistRules(
        rules,
        combinator || 'and',
        orderBy,
        orderDirection,
        limit || 100
      );

      // Resolve track IDs to full track data
      const tracks = this.libraryDb.getTracksByIds(trackIds);

      return {
        tracks,
        count: trackIds.length,
        evaluatedAt: Date.now()
      };
    });

    // Get available smart playlist rule definitions
    this.fastify.get('/api/library/smart-playlists/rules', async () => {
      // Return built-in rules - plugins can add more via the registry
      return {
        rules: [
          { field: 'title', label: 'Title', type: 'string', category: 'metadata', operators: ['contains', 'not_contains', 'is', 'is_not', 'starts_with', 'ends_with'] },
          { field: 'artist', label: 'Artist', type: 'string', category: 'metadata', operators: ['contains', 'not_contains', 'is', 'is_not'] },
          { field: 'album', label: 'Album', type: 'string', category: 'metadata', operators: ['contains', 'not_contains', 'is', 'is_not'] },
          { field: 'genre', label: 'Genre', type: 'string', category: 'metadata', operators: ['contains', 'is'] },
          { field: 'year', label: 'Year', type: 'number', category: 'metadata', operators: ['is', 'is_not', 'gt', 'lt', 'between'] },
          { field: 'duration', label: 'Duration', type: 'duration', category: 'metadata', operators: ['gt', 'lt', 'between'] },
          { field: 'addedAt', label: 'Date Added', type: 'date', category: 'library', operators: ['in_last', 'not_in_last', 'before', 'after'] },
          { field: 'isLiked', label: 'Liked', type: 'boolean', category: 'library', operators: ['is'] },
          { field: 'playCount', label: 'Play Count', type: 'number', category: 'playback', operators: ['is', 'gt', 'lt'] },
          { field: 'lastPlayed', label: 'Last Played', type: 'date', category: 'playback', operators: ['in_last', 'not_in_last', 'never'] },
          { field: 'skipCount', label: 'Skip Count', type: 'number', category: 'playback', operators: ['is', 'gt', 'lt'] }
        ]
      };
    });

    // ========================================
    // Playlist Folders
    // ========================================

    this.fastify.get('/api/library/folders', async () => {
      return {
        folders: this.libraryDb.getPlaylistFolders(),
        synced: true
      };
    });

    this.fastify.get('/api/library/folders/:folderId', async (request, reply) => {
      const { folderId } = request.params as { folderId: string };
      const folder = this.libraryDb.getPlaylistFolder(folderId);
      if (!folder) {
        return reply.code(404).send({ error: 'Folder not found' });
      }
      return folder;
    });

    this.fastify.post('/api/library/folders', async (request) => {
      const { name, parentId } = request.body as { name: string; parentId?: string };
      if (!name) {
        return { success: false, error: 'Name required' };
      }
      const folder = this.libraryDb.createPlaylistFolder(name, parentId);
      return { success: true, folder };
    });

    this.fastify.put('/api/library/folders/:folderId', async (request) => {
      const { folderId } = request.params as { folderId: string };
      const data = request.body as Partial<{
        name: string;
        parentId: string;
        position: number;
        isExpanded: boolean;
      }>;

      this.libraryDb.updatePlaylistFolder(folderId, data);
      return { success: true };
    });

    this.fastify.delete('/api/library/folders/:folderId', async (request) => {
      const { folderId } = request.params as { folderId: string };
      this.libraryDb.deletePlaylistFolder(folderId);
      return { success: true };
    });

    // Move playlist to folder
    this.fastify.post('/api/library/playlists/:playlistId/move', async (request) => {
      const { playlistId } = request.params as { playlistId: string };
      const { folderId } = request.body as { folderId: string | null };
      this.libraryDb.movePlaylistToFolder(playlistId, folderId);
      return { success: true };
    });

    // Move smart playlist to folder
    this.fastify.post('/api/library/smart-playlists/:playlistId/move', async (request) => {
      const { playlistId } = request.params as { playlistId: string };
      const { folderId } = request.body as { folderId: string | null };
      this.libraryDb.moveSmartPlaylistToFolder(playlistId, folderId);
      return { success: true };
    });

    // ========================================
    // Track Statistics
    // ========================================

    this.fastify.get('/api/library/stats', async () => {
      return this.libraryDb.getStats();
    });

    this.fastify.get('/api/library/stats/track/:trackId', async (request, reply) => {
      const { trackId } = request.params as { trackId: string };
      const stats = this.libraryDb.getTrackPlayStats(trackId);
      if (!stats) {
        return { trackId, playCount: 0, skipCount: 0, totalListenTime: 0 };
      }
      return stats;
    });

    this.fastify.get('/api/library/stats/most-played', async (request) => {
      const { limit } = request.query as { limit?: string };
      const l = parseInt(limit || '50', 10);
      return {
        tracks: this.libraryDb.getMostPlayedTracks(l)
      };
    });

    // ========================================
    // Track Enrichment (via plugins)
    // ========================================

    this.fastify.get('/api/library/enrichment/:trackId', async (request, reply) => {
      const { trackId } = request.params as { trackId: string };
      const enrichment = this.libraryDb.getTrackEnrichment(trackId);
      if (!enrichment) {
        return reply.code(404).send({ error: 'No enrichment data found' });
      }
      return enrichment;
    });

    this.fastify.post('/api/library/enrichment/:trackId', async (request) => {
      const { trackId } = request.params as { trackId: string };
      const { enrichedData, providerId, confidence } = request.body as {
        enrichedData: Record<string, unknown>;
        providerId?: string;
        confidence?: number;
      };

      if (!enrichedData) {
        return { success: false, error: 'enrichedData required' };
      }

      this.libraryDb.saveTrackEnrichment(trackId, enrichedData, providerId, confidence);
      return { success: true };
    });

    this.fastify.delete('/api/library/enrichment/:trackId', async (request) => {
      const { trackId } = request.params as { trackId: string };
      this.libraryDb.deleteTrackEnrichment(trackId);
      return { success: true };
    });

    // ========================================
    // Fingerprints (via plugins)
    // ========================================

    this.fastify.get('/api/library/fingerprint/:trackId', async (request, reply) => {
      const { trackId } = request.params as { trackId: string };
      const fingerprint = this.libraryDb.getCachedFingerprint(trackId);
      if (!fingerprint) {
        return reply.code(404).send({ error: 'No fingerprint cached' });
      }
      return fingerprint;
    });

    this.fastify.post('/api/library/fingerprint/:trackId', async (request) => {
      const { trackId } = request.params as { trackId: string };
      const { fingerprint, duration } = request.body as {
        fingerprint: string;
        duration: number;
      };

      if (!fingerprint || typeof duration !== 'number') {
        return { success: false, error: 'fingerprint and duration required' };
      }

      this.libraryDb.cacheFingerprint(trackId, fingerprint, duration);
      return { success: true };
    });

    this.fastify.delete('/api/library/fingerprint/:trackId', async (request) => {
      const { trackId } = request.params as { trackId: string };
      this.libraryDb.deleteCachedFingerprint(trackId);
      return { success: true };
    });

    // ========================================
    // Tags
    // ========================================

    this.fastify.get('/api/tags', async () => {
      return { tags: this.libraryDb.getTags() };
    });

    this.fastify.post('/api/tags', async (request) => {
      const { name, color } = request.body as { name: string; color?: string };
      if (!name) {
        return { success: false, error: 'Name required' };
      }
      const tag = this.libraryDb.createTag(name, color);
      return { success: true, tag };
    });

    this.fastify.put('/api/tags/:tagId', async (request) => {
      const { tagId } = request.params as { tagId: string };
      const data = request.body as Partial<{ name: string; color: string }>;
      this.libraryDb.updateTag(tagId, data);
      return { success: true };
    });

    this.fastify.delete('/api/tags/:tagId', async (request) => {
      const { tagId } = request.params as { tagId: string };
      this.libraryDb.deleteTag(tagId);
      return { success: true };
    });

    // Track tags
    this.fastify.get('/api/tracks/:trackId/tags', async (request) => {
      const { trackId } = request.params as { trackId: string };
      return { tags: this.libraryDb.getTrackTags(trackId) };
    });

    this.fastify.post('/api/tracks/:trackId/tags', async (request) => {
      const { trackId } = request.params as { trackId: string };
      const { tagName, color } = request.body as { tagName: string; color?: string };
      if (!tagName) {
        return { success: false, error: 'tagName required' };
      }
      const trackTag = this.libraryDb.addTagToTrack(trackId, tagName, color);
      return { success: true, trackTag };
    });

    this.fastify.delete('/api/tracks/:trackId/tags/:tagName', async (request) => {
      const { trackId, tagName } = request.params as { trackId: string; tagName: string };
      this.libraryDb.removeTagFromTrack(trackId, tagName);
      return { success: true };
    });

    this.fastify.get('/api/tracks/by-tag/:tagName', async (request) => {
      const { tagName } = request.params as { tagName: string };
      return { trackIds: this.libraryDb.getTracksByTag(tagName) };
    });

    // Entity tags (albums, artists, playlists)
    this.fastify.get('/api/entities/:entityType/:entityId/tags', async (request) => {
      const { entityType, entityId } = request.params as { entityType: string; entityId: string };
      return { tags: this.libraryDb.getEntityTags(entityType, entityId) };
    });

    this.fastify.post('/api/entities/:entityType/:entityId/tags', async (request) => {
      const { entityType, entityId } = request.params as { entityType: string; entityId: string };
      const { tagName } = request.body as { tagName: string };
      if (!tagName) {
        return { success: false, error: 'tagName required' };
      }
      const entityTag = this.libraryDb.addTagToEntity(entityType, entityId, tagName);
      return { success: true, entityTag };
    });

    this.fastify.delete('/api/entities/:entityType/:entityId/tags/:tagName', async (request) => {
      const { entityType, entityId, tagName } = request.params as { entityType: string; entityId: string; tagName: string };
      this.libraryDb.removeTagFromEntity(entityType, entityId, tagName);
      return { success: true };
    });

    // ========================================
    // Collections
    // ========================================

    this.fastify.get('/api/collections', async () => {
      return { collections: this.libraryDb.getCollections() };
    });

    this.fastify.get('/api/collections/:collectionId', async (request, reply) => {
      const { collectionId } = request.params as { collectionId: string };
      const collection = this.libraryDb.getCollection(collectionId);
      if (!collection) {
        return reply.code(404).send({ error: 'Collection not found' });
      }
      const items = this.libraryDb.getCollectionItems(collectionId);
      return { ...collection, items };
    });

    this.fastify.post('/api/collections', async (request) => {
      const { name, description } = request.body as { name: string; description?: string };
      if (!name) {
        return { success: false, error: 'Name required' };
      }
      const collection = this.libraryDb.createCollection(name, description);
      return { success: true, collection };
    });

    this.fastify.put('/api/collections/:collectionId', async (request) => {
      const { collectionId } = request.params as { collectionId: string };
      const data = request.body as Partial<{ name: string; description: string; coverImage: string }>;
      this.libraryDb.updateCollection(collectionId, data);
      return { success: true };
    });

    this.fastify.delete('/api/collections/:collectionId', async (request) => {
      const { collectionId } = request.params as { collectionId: string };
      this.libraryDb.deleteCollection(collectionId);
      return { success: true };
    });

    this.fastify.post('/api/collections/:collectionId/items', async (request) => {
      const { collectionId } = request.params as { collectionId: string };
      const { itemType, itemId, itemData, parentFolderId } = request.body as {
        itemType: string;
        itemId: string;
        itemData?: Record<string, unknown>;
        parentFolderId?: string | null;
      };
      if (!itemType || !itemId) {
        return { success: false, error: 'itemType and itemId required' };
      }
      const item = this.libraryDb.addToCollection(collectionId, itemType, itemId, itemData, parentFolderId);
      return { success: true, item };
    });

    this.fastify.delete('/api/collections/:collectionId/items/:itemId', async (request) => {
      const { collectionId, itemId } = request.params as { collectionId: string; itemId: string };
      this.libraryDb.removeFromCollection(collectionId, itemId);
      return { success: true };
    });

    this.fastify.put('/api/collections/:collectionId/reorder', async (request) => {
      const { collectionId } = request.params as { collectionId: string };
      const { itemIds } = request.body as { itemIds: string[] };
      if (!itemIds || !Array.isArray(itemIds)) {
        return { success: false, error: 'itemIds array required' };
      }
      this.libraryDb.reorderCollectionItems(collectionId, itemIds);
      return { success: true };
    });

    // Move item to folder within collection
    this.fastify.put('/api/collections/:collectionId/items/:itemId/move', async (request) => {
      const { collectionId, itemId } = request.params as { collectionId: string; itemId: string };
      const { targetFolderId } = request.body as { targetFolderId: string | null };
      this.libraryDb.moveCollectionItemToFolder(collectionId, itemId, targetFolderId);
      return { success: true };
    });

    // Reorder collections in sidebar
    this.fastify.put('/api/collections/reorder', async (request) => {
      const { collectionIds } = request.body as { collectionIds: string[] };
      if (!collectionIds || !Array.isArray(collectionIds)) {
        return { success: false, error: 'collectionIds array required' };
      }
      this.libraryDb.reorderCollections(collectionIds);
      return { success: true };
    });

    // ========================================
    // Folders within Collections
    // ========================================

    // Create folder within collection
    this.fastify.post('/api/collections/:collectionId/folders', async (request) => {
      const { collectionId } = request.params as { collectionId: string };
      const { name, parentFolderId } = request.body as { name: string; parentFolderId?: string | null };
      if (!name) {
        return { success: false, error: 'Name required' };
      }
      const item = this.libraryDb.createCollectionItemFolder(collectionId, name, parentFolderId);
      return { success: true, item };
    });

    // Update folder within collection
    this.fastify.put('/api/collections/:collectionId/folders/:folderId', async (request) => {
      const { collectionId, folderId } = request.params as { collectionId: string; folderId: string };
      const data = request.body as { name?: string; isExpanded?: boolean };
      this.libraryDb.updateCollectionItemFolder(collectionId, folderId, data);
      return { success: true };
    });

    // Delete folder within collection
    this.fastify.delete('/api/collections/:collectionId/folders/:folderId', async (request) => {
      const { collectionId, folderId } = request.params as { collectionId: string; folderId: string };
      const { moveContentsToParent } = request.body as { moveContentsToParent?: boolean } || {};
      this.libraryDb.deleteCollectionItemFolder(collectionId, folderId, moveContentsToParent ?? true);
      return { success: true };
    });

    // ========================================
    // Pinned Items
    // ========================================

    this.fastify.get('/api/pinned', async () => {
      return { items: this.libraryDb.getPinnedItems() };
    });

    this.fastify.post('/api/pinned', async (request) => {
      const { itemType, itemId, itemData } = request.body as {
        itemType: string;
        itemId: string;
        itemData?: Record<string, unknown>;
      };
      if (!itemType || !itemId) {
        return { success: false, error: 'itemType and itemId required' };
      }
      const item = this.libraryDb.pinItem(itemType, itemId, itemData);
      return { success: true, item };
    });

    this.fastify.delete('/api/pinned/:itemType/:itemId', async (request) => {
      const { itemType, itemId } = request.params as { itemType: string; itemId: string };
      this.libraryDb.unpinItem(itemType, itemId);
      return { success: true };
    });

    this.fastify.get('/api/pinned/:itemType/:itemId', async (request) => {
      const { itemType, itemId } = request.params as { itemType: string; itemId: string };
      return { pinned: this.libraryDb.isPinned(itemType, itemId) };
    });

    this.fastify.put('/api/pinned/reorder', async (request) => {
      const { items } = request.body as { items: Array<{ type: string; id: string }> };
      if (!items || !Array.isArray(items)) {
        return { success: false, error: 'items array required' };
      }
      this.libraryDb.reorderPinnedItems(items);
      return { success: true };
    });

    // ========================================
    // Library Views
    // ========================================

    this.fastify.get('/api/library/views', async () => {
      return { views: this.libraryDb.getLibraryViews() };
    });

    this.fastify.get('/api/library/views/:viewId', async (request, reply) => {
      const { viewId } = request.params as { viewId: string };
      const view = this.libraryDb.getLibraryView(viewId);
      if (!view) {
        return reply.code(404).send({ error: 'View not found' });
      }
      return view;
    });

    this.fastify.post('/api/library/views', async (request) => {
      const data = request.body as {
        name: string;
        icon?: string;
        filters: Record<string, unknown>;
        sortBy?: string;
        sortDirection?: 'asc' | 'desc';
      };
      if (!data.name || !data.filters) {
        return { success: false, error: 'name and filters required' };
      }
      const view = this.libraryDb.createLibraryView(data);
      return { success: true, view };
    });

    this.fastify.put('/api/library/views/:viewId', async (request) => {
      const { viewId } = request.params as { viewId: string };
      const data = request.body as Partial<{
        name: string;
        icon: string;
        filters: Record<string, unknown>;
        sortBy: string;
        sortDirection: 'asc' | 'desc';
      }>;
      this.libraryDb.updateLibraryView(viewId, data);
      return { success: true };
    });

    this.fastify.delete('/api/library/views/:viewId', async (request) => {
      const { viewId } = request.params as { viewId: string };
      this.libraryDb.deleteLibraryView(viewId);
      return { success: true };
    });

    // ========================================
    // Audio Features
    // ========================================

    this.fastify.get('/api/library/audio-features/:trackId', async (request, reply) => {
      const { trackId } = request.params as { trackId: string };
      const features = this.libraryDb.getAudioFeatures(trackId);
      if (!features) {
        return reply.code(404).send({ error: 'No audio features found' });
      }
      return features;
    });

    this.fastify.post('/api/library/audio-features', async (request) => {
      const features = request.body as {
        trackId: string;
        energy: number;
        tempo: number;
        valence: number;
        danceability: number;
        acousticness: number;
        instrumentalness: number;
        speechiness: number;
        loudness: number;
        key: number;
        mode: number;
        timeSignature: number;
      };
      if (!features.trackId) {
        return { success: false, error: 'trackId required' };
      }
      this.libraryDb.saveAudioFeatures({ ...features, analyzedAt: Date.now() });
      return { success: true };
    });

    this.fastify.post('/api/library/audio-features/search', async (request) => {
      const { criteria, limit } = request.body as {
        criteria: {
          energyMin?: number;
          energyMax?: number;
          tempoMin?: number;
          tempoMax?: number;
          valenceMin?: number;
          valenceMax?: number;
          danceabilityMin?: number;
          danceabilityMax?: number;
          acousticnessMin?: number;
          acousticnessMax?: number;
          instrumentalnessMin?: number;
          instrumentalnessMax?: number;
        };
        limit?: number;
      };
      if (!criteria) {
        return { success: false, error: 'criteria required' };
      }
      const trackIds = this.libraryDb.searchByAudioFeatures(criteria, limit);
      return { trackIds };
    });

    // ========================================
    // Plugin Capabilities for Library
    // ========================================

    this.fastify.get('/api/library/capabilities', async () => {
      // Report which library management capabilities are available via plugins
      const capabilities: Record<string, { available: boolean; providers: string[] }> = {
        'metadata-enricher': { available: false, providers: [] },
        'artwork-provider': { available: false, providers: [] },
        'fingerprint-provider': { available: false, providers: [] },
        'isrc-resolver': { available: false, providers: [] },
        'analytics-provider': { available: false, providers: [] },
        'smart-playlist-rules': { available: false, providers: [] },
        'duplicate-detector': { available: false, providers: [] },
        'import-provider': { available: false, providers: [] },
        'export-provider': { available: false, providers: [] },
        'library-hook': { available: false, providers: [] }
      };

      // Check registry for each capability
      const enrichers = this.registry.getMetadataEnrichers?.() || [];
      if (enrichers.length > 0) {
        capabilities['metadata-enricher'] = { available: true, providers: enrichers.map(e => e.id) };
      }

      const artworkProviders = this.registry.getArtworkProviders?.() || [];
      if (artworkProviders.length > 0) {
        capabilities['artwork-provider'] = { available: true, providers: artworkProviders.map(p => p.id) };
      }

      const fingerprintProvider = this.registry.getFingerprintProvider?.();
      if (fingerprintProvider) {
        capabilities['fingerprint-provider'] = { available: true, providers: [fingerprintProvider.id] };
      }

      const isrcResolvers = this.registry.getISRCResolvers?.() || [];
      if (isrcResolvers.length > 0) {
        capabilities['isrc-resolver'] = { available: true, providers: isrcResolvers.map(r => r.id) };
      }

      const analyticsProviders = this.registry.getAnalyticsProviders?.() || [];
      if (analyticsProviders.length > 0) {
        capabilities['analytics-provider'] = { available: true, providers: analyticsProviders.map(p => p.id) };
      }

      const smartPlaylistProviders = this.registry.getSmartPlaylistRulesProviders?.() || [];
      if (smartPlaylistProviders.length > 0) {
        capabilities['smart-playlist-rules'] = { available: true, providers: smartPlaylistProviders.map(p => p.id) };
      }

      const duplicateDetector = this.registry.getDuplicateDetector?.();
      if (duplicateDetector) {
        capabilities['duplicate-detector'] = { available: true, providers: [duplicateDetector.id] };
      }

      const importProviders = this.registry.getImportProviders?.() || [];
      if (importProviders.length > 0) {
        capabilities['import-provider'] = { available: true, providers: importProviders.map(p => p.id) };
      }

      const exportProviders = this.registry.getExportProviders?.() || [];
      if (exportProviders.length > 0) {
        capabilities['export-provider'] = { available: true, providers: exportProviders.map(p => p.id) };
      }

      const libraryHooks = this.registry.getLibraryHooks?.() || [];
      if (libraryHooks.length > 0) {
        capabilities['library-hook'] = { available: true, providers: libraryHooks.map(h => h.id) };
      }

      return capabilities;
    });

    // Get available import providers
    this.fastify.get('/api/library/import/providers', async () => {
      const providers = this.registry.getImportProviders?.() || [];
      return {
        providers: providers.map(p => ({
          id: p.id,
          name: p.name,
          source: p.source
        }))
      };
    });

    // Get available export formats
    this.fastify.get('/api/library/export/formats', async () => {
      const providers = this.registry.getExportProviders?.() || [];
      const formats: Array<{ providerId: string; format: string; extension: string; name: string }> = [];

      for (const provider of providers) {
        for (const format of provider.formats) {
          formats.push({
            providerId: provider.id,
            format: format.id,
            extension: format.extension,
            name: format.name
          });
        }
      }

      return { formats };
    });

    // Addons/Plugins - List loaded
    this.fastify.get('/api/addons', async () => {
      return {
        addons: this.pluginLoader.getLoadedPlugins().map(p => {
          // Get settingsSchema and privacy from the plugin instance manifest
          const instanceManifest = p.instance?.manifest as any;

          // Debug: log privacy data for each plugin
          if (instanceManifest?.privacy) {
            console.log(`[Addons] Plugin ${p.manifest.id} has privacy manifest:`, JSON.stringify(instanceManifest.privacy, null, 2));
          } else {
            console.log(`[Addons] Plugin ${p.manifest.id} has NO privacy manifest. instanceManifest keys:`, instanceManifest ? Object.keys(instanceManifest) : 'null');
          }

          return {
            id: p.manifest.id,
            name: p.manifest.name,
            version: p.manifest.version,
            description: p.manifest.description,
            author: instanceManifest?.author || p.manifest.author,
            roles: p.manifest.roles,
            source: p.source,
            // Map settingsSchema to settingsDefinitions for the UI
            settingsDefinitions: instanceManifest?.settingsSchema || [],
            // Privacy transparency manifest
            privacy: instanceManifest?.privacy
          };
        })
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

      // Persist enabled state to database
      this.libraryDb.setPluginEnabled(addonId, enabled);

      return { success: true, addonId, enabled };
    });

    // Plugin settings
    this.fastify.get('/api/addons/:addonId/settings', async (request, reply) => {
      const { addonId } = request.params as { addonId: string };
      const addon = this.registry.get(addonId) as any;

      if (!addon) {
        return reply.code(404).send({ error: 'Addon not found' });
      }

      // Get settings from plugin (in-memory) and merge with persisted
      const pluginSettings = addon.getSettings ? addon.getSettings() : {};
      const persisted = this.libraryDb.getPluginSettings(addonId);

      // Merge: persisted settings take precedence (they're the source of truth)
      const mergedSettings = { ...pluginSettings, ...(persisted?.settings || {}) };

      return { settings: mergedSettings };
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

      // Apply to plugin in-memory
      addon.updateSettings(settings);

      // Persist to database (merge with existing settings)
      const existing = this.libraryDb.getPluginSettings(addonId);
      const mergedSettings = { ...(existing?.settings || {}), ...settings };
      this.libraryDb.updatePluginSettings(addonId, mergedSettings);

      // Log which settings were saved (keys only, not values for security)
      const settingKeys = Object.keys(settings);
      console.log(`[Server] Persisted settings for plugin ${addonId}:`, settingKeys.join(', '));
      return { success: true };
    });

    // ========================================
    // Scrobbling API
    // ========================================

    // Submit a scrobble to a specific plugin
    this.fastify.post('/api/scrobble/:pluginId/submit', async (request, reply) => {
      const { pluginId } = request.params as { pluginId: string };
      const { track, playedDuration, timestamp } = request.body as {
        track: { title: string; artist: string; album?: string; duration: number };
        playedDuration: number;
        timestamp: number;
      };

      const addon = this.registry.get(pluginId) as any;
      if (!addon) {
        return reply.code(404).send({ error: 'Scrobbler plugin not found' });
      }

      if (!addon.scrobble) {
        return reply.code(400).send({ error: 'Plugin does not support scrobbling' });
      }

      try {
        const success = await addon.scrobble({
          track,
          playedDuration,
          timestamp: new Date(timestamp * 1000)
        });
        return { success };
      } catch (error) {
        console.error(`[Scrobble] Error submitting to ${pluginId}:`, error);
        return { success: false, error: String(error) };
      }
    });

    // Update now playing status
    this.fastify.post('/api/scrobble/:pluginId/now-playing', async (request, reply) => {
      const { pluginId } = request.params as { pluginId: string };
      const { track } = request.body as {
        track: { title: string; artist: string; album?: string; duration: number };
      };

      console.log(`[Scrobble] Now playing request: ${pluginId} - ${track?.title}`);

      const addon = this.registry.get(pluginId) as any;
      if (!addon) {
        console.log(`[Scrobble] Plugin not found: ${pluginId}`);
        return reply.code(404).send({ error: 'Scrobbler plugin not found' });
      }

      if (!addon.updateNowPlaying) {
        return reply.code(400).send({ error: 'Plugin does not support now playing' });
      }

      // Check if plugin has token set
      if (addon.isAuthenticated && !addon.isAuthenticated()) {
        return { success: false, error: 'Not authenticated - please set token in plugin settings' };
      }

      try {
        const success = await addon.updateNowPlaying({ track });
        return { success };
      } catch (error) {
        console.error(`[Scrobble] Error updating now playing for ${pluginId}:`, error);
        return { success: false, error: String(error) };
      }
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

    // Debug endpoint for persistence verification
    this.fastify.get('/api/debug/persistence', async () => {
      try {
        const libraryStats = this.libraryDb.getStats();
        const mlStorageVerification = await mlService.verifyStorage();
        const mlStatus = mlService.getStatus();

        return {
          timestamp: Date.now(),
          library: {
            status: 'ok',
            stats: libraryStats,
            databasePath: this.config.storage.database
          },
          ml: {
            status: mlStorageVerification.success ? 'ok' : 'error',
            storageVerification: mlStorageVerification,
            serviceStatus: mlStatus
          }
        };
      } catch (error) {
        console.error('[Debug] Persistence check failed:', error);
        return {
          timestamp: Date.now(),
          error: String(error),
          library: { status: 'error' },
          ml: { status: 'error' }
        };
      }
    });

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

    // Listen history for stats page
    this.fastify.get('/api/stats/history', async (request) => {
      const { limit } = request.query as { limit?: string };
      const entries = this.trackingService.getListenHistory(parseInt(limit || '50', 10));
      return { entries };
    });

    // Refresh stats
    this.fastify.post('/api/stats/refresh', async () => {
      this.statsService.refreshAggregates();
      return { success: true };
    });

    // Combined stats by period (for UI StatsSnapshot)
    this.fastify.get('/api/stats/:period', async (request) => {
      const { period } = request.params as { period: 'week' | 'month' | 'year' | 'all' };
      const validPeriods = ['week', 'month', 'year', 'all'];
      if (!validPeriods.includes(period)) {
        return { error: 'Invalid period' };
      }

      // Get listening stats for the period
      const listening = this.statsService.getListeningStats(period);
      const patterns = this.statsService.getListeningPatterns();
      const streaks = this.statsService.getStreaks();
      const topArtists = this.statsService.getTopArtists(10, period);
      const topGenres = this.statsService.getTopGenres(10, period);

      // Transform to StatsSnapshot format expected by UI
      return {
        period,
        totalListenTime: Math.round(listening.listenTime / 1000), // Convert ms to seconds
        totalTracks: listening.playCount,
        uniqueTracks: listening.uniqueTracks,
        uniqueArtists: listening.uniqueArtists,
        topArtists: topArtists.map(a => ({
          artistId: a.id,
          artistName: a.name,
          artwork: a.artwork,
          playCount: a.count,
          totalDuration: Math.round(a.duration / 1000),
          lastPlayed: Date.now()
        })),
        topGenres: topGenres.map(g => ({
          genre: g.name,
          playCount: g.count,
          totalDuration: 0
        })),
        dailyStats: listening.dailyData.map(d => ({
          date: d.date,
          playCount: d.plays,
          totalDuration: Math.round(d.duration / 1000),
          uniqueTracks: 0,
          uniqueArtists: 0
        })),
        hourlyDistribution: patterns.hourlyDistribution.map((count, hour) => ({
          hour,
          playCount: count
        })),
        dayOfWeekDistribution: patterns.dailyDistribution.map((count, day) => ({
          day,
          playCount: count
        })),
        currentStreak: streaks.current,
        longestStreak: streaks.longest
      };
    });

    // Clear stats
    this.fastify.delete('/api/stats', async () => {
      // Clear tracking events (keep structure but remove data)
      const db = (this.libraryDb as any).db;
      db.prepare('DELETE FROM tracking_events').run();
      db.prepare('DELETE FROM tracking_sessions').run();
      db.prepare('DELETE FROM stats_daily').run();
      db.prepare('DELETE FROM track_stats').run();
      db.prepare('DELETE FROM artist_stats').run();
      this.statsService.clearCache();
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
              // Transform SDK LyricsResult to client format
              // SDK uses: { plain, synced, _rawSynced, source }
              // Client expects: { plainLyrics, syncedLyrics, duration }
              return {
                plainLyrics: lyrics.plain || null,
                syncedLyrics: lyrics._rawSynced || null, // Raw LRC string for client parsing
                duration: duration ? parseInt(duration, 10) : null,
                source: lyrics.source
              };
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
          // Try getArtistVideos (SDK standard) or getVideos (legacy)
          const videoMethod = provider.getArtistVideos || provider.getVideos;
          if (videoMethod) {
            const videos = await videoMethod.call(provider, decodeURIComponent(artistName), parseInt(limit || '10', 10));
            if (videos && videos.length > 0) {
              return { success: true, data: videos, source: provider.manifest?.id || provider.id };
            }
          }
        }
        return { success: true, data: [] };
      } catch (error) {
        console.error('[Enrichment] Videos error:', error);
        return reply.code(500).send({ success: false, error: 'Failed to fetch videos' });
      }
    });

    // Album videos endpoint
    this.fastify.get('/api/enrichment/album-videos/:artistName/:albumTitle', async (request, reply) => {
      const { artistName, albumTitle } = request.params as { artistName: string; albumTitle: string };
      const { limit, trackNames } = request.query as { limit?: string; trackNames?: string };

      const providers = (this.registry as any).getArtistEnrichmentProvidersByType?.('videos') || [];
      if (providers.length === 0) {
        return { success: false, data: [], error: 'No video provider available' };
      }

      try {
        const trackList = trackNames ? trackNames.split(',').map(t => t.trim()) : undefined;

        for (const provider of providers) {
          if (provider.getAlbumVideos) {
            const videos = await provider.getAlbumVideos(
              decodeURIComponent(albumTitle),
              decodeURIComponent(artistName),
              trackList,
              parseInt(limit || '8', 10)
            );
            if (videos && videos.length > 0) {
              return { success: true, data: videos, source: provider.manifest?.id || provider.id };
            }
          }
        }
        return { success: true, data: [] };
      } catch (error) {
        console.error('[Enrichment] Album videos error:', error);
        return reply.code(500).send({ success: false, error: 'Failed to fetch album videos' });
      }
    });

    // Video stream endpoint
    this.fastify.get('/api/enrichment/video-stream/:videoId', async (request, reply) => {
      const { videoId } = request.params as { videoId: string };
      const { source, quality } = request.query as { source?: string; quality?: string };

      const providers = (this.registry as any).getArtistEnrichmentProvidersByType?.('videos') || [];
      if (providers.length === 0) {
        return reply.code(404).send({ error: 'No video provider available' });
      }

      try {
        for (const provider of providers) {
          // If source specified, only use that provider
          if (source && (provider.manifest?.id || provider.id) !== source) {
            continue;
          }

          if (provider.getVideoStream) {
            const stream = await provider.getVideoStream(decodeURIComponent(videoId), quality || '720p');
            if (stream) {
              return { success: true, data: stream, source: provider.manifest?.id || provider.id };
            }
          }
        }
        return reply.code(404).send({ error: 'Video stream not found' });
      } catch (error) {
        console.error('[Enrichment] Video stream error:', error);
        return reply.code(500).send({ error: 'Failed to get video stream' });
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
          // Try getArtistGallery (SDK standard) or getGallery (legacy)
          const galleryMethod = provider.getArtistGallery || provider.getGallery;
          if (galleryMethod) {
            const gallery = await galleryMethod.call(provider, mbid || '', decodeURIComponent(artistName));
            if (gallery) {
              return { success: true, data: gallery, source: provider.manifest?.id || provider.id };
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

    // ========================================
    // Logs API (for admin dashboard)
    // ========================================

    // Get recent logs
    this.fastify.get('/api/logs', async (request) => {
      const { count, level, service } = request.query as {
        count?: string;
        level?: string;
        service?: string;
      };

      const logs = logService.getRecent(
        parseInt(count || '100', 10),
        {
          level: level as any,
          service
        }
      );

      return {
        logs,
        stats: logService.getStats()
      };
    });

    // Clear logs
    this.fastify.post('/api/logs/clear', async () => {
      logService.clear();
      return { success: true };
    });

    // WebSocket for real-time log streaming
    this.fastify.get('/api/logs/stream', { websocket: true }, (socket) => {
      const handler = (entry: any) => {
        try {
          socket.send(JSON.stringify({ type: 'log', data: entry }));
        } catch {
          // Socket closed
        }
      };

      const clearHandler = () => {
        try {
          socket.send(JSON.stringify({ type: 'clear' }));
        } catch {
          // Socket closed
        }
      };

      logService.on('log', handler);
      logService.on('clear', clearHandler);

      socket.on('close', () => {
        logService.off('log', handler);
        logService.off('clear', clearHandler);
      });

      // Send initial logs
      const initialLogs = logService.getRecent(50);
      socket.send(JSON.stringify({ type: 'initial', data: initialLogs }));
    });

    // ========================================
    // Active Sessions API (for admin dashboard)
    // ========================================

    // Get active playback sessions
    this.fastify.get('/api/sessions/active', async () => {
      const sessions = this.trackingService.getActivePlaybackSessions();
      return { sessions };
    });

    // Get specific active session
    this.fastify.get('/api/sessions/active/:sessionId', async (request, reply) => {
      const { sessionId } = request.params as { sessionId: string };
      const session = this.trackingService.getActivePlayback(sessionId);

      if (!session) {
        return reply.code(404).send({ error: 'Session not found' });
      }

      return { session };
    });

    // Update playback position (heartbeat from client)
    this.fastify.post('/api/sessions/active/:sessionId/position', async (request) => {
      const { sessionId } = request.params as { sessionId: string };
      const { position, isPlaying } = request.body as { position: number; isPlaying?: boolean };

      this.trackingService.updatePlaybackPosition(sessionId, position, isPlaying);
      return { success: true };
    });

    // WebSocket for real-time session updates
    this.fastify.get('/api/sessions/live', { websocket: true }, (socket) => {
      const updateHandler = (session: any) => {
        try {
          socket.send(JSON.stringify({ type: 'update', data: session }));
        } catch {
          // Socket closed
        }
      };

      const endHandler = (data: any) => {
        try {
          socket.send(JSON.stringify({ type: 'end', data }));
        } catch {
          // Socket closed
        }
      };

      this.trackingService.on('playback_update', updateHandler);
      this.trackingService.on('playback_end', endHandler);

      socket.on('close', () => {
        this.trackingService.off('playback_update', updateHandler);
        this.trackingService.off('playback_end', endHandler);
      });

      // Send initial active sessions
      const sessions = this.trackingService.getActivePlaybackSessions();
      socket.send(JSON.stringify({ type: 'initial', data: sessions }));
    });

    // ========================================
    // Signal Path API (for admin dashboard)
    // ========================================

    // Get signal path traces
    this.fastify.get('/api/signal-path/traces', async (request) => {
      const { active, limit } = request.query as { active?: string; limit?: string };

      if (active === 'true') {
        return { traces: signalPathService.getActiveTraces() };
      }

      return {
        traces: signalPathService.getAllTraces(parseInt(limit || '50', 10)),
        stats: signalPathService.getStats()
      };
    });

    // Get specific trace
    this.fastify.get('/api/signal-path/trace/:traceId', async (request, reply) => {
      const { traceId } = request.params as { traceId: string };
      const trace = signalPathService.getTrace(traceId);

      if (!trace) {
        return reply.code(404).send({ error: 'Trace not found' });
      }

      return { trace };
    });

    // Get signal path stats
    this.fastify.get('/api/signal-path/stats', async () => {
      return signalPathService.getStats();
    });

    // Clear traces
    this.fastify.post('/api/signal-path/clear', async () => {
      signalPathService.clear();
      return { success: true };
    });

    // WebSocket for real-time signal path updates
    this.fastify.get('/api/signal-path/live', { websocket: true }, (socket) => {
      const startHandler = (trace: any) => {
        try {
          socket.send(JSON.stringify({ type: 'trace_start', data: trace }));
        } catch {
          // Socket closed
        }
      };

      const stepHandler = (data: any) => {
        try {
          socket.send(JSON.stringify({ type: 'step', data }));
        } catch {
          // Socket closed
        }
      };

      const completeHandler = (trace: any) => {
        try {
          socket.send(JSON.stringify({ type: 'trace_complete', data: trace }));
        } catch {
          // Socket closed
        }
      };

      const clearHandler = () => {
        try {
          socket.send(JSON.stringify({ type: 'clear' }));
        } catch {
          // Socket closed
        }
      };

      signalPathService.on('trace_start', startHandler);
      signalPathService.on('step', stepHandler);
      signalPathService.on('trace_complete', completeHandler);
      signalPathService.on('clear', clearHandler);

      socket.on('close', () => {
        signalPathService.off('trace_start', startHandler);
        signalPathService.off('step', stepHandler);
        signalPathService.off('trace_complete', completeHandler);
        signalPathService.off('clear', clearHandler);
      });

      // Send initial state
      const traces = signalPathService.getAllTraces(20);
      socket.send(JSON.stringify({ type: 'initial', data: traces }));
    });

    // ========================================
    // Media Folders API
    // ========================================

    // List all media folders
    this.fastify.get('/api/media/folders', async (request) => {
      const { type } = request.query as { type?: 'audio' | 'video' | 'downloads' };
      return {
        folders: this.mediaFoldersService.getFolders(type)
      };
    });

    // Get single folder
    this.fastify.get('/api/media/folders/:folderId', async (request, reply) => {
      const { folderId } = request.params as { folderId: string };
      const folder = this.mediaFoldersService.getFolder(folderId);
      if (!folder) {
        return reply.code(404).send({ error: 'Folder not found' });
      }
      return { folder };
    });

    // Add new folder
    this.fastify.post('/api/media/folders', async (request) => {
      const { path, type, name, watchEnabled, scanInterval } = request.body as {
        path: string;
        type: 'audio' | 'video' | 'downloads';
        name?: string;
        watchEnabled?: boolean;
        scanInterval?: number | null;
      };

      if (!path || !type) {
        return { success: false, error: 'Path and type are required' };
      }

      const result = this.mediaFoldersService.addFolder(path, type, {
        name,
        watchEnabled,
        scanInterval
      });

      // Auto-scan if it's an audio or video folder
      if (result.success && result.folder && (type === 'audio' || type === 'video')) {
        // Start scan in background
        this.localScannerService.scanFolder(result.folder.id, {
          includeVideos: type === 'video'
        }).catch(err => {
          console.error('[MediaFolders] Auto-scan failed:', err);
        });
      }

      return result;
    });

    // Update folder settings
    this.fastify.patch('/api/media/folders/:folderId', async (request) => {
      const { folderId } = request.params as { folderId: string };
      const { name, watchEnabled, scanInterval } = request.body as {
        name?: string;
        watchEnabled?: boolean;
        scanInterval?: number | null;
      };

      return this.mediaFoldersService.updateFolder(folderId, {
        name,
        watchEnabled,
        scanInterval
      });
    });

    // Remove folder
    this.fastify.delete('/api/media/folders/:folderId', async (request) => {
      const { folderId } = request.params as { folderId: string };
      return this.mediaFoldersService.removeFolder(folderId);
    });

    // Browse filesystem (for folder picker)
    this.fastify.get('/api/media/folders/browse', async (request) => {
      const { path } = request.query as { path?: string };
      return this.mediaFoldersService.browse(path);
    });

    // Get filesystem roots (drives on Windows, / on Unix)
    this.fastify.get('/api/media/folders/roots', async () => {
      return { roots: this.mediaFoldersService.getRoots() };
    });

    // Get tracks in folder
    this.fastify.get('/api/media/folders/:folderId/tracks', async (request, reply) => {
      const { folderId } = request.params as { folderId: string };
      const { limit, offset, isVideo } = request.query as {
        limit?: string;
        offset?: string;
        isVideo?: string;
      };

      const folder = this.mediaFoldersService.getFolder(folderId);
      if (!folder) {
        return reply.code(404).send({ error: 'Folder not found' });
      }

      const tracks = this.mediaFoldersService.getLocalTracks(folderId, {
        limit: limit ? parseInt(limit, 10) : undefined,
        offset: offset ? parseInt(offset, 10) : undefined,
        isVideo: isVideo === 'true' ? true : isVideo === 'false' ? false : undefined
      });

      return { tracks, total: folder.trackCount };
    });

    // ========================================
    // Local Scanning API
    // ========================================

    // Trigger folder scan
    this.fastify.post('/api/media/folders/:folderId/scan', async (request) => {
      const { folderId } = request.params as { folderId: string };
      const { forceRescan, includeVideos, waitForCompletion } = request.body as {
        forceRescan?: boolean;
        includeVideos?: boolean;
        waitForCompletion?: boolean;
      };

      const folder = this.mediaFoldersService.getFolder(folderId);
      if (!folder) {
        return { success: false, error: 'Folder not found' };
      }

      const scanOptions = {
        forceRescan,
        includeVideos: includeVideos ?? (folder.type === 'video')
      };

      // If waitForCompletion is true (default), await the scan
      // Otherwise start in background and return immediately
      if (waitForCompletion !== false) {
        const result = await this.localScannerService.scanFolder(folderId, scanOptions);
        return result;
      } else {
        // Start scan in background, return immediately
        this.localScannerService.scanFolder(folderId, scanOptions).catch(err => {
          console.error('[LocalScanner] Scan failed:', err);
        });
        return { success: true, message: 'Scan started' };
      }
    });

    // Get scan status
    this.fastify.get('/api/media/scan/status', async () => {
      return this.localScannerService.getScanStatus();
    });

    // Abort current scan
    this.fastify.post('/api/media/scan/abort', async () => {
      const aborted = this.localScannerService.abortScan();
      return { success: aborted };
    });

    // Get embedded artwork for track
    this.fastify.get('/api/media/tracks/:trackId/artwork', async (request, reply) => {
      const { trackId } = request.params as { trackId: string };

      const artwork = await this.localScannerService.getEmbeddedArtwork(trackId);
      if (!artwork) {
        return reply.code(404).send({ error: 'Artwork not found' });
      }

      reply.header('Content-Type', artwork.mimeType);
      reply.header('Cache-Control', 'public, max-age=86400');
      return reply.send(artwork.data);
    });

    // WebSocket for real-time scan progress
    this.fastify.get('/api/media/scan/live', { websocket: true }, (socket) => {
      const progressHandler = (progress: any) => {
        try {
          socket.send(JSON.stringify({ type: 'progress', data: progress }));
        } catch {
          // Socket closed
        }
      };

      this.localScannerService.on('scan-progress', progressHandler);

      socket.on('close', () => {
        this.localScannerService.off('scan-progress', progressHandler);
      });

      // Send current status
      const status = this.localScannerService.getScanStatus();
      socket.send(JSON.stringify({ type: 'status', data: status }));
    });

    // ========================================
    // Download API
    // ========================================

    // Start download
    this.fastify.post('/api/media/download', async (request) => {
      const { url, folderId, filename, extension, metadata, sourceType, trackData } = request.body as {
        url: string;
        folderId?: string;
        filename: string;
        extension: string;
        metadata?: {
          title?: string;
          artists?: string[];
          album?: string;
          genre?: string[];
          year?: number;
          artworkUrl?: string;
        };
        sourceType: 'audio' | 'video';
        trackData?: unknown;
      };

      console.log('[API] Download request:', { filename, extension, sourceType, hasUrl: !!url, folderId });

      if (!url || !filename || !extension || !sourceType) {
        console.error('[API] Download missing required fields:', { url: !!url, filename: !!filename, extension: !!extension, sourceType: !!sourceType });
        return { success: false, error: 'Missing required fields' };
      }

      const result = await this.downloadService.startDownload({
        url,
        folderId,
        filename,
        extension,
        metadata,
        sourceType,
        trackData
      });

      console.log('[API] Download result:', result);
      return result;
    });

    // Get active downloads
    this.fastify.get('/api/media/downloads', async () => {
      return {
        active: this.downloadService.getActiveDownloads(),
        queued: this.downloadService.getQueuedDownloads()
      };
    });

    // Get download history
    this.fastify.get('/api/media/downloads/history', async (request) => {
      const { status } = request.query as { status?: string };
      return {
        downloads: this.mediaFoldersService.getDownloads(status)
      };
    });

    // Cancel download
    this.fastify.delete('/api/media/downloads/:downloadId', async (request) => {
      const { downloadId } = request.params as { downloadId: string };
      const cancelled = this.downloadService.cancelDownload(downloadId);
      return { success: cancelled };
    });

    // WebSocket for real-time download progress
    this.fastify.get('/api/media/downloads/live', { websocket: true }, (socket) => {
      const progressHandler = (progress: any) => {
        try {
          socket.send(JSON.stringify({ type: 'progress', data: progress }));
        } catch {
          // Socket closed
        }
      };

      this.downloadService.on('download-progress', progressHandler);

      socket.on('close', () => {
        this.downloadService.off('download-progress', progressHandler);
      });

      // Send current active downloads
      const active = this.downloadService.getActiveDownloads();
      const queued = this.downloadService.getQueuedDownloads();
      socket.send(JSON.stringify({ type: 'initial', data: { active, queued } }));
    });

    // ========================================
    // Folder Watcher API
    // ========================================

    // Get watcher status
    this.fastify.get('/api/media/watcher/status', async () => {
      return {
        ...this.folderWatcherService.getStatus(),
        watchedFolders: this.folderWatcherService.getWatchedFolders()
      };
    });

    // WebSocket for real-time file change events
    this.fastify.get('/api/media/watcher/live', { websocket: true }, (socket) => {
      const changeHandler = (event: any) => {
        try {
          socket.send(JSON.stringify({ type: 'file-change', data: event }));
        } catch {
          // Socket closed
        }
      };

      const errorHandler = (event: any) => {
        try {
          socket.send(JSON.stringify({ type: 'error', data: event }));
        } catch {
          // Socket closed
        }
      };

      this.folderWatcherService.on('file-change', changeHandler);
      this.folderWatcherService.on('watcher-error', errorHandler);

      socket.on('close', () => {
        this.folderWatcherService.off('file-change', changeHandler);
        this.folderWatcherService.off('watcher-error', errorHandler);
      });

      // Send initial status
      const status = this.folderWatcherService.getStatus();
      socket.send(JSON.stringify({ type: 'status', data: status }));
    });

    // ========================================
    // Setup Wizard API
    // ========================================

    // Check setup status
    this.fastify.get('/api/setup/status', async () => {
      const identity = this.authService.getPublicIdentity();
      // Setup is complete if server has been named (not default)
      const isComplete = (identity as any).setupCompleted === true;
      return {
        completed: isComplete,
        serverName: identity.serverName
      };
    });

    // Mark setup as complete
    this.fastify.post('/api/setup/complete', async () => {
      this.authService.markSetupComplete();
      return { success: true };
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
