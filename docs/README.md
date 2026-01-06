# Audiio Documentation

Audiio is a self-hosted music streaming server with multi-device support. Run your own music server and connect from desktop, mobile, or web.

> **Note:** This project is under active development. Documentation is being updated to reflect the new server-first architecture.

## Architecture Overview

Audiio uses a **server-client architecture**:

```
┌─────────────────────────────────────────────────────────────────┐
│                        Audiio Server                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │   Plugins    │  │  ML Engine   │  │    Library DB        │  │
│  │  (dynamic)   │  │ (TensorFlow) │  │    (SQLite)          │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │ Orchestrators│  │    Auth      │  │   REST API (100+)    │  │
│  │ search/play  │  │  (NaCl/QR)   │  │   + WebSocket        │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
         │                                          │
         │ HTTP/WS                                  │ HTTP/WS
         ▼                                          ▼
┌─────────────┐                            ┌─────────────────────┐
│   Desktop   │                            │    Web Browser      │
│   Client    │                            │    (direct API)     │
│  (Electron) │                            │                     │
└─────────────┘                            └─────────────────────┘
         │
         │ (optional)
         ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Audiio Relay                               │
│              (for remote access outside LAN)                    │
│         wss://audiio-relay.fly.dev (E2E encrypted)              │
└─────────────────────────────────────────────────────────────────┘
```

## Quick Start

### Run the Server

```bash
# Clone and install
git clone https://github.com/magicianjarden/audiio-official.git
cd audiio-official
npm install

# Build and run server
npm run build -w @audiio/server
npm run start -w @audiio/server
```

The server starts at `http://localhost:8484`.

### Connect a Client

1. Open the desktop client or navigate to `http://localhost:8484` in a browser
2. Scan the QR code or enter the pairing code
3. Start streaming

## Documentation

### Server

| Guide | Description |
|-------|-------------|
| [Server Overview](./server/README.md) | What the server does |
| [Installation](./server/installation.md) | Docker, standalone, NAS deployment |
| [Configuration](./server/configuration.md) | Config file and environment variables |
| [Authentication](./server/authentication.md) | Device pairing and security |
| [API Reference](./server/api-reference.md) | REST API endpoints |

### Clients

| Guide | Description |
|-------|-------------|
| [Clients Overview](./clients/README.md) | Available clients |
| [Desktop Client](./clients/desktop.md) | Electron desktop app |

### Plugins

| Guide | Description |
|-------|-------------|
| [Plugin System](./plugins/README.md) | How plugins work |
| [Getting Started](./plugins/getting-started.md) | Create your first plugin |
| [Provider Types](./plugins/providers.md) | Metadata, stream, lyrics, etc. |
| [Sandbox & Security](./plugins/sandbox.md) | Plugin capabilities |

### Reference

| Guide | Description |
|-------|-------------|
| [Architecture](./architecture.md) | System design deep-dive |
| [ML System](./ml-system.md) | Recommendations and personalization |

## Packages

```
packages/
├── server/          # Headless music server (Fastify + SQLite)
├── clients/
│   └── desktop/     # Electron thin client
├── shared/
│   ├── core/        # Types and orchestrators
│   ├── sdk/         # Plugin development kit
│   ├── ui/          # React components
│   └── icons/       # Icon library
└── infra/
    ├── relay/       # P2P tunneling server
    └── landing/     # Marketing website
```

## Key Features

- **Self-Hosted** - Run on Docker, NAS, Raspberry Pi, or cloud
- **Multi-Device** - Connect from desktop or web
- **Plugin System** - Extend with metadata, streaming, lyrics providers
- **ML Recommendations** - Personalized radio and smart queue
- **Secure** - Device pairing with NaCl encryption
- **Remote Access** - Optional relay for access outside your network

## License

MIT
