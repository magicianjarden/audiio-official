/**
 * Plugin Loader Service
 * Dynamically discovers and loads plugins from npm packages and user folders
 *
 * Integrates with PluginSandbox to provide secure, capability-based access
 * to filesystem, network, and APIs.
 */

import * as fs from 'fs';
import * as path from 'path';
import { pathToFileURL } from 'url';
import Module from 'module';
import type { AddonRegistry, BaseAddon, AddonRole } from '@audiio/core';
import type { PluginRouteHandler, PluginCapabilities, PluginInitOptions } from '@audiio/sdk';
import { paths, appPaths } from '../paths';
import type { PluginRouter } from './plugin-router';
import { getPluginSandbox } from './plugin-sandbox';

// Hook into Node's module resolution to provide @audiio/sdk and @audiio/core to plugins
const originalResolveFilename = (Module as any)._resolveFilename;
(Module as any)._resolveFilename = function(request: string, parent: any, isMain: boolean, options: any) {
  // Redirect @audiio/sdk and @audiio/core to the app's bundled versions
  if (request === '@audiio/sdk' || request === '@audiio/core') {
    const possiblePaths = appPaths.getModulePaths(request);

    console.log(`[PluginLoader] Resolving ${request}, checking paths:`, possiblePaths.map(p => `${p} (exists: ${fs.existsSync(p)})`));

    for (const pkgPath of possiblePaths) {
      if (fs.existsSync(pkgPath)) {
        console.log(`[PluginLoader] Found ${request} at: ${pkgPath}`);
        return originalResolveFilename.call(this, pkgPath, parent, isMain, options);
      }
    }

    console.log(`[PluginLoader] Could not find ${request} in any location`);
  }

  return originalResolveFilename.call(this, request, parent, isMain, options);
};

export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  description?: string;
  roles: AddonRole[];
  main?: string;
  author?: string;
  /** Default enabled state */
  defaultEnabled?: boolean;
  /** Required capabilities for sandboxed execution */
  capabilities?: Partial<PluginCapabilities>;
}

export interface LoadedPlugin {
  manifest: PluginManifest;
  instance: BaseAddon;
  source: 'npm' | 'local' | 'user';
  packageName?: string;
}

export interface PluginLoadResult {
  success: boolean;
  pluginId?: string;
  error?: string;
}

export interface PluginLoaderOptions {
  pluginsDir?: string;
}

export class PluginLoader {
  private registry: AddonRegistry;
  private loadedPlugins: Map<string, LoadedPlugin> = new Map();
  private userPluginsDir: string;
  private pluginRouter: PluginRouter | null = null;

  constructor(registry: AddonRegistry, options?: PluginLoaderOptions) {
    this.registry = registry;
    this.userPluginsDir = options?.pluginsDir || paths.plugins;

    // Ensure user plugins directory exists
    if (!fs.existsSync(this.userPluginsDir)) {
      fs.mkdirSync(this.userPluginsDir, { recursive: true });
    }
  }

  /**
   * Set the plugin router for registering plugin routes
   */
  setPluginRouter(router: PluginRouter): void {
    this.pluginRouter = router;
  }

  /**
   * Register routes for a plugin if it implements getRoutes()
   */
  private registerPluginRoutes(pluginId: string, instance: any): void {
    if (!this.pluginRouter) return;

    // Check if plugin implements getRoutes()
    if (typeof instance.getRoutes === 'function') {
      try {
        const routes: PluginRouteHandler[] = instance.getRoutes();
        if (routes && routes.length > 0) {
          this.pluginRouter.registerPlugin(pluginId, routes);
          console.log(`[PluginLoader] Registered ${routes.length} routes for ${pluginId}`);
        }
      } catch (error) {
        console.error(`[PluginLoader] Failed to register routes for ${pluginId}:`, error);
      }
    }
  }

  /**
   * Discover all available plugins from various sources
   */
  async discoverPlugins(): Promise<PluginManifest[]> {
    const discovered: PluginManifest[] = [];

    // 1. Discover npm-installed plugins
    const npmPlugins = await this.discoverNpmPlugins();
    discovered.push(...npmPlugins);

    // 2. Discover user-installed plugins (.audiio-plugin files)
    const userPlugins = await this.discoverUserPlugins();
    discovered.push(...userPlugins);

    console.log(`[PluginLoader] Discovered ${discovered.length} plugins`);
    return discovered;
  }

  /**
   * Load all discovered plugins
   */
  async loadAllPlugins(): Promise<PluginLoadResult[]> {
    const results: PluginLoadResult[] = [];

    // 1. Load bundled plugins first (from packages/server/plugins/)
    const bundledResults = await this.loadBundledPlugins();
    results.push(...bundledResults);

    // 2. Load npm plugins (only if not already loaded as bundled)
    const npmPlugins = await this.discoverNpmPlugins();
    for (const manifest of npmPlugins) {
      // Skip if already loaded as bundled plugin
      if (this.loadedPlugins.has(manifest.id)) {
        continue;
      }
      const packageName = this.findPackageNameForPlugin(manifest.id);
      if (packageName) {
        const result = await this.loadNpmPlugin(packageName);
        results.push(result);
      }
    }

    // 3. Load user plugins from plugins directory
    const userResults = await this.loadUserPlugins();
    results.push(...userResults);

    return results;
  }

  /**
   * Load bundled plugins from packages/server/plugins/
   */
  private async loadBundledPlugins(): Promise<PluginLoadResult[]> {
    const results: PluginLoadResult[] = [];

    // Find the bundled plugins directory relative to this file
    const bundledPluginsDir = path.join(__dirname, '..', '..', 'plugins');

    if (!fs.existsSync(bundledPluginsDir)) {
      console.log('[PluginLoader] Bundled plugins directory not found:', bundledPluginsDir);
      return results;
    }

    console.log(`[PluginLoader] Loading bundled plugins from: ${bundledPluginsDir}`);

    try {
      const entries = fs.readdirSync(bundledPluginsDir);

      for (const entry of entries) {
        const pluginDir = path.join(bundledPluginsDir, entry);
        const stat = fs.statSync(pluginDir);

        if (!stat.isDirectory()) continue;

        // Check for package.json
        const packageJsonPath = path.join(pluginDir, 'package.json');
        if (!fs.existsSync(packageJsonPath)) {
          console.log(`[PluginLoader] Skipping ${entry}: no package.json`);
          continue;
        }

        try {
          const pkgJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
          const mainFile = pkgJson.main || 'dist/index.js';
          const entryPath = path.join(pluginDir, mainFile);

          if (!fs.existsSync(entryPath)) {
            console.log(`[PluginLoader] Skipping ${entry}: entry point not found at ${mainFile}`);
            continue;
          }

          // Load the plugin
          console.log(`[PluginLoader] Loading bundled plugin: ${pkgJson.name}`);

          // Clear require cache for reloading
          try {
            delete require.cache[require.resolve(entryPath)];
          } catch {
            // Not cached yet
          }

          const module = require(entryPath);
          const moduleKeys = Object.keys(module);
          const firstKey = moduleKeys[0];
          const ProviderClass = module.default || (firstKey ? module[firstKey] : undefined);

          if (!ProviderClass || typeof ProviderClass !== 'function') {
            console.log(`[PluginLoader] Skipping ${entry}: no valid export`);
            continue;
          }

          const instance = new ProviderClass() as BaseAddon;

          const manifest: PluginManifest = {
            id: instance.manifest.id,
            name: instance.manifest.name,
            version: instance.manifest.version,
            description: instance.manifest.description,
            roles: instance.manifest.roles,
            capabilities: (instance.manifest as any).capabilities
          };

          // Register with sandbox and get init options
          const initOptions = await this.createSandboxContext(manifest);

          // Initialize the plugin with sandbox context
          if (initOptions && typeof (instance as any).initialize === 'function') {
            await (instance as any).initialize(initOptions);
          } else {
            await instance.initialize();
          }

          // Register with the addon registry
          this.registry.register(instance);

          this.loadedPlugins.set(manifest.id, {
            manifest,
            instance,
            source: 'local',
            packageName: pkgJson.name
          });

          // Register plugin routes if available
          this.registerPluginRoutes(manifest.id, instance);

          console.log(`[PluginLoader] Loaded bundled plugin: ${manifest.name} (${manifest.id})`);

          results.push({
            success: true,
            pluginId: manifest.id
          });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          console.warn(`[PluginLoader] Failed to load bundled plugin ${entry}:`, errorMessage);
          results.push({
            success: false,
            error: errorMessage
          });
        }
      }
    } catch (error) {
      console.error('[PluginLoader] Error scanning bundled plugins:', error);
    }

    return results;
  }

  /**
   * Find the npm package name for a plugin ID
   */
  private findPackageNameForPlugin(pluginId: string): string | null {
    // Use standard plugin pattern
    return `@audiio/plugin-${pluginId}`;
  }

  /**
   * Load a plugin from npm package
   */
  async loadNpmPlugin(packageName: string): Promise<PluginLoadResult> {
    try {
      console.log(`[PluginLoader] Attempting to load: ${packageName}`);

      // Dynamic import the plugin module
      const module = await this.dynamicImport(packageName);

      // Get the provider class (either default export or first named export)
      const moduleKeys = Object.keys(module);
      const firstKey = moduleKeys[0];
      const ProviderClass = module.default || (firstKey ? module[firstKey] : undefined);

      if (!ProviderClass || typeof ProviderClass !== 'function') {
        return {
          success: false,
          error: `Invalid plugin export in ${packageName}`
        };
      }

      // Instantiate the plugin
      const instance = new ProviderClass() as BaseAddon;

      // Extract manifest info
      const manifest: PluginManifest = {
        id: instance.manifest.id,
        name: instance.manifest.name,
        version: instance.manifest.version,
        description: instance.manifest.description,
        roles: instance.manifest.roles,
        capabilities: (instance.manifest as any).capabilities
      };

      // Register with sandbox and get init options
      const initOptions = await this.createSandboxContext(manifest);

      // Initialize the plugin with sandbox context
      if (initOptions && typeof (instance as any).initialize === 'function') {
        await (instance as any).initialize(initOptions);
      } else {
        await instance.initialize();
      }

      // Register with the addon registry
      this.registry.register(instance);

      this.loadedPlugins.set(manifest.id, {
        manifest,
        instance,
        source: 'npm',
        packageName
      });

      // Register plugin routes if available
      this.registerPluginRoutes(manifest.id, instance);

      console.log(`[PluginLoader] Loaded: ${manifest.name} (${manifest.id})`);

      return {
        success: true,
        pluginId: manifest.id
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      // Don't log as error if plugin simply isn't installed
      if (errorMessage.includes('Cannot find module') || errorMessage.includes('MODULE_NOT_FOUND')) {
        console.log(`[PluginLoader] Plugin not installed: ${packageName}`);
      } else {
        console.warn(`[PluginLoader] Failed to load ${packageName}:`, errorMessage);
      }

      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * Load a plugin from a local directory or .audiio-plugin file
   */
  async loadLocalPlugin(pluginPath: string): Promise<PluginLoadResult> {
    try {
      console.log(`[PluginLoader] Loading local plugin: ${pluginPath}`);

      let manifest: PluginManifest | null = null;
      let pluginDir: string;

      // Check for .audiio-plugin file
      if (pluginPath.endsWith('.audiio-plugin')) {
        if (!fs.existsSync(pluginPath)) {
          return { success: false, error: 'Plugin file not found' };
        }
        const manifestContent = fs.readFileSync(pluginPath, 'utf-8');
        manifest = JSON.parse(manifestContent);
        pluginDir = path.dirname(pluginPath);
      } else {
        pluginDir = pluginPath;

        // Try audiio-plugin.json first
        const audiioManifestPath = path.join(pluginDir, 'audiio-plugin.json');
        if (fs.existsSync(audiioManifestPath)) {
          const manifestContent = fs.readFileSync(audiioManifestPath, 'utf-8');
          manifest = JSON.parse(manifestContent);
        } else {
          // Fall back to package.json with audiio metadata
          const pkgJsonPath = path.join(pluginDir, 'package.json');
          if (fs.existsSync(pkgJsonPath)) {
            const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8'));
            const audiioMeta = pkgJson.audiio || {};

            if (audiioMeta.id || pkgJson.name) {
              manifest = {
                id: audiioMeta.id || pkgJson.name?.replace('@audiio/plugin-', ''),
                name: audiioMeta.name || pkgJson.name,
                version: pkgJson.version || '1.0.0',
                description: pkgJson.description,
                roles: audiioMeta.roles || [],
                main: pkgJson.main || './dist/index.js',
                author: pkgJson.author,
              };
            }
          }
        }
      }

      if (!manifest) {
        return { success: false, error: 'Plugin manifest not found' };
      }

      if (!manifest.id || !manifest.name) {
        return {
          success: false,
          error: 'Invalid plugin manifest: missing id or name'
        };
      }

      // Check if already loaded
      if (this.loadedPlugins.has(manifest.id)) {
        console.log(`[PluginLoader] Plugin ${manifest.id} already loaded, skipping`);
        return {
          success: true,
          pluginId: manifest.id
        };
      }

      // For local plugins, try to load from the main entry point
      const mainEntry = manifest.main || './dist/index.js';
      const entryPath = path.join(pluginDir, mainEntry);

      if (!fs.existsSync(entryPath)) {
        return {
          success: false,
          error: `Entry point not found: ${mainEntry}`
        };
      }

      // Use require for CommonJS plugins to ensure module resolution hooks work
      // Clear cache first to allow reloading
      try {
        delete require.cache[require.resolve(entryPath)];
      } catch {
        // Module not in cache yet, that's fine
      }

      const module = require(entryPath);
      const moduleKeys = Object.keys(module);
      const firstKey = moduleKeys[0];
      const ProviderClass = module.default || (firstKey ? module[firstKey] : undefined);

      if (!ProviderClass || typeof ProviderClass !== 'function') {
        return {
          success: false,
          error: 'No valid export found in plugin'
        };
      }

      const instance = new ProviderClass() as BaseAddon;

      // Register with sandbox and get init options
      const initOptions = await this.createSandboxContext(manifest);

      // Initialize the plugin with sandbox context
      if (initOptions && typeof (instance as any).initialize === 'function') {
        await (instance as any).initialize(initOptions);
      } else {
        await instance.initialize();
      }

      this.registry.register(instance);

      this.loadedPlugins.set(manifest.id, {
        manifest,
        instance,
        source: 'local'
      });

      // Register plugin routes if available
      this.registerPluginRoutes(manifest.id, instance);

      console.log(`[PluginLoader] Loaded local plugin: ${manifest.name} (${manifest.id})`);

      return {
        success: true,
        pluginId: manifest.id
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[PluginLoader] Failed to load local plugin:`, errorMessage);

      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * Create sandbox context for a plugin based on its manifest
   */
  private async createSandboxContext(manifest: PluginManifest): Promise<PluginInitOptions | null> {
    const sandbox = getPluginSandbox();
    if (!sandbox) {
      console.log(`[PluginLoader] Sandbox not available, plugin ${manifest.id} will run unsandboxed`);
      return null;
    }

    try {
      const { context } = await sandbox.registerPlugin(
        manifest.id,
        manifest.name,
        manifest.version,
        manifest.capabilities || {}
      );

      return { sandbox: context };
    } catch (error) {
      console.error(`[PluginLoader] Failed to create sandbox for ${manifest.id}:`, error);
      return null;
    }
  }

  /**
   * Discover plugins from npm (check node_modules for @audiio/plugin-* packages)
   */
  private async discoverNpmPlugins(): Promise<PluginManifest[]> {
    const manifests: PluginManifest[] = [];

    // Try to find all @audiio packages in node_modules
    const nodeModulesPath = this.findNodeModulesPath();
    if (!nodeModulesPath) {
      console.log('[PluginLoader] node_modules not found');
      return manifests;
    }

    const audiioScopePath = path.join(nodeModulesPath, '@audiio');
    if (!fs.existsSync(audiioScopePath)) {
      console.log('[PluginLoader] @audiio scope not found in node_modules');
      return manifests;
    }

    try {
      const scopeEntries = fs.readdirSync(audiioScopePath);

      for (const entry of scopeEntries) {
        // Only look for standard plugin pattern (plugin-*)
        if (!entry.startsWith('plugin-')) continue;

        const packageName = `@audiio/${entry}`;
        try {
          const pkgJsonPath = path.join(audiioScopePath, entry, 'package.json');
          if (!fs.existsSync(pkgJsonPath)) continue;

          const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8'));

          // Extract audiio plugin metadata if available
          const audiioMeta = pkgJson.audiio || {};

          manifests.push({
            id: audiioMeta.id || pkgJson.name,
            name: audiioMeta.name || pkgJson.name,
            version: pkgJson.version,
            description: pkgJson.description,
            roles: audiioMeta.roles || [],
            author: pkgJson.author
          });

          console.log(`[PluginLoader] Discovered npm plugin: ${packageName}`);
        } catch {
          // Invalid package - skip
        }
      }
    } catch (error) {
      console.warn('[PluginLoader] Error scanning @audiio scope:', error);
    }

    return manifests;
  }

  /**
   * Find the node_modules path for plugin discovery
   */
  private findNodeModulesPath(): string | null {
    // Try various node_modules locations
    const possiblePaths = [
      // Current working directory
      path.join(process.cwd(), 'node_modules'),
      // Relative to __dirname
      path.join(__dirname, '..', '..', 'node_modules'),
      path.join(__dirname, '..', '..', '..', 'node_modules'),
      path.join(__dirname, '..', '..', '..', '..', 'node_modules'),
    ];

    for (const nodePath of possiblePaths) {
      if (fs.existsSync(nodePath)) {
        return nodePath;
      }
    }

    return null;
  }

  /**
   * Discover user-installed plugins
   */
  private async discoverUserPlugins(): Promise<PluginManifest[]> {
    const manifests: PluginManifest[] = [];

    try {
      const entries = await fs.promises.readdir(this.userPluginsDir);

      for (const entry of entries) {
        const entryPath = path.join(this.userPluginsDir, entry);
        const stat = await fs.promises.stat(entryPath);

        if (stat.isDirectory()) {
          // Check for audiio-plugin.json in directory
          const manifestPath = path.join(entryPath, 'audiio-plugin.json');
          if (fs.existsSync(manifestPath)) {
            try {
              const content = fs.readFileSync(manifestPath, 'utf-8');
              const manifest = JSON.parse(content) as PluginManifest;
              manifests.push(manifest);
            } catch {
              console.warn(`[PluginLoader] Invalid manifest in ${entry}`);
            }
          }
        } else if (entry.endsWith('.audiio-plugin')) {
          // Single-file plugin manifest
          try {
            const content = fs.readFileSync(entryPath, 'utf-8');
            const manifest = JSON.parse(content) as PluginManifest;
            manifests.push(manifest);
          } catch {
            console.warn(`[PluginLoader] Invalid plugin file: ${entry}`);
          }
        }
      }
    } catch {
      // User plugins directory doesn't exist or can't be read
    }

    return manifests;
  }

  /**
   * Load all user-installed plugins
   */
  private async loadUserPlugins(): Promise<PluginLoadResult[]> {
    const results: PluginLoadResult[] = [];

    console.log(`[PluginLoader] Loading user plugins from: ${this.userPluginsDir}`);

    try {
      if (!fs.existsSync(this.userPluginsDir)) {
        console.log('[PluginLoader] User plugins directory does not exist');
        return results;
      }

      const entries = await fs.promises.readdir(this.userPluginsDir);
      console.log(`[PluginLoader] Found ${entries.length} entries in plugins directory:`, entries);

      for (const entry of entries) {
        // Skip internal directories
        if (entry.startsWith('_')) {
          console.log(`[PluginLoader] Skipping internal directory: ${entry}`);
          continue;
        }

        const entryPath = path.join(this.userPluginsDir, entry);
        console.log(`[PluginLoader] Attempting to load: ${entryPath}`);
        const result = await this.loadLocalPlugin(entryPath);
        console.log(`[PluginLoader] Load result for ${entry}:`, result);
        results.push(result);
      }
    } catch (error) {
      console.error('[PluginLoader] Error loading user plugins:', error);
    }

    return results;
  }

  /**
   * Dynamic import helper that works in both ESM and CJS contexts
   */
  private async dynamicImport(specifier: string): Promise<any> {
    // Convert absolute paths to file:// URLs for ESM loader on Windows
    let importSpecifier = specifier;
    if (path.isAbsolute(specifier)) {
      importSpecifier = pathToFileURL(specifier).href;
    }

    // Use Function constructor to prevent bundlers from transforming the import
    const dynamicImportFn = new Function('specifier', 'return import(specifier)');
    return dynamicImportFn(importSpecifier);
  }

  /**
   * Get all loaded plugins
   */
  getLoadedPlugins(): LoadedPlugin[] {
    return Array.from(this.loadedPlugins.values());
  }

  /**
   * Get a specific loaded plugin
   */
  getPlugin(pluginId: string): LoadedPlugin | undefined {
    return this.loadedPlugins.get(pluginId);
  }

  /**
   * Check if a plugin is loaded
   */
  isPluginLoaded(pluginId: string): boolean {
    return this.loadedPlugins.has(pluginId);
  }

  /**
   * Unload a plugin
   */
  async unloadPlugin(pluginId: string): Promise<boolean> {
    const plugin = this.loadedPlugins.get(pluginId);
    if (!plugin) {
      return false;
    }

    try {
      await plugin.instance.dispose();
      this.registry.unregister(pluginId);
      this.loadedPlugins.delete(pluginId);
      console.log(`[PluginLoader] Unloaded: ${pluginId}`);
      return true;
    } catch (error) {
      console.error(`[PluginLoader] Failed to unload ${pluginId}:`, error);
      return false;
    }
  }

  /**
   * Reload all plugins
   */
  async reloadPlugins(): Promise<PluginLoadResult[]> {
    // Unload all current plugins
    for (const pluginId of this.loadedPlugins.keys()) {
      await this.unloadPlugin(pluginId);
    }

    // Load all plugins again
    return this.loadAllPlugins();
  }
}
