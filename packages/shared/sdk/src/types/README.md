# SDK Types

This directory contains TypeScript type definitions for plugin development in Audiio.

## Overview

| File | Purpose |
|------|---------|
| `routes.ts` | Types for plugins that register custom HTTP endpoints |
| `sandbox.ts` | Types for sandboxed plugin execution with capability-based permissions |

---

## Routes (`routes.ts`)

Types for plugins that expose custom HTTP routes. Routes are automatically prefixed with `/api/plugins/:pluginId/`.

### Types

#### `PluginRouteMethod`
```typescript
type PluginRouteMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
```
Supported HTTP methods for plugin routes.

#### `PluginRouteHandler`
```typescript
interface PluginRouteHandler {
  method: PluginRouteMethod;
  path: string;                    // e.g., '/folders', '/scan/:id'
  handler: (request: PluginRouteRequest, reply: PluginRouteReply) => Promise<unknown>;
  schema?: PluginRouteSchema;      // Optional JSON schema validation
  rateLimit?: { max: number; timeWindow: string };
  description?: string;            // For documentation
}
```
Definition for a plugin route. Used in `getRoutes()` method.

#### `PluginRouteRequest`
```typescript
interface PluginRouteRequest {
  params: Record<string, string>;              // URL path params (:id, :folderId)
  query: Record<string, string | undefined>;   // Query string params
  body: unknown;                               // Parsed JSON body
  headers: Record<string, string | string[] | undefined>;
  ip: string;                                  // Client IP
  method: string;                              // HTTP method
  url: string;                                 // Request URL
  pluginId: string;                            // Plugin that owns this route
}
```
Request object passed to route handlers.

#### `PluginRouteReply`
```typescript
interface PluginRouteReply {
  code(statusCode: number): PluginRouteReply;  // Set HTTP status
  header(name: string, value: string): PluginRouteReply;  // Set header
  send(payload?: unknown): void;               // Send response
  redirect(url: string): void;                 // Redirect to URL
}
```
Reply object for sending HTTP responses.

#### `PluginRouteSchema`
```typescript
interface PluginRouteSchema {
  body?: Record<string, unknown>;
  querystring?: Record<string, unknown>;
  params?: Record<string, unknown>;
  response?: Record<number, Record<string, unknown>>;
}
```
JSON schema for request/response validation.

#### `PluginWithRoutes`
```typescript
interface PluginWithRoutes {
  getRoutes?(): PluginRouteHandler[];
}
```
Interface for plugins that provide custom routes.

#### `RegisteredPluginRoute`
```typescript
interface RegisteredPluginRoute {
  pluginId: string;
  method: PluginRouteMethod;
  path: string;
  fullPath: string;    // Full path including /api/plugins/:pluginId prefix
  description?: string;
}
```
Information about a registered route (returned by server).

### Usage Example

```typescript
import {
  PluginRouteHandler,
  PluginRouteRequest,
  PluginRouteReply
} from '@audiio/sdk';

class MyPlugin {
  getRoutes(): PluginRouteHandler[] {
    return [
      {
        method: 'GET',
        path: '/items',
        handler: this.getItems.bind(this),
        description: 'List all items'
      },
      {
        method: 'POST',
        path: '/items',
        handler: this.createItem.bind(this),
        rateLimit: { max: 10, timeWindow: '1m' }
      },
      {
        method: 'DELETE',
        path: '/items/:id',
        handler: this.deleteItem.bind(this)
      }
    ];
  }

  private async getItems(req: PluginRouteRequest, reply: PluginRouteReply) {
    const { limit, offset } = req.query;
    const items = await this.db.getItems(parseInt(limit || '50'));
    return { items };
  }

  private async deleteItem(req: PluginRouteRequest, reply: PluginRouteReply) {
    const { id } = req.params;
    const deleted = await this.db.delete(id);
    if (!deleted) {
      reply.code(404);
      return { error: 'Item not found' };
    }
    return { success: true };
  }
}
```

### Where Used

| Location | Purpose |
|----------|---------|
| `packages/server/src/services/plugin-router.ts` | Registers plugin routes with Fastify |
| `packages/server/src/services/plugin-loader.ts` | Calls `getRoutes()` during plugin initialization |
| `packages/server/plugins/local-library/index.ts` | Example plugin implementing custom routes |

---

## Sandbox (`sandbox.ts`)

Types for sandboxed plugin execution with capability-based permissions. Plugins run in a restricted environment with controlled access to filesystem, network, and APIs.

### Types

#### `SandboxedFS`
```typescript
interface SandboxedFS {
  readFile(path: string): Promise<Buffer>;
  writeFile(path: string, data: string | Buffer): Promise<void>;
  readdir(path: string): Promise<string[]>;
  stat(path: string): Promise<{ isFile: boolean; isDirectory: boolean; size: number; modifiedAt: number }>;
  exists(path: string): Promise<boolean>;
  mkdir(path: string): Promise<void>;
  unlink(path: string): Promise<void>;
  readdirRecursive(path: string, options?: { maxDepth?: number }): Promise<Array<{
    path: string;
    type: 'file' | 'directory';
    size?: number;
  }>>;
}
```
Sandboxed filesystem interface. Only allows access to paths explicitly granted to the plugin.

#### `SandboxedFetch`
```typescript
type SandboxedFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
```
Sandboxed fetch function. Only allows requests to hosts in the plugin's allowed hosts list.

#### `PluginCapabilities`
```typescript
interface PluginCapabilities {
  filesystem: {
    read: boolean;           // Can read files
    write: boolean;          // Can write files
    allowedPaths?: string[]; // Whitelisted paths
  };
  network: {
    outbound: boolean;       // Can make HTTP requests
    allowedHosts?: string[]; // Whitelisted hosts
  };
  apis: {
    library: boolean;        // Access to library (likes, playlists, history)
    player: boolean;         // Access to player control
    settings: boolean;       // Access to settings
    tracking: boolean;       // Access to tracking events
  };
  resources: {
    maxMemory?: number;      // Memory limit in MB
    timeout?: number;        // Execution timeout in ms
    maxCpuTime?: number;     // CPU time limit in ms
  };
}
```
Plugin capabilities configuration. Declared in manifest and enforced at runtime.

#### `SandboxContext`
```typescript
interface SandboxContext {
  pluginId: string;
  fs: SandboxedFS;                              // Sandboxed filesystem
  fetch: SandboxedFetch;                        // Sandboxed HTTP client
  dataDir: string;                              // Plugin's data directory (always writable)
  capabilities: Readonly<PluginCapabilities>;   // Granted capabilities
  requestPathAccess(path: string, write?: boolean): Promise<boolean>;  // Request new path
  getAuthorizedPaths(): string[];               // Get current authorized paths
  log: {
    info(message: string, ...args: any[]): void;
    warn(message: string, ...args: any[]): void;
    error(message: string, ...args: any[]): void;
    debug(message: string, ...args: any[]): void;
  };
}
```
Context passed to plugins during initialization. Provides controlled access to system resources.

#### `PluginInitOptions`
```typescript
interface PluginInitOptions {
  sandbox: SandboxContext;
  config?: Record<string, unknown>;  // Server-provided configuration
}
```
Options passed to the plugin's `initialize()` method.

#### `SandboxedPlugin`
```typescript
interface SandboxedPlugin {
  initialize(options?: PluginInitOptions): Promise<void>;
}
```
Base interface for plugins that support sandboxed execution.

#### `PluginCapabilityManifest`
```typescript
interface PluginCapabilityManifest {
  capabilities?: Partial<PluginCapabilities>;  // Required capabilities
  needsFilesystem?: boolean;                   // Shorthand for filesystem access
  needsNetwork?: boolean;                      // Shorthand for network access
}
```
Manifest extension for declaring required capabilities.

### Usage Example

```typescript
import {
  SandboxContext,
  SandboxedFS,
  PluginInitOptions
} from '@audiio/sdk';

class MyPlugin {
  manifest = {
    id: 'my-plugin',
    name: 'My Plugin',
    version: '1.0.0',
    capabilities: {
      filesystem: {
        read: true,
        write: false,
        allowedPaths: []  // Populated by admin
      },
      network: {
        outbound: true,
        allowedHosts: ['api.example.com']
      },
      apis: {
        library: true
      }
    }
  };

  private sandbox: SandboxContext | null = null;
  private fs: SandboxedFS | null = null;

  async initialize(options?: PluginInitOptions): Promise<void> {
    if (options?.sandbox) {
      this.sandbox = options.sandbox;
      this.fs = options.sandbox.fs;

      this.sandbox.log.info('Plugin initialized');
      this.sandbox.log.info('Authorized paths:', this.sandbox.getAuthorizedPaths());
    }
  }

  async readUserFile(filePath: string): Promise<Buffer | null> {
    if (!this.fs) return null;

    // Check if path is authorized
    if (!this.sandbox) return null;

    const authorized = this.sandbox.getAuthorizedPaths();
    const isAllowed = authorized.some(p => filePath.startsWith(p));

    if (!isAllowed) {
      // Request access - triggers admin approval flow
      const granted = await this.sandbox.requestPathAccess(filePath, false);
      if (!granted) {
        this.sandbox.log.warn('Path access denied:', filePath);
        return null;
      }
    }

    return this.fs.readFile(filePath);
  }

  async fetchExternalData(): Promise<any> {
    if (!this.sandbox) return null;

    // fetch is sandboxed - only allowed hosts work
    const response = await this.sandbox.fetch('https://api.example.com/data');
    return response.json();
  }
}
```

### Where Used

| Location | Purpose |
|----------|---------|
| `packages/server/src/services/plugin-sandbox.ts` | Creates sandbox contexts for plugins |
| `packages/server/src/services/plugin-loader.ts` | Passes sandbox context to `initialize()` |
| `packages/server/plugins/local-library/index.ts` | Example using sandboxed filesystem |
| `packages/server/src/services/path-authorization.ts` | Manages authorized paths |

---

## Security Model

### Capability-Based Permissions

1. **Declare in Manifest**: Plugins declare required capabilities in their manifest
2. **Admin Approval**: Capabilities requiring filesystem/network access need admin approval
3. **Runtime Enforcement**: Server enforces capabilities at runtime

### Path Authorization Flow

```
Plugin Request → Sandbox Check → If Not Authorized → requestPathAccess() → Admin Approval → Grant/Deny
```

### Forbidden Paths

The sandbox automatically blocks access to system paths:
- Unix: `/etc`, `/sys`, `/proc`, `/dev`, `/boot`, `/root`, `/usr/bin`, etc.
- Windows: `C:\Windows`, `C:\Program Files`, `C:\ProgramData`, etc.

---

## Best Practices

1. **Store sandbox reference**: Save the `SandboxContext` from `initialize()` for later use
2. **Use sandboxed fs**: Always use `sandbox.fs` instead of Node.js `fs` module
3. **Use sandboxed fetch**: Always use `sandbox.fetch` instead of global `fetch`
4. **Check authorization**: Use `getAuthorizedPaths()` before accessing files
5. **Handle denials gracefully**: `requestPathAccess()` may return `false`
6. **Log through sandbox**: Use `sandbox.log` for plugin logging
