# Audiio Server

The Audiio server is a headless music streaming backend. It handles:

- Music search and streaming via plugins
- Library management (likes, playlists, history)
- ML-powered recommendations
- Device authentication
- Plugin lifecycle management

## Features

### Plugin System
Plugins provide music sources, lyrics, metadata, and more. The server loads plugins dynamically and routes requests through them.

Built-in plugins:
- `plugin-youtube-music` - YouTube Music streaming
- `plugin-deezer` - Deezer streaming and charts
- `plugin-lrclib` - Lyrics from LRCLIB
- `plugin-fanart` - Artist images from Fanart.tv
- `local-library` - Local music files

### Library Database
SQLite database storing:
- Liked and disliked tracks
- Playlists
- Play history
- User preferences

### ML Engine
TensorFlow.js-based recommendation system:
- Track scoring based on listening history
- Radio generation (by track, artist, genre, mood)
- Smart queue suggestions
- User taste profiling

### REST API
100+ endpoints for:
- Search and discovery
- Stream resolution
- Library CRUD
- Plugin management
- ML recommendations
- Device authentication

### Authentication
Secure device pairing using NaCl public-key cryptography:
- QR code pairing
- Challenge-response authentication
- Session tokens
- Device management

## Requirements

- Node.js 18+
- npm or yarn

## Quick Start

```bash
# From repository root
npm install
npm run build -w @audiio/server
npm run start -w @audiio/server
```

Server runs at `http://localhost:8484` by default.

## Next Steps

- [Installation](./installation.md) - Deployment options
- [Configuration](./configuration.md) - Server settings
- [Authentication](./authentication.md) - Device pairing
- [API Reference](./api-reference.md) - REST endpoints
