/**
 * Server Paths - Platform-agnostic path resolution
 * Replaces Electron's app.getPath() with configurable paths
 */

import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';

// Default data directory based on platform
function getDefaultDataDir(): string {
  const appName = 'audiio-server';

  switch (process.platform) {
    case 'win32':
      return path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), appName);
    case 'darwin':
      return path.join(os.homedir(), 'Library', 'Application Support', appName);
    default: // linux and others
      return path.join(process.env.XDG_DATA_HOME || path.join(os.homedir(), '.local', 'share'), appName);
  }
}

// Configuration from environment or defaults
const config = {
  dataDir: process.env.AUDIIO_DATA_DIR || getDefaultDataDir(),
  pluginsDir: process.env.AUDIIO_PLUGINS_DIR || '',
  cacheDir: process.env.AUDIIO_CACHE_DIR || '',
};

// Ensure data directory exists
if (!fs.existsSync(config.dataDir)) {
  fs.mkdirSync(config.dataDir, { recursive: true });
}

// Derived paths
export const paths = {
  // Base data directory (like app.getPath('userData'))
  data: config.dataDir,

  // Plugins directory
  plugins: config.pluginsDir || path.join(config.dataDir, 'plugins'),

  // Cache directory
  cache: config.cacheDir || path.join(config.dataDir, 'cache'),

  // Database file
  database: path.join(config.dataDir, 'audiio.db'),

  // ML models directory
  models: path.join(config.dataDir, 'models'),

  // Config file
  config: path.join(config.dataDir, 'config.json'),

  // Logs directory
  logs: path.join(config.dataDir, 'logs'),

  // Downloads directory (for local music)
  downloads: path.join(config.dataDir, 'downloads'),
};

// Ensure directories exist
const dirsToCreate = [paths.plugins, paths.cache, paths.models, paths.logs, paths.downloads];
for (const dir of dirsToCreate) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// App path resolution (for finding node_modules, etc.)
export const appPaths = {
  // Root of the application
  root: process.cwd(),

  // Whether running in production (bundled) mode
  isPackaged: process.env.NODE_ENV === 'production',

  // Get possible paths for a module
  getModulePaths: (moduleName: string): string[] => {
    return [
      // Current working directory
      path.join(process.cwd(), 'node_modules', moduleName),
      // Workspace packages
      path.join(process.cwd(), 'packages', moduleName.replace('@audiio/', '')),
      path.join(process.cwd(), 'packages', 'shared', moduleName.replace('@audiio/', '')),
      // Relative to this file
      path.join(__dirname, '..', 'node_modules', moduleName),
      path.join(__dirname, '..', '..', 'node_modules', moduleName),
      path.join(__dirname, '..', '..', '..', 'node_modules', moduleName),
      path.join(__dirname, '..', '..', '..', 'shared', moduleName.replace('@audiio/', '')),
    ];
  },
};

export default paths;
