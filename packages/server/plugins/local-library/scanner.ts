/**
 * Local Library Scanner
 *
 * Scans directories for audio and video files, extracting metadata.
 * Supports audio via music-metadata and video via ffprobe.
 *
 * Security:
 * - Can use sandboxed filesystem (SandboxedFS) for secure access
 * - Falls back to native fs for development/unsandboxed mode
 */

import * as nativeFs from 'fs/promises';
import * as path from 'path';
import { parseFile } from 'music-metadata';
import type { SandboxedFS } from '@audiio/sdk';

// ========================================
// Types
// ========================================

export interface ScanProgress {
  scanned: number;
  total: number;
  current: string;
  phase: 'discovering' | 'scanning' | 'complete';
}

export interface LocalTrack {
  filePath: string;
  title?: string;
  artist?: string;
  album?: string;
  duration?: number;
  genres?: string[];
  artworkPath?: string;
  fileSize?: number;
  mimeType?: string;
  modifiedAt?: number;
  trackNumber?: number;
  year?: number;
}

export interface LocalVideo {
  filePath: string;
  title?: string;
  artist?: string;
  duration?: number;
  resolution?: string;
  codec?: string;
  thumbnailPath?: string;
  fileSize?: number;
  mimeType?: string;
  videoType?: 'music_video' | 'concert' | 'other';
  modifiedAt?: number;
}

export interface ScanOptions {
  includeAudio: boolean;
  includeVideo: boolean;
  onProgress?: (progress: ScanProgress) => void;
  maxDepth?: number;
}

export interface ScanResult {
  tracks: LocalTrack[];
  videos: LocalVideo[];
  errors: Array<{ path: string; error: string }>;
}

// Supported file extensions
const AUDIO_EXTENSIONS = new Set([
  '.mp3', '.flac', '.m4a', '.aac', '.ogg', '.opus', '.wav', '.aiff', '.wma', '.alac'
]);

const VIDEO_EXTENSIONS = new Set([
  '.mp4', '.mkv', '.webm', '.avi', '.mov', '.m4v', '.wmv', '.flv'
]);

// MIME types by extension
const MIME_TYPES: Record<string, string> = {
  '.mp3': 'audio/mpeg',
  '.flac': 'audio/flac',
  '.m4a': 'audio/mp4',
  '.aac': 'audio/aac',
  '.ogg': 'audio/ogg',
  '.opus': 'audio/opus',
  '.wav': 'audio/wav',
  '.aiff': 'audio/aiff',
  '.wma': 'audio/x-ms-wma',
  '.alac': 'audio/alac',
  '.mp4': 'video/mp4',
  '.mkv': 'video/x-matroska',
  '.webm': 'video/webm',
  '.avi': 'video/x-msvideo',
  '.mov': 'video/quicktime',
  '.m4v': 'video/x-m4v',
  '.wmv': 'video/x-ms-wmv',
  '.flv': 'video/x-flv'
};

// ========================================
// Local Scanner
// ========================================

export class LocalScanner {
  private ffprobePath: string | null = null;
  private sandboxedFs: SandboxedFS | null = null;

  constructor(sandboxedFs?: SandboxedFS | null) {
    this.sandboxedFs = sandboxedFs || null;
    this.detectFFprobe();
  }

  /**
   * Get filesystem interface (sandboxed or native)
   */
  private get fs() {
    // Return a unified interface that works with both
    const sandboxed = this.sandboxedFs;

    return {
      readdir: async (dirPath: string): Promise<string[]> => {
        if (sandboxed) {
          return sandboxed.readdir(dirPath);
        }
        return nativeFs.readdir(dirPath);
      },

      stat: async (filePath: string) => {
        if (sandboxed) {
          const stats = await sandboxed.stat(filePath);
          return {
            isFile: () => stats.isFile,
            isDirectory: () => stats.isDirectory,
            size: stats.size,
            mtimeMs: stats.modifiedAt
          };
        }
        return nativeFs.stat(filePath);
      },

      readFile: async (filePath: string): Promise<Buffer> => {
        if (sandboxed) {
          return sandboxed.readFile(filePath);
        }
        return nativeFs.readFile(filePath);
      }
    };
  }

  /**
   * Detect ffprobe binary location
   */
  private async detectFFprobe(): Promise<void> {
    try {
      // Try to find ffprobe in common locations
      const { execSync } = await import('child_process');

      // Check if ffprobe is in PATH
      try {
        execSync('ffprobe -version', { stdio: 'ignore' });
        this.ffprobePath = 'ffprobe';
        return;
      } catch {}

      // Try ffprobe-static if available
      try {
        const ffprobeStatic = require('ffprobe-static');
        this.ffprobePath = ffprobeStatic.path;
      } catch {
        // ffprobe not available - video metadata will be limited
        console.log('[LocalScanner] ffprobe not found, video metadata will be limited');
      }
    } catch {
      // Ignore detection errors
    }
  }

  /**
   * Scan a directory for audio and video files
   */
  async scanDirectory(dirPath: string, options: ScanOptions): Promise<ScanResult> {
    const result: ScanResult = {
      tracks: [],
      videos: [],
      errors: []
    };

    const maxDepth = options.maxDepth ?? 10;

    // Phase 1: Discover all files
    options.onProgress?.({ scanned: 0, total: 0, current: dirPath, phase: 'discovering' });

    const files = await this.discoverFiles(dirPath, options, maxDepth);

    // Phase 2: Scan files for metadata
    let scanned = 0;
    const total = files.length;

    for (const file of files) {
      options.onProgress?.({
        scanned,
        total,
        current: path.basename(file.path),
        phase: 'scanning'
      });

      try {
        if (file.type === 'audio') {
          const track = await this.scanAudioFile(file.path);
          if (track) {
            result.tracks.push(track);
          }
        } else if (file.type === 'video') {
          const video = await this.scanVideoFile(file.path);
          if (video) {
            result.videos.push(video);
          }
        }
      } catch (error) {
        result.errors.push({
          path: file.path,
          error: error instanceof Error ? error.message : String(error)
        });
      }

      scanned++;
    }

    options.onProgress?.({
      scanned: total,
      total,
      current: '',
      phase: 'complete'
    });

    return result;
  }

  /**
   * Discover all media files in a directory tree
   */
  private async discoverFiles(
    dirPath: string,
    options: ScanOptions,
    maxDepth: number,
    currentDepth: number = 0
  ): Promise<Array<{ path: string; type: 'audio' | 'video' }>> {
    const files: Array<{ path: string; type: 'audio' | 'video' }> = [];

    if (currentDepth > maxDepth) {
      return files;
    }

    try {
      // Use the fs interface (sandboxed or native)
      const entries = await this.fs.readdir(dirPath);

      for (const entryName of entries) {
        const entryPath = path.join(dirPath, entryName);

        // Skip hidden files and directories
        if (entryName.startsWith('.')) continue;

        const stats = await this.fs.stat(entryPath);

        if (stats.isDirectory()) {
          // Recursively scan subdirectories
          const subFiles = await this.discoverFiles(entryPath, options, maxDepth, currentDepth + 1);
          files.push(...subFiles);
        } else if (stats.isFile()) {
          const ext = path.extname(entryName).toLowerCase();

          if (options.includeAudio && AUDIO_EXTENSIONS.has(ext)) {
            files.push({ path: entryPath, type: 'audio' });
          } else if (options.includeVideo && VIDEO_EXTENSIONS.has(ext)) {
            files.push({ path: entryPath, type: 'video' });
          }
        }
      }
    } catch (error) {
      console.error(`[LocalScanner] Error reading directory ${dirPath}:`, error);
    }

    return files;
  }

  /**
   * Scan an audio file for metadata
   */
  private async scanAudioFile(filePath: string): Promise<LocalTrack | null> {
    try {
      const stats = await this.fs.stat(filePath);
      const ext = path.extname(filePath).toLowerCase();

      // Parse metadata using music-metadata
      // Note: music-metadata uses native fs, which works with authorized paths
      const metadata = await parseFile(filePath, { skipCovers: false });

      // Extract embedded artwork if available
      let artworkPath: string | undefined;
      if (metadata.common.picture && metadata.common.picture.length > 0) {
        // For now, we don't extract artwork to files
        // Could be extended to save to cache directory
        artworkPath = undefined;
      }

      return {
        filePath,
        title: metadata.common.title || this.extractTitleFromFilename(filePath),
        artist: metadata.common.artist || metadata.common.albumartist,
        album: metadata.common.album,
        duration: metadata.format.duration ? Math.round(metadata.format.duration * 1000) : undefined,
        genres: metadata.common.genre,
        artworkPath,
        fileSize: stats.size,
        mimeType: MIME_TYPES[ext] || 'audio/unknown',
        modifiedAt: stats.mtimeMs,
        trackNumber: metadata.common.track?.no || undefined,
        year: metadata.common.year
      };
    } catch (error) {
      console.error(`[LocalScanner] Error scanning audio file ${filePath}:`, error);
      return null;
    }
  }

  /**
   * Scan a video file for metadata
   */
  private async scanVideoFile(filePath: string): Promise<LocalVideo | null> {
    try {
      const stats = await this.fs.stat(filePath);
      const ext = path.extname(filePath).toLowerCase();

      let duration: number | undefined;
      let resolution: string | undefined;
      let codec: string | undefined;

      // Try to get video metadata using ffprobe
      if (this.ffprobePath) {
        try {
          const probeData = await this.probeVideo(filePath);
          duration = probeData.duration;
          resolution = probeData.resolution;
          codec = probeData.codec;
        } catch {
          // ffprobe failed, continue without detailed metadata
        }
      }

      // Determine video type from path/filename
      const videoType = this.classifyVideoType(filePath);

      // Extract title and artist from filename
      const { title, artist } = this.parseVideoFilename(filePath);

      return {
        filePath,
        title,
        artist,
        duration,
        resolution,
        codec,
        thumbnailPath: undefined,  // Could be generated with ffmpeg
        fileSize: stats.size,
        mimeType: MIME_TYPES[ext] || 'video/unknown',
        videoType,
        modifiedAt: stats.mtimeMs
      };
    } catch (error) {
      console.error(`[LocalScanner] Error scanning video file ${filePath}:`, error);
      return null;
    }
  }

  /**
   * Probe video file with ffprobe
   */
  private async probeVideo(filePath: string): Promise<{
    duration?: number;
    resolution?: string;
    codec?: string;
  }> {
    if (!this.ffprobePath) {
      return {};
    }

    return new Promise((resolve) => {
      const { exec } = require('child_process');

      const cmd = `"${this.ffprobePath}" -v quiet -print_format json -show_format -show_streams "${filePath.replace(/"/g, '\\"')}"`;

      exec(cmd, { timeout: 30000 }, (error: Error | null, stdout: string) => {
        if (error) {
          resolve({});
          return;
        }

        try {
          const data = JSON.parse(stdout);
          const videoStream = data.streams?.find((s: any) => s.codec_type === 'video');

          resolve({
            duration: data.format?.duration ? Math.round(parseFloat(data.format.duration) * 1000) : undefined,
            resolution: videoStream ? `${videoStream.width}x${videoStream.height}` : undefined,
            codec: videoStream?.codec_name
          });
        } catch {
          resolve({});
        }
      });
    });
  }

  /**
   * Classify video type based on path and filename
   */
  private classifyVideoType(filePath: string): 'music_video' | 'concert' | 'other' {
    const lowerPath = filePath.toLowerCase();

    // Check for music video indicators
    if (
      lowerPath.includes('music video') ||
      lowerPath.includes('musicvideo') ||
      lowerPath.includes('mv') ||
      lowerPath.includes('official video')
    ) {
      return 'music_video';
    }

    // Check for concert indicators
    if (
      lowerPath.includes('concert') ||
      lowerPath.includes('live') ||
      lowerPath.includes('performance') ||
      lowerPath.includes('tour')
    ) {
      return 'concert';
    }

    return 'other';
  }

  /**
   * Parse video filename to extract title and artist
   */
  private parseVideoFilename(filePath: string): { title: string; artist?: string } {
    const basename = path.basename(filePath, path.extname(filePath));

    // Common patterns:
    // "Artist - Title"
    // "Artist - Title (Official Video)"
    // "Title - Artist"

    // Try "Artist - Title" pattern
    const dashMatch = basename.match(/^(.+?)\s*[-–—]\s*(.+?)(?:\s*\(.*\))?$/);
    if (dashMatch) {
      const [, first, second] = dashMatch;

      // Heuristic: if second part has more caps, it's probably the title
      // Otherwise, assume "Artist - Title" format
      return {
        artist: first.trim(),
        title: second.trim()
      };
    }

    // No pattern matched, use filename as title
    return {
      title: basename
        .replace(/\[.*?\]/g, '')   // Remove bracketed content
        .replace(/\(.*?\)/g, '')   // Remove parenthesized content
        .replace(/_/g, ' ')        // Replace underscores with spaces
        .replace(/\s+/g, ' ')      // Normalize whitespace
        .trim()
    };
  }

  /**
   * Extract title from filename
   */
  private extractTitleFromFilename(filePath: string): string {
    const basename = path.basename(filePath, path.extname(filePath));

    // Clean up common patterns
    return basename
      .replace(/^\d+[\s._-]+/, '')  // Remove leading track numbers
      .replace(/_/g, ' ')           // Replace underscores
      .replace(/\s+/g, ' ')         // Normalize whitespace
      .trim();
  }
}
