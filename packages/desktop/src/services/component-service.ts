/**
 * Component Service - Manages optional installable components (Demucs, etc.)
 *
 * Handles installation, updates, and lifecycle of bundled components
 * that include their own runtimes (e.g., Python for Demucs).
 */

import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { spawn, ChildProcess } from 'child_process';
import * as https from 'https';
import * as http from 'http';
import { createWriteStream, existsSync, mkdirSync, rmSync } from 'fs';

// ============================================
// Types
// ============================================

export interface DemucsStatus {
  installed: boolean;
  enabled: boolean;
  version: string | null;
  updateAvailable: string | null;
  serverRunning: boolean;
}

export interface InstallProgress {
  phase: 'downloading' | 'extracting' | 'verifying' | 'complete' | 'error';
  progress: number; // 0-100
  message: string;
  bytesDownloaded?: number;
  totalBytes?: number;
}

export type ProgressCallback = (progress: InstallProgress) => void;

// ============================================
// Component URLs (platform-specific bundles)
// ============================================

const DEMUCS_VERSION = '1.0.0';

// Miniconda download URLs by platform
const getMinicondaUrl = (): string => {
  const platform = process.platform;
  const arch = process.arch;

  if (platform === 'win32') {
    return 'https://repo.anaconda.com/miniconda/Miniconda3-latest-Windows-x86_64.exe';
  } else if (platform === 'darwin') {
    // macOS - check for ARM or Intel
    if (arch === 'arm64') {
      return 'https://repo.anaconda.com/miniconda/Miniconda3-latest-MacOSX-arm64.sh';
    } else {
      return 'https://repo.anaconda.com/miniconda/Miniconda3-latest-MacOSX-x86_64.sh';
    }
  } else {
    // Linux
    if (arch === 'arm64') {
      return 'https://repo.anaconda.com/miniconda/Miniconda3-latest-Linux-aarch64.sh';
    } else {
      return 'https://repo.anaconda.com/miniconda/Miniconda3-latest-Linux-x86_64.sh';
    }
  }
};

// Get path to local demucs-server in the repo
const getLocalDemucsPath = (): string => {
  // In development, __dirname is packages/desktop/dist
  // demucs-server is at packages/demucs-server
  return path.join(__dirname, '../../../demucs-server');
};

// ============================================
// Component Service
// ============================================

class ComponentService {
  private componentsDir: string;
  private demucsDir: string;
  private demucsProcess: ChildProcess | null = null;
  private enabled: boolean = true;
  private abortController: AbortController | null = null;

  constructor() {
    // Components are stored in userData/components/
    this.componentsDir = path.join(app.getPath('userData'), 'components');
    this.demucsDir = path.join(this.componentsDir, 'demucs');
  }

  /**
   * Initialize the service - check installed components
   */
  initialize(): void {
    // Ensure components directory exists
    if (!existsSync(this.componentsDir)) {
      mkdirSync(this.componentsDir, { recursive: true });
    }
    console.log('[ComponentService] Initialized, components dir:', this.componentsDir);
  }

  /**
   * Get current Demucs installation status
   */
  async getStatus(): Promise<DemucsStatus> {
    const installed = this.isDemucsInstalled();
    const version = installed ? this.getInstalledVersion() : null;
    const serverRunning = this.demucsProcess !== null;

    return {
      installed,
      enabled: this.enabled,
      version,
      updateAvailable: null, // TODO: Check for updates
      serverRunning,
    };
  }

  /**
   * Check if Demucs is installed
   */
  isDemucsInstalled(): boolean {
    const manifestPath = path.join(this.demucsDir, 'manifest.json');
    return existsSync(manifestPath);
  }

  /**
   * Get installed version from manifest
   */
  getInstalledVersion(): string | null {
    try {
      const manifestPath = path.join(this.demucsDir, 'manifest.json');
      if (existsSync(manifestPath)) {
        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
        return manifest.version || null;
      }
    } catch {
      // Ignore errors
    }
    return null;
  }

  /**
   * Install Demucs component with miniconda
   */
  async install(onProgress?: ProgressCallback): Promise<void> {
    const localPath = getLocalDemucsPath();
    const minicondaUrl = getMinicondaUrl();
    const isWindows = process.platform === 'win32';
    const installerExt = isWindows ? '.exe' : '.sh';
    const installerPath = path.join(this.componentsDir, `miniconda-installer${installerExt}`);
    const condaDir = path.join(this.demucsDir, 'miniconda');

    try {
      // Create components directory if needed
      if (!existsSync(this.componentsDir)) {
        mkdirSync(this.componentsDir, { recursive: true });
      }

      // Clean up any existing partial install
      if (existsSync(this.demucsDir)) {
        rmSync(this.demucsDir, { recursive: true, force: true });
      }
      mkdirSync(this.demucsDir, { recursive: true });

      // Setup abort controller for cancellation
      this.abortController = new AbortController();

      // Phase 1: Download Miniconda (~70MB)
      onProgress?.({
        phase: 'downloading',
        progress: 0,
        message: 'Downloading Python environment...',
      });

      await this.downloadFile(minicondaUrl, installerPath, (downloaded, total) => {
        const percent = total > 0 ? Math.round((downloaded / total) * 20) : 0;
        onProgress?.({
          phase: 'downloading',
          progress: percent,
          message: `Downloading Python... ${this.formatBytes(downloaded)} / ${this.formatBytes(total)}`,
          bytesDownloaded: downloaded,
          totalBytes: total,
        });
      });

      // Phase 2: Install Miniconda
      onProgress?.({
        phase: 'extracting',
        progress: 25,
        message: 'Installing Python environment...',
      });

      await this.installMiniconda(installerPath, condaDir);

      // Clean up installer
      if (existsSync(installerPath)) {
        rmSync(installerPath);
      }

      // Phase 3: Copy server files
      onProgress?.({
        phase: 'extracting',
        progress: 40,
        message: 'Copying server files...',
      });

      if (!existsSync(localPath)) {
        throw new Error(`Local demucs-server not found at: ${localPath}`);
      }

      // Copy server.py and requirements.txt
      fs.copyFileSync(path.join(localPath, 'server.py'), path.join(this.demucsDir, 'server.py'));
      fs.copyFileSync(path.join(localPath, 'requirements.txt'), path.join(this.demucsDir, 'requirements.txt'));

      // Phase 4: Install FFmpeg (download static binary)
      onProgress?.({
        phase: 'extracting',
        progress: 45,
        message: 'Installing FFmpeg...',
      });

      await this.installFFmpeg(this.demucsDir);

      // Phase 5: Install Python dependencies
      onProgress?.({
        phase: 'extracting',
        progress: 55,
        message: 'Installing AI dependencies (this may take a few minutes)...',
      });

      await this.installPipDependencies(condaDir, this.demucsDir);

      // Phase 6: Verify
      onProgress?.({
        phase: 'verifying',
        progress: 95,
        message: 'Verifying installation...',
      });

      // Verify critical files exist
      const serverPath = path.join(this.demucsDir, 'server.py');
      if (!existsSync(serverPath)) {
        throw new Error('Installation verification failed: server.py not found');
      }

      // Create manifest
      const manifestPath = path.join(this.demucsDir, 'manifest.json');
      fs.writeFileSync(
        manifestPath,
        JSON.stringify({
          version: DEMUCS_VERSION,
          installedAt: Date.now(),
          source: 'miniconda',
          platform: process.platform,
          arch: process.arch
        }, null, 2)
      );

      // Complete
      onProgress?.({
        phase: 'complete',
        progress: 100,
        message: 'Installation complete!',
      });

      console.log('[ComponentService] Demucs installed successfully');
    } catch (error) {
      // Clean up on error
      if (existsSync(installerPath)) {
        try { rmSync(installerPath); } catch { /* ignore */ }
      }
      if (existsSync(this.demucsDir)) {
        try { rmSync(this.demucsDir, { recursive: true, force: true }); } catch { /* ignore */ }
      }

      const message = error instanceof Error ? error.message : 'Unknown error';
      onProgress?.({
        phase: 'error',
        progress: 0,
        message: `Installation failed: ${message}`,
      });

      throw error;
    } finally {
      this.abortController = null;
    }
  }

  /**
   * Install Miniconda silently
   */
  private async installMiniconda(installerPath: string, destDir: string): Promise<void> {
    return new Promise((resolve, reject) => {
      let cmd: string;
      let args: string[];

      if (process.platform === 'win32') {
        // Windows: run .exe installer with silent flags
        cmd = installerPath;
        args = ['/S', '/D=' + destDir];
      } else {
        // Unix: run .sh installer with silent flags
        cmd = 'bash';
        args = [installerPath, '-b', '-p', destDir];
      }

      console.log('[ComponentService] Installing miniconda:', cmd, args.join(' '));

      const proc = spawn(cmd, args, {
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: process.platform === 'win32',
      });

      let stderr = '';
      proc.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Miniconda installation failed (code ${code}): ${stderr}`));
        }
      });

      proc.on('error', (err) => {
        reject(new Error(`Failed to run installer: ${err.message}`));
      });
    });
  }

  /**
   * Get FFmpeg download URL for current platform
   */
  private getFFmpegUrl(): { url: string; isZip: boolean } {
    const platform = process.platform;
    const arch = process.arch;

    if (platform === 'win32') {
      // Windows - use gyan.dev builds (reliable, well-maintained)
      return {
        url: 'https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip',
        isZip: true
      };
    } else if (platform === 'darwin') {
      // macOS - use evermeet builds
      if (arch === 'arm64') {
        return {
          url: 'https://evermeet.cx/ffmpeg/getrelease/zip',
          isZip: true
        };
      } else {
        return {
          url: 'https://evermeet.cx/ffmpeg/getrelease/zip',
          isZip: true
        };
      }
    } else {
      // Linux - use static build from johnvansickle
      return {
        url: 'https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz',
        isZip: false
      };
    }
  }

  /**
   * Install FFmpeg by downloading static binary
   */
  private async installFFmpeg(destDir: string): Promise<void> {
    const { url, isZip } = this.getFFmpegUrl();
    const ffmpegDir = path.join(destDir, 'ffmpeg');
    const archiveExt = isZip ? '.zip' : '.tar.xz';
    const archivePath = path.join(this.componentsDir, `ffmpeg${archiveExt}`);

    console.log('[ComponentService] Downloading FFmpeg from:', url);

    try {
      // Create ffmpeg directory
      if (!existsSync(ffmpegDir)) {
        mkdirSync(ffmpegDir, { recursive: true });
      }

      // Download archive
      await this.downloadFile(url, archivePath);

      console.log('[ComponentService] Extracting FFmpeg...');

      // Extract based on platform
      if (process.platform === 'win32') {
        // Use PowerShell to extract zip
        await this.runCommand(
          'powershell',
          ['-Command', `Expand-Archive -Path '${archivePath}' -DestinationPath '${ffmpegDir}' -Force`]
        );

        // Find and move ffmpeg.exe to the right place
        // The zip contains a folder like ffmpeg-master-latest-win64-gpl/bin/ffmpeg.exe
        const extractedDirs = fs.readdirSync(ffmpegDir);
        for (const dir of extractedDirs) {
          const binPath = path.join(ffmpegDir, dir, 'bin');
          if (existsSync(binPath)) {
            // Copy executables to ffmpeg root
            const files = fs.readdirSync(binPath);
            for (const file of files) {
              if (file.endsWith('.exe')) {
                fs.copyFileSync(path.join(binPath, file), path.join(ffmpegDir, file));
              }
            }
          }
        }
      } else if (process.platform === 'darwin') {
        // Use unzip for macOS
        await this.runCommand('unzip', ['-o', archivePath, '-d', ffmpegDir]);
      } else {
        // Use tar for Linux
        await this.runCommand('tar', ['-xf', archivePath, '-C', ffmpegDir, '--strip-components=1']);
      }

      // Cleanup archive
      if (existsSync(archivePath)) {
        rmSync(archivePath);
      }

      // Verify ffmpeg exists
      const ffmpegExe = process.platform === 'win32'
        ? path.join(ffmpegDir, 'ffmpeg.exe')
        : path.join(ffmpegDir, 'ffmpeg');

      if (!existsSync(ffmpegExe)) {
        throw new Error('FFmpeg executable not found after extraction');
      }

      console.log('[ComponentService] FFmpeg installed successfully at:', ffmpegExe);
    } catch (error) {
      // Cleanup on error
      if (existsSync(archivePath)) {
        try { rmSync(archivePath); } catch { /* ignore */ }
      }
      throw error;
    }
  }

  /**
   * Run a command and wait for completion
   */
  private runCommand(cmd: string, args: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      const proc = spawn(cmd, args, {
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: process.platform === 'win32',
      });

      let stderr = '';
      proc.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Command failed (code ${code}): ${stderr}`));
        }
      });

      proc.on('error', reject);
    });
  }

  /**
   * Check if NVIDIA GPU is available
   */
  private async detectNvidiaGpu(): Promise<boolean> {
    return new Promise((resolve) => {
      // Try to run nvidia-smi to detect NVIDIA GPU
      const proc = spawn('nvidia-smi', ['--query-gpu=name', '--format=csv,noheader'], {
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: true,
      });

      let hasGpu = false;

      proc.stdout?.on('data', (data) => {
        const output = data.toString().trim();
        if (output && !output.includes('NVIDIA-SMI has failed')) {
          console.log('[ComponentService] NVIDIA GPU detected:', output);
          hasGpu = true;
        }
      });

      proc.on('close', () => {
        resolve(hasGpu);
      });

      proc.on('error', () => {
        resolve(false);
      });

      // Timeout after 5 seconds
      setTimeout(() => resolve(false), 5000);
    });
  }

  /**
   * Install CUDA-enabled PyTorch
   */
  private async installCudaPyTorch(condaDir: string): Promise<void> {
    return new Promise((resolve) => {
      const pipPath = process.platform === 'win32'
        ? path.join(condaDir, 'Scripts', 'pip.exe')
        : path.join(condaDir, 'bin', 'pip');

      console.log('[ComponentService] Installing CUDA-enabled PyTorch...');

      // First uninstall existing torch
      const uninstallProc = spawn(pipPath, ['uninstall', 'torch', 'torchaudio', '-y'], {
        stdio: ['ignore', 'pipe', 'pipe'],
        env: {
          ...process.env,
          PYTHONHOME: condaDir,
          PATH: process.platform === 'win32'
            ? `${path.join(condaDir, 'Scripts')};${path.join(condaDir)};${process.env.PATH}`
            : `${path.join(condaDir, 'bin')}:${process.env.PATH}`,
        },
      });

      uninstallProc.on('close', () => {
        // Install CUDA PyTorch (CUDA 12.4 for RTX 40/50 series)
        const installProc = spawn(pipPath, [
          'install', 'torch', 'torchaudio',
          '--index-url', 'https://download.pytorch.org/whl/cu124'
        ], {
          stdio: ['ignore', 'pipe', 'pipe'],
          env: {
            ...process.env,
            PYTHONHOME: condaDir,
            PATH: process.platform === 'win32'
              ? `${path.join(condaDir, 'Scripts')};${path.join(condaDir)};${process.env.PATH}`
              : `${path.join(condaDir, 'bin')}:${process.env.PATH}`,
          },
        });

        installProc.stdout?.on('data', (data) => {
          console.log('[pip-cuda]', data.toString().trim());
        });

        installProc.stderr?.on('data', (data) => {
          console.error('[pip-cuda]', data.toString().trim());
        });

        installProc.on('close', (code) => {
          if (code === 0) {
            console.log('[ComponentService] CUDA PyTorch installed successfully');
            resolve();
          } else {
            console.error('[ComponentService] CUDA PyTorch installation failed, will use CPU version');
            resolve(); // Don't reject - CPU fallback is fine
          }
        });

        installProc.on('error', () => {
          console.error('[ComponentService] Failed to install CUDA PyTorch');
          resolve(); // Don't reject - CPU fallback is fine
        });
      });
    });
  }

  /**
   * Install pip dependencies in the conda environment
   */
  private async installPipDependencies(condaDir: string, workDir: string): Promise<void> {
    // First, detect if NVIDIA GPU is available
    const hasNvidiaGpu = await this.detectNvidiaGpu();
    console.log('[ComponentService] NVIDIA GPU available:', hasNvidiaGpu);

    // Install base requirements
    await new Promise<void>((resolve, reject) => {
      // Get the pip executable path
      const pipPath = process.platform === 'win32'
        ? path.join(condaDir, 'Scripts', 'pip.exe')
        : path.join(condaDir, 'bin', 'pip');

      const requirementsPath = path.join(workDir, 'requirements.txt');

      console.log('[ComponentService] Installing pip dependencies...');
      console.log('[ComponentService] Pip path:', pipPath);
      console.log('[ComponentService] Requirements:', requirementsPath);

      const proc = spawn(pipPath, ['install', '-r', requirementsPath], {
        cwd: workDir,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: {
          ...process.env,
          // Ensure conda env is isolated
          PYTHONHOME: condaDir,
          PATH: process.platform === 'win32'
            ? `${path.join(condaDir, 'Scripts')};${path.join(condaDir)};${process.env.PATH}`
            : `${path.join(condaDir, 'bin')}:${process.env.PATH}`,
        },
      });

      let stderr = '';

      proc.stdout?.on('data', (data) => {
        console.log('[pip]', data.toString().trim());
      });

      proc.stderr?.on('data', (data) => {
        stderr += data.toString();
        console.error('[pip]', data.toString().trim());
      });

      proc.on('close', (code) => {
        if (code === 0) {
          console.log('[ComponentService] Pip dependencies installed successfully');
          resolve();
        } else {
          reject(new Error(`Pip install failed (code ${code}): ${stderr}`));
        }
      });

      proc.on('error', (err) => {
        reject(new Error(`Failed to run pip: ${err.message}`));
      });
    });

    // If NVIDIA GPU detected, upgrade to CUDA PyTorch for 10-20x faster processing
    if (hasNvidiaGpu) {
      console.log('[ComponentService] Upgrading to CUDA PyTorch for GPU acceleration...');
      await this.installCudaPyTorch(condaDir);
    }
  }

  /**
   * Cancel ongoing installation
   */
  cancelInstall(): void {
    if (this.abortController) {
      this.abortController.abort();
      console.log('[ComponentService] Installation cancelled');
    }
  }

  /**
   * Uninstall Demucs component
   */
  async uninstall(): Promise<void> {
    // Stop server if running
    await this.stopServer();

    // Remove directory
    if (existsSync(this.demucsDir)) {
      rmSync(this.demucsDir, { recursive: true, force: true });
    }

    console.log('[ComponentService] Demucs uninstalled');
  }

  /**
   * Set enabled state
   */
  async setEnabled(enabled: boolean): Promise<void> {
    this.enabled = enabled;

    if (enabled && this.isDemucsInstalled()) {
      await this.startServer();
    } else if (!enabled) {
      await this.stopServer();
    }
  }

  /**
   * Check if GPU can be enabled (NVIDIA GPU available but CUDA PyTorch not installed)
   */
  async canEnableGpu(): Promise<{ hasGpu: boolean; cudaInstalled: boolean }> {
    const hasGpu = await this.detectNvidiaGpu();
    // For now, assume CUDA is not installed if we're on CPU mode
    // The server /health endpoint will tell us if CUDA is actually available
    return { hasGpu, cudaInstalled: false };
  }

  /**
   * Upgrade existing installation to use CUDA (GPU acceleration)
   */
  async upgradeToGpu(onProgress?: ProgressCallback): Promise<boolean> {
    if (!this.isDemucsInstalled()) {
      console.error('[ComponentService] Cannot upgrade - Demucs not installed');
      return false;
    }

    const hasGpu = await this.detectNvidiaGpu();
    if (!hasGpu) {
      console.error('[ComponentService] Cannot upgrade - No NVIDIA GPU detected');
      return false;
    }

    onProgress?.({
      phase: 'extracting',
      progress: 10,
      message: 'Stopping server...',
    });

    // Stop server during upgrade
    await this.stopServer();

    onProgress?.({
      phase: 'extracting',
      progress: 30,
      message: 'Installing CUDA PyTorch (this may take a few minutes)...',
    });

    try {
      const condaDir = path.join(this.demucsDir, 'conda');
      await this.installCudaPyTorch(condaDir);

      onProgress?.({
        phase: 'complete',
        progress: 100,
        message: 'GPU acceleration enabled! Restart the server to apply.',
      });

      // Restart server with new PyTorch
      await this.startServer();

      return true;
    } catch (error) {
      onProgress?.({
        phase: 'error',
        progress: 0,
        message: `GPU upgrade failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
      return false;
    }
  }

  /**
   * Sync server.py from source if it's newer (for development updates)
   */
  private syncServerFile(): void {
    try {
      const localPath = getLocalDemucsPath();
      const srcServerPath = path.join(localPath, 'server.py');
      const destServerPath = path.join(this.demucsDir, 'server.py');

      if (!existsSync(srcServerPath)) {
        console.log('[ComponentService] Source server.py not found, skipping sync');
        return;
      }

      if (!existsSync(destServerPath)) {
        console.log('[ComponentService] Installed server.py not found, skipping sync');
        return;
      }

      const srcStat = fs.statSync(srcServerPath);
      const destStat = fs.statSync(destServerPath);

      // If source is newer, copy it
      if (srcStat.mtimeMs > destStat.mtimeMs) {
        console.log('[ComponentService] Updating server.py with newer version from source...');
        fs.copyFileSync(srcServerPath, destServerPath);
        console.log('[ComponentService] ✓ server.py updated');
      }
    } catch (error) {
      console.error('[ComponentService] Error syncing server.py:', error);
    }
  }

  /**
   * Start the Demucs server
   */
  async startServer(): Promise<boolean> {
    if (this.demucsProcess) {
      console.log('[ComponentService] Server already running');
      return true;
    }

    if (!this.isDemucsInstalled()) {
      console.log('[ComponentService] Cannot start server - not installed');
      return false;
    }

    if (!this.enabled) {
      console.log('[ComponentService] Cannot start server - disabled');
      return false;
    }

    // Sync server.py with latest source (for development)
    this.syncServerFile();

    try {
      const serverPath = this.demucsDir;
      const condaDir = path.join(this.demucsDir, 'miniconda');
      const ffmpegDir = path.join(this.demucsDir, 'ffmpeg');

      // Determine Python executable path from miniconda installation
      let pythonCmd: string;
      let envPath: string;

      if (process.platform === 'win32') {
        pythonCmd = path.join(condaDir, 'python.exe');
        // Include ffmpeg directory in PATH
        envPath = `${ffmpegDir};${path.join(condaDir, 'Scripts')};${condaDir};${process.env.PATH}`;
      } else {
        pythonCmd = path.join(condaDir, 'bin', 'python');
        envPath = `${ffmpegDir}:${path.join(condaDir, 'bin')}:${process.env.PATH}`;
      }

      // Check if miniconda Python exists
      if (!existsSync(pythonCmd)) {
        console.error('[ComponentService] Miniconda Python not found at:', pythonCmd);
        return false;
      }

      console.log('[ComponentService] Starting Demucs server with:', pythonCmd);
      console.log('[ComponentService] Server path:', serverPath);

      this.demucsProcess = spawn(pythonCmd, ['server.py'], {
        cwd: serverPath,
        env: {
          ...process.env,
          PORT: '8765',
          PYTHONHOME: condaDir,
          PATH: envPath,
        },
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      this.demucsProcess.stdout?.on('data', (data: Buffer) => {
        console.log('[Demucs]', data.toString().trim());
      });

      this.demucsProcess.stderr?.on('data', (data: Buffer) => {
        console.error('[Demucs]', data.toString().trim());
      });

      this.demucsProcess.on('error', (err) => {
        console.error('[ComponentService] Failed to start Demucs server:', err.message);
        this.demucsProcess = null;
      });

      this.demucsProcess.on('exit', (code) => {
        console.log('[ComponentService] Demucs server exited with code:', code);
        this.demucsProcess = null;
      });

      // Wait for server to be ready
      await this.waitForServer(10000);
      return true;
    } catch (error) {
      console.error('[ComponentService] Error starting server:', error);
      return false;
    }
  }

  /**
   * Stop the Demucs server
   */
  async stopServer(): Promise<void> {
    if (this.demucsProcess) {
      try {
        this.demucsProcess.kill();
        this.demucsProcess = null;
        console.log('[ComponentService] Demucs server stopped');
      } catch (error) {
        console.error('[ComponentService] Error stopping server:', error);
      }
    }
  }

  /**
   * Check if server is running and responding
   */
  async isServerAvailable(): Promise<boolean> {
    try {
      const response = await fetch('http://localhost:8765/health', {
        method: 'GET',
        signal: AbortSignal.timeout(2000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Dispose - clean up resources
   */
  async dispose(): Promise<void> {
    await this.stopServer();
    console.log('[ComponentService] Disposed');
  }

  // ============================================
  // Private Helpers
  // ============================================

  private async downloadFile(
    url: string,
    destPath: string,
    onProgress?: (downloaded: number, total: number) => void
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const parsedUrl = new URL(url);
      const protocol = parsedUrl.protocol === 'https:' ? https : http;

      const options = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
        path: parsedUrl.pathname + parsedUrl.search,
        method: 'GET',
        headers: {
          'User-Agent': 'Audiio/1.0 (Electron)',
          'Accept': '*/*',
        },
      };

      const request = protocol.request(options, (response) => {
        // Handle redirects
        if (response.statusCode === 301 || response.statusCode === 302 || response.statusCode === 303 || response.statusCode === 307) {
          const redirectUrl = response.headers.location;
          if (redirectUrl) {
            // Handle relative URLs
            const fullRedirectUrl = redirectUrl.startsWith('http') ? redirectUrl : new URL(redirectUrl, url).toString();
            this.downloadFile(fullRedirectUrl, destPath, onProgress)
              .then(resolve)
              .catch(reject);
            return;
          }
        }

        if (response.statusCode !== 200) {
          reject(new Error(`Download failed: HTTP ${response.statusCode}`));
          return;
        }

        const totalBytes = parseInt(response.headers['content-length'] || '0', 10);
        let downloadedBytes = 0;

        const fileStream = createWriteStream(destPath);

        response.on('data', (chunk: Buffer) => {
          downloadedBytes += chunk.length;
          onProgress?.(downloadedBytes, totalBytes);
        });

        response.pipe(fileStream);

        fileStream.on('finish', () => {
          fileStream.close();
          resolve();
        });

        fileStream.on('error', (err) => {
          rmSync(destPath, { force: true });
          reject(err);
        });
      });

      request.on('error', (err) => {
        reject(err);
      });

      // Handle abort
      if (this.abortController) {
        this.abortController.signal.addEventListener('abort', () => {
          request.destroy();
          reject(new Error('Download cancelled'));
        });
      }

      request.end();
    });
  }

  private async waitForServer(timeout: number): Promise<boolean> {
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
      if (await this.isServerAvailable()) {
        return true;
      }
      await new Promise((r) => setTimeout(r, 500));
    }
    return false;
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }
}

// Export singleton
export const componentService = new ComponentService();
