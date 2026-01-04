/**
 * Audiio Server - Library Entry Point
 *
 * This module exports the server components for programmatic use.
 * For CLI usage, see ./cli.ts
 */

// Core exports
export { StandaloneServer } from './standalone-server';
export { loadConfig, generateExampleConfig } from './config';

// Services
export { LibraryDatabase } from './services/library-db';
export { PluginLoader } from './services/plugin-loader';
export { pluginRepositoryService } from './services/plugin-repository';
export { pluginInstaller } from './services/plugin-installer';
export { mlService } from './services/ml-service';

// Paths
export { paths, appPaths } from './paths';

// Types
export type { ServerConfig } from './config';
export type { ServerInfo, StandaloneServerOptions } from './standalone-server';
export type { PluginManifest, LoadedPlugin, PluginLoadResult, PluginLoaderOptions } from './services/plugin-loader';
export type { PluginRepository, RepositoryPlugin, UpdateInfo } from './services/plugin-repository';
