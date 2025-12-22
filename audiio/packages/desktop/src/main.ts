/**
 * Audiio Desktop - Electron Main Process
 */

import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import * as https from 'https';
import * as http from 'http';
import {
  AddonRegistry,
  SearchOrchestrator,
  TrackResolver,
  PlaybackOrchestrator,
  getAudioAnalyzer,
  type AudioFeatures,
  type AnalysisOptions
} from '@audiio/core';
import { DeezerMetadataProvider } from '@audiio/deezer-metadata';
import { YouTubeMusicProvider } from '@audiio/youtube-music';
import { AppleMusicArtworkProvider } from '@audiio/applemusic-artwork';
import { LRCLibProvider } from '@audiio/lrclib-lyrics';
import { getLibraryBridge, type LibraryBridge } from './services/library-bridge';

// Mobile server - lazy loaded
let MobileServer: any = null;
let AuthManager: any = null;
let mobileServer: any = null;
let mobileAuthManager: any = null;
let mobileAccessConfig: any = null;

let mainWindow: BrowserWindow | null = null;
let registry: AddonRegistry;
let searchOrchestrator: SearchOrchestrator;
let trackResolver: TrackResolver;
let playbackOrchestrator: PlaybackOrchestrator;
let libraryBridge: LibraryBridge;

// Store provider references for settings updates
let deezerProvider: DeezerMetadataProvider;
let appleMusicProvider: AppleMusicArtworkProvider;
let lrclibProvider: LRCLibProvider;

// Audio analyzer instance
const audioAnalyzer = getAudioAnalyzer();

// Audio features cache (persisted across sessions)
const audioFeaturesCache = new Map<string, AudioFeatures>();

/**
 * Initialize addon providers
 */
async function initializeAddons(): Promise<void> {
  registry = new AddonRegistry();

  // Initialize Deezer metadata provider
  deezerProvider = new DeezerMetadataProvider();
  await deezerProvider.initialize();
  registry.register(deezerProvider);

  // Initialize Apple Music artwork provider
  appleMusicProvider = new AppleMusicArtworkProvider();
  await appleMusicProvider.initialize();
  registry.register(appleMusicProvider);
  // Enabled by default for animated artwork support

  // Initialize YouTube Music stream provider
  const ytMusic = new YouTubeMusicProvider();
  await ytMusic.initialize();
  registry.register(ytMusic);

  // Initialize LRCLib lyrics provider
  lrclibProvider = new LRCLibProvider();
  await lrclibProvider.initialize();
  registry.register(lrclibProvider);

  // Create orchestrators
  searchOrchestrator = new SearchOrchestrator(registry);
  trackResolver = new TrackResolver(registry);
  playbackOrchestrator = new PlaybackOrchestrator(trackResolver);

  console.log('Addons initialized:', registry.getAllAddonIds());
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

  ipcMain.handle('set-addon-enabled', (_event, { addonId, enabled }: { addonId: string; enabled: boolean }) => {
    console.log(`Setting addon ${addonId} enabled: ${enabled}`);
    registry.setEnabled(addonId, enabled);
    return { success: true, addonId, enabled };
  });

  // Update addon settings
  ipcMain.handle('update-addon-settings', (_event, { addonId, settings }: { addonId: string; settings: Record<string, unknown> }) => {
    console.log(`Updating addon ${addonId} settings:`, settings);

    // Get the addon and update its settings
    if (addonId === 'deezer' && deezerProvider) {
      deezerProvider.updateSettings(settings);
      return { success: true, addonId, settings: deezerProvider.getSettings() };
    }

    if (addonId === 'applemusic-artwork' && appleMusicProvider) {
      appleMusicProvider.updateSettings(settings);
      return { success: true, addonId, settings: appleMusicProvider.getSettings() };
    }

    return { success: false, error: `Unknown addon: ${addonId}` };
  });

  // Get addon settings
  ipcMain.handle('get-addon-settings', (_event, addonId: string) => {
    if (addonId === 'deezer' && deezerProvider) {
      return deezerProvider.getSettings();
    }

    if (addonId === 'applemusic-artwork' && appleMusicProvider) {
      return appleMusicProvider.getSettings();
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
      if (!appleMusicProvider) {
        return null;
      }

      // Check if provider is enabled
      const provider = registry.get('applemusic-artwork');
      if (!provider) {
        console.log('Apple Music artwork provider is disabled');
        return null;
      }

      // Get animated artwork and convert to MP4
      const result = await appleMusicProvider.getAnimatedArtworkAsMP4(
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
  ipcMain.handle('get-artist', async (_event, { id, source: _source }: { id: string; source?: string }) => {
    try {
      // Use Deezer provider directly for now
      if (deezerProvider) {
        return await deezerProvider.getArtist(id);
      }
      return null;
    } catch (error) {
      console.error('Get artist error:', error);
      throw error;
    }
  });

  // Album details
  ipcMain.handle('get-album', async (_event, { id, source: _source }: { id: string; source?: string }) => {
    try {
      // Use Deezer provider directly for now
      if (deezerProvider) {
        return await deezerProvider.getAlbum(id);
      }
      return null;
    } catch (error) {
      console.error('Get album error:', error);
      throw error;
    }
  });

  // Trending content - uses Deezer charts API for real trending data
  ipcMain.handle('get-trending', async () => {
    try {
      // Use Deezer's charts API for actual trending content
      if (deezerProvider) {
        const charts = await deezerProvider.getCharts(20);
        console.log(`[Trending] Fetched ${charts.tracks.length} tracks, ${charts.artists.length} artists, ${charts.albums.length} albums`);
        return charts;
      }

      // Fallback to search if Deezer not available
      const result = await searchOrchestrator.search('top hits 2024', { limit: 20 });
      return {
        tracks: result.tracks,
        artists: result.artists || [],
        albums: result.albums || []
      };
    } catch (error) {
      console.error('Get trending error:', error);
      return { tracks: [], artists: [], albums: [] };
    }
  });

  // Similar albums
  ipcMain.handle('get-similar-albums', async (_event, { albumId, source: _source }: { albumId: string; source?: string }) => {
    try {
      // Fallback: get album first, then search by artist/genre
      const album = await deezerProvider?.getAlbum(albumId);
      if (album?.artists?.[0]?.name) {
        const result = await searchOrchestrator.search(`${album.artists[0].name} similar`, { limit: 10 });
        return result.albums || [];
      }
      return [];
    } catch (error) {
      console.error('Get similar albums error:', error);
      return [];
    }
  });

  // Similar tracks
  ipcMain.handle('get-similar-tracks', async (_event, { trackId, source: _source }: { trackId: string; source?: string }) => {
    try {
      // Fallback: get track first, then search similar
      const track = await deezerProvider?.getTrack(trackId);
      if (track?.artists?.[0]?.name) {
        const result = await searchOrchestrator.search(`${track.artists[0].name} ${track.title} similar`, { limit: 15 });
        return result.tracks;
      }
      return [];
    } catch (error) {
      console.error('Get similar tracks error:', error);
      return [];
    }
  });

  // Artist latest release
  ipcMain.handle('get-artist-latest-release', async (_event, { artistId, source: _source }: { artistId: string; source?: string }) => {
    try {
      // Search for artist's recent releases
      const artist = await deezerProvider?.getArtist(artistId);
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
      if (!lrclibProvider) {
        return null;
      }

      const lyrics = await lrclibProvider.getLyrics({
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
          metadata: deezerProvider,
          authManager: mobileAuthManager,
          libraryBridge
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

      console.log('[Mobile] Server started successfully:', access.localUrl);
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
          metadata: deezerProvider,
          authManager: mobileAuthManager,
          libraryBridge
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
          metadata: deezerProvider,
          authManager: mobileAuthManager,
          libraryBridge
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
}

/**
 * Download a file from URL with progress updates
 */
function downloadFile(url: string, filePath: string, onProgress: (progress: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    const tempPath = filePath + '.tmp';

    const request = protocol.get(url, (response) => {
      // Handle redirects
      if (response.statusCode === 301 || response.statusCode === 302) {
        const redirectUrl = response.headers.location;
        if (redirectUrl) {
          downloadFile(redirectUrl, filePath, onProgress).then(resolve).catch(reject);
          return;
        }
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
          const progress = Math.round((downloadedSize / totalSize) * 100);
          onProgress(progress);
        }
      });

      response.pipe(file);

      file.on('finish', () => {
        file.close(() => {
          // Rename temp file to final path
          fs.rename(tempPath, filePath, (err) => {
            if (err) {
              reject(err);
            } else {
              resolve();
            }
          });
        });
      });

      file.on('error', (err) => {
        fs.unlink(tempPath, () => {}); // Delete temp file on error
        reject(err);
      });
    });

    request.on('error', (err) => {
      fs.unlink(tempPath, () => {}); // Delete temp file on error
      reject(err);
    });

    request.setTimeout(30000, () => {
      request.destroy();
      reject(new Error('Download timeout'));
    });
  });
}

/**
 * Forward playback events to renderer
 */
function setupPlaybackEvents(): void {
  playbackOrchestrator.on('play', (data) => {
    mainWindow?.webContents.send('playback-event', { type: 'play', ...data });
  });

  playbackOrchestrator.on('pause', () => {
    mainWindow?.webContents.send('playback-event', { type: 'pause' });
  });

  playbackOrchestrator.on('resume', () => {
    mainWindow?.webContents.send('playback-event', { type: 'resume' });
  });

  playbackOrchestrator.on('trackChange', (data) => {
    mainWindow?.webContents.send('playback-event', { type: 'trackChange', ...data });
  });

  playbackOrchestrator.on('error', (data) => {
    mainWindow?.webContents.send('playback-event', { type: 'error', error: data.error.message });
  });
}

// App lifecycle
app.whenReady().then(async () => {
  try {
    await initializeAddons();

    // Initialize library bridge
    libraryBridge = getLibraryBridge();
    console.log('[LibraryBridge] Initialized');

    setupIPCHandlers();
    createWindow();
    setupPlaybackEvents();
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
  // Stop mobile server if running
  if (mobileServer) {
    try {
      await mobileServer.stop();
      console.log('[Mobile] Server stopped on quit');
    } catch (error) {
      console.error('[Mobile] Error stopping server:', error);
    }
  }

  // Cleanup library bridge
  if (libraryBridge) {
    libraryBridge.destroy();
    console.log('[LibraryBridge] Destroyed on quit');
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
