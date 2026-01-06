# Audiio Clients

Audiio clients are lightweight applications that connect to an Audiio server. The server handles all the heavy lifting (plugins, ML, library management), while clients provide the user interface.

## Available Clients

| Client | Platform | Description |
|--------|----------|-------------|
| [Desktop](./desktop.md) | Windows, macOS, Linux | Electron-based desktop app |
| Web | Any browser | Direct API access at server URL |

## How Clients Work

```
┌─────────────────┐     HTTP/WebSocket     ┌─────────────────┐
│     Client      │ ◄──────────────────► │     Server      │
│                 │                        │                 │
│ • UI rendering  │                        │ • Plugins       │
│ • User input    │                        │ • ML/Recs       │
│ • Audio output  │                        │ • Library       │
│ • Device keys   │                        │ • Auth          │
└─────────────────┘                        └─────────────────┘
```

Clients are "thin" - they don't run plugins or ML algorithms. They simply:

1. Connect to a server (local network or via relay)
2. Authenticate via device pairing
3. Make API calls to search, stream, manage library
4. Render the UI and play audio

## Connection Methods

### Local Network
Clients can discover servers on the local network via mDNS/Bonjour:

```
Audiio Server (192.168.1.100:8484)
    └── Desktop Client (same network)
```

### Relay (Remote Access)
For access outside your network, use the relay:

```
Client (anywhere) ──► Audiio Relay ──► Your Server (at home)
                     (E2E encrypted)
```

The relay tunnels encrypted traffic without seeing your data.

## Device Pairing

All clients use the same pairing flow:

1. Server displays QR code or pairing code
2. Client scans/enters the code
3. Client and server exchange public keys
4. Server issues session token
5. Client stores token for future connections

See [Authentication](../server/authentication.md) for details.

## Building Clients

### Desktop
```bash
npm run build -w @audiio/client
npm run start -w @audiio/client
```

## Next Steps

- [Desktop Client](./desktop.md) - Desktop app setup
