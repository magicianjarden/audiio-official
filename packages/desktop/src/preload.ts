/**
 * Audiio Desktop - Preload Script
 * Exposes a safe API to the renderer process
 */

import { contextBridge, ipcRenderer } from 'electron';

// Type-safe API exposed to renderer
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

  // Event subscriptions
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

  // Extended plugin management
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

  // Audio Analysis APIs
  getAudioFeatures: (trackId: string, streamUrl?: string) => {
    return ipcRenderer.invoke('get-audio-features', { trackId, streamUrl });
  },

  analyzeAudioFile: (filePath: string, options?: unknown) => {
    return ipcRenderer.invoke('analyze-audio-file', { filePath, options });
  },

  analyzeAudioUrl: (url: string, options?: unknown) => {
    return ipcRenderer.invoke('analyze-audio-url', { url, options });
  },

  setAudioFeatures: (trackId: string, features: unknown) => {
    return ipcRenderer.invoke('set-audio-features', { trackId, features });
  },

  getCachedAudioFeatures: (trackIds: string[]) => {
    return ipcRenderer.invoke('get-cached-audio-features', trackIds);
  },

  clearAudioFeaturesCache: () => {
    return ipcRenderer.invoke('clear-audio-features-cache');
  },

  checkAudioAnalyzer: () => {
    return ipcRenderer.invoke('check-audio-analyzer');
  },

  // Download
  downloadTrack: (track: unknown) => {
    return ipcRenderer.invoke('download-track', track);
  },

  onDownloadProgress: (callback: (progress: { trackId: string; progress: number; status: string; filePath?: string; error?: string }) => void) => {
    const listener = (_: unknown, progress: { trackId: string; progress: number; status: string; filePath?: string; error?: string }) => callback(progress);
    ipcRenderer.on('download-progress', listener);
    return () => {
      ipcRenderer.removeListener('download-progress', listener);
    };
  },

  // Mobile Access APIs
  getMobileStatus: () => {
    return ipcRenderer.invoke('get-mobile-status');
  },

  enableMobileAccess: (options?: { customRelayUrl?: string }) => {
    return ipcRenderer.invoke('enable-mobile-access', options);
  },

  disableMobileAccess: () => {
    return ipcRenderer.invoke('disable-mobile-access');
  },

  setMobileRemoteAccess: (enable: boolean) => {
    return ipcRenderer.invoke('set-mobile-remote-access', enable);
  },

  regenerateMobileToken: () => {
    return ipcRenderer.invoke('regenerate-mobile-token');
  },

  disconnectMobileSession: (sessionId: string) => {
    return ipcRenderer.invoke('disconnect-mobile-session', sessionId);
  },

  onMobileStatusChange: (callback: (status: { isEnabled: boolean; accessConfig: unknown }) => void) => {
    const listener = (_: unknown, status: { isEnabled: boolean; accessConfig: unknown }) => callback(status);
    ipcRenderer.on('mobile-status-change', listener);
    return () => {
      ipcRenderer.removeListener('mobile-status-change', listener);
    };
  },

  // Device approval events and actions
  onMobileDeviceApprovalRequest: (callback: (request: { id: string; deviceName: string; userAgent: string }) => void) => {
    const listener = (_: unknown, request: { id: string; deviceName: string; userAgent: string }) => callback(request);
    ipcRenderer.on('mobile-device-approval-request', listener);
    return () => {
      ipcRenderer.removeListener('mobile-device-approval-request', listener);
    };
  },

  approveMobileDevice: (requestId: string) => {
    return ipcRenderer.invoke('approve-mobile-device', requestId);
  },

  denyMobileDevice: (requestId: string) => {
    return ipcRenderer.invoke('deny-mobile-device', requestId);
  },

  getPendingMobileApprovals: () => {
    return ipcRenderer.invoke('get-pending-mobile-approvals');
  },

  // ========================================
  // Mobile Auth Management APIs
  // ========================================

  getMobilePassphrase: () => {
    return ipcRenderer.invoke('get-mobile-passphrase');
  },

  regenerateMobilePassphrase: () => {
    return ipcRenderer.invoke('regenerate-mobile-passphrase');
  },

  setMobileCustomPassword: (password: string) => {
    return ipcRenderer.invoke('set-mobile-custom-password', password);
  },

  removeMobileCustomPassword: () => {
    return ipcRenderer.invoke('remove-mobile-custom-password');
  },

  getMobileDevices: () => {
    return ipcRenderer.invoke('get-mobile-devices');
  },

  revokeMobileDevice: (deviceId: string) => {
    return ipcRenderer.invoke('revoke-mobile-device', deviceId);
  },

  revokeAllMobileDevices: () => {
    return ipcRenderer.invoke('revoke-all-mobile-devices');
  },

  getMobileAuthSettings: () => {
    return ipcRenderer.invoke('get-mobile-auth-settings');
  },

  updateMobileAuthSettings: (settings: { defaultExpirationDays?: number | null; requirePasswordEveryTime?: boolean }) => {
    return ipcRenderer.invoke('update-mobile-auth-settings', settings);
  },

  renameMobileDevice: (deviceId: string, name: string) => {
    return ipcRenderer.invoke('rename-mobile-device', deviceId, name);
  },

  // ========================================
  // Relay Management APIs
  // ========================================

  // Get relay status and info
  getRelayStatus: () => {
    return ipcRenderer.invoke('get-relay-status');
  },

  // Get relay connection code
  getRelayCode: () => {
    return ipcRenderer.invoke('get-relay-code');
  },

  // Get connected relay peers
  getRelayPeers: () => {
    return ipcRenderer.invoke('get-relay-peers');
  },

  // Approve a relay peer
  approveRelayPeer: (peerId: string) => {
    return ipcRenderer.invoke('approve-relay-peer', peerId);
  },

  // Deny a relay peer
  denyRelayPeer: (peerId: string) => {
    return ipcRenderer.invoke('deny-relay-peer', peerId);
  },

  // Listen for relay peer join events
  onRelayPeerJoined: (callback: (peer: { id: string; deviceName: string; publicKey: string }) => void) => {
    const listener = (_: unknown, peer: { id: string; deviceName: string; publicKey: string }) => callback(peer);
    ipcRenderer.on('relay-peer-joined', listener);
    return () => {
      ipcRenderer.removeListener('relay-peer-joined', listener);
    };
  },

  // Listen for relay peer left events
  onRelayPeerLeft: (callback: (peerId: string) => void) => {
    const listener = (_: unknown, peerId: string) => callback(peerId);
    ipcRenderer.on('relay-peer-left', listener);
    return () => {
      ipcRenderer.removeListener('relay-peer-left', listener);
    };
  },

  // ========================================
  // Library Bridge APIs (for mobile sync)
  // ========================================

  // Signal that library bridge hooks are ready
  signalLibraryBridgeReady: () => {
    ipcRenderer.send('library-bridge-ready');
  },

  // Respond to library data request from main process
  onLibraryDataRequest: (callback: () => void) => {
    const listener = () => callback();
    ipcRenderer.on('library-request-data', listener);
    return () => {
      ipcRenderer.removeListener('library-request-data', listener);
    };
  },

  // Send library data to main process
  sendLibraryData: (data: { likedTracks: unknown[]; playlists: unknown[]; dislikedTrackIds: string[]; dislikedTracks: unknown[] }) => {
    ipcRenderer.send('library-data-response', data);
  },

  // Notify main process of library changes
  notifyLibraryChange: (type: string, data: unknown) => {
    ipcRenderer.send(type, data);
  },

  // Listen for library actions from main process (mobile triggers)
  onLibraryAction: (
    action: 'like' | 'unlike' | 'dislike' | 'remove-dislike' | 'create-playlist' | 'delete-playlist' | 'rename-playlist' | 'add-to-playlist' | 'remove-from-playlist',
    callback: (payload: unknown) => void
  ) => {
    const channel = `library-action-${action}`;
    const listener = (_: unknown, payload: unknown) => callback(payload);
    ipcRenderer.on(channel, listener);
    return () => {
      ipcRenderer.removeListener(channel, listener);
    };
  },

  // Translation API (CORS-free via main process)
  translateText: (text: string, source: string, target: string) => {
    return ipcRenderer.invoke('translate-text', { text, source, target });
  },

  // Folder selection dialog
  selectFolder: (options?: { title?: string; defaultPath?: string }) => {
    return ipcRenderer.invoke('select-folder', options);
  },

  // Local music scanning
  scanMusicFolder: (folderPath: string) => {
    return ipcRenderer.invoke('scan-music-folder', folderPath);
  },

  // Get local music tracks
  getLocalTracks: () => {
    return ipcRenderer.invoke('get-local-tracks');
  },

  // Settings sync
  updateSettings: (key: string, value: unknown) => {
    return ipcRenderer.invoke('update-settings', { key, value });
  },

  // Get app paths
  getAppPaths: () => {
    return ipcRenderer.invoke('get-app-paths');
  },

  // ========================================
  // Plugin Management APIs
  // ========================================

  setPluginFolder: (folderPath: string | null) => {
    return ipcRenderer.invoke('set-plugin-folder', folderPath);
  },

  getPluginFolderStatus: () => {
    return ipcRenderer.invoke('get-plugin-folder-status');
  },

  installPlugin: (filePath: string) => {
    return ipcRenderer.invoke('install-plugin', filePath);
  },

  getInstalledPlugins: () => {
    return ipcRenderer.invoke('get-installed-plugins');
  },

  uninstallPlugin: (pluginId: string) => {
    return ipcRenderer.invoke('uninstall-plugin', pluginId);
  },

  onPluginDetected: (callback: (data: { filename: string; path: string }) => void) => {
    const listener = (_: unknown, data: { filename: string; path: string }) => callback(data);
    ipcRenderer.on('plugin-detected', listener);
    return () => {
      ipcRenderer.removeListener('plugin-detected', listener);
    };
  },

  // === ML Algorithm APIs ===

  // Score a single track
  algoScoreTrack: (trackId: string) => {
    return ipcRenderer.invoke('algo-score-track', trackId);
  },

  // Score multiple tracks
  algoScoreBatch: (trackIds: string[]) => {
    return ipcRenderer.invoke('algo-score-batch', trackIds);
  },

  // Get personalized recommendations
  algoGetRecommendations: (count: number) => {
    return ipcRenderer.invoke('algo-get-recommendations', count);
  },

  // Get similar tracks
  algoGetSimilar: (trackId: string, count: number) => {
    return ipcRenderer.invoke('algo-get-similar', trackId, count);
  },

  // Get audio features from ML
  algoGetFeatures: (trackId: string) => {
    return ipcRenderer.invoke('algo-get-features', trackId);
  },

  // Trigger model training
  algoTrain: () => {
    return ipcRenderer.invoke('algo-train');
  },

  // Get training status
  algoTrainingStatus: () => {
    return ipcRenderer.invoke('algo-training-status');
  },

  // Record a user event for learning
  algoRecordEvent: (event: unknown) => {
    return ipcRenderer.invoke('algo-record-event', event);
  },

  // Check if algorithm is loaded
  isAddonLoaded: (_addonId: string) => {
    return ipcRenderer.invoke('algo-is-loaded');
  },

  // Update algorithm settings
  algoUpdateSettings: (settings: Record<string, unknown>) => {
    return ipcRenderer.invoke('algo-update-settings', settings);
  },

  // Get algorithm settings
  algoGetSettings: () => {
    return ipcRenderer.invoke('algo-get-settings');
  },

  // ========================================
  // Karaoke APIs
  // ========================================

  karaoke: {
    // Check if karaoke is available
    isAvailable: () => {
      return ipcRenderer.invoke('karaoke-is-available');
    },

    // Process a track for karaoke (get instrumental)
    processTrack: (trackId: string, audioUrl: string) => {
      return ipcRenderer.invoke('karaoke-process-track', { trackId, audioUrl });
    },

    // Check if track is cached
    hasCached: (trackId: string) => {
      return ipcRenderer.invoke('karaoke-has-cached', trackId);
    },

    // Get cached instrumental
    getCached: (trackId: string) => {
      return ipcRenderer.invoke('karaoke-get-cached', trackId);
    },

    // Clear cache for a track
    clearCache: (trackId: string) => {
      return ipcRenderer.invoke('karaoke-clear-cache', trackId);
    },

    // Clear all karaoke cache
    clearAllCache: () => {
      return ipcRenderer.invoke('karaoke-clear-all-cache');
    },

    // Listen for availability changes
    onAvailabilityChange: (callback: (data: { available: boolean }) => void) => {
      const listener = (_: unknown, data: { available: boolean }) => callback(data);
      ipcRenderer.on('karaoke-availability-change', listener);
      return () => {
        ipcRenderer.removeListener('karaoke-availability-change', listener);
      };
    },

    // Listen for full track ready events (push notification - no polling needed!)
    onFullTrackReady: (callback: (data: { trackId: string; result: { instrumentalUrl?: string; audioBase64?: string; mimeType: string; isPartial: boolean } }) => void) => {
      console.log('[Preload] Registering karaoke-full-track-ready listener');
      const listener = (_: unknown, data: { trackId: string; result: { instrumentalUrl?: string; audioBase64?: string; mimeType: string; isPartial: boolean } }) => {
        console.log('[Preload] Received karaoke-full-track-ready event:', data?.trackId);
        callback(data);
      };
      ipcRenderer.on('karaoke-full-track-ready', listener);
      return () => {
        console.log('[Preload] Removing karaoke-full-track-ready listener');
        ipcRenderer.removeListener('karaoke-full-track-ready', listener);
      };
    },

    // Listen for progress updates (real-time via WebSocket, with ETA)
    onProgress: (callback: (data: { trackId: string; progress: number; stage: string; eta?: number }) => void) => {
      const listener = (_: unknown, data: { trackId: string; progress: number; stage: string; eta?: number }) => callback(data);
      ipcRenderer.on('karaoke-progress', listener);
      return () => {
        ipcRenderer.removeListener('karaoke-progress', listener);
      };
    },

    // Listen for FIRST CHUNK ready (instant playback - ~3-4 seconds!)
    onFirstChunkReady: (callback: (data: { trackId: string; url: string }) => void) => {
      console.log('[Preload] Registering karaoke-first-chunk-ready listener');
      const listener = (_: unknown, data: { trackId: string; url: string }) => {
        console.log('[Preload] First chunk ready for instant playback:', data?.trackId);
        callback(data);
      };
      ipcRenderer.on('karaoke-first-chunk-ready', listener);
      return () => {
        ipcRenderer.removeListener('karaoke-first-chunk-ready', listener);
      };
    },

    // Listen for CHUNK UPDATED (progressive streaming - audio file has grown)
    onChunkUpdated: (callback: (data: { trackId: string; url: string; chunkNumber: number }) => void) => {
      const listener = (_: unknown, data: { trackId: string; url: string; chunkNumber: number }) => {
        console.log('[Preload] Chunk updated:', data?.trackId, 'chunk:', data?.chunkNumber);
        callback(data);
      };
      ipcRenderer.on('karaoke-chunk-updated', listener);
      return () => {
        ipcRenderer.removeListener('karaoke-chunk-updated', listener);
      };
    },

    // Queue tracks for predictive processing
    predictivePrefetch: (tracks: Array<{ id: string; url: string }>) => {
      return ipcRenderer.invoke('karaoke-predictive-prefetch', tracks);
    },

    // Get server capabilities (hardware, RTF, etc.)
    getCapabilities: () => {
      return ipcRenderer.invoke('karaoke-get-capabilities');
    },
  },

  // ========================================
  // Components APIs (Optional Components like Demucs)
  // ========================================

  components: {
    // Get Demucs component status
    getDemucsStatus: () => {
      return ipcRenderer.invoke('component-demucs-status');
    },

    // Install Demucs component
    installDemucs: () => {
      return ipcRenderer.invoke('component-demucs-install');
    },

    // Cancel Demucs installation
    cancelDemucsInstall: () => {
      return ipcRenderer.invoke('component-demucs-cancel-install');
    },

    // Uninstall Demucs component
    uninstallDemucs: () => {
      return ipcRenderer.invoke('component-demucs-uninstall');
    },

    // Set Demucs enabled state
    setDemucsEnabled: (enabled: boolean) => {
      return ipcRenderer.invoke('component-demucs-set-enabled', enabled);
    },

    // Start Demucs server
    startDemucsServer: () => {
      return ipcRenderer.invoke('component-demucs-start-server');
    },

    // Stop Demucs server
    stopDemucsServer: () => {
      return ipcRenderer.invoke('component-demucs-stop-server');
    },

    // Listen for install progress events
    onInstallProgress: (callback: (progress: { phase: string; progress: number; message: string; bytesDownloaded?: number; totalBytes?: number }) => void) => {
      const listener = (_: unknown, progress: { phase: string; progress: number; message: string; bytesDownloaded?: number; totalBytes?: number }) => callback(progress);
      ipcRenderer.on('component-install-progress', listener);
      return () => {
        ipcRenderer.removeListener('component-install-progress', listener);
      };
    },
  },

  // ========================================
  // Sposify APIs
  // ========================================

  sposify: {
    // Database management
    init: () => ipcRenderer.invoke('sposify:init'),
    rebuildDatabase: () => ipcRenderer.invoke('sposify:rebuild-database'),
    getStatus: () => ipcRenderer.invoke('sposify:get-status'),
    close: () => ipcRenderer.invoke('sposify:close'),

    // File selection
    selectExportFiles: () => ipcRenderer.invoke('sposify:select-export-files'),
    selectExportFolder: () => ipcRenderer.invoke('sposify:select-export-folder'),

    // Import operations
    parseExport: (filePaths: string[]) => ipcRenderer.invoke('sposify:parse-export', filePaths),
    parseExportFolder: (folderPath: string) => ipcRenderer.invoke('sposify:parse-export-folder', folderPath),
    matchTracks: (tracks: Array<{ trackName: string; artistName: string; albumName?: string }>) =>
      ipcRenderer.invoke('sposify:match-tracks', tracks),
    importToLibrary: (data: unknown) => ipcRenderer.invoke('sposify:import-to-library', data),

    // Audio features
    getAudioFeatures: (spotifyId: string) => ipcRenderer.invoke('sposify:get-audio-features', spotifyId),
    getAudioFeaturesBatch: (spotifyIds: string[]) => ipcRenderer.invoke('sposify:get-audio-features-batch', spotifyIds),
    getFeaturesByIsrc: (isrc: string) => ipcRenderer.invoke('sposify:get-features-by-isrc', isrc),
    getFeaturesByMetadata: (title: string, artist: string) =>
      ipcRenderer.invoke('sposify:get-features-by-metadata', title, artist),
    findSimilarByFeatures: (features: unknown, limit?: number) =>
      ipcRenderer.invoke('sposify:find-similar-by-features', features, limit),

    // ISRC matching
    matchByMetadata: (tracks: Array<{ id: string; title: string; artist: string; album?: string; duration?: number; isrc?: string }>) =>
      ipcRenderer.invoke('sposify:match-by-metadata', tracks),
    enrichTrack: (localTrackId: string, spotifyId: string) =>
      ipcRenderer.invoke('sposify:enrich-track', localTrackId, spotifyId),

    // Playlist discovery
    searchPlaylists: (query: string, options?: { limit?: number; offset?: number; minFollowers?: number }) =>
      ipcRenderer.invoke('sposify:search-playlists', query, options),
    browsePlaylists: (options?: { limit?: number; offset?: number; minFollowers?: number }) =>
      ipcRenderer.invoke('sposify:browse-playlists', options),
    getPlaylist: (playlistId: string) => ipcRenderer.invoke('sposify:get-playlist', playlistId),
    getTopPlaylists: (limit?: number) => ipcRenderer.invoke('sposify:get-top-playlists', limit),
    getPlaylistsForTrack: (spotifyId: string, limit?: number) =>
      ipcRenderer.invoke('sposify:get-playlists-for-track', spotifyId, limit),

    // Track queries
    getTrack: (spotifyId: string) => ipcRenderer.invoke('sposify:get-track', spotifyId),
    getTrackByIsrc: (isrc: string) => ipcRenderer.invoke('sposify:get-track-by-isrc', isrc),
    searchTracks: (title: string, artist: string, limit?: number) =>
      ipcRenderer.invoke('sposify:search-tracks', title, artist, limit),

    // Configuration
    setConfig: (config: { minMatchConfidence?: number; enableFuzzyMatching?: boolean; maxCacheSize?: number }) =>
      ipcRenderer.invoke('sposify:set-config', config),
    clearCache: () => ipcRenderer.invoke('sposify:clear-cache'),

    // Events
    onImportProgress: (callback: (progress: { phase: string; progress: number; currentItem?: string }) => void) => {
      const listener = (_: unknown, progress: { phase: string; progress: number; currentItem?: string }) => callback(progress);
      ipcRenderer.on('sposify:import-progress', listener);
      return () => {
        ipcRenderer.removeListener('sposify:import-progress', listener);
      };
    },

    onSetupProgress: (callback: (progress: {
      phase: 'checking' | 'downloading' | 'extracting' | 'building' | 'verifying' | 'complete' | 'error';
      progress: number;
      message: string;
      bytesDownloaded?: number;
      totalBytes?: number;
      speed?: number;
    }) => void) => {
      const listener = (_: unknown, progress: {
        phase: 'checking' | 'downloading' | 'extracting' | 'building' | 'verifying' | 'complete' | 'error';
        progress: number;
        message: string;
        bytesDownloaded?: number;
        totalBytes?: number;
        speed?: number;
      }) => callback(progress);
      ipcRenderer.on('sposify:setup-progress', listener);
      return () => {
        ipcRenderer.removeListener('sposify:setup-progress', listener);
      };
    },
  },

  // ========================================
  // Plugin Repository APIs
  // ========================================

  repositories: {
    // Get all repositories
    list: () => {
      return ipcRenderer.invoke('get-repositories');
    },

    // Add a new repository
    add: (url: string) => {
      return ipcRenderer.invoke('add-repository', url);
    },

    // Remove a repository
    remove: (repoId: string) => {
      return ipcRenderer.invoke('remove-repository', repoId);
    },

    // Enable/disable a repository
    setEnabled: (repoId: string, enabled: boolean) => {
      return ipcRenderer.invoke('set-repository-enabled', { repoId, enabled });
    },

    // Refresh a single repository
    refresh: (repoId: string) => {
      return ipcRenderer.invoke('refresh-repository', repoId);
    },

    // Refresh all repositories
    refreshAll: () => {
      return ipcRenderer.invoke('refresh-all-repositories');
    },

    // Get all available plugins from repositories
    getAvailablePlugins: () => {
      return ipcRenderer.invoke('get-available-plugins');
    },

    // Search plugins across all repositories
    searchPlugins: (query: string) => {
      return ipcRenderer.invoke('search-plugins', query);
    },

    // Check for plugin updates
    checkUpdates: () => {
      return ipcRenderer.invoke('check-plugin-updates');
    },

    // Install a plugin from any source (npm, git, local path)
    installFromSource: (source: string) => {
      return ipcRenderer.invoke('install-plugin-from-source', source);
    },

    // Uninstall a plugin
    uninstallPlugin: (pluginId: string) => {
      return ipcRenderer.invoke('uninstall-plugin-by-id', pluginId);
    },

    // Update a plugin
    updatePlugin: (pluginId: string, source: string) => {
      return ipcRenderer.invoke('update-plugin', { pluginId, source });
    },

    // Listen for installation progress
    onInstallProgress: (callback: (progress: {
      phase: 'downloading' | 'extracting' | 'installing' | 'building' | 'complete' | 'error';
      progress: number;
      message: string;
      pluginId?: string;
    }) => void) => {
      const listener = (_: unknown, progress: {
        phase: 'downloading' | 'extracting' | 'installing' | 'building' | 'complete' | 'error';
        progress: number;
        message: string;
        pluginId?: string;
      }) => callback(progress);
      ipcRenderer.on('plugin-install-progress', listener);
      return () => {
        ipcRenderer.removeListener('plugin-install-progress', listener);
      };
    },

    // Listen for plugin changes (install/uninstall/update)
    onPluginsChanged: (callback: () => void) => {
      const listener = () => callback();
      ipcRenderer.on('plugins-changed', listener);
      return () => {
        ipcRenderer.removeListener('plugins-changed', listener);
      };
    },
  },

  // ========================================
  // Artist Enrichment APIs
  // ========================================

  enrichment: {
    // Get available enrichment types from installed plugins
    getAvailableTypes: () => {
      return ipcRenderer.invoke('get-available-enrichment-types');
    },

    // Get artist music videos
    getVideos: (artistName: string, limit?: number) => {
      return ipcRenderer.invoke('get-artist-videos', { artistName, limit });
    },

    // Get album music videos
    getAlbumVideos: (albumTitle: string, artistName: string, trackNames?: string[], limit?: number) => {
      return ipcRenderer.invoke('get-album-videos', { albumTitle, artistName, trackNames, limit });
    },

    // Get artist timeline/discography
    getTimeline: (artistName: string) => {
      return ipcRenderer.invoke('get-artist-timeline', { artistName });
    },

    // Get artist setlists
    getSetlists: (artistName: string, mbid?: string, limit?: number) => {
      return ipcRenderer.invoke('get-artist-setlists', { artistName, mbid, limit });
    },

    // Get upcoming concerts
    getConcerts: (artistName: string) => {
      return ipcRenderer.invoke('get-artist-concerts', { artistName });
    },

    // Get artist gallery/images
    getGallery: (mbid?: string, artistName?: string) => {
      return ipcRenderer.invoke('get-artist-gallery', { mbid, artistName });
    },

    // Get merchandise URL
    getMerchandise: (artistName: string) => {
      return ipcRenderer.invoke('get-artist-merchandise', { artistName });
    },
  },
};

// Expose the API to the renderer process
contextBridge.exposeInMainWorld('api', api);
