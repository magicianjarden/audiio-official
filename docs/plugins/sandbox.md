# Sandbox & Security

Plugins run in a sandboxed environment with capability-based security.

## Capability Model

Plugins must request capabilities they need. By default, plugins have limited access.

### Available Capabilities

| Capability | Description | Risk Level |
|------------|-------------|------------|
| `network` | Make HTTP requests | Low |
| `network:unrestricted` | Access any URL | Medium |
| `filesystem:read` | Read authorized paths | Medium |
| `filesystem:write` | Write to authorized paths | High |
| `database:read` | Read from plugin database | Low |
| `database:write` | Write to plugin database | Medium |
| `ipc` | Communicate with other plugins | Low |

### Declaring Capabilities

In `package.json`:

```json
{
  "name": "my-plugin",
  "audiio": {
    "type": "plugin",
    "id": "my-plugin",
    "roles": ["metadata-provider"],
    "capabilities": [
      "network",
      "database:read",
      "database:write"
    ]
  }
}
```

## Network Access

### Default (network)

Plugins can make requests to their declared domains:

```json
{
  "audiio": {
    "capabilities": ["network"],
    "allowedDomains": [
      "api.myservice.com",
      "cdn.myservice.com"
    ]
  }
}
```

### Unrestricted (network:unrestricted)

For plugins that need to access user-provided URLs:

```json
{
  "audiio": {
    "capabilities": ["network:unrestricted"]
  }
}
```

This requires admin approval on install.

## Filesystem Access

Plugins cannot access the filesystem directly. Instead:

### Path Authorization

Admins authorize specific paths for plugins:

```bash
curl -X POST http://localhost:8484/api/folders \
  -H "Content-Type: application/json" \
  -d '{
    "path": "/music",
    "readOnly": true,
    "pluginId": "local-library"
  }'
```

### Plugin File API

Plugins use a controlled file API:

```typescript
import { PluginContext } from '@audiio/sdk';

export default class MyPlugin {
  private ctx: PluginContext;

  async initialize(ctx: PluginContext) {
    this.ctx = ctx;
  }

  async readFile(relativePath: string) {
    // Only works for authorized paths
    return await this.ctx.fs.read(relativePath);
  }

  async listFiles(directory: string) {
    return await this.ctx.fs.list(directory);
  }
}
```

## Database Access

Each plugin gets an isolated database namespace:

```typescript
import { PluginContext } from '@audiio/sdk';

export default class MyPlugin {
  private ctx: PluginContext;

  async saveData(key: string, value: any) {
    // Saved to plugin's isolated namespace
    await this.ctx.db.set(key, value);
  }

  async loadData(key: string) {
    return await this.ctx.db.get(key);
  }
}
```

Plugins cannot access:
- Other plugins' data
- Core Audiio database
- User credentials

## Secrets Management

For API keys and credentials:

```typescript
// Plugin requests secret during setup
const apiKey = await this.ctx.secrets.get('API_KEY');

// Secrets are stored encrypted, not in plain text
```

Secrets are:
- Encrypted at rest
- Never logged
- Isolated per-plugin

## Resource Limits

Plugins are subject to resource limits:

| Resource | Limit |
|----------|-------|
| Memory | 256MB per plugin |
| CPU | 30% of one core |
| Network requests | 100/minute |
| Database storage | 100MB |
| File access | Authorized paths only |

Exceeding limits results in throttling or termination.

## Security Best Practices

### For Plugin Developers

1. **Request minimal capabilities** - Only what you need
2. **Validate all input** - Don't trust user data
3. **Handle errors gracefully** - Don't leak stack traces
4. **Don't store secrets in code** - Use secrets API
5. **Pin dependencies** - Avoid supply chain attacks

### For Server Admins

1. **Review capabilities** - Before installing plugins
2. **Limit path access** - Only necessary directories
3. **Monitor plugin activity** - Check logs for anomalies
4. **Update regularly** - Keep plugins patched
5. **Use trusted sources** - Prefer official plugins

## Audit Logging

Plugin actions are logged:

```json
{
  "timestamp": "2024-01-15T12:00:00Z",
  "plugin": "my-plugin",
  "action": "network:request",
  "details": {
    "url": "https://api.example.com/search",
    "method": "GET",
    "status": 200
  }
}
```

View logs:
```bash
curl http://localhost:8484/api/admin/logs?plugin=my-plugin
```

## Disabling Sandbox (Development Only)

For development, sandbox can be disabled:

```yaml
# config.yml - DO NOT USE IN PRODUCTION
plugins:
  sandbox: false
```

This gives plugins full access to the system.
