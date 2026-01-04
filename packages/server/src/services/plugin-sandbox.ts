/**
 * Plugin Sandbox - Secure execution environment for plugins
 *
 * Provides sandboxed access to filesystem, network, and APIs based on
 * capability-based permissions. Integrates with PathAuthorizationService
 * for dynamic path management.
 *
 * Features:
 * - Capability-based filesystem access (read/write with path whitelist)
 * - Network access control with host whitelist
 * - API access control (library, player, settings, tracking)
 * - Memory/CPU limits (for future isolated-vm integration)
 * - Plugin-specific data directories
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import type {
  SandboxedFS,
  SandboxedFetch,
  PluginCapabilities,
  SandboxContext,
  PluginInitOptions
} from '@audiio/sdk';
import { getPathAuthService } from './path-authorization';

// ========================================
// Types
// ========================================

export interface SandboxConfig {
  /** Base directory for plugin data */
  dataDir: string;
  /** Default memory limit in MB */
  defaultMemoryLimit: number;
  /** Default timeout in ms */
  defaultTimeout: number;
  /** Max plugins allowed */
  maxPlugins: number;
  /** Enable execution logging */
  logExecution: boolean;
}

export interface SandboxedPluginInfo {
  id: string;
  name: string;
  version: string;
  capabilities: PluginCapabilities;
  state: 'initializing' | 'running' | 'stopped' | 'error';
  lastError?: string;
  memoryUsage?: number;
  dataDir: string;
}

// Forbidden paths that should never be accessible
const FORBIDDEN_PATHS_UNIX = [
  '/etc', '/sys', '/proc', '/dev', '/boot', '/root',
  '/usr/bin', '/usr/sbin', '/bin', '/sbin',
  '/var/run', '/var/lock'
];

const FORBIDDEN_PATHS_WINDOWS = [
  'C:\\Windows', 'C:\\Program Files', 'C:\\Program Files (x86)',
  'C:\\ProgramData', 'C:\\System Volume Information',
  'C:\\$Recycle.Bin'
];

const DEFAULT_CONFIG: SandboxConfig = {
  dataDir: './data/plugins',
  defaultMemoryLimit: 128,
  defaultTimeout: 30000,
  maxPlugins: 50,
  logExecution: false
};

const DEFAULT_CAPABILITIES: PluginCapabilities = {
  filesystem: { read: false, write: false, allowedPaths: [] },
  network: { outbound: false, allowedHosts: [] },
  apis: {
    library: false,
    player: false,
    settings: false,
    tracking: false
  },
  resources: {
    maxMemory: 128,
    timeout: 30000,
    maxCpuTime: 5000
  }
};

// ========================================
// Plugin Sandbox Manager
// ========================================

export class PluginSandbox {
  private config: SandboxConfig;
  private plugins: Map<string, SandboxedPluginInfo> = new Map();
  private contexts: Map<string, SandboxContext> = new Map();

  constructor(config: Partial<SandboxConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Register a plugin and create its sandbox context
   */
  async registerPlugin(
    id: string,
    name: string,
    version: string,
    requestedCapabilities: Partial<PluginCapabilities> = {}
  ): Promise<{ plugin: SandboxedPluginInfo; context: SandboxContext }> {
    if (this.plugins.size >= this.config.maxPlugins) {
      throw new Error(`Maximum plugin limit (${this.config.maxPlugins}) reached`);
    }

    // Merge with defaults
    const capabilities = this.mergeCapabilities(DEFAULT_CAPABILITIES, requestedCapabilities);

    // Validate capabilities
    this.validateCapabilities(capabilities);

    // Get authorized paths from PathAuthorizationService
    const pathAuthService = getPathAuthService();
    if (pathAuthService && capabilities.filesystem.read) {
      const authorizedPaths = pathAuthService.getAllowedPathsForSandbox(id);
      capabilities.filesystem.allowedPaths = [
        ...(capabilities.filesystem.allowedPaths || []),
        ...authorizedPaths
      ];
    }

    // Create plugin data directory
    const pluginDataDir = path.join(this.config.dataDir, id);
    await fs.mkdir(pluginDataDir, { recursive: true });

    // Add data dir to allowed paths (always writable)
    if (!capabilities.filesystem.allowedPaths) {
      capabilities.filesystem.allowedPaths = [];
    }
    capabilities.filesystem.allowedPaths.push(pluginDataDir);

    const plugin: SandboxedPluginInfo = {
      id,
      name,
      version,
      capabilities,
      state: 'initializing',
      dataDir: pluginDataDir
    };

    this.plugins.set(id, plugin);

    // Create sandbox context
    const context = this.createContext(id, capabilities, pluginDataDir);
    this.contexts.set(id, context);

    console.log(`[Sandbox] Registered plugin: ${id}`, {
      filesystem: {
        read: capabilities.filesystem.read,
        write: capabilities.filesystem.write,
        paths: capabilities.filesystem.allowedPaths?.length || 0
      },
      network: capabilities.network.outbound
    });

    return { plugin, context };
  }

  /**
   * Unregister a plugin
   */
  unregisterPlugin(id: string): void {
    const plugin = this.plugins.get(id);
    if (plugin) {
      plugin.state = 'stopped';
      this.plugins.delete(id);
      this.contexts.delete(id);
      console.log(`[Sandbox] Unregistered plugin: ${id}`);
    }
  }

  /**
   * Get sandbox context for a plugin
   */
  getContext(pluginId: string): SandboxContext | null {
    return this.contexts.get(pluginId) || null;
  }

  /**
   * Get plugin init options (context + config)
   */
  getInitOptions(pluginId: string, config?: Record<string, unknown>): PluginInitOptions | null {
    const context = this.getContext(pluginId);
    if (!context) return null;

    return {
      sandbox: context,
      config
    };
  }

  /**
   * Update allowed paths for a plugin (e.g., when admin adds a folder)
   */
  async updateAllowedPaths(pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId);
    const context = this.contexts.get(pluginId);
    if (!plugin || !context) return;

    const pathAuthService = getPathAuthService();
    if (!pathAuthService) return;

    const authorizedPaths = pathAuthService.getAllowedPathsForSandbox(pluginId);

    // Update capabilities
    plugin.capabilities.filesystem.allowedPaths = [
      plugin.dataDir,  // Always include data dir
      ...authorizedPaths
    ];

    // Recreate context with updated paths
    const newContext = this.createContext(pluginId, plugin.capabilities, plugin.dataDir);
    this.contexts.set(pluginId, newContext);

    console.log(`[Sandbox] Updated paths for ${pluginId}: ${authorizedPaths.length} authorized`);
  }

  /**
   * Get all registered plugins
   */
  getPlugins(): SandboxedPluginInfo[] {
    return Array.from(this.plugins.values());
  }

  /**
   * Get a specific plugin
   */
  getPlugin(id: string): SandboxedPluginInfo | undefined {
    return this.plugins.get(id);
  }

  /**
   * Update plugin state
   */
  setPluginState(id: string, state: SandboxedPluginInfo['state'], error?: string): void {
    const plugin = this.plugins.get(id);
    if (plugin) {
      plugin.state = state;
      if (error) {
        plugin.lastError = error;
      }
    }
  }

  /**
   * Check if plugin has a specific capability
   */
  hasCapability(pluginId: string, capability: string): boolean {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) return false;

    const parts = capability.split('.');
    let current: any = plugin.capabilities;

    for (const part of parts) {
      if (current[part] === undefined) return false;
      current = current[part];
    }

    return current === true;
  }

  // ========================================
  // Context Creation
  // ========================================

  private createContext(
    pluginId: string,
    capabilities: PluginCapabilities,
    dataDir: string
  ): SandboxContext {
    const sandbox = this;

    return {
      pluginId,
      dataDir,
      capabilities: Object.freeze({ ...capabilities }),

      fs: this.createSandboxedFS(pluginId, capabilities, dataDir),
      fetch: this.createSandboxedFetch(pluginId, capabilities),

      async requestPathAccess(targetPath: string, write = false): Promise<boolean> {
        const pathAuthService = getPathAuthService();
        if (!pathAuthService) return false;

        // Create a request for admin approval
        pathAuthService.requestPathAccess(
          pluginId,
          targetPath,
          write ? 'readwrite' : 'read',
          `Plugin ${pluginId} requested access`
        );

        // For now, always return false (requires admin approval)
        // In a real implementation, this could wait for approval
        console.log(`[Sandbox] Path access requested by ${pluginId}: ${targetPath}`);
        return false;
      },

      getAuthorizedPaths(): string[] {
        const plugin = sandbox.plugins.get(pluginId);
        return plugin?.capabilities.filesystem.allowedPaths || [];
      },

      log: {
        info(message: string, ...args: any[]) {
          console.log(`[Plugin:${pluginId}] ${message}`, ...args);
        },
        warn(message: string, ...args: any[]) {
          console.warn(`[Plugin:${pluginId}] ${message}`, ...args);
        },
        error(message: string, ...args: any[]) {
          console.error(`[Plugin:${pluginId}] ${message}`, ...args);
        },
        debug(message: string, ...args: any[]) {
          if (sandbox.config.logExecution) {
            console.log(`[Plugin:${pluginId}:DEBUG] ${message}`, ...args);
          }
        }
      }
    };
  }

  // ========================================
  // Sandboxed Filesystem
  // ========================================

  private createSandboxedFS(
    pluginId: string,
    capabilities: PluginCapabilities,
    dataDir: string
  ): SandboxedFS {
    const sandbox = this;

    const checkReadAccess = (targetPath: string): void => {
      if (!capabilities.filesystem.read) {
        throw new Error(`Plugin ${pluginId} does not have filesystem read permission`);
      }
      if (!sandbox.canAccessPath(pluginId, targetPath, false)) {
        throw new Error(`Plugin ${pluginId} cannot access path: ${targetPath}`);
      }
    };

    const checkWriteAccess = (targetPath: string): void => {
      if (!capabilities.filesystem.write) {
        throw new Error(`Plugin ${pluginId} does not have filesystem write permission`);
      }
      if (!sandbox.canAccessPath(pluginId, targetPath, true)) {
        throw new Error(`Plugin ${pluginId} cannot write to path: ${targetPath}`);
      }
    };

    return {
      async readFile(filePath: string): Promise<Buffer> {
        checkReadAccess(filePath);
        return fs.readFile(filePath);
      },

      async writeFile(filePath: string, data: string | Buffer): Promise<void> {
        checkWriteAccess(filePath);
        await fs.writeFile(filePath, data);
      },

      async readdir(dirPath: string): Promise<string[]> {
        checkReadAccess(dirPath);
        return fs.readdir(dirPath);
      },

      async stat(filePath: string): Promise<{ isFile: boolean; isDirectory: boolean; size: number; modifiedAt: number }> {
        checkReadAccess(filePath);
        const stats = await fs.stat(filePath);
        return {
          isFile: stats.isFile(),
          isDirectory: stats.isDirectory(),
          size: stats.size,
          modifiedAt: stats.mtimeMs
        };
      },

      async exists(filePath: string): Promise<boolean> {
        // Allow checking existence even without read permission for allowed paths
        if (!sandbox.canAccessPath(pluginId, filePath, false)) {
          return false;
        }
        try {
          await fs.access(filePath);
          return true;
        } catch {
          return false;
        }
      },

      async mkdir(dirPath: string): Promise<void> {
        checkWriteAccess(dirPath);
        await fs.mkdir(dirPath, { recursive: true });
      },

      async unlink(filePath: string): Promise<void> {
        checkWriteAccess(filePath);
        await fs.unlink(filePath);
      },

      async readdirRecursive(dirPath: string, options?: { maxDepth?: number }): Promise<Array<{
        path: string;
        type: 'file' | 'directory';
        size?: number;
      }>> {
        checkReadAccess(dirPath);

        const maxDepth = options?.maxDepth ?? 10;
        const results: Array<{ path: string; type: 'file' | 'directory'; size?: number }> = [];

        async function scan(currentPath: string, depth: number): Promise<void> {
          if (depth > maxDepth) return;

          const entries = await fs.readdir(currentPath, { withFileTypes: true });

          for (const entry of entries) {
            if (entry.name.startsWith('.')) continue;

            const entryPath = path.join(currentPath, entry.name);

            if (entry.isDirectory()) {
              results.push({ path: entryPath, type: 'directory' });
              await scan(entryPath, depth + 1);
            } else if (entry.isFile()) {
              const stats = await fs.stat(entryPath);
              results.push({ path: entryPath, type: 'file', size: stats.size });
            }
          }
        }

        await scan(dirPath, 0);
        return results;
      }
    };
  }

  // ========================================
  // Sandboxed Fetch
  // ========================================

  private createSandboxedFetch(
    pluginId: string,
    capabilities: PluginCapabilities
  ): SandboxedFetch {
    const sandbox = this;

    return async function sandboxedFetch(
      input: RequestInfo | URL,
      init?: RequestInit
    ): Promise<Response> {
      if (!capabilities.network.outbound) {
        throw new Error(`Plugin ${pluginId} does not have network access`);
      }

      // Extract host from URL
      let host: string;
      if (typeof input === 'string') {
        host = new URL(input).hostname;
      } else if (input instanceof URL) {
        host = input.hostname;
      } else {
        host = new URL(input.url).hostname;
      }

      if (!sandbox.canAccessHost(pluginId, host)) {
        throw new Error(`Plugin ${pluginId} cannot access host: ${host}`);
      }

      return fetch(input, init);
    };
  }

  // ========================================
  // Access Checks
  // ========================================

  /**
   * Check if plugin can access a filesystem path
   */
  canAccessPath(pluginId: string, targetPath: string, write: boolean = false): boolean {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) return false;

    const fsPerms = plugin.capabilities.filesystem;

    // Check basic permission
    if (write && !fsPerms.write) return false;
    if (!write && !fsPerms.read) return false;

    // Check allowed paths
    const allowedPaths = fsPerms.allowedPaths || [];
    if (allowedPaths.length === 0) return false;

    // Normalize and check
    const normalizedTarget = path.resolve(targetPath).toLowerCase();

    // Check forbidden paths first
    if (this.isForbiddenPath(normalizedTarget)) {
      return false;
    }

    // Check if target is within any allowed path
    for (const allowed of allowedPaths) {
      const normalizedAllowed = path.resolve(allowed).toLowerCase();
      if (normalizedTarget.startsWith(normalizedAllowed)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check if plugin can access a network host
   */
  canAccessHost(pluginId: string, host: string): boolean {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) return false;

    if (!plugin.capabilities.network.outbound) return false;

    const allowedHosts = plugin.capabilities.network.allowedHosts;
    if (!allowedHosts || allowedHosts.length === 0) {
      return true;  // No whitelist means all hosts allowed
    }

    const normalizedHost = host.toLowerCase();
    return allowedHosts.some(allowed => {
      const normalizedAllowed = allowed.toLowerCase();
      return normalizedHost === normalizedAllowed ||
             normalizedHost.endsWith('.' + normalizedAllowed);
    });
  }

  /**
   * Check if a path is forbidden (system paths)
   */
  private isForbiddenPath(normalizedPath: string): boolean {
    const isWindows = process.platform === 'win32';
    const forbiddenPaths = isWindows ? FORBIDDEN_PATHS_WINDOWS : FORBIDDEN_PATHS_UNIX;

    for (const forbidden of forbiddenPaths) {
      const normalizedForbidden = path.resolve(forbidden).toLowerCase();
      if (normalizedPath.startsWith(normalizedForbidden)) {
        return true;
      }
    }

    return false;
  }

  // ========================================
  // Capability Management
  // ========================================

  private mergeCapabilities(
    defaults: PluginCapabilities,
    requested: Partial<PluginCapabilities>
  ): PluginCapabilities {
    return {
      filesystem: {
        ...defaults.filesystem,
        ...requested.filesystem
      },
      network: {
        ...defaults.network,
        ...requested.network
      },
      apis: {
        ...defaults.apis,
        ...requested.apis
      },
      resources: {
        ...defaults.resources,
        ...requested.resources
      }
    };
  }

  private validateCapabilities(caps: PluginCapabilities): void {
    // Validate memory limit
    if (caps.resources.maxMemory && caps.resources.maxMemory > 512) {
      throw new Error('Memory limit cannot exceed 512MB');
    }

    // Validate timeout
    if (caps.resources.timeout && caps.resources.timeout > 300000) {
      throw new Error('Timeout cannot exceed 5 minutes');
    }

    // Validate CPU time
    if (caps.resources.maxCpuTime && caps.resources.maxCpuTime > 30000) {
      throw new Error('CPU time limit cannot exceed 30 seconds');
    }

    // Validate allowed paths don't include system directories
    if (caps.filesystem.allowedPaths) {
      for (const p of caps.filesystem.allowedPaths) {
        const normalizedPath = path.resolve(p).toLowerCase();
        if (this.isForbiddenPath(normalizedPath)) {
          throw new Error(`Access to ${p} is forbidden`);
        }
      }
    }
  }
}

// ========================================
// Singleton Instance
// ========================================

let defaultSandbox: PluginSandbox | null = null;

export function initPluginSandbox(config?: Partial<SandboxConfig>): PluginSandbox {
  if (!defaultSandbox) {
    defaultSandbox = new PluginSandbox(config);
  }
  return defaultSandbox;
}

export function getPluginSandbox(): PluginSandbox | null {
  return defaultSandbox;
}

// Re-export types for convenience
export type { PluginCapabilities, SandboxContext, PluginInitOptions } from '@audiio/sdk';
