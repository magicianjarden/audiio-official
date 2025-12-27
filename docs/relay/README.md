# Audiio Relay

A lightweight WebSocket relay server for secure remote mobile access to your Audiio desktop library.

## Overview

The relay enables mobile devices to connect to your desktop from anywhere, without exposing your local network. All communication is end-to-end encrypted - the relay only sees encrypted blobs.

```
┌─────────────┐          ┌─────────────┐          ┌─────────────┐
│   Desktop   │◄────────►│   Relay     │◄────────►│   Mobile    │
│   (Host)    │  E2E     │   Server    │  E2E     │   (Client)  │
└─────────────┘  Encrypted└─────────────┘ Encrypted└─────────────┘
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

## How It Works

1. **Desktop registers** with the relay and receives a memorable connection code (e.g., `SWIFT-EAGLE-42`)
2. **Mobile joins** using the code from the web portal
3. **Relay connects them** and exchanges public keys for E2E encryption
4. **All messages** are encrypted client-side using NaCl (X25519 key exchange + XSalsa20-Poly1305)
5. **Audio streams** directly from desktop to mobile through the encrypted tunnel

## Connection Codes

Codes are designed to be:

- **Memorable**: Two words + two digits (e.g., `BLUE-TIGER-42`)
- **Speakable**: Easy to tell someone over the phone
- **Secure**: ~17 bits of entropy, expires after 5 minutes
- **Case-insensitive**: `blue-tiger-42` = `BLUE-TIGER-42`

## Client Usage

### Desktop (Node.js)

```typescript
import { RelayClient } from '@audiio/relay';

const client = new RelayClient({
  serverUrl: 'wss://audiio-relay.fly.dev',
  autoReconnect: true
});

// Connect and get code
await client.connect();
client.on('registered', (code, expiresAt) => {
  console.log(`Show this code to mobile: ${code}`);
});

// Handle incoming mobile connections
client.on('peerJoined', (peer) => {
  console.log(`${peer.deviceName} connected!`);

  // Send encrypted message
  client.sendToPeer(peer.id, { type: 'welcome', data: '...' });
});

// Handle messages from mobile
client.on('message', (peerId, message) => {
  console.log('Got message:', message);
});
```

### Mobile (Browser)

```typescript
import { useP2PStore } from './stores/p2p-store';

// Connect using the code
const success = await useP2PStore.getState().connect('SWIFT-EAGLE-42');

if (success) {
  // Make API requests through the tunnel
  const response = await useP2PStore.getState().apiRequest('/api/library');
}
```

## Server API

### Configuration

```typescript
interface RelayServerConfig {
  port: number;           // Default: 9484
  host: string;           // Default: '0.0.0.0'
  codeExpiryMs: number;   // Default: 5 minutes
  maxPeersPerRoom: number; // Default: 5
  tls?: {
    cert: string;
    key: string;
  };
}
```

### Messages

| Type | Direction | Description |
|------|-----------|-------------|
| `register` | Desktop → Relay | Register and request a code |
| `registered` | Relay → Desktop | Confirm with code and expiry |
| `join` | Mobile → Relay | Join room with code |
| `joined` | Relay → Mobile | Confirm with desktop's public key |
| `peer-joined` | Relay → Desktop | Notify of new mobile connection |
| `peer-left` | Relay → All | Notify of disconnection |
| `data` | Any → Relay | E2E encrypted message to relay |
| `ping/pong` | Any | Keep-alive |
| `error` | Relay → Client | Error notification |

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

- **Key Exchange**: X25519 (Curve25519 ECDH)
- **Encryption**: XSalsa20-Poly1305 (authenticated encryption)
- **Key Size**: 256 bits
- **Nonce Size**: 192 bits (24 bytes)

```typescript
import { generateKeyPair, encrypt, decrypt } from '@audiio/relay';

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
| `CODE_EXPIRY_MS` | Code lifetime | `300000` (5 min) |
| `MAX_PEERS` | Max mobile devices per room | `5` |

## Security Considerations

- **E2E Encryption**: Relay never sees plaintext data
- **Forward Secrecy**: New key pairs per session
- **Code Expiry**: Codes expire after 5 minutes
- **No Storage**: Relay keeps no persistent data
- **Rate Limiting**: Built-in protection against abuse

## API Reference

### RelayClient

```typescript
class RelayClient {
  // Connect to relay server
  connect(): Promise<void>;

  // Disconnect
  disconnect(): void;

  // Send message to specific peer
  sendToPeer(peerId: string, message: unknown): void;

  // Broadcast to all peers
  broadcast(message: unknown): void;

  // Get connection code
  getConnectionCode(): string | null;

  // Get connected peers
  getPeers(): ConnectedPeer[];

  // Check connection status
  isConnected(): boolean;

  // Event handlers
  on(event: 'connected', cb: () => void): () => void;
  on(event: 'registered', cb: (code: string, expiresAt: number) => void): () => void;
  on(event: 'peerJoined', cb: (peer: ConnectedPeer) => void): () => void;
  on(event: 'peerLeft', cb: (peerId: string) => void): () => void;
  on(event: 'message', cb: (peerId: string, message: unknown) => void): () => void;
  on(event: 'error', cb: (error: Error) => void): () => void;
}
```

### RelayServer

```typescript
class RelayServer {
  // Start server
  start(): Promise<void>;

  // Stop server
  stop(): Promise<void>;

  // Get statistics
  getStats(): { rooms: number; clients: number };
}
```
