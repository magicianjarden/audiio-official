/**
 * P2P Connection Manager
 *
 * Uses the Audiio Relay server for signaling.
 * Works in both Node.js (desktop) and browsers (mobile).
 *
 * Flow:
 * 1. Desktop registers with relay, gets a connection code (e.g., "BLUE-TIGER-42")
 * 2. Mobile joins the same room with the code
 * 3. Messages are E2E encrypted and relayed
 */

import { EventEmitter } from 'events';
import { RelayClient, ConnectedPeer, RelayClientConfig } from '@audiio/relay';

// Re-export types with P2P naming for backwards compatibility
export interface P2PPeer {
  id: string;
  deviceName: string;
  publicKey: string;
  connectedAt: number;
}

export interface P2PConfig extends Partial<RelayClientConfig> {
  relayUrl?: string;
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
   * Start as host (desktop) - get a connection code
   */
  async startAsHost(): Promise<{ code: string }> {
    if (this.isRunning) {
      throw new Error('P2P already running');
    }

    const serverUrl = this.config.relayUrl || DEFAULT_RELAY_URL;

    console.log(`[P2P] Connecting to relay: ${serverUrl}`);

    this.relay = new RelayClient({
      serverUrl,
      autoReconnect: true,
      reconnectDelay: 3000,
      maxReconnectAttempts: 10
    });

    // Set up event handlers
    this.relay.on('registered', (code, expiresAt) => {
      console.log(`[P2P] Registered with code: ${code} (expires: ${new Date(expiresAt).toLocaleTimeString()})`);
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
   * Wait for connection code from relay
   */
  private waitForCode(): Promise<string> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Timeout waiting for connection code'));
      }, 10000);

      const checkCode = () => {
        const code = this.relay?.getConnectionCode();
        if (code) {
          clearTimeout(timeout);
          resolve(code);
        } else {
          setTimeout(checkCode, 100);
        }
      };

      checkCode();
    });
  }

  /**
   * Handle incoming message from peer
   */
  private handleMessage(peerId: string, message: unknown): void {
    const msg = message as { type: string; requestId?: string; [key: string]: unknown };

    if (msg.type === 'api-request') {
      // Handle API request
      this.emit('api-request', peerId, msg);
    } else {
      // Generic message
      this.emit('message', peerId, message);
    }
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
   * Get connection code
   */
  getConnectionCode(): string | null {
    return this.relay?.getConnectionCode() || null;
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
}

export default P2PManager;
