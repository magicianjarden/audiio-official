/**
 * Audiio Desktop - Electron Main Process
 */

import { app, BrowserWindow, ipcMain, dialog, protocol } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import * as https from 'https';
import * as http from 'http';
import { spawn, type ChildProcess } from 'child_process';
import {
  AddonRegistry,
  SearchOrchestrator,
  TrackResolver,
  PlaybackOrchestrator,
  MetadataOrchestrator,
  getAudioAnalyzer,
  type AudioFeatures,
  type AnalysisOptions
} from '@audiio/core';
import { getLibraryBridge, type LibraryBridge } from './services/library-bridge';
import { PluginLoader } from './services/plugin-loader';
import { mlService } from './services/ml-service';

// Sposify addon - lazy loaded
let sposifyHandlersRegistered = false;

// Demucs server process
let demucsProcess: ChildProcess | null = null;

// Plugin loader
let pluginLoader: PluginLoader;

// Mobile server - lazy loaded
let MobileServer: any = null;
let AuthManager: any = null;
let mobileServer: any = null;
let mobileAuthManager: any = null;
let mobileAccessConfig: any = null;

// Register local-audio as a privileged scheme for media playback
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'local-audio',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true,
      bypassCSP: true
    }
  }
]);

let mainWindow: BrowserWindow | null = null;
let registry: AddonRegistry;
let searchOrchestrator: SearchOrchestrator;
let trackResolver: TrackResolver;
let playbackOrchestrator: PlaybackOrchestrator;
let metadataOrchestrator: MetadataOrchestrator;
let libraryBridge: LibraryBridge;

// Audio analyzer instance
const audioAnalyzer = getAudioAnalyzer();

// Audio features cache (persisted across sessions)
const audioFeaturesCache = new Map<string, AudioFeatures>();

// Plugin folder watcher
let pluginFolderWatcher: fs.FSWatcher | null = null;
let currentPluginFolder: string | null = null;

/**
 * Initialize addon providers using dynamic plugin loading
 */
async function initializeAddons(): Promise<void> {
  registry = new AddonRegistry();
  pluginLoader = new PluginLoader(registry);

  console.log('[Plugins] Starting dynamic plugin discovery...');

  // Load all available plugins (official + user-installed)
  const results = await pluginLoader.loadAllPlugins();

  const loaded = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);

  console.log(`[Plugins] Loaded ${loaded.length} plugins, ${failed.length} not available`);

  // Create orchestrators (they handle empty registry gracefully)
  searchOrchestrator = new SearchOrchestrator(registry);
  trackResolver = new TrackResolver(registry);
  playbackOrchestrator = new PlaybackOrchestrator(trackResolver);
  metadataOrchestrator = new MetadataOrchestrator(registry);

  // Set up karaoke event forwarding if karaoke plugin is loaded
  const karaokePlugin = pluginLoader.getPlugin('karaoke');
  if (karaokePlugin && karaokePlugin.instance) {
    const karaokeInstance = karaokePlugin.instance as any;
    if (typeof karaokeInstance.onFullTrackReady === 'function') {
      karaokeInstance.onFullTrackReady((trackId: string, result: any) => {
        console.log(`[Karaoke] Forwarding full track ready event to renderer: ${trackId}`);
        mainWindow?.webContents.send('karaoke-full-track-ready', { trackId, result });
      });
    }
  }

  console.log('[Plugins] Initialized:', registry.getAllAddonIds());
}

/**
 * Start the Demucs Python server for karaoke processing
 */
function startDemucsServer(): void {
  const serverPath = path.join(__dirname, '../../../demucs-server');

  // Check if server directory exists
  if (!fs.existsSync(serverPath)) {
    console.log('[Demucs] Server directory not found:', serverPath);
    return;
  }

  console.log('[Demucs] Starting server from:', serverPath);

  // Try python3 first, fall back to python
  const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';

  demucsProcess = spawn(pythonCmd, ['server.py'], {
    cwd: serverPath,
    env: { ...process.env, PORT: '8765' },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  demucsProcess.stdout?.on('data', (data: Buffer) => {
    console.log('[Demucs]', data.toString().trim());
  });

  demucsProcess.stderr?.on('data', (data: Buffer) => {
    console.error('[Demucs]', data.toString().trim());
  });

  demucsProcess.on('error', (err) => {
    console.error('[Demucs] Failed to start server:', err.message);
  });

  demucsProcess.on('exit', (code) => {
    console.log('[Demucs] Server exited with code:', code);
    demucsProcess = null;
    // Notify renderer
    mainWindow?.webContents.send('karaoke-availability-change', { available: false });
  });

  // Check server health after a short delay
  setTimeout(async () => {
    try {
      const karaokePlugin = pluginLoader?.getPlugin('karaoke');
      if (karaokePlugin?.instance) {
        const karaokeInstance = karaokePlugin.instance as any;
        if (typeof karaokeInstance.isAvailable === 'function') {
          const available = await karaokeInstance.isAvailable();
          console.log('[Demucs] Server available:', available);
          mainWindow?.webContents.send('karaoke-availability-change', { available });
        }
      }
    } catch {
      // Server not available yet
    }
  }, 3000);
}

/**
 * Initialize ML service
 */
async function initializeMLService(): Promise<void> {
  try {
    console.log('[ML] Initializing ML service...');

    await mlService.initialize({
      storagePath: app.getPath('userData'),
      enableAutoTraining: true,
      algorithmId: 'audiio-algo',
    });

    // Set library provider for ML service
    if (libraryBridge) {
      mlService.setLibraryProvider({
        getAllTracks: () => libraryBridge.getAllTracks(),
        getTrack: (id) => libraryBridge.getTrackById(id),
        getLikedTracks: () => libraryBridge.getLikedTracks(),
        getDislikedTrackIds: () => libraryBridge.getDislikedTrackIds(),
      });
    }

    console.log('[ML] ML service initialized');
  } catch (error) {
    console.error('[ML] Failed to initialize ML service:', error);
    // Don't throw - ML is optional
  }
}

/**
 * Set up ML IPC handlers
 */
function setupMLIPCHandlers(): void {
  // Score a single track
  ipcMain.handle('algo-score-track', async (_event, trackId: string) => {
    try {
      return await mlService.scoreTrack(trackId);
    } catch (error) {
      console.error('[ML] Score track failed:', error);
      return null;
    }
  });

  // Score multiple tracks
  ipcMain.handle('algo-score-batch', async (_event, trackIds: string[]) => {
    try {
      return await mlService.scoreBatch(trackIds);
    } catch (error) {
      console.error('[ML] Score batch failed:', error);
      return [];
    }
  });

  // Get recommendations
  ipcMain.handle('algo-get-recommendations', async (_event, count: number) => {
    try {
      return await mlService.getRecommendations(count);
    } catch (error) {
      console.error('[ML] Get recommendations failed:', error);
      return [];
    }
  });

  // Get similar tracks
  ipcMain.handle('algo-get-similar', async (_event, trackId: string, count: number) => {
    try {
      return await mlService.getSimilarTracks(trackId, count);
    } catch (error) {
      console.error('[ML] Get similar failed:', error);
      return [];
    }
  });

  // Get audio features
  ipcMain.handle('algo-get-features', async (_event, trackId: string) => {
    try {
      return await mlService.getAudioFeatures(trackId);
    } catch (error) {
      console.error('[ML] Get features failed:', error);
      return null;
    }
  });

  // Trigger training
  ipcMain.handle('algo-train', async () => {
    try {
      return await mlService.train();
    } catch (error) {
      console.error('[ML] Training failed:', error);
      return null;
    }
  });

  // Get training status
  ipcMain.handle('algo-training-status', () => {
    return mlService.getTrainingStatus();
  });

  // Record user event
  ipcMain.handle('algo-record-event', async (_event, userEvent: unknown) => {
    try {
      await mlService.recordEvent(userEvent as import('@audiio/ml-sdk').UserEvent);
      return { success: true };
    } catch (error) {
      console.error('[ML] Record event failed:', error);
      return { success: false };
    }
  });

  // Check if algorithm is loaded
  ipcMain.handle('algo-is-loaded', () => {
    return mlService.isAlgorithmLoaded();
  });

  // Update settings
  ipcMain.handle('algo-update-settings', async (_event, settings: Record<string, unknown>) => {
    try {
      mlService.updateSettings(settings);
      return { success: true };
    } catch (error) {
      console.error('[ML] Update settings failed:', error);
      return { success: false };
    }
  });

  // Get settings
  ipcMain.handle('algo-get-settings', () => {
    return mlService.getSettings();
  });
}

/**
 * Create the main application window
 */
function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      preload: path.join(__dirname, 'preload.js')
    },
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    frame: true,
    backgroundColor: '#121212'
  });

  // Add CORS headers for audio streams to enable Web Audio API processing
  // This is needed for vocal removal feature to work with cross-origin audio
  mainWindow.webContents.session.webRequest.onHeadersReceived(
    { urls: ['*://*.googlevideo.com/*', '*://*.youtube.com/*', '*://*.ytimg.com/*'] },
    (details, callback) => {
      const responseHeaders = { ...details.responseHeaders };

      // Add CORS headers to allow Web Audio API access
      responseHeaders['Access-Control-Allow-Origin'] = ['*'];
      responseHeaders['Access-Control-Allow-Methods'] = ['GET, HEAD, OPTIONS'];
      responseHeaders['Access-Control-Allow-Headers'] = ['Range, Content-Type'];
      responseHeaders['Access-Control-Expose-Headers'] = ['Content-Length, Content-Range'];

      callback({ responseHeaders });
    }
  );

  // Load app - check for dev server first
  const devServerUrl = process.env['VITE_DEV_SERVER_URL'] || 'http://localhost:5174';

  if (process.env['NODE_ENV'] === 'development' || process.argv.includes('--dev')) {
    mainWindow.loadURL(devServerUrl);
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
    // Clear library bridge window reference
    if (libraryBridge) {
      libraryBridge.setWindow(null);
    }
  });

  // Set library bridge window reference
  if (libraryBridge) {
    libraryBridge.setWindow(mainWindow);
  }
}

/**
 * Set up IPC handlers for renderer communication
 */
function setupIPCHandlers(): void {
  // Search
  ipcMain.handle('search', async (_event, query: { query: string; type?: string }) => {
    try {
      const result = await searchOrchestrator.search(query.query, {
        limit: 25
      });

      // Return data based on type parameter
      switch (query.type) {
        case 'artist':
          // Return artists from the search result
          return result.artists || [];
        case 'album':
          // Return albums from the search result
          return result.albums || [];
        case 'track':
        default:
          // Return tracks for track type or default
          return result.tracks;
      }
    } catch (error) {
      console.error('Search error:', error);
      throw error;
    }
  });

  // Play track
  ipcMain.handle('play-track', async (_event, track) => {
    try {
      const streamInfo = await playbackOrchestrator.play(track);
      return streamInfo;
    } catch (error) {
      console.error('Play error:', error);
      throw error;
    }
  });

  // Pause
  ipcMain.handle('pause', () => {
    playbackOrchestrator.pause();
  });

  // Resume
  ipcMain.handle('resume', () => {
    playbackOrchestrator.resume();
  });

  // Seek
  ipcMain.handle('seek', (_event, position: number) => {
    playbackOrchestrator.seek(position);
  });

  // Get playback state
  ipcMain.handle('get-playback-state', () => {
    return playbackOrchestrator.getState();
  });

  // Plugin management
  ipcMain.handle('get-addons', () => {
    const addonIds = registry.getAllAddonIds();
    return addonIds.map(id => {
      const addon = registry.get(id);
      return {
        id,
        name: addon?.manifest.name || id,
        roles: addon?.manifest.roles || [],
        enabled: addon !== null
      };
    });
  });

  // Get loaded plugins with full details
  ipcMain.handle('get-loaded-plugins', () => {
    if (!pluginLoader) {
      return [];
    }
    return pluginLoader.getLoadedPlugins().map(plugin => ({
      id: plugin.manifest.id,
      name: plugin.manifest.name,
      version: plugin.manifest.version,
      description: plugin.manifest.description,
      roles: plugin.manifest.roles,
      source: plugin.source,
      packageName: plugin.packageName
    }));
  });

  // Reload all plugins
  ipcMain.handle('reload-plugins', async () => {
    if (!pluginLoader) {
      return { success: false, error: 'Plugin loader not initialized' };
    }
    try {
      const results = await pluginLoader.reloadPlugins();
      const loaded = results.filter(r => r.success);
      console.log(`[Plugins] Reloaded ${loaded.length} plugins`);
      return { success: true, loaded: loaded.length };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  // Check if a specific plugin is loaded
  ipcMain.handle('is-plugin-loaded', (_event, pluginId: string) => {
    if (!pluginLoader) {
      return false;
    }
    return pluginLoader.isPluginLoaded(pluginId);
  });

  ipcMain.handle('set-addon-enabled', (_event, { addonId, enabled }: { addonId: string; enabled: boolean }) => {
    console.log(`Setting addon ${addonId} enabled: ${enabled}`);
    registry.setEnabled(addonId, enabled);
    return { success: true, addonId, enabled };
  });

  // Update addon settings
  ipcMain.handle('update-addon-settings', (_event, { addonId, settings }: { addonId: string; settings: Record<string, unknown> }) => {
    console.log(`Updating addon ${addonId} settings:`, settings);

    // Get the addon from registry and update its settings
    const addon = registry.get(addonId) as { updateSettings?: (s: Record<string, unknown>) => void; getSettings?: () => Record<string, unknown> } | null;
    if (addon?.updateSettings) {
      addon.updateSettings(settings);
      return { success: true, addonId, settings: addon.getSettings?.() || settings };
    }

    return { success: false, error: `Unknown addon or addon has no settings: ${addonId}` };
  });

  // Get addon settings
  ipcMain.handle('get-addon-settings', (_event, addonId: string) => {
    const addon = registry.get(addonId) as { getSettings?: () => Record<string, unknown> } | null;
    if (addon?.getSettings) {
      return addon.getSettings();
    }
    return null;
  });

  // Set addon priority
  ipcMain.handle('set-addon-priority', (_event, { addonId, priority }: { addonId: string; priority: number }) => {
    console.log(`Setting addon ${addonId} priority: ${priority}`);
    registry.setAddonPriority(addonId, priority);
    return { success: true, addonId, priority };
  });

  // Set addon order (bulk reorder from DnD)
  ipcMain.handle('set-addon-order', (_event, orderedIds: string[]) => {
    console.log('Setting addon order:', orderedIds);
    registry.setAddonOrder(orderedIds);
    return { success: true, order: orderedIds };
  });

  // Get current addon priorities
  ipcMain.handle('get-addon-priorities', () => {
    const priorities = registry.getAddonPriorities();
    return Object.fromEntries(priorities);
  });

  // Get animated artwork for a track (triggers MP4 conversion)
  ipcMain.handle('get-animated-artwork', async (_event, { album, artist, track }: { album: string; artist: string; track?: string }) => {
    try {
      // Get Apple Music provider from plugin loader
      const appleMusicPlugin = pluginLoader?.getPlugin('applemusic-artwork');
      if (!appleMusicPlugin?.instance) {
        return null;
      }

      // Check if provider is enabled in registry
      const provider = registry.get('applemusic-artwork');
      if (!provider) {
        console.log('Apple Music artwork provider is disabled');
        return null;
      }

      // Get animated artwork and convert to MP4
      const appleMusicInstance = appleMusicPlugin.instance as any;
      if (typeof appleMusicInstance.getAnimatedArtworkAsMP4 !== 'function') {
        return null;
      }

      const result = await appleMusicInstance.getAnimatedArtworkAsMP4(
        { album, artist, track },
        { returnBuffer: false, cleanup: false }
      );

      if (result && result.mp4Path) {
        return {
          videoUrl: `file://${result.mp4Path}`,
          aspectRatio: result.aspectRatio,
          previewFrame: result.previewFrameUrl || result.staticUrl,
          hasAudio: false,
          albumId: result.albumId
        };
      }

      return null;
    } catch (error) {
      console.error('Get animated artwork error:', error);
      return null;
    }
  });

  // Artist details
  ipcMain.handle('get-artist', async (_event, { id, source }: { id: string; source?: string }) => {
    try {
      return await metadataOrchestrator.getArtist(id, source);
    } catch (error) {
      console.error('Get artist error:', error);
      throw error;
    }
  });

  // Album details
  ipcMain.handle('get-album', async (_event, { id, source }: { id: string; source?: string }) => {
    try {
      return await metadataOrchestrator.getAlbum(id, source);
    } catch (error) {
      console.error('Get album error:', error);
      throw error;
    }
  });

  // Trending content - uses metadata orchestrator for charts
  ipcMain.handle('get-trending', async () => {
    try {
      const charts = await metadataOrchestrator.getCharts(20);
      console.log(`[Trending] Fetched ${charts.tracks.length} tracks, ${charts.artists.length} artists, ${charts.albums.length} albums`);
      return charts;
    } catch (error) {
      console.error('Get trending error:', error);
      return { tracks: [], artists: [], albums: [] };
    }
  });

  // Similar albums
  ipcMain.handle('get-similar-albums', async (_event, { albumId, source }: { albumId: string; source?: string }) => {
    try {
      return await metadataOrchestrator.getSimilarAlbums(albumId, source, 10);
    } catch (error) {
      console.error('Get similar albums error:', error);
      return [];
    }
  });

  // Similar tracks
  ipcMain.handle('get-similar-tracks', async (_event, { trackId, source }: { trackId: string; source?: string }) => {
    try {
      return await metadataOrchestrator.getSimilarTracks(trackId, source, 15);
    } catch (error) {
      console.error('Get similar tracks error:', error);
      return [];
    }
  });

  // Prefetch tracks - pre-resolve streams for upcoming queue tracks
  ipcMain.handle('prefetch-tracks', async (_event, tracks: any[]) => {
    try {
      if (!tracks || tracks.length === 0) {
        return {};
      }

      console.log(`[Prefetch] Pre-resolving ${tracks.length} tracks`);
      const results = await trackResolver.resolveStreamsForTracks(tracks);

      // Convert Map to plain object for IPC serialization
      const serialized: Record<string, any> = {};
      results.forEach((streamInfo, trackId) => {
        if (streamInfo) {
          serialized[trackId] = streamInfo;
        }
      });

      console.log(`[Prefetch] Resolved ${Object.keys(serialized).length}/${tracks.length} streams`);
      return serialized;
    } catch (error) {
      console.error('Prefetch tracks error:', error);
      return {};
    }
  });

  // Artist latest release
  ipcMain.handle('get-artist-latest-release', async (_event, { artistId, source }: { artistId: string; source?: string }) => {
    try {
      // Get artist from orchestrator
      const artist = await metadataOrchestrator.getArtist(artistId, source);
      if (artist?.name) {
        const result = await searchOrchestrator.search(`${artist.name} new album 2024`, { limit: 5 });
        if (result.albums && result.albums.length > 0) {
          return result.albums[0];
        }
      }
      return null;
    } catch (error) {
      console.error('Get artist latest release error:', error);
      return null;
    }
  });

  // Recommended tracks based on artist or genre
  ipcMain.handle('get-recommended-tracks', async (_event, { basedOn, id }: { basedOn: 'artist' | 'genre'; id: string }) => {
    try {
      if (basedOn === 'artist') {
        // First try to get artist's top tracks if we have their ID
        // Then search for related artist tracks
        const artistResult = await searchOrchestrator.search(`${id}`, { limit: 5 });

        // Also get tracks "fans also like"
        const similarResult = await searchOrchestrator.search(`${id} fans also like`, { limit: 15 });

        // Combine results, prioritizing direct artist tracks
        const tracks = [...artistResult.tracks.slice(0, 5), ...similarResult.tracks];
        // Remove duplicates by ID
        const seen = new Set<string>();
        const uniqueTracks = tracks.filter(t => {
          if (seen.has(t.id)) return false;
          seen.add(t.id);
          return true;
        });
        return uniqueTracks.slice(0, 20);
      } else if (basedOn === 'genre') {
        // Search for top tracks in genre
        const result = await searchOrchestrator.search(`${id} hits`, { limit: 20 });
        return result.tracks;
      }
      return [];
    } catch (error) {
      console.error('Get recommended tracks error:', error);
      return [];
    }
  });

  // =============================================
  // Lyrics Handler
  // =============================================

  // Get lyrics for a track
  ipcMain.handle('get-lyrics', async (_event, { title, artist, album, duration }: { title: string; artist: string; album?: string; duration?: number }) => {
    try {
      // Get lyrics provider from plugin loader
      const lrclibPlugin = pluginLoader?.getPlugin('lrclib-lyrics');
      if (!lrclibPlugin?.instance) {
        // Try to get any lyrics provider from registry
        const providers = registry.getLyricsProviders();
        if (providers.length === 0) {
          return null;
        }
        // Use first available lyrics provider
        const firstProvider = providers[0];
        if (!firstProvider) {
          return null;
        }
        return await firstProvider.getLyrics({ title, artist, album, duration });
      }

      const lrclibInstance = lrclibPlugin.instance as any;
      if (typeof lrclibInstance.getLyrics !== 'function') {
        return null;
      }

      const lyrics = await lrclibInstance.getLyrics({
        title,
        artist,
        album,
        duration
      });

      return lyrics;
    } catch (error) {
      console.error('Get lyrics error:', error);
      return null;
    }
  });

  // =============================================
  // Audio Analysis Handlers
  // =============================================

  // Get audio features for a track (from cache or analyze)
  ipcMain.handle('get-audio-features', async (_event, { trackId, streamUrl }: { trackId: string; streamUrl?: string }) => {
    try {
      // Check cache first
      if (audioFeaturesCache.has(trackId)) {
        console.log(`[AudioAnalysis] Cache hit for ${trackId}`);
        return audioFeaturesCache.get(trackId);
      }

      // If no stream URL, try to resolve the track first
      if (!streamUrl) {
        console.log(`[AudioAnalysis] No stream URL for ${trackId}, returning null`);
        return null;
      }

      // Analyze the audio stream
      console.log(`[AudioAnalysis] Analyzing ${trackId}...`);
      const features = await audioAnalyzer.analyzeUrl(streamUrl, {
        maxDuration: 45,      // Analyze 45 seconds
        skipToPosition: 30,   // Start from middle of song
        analyzeBpm: true,
        analyzeKey: true,
        analyzeEnergy: true,
        analyzeVocals: true
      });

      if (features) {
        // Cache the result
        audioFeaturesCache.set(trackId, features);
        console.log(`[AudioAnalysis] Completed for ${trackId}:`, {
          bpm: features.bpm,
          key: features.key,
          mode: features.mode,
          energy: features.energy?.toFixed(2)
        });
        return features;
      }

      return null;
    } catch (error) {
      console.error('[AudioAnalysis] Error:', error);
      return null;
    }
  });

  // Analyze audio from a file path
  ipcMain.handle('analyze-audio-file', async (_event, { filePath, options }: { filePath: string; options?: AnalysisOptions }) => {
    try {
      const features = await audioAnalyzer.analyzeFile(filePath, options);
      return features;
    } catch (error) {
      console.error('[AudioAnalysis] File analysis error:', error);
      return null;
    }
  });

  // Analyze audio from a URL
  ipcMain.handle('analyze-audio-url', async (_event, { url, options }: { url: string; options?: AnalysisOptions }) => {
    try {
      const features = await audioAnalyzer.analyzeUrl(url, options);
      return features;
    } catch (error) {
      console.error('[AudioAnalysis] URL analysis error:', error);
      return null;
    }
  });

  // Set audio features for a track (from plugin or external source)
  ipcMain.handle('set-audio-features', (_event, { trackId, features }: { trackId: string; features: AudioFeatures }) => {
    audioFeaturesCache.set(trackId, features);
    console.log(`[AudioAnalysis] Set features for ${trackId} from external source`);
    return { success: true };
  });

  // Get cached audio features (batch)
  ipcMain.handle('get-cached-audio-features', (_event, trackIds: string[]) => {
    const result: Record<string, AudioFeatures | null> = {};
    for (const id of trackIds) {
      result[id] = audioFeaturesCache.get(id) || null;
    }
    return result;
  });

  // Clear audio features cache
  ipcMain.handle('clear-audio-features-cache', () => {
    audioFeaturesCache.clear();
    audioAnalyzer.clearCache();
    console.log('[AudioAnalysis] Cache cleared');
    return { success: true };
  });

  // Check if audio analyzer is available (FFmpeg check)
  ipcMain.handle('check-audio-analyzer', async () => {
    const available = await audioAnalyzer.checkFFmpegAvailable();
    return {
      available,
      cacheSize: audioFeaturesCache.size
    };
  });

  // =============================================
  // Download Handler
  // =============================================

  ipcMain.handle('download-track', async (_event, track: { id: string; title: string; artists: { name: string }[] }) => {
    try {
      console.log(`[Download] Starting download for: ${track.title}`);

      // Get downloads directory
      const downloadsDir = path.join(app.getPath('downloads'), 'Audiio');
      if (!fs.existsSync(downloadsDir)) {
        fs.mkdirSync(downloadsDir, { recursive: true });
      }

      // Sanitize filename
      const artistName = track.artists[0]?.name || 'Unknown Artist';
      const sanitizedTitle = track.title.replace(/[<>:"/\\|?*]/g, '_');
      const sanitizedArtist = artistName.replace(/[<>:"/\\|?*]/g, '_');
      const filename = `${sanitizedArtist} - ${sanitizedTitle}.mp3`;
      const filePath = path.join(downloadsDir, filename);

      // Check if already downloaded
      if (fs.existsSync(filePath)) {
        console.log(`[Download] File already exists: ${filePath}`);
        mainWindow?.webContents.send('download-progress', {
          trackId: track.id,
          progress: 100,
          status: 'completed',
          filePath
        });
        return { success: true, filePath };
      }

      // Resolve stream URL using track resolver
      const streamInfo = await trackResolver.resolveStream(track as any);
      if (!streamInfo?.url) {
        throw new Error('Could not resolve stream URL');
      }

      console.log(`[Download] Got stream URL for: ${track.title}`);

      // Send initial progress
      mainWindow?.webContents.send('download-progress', {
        trackId: track.id,
        progress: 0,
        status: 'downloading'
      });

      // Download the file
      await downloadFile(streamInfo.url, filePath, (progress) => {
        mainWindow?.webContents.send('download-progress', {
          trackId: track.id,
          progress,
          status: 'downloading'
        });
      });

      console.log(`[Download] Completed: ${filePath}`);

      // Send completion
      mainWindow?.webContents.send('download-progress', {
        trackId: track.id,
        progress: 100,
        status: 'completed',
        filePath
      });

      return { success: true, filePath };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Download failed';
      console.error('[Download] Error:', errorMessage);

      // Send failure
      mainWindow?.webContents.send('download-progress', {
        trackId: track.id,
        progress: 0,
        status: 'failed',
        error: errorMessage
      });

      return { success: false, error: errorMessage };
    }
  });

  // =============================================
  // Mobile Access Handlers
  // =============================================

  // Get current mobile access status
  ipcMain.handle('get-mobile-status', () => {
    return {
      isEnabled: mobileServer !== null,
      accessConfig: mobileAccessConfig,
      sessions: mobileServer?.getSessions() || [],
      enableRemoteAccess: mobileAccessConfig?.tunnelUrl !== undefined
    };
  });

  // Enable mobile access
  ipcMain.handle('enable-mobile-access', async () => {
    console.log('[Mobile] enable-mobile-access called');
    try {
      // Lazy load the mobile server module using dynamic import
      if (!MobileServer) {
        console.log('[Mobile] Loading MobileServer module...');
        try {
          // Try require first (for CommonJS)
          const mobileModule = require('@audiio/mobile');
          MobileServer = mobileModule.MobileServer;
          AuthManager = mobileModule.AuthManager;
          console.log('[Mobile] Loaded via require');
        } catch (requireError) {
          console.log('[Mobile] require failed, trying dynamic import...');
          // Fall back to dynamic import for ESM
          const mobileModule = await import('@audiio/mobile');
          MobileServer = mobileModule.MobileServer;
          AuthManager = mobileModule.AuthManager;
          console.log('[Mobile] Loaded via dynamic import');
        }
      }

      if (!MobileServer) {
        console.error('[Mobile] MobileServer class not found in module');
        return { success: false, error: 'MobileServer not available' };
      }

      if (mobileServer) {
        console.log('[Mobile] Server already running');
        return { success: true, accessConfig: mobileAccessConfig };
      }

      // Create AuthManager if not exists
      if (!mobileAuthManager && AuthManager) {
        const dataPath = path.join(app.getPath('userData'), 'mobile');
        console.log('[Mobile] Creating AuthManager with data path:', dataPath);
        mobileAuthManager = new AuthManager({ dataPath, defaultExpirationDays: 30 });
      }

      console.log('[Mobile] Creating new MobileServer instance...');
      mobileServer = new MobileServer({
        config: {
          port: 8484,
          enableTunnel: false
        },
        orchestrators: {
          search: searchOrchestrator,
          trackResolver,
          playback: playbackOrchestrator,
          registry,
          metadata: metadataOrchestrator,
          authManager: mobileAuthManager,
          libraryBridge,
          mlService
        },
        onReady: (access: any) => {
          console.log('[Mobile] onReady callback fired');
          mobileAccessConfig = access;
          // Notify renderer of status change
          mainWindow?.webContents.send('mobile-status-change', {
            isEnabled: true,
            accessConfig: access
          });
        }
      });

      console.log('[Mobile] Starting server...');
      const access = await mobileServer.start();
      mobileAccessConfig = access;

      // Set up device approval callback
      mobileServer.onDeviceApprovalRequest((request: { id: string; deviceName: string; userAgent: string }) => {
        console.log(`[Mobile] Device approval requested: ${request.deviceName}`);
        // Send to renderer to show approval dialog
        mainWindow?.webContents.send('mobile-device-approval-request', request);
      });

      // Set up relay event handlers
      if (mobileServer.onRelayPeerJoined) {
        mobileServer.onRelayPeerJoined((peer: { id: string; deviceName: string; publicKey: string }) => {
          console.log(`[Relay] Peer joined: ${peer.deviceName}`);
          mainWindow?.webContents.send('relay-peer-joined', peer);
        });
      }

      console.log('[Mobile] Server started successfully:', access.localUrl);
      console.log('[Mobile] Relay active:', access.relayActive || false);
      console.log('[Mobile] Relay code:', access.relayCode || 'N/A');
      console.log('[Mobile] QR Code available:', !!access.qrCode);

      return { success: true, accessConfig: access };
    } catch (error) {
      console.error('[Mobile] Failed to start server:', error);
      mobileServer = null;
      return { success: false, error: String(error) };
    }
  });

  // Disable mobile access
  ipcMain.handle('disable-mobile-access', async () => {
    try {
      if (mobileServer) {
        await mobileServer.stop();
        mobileServer = null;
        mobileAccessConfig = null;

        mainWindow?.webContents.send('mobile-status-change', {
          isEnabled: false,
          accessConfig: null
        });

        console.log('[Mobile] Server stopped');
      }
      return { success: true };
    } catch (error) {
      console.error('[Mobile] Failed to stop server:', error);
      return { success: false, error: String(error) };
    }
  });

  // Toggle remote access (tunnel)
  ipcMain.handle('set-mobile-remote-access', async (_event, enable: boolean) => {
    if (!mobileServer) {
      return { success: false, error: 'Mobile server not running' };
    }

    try {
      // Need to restart server with tunnel enabled/disabled
      await mobileServer.stop();

      mobileServer = new MobileServer({
        config: {
          port: 8484,
          enableTunnel: enable
        },
        orchestrators: {
          search: searchOrchestrator,
          trackResolver,
          playback: playbackOrchestrator,
          registry,
          metadata: metadataOrchestrator,
          authManager: mobileAuthManager,
          libraryBridge,
          mlService
        }
      });

      const access = await mobileServer.start();
      mobileAccessConfig = access;

      mainWindow?.webContents.send('mobile-status-change', {
        isEnabled: true,
        accessConfig: access
      });

      console.log('[Mobile] Remote access:', enable ? 'enabled' : 'disabled');

      return { success: true, accessConfig: access };
    } catch (error) {
      console.error('[Mobile] Failed to toggle remote access:', error);
      return { success: false, error: String(error) };
    }
  });

  // Regenerate access token
  ipcMain.handle('regenerate-mobile-token', async () => {
    if (!mobileServer) {
      return { success: false, error: 'Mobile server not running' };
    }

    try {
      // Get current config and regenerate
      const currentConfig = mobileServer.getAccessConfig();
      if (!currentConfig) {
        return { success: false, error: 'No access config' };
      }

      // Restart server to generate new token
      const enableTunnel = !!currentConfig.tunnelUrl;
      await mobileServer.stop();

      mobileServer = new MobileServer({
        config: {
          port: 8484,
          enableTunnel
        },
        orchestrators: {
          search: searchOrchestrator,
          trackResolver,
          playback: playbackOrchestrator,
          registry,
          metadata: metadataOrchestrator,
          authManager: mobileAuthManager,
          libraryBridge,
          mlService
        }
      });

      const access = await mobileServer.start();
      mobileAccessConfig = access;

      mainWindow?.webContents.send('mobile-status-change', {
        isEnabled: true,
        accessConfig: access
      });

      console.log('[Mobile] Token regenerated');

      return { success: true, accessConfig: access };
    } catch (error) {
      console.error('[Mobile] Failed to regenerate token:', error);
      return { success: false, error: String(error) };
    }
  });

  // Disconnect a mobile session
  ipcMain.handle('disconnect-mobile-session', async (_event, sessionId: string) => {
    if (!mobileServer) {
      return { success: false, error: 'Mobile server not running' };
    }

    try {
      // Access session manager through server
      // Session disconnection would be handled by the mobile server
      console.log('[Mobile] Disconnecting session:', sessionId);
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  // ========================================
  // Mobile Device Approval Handlers
  // ========================================

  // Approve a device pairing request
  ipcMain.handle('approve-mobile-device', async (_event, requestId: string) => {
    if (!mobileServer) {
      return { success: false, error: 'Mobile server not running' };
    }

    try {
      const approved = mobileServer.approveDevice(requestId);
      console.log(`[Mobile] Device approval ${requestId}: ${approved ? 'approved' : 'not found'}`);
      return { success: approved };
    } catch (error) {
      console.error('[Mobile] Failed to approve device:', error);
      return { success: false, error: String(error) };
    }
  });

  // Deny a device pairing request
  ipcMain.handle('deny-mobile-device', async (_event, requestId: string) => {
    if (!mobileServer) {
      return { success: false, error: 'Mobile server not running' };
    }

    try {
      const denied = mobileServer.denyDevice(requestId);
      console.log(`[Mobile] Device denial ${requestId}: ${denied ? 'denied' : 'not found'}`);
      return { success: denied };
    } catch (error) {
      console.error('[Mobile] Failed to deny device:', error);
      return { success: false, error: String(error) };
    }
  });

  // Get pending approval requests
  ipcMain.handle('get-pending-mobile-approvals', () => {
    if (!mobileServer) {
      return { requests: [] };
    }
    return { requests: mobileServer.getPendingApprovals() };
  });

  // ========================================
  // Mobile Auth Management Handlers
  // ========================================

  // Get current passphrase
  ipcMain.handle('get-mobile-passphrase', () => {
    if (!mobileAuthManager) {
      return { passphrase: null };
    }
    return { passphrase: mobileAuthManager.getCurrentPassphrase() };
  });

  // Regenerate passphrase
  ipcMain.handle('regenerate-mobile-passphrase', () => {
    if (!mobileAuthManager) {
      return { success: false, error: 'Auth manager not available' };
    }
    try {
      const passphrase = mobileAuthManager.regeneratePassphrase();
      // Revoke all devices when passphrase changes
      mobileAuthManager.revokeAllDevices();
      return { success: true, passphrase };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  // Set custom password
  ipcMain.handle('set-mobile-custom-password', (_event, password: string) => {
    if (!mobileAuthManager) {
      return { success: false, error: 'Auth manager not available' };
    }
    try {
      const result = mobileAuthManager.setCustomPassword(password);
      if (result.success) {
        // Revoke all devices when password changes
        mobileAuthManager.revokeAllDevices();
      }
      return result;
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  // Remove custom password (revert to passphrase)
  ipcMain.handle('remove-mobile-custom-password', () => {
    if (!mobileAuthManager) {
      return { success: false, error: 'Auth manager not available' };
    }
    try {
      mobileAuthManager.removeCustomPassword();
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  // Get authorized devices
  ipcMain.handle('get-mobile-devices', () => {
    if (!mobileAuthManager) {
      return { devices: [] };
    }
    try {
      const devices = mobileAuthManager.listDevices();
      return {
        devices: devices.map((d: any) => ({
          id: d.id,
          name: d.name,
          createdAt: d.createdAt?.toISOString(),
          lastAccessAt: d.lastAccessAt?.toISOString(),
          expiresAt: d.expiresAt?.toISOString() || null
        }))
      };
    } catch (error) {
      return { devices: [] };
    }
  });

  // Revoke a device
  ipcMain.handle('revoke-mobile-device', (_event, deviceId: string) => {
    if (!mobileAuthManager) {
      return { success: false, error: 'Auth manager not available' };
    }
    try {
      const success = mobileAuthManager.revokeDevice(deviceId);
      return { success };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  // Revoke all devices
  ipcMain.handle('revoke-all-mobile-devices', () => {
    if (!mobileAuthManager) {
      return { success: false, error: 'Auth manager not available' };
    }
    try {
      const count = mobileAuthManager.revokeAllDevices();
      return { success: true, count };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  // Get auth settings
  ipcMain.handle('get-mobile-auth-settings', () => {
    if (!mobileAuthManager) {
      return {
        useCustomPassword: false,
        defaultExpirationDays: 30,
        requirePasswordEveryTime: false
      };
    }
    try {
      return mobileAuthManager.getSettings();
    } catch (error) {
      return {
        useCustomPassword: false,
        defaultExpirationDays: 30,
        requirePasswordEveryTime: false
      };
    }
  });

  // Update auth settings
  ipcMain.handle('update-mobile-auth-settings', (_event, settings: { defaultExpirationDays?: number | null; requirePasswordEveryTime?: boolean }) => {
    if (!mobileAuthManager) {
      return { success: false, error: 'Auth manager not available' };
    }
    try {
      mobileAuthManager.updateSettings(settings);
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  // Rename a device
  ipcMain.handle('rename-mobile-device', (_event, deviceId: string, name: string) => {
    if (!mobileAuthManager) {
      return { success: false, error: 'Auth manager not available' };
    }
    try {
      const success = mobileAuthManager.renameDevice(deviceId, name);
      return { success };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  // ========================================
  // Relay Management Handlers
  // ========================================

  // Get relay status and info
  ipcMain.handle('get-relay-status', () => {
    if (!mobileServer) {
      return {
        isActive: false,
        code: null,
        peers: [],
        mode: 'embedded'
      };
    }

    const relayInfo = mobileServer.getRelayInfo?.();
    return {
      isActive: mobileServer.isRelayActive?.() || false,
      code: relayInfo?.code || null,
      publicKey: relayInfo?.publicKey || null,
      peers: relayInfo?.peers || [],
      mode: 'embedded'
    };
  });

  // Get relay connection code
  ipcMain.handle('get-relay-code', () => {
    if (!mobileServer) {
      return { code: null };
    }
    return { code: mobileServer.getRelayCode?.() || null };
  });

  // Get connected relay peers
  ipcMain.handle('get-relay-peers', () => {
    if (!mobileServer) {
      return { peers: [] };
    }
    return { peers: mobileServer.getRelayPeers?.() || [] };
  });

  // Approve a relay peer
  ipcMain.handle('approve-relay-peer', (_event, peerId: string) => {
    if (!mobileServer) {
      return { success: false, error: 'Mobile server not running' };
    }
    try {
      mobileServer.approveRelayPeer?.(peerId);
      console.log(`[Relay] Approved peer: ${peerId}`);
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  // Deny a relay peer
  ipcMain.handle('deny-relay-peer', (_event, peerId: string) => {
    if (!mobileServer) {
      return { success: false, error: 'Mobile server not running' };
    }
    try {
      mobileServer.denyRelayPeer?.(peerId);
      console.log(`[Relay] Denied peer: ${peerId}`);
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  // =============================================
  // Translation Handler (CORS-free from main process)
  // Uses MyMemory API (free, reliable) with Lingva fallback
  // =============================================

  ipcMain.handle('translate-text', async (_event, { text, source, target }: { text: string; source: string; target: string }) => {
    const errors: string[] = [];

    // Try MyMemory API first (most reliable free option)
    try {
      const langPair = `${source}|${target}`;
      const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${langPair}`;

      const response = await fetch(url, {
        headers: { 'User-Agent': 'Audiio Music Player' }
      });

      if (response.ok) {
        const data = await response.json() as {
          responseStatus: number;
          responseData: { translatedText: string };
          quotaFinished?: boolean;
        };

        if (data.responseStatus === 200 && data.responseData?.translatedText) {
          if (data.quotaFinished || data.responseData.translatedText.includes('MYMEMORY WARNING')) {
            errors.push('MyMemory: Daily quota exceeded');
          } else {
            return { success: true, translatedText: data.responseData.translatedText };
          }
        } else {
          errors.push(`MyMemory: Status ${data.responseStatus}`);
        }
      } else {
        errors.push(`MyMemory: HTTP ${response.status}`);
      }
    } catch (error) {
      errors.push(`MyMemory: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // Fallback to Lingva (Google Translate frontend)
    const lingvaInstances = ['https://lingva.ml', 'https://translate.plausibility.cloud'];

    for (const instance of lingvaInstances) {
      try {
        const url = `${instance}/api/v1/${source}/${target}/${encodeURIComponent(text)}`;
        const response = await fetch(url);

        if (response.ok) {
          const data = await response.json() as { translation: string };
          if (data.translation) {
            return { success: true, translatedText: data.translation };
          }
        }
        errors.push(`${instance}: HTTP ${response.status}`);
      } catch (error) {
        errors.push(`${instance}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return { success: false, error: errors.join('; ') };
  });

  // =============================================
  // Storage & Local Music Handlers
  // =============================================

  // Select folder dialog
  ipcMain.handle('select-folder', async (_event, options?: { title?: string; defaultPath?: string }) => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      title: options?.title || 'Select Folder',
      defaultPath: options?.defaultPath,
      properties: ['openDirectory', 'createDirectory']
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    return result.filePaths[0];
  });

  // Scan music folder for audio files - returns UnifiedTrack-compatible format
  ipcMain.handle('scan-music-folder', async (_event, folderPath: string) => {
    const audioExtensions = ['.mp3', '.flac', '.wav', '.m4a', '.aac', '.ogg', '.opus', '.wma', '.aiff'];
    const tracks: Array<{
      id: string;
      title: string;
      artists: Array<{ id: string; name: string }>;
      album: { id: string; title: string };
      duration: number;
      artwork?: { small?: string; medium?: string; large?: string };
      streamInfo: {
        url: string;
        format: string;
        quality: string;
        expiresAt: null;
      };
      streamSources: Array<{
        providerId: string;
        trackId: string;
        available: boolean;
      }>;
      _meta: {
        metadataProvider: string;
        lastUpdated: Date;
      };
    }> = [];

    const scanDirectory = async (dirPath: string) => {
      try {
        const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(dirPath, entry.name);

          if (entry.isDirectory()) {
            // Recursively scan subdirectories
            await scanDirectory(fullPath);
          } else if (entry.isFile()) {
            const ext = path.extname(entry.name).toLowerCase();
            if (audioExtensions.includes(ext)) {
              // Parse filename for metadata (basic: "Artist - Title.mp3")
              const baseName = path.basename(entry.name, ext);
              let title = baseName;
              let artist = 'Unknown Artist';
              let album = path.basename(path.dirname(fullPath));

              // Try to parse "Artist - Title" format
              const dashIndex = baseName.indexOf(' - ');
              if (dashIndex > 0) {
                artist = baseName.substring(0, dashIndex).trim();
                title = baseName.substring(dashIndex + 3).trim();
              }

              const trackId = `local:${Buffer.from(fullPath).toString('base64')}`;
              const format = ext.slice(1); // Remove the dot: '.mp3' -> 'mp3'

              tracks.push({
                id: trackId,
                title,
                artists: [{ id: `local-artist:${Buffer.from(artist).toString('base64')}`, name: artist }],
                album: { id: `local-album:${Buffer.from(album).toString('base64')}`, title: album },
                duration: 0, // Would need audio metadata library for actual duration
                artwork: undefined,
                streamInfo: {
                  url: `local-audio://localhost${fullPath}`,  // Use localhost as host, path starts with /
                  format,
                  quality: 'lossless',
                  expiresAt: null
                },
                streamSources: [{
                  providerId: 'local-file',
                  trackId: fullPath,
                  available: true
                }],
                _meta: {
                  metadataProvider: 'local-file',
                  lastUpdated: new Date()
                }
              });
            }
          }
        }
      } catch (error) {
        console.error(`[LocalMusic] Error scanning ${dirPath}:`, error);
      }
    };

    console.log(`[LocalMusic] Scanning folder: ${folderPath}`);
    await scanDirectory(folderPath);
    console.log(`[LocalMusic] Found ${tracks.length} tracks`);

    return { trackCount: tracks.length, tracks };
  });

  // Get all local tracks from configured folders
  ipcMain.handle('get-local-tracks', async () => {
    // This would need to read from settings and aggregate all local tracks
    // For now, return empty - UI will manage this via settings store
    return { tracks: [] };
  });

  // Update settings (sync from renderer to main)
  ipcMain.handle('update-settings', (_event, { key, value }: { key: string; value: unknown }) => {
    console.log(`[Settings] Update: ${key} =`, value);
    // Store in userData for persistence if needed
    // For now, just acknowledge - settings are managed by renderer localStorage
    return { success: true };
  });

  // Get app paths for defaults
  ipcMain.handle('get-app-paths', () => {
    return {
      downloads: path.join(app.getPath('downloads'), 'Audiio'),
      userData: app.getPath('userData'),
      music: app.getPath('music'),
      documents: app.getPath('documents')
    };
  });

  // =============================================
  // Plugin Folder Handlers
  // =============================================

  // Set plugin folder and start watching
  ipcMain.handle('set-plugin-folder', (_event, folderPath: string | null) => {
    // Stop existing watcher
    if (pluginFolderWatcher) {
      pluginFolderWatcher.close();
      pluginFolderWatcher = null;
    }

    currentPluginFolder = folderPath;

    if (!folderPath) {
      console.log('[Plugins] Plugin folder watching disabled');
      return { success: true, watching: false };
    }

    // Ensure folder exists
    if (!fs.existsSync(folderPath)) {
      try {
        fs.mkdirSync(folderPath, { recursive: true });
      } catch (error) {
        console.error('[Plugins] Failed to create plugin folder:', error);
        return { success: false, error: 'Failed to create folder' };
      }
    }

    // Start watching for new plugin files
    try {
      pluginFolderWatcher = fs.watch(folderPath, (eventType, filename) => {
        if (eventType === 'rename' && filename) {
          const fullPath = path.join(folderPath, filename);

          // Check if it's a plugin file
          if (filename.endsWith('.audiio-plugin') && fs.existsSync(fullPath)) {
            console.log(`[Plugins] New plugin detected: ${filename}`);

            // Notify renderer about new plugin
            mainWindow?.webContents.send('plugin-detected', {
              filename,
              path: fullPath
            });
          }
        }
      });

      console.log(`[Plugins] Watching folder: ${folderPath}`);
      return { success: true, watching: true };
    } catch (error) {
      console.error('[Plugins] Failed to watch folder:', error);
      return { success: false, error: 'Failed to watch folder' };
    }
  });

  // Get plugin folder status
  ipcMain.handle('get-plugin-folder-status', () => {
    return {
      folder: currentPluginFolder,
      watching: pluginFolderWatcher !== null
    };
  });

  // Install plugin from file
  ipcMain.handle('install-plugin', async (_event, filePath: string) => {
    try {
      if (!fs.existsSync(filePath)) {
        return { success: false, error: 'Plugin file not found' };
      }

      // Read plugin manifest
      const content = await fs.promises.readFile(filePath, 'utf-8');
      let manifest;

      try {
        manifest = JSON.parse(content);
      } catch {
        return { success: false, error: 'Invalid plugin manifest' };
      }

      if (!manifest.id || !manifest.name) {
        return { success: false, error: 'Plugin missing required fields (id, name)' };
      }

      // Copy to plugins directory in userData
      const pluginsDir = path.join(app.getPath('userData'), 'plugins');
      if (!fs.existsSync(pluginsDir)) {
        fs.mkdirSync(pluginsDir, { recursive: true });
      }

      const destPath = path.join(pluginsDir, `${manifest.id}.audiio-plugin`);
      await fs.promises.copyFile(filePath, destPath);

      console.log(`[Plugins] Installed plugin: ${manifest.name} (${manifest.id})`);

      return {
        success: true,
        plugin: {
          id: manifest.id,
          name: manifest.name,
          description: manifest.description || '',
          version: manifest.version || '1.0.0',
          path: destPath
        }
      };
    } catch (error) {
      console.error('[Plugins] Failed to install plugin:', error);
      return { success: false, error: String(error) };
    }
  });

  // List installed plugins
  ipcMain.handle('get-installed-plugins', async () => {
    try {
      const pluginsDir = path.join(app.getPath('userData'), 'plugins');

      if (!fs.existsSync(pluginsDir)) {
        return { plugins: [] };
      }

      const files = await fs.promises.readdir(pluginsDir);
      const plugins = [];

      for (const file of files) {
        if (file.endsWith('.audiio-plugin')) {
          try {
            const content = await fs.promises.readFile(path.join(pluginsDir, file), 'utf-8');
            const manifest = JSON.parse(content);
            plugins.push({
              id: manifest.id,
              name: manifest.name,
              description: manifest.description || '',
              version: manifest.version || '1.0.0',
              path: path.join(pluginsDir, file)
            });
          } catch {
            // Skip invalid plugins
          }
        }
      }

      return { plugins };
    } catch (error) {
      return { plugins: [] };
    }
  });

  // Uninstall plugin
  ipcMain.handle('uninstall-plugin', async (_event, pluginId: string) => {
    try {
      const pluginsDir = path.join(app.getPath('userData'), 'plugins');
      const pluginPath = path.join(pluginsDir, `${pluginId}.audiio-plugin`);

      if (fs.existsSync(pluginPath)) {
        await fs.promises.unlink(pluginPath);
        console.log(`[Plugins] Uninstalled plugin: ${pluginId}`);
        return { success: true };
      }

      return { success: false, error: 'Plugin not found' };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  // =============================================
  // Karaoke Handlers
  // =============================================

  // Helper to get karaoke processor from plugin loader
  const getKaraokeProcessor = (): any | null => {
    const karaokePlugin = pluginLoader?.getPlugin('karaoke');
    return karaokePlugin?.instance || null;
  };

  // Check if karaoke is available
  ipcMain.handle('karaoke-is-available', async () => {
    try {
      const processor = getKaraokeProcessor();
      if (!processor || typeof processor.isAvailable !== 'function') {
        return { available: false };
      }
      const available = await processor.isAvailable();
      return { available };
    } catch {
      return { available: false };
    }
  });

  // Process a track for karaoke (get instrumental)
  ipcMain.handle('karaoke-process-track', async (_event, { trackId, audioUrl }: { trackId: string; audioUrl: string }) => {
    try {
      const processor = getKaraokeProcessor();
      if (!processor || typeof processor.processTrack !== 'function') {
        return { success: false, error: 'Karaoke plugin not available' };
      }
      console.log(`[Karaoke] Processing track: ${trackId}`);
      const result = await processor.processTrack(trackId, audioUrl);
      console.log(`[Karaoke] Processing complete for: ${trackId}, cached: ${result.cached}`);
      return { success: true, result };
    } catch (error) {
      console.error('[Karaoke] Processing failed:', error);
      return { success: false, error: String(error) };
    }
  });

  // Check if track is cached
  ipcMain.handle('karaoke-has-cached', async (_event, trackId: string) => {
    try {
      const processor = getKaraokeProcessor();
      if (!processor || typeof processor.hasCached !== 'function') {
        return { cached: false };
      }
      const cached = await processor.hasCached(trackId);
      return { cached };
    } catch {
      return { cached: false };
    }
  });

  // Get cached instrumental
  ipcMain.handle('karaoke-get-cached', async (_event, trackId: string) => {
    try {
      const processor = getKaraokeProcessor();
      if (!processor || typeof processor.getCached !== 'function') {
        return { success: false, error: 'Karaoke plugin not available' };
      }
      const result = await processor.getCached(trackId);
      return { success: true, result };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  // Clear cache for a track
  ipcMain.handle('karaoke-clear-cache', async (_event, trackId: string) => {
    try {
      const processor = getKaraokeProcessor();
      if (!processor || typeof processor.clearCache !== 'function') {
        return { success: false, error: 'Karaoke plugin not available' };
      }
      await processor.clearCache(trackId);
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  // Clear all karaoke cache
  ipcMain.handle('karaoke-clear-all-cache', async () => {
    try {
      const processor = getKaraokeProcessor();
      if (!processor || typeof processor.clearAllCache !== 'function') {
        return { success: false, error: 'Karaoke plugin not available' };
      }
      await processor.clearAllCache();
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });
}

/**
 * Download a file from URL with progress updates using chunked Range requests
 * YouTube/Google CDN requires Range requests for adaptive streams
 */
async function downloadFile(url: string, filePath: string, onProgress: (progress: number) => void): Promise<void> {
  const tempPath = filePath + '.tmp';
  const CHUNK_SIZE = 1024 * 1024; // 1MB chunks
  const IDLE_TIMEOUT_MS = 30000;

  // First, get the total file size with a HEAD request
  const totalSize = await getContentLength(url);
  console.log(`[Download] Total size: ${totalSize} bytes`);

  if (totalSize === 0) {
    // Fall back to non-chunked download if we can't get size
    return downloadFileSimple(url, filePath, onProgress);
  }

  // Create/truncate the temp file
  const file = fs.createWriteStream(tempPath);

  let downloadedSize = 0;

  try {
    // Download in chunks using Range requests
    while (downloadedSize < totalSize) {
      const start = downloadedSize;
      const end = Math.min(downloadedSize + CHUNK_SIZE - 1, totalSize - 1);

      console.log(`[Download] Fetching chunk: bytes ${start}-${end}/${totalSize}`);

      const chunk = await downloadChunk(url, start, end, IDLE_TIMEOUT_MS);
      file.write(chunk);

      downloadedSize += chunk.length;
      const progress = Math.round((downloadedSize / totalSize) * 100);
      onProgress(progress);
    }

    // Close the file and rename
    await new Promise<void>((resolve, reject) => {
      file.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    await fs.promises.rename(tempPath, filePath);
    console.log(`[Download] Complete: ${filePath}`);
  } catch (error) {
    file.close(() => {});
    try { await fs.promises.unlink(tempPath); } catch {}
    throw error;
  }
}

/**
 * Get content length via HEAD request
 */
function getContentLength(url: string): Promise<number> {
  return new Promise((resolve) => {
    const parsedUrl = new URL(url);
    const protocol = parsedUrl.protocol === 'https:' ? https : http;

    const requestOptions = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'HEAD',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://music.youtube.com/',
        'Origin': 'https://music.youtube.com'
      }
    };

    const request = protocol.request(requestOptions, (response) => {
      // Follow redirects
      if ((response.statusCode === 301 || response.statusCode === 302) && response.headers.location) {
        getContentLength(response.headers.location).then(resolve);
        return;
      }
      const length = parseInt(response.headers['content-length'] || '0', 10);
      resolve(length);
    });

    request.on('error', () => resolve(0));
    request.setTimeout(10000, () => {
      request.destroy();
      resolve(0);
    });
    request.end();
  });
}

/**
 * Download a single chunk using Range request
 */
function downloadChunk(url: string, start: number, end: number, timeoutMs: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const protocol = parsedUrl.protocol === 'https:' ? https : http;

    const requestOptions = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': '*/*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'identity',
        'Connection': 'keep-alive',
        'Referer': 'https://music.youtube.com/',
        'Origin': 'https://music.youtube.com',
        'Range': `bytes=${start}-${end}`
      }
    };

    const chunks: Buffer[] = [];
    let idleTimeout: NodeJS.Timeout | null = null;

    const resetTimeout = () => {
      if (idleTimeout) clearTimeout(idleTimeout);
      idleTimeout = setTimeout(() => {
        request.destroy();
        reject(new Error('Download chunk timeout'));
      }, timeoutMs);
    };

    const clearTimeout2 = () => {
      if (idleTimeout) {
        clearTimeout(idleTimeout);
        idleTimeout = null;
      }
    };

    const request = protocol.request(requestOptions, (response) => {
      // Follow redirects
      if ((response.statusCode === 301 || response.statusCode === 302) && response.headers.location) {
        clearTimeout2();
        downloadChunk(response.headers.location, start, end, timeoutMs).then(resolve).catch(reject);
        return;
      }

      // Accept 200 (full content) or 206 (partial content)
      if (response.statusCode !== 200 && response.statusCode !== 206) {
        clearTimeout2();
        reject(new Error(`HTTP ${response.statusCode}`));
        return;
      }

      resetTimeout();

      response.on('data', (chunk: Buffer) => {
        chunks.push(chunk);
        resetTimeout();
      });

      response.on('end', () => {
        clearTimeout2();
        resolve(Buffer.concat(chunks));
      });

      response.on('error', (err) => {
        clearTimeout2();
        reject(err);
      });
    });

    request.on('error', (err) => {
      clearTimeout2();
      reject(err);
    });

    request.setTimeout(timeoutMs, () => {
      clearTimeout2();
      request.destroy();
      reject(new Error('Connection timeout'));
    });

    request.end();
  });
}

/**
 * Simple non-chunked download fallback
 */
function downloadFileSimple(url: string, filePath: string, onProgress: (progress: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const protocol = parsedUrl.protocol === 'https:' ? https : http;
    const tempPath = filePath + '.tmp';

    const requestOptions = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': '*/*',
        'Accept-Encoding': 'identity',
        'Referer': 'https://music.youtube.com/',
        'Origin': 'https://music.youtube.com'
      }
    };

    const request = protocol.request(requestOptions, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        if (response.headers.location) {
          downloadFileSimple(response.headers.location, filePath, onProgress).then(resolve).catch(reject);
        } else {
          reject(new Error('Redirect without location'));
        }
        return;
      }

      if (response.statusCode !== 200) {
        reject(new Error(`HTTP ${response.statusCode}`));
        return;
      }

      const totalSize = parseInt(response.headers['content-length'] || '0', 10);
      let downloadedSize = 0;
      const file = fs.createWriteStream(tempPath);

      response.on('data', (chunk: Buffer) => {
        downloadedSize += chunk.length;
        if (totalSize > 0) {
          onProgress(Math.round((downloadedSize / totalSize) * 100));
        }
      });

      response.pipe(file);

      file.on('finish', () => {
        file.close(() => {
          fs.rename(tempPath, filePath, (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
      });

      file.on('error', (err) => {
        fs.unlink(tempPath, () => {});
        reject(err);
      });
    });

    request.on('error', (err) => {
      fs.unlink(tempPath, () => {});
      reject(err);
    });

    request.setTimeout(30000, () => {
      request.destroy();
      reject(new Error('Connection timeout'));
    });

    request.end();
  });
}

/**
 * Forward playback events to renderer and record ML events
 */
function setupPlaybackEvents(): void {
  // Track current playback for ML event recording
  let currentTrackData: { track: any; startTime: number } | null = null;

  playbackOrchestrator.on('play', (data) => {
    mainWindow?.webContents.send('playback-event', { type: 'play', ...data });

    // Store track data for later event recording
    if (data.track) {
      currentTrackData = {
        track: data.track,
        startTime: Date.now()
      };
    }
  });

  playbackOrchestrator.on('pause', () => {
    mainWindow?.webContents.send('playback-event', { type: 'pause' });
  });

  playbackOrchestrator.on('resume', () => {
    mainWindow?.webContents.send('playback-event', { type: 'resume' });
  });

  playbackOrchestrator.on('trackChange', (data) => {
    mainWindow?.webContents.send('playback-event', { type: 'trackChange', ...data });

    // Record ML event for previous track (skip or complete)
    if (currentTrackData && mlService.isInitialized()) {
      const duration = Date.now() - currentTrackData.startTime;
      const durationSeconds = duration / 1000;
      const track = currentTrackData.track;
      const trackDuration = track.duration || 180; // Default 3 min if unknown
      const completion = Math.min(durationSeconds / trackDuration, 1);

      const now = new Date();
      const context = {
        hourOfDay: now.getHours(),
        dayOfWeek: now.getDay(),
        isWeekend: now.getDay() === 0 || now.getDay() === 6,
        device: 'desktop' as const
      };

      // Convert to ML Track format
      const mlTrack = {
        id: track.id,
        title: track.title,
        artist: track.artists?.[0]?.name || 'Unknown Artist',
        artistId: track.artists?.[0]?.id,
        album: track.album,
        albumId: track.albumId,
        duration: track.duration || 0,
        genres: track.genres,
      };

      // If less than 30 seconds, consider it a skip
      if (durationSeconds < 30) {
        mlService.recordEvent({
          type: 'skip',
          timestamp: Date.now(),
          track: mlTrack,
          skipPosition: durationSeconds,
          skipPercentage: completion,
          earlySkip: true,
          context
        }).catch(err => console.error('[ML] Failed to record skip event:', err));
      } else {
        // Consider it a listen (partial or complete)
        mlService.recordEvent({
          type: 'listen',
          timestamp: Date.now(),
          track: mlTrack,
          duration: durationSeconds,
          completion,
          completed: completion >= 0.8,
          source: { type: 'queue' as const },
          context
        }).catch(err => console.error('[ML] Failed to record listen event:', err));
      }
    }

    // Update current track if new track is starting
    if (data.track) {
      currentTrackData = {
        track: data.track,
        startTime: Date.now()
      };
    } else {
      currentTrackData = null;
    }
  });

  playbackOrchestrator.on('error', (data) => {
    mainWindow?.webContents.send('playback-event', { type: 'error', error: data.error.message });
  });
}

/**
 * Connect library events to ML service for learning
 */
function setupMLLibraryEvents(): void {
  if (!libraryBridge || !mlService.isInitialized()) {
    console.log('[ML] Skipping library event setup - services not ready');
    return;
  }

  // Listen for library changes and record relevant ML events
  libraryBridge.onLibraryChange((data) => {
    // Note: Individual like/dislike events are handled via IPC in library-bridge.ts
    // This callback receives batch updates, useful for sync notifications
    if (data.likedTracks) {
      console.log(`[ML] Library updated: ${data.likedTracks.length} liked tracks`);
    }
  });

  // Add IPC listeners for like/dislike events to record ML events
  ipcMain.on('library-track-liked', (_event, track) => {
    if (mlService.isInitialized() && track?.id) {
      const mlTrack = {
        id: track.id,
        title: track.title,
        artist: track.artists?.[0]?.name || 'Unknown Artist',
        artistId: track.artists?.[0]?.id,
        album: track.album,
        albumId: track.albumId,
        duration: track.duration || 0,
        genres: track.genres,
      };

      mlService.recordEvent({
        type: 'like',
        timestamp: Date.now(),
        track: mlTrack,
        strength: 1 // Normal like
      }).catch(err => console.error('[ML] Failed to record like event:', err));
    }
  });

  // Note: 'unlike' is not a standard ML event type, so we skip recording it
  // The preference learning system handles it internally

  // Track dislikes with reasons
  ipcMain.on('library-track-disliked', (_event, data) => {
    if (mlService.isInitialized() && data?.track?.id) {
      const track = data.track;
      const mlTrack = {
        id: track.id,
        title: track.title,
        artist: track.artists?.[0]?.name || 'Unknown Artist',
        artistId: track.artists?.[0]?.id,
        album: track.album,
        albumId: track.albumId,
        duration: track.duration || 0,
        genres: track.genres,
      };

      // Map reasons to standard dislike reason
      const reasonMap: Record<string, string> = {
        'not_my_taste': 'not_my_taste',
        'heard_too_much': 'heard_too_much',
        'bad_quality': 'bad_audio_quality',
        'wrong_mood': 'wrong_mood',
        'dont_like_artist': 'dont_like_artist',
        'too_long': 'too_long',
        'too_short': 'too_short',
        'explicit': 'explicit_content',
        'wrong_genre': 'wrong_genre',
      };
      const primaryReason = data.reasons?.[0] || 'other';
      const reason = (reasonMap[primaryReason] || 'other') as 'not_my_taste' | 'heard_too_much' | 'bad_audio_quality' | 'wrong_mood' | 'dont_like_artist' | 'too_long' | 'too_short' | 'explicit_content' | 'wrong_genre' | 'other';

      mlService.recordEvent({
        type: 'dislike',
        timestamp: Date.now(),
        track: mlTrack,
        reason,
        feedback: data.reasons?.join(', ')
      }).catch(err => console.error('[ML] Failed to record dislike event:', err));
    }
  });

  console.log('[ML] Library event recording configured');
}

/**
 * Dynamic import helper that bypasses TypeScript checking
 * Used for optional plugin imports that may not be installed
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function dynamicPluginImport(specifier: string): Promise<any> {
  const dynamicImportFn = new Function('specifier', 'return import(specifier)');
  return dynamicImportFn(specifier);
}

/**
 * Initialize Sposify addon handlers
 */
async function initializeSposify(): Promise<void> {
  try {
    // Dynamically import to avoid bundling issues if not installed
    const sposifyModule = await dynamicPluginImport('@audiio/sposify');
    sposifyModule.registerSposifyHandlers(app.getPath('userData'));
    if (mainWindow) {
      sposifyModule.setMainWindow(mainWindow);
    }
    sposifyHandlersRegistered = true;
    console.log('[Sposify] Handlers registered');
  } catch (error) {
    // Sposify addon not installed - this is fine
    console.log('[Sposify] Addon not available:', (error as Error).message);
  }
}

// App lifecycle
app.whenReady().then(async () => {
  try {
    // Register custom protocol for local audio files
    protocol.handle('local-audio', async (request) => {
      // URL format: local-audio://localhost/path/to/file.mp3
      // Parse the URL to extract the pathname
      const url = new URL(request.url);
      let filePath = decodeURIComponent(url.pathname);
      // On Windows, remove leading slash from /C:/path/to/file
      if (process.platform === 'win32' && filePath.match(/^\/[A-Za-z]:/)) {
        filePath = filePath.slice(1);
      }
      console.log('[LocalAudio] Request URL:', request.url);
      console.log('[LocalAudio] Serving file:', filePath);

      try {
        // Check if file exists
        await fs.promises.access(filePath);

        // Read the file
        const data = await fs.promises.readFile(filePath);
        const ext = path.extname(filePath).toLowerCase();

        // Determine MIME type
        const mimeTypes: Record<string, string> = {
          '.mp3': 'audio/mpeg',
          '.flac': 'audio/flac',
          '.wav': 'audio/wav',
          '.m4a': 'audio/mp4',
          '.aac': 'audio/aac',
          '.ogg': 'audio/ogg',
          '.opus': 'audio/opus',
          '.wma': 'audio/x-ms-wma',
          '.aiff': 'audio/aiff'
        };

        const mimeType = mimeTypes[ext] || 'audio/mpeg';
        console.log('[LocalAudio] Serving with MIME type:', mimeType);

        return new Response(data, {
          status: 200,
          headers: {
            'Content-Type': mimeType,
            'Content-Length': data.length.toString(),
            'Accept-Ranges': 'bytes'
          }
        });
      } catch (error) {
        console.error('[LocalAudio] Error serving file:', error);
        return new Response('File not found', { status: 404 });
      }
    });
    console.log('[LocalAudio] Protocol handler registered');

    await initializeAddons();

    // Initialize library bridge
    libraryBridge = getLibraryBridge();
    console.log('[LibraryBridge] Initialized');

    // Initialize ML service (after library bridge)
    await initializeMLService();

    // Start Demucs server for karaoke
    startDemucsServer();

    setupIPCHandlers();
    setupMLIPCHandlers();
    createWindow();
    setupPlaybackEvents();

    // Initialize Sposify addon (after window creation)
    await initializeSposify();

    // Connect library events to ML service for learning
    setupMLLibraryEvents();
  } catch (error) {
    console.error('Failed to initialize app:', error);
    app.quit();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Cleanup on quit
app.on('before-quit', async () => {
  // Stop Demucs server if running
  if (demucsProcess) {
    try {
      demucsProcess.kill();
      demucsProcess = null;
      console.log('[Demucs] Server stopped on quit');
    } catch (error) {
      console.error('[Demucs] Error stopping server:', error);
    }
  }

  // Stop mobile server if running
  if (mobileServer) {
    try {
      await mobileServer.stop();
      console.log('[Mobile] Server stopped on quit');
    } catch (error) {
      console.error('[Mobile] Error stopping server:', error);
    }
  }

  // Cleanup ML service
  if (mlService.isInitialized()) {
    try {
      await mlService.dispose();
      console.log('[ML] Service disposed on quit');
    } catch (error) {
      console.error('[ML] Error disposing service:', error);
    }
  }

  // Cleanup library bridge
  if (libraryBridge) {
    libraryBridge.destroy();
    console.log('[LibraryBridge] Destroyed on quit');
  }

  // Cleanup plugin folder watcher
  if (pluginFolderWatcher) {
    pluginFolderWatcher.close();
    pluginFolderWatcher = null;
    console.log('[Plugins] Folder watcher stopped on quit');
  }

  // Cleanup Sposify handlers
  if (sposifyHandlersRegistered) {
    try {
      const sposifyModule = await dynamicPluginImport('@audiio/sposify');
      sposifyModule.unregisterSposifyHandlers();
      console.log('[Sposify] Handlers unregistered on quit');
    } catch (error) {
      // Ignore - addon may not be available
    }
  }

  // Dispose addons
  for (const addonId of registry.getAllAddonIds()) {
    const addon = registry.get(addonId);
    if (addon) {
      try {
        await addon.dispose();
      } catch (error) {
        console.error(`Error disposing addon ${addonId}:`, error);
      }
    }
  }
});
