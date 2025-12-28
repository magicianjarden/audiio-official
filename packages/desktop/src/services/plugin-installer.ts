/**
 * Plugin Installer Service
 * Handles installing plugins from npm, git, or local sources
 */

import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';
import { spawn, type ChildProcess } from 'child_process';

export interface InstallResult {
  success: boolean;
  pluginId?: string;
  version?: string;
  error?: string;
}

export interface InstallProgress {
  phase: 'downloading' | 'extracting' | 'installing' | 'building' | 'complete' | 'error';
  progress: number;
  message: string;
}

export type ProgressCallback = (progress: InstallProgress) => void;

class PluginInstallerService {
  private pluginsDir: string;
  private tempDir: string;

  constructor() {
    this.pluginsDir = path.join(app.getPath('userData'), 'plugins');
    this.tempDir = path.join(app.getPath('temp'), 'audiio-plugin-install');

    // Ensure directories exist
    if (!fs.existsSync(this.pluginsDir)) {
      fs.mkdirSync(this.pluginsDir, { recursive: true });
    }
  }

  /**
   * Install a plugin from any source
   * Source format:
   * - npm:@audiio/plugin-name
   * - git:https://github.com/user/repo.git
   * - https://github.com/user/repo (auto-detected as git)
   * - /path/to/local/plugin
   */
  async install(source: string, onProgress?: ProgressCallback): Promise<InstallResult> {
    try {
      if (source.startsWith('npm:')) {
        return await this.installFromNpm(source.slice(4), onProgress);
      } else if (source.startsWith('git:')) {
        return await this.installFromGit(source.slice(4), onProgress);
      } else if (source.includes('github.com') || source.includes('gitlab.com') || source.includes('.git')) {
        return await this.installFromGit(source, onProgress);
      } else {
        return await this.installFromLocal(source, onProgress);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Install from npm registry
   */
  async installFromNpm(packageName: string, onProgress?: ProgressCallback): Promise<InstallResult> {
    onProgress?.({
      phase: 'downloading',
      progress: 10,
      message: `Installing ${packageName} from npm...`,
    });

    try {
      // Use npm to install the package
      // Use --legacy-peer-deps since SDK/core are local workspace packages not on npm
      await this.runCommand('npm', ['install', packageName, '--save-optional', '--legacy-peer-deps'], {
        cwd: app.getAppPath(),
        onProgress: (output) => {
          onProgress?.({
            phase: 'installing',
            progress: 50,
            message: output,
          });
        },
      });

      onProgress?.({
        phase: 'complete',
        progress: 100,
        message: `Successfully installed ${packageName}`,
      });

      // Extract plugin ID from package name
      const pluginId = packageName.split('/').pop()?.replace('plugin-', '') || packageName;

      return {
        success: true,
        pluginId,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      onProgress?.({
        phase: 'error',
        progress: 0,
        message: errorMessage,
      });
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Install from git repository
   * Supports subdirectory syntax: https://github.com/user/repo.git#subdirectory/path
   */
  async installFromGit(gitUrl: string, onProgress?: ProgressCallback): Promise<InstallResult> {
    // Parse subdirectory from URL fragment if present
    let repoUrl = gitUrl;
    let subdirectory: string | null = null;

    const hashIndex = gitUrl.indexOf('#');
    if (hashIndex !== -1) {
      repoUrl = gitUrl.substring(0, hashIndex);
      subdirectory = gitUrl.substring(hashIndex + 1);
      console.log(`[PluginInstaller] Parsed git URL: repo=${repoUrl}, subdir=${subdirectory}`);
    }

    // Ensure temp directory is clean
    if (fs.existsSync(this.tempDir)) {
      await fs.promises.rm(this.tempDir, { recursive: true });
    }
    fs.mkdirSync(this.tempDir, { recursive: true });

    try {
      onProgress?.({
        phase: 'downloading',
        progress: 10,
        message: `Cloning repository...`,
      });

      // Clone the repository (use sparse checkout for subdirectory if specified)
      if (subdirectory) {
        // Use sparse checkout to only get the subdirectory
        await this.runCommand('git', ['clone', '--depth', '1', '--filter=blob:none', '--sparse', repoUrl, this.tempDir], {
          onProgress: (output) => {
            onProgress?.({
              phase: 'downloading',
              progress: 20,
              message: output,
            });
          },
        });

        // Configure sparse checkout for the subdirectory
        await this.runCommand('git', ['sparse-checkout', 'set', subdirectory], {
          cwd: this.tempDir,
          onProgress: (output) => {
            onProgress?.({
              phase: 'downloading',
              progress: 30,
              message: output,
            });
          },
        });
      } else {
        await this.runCommand('git', ['clone', '--depth', '1', repoUrl, this.tempDir], {
          onProgress: (output) => {
            onProgress?.({
              phase: 'downloading',
              progress: 30,
              message: output,
            });
          },
        });
      }

      // Determine the plugin source directory
      const pluginSourceDir = subdirectory
        ? path.join(this.tempDir, subdirectory)
        : this.tempDir;

      // Verify the subdirectory exists
      if (subdirectory && !fs.existsSync(pluginSourceDir)) {
        throw new Error(`Subdirectory not found in repository: ${subdirectory}`);
      }

      // Read and validate manifest
      const manifest = await this.readManifest(pluginSourceDir);
      if (!manifest) {
        throw new Error('Invalid plugin: missing or invalid manifest');
      }

      onProgress?.({
        phase: 'installing',
        progress: 50,
        message: 'Installing dependencies...',
      });

      // Install dependencies in the plugin source directory
      // Use --legacy-peer-deps to skip peer dependency resolution (SDK/core are provided by the app)
      // Use --omit=dev to skip dev dependencies
      await this.runCommand('npm', ['install', '--omit=dev', '--legacy-peer-deps'], {
        cwd: pluginSourceDir,
        onProgress: (output) => {
          onProgress?.({
            phase: 'installing',
            progress: 60,
            message: output,
          });
        },
      });

      // Check if plugin is already built (dist/ exists with index.js)
      const distDir = path.join(pluginSourceDir, 'dist');
      const distIndexPath = path.join(distDir, 'index.js');
      const isPrebuilt = fs.existsSync(distIndexPath);

      // Only build if not pre-built and has a build script
      const pkgJsonPath = path.join(pluginSourceDir, 'package.json');
      if (!isPrebuilt && fs.existsSync(pkgJsonPath)) {
        const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8'));
        if (pkgJson.scripts?.build) {
          onProgress?.({
            phase: 'building',
            progress: 70,
            message: 'Building plugin...',
          });

          await this.runCommand('npm', ['run', 'build'], {
            cwd: pluginSourceDir,
            onProgress: (output) => {
              onProgress?.({
                phase: 'building',
                progress: 80,
                message: output,
              });
            },
          });
        }
      } else if (isPrebuilt) {
        console.log(`[PluginInstaller] Plugin is pre-built, skipping build step`);
      }

      onProgress?.({
        phase: 'installing',
        progress: 90,
        message: 'Moving to plugins directory...',
      });

      // Move/copy to plugins directory
      const destDir = path.join(this.pluginsDir, manifest.id);
      if (fs.existsSync(destDir)) {
        await fs.promises.rm(destDir, { recursive: true });
      }

      // If using subdirectory, copy instead of rename (since we can't move across mounts)
      if (subdirectory) {
        await this.copyDirectory(pluginSourceDir, destDir);
        // Cleanup temp directory
        await fs.promises.rm(this.tempDir, { recursive: true }).catch(() => {});
      } else {
        await fs.promises.rename(this.tempDir, destDir);
      }

      // Create manifest file for the plugin loader
      const manifestPath = path.join(destDir, 'audiio-plugin.json');
      fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

      onProgress?.({
        phase: 'complete',
        progress: 100,
        message: `Successfully installed ${manifest.name}`,
      });

      return {
        success: true,
        pluginId: manifest.id,
        version: manifest.version,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      onProgress?.({
        phase: 'error',
        progress: 0,
        message: errorMessage,
      });

      // Cleanup temp directory
      if (fs.existsSync(this.tempDir)) {
        await fs.promises.rm(this.tempDir, { recursive: true }).catch(() => {});
      }

      return { success: false, error: errorMessage };
    }
  }

  /**
   * Install from local path
   */
  async installFromLocal(sourcePath: string, onProgress?: ProgressCallback): Promise<InstallResult> {
    try {
      onProgress?.({
        phase: 'extracting',
        progress: 20,
        message: 'Reading plugin...',
      });

      // Check if source exists
      if (!fs.existsSync(sourcePath)) {
        throw new Error('Plugin source not found');
      }

      // Read manifest
      const manifest = await this.readManifest(sourcePath);
      if (!manifest) {
        throw new Error('Invalid plugin: missing or invalid manifest');
      }

      onProgress?.({
        phase: 'installing',
        progress: 50,
        message: 'Copying to plugins directory...',
      });

      // Copy to plugins directory
      const destDir = path.join(this.pluginsDir, manifest.id);
      if (fs.existsSync(destDir)) {
        await fs.promises.rm(destDir, { recursive: true });
      }

      await this.copyDirectory(sourcePath, destDir);

      // Ensure manifest file exists
      const manifestPath = path.join(destDir, 'audiio-plugin.json');
      if (!fs.existsSync(manifestPath)) {
        fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
      }

      onProgress?.({
        phase: 'complete',
        progress: 100,
        message: `Successfully installed ${manifest.name}`,
      });

      return {
        success: true,
        pluginId: manifest.id,
        version: manifest.version,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      onProgress?.({
        phase: 'error',
        progress: 0,
        message: errorMessage,
      });
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Uninstall a plugin
   */
  async uninstall(pluginId: string): Promise<InstallResult> {
    try {
      const pluginPath = path.join(this.pluginsDir, pluginId);

      if (!fs.existsSync(pluginPath)) {
        return { success: false, error: 'Plugin not found' };
      }

      await fs.promises.rm(pluginPath, { recursive: true });

      return { success: true, pluginId };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Update a plugin to a newer version
   */
  async update(pluginId: string, source: string, onProgress?: ProgressCallback): Promise<InstallResult> {
    // Backup current version
    const currentPath = path.join(this.pluginsDir, pluginId);
    const backupPath = path.join(this.pluginsDir, `${pluginId}.backup`);

    try {
      if (fs.existsSync(currentPath)) {
        await fs.promises.rename(currentPath, backupPath);
      }

      // Install new version
      const result = await this.install(source, onProgress);

      // If successful, remove backup
      if (result.success && fs.existsSync(backupPath)) {
        await fs.promises.rm(backupPath, { recursive: true });
      }

      return result;
    } catch (error) {
      // Restore backup on failure
      if (fs.existsSync(backupPath) && !fs.existsSync(currentPath)) {
        await fs.promises.rename(backupPath, currentPath);
      }

      const errorMessage = error instanceof Error ? error.message : String(error);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Read plugin manifest from directory
   */
  private async readManifest(dir: string): Promise<{
    id: string;
    name: string;
    version: string;
    description?: string;
    roles?: string[];
  } | null> {
    // Try audiio-plugin.json first
    const manifestPath = path.join(dir, 'audiio-plugin.json');
    if (fs.existsSync(manifestPath)) {
      try {
        const content = fs.readFileSync(manifestPath, 'utf-8');
        const manifest = JSON.parse(content);
        if (manifest.id && manifest.name) {
          return manifest;
        }
      } catch {
        // Invalid manifest
      }
    }

    // Fall back to package.json with audiio field
    const pkgJsonPath = path.join(dir, 'package.json');
    if (fs.existsSync(pkgJsonPath)) {
      try {
        const content = fs.readFileSync(pkgJsonPath, 'utf-8');
        const pkgJson = JSON.parse(content);

        if (pkgJson.audiio) {
          return {
            id: pkgJson.audiio.id || pkgJson.name,
            name: pkgJson.audiio.name || pkgJson.name,
            version: pkgJson.version,
            description: pkgJson.description,
            roles: pkgJson.audiio.roles,
          };
        }
      } catch {
        // Invalid package.json
      }
    }

    return null;
  }

  /**
   * Run a shell command
   */
  private async runCommand(
    command: string,
    args: string[],
    options?: {
      cwd?: string;
      onProgress?: (output: string) => void;
    }
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const proc: ChildProcess = spawn(command, args, {
        cwd: options?.cwd || process.cwd(),
        shell: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let output = '';

      proc.stdout?.on('data', (data: Buffer) => {
        const text = data.toString();
        output += text;
        options?.onProgress?.(text.trim());
      });

      proc.stderr?.on('data', (data: Buffer) => {
        const text = data.toString();
        output += text;
        // Don't report stderr as progress (may contain warnings)
      });

      proc.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Command failed with code ${code}: ${output}`));
        }
      });

      proc.on('error', (error) => {
        reject(error);
      });
    });
  }

  /**
   * Copy a directory recursively
   */
  private async copyDirectory(src: string, dest: string): Promise<void> {
    await fs.promises.mkdir(dest, { recursive: true });
    const entries = await fs.promises.readdir(src, { withFileTypes: true });

    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);

      if (entry.isDirectory()) {
        // Skip node_modules and .git
        if (entry.name === 'node_modules' || entry.name === '.git') {
          continue;
        }
        await this.copyDirectory(srcPath, destPath);
      } else {
        await fs.promises.copyFile(srcPath, destPath);
      }
    }
  }

  /**
   * Get the plugins directory path
   */
  getPluginsDir(): string {
    return this.pluginsDir;
  }
}

// Export singleton instance
export const pluginInstaller = new PluginInstallerService();
