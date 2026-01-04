/**
 * Audiio Client - Electron Main Process
 *
 * A lightweight Electron app that connects to an Audiio server.
 * Unlike the full desktop app, this doesn't run any local orchestrators
 * or plugins - everything is fetched from the server.
 */

import { app, BrowserWindow, ipcMain, shell, nativeTheme, session } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { Bonjour, Browser, Service } from 'bonjour-service';
import { ServerClient, getServerClient, DeviceIdentity } from './server-client';

// ========================================
// Configuration
// ========================================

interface ClientConfig {
  serverUrl: string | null;
  token: string | null;
  sessionToken: string | null;
  deviceIdentity: DeviceIdentity | null;
  windowBounds?: { width: number; height: number; x?: number; y?: number };
}

const CONFIG_FILE = path.join(app.getPath('userData'), 'client-config.json');

function loadConfig(): ClientConfig {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const loaded = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
      return {
        serverUrl: loaded.serverUrl || null,
        token: loaded.token || null,
        sessionToken: loaded.sessionToken || null,
        deviceIdentity: loaded.deviceIdentity || null,
        windowBounds: loaded.windowBounds
      };
    }
  } catch {
    // Invalid config
  }
  return { serverUrl: null, token: null, sessionToken: null, deviceIdentity: null };
}

function saveConfig(config: ClientConfig): void {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

// ========================================
// Window Management
// ========================================

let mainWindow: BrowserWindow | null = null;
let serverClient: ServerClient;
let config: ClientConfig;

async function createWindow(): Promise<void> {
  const bounds = config.windowBounds || { width: 1200, height: 800 };

  mainWindow = new BrowserWindow({
    width: bounds.width,
    height: bounds.height,
    x: bounds.x,
    y: bounds.y,
    minWidth: 800,
    minHeight: 600,
    frame: false,
    titleBarStyle: 'hidden',
    trafficLightPosition: { x: 16, y: 16 },
    backgroundColor: '#0a0a0a',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false
    }
  });

  // Save window bounds on resize/move
  mainWindow.on('resize', saveWindowBounds);
  mainWindow.on('move', saveWindowBounds);

  // Forward maximize state changes
  mainWindow.on('maximize', () => {
    mainWindow?.webContents.send('window-maximized-change', true);
  });
  mainWindow.on('unmaximize', () => {
    mainWindow?.webContents.send('window-maximized-change', false);
  });

  // Handle external links
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Load UI
  const isDev = process.argv.includes('--dev');
  if (isDev) {
    // Development: load from Vite dev server (packages/ui)
    // Try common Vite ports
    const ports = [5173, 5174, 5175];
    let loaded = false;
    for (const port of ports) {
      try {
        await mainWindow.loadURL(`http://localhost:${port}`);
        loaded = true;
        break;
      } catch {
        // Try next port
      }
    }
    if (!loaded) {
      console.error('[Client] Could not connect to any Vite dev server');
      await mainWindow.loadFile(path.join(__dirname, 'connect.html'));
    }
    mainWindow.webContents.openDevTools();
  } else {
    // Production: load from built UI
    const uiPath = path.join(__dirname, '..', '..', 'ui', 'dist', 'index.html');
    if (fs.existsSync(uiPath)) {
      await mainWindow.loadFile(uiPath);
    } else {
      // Fallback: show connection screen
      await mainWindow.loadFile(path.join(__dirname, 'connect.html'));
    }
  }
}

function saveWindowBounds(): void {
  if (!mainWindow) return;
  const bounds = mainWindow.getBounds();
  config.windowBounds = bounds;
  saveConfig(config);
}

// ========================================
// IPC Handlers
// ========================================

function setupIpcHandlers(): void {
  // Window controls
  ipcMain.handle('window-minimize', () => {
    mainWindow?.minimize();
  });

  ipcMain.handle('window-maximize', () => {
    if (mainWindow?.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow?.maximize();
    }
  });

  ipcMain.handle('window-close', () => {
    mainWindow?.close();
  });

  ipcMain.handle('window-is-maximized', () => {
    return mainWindow?.isMaximized() ?? false;
  });

  // Platform
  ipcMain.handle('get-platform', () => process.platform);

  // Theme
  ipcMain.handle('get-system-theme', () => nativeTheme.shouldUseDarkColors ? 'dark' : 'light');

  // ========================================
  // Connection Management
  // ========================================

  ipcMain.handle('get-connection-state', () => {
    return serverClient.getConnectionState();
  });

  ipcMain.handle('connect-to-server', async (_event, serverUrl: string, token?: string) => {
    const success = await serverClient.connect({ url: serverUrl, token });
    if (success) {
      config.serverUrl = serverUrl;
      config.token = token || null;
      // Save session token and device identity for persistence
      config.sessionToken = serverClient.getSessionToken();
      config.deviceIdentity = serverClient.getOrCreateDeviceIdentity();
      saveConfig(config);
    }
    return success;
  });

  ipcMain.handle('disconnect-from-server', () => {
    serverClient.disconnect();
    config.serverUrl = null;
    config.token = null;
    // Keep device identity but clear session (device stays trusted, just logged out)
    config.sessionToken = null;
    saveConfig(config);
  });

  ipcMain.handle('get-saved-server', () => {
    return { url: config.serverUrl, token: config.token };
  });

  // ========================================
  // Search (proxied to server)
  // ========================================

  ipcMain.handle('search', async (_event, queryOrObj: string | { query: string; type?: string; limit?: number }, options?: { limit?: number }) => {
    console.log('[IPC] Search called with:', queryOrObj, 'options:', options);
    console.log('[IPC] Server connected:', serverClient.isConnected());

    if (!serverClient.isConnected()) {
      console.log('[IPC] Not connected, returning empty');
      return [];
    }

    // Handle both { query: string, type?: string } object and plain string
    const query = typeof queryOrObj === 'string' ? queryOrObj : queryOrObj.query;
    const type = typeof queryOrObj === 'object' ? queryOrObj.type : undefined;
    const limit = options?.limit || (typeof queryOrObj === 'object' ? queryOrObj.limit : undefined) || 20;

    if (!query) {
      return [];
    }

    try {
      console.log('[IPC] Searching for:', query, 'type:', type, 'limit:', limit);
      const results = await serverClient.search(query, type, limit);
      console.log('[IPC] Search results:', results?.length || 0, 'items');
      // Return array directly (type-specific) - the UI expects arrays
      return results || [];
    } catch (error) {
      console.error('[IPC] Search error:', error);
      return [];
    }
  });

  // ========================================
  // Stream Resolution (proxied to server)
  // ========================================

  ipcMain.handle('resolve-stream', async (_event, track: any) => {
    if (!serverClient.isConnected()) {
      return null;
    }
    try {
      return await serverClient.resolveStream(track);
    } catch (error) {
      console.error('[IPC] Stream resolve error:', error);
      return null;
    }
  });

  // ========================================
  // Metadata (proxied to server)
  // ========================================

  ipcMain.handle('get-trending', async () => {
    if (!serverClient.isConnected()) return null;
    try {
      return await serverClient.getTrending();
    } catch (error) {
      console.error('[IPC] Trending error:', error);
      return null;
    }
  });

  ipcMain.handle('get-artist', async (_event, idOrObj: string | { id: string; source?: string }) => {
    if (!serverClient.isConnected()) return null;
    const artistId = typeof idOrObj === 'string' ? idOrObj : idOrObj.id;
    try {
      return await serverClient.getArtist(artistId);
    } catch (error) {
      console.error('[IPC] Artist error:', error);
      return null;
    }
  });

  ipcMain.handle('get-album', async (_event, idOrObj: string | { id: string; source?: string }) => {
    if (!serverClient.isConnected()) return null;
    const albumId = typeof idOrObj === 'string' ? idOrObj : idOrObj.id;
    try {
      return await serverClient.getAlbum(albumId);
    } catch (error) {
      console.error('[IPC] Album error:', error);
      return null;
    }
  });

  ipcMain.handle('get-discover', async (_event, limit?: number) => {
    if (!serverClient.isConnected()) return null;
    try {
      return await serverClient.getDiscover(limit);
    } catch (error) {
      console.error('[IPC] Discover error:', error);
      return null;
    }
  });

  // ========================================
  // Library (proxied to server)
  // ========================================

  ipcMain.handle('get-liked-tracks', async () => {
    if (!serverClient.isConnected()) return { tracks: [] };
    try {
      return await serverClient.getLikedTracks();
    } catch (error) {
      console.error('[IPC] Get likes error:', error);
      return { tracks: [] };
    }
  });

  ipcMain.handle('like-track', async (_event, track: any) => {
    if (!serverClient.isConnected()) return { success: false };
    try {
      return await serverClient.likeTrack(track);
    } catch (error) {
      console.error('[IPC] Like error:', error);
      return { success: false };
    }
  });

  ipcMain.handle('unlike-track', async (_event, trackId: string) => {
    if (!serverClient.isConnected()) return { success: false };
    try {
      return await serverClient.unlikeTrack(trackId);
    } catch (error) {
      console.error('[IPC] Unlike error:', error);
      return { success: false };
    }
  });

  ipcMain.handle('is-track-liked', async (_event, trackId: string) => {
    if (!serverClient.isConnected()) return false;
    try {
      return await serverClient.isTrackLiked(trackId);
    } catch {
      return false;
    }
  });

  // ========================================
  // Playlists (proxied to server)
  // ========================================

  ipcMain.handle('get-playlists', async () => {
    if (!serverClient.isConnected()) return { playlists: [] };
    try {
      return await serverClient.getPlaylists();
    } catch (error) {
      console.error('[IPC] Get playlists error:', error);
      return { playlists: [] };
    }
  });

  ipcMain.handle('get-playlist', async (_event, playlistId: string) => {
    if (!serverClient.isConnected()) return null;
    try {
      return await serverClient.getPlaylist(playlistId);
    } catch (error) {
      console.error('[IPC] Get playlist error:', error);
      return null;
    }
  });

  ipcMain.handle('create-playlist', async (_event, name: string, description?: string) => {
    if (!serverClient.isConnected()) return null;
    try {
      return await serverClient.createPlaylist(name, description);
    } catch (error) {
      console.error('[IPC] Create playlist error:', error);
      return null;
    }
  });

  ipcMain.handle('delete-playlist', async (_event, playlistId: string) => {
    if (!serverClient.isConnected()) return { success: false };
    try {
      return await serverClient.deletePlaylist(playlistId);
    } catch (error) {
      console.error('[IPC] Delete playlist error:', error);
      return { success: false };
    }
  });

  ipcMain.handle('add-to-playlist', async (_event, playlistId: string, track: any) => {
    if (!serverClient.isConnected()) return { success: false };
    try {
      return await serverClient.addToPlaylist(playlistId, track);
    } catch (error) {
      console.error('[IPC] Add to playlist error:', error);
      return { success: false };
    }
  });

  ipcMain.handle('remove-from-playlist', async (_event, playlistId: string, trackId: string) => {
    if (!serverClient.isConnected()) return { success: false };
    try {
      return await serverClient.removeFromPlaylist(playlistId, trackId);
    } catch (error) {
      console.error('[IPC] Remove from playlist error:', error);
      return { success: false };
    }
  });

  // ========================================
  // Addons (read-only from server)
  // ========================================

  ipcMain.handle('get-addons', async () => {
    if (!serverClient.isConnected()) return { addons: [] };
    try {
      return await serverClient.getAddons();
    } catch (error) {
      console.error('[IPC] Get addons error:', error);
      return { addons: [] };
    }
  });

  // ========================================
  // App Info
  // ========================================

  ipcMain.handle('get-app-info', () => ({
    name: 'Audiio Client',
    version: app.getVersion(),
    isClient: true, // Flag to tell UI we're in client mode
    platform: process.platform
  }));

  // ========================================
  // Stub handlers for desktop-only features
  // These return sensible defaults so the UI doesn't crash
  // ========================================

  // Playback - resolve stream from server and return stream info
  ipcMain.handle('play-track', async (_event, track: any) => {
    console.log('[IPC] play-track called for:', track?.title);
    if (!serverClient.isConnected()) {
      console.error('[IPC] Cannot play track - not connected to server');
      return null;
    }
    try {
      // Resolve stream from server
      const streamInfo = await serverClient.resolveStream(track);
      console.log('[IPC] Stream resolved:', streamInfo?.url ? 'success' : 'failed');
      return streamInfo;
    } catch (error) {
      console.error('[IPC] Stream resolution error:', error);
      return null;
    }
  });

  ipcMain.handle('pause', async () => ({ success: true }));
  ipcMain.handle('resume', async () => ({ success: true }));
  ipcMain.handle('seek', async () => ({ success: true }));
  ipcMain.handle('get-playback-state', async () => ({
    isPlaying: false,
    currentTrack: null,
    position: 0,
    duration: 0
  }));

  // Addon stubs
  ipcMain.handle('set-addon-enabled', async () => ({ success: false }));
  ipcMain.handle('update-addon-settings', async () => ({ success: false }));
  ipcMain.handle('get-addon-settings', async () => ({}));
  ipcMain.handle('set-addon-priority', async () => ({ success: false }));
  ipcMain.handle('set-addon-order', async () => ({ success: false }));
  ipcMain.handle('get-addon-priorities', async () => ({}));
  ipcMain.handle('get-loaded-plugins', async () => []);
  ipcMain.handle('reload-plugins', async () => ({ success: false }));
  ipcMain.handle('is-plugin-loaded', async () => false);

  // Feature stubs
  ipcMain.handle('get-animated-artwork', async () => null);
  ipcMain.handle('get-similar-albums', async () => []);
  ipcMain.handle('get-similar-tracks', async () => []);
  ipcMain.handle('prefetch-tracks', async (_event, tracks: any[]) => {
    console.log('[IPC] prefetch-tracks called for', tracks?.length, 'tracks');
    if (!serverClient.isConnected() || !tracks?.length) {
      return {};
    }

    const results: Record<string, any> = {};

    // Resolve streams in parallel (limit concurrency to 3)
    const concurrency = 3;
    for (let i = 0; i < tracks.length; i += concurrency) {
      const batch = tracks.slice(i, i + concurrency);
      const batchResults = await Promise.all(
        batch.map(async (track) => {
          try {
            const streamInfo = await serverClient.resolveStream(track);
            return { trackId: track.id, streamInfo };
          } catch {
            return { trackId: track.id, streamInfo: null };
          }
        })
      );

      for (const { trackId, streamInfo } of batchResults) {
        if (streamInfo) {
          results[trackId] = streamInfo;
        }
      }
    }

    console.log('[IPC] Prefetched', Object.keys(results).length, '/', tracks.length, 'streams');
    return results;
  });
  ipcMain.handle('get-artist-latest-release', async () => null);
  ipcMain.handle('get-lyrics', async () => null);
  ipcMain.handle('get-recommended-tracks', async () => []);

  // Settings
  ipcMain.handle('update-settings', async () => ({ success: true }));
  ipcMain.handle('get-app-paths', async () => ({
    userData: app.getPath('userData'),
    temp: app.getPath('temp')
  }));

  // Enrichment stubs
  ipcMain.handle('get-available-enrichment-types', async () => []);
  ipcMain.handle('get-artist-videos', async () => []);
  ipcMain.handle('get-album-videos', async () => []);
  ipcMain.handle('get-video-stream', async () => null);
  ipcMain.handle('get-artist-timeline', async () => null);
  ipcMain.handle('get-artist-setlists', async () => []);
  ipcMain.handle('get-artist-concerts', async () => []);
  ipcMain.handle('get-artist-gallery', async () => []);
  ipcMain.handle('get-artist-merchandise', async () => null);

  // Translation stub
  ipcMain.handle('translate-text', async () => null);

  // Rename playlist
  ipcMain.handle('rename-playlist', async (_event, playlistId: string, name: string) => {
    if (!serverClient.isConnected()) return { success: false };
    try {
      return await serverClient.renamePlaylist(playlistId, name);
    } catch (error) {
      console.error('[IPC] Rename playlist error:', error);
      return { success: false };
    }
  });

  // Dislike APIs
  ipcMain.handle('get-disliked-tracks', async () => {
    if (!serverClient.isConnected()) return { tracks: [] };
    try {
      return await serverClient.getDislikedTracks();
    } catch {
      return { tracks: [] };
    }
  });

  ipcMain.handle('dislike-track', async (_event, track: any, reasons?: string[]) => {
    if (!serverClient.isConnected()) return { success: false };
    try {
      return await serverClient.dislikeTrack(track, reasons);
    } catch {
      return { success: false };
    }
  });

  ipcMain.handle('remove-dislike', async (_event, trackId: string) => {
    if (!serverClient.isConnected()) return { success: false };
    try {
      return await serverClient.removeDislike(trackId);
    } catch {
      return { success: false };
    }
  });

  // ========================================
  // Server Discovery (mDNS)
  // ========================================

  // Store discovered servers
  const discoveredServers: Map<string, { name: string; url: string; serverId: string }> = new Map();
  let bonjour: Bonjour | null = null;
  let browser: Browser | null = null;

  ipcMain.handle('discovery-get-servers', async () => {
    return Array.from(discoveredServers.values());
  });

  ipcMain.handle('discovery-start', async () => {
    console.log('[Discovery] Starting mDNS browsing...');

    try {
      // Create bonjour instance if not exists
      if (!bonjour) {
        bonjour = new Bonjour();
      }

      // Stop existing browser if running
      if (browser) {
        browser.stop();
      }

      // Clear discovered servers
      discoveredServers.clear();

      // Start browsing for audiio services
      browser = bonjour.find({ type: 'audiio' }, (service: Service) => {
        console.log('[Discovery] Found service:', service.name, service.host, service.port);

        // Build URL from service info
        const addresses = service.addresses || [];
        const ipv4 = addresses.find((addr: string) => !addr.includes(':')) || service.host;
        const url = `http://${ipv4}:${service.port}`;

        // Get serverId from TXT record
        const txt = service.txt as Record<string, string> || {};
        const serverId = txt.serverId || service.name;

        const serverInfo = {
          name: service.name,
          url,
          serverId
        };

        discoveredServers.set(serverId, serverInfo);
        console.log('[Discovery] Added server:', serverInfo);

        // Notify renderer
        if (mainWindow) {
          mainWindow.webContents.send('discovery-server-found', serverInfo);
        }
      });

      // Handle service removal
      browser.on('down', (service: Service) => {
        console.log('[Discovery] Service down:', service.name);
        const txt = service.txt as Record<string, string> || {};
        const serverId = txt.serverId || service.name;

        if (discoveredServers.has(serverId)) {
          discoveredServers.delete(serverId);
          if (mainWindow) {
            mainWindow.webContents.send('discovery-server-lost', serverId);
          }
        }
      });

      return { success: true };
    } catch (error) {
      console.error('[Discovery] Failed to start browsing:', error);
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle('discovery-stop', async () => {
    console.log('[Discovery] Stopping mDNS browsing...');

    if (browser) {
      browser.stop();
      browser = null;
    }

    return { success: true };
  });

  // ========================================
  // Tracking API (proxied to server)
  // ========================================

  ipcMain.handle('track-event', async (_event, trackEvent: any) => {
    if (!serverClient.isConnected()) return { success: false };
    try {
      return await serverClient.trackEvent(trackEvent);
    } catch (error) {
      console.error('[IPC] Track event error:', error);
      return { success: false };
    }
  });

  ipcMain.handle('track-batch', async (_event, events: any[]) => {
    if (!serverClient.isConnected()) return { success: false };
    try {
      return await serverClient.trackBatch(events);
    } catch (error) {
      console.error('[IPC] Track batch error:', error);
      return { success: false };
    }
  });

  // ========================================
  // Stats API (proxied to server)
  // ========================================

  ipcMain.handle('stats-overview', async () => {
    if (!serverClient.isConnected()) return null;
    try {
      return await serverClient.getStatsOverview();
    } catch (error) {
      console.error('[IPC] Stats overview error:', error);
      return null;
    }
  });

  ipcMain.handle('stats-top-artists', async (_event, limit?: number) => {
    if (!serverClient.isConnected()) return { artists: [] };
    try {
      return await serverClient.getTopArtists(limit);
    } catch {
      return { artists: [] };
    }
  });

  ipcMain.handle('stats-top-tracks', async (_event, limit?: number) => {
    if (!serverClient.isConnected()) return { tracks: [] };
    try {
      return await serverClient.getTopTracks(limit);
    } catch {
      return { tracks: [] };
    }
  });

  ipcMain.handle('stats-patterns', async () => {
    if (!serverClient.isConnected()) return null;
    try {
      return await serverClient.getListeningPatterns();
    } catch {
      return null;
    }
  });

  ipcMain.handle('stats-streaks', async () => {
    if (!serverClient.isConnected()) return null;
    try {
      return await serverClient.getStreaks();
    } catch {
      return null;
    }
  });

  ipcMain.handle('stats-period', async (_event, period: string) => {
    if (!serverClient.isConnected()) return null;
    try {
      return await serverClient.getStats(period);
    } catch {
      return null;
    }
  });

  ipcMain.handle('stats-clear', async () => {
    if (!serverClient.isConnected()) return false;
    try {
      await serverClient.clearStats();
      return true;
    } catch {
      return false;
    }
  });

  // Note: dislike-track, dislike-list, and remove-dislike handlers are defined earlier in this file

  ipcMain.handle('dislike-remove', async (_event, trackId: string) => {
    if (!serverClient.isConnected()) return false;
    try {
      await serverClient.removeDislike(trackId);
      return true;
    } catch {
      return false;
    }
  });

  // ========================================
  // ML Algorithm APIs (proxied to server)
  // ========================================

  ipcMain.handle('algo-score-track', async (_event, trackId: string) => {
    if (!serverClient.isConnected()) return null;
    try {
      return await serverClient.algoScoreTrack(trackId);
    } catch {
      return null;
    }
  });

  ipcMain.handle('algo-score-batch', async (_event, trackIds: string[]) => {
    if (!serverClient.isConnected()) return {};
    try {
      return await serverClient.algoScoreBatch(trackIds);
    } catch {
      return {};
    }
  });

  ipcMain.handle('algo-recommendations', async (_event, count: number, mode?: string) => {
    if (!serverClient.isConnected()) return [];
    try {
      const result = await serverClient.algoGetRecommendations(count, mode);
      return result?.tracks || [];
    } catch {
      return [];
    }
  });

  ipcMain.handle('algo-similar', async (_event, trackId: string, count: number) => {
    if (!serverClient.isConnected()) return [];
    try {
      const result = await serverClient.algoGetSimilar(trackId, count);
      return result?.tracks || [];
    } catch {
      return [];
    }
  });

  ipcMain.handle('algo-radio', async (_event, seedTrackId: string, count: number) => {
    if (!serverClient.isConnected()) return [];
    try {
      const result = await serverClient.algoGetRadio(seedTrackId, count);
      return result?.tracks || [];
    } catch {
      return [];
    }
  });

  ipcMain.handle('algo-artist-radio', async (_event, artistId: string, count: number) => {
    if (!serverClient.isConnected()) return [];
    try {
      const result = await serverClient.algoGetArtistRadio(artistId, count);
      return result?.tracks || [];
    } catch {
      return [];
    }
  });

  ipcMain.handle('algo-genre-radio', async (_event, genre: string, count: number) => {
    if (!serverClient.isConnected()) return [];
    try {
      const result = await serverClient.algoGetGenreRadio(genre, count);
      return result?.tracks || [];
    } catch {
      return [];
    }
  });

  ipcMain.handle('algo-features', async (_event, trackId: string) => {
    if (!serverClient.isConnected()) return null;
    try {
      return await serverClient.algoGetFeatures(trackId);
    } catch {
      return null;
    }
  });

  ipcMain.handle('algo-train', async () => {
    if (!serverClient.isConnected()) return { success: false };
    try {
      return await serverClient.algoTrain();
    } catch {
      return { success: false };
    }
  });

  ipcMain.handle('algo-training-status', async () => {
    if (!serverClient.isConnected()) return { isTraining: false };
    try {
      return await serverClient.algoGetTrainingStatus();
    } catch {
      return { isTraining: false };
    }
  });

  ipcMain.handle('algo-profile', async () => {
    if (!serverClient.isConnected()) return null;
    try {
      return await serverClient.algoGetProfile();
    } catch {
      return null;
    }
  });

  ipcMain.handle('algo-preferences', async () => {
    if (!serverClient.isConnected()) return {};
    try {
      return await serverClient.algoGetPreferences();
    } catch {
      return {};
    }
  });

  ipcMain.handle('algo-update-preferences', async (_event, preferences: any) => {
    if (!serverClient.isConnected()) return { success: false };
    try {
      return await serverClient.algoUpdatePreferences(preferences);
    } catch {
      return { success: false };
    }
  });

  ipcMain.handle('algo-next-queue', async (_event, count: number) => {
    if (!serverClient.isConnected()) return [];
    try {
      const result = await serverClient.algoGetNextQueue(count);
      return result?.tracks || [];
    } catch {
      return [];
    }
  });
}

// ========================================
// Content Security Policy
// ========================================

function setupContentSecurityPolicy(): void {
  const isDev = process.argv.includes('--dev');

  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    // Build CSP based on environment
    const csp = isDev
      ? [
          "default-src 'self'",
          "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // unsafe-eval needed for Vite HMR
          "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
          "style-src-elem 'self' 'unsafe-inline' https://fonts.googleapis.com",
          "img-src 'self' data: blob: https: http:",
          "media-src 'self' blob: data: https: http:",
          "connect-src 'self' ws: wss: http: https:",
          "font-src 'self' data: https://fonts.gstatic.com",
          "worker-src 'self' blob:",
        ].join('; ')
      : [
          "default-src 'self'",
          "script-src 'self'",
          "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
          "style-src-elem 'self' 'unsafe-inline' https://fonts.googleapis.com",
          "img-src 'self' data: blob: https:",
          "media-src 'self' blob: data: https:",
          "connect-src 'self' https: wss:",
          "font-src 'self' data: https://fonts.gstatic.com",
          "worker-src 'self' blob:",
        ].join('; ');

    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [csp],
      },
    });
  });
}

// ========================================
// App Lifecycle
// ========================================

app.whenReady().then(async () => {
  // Setup Content Security Policy
  setupContentSecurityPolicy();

  // Load config
  config = loadConfig();
  console.log('[Client] Config file path:', path.join(app.getPath('userData'), 'client-config.json'));
  console.log('[Client] Loaded config:', JSON.stringify(config));

  // Initialize server client
  serverClient = getServerClient();

  // Setup IPC handlers
  setupIpcHandlers();

  // Restore device identity and session token from config
  if (config.deviceIdentity) {
    console.log('[Client] Restoring device identity:', config.deviceIdentity.deviceId);
    serverClient.setDeviceIdentity(config.deviceIdentity);
  }
  if (config.sessionToken) {
    console.log('[Client] Restoring session token');
    serverClient.setSessionToken(config.sessionToken);
  }

  // Auto-connect if we have a saved server
  if (config.serverUrl) {
    console.log('[Client] Auto-connecting to saved server:', config.serverUrl);
    const connected = await serverClient.connect({
      url: config.serverUrl,
      token: config.token || undefined
    });
    console.log('[Client] Auto-connect result:', connected);
    console.log('[Client] Connection state:', serverClient.getConnectionState());

    // Save updated session token (might have been refreshed)
    if (connected) {
      const newSessionToken = serverClient.getSessionToken();
      if (newSessionToken !== config.sessionToken) {
        config.sessionToken = newSessionToken;
        config.deviceIdentity = serverClient.getOrCreateDeviceIdentity();
        saveConfig(config);
        console.log('[Client] Updated session token saved');
      }
    }
  } else {
    console.log('[Client] No saved server URL, skipping auto-connect');
  }

  // Forward connection state changes to renderer
  serverClient.on('connection-change', (state) => {
    mainWindow?.webContents.send('connection-state-changed', state);
  });

  serverClient.on('playback-state', (state) => {
    mainWindow?.webContents.send('playback-state-update', state);
  });

  // Create window
  await createWindow();
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

app.on('before-quit', () => {
  serverClient.disconnect();
});
