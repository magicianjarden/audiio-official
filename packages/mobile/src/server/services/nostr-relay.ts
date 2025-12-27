/**
 * Nostr Relay - Simple message passing via public Nostr relays
 *
 * Uses WebSocket to connect to Nostr relays for signaling.
 * No WebRTC needed - just plain WebSocket communication.
 * Works in both Node.js and browsers.
 *
 * Flow:
 * 1. Desktop creates a room with a connection code (e.g., "SWIFT-EAGLE-42")
 * 2. Mobile joins the same room with the code
 * 3. Messages are passed through public Nostr relays (no P2P, just relay)
 */

import { EventEmitter } from 'events';
import * as crypto from 'crypto';
import { schnorr } from '@noble/curves/secp256k1';
import { bytesToHex } from '@noble/curves/abstract/utils';

// WebSocket import that works in both Node.js and browser
const WebSocketImpl = typeof WebSocket !== 'undefined'
  ? WebSocket
  : require('ws');

// Public Nostr relays (free to use, no PoW required)
// Prioritize relays that don't require proof-of-work
const NOSTR_RELAYS = [
  'wss://relay.damus.io',
  'wss://relay.snort.social',
  'wss://nostr.wine',
  'wss://relay.nostr.band',
  'wss://purplepag.es'
];

// Word lists for memorable connection codes
const ADJECTIVES = [
  'SWIFT', 'CALM', 'BOLD', 'WARM', 'COOL',
  'BLUE', 'GOLD', 'JADE', 'RUBY', 'SAGE',
  'WILD', 'SOFT', 'DEEP', 'HIGH', 'PURE',
  'BRIGHT', 'QUICK', 'SILENT', 'LUCKY', 'NOBLE'
];

const NOUNS = [
  'TIGER', 'EAGLE', 'SHARK', 'WOLF', 'BEAR',
  'RIVER', 'OCEAN', 'STORM', 'CLOUD', 'STONE',
  'FLAME', 'FROST', 'LIGHT', 'SHADE', 'SPARK',
  'FALCON', 'PHOENIX', 'DRAGON', 'THUNDER', 'CRYSTAL'
];

function generateCode(): string {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  const num = Math.floor(Math.random() * 90) + 10;
  return `${adj}-${noun}-${num}`;
}

function normalizeCode(code: string): string {
  return code.toUpperCase().trim();
}

// Generate a random hex ID (64 chars / 32 bytes for Nostr compatibility)
function randomId(): string {
  return crypto.randomBytes(32).toString('hex');
}

// Simple hash for Nostr event ID
function sha256(data: string): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

export interface NostrPeer {
  id: string;
  deviceName: string;
  connectedAt: number;
}

export interface NostrRelayConfig {
  /** Custom relay URLs */
  relays?: string[];
  /** App identifier for namespacing */
  appId?: string;
  /** Auth token to send to peers when they join (host mode) */
  authToken?: string;
  /** Local URL for HTTP fallback */
  localUrl?: string;
  /** Callback for handling API requests from P2P peers */
  onApiRequest?: (request: {
    url: string;
    method: string;
    body?: unknown;
    authToken?: string;
  }) => Promise<{ ok: boolean; status: number; data: unknown }>;
}

const DEFAULT_CONFIG: NostrRelayConfig = {
  relays: NOSTR_RELAYS,
  appId: 'audiio-mobile'
};

// Nostr event structure (simplified)
interface NostrEvent {
  id: string;
  pubkey: string;
  created_at: number;
  kind: number;
  tags: string[][];
  content: string;
  sig: string;
}

export class NostrRelay extends EventEmitter {
  private config: NostrRelayConfig;
  private ws: InstanceType<typeof WebSocketImpl> | null = null;
  private connectionCode: string | null = null;
  private isHost = false;
  private peers = new Map<string, NostrPeer>();
  private isRunning = false;
  private privateKey: Uint8Array;
  private publicKey: string;
  private subscriptionId: string | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;

  constructor(config: Partial<NostrRelayConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    // Generate a proper secp256k1 keypair for Nostr
    this.privateKey = schnorr.utils.randomPrivateKey();
    this.publicKey = bytesToHex(schnorr.getPublicKey(this.privateKey));
  }

  /**
   * Get own peer ID (public key)
   */
  getSelfId(): string {
    return this.publicKey;
  }

  /**
   * Start as host (desktop) - creates a room and returns connection code
   */
  async startAsHost(): Promise<{ code: string }> {
    if (this.isRunning) {
      throw new Error('Relay is already running');
    }

    this.connectionCode = generateCode();
    this.isHost = true;
    await this.connect();

    console.log(`[NostrRelay] Hosting room: ${this.connectionCode}`);

    return { code: this.connectionCode };
  }

  /**
   * Start as client (mobile) - joins an existing room with code
   */
  async joinAsClient(code: string, deviceName: string): Promise<void> {
    if (this.isRunning) {
      throw new Error('Relay is already running');
    }

    this.connectionCode = normalizeCode(code);
    this.isHost = false;
    await this.connect();

    // Send join message to identify ourselves
    this.sendMessage({
      type: 'join',
      deviceName,
      timestamp: Date.now()
    });

    console.log(`[NostrRelay] Joined room: ${this.connectionCode}`);
  }

  /**
   * Stop relay connections
   */
  async stop(): Promise<void> {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }

    if (this.ws) {
      try {
        // Unsubscribe first
        if (this.subscriptionId) {
          this.ws.send(JSON.stringify(['CLOSE', this.subscriptionId]));
        }
        this.ws.close();
      } catch {
        // Ignore close errors
      }
      this.ws = null;
    }

    this.connectionCode = null;
    this.peers.clear();
    this.isRunning = false;
    this.subscriptionId = null;

    console.log('[NostrRelay] Stopped');
  }

  /**
   * Send data to a specific peer or broadcast to all
   */
  send(data: unknown, peerId?: string): void {
    this.sendMessage({
      type: 'data',
      from: this.publicKey,
      to: peerId,
      payload: data,
      timestamp: Date.now()
    });
  }

  /**
   * Get current connection code
   */
  getConnectionCode(): string | null {
    return this.connectionCode;
  }

  /**
   * Get connected peers
   */
  getPeers(): NostrPeer[] {
    return Array.from(this.peers.values());
  }

  /**
   * Check if running
   */
  getIsRunning(): boolean {
    return this.isRunning;
  }

  // ========================================
  // Private Methods
  // ========================================

  private async connect(): Promise<void> {
    const relays = this.config.relays || NOSTR_RELAYS;
    let lastError: Error | null = null;

    // Try each relay until one succeeds
    for (const relayUrl of relays) {
      try {
        await this.connectToRelay(relayUrl);
        return; // Success!
      } catch (error) {
        console.log(`[NostrRelay] Failed to connect to ${relayUrl}, trying next...`);
        lastError = error as Error;
      }
    }

    // All relays failed
    throw lastError || new Error('All relays failed to connect');
  }

  private async connectToRelay(relayUrl: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        console.log(`[NostrRelay] Connecting to ${relayUrl}...`);
        this.ws = new WebSocketImpl(relayUrl);

        const timeout = setTimeout(() => {
          if (this.ws) {
            try { this.ws.close(); } catch {}
          }
          reject(new Error('Connection timeout'));
        }, 8000);

        this.ws.onopen = () => {
          clearTimeout(timeout);
          console.log(`[NostrRelay] Connected to relay: ${relayUrl}`);
          this.isRunning = true;
          this.subscribe();
          this.startHeartbeat();
          resolve();
        };

        this.ws.onclose = () => {
          console.log('[NostrRelay] Disconnected from relay');
          this.scheduleReconnect();
        };

        this.ws.onerror = (error: any) => {
          console.error('[NostrRelay] WebSocket error:', error);
          clearTimeout(timeout);
          if (!this.isRunning) {
            reject(error);
          }
        };

        this.ws.onmessage = (event: any) => {
          const data = String(event.data);
          // Only log non-EOSE and non-OK messages in detail
          if (data.includes('"EVENT"')) {
            console.log(`[NostrRelay] Received EVENT: ${data.substring(0, 300)}...`);
          } else if (!data.includes('"EOSE"')) {
            console.log(`[NostrRelay] WS message: ${data.substring(0, 150)}`);
          }
          this.handleMessage(event.data);
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  private scheduleReconnect(): void {
    if (!this.isRunning || this.reconnectTimer) return;

    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null;
      try {
        await this.connect();
      } catch (error) {
        console.error('[NostrRelay] Reconnect failed:', error);
        this.scheduleReconnect();
      }
    }, 3000);
  }

  private startHeartbeat(): void {
    // If host, announce presence immediately
    if (this.isHost) {
      console.log('[NostrRelay] Announcing host presence');
      this.announcePresence();
    }

    this.heartbeatTimer = setInterval(() => {
      if (this.ws && this.ws.readyState === 1) {
        // If host, announce presence periodically (for peer discovery)
        if (this.isHost) {
          this.announcePresence();
        }
      }
    }, 30000); // Every 30 seconds for discovery, less aggressive
  }

  /**
   * Announce host presence so mobile clients can discover us
   */
  private announcePresence(): void {
    if (!this.isHost || !this.ws) return;

    // Don't log every announce - too noisy
    this.sendMessage({
      type: 'host-announce',
      hostId: this.publicKey,
      authToken: this.config.authToken,
      localUrl: this.config.localUrl,
      timestamp: Date.now()
    });
  }

  private subscribe(): void {
    if (!this.ws || !this.connectionCode) return;

    // Generate a unique subscription ID
    this.subscriptionId = `sub_${randomId().substring(0, 8)}`;

    // Create room identifier from code and app ID
    const roomId = `${this.config.appId}:${this.connectionCode}`;

    // Subscribe to events with our room tag
    // Using kind 30078 (application-specific data) with "d" tag for room
    const filter = {
      kinds: [30078],
      '#d': [roomId],
      since: Math.floor(Date.now() / 1000) - 300 // Last 5 minutes for better reliability
    };

    const req = JSON.stringify(['REQ', this.subscriptionId, filter]);
    console.log('[NostrRelay] Subscribing to room:', roomId);
    console.log('[NostrRelay] Subscription filter:', JSON.stringify(filter));
    this.ws.send(req);
  }

  private sendMessage(data: unknown): void {
    if (!this.ws || !this.connectionCode) {
      console.warn('[NostrRelay] Not connected, cannot send');
      return;
    }

    // Create room identifier
    const roomId = `${this.config.appId}:${this.connectionCode}`;

    // Create a Nostr event
    const event = this.createEvent(roomId, JSON.stringify(data));

    // Send the event
    const msg = JSON.stringify(['EVENT', event]);
    this.ws.send(msg);
  }

  private createEvent(roomId: string, content: string): NostrEvent {
    const created_at = Math.floor(Date.now() / 1000);
    const kind = 30078; // Application-specific data

    const tags = [
      ['d', roomId], // Room identifier
      ['p', this.publicKey] // Sender ID
    ];

    // Create serialized event for hashing (NIP-01 format)
    const preEvent = [
      0, // reserved
      this.publicKey, // pubkey
      created_at,
      kind,
      tags,
      content
    ];

    // Hash the serialized event to get the event ID
    const eventHash = sha256(JSON.stringify(preEvent));

    // Sign the event hash with our private key using Schnorr signature
    const signature = schnorr.sign(eventHash, this.privateKey);
    const sig = bytesToHex(signature);

    return {
      id: eventHash,
      pubkey: this.publicKey,
      created_at,
      kind,
      tags,
      content,
      sig
    };
  }

  private handleMessage(rawData: string): void {
    try {
      const msg = JSON.parse(rawData);

      if (!Array.isArray(msg)) return;

      const [type, ...args] = msg;

      switch (type) {
        case 'EVENT':
          // args[0] is subscription ID, args[1] is the event
          const event = (args[1] || args[0]) as NostrEvent;
          if (event && event.id && event.pubkey) {
            this.handleEvent(event);
          }
          break;
        case 'OK':
          // Event accepted/rejected - log if rejected
          if (args[1] === false) {
            console.log(`[NostrRelay] Event rejected: ${args[2]}`);
          }
          break;
        case 'EOSE':
          // End of stored events
          console.log('[NostrRelay] Subscription ready');
          break;
        case 'NOTICE':
          console.log('[NostrRelay] Notice:', args[0]);
          break;
        case 'CLOSED':
          console.log('[NostrRelay] Subscription closed:', args[1]);
          break;
        default:
          break;
      }
    } catch {
      // Ignore parse errors
    }
  }

  private handleEvent(event: NostrEvent): void {
    // Ignore our own events
    if (event.pubkey === this.publicKey) {
      console.log('[NostrRelay] Ignoring own event');
      return;
    }

    console.log(`[NostrRelay] Received event from: ${event.pubkey.substring(0, 8)}...`);

    try {
      const data = JSON.parse(event.content);
      const senderId = event.pubkey;
      console.log(`[NostrRelay] Event type: ${data.type}`);

      // Handle different message types
      switch (data.type) {
        case 'join':
          this.handlePeerJoin(senderId, data);
          break;
        case 'data':
          // Check if message is for us (or broadcast)
          if (!data.to || data.to === this.publicKey) {
            const payload = data.payload;
            // Handle API request from P2P peer
            if (payload?.type === 'api-request') {
              this.handleApiRequest(senderId, payload);
            } else {
              this.emit('message', senderId, payload);
            }
          }
          break;
        case 'ping':
          // Heartbeat, ignore
          break;
        default:
          break;
      }
    } catch {
      // Ignore parse errors
    }
  }

  private handlePeerJoin(peerId: string, data: { deviceName?: string }): void {
    if (this.peers.has(peerId)) return;

    const peer: NostrPeer = {
      id: peerId,
      deviceName: data.deviceName || 'Unknown Device',
      connectedAt: Date.now()
    };

    this.peers.set(peerId, peer);
    console.log(`[NostrRelay] Peer joined: ${peer.deviceName}`);

    this.emit('peer-joined', peer);

    // If we're host, send acknowledgment with auth info
    if (this.isHost) {
      console.log(`[NostrRelay] Sending welcome to peer ${peerId.substring(0, 8)}... with authToken: ${!!this.config.authToken}`);
      this.send({
        type: 'welcome',
        host: true,
        authToken: this.config.authToken,
        localUrl: this.config.localUrl
      }, peerId);
    }
  }

  /**
   * Update auth config (e.g., when token is generated)
   */
  setAuthConfig(authToken: string, localUrl?: string): void {
    this.config.authToken = authToken;
    if (localUrl) {
      this.config.localUrl = localUrl;
    }
  }

  /**
   * Set API request handler callback
   */
  setApiRequestHandler(handler: NostrRelayConfig['onApiRequest']): void {
    this.config.onApiRequest = handler;
  }

  /**
   * Handle API request from P2P peer
   */
  private async handleApiRequest(
    peerId: string,
    request: { requestId: string; url: string; method: string; body?: unknown; authToken?: string }
  ): Promise<void> {
    console.log(`[NostrRelay] API request from ${peerId}: ${request.method} ${request.url}`);

    let response: { ok: boolean; status: number; data: unknown };

    if (this.config.onApiRequest) {
      try {
        response = await this.config.onApiRequest({
          url: request.url,
          method: request.method,
          body: request.body,
          authToken: request.authToken
        });
      } catch (error) {
        console.error('[NostrRelay] API request handler error:', error);
        response = {
          ok: false,
          status: 500,
          data: { error: 'Internal server error' }
        };
      }
    } else {
      // No handler configured - use local HTTP fetch
      try {
        const localUrl = this.config.localUrl || 'http://localhost:8484';
        const fullUrl = new URL(request.url, localUrl);
        if (request.authToken) {
          fullUrl.searchParams.set('token', request.authToken);
        }

        const fetchOptions: RequestInit = {
          method: request.method,
          headers: { 'Content-Type': 'application/json' }
        };
        if (request.body && request.method !== 'GET') {
          fetchOptions.body = JSON.stringify(request.body);
        }

        const httpResponse = await fetch(fullUrl.toString(), fetchOptions);
        const data = await httpResponse.json().catch(() => ({}));

        response = {
          ok: httpResponse.ok,
          status: httpResponse.status,
          data
        };
      } catch (error) {
        console.error('[NostrRelay] HTTP fetch error:', error);
        response = {
          ok: false,
          status: 502,
          data: { error: 'Failed to reach local server' }
        };
      }
    }

    // Send response back to peer
    this.send({
      type: 'api-response',
      requestId: request.requestId,
      ok: response.ok,
      status: response.status,
      data: response.data
    }, peerId);

    console.log(`[NostrRelay] API response to ${peerId}: ${response.status}`);
  }
}

export default NostrRelay;
