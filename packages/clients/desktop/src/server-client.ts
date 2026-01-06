/**
 * Server Client - HTTP client for Audiio Server
 *
 * Handles all communication between the client app and a remote Audiio server.
 * Implements the same interface that the UI expects from local orchestrators.
 */

import { EventEmitter } from '@audiio/core';
import nacl from 'tweetnacl';
import { encodeBase64, decodeUTF8 } from 'tweetnacl-util';

export interface ServerConfig {
  url: string;
  token?: string;
  deviceName?: string;
}

export interface DeviceIdentity {
  publicKey: string;
  secretKey: string;
  deviceId: string;
}

export interface ConnectionState {
  connected: boolean;
  serverUrl: string | null;
  serverName?: string;
  serverVersion?: string;
  error?: string;
}

type ServerClientEvents = {
  'connection-change': ConnectionState;
  'error': Error;
};

export class ServerClient extends EventEmitter<ServerClientEvents> {
  private serverUrl: string | null = null;
  private token: string | null = null;
  private deviceIdentity: DeviceIdentity | null = null;
  private sessionToken: string | null = null;
  private connectionState: ConnectionState = {
    connected: false,
    serverUrl: null
  };
  private deviceName: string = 'Audiio Desktop';

  /**
   * Set device identity (for persistence between sessions)
   */
  setDeviceIdentity(identity: DeviceIdentity): void {
    this.deviceIdentity = identity;
  }

  /**
   * Get or create device identity
   */
  getOrCreateDeviceIdentity(): DeviceIdentity {
    if (this.deviceIdentity) {
      return this.deviceIdentity;
    }

    // Generate new key pair
    const keyPair = nacl.box.keyPair();
    const publicKey = encodeBase64(keyPair.publicKey);
    const secretKey = encodeBase64(keyPair.secretKey);
    const deviceId = this.fingerprint(publicKey);

    this.deviceIdentity = { publicKey, secretKey, deviceId };
    return this.deviceIdentity;
  }

  /**
   * Set session token (for persistence)
   */
  setSessionToken(token: string | null): void {
    this.sessionToken = token;
  }

  /**
   * Get current session token
   */
  getSessionToken(): string | null {
    return this.sessionToken;
  }

  /**
   * Connect to an Audiio server
   */
  async connect(config: ServerConfig): Promise<boolean> {
    this.serverUrl = config.url.replace(/\/$/, ''); // Remove trailing slash
    this.token = config.token || null;
    if (config.deviceName) {
      this.deviceName = config.deviceName;
    }

    try {
      // Test connection with health check
      const health = await this.get('/health');
      if (!health || health.status !== 'ok') {
        throw new Error('Server health check failed');
      }

      // Get server info
      const info = await this.get('/api/info');

      // Try to use existing session token first
      if (this.sessionToken) {
        const valid = await this.validateSession();
        if (valid) {
          console.log('[ServerClient] Session token is valid');
        } else {
          console.log('[ServerClient] Session token expired, re-registering...');
          this.sessionToken = null;
          await this.registerDevice();
        }
      } else {
        // No session token - need to register
        await this.registerDevice();
      }

      this.connectionState = {
        connected: true,
        serverUrl: this.serverUrl,
        serverName: info?.name || 'Audiio Server',
        serverVersion: info?.version
      };

      this.emit('connection-change', this.connectionState);
      return true;
    } catch (error) {
      console.error('[ServerClient] Connection error:', error);
      this.connectionState = {
        connected: false,
        serverUrl: this.serverUrl,
        error: error instanceof Error ? error.message : 'Connection failed'
      };
      this.emit('connection-change', this.connectionState);
      return false;
    }
  }

  /**
   * Register this device with the server
   */
  private async registerDevice(): Promise<void> {
    const identity = this.getOrCreateDeviceIdentity();

    console.log('[ServerClient] Registering device:', identity.deviceId);

    // Get a pairing token from the server
    const pairingResponse = await this.post('/api/auth/pairing-token', {});
    if (!pairingResponse?.token) {
      throw new Error('Failed to get pairing token');
    }

    // Pair the device
    const pairResponse = await this.post('/api/auth/pair', {
      pairingToken: pairingResponse.token,
      deviceId: identity.deviceId,
      devicePublicKey: identity.publicKey,
      deviceName: this.deviceName,
      deviceType: 'desktop'
    });

    if (!pairResponse?.success) {
      throw new Error(pairResponse?.error || 'Device pairing failed');
    }

    this.sessionToken = pairResponse.sessionToken;
    console.log('[ServerClient] Device registered successfully');
  }

  /**
   * Validate current session token
   */
  private async validateSession(): Promise<boolean> {
    try {
      // Try to access a protected endpoint
      const response = await fetch(`${this.serverUrl}/api/library/likes`, {
        headers: this.getHeaders()
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Create fingerprint (device ID) from public key
   */
  private fingerprint(publicKey: string): string {
    const bytes = decodeUTF8(publicKey);
    const hash = nacl.hash(bytes);
    return encodeBase64(hash).substring(0, 8).toUpperCase();
  }

  /**
   * Disconnect from server
   */
  disconnect(): void {
    this.connectionState = {
      connected: false,
      serverUrl: null
    };
    this.emit('connection-change', this.connectionState);
  }

  /**
   * Get connection state
   */
  getConnectionState(): ConnectionState {
    return { ...this.connectionState };
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.connectionState.connected;
  }

  /**
   * Get the current server URL
   */
  getServerUrl(): string | null {
    return this.serverUrl;
  }

  // ========================================
  // HTTP API Methods
  // ========================================

  private async get(path: string): Promise<any> {
    if (!this.serverUrl) throw new Error('Not connected');

    const response = await fetch(`${this.serverUrl}${path}`, {
      headers: this.getHeaders()
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return response.json();
  }

  private async post(path: string, body?: any): Promise<any> {
    if (!this.serverUrl) throw new Error('Not connected');

    const response = await fetch(`${this.serverUrl}${path}`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: body ? JSON.stringify(body) : undefined
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return response.json();
  }

  private async delete(path: string): Promise<any> {
    if (!this.serverUrl) throw new Error('Not connected');

    // Don't send Content-Type for DELETE requests without body
    const headers: Record<string, string> = {};
    const authToken = this.sessionToken || this.token;
    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }
    if (this.deviceIdentity) {
      headers['X-Device-ID'] = this.deviceIdentity.deviceId;
    }

    const response = await fetch(`${this.serverUrl}${path}`, {
      method: 'DELETE',
      headers
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return response.json();
  }

  private async put(path: string, body?: any): Promise<any> {
    if (!this.serverUrl) throw new Error('Not connected');

    const response = await fetch(`${this.serverUrl}${path}`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: body ? JSON.stringify(body) : undefined
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return response.json();
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    // Use session token (from device registration) or legacy token
    const authToken = this.sessionToken || this.token;
    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }
    // Also send device ID for additional verification
    if (this.deviceIdentity) {
      headers['X-Device-ID'] = this.deviceIdentity.deviceId;
    }
    return headers;
  }

  // ========================================
  // Generic API Fetch (for stores that need direct server access)
  // ========================================

  /**
   * Generic API fetch method for direct server access
   * Used by stores like collection-store and tag-store
   */
  async apiFetch(path: string, options?: { method?: string; body?: unknown }): Promise<unknown> {
    const method = options?.method?.toUpperCase() || 'GET';

    switch (method) {
      case 'GET':
        return this.get(path);
      case 'POST':
        return this.post(path, options?.body);
      case 'PUT':
        return this.put(path, options?.body);
      case 'DELETE':
        return this.delete(path);
      default:
        throw new Error(`Unsupported HTTP method: ${method}`);
    }
  }

  // ========================================
  // Search API
  // ========================================

  async search(query: string, type?: string, limit: number = 20): Promise<any[]> {
    const params = new URLSearchParams();
    params.set('q', query);
    params.set('limit', String(limit));
    if (type) {
      params.set('type', type);
    }

    const result = await this.get(`/api/search?${params.toString()}`);

    // Return appropriate array based on type
    if (type === 'track') {
      return result?.tracks || [];
    } else if (type === 'artist') {
      return result?.artists || [];
    } else if (type === 'album') {
      return result?.albums || [];
    }

    // No type specified - return tracks for backwards compat
    return result?.tracks || [];
  }

  // ========================================
  // Stream API
  // ========================================

  async resolveStream(track: {
    id?: string;
    title?: string;
    artist?: string;
    artists?: Array<{ name: string }>;
    isrc?: string;
    _meta?: { externalIds?: { isrc?: string } };
  }): Promise<any> {
    const params = new URLSearchParams();
    if (track.id) params.set('trackId', track.id);
    if (track.title) params.set('title', track.title);

    // Handle both artist string and artists array
    const artistName = track.artist || track.artists?.[0]?.name;
    if (artistName) params.set('artist', artistName);

    // Handle ISRC from multiple locations
    const isrc = track.isrc || track._meta?.externalIds?.isrc;
    if (isrc) params.set('isrc', isrc);

    const result = await this.get(`/api/stream/resolve?${params.toString()}`);

    // If the URL is a relative proxy path, make it absolute
    if (result?.url?.startsWith('/api/stream/proxy')) {
      result.url = `${this.serverUrl}${result.url}`;
    }

    return result;
  }

  // ========================================
  // Metadata API
  // ========================================

  async getTrending(): Promise<any> {
    return this.get('/api/trending');
  }

  async getArtist(artistId: string): Promise<any> {
    return this.get(`/api/artist/${encodeURIComponent(artistId)}`);
  }

  async getAlbum(albumId: string): Promise<any> {
    return this.get(`/api/album/${encodeURIComponent(albumId)}`);
  }

  async getDiscover(limit: number = 10): Promise<any> {
    return this.get(`/api/discover?limit=${limit}`);
  }

  // ========================================
  // Library API
  // ========================================

  async getLikedTracks(): Promise<any> {
    return this.get('/api/library/likes');
  }

  async likeTrack(track: any): Promise<any> {
    return this.post('/api/library/likes', { track });
  }

  async unlikeTrack(trackId: string): Promise<any> {
    return this.delete(`/api/library/likes/${encodeURIComponent(trackId)}`);
  }

  async isTrackLiked(trackId: string): Promise<boolean> {
    const result = await this.get(`/api/library/likes/${encodeURIComponent(trackId)}`);
    return result?.liked || false;
  }

  async getDislikedTracks(): Promise<any> {
    return this.get('/api/library/dislikes');
  }

  async dislikeTrack(track: any, reasons?: string[]): Promise<any> {
    return this.post('/api/library/dislikes', { track, reasons });
  }

  async removeDislike(trackId: string): Promise<any> {
    return this.delete(`/api/library/dislikes/${encodeURIComponent(trackId)}`);
  }

  // ========================================
  // Playlist API
  // ========================================

  async getPlaylists(): Promise<any> {
    return this.get('/api/library/playlists');
  }

  async getPlaylist(playlistId: string): Promise<any> {
    return this.get(`/api/library/playlists/${encodeURIComponent(playlistId)}`);
  }

  async createPlaylist(name: string, description?: string, options?: {
    folderId?: string;
    rules?: Array<{ field: string; operator: string; value: unknown }>;
    combinator?: 'and' | 'or';
    orderBy?: string;
    orderDirection?: 'asc' | 'desc';
    limit?: number;
  }): Promise<any> {
    return this.post('/api/library/playlists', { name, description, ...options });
  }

  async updatePlaylist(playlistId: string, data: Record<string, unknown>): Promise<any> {
    return this.put(`/api/library/playlists/${encodeURIComponent(playlistId)}`, data);
  }

  async deletePlaylist(playlistId: string): Promise<any> {
    return this.delete(`/api/library/playlists/${encodeURIComponent(playlistId)}`);
  }

  async renamePlaylist(playlistId: string, name: string): Promise<any> {
    return this.put(`/api/library/playlists/${encodeURIComponent(playlistId)}`, { name });
  }

  async addToPlaylist(playlistId: string, track: any): Promise<any> {
    return this.post(`/api/library/playlists/${encodeURIComponent(playlistId)}/tracks`, { track });
  }

  async removeFromPlaylist(playlistId: string, trackId: string): Promise<any> {
    return this.delete(`/api/library/playlists/${encodeURIComponent(playlistId)}/tracks/${encodeURIComponent(trackId)}`);
  }

  // Playlist Rules (for smart/hybrid playlists)
  async getPlaylistRules(): Promise<any> {
    return this.get('/api/library/playlists/rules');
  }

  async evaluatePlaylistRules(playlistId: string): Promise<any> {
    return this.get(`/api/library/playlists/${encodeURIComponent(playlistId)}/evaluate`);
  }

  async previewPlaylistRules(options: {
    rules: Array<{ field: string; operator: string; value: unknown }>;
    combinator?: 'and' | 'or';
    orderBy?: string;
    orderDirection?: 'asc' | 'desc';
    limit?: number;
  }): Promise<any> {
    return this.post('/api/library/playlists/preview', options);
  }

  // ========================================
  // History API
  // ========================================

  async recordPlay(track: any, duration?: number): Promise<any> {
    return this.post('/api/library/history', { track, duration });
  }

  // ========================================
  // Addons API
  // ========================================

  async getAddons(): Promise<any> {
    return this.get('/api/addons');
  }

  async getAddonSettings(addonId: string): Promise<any> {
    return this.get(`/api/addons/${addonId}/settings`);
  }

  async updateAddonSettings(addonId: string, settings: Record<string, unknown>): Promise<any> {
    return this.post(`/api/addons/${addonId}/settings`, { settings });
  }

  async scrobbleSubmit(pluginId: string, data: {
    title: string;
    artist: string;
    album?: string;
    duration: number;
    timestamp: number;
    playedMs: number;
  }): Promise<any> {
    return this.post(`/api/scrobble/${pluginId}/submit`, {
      track: {
        title: data.title,
        artist: data.artist,
        album: data.album,
        duration: data.duration
      },
      playedDuration: data.playedMs / 1000, // Convert to seconds
      timestamp: data.timestamp
    });
  }

  async scrobbleNowPlaying(pluginId: string, data: {
    title: string;
    artist: string;
    album?: string;
    duration: number;
  }): Promise<any> {
    return this.post(`/api/scrobble/${pluginId}/now-playing`, {
      track: {
        title: data.title,
        artist: data.artist,
        album: data.album,
        duration: data.duration
      }
    });
  }

  // ========================================
  // Server Info
  // ========================================

  async getServerInfo(): Promise<any> {
    return this.get('/api/info');
  }

  // ========================================
  // Tracking API (send events to server)
  // ========================================

  async trackEvent(event: {
    type: string;
    trackId?: string;
    trackData?: any;
    position?: number;
    duration?: number;
    percentage?: number;
    source?: string;
    metadata?: any;
  }): Promise<any> {
    return this.post('/api/tracking/event', event);
  }

  async trackBatch(events: any[]): Promise<any> {
    return this.post('/api/tracking/batch', { events });
  }

  // ========================================
  // Stats API (get stats from server)
  // ========================================

  async getStatsOverview(): Promise<any> {
    return this.get('/api/stats/overview');
  }

  async getListeningStats(period?: string): Promise<any> {
    const params = period ? `?period=${period}` : '';
    return this.get(`/api/stats/listening${params}`);
  }

  async getTopArtists(limit?: number): Promise<any> {
    const params = limit ? `?limit=${limit}` : '';
    return this.get(`/api/stats/top/artists${params}`);
  }

  async getTopTracks(limit?: number): Promise<any> {
    const params = limit ? `?limit=${limit}` : '';
    return this.get(`/api/stats/top/tracks${params}`);
  }

  async getTopGenres(limit?: number): Promise<any> {
    const params = limit ? `?limit=${limit}` : '';
    return this.get(`/api/stats/top/genres${params}`);
  }

  async getListeningPatterns(): Promise<any> {
    return this.get('/api/stats/patterns');
  }

  async getStreaks(): Promise<any> {
    return this.get('/api/stats/streaks');
  }

  async getStats(period: string): Promise<any> {
    return this.get(`/api/stats/${encodeURIComponent(period)}`);
  }

  async clearStats(): Promise<void> {
    return this.delete('/api/stats');
  }

  async getListenHistory(limit: number = 50): Promise<{ entries: any[] }> {
    return this.get(`/api/stats/history?limit=${limit}`);
  }

  // ========================================
  // ML/Algorithm API (get recommendations from server)
  // ========================================

  async algoScoreTrack(trackId: string): Promise<any> {
    return this.get(`/api/algo/score/${encodeURIComponent(trackId)}`);
  }

  async algoScoreBatch(trackIds: string[]): Promise<any> {
    return this.post('/api/algo/score/batch', { trackIds });
  }

  async algoGetRecommendations(count: number = 20, mode?: string): Promise<any> {
    const params = new URLSearchParams();
    params.set('count', String(count));
    if (mode) params.set('mode', mode);
    return this.get(`/api/algo/recommendations?${params.toString()}`);
  }

  async algoGetSimilar(trackId: string, count: number = 10): Promise<any> {
    return this.get(`/api/algo/similar/${encodeURIComponent(trackId)}?count=${count}`);
  }

  async algoGetRadio(seedTrackId: string, count: number = 50): Promise<any> {
    return this.get(`/api/algo/radio/${encodeURIComponent(seedTrackId)}?count=${count}`);
  }

  async algoGetArtistRadio(artistId: string, count: number = 50): Promise<any> {
    return this.get(`/api/algo/radio/artist/${encodeURIComponent(artistId)}?count=${count}`);
  }

  async algoGetGenreRadio(genre: string, count: number = 50): Promise<any> {
    return this.get(`/api/algo/radio/genre/${encodeURIComponent(genre)}?count=${count}`);
  }

  async algoGetFeatures(trackId: string): Promise<any> {
    return this.get(`/api/algo/features/${encodeURIComponent(trackId)}`);
  }

  async algoTrain(trigger?: string): Promise<any> {
    return this.post('/api/algo/train', { trigger: trigger || 'manual' });
  }

  async algoGetTrainingStatus(): Promise<any> {
    return this.get('/api/algo/training/status');
  }

  async algoGetProfile(): Promise<any> {
    return this.get('/api/algo/profile');
  }

  async algoGetPreferences(): Promise<any> {
    return this.get('/api/algo/preferences');
  }

  async algoUpdatePreferences(preferences: any): Promise<any> {
    return this.post('/api/algo/preferences', preferences);
  }

  async algoGetNextQueue(count: number = 10): Promise<any> {
    return this.get(`/api/algo/queue/next?count=${count}`);
  }

  // ========================================
  // Lyrics API
  // ========================================

  async getLyrics(params: { title: string; artist: string; album?: string; duration?: number }): Promise<any> {
    const query = new URLSearchParams();
    query.set('title', params.title);
    query.set('artist', params.artist);
    if (params.album) query.set('album', params.album);
    if (params.duration) query.set('duration', String(params.duration));
    return this.get(`/api/lyrics?${query.toString()}`);
  }

  // ========================================
  // Artist Enrichment API
  // ========================================

  async getAvailableEnrichmentTypes(): Promise<string[]> {
    const result = await this.get('/api/enrichment/types');
    return result?.types || [];
  }

  async getArtistVideos(artistName: string, limit?: number): Promise<any> {
    const params = limit ? `?limit=${limit}` : '';
    return this.get(`/api/enrichment/videos/${encodeURIComponent(artistName)}${params}`);
  }

  async getAlbumVideos(albumTitle: string, artistName: string, trackNames?: string[], limit?: number): Promise<any> {
    const params = new URLSearchParams();
    if (limit) params.set('limit', String(limit));
    if (trackNames?.length) params.set('trackNames', trackNames.join(','));
    return this.get(`/api/enrichment/album-videos/${encodeURIComponent(artistName)}/${encodeURIComponent(albumTitle)}?${params.toString()}`);
  }

  async getVideoStream(videoId: string, source: string, preferredQuality?: string): Promise<any> {
    const params = new URLSearchParams();
    params.set('source', source);
    if (preferredQuality) params.set('quality', preferredQuality);
    return this.get(`/api/enrichment/video-stream/${encodeURIComponent(videoId)}?${params.toString()}`);
  }

  async getArtistTimeline(artistName: string): Promise<any> {
    return this.get(`/api/enrichment/timeline/${encodeURIComponent(artistName)}`);
  }

  async getArtistSetlists(artistName: string, mbid?: string, limit?: number): Promise<any> {
    const params = new URLSearchParams();
    if (mbid) params.set('mbid', mbid);
    if (limit) params.set('limit', String(limit));
    return this.get(`/api/enrichment/setlists/${encodeURIComponent(artistName)}?${params.toString()}`);
  }

  async getArtistConcerts(artistName: string): Promise<any> {
    return this.get(`/api/enrichment/concerts/${encodeURIComponent(artistName)}`);
  }

  async getArtistGallery(artistName: string, mbid?: string): Promise<any> {
    const params = mbid ? `?mbid=${encodeURIComponent(mbid)}` : '';
    return this.get(`/api/enrichment/gallery/${encodeURIComponent(artistName)}${params}`);
  }

  async getArtistMerchandise(artistName: string): Promise<any> {
    return this.get(`/api/enrichment/merchandise/${encodeURIComponent(artistName)}`);
  }

  // ========================================
  // Media Folders API
  // ========================================

  async getMediaFolders(type?: 'audio' | 'video' | 'downloads'): Promise<any> {
    const params = type ? `?type=${type}` : '';
    return this.get(`/api/media/folders${params}`);
  }

  async getMediaFolder(folderId: string): Promise<any> {
    return this.get(`/api/media/folders/${folderId}`);
  }

  async addMediaFolder(path: string, type: 'audio' | 'video' | 'downloads', options?: {
    name?: string;
    watchEnabled?: boolean;
    scanInterval?: number | null;
  }): Promise<any> {
    return this.post('/api/media/folders', { path, type, ...options });
  }

  async updateMediaFolder(folderId: string, updates: {
    name?: string;
    watchEnabled?: boolean;
    scanInterval?: number | null;
  }): Promise<any> {
    return this.patch(`/api/media/folders/${folderId}`, updates);
  }

  async removeMediaFolder(folderId: string): Promise<any> {
    return this.delete(`/api/media/folders/${folderId}`);
  }

  async browseFilesystem(path?: string): Promise<any> {
    const params = path ? `?path=${encodeURIComponent(path)}` : '';
    return this.get(`/api/media/folders/browse${params}`);
  }

  async getFilesystemRoots(): Promise<any> {
    return this.get('/api/media/folders/roots');
  }

  async getFolderTracks(folderId: string, options?: {
    limit?: number;
    offset?: number;
    isVideo?: boolean;
  }): Promise<any> {
    const params = new URLSearchParams();
    if (options?.limit) params.set('limit', String(options.limit));
    if (options?.offset) params.set('offset', String(options.offset));
    if (options?.isVideo !== undefined) params.set('isVideo', String(options.isVideo));
    const query = params.toString() ? `?${params.toString()}` : '';
    return this.get(`/api/media/folders/${folderId}/tracks${query}`);
  }

  // ========================================
  // Scanning API
  // ========================================

  async scanFolder(folderId: string, options?: {
    forceRescan?: boolean;
    includeVideos?: boolean;
  }): Promise<any> {
    return this.post(`/api/media/folders/${folderId}/scan`, options || {});
  }

  async getScanStatus(): Promise<any> {
    return this.get('/api/media/scan/status');
  }

  async abortScan(): Promise<any> {
    return this.post('/api/media/scan/abort', {});
  }

  async getLocalTrackArtwork(trackId: string): Promise<string | null> {
    // Returns artwork URL - the actual artwork is served via /api/media/tracks/:trackId/artwork
    if (!this.serverUrl) return null;
    return `${this.serverUrl}/api/media/tracks/${encodeURIComponent(trackId)}/artwork`;
  }

  // ========================================
  // Download API
  // ========================================

  async startDownload(options: {
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
  }): Promise<any> {
    return this.post('/api/media/download', options);
  }

  async getActiveDownloads(): Promise<any> {
    return this.get('/api/media/downloads');
  }

  async getDownloadHistory(status?: string): Promise<any> {
    const params = status ? `?status=${status}` : '';
    return this.get(`/api/media/downloads/history${params}`);
  }

  async cancelDownload(downloadId: string): Promise<any> {
    return this.delete(`/api/media/downloads/${downloadId}`);
  }

  async getLastPlaybackState(): Promise<any> {
    return this.get('/api/player/last-played');
  }

  // ========================================
  // Tags API
  // ========================================

  async getTags(): Promise<any> {
    return this.get('/api/tags');
  }

  async createTag(name: string, color?: string): Promise<any> {
    return this.post('/api/tags', { name, color });
  }

  async updateTag(tagId: string, data: { name?: string; color?: string }): Promise<any> {
    return this.put(`/api/tags/${encodeURIComponent(tagId)}`, data);
  }

  async deleteTag(tagId: string): Promise<any> {
    return this.delete(`/api/tags/${encodeURIComponent(tagId)}`);
  }

  async getTrackTags(trackId: string): Promise<any> {
    return this.get(`/api/tracks/${encodeURIComponent(trackId)}/tags`);
  }

  async addTagsToTrack(trackId: string, tags: string[]): Promise<any> {
    return this.post(`/api/tracks/${encodeURIComponent(trackId)}/tags`, { tags });
  }

  async removeTagFromTrack(trackId: string, tagName: string): Promise<any> {
    return this.delete(`/api/tracks/${encodeURIComponent(trackId)}/tags/${encodeURIComponent(tagName)}`);
  }

  async getTracksByTag(tagName: string): Promise<any> {
    return this.get(`/api/tracks/by-tag/${encodeURIComponent(tagName)}`);
  }

  async getEntityTags(entityType: string, entityId: string): Promise<any> {
    return this.get(`/api/entities/${encodeURIComponent(entityType)}/${encodeURIComponent(entityId)}/tags`);
  }

  async addTagsToEntity(entityType: string, entityId: string, tags: string[]): Promise<any> {
    return this.post(`/api/entities/${encodeURIComponent(entityType)}/${encodeURIComponent(entityId)}/tags`, { tags });
  }

  async removeTagFromEntity(entityType: string, entityId: string, tagName: string): Promise<any> {
    return this.delete(`/api/entities/${encodeURIComponent(entityType)}/${encodeURIComponent(entityId)}/tags/${encodeURIComponent(tagName)}`);
  }

  // ========================================
  // Collections API
  // ========================================

  async getCollections(): Promise<any> {
    return this.get('/api/collections');
  }

  async getCollection(collectionId: string): Promise<any> {
    return this.get(`/api/collections/${encodeURIComponent(collectionId)}`);
  }

  async createCollection(data: {
    name: string;
    description?: string;
    color?: string;
    icon?: string;
  }): Promise<any> {
    return this.post('/api/collections', data);
  }

  async updateCollection(collectionId: string, data: {
    name?: string;
    description?: string;
    color?: string;
    icon?: string;
  }): Promise<any> {
    return this.put(`/api/collections/${encodeURIComponent(collectionId)}`, data);
  }

  async deleteCollection(collectionId: string): Promise<any> {
    return this.delete(`/api/collections/${encodeURIComponent(collectionId)}`);
  }

  async addToCollection(collectionId: string, item: {
    type: 'track' | 'album' | 'artist' | 'playlist';
    id: string;
    data?: unknown;
  }): Promise<any> {
    return this.post(`/api/collections/${encodeURIComponent(collectionId)}/items`, item);
  }

  async removeFromCollection(collectionId: string, itemId: string): Promise<any> {
    return this.delete(`/api/collections/${encodeURIComponent(collectionId)}/items/${encodeURIComponent(itemId)}`);
  }

  async reorderCollectionItems(collectionId: string, itemIds: string[]): Promise<any> {
    return this.put(`/api/collections/${encodeURIComponent(collectionId)}/reorder`, { itemIds });
  }

  async moveCollectionItem(collectionId: string, itemId: string, targetFolderId?: string): Promise<any> {
    return this.put(`/api/collections/${encodeURIComponent(collectionId)}/items/${encodeURIComponent(itemId)}/move`, { folderId: targetFolderId });
  }

  async reorderCollections(collectionIds: string[]): Promise<any> {
    return this.put('/api/collections/reorder', { collectionIds });
  }

  async createCollectionFolder(collectionId: string, data: { name: string; parentId?: string }): Promise<any> {
    return this.post(`/api/collections/${encodeURIComponent(collectionId)}/folders`, data);
  }

  async updateCollectionFolder(collectionId: string, folderId: string, data: { name?: string }): Promise<any> {
    return this.put(`/api/collections/${encodeURIComponent(collectionId)}/folders/${encodeURIComponent(folderId)}`, data);
  }

  async deleteCollectionFolder(collectionId: string, folderId: string): Promise<any> {
    return this.delete(`/api/collections/${encodeURIComponent(collectionId)}/folders/${encodeURIComponent(folderId)}`);
  }

  // ========================================
  // Audio Features API
  // ========================================

  async getAudioFeatures(trackId: string): Promise<any> {
    return this.get(`/api/audio-features/${encodeURIComponent(trackId)}`);
  }

  async queryAudioFeatures(query: {
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
  }): Promise<any> {
    const params = new URLSearchParams();
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        if (Array.isArray(value)) {
          params.set(key, value.join(','));
        } else {
          params.set(key, String(value));
        }
      }
    });
    return this.get(`/api/audio-features/query?${params.toString()}`);
  }

  async getSimilarByAudioFeatures(trackId: string, count: number = 10): Promise<any> {
    return this.get(`/api/audio-features/similar/${encodeURIComponent(trackId)}?count=${count}`);
  }

  async getAudioFeatureDistributions(): Promise<any> {
    return this.get('/api/audio-features/distributions');
  }

  async getMoodTypes(): Promise<any> {
    return this.get('/api/audio-features/moods');
  }

  async getMoodClusters(mood?: string): Promise<any> {
    const params = mood ? `?mood=${encodeURIComponent(mood)}` : '';
    return this.get(`/api/audio-features/moods/clusters${params}`);
  }

  async getTrackMood(trackId: string): Promise<any> {
    return this.get(`/api/audio-features/mood/${encodeURIComponent(trackId)}`);
  }

  async getAudioFeatureStats(): Promise<any> {
    return this.get('/api/audio-features/stats');
  }

  async saveAudioFeatures(trackId: string, features: any): Promise<any> {
    return this.post('/api/library/audio-features', { trackId, features });
  }

  async searchByAudioFeatures(criteria: any): Promise<any> {
    return this.post('/api/library/audio-features/search', criteria);
  }

  // ========================================
  // NLP Search API
  // ========================================

  async naturalLanguageSearch(query: string): Promise<any> {
    return this.post('/api/search/natural', { query });
  }

  async advancedSearch(params: {
    query?: string;
    artist?: string;
    album?: string;
    genre?: string;
    mood?: string;
    tempo?: string;
    decade?: string;
    tags?: string[];
    limit?: number;
  }): Promise<any> {
    const queryParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        if (Array.isArray(value)) {
          queryParams.set(key, value.join(','));
        } else {
          queryParams.set(key, String(value));
        }
      }
    });
    return this.get(`/api/search/advanced?${queryParams.toString()}`);
  }

  async getSearchSuggestions(prefix: string): Promise<any> {
    return this.get(`/api/search/suggestions?q=${encodeURIComponent(prefix)}`);
  }

  async getSearchHistory(): Promise<any> {
    return this.get('/api/search/history');
  }

  async deleteSearchHistoryItem(id: string): Promise<any> {
    return this.delete(`/api/search/history/${encodeURIComponent(id)}`);
  }

  async clearSearchHistory(): Promise<any> {
    return this.delete('/api/search/history');
  }

  // ========================================
  // Embedding API
  // ========================================

  async getTrackEmbedding(trackId: string): Promise<any> {
    return this.get(`/api/algo/embedding/${encodeURIComponent(trackId)}`);
  }

  async findSimilarByEmbedding(embedding: number[], count: number = 10): Promise<any> {
    return this.post('/api/algo/embedding/similar', { embedding, count });
  }

  // ========================================
  // Mood Radio API
  // ========================================

  async getMoodRadio(mood: string, count: number = 50): Promise<any> {
    return this.get(`/api/algo/radio/mood/${encodeURIComponent(mood)}?count=${count}`);
  }

  // ========================================
  // ML Status & Training API
  // ========================================

  async getMLStatus(): Promise<any> {
    return this.get('/api/algo/status');
  }

  async getTrainingHistory(): Promise<any> {
    return this.get('/api/algo/training/history');
  }

  async recordMLEvent(event: any): Promise<any> {
    return this.post('/api/algo/event', event);
  }

  // ========================================
  // Pinned Items API
  // ========================================

  async getPinnedItems(): Promise<any> {
    return this.get('/api/pinned');
  }

  async pinItem(itemType: string, itemId: string, data?: any): Promise<any> {
    return this.post('/api/pinned', { itemType, itemId, data });
  }

  async unpinItem(itemType: string, itemId: string): Promise<any> {
    return this.delete(`/api/pinned/${encodeURIComponent(itemType)}/${encodeURIComponent(itemId)}`);
  }

  async isPinned(itemType: string, itemId: string): Promise<boolean> {
    const result = await this.get(`/api/pinned/${encodeURIComponent(itemType)}/${encodeURIComponent(itemId)}`);
    return result?.pinned || false;
  }

  async reorderPinnedItems(items: Array<{ itemType: string; itemId: string }>): Promise<any> {
    return this.put('/api/pinned/reorder', { items });
  }

  // ========================================
  // Library Views API
  // ========================================

  async getLibraryViews(): Promise<any> {
    return this.get('/api/library/views');
  }

  async getLibraryView(viewId: string): Promise<any> {
    return this.get(`/api/library/views/${encodeURIComponent(viewId)}`);
  }

  async createLibraryView(data: {
    name: string;
    type: string;
    filters?: any;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }): Promise<any> {
    return this.post('/api/library/views', data);
  }

  async updateLibraryView(viewId: string, data: {
    name?: string;
    filters?: any;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }): Promise<any> {
    return this.put(`/api/library/views/${encodeURIComponent(viewId)}`, data);
  }

  async deleteLibraryView(viewId: string): Promise<any> {
    return this.delete(`/api/library/views/${encodeURIComponent(viewId)}`);
  }

  // ========================================
  // Library Folders API (for playlists organization)
  // ========================================

  async getLibraryFolders(): Promise<any> {
    return this.get('/api/library/folders');
  }

  async getLibraryFolder(folderId: string): Promise<any> {
    return this.get(`/api/library/folders/${encodeURIComponent(folderId)}`);
  }

  async createLibraryFolder(data: { name: string; parentId?: string }): Promise<any> {
    return this.post('/api/library/folders', data);
  }

  async updateLibraryFolder(folderId: string, data: { name?: string }): Promise<any> {
    return this.put(`/api/library/folders/${encodeURIComponent(folderId)}`, data);
  }

  async deleteLibraryFolder(folderId: string): Promise<any> {
    return this.delete(`/api/library/folders/${encodeURIComponent(folderId)}`);
  }

  async movePlaylistToFolder(playlistId: string, folderId: string | null): Promise<any> {
    return this.post(`/api/library/playlists/${encodeURIComponent(playlistId)}/move`, { folderId });
  }

  // ========================================
  // Smart Playlists API
  // ========================================

  async getSmartPlaylists(): Promise<any> {
    return this.get('/api/library/smart-playlists');
  }

  async getSmartPlaylist(playlistId: string): Promise<any> {
    return this.get(`/api/library/smart-playlists/${encodeURIComponent(playlistId)}`);
  }

  async createSmartPlaylist(data: {
    name: string;
    description?: string;
    rules: Array<{ field: string; operator: string; value: unknown }>;
    combinator?: 'and' | 'or';
    orderBy?: string;
    orderDirection?: 'asc' | 'desc';
    limit?: number;
  }): Promise<any> {
    return this.post('/api/library/smart-playlists', data);
  }

  async updateSmartPlaylist(playlistId: string, data: any): Promise<any> {
    return this.put(`/api/library/smart-playlists/${encodeURIComponent(playlistId)}`, data);
  }

  async deleteSmartPlaylist(playlistId: string): Promise<any> {
    return this.delete(`/api/library/smart-playlists/${encodeURIComponent(playlistId)}`);
  }

  async getSmartPlaylistTracks(playlistId: string): Promise<any> {
    return this.get(`/api/library/smart-playlists/${encodeURIComponent(playlistId)}/tracks`);
  }

  async previewSmartPlaylistRules(options: {
    rules: Array<{ field: string; operator: string; value: unknown }>;
    combinator?: 'and' | 'or';
    orderBy?: string;
    orderDirection?: 'asc' | 'desc';
    limit?: number;
  }): Promise<any> {
    return this.post('/api/library/smart-playlists/preview', options);
  }

  async getSmartPlaylistRules(): Promise<any> {
    return this.get('/api/library/smart-playlists/rules');
  }

  async moveSmartPlaylistToFolder(playlistId: string, folderId: string | null): Promise<any> {
    return this.post(`/api/library/smart-playlists/${encodeURIComponent(playlistId)}/move`, { folderId });
  }

  // ========================================
  // Library Stats API
  // ========================================

  async getLibraryStats(): Promise<any> {
    return this.get('/api/library/stats');
  }

  async getTrackStats(trackId: string): Promise<any> {
    return this.get(`/api/library/stats/track/${encodeURIComponent(trackId)}`);
  }

  async getMostPlayedTracks(limit: number = 50): Promise<any> {
    return this.get(`/api/library/stats/most-played?limit=${limit}`);
  }

  // ========================================
  // Enrichment & Fingerprint API
  // ========================================

  async getTrackEnrichment(trackId: string): Promise<any> {
    return this.get(`/api/library/enrichment/${encodeURIComponent(trackId)}`);
  }

  async saveTrackEnrichment(trackId: string, enrichment: any): Promise<any> {
    return this.post(`/api/library/enrichment/${encodeURIComponent(trackId)}`, enrichment);
  }

  async deleteTrackEnrichment(trackId: string): Promise<any> {
    return this.delete(`/api/library/enrichment/${encodeURIComponent(trackId)}`);
  }

  async getTrackFingerprint(trackId: string): Promise<any> {
    return this.get(`/api/library/fingerprint/${encodeURIComponent(trackId)}`);
  }

  async saveTrackFingerprint(trackId: string, fingerprint: any): Promise<any> {
    return this.post(`/api/library/fingerprint/${encodeURIComponent(trackId)}`, fingerprint);
  }

  async deleteTrackFingerprint(trackId: string): Promise<any> {
    return this.delete(`/api/library/fingerprint/${encodeURIComponent(trackId)}`);
  }

  // ========================================
  // Tracking Sessions API
  // ========================================

  async startTrackingSession(data?: { context?: string }): Promise<any> {
    return this.post('/api/tracking/session', data || {});
  }

  async endTrackingSession(sessionId: string): Promise<any> {
    return this.post(`/api/tracking/session/${encodeURIComponent(sessionId)}/end`, {});
  }

  async getTrackingSession(sessionId: string): Promise<any> {
    return this.get(`/api/tracking/session/${encodeURIComponent(sessionId)}`);
  }

  async getTrackingSessions(limit?: number): Promise<any> {
    const params = limit ? `?limit=${limit}` : '';
    return this.get(`/api/tracking/sessions${params}`);
  }

  async getTrackingEvents(options?: {
    type?: string;
    trackId?: string;
    sessionId?: string;
    limit?: number;
    offset?: number;
  }): Promise<any> {
    const params = new URLSearchParams();
    if (options) {
      Object.entries(options).forEach(([key, value]) => {
        if (value !== undefined) params.set(key, String(value));
      });
    }
    const query = params.toString() ? `?${params.toString()}` : '';
    return this.get(`/api/tracking/events${query}`);
  }

  // ========================================
  // Discover API (extended)
  // ========================================

  async getDiscoverGenres(): Promise<any> {
    return this.get('/api/discover/genres');
  }

  async getDiscoverGenre(genreId: string): Promise<any> {
    return this.get(`/api/discover/genre/${encodeURIComponent(genreId)}`);
  }

  async getDiscoverRadio(trackId: string): Promise<any> {
    return this.get(`/api/discover/radio/${encodeURIComponent(trackId)}`);
  }

  async getDiscoverSections(): Promise<any> {
    return this.get('/api/discover/sections');
  }

  async getDiscoverLayout(): Promise<any> {
    return this.get('/api/discover/layout');
  }

  // ========================================
  // Plugin Management API
  // ========================================

  async getPluginRepositories(): Promise<any> {
    return this.get('/api/plugins/repositories');
  }

  async addPluginRepository(url: string): Promise<any> {
    return this.post('/api/plugins/repositories', { url });
  }

  async removePluginRepository(repoId: string): Promise<any> {
    return this.delete(`/api/plugins/repositories/${encodeURIComponent(repoId)}`);
  }

  async refreshPluginRepository(repoId: string): Promise<any> {
    return this.post(`/api/plugins/repositories/${encodeURIComponent(repoId)}/refresh`, {});
  }

  async getAvailablePlugins(): Promise<any> {
    return this.get('/api/plugins/available');
  }

  async searchPlugins(query: string): Promise<any> {
    return this.get(`/api/plugins/search?q=${encodeURIComponent(query)}`);
  }

  async installPlugin(source: string, type: 'npm' | 'git' | 'local' = 'npm'): Promise<any> {
    return this.post('/api/plugins/install', { source, type });
  }

  async uninstallPlugin(pluginId: string): Promise<any> {
    return this.post(`/api/plugins/${encodeURIComponent(pluginId)}/uninstall`, {});
  }

  async getPluginUpdates(): Promise<any> {
    return this.get('/api/plugins/updates');
  }

  async getPluginRoutes(): Promise<any> {
    return this.get('/api/plugins/routes');
  }

  async getPluginSpecificRoutes(pluginId: string): Promise<any> {
    return this.get(`/api/plugins/${encodeURIComponent(pluginId)}/routes`);
  }

  async setAddonEnabled(addonId: string, enabled: boolean): Promise<any> {
    return this.post(`/api/addons/${encodeURIComponent(addonId)}/enabled`, { enabled });
  }

  // ========================================
  // Settings API
  // ========================================

  async getServerSettings(): Promise<any> {
    return this.get('/api/settings/server');
  }

  async updateServerSettings(settings: any): Promise<any> {
    return this.post('/api/settings/server', settings);
  }

  // ========================================
  // Logs API
  // ========================================

  async getLogs(options?: { level?: string; limit?: number; since?: string }): Promise<any> {
    const params = new URLSearchParams();
    if (options) {
      Object.entries(options).forEach(([key, value]) => {
        if (value !== undefined) params.set(key, String(value));
      });
    }
    const query = params.toString() ? `?${params.toString()}` : '';
    return this.get(`/api/logs${query}`);
  }

  async clearLogs(): Promise<any> {
    return this.post('/api/logs/clear', {});
  }

  // ========================================
  // Stats API (extended)
  // ========================================

  async getTopAlbums(limit?: number): Promise<any> {
    const params = limit ? `?limit=${limit}` : '';
    return this.get(`/api/stats/top/albums${params}`);
  }

  async refreshStats(): Promise<any> {
    return this.post('/api/stats/refresh', {});
  }

  // ========================================
  // Library Capabilities API
  // ========================================

  async getLibraryCapabilities(): Promise<any> {
    return this.get('/api/library/capabilities');
  }

  async getImportProviders(): Promise<any> {
    return this.get('/api/library/import/providers');
  }

  async getExportFormats(): Promise<any> {
    return this.get('/api/library/export/formats');
  }

  // ========================================
  // Skip Recording API
  // ========================================

  async recordSkip(track: any, position: number, duration: number): Promise<any> {
    return this.post('/api/library/skip', { track, position, duration });
  }

  // ========================================
  // Signal Path API (debugging)
  // ========================================

  async getSignalPathTraces(limit?: number): Promise<any> {
    const params = limit ? `?limit=${limit}` : '';
    return this.get(`/api/signal-path/traces${params}`);
  }

  async getSignalPathTrace(traceId: string): Promise<any> {
    return this.get(`/api/signal-path/trace/${encodeURIComponent(traceId)}`);
  }

  async getSignalPathStats(): Promise<any> {
    return this.get('/api/signal-path/stats');
  }

  async clearSignalPathTraces(): Promise<any> {
    return this.post('/api/signal-path/clear', {});
  }

  // ========================================
  // Media Watcher API
  // ========================================

  async getMediaWatcherStatus(): Promise<any> {
    return this.get('/api/media/watcher/status');
  }

  // ========================================
  // Auth/Device API (extended)
  // ========================================

  async getAuthIdentity(): Promise<any> {
    return this.get('/api/auth/identity');
  }

  async getDevices(): Promise<any> {
    return this.get('/api/auth/devices');
  }

  async removeDevice(deviceId: string): Promise<any> {
    return this.delete(`/api/auth/devices/${encodeURIComponent(deviceId)}`);
  }

  async updateDevice(deviceId: string, data: { name?: string; trusted?: boolean }): Promise<any> {
    return this.patch(`/api/auth/devices/${encodeURIComponent(deviceId)}`, data);
  }

  async isDeviceTrusted(deviceId: string): Promise<boolean> {
    const result = await this.get(`/api/auth/devices/${encodeURIComponent(deviceId)}/trusted`);
    return result?.trusted || false;
  }

  // ========================================
  // Path Authorization API (folder access)
  // ========================================

  async getAuthorizedFolders(): Promise<any> {
    return this.get('/api/folders');
  }

  async getPluginFolders(pluginId: string): Promise<any> {
    return this.get(`/api/folders/${encodeURIComponent(pluginId)}`);
  }

  async requestFolderAccess(data: {
    pluginId: string;
    path: string;
    reason?: string;
    recursive?: boolean;
    writeAccess?: boolean;
  }): Promise<any> {
    return this.post('/api/folders', data);
  }

  async revokeFolderAccess(pathId: string): Promise<any> {
    return this.delete(`/api/folders/${encodeURIComponent(pathId)}`);
  }

  async getPendingFolderRequests(): Promise<any> {
    return this.get('/api/folders/requests/pending');
  }

  async approveFolderRequest(requestId: string): Promise<any> {
    return this.post(`/api/folders/requests/${encodeURIComponent(requestId)}/approve`, {});
  }

  async denyFolderRequest(requestId: string): Promise<any> {
    return this.post(`/api/folders/requests/${encodeURIComponent(requestId)}/deny`, {});
  }

  async validateFolderPath(path: string): Promise<any> {
    return this.post('/api/folders/validate', { path });
  }

  async browseFolders(path?: string): Promise<any> {
    const params = path ? `?path=${encodeURIComponent(path)}` : '';
    return this.get(`/api/folders/browse${params}`);
  }

  // ========================================
  // Setup API
  // ========================================

  async getSetupStatus(): Promise<any> {
    return this.get('/api/setup/status');
  }

  async completeSetup(): Promise<any> {
    return this.post('/api/setup/complete', {});
  }

  // ========================================
  // Debug API
  // ========================================

  async getDebugPersistence(): Promise<any> {
    return this.get('/api/debug/persistence');
  }

  // Helper for PATCH requests
  private async patch(path: string, body: any): Promise<any> {
    if (!this.serverUrl) {
      throw new Error('Not connected to server');
    }

    const response = await fetch(`${this.serverUrl}${path}`, {
      method: 'PATCH',
      headers: {
        ...this.getHeaders(),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return response.json();
  }
}

// Singleton instance
let serverClientInstance: ServerClient | null = null;

export function getServerClient(): ServerClient {
  if (!serverClientInstance) {
    serverClientInstance = new ServerClient();
  }
  return serverClientInstance;
}
