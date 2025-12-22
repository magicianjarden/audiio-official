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

  getArtistLatestRelease: (artistId: string, source?: string) => {
    return ipcRenderer.invoke('get-artist-latest-release', { artistId, source });
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

  enableMobileAccess: () => {
    return ipcRenderer.invoke('enable-mobile-access');
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
  // Library Bridge APIs (for mobile sync)
  // ========================================

  // Respond to library data request from main process
  onLibraryDataRequest: (callback: () => void) => {
    const listener = () => callback();
    ipcRenderer.on('library-request-data', listener);
    return () => {
      ipcRenderer.removeListener('library-request-data', listener);
    };
  },

  // Send library data to main process
  sendLibraryData: (data: { likedTracks: unknown[]; playlists: unknown[]; dislikedTrackIds: string[] }) => {
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
  }
};

// Expose the API to the renderer process
contextBridge.exposeInMainWorld('api', api);
