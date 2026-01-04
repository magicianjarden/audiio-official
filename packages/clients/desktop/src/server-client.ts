/**
 * Server Client - HTTP/WebSocket client for Audiio Server
 *
 * Handles all communication between the client app and a remote Audiio server.
 * Implements the same interface that the UI expects from local orchestrators.
 */

import { EventEmitter } from '@audiio/core';
import WebSocket from 'ws';
import nacl from 'tweetnacl';
import { encodeBase64, decodeBase64, decodeUTF8 } from 'tweetnacl-util';
import { createHash } from 'crypto';

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
  latency?: number;
  error?: string;
}

type ServerClientEvents = {
  'connection-change': ConnectionState;
  'playback-state': any;
  'error': Error;
};

export class ServerClient extends EventEmitter<ServerClientEvents> {
  private serverUrl: string | null = null;
  private token: string | null = null;
  private deviceIdentity: DeviceIdentity | null = null;
  private sessionToken: string | null = null;
  private ws: WebSocket | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pingInterval: ReturnType<typeof setInterval> | null = null;
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

      // Connect WebSocket for real-time updates
      this.connectWebSocket();

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
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }

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

    const response = await fetch(`${this.serverUrl}${path}`, {
      method: 'DELETE',
      headers: this.getHeaders()
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
  // WebSocket Connection
  // ========================================

  private connectWebSocket(): void {
    if (!this.serverUrl) return;

    const wsUrl = this.serverUrl.replace(/^http/, 'ws') + '/ws';
    const fullUrl = this.token ? `${wsUrl}?token=${this.token}` : wsUrl;

    try {
      this.ws = new WebSocket(fullUrl);

      this.ws.onopen = () => {
        console.log('[ServerClient] WebSocket connected');
        this.startPingInterval();
      };

      this.ws.onmessage = (event) => {
        try {
          const messageData = typeof event.data === 'string'
            ? event.data
            : event.data.toString();
          const data = JSON.parse(messageData);
          this.handleWebSocketMessage(data);
        } catch {
          // Invalid JSON
        }
      };

      this.ws.onclose = () => {
        console.log('[ServerClient] WebSocket disconnected');
        this.stopPingInterval();
        this.scheduleReconnect();
      };

      this.ws.onerror = (error) => {
        console.error('[ServerClient] WebSocket error:', error);
      };
    } catch (error) {
      console.error('[ServerClient] Failed to create WebSocket:', error);
    }
  }

  private handleWebSocketMessage(data: { type: string; payload?: any }): void {
    switch (data.type) {
      case 'pong':
        // Calculate latency
        if (data.payload) {
          this.connectionState.latency = Date.now() - data.payload;
        }
        break;

      case 'playback-state':
      case 'desktop-state':
        this.emit('playback-state', data.payload);
        break;

      default:
        // Other message types
        break;
    }
  }

  private startPingInterval(): void {
    this.pingInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'ping', payload: Date.now() }));
      }
    }, 30000);
  }

  private stopPingInterval(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (this.serverUrl && this.connectionState.connected) {
        console.log('[ServerClient] Attempting reconnect...');
        this.connectWebSocket();
      }
    }, 5000);
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

    console.log('[ServerClient] Resolving stream:', params.toString());
    const result = await this.get(`/api/stream/resolve?${params.toString()}`);

    // If the URL is a relative proxy path, make it absolute
    if (result?.url?.startsWith('/api/stream/proxy')) {
      result.url = `${this.serverUrl}${result.url}`;
      console.log('[ServerClient] Converted to absolute URL:', result.url.slice(0, 80) + '...');
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

  async createPlaylist(name: string, description?: string): Promise<any> {
    return this.post('/api/library/playlists', { name, description });
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
}

// Singleton instance
let serverClientInstance: ServerClient | null = null;

export function getServerClient(): ServerClient {
  if (!serverClientInstance) {
    serverClientInstance = new ServerClient();
  }
  return serverClientInstance;
}
