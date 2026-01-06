# Plugin System

Audiio uses a plugin architecture to support multiple music sources, lyrics providers, and more.

## Overview

Plugins run on the **server**, not clients. This means:

- One plugin installation serves all connected devices
- Plugins have access to server resources
- Plugin updates only need to happen once

## Plugin Roles

| Role | Description | Example |
|------|-------------|---------|
| `metadata-provider` | Search and track metadata | Deezer, MusicBrainz |
| `stream-provider` | Audio stream URLs | YouTube Music |
| `lyrics-provider` | Lyrics with timestamps | LRCLIB |
| `scrobbler` | Play tracking | Last.fm |
| `audio-processor` | Audio effects | Equalizer |
| `artist-enrichment` | Artist info | Fanart.tv |
| `tool` | Utility functions | Backup |

## Built-in Plugins

Located in `packages/server/plugins/`:

| Plugin | Roles | Description |
|--------|-------|-------------|
| `plugin-youtube-music` | stream-provider, metadata-provider | YouTube Music streaming |
| `plugin-deezer` | stream-provider, metadata-provider | Deezer streaming and charts |
| `plugin-lrclib` | lyrics-provider | Synchronized lyrics |
| `plugin-fanart` | artist-enrichment | Artist images |
| `local-library` | metadata-provider, stream-provider | Local music files |

## Installing Plugins

### Via API

```bash
# Install from URL
curl -X POST http://localhost:8484/api/plugins/install \
  -H "Content-Type: application/json" \
  -d '{"downloadUrl": "https://example.com/plugin.zip"}'
```

### Via Plugin Repository

```bash
# Add a repository
curl -X POST http://localhost:8484/api/plugins/repositories \
  -H "Content-Type: application/json" \
  -d '{"url": "https://plugins.example.com/registry.json"}'

# List available plugins
curl http://localhost:8484/api/plugins/available

# Install from repository
curl -X POST http://localhost:8484/api/plugins/install \
  -H "Content-Type: application/json" \
  -d '{"downloadUrl": "https://plugins.example.com/my-plugin.zip"}'
```

## Plugin Configuration

### Enable/Disable

```bash
curl -X POST http://localhost:8484/api/addons/plugin-id/enabled \
  -H "Content-Type: application/json" \
  -d '{"enabled": false}'
```

### Plugin Settings

```bash
# Get settings
curl http://localhost:8484/api/addons/plugin-id/settings

# Update settings
curl -X POST http://localhost:8484/api/addons/plugin-id/settings \
  -H "Content-Type: application/json" \
  -d '{"settings": {"apiKey": "your-key"}}'
```

## Next Steps

- [Getting Started](./getting-started.md) - Create your first plugin
- [Provider Types](./providers.md) - Deep dive into each role
- [Sandbox & Security](./sandbox.md) - Plugin capabilities
