/**
 * Plugin Repository Service
 * Manages plugin repositories and fetches available plugins from registries
 *
 * Note: No repositories are built-in. The app starts as a skeleton and
 * users choose which repositories to add (100% user choice).
 */

import * as fs from 'fs';
import * as path from 'path';
import { paths } from '../paths';
import type { AddonRole } from '@audiio/core';

export interface PluginRepository {
  id: string;
  name: string;
  url: string;           // URL to registry.json
  enabled: boolean;
  lastUpdated?: number;  // Timestamp of last fetch
  pluginCount?: number;  // Cached count of plugins
}

export interface RepositoryPlugin {
  id: string;
  name: string;
  version: string;
  roles: AddonRole[];
  description: string;
  author: string;
  downloadUrl: string;   // npm:@audiio/plugin-* or git:https://github.com/...
  icon?: string;
  homepage?: string;
  repository?: string;
  dependencies?: string[];
}

export interface RegistryJson {
  name: string;
  version: string;
  plugins: RepositoryPlugin[];
}

export interface RepositoryFetchResult {
  success: boolean;
  repository?: PluginRepository;
  plugins?: RepositoryPlugin[];
  error?: string;
}

export interface UpdateInfo {
  pluginId: string;
  currentVersion: string;
  latestVersion: string;
  repositoryId: string;
}

class PluginRepositoryService {
  private repositories: Map<string, PluginRepository> = new Map();
  private pluginCache: Map<string, RepositoryPlugin[]> = new Map();
  private configPath: string;

  constructor() {
    this.configPath = path.join(paths.data, 'plugin-repositories.json');
    this.loadRepositories();
  }

  /**
   * Load repositories from disk
   */
  private loadRepositories(): void {
    try {
      if (fs.existsSync(this.configPath)) {
        const data = fs.readFileSync(this.configPath, 'utf-8');
        const repos: PluginRepository[] = JSON.parse(data);
        for (const repo of repos) {
          this.repositories.set(repo.id, repo);
        }
        console.log(`[PluginRepository] Loaded ${this.repositories.size} repositories`);
      }
    } catch (error) {
      console.warn('[PluginRepository] Failed to load repositories:', error);
    }
  }

  /**
   * Save repositories to disk
   */
  private saveRepositories(): void {
    try {
      const repos = Array.from(this.repositories.values());
      fs.writeFileSync(this.configPath, JSON.stringify(repos, null, 2));
    } catch (error) {
      console.error('[PluginRepository] Failed to save repositories:', error);
    }
  }

  /**
   * Generate a unique ID for a repository URL
   */
  private generateRepoId(url: string): string {
    // Create a short hash-like ID from the URL
    const cleaned = url.replace(/https?:\/\//, '').replace(/[^a-zA-Z0-9]/g, '-');
    return cleaned.substring(0, 50);
  }

  /**
   * Add a new repository
   */
  async addRepository(url: string): Promise<RepositoryFetchResult> {
    // Validate URL
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      return { success: false, error: 'Invalid URL: must start with http:// or https://' };
    }

    // Ensure URL points to registry.json
    const registryUrl = url.endsWith('registry.json') ? url : `${url.replace(/\/$/, '')}/registry.json`;

    // Fetch and validate the registry
    try {
      const response = await fetch(registryUrl);
      if (!response.ok) {
        return { success: false, error: `Failed to fetch registry: HTTP ${response.status}` };
      }

      const registry: RegistryJson = await response.json();

      if (!registry.name || !Array.isArray(registry.plugins)) {
        return { success: false, error: 'Invalid registry format: missing name or plugins array' };
      }

      const repoId = this.generateRepoId(url);

      // Check if already exists
      if (this.repositories.has(repoId)) {
        return { success: false, error: 'Repository already added' };
      }

      const repo: PluginRepository = {
        id: repoId,
        name: registry.name,
        url: registryUrl,
        enabled: true,
        lastUpdated: Date.now(),
        pluginCount: registry.plugins.length,
      };

      this.repositories.set(repoId, repo);
      this.pluginCache.set(repoId, registry.plugins);
      this.saveRepositories();

      console.log(`[PluginRepository] Added repository: ${registry.name} (${registry.plugins.length} plugins)`);

      return {
        success: true,
        repository: repo,
        plugins: registry.plugins,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return { success: false, error: `Failed to add repository: ${errorMessage}` };
    }
  }

  /**
   * Remove a repository
   */
  removeRepository(repoId: string): boolean {
    if (!this.repositories.has(repoId)) {
      return false;
    }

    this.repositories.delete(repoId);
    this.pluginCache.delete(repoId);
    this.saveRepositories();

    console.log(`[PluginRepository] Removed repository: ${repoId}`);
    return true;
  }

  /**
   * Enable/disable a repository
   */
  setRepositoryEnabled(repoId: string, enabled: boolean): boolean {
    const repo = this.repositories.get(repoId);
    if (!repo) return false;

    repo.enabled = enabled;
    this.saveRepositories();
    return true;
  }

  /**
   * Get all repositories
   */
  getRepositories(): PluginRepository[] {
    return Array.from(this.repositories.values());
  }

  /**
   * Get a specific repository
   */
  getRepository(repoId: string): PluginRepository | null {
    return this.repositories.get(repoId) || null;
  }

  /**
   * Refresh a repository's plugin list
   */
  async refreshRepository(repoId: string): Promise<RepositoryFetchResult> {
    const repo = this.repositories.get(repoId);
    if (!repo) {
      return { success: false, error: 'Repository not found' };
    }

    try {
      const response = await fetch(repo.url);
      if (!response.ok) {
        return { success: false, error: `Failed to fetch registry: HTTP ${response.status}` };
      }

      const registry: RegistryJson = await response.json();

      // Update cache
      this.pluginCache.set(repoId, registry.plugins);

      // Update repository metadata
      repo.lastUpdated = Date.now();
      repo.pluginCount = registry.plugins.length;
      repo.name = registry.name;
      this.saveRepositories();

      console.log(`[PluginRepository] Refreshed ${repo.name}: ${registry.plugins.length} plugins`);

      return {
        success: true,
        repository: repo,
        plugins: registry.plugins,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return { success: false, error: `Failed to refresh repository: ${errorMessage}` };
    }
  }

  /**
   * Refresh all repositories
   */
  async refreshAllRepositories(): Promise<Map<string, RepositoryFetchResult>> {
    const results = new Map<string, RepositoryFetchResult>();

    for (const repoId of this.repositories.keys()) {
      const result = await this.refreshRepository(repoId);
      results.set(repoId, result);
    }

    return results;
  }

  /**
   * Get available plugins from all enabled repositories
   */
  async getAvailablePlugins(): Promise<RepositoryPlugin[]> {
    const allPlugins: RepositoryPlugin[] = [];
    const seenIds = new Set<string>();

    for (const [repoId, repo] of this.repositories) {
      if (!repo.enabled) continue;

      let plugins = this.pluginCache.get(repoId);

      // Refresh if cache is empty or stale (older than 1 hour)
      if (!plugins || (repo.lastUpdated && Date.now() - repo.lastUpdated > 3600000)) {
        const result = await this.refreshRepository(repoId);
        if (result.success && result.plugins) {
          plugins = result.plugins;
        }
      }

      if (plugins) {
        for (const plugin of plugins) {
          // Avoid duplicates (prefer first occurrence)
          if (!seenIds.has(plugin.id)) {
            seenIds.add(plugin.id);
            allPlugins.push(plugin);
          }
        }
      }
    }

    return allPlugins;
  }

  /**
   * Get plugins from a specific repository
   */
  getPluginsFromRepository(repoId: string): RepositoryPlugin[] {
    return this.pluginCache.get(repoId) || [];
  }

  /**
   * Search for plugins across all repositories
   */
  async searchPlugins(query: string): Promise<RepositoryPlugin[]> {
    const plugins = await this.getAvailablePlugins();
    const lowerQuery = query.toLowerCase();

    return plugins.filter(plugin =>
      plugin.name.toLowerCase().includes(lowerQuery) ||
      plugin.description.toLowerCase().includes(lowerQuery) ||
      plugin.id.toLowerCase().includes(lowerQuery) ||
      plugin.author.toLowerCase().includes(lowerQuery)
    );
  }

  /**
   * Check for updates for installed plugins
   */
  async checkUpdates(installedPlugins: { id: string; version: string }[]): Promise<UpdateInfo[]> {
    const availablePlugins = await this.getAvailablePlugins();
    const updates: UpdateInfo[] = [];

    for (const installed of installedPlugins) {
      const available = availablePlugins.find(p => p.id === installed.id);
      if (available && this.isNewerVersion(available.version, installed.version)) {
        // Find which repository has this plugin
        let repositoryId = '';
        for (const [repoId, plugins] of this.pluginCache) {
          if (plugins.some(p => p.id === installed.id)) {
            repositoryId = repoId;
            break;
          }
        }

        updates.push({
          pluginId: installed.id,
          currentVersion: installed.version,
          latestVersion: available.version,
          repositoryId,
        });
      }
    }

    return updates;
  }

  /**
   * Compare versions (simple semver comparison)
   */
  private isNewerVersion(latest: string, current: string): boolean {
    const parseVersion = (v: string) => v.split('.').map(n => parseInt(n, 10) || 0);

    const latestParts = parseVersion(latest);
    const currentParts = parseVersion(current);

    for (let i = 0; i < Math.max(latestParts.length, currentParts.length); i++) {
      const l = latestParts[i] || 0;
      const c = currentParts[i] || 0;
      if (l > c) return true;
      if (l < c) return false;
    }

    return false;
  }
}

// Export singleton instance
export const pluginRepositoryService = new PluginRepositoryService();
