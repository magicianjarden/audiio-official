/**
 * Audiio Relay Client
 *
 * Used by the desktop app to connect to the relay server
 * and establish E2E encrypted tunnels with mobile devices.
 */

import WebSocket from 'ws';
import {
  RelayMessage,
  RegisteredMessage,
  PeerJoinedMessage,
  PeerLeftMessage,
  DataMessage,
  ConnectionCode
} from '../shared/types';
import {
  generateKeyPair,
  encrypt,
  decrypt,
  decryptJSON,
  KeyPair,
  EncryptedMessage
} from '../shared/crypto';

export interface RelayClientConfig {
  /** Relay server URL (ws:// or wss://) */
  serverUrl: string;
  /** Reconnect on disconnect */
  autoReconnect: boolean;
  /** Reconnect delay in ms */
  reconnectDelay: number;
  /** Max reconnect attempts */
  maxReconnectAttempts: number;
}

export interface ConnectedPeer {
  id: string;
  publicKey: string;
  deviceName: string;
  userAgent: string;
  connectedAt: number;
}

export interface RelayClientEvents {
  /** Connected to relay server */
  connected: () => void;
  /** Disconnected from relay server */
  disconnected: (reason?: string) => void;
  /** Got a connection code */
  registered: (code: ConnectionCode, expiresAt: number) => void;
  /** A mobile device wants to connect */
  peerJoined: (peer: ConnectedPeer) => void;
  /** A mobile device disconnected */
  peerLeft: (peerId: string) => void;
  /** Received decrypted message from peer */
  message: (peerId: string, message: unknown) => void;
  /** Error occurred */
  error: (error: Error) => void;
}

const DEFAULT_CONFIG: RelayClientConfig = {
  serverUrl: 'ws://localhost:9484',
  autoReconnect: true,
  reconnectDelay: 3000,
  maxReconnectAttempts: 10
};

export class RelayClient {
  private config: RelayClientConfig;
  private ws: WebSocket | null = null;
  private keyPair: KeyPair;
  private connectionCode: ConnectionCode | null = null;
  private peers = new Map<string, ConnectedPeer>();
  private listeners = new Map<keyof RelayClientEvents, Set<Function>>();
  private reconnectAttempts = 0;
  private isConnecting = false;
  private shouldReconnect = true;
  private pingInterval: NodeJS.Timeout | null = null;

  constructor(config: Partial<RelayClientConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.keyPair = generateKeyPair();
  }

  /**
   * Connect to the relay server
   */
  async connect(): Promise<void> {
    if (this.ws?.readyState === WebSocket.OPEN) {
      return;
    }

    if (this.isConnecting) {
      return;
    }

    this.isConnecting = true;
    this.shouldReconnect = true;

    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.config.serverUrl);

        this.ws.on('open', () => {
          console.log('[RelayClient] Connected to relay server');
          this.isConnecting = false;
          this.reconnectAttempts = 0;
          this.startPingInterval();
          this.emit('connected');
          this.register();
          resolve();
        });

        this.ws.on('message', (data: Buffer) => {
          try {
            const message = JSON.parse(data.toString()) as RelayMessage;
            this.handleMessage(message);
          } catch (err) {
            console.error('[RelayClient] Failed to parse message:', err);
          }
        });

        this.ws.on('close', () => {
          this.handleDisconnect();
        });

        this.ws.on('error', (err: Error) => {
          console.error('[RelayClient] WebSocket error:', err.message);
          this.isConnecting = false;
          if (this.reconnectAttempts === 0) {
            reject(err);
          }
          this.emit('error', err);
        });
      } catch (err) {
        this.isConnecting = false;
        reject(err);
      }
    });
  }

  /**
   * Disconnect from the relay server
   */
  disconnect(): void {
    this.shouldReconnect = false;
    this.stopPingInterval();

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.connectionCode = null;
    this.peers.clear();
  }

  /**
   * Send encrypted message to a specific peer
   */
  sendToPeer(peerId: string, message: unknown): void {
    const peer = this.peers.get(peerId);
    if (!peer) {
      console.warn(`[RelayClient] Peer ${peerId} not found`);
      return;
    }

    const messageToEncrypt = typeof message === 'string' ? message : JSON.stringify(message);
    const encrypted = encrypt(messageToEncrypt, peer.publicKey, this.keyPair.secretKey);
    this.send({
      type: 'data',
      payload: {
        to: peerId,
        encrypted: encrypted.encrypted,
        nonce: encrypted.nonce
      },
      timestamp: Date.now()
    });
  }

  /**
   * Broadcast encrypted message to all peers
   */
  broadcast(message: unknown): void {
    for (const peer of this.peers.values()) {
      this.sendToPeer(peer.id, message);
    }
  }

  /**
   * Get current connection code
   */
  getConnectionCode(): ConnectionCode | null {
    return this.connectionCode;
  }

  /**
   * Get public key (for QR code)
   */
  getPublicKey(): string {
    return this.keyPair.publicKey;
  }

  /**
   * Get connected peers
   */
  getPeers(): ConnectedPeer[] {
    return Array.from(this.peers.values());
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  /**
   * Register event listener
   */
  on<K extends keyof RelayClientEvents>(
    event: K,
    callback: RelayClientEvents[K]
  ): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);

    // Return unsubscribe function
    return () => {
      this.listeners.get(event)?.delete(callback);
    };
  }

  // ========================================
  // Private Methods
  // ========================================

  private register(): void {
    this.send({
      type: 'register',
      payload: {
        publicKey: this.keyPair.publicKey,
        requestedCode: this.connectionCode || undefined
      },
      timestamp: Date.now()
    });
  }

  private handleMessage(message: RelayMessage): void {
    switch (message.type) {
      case 'registered':
        this.handleRegistered(message as RegisteredMessage);
        break;

      case 'peer-joined':
        this.handlePeerJoined(message as PeerJoinedMessage);
        break;

      case 'peer-left':
        this.handlePeerLeft(message as PeerLeftMessage);
        break;

      case 'data':
        this.handleData(message as DataMessage);
        break;

      case 'pong':
        // Ping response, connection is alive
        break;

      case 'error':
        console.error('[RelayClient] Server error:', message.payload);
        this.emit('error', new Error((message.payload as any)?.message || 'Unknown error'));
        break;
    }
  }

  private handleRegistered(message: RegisteredMessage): void {
    this.connectionCode = message.payload.code;
    console.log(`[RelayClient] Registered with code: ${this.connectionCode}`);
    this.emit('registered', this.connectionCode, message.payload.expiresAt);
  }

  private handlePeerJoined(message: PeerJoinedMessage): void {
    const { peerId, publicKey, deviceName, userAgent } = message.payload;

    const peer: ConnectedPeer = {
      id: peerId,
      publicKey,
      deviceName,
      userAgent,
      connectedAt: Date.now()
    };

    this.peers.set(peerId, peer);
    console.log(`[RelayClient] Peer joined: ${deviceName} (${peerId})`);
    this.emit('peerJoined', peer);
  }

  private handlePeerLeft(message: PeerLeftMessage): void {
    const { peerId } = message.payload;
    this.peers.delete(peerId);
    console.log(`[RelayClient] Peer left: ${peerId}`);
    this.emit('peerLeft', peerId);
  }

  private handleData(message: DataMessage): void {
    const { encrypted, nonce, from } = message.payload as any;
    const peer = this.peers.get(from);

    if (!peer) {
      console.warn(`[RelayClient] Data from unknown peer: ${from}`);
      return;
    }

    try {
      const decrypted = decryptJSON(
        { encrypted, nonce },
        peer.publicKey,
        this.keyPair.secretKey
      );
      this.emit('message', from, decrypted);
    } catch (err) {
      console.error(`[RelayClient] Failed to decrypt message from ${from}:`, err);
    }
  }

  private handleDisconnect(): void {
    console.log('[RelayClient] Disconnected from relay server');
    this.stopPingInterval();
    this.ws = null;
    this.emit('disconnected');

    // Attempt reconnection
    if (this.shouldReconnect && this.config.autoReconnect) {
      if (this.reconnectAttempts < this.config.maxReconnectAttempts) {
        this.reconnectAttempts++;
        console.log(`[RelayClient] Reconnecting in ${this.config.reconnectDelay}ms (attempt ${this.reconnectAttempts})`);
        setTimeout(() => {
          this.connect().catch(() => {});
        }, this.config.reconnectDelay);
      } else {
        console.error('[RelayClient] Max reconnection attempts reached');
        this.emit('error', new Error('Max reconnection attempts reached'));
      }
    }
  }

  private send(message: RelayMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  private emit<K extends keyof RelayClientEvents>(
    event: K,
    ...args: Parameters<RelayClientEvents[K]>
  ): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      for (const callback of callbacks) {
        try {
          (callback as Function)(...args);
        } catch (err) {
          console.error(`[RelayClient] Error in ${event} callback:`, err);
        }
      }
    }
  }

  private startPingInterval(): void {
    this.stopPingInterval();
    this.pingInterval = setInterval(() => {
      this.send({ type: 'ping', timestamp: Date.now() });
    }, 30000); // Every 30 seconds
  }

  private stopPingInterval(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }
}

// Re-export useful types and functions
export { generateKeyPair, encrypt, decrypt, decryptJSON } from '../shared/crypto';
export { generateCode, normalizeCode } from '../shared/codes';
export * from '../shared/types';
