/**
 * Configuration loader for Audiio Standalone Server
 *
 * Supports (in order of precedence):
 * 1. Environment variables (AUDIIO_*)
 * 2. Config file (config.yml or config.json)
 * 3. Default values
 */

import * as fs from 'fs';
import * as path from 'path';
import YAML from 'yaml';

export interface ServerConfig {
  server: {
    port: number;
    host: string;
    name?: string;  // Server name for device pairing (e.g., "Jordan's MacBook Pro")
  };
  plugins: {
    directory: string;
    autoload: boolean;
  };
  storage: {
    database: string;
    cache: string;
  };
  relay: {
    enabled: boolean;
    url: string;
  };
  auth: {
    requirePairing: boolean;
    sessionTimeout: number; // minutes
  };
  logging: {
    level: 'debug' | 'info' | 'warn' | 'error';
  };
}

const DEFAULT_CONFIG: ServerConfig = {
  server: {
    port: 8484,
    host: '0.0.0.0'
  },
  plugins: {
    directory: './plugins',
    autoload: true
  },
  storage: {
    database: './data/audiio.db',
    cache: './data/cache'
  },
  relay: {
    enabled: true,
    url: 'wss://audiio-relay.fly.dev'
  },
  auth: {
    requirePairing: true,
    sessionTimeout: 60 * 24 * 7 // 1 week
  },
  logging: {
    level: 'info'
  }
};

/**
 * Load configuration from environment variables
 */
function loadFromEnv(): Partial<ServerConfig> {
  const config: any = {};

  // Server
  if (process.env.AUDIIO_PORT) {
    config.server = config.server || {};
    config.server.port = parseInt(process.env.AUDIIO_PORT, 10);
  }
  if (process.env.AUDIIO_HOST) {
    config.server = config.server || {};
    config.server.host = process.env.AUDIIO_HOST;
  }
  if (process.env.AUDIIO_SERVER_NAME) {
    config.server = config.server || {};
    config.server.name = process.env.AUDIIO_SERVER_NAME;
  }

  // Plugins
  if (process.env.AUDIIO_PLUGINS_DIR) {
    config.plugins = config.plugins || {};
    config.plugins.directory = process.env.AUDIIO_PLUGINS_DIR;
  }

  // Storage
  if (process.env.AUDIIO_DATABASE) {
    config.storage = config.storage || {};
    config.storage.database = process.env.AUDIIO_DATABASE;
  }
  if (process.env.AUDIIO_CACHE_DIR) {
    config.storage = config.storage || {};
    config.storage.cache = process.env.AUDIIO_CACHE_DIR;
  }

  // Relay
  if (process.env.AUDIIO_RELAY_ENABLED) {
    config.relay = config.relay || {};
    config.relay.enabled = process.env.AUDIIO_RELAY_ENABLED === 'true';
  }
  if (process.env.AUDIIO_RELAY_URL) {
    config.relay = config.relay || {};
    config.relay.url = process.env.AUDIIO_RELAY_URL;
  }

  // Auth
  if (process.env.AUDIIO_REQUIRE_PAIRING) {
    config.auth = config.auth || {};
    config.auth.requirePairing = process.env.AUDIIO_REQUIRE_PAIRING === 'true';
  }

  // Logging
  if (process.env.AUDIIO_LOG_LEVEL) {
    config.logging = config.logging || {};
    config.logging.level = process.env.AUDIIO_LOG_LEVEL as any;
  }

  return config;
}

/**
 * Load configuration from file
 */
function loadFromFile(configPath?: string): Partial<ServerConfig> {
  // Try to find config file
  const searchPaths = configPath
    ? [configPath]
    : [
        './config.yml',
        './config.yaml',
        './config.json',
        path.join(process.cwd(), 'config.yml'),
        path.join(process.cwd(), 'config.yaml'),
        path.join(process.cwd(), 'config.json')
      ];

  for (const filePath of searchPaths) {
    if (fs.existsSync(filePath)) {
      console.log(`[Config] Loading from: ${filePath}`);
      const content = fs.readFileSync(filePath, 'utf-8');

      if (filePath.endsWith('.json')) {
        return JSON.parse(content);
      } else {
        return YAML.parse(content);
      }
    }
  }

  return {};
}

/**
 * Deep merge two objects
 */
function deepMerge<T extends object>(target: T, source: Partial<T>): T {
  const result = { ...target };

  for (const key of Object.keys(source) as (keyof T)[]) {
    const sourceValue = source[key];
    const targetValue = result[key];

    if (sourceValue !== undefined) {
      if (
        typeof sourceValue === 'object' &&
        sourceValue !== null &&
        !Array.isArray(sourceValue) &&
        typeof targetValue === 'object' &&
        targetValue !== null
      ) {
        result[key] = deepMerge(targetValue as any, sourceValue as any);
      } else {
        result[key] = sourceValue as any;
      }
    }
  }

  return result;
}

/**
 * Resolve relative paths to absolute paths
 */
function resolvePaths(config: ServerConfig, basePath: string): ServerConfig {
  const resolve = (p: string) => path.isAbsolute(p) ? p : path.resolve(basePath, p);

  return {
    ...config,
    plugins: {
      ...config.plugins,
      directory: resolve(config.plugins.directory)
    },
    storage: {
      ...config.storage,
      database: resolve(config.storage.database),
      cache: resolve(config.storage.cache)
    }
  };
}

/**
 * Ensure required directories exist
 */
function ensureDirectories(config: ServerConfig): void {
  const dirs = [
    config.plugins.directory,
    path.dirname(config.storage.database),
    config.storage.cache
  ];

  for (const dir of dirs) {
    if (!fs.existsSync(dir)) {
      console.log(`[Config] Creating directory: ${dir}`);
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}

export interface LoadConfigOptions {
  configPath?: string;
  basePath?: string;
  skipDirectoryCreation?: boolean;
}

/**
 * Load and merge configuration from all sources
 */
export function loadConfig(options: LoadConfigOptions = {}): ServerConfig {
  const basePath = options.basePath || process.cwd();

  // Load from file first (lowest precedence after defaults)
  const fileConfig = loadFromFile(options.configPath);

  // Load from environment (highest precedence)
  const envConfig = loadFromEnv();

  // Merge: defaults <- file <- env
  let config = deepMerge(DEFAULT_CONFIG, fileConfig);
  config = deepMerge(config, envConfig);

  // Resolve relative paths
  config = resolvePaths(config, basePath);

  // Create directories
  if (!options.skipDirectoryCreation) {
    ensureDirectories(config);
  }

  return config;
}

/**
 * Generate example config file
 */
export function generateExampleConfig(): string {
  return YAML.stringify({
    server: {
      port: 8484,
      host: '0.0.0.0'
    },
    plugins: {
      directory: './plugins',
      autoload: true
    },
    storage: {
      database: './data/audiio.db',
      cache: './data/cache'
    },
    relay: {
      enabled: true,
      url: 'wss://audiio-relay.fly.dev'
    },
    auth: {
      requirePairing: true,
      sessionTimeout: 10080 // 1 week in minutes
    },
    logging: {
      level: 'info'
    }
  });
}
