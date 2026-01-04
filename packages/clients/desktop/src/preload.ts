/**
 * Audiio Client - Preload Script
 *
 * Exposes safe IPC methods to the renderer process.
 * Matches the desktop API structure so the same UI can be used.
 */

import { contextBridge, ipcRenderer } from 'electron';

// Type-safe API exposed to renderer - matches desktop structure
const api = {
  // Search
  search: (query: { query: string; type?: string }) => {
    return ipcRenderer.invoke('search', query);
  },

  // Playback
  playTrack: (track: unknown) => {
    return ipcRenderer.invoke('play-track', track);
  },

  pause: () => {
    return ipcRenderer.invoke('pause');
  },

  resume: () => {
    return ipcRenderer.invoke('resume');
  },

  seek: (position: number) => {
    return ipcRenderer.invoke('seek', position);
  },

  getPlaybackState: () => {
    return ipcRenderer.invoke('get-playback-state');
  },

  onPlaybackEvent: (callback: (event: unknown) => void) => {
    const listener = (_: unknown, event: unknown) => callback(event);
    ipcRenderer.on('playback-event', listener);
    return () => {
      ipcRenderer.removeListener('playback-event', listener);
    };
  },

  // ========================================
  // Window Control APIs (for frameless title bar)
  // ========================================

  windowMinimize: () => {
    return ipcRenderer.invoke('window-minimize');
  },

  windowMaximize: () => {
    return ipcRenderer.invoke('window-maximize');
  },

  windowClose: () => {
    return ipcRenderer.invoke('window-close');
  },

  windowIsMaximized: () => {
    return ipcRenderer.invoke('window-is-maximized');
  },

  onWindowMaximizedChange: (callback: (isMaximized: boolean) => void) => {
    const listener = (_: unknown, isMaximized: boolean) => callback(isMaximized);
    ipcRenderer.on('window-maximized-change', listener);
    return () => {
      ipcRenderer.removeListener('window-maximized-change', listener);
    };
  },

  getPlatform: () => {
    return ipcRenderer.invoke('get-platform');
  },

  // Plugin management
  getAddons: () => {
    return ipcRenderer.invoke('get-addons');
  },

  setAddonEnabled: (addonId: string, enabled: boolean) => {
    return ipcRenderer.invoke('set-addon-enabled', { addonId, enabled });
  },

  updateAddonSettings: (addonId: string, settings: Record<string, unknown>) => {
    return ipcRenderer.invoke('update-addon-settings', { addonId, settings });
  },

  getAddonSettings: (addonId: string) => {
    return ipcRenderer.invoke('get-addon-settings', addonId);
  },

  setAddonPriority: (addonId: string, priority: number) => {
    return ipcRenderer.invoke('set-addon-priority', { addonId, priority });
  },

  setAddonOrder: (orderedIds: string[]) => {
    return ipcRenderer.invoke('set-addon-order', orderedIds);
  },

  getAddonPriorities: () => {
    return ipcRenderer.invoke('get-addon-priorities');
  },

  getLoadedPlugins: () => {
    return ipcRenderer.invoke('get-loaded-plugins');
  },

  reloadPlugins: () => {
    return ipcRenderer.invoke('reload-plugins');
  },

  isPluginLoaded: (pluginId: string) => {
    return ipcRenderer.invoke('is-plugin-loaded', pluginId);
  },

  getAnimatedArtwork: (album: string, artist: string, track?: string) => {
    return ipcRenderer.invoke('get-animated-artwork', { album, artist, track });
  },

  // Artist and Album details
  getArtist: (id: string, source?: string) => {
    return ipcRenderer.invoke('get-artist', { id, source });
  },

  getAlbum: (id: string, source?: string) => {
    return ipcRenderer.invoke('get-album', { id, source });
  },

  // Discovery & Trending
  getTrending: () => {
    return ipcRenderer.invoke('get-trending');
  },

  getSimilarAlbums: (albumId: string, source?: string) => {
    return ipcRenderer.invoke('get-similar-albums', { albumId, source });
  },

  getSimilarTracks: (trackId: string, source?: string) => {
    return ipcRenderer.invoke('get-similar-tracks', { trackId, source });
  },

  prefetchTracks: (tracks: unknown[]) => {
    return ipcRenderer.invoke('prefetch-tracks', tracks);
  },

  getArtistLatestRelease: (artistId: string, source?: string) => {
    return ipcRenderer.invoke('get-artist-latest-release', { artistId, source });
  },

  // Lyrics API
  lyrics: {
    search: (artist: string, track: string, album?: string, duration?: number) => {
      return ipcRenderer.invoke('get-lyrics', { title: track, artist, album, duration });
    }
  },

  getRecommendedTracks: (basedOn: 'artist' | 'genre', id: string) => {
    return ipcRenderer.invoke('get-recommended-tracks', { basedOn, id });
  },

  // Audio Analysis APIs (stub - not available in client mode)
  getAudioFeatures: (_trackId: string, _streamUrl?: string, _track?: unknown) => {
    return Promise.resolve(null);
  },

  analyzeAudioFile: (_filePath: string, _options?: unknown) => {
    return Promise.resolve(null);
  },

  analyzeAudioUrl: (_url: string, _options?: unknown) => {
    return Promise.resolve(null);
  },

  setAudioFeatures: (_trackId: string, _features: unknown) => {
    return Promise.resolve({ success: false });
  },

  getCachedAudioFeatures: (_trackIds: string[]) => {
    return Promise.resolve({});
  },

  clearAudioFeaturesCache: () => {
    return Promise.resolve({ success: true });
  },

  checkAudioAnalyzer: () => {
    return Promise.resolve({ available: false });
  },

  // Download (stub - client doesn't download)
  downloadTrack: (_track: unknown) => {
    return Promise.resolve({ success: false, error: 'Downloads not available in client mode' });
  },

  onDownloadProgress: (_callback: (progress: any) => void) => {
    return () => {}; // No-op unsubscribe
  },

  // Mobile Access APIs (stub - not applicable for client)
  getMobileStatus: () => {
    return Promise.resolve({ isEnabled: false });
  },

  enableMobileAccess: (_options?: any) => {
    return Promise.resolve({ success: false });
  },

  disableMobileAccess: () => {
    return Promise.resolve({ success: true });
  },

  refreshMobilePairingCode: () => {
    return Promise.resolve(null);
  },

  setMobileRemoteAccess: (_enable: boolean) => {
    return Promise.resolve({ success: false });
  },

  regenerateMobileToken: () => {
    return Promise.resolve(null);
  },

  disconnectMobileSession: (_sessionId: string) => {
    return Promise.resolve({ success: false });
  },

  onMobileStatusChange: (_callback: any) => {
    return () => {};
  },

  onMobileDeviceApprovalRequest: (_callback: any) => {
    return () => {};
  },

  approveMobileDevice: (_requestId: string) => {
    return Promise.resolve({ success: false });
  },

  denyMobileDevice: (_requestId: string) => {
    return Promise.resolve({ success: false });
  },

  getPendingMobileApprovals: () => {
    return Promise.resolve([]);
  },

  getMobilePassphrase: () => {
    return Promise.resolve(null);
  },

  regenerateMobilePassphrase: () => {
    return Promise.resolve(null);
  },

  setMobileCustomPassword: (_password: string) => {
    return Promise.resolve({ success: false });
  },

  removeMobileCustomPassword: () => {
    return Promise.resolve({ success: false });
  },

  getMobileDevices: () => {
    return Promise.resolve([]);
  },

  revokeMobileDevice: (_deviceId: string) => {
    return Promise.resolve({ success: false });
  },

  revokeAllMobileDevices: () => {
    return Promise.resolve({ success: false });
  },

  getMobileAuthSettings: () => {
    return Promise.resolve({});
  },

  updateMobileAuthSettings: (_settings: any) => {
    return Promise.resolve({ success: false });
  },

  renameMobileDevice: (_deviceId: string, _name: string) => {
    return Promise.resolve({ success: false });
  },

  // Room Security APIs (stub)
  setRoomPassword: (_password: string) => {
    return Promise.resolve({ success: false });
  },

  removeRoomPassword: () => {
    return Promise.resolve({ success: false });
  },

  getRoomSecurityInfo: () => {
    return Promise.resolve(null);
  },

  regenerateRoomId: () => {
    return Promise.resolve(null);
  },

  // Relay Management APIs (stub)
  getRelayStatus: () => {
    return Promise.resolve({ connected: false });
  },

  getRelayCode: () => {
    return Promise.resolve(null);
  },

  getRelayPeers: () => {
    return Promise.resolve([]);
  },

  approveRelayPeer: (_peerId: string) => {
    return Promise.resolve({ success: false });
  },

  denyRelayPeer: (_peerId: string) => {
    return Promise.resolve({ success: false });
  },

  onRelayPeerJoined: (_callback: any) => {
    return () => {};
  },

  onRelayPeerLeft: (_callback: any) => {
    return () => {};
  },

  // Library Bridge APIs (stub)
  signalLibraryBridgeReady: () => {
    ipcRenderer.send('library-bridge-ready');
  },

  onLibraryDataRequest: (_callback: () => void) => {
    return () => {};
  },

  sendLibraryData: (_data: any) => {
    // No-op
  },

  notifyLibraryChange: (_type: string, _data: unknown) => {
    // No-op
  },

  onLibraryAction: (_action: string, _callback: (payload: unknown) => void) => {
    return () => {};
  },

  // Translation API
  translateText: (text: string, source: string, target: string) => {
    return ipcRenderer.invoke('translate-text', { text, source, target });
  },

  // Folder selection (stub)
  selectFolder: (_options?: any) => {
    return Promise.resolve(null);
  },

  // Local music (stub - not available in client mode)
  scanMusicFolder: (_folderPath: string) => {
    return Promise.resolve({ tracks: [] });
  },

  getLocalTracks: () => {
    return Promise.resolve([]);
  },

  getEmbeddedArtwork: (_trackId: string) => {
    return Promise.resolve(null);
  },

  enrichLocalTracks: (_tracks: any[]) => {
    return Promise.resolve([]);
  },

  writeTrackMetadata: (_params: any) => {
    return Promise.resolve({ success: false });
  },

  onScanProgress: (_callback: any) => {
    return () => {};
  },

  onEnrichProgress: (_callback: any) => {
    return () => {};
  },

  // Settings sync
  updateSettings: (key: string, value: unknown) => {
    return ipcRenderer.invoke('update-settings', { key, value });
  },

  // Get app paths
  getAppPaths: () => {
    return ipcRenderer.invoke('get-app-paths');
  },

  // Plugin Management APIs (limited in client mode)
  setPluginFolder: (_folderPath: string | null) => {
    return Promise.resolve({ success: false, error: 'Plugin management not available in client mode' });
  },

  getPluginFolderStatus: () => {
    return Promise.resolve({ hasCustomFolder: false, path: null });
  },

  installPlugin: (_filePath: string) => {
    return Promise.resolve({ success: false, error: 'Plugin installation not available in client mode' });
  },

  getInstalledPlugins: () => {
    return ipcRenderer.invoke('get-loaded-plugins');
  },

  uninstallPlugin: (_pluginId: string) => {
    return Promise.resolve({ success: false });
  },

  onPluginDetected: (_callback: any) => {
    return () => {};
  },

  // ========================================
  // Tracking API (proxied to server)
  // ========================================

  trackEvent: (event: { type: string; trackId?: string; trackData?: unknown; position?: number; duration?: number }) => {
    return ipcRenderer.invoke('track-event', event);
  },

  trackBatch: (events: unknown[]) => {
    return ipcRenderer.invoke('track-batch', events);
  },

  // ========================================
  // Stats API (proxied to server)
  // ========================================

  getStatsOverview: () => {
    return ipcRenderer.invoke('stats-overview');
  },

  getTopArtists: (limit?: number) => {
    return ipcRenderer.invoke('stats-top-artists', limit);
  },

  getTopTracks: (limit?: number) => {
    return ipcRenderer.invoke('stats-top-tracks', limit);
  },

  getListeningPatterns: () => {
    return ipcRenderer.invoke('stats-patterns');
  },

  getStreaks: () => {
    return ipcRenderer.invoke('stats-streaks');
  },

  getStats: (period: string) => {
    return ipcRenderer.invoke('stats-period', period);
  },

  clearStats: () => {
    return ipcRenderer.invoke('stats-clear');
  },

  // ========================================
  // Dislike APIs (proxied to server)
  // ========================================

  dislikeTrack: (track: unknown, reasons: string[]) => {
    return ipcRenderer.invoke('dislike-track', track, reasons);
  },

  getDislikedTracks: () => {
    return ipcRenderer.invoke('dislike-list');
  },

  removeDislike: (trackId: string) => {
    return ipcRenderer.invoke('dislike-remove', trackId);
  },

  // ========================================
  // ML Algorithm APIs (proxied to server)
  // ========================================

  algoScoreTrack: (trackId: string) => {
    return ipcRenderer.invoke('algo-score-track', trackId);
  },

  algoScoreBatch: (trackIds: string[]) => {
    return ipcRenderer.invoke('algo-score-batch', trackIds);
  },

  algoGetRecommendations: (count: number, mode?: string) => {
    return ipcRenderer.invoke('algo-recommendations', count, mode);
  },

  algoGetSimilar: (trackId: string, count: number) => {
    return ipcRenderer.invoke('algo-similar', trackId, count);
  },

  algoGetRadio: (seedTrackId: string, count: number) => {
    return ipcRenderer.invoke('algo-radio', seedTrackId, count);
  },

  algoGetArtistRadio: (artistId: string, count: number) => {
    return ipcRenderer.invoke('algo-artist-radio', artistId, count);
  },

  algoGetGenreRadio: (genre: string, count: number) => {
    return ipcRenderer.invoke('algo-genre-radio', genre, count);
  },

  algoGetFeatures: (trackId: string) => {
    return ipcRenderer.invoke('algo-features', trackId);
  },

  algoTrain: () => {
    return ipcRenderer.invoke('algo-train');
  },

  algoGetTrainingStatus: () => {
    return ipcRenderer.invoke('algo-training-status');
  },

  // Backward compatibility alias
  algoTrainingStatus: () => {
    return ipcRenderer.invoke('algo-training-status');
  },

  algoRecordEvent: (event: unknown) => {
    // Use the new tracking API
    return ipcRenderer.invoke('track-event', event);
  },

  algoGetProfile: () => {
    return ipcRenderer.invoke('algo-profile');
  },

  algoGetPreferences: () => {
    return ipcRenderer.invoke('algo-preferences');
  },

  algoUpdatePreferences: (preferences: Record<string, unknown>) => {
    return ipcRenderer.invoke('algo-update-preferences', preferences);
  },

  algoGetNextQueue: (count: number, context?: Record<string, unknown>) => {
    return ipcRenderer.invoke('algo-next-queue', count, context);
  },

  isAddonLoaded: (_addonId: string) => {
    return Promise.resolve(false);
  },

  algoUpdateSettings: (_settings: Record<string, unknown>) => {
    return Promise.resolve({ success: false });
  },

  algoGetSettings: () => {
    return Promise.resolve({});
  },

  // ========================================
  // Karaoke APIs (stub - not available in client mode)
  // ========================================

  karaoke: {
    isAvailable: () => {
      return Promise.resolve(false);
    },

    processTrack: (_trackId: string, _audioUrl: string) => {
      return Promise.resolve({ success: false, error: 'Karaoke not available in client mode' });
    },

    hasCached: (_trackId: string) => {
      return Promise.resolve(false);
    },

    getCached: (_trackId: string) => {
      return Promise.resolve(null);
    },

    clearCache: (_trackId: string) => {
      return Promise.resolve({ success: true });
    },

    clearAllCache: () => {
      return Promise.resolve({ success: true });
    },

    onAvailabilityChange: (_callback: any) => {
      return () => {};
    },

    onFullTrackReady: (_callback: any) => {
      return () => {};
    },

    onProgress: (_callback: any) => {
      return () => {};
    },

    onFirstChunkReady: (_callback: any) => {
      return () => {};
    },

    onChunkUpdated: (_callback: any) => {
      return () => {};
    },

    predictivePrefetch: (_tracks: any[]) => {
      return Promise.resolve({ success: false });
    },

    getCapabilities: () => {
      return Promise.resolve({ available: false });
    },
  },

  // ========================================
  // Components APIs (stub)
  // ========================================

  components: {
    getDemucsStatus: () => {
      return Promise.resolve({ installed: false, enabled: false });
    },

    installDemucs: () => {
      return Promise.resolve({ success: false });
    },

    cancelDemucsInstall: () => {
      return Promise.resolve({ success: false });
    },

    uninstallDemucs: () => {
      return Promise.resolve({ success: false });
    },

    setDemucsEnabled: (_enabled: boolean) => {
      return Promise.resolve({ success: false });
    },

    startDemucsServer: () => {
      return Promise.resolve({ success: false });
    },

    stopDemucsServer: () => {
      return Promise.resolve({ success: false });
    },

    onInstallProgress: (_callback: any) => {
      return () => {};
    },
  },

  // ========================================
  // Sposify APIs (stub)
  // ========================================

  sposify: {
    init: () => Promise.resolve({ success: false }),
    rebuildDatabase: () => Promise.resolve({ success: false }),
    getStatus: () => Promise.resolve({ initialized: false }),
    close: () => Promise.resolve({ success: true }),
    selectExportFiles: () => Promise.resolve(null),
    selectExportFolder: () => Promise.resolve(null),
    parseExport: (_filePaths: string[]) => Promise.resolve(null),
    parseExportFolder: (_folderPath: string) => Promise.resolve(null),
    matchTracks: (_tracks: any[]) => Promise.resolve([]),
    importToLibrary: (_data: unknown) => Promise.resolve({ success: false }),
    getAudioFeatures: (_spotifyId: string) => Promise.resolve(null),
    getAudioFeaturesBatch: (_spotifyIds: string[]) => Promise.resolve({}),
    getFeaturesByIsrc: (_isrc: string) => Promise.resolve(null),
    getFeaturesByMetadata: (_title: string, _artist: string) => Promise.resolve(null),
    findSimilarByFeatures: (_features: unknown, _limit?: number) => Promise.resolve([]),
    matchByMetadata: (_tracks: any[]) => Promise.resolve([]),
    enrichTrack: (_localTrackId: string, _spotifyId: string) => Promise.resolve({ success: false }),
    searchPlaylists: (_query: string, _options?: any) => Promise.resolve({ playlists: [] }),
    browsePlaylists: (_options?: any) => Promise.resolve({ playlists: [] }),
    getPlaylist: (_playlistId: string) => Promise.resolve(null),
    getTopPlaylists: (_limit?: number) => Promise.resolve([]),
    getPlaylistsForTrack: (_spotifyId: string, _limit?: number) => Promise.resolve([]),
    getTrack: (_spotifyId: string) => Promise.resolve(null),
    getTrackByIsrc: (_isrc: string) => Promise.resolve(null),
    searchTracks: (_title: string, _artist: string, _limit?: number) => Promise.resolve([]),
    setConfig: (_config: any) => Promise.resolve({ success: false }),
    clearCache: () => Promise.resolve({ success: true }),
    onImportProgress: (_callback: any) => { return () => {}; },
    onSetupProgress: (_callback: any) => { return () => {}; },
  },

  // ========================================
  // Plugin Repository APIs (limited in client mode)
  // ========================================

  repositories: {
    list: () => {
      return Promise.resolve([]);
    },

    add: (_url: string) => {
      return Promise.resolve({ success: false, error: 'Repository management not available in client mode' });
    },

    remove: (_repoId: string) => {
      return Promise.resolve({ success: false });
    },

    setEnabled: (_repoId: string, _enabled: boolean) => {
      return Promise.resolve({ success: false });
    },

    refresh: (_repoId: string) => {
      return Promise.resolve({ success: false });
    },

    refreshAll: () => {
      return Promise.resolve({ success: false });
    },

    getAvailablePlugins: () => {
      return Promise.resolve([]);
    },

    searchPlugins: (_query: string) => {
      return Promise.resolve([]);
    },

    checkUpdates: () => {
      return Promise.resolve([]);
    },

    installFromSource: (_source: string) => {
      return Promise.resolve({ success: false, error: 'Plugin installation not available in client mode' });
    },

    uninstallPlugin: (_pluginId: string) => {
      return Promise.resolve({ success: false });
    },

    updatePlugin: (_pluginId: string, _source: string) => {
      return Promise.resolve({ success: false });
    },

    onInstallProgress: (_callback: any) => {
      return () => {};
    },

    onPluginsChanged: (_callback: () => void) => {
      return () => {};
    },
  },

  // ========================================
  // Artist Enrichment APIs (proxy to server)
  // ========================================

  enrichment: {
    getAvailableTypes: () => {
      return ipcRenderer.invoke('get-available-enrichment-types');
    },

    getVideos: (artistName: string, limit?: number) => {
      return ipcRenderer.invoke('get-artist-videos', { artistName, limit });
    },

    getAlbumVideos: (albumTitle: string, artistName: string, trackNames?: string[], limit?: number) => {
      return ipcRenderer.invoke('get-album-videos', { albumTitle, artistName, trackNames, limit });
    },

    getVideoStream: (videoId: string, source: string, preferredQuality?: string) => {
      return ipcRenderer.invoke('get-video-stream', { videoId, source, preferredQuality });
    },

    getTimeline: (artistName: string) => {
      return ipcRenderer.invoke('get-artist-timeline', { artistName });
    },

    getSetlists: (artistName: string, mbid?: string, limit?: number) => {
      return ipcRenderer.invoke('get-artist-setlists', { artistName, mbid, limit });
    },

    getConcerts: (artistName: string) => {
      return ipcRenderer.invoke('get-artist-concerts', { artistName });
    },

    getGallery: (mbid?: string, artistName?: string) => {
      return ipcRenderer.invoke('get-artist-gallery', { mbid, artistName });
    },

    getMerchandise: (artistName: string) => {
      return ipcRenderer.invoke('get-artist-merchandise', { artistName });
    },
  },

  // ========================================
  // Client-specific: Server Connection
  // ========================================

  connection: {
    getState: () => ipcRenderer.invoke('get-connection-state'),
    connect: (serverUrl: string, token?: string) =>
      ipcRenderer.invoke('connect-to-server', serverUrl, token),
    disconnect: () => ipcRenderer.invoke('disconnect-from-server'),
    getSavedServer: () => ipcRenderer.invoke('get-saved-server'),
    onStateChange: (callback: (state: any) => void) => {
      const handler = (_event: any, state: any) => callback(state);
      ipcRenderer.on('connection-state-changed', handler);
      return () => ipcRenderer.removeListener('connection-state-changed', handler);
    }
  },

  // ========================================
  // Server Discovery (mDNS)
  // ========================================

  discovery: {
    getServers: () => ipcRenderer.invoke('discovery-get-servers'),
    startBrowsing: () => ipcRenderer.invoke('discovery-start'),
    stopBrowsing: () => ipcRenderer.invoke('discovery-stop'),
    onServerFound: (callback: (server: any) => void) => {
      const handler = (_event: any, server: any) => callback(server);
      ipcRenderer.on('discovery-server-found', handler);
      return () => ipcRenderer.removeListener('discovery-server-found', handler);
    },
    onServerLost: (callback: (serverId: string) => void) => {
      const handler = (_event: any, serverId: string) => callback(serverId);
      ipcRenderer.on('discovery-server-lost', handler);
      return () => ipcRenderer.removeListener('discovery-server-lost', handler);
    }
  },
};

// Expose the API to the renderer process
contextBridge.exposeInMainWorld('api', api);
