# Server Configuration

The server loads configuration from multiple sources (in order of priority):

1. Environment variables (`AUDIIO_*`)
2. Config file (`config.yml` or `config.json`)
3. Default values

## Config File

Create `config.yml` in the server directory:

```yaml
server:
  port: 8484
  host: "0.0.0.0"
  name: "My Audiio Server"  # Shown during device pairing

plugins:
  directory: "./plugins"
  autoload: true

storage:
  database: "./data/audiio.db"
  cache: "./data/cache"

relay:
  enabled: true
  url: "wss://audiio-relay.fly.dev"

auth:
  requirePairing: true
  sessionTimeout: 10080  # 1 week in minutes

logging:
  level: "info"  # debug, info, warn, error
```

Or use JSON:

```json
{
  "server": {
    "port": 8484,
    "host": "0.0.0.0"
  },
  "plugins": {
    "directory": "./plugins",
    "autoload": true
  },
  "storage": {
    "database": "./data/audiio.db",
    "cache": "./data/cache"
  },
  "auth": {
    "requirePairing": true
  },
  "logging": {
    "level": "info"
  }
}
```

## Environment Variables

All config options can be set via environment variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `AUDIIO_PORT` | Server port | `8484` |
| `AUDIIO_HOST` | Bind address | `0.0.0.0` |
| `AUDIIO_SERVER_NAME` | Server display name | hostname |
| `AUDIIO_LOG_LEVEL` | Log verbosity | `info` |
| `AUDIIO_DATABASE` | Database file path | `./data/audiio.db` |
| `AUDIIO_CACHE_DIR` | Cache directory | `./data/cache` |
| `AUDIIO_PLUGINS_DIR` | Plugins directory | `./plugins` |
| `AUDIIO_REQUIRE_PAIRING` | Require device pairing | `true` |
| `AUDIIO_RELAY_ENABLED` | Enable relay connection | `true` |
| `AUDIIO_RELAY_URL` | Relay server URL | `wss://audiio-relay.fly.dev` |

## Data Directory

The server stores data in `./data/` by default:

```
data/
├── audiio.db           # Main SQLite database
├── server-identity.json # Server keypair
├── cache/              # Temporary cache
└── plugins/            # Downloaded plugins
```

## Disabling Authentication

For local/trusted networks, device pairing can be disabled:

```yaml
auth:
  requirePairing: false
```

Or:
```bash
AUDIIO_REQUIRE_PAIRING=false
```

When disabled, all API endpoints are publicly accessible.

## Logging

```yaml
logging:
  level: "debug"  # For development
  level: "info"   # For production
  level: "warn"   # Minimal logging
```

Logs are written to stdout. Use Docker or systemd to capture logs.

## Next Steps

- [Authentication](./authentication.md) - Device pairing setup
- [API Reference](./api-reference.md) - Available endpoints
