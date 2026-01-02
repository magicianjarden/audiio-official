# Mobile Server

Technical documentation for Audiio's mobile server internals.

## Overview

The mobile server enables remote control from phones/tablets. It runs inside the desktop app and provides:

- REST API for library and playback (60+ endpoints)
- WebSocket for real-time updates
- P2P connectivity via relay server (static room model)
- E2E encryption for security
- Two playback modes: Remote Control and Local Playback (Plex-like)
- Multi-layer authentication with device management
- Room-based security with optional password protection

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            Mobile Server                                     │
│                                                                             │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐  ┌─────────────┐ │
│  │  REST Routes  │  │   WebSocket   │  │  P2P Manager  │  │  Pairing    │ │
│  │   /api/...    │  │   /ws         │  │ (Static Room) │  │  Service    │ │
│  └───────┬───────┘  └───────┬───────┘  └───────┬───────┘  └──────┬──────┘ │
│          │                  │                  │                  │        │
│          └──────────────────┼──────────────────┼──────────────────┘        │
│                             │                  │                           │
│                    ┌────────▼────────┐  ┌──────▼──────┐                    │
│                    │   Auth Manager  │  │   Device    │                    │
│                    │                 │  │   Manager   │                    │
│                    └────────┬────────┘  └──────┬──────┘                    │
│                             │                  │                           │
│                    ┌────────▼──────────────────▼──────┐                    │
│                    │       Server Identity             │                    │
│                    │  (Persistent ID, Room Code, PWD) │                    │
│                    └───────────────────────────────────┘                    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Server Setup

```typescript
// packages/mobile/src/server/index.ts
import Fastify from 'fastify';
import websocket from '@fastify/websocket';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { registerRoutes } from './api/routes';
import { PairingService } from './services/pairing-service';
import { DeviceManager } from './services/device-manager';
import { P2PManager } from './services/p2p-manager';
import { ServerIdentityService } from './services/server-identity';

export async function createMobileServer(config: ServerConfig) {
  const fastify = Fastify({ logger: true });

  // Initialize services
  const serverIdentity = new ServerIdentityService();
  const deviceManager = new DeviceManager();
  const pairingService = new PairingService(deviceManager, serverIdentity);
  const p2pManager = new P2PManager(serverIdentity);

  // Middleware
  await fastify.register(cors, { origin: true });
  await fastify.register(rateLimit, { max: 100 });
  await fastify.register(websocket);

  // Register routes (60+ endpoints)
  await registerRoutes(fastify, {
    pairingService,
    deviceManager,
    p2pManager,
    serverIdentity
  });

  // Start server
  await fastify.listen({ port: config.port, host: '0.0.0.0' });

  return {
    fastify,
    pairingService,
    deviceManager,
    p2pManager,
    serverIdentity,
    close: () => fastify.close(),
  };
}
```

**Default Configuration:**
```typescript
{
  port: 8484,              // Auto-increment if in use
  rateLimit: 100,          // 100 requests/minute
  maxStreams: 3,           // 3 concurrent audio streams
  streamQuality: 'medium', // Quality for mobile streaming
  codeExpiration: 5        // Pairing code expires in 5 minutes
}
```

## Static Room Model

The mobile server uses a **static room model** for P2P connections:

```
Desktop (Host)
     │
     ├── Persistent Server ID (UUID, generated once)
     ├── Deterministic Room Code (derived from Server ID)
     ├── Optional Password (SHA-512 hashed)
     │
     ▼
Relay Server (wss://audiio-relay.fly.dev)
     │
     ├── Room ID → Desktop mapping
     ├── Password verification (if enabled)
     ├── E2E encrypted message relay
     │
     ▼
Mobile (Client)
     │
     ├── Enter room code + optional password
     ├── Receive desktop's public key
     └── E2E encrypted tunnel established
```

### Server Identity

```typescript
// services/server-identity.ts
interface ServerIdentity {
  serverId: string;      // Persistent UUID
  serverName: string;    // User's device name
  relayCode: string;     // ADJECTIVE-NOUN-NUMBER format
  passwordHash?: string; // SHA-512 hashed password
}

export class ServerIdentityService {
  private identity: ServerIdentity;
  private storagePath: string;

  constructor() {
    this.storagePath = path.join(app.getPath('userData'), 'server-identity.json');
    this.identity = this.loadOrCreate();
  }

  private loadOrCreate(): ServerIdentity {
    if (fs.existsSync(this.storagePath)) {
      return JSON.parse(fs.readFileSync(this.storagePath, 'utf8'));
    }

    const identity: ServerIdentity = {
      serverId: crypto.randomUUID(),
      serverName: os.hostname(),
      relayCode: this.generateRelayCode(),
    };

    this.save(identity);
    return identity;
  }

  private generateRelayCode(): string {
    // Deterministic from server ID
    const adjectives = ['SWIFT', 'BLUE', 'HAPPY', ...];
    const nouns = ['TIGER', 'EAGLE', 'WOLF', ...];
    const hash = crypto.createHash('sha256').update(this.serverId).digest();

    return [
      adjectives[hash[0] % adjectives.length],
      nouns[hash[1] % nouns.length],
      (hash[2] % 100).toString().padStart(2, '0')
    ].join('-');
  }

  // Password management
  setPassword(password: string): void {
    this.identity.passwordHash = crypto
      .createHash('sha512')
      .update(password)
      .digest('hex');
    this.save();
  }

  removePassword(): void {
    delete this.identity.passwordHash;
    this.save();
  }

  hasPassword(): boolean {
    return !!this.identity.passwordHash;
  }

  validatePassword(password: string): boolean {
    const hash = crypto.createHash('sha512').update(password).digest('hex');
    return hash === this.identity.passwordHash;
  }

  // Room ID regeneration (security reset)
  regenerate(): void {
    this.identity.serverId = crypto.randomUUID();
    this.identity.relayCode = this.generateRelayCode();
    delete this.identity.passwordHash;
    this.save();
  }
}
```

## Multi-Layer Authentication

### Authentication Layers

| Layer | Purpose | Lifetime |
|-------|---------|----------|
| Access Token | Legacy quick access | In-memory (session) |
| Pairing Code | Initial device pairing | 5 minutes |
| Device Token | Persistent device auth | Configurable (default: never expires) |
| Room Password | Optional room protection | Persistent |

### Pairing Service

```typescript
// services/pairing-service.ts
export class PairingService {
  private deviceManager: DeviceManager;
  private serverIdentity: ServerIdentityService;
  private currentCode: string;
  private codeExpiresAt: number;

  generatePairingCode(): { code: string; expiresAt: number } {
    // Generate fresh WORD-WORD-NUMBER code
    const adjectives = ['SWIFT', 'BLUE', 'HAPPY', ...];
    const nouns = ['TIGER', 'EAGLE', 'WOLF', ...];

    this.currentCode = [
      adjectives[Math.floor(Math.random() * adjectives.length)],
      nouns[Math.floor(Math.random() * nouns.length)],
      Math.floor(Math.random() * 100).toString().padStart(2, '0')
    ].join('-');

    this.codeExpiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes

    return { code: this.currentCode, expiresAt: this.codeExpiresAt };
  }

  validateCode(code: string): boolean {
    if (Date.now() > this.codeExpiresAt) return false;
    return code.toUpperCase() === this.currentCode;
  }

  async pairDevice(code: string, deviceInfo: DeviceInfo): Promise<PairResult> {
    // Validate code
    if (!this.validateCode(code)) {
      return { success: false, error: 'Invalid or expired code' };
    }

    // Register device
    const device = await this.deviceManager.registerDevice(deviceInfo);

    // Generate device token
    const token = crypto.randomBytes(32).toString('hex');
    await this.deviceManager.setDeviceToken(device.id, token);

    // Consume code (one-time use)
    this.currentCode = '';

    return {
      success: true,
      deviceId: device.id,
      deviceToken: `${device.id}:${token}`,
    };
  }
}
```

### Device Manager

```typescript
// services/device-manager.ts
interface Device {
  id: string;
  name: string;
  userAgent: string;
  tokenHash: string;
  createdAt: Date;
  lastAccessAt: Date;
  expiresAt?: Date;
  revoked: boolean;
}

export class DeviceManager {
  private devices: Map<string, Device> = new Map();
  private storagePath: string;

  constructor() {
    this.storagePath = path.join(app.getPath('userData'), 'devices.json');
    this.load();
  }

  async registerDevice(info: DeviceInfo): Promise<Device> {
    const device: Device = {
      id: `device_${crypto.randomBytes(8).toString('hex')}`,
      name: info.deviceName,
      userAgent: info.userAgent,
      tokenHash: '',
      createdAt: new Date(),
      lastAccessAt: new Date(),
      revoked: false,
    };

    this.devices.set(device.id, device);
    this.save();
    return device;
  }

  async setDeviceToken(deviceId: string, token: string): Promise<void> {
    const device = this.devices.get(deviceId);
    if (!device) throw new Error('Device not found');

    device.tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    this.save();
  }

  validateDeviceToken(deviceToken: string): Device | null {
    const [deviceId, token] = deviceToken.split(':');
    const device = this.devices.get(deviceId);

    if (!device || device.revoked) return null;
    if (device.expiresAt && device.expiresAt < new Date()) return null;

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    if (tokenHash !== device.tokenHash) return null;

    // Update last access
    device.lastAccessAt = new Date();
    this.save();

    return device;
  }

  getAuthorizedDevices(): Device[] {
    return Array.from(this.devices.values())
      .filter(d => !d.revoked);
  }

  revokeDevice(deviceId: string): void {
    const device = this.devices.get(deviceId);
    if (device) {
      device.revoked = true;
      this.save();
    }
  }

  revokeAllDevices(): number {
    let count = 0;
    for (const device of this.devices.values()) {
      if (!device.revoked) {
        device.revoked = true;
        count++;
      }
    }
    this.save();
    return count;
  }
}
```

### Auth Middleware

```typescript
// middleware/auth.ts
export async function authMiddleware(
  request: FastifyRequest,
  reply: FastifyReply,
  services: Services
) {
  const { pairingService, accessManager } = services;

  // Public routes (no auth required)
  const publicPaths = ['/api/health', '/api/auth/pair', '/api/auth/login', '/api/auth/device'];
  if (publicPaths.some(p => request.url.startsWith(p))) {
    return;
  }

  // P2P requests (authenticated at P2P layer)
  if (request.headers['x-p2p-request'] === 'true') {
    return;
  }

  // Extract token
  const token = extractToken(request);
  if (!token) {
    return reply.status(401).send({ error: 'Unauthorized' });
  }

  // Try device token first
  const device = pairingService.validateDeviceToken(token);
  if (device) {
    request.device = device;
    return;
  }

  // Try legacy access token
  if (accessManager.validateToken(token)) {
    return;
  }

  return reply.status(401).send({ error: 'Invalid or expired token' });
}

function extractToken(request: FastifyRequest): string | null {
  // Query parameter
  const queryToken = (request.query as any).token;
  if (queryToken) return queryToken;

  // Authorization header
  const authHeader = request.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }

  return null;
}
```

## P2P Manager

```typescript
// services/p2p-manager.ts
export class P2PManager extends EventEmitter {
  private relayUrl: string;
  private ws: WebSocket | null = null;
  private keyPair: nacl.BoxKeyPair;
  private peers: Map<string, Peer> = new Map();
  private serverIdentity: ServerIdentityService;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;

  constructor(serverIdentity: ServerIdentityService) {
    super();
    this.serverIdentity = serverIdentity;
    this.keyPair = nacl.box.keyPair();
    this.relayUrl = 'wss://audiio-relay.fly.dev';
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.relayUrl);

      this.ws.onopen = () => {
        this.reconnectAttempts = 0;

        // Register with room code
        this.ws?.send(JSON.stringify({
          type: 'register',
          roomId: this.serverIdentity.getRelayCode(),
          publicKey: encodeBase64(this.keyPair.publicKey),
          hasPassword: this.serverIdentity.hasPassword(),
        }));
      };

      this.ws.onmessage = (event) => {
        const message = JSON.parse(event.data);
        this.handleMessage(message);

        if (message.type === 'registered') {
          resolve();
        }
      };

      this.ws.onclose = () => {
        this.handleDisconnect();
      };

      this.ws.onerror = (error) => {
        reject(error);
      };
    });
  }

  private handleMessage(message: any): void {
    switch (message.type) {
      case 'join-request':
        this.handleJoinRequest(message);
        break;

      case 'peer-joined':
        this.handlePeerJoined(message);
        break;

      case 'peer-left':
        this.peers.delete(message.peerId);
        this.emit('peer-left', message.peerId);
        break;

      case 'data':
        this.handleEncryptedData(message);
        break;

      case 'api-request':
        this.handleApiRequest(message);
        break;
    }
  }

  private handleJoinRequest(message: any): void {
    // Verify password if required
    if (this.serverIdentity.hasPassword()) {
      if (!message.passwordHash ||
          !this.serverIdentity.validatePasswordHash(message.passwordHash)) {
        this.ws?.send(JSON.stringify({
          type: 'join-denied',
          peerId: message.peerId,
          reason: 'Invalid password',
        }));
        return;
      }
    }

    // Accept join
    this.ws?.send(JSON.stringify({
      type: 'join-accepted',
      peerId: message.peerId,
      publicKey: encodeBase64(this.keyPair.publicKey),
    }));
  }

  private handlePeerJoined(message: any): void {
    const peerPublicKey = decodeBase64(message.publicKey);
    const sharedKey = nacl.box.before(peerPublicKey, this.keyPair.secretKey);

    this.peers.set(message.peerId, {
      id: message.peerId,
      publicKey: peerPublicKey,
      sharedKey,
      deviceName: message.deviceName,
    });

    // Send welcome message with auth token
    this.sendToPeer(message.peerId, {
      type: 'welcome',
      authToken: this.generatePeerToken(message.peerId),
      localUrl: this.getLocalUrl(),
    });

    this.emit('peer-joined', message.peerId, message.deviceName);
  }

  private async handleApiRequest(message: any): Promise<void> {
    const peer = this.peers.get(message.peerId);
    if (!peer) return;

    // Decrypt request
    const request = this.decrypt(message.data, message.nonce, peer.sharedKey);

    // Execute API request
    const response = await this.executeApiRequest(request);

    // Send encrypted response
    this.sendToPeer(message.peerId, {
      type: 'api-response',
      requestId: message.requestId,
      ...response,
    });
  }

  sendToPeer(peerId: string, data: any): void {
    const peer = this.peers.get(peerId);
    if (!peer || !this.ws) return;

    const nonce = nacl.randomBytes(nacl.box.nonceLength);
    const message = new TextEncoder().encode(JSON.stringify(data));
    const encrypted = nacl.box.after(message, nonce, peer.sharedKey);

    this.ws.send(JSON.stringify({
      type: 'data',
      peerId,
      nonce: encodeBase64(nonce),
      data: encodeBase64(encrypted),
    }));
  }

  private handleDisconnect(): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      setTimeout(() => this.connect(), 3000);
    }
  }

  // Room security management
  setPassword(password: string): void {
    this.serverIdentity.setPassword(password);
    this.reconnect();
  }

  removePassword(): void {
    this.serverIdentity.removePassword();
    this.reconnect();
  }

  regenerateRoomId(): { newCode: string; revokedDevices: number } {
    const revokedCount = this.deviceManager.revokeAllDevices();
    this.disconnect();
    this.serverIdentity.regenerate();
    this.connect();

    return {
      newCode: this.serverIdentity.getRelayCode(),
      revokedDevices: revokedCount,
    };
  }
}
```

## Playback Modes

The mobile server supports two playback modes:

### Remote Control Mode

Commands are sent to the desktop, which plays the audio:

```typescript
// POST /api/playback/play
app.post('/api/playback/play', async (request) => {
  const { track } = request.body;
  await orchestrators.playback.play(track);
  return { success: true };
});
```

### Local Playback Mode (Plex-like)

Stream URL is resolved and returned to mobile for local playback:

```typescript
// POST /api/stream/resolve
app.post('/api/stream/resolve', async (request) => {
  const { track, quality } = request.body;

  // Resolve stream without triggering desktop playback
  const streamInfo = await orchestrators.trackResolver.resolveStream(track, quality);

  if (!streamInfo) {
    return reply.status(404).send({ error: 'Stream not found' });
  }

  return {
    url: streamInfo.url,
    format: streamInfo.format,
    quality: streamInfo.quality,
    expiresAt: streamInfo.expiresAt,
  };
});
```

## REST API Routes (60+ Endpoints)

### Authentication

```http
POST /api/auth/pair              # Pair device with pairing code
GET  /api/auth/pair/check        # Check if code is valid
POST /api/auth/login             # Login with password
POST /api/auth/device            # Authenticate with device token
POST /api/auth/refresh           # Refresh device token
POST /api/auth/logout            # Logout and revoke device
GET  /api/auth/devices           # List authorized devices
DELETE /api/auth/devices/:id     # Revoke specific device
GET  /api/auth/passphrase        # Get pairing code
POST /api/auth/passphrase/regenerate  # Generate new code
GET  /api/auth/settings          # Get auth settings
POST /api/auth/settings          # Update auth settings
```

### Playback Control

```http
POST /api/playback/play          # Start playback
POST /api/playback/pause         # Pause playback
POST /api/playback/resume        # Resume playback
POST /api/playback/seek          # Seek to position
POST /api/playback/next          # Next track
POST /api/playback/previous      # Previous track
POST /api/playback/volume        # Set volume
POST /api/playback/shuffle       # Toggle shuffle
POST /api/playback/repeat        # Cycle repeat mode
GET  /api/playback/state         # Get current state
```

### Audio Streaming

```http
POST /api/stream/resolve         # Resolve stream URL (for local playback)
GET  /api/stream/:trackId        # Stream audio directly
```

### Search & Discovery

```http
GET  /api/search                 # Search tracks/artists/albums
GET  /api/artist/:id             # Get artist details
GET  /api/album/:id              # Get album details
GET  /api/trending               # Get trending content
GET  /api/discover               # Get personalized home content
GET  /api/discover/sections      # Get structured sections
```

### Library Management

```http
GET  /api/library/likes          # Get liked tracks
POST /api/library/likes          # Like a track
DELETE /api/library/likes/:id    # Unlike track
GET  /api/library/likes/:id      # Check if liked
GET  /api/library/dislikes       # Get disliked tracks
POST /api/library/dislikes       # Dislike track
DELETE /api/library/dislikes/:id # Remove dislike
GET  /api/library/playlists      # List playlists
POST /api/library/playlists      # Create playlist
GET  /api/library/playlists/:id  # Get playlist
PUT  /api/library/playlists/:id  # Rename playlist
DELETE /api/library/playlists/:id    # Delete playlist
POST /api/library/playlists/:id/tracks    # Add track
DELETE /api/library/playlists/:id/tracks/:trackId  # Remove track
```

### Lyrics & Translation

```http
GET  /api/lyrics                 # Get lyrics for track
POST /api/translate              # Translate text
```

### Plugins

```http
GET  /api/addons                 # List all addons
GET  /api/addons/:id/settings    # Get addon settings
POST /api/addons/:id/settings    # Update settings
POST /api/addons/:id/enabled     # Toggle addon
POST /api/addons/order           # Reorder addons
GET  /api/addons/priorities      # Get addon priorities
```

### ML/Recommendations

```http
GET  /api/algo/status            # ML service status
GET  /api/algo/recommendations   # Get personalized recommendations
GET  /api/algo/similar/:trackId  # Get similar tracks
POST /api/algo/event             # Record user event
GET  /api/algo/features/:trackId # Get audio features
```

### Sessions & Access

```http
GET  /api/sessions               # List active sessions
DELETE /api/sessions/:id         # End session
POST /api/access/rotate          # Rotate access token
GET  /api/access/info            # Get access configuration
POST /api/access/refresh         # Refresh pairing code
GET  /api/access/relay           # Get relay URL
POST /api/access/relay           # Set custom relay URL
```

### Room Security

```http
POST /api/room/password          # Set room password
DELETE /api/room/password        # Remove password
GET  /api/room/security          # Get security info
POST /api/room/regenerate        # Regenerate room ID
```

## WebSocket Handler

```typescript
// websocket/handler.ts
fastify.register(async (app) => {
  app.get('/ws', { websocket: true }, (socket, req) => {
    let authenticated = false;

    socket.on('message', async (data) => {
      const message = JSON.parse(data.toString());

      switch (message.type) {
        case 'auth':
          const device = pairingService.validateDeviceToken(message.token);
          if (device) {
            authenticated = true;
            socket.send(JSON.stringify({ type: 'auth:success' }));
            subscribeToPlaybackUpdates(socket);
          } else {
            socket.send(JSON.stringify({ type: 'auth:failed' }));
            socket.close();
          }
          break;

        case 'playback:command':
          if (!authenticated) return;
          await handlePlaybackCommand(message);
          break;

        case 'ping':
          socket.send(JSON.stringify({ type: 'pong' }));
          break;
      }
    });

    socket.on('close', () => {
      unsubscribeFromPlaybackUpdates(socket);
    });
  });
});

// Broadcast playback state to all connected clients
function broadcastPlaybackState(state: PlaybackState) {
  const message = JSON.stringify({
    type: 'playback:sync',
    state,
  });

  connectedSockets.forEach(socket => {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(message);
    }
  });
}
```

## Orchestrator Integration

The mobile server delegates to desktop orchestrators:

```typescript
// Playback
orchestrators.playback.play(track)
orchestrators.playback.pause()
orchestrators.playback.resume()
orchestrators.playback.seek(position)
orchestrators.playback.next()
orchestrators.playback.previous()
orchestrators.playback.setVolume(volume)
orchestrators.playback.getState()

// Search & Metadata
orchestrators.search.search(query, options)
orchestrators.metadata.getArtist(id, source)
orchestrators.metadata.getAlbum(id, source)
orchestrators.metadata.getCharts(limit)

// Track Resolution
orchestrators.trackResolver.resolveStream(track, quality)

// ML Service
orchestrators.mlService.isAlgorithmLoaded()
orchestrators.mlService.getRecommendations(count)
orchestrators.mlService.getSimilarTracks(trackId, count)
orchestrators.mlService.recordEvent(event)

// Library Bridge
orchestrators.libraryBridge.getLikedTracks()
orchestrators.libraryBridge.likeTrack(track)
orchestrators.libraryBridge.getPlaylists()
```

## Security

### E2E Encryption

All P2P messages are encrypted using NaCl:

- **Key Exchange**: X25519 (Curve25519 ECDH)
- **Encryption**: XSalsa20-Poly1305 (authenticated encryption)
- **Key Size**: 256 bits
- **Nonce Size**: 192 bits (24 bytes)

### Token Types

| Token | Format | Storage | Validation |
|-------|--------|---------|------------|
| Access Token | 32 random chars | In-memory | Direct comparison |
| Device Token | `deviceId:token` | Hashed (SHA-256) | Hash comparison |
| Pairing Code | WORD-WORD-NN | Temporary | Case-insensitive match |
| Room Password | User-defined | Hashed (SHA-512) | Hash comparison |

### CORS & Rate Limiting

```typescript
fastify.register(cors, {
  origin: true,
  credentials: true,
});

fastify.register(rateLimit, {
  max: 100,           // 100 requests
  timeWindow: '1 min', // per minute
});
```

## Mobile Web Frontend

```
src/web/
├── App.tsx                  # Main router
├── pages/
│   ├── HomePage.tsx         # Discover/trending
│   ├── SearchPage.tsx       # Search interface
│   ├── NowPlayingPage.tsx   # Full player
│   ├── QueuePage.tsx        # Queue management
│   ├── LyricsPage.tsx       # Lyrics display
│   ├── LibraryPage.tsx      # Likes/playlists
│   ├── PlaylistDetailPage.tsx
│   ├── ArtistPage.tsx
│   ├── AlbumPage.tsx
│   ├── SettingsPage.tsx
│   ├── PluginsPage.tsx
│   └── AuthPage.tsx         # Login/pairing
├── components/
│   ├── MiniPlayer.tsx       # Compact player bar
│   ├── FullPlayer.tsx       # Expanded player
│   ├── TrackList.tsx        # Track list renderer
│   └── ...
├── stores/
│   ├── auth-store.ts        # Authentication
│   ├── player-store.ts      # Playback + WebSocket
│   ├── p2p-store.ts         # P2P relay connection
│   ├── library-store.ts     # Library sync
│   └── ...
└── utils/
    ├── artwork.ts           # Image URL handling
    └── haptics.ts           # Vibration feedback
```

## Related

- [Architecture](architecture.md) - System design
- [IPC Reference](ipc-reference.md) - Desktop IPC
- [REST API](../api/README.md) - Full API reference
- [Relay](../relay/README.md) - Relay server documentation
