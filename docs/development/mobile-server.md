# Mobile Server

Technical documentation for Audiio's mobile server internals.

## Overview

The mobile server enables remote control from phones/tablets. It runs inside the desktop app and provides:

- REST API for library and playback
- WebSocket for real-time updates
- P2P connectivity via relay server
- E2E encryption for security

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Mobile Server                           │
│                                                              │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐   │
│  │  REST Routes  │  │   WebSocket   │  │  P2P Manager  │   │
│  │   /api/...    │  │   /ws         │  │               │   │
│  └───────┬───────┘  └───────┬───────┘  └───────┬───────┘   │
│          │                  │                  │            │
│          └──────────────────┼──────────────────┘            │
│                             │                               │
│                    ┌────────▼────────┐                      │
│                    │   Auth Manager  │                      │
│                    │                 │                      │
│                    └────────┬────────┘                      │
│                             │                               │
│                    ┌────────▼────────┐                      │
│                    │ Device Manager  │                      │
│                    │                 │                      │
│                    └─────────────────┘                      │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Server Setup

```typescript
// packages/mobile/src/server/index.ts
import Fastify from 'fastify';
import websocket from '@fastify/websocket';
import { registerRoutes } from './api/routes';
import { AuthManager } from './services/auth-manager';
import { DeviceManager } from './services/device-manager';
import { P2PManager } from './services/p2p-manager';

export async function createMobileServer(port: number = 9484) {
  const fastify = Fastify({ logger: true });

  // Initialize services
  const authManager = new AuthManager();
  const deviceManager = new DeviceManager();
  const p2pManager = new P2PManager();

  // Register WebSocket
  await fastify.register(websocket);

  // Register routes
  await registerRoutes(fastify, { authManager, deviceManager });

  // WebSocket handler
  fastify.register(async (app) => {
    app.get('/ws', { websocket: true }, (socket, req) => {
      handleWebSocket(socket, req, { authManager, deviceManager });
    });
  });

  // Start server
  await fastify.listen({ port, host: '0.0.0.0' });

  return {
    fastify,
    authManager,
    deviceManager,
    p2pManager,
    close: () => fastify.close(),
  };
}
```

## Authentication

### Auth Manager

```typescript
// services/auth-manager.ts
import { randomBytes, createHash } from 'crypto';
import { box, randomBytes as naclRandomBytes } from 'tweetnacl';

interface Session {
  token: string;
  deviceId: string;
  createdAt: Date;
  expiresAt: Date;
}

export class AuthManager {
  private sessions: Map<string, Session> = new Map();
  private connectionCode: string = '';
  private keyPair: { publicKey: Uint8Array; secretKey: Uint8Array };

  constructor() {
    this.keyPair = box.keyPair();
    this.regenerateCode();
  }

  regenerateCode(): string {
    // Generate memorable 3-word code
    const words = ['SWIFT', 'EAGLE', 'TIGER', 'HAPPY', 'BLUE', ...];
    const code = [
      words[Math.floor(Math.random() * words.length)],
      words[Math.floor(Math.random() * words.length)],
      Math.floor(Math.random() * 100).toString().padStart(2, '0'),
    ].join('-');

    this.connectionCode = code;
    return code;
  }

  getConnectionCode(): string {
    return this.connectionCode;
  }

  getPublicKey(): Uint8Array {
    return this.keyPair.publicKey;
  }

  validateCode(code: string): boolean {
    return code.toUpperCase() === this.connectionCode;
  }

  createSession(deviceId: string): string {
    const token = randomBytes(32).toString('hex');
    const session: Session = {
      token,
      deviceId,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    };

    this.sessions.set(token, session);
    return token;
  }

  validateSession(token: string): Session | null {
    const session = this.sessions.get(token);
    if (!session) return null;

    if (session.expiresAt < new Date()) {
      this.sessions.delete(token);
      return null;
    }

    return session;
  }

  revokeSession(token: string): void {
    this.sessions.delete(token);
  }

  revokeAllSessions(): void {
    this.sessions.clear();
  }
}
```

### Auth Middleware

```typescript
// middleware/auth.ts
import { FastifyRequest, FastifyReply } from 'fastify';

export async function authMiddleware(
  request: FastifyRequest,
  reply: FastifyReply,
  authManager: AuthManager
) {
  // Skip auth for public routes
  if (request.url === '/api/auth/connect') {
    return;
  }

  const authHeader = request.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return reply.status(401).send({ error: 'Unauthorized' });
  }

  const token = authHeader.slice(7);
  const session = authManager.validateSession(token);

  if (!session) {
    return reply.status(401).send({ error: 'Invalid or expired session' });
  }

  // Attach session to request
  request.session = session;
}
```

## REST API Routes

```typescript
// api/routes.ts
import { FastifyInstance } from 'fastify';

export async function registerRoutes(fastify: FastifyInstance, services: Services) {
  const { authManager, deviceManager } = services;

  // Auth
  fastify.post('/api/auth/connect', async (request, reply) => {
    const { code, deviceName, publicKey } = request.body as any;

    if (!authManager.validateCode(code)) {
      return reply.status(401).send({ error: 'Invalid code' });
    }

    const device = await deviceManager.registerDevice(deviceName, publicKey);
    const token = authManager.createSession(device.id);

    return {
      token,
      deviceId: device.id,
      serverPublicKey: Buffer.from(authManager.getPublicKey()).toString('base64'),
    };
  });

  fastify.post('/api/auth/disconnect', async (request, reply) => {
    const token = request.headers.authorization?.slice(7);
    if (token) {
      authManager.revokeSession(token);
    }
    return { success: true };
  });

  // Library
  fastify.get('/api/library/likes', async (request) => {
    return libraryBridge.getLikes();
  });

  fastify.get('/api/library/playlists', async (request) => {
    return libraryBridge.getPlaylists();
  });

  fastify.get('/api/library/playlists/:id', async (request) => {
    const { id } = request.params as any;
    return libraryBridge.getPlaylist(id);
  });

  // Player
  fastify.get('/api/player/state', async (request) => {
    return playerBridge.getState();
  });

  fastify.post('/api/player/play', async (request) => {
    const { trackId } = request.body as any;
    await playerBridge.play(trackId);
    return { success: true };
  });

  fastify.post('/api/player/pause', async (request) => {
    await playerBridge.pause();
    return { success: true };
  });

  fastify.post('/api/player/next', async (request) => {
    await playerBridge.next();
    return { success: true };
  });

  fastify.post('/api/player/previous', async (request) => {
    await playerBridge.previous();
    return { success: true };
  });

  fastify.post('/api/player/seek', async (request) => {
    const { position } = request.body as any;
    await playerBridge.seek(position);
    return { success: true };
  });

  fastify.post('/api/player/volume', async (request) => {
    const { volume } = request.body as any;
    await playerBridge.setVolume(volume);
    return { success: true };
  });

  // Queue
  fastify.get('/api/queue', async (request) => {
    return playerBridge.getQueue();
  });

  fastify.post('/api/queue/add', async (request) => {
    const { tracks, position } = request.body as any;
    await playerBridge.addToQueue(tracks, position);
    return { success: true };
  });

  fastify.delete('/api/queue/:index', async (request) => {
    const { index } = request.params as any;
    await playerBridge.removeFromQueue(parseInt(index));
    return { success: true };
  });

  // Search
  fastify.get('/api/search', async (request) => {
    const { q, type = 'all', limit = 25 } = request.query as any;
    return searchBridge.search(q, type, limit);
  });
}
```

## WebSocket Handler

```typescript
// websocket/handler.ts
import { WebSocket } from 'ws';

interface WSMessage {
  type: string;
  payload?: any;
}

export function handleWebSocket(
  socket: WebSocket,
  request: any,
  services: Services
) {
  const { authManager, deviceManager } = services;
  let session: Session | null = null;

  socket.on('message', async (data) => {
    try {
      const message: WSMessage = JSON.parse(data.toString());

      switch (message.type) {
        case 'auth':
          session = authManager.validateSession(message.payload.token);
          if (session) {
            socket.send(JSON.stringify({ type: 'auth:success' }));
            // Subscribe to updates
            subscribeToUpdates(socket);
          } else {
            socket.send(JSON.stringify({ type: 'auth:failed' }));
            socket.close();
          }
          break;

        case 'player:play':
          if (!session) return;
          await playerBridge.play(message.payload?.trackId);
          break;

        case 'player:pause':
          if (!session) return;
          await playerBridge.pause();
          break;

        case 'player:seek':
          if (!session) return;
          await playerBridge.seek(message.payload.position);
          break;

        case 'ping':
          socket.send(JSON.stringify({ type: 'pong' }));
          break;
      }
    } catch (error) {
      console.error('WebSocket message error:', error);
    }
  });

  socket.on('close', () => {
    unsubscribeFromUpdates(socket);
  });
}

const connectedSockets = new Set<WebSocket>();

function subscribeToUpdates(socket: WebSocket) {
  connectedSockets.add(socket);
}

function unsubscribeFromUpdates(socket: WebSocket) {
  connectedSockets.delete(socket);
}

// Broadcast updates to all connected clients
export function broadcast(message: WSMessage) {
  const data = JSON.stringify(message);
  connectedSockets.forEach(socket => {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(data);
    }
  });
}
```

## P2P Manager

```typescript
// services/p2p-manager.ts
import { box, randomBytes } from 'tweetnacl';
import { encodeBase64, decodeBase64 } from 'tweetnacl-util';

interface PeerConnection {
  peerId: string;
  publicKey: Uint8Array;
  sharedKey: Uint8Array;
}

export class P2PManager extends EventEmitter {
  private relayUrl: string;
  private ws: WebSocket | null = null;
  private keyPair: { publicKey: Uint8Array; secretKey: Uint8Array };
  private peers: Map<string, PeerConnection> = new Map();
  private connectionCode: string = '';

  constructor(relayUrl: string = 'wss://audiio-relay.fly.dev') {
    super();
    this.relayUrl = relayUrl;
    this.keyPair = box.keyPair();
  }

  async connect(): Promise<string> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.relayUrl);

      this.ws.onopen = () => {
        // Request a connection code
        this.ws?.send(JSON.stringify({
          type: 'register',
          publicKey: encodeBase64(this.keyPair.publicKey),
        }));
      };

      this.ws.onmessage = (event) => {
        const message = JSON.parse(event.data);
        this.handleMessage(message);

        if (message.type === 'registered') {
          this.connectionCode = message.code;
          resolve(this.connectionCode);
        }
      };

      this.ws.onerror = (error) => {
        reject(error);
      };
    });
  }

  private handleMessage(message: any) {
    switch (message.type) {
      case 'peer-connect':
        this.handlePeerConnect(message);
        break;

      case 'peer-message':
        this.handlePeerMessage(message);
        break;

      case 'peer-disconnect':
        this.peers.delete(message.peerId);
        this.emit('peer-disconnect', message.peerId);
        break;
    }
  }

  private handlePeerConnect(message: any) {
    const peerPublicKey = decodeBase64(message.publicKey);

    // Generate shared secret
    const sharedKey = box.before(peerPublicKey, this.keyPair.secretKey);

    this.peers.set(message.peerId, {
      peerId: message.peerId,
      publicKey: peerPublicKey,
      sharedKey,
    });

    this.emit('peer-connect', message.peerId);
  }

  private handlePeerMessage(message: any) {
    const peer = this.peers.get(message.peerId);
    if (!peer) return;

    // Decrypt message
    const nonce = decodeBase64(message.nonce);
    const encrypted = decodeBase64(message.data);
    const decrypted = box.open.after(encrypted, nonce, peer.sharedKey);

    if (!decrypted) {
      console.error('Failed to decrypt message');
      return;
    }

    const data = JSON.parse(new TextDecoder().decode(decrypted));
    this.emit('message', { peerId: message.peerId, data });
  }

  sendToPeer(peerId: string, data: any) {
    const peer = this.peers.get(peerId);
    if (!peer || !this.ws) return;

    // Encrypt message
    const nonce = randomBytes(box.nonceLength);
    const message = new TextEncoder().encode(JSON.stringify(data));
    const encrypted = box.after(message, nonce, peer.sharedKey);

    this.ws.send(JSON.stringify({
      type: 'send',
      peerId,
      nonce: encodeBase64(nonce),
      data: encodeBase64(encrypted),
    }));
  }

  disconnect() {
    this.ws?.close();
    this.peers.clear();
  }
}
```

## Device Manager

```typescript
// services/device-manager.ts
interface Device {
  id: string;
  name: string;
  publicKey: string;
  authorized: boolean;
  lastSeen: Date;
  createdAt: Date;
}

export class DeviceManager {
  private devices: Map<string, Device> = new Map();

  async registerDevice(name: string, publicKey: string): Promise<Device> {
    const id = crypto.randomUUID();

    const device: Device = {
      id,
      name,
      publicKey,
      authorized: false,
      lastSeen: new Date(),
      createdAt: new Date(),
    };

    this.devices.set(id, device);

    // Emit event for UI to prompt authorization
    this.emit('device-pending', device);

    return device;
  }

  authorizeDevice(deviceId: string): boolean {
    const device = this.devices.get(deviceId);
    if (!device) return false;

    device.authorized = true;
    this.emit('device-authorized', device);
    return true;
  }

  revokeDevice(deviceId: string): boolean {
    const device = this.devices.get(deviceId);
    if (!device) return false;

    this.devices.delete(deviceId);
    this.emit('device-revoked', device);
    return true;
  }

  getDevice(deviceId: string): Device | null {
    return this.devices.get(deviceId) || null;
  }

  getAuthorizedDevices(): Device[] {
    return Array.from(this.devices.values()).filter(d => d.authorized);
  }

  updateLastSeen(deviceId: string): void {
    const device = this.devices.get(deviceId);
    if (device) {
      device.lastSeen = new Date();
    }
  }
}
```

## Bridge to Main Process

```typescript
// services/library-bridge.ts
import { ipcRenderer } from 'electron';

export const libraryBridge = {
  async getLikes(): Promise<Track[]> {
    return ipcRenderer.invoke('library:getLikes');
  },

  async getPlaylists(): Promise<Playlist[]> {
    return ipcRenderer.invoke('library:getPlaylists');
  },

  async getPlaylist(id: string): Promise<Playlist> {
    return ipcRenderer.invoke('library:getPlaylist', id);
  },
};

export const playerBridge = {
  async getState(): Promise<PlayerState> {
    return ipcRenderer.invoke('player:getState');
  },

  async play(trackId?: string): Promise<void> {
    return ipcRenderer.invoke('player:play', trackId);
  },

  async pause(): Promise<void> {
    return ipcRenderer.invoke('player:pause');
  },

  async next(): Promise<void> {
    return ipcRenderer.invoke('player:next');
  },

  async previous(): Promise<void> {
    return ipcRenderer.invoke('player:previous');
  },

  async seek(position: number): Promise<void> {
    return ipcRenderer.invoke('player:seek', position);
  },

  async setVolume(volume: number): Promise<void> {
    return ipcRenderer.invoke('player:setVolume', volume);
  },

  async getQueue(): Promise<Track[]> {
    return ipcRenderer.invoke('player:getQueue');
  },

  async addToQueue(tracks: Track[], position?: 'next' | 'last'): Promise<void> {
    return ipcRenderer.invoke('player:addToQueue', { tracks, position });
  },

  async removeFromQueue(index: number): Promise<void> {
    return ipcRenderer.invoke('player:removeFromQueue', index);
  },
};
```

## Security

### E2E Encryption

All P2P messages are encrypted:

```typescript
function encrypt(data: any, sharedKey: Uint8Array): { nonce: string; data: string } {
  const nonce = randomBytes(box.nonceLength);
  const message = new TextEncoder().encode(JSON.stringify(data));
  const encrypted = box.after(message, nonce, sharedKey);

  return {
    nonce: encodeBase64(nonce),
    data: encodeBase64(encrypted),
  };
}

function decrypt(encrypted: string, nonce: string, sharedKey: Uint8Array): any {
  const decrypted = box.open.after(
    decodeBase64(encrypted),
    decodeBase64(nonce),
    sharedKey
  );

  if (!decrypted) throw new Error('Decryption failed');

  return JSON.parse(new TextDecoder().decode(decrypted));
}
```

### CORS Configuration

```typescript
fastify.register(cors, {
  origin: true, // Allow all origins for mobile access
  credentials: true,
});
```

## Related

- [Architecture](architecture.md) - System design
- [IPC Reference](ipc-reference.md) - Desktop IPC
- [REST API](../api/README.md) - Full API reference

