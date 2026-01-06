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
    if (!serverClient.isConnected()) {
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
      const results = await serverClient.search(query, type, limit);
      return results || [];
    } catch (error) {
      console.error('[IPC] Search failed:', error instanceof Error ? error.message : error);
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
  // Library API (proxied to server)
  // ========================================

  ipcMain.handle('library-likes', async () => {
    if (!serverClient.isConnected()) return { tracks: [] };
    try {
      return await serverClient.getLikedTracks();
    } catch (error) {
      console.error('[IPC] Get liked tracks error:', error);
      return { tracks: [] };
    }
  });

  ipcMain.handle('like-track', async (_event, track: any) => {
    if (!serverClient.isConnected()) return { success: false };
    try {
      return await serverClient.likeTrack(track);
    } catch (error) {
      console.error('[IPC] Like track error:', error);
      return { success: false };
    }
  });

  ipcMain.handle('unlike-track', async (_event, trackId: string) => {
    if (!serverClient.isConnected()) return { success: false };
    try {
      return await serverClient.unlikeTrack(trackId);
    } catch (error) {
      console.error('[IPC] Unlike track error:', error);
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

  // Dislikes
  ipcMain.handle('dislike-list', async () => {
    if (!serverClient.isConnected()) return { tracks: [] };
    try {
      return await serverClient.getDislikedTracks();
    } catch (error) {
      console.error('[IPC] Get disliked tracks error:', error);
      return { tracks: [] };
    }
  });

  ipcMain.handle('dislike-track', async (_event, track: any, reasons?: string[]) => {
    if (!serverClient.isConnected()) return { success: false };
    try {
      return await serverClient.dislikeTrack(track, reasons);
    } catch (error) {
      console.error('[IPC] Dislike track error:', error);
      return { success: false };
    }
  });

  ipcMain.handle('dislike-remove', async (_event, trackId: string) => {
    if (!serverClient.isConnected()) return { success: false };
    try {
      return await serverClient.removeDislike(trackId);
    } catch (error) {
      console.error('[IPC] Remove dislike error:', error);
      return { success: false };
    }
  });

  // ========================================
  // Generic API Fetch (for stores that need direct server access)
  // ========================================

  ipcMain.handle('api-fetch', async (_event, args: { path: string; options?: { method?: string; body?: unknown } }) => {
    if (!serverClient.isConnected()) {
      return { error: 'Not connected to server' };
    }
    try {
      return await serverClient.apiFetch(args.path, args.options);
    } catch (error) {
      console.error('[IPC] API fetch error:', error);
      return { error: String(error) };
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

  ipcMain.handle('create-playlist', async (_event, name: string, description?: string, options?: any) => {
    if (!serverClient.isConnected()) return null;
    try {
      return await serverClient.createPlaylist(name, description, options);
    } catch (error) {
      console.error('[IPC] Create playlist error:', error);
      return null;
    }
  });

  ipcMain.handle('update-playlist', async (_event, playlistId: string, data: any) => {
    if (!serverClient.isConnected()) return { success: false };
    try {
      return await serverClient.updatePlaylist(playlistId, data);
    } catch (error) {
      console.error('[IPC] Update playlist error:', error);
      return { success: false };
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

  // Playlist Rules (for smart/hybrid playlists)
  ipcMain.handle('get-playlist-rules', async () => {
    if (!serverClient.isConnected()) return { rules: [] };
    try {
      return await serverClient.getPlaylistRules();
    } catch (error) {
      console.error('[IPC] Get playlist rules error:', error);
      return { rules: [] };
    }
  });

  ipcMain.handle('evaluate-playlist-rules', async (_event, playlistId: string) => {
    if (!serverClient.isConnected()) return { tracks: [], count: 0 };
    try {
      return await serverClient.evaluatePlaylistRules(playlistId);
    } catch (error) {
      console.error('[IPC] Evaluate playlist rules error:', error);
      return { tracks: [], count: 0 };
    }
  });

  ipcMain.handle('preview-playlist-rules', async (_event, options: any) => {
    if (!serverClient.isConnected()) return { tracks: [], count: 0 };
    try {
      return await serverClient.previewPlaylistRules(options);
    } catch (error) {
      console.error('[IPC] Preview playlist rules error:', error);
      return { tracks: [], count: 0 };
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
    if (!serverClient.isConnected()) {
      return null;
    }

    try {
      // Check if this is a local track - should play directly without plugin search
      const isLocalTrack = track?.isLocal ||
        track?.id?.startsWith('local:') ||
        track?._meta?.metadataProvider === 'local-file' ||
        track?.streamInfo?.url?.startsWith('local-audio://');

      if (isLocalTrack) {
        // Get the local file path
        let filePath = track?.localPath;

        // If streamInfo has local-audio:// URL, extract path from it
        if (!filePath && track?.streamInfo?.url?.startsWith('local-audio://')) {
          filePath = decodeURIComponent(track.streamInfo.url.replace('local-audio://', ''));
        }

        if (filePath) {
          // Convert to server's local stream endpoint
          const serverUrl = serverClient.getServerUrl();
          const localStreamUrl = `${serverUrl}/api/stream/local?path=${encodeURIComponent(filePath)}`;

          return {
            url: localStreamUrl,
            quality: 'lossless',
            mimeType: track?.isVideo ? 'video/mp4' : 'audio/mpeg',
            expiresAt: null, // Local files never expire
          };
        }
      }

      // For remote tracks, resolve stream from server
      return await serverClient.resolveStream(track);
    } catch (error) {
      console.error('[IPC] Stream resolution failed:', error instanceof Error ? error.message : error);
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
  ipcMain.handle('update-addon-settings', async (_event, args: { addonId: string; settings: Record<string, unknown> }) => {
    if (!serverClient.isConnected()) return { success: false };
    try {
      return await serverClient.updateAddonSettings(args.addonId, args.settings);
    } catch (error) {
      console.error('[IPC] Update addon settings error:', error);
      return { success: false };
    }
  });
  ipcMain.handle('get-addon-settings', async (_event, addonId: string) => {
    if (!serverClient.isConnected()) return {};
    try {
      const result = await serverClient.getAddonSettings(addonId);
      return result?.settings || {};
    } catch (error) {
      console.error('[IPC] Get addon settings error:', error);
      return {};
    }
  });
  ipcMain.handle('set-addon-priority', async () => ({ success: false }));
  ipcMain.handle('set-addon-order', async () => ({ success: false }));
  ipcMain.handle('get-addon-priorities', async () => ({}));
  ipcMain.handle('get-loaded-plugins', async () => {
    // Return addons from server with settingsDefinitions for plugin settings UI
    if (!serverClient.isConnected()) return [];
    try {
      const result = await serverClient.getAddons();
      return result?.addons || [];
    } catch (error) {
      console.error('[IPC] Get loaded plugins error:', error);
      return [];
    }
  });
  ipcMain.handle('reload-plugins', async () => ({ success: false }));
  ipcMain.handle('is-plugin-loaded', async () => false);

  // Scrobble API
  ipcMain.handle('scrobble-submit', async (_event, args: {
    pluginId: string;
    data: { title: string; artist: string; album?: string; duration: number; timestamp: number; playedMs: number };
  }) => {
    if (!serverClient.isConnected()) return { success: false };
    try {
      console.log(`[IPC] Scrobble submit to ${args.pluginId}:`, args.data.title);
      return await serverClient.scrobbleSubmit(args.pluginId, args.data);
    } catch (error) {
      console.error('[IPC] Scrobble submit error:', error);
      return { success: false };
    }
  });

  ipcMain.handle('scrobble-now-playing', async (_event, args: {
    pluginId: string;
    data: { title: string; artist: string; album?: string; duration: number };
  }) => {
    if (!serverClient.isConnected()) return { success: false };
    try {
      console.log(`[IPC] Now playing to ${args.pluginId}:`, args.data.title);
      return await serverClient.scrobbleNowPlaying(args.pluginId, args.data);
    } catch (error) {
      console.error('[IPC] Now playing error:', error);
      return { success: false };
    }
  });

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
  ipcMain.handle('get-lyrics', async (_event, params: { title: string; artist: string; album?: string; duration?: number }) => {
    if (!serverClient.isConnected()) return null;
    try {
      return await serverClient.getLyrics(params);
    } catch (error) {
      console.error('[IPC] get-lyrics error:', error);
      return null;
    }
  });
  ipcMain.handle('get-recommended-tracks', async () => []);

  // Settings
  ipcMain.handle('update-settings', async () => ({ success: true }));
  ipcMain.handle('get-app-paths', async () => ({
    userData: app.getPath('userData'),
    temp: app.getPath('temp')
  }));

  // Artist Enrichment APIs (proxy to server)
  ipcMain.handle('get-available-enrichment-types', async () => {
    if (!serverClient.isConnected()) return [];
    try {
      return await serverClient.getAvailableEnrichmentTypes();
    } catch (error) {
      console.error('[IPC] get-available-enrichment-types error:', error);
      return [];
    }
  });

  ipcMain.handle('get-artist-videos', async (_event, { artistName, limit }) => {
    if (!serverClient.isConnected()) return { success: false, data: [] };
    try {
      return await serverClient.getArtistVideos(artistName, limit);
    } catch (error) {
      console.error('[IPC] get-artist-videos error:', error);
      return { success: false, data: [] };
    }
  });

  ipcMain.handle('get-album-videos', async (_event, { albumTitle, artistName, trackNames, limit }) => {
    if (!serverClient.isConnected()) return { success: false, data: [] };
    try {
      return await serverClient.getAlbumVideos(albumTitle, artistName, trackNames, limit);
    } catch (error) {
      console.error('[IPC] get-album-videos error:', error);
      return { success: false, data: [] };
    }
  });

  ipcMain.handle('get-video-stream', async (_event, { videoId, source, preferredQuality }) => {
    if (!serverClient.isConnected()) return { success: false, error: 'Not connected to server' };
    try {
      return await serverClient.getVideoStream(videoId, source, preferredQuality);
    } catch (error) {
      console.error('[IPC] get-video-stream error:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Failed to get video stream' };
    }
  });

  ipcMain.handle('get-artist-timeline', async (_event, { artistName }) => {
    if (!serverClient.isConnected()) return { success: false, data: null };
    try {
      return await serverClient.getArtistTimeline(artistName);
    } catch (error) {
      console.error('[IPC] get-artist-timeline error:', error);
      return { success: false, data: null };
    }
  });

  ipcMain.handle('get-artist-setlists', async (_event, { artistName, mbid, limit }) => {
    if (!serverClient.isConnected()) return { success: false, data: [] };
    try {
      return await serverClient.getArtistSetlists(artistName, mbid, limit);
    } catch (error) {
      console.error('[IPC] get-artist-setlists error:', error);
      return { success: false, data: [] };
    }
  });

  ipcMain.handle('get-artist-concerts', async (_event, { artistName }) => {
    if (!serverClient.isConnected()) return { success: false, data: [] };
    try {
      return await serverClient.getArtistConcerts(artistName);
    } catch (error) {
      console.error('[IPC] get-artist-concerts error:', error);
      return { success: false, data: [] };
    }
  });

  ipcMain.handle('get-artist-gallery', async (_event, { artistName, mbid }) => {
    if (!serverClient.isConnected()) return { success: false, data: null };
    try {
      return await serverClient.getArtistGallery(artistName, mbid);
    } catch (error) {
      console.error('[IPC] get-artist-gallery error:', error);
      return { success: false, data: null };
    }
  });

  ipcMain.handle('get-artist-merchandise', async (_event, { artistName }) => {
    if (!serverClient.isConnected()) return { success: false, data: null };
    try {
      return await serverClient.getArtistMerchandise(artistName);
    } catch (error) {
      console.error('[IPC] get-artist-merchandise error:', error);
      return { success: false, data: null };
    }
  });

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

  ipcMain.handle('stats-listen-history', async (_event, limit?: number) => {
    if (!serverClient.isConnected()) return { entries: [] };
    try {
      return await serverClient.getListenHistory(limit);
    } catch (error) {
      console.error('[IPC] stats-listen-history error:', error);
      return { entries: [] };
    }
  });

  // Note: dislike-track, dislike-list, and dislike-remove handlers are defined earlier in this file

  // ========================================
  // ML Algorithm APIs (proxied to server)
  // ========================================

  ipcMain.handle('algo-score-track', async (_event, trackId: string) => {
    if (!serverClient.isConnected()) return null;
    try {
      return await serverClient.algoScoreTrack(trackId);
    } catch (error) {
      console.error('[IPC] algo-score-track error:', error);
      return null;
    }
  });

  ipcMain.handle('algo-score-batch', async (_event, trackIds: string[]) => {
    if (!serverClient.isConnected()) return {};
    try {
      return await serverClient.algoScoreBatch(trackIds);
    } catch (error) {
      console.error('[IPC] algo-score-batch error:', error);
      return {};
    }
  });

  ipcMain.handle('algo-recommendations', async (_event, count: number, mode?: string) => {
    if (!serverClient.isConnected()) return [];
    try {
      const result = await serverClient.algoGetRecommendations(count, mode);
      return result?.tracks || [];
    } catch (error) {
      console.error('[IPC] algo-recommendations error:', error);
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

  // ========================================
  // Media Folders API (proxied to server)
  // ========================================

  ipcMain.handle('media-get-folders', async (_event, type?: 'audio' | 'video' | 'downloads') => {
    console.log(`[IPC] media-get-folders called with type: ${type}`);
    if (!serverClient.isConnected()) {
      console.log('[IPC] media-get-folders: Server not connected');
      return { folders: [] };
    }
    try {
      const result = await serverClient.getMediaFolders(type);
      console.log(`[IPC] media-get-folders result:`, JSON.stringify(result, null, 2));
      return result;
    } catch (error) {
      console.error('[IPC] Get media folders error:', error);
      return { folders: [] };
    }
  });

  ipcMain.handle('media-get-folder', async (_event, folderId: string) => {
    if (!serverClient.isConnected()) return null;
    try {
      return await serverClient.getMediaFolder(folderId);
    } catch (error) {
      console.error('[IPC] Get media folder error:', error);
      return null;
    }
  });

  ipcMain.handle('media-add-folder', async (_event, path: string, type: 'audio' | 'video' | 'downloads', options?: any) => {
    if (!serverClient.isConnected()) return { success: false, error: 'Not connected' };
    try {
      return await serverClient.addMediaFolder(path, type, options);
    } catch (error) {
      console.error('[IPC] Add media folder error:', error);
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle('media-update-folder', async (_event, folderId: string, updates: any) => {
    if (!serverClient.isConnected()) return { success: false, error: 'Not connected' };
    try {
      return await serverClient.updateMediaFolder(folderId, updates);
    } catch (error) {
      console.error('[IPC] Update media folder error:', error);
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle('media-remove-folder', async (_event, folderId: string) => {
    if (!serverClient.isConnected()) return { success: false, error: 'Not connected' };
    try {
      return await serverClient.removeMediaFolder(folderId);
    } catch (error) {
      console.error('[IPC] Remove media folder error:', error);
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle('media-browse-filesystem', async (_event, path?: string) => {
    if (!serverClient.isConnected()) return { currentPath: '', parentPath: null, directories: [], canWrite: false };
    try {
      return await serverClient.browseFilesystem(path);
    } catch (error) {
      console.error('[IPC] Browse filesystem error:', error);
      return { currentPath: '', parentPath: null, directories: [], canWrite: false };
    }
  });

  ipcMain.handle('media-get-roots', async () => {
    if (!serverClient.isConnected()) return { roots: [] };
    try {
      return await serverClient.getFilesystemRoots();
    } catch (error) {
      console.error('[IPC] Get roots error:', error);
      return { roots: [] };
    }
  });

  ipcMain.handle('media-get-folder-tracks', async (_event, folderId: string, options?: any) => {
    if (!serverClient.isConnected()) return { tracks: [], total: 0 };
    try {
      return await serverClient.getFolderTracks(folderId, options);
    } catch (error) {
      console.error('[IPC] Get folder tracks error:', error);
      return { tracks: [], total: 0 };
    }
  });

  // ========================================
  // Scanning API (proxied to server)
  // ========================================

  ipcMain.handle('media-scan-folder', async (_event, folderId: string, options?: any) => {
    if (!serverClient.isConnected()) return { success: false, error: 'Not connected' };
    try {
      return await serverClient.scanFolder(folderId, options);
    } catch (error) {
      console.error('[IPC] Scan folder error:', error);
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle('media-scan-status', async () => {
    if (!serverClient.isConnected()) return { isScanning: false, folderId: null };
    try {
      return await serverClient.getScanStatus();
    } catch (error) {
      console.error('[IPC] Scan status error:', error);
      return { isScanning: false, folderId: null };
    }
  });

  ipcMain.handle('media-abort-scan', async () => {
    if (!serverClient.isConnected()) return { success: false };
    try {
      return await serverClient.abortScan();
    } catch (error) {
      console.error('[IPC] Abort scan error:', error);
      return { success: false };
    }
  });

  ipcMain.handle('media-get-track-artwork', async (_event, trackId: string) => {
    if (!serverClient.isConnected()) return null;
    try {
      return await serverClient.getLocalTrackArtwork(trackId);
    } catch (error) {
      console.error('[IPC] Get track artwork error:', error);
      return null;
    }
  });

  // ========================================
  // Download API (proxied to server)
  // ========================================

  ipcMain.handle('media-start-download', async (_event, options: any) => {
    console.log('[IPC] Download request received:', { filename: options?.filename, hasUrl: !!options?.url });
    if (!serverClient.isConnected()) {
      console.error('[IPC] Download failed: Not connected to server');
      return { success: false, error: 'Not connected' };
    }
    try {
      const result = await serverClient.startDownload(options);
      console.log('[IPC] Download result:', result);
      return result;
    } catch (error) {
      console.error('[IPC] Start download error:', error);
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle('media-get-downloads', async () => {
    if (!serverClient.isConnected()) return { active: [], queued: [] };
    try {
      return await serverClient.getActiveDownloads();
    } catch (error) {
      console.error('[IPC] Get downloads error:', error);
      return { active: [], queued: [] };
    }
  });

  ipcMain.handle('media-get-download-history', async (_event, status?: string) => {
    if (!serverClient.isConnected()) return { downloads: [] };
    try {
      return await serverClient.getDownloadHistory(status);
    } catch (error) {
      console.error('[IPC] Get download history error:', error);
      return { downloads: [] };
    }
  });

  ipcMain.handle('media-cancel-download', async (_event, downloadId: string) => {
    if (!serverClient.isConnected()) return { success: false };
    try {
      return await serverClient.cancelDownload(downloadId);
    } catch (error) {
      console.error('[IPC] Cancel download error:', error);
      return { success: false };
    }
  });

  // Player State
  ipcMain.handle('player-last-state', async () => {
    if (!serverClient.isConnected()) return { success: false };
    try {
      return await serverClient.getLastPlaybackState();
    } catch (error) {
      console.error('[IPC] Last state error:', error);
      return { success: false };
    }
  });

  // ========================================
  // Tags API (proxied to server)
  // ========================================

  ipcMain.handle('tags-get-all', async () => {
    if (!serverClient.isConnected()) return { tags: [] };
    try {
      return await serverClient.getTags();
    } catch (error) {
      console.error('[IPC] Get tags error:', error);
      return { tags: [] };
    }
  });

  ipcMain.handle('tags-create', async (_event, name: string, color?: string) => {
    if (!serverClient.isConnected()) return { success: false };
    try {
      return await serverClient.createTag(name, color);
    } catch (error) {
      console.error('[IPC] Create tag error:', error);
      return { success: false };
    }
  });

  ipcMain.handle('tags-update', async (_event, tagId: string, data: { name?: string; color?: string }) => {
    if (!serverClient.isConnected()) return { success: false };
    try {
      return await serverClient.updateTag(tagId, data);
    } catch (error) {
      console.error('[IPC] Update tag error:', error);
      return { success: false };
    }
  });

  ipcMain.handle('tags-delete', async (_event, tagId: string) => {
    if (!serverClient.isConnected()) return { success: false };
    try {
      return await serverClient.deleteTag(tagId);
    } catch (error) {
      console.error('[IPC] Delete tag error:', error);
      return { success: false };
    }
  });

  ipcMain.handle('tags-get-track-tags', async (_event, trackId: string) => {
    if (!serverClient.isConnected()) return { tags: [] };
    try {
      return await serverClient.getTrackTags(trackId);
    } catch (error) {
      console.error('[IPC] Get track tags error:', error);
      return { tags: [] };
    }
  });

  ipcMain.handle('tags-add-to-track', async (_event, trackId: string, tags: string[]) => {
    if (!serverClient.isConnected()) return { success: false };
    try {
      return await serverClient.addTagsToTrack(trackId, tags);
    } catch (error) {
      console.error('[IPC] Add tags to track error:', error);
      return { success: false };
    }
  });

  ipcMain.handle('tags-remove-from-track', async (_event, trackId: string, tagName: string) => {
    if (!serverClient.isConnected()) return { success: false };
    try {
      return await serverClient.removeTagFromTrack(trackId, tagName);
    } catch (error) {
      console.error('[IPC] Remove tag from track error:', error);
      return { success: false };
    }
  });

  ipcMain.handle('tags-get-tracks-by-tag', async (_event, tagName: string) => {
    if (!serverClient.isConnected()) return { tracks: [] };
    try {
      return await serverClient.getTracksByTag(tagName);
    } catch (error) {
      console.error('[IPC] Get tracks by tag error:', error);
      return { tracks: [] };
    }
  });

  ipcMain.handle('tags-get-entity-tags', async (_event, entityType: string, entityId: string) => {
    if (!serverClient.isConnected()) return { tags: [] };
    try {
      return await serverClient.getEntityTags(entityType, entityId);
    } catch (error) {
      console.error('[IPC] Get entity tags error:', error);
      return { tags: [] };
    }
  });

  ipcMain.handle('tags-add-to-entity', async (_event, entityType: string, entityId: string, tags: string[]) => {
    if (!serverClient.isConnected()) return { success: false };
    try {
      return await serverClient.addTagsToEntity(entityType, entityId, tags);
    } catch (error) {
      console.error('[IPC] Add tags to entity error:', error);
      return { success: false };
    }
  });

  ipcMain.handle('tags-remove-from-entity', async (_event, entityType: string, entityId: string, tagName: string) => {
    if (!serverClient.isConnected()) return { success: false };
    try {
      return await serverClient.removeTagFromEntity(entityType, entityId, tagName);
    } catch (error) {
      console.error('[IPC] Remove tag from entity error:', error);
      return { success: false };
    }
  });

  // ========================================
  // Collections API (proxied to server)
  // ========================================

  ipcMain.handle('collections-get-all', async () => {
    if (!serverClient.isConnected()) return { collections: [] };
    try {
      return await serverClient.getCollections();
    } catch (error) {
      console.error('[IPC] Get collections error:', error);
      return { collections: [] };
    }
  });

  ipcMain.handle('collections-get', async (_event, collectionId: string) => {
    if (!serverClient.isConnected()) return null;
    try {
      return await serverClient.getCollection(collectionId);
    } catch (error) {
      console.error('[IPC] Get collection error:', error);
      return null;
    }
  });

  ipcMain.handle('collections-create', async (_event, data: any) => {
    if (!serverClient.isConnected()) return { success: false };
    try {
      return await serverClient.createCollection(data);
    } catch (error) {
      console.error('[IPC] Create collection error:', error);
      return { success: false };
    }
  });

  ipcMain.handle('collections-update', async (_event, collectionId: string, data: any) => {
    if (!serverClient.isConnected()) return { success: false };
    try {
      return await serverClient.updateCollection(collectionId, data);
    } catch (error) {
      console.error('[IPC] Update collection error:', error);
      return { success: false };
    }
  });

  ipcMain.handle('collections-delete', async (_event, collectionId: string) => {
    if (!serverClient.isConnected()) return { success: false };
    try {
      return await serverClient.deleteCollection(collectionId);
    } catch (error) {
      console.error('[IPC] Delete collection error:', error);
      return { success: false };
    }
  });

  ipcMain.handle('collections-add-item', async (_event, collectionId: string, item: any) => {
    if (!serverClient.isConnected()) return { success: false };
    try {
      return await serverClient.addToCollection(collectionId, item);
    } catch (error) {
      console.error('[IPC] Add to collection error:', error);
      return { success: false };
    }
  });

  ipcMain.handle('collections-remove-item', async (_event, collectionId: string, itemId: string) => {
    if (!serverClient.isConnected()) return { success: false };
    try {
      return await serverClient.removeFromCollection(collectionId, itemId);
    } catch (error) {
      console.error('[IPC] Remove from collection error:', error);
      return { success: false };
    }
  });

  ipcMain.handle('collections-reorder-items', async (_event, collectionId: string, itemIds: string[]) => {
    if (!serverClient.isConnected()) return { success: false };
    try {
      return await serverClient.reorderCollectionItems(collectionId, itemIds);
    } catch (error) {
      console.error('[IPC] Reorder collection items error:', error);
      return { success: false };
    }
  });

  ipcMain.handle('collections-reorder', async (_event, collectionIds: string[]) => {
    if (!serverClient.isConnected()) return { success: false };
    try {
      return await serverClient.reorderCollections(collectionIds);
    } catch (error) {
      console.error('[IPC] Reorder collections error:', error);
      return { success: false };
    }
  });

  ipcMain.handle('collections-move-item', async (_event, collectionId: string, itemId: string, targetFolderId: string | null) => {
    if (!serverClient.isConnected()) return { success: false };
    try {
      return await serverClient.moveCollectionItem(collectionId, itemId, targetFolderId ?? undefined);
    } catch (error) {
      console.error('[IPC] Move collection item error:', error);
      return { success: false };
    }
  });

  ipcMain.handle('collections-create-folder', async (_event, collectionId: string, name: string, parentFolderId?: string | null) => {
    if (!serverClient.isConnected()) return { success: false, item: null };
    try {
      return await serverClient.createCollectionFolder(collectionId, { name, parentId: parentFolderId ?? undefined });
    } catch (error) {
      console.error('[IPC] Create collection folder error:', error);
      return { success: false, item: null };
    }
  });

  ipcMain.handle('collections-update-folder', async (_event, collectionId: string, folderId: string, data: { name?: string }) => {
    if (!serverClient.isConnected()) return { success: false };
    try {
      return await serverClient.updateCollectionFolder(collectionId, folderId, data);
    } catch (error) {
      console.error('[IPC] Update collection folder error:', error);
      return { success: false };
    }
  });

  ipcMain.handle('collections-delete-folder', async (_event, collectionId: string, folderId: string, moveContentsToParent: boolean) => {
    if (!serverClient.isConnected()) return { success: false };
    try {
      // Note: server endpoint may not support moveContentsToParent flag - check implementation
      return await serverClient.deleteCollectionFolder(collectionId, folderId);
    } catch (error) {
      console.error('[IPC] Delete collection folder error:', error);
      return { success: false };
    }
  });

  // ========================================
  // Audio Features API (proxied to server)
  // ========================================

  ipcMain.handle('audio-features-get', async (_event, trackId: string) => {
    if (!serverClient.isConnected()) return null;
    try {
      return await serverClient.getAudioFeatures(trackId);
    } catch (error) {
      console.error('[IPC] Get audio features error:', error);
      return null;
    }
  });

  ipcMain.handle('audio-features-query', async (_event, query: any) => {
    if (!serverClient.isConnected()) return { tracks: [] };
    try {
      return await serverClient.queryAudioFeatures(query);
    } catch (error) {
      console.error('[IPC] Query audio features error:', error);
      return { tracks: [] };
    }
  });

  ipcMain.handle('audio-features-similar', async (_event, trackId: string, count: number) => {
    if (!serverClient.isConnected()) return { tracks: [] };
    try {
      return await serverClient.getSimilarByAudioFeatures(trackId, count);
    } catch (error) {
      console.error('[IPC] Get similar by audio features error:', error);
      return { tracks: [] };
    }
  });

  ipcMain.handle('audio-features-distributions', async () => {
    if (!serverClient.isConnected()) return {};
    try {
      return await serverClient.getAudioFeatureDistributions();
    } catch (error) {
      console.error('[IPC] Get audio feature distributions error:', error);
      return {};
    }
  });

  ipcMain.handle('audio-features-moods', async () => {
    if (!serverClient.isConnected()) return { moods: [] };
    try {
      return await serverClient.getMoodTypes();
    } catch (error) {
      console.error('[IPC] Get mood types error:', error);
      return { moods: [] };
    }
  });

  ipcMain.handle('audio-features-mood-clusters', async (_event, mood?: string) => {
    if (!serverClient.isConnected()) return { clusters: [] };
    try {
      return await serverClient.getMoodClusters(mood);
    } catch (error) {
      console.error('[IPC] Get mood clusters error:', error);
      return { clusters: [] };
    }
  });

  ipcMain.handle('audio-features-track-mood', async (_event, trackId: string) => {
    if (!serverClient.isConnected()) return null;
    try {
      return await serverClient.getTrackMood(trackId);
    } catch (error) {
      console.error('[IPC] Get track mood error:', error);
      return null;
    }
  });

  ipcMain.handle('audio-features-stats', async () => {
    if (!serverClient.isConnected()) return {};
    try {
      return await serverClient.getAudioFeatureStats();
    } catch (error) {
      console.error('[IPC] Get audio feature stats error:', error);
      return {};
    }
  });

  ipcMain.handle('audio-features-save', async (_event, trackId: string, features: any) => {
    if (!serverClient.isConnected()) return { success: false };
    try {
      return await serverClient.saveAudioFeatures(trackId, features);
    } catch (error) {
      console.error('[IPC] Save audio features error:', error);
      return { success: false };
    }
  });

  ipcMain.handle('audio-features-search', async (_event, criteria: any) => {
    if (!serverClient.isConnected()) return { tracks: [] };
    try {
      return await serverClient.searchByAudioFeatures(criteria);
    } catch (error) {
      console.error('[IPC] Search by audio features error:', error);
      return { tracks: [] };
    }
  });

  // ========================================
  // NLP Search API (proxied to server)
  // ========================================

  ipcMain.handle('search-natural', async (_event, query: string) => {
    if (!serverClient.isConnected()) return { tracks: [], parsed: null };
    try {
      return await serverClient.naturalLanguageSearch(query);
    } catch (error) {
      console.error('[IPC] Natural language search error:', error);
      return { tracks: [], parsed: null };
    }
  });

  ipcMain.handle('search-advanced', async (_event, params: any) => {
    if (!serverClient.isConnected()) return { tracks: [] };
    try {
      return await serverClient.advancedSearch(params);
    } catch (error) {
      console.error('[IPC] Advanced search error:', error);
      return { tracks: [] };
    }
  });

  ipcMain.handle('search-suggestions', async (_event, prefix: string) => {
    if (!serverClient.isConnected()) return { suggestions: [] };
    try {
      return await serverClient.getSearchSuggestions(prefix);
    } catch (error) {
      console.error('[IPC] Search suggestions error:', error);
      return { suggestions: [] };
    }
  });

  ipcMain.handle('search-history', async () => {
    if (!serverClient.isConnected()) return { history: [] };
    try {
      return await serverClient.getSearchHistory();
    } catch (error) {
      console.error('[IPC] Search history error:', error);
      return { history: [] };
    }
  });

  ipcMain.handle('search-history-delete', async (_event, id: string) => {
    if (!serverClient.isConnected()) return { success: false };
    try {
      return await serverClient.deleteSearchHistoryItem(id);
    } catch (error) {
      console.error('[IPC] Delete search history item error:', error);
      return { success: false };
    }
  });

  ipcMain.handle('search-history-clear', async () => {
    if (!serverClient.isConnected()) return { success: false };
    try {
      return await serverClient.clearSearchHistory();
    } catch (error) {
      console.error('[IPC] Clear search history error:', error);
      return { success: false };
    }
  });

  // ========================================
  // Embedding API (proxied to server)
  // ========================================

  ipcMain.handle('embedding-get', async (_event, trackId: string) => {
    if (!serverClient.isConnected()) return null;
    try {
      return await serverClient.getTrackEmbedding(trackId);
    } catch (error) {
      console.error('[IPC] Get embedding error:', error);
      return null;
    }
  });

  ipcMain.handle('embedding-similar', async (_event, embedding: number[], count: number) => {
    if (!serverClient.isConnected()) return { tracks: [] };
    try {
      return await serverClient.findSimilarByEmbedding(embedding, count);
    } catch (error) {
      console.error('[IPC] Find similar by embedding error:', error);
      return { tracks: [] };
    }
  });

  // ========================================
  // Mood Radio API (proxied to server)
  // ========================================

  ipcMain.handle('algo-mood-radio', async (_event, mood: string, count: number) => {
    if (!serverClient.isConnected()) return [];
    try {
      const result = await serverClient.getMoodRadio(mood, count);
      return result?.tracks || [];
    } catch (error) {
      console.error('[IPC] Mood radio error:', error);
      return [];
    }
  });

  // ========================================
  // ML Status API (proxied to server)
  // ========================================

  ipcMain.handle('algo-status', async () => {
    if (!serverClient.isConnected()) return { status: 'disconnected' };
    try {
      return await serverClient.getMLStatus();
    } catch (error) {
      console.error('[IPC] ML status error:', error);
      return { status: 'error' };
    }
  });

  ipcMain.handle('algo-training-history', async () => {
    if (!serverClient.isConnected()) return { history: [] };
    try {
      return await serverClient.getTrainingHistory();
    } catch (error) {
      console.error('[IPC] Training history error:', error);
      return { history: [] };
    }
  });

  ipcMain.handle('algo-record-event', async (_event, mlEvent: any) => {
    if (!serverClient.isConnected()) return { success: false };
    try {
      return await serverClient.recordMLEvent(mlEvent);
    } catch (error) {
      console.error('[IPC] Record ML event error:', error);
      return { success: false };
    }
  });

  // ========================================
  // Pinned Items API (proxied to server)
  // ========================================

  ipcMain.handle('pinned-get-all', async () => {
    if (!serverClient.isConnected()) return { items: [] };
    try {
      return await serverClient.getPinnedItems();
    } catch (error) {
      console.error('[IPC] Get pinned items error:', error);
      return { items: [] };
    }
  });

  ipcMain.handle('pinned-add', async (_event, itemType: string, itemId: string, data?: any) => {
    if (!serverClient.isConnected()) return { success: false };
    try {
      return await serverClient.pinItem(itemType, itemId, data);
    } catch (error) {
      console.error('[IPC] Pin item error:', error);
      return { success: false };
    }
  });

  ipcMain.handle('pinned-remove', async (_event, itemType: string, itemId: string) => {
    if (!serverClient.isConnected()) return { success: false };
    try {
      return await serverClient.unpinItem(itemType, itemId);
    } catch (error) {
      console.error('[IPC] Unpin item error:', error);
      return { success: false };
    }
  });

  ipcMain.handle('pinned-check', async (_event, itemType: string, itemId: string) => {
    if (!serverClient.isConnected()) return false;
    try {
      return await serverClient.isPinned(itemType, itemId);
    } catch (error) {
      console.error('[IPC] Check pinned error:', error);
      return false;
    }
  });

  ipcMain.handle('pinned-reorder', async (_event, items: Array<{ itemType: string; itemId: string }>) => {
    if (!serverClient.isConnected()) return { success: false };
    try {
      return await serverClient.reorderPinnedItems(items);
    } catch (error) {
      console.error('[IPC] Reorder pinned items error:', error);
      return { success: false };
    }
  });

  // ========================================
  // Library Views API (proxied to server)
  // ========================================

  ipcMain.handle('library-views-get-all', async () => {
    if (!serverClient.isConnected()) return { views: [] };
    try {
      return await serverClient.getLibraryViews();
    } catch (error) {
      console.error('[IPC] Get library views error:', error);
      return { views: [] };
    }
  });

  ipcMain.handle('library-views-get', async (_event, viewId: string) => {
    if (!serverClient.isConnected()) return null;
    try {
      return await serverClient.getLibraryView(viewId);
    } catch (error) {
      console.error('[IPC] Get library view error:', error);
      return null;
    }
  });

  ipcMain.handle('library-views-create', async (_event, data: any) => {
    if (!serverClient.isConnected()) return { success: false };
    try {
      return await serverClient.createLibraryView(data);
    } catch (error) {
      console.error('[IPC] Create library view error:', error);
      return { success: false };
    }
  });

  ipcMain.handle('library-views-update', async (_event, viewId: string, data: any) => {
    if (!serverClient.isConnected()) return { success: false };
    try {
      return await serverClient.updateLibraryView(viewId, data);
    } catch (error) {
      console.error('[IPC] Update library view error:', error);
      return { success: false };
    }
  });

  ipcMain.handle('library-views-delete', async (_event, viewId: string) => {
    if (!serverClient.isConnected()) return { success: false };
    try {
      return await serverClient.deleteLibraryView(viewId);
    } catch (error) {
      console.error('[IPC] Delete library view error:', error);
      return { success: false };
    }
  });

  // ========================================
  // Library Folders API (proxied to server)
  // ========================================

  ipcMain.handle('library-folders-get-all', async () => {
    if (!serverClient.isConnected()) return { folders: [] };
    try {
      return await serverClient.getLibraryFolders();
    } catch (error) {
      console.error('[IPC] Get library folders error:', error);
      return { folders: [] };
    }
  });

  ipcMain.handle('library-folders-create', async (_event, data: { name: string; parentId?: string }) => {
    if (!serverClient.isConnected()) return { success: false };
    try {
      return await serverClient.createLibraryFolder(data);
    } catch (error) {
      console.error('[IPC] Create library folder error:', error);
      return { success: false };
    }
  });

  ipcMain.handle('library-folders-update', async (_event, folderId: string, data: { name?: string }) => {
    if (!serverClient.isConnected()) return { success: false };
    try {
      return await serverClient.updateLibraryFolder(folderId, data);
    } catch (error) {
      console.error('[IPC] Update library folder error:', error);
      return { success: false };
    }
  });

  ipcMain.handle('library-folders-delete', async (_event, folderId: string) => {
    if (!serverClient.isConnected()) return { success: false };
    try {
      return await serverClient.deleteLibraryFolder(folderId);
    } catch (error) {
      console.error('[IPC] Delete library folder error:', error);
      return { success: false };
    }
  });

  ipcMain.handle('library-playlist-move', async (_event, playlistId: string, folderId: string | null) => {
    if (!serverClient.isConnected()) return { success: false };
    try {
      return await serverClient.movePlaylistToFolder(playlistId, folderId);
    } catch (error) {
      console.error('[IPC] Move playlist to folder error:', error);
      return { success: false };
    }
  });

  // ========================================
  // Smart Playlists API (proxied to server)
  // ========================================

  ipcMain.handle('smart-playlists-get-all', async () => {
    if (!serverClient.isConnected()) return { playlists: [] };
    try {
      return await serverClient.getSmartPlaylists();
    } catch (error) {
      console.error('[IPC] Get smart playlists error:', error);
      return { playlists: [] };
    }
  });

  ipcMain.handle('smart-playlists-get', async (_event, playlistId: string) => {
    if (!serverClient.isConnected()) return null;
    try {
      return await serverClient.getSmartPlaylist(playlistId);
    } catch (error) {
      console.error('[IPC] Get smart playlist error:', error);
      return null;
    }
  });

  ipcMain.handle('smart-playlists-create', async (_event, data: any) => {
    if (!serverClient.isConnected()) return { success: false };
    try {
      return await serverClient.createSmartPlaylist(data);
    } catch (error) {
      console.error('[IPC] Create smart playlist error:', error);
      return { success: false };
    }
  });

  ipcMain.handle('smart-playlists-update', async (_event, playlistId: string, data: any) => {
    if (!serverClient.isConnected()) return { success: false };
    try {
      return await serverClient.updateSmartPlaylist(playlistId, data);
    } catch (error) {
      console.error('[IPC] Update smart playlist error:', error);
      return { success: false };
    }
  });

  ipcMain.handle('smart-playlists-delete', async (_event, playlistId: string) => {
    if (!serverClient.isConnected()) return { success: false };
    try {
      return await serverClient.deleteSmartPlaylist(playlistId);
    } catch (error) {
      console.error('[IPC] Delete smart playlist error:', error);
      return { success: false };
    }
  });

  ipcMain.handle('smart-playlists-tracks', async (_event, playlistId: string) => {
    if (!serverClient.isConnected()) return { tracks: [] };
    try {
      return await serverClient.getSmartPlaylistTracks(playlistId);
    } catch (error) {
      console.error('[IPC] Get smart playlist tracks error:', error);
      return { tracks: [] };
    }
  });

  ipcMain.handle('smart-playlists-preview', async (_event, options: any) => {
    if (!serverClient.isConnected()) return { tracks: [], count: 0 };
    try {
      return await serverClient.previewSmartPlaylistRules(options);
    } catch (error) {
      console.error('[IPC] Preview smart playlist rules error:', error);
      return { tracks: [], count: 0 };
    }
  });

  ipcMain.handle('smart-playlists-rules', async () => {
    if (!serverClient.isConnected()) return { rules: [] };
    try {
      return await serverClient.getSmartPlaylistRules();
    } catch (error) {
      console.error('[IPC] Get smart playlist rules error:', error);
      return { rules: [] };
    }
  });

  // ========================================
  // Library Stats API (proxied to server)
  // ========================================

  ipcMain.handle('library-stats', async () => {
    if (!serverClient.isConnected()) return null;
    try {
      return await serverClient.getLibraryStats();
    } catch (error) {
      console.error('[IPC] Get library stats error:', error);
      return null;
    }
  });

  ipcMain.handle('library-track-stats', async (_event, trackId: string) => {
    if (!serverClient.isConnected()) return null;
    try {
      return await serverClient.getTrackStats(trackId);
    } catch (error) {
      console.error('[IPC] Get track stats error:', error);
      return null;
    }
  });

  ipcMain.handle('library-most-played', async (_event, limit: number) => {
    if (!serverClient.isConnected()) return { tracks: [] };
    try {
      return await serverClient.getMostPlayedTracks(limit);
    } catch (error) {
      console.error('[IPC] Get most played tracks error:', error);
      return { tracks: [] };
    }
  });

  // ========================================
  // Tracking Sessions API (proxied to server)
  // ========================================

  ipcMain.handle('tracking-session-start', async (_event, data?: { context?: string }) => {
    if (!serverClient.isConnected()) return { success: false };
    try {
      return await serverClient.startTrackingSession(data);
    } catch (error) {
      console.error('[IPC] Start tracking session error:', error);
      return { success: false };
    }
  });

  ipcMain.handle('tracking-session-end', async (_event, sessionId: string) => {
    if (!serverClient.isConnected()) return { success: false };
    try {
      return await serverClient.endTrackingSession(sessionId);
    } catch (error) {
      console.error('[IPC] End tracking session error:', error);
      return { success: false };
    }
  });

  ipcMain.handle('tracking-session-get', async (_event, sessionId: string) => {
    if (!serverClient.isConnected()) return null;
    try {
      return await serverClient.getTrackingSession(sessionId);
    } catch (error) {
      console.error('[IPC] Get tracking session error:', error);
      return null;
    }
  });

  ipcMain.handle('tracking-sessions-list', async (_event, limit?: number) => {
    if (!serverClient.isConnected()) return { sessions: [] };
    try {
      return await serverClient.getTrackingSessions(limit);
    } catch (error) {
      console.error('[IPC] Get tracking sessions error:', error);
      return { sessions: [] };
    }
  });

  ipcMain.handle('tracking-events-list', async (_event, options?: any) => {
    if (!serverClient.isConnected()) return { events: [] };
    try {
      return await serverClient.getTrackingEvents(options);
    } catch (error) {
      console.error('[IPC] Get tracking events error:', error);
      return { events: [] };
    }
  });

  // ========================================
  // Discover API Extended (proxied to server)
  // ========================================

  ipcMain.handle('discover-genres', async () => {
    if (!serverClient.isConnected()) return { genres: [] };
    try {
      return await serverClient.getDiscoverGenres();
    } catch (error) {
      console.error('[IPC] Get discover genres error:', error);
      return { genres: [] };
    }
  });

  ipcMain.handle('discover-genre', async (_event, genreId: string) => {
    if (!serverClient.isConnected()) return null;
    try {
      return await serverClient.getDiscoverGenre(genreId);
    } catch (error) {
      console.error('[IPC] Get discover genre error:', error);
      return null;
    }
  });

  ipcMain.handle('discover-radio', async (_event, trackId: string) => {
    if (!serverClient.isConnected()) return { tracks: [] };
    try {
      return await serverClient.getDiscoverRadio(trackId);
    } catch (error) {
      console.error('[IPC] Get discover radio error:', error);
      return { tracks: [] };
    }
  });

  ipcMain.handle('discover-sections', async () => {
    if (!serverClient.isConnected()) return { sections: [] };
    try {
      return await serverClient.getDiscoverSections();
    } catch (error) {
      console.error('[IPC] Get discover sections error:', error);
      return { sections: [] };
    }
  });

  ipcMain.handle('discover-layout', async () => {
    if (!serverClient.isConnected()) return { layout: [] };
    try {
      return await serverClient.getDiscoverLayout();
    } catch (error) {
      console.error('[IPC] Get discover layout error:', error);
      return { layout: [] };
    }
  });

  // ========================================
  // Plugin Management API (proxied to server)
  // ========================================

  ipcMain.handle('plugins-repositories-get', async () => {
    if (!serverClient.isConnected()) return { repositories: [] };
    try {
      return await serverClient.getPluginRepositories();
    } catch (error) {
      console.error('[IPC] Get plugin repositories error:', error);
      return { repositories: [] };
    }
  });

  ipcMain.handle('plugins-repositories-add', async (_event, url: string) => {
    if (!serverClient.isConnected()) return { success: false };
    try {
      return await serverClient.addPluginRepository(url);
    } catch (error) {
      console.error('[IPC] Add plugin repository error:', error);
      return { success: false };
    }
  });

  ipcMain.handle('plugins-repositories-remove', async (_event, repoId: string) => {
    if (!serverClient.isConnected()) return { success: false };
    try {
      return await serverClient.removePluginRepository(repoId);
    } catch (error) {
      console.error('[IPC] Remove plugin repository error:', error);
      return { success: false };
    }
  });

  ipcMain.handle('plugins-repositories-refresh', async (_event, repoId: string) => {
    if (!serverClient.isConnected()) return { success: false };
    try {
      return await serverClient.refreshPluginRepository(repoId);
    } catch (error) {
      console.error('[IPC] Refresh plugin repository error:', error);
      return { success: false };
    }
  });

  ipcMain.handle('plugins-available', async () => {
    if (!serverClient.isConnected()) return { plugins: [] };
    try {
      return await serverClient.getAvailablePlugins();
    } catch (error) {
      console.error('[IPC] Get available plugins error:', error);
      return { plugins: [] };
    }
  });

  ipcMain.handle('plugins-search', async (_event, query: string) => {
    if (!serverClient.isConnected()) return { plugins: [] };
    try {
      return await serverClient.searchPlugins(query);
    } catch (error) {
      console.error('[IPC] Search plugins error:', error);
      return { plugins: [] };
    }
  });

  ipcMain.handle('plugins-install', async (_event, source: string, type?: 'npm' | 'git' | 'local') => {
    if (!serverClient.isConnected()) return { success: false };
    try {
      return await serverClient.installPlugin(source, type);
    } catch (error) {
      console.error('[IPC] Install plugin error:', error);
      return { success: false };
    }
  });

  ipcMain.handle('plugins-uninstall', async (_event, pluginId: string) => {
    if (!serverClient.isConnected()) return { success: false };
    try {
      return await serverClient.uninstallPlugin(pluginId);
    } catch (error) {
      console.error('[IPC] Uninstall plugin error:', error);
      return { success: false };
    }
  });

  ipcMain.handle('plugins-updates', async () => {
    if (!serverClient.isConnected()) return { updates: [] };
    try {
      return await serverClient.getPluginUpdates();
    } catch (error) {
      console.error('[IPC] Get plugin updates error:', error);
      return { updates: [] };
    }
  });

  ipcMain.handle('plugins-routes', async () => {
    if (!serverClient.isConnected()) return { routes: [] };
    try {
      return await serverClient.getPluginRoutes();
    } catch (error) {
      console.error('[IPC] Get plugin routes error:', error);
      return { routes: [] };
    }
  });

  ipcMain.handle('addon-set-enabled', async (_event, addonId: string, enabled: boolean) => {
    if (!serverClient.isConnected()) return { success: false };
    try {
      return await serverClient.setAddonEnabled(addonId, enabled);
    } catch (error) {
      console.error('[IPC] Set addon enabled error:', error);
      return { success: false };
    }
  });

  // ========================================
  // Settings API (proxied to server)
  // ========================================

  ipcMain.handle('settings-server-get', async () => {
    if (!serverClient.isConnected()) return {};
    try {
      return await serverClient.getServerSettings();
    } catch (error) {
      console.error('[IPC] Get server settings error:', error);
      return {};
    }
  });

  ipcMain.handle('settings-server-update', async (_event, settings: any) => {
    if (!serverClient.isConnected()) return { success: false };
    try {
      return await serverClient.updateServerSettings(settings);
    } catch (error) {
      console.error('[IPC] Update server settings error:', error);
      return { success: false };
    }
  });

  // ========================================
  // Logs API (proxied to server)
  // ========================================

  ipcMain.handle('logs-get', async (_event, options?: any) => {
    if (!serverClient.isConnected()) return { logs: [] };
    try {
      return await serverClient.getLogs(options);
    } catch (error) {
      console.error('[IPC] Get logs error:', error);
      return { logs: [] };
    }
  });

  ipcMain.handle('logs-clear', async () => {
    if (!serverClient.isConnected()) return { success: false };
    try {
      return await serverClient.clearLogs();
    } catch (error) {
      console.error('[IPC] Clear logs error:', error);
      return { success: false };
    }
  });

  // ========================================
  // Stats Extended API (proxied to server)
  // ========================================

  ipcMain.handle('stats-top-albums', async (_event, limit?: number) => {
    if (!serverClient.isConnected()) return { albums: [] };
    try {
      return await serverClient.getTopAlbums(limit);
    } catch (error) {
      console.error('[IPC] Get top albums error:', error);
      return { albums: [] };
    }
  });

  ipcMain.handle('stats-refresh', async () => {
    if (!serverClient.isConnected()) return { success: false };
    try {
      return await serverClient.refreshStats();
    } catch (error) {
      console.error('[IPC] Refresh stats error:', error);
      return { success: false };
    }
  });

  // ========================================
  // Library Capabilities API (proxied to server)
  // ========================================

  ipcMain.handle('library-capabilities', async () => {
    if (!serverClient.isConnected()) return {};
    try {
      return await serverClient.getLibraryCapabilities();
    } catch (error) {
      console.error('[IPC] Get library capabilities error:', error);
      return {};
    }
  });

  ipcMain.handle('library-import-providers', async () => {
    if (!serverClient.isConnected()) return { providers: [] };
    try {
      return await serverClient.getImportProviders();
    } catch (error) {
      console.error('[IPC] Get import providers error:', error);
      return { providers: [] };
    }
  });

  ipcMain.handle('library-export-formats', async () => {
    if (!serverClient.isConnected()) return { formats: [] };
    try {
      return await serverClient.getExportFormats();
    } catch (error) {
      console.error('[IPC] Get export formats error:', error);
      return { formats: [] };
    }
  });

  // ========================================
  // Skip Recording API (proxied to server)
  // ========================================

  ipcMain.handle('record-skip', async (_event, track: any, position: number, duration: number) => {
    if (!serverClient.isConnected()) return { success: false };
    try {
      return await serverClient.recordSkip(track, position, duration);
    } catch (error) {
      console.error('[IPC] Record skip error:', error);
      return { success: false };
    }
  });

  // ========================================
  // Media Watcher API (proxied to server)
  // ========================================

  ipcMain.handle('media-watcher-status', async () => {
    if (!serverClient.isConnected()) return { status: 'disconnected' };
    try {
      return await serverClient.getMediaWatcherStatus();
    } catch (error) {
      console.error('[IPC] Get media watcher status error:', error);
      return { status: 'error' };
    }
  });

  // ========================================
  // Auth/Device API (proxied to server)
  // ========================================

  ipcMain.handle('auth-identity', async () => {
    if (!serverClient.isConnected()) return null;
    try {
      return await serverClient.getAuthIdentity();
    } catch (error) {
      console.error('[IPC] Get auth identity error:', error);
      return null;
    }
  });

  ipcMain.handle('auth-devices', async () => {
    if (!serverClient.isConnected()) return { devices: [] };
    try {
      return await serverClient.getDevices();
    } catch (error) {
      console.error('[IPC] Get devices error:', error);
      return { devices: [] };
    }
  });

  ipcMain.handle('auth-device-remove', async (_event, deviceId: string) => {
    if (!serverClient.isConnected()) return { success: false };
    try {
      return await serverClient.removeDevice(deviceId);
    } catch (error) {
      console.error('[IPC] Remove device error:', error);
      return { success: false };
    }
  });

  ipcMain.handle('auth-device-update', async (_event, deviceId: string, data: { name?: string; trusted?: boolean }) => {
    if (!serverClient.isConnected()) return { success: false };
    try {
      return await serverClient.updateDevice(deviceId, data);
    } catch (error) {
      console.error('[IPC] Update device error:', error);
      return { success: false };
    }
  });

  // ========================================
  // Setup API (proxied to server)
  // ========================================

  ipcMain.handle('setup-status', async () => {
    if (!serverClient.isConnected()) return { setupComplete: false };
    try {
      return await serverClient.getSetupStatus();
    } catch (error) {
      console.error('[IPC] Get setup status error:', error);
      return { setupComplete: false };
    }
  });

  ipcMain.handle('setup-complete', async () => {
    if (!serverClient.isConnected()) return { success: false };
    try {
      return await serverClient.completeSetup();
    } catch (error) {
      console.error('[IPC] Complete setup error:', error);
      return { success: false };
    }
  });

  // ========================================
  // Debug API (proxied to server)
  // ========================================

  ipcMain.handle('debug-persistence', async () => {
    if (!serverClient.isConnected()) return null;
    try {
      return await serverClient.getDebugPersistence();
    } catch (error) {
      console.error('[IPC] Get debug persistence error:', error);
      return null;
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
