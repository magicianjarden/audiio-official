/**
 * Plugin Sandbox Types
 *
 * Types for sandboxed plugin execution with capability-based permissions.
 * Plugins receive a SandboxContext during initialization that provides
 * controlled access to filesystem, network, and APIs.
 */

/**
 * Sandboxed filesystem interface
 * Only allows access to paths explicitly granted to the plugin
 */
export interface SandboxedFS {
  /** Read a file (requires filesystem.read capability + path in allowedPaths) */
  readFile(path: string): Promise<Buffer>;
  /** Write a file (requires filesystem.write capability + path in allowedPaths) */
  writeFile(path: string, data: string | Buffer): Promise<void>;
  /** Read directory contents */
  readdir(path: string): Promise<string[]>;
  /** Get file/directory stats */
  stat(path: string): Promise<{ isFile: boolean; isDirectory: boolean; size: number; modifiedAt: number }>;
  /** Check if path exists */
  exists(path: string): Promise<boolean>;
  /** Create directory (recursive) */
  mkdir(path: string): Promise<void>;
  /** Delete file */
  unlink(path: string): Promise<void>;
  /** Read directory recursively with file types */
  readdirRecursive(path: string, options?: { maxDepth?: number }): Promise<Array<{
    path: string;
    type: 'file' | 'directory';
    size?: number;
  }>>;
}

/**
 * Sandboxed fetch function
 * Only allows requests to hosts explicitly granted to the plugin
 */
export type SandboxedFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

/**
 * Plugin capabilities configuration
 */
export interface PluginCapabilities {
  filesystem: {
    /** Can read files */
    read: boolean;
    /** Can write files */
    write: boolean;
    /** Allowed paths (whitelist) - empty means no access */
    allowedPaths?: string[];
  };
  network: {
    /** Can make outbound requests */
    outbound: boolean;
    /** Allowed hosts (whitelist) - empty/undefined means all hosts if outbound=true */
    allowedHosts?: string[];
  };
  apis: {
    /** Access to library API (likes, playlists, history) */
    library: boolean;
    /** Access to player control */
    player: boolean;
    /** Access to settings */
    settings: boolean;
    /** Access to tracking events */
    tracking: boolean;
  };
  resources: {
    /** Max memory in MB */
    maxMemory?: number;
    /** Max execution timeout in ms */
    timeout?: number;
    /** Max CPU time in ms */
    maxCpuTime?: number;
  };
}

/**
 * Context passed to plugins during initialization
 * Provides sandboxed access to system resources
 */
export interface SandboxContext {
  /** Plugin ID */
  pluginId: string;

  /** Sandboxed filesystem access */
  fs: SandboxedFS;

  /** Sandboxed fetch function */
  fetch: SandboxedFetch;

  /** Plugin's data directory (always writable) */
  dataDir: string;

  /** Current capabilities granted to this plugin */
  capabilities: Readonly<PluginCapabilities>;

  /**
   * Request additional path access
   * Returns true if granted, false if denied
   * This triggers an authorization flow (admin approval)
   */
  requestPathAccess(path: string, write?: boolean): Promise<boolean>;

  /**
   * Get list of currently authorized paths
   */
  getAuthorizedPaths(): string[];

  /**
   * Log a message (sandboxed, goes to plugin log)
   */
  log: {
    info(message: string, ...args: any[]): void;
    warn(message: string, ...args: any[]): void;
    error(message: string, ...args: any[]): void;
    debug(message: string, ...args: any[]): void;
  };
}

/**
 * Plugin initialization options passed to initialize()
 */
export interface PluginInitOptions {
  /** Sandbox context for secure resource access */
  sandbox: SandboxContext;

  /** Server-provided configuration for this plugin */
  config?: Record<string, unknown>;
}

/**
 * Base interface for plugins that support sandboxed execution
 */
export interface SandboxedPlugin {
  /**
   * Initialize plugin with sandbox context
   * Plugins should store the sandbox reference and use it for all resource access
   */
  initialize(options?: PluginInitOptions): Promise<void>;
}

/**
 * Manifest extension for declaring required capabilities
 */
export interface PluginCapabilityManifest {
  /** Required capabilities */
  capabilities?: Partial<PluginCapabilities>;

  /** Whether this plugin needs filesystem access (shorthand) */
  needsFilesystem?: boolean;

  /** Whether this plugin needs network access (shorthand) */
  needsNetwork?: boolean;
}
