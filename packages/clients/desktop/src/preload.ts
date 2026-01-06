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

  // Scrobble API (proxied to server plugins)
  scrobble: {
    submit: (pluginId: string, data: {
      title: string;
      artist: string;
      album?: string;
      duration: number;
      timestamp: number;
      playedMs: number;
    }) => {
      return ipcRenderer.invoke('scrobble-submit', { pluginId, data });
    },
    updateNowPlaying: (pluginId: string, data: {
      title: string;
      artist: string;
      album?: string;
      duration: number;
    }) => {
      return ipcRenderer.invoke('scrobble-now-playing', { pluginId, data });
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
    return () => { }; // No-op unsubscribe
  },

  // ========================================
  // DEPRECATED: Mobile Access APIs
  // These are stubs - mobile access is not available in client mode
  // ========================================

  /** @deprecated Mobile access not available in client mode */
  getMobileStatus: () => Promise.resolve({ isEnabled: false }),
  /** @deprecated Mobile access not available in client mode */
  enableMobileAccess: (_options?: unknown) => Promise.resolve({ success: false }),
  /** @deprecated Mobile access not available in client mode */
  disableMobileAccess: () => Promise.resolve({ success: true }),
  /** @deprecated Mobile access not available in client mode */
  refreshMobilePairingCode: () => Promise.resolve(null),
  /** @deprecated Mobile access not available in client mode */
  setMobileRemoteAccess: (_enable: boolean) => Promise.resolve({ success: false }),
  /** @deprecated Mobile access not available in client mode */
  regenerateMobileToken: () => Promise.resolve(null),
  /** @deprecated Mobile access not available in client mode */
  disconnectMobileSession: (_sessionId: string) => Promise.resolve({ success: false }),
  /** @deprecated Mobile access not available in client mode */
  onMobileStatusChange: (_callback: unknown) => () => {},
  /** @deprecated Mobile access not available in client mode */
  onMobileDeviceApprovalRequest: (_callback: unknown) => () => {},
  /** @deprecated Mobile access not available in client mode */
  approveMobileDevice: (_requestId: string) => Promise.resolve({ success: false }),
  /** @deprecated Mobile access not available in client mode */
  denyMobileDevice: (_requestId: string) => Promise.resolve({ success: false }),
  /** @deprecated Mobile access not available in client mode */
  getPendingMobileApprovals: () => Promise.resolve([]),
  /** @deprecated Mobile access not available in client mode */
  getMobilePassphrase: () => Promise.resolve(null),
  /** @deprecated Mobile access not available in client mode */
  regenerateMobilePassphrase: () => Promise.resolve(null),
  /** @deprecated Mobile access not available in client mode */
  setMobileCustomPassword: (_password: string) => Promise.resolve({ success: false }),
  /** @deprecated Mobile access not available in client mode */
  removeMobileCustomPassword: () => Promise.resolve({ success: false }),
  /** @deprecated Mobile access not available in client mode */
  getMobileDevices: () => Promise.resolve([]),
  /** @deprecated Mobile access not available in client mode */
  revokeMobileDevice: (_deviceId: string) => Promise.resolve({ success: false }),
  /** @deprecated Mobile access not available in client mode */
  revokeAllMobileDevices: () => Promise.resolve({ success: false }),
  /** @deprecated Mobile access not available in client mode */
  getMobileAuthSettings: () => Promise.resolve({}),
  /** @deprecated Mobile access not available in client mode */
  updateMobileAuthSettings: (_settings: unknown) => Promise.resolve({ success: false }),
  /** @deprecated Mobile access not available in client mode */
  renameMobileDevice: (_deviceId: string, _name: string) => Promise.resolve({ success: false }),

  // ========================================
  // DEPRECATED: Room Security APIs
  // These are stubs - room security is not available in client mode
  // ========================================

  /** @deprecated Room security not available in client mode */
  setRoomPassword: (_password: string) => Promise.resolve({ success: false }),
  /** @deprecated Room security not available in client mode */
  removeRoomPassword: () => Promise.resolve({ success: false }),
  /** @deprecated Room security not available in client mode */
  getRoomSecurityInfo: () => Promise.resolve(null),
  /** @deprecated Room security not available in client mode */
  regenerateRoomId: () => Promise.resolve(null),

  // ========================================
  // DEPRECATED: Relay Management APIs
  // These are stubs - relay is not available in client mode
  // ========================================

  /** @deprecated Relay not available in client mode */
  getRelayStatus: () => Promise.resolve({ connected: false }),
  /** @deprecated Relay not available in client mode */
  getRelayCode: () => Promise.resolve(null),
  /** @deprecated Relay not available in client mode */
  getRelayPeers: () => Promise.resolve([]),
  /** @deprecated Relay not available in client mode */
  approveRelayPeer: (_peerId: string) => Promise.resolve({ success: false }),
  /** @deprecated Relay not available in client mode */
  denyRelayPeer: (_peerId: string) => Promise.resolve({ success: false }),
  /** @deprecated Relay not available in client mode */
  onRelayPeerJoined: (_callback: unknown) => () => {},
  /** @deprecated Relay not available in client mode */
  onRelayPeerLeft: (_callback: unknown) => () => {},

  // ========================================
  // DEPRECATED: Library Bridge APIs
  // These are stubs - library bridge is for server mode only
  // ========================================

  /** @deprecated Library bridge not available in client mode */
  signalLibraryBridgeReady: () => { ipcRenderer.send('library-bridge-ready'); },
  /** @deprecated Library bridge not available in client mode */
  onLibraryDataRequest: (_callback: () => void) => () => {},
  /** @deprecated Library bridge not available in client mode */
  sendLibraryData: (_data: unknown) => {},
  /** @deprecated Library bridge not available in client mode */
  notifyLibraryChange: (_type: string, _data: unknown) => {},
  /** @deprecated Library bridge not available in client mode */
  onLibraryAction: (_action: string, _callback: (payload: unknown) => void) => () => {},

  // Translation API
  translateText: (text: string, source: string, target: string) => {
    return ipcRenderer.invoke('translate-text', { text, source, target });
  },

  // ========================================
  // Media Folders API (proxied to server)
  // ========================================

  // Get all media folders
  getMediaFolders: (type?: 'audio' | 'video' | 'downloads') => {
    return ipcRenderer.invoke('media-get-folders', type);
  },

  // Get a specific folder
  getMediaFolder: (folderId: string) => {
    return ipcRenderer.invoke('media-get-folder', folderId);
  },

  // Add a new media folder
  addMediaFolder: (path: string, type: 'audio' | 'video' | 'downloads', options?: {
    name?: string;
    watchEnabled?: boolean;
    scanInterval?: number | null;
  }) => {
    return ipcRenderer.invoke('media-add-folder', path, type, options);
  },

  // Update folder settings
  updateMediaFolder: (folderId: string, updates: {
    name?: string;
    watchEnabled?: boolean;
    scanInterval?: number | null;
  }) => {
    return ipcRenderer.invoke('media-update-folder', folderId, updates);
  },

  // Remove a media folder
  removeMediaFolder: (folderId: string) => {
    return ipcRenderer.invoke('media-remove-folder', folderId);
  },

  // Browse filesystem on server for folder picker
  browseFilesystem: (path?: string) => {
    return ipcRenderer.invoke('media-browse-filesystem', path);
  },

  // Get filesystem roots (drives on Windows)
  getFilesystemRoots: () => {
    return ipcRenderer.invoke('media-get-roots');
  },

  // Get tracks in a folder
  getFolderTracks: (folderId: string, options?: {
    limit?: number;
    offset?: number;
    isVideo?: boolean;
  }) => {
    return ipcRenderer.invoke('media-get-folder-tracks', folderId, options);
  },

  // Scan a folder for media files
  scanFolder: (folderId: string, options?: {
    forceRescan?: boolean;
    includeVideos?: boolean;
  }) => {
    return ipcRenderer.invoke('media-scan-folder', folderId, options);
  },

  // Get current scan status
  getScanStatus: () => {
    return ipcRenderer.invoke('media-scan-status');
  },

  // Abort current scan
  abortScan: () => {
    return ipcRenderer.invoke('media-abort-scan');
  },

  // Get local track artwork URL
  getLocalTrackArtwork: (trackId: string) => {
    return ipcRenderer.invoke('media-get-track-artwork', trackId);
  },

  // ========================================
  // Download API (proxied to server)
  // ========================================

  // Start a download
  startDownload: (options: {
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
  }) => {
    return ipcRenderer.invoke('media-start-download', options);
  },

  // Get active downloads
  getActiveDownloads: () => {
    return ipcRenderer.invoke('media-get-downloads');
  },

  // Get download history
  getDownloadHistory: (status?: string) => {
    return ipcRenderer.invoke('media-get-download-history', status);
  },

  // Cancel a download
  cancelDownload: (downloadId: string) => {
    return ipcRenderer.invoke('media-cancel-download', downloadId);
  },

  // Legacy compatibility stubs (deprecated - use new APIs above)
  selectFolder: (_options?: any) => {
    console.warn('[Preload] selectFolder is deprecated, use browseFilesystem instead');
    return Promise.resolve(null);
  },

  scanMusicFolder: (_folderPath: string) => {
    console.warn('[Preload] scanMusicFolder is deprecated, use scanFolder instead');
    return Promise.resolve({ tracks: [] });
  },

  getLocalTracks: () => {
    console.warn('[Preload] getLocalTracks is deprecated, use getFolderTracks instead');
    return Promise.resolve([]);
  },

  getEmbeddedArtwork: (trackId: string) => {
    return ipcRenderer.invoke('media-get-track-artwork', trackId);
  },

  enrichLocalTracks: (_tracks: any[]) => {
    console.warn('[Preload] enrichLocalTracks is deprecated');
    return Promise.resolve([]);
  },

  writeTrackMetadata: (_params: any) => {
    console.warn('[Preload] writeTrackMetadata is not yet implemented on server');
    return Promise.resolve({ success: false });
  },

  onScanProgress: (_callback: any) => {
    // TODO: Implement WebSocket-based progress events
    return () => { };
  },

  onEnrichProgress: (_callback: any) => {
    return () => { };
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
    return () => { };
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

  getListenHistory: (limit?: number) => {
    return ipcRenderer.invoke('stats-listen-history', limit);
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
  // Like APIs (proxied to server)
  // ========================================

  getLikedTracks: () => {
    return ipcRenderer.invoke('library-likes');
  },

  likeTrack: (track: unknown) => {
    return ipcRenderer.invoke('like-track', track);
  },

  unlikeTrack: (trackId: string) => {
    return ipcRenderer.invoke('unlike-track', trackId);
  },

  isTrackLiked: (trackId: string) => {
    return ipcRenderer.invoke('is-track-liked', trackId);
  },

  // ========================================
  // Playlist APIs (proxied to server)
  // ========================================

  getPlaylists: () => {
    return ipcRenderer.invoke('get-playlists');
  },

  getPlaylist: (playlistId: string) => {
    return ipcRenderer.invoke('get-playlist', playlistId);
  },

  createPlaylist: (name: string, description?: string, options?: {
    folderId?: string;
    rules?: Array<{ field: string; operator: string; value: unknown }>;
    combinator?: 'and' | 'or';
    orderBy?: string;
    orderDirection?: 'asc' | 'desc';
    limit?: number;
  }) => {
    return ipcRenderer.invoke('create-playlist', name, description, options);
  },

  updatePlaylist: (playlistId: string, data: Record<string, unknown>) => {
    return ipcRenderer.invoke('update-playlist', playlistId, data);
  },

  deletePlaylist: (playlistId: string) => {
    return ipcRenderer.invoke('delete-playlist', playlistId);
  },

  renamePlaylist: (playlistId: string, name: string) => {
    return ipcRenderer.invoke('rename-playlist', playlistId, name);
  },

  addToPlaylist: (playlistId: string, track: unknown) => {
    return ipcRenderer.invoke('add-to-playlist', playlistId, track);
  },

  removeFromPlaylist: (playlistId: string, trackId: string) => {
    return ipcRenderer.invoke('remove-from-playlist', playlistId, trackId);
  },

  // Playlist Rules (for smart/hybrid playlists)
  getPlaylistRules: () => {
    return ipcRenderer.invoke('get-playlist-rules');
  },

  evaluatePlaylistRules: (playlistId: string) => {
    return ipcRenderer.invoke('evaluate-playlist-rules', playlistId);
  },

  previewPlaylistRules: (options: {
    rules: Array<{ field: string; operator: string; value: unknown }>;
    combinator?: 'and' | 'or';
    orderBy?: string;
    orderDirection?: 'asc' | 'desc';
    limit?: number;
  }) => {
    return ipcRenderer.invoke('preview-playlist-rules', options);
  },

  playerGetLastState: () => {
    return ipcRenderer.invoke('player-last-state');
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
  // DEPRECATED: Karaoke APIs
  // These are stubs - karaoke is not available in client mode
  // ========================================

  /** @deprecated Karaoke not available in client mode */
  karaoke: {
    /** @deprecated */ isAvailable: () => Promise.resolve(false),
    /** @deprecated */ processTrack: (_trackId: string, _audioUrl: string) => Promise.resolve({ success: false, error: 'Karaoke not available in client mode' }),
    /** @deprecated */ hasCached: (_trackId: string) => Promise.resolve(false),
    /** @deprecated */ getCached: (_trackId: string) => Promise.resolve(null),
    /** @deprecated */ clearCache: (_trackId: string) => Promise.resolve({ success: true }),
    /** @deprecated */ clearAllCache: () => Promise.resolve({ success: true }),
    /** @deprecated */ onAvailabilityChange: (_callback: unknown) => () => {},
    /** @deprecated */ onFullTrackReady: (_callback: unknown) => () => {},
    /** @deprecated */ onProgress: (_callback: unknown) => () => {},
    /** @deprecated */ onFirstChunkReady: (_callback: unknown) => () => {},
    /** @deprecated */ onChunkUpdated: (_callback: unknown) => () => {},
    /** @deprecated */ predictivePrefetch: (_tracks: unknown[]) => Promise.resolve({ success: false }),
    /** @deprecated */ getCapabilities: () => Promise.resolve({ available: false }),
  },

  // ========================================
  // DEPRECATED: Components APIs (Demucs)
  // These are stubs - component management is not available in client mode
  // ========================================

  /** @deprecated Components not available in client mode */
  components: {
    /** @deprecated */ getDemucsStatus: () => Promise.resolve({ installed: false, enabled: false }),
    /** @deprecated */ installDemucs: () => Promise.resolve({ success: false }),
    /** @deprecated */ cancelDemucsInstall: () => Promise.resolve({ success: false }),
    /** @deprecated */ uninstallDemucs: () => Promise.resolve({ success: false }),
    /** @deprecated */ setDemucsEnabled: (_enabled: boolean) => Promise.resolve({ success: false }),
    /** @deprecated */ startDemucsServer: () => Promise.resolve({ success: false }),
    /** @deprecated */ stopDemucsServer: () => Promise.resolve({ success: false }),
    /** @deprecated */ onInstallProgress: (_callback: unknown) => () => {},
  },

  // ========================================
  // DEPRECATED: Spotify Integration APIs
  // These are stubs - Spotify integration is not available in client mode
  // Note: "sposify" is a legacy typo, kept for backwards compatibility
  // ========================================

  /** @deprecated Spotify integration not available in client mode */
  sposify: {
    /** @deprecated */ init: () => Promise.resolve({ success: false }),
    /** @deprecated */ rebuildDatabase: () => Promise.resolve({ success: false }),
    /** @deprecated */ getStatus: () => Promise.resolve({ initialized: false }),
    /** @deprecated */ close: () => Promise.resolve({ success: true }),
    /** @deprecated */ selectExportFiles: () => Promise.resolve(null),
    /** @deprecated */ selectExportFolder: () => Promise.resolve(null),
    /** @deprecated */ parseExport: (_filePaths: string[]) => Promise.resolve(null),
    /** @deprecated */ parseExportFolder: (_folderPath: string) => Promise.resolve(null),
    /** @deprecated */ matchTracks: (_tracks: unknown[]) => Promise.resolve([]),
    /** @deprecated */ importToLibrary: (_data: unknown) => Promise.resolve({ success: false }),
    /** @deprecated */ getAudioFeatures: (_spotifyId: string) => Promise.resolve(null),
    /** @deprecated */ getAudioFeaturesBatch: (_spotifyIds: string[]) => Promise.resolve({}),
    /** @deprecated */ getFeaturesByIsrc: (_isrc: string) => Promise.resolve(null),
    /** @deprecated */ getFeaturesByMetadata: (_title: string, _artist: string) => Promise.resolve(null),
    /** @deprecated */ findSimilarByFeatures: (_features: unknown, _limit?: number) => Promise.resolve([]),
    /** @deprecated */ matchByMetadata: (_tracks: unknown[]) => Promise.resolve([]),
    /** @deprecated */ enrichTrack: (_localTrackId: string, _spotifyId: string) => Promise.resolve({ success: false }),
    /** @deprecated */ searchPlaylists: (_query: string, _options?: unknown) => Promise.resolve({ playlists: [] }),
    /** @deprecated */ browsePlaylists: (_options?: unknown) => Promise.resolve({ playlists: [] }),
    /** @deprecated */ getPlaylist: (_playlistId: string) => Promise.resolve(null),
    /** @deprecated */ getTopPlaylists: (_limit?: number) => Promise.resolve([]),
    /** @deprecated */ getPlaylistsForTrack: (_spotifyId: string, _limit?: number) => Promise.resolve([]),
    /** @deprecated */ getTrack: (_spotifyId: string) => Promise.resolve(null),
    /** @deprecated */ getTrackByIsrc: (_isrc: string) => Promise.resolve(null),
    /** @deprecated */ searchTracks: (_title: string, _artist: string, _limit?: number) => Promise.resolve([]),
    /** @deprecated */ setConfig: (_config: unknown) => Promise.resolve({ success: false }),
    /** @deprecated */ clearCache: () => Promise.resolve({ success: true }),
    /** @deprecated */ onImportProgress: (_callback: unknown) => () => {},
    /** @deprecated */ onSetupProgress: (_callback: unknown) => () => {},
  },

  // ========================================
  // DEPRECATED: Plugin Repository APIs
  // These are stubs - repository management is not available in client mode
  // ========================================

  /** @deprecated Repository management not available in client mode */
  repositories: {
    /** @deprecated */ list: () => Promise.resolve([]),
    /** @deprecated */ add: (_url: string) => Promise.resolve({ success: false, error: 'Repository management not available in client mode' }),
    /** @deprecated */ remove: (_repoId: string) => Promise.resolve({ success: false }),
    /** @deprecated */ setEnabled: (_repoId: string, _enabled: boolean) => Promise.resolve({ success: false }),
    /** @deprecated */ refresh: (_repoId: string) => Promise.resolve({ success: false }),
    /** @deprecated */ refreshAll: () => Promise.resolve({ success: false }),
    /** @deprecated */ getAvailablePlugins: () => Promise.resolve([]),
    /** @deprecated */ searchPlugins: (_query: string) => Promise.resolve([]),
    /** @deprecated */ checkUpdates: () => Promise.resolve([]),
    /** @deprecated */ installFromSource: (_source: string) => Promise.resolve({ success: false, error: 'Plugin installation not available in client mode' }),
    /** @deprecated */ uninstallPlugin: (_pluginId: string) => Promise.resolve({ success: false }),
    /** @deprecated */ updatePlugin: (_pluginId: string, _source: string) => Promise.resolve({ success: false }),
    /** @deprecated */ onInstallProgress: (_callback: unknown) => () => {},
    /** @deprecated */ onPluginsChanged: (_callback: () => void) => () => {},
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

  // ========================================
  // Generic API Fetch (for stores that need direct server access)
  // ========================================

  fetch: (path: string, options?: { method?: string; body?: unknown }) => {
    return ipcRenderer.invoke('api-fetch', { path, options });
  },

  // ========================================
  // Tags API (proxied to server)
  // ========================================

  tags: {
    getAll: () => {
      return ipcRenderer.invoke('tags-get-all');
    },

    create: (name: string, color?: string) => {
      return ipcRenderer.invoke('tags-create', name, color);
    },

    update: (tagId: string, data: { name?: string; color?: string }) => {
      return ipcRenderer.invoke('tags-update', tagId, data);
    },

    delete: (tagId: string) => {
      return ipcRenderer.invoke('tags-delete', tagId);
    },

    getTrackTags: (trackId: string) => {
      return ipcRenderer.invoke('tags-get-track-tags', trackId);
    },

    addToTrack: (trackId: string, tags: string[]) => {
      return ipcRenderer.invoke('tags-add-to-track', trackId, tags);
    },

    removeFromTrack: (trackId: string, tagName: string) => {
      return ipcRenderer.invoke('tags-remove-from-track', trackId, tagName);
    },

    getTracksByTag: (tagName: string) => {
      return ipcRenderer.invoke('tags-get-tracks-by-tag', tagName);
    },

    // Entity tags (albums, artists, playlists)
    getEntityTags: (entityType: string, entityId: string) => {
      return ipcRenderer.invoke('tags-get-entity-tags', entityType, entityId);
    },

    addToEntity: (entityType: string, entityId: string, tags: string[]) => {
      return ipcRenderer.invoke('tags-add-to-entity', entityType, entityId, tags);
    },

    removeFromEntity: (entityType: string, entityId: string, tagName: string) => {
      return ipcRenderer.invoke('tags-remove-from-entity', entityType, entityId, tagName);
    },
  },

  // ========================================
  // Collections API (proxied to server)
  // ========================================

  collections: {
    getAll: () => {
      return ipcRenderer.invoke('collections-get-all');
    },

    get: (collectionId: string) => {
      return ipcRenderer.invoke('collections-get', collectionId);
    },

    create: (data: {
      name: string;
      description?: string;
      color?: string;
      icon?: string;
    }) => {
      return ipcRenderer.invoke('collections-create', data);
    },

    update: (collectionId: string, data: {
      name?: string;
      description?: string;
      color?: string;
      icon?: string;
    }) => {
      return ipcRenderer.invoke('collections-update', collectionId, data);
    },

    delete: (collectionId: string) => {
      return ipcRenderer.invoke('collections-delete', collectionId);
    },

    addItem: (collectionId: string, item: {
      type: 'track' | 'album' | 'artist' | 'playlist';
      id: string;
      data?: unknown;
    }) => {
      return ipcRenderer.invoke('collections-add-item', collectionId, item);
    },

    removeItem: (collectionId: string, itemId: string) => {
      return ipcRenderer.invoke('collections-remove-item', collectionId, itemId);
    },

    reorderItems: (collectionId: string, itemIds: string[]) => {
      return ipcRenderer.invoke('collections-reorder-items', collectionId, itemIds);
    },

    reorder: (collectionIds: string[]) => {
      return ipcRenderer.invoke('collections-reorder', collectionIds);
    },

    moveItem: (collectionId: string, itemId: string, targetFolderId: string | null) => {
      return ipcRenderer.invoke('collections-move-item', collectionId, itemId, targetFolderId);
    },

    createFolder: (collectionId: string, name: string, parentFolderId?: string | null) => {
      return ipcRenderer.invoke('collections-create-folder', collectionId, name, parentFolderId);
    },

    updateFolder: (collectionId: string, folderId: string, data: { name?: string }) => {
      return ipcRenderer.invoke('collections-update-folder', collectionId, folderId, data);
    },

    deleteFolder: (collectionId: string, folderId: string, moveContentsToParent?: boolean) => {
      return ipcRenderer.invoke('collections-delete-folder', collectionId, folderId, moveContentsToParent);
    },
  },

  // ========================================
  // Audio Features API (proxied to server)
  // ========================================

  audioFeatures: {
    get: (trackId: string) => {
      return ipcRenderer.invoke('audio-features-get', trackId);
    },

    query: (query: {
      bpmMin?: number;
      bpmMax?: number;
      energyMin?: number;
      energyMax?: number;
      danceabilityMin?: number;
      danceabilityMax?: number;
      valenceMin?: number;
      valenceMax?: number;
      key?: string;
      mode?: string;
      genres?: string[];
      mood?: string;
      decade?: string;
      limit?: number;
    }) => {
      return ipcRenderer.invoke('audio-features-query', query);
    },

    getSimilar: (trackId: string, count: number) => {
      return ipcRenderer.invoke('audio-features-similar', trackId, count);
    },

    getDistributions: () => {
      return ipcRenderer.invoke('audio-features-distributions');
    },

    getMoods: () => {
      return ipcRenderer.invoke('audio-features-moods');
    },

    getMoodClusters: (mood?: string) => {
      return ipcRenderer.invoke('audio-features-mood-clusters', mood);
    },

    getTrackMood: (trackId: string) => {
      return ipcRenderer.invoke('audio-features-track-mood', trackId);
    },

    getStats: () => {
      return ipcRenderer.invoke('audio-features-stats');
    },

    save: (trackId: string, features: unknown) => {
      return ipcRenderer.invoke('audio-features-save', trackId, features);
    },

    search: (criteria: unknown) => {
      return ipcRenderer.invoke('audio-features-search', criteria);
    },
  },

  // ========================================
  // NLP Search API (proxied to server)
  // ========================================

  nlpSearch: {
    natural: (query: string) => {
      return ipcRenderer.invoke('search-natural', query);
    },

    advanced: (params: {
      query?: string;
      artist?: string;
      album?: string;
      genre?: string;
      mood?: string;
      tempo?: string;
      decade?: string;
      tags?: string[];
      limit?: number;
    }) => {
      return ipcRenderer.invoke('search-advanced', params);
    },

    suggestions: (prefix: string) => {
      return ipcRenderer.invoke('search-suggestions', prefix);
    },

    getHistory: () => {
      return ipcRenderer.invoke('search-history');
    },

    deleteHistoryItem: (id: string) => {
      return ipcRenderer.invoke('search-history-delete', id);
    },

    clearHistory: () => {
      return ipcRenderer.invoke('search-history-clear');
    },
  },

  // ========================================
  // Embedding API (proxied to server)
  // ========================================

  embedding: {
    get: (trackId: string) => {
      return ipcRenderer.invoke('embedding-get', trackId);
    },

    findSimilar: (embedding: number[], count: number) => {
      return ipcRenderer.invoke('embedding-similar', embedding, count);
    },
  },

  // ========================================
  // Extended ML/Algorithm APIs
  // ========================================

  algoGetMoodRadio: (mood: string, count: number) => {
    return ipcRenderer.invoke('algo-mood-radio', mood, count);
  },

  algoGetStatus: () => {
    return ipcRenderer.invoke('algo-status');
  },

  algoGetTrainingHistory: () => {
    return ipcRenderer.invoke('algo-training-history');
  },

  algoRecordMLEvent: (event: unknown) => {
    return ipcRenderer.invoke('algo-record-event', event);
  },

  // ========================================
  // Pinned Items API (proxied to server)
  // ========================================

  pinned: {
    getAll: () => {
      return ipcRenderer.invoke('pinned-get-all');
    },

    add: (itemType: string, itemId: string, data?: unknown) => {
      return ipcRenderer.invoke('pinned-add', itemType, itemId, data);
    },

    remove: (itemType: string, itemId: string) => {
      return ipcRenderer.invoke('pinned-remove', itemType, itemId);
    },

    check: (itemType: string, itemId: string) => {
      return ipcRenderer.invoke('pinned-check', itemType, itemId);
    },

    reorder: (items: Array<{ itemType: string; itemId: string }>) => {
      return ipcRenderer.invoke('pinned-reorder', items);
    },
  },

  // ========================================
  // Library Views API (proxied to server)
  // ========================================

  libraryViews: {
    getAll: () => {
      return ipcRenderer.invoke('library-views-get-all');
    },

    get: (viewId: string) => {
      return ipcRenderer.invoke('library-views-get', viewId);
    },

    create: (data: {
      name: string;
      type: string;
      filters?: unknown;
      sortBy?: string;
      sortOrder?: 'asc' | 'desc';
    }) => {
      return ipcRenderer.invoke('library-views-create', data);
    },

    update: (viewId: string, data: {
      name?: string;
      filters?: unknown;
      sortBy?: string;
      sortOrder?: 'asc' | 'desc';
    }) => {
      return ipcRenderer.invoke('library-views-update', viewId, data);
    },

    delete: (viewId: string) => {
      return ipcRenderer.invoke('library-views-delete', viewId);
    },
  },

  // ========================================
  // Library Folders API (proxied to server)
  // ========================================

  libraryFolders: {
    getAll: () => {
      return ipcRenderer.invoke('library-folders-get-all');
    },

    create: (data: { name: string; parentId?: string }) => {
      return ipcRenderer.invoke('library-folders-create', data);
    },

    update: (folderId: string, data: { name?: string }) => {
      return ipcRenderer.invoke('library-folders-update', folderId, data);
    },

    delete: (folderId: string) => {
      return ipcRenderer.invoke('library-folders-delete', folderId);
    },

    movePlaylist: (playlistId: string, folderId: string | null) => {
      return ipcRenderer.invoke('library-playlist-move', playlistId, folderId);
    },
  },

  // ========================================
  // Smart Playlists API (proxied to server)
  // ========================================

  smartPlaylists: {
    getAll: () => {
      return ipcRenderer.invoke('smart-playlists-get-all');
    },

    get: (playlistId: string) => {
      return ipcRenderer.invoke('smart-playlists-get', playlistId);
    },

    create: (data: {
      name: string;
      description?: string;
      rules: Array<{ field: string; operator: string; value: unknown }>;
      combinator?: 'and' | 'or';
      orderBy?: string;
      orderDirection?: 'asc' | 'desc';
      limit?: number;
    }) => {
      return ipcRenderer.invoke('smart-playlists-create', data);
    },

    update: (playlistId: string, data: unknown) => {
      return ipcRenderer.invoke('smart-playlists-update', playlistId, data);
    },

    delete: (playlistId: string) => {
      return ipcRenderer.invoke('smart-playlists-delete', playlistId);
    },

    getTracks: (playlistId: string) => {
      return ipcRenderer.invoke('smart-playlists-tracks', playlistId);
    },

    preview: (options: {
      rules: Array<{ field: string; operator: string; value: unknown }>;
      combinator?: 'and' | 'or';
      orderBy?: string;
      orderDirection?: 'asc' | 'desc';
      limit?: number;
    }) => {
      return ipcRenderer.invoke('smart-playlists-preview', options);
    },

    getRules: () => {
      return ipcRenderer.invoke('smart-playlists-rules');
    },
  },

  // ========================================
  // Library Stats API (proxied to server)
  // ========================================

  libraryStats: {
    get: () => {
      return ipcRenderer.invoke('library-stats');
    },

    getTrackStats: (trackId: string) => {
      return ipcRenderer.invoke('library-track-stats', trackId);
    },

    getMostPlayed: (limit: number) => {
      return ipcRenderer.invoke('library-most-played', limit);
    },
  },

  // ========================================
  // Tracking Sessions API (proxied to server)
  // ========================================

  trackingSessions: {
    start: (data?: { context?: string }) => {
      return ipcRenderer.invoke('tracking-session-start', data);
    },

    end: (sessionId: string) => {
      return ipcRenderer.invoke('tracking-session-end', sessionId);
    },

    get: (sessionId: string) => {
      return ipcRenderer.invoke('tracking-session-get', sessionId);
    },

    list: (limit?: number) => {
      return ipcRenderer.invoke('tracking-sessions-list', limit);
    },

    getEvents: (options?: {
      type?: string;
      trackId?: string;
      sessionId?: string;
      limit?: number;
      offset?: number;
    }) => {
      return ipcRenderer.invoke('tracking-events-list', options);
    },
  },

  // ========================================
  // Discover API Extended (proxied to server)
  // ========================================

  discoverExtended: {
    getGenres: () => {
      return ipcRenderer.invoke('discover-genres');
    },

    getGenre: (genreId: string) => {
      return ipcRenderer.invoke('discover-genre', genreId);
    },

    getRadio: (trackId: string) => {
      return ipcRenderer.invoke('discover-radio', trackId);
    },

    getSections: () => {
      return ipcRenderer.invoke('discover-sections');
    },

    getLayout: () => {
      return ipcRenderer.invoke('discover-layout');
    },
  },

  // ========================================
  // Plugin Management API (proxied to server)
  // ========================================

  pluginManagement: {
    getRepositories: () => {
      return ipcRenderer.invoke('plugins-repositories-get');
    },

    addRepository: (url: string) => {
      return ipcRenderer.invoke('plugins-repositories-add', url);
    },

    removeRepository: (repoId: string) => {
      return ipcRenderer.invoke('plugins-repositories-remove', repoId);
    },

    refreshRepository: (repoId: string) => {
      return ipcRenderer.invoke('plugins-repositories-refresh', repoId);
    },

    getAvailable: () => {
      return ipcRenderer.invoke('plugins-available');
    },

    search: (query: string) => {
      return ipcRenderer.invoke('plugins-search', query);
    },

    install: (source: string, type?: 'npm' | 'git' | 'local') => {
      return ipcRenderer.invoke('plugins-install', source, type);
    },

    uninstall: (pluginId: string) => {
      return ipcRenderer.invoke('plugins-uninstall', pluginId);
    },

    getUpdates: () => {
      return ipcRenderer.invoke('plugins-updates');
    },

    getRoutes: () => {
      return ipcRenderer.invoke('plugins-routes');
    },

    setEnabled: (addonId: string, enabled: boolean) => {
      return ipcRenderer.invoke('addon-set-enabled', addonId, enabled);
    },
  },

  // ========================================
  // Server Settings API (proxied to server)
  // ========================================

  serverSettings: {
    get: () => {
      return ipcRenderer.invoke('settings-server-get');
    },

    update: (settings: unknown) => {
      return ipcRenderer.invoke('settings-server-update', settings);
    },
  },

  // ========================================
  // Logs API (proxied to server)
  // ========================================

  logs: {
    get: (options?: { level?: string; limit?: number; since?: string }) => {
      return ipcRenderer.invoke('logs-get', options);
    },

    clear: () => {
      return ipcRenderer.invoke('logs-clear');
    },
  },

  // ========================================
  // Stats Extended API (proxied to server)
  // ========================================

  getTopAlbums: (limit?: number) => {
    return ipcRenderer.invoke('stats-top-albums', limit);
  },

  refreshStats: () => {
    return ipcRenderer.invoke('stats-refresh');
  },

  // ========================================
  // Library Capabilities API (proxied to server)
  // ========================================

  libraryCapabilities: {
    get: () => {
      return ipcRenderer.invoke('library-capabilities');
    },

    getImportProviders: () => {
      return ipcRenderer.invoke('library-import-providers');
    },

    getExportFormats: () => {
      return ipcRenderer.invoke('library-export-formats');
    },
  },

  // ========================================
  // Skip Recording API (proxied to server)
  // ========================================

  recordSkip: (track: unknown, position: number, duration: number) => {
    return ipcRenderer.invoke('record-skip', track, position, duration);
  },

  // ========================================
  // Media Watcher API (proxied to server)
  // ========================================

  getMediaWatcherStatus: () => {
    return ipcRenderer.invoke('media-watcher-status');
  },

  // ========================================
  // Auth/Device API (proxied to server)
  // ========================================

  auth: {
    getIdentity: () => {
      return ipcRenderer.invoke('auth-identity');
    },

    getDevices: () => {
      return ipcRenderer.invoke('auth-devices');
    },

    removeDevice: (deviceId: string) => {
      return ipcRenderer.invoke('auth-device-remove', deviceId);
    },

    updateDevice: (deviceId: string, data: { name?: string; trusted?: boolean }) => {
      return ipcRenderer.invoke('auth-device-update', deviceId, data);
    },
  },

  // ========================================
  // Setup API (proxied to server)
  // ========================================

  setup: {
    getStatus: () => {
      return ipcRenderer.invoke('setup-status');
    },

    complete: () => {
      return ipcRenderer.invoke('setup-complete');
    },
  },

  // ========================================
  // Debug API (proxied to server)
  // ========================================

  debug: {
    getPersistence: () => {
      return ipcRenderer.invoke('debug-persistence');
    },
  },
};

// Expose the API to the renderer process
contextBridge.exposeInMainWorld('api', api);
