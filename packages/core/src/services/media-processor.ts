/**
 * Media Processor Service
 * Handles FFmpeg-based media processing operations
 * Used for converting HLS streams, video processing, and format conversion
 */

import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface HLSConversionOptions {
  /** Number of times to loop the video (default: 1, no loop) */
  loopCount?: number;
  /** Output directory for the file */
  outputDir?: string;
  /** Custom filename (without extension) */
  filename?: string;
  /** Return the file as a Buffer */
  returnBuffer?: boolean;
  /** Clean up temp files after conversion (default: true) */
  cleanup?: boolean;
  /** Timeout in milliseconds (default: 60000) */
  timeout?: number;
}

export interface ConversionResult {
  /** Path to the output file */
  outputPath: string;
  /** File as Buffer if requested */
  buffer?: Buffer;
  /** File size in bytes */
  size: number;
  /** Duration of conversion in ms */
  duration: number;
}

export interface FFmpegProgress {
  /** Current frame being processed */
  frame?: number;
  /** Current time position */
  time?: string;
  /** Processing speed (e.g., "1.5x") */
  speed?: string;
}

export type ProgressCallback = (progress: FFmpegProgress) => void;

/**
 * MediaProcessor - Core service for media conversion operations
 * Provides FFmpeg-based utilities for the entire application
 */
export class MediaProcessor {
  private static instance: MediaProcessor;
  private ffmpegAvailable: boolean | null = null;

  private constructor() {}

  /**
   * Get singleton instance
   */
  static getInstance(): MediaProcessor {
    if (!MediaProcessor.instance) {
      MediaProcessor.instance = new MediaProcessor();
    }
    return MediaProcessor.instance;
  }

  /**
   * Check if FFmpeg is available on the system
   */
  async checkFFmpegAvailable(): Promise<boolean> {
    if (this.ffmpegAvailable !== null) {
      return this.ffmpegAvailable;
    }

    this.ffmpegAvailable = await new Promise<boolean>((resolve) => {
      const ffmpeg = spawn('ffmpeg', ['-version']);

      ffmpeg.on('close', (code) => {
        resolve(code === 0);
      });

      ffmpeg.on('error', () => {
        resolve(false);
      });
    });

    return this.ffmpegAvailable;
  }

  /**
   * Convert an HLS (M3U8) stream to MP4
   * Handles downloading and optional looping
   */
  async convertHLSToMP4(
    m3u8Url: string,
    options: HLSConversionOptions = {},
    onProgress?: ProgressCallback
  ): Promise<ConversionResult> {
    const startTime = Date.now();

    // Check FFmpeg availability
    const hasFFmpeg = await this.checkFFmpegAvailable();
    if (!hasFFmpeg) {
      throw new Error('FFmpeg is not installed or not available in PATH');
    }

    const {
      loopCount = 1,
      outputDir = os.tmpdir(),
      filename = `media_${Date.now()}`,
      returnBuffer = false,
      cleanup = true,
      timeout = 60000
    } = options;

    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'media-processor-'));
    const tempVideoPath = path.join(tempDir, 'source.mp4');
    const tempLoopedPath = path.join(tempDir, 'looped.mp4');
    const finalPath = path.join(outputDir, `${filename}.mp4`);

    try {
      // Step 1: Download HLS stream to MP4 (stream copy - fast, no re-encoding)
      await this.runFFmpeg(
        ['-y', '-i', m3u8Url, '-c', 'copy', tempVideoPath],
        timeout,
        onProgress
      );

      // Step 2: Loop the video if requested
      let sourceForFinal = tempVideoPath;
      if (loopCount > 1) {
        await this.runFFmpeg(
          [
            '-y',
            '-stream_loop', String(loopCount - 1),
            '-i', tempVideoPath,
            '-c', 'copy',
            tempLoopedPath
          ],
          timeout,
          onProgress
        );
        sourceForFinal = tempLoopedPath;
      }

      // Step 3: Ensure output directory exists and copy final file
      await fs.mkdir(outputDir, { recursive: true });
      await fs.copyFile(sourceForFinal, finalPath);

      // Step 4: Get file stats
      const stats = await fs.stat(finalPath);

      // Step 5: Optionally read as buffer
      let buffer: Buffer | undefined;
      if (returnBuffer) {
        buffer = await fs.readFile(finalPath);
      }

      // Step 6: Cleanup temp files
      if (cleanup) {
        await this.cleanupDir(tempDir);
      }

      return {
        outputPath: finalPath,
        buffer,
        size: stats.size,
        duration: Date.now() - startTime
      };
    } catch (error) {
      // Always cleanup on error
      await this.cleanupDir(tempDir);
      throw error;
    }
  }

  /**
   * Convert any supported format to MP4
   */
  async convertToMP4(
    inputPath: string,
    options: Omit<HLSConversionOptions, 'loopCount'> = {},
    onProgress?: ProgressCallback
  ): Promise<ConversionResult> {
    const startTime = Date.now();

    const hasFFmpeg = await this.checkFFmpegAvailable();
    if (!hasFFmpeg) {
      throw new Error('FFmpeg is not installed or not available in PATH');
    }

    const {
      outputDir = os.tmpdir(),
      filename = `converted_${Date.now()}`,
      returnBuffer = false,
      timeout = 120000
    } = options;

    const finalPath = path.join(outputDir, `${filename}.mp4`);

    await fs.mkdir(outputDir, { recursive: true });

    // Convert with re-encoding for compatibility
    await this.runFFmpeg(
      [
        '-y',
        '-i', inputPath,
        '-c:v', 'libx264',
        '-c:a', 'aac',
        '-movflags', '+faststart',
        finalPath
      ],
      timeout,
      onProgress
    );

    const stats = await fs.stat(finalPath);

    let buffer: Buffer | undefined;
    if (returnBuffer) {
      buffer = await fs.readFile(finalPath);
    }

    return {
      outputPath: finalPath,
      buffer,
      size: stats.size,
      duration: Date.now() - startTime
    };
  }

  /**
   * Extract a frame from a video as an image
   */
  async extractFrame(
    videoPath: string,
    options: {
      timestamp?: string; // e.g., "00:00:01" or "5" (seconds)
      outputPath?: string;
      width?: number;
      height?: number;
    } = {}
  ): Promise<string> {
    const hasFFmpeg = await this.checkFFmpegAvailable();
    if (!hasFFmpeg) {
      throw new Error('FFmpeg is not installed or not available in PATH');
    }

    const {
      timestamp = '0',
      outputPath = path.join(os.tmpdir(), `frame_${Date.now()}.jpg`),
      width,
      height
    } = options;

    const args = [
      '-y',
      '-ss', timestamp,
      '-i', videoPath,
      '-frames:v', '1'
    ];

    if (width && height) {
      args.push('-vf', `scale=${width}:${height}`);
    }

    args.push(outputPath);

    await this.runFFmpeg(args, 30000);

    return outputPath;
  }

  /**
   * Get video/audio information
   */
  async getMediaInfo(filePath: string): Promise<{
    duration: number;
    width?: number;
    height?: number;
    codec?: string;
    bitrate?: number;
  }> {
    return new Promise((resolve, reject) => {
      const ffprobe = spawn('ffprobe', [
        '-v', 'quiet',
        '-print_format', 'json',
        '-show_format',
        '-show_streams',
        filePath
      ]);

      let stdout = '';
      let stderr = '';

      ffprobe.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      ffprobe.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      ffprobe.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`ffprobe failed: ${stderr}`));
          return;
        }

        try {
          const info = JSON.parse(stdout);
          const videoStream = info.streams?.find((s: { codec_type: string }) => s.codec_type === 'video');
          const format = info.format || {};

          resolve({
            duration: parseFloat(format.duration) || 0,
            width: videoStream?.width,
            height: videoStream?.height,
            codec: videoStream?.codec_name,
            bitrate: parseInt(format.bit_rate) || undefined
          });
        } catch {
          reject(new Error('Failed to parse ffprobe output'));
        }
      });

      ffprobe.on('error', (err) => {
        reject(new Error(`Failed to run ffprobe: ${err.message}`));
      });
    });
  }

  /**
   * Run an FFmpeg command with timeout support
   */
  private runFFmpeg(
    args: string[],
    timeout: number,
    onProgress?: ProgressCallback
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const ffmpeg = spawn('ffmpeg', ['-loglevel', 'info', '-progress', 'pipe:1', ...args]);

      let stderr = '';
      let timeoutId: NodeJS.Timeout | undefined;

      if (timeout > 0) {
        timeoutId = setTimeout(() => {
          ffmpeg.kill('SIGKILL');
          reject(new Error(`FFmpeg timed out after ${timeout}ms`));
        }, timeout);
      }

      ffmpeg.stdout.on('data', (data) => {
        if (onProgress) {
          const output = data.toString();
          const progress: FFmpegProgress = {};

          const frameMatch = output.match(/frame=(\d+)/);
          if (frameMatch) progress.frame = parseInt(frameMatch[1]);

          const timeMatch = output.match(/out_time=([^\n]+)/);
          if (timeMatch) progress.time = timeMatch[1].trim();

          const speedMatch = output.match(/speed=([^\n]+)/);
          if (speedMatch) progress.speed = speedMatch[1].trim();

          if (Object.keys(progress).length > 0) {
            onProgress(progress);
          }
        }
      });

      ffmpeg.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      ffmpeg.on('close', (code) => {
        if (timeoutId) clearTimeout(timeoutId);

        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`FFmpeg exited with code ${code}: ${stderr}`));
        }
      });

      ffmpeg.on('error', (err) => {
        if (timeoutId) clearTimeout(timeoutId);
        reject(new Error(`Failed to start FFmpeg: ${err.message}. Is FFmpeg installed?`));
      });
    });
  }

  /**
   * Cleanup a directory
   */
  private async cleanupDir(dir: string): Promise<void> {
    try {
      await fs.rm(dir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  }
}

// Export singleton getter for convenience
export const getMediaProcessor = () => MediaProcessor.getInstance();
