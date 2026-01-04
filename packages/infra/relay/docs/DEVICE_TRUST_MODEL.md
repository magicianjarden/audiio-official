# Audiio Device Trust Model

## Overview

Replace room codes + passwords with cryptographic device pairing. Once a device is trusted, it can connect securely without re-entering credentials.

## Goals

1. **Secure Pairing**: QR code exchange, not guessable room codes
2. **Device Persistence**: Trust a device once, it stays trusted
3. **Admin Control**: View and revoke trusted devices anytime
4. **Works Everywhere**: Same model for local and relay connections
5. **Zero-Knowledge Relay**: Relay never sees credentials or can impersonate

## Architecture

### Device Identity

Each device has a persistent X25519 key pair:
```
Desktop Server:
  - serverKeyPair: { publicKey, secretKey }
  - serverId: fingerprint(serverKeyPair.publicKey)  // e.g., "A3F2B1C9"

Mobile Device:
  - deviceKeyPair: { publicKey, secretKey }
  - deviceId: fingerprint(deviceKeyPair.publicKey)  // e.g., "7D4E8F2A"
```

### Pairing Flow

```
┌──────────────┐                              ┌──────────────┐
│   Desktop    │                              │    Mobile    │
│   Server     │                              │    Device    │
└──────┬───────┘                              └──────┬───────┘
       │                                             │
       │  1. Generate pairing token                  │
       │     (one-time, expires in 5min)             │
       │                                             │
       │  2. Show QR code:                           │
       │     {                                       │
       │       serverId: "A3F2B1C9",                 │
       │       serverPublicKey: "...",               │
       │       pairingToken: "xyz123",               │
       │       localUrl: "http://192.168.1.5:8484", │
       │       relayUrl: "wss://relay.audiio.com",  │
       │       serverName: "Jordan's PC"             │
       │     }                                       │
       │                                             │
       │◄────────────── 3. Scan QR ─────────────────│
       │                                             │
       │  4. POST /api/auth/pair                     │
       │     {                                       │
       │       pairingToken: "xyz123",               │
       │       devicePublicKey: "...",               │
       │       deviceName: "Jordan's iPhone",        │
       │       deviceId: "7D4E8F2A"                  │
       │     }                                       │
       │                                             │
       │  5. Server validates token,                 │
       │     stores trusted device:                  │
       │     {                                       │
       │       deviceId: "7D4E8F2A",                 │
       │       publicKey: "...",                     │
       │       deviceName: "Jordan's iPhone",        │
       │       trustedAt: 1704153600000,             │
       │       lastSeen: 1704153600000               │
       │     }                                       │
       │                                             │
       │  6. Return success + auth token             │
       │─────────────────────────────────────────────►
       │                                             │
       │  Device is now trusted!                     │
       │                                             │
```

### Connection Flow (After Pairing)

**Local Network:**
```
Mobile → Server:
  POST /api/auth/challenge
  { deviceId: "7D4E8F2A" }

Server → Mobile:
  { challenge: "random-nonce-12345", serverPublicKey: "..." }

Mobile → Server:
  POST /api/auth/verify
  {
    deviceId: "7D4E8F2A",
    signature: sign(challenge, deviceSecretKey)
  }

Server:
  1. Lookup trusted device by deviceId
  2. Verify signature using stored publicKey
  3. If valid → issue session token
  4. If invalid → reject
```

**Via Relay:**
```
Desktop registers with relay:
  {
    type: "register",
    serverId: "A3F2B1C9",           // Unique, not guessable
    serverPublicKey: "...",
    serverName: "Jordan's PC"
  }

Mobile joins via relay:
  {
    type: "join",
    serverId: "A3F2B1C9",           // From saved QR data
    deviceId: "7D4E8F2A",
    devicePublicKey: "..."
  }

Relay routes → Desktop:
  Desktop checks if deviceId is trusted
  If trusted → accept connection
  If not → reject
```

### Key Differences from Current System

| Current | New |
|---------|-----|
| Room code: BLUE-TIGER-42 (guessable) | Server ID: A3F2B1C9 (cryptographic hash) |
| Password: shared secret | No password - cryptographic challenge |
| Relay compares password hashes | Relay just routes, server validates |
| Re-enter password every time | Trusted once, connects automatically |
| No way to revoke | Admin can revoke any device |

## Data Structures

### Server-side Storage

```typescript
interface TrustedDevice {
  deviceId: string;           // Fingerprint of device's public key
  publicKey: string;          // Device's X25519 public key (base64)
  deviceName: string;         // "Jordan's iPhone"
  deviceType: 'mobile' | 'desktop' | 'web';
  trustedAt: number;          // Timestamp when paired
  lastSeen: number;           // Last successful connection
  lastIp?: string;            // For display purposes only
}

interface PairingToken {
  token: string;              // Random 32-byte base64
  expiresAt: number;          // 5 minutes from creation
  createdBy?: string;         // Admin who created it (for multi-user)
}
```

### Server Config

```typescript
interface ServerIdentity {
  keyPair: KeyPair;           // Persistent X25519 key pair
  serverId: string;           // fingerprint(publicKey)
  serverName: string;         // "Jordan's MacBook Pro"
}
```

### Mobile Storage

```typescript
interface SavedServer {
  serverId: string;           // "A3F2B1C9"
  serverName: string;         // "Jordan's MacBook Pro"
  serverPublicKey: string;    // For E2E encryption
  localUrl?: string;          // "http://192.168.1.5:8484"
  relayUrl?: string;          // "wss://relay.audiio.com"
  pairedAt: number;           // When we paired
  lastConnected: number;      // Last successful connection
}
```

## API Endpoints

### Pairing

```
POST /api/auth/pairing-token
  → { token: "xyz123", expiresAt: 1704157200000, qrData: {...} }

POST /api/auth/pair
  { pairingToken, devicePublicKey, deviceName, deviceId }
  → { success: true, sessionToken: "...", serverId: "..." }
```

### Authentication

```
POST /api/auth/challenge
  { deviceId: "7D4E8F2A" }
  → { challenge: "nonce", serverId: "A3F2B1C9" }

POST /api/auth/verify
  { deviceId, signature }
  → { success: true, sessionToken: "..." }
```

### Device Management

```
GET /api/auth/devices
  → { devices: [...] }

DELETE /api/auth/devices/:deviceId
  → { success: true }
```

## Security Analysis

### Threat: Relay Compromise
- **Before**: Relay could brute-force password hashes
- **After**: Relay only sees deviceId and encrypted messages. No credentials to steal.

### Threat: Room Code Enumeration
- **Before**: 81,000 combinations, enumerable in seconds
- **After**: serverId is 8 chars of base64 hash = 2^48 combinations, not enumerable

### Threat: Stolen Device
- **Before**: Attacker has room code forever
- **After**: Admin revokes deviceId, connection rejected

### Threat: MITM on Pairing
- **Mitigation**: QR contains serverPublicKey, mobile encrypts TO server immediately
- **Enhancement**: Optional fingerprint verification (show fingerprint on both screens)

## Migration Path

1. Keep room codes working during transition (deprecated)
2. New pairing flow parallel to old
3. After X months, disable room code support
4. Relay server supports both during transition

## Implementation Order

1. Server identity generation (keyPair, serverId, storage)
2. Pairing token generation and QR code
3. Device trust storage (SQLite table)
4. Challenge-response authentication
5. Session token middleware
6. Device management UI
7. Relay protocol v2 (serverId instead of roomId)
8. Mobile app updates
