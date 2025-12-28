/**
 * Plugin Loader Service
 * Dynamically discovers and loads plugins from npm packages and user folders
 */

import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';
import type { AddonRegistry, BaseAddon, AddonRole } from '@audiio/core';

export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  description?: string;
  roles: AddonRole[];
  main?: string;
  author?: string;
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

/**
 * Legacy plugin package names (for backwards compatibility during migration)
 * Maps old package names to new plugin pattern names
 */
const LEGACY_PLUGIN_NAMES: Record<string, string> = {
  '@audiio/deezer-metadata': '@audiio/plugin-deezer',
  '@audiio/youtube-music': '@audiio/plugin-youtube-music',
  '@audiio/applemusic-artwork': '@audiio/plugin-applemusic',
  '@audiio/lrclib-lyrics': '@audiio/plugin-lrclib',
  '@audiio/karaoke': '@audiio/plugin-karaoke',
  '@audiio/sposify': '@audiio/plugin-sposify',
  '@audiio/algo': '@audiio/plugin-algo'
};

export class PluginLoader {
  private registry: AddonRegistry;
  private loadedPlugins: Map<string, LoadedPlugin> = new Map();
  private userPluginsDir: string;

  constructor(registry: AddonRegistry) {
    this.registry = registry;
    this.userPluginsDir = path.join(app.getPath('userData'), 'plugins');

    // Ensure user plugins directory exists
    if (!fs.existsSync(this.userPluginsDir)) {
      fs.mkdirSync(this.userPluginsDir, { recursive: true });
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

    // Discover and load npm plugins
    const npmPlugins = await this.discoverNpmPlugins();
    for (const manifest of npmPlugins) {
      // Try to find the package name for this plugin
      const packageName = this.findPackageNameForPlugin(manifest.id);
      if (packageName) {
        const result = await this.loadNpmPlugin(packageName);
        results.push(result);
      }
    }

    // Load user plugins from plugins directory
    const userResults = await this.loadUserPlugins();
    results.push(...userResults);

    return results;
  }

  /**
   * Find the npm package name for a plugin ID
   */
  private findPackageNameForPlugin(pluginId: string): string | null {
    // Check if it's a legacy plugin name
    for (const [legacyName, newName] of Object.entries(LEGACY_PLUGIN_NAMES)) {
      if (newName.includes(pluginId) || legacyName.includes(pluginId)) {
        return legacyName;
      }
    }

    // Try standard plugin pattern
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

      // Instantiate and initialize the plugin
      const instance = new ProviderClass() as BaseAddon;
      await instance.initialize();

      // Register with the addon registry
      this.registry.register(instance);

      // Store in loaded plugins map
      const manifest: PluginManifest = {
        id: instance.manifest.id,
        name: instance.manifest.name,
        version: instance.manifest.version,
        description: instance.manifest.description,
        roles: instance.manifest.roles
      };

      this.loadedPlugins.set(manifest.id, {
        manifest,
        instance,
        source: 'npm',
        packageName
      });

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
   * Load a plugin from a local .audiio-plugin file
   */
  async loadLocalPlugin(pluginPath: string): Promise<PluginLoadResult> {
    try {
      console.log(`[PluginLoader] Loading local plugin: ${pluginPath}`);

      // Read and parse the plugin manifest
      const manifestPath = pluginPath.endsWith('.audiio-plugin')
        ? pluginPath
        : path.join(pluginPath, 'audiio-plugin.json');

      if (!fs.existsSync(manifestPath)) {
        return {
          success: false,
          error: 'Plugin manifest not found'
        };
      }

      const manifestContent = fs.readFileSync(manifestPath, 'utf-8');
      const manifest: PluginManifest = JSON.parse(manifestContent);

      if (!manifest.id || !manifest.name) {
        return {
          success: false,
          error: 'Invalid plugin manifest: missing id or name'
        };
      }

      // Check if already loaded
      if (this.loadedPlugins.has(manifest.id)) {
        return {
          success: true,
          pluginId: manifest.id
        };
      }

      // For local plugins, try to load from the main entry point
      if (manifest.main) {
        const pluginDir = path.dirname(manifestPath);
        const entryPath = path.join(pluginDir, manifest.main);

        const module = await this.dynamicImport(entryPath);
        const localModuleKeys = Object.keys(module);
        const localFirstKey = localModuleKeys[0];
        const ProviderClass = module.default || (localFirstKey ? module[localFirstKey] : undefined);

        if (ProviderClass && typeof ProviderClass === 'function') {
          const instance = new ProviderClass() as BaseAddon;
          await instance.initialize();
          this.registry.register(instance);

          this.loadedPlugins.set(manifest.id, {
            manifest,
            instance,
            source: 'local'
          });

          console.log(`[PluginLoader] Loaded local plugin: ${manifest.name}`);

          return {
            success: true,
            pluginId: manifest.id
          };
        }
      }

      return {
        success: false,
        error: 'Could not load plugin entry point'
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
        // Check for plugin pattern or legacy plugin names
        const isPlugin = entry.startsWith('plugin-') ||
                        Object.keys(LEGACY_PLUGIN_NAMES).some(legacy =>
                          legacy.replace('@audiio/', '') === entry
                        );

        if (!isPlugin) continue;

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
    // Try relative to app resources first (production)
    const resourcesPath = process.resourcesPath || app.getAppPath();
    const prodNodeModules = path.join(resourcesPath, 'node_modules');
    if (fs.existsSync(prodNodeModules)) {
      return prodNodeModules;
    }

    // Try relative to app path (development)
    const devNodeModules = path.join(app.getAppPath(), 'node_modules');
    if (fs.existsSync(devNodeModules)) {
      return devNodeModules;
    }

    // Try relative to __dirname
    const dirNodeModules = path.join(__dirname, '..', '..', 'node_modules');
    if (fs.existsSync(dirNodeModules)) {
      return dirNodeModules;
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

    try {
      const entries = await fs.promises.readdir(this.userPluginsDir);

      for (const entry of entries) {
        const entryPath = path.join(this.userPluginsDir, entry);
        const result = await this.loadLocalPlugin(entryPath);
        results.push(result);
      }
    } catch {
      // No user plugins to load
    }

    return results;
  }

  /**
   * Dynamic import helper that works in both ESM and CJS contexts
   */
  private async dynamicImport(specifier: string): Promise<any> {
    // Use Function constructor to prevent bundlers from transforming the import
    const dynamicImportFn = new Function('specifier', 'return import(specifier)');
    return dynamicImportFn(specifier);
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
