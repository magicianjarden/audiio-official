/**
 * Plugin Installer Service
 * Handles installing plugins from npm, git, or local sources
 * Works in both development (with git/npm) and production (HTTP fallback)
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { spawn, type ChildProcess, execSync } from 'child_process';
import * as https from 'https';
import * as http from 'http';
import { createWriteStream } from 'fs';
import { paths } from '../paths';

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
  private gitAvailable: boolean | null = null;

  constructor() {
    this.pluginsDir = paths.plugins;
    this.tempDir = path.join(os.tmpdir(), 'audiio-plugin-install');

    // Ensure directories exist
    if (!fs.existsSync(this.pluginsDir)) {
      fs.mkdirSync(this.pluginsDir, { recursive: true });
    }
  }

  /**
   * Get a clean environment for running commands on macOS/Linux
   */
  private getCleanEnv(): NodeJS.ProcessEnv {
    const isMac = process.platform === 'darwin';
    const isLinux = process.platform === 'linux';

    if (!isMac && !isLinux) {
      return process.env;
    }

    // Build a clean PATH that includes common npm/node locations
    const cleanPath = [
      '/usr/local/bin',
      '/usr/bin',
      '/bin',
      '/opt/homebrew/bin',
      '/usr/local/opt/node/bin',
      process.env.HOME + '/.nvm/versions/node/v20.18.2/bin',
      process.env.HOME + '/.nvm/versions/node/v22.12.0/bin',
      process.env.HOME + '/.npm-global/bin',
      process.env.PATH || ''
    ].join(':');

    return {
      ...process.env,
      PATH: cleanPath,
      // Prevent shell from sourcing profile files
      BASH_ENV: '',
      ENV: '',
    };
  }

  /**
   * Check if git is available on the system
   */
  private isGitAvailable(): boolean {
    if (this.gitAvailable !== null) {
      return this.gitAvailable;
    }

    try {
      execSync('git --version', { stdio: 'ignore', env: this.getCleanEnv() });
      this.gitAvailable = true;
      console.log('[PluginInstaller] Git is available');
    } catch {
      this.gitAvailable = false;
      console.log('[PluginInstaller] Git is not available, will use HTTP download');
    }

    return this.gitAvailable;
  }

  /**
   * Check if npm is available on the system
   */
  private isNpmAvailable(): boolean {
    try {
      execSync('npm --version', { stdio: 'ignore', env: this.getCleanEnv() });
      return true;
    } catch (error) {
      console.log('[PluginInstaller] npm not available:', error);
      return false;
    }
  }

  /**
   * Download a file via HTTP/HTTPS
   */
  private async downloadFile(url: string, destPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const protocol = url.startsWith('https') ? https : http;

      const makeRequest = (requestUrl: string, redirectCount = 0) => {
        if (redirectCount > 5) {
          reject(new Error('Too many redirects'));
          return;
        }

        protocol.get(requestUrl, (response) => {
          // Handle redirects
          if (response.statusCode === 301 || response.statusCode === 302 || response.statusCode === 307) {
            const redirectUrl = response.headers.location;
            if (redirectUrl) {
              makeRequest(redirectUrl, redirectCount + 1);
              return;
            }
          }

          if (response.statusCode !== 200) {
            reject(new Error(`Download failed with status ${response.statusCode}`));
            return;
          }

          const file = createWriteStream(destPath);
          response.pipe(file);
          file.on('finish', () => {
            file.close();
            resolve();
          });
          file.on('error', (err) => {
            fs.unlink(destPath, () => {}); // Delete incomplete file
            reject(err);
          });
        }).on('error', reject);
      };

      makeRequest(url);
    });
  }

  /**
   * Extract a zip file (using built-in decompress or AdmZip)
   */
  private async extractZip(zipPath: string, destDir: string): Promise<void> {
    // Use Node.js built-in zlib for basic extraction
    // For production, we'll use a simple approach with the yauzl or extract-zip package
    // But since we may not have those, let's try using PowerShell on Windows

    try {
      if (process.platform === 'win32') {
        // Use PowerShell to extract on Windows
        await this.runCommand('powershell', [
          '-Command',
          `Expand-Archive -Path "${zipPath}" -DestinationPath "${destDir}" -Force`
        ], {});
      } else {
        // Use unzip on macOS/Linux
        await this.runCommand('unzip', ['-o', zipPath, '-d', destDir], {});
      }
    } catch (error) {
      throw new Error(`Failed to extract zip: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Parse GitHub URL to get owner, repo, and optional subdirectory
   */
  private parseGitHubUrl(url: string): { owner: string; repo: string; subdirectory: string | null; branch: string } | null {
    // Remove .git suffix if present
    let cleanUrl = url.replace(/\.git$/, '');

    // Parse subdirectory from hash
    let subdirectory: string | null = null;
    const hashIndex = cleanUrl.indexOf('#');
    if (hashIndex !== -1) {
      subdirectory = cleanUrl.substring(hashIndex + 1);
      cleanUrl = cleanUrl.substring(0, hashIndex);
    }

    // Match GitHub URL patterns
    const patterns = [
      /github\.com\/([^\/]+)\/([^\/]+)$/,
      /github\.com\/([^\/]+)\/([^\/]+)\/tree\/([^\/]+)$/,
      /github\.com\/([^\/]+)\/([^\/]+)\/tree\/([^\/]+)\/(.+)$/,
    ];

    for (const pattern of patterns) {
      const match = cleanUrl.match(pattern);
      if (match && match[1] && match[2]) {
        return {
          owner: match[1],
          repo: match[2],
          subdirectory: match[4] ?? subdirectory,
          branch: match[3] ?? 'main',
        };
      }
    }

    return null;
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
   * Note: npm packages in production should be pre-installed or use git URL
   */
  async installFromNpm(packageName: string, onProgress?: ProgressCallback): Promise<InstallResult> {
    // Check if npm is available
    if (!this.isNpmAvailable()) {
      onProgress?.({
        phase: 'error',
        progress: 0,
        message: 'npm is not available. Please use a GitHub URL instead.',
      });
      return {
        success: false,
        error: 'npm is not available on this system. Please install the plugin from a GitHub URL instead.'
      };
    }

    onProgress?.({
      phase: 'downloading',
      progress: 10,
      message: `Installing ${packageName} from npm...`,
    });

    try {
      // Install to the plugins directory instead of app path (which is asar in production)
      const installDir = path.join(this.pluginsDir, '_npm_installs');
      if (!fs.existsSync(installDir)) {
        fs.mkdirSync(installDir, { recursive: true });
        // Create a minimal package.json
        fs.writeFileSync(path.join(installDir, 'package.json'), JSON.stringify({
          name: 'audiio-npm-plugins',
          private: true
        }));
      }

      // Use npm to install the package
      await this.runCommand('npm', ['install', packageName, '--legacy-peer-deps'], {
        cwd: installDir,
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
   * Falls back to HTTP download if git is not available
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
        message: `Downloading plugin...`,
      });

      // Try git clone first if available, otherwise use HTTP download
      if (this.isGitAvailable()) {
        console.log('[PluginInstaller] Using git clone');
        await this.runCommand('git', ['clone', '--depth', '1', repoUrl, this.tempDir], {
          onProgress: (output) => {
            onProgress?.({
              phase: 'downloading',
              progress: 30,
              message: output,
            });
          },
        });
      } else {
        // Fall back to HTTP download for GitHub repos
        const ghInfo = this.parseGitHubUrl(repoUrl);
        if (!ghInfo) {
          throw new Error('Git is not available and URL is not a supported GitHub URL. Please install git or use a GitHub repository URL.');
        }

        console.log(`[PluginInstaller] Using HTTP download for ${ghInfo.owner}/${ghInfo.repo}`);

        // Download the zip archive
        const zipUrl = `https://github.com/${ghInfo.owner}/${ghInfo.repo}/archive/refs/heads/${ghInfo.branch}.zip`;
        const zipPath = path.join(this.tempDir, 'repo.zip');

        onProgress?.({
          phase: 'downloading',
          progress: 20,
          message: `Downloading from GitHub...`,
        });

        await this.downloadFile(zipUrl, zipPath);

        onProgress?.({
          phase: 'extracting',
          progress: 40,
          message: `Extracting archive...`,
        });

        // Extract the zip
        const extractDir = path.join(this.tempDir, 'extracted');
        fs.mkdirSync(extractDir, { recursive: true });
        await this.extractZip(zipPath, extractDir);

        // GitHub zips extract to a folder named repo-branch
        const extractedFolder = `${ghInfo.repo}-${ghInfo.branch}`;
        const extractedPath = path.join(extractDir, extractedFolder);

        if (!fs.existsSync(extractedPath)) {
          // Try to find the extracted folder
          const entries = fs.readdirSync(extractDir);
          const firstEntry = entries[0];
          if (entries.length === 1 && firstEntry) {
            const actualPath = path.join(extractDir, firstEntry);
            if (fs.statSync(actualPath).isDirectory()) {
              // Move contents to temp dir
              await this.copyDirectory(actualPath, this.tempDir);
            }
          } else {
            throw new Error('Could not find extracted plugin folder');
          }
        } else {
          // Move contents to temp dir
          await this.copyDirectory(extractedPath, this.tempDir);
        }

        // Clean up
        fs.rmSync(zipPath, { force: true });
        fs.rmSync(extractDir, { recursive: true, force: true });

        // Update subdirectory if specified in GitHub info
        if (ghInfo.subdirectory && !subdirectory) {
          subdirectory = ghInfo.subdirectory;
        }
      }

      // Determine the plugin source directory
      let pluginSourceDir = subdirectory
        ? path.join(this.tempDir, subdirectory)
        : this.tempDir;

      // Verify the subdirectory exists
      if (subdirectory && !fs.existsSync(pluginSourceDir)) {
        throw new Error(`Subdirectory not found in repository: ${subdirectory}`);
      }

      // If subdirectory specified, copy it to a clean location to avoid workspace issues
      // (npm install in a workspace subfolder tries to install all workspace deps)
      if (subdirectory) {
        const isolatedDir = path.join(path.dirname(this.tempDir), 'audiio-plugin-isolated');
        if (fs.existsSync(isolatedDir)) {
          await fs.promises.rm(isolatedDir, { recursive: true });
        }
        await this.copyDirectory(pluginSourceDir, isolatedDir);
        pluginSourceDir = isolatedDir;
        console.log(`[PluginInstaller] Isolated plugin to: ${isolatedDir}`);
      }

      // Read and validate manifest
      const manifest = await this.readManifest(pluginSourceDir);
      if (!manifest) {
        throw new Error('Invalid plugin: missing or invalid manifest');
      }

      // Check if plugin is already built (dist/ exists with index.js)
      const distDir = path.join(pluginSourceDir, 'dist');
      const distIndexPath = path.join(distDir, 'index.js');
      const isPrebuilt = fs.existsSync(distIndexPath);

      // Only install deps and build if not pre-built
      const pkgJsonPath = path.join(pluginSourceDir, 'package.json');
      if (!isPrebuilt && fs.existsSync(pkgJsonPath)) {
        const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8'));

        // Check if npm is available
        if (!this.isNpmAvailable()) {
          // Check if there's a build script that would require npm
          if (pkgJson.scripts?.build) {
            throw new Error('This plugin requires building but npm is not available. Please install a pre-built version or install Node.js.');
          }
          console.log('[PluginInstaller] npm not available, skipping dependency installation');
        } else {
          // Install dependencies for building
          onProgress?.({
            phase: 'installing',
            progress: 50,
            message: 'Installing dependencies...',
          });
          await this.runCommand('npm', ['install', '--legacy-peer-deps'], {
            cwd: pluginSourceDir,
            onProgress: (output) => {
              onProgress?.({
                phase: 'installing',
                progress: 60,
                message: output,
              });
            },
          });

          // Build if has build script
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
        // Cleanup temp directories (both clone and isolated)
        await fs.promises.rm(this.tempDir, { recursive: true }).catch(() => {});
        await fs.promises.rm(pluginSourceDir, { recursive: true }).catch(() => {});
      } else {
        await fs.promises.rename(this.tempDir, destDir);
      }

      // Install dependencies in final location (copyDirectory skips node_modules)
      // Only if package.json has dependencies and npm is available
      const finalPkgJsonPath = path.join(destDir, 'package.json');
      if (fs.existsSync(finalPkgJsonPath) && this.isNpmAvailable()) {
        const finalPkgJson = JSON.parse(fs.readFileSync(finalPkgJsonPath, 'utf-8'));
        // Only install if there are non-audiio dependencies (audiio deps are provided by the app)
        const deps = finalPkgJson.dependencies || {};
        const nonAudioDeps = Object.keys(deps).filter(d => !d.startsWith('@audiio/'));
        if (nonAudioDeps.length > 0) {
          onProgress?.({
            phase: 'installing',
            progress: 95,
            message: 'Installing plugin dependencies...',
          });
          await this.runCommand('npm', ['install', '--omit=dev', '--legacy-peer-deps'], {
            cwd: destDir,
            onProgress: (output) => {
              onProgress?.({
                phase: 'installing',
                progress: 95,
                message: output,
              });
            },
          });
        }
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

      // Cleanup temp directories
      if (fs.existsSync(this.tempDir)) {
        await fs.promises.rm(this.tempDir, { recursive: true }).catch(() => {});
      }
      const isolatedDir = path.join(path.dirname(this.tempDir), 'audiio-plugin-isolated');
      if (fs.existsSync(isolatedDir)) {
        await fs.promises.rm(isolatedDir, { recursive: true }).catch(() => {});
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
    main?: string;
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
            main: pkgJson.main || './dist/index.js',
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
      const isMac = process.platform === 'darwin';
      const isLinux = process.platform === 'linux';

      const proc: ChildProcess = spawn(command, args, {
        cwd: options?.cwd || process.cwd(),
        shell: isMac || isLinux ? '/bin/bash' : true,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: this.getCleanEnv(),
      });

      let output = '';
      let errorOutput = '';

      proc.stdout?.on('data', (data: Buffer) => {
        const text = data.toString();
        output += text;
        options?.onProgress?.(text.trim());
      });

      proc.stderr?.on('data', (data: Buffer) => {
        const text = data.toString();
        errorOutput += text;
        // Log stderr for debugging but don't treat all stderr as errors
        // (npm often outputs warnings to stderr)
        console.log(`[PluginInstaller] stderr: ${text.trim()}`);
      });

      proc.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          const fullOutput = output + '\n' + errorOutput;
          console.error(`[PluginInstaller] Command failed: ${command} ${args.join(' ')}`);
          console.error(`[PluginInstaller] Exit code: ${code}`);
          console.error(`[PluginInstaller] Output: ${fullOutput}`);
          reject(new Error(`Command failed with code ${code}: ${fullOutput}`));
        }
      });

      proc.on('error', (error) => {
        console.error(`[PluginInstaller] Process error:`, error);
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
