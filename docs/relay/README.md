# Audiio Relay

A secure WebSocket relay server enabling remote mobile access to your Audiio desktop library from anywhere in the world.

## Overview

The relay enables mobile devices to connect to your desktop without exposing your local network. It implements a **static room model** where each desktop gets a persistent room ID that never changes. All communication is end-to-end encrypted - the relay only sees encrypted blobs.

```
┌─────────────┐          ┌─────────────┐          ┌─────────────┐
│   Desktop   │◄────────►│   Relay     │◄────────►│   Mobile    │
│   (Host)    │  E2E     │   Server    │  E2E     │   (Client)  │
│             │ Encrypted│             │ Encrypted│             │
│  Static     │          │  Rooms      │          │  Joins by   │
│  Room ID    │          │  persist    │          │  room code  │
└─────────────┘          └─────────────┘          └─────────────┘
```

## Quick Start

### Using the Public Relay

The default relay is hosted at `wss://audiio-relay.fly.dev`. No setup required!

### Self-Hosting

```bash
# Install
npm install @audiio/relay

# Run
npx audiio-relay --port 9484

# Or with Docker
docker run -p 9484:9484 audiio/relay
```

## Static Room Model

Unlike dynamic relay systems where codes expire, Audiio uses a **static room model**:

| Feature | Description |
|---------|-------------|
| **Persistent Room IDs** | Same desktop always has same room code |
| **No Expiry** | Rooms don't expire while desktop is active |
| **Pair Once** | Mobile devices pair once, connect forever |
| **24-Hour Persistence** | Rooms persist 24 hours after desktop goes offline |
| **Offline Queuing** | Mobile connections queue until desktop returns |

### How Room IDs Work

```
┌─────────────────────────────────────────────────────────────────┐
│                     Desktop First Run                           │
│                                                                 │
│  1. Generate UUID: "a1b2c3d4-e5f6-..."                         │
│  2. Derive room code from UUID: "SWIFT-EAGLE-42"               │
│  3. Store in server-identity.json (persistent)                 │
│                                                                 │
│  Same UUID → Same room code → Same room ID forever             │
└─────────────────────────────────────────────────────────────────┘
```

Room codes are deterministically derived from a UUID, ensuring the same computer always gets the same code.

## Connection Codes

Codes are designed to be:

- **Memorable**: Two words + two digits (e.g., `BLUE-TIGER-42`)
- **Speakable**: Easy to tell someone over the phone
- **Persistent**: Same code forever (unless regenerated)
- **Case-insensitive**: `blue-tiger-42` = `BLUE-TIGER-42`
- **~81,000 combinations**: 30 adjectives x 30 nouns x 90 numbers

### Code Generation

```typescript
// Random (for temporary pairing codes)
function generateCode(): string {
  const adjective = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  const number = Math.floor(Math.random() * 90) + 10;
  return `${adjective}-${noun}-${number}`;
}

// Deterministic (for persistent room IDs)
function generateRelayCode(serverId: string): string {
  const seed = serverId.replace(/-/g, '').substring(0, 8);
  const seedNum = parseInt(seed, 16);

  const adjIndex = seedNum % ADJECTIVES.length;
  const nounIndex = Math.floor(seedNum / ADJECTIVES.length) % NOUNS.length;
  const number = (seedNum % 90) + 10;

  return `${ADJECTIVES[adjIndex]}-${NOUNS[nounIndex]}-${number}`;
}
```

## Password Protection

Rooms can optionally require a password for additional security.

### Setting a Password (Desktop)

```typescript
import { hash } from '@audiio/relay';

// Hash password locally before sending to relay
const passwordHash = hash(password); // SHA-512

// Register with password
client.register({
  publicKey: myPublicKey,
  roomId: 'SWIFT-EAGLE-42',
  passwordHash: passwordHash,
  serverName: 'My Desktop'
});
```

### Joining with Password (Mobile)

```typescript
// First join attempt (no password)
client.join({ roomId: 'SWIFT-EAGLE-42', publicKey, deviceName });

// If room requires password, receive 'auth-required' message
client.on('auth-required', ({ roomId, serverName }) => {
  // Prompt user for password
  const password = await promptPassword();
  const passwordHash = hash(password);

  // Rejoin with password
  client.join({ roomId, publicKey, deviceName, passwordHash });
});
```

### Security Model

- Passwords are **SHA-512 hashed** before transmission
- Relay **never sees plaintext** passwords
- Only hash comparison happens on relay
- Password can be changed anytime by re-registering

## Connection Flow

### Desktop (Host) Flow

```
1. Desktop connects to relay WebSocket
   ↓
2. Desktop sends 'register' with:
   - publicKey: X25519 key for E2E encryption
   - roomId: persistent room ID (e.g., SWIFT-EAGLE-42)
   - passwordHash: optional SHA-512 password hash
   - serverName: human-friendly name
   ↓
3. Relay creates or updates room:
   - New room: creates with static ID
   - Existing room: updates desktopId, marks online
   ↓
4. Relay sends 'registered' confirmation
   ↓
5. Desktop waits for mobile peers
```

### Mobile (Client) Flow

```
1. Mobile connects to relay WebSocket
   ↓
2. Mobile sends 'join' with:
   - roomId: the room code
   - publicKey: X25519 key
   - deviceName: device identifier
   - passwordHash: if room requires auth
   ↓
3. Relay validates:
   - Room exists?
   - Password correct (if required)?
   - Desktop online?
   ↓
4a. Password required but missing:
    → 'auth-required' message
    → Mobile prompts user
    → Mobile rejoins with hash
   ↓
4b. Desktop offline:
    → Add peer to room anyway
    → 'DESKTOP_OFFLINE' error
    → Mobile waits or retries
    → Notified when desktop returns
   ↓
5. Success:
   → Mobile receives 'joined' with desktop's publicKey
   → Desktop receives 'peer-joined'
   → Both have keys for E2E encryption
```

## Client Usage

### Desktop (Node.js)

```typescript
import { RelayClient } from '@audiio/relay';

const client = new RelayClient({
  serverUrl: 'wss://audiio-relay.fly.dev',
  autoReconnect: true
});

// Connect and register
await client.connect();
client.register({
  publicKey: myKeyPair.publicKey,
  roomId: 'SWIFT-EAGLE-42',
  serverName: 'My MacBook Pro'
});

client.on('registered', ({ roomId, hasPassword }) => {
  console.log(`Room ${roomId} ready, password: ${hasPassword}`);
});

// Handle mobile connections
client.on('peerJoined', (peer) => {
  console.log(`${peer.deviceName} connected!`);
  client.sendToPeer(peer.id, { type: 'welcome' });
});

// Handle messages from mobile
client.on('message', (peerId, message) => {
  // Message is already decrypted
  console.log('Got message:', message);
});
```

### Mobile (Browser)

```typescript
import { RelayClient, generateKeyPair, hash } from '@audiio/relay';

const myKeys = generateKeyPair();
const client = new RelayClient({ serverUrl: 'wss://audiio-relay.fly.dev' });

await client.connect();

// Join room
client.join({
  roomId: 'SWIFT-EAGLE-42',
  publicKey: myKeys.publicKey,
  deviceName: 'iPhone'
});

// Handle password requirement
client.on('auth-required', async ({ serverName }) => {
  const password = await promptUser(`Enter password for ${serverName}`);
  client.join({
    roomId: 'SWIFT-EAGLE-42',
    publicKey: myKeys.publicKey,
    deviceName: 'iPhone',
    passwordHash: hash(password)
  });
});

// Connected to desktop
client.on('joined', ({ desktopPublicKey }) => {
  // Can now send encrypted messages
  client.sendToDesktop({ type: 'api-request', path: '/api/playback/state' });
});
```

## Server API

### Configuration

```typescript
interface RelayServerConfig {
  port: number;              // Default: 9484
  host: string;              // Default: '0.0.0.0'
  maxPeersPerRoom: number;   // Default: 5
  roomCleanupMs: number;     // Default: 86400000 (24 hours)
  tls?: {
    cert: string;
    key: string;
  };
}
```

### Message Types

| Type | Direction | Description |
|------|-----------|-------------|
| `register` | Desktop → Relay | Register with room ID and optional password |
| `registered` | Relay → Desktop | Confirm with roomId and hasPassword flag |
| `join` | Mobile → Relay | Join room with code |
| `joined` | Relay → Mobile | Confirm with desktop's public key |
| `auth-required` | Relay → Mobile | Room requires password |
| `peer-joined` | Relay → Desktop | New mobile connection |
| `peer-left` | Relay → All | Disconnection notification |
| `data` | Any → Relay | E2E encrypted message to forward |
| `ping/pong` | Any | Keep-alive heartbeat |
| `error` | Relay → Client | Error notification |

### Error Codes

| Code | Description |
|------|-------------|
| `ROOM_NOT_FOUND` | Room ID doesn't exist |
| `INVALID_PASSWORD` | Password hash doesn't match |
| `DESKTOP_OFFLINE` | Desktop not currently connected |
| `ROOM_FULL` | Maximum peers reached |
| `INVALID_MESSAGE` | Malformed message |

### Health Check

```bash
curl https://audiio-relay.fly.dev/health

# Response:
{
  "status": "ok",
  "rooms": 3,
  "clients": 7,
  "uptime": 86400
}
```

## Encryption

All data messages are encrypted using **NaCl** (Networking and Cryptography Library):

| Component | Algorithm |
|-----------|-----------|
| Key Exchange | X25519 (Curve25519 ECDH) |
| Encryption | XSalsa20-Poly1305 (authenticated) |
| Key Size | 256 bits |
| Nonce Size | 192 bits (24 bytes) |
| Password Hashing | SHA-512 |

### Crypto Utilities

```typescript
import {
  generateKeyPair,
  encrypt,
  decrypt,
  decryptJSON,
  computeSharedSecret,
  hash,
  hashPassword,
  fingerprint
} from '@audiio/relay';

// Generate key pair
const myKeys = generateKeyPair();
console.log('Public key:', myKeys.publicKey);

// Encrypt message for recipient
const encrypted = encrypt(
  JSON.stringify({ type: 'hello' }),
  recipientPublicKey,
  myKeys.secretKey
);

// Decrypt received message
const decrypted = decrypt(
  encrypted,
  senderPublicKey,
  myKeys.secretKey
);

// Hash password
const passwordHash = hash('my-secret-password');
```

## Deployment

### Fly.io (Recommended)

```bash
cd packages/relay
fly launch --name my-audiio-relay
fly deploy
```

### Docker

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY dist/ ./dist/
EXPOSE 8080
ENV PORT=8080
CMD ["node", "dist/server/index.js"]
```

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `9484` |
| `HOST` | Bind address | `0.0.0.0` |
| `MAX_PEERS` | Max mobile devices per room | `5` |
| `ROOM_CLEANUP_MS` | Time before cleaning abandoned rooms | `86400000` (24h) |

## Security Considerations

| Feature | Description |
|---------|-------------|
| **E2E Encryption** | Relay never sees plaintext data |
| **Forward Secrecy** | New key pairs per session |
| **Password Hashing** | SHA-512, relay only sees hashes |
| **No Storage** | Relay keeps no persistent data |
| **Rate Limiting** | Built-in protection against abuse |
| **Room Isolation** | Peers can only access their room |

## API Reference

### RelayClient

```typescript
class RelayClient {
  constructor(config: RelayClientConfig);

  // Connection
  connect(): Promise<void>;
  disconnect(): void;
  isConnected(): boolean;

  // Desktop operations
  register(options: RegisterOptions): void;

  // Mobile operations
  join(options: JoinOptions): void;

  // Messaging
  sendToPeer(peerId: string, message: unknown): void;
  sendToDesktop(message: unknown): void;
  broadcast(message: unknown): void;

  // State
  getRoomId(): string | null;
  getPeers(): ConnectedPeer[];

  // Events
  on(event: 'connected', cb: () => void): () => void;
  on(event: 'registered', cb: (info: RegisteredInfo) => void): () => void;
  on(event: 'joined', cb: (info: JoinedInfo) => void): () => void;
  on(event: 'auth-required', cb: (info: AuthRequiredInfo) => void): () => void;
  on(event: 'peerJoined', cb: (peer: ConnectedPeer) => void): () => void;
  on(event: 'peerLeft', cb: (peerId: string) => void): () => void;
  on(event: 'message', cb: (peerId: string, message: unknown) => void): () => void;
  on(event: 'error', cb: (error: RelayError) => void): () => void;
}
```

### RelayServer

```typescript
class RelayServer {
  constructor(config?: RelayServerConfig);

  // Lifecycle
  start(): Promise<void>;
  stop(): Promise<void>;

  // Statistics
  getStats(): { rooms: number; clients: number; uptime: number };
}
```

### Types

```typescript
interface RegisterOptions {
  publicKey: string;
  roomId: string;
  passwordHash?: string;
  serverName?: string;
}

interface JoinOptions {
  roomId: string;
  publicKey: string;
  deviceName: string;
  passwordHash?: string;
}

interface ConnectedPeer {
  id: string;
  deviceName: string;
  publicKey: string;
  connectedAt: number;
}

interface RelayRoom {
  roomId: string;
  desktopId: string | null;
  desktopPublicKey: string;
  passwordHash?: string;
  serverName?: string;
  peers: Map<string, ConnectedPeer>;
  createdAt: number;
  lastDesktopSeen: number;
  isDesktopOnline: boolean;
}
```

## Comparison: Static vs Dynamic Model

| Aspect | Static (Current) | Dynamic (Legacy) |
|--------|------------------|------------------|
| Room ID | Persistent, derived from UUID | Random each connection |
| Code Expiry | No expiry while active | 5-minute lifetime |
| Room Lifecycle | Persists for reconnection | Deleted when empty |
| Password Support | Full SHA-512 support | Not implemented |
| Desktop Offline | Room persists 24h | Room deleted |
| Mobile UX | Pair once, connect forever | New code each time |

## Next Steps

- [Mobile Server](../development/mobile-server.md) - How mobile uses the relay
- [Architecture](../development/architecture.md) - System design
- [API Reference](../api/README.md) - REST API endpoints
