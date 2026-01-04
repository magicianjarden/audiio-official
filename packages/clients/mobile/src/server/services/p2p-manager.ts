/**
 * P2P Connection Manager
 *
 * Uses the Audiio Relay server for signaling.
 * Works in both Node.js (desktop) and browsers (mobile).
 *
 * Static Room Model:
 * 1. Desktop has a permanent room ID (stored locally)
 * 2. Optional password for security (hashed, never sent in plaintext)
 * 3. Mobile joins room by ID, stays connected
 * 4. Messages are E2E encrypted and relayed
 */

import { EventEmitter } from 'events';
import { RelayClient, ConnectedPeer, RoomId } from '@audiio/relay';

// Re-export types with P2P naming for backwards compatibility
export interface P2PPeer {
  id: string;
  deviceName: string;
  publicKey: string;
  connectedAt: number;
}

export interface P2PConfig {
  relayUrl?: string;
  /** Static room ID (can be set at construction or when calling startAsHost) */
  roomId?: RoomId;
  /** Optional password hash for room protection */
  passwordHash?: string;
  /** Server name for display (e.g., "Jordan's MacBook Pro") */
  serverName?: string;
}

// Relay server URL - will be updated after Fly.io deployment
const DEFAULT_RELAY_URL = process.env.AUDIIO_RELAY_URL || 'wss://audiio-relay.fly.dev';

/**
 * P2P Manager - Uses Audiio Relay for remote access
 */
export class P2PManager extends EventEmitter {
  private relay: RelayClient | null = null;
  private isRunning = false;
  private authToken: string | null = null;
  private localUrl: string | null = null;

  constructor(private config: P2PConfig = {}) {
    super();
  }

  /**
   * Start as host (desktop) - register with the static room ID
   * @param roomId Room ID to use (overrides config if provided)
   * @param serverName Server name for display (overrides config if provided)
   */
  async startAsHost(roomId?: string, serverName?: string): Promise<{ code: string }> {
    if (this.isRunning) {
      throw new Error('P2P already running');
    }

    // Use provided roomId or fall back to config
    const effectiveRoomId = roomId || this.config.roomId;
    if (!effectiveRoomId) {
      throw new Error('roomId is required for P2P connection');
    }

    // Update config with provided values
    if (roomId) this.config.roomId = roomId;
    if (serverName) this.config.serverName = serverName;

    const serverUrl = this.config.relayUrl || DEFAULT_RELAY_URL;

    console.log(`[P2P] Connecting to relay: ${serverUrl}`);
    console.log(`[P2P] Room ID: ${effectiveRoomId}${this.config.passwordHash ? ' (password protected)' : ''}`);

    this.relay = new RelayClient({
      serverUrl,
      roomId: effectiveRoomId,
      passwordHash: this.config.passwordHash,
      serverName: this.config.serverName,
      autoReconnect: true,
      reconnectDelay: 3000,
      maxReconnectAttempts: 10
    });

    // Set up event handlers
    this.relay.on('registered', (registeredRoomId, hasPassword) => {
      console.log(`[P2P] Registered room: ${registeredRoomId}${hasPassword ? ' (password protected)' : ''}`);
    });

    this.relay.on('peerJoined', (peer: ConnectedPeer) => {
      console.log(`[P2P] Peer joined: ${peer.deviceName}`);
      this.emit('peer-joined', {
        id: peer.id,
        deviceName: peer.deviceName,
        publicKey: peer.publicKey,
        connectedAt: peer.connectedAt
      } as P2PPeer);

      // Send welcome message with auth info
      if (this.authToken && this.localUrl) {
        this.relay?.sendToPeer(peer.id, {
          type: 'welcome',
          authToken: this.authToken,
          localUrl: this.localUrl
        });
      }
    });

    this.relay.on('peerLeft', (peerId) => {
      console.log(`[P2P] Peer left: ${peerId}`);
      this.emit('peer-left', peerId);
    });

    this.relay.on('message', (peerId, message) => {
      console.log(`[P2P] Message from ${peerId}:`, typeof message === 'object' ? (message as any).type : message);
      this.handleMessage(peerId, message);
    });

    this.relay.on('disconnected', () => {
      console.log('[P2P] Disconnected from relay');
      this.emit('disconnected');
    });

    this.relay.on('error', (error) => {
      console.error('[P2P] Relay error:', error.message);
      this.emit('error', error);
    });

    // Connect to relay
    await this.relay.connect();
    this.isRunning = true;

    // Wait for registration
    const code = await this.waitForCode();

    return { code };
  }

  /**
   * Wait for room registration confirmation from relay
   */
  private waitForCode(): Promise<string> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Timeout waiting for room registration'));
      }, 10000);

      // Listen for the 'registered' event which confirms room is active
      const unsubscribe = this.relay?.on('registered', (roomId) => {
        clearTimeout(timeout);
        unsubscribe?.();
        // Use our known room ID from config, not what relay returns
        // (relay might return undefined if running older version)
        const effectiveRoomId = roomId || this.config.roomId || '';
        console.log(`[P2P] Room registered: ${effectiveRoomId}`);
        resolve(effectiveRoomId);
      });

      // If no relay, reject immediately
      if (!this.relay) {
        clearTimeout(timeout);
        reject(new Error('No relay client'));
      }
    });
  }

  /**
   * Handle incoming message from peer
   */
  private handleMessage(peerId: string, message: unknown): void {
    // Emit all messages through 'message' event - MobileServer handles routing
    this.emit('message', peerId, message);
  }

  /**
   * Stop the P2P connection
   */
  async stop(): Promise<void> {
    if (!this.isRunning) return;

    this.relay?.disconnect();
    this.relay = null;
    this.isRunning = false;
    console.log('[P2P] Stopped');
  }

  /**
   * Set auth config to send to connecting peers
   */
  setAuthConfig(token: string, localUrl: string): void {
    this.authToken = token;
    this.localUrl = localUrl;
  }

  /**
   * Get room ID
   */
  getRoomId(): string | null {
    return this.config.roomId || null;
  }

  /**
   * Get connection code (alias for getRoomId for backwards compatibility)
   */
  getConnectionCode(): string | null {
    return this.relay?.getRoomId() || this.config.roomId || null;
  }

  /**
   * Check if room has password protection
   */
  hasPassword(): boolean {
    return !!this.config.passwordHash;
  }

  /**
   * Update password hash (takes effect on next connection)
   */
  setPasswordHash(hash: string | undefined): void {
    this.config.passwordHash = hash;
    // If connected, update the relay client
    if (this.relay) {
      this.relay.setPasswordHash(hash);
    }
  }

  /**
   * Get connected peers
   */
  getPeers(): P2PPeer[] {
    const peers = this.relay?.getPeers() || [];
    return peers.map(p => ({
      id: p.id,
      deviceName: p.deviceName,
      publicKey: p.publicKey,
      connectedAt: p.connectedAt
    }));
  }

  /**
   * Check if P2P is running
   */
  getIsRunning(): boolean {
    return this.isRunning;
  }

  /**
   * Send message to a peer
   */
  send(message: unknown, peerId?: string): void {
    if (!this.relay) {
      console.warn('[P2P] Cannot send - not connected');
      return;
    }

    if (peerId) {
      this.relay.sendToPeer(peerId, message);
    } else {
      this.relay.broadcast(message);
    }
  }

  /**
   * Send API response to peer
   */
  sendApiResponse(peerId: string, requestId: string, response: { ok: boolean; status: number; data: unknown }): void {
    this.send({
      type: 'api-response',
      requestId,
      ok: response.ok,
      status: response.status,
      data: response.data
    }, peerId);
  }

  /**
   * Get current relay URL
   */
  getRelayUrl(): string {
    return this.config.relayUrl || DEFAULT_RELAY_URL;
  }

  /**
   * Set custom relay URL (takes effect on next restart)
   */
  setRelayUrl(url: string): void {
    this.config.relayUrl = url;
    console.log(`[P2P] Relay URL set to: ${url} (will take effect on next restart)`);
  }
}

export default P2PManager;
