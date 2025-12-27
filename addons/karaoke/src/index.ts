/**
 * Karaoke Processor - AI-powered vocal removal using Demucs
 *
 * Features:
 * - Streaming mode: Get first 15 seconds quickly for immediate playback
 * - Full track processes in background, seamlessly swaps when ready
 * - Caches processed tracks as base64 (for IPC transfer to renderer)
 */

import { BaseAudioProcessor, type AudioProcessorResult } from '@audiio/sdk';

const DEMUCS_SERVER = 'http://localhost:8765';

interface DemucsHealthResponse {
  status: string;
  device: string;
  model: string;
  model_loaded: boolean;
  gpu_available: boolean;
}

interface StreamStartResponse {
  success: boolean;
  first_segment?: string;  // base64 encoded
  duration?: number;
  is_complete?: boolean;
  error?: string;
}

interface StreamStatusResponse {
  status: 'processing' | 'complete' | 'error' | 'not_found';
  full_track?: string;  // base64 encoded
  error?: string;
}

// Extended result that includes base64 data for IPC transfer
export interface KaraokeProcessorResult extends AudioProcessorResult {
  audioBase64?: string;  // Base64 audio data for IPC transfer
  mimeType?: string;     // MIME type of the audio
  isPartial?: boolean;   // True if this is just the first segment
  duration?: number;     // Total track duration
}

// Callback type for when full track becomes ready
export type FullTrackReadyCallback = (trackId: string, result: KaraokeProcessorResult) => void;

export class KaraokeProcessor extends BaseAudioProcessor {
  readonly id = 'karaoke';
  readonly name = 'Karaoke Mode';

  // In-memory cache of processed track audio (base64)
  private cache = new Map<string, { base64: string; mimeType: string; isComplete: boolean }>();

  // Track processing status
  private processing = new Map<string, Promise<KaraokeProcessorResult>>();

  // Polling intervals for background completion
  private pollingIntervals = new Map<string, NodeJS.Timeout>();

  // Callback for when full track becomes ready (push notification instead of polling)
  private onFullTrackReadyCallbacks: FullTrackReadyCallback[] = [];

  async initialize(): Promise<void> {
    this.cache.clear();
  }

  async dispose(): Promise<void> {
    // Clear all polling intervals
    for (const interval of this.pollingIntervals.values()) {
      clearInterval(interval);
    }
    this.pollingIntervals.clear();
    this.cache.clear();
    this.processing.clear();
    this.onFullTrackReadyCallbacks = [];
  }

  /**
   * Register a callback to be notified when a full track becomes ready
   * This replaces the need for renderer-side polling
   */
  onFullTrackReady(callback: FullTrackReadyCallback): () => void {
    this.onFullTrackReadyCallbacks.push(callback);
    return () => {
      const index = this.onFullTrackReadyCallbacks.indexOf(callback);
      if (index > -1) {
        this.onFullTrackReadyCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * Notify all listeners that a full track is ready
   */
  private notifyFullTrackReady(trackId: string, result: KaraokeProcessorResult): void {
    for (const callback of this.onFullTrackReadyCallbacks) {
      try {
        callback(trackId, result);
      } catch (error) {
        console.error('[Karaoke] Callback error:', error);
      }
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${DEMUCS_SERVER}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(2000)
      });

      if (!response.ok) return false;

      const data: DemucsHealthResponse = await response.json();
      return data.status === 'ok' && data.model_loaded;
    } catch {
      return false;
    }
  }

  /**
   * Process track with streaming - returns first segment quickly
   */
  async processTrack(trackId: string, audioUrl: string): Promise<KaraokeProcessorResult> {
    // Check cache first - return complete version if available
    const cached = this.cache.get(trackId);
    if (cached?.isComplete) {
      return {
        trackId,
        instrumentalUrl: '',
        audioBase64: cached.base64,
        mimeType: cached.mimeType,
        cached: true,
        isPartial: false
      };
    }

    // Check if already processing
    const existing = this.processing.get(trackId);
    if (existing) return existing;

    // Start streaming processing
    const processingPromise = this.doStreamProcess(trackId, audioUrl);
    this.processing.set(trackId, processingPromise);

    try {
      const result = await processingPromise;
      return result;
    } finally {
      this.processing.delete(trackId);
    }
  }

  private async doStreamProcess(trackId: string, audioUrl: string): Promise<KaraokeProcessorResult> {
    console.log(`[Karaoke] Starting stream processing for: ${trackId}`);

    const response = await fetch(`${DEMUCS_SERVER}/stream/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: audioUrl, track_id: trackId })
    });

    if (!response.ok) {
      throw new Error(`Demucs streaming failed: ${response.status} ${response.statusText}`);
    }

    const data: StreamStartResponse = await response.json();

    if (!data.success || !data.first_segment) {
      throw new Error(data.error || 'Failed to get first segment');
    }

    // Cache the first segment
    this.cache.set(trackId, {
      base64: data.first_segment,
      mimeType: 'audio/mpeg',
      isComplete: data.is_complete || false
    });

    // If not complete, start polling for full track
    if (!data.is_complete) {
      this.startPollingForComplete(trackId);
    }

    console.log(`[Karaoke] First segment ready for: ${trackId}, complete: ${data.is_complete}`);

    return {
      trackId,
      instrumentalUrl: '',
      audioBase64: data.first_segment,
      mimeType: 'audio/mpeg',
      cached: false,
      isPartial: !data.is_complete,
      duration: data.duration
    };
  }

  /**
   * Poll for full track completion in background
   */
  private startPollingForComplete(trackId: string): void {
    // Clear any existing interval
    const existing = this.pollingIntervals.get(trackId);
    if (existing) clearInterval(existing);

    let attempts = 0;
    const maxAttempts = 120; // 2 minutes max (1 second intervals)

    const interval = setInterval(async () => {
      attempts++;

      if (attempts > maxAttempts) {
        console.log(`[Karaoke] Polling timeout for: ${trackId}`);
        clearInterval(interval);
        this.pollingIntervals.delete(trackId);
        return;
      }

      try {
        const response = await fetch(`${DEMUCS_SERVER}/stream/status/${trackId}`);
        const data: StreamStatusResponse = await response.json();

        if (data.status === 'complete' && data.full_track) {
          console.log(`[Karaoke] Full track ready for: ${trackId}`);

          // Update cache with full track
          this.cache.set(trackId, {
            base64: data.full_track,
            mimeType: 'audio/mpeg',
            isComplete: true
          });

          clearInterval(interval);
          this.pollingIntervals.delete(trackId);

          // PUSH NOTIFICATION: Notify listeners that full track is ready
          // This replaces the need for renderer-side polling
          this.notifyFullTrackReady(trackId, {
            trackId,
            instrumentalUrl: '',
            audioBase64: data.full_track,
            mimeType: 'audio/mpeg',
            cached: true,
            isPartial: false
          });
        } else if (data.status === 'error') {
          console.error(`[Karaoke] Processing error for: ${trackId}`, data.error);
          clearInterval(interval);
          this.pollingIntervals.delete(trackId);
        }
      } catch (error) {
        console.error(`[Karaoke] Polling error for: ${trackId}`, error);
      }
    }, 1000);

    this.pollingIntervals.set(trackId, interval);
  }

  /**
   * Check if full track is ready (not just first segment)
   */
  async isFullTrackReady(trackId: string): Promise<boolean> {
    const cached = this.cache.get(trackId);
    return cached?.isComplete || false;
  }

  /**
   * Get full track if available (blocks briefly if still processing)
   */
  async getFullTrack(trackId: string): Promise<KaraokeProcessorResult | null> {
    const cached = this.cache.get(trackId);
    if (cached?.isComplete) {
      return {
        trackId,
        instrumentalUrl: '',
        audioBase64: cached.base64,
        mimeType: cached.mimeType,
        cached: true,
        isPartial: false
      };
    }

    // Try to get from server
    try {
      const response = await fetch(`${DEMUCS_SERVER}/stream/status/${trackId}`);
      const data: StreamStatusResponse = await response.json();

      if (data.status === 'complete' && data.full_track) {
        this.cache.set(trackId, {
          base64: data.full_track,
          mimeType: 'audio/mpeg',
          isComplete: true
        });

        return {
          trackId,
          instrumentalUrl: '',
          audioBase64: data.full_track,
          mimeType: 'audio/mpeg',
          cached: true,
          isPartial: false
        };
      }
    } catch {
      // Ignore errors
    }

    return null;
  }

  async hasCached(trackId: string): Promise<boolean> {
    return this.cache.has(trackId);
  }

  async getCached(trackId: string): Promise<KaraokeProcessorResult | null> {
    const cached = this.cache.get(trackId);
    if (!cached) return null;

    return {
      trackId,
      instrumentalUrl: '',
      audioBase64: cached.base64,
      mimeType: cached.mimeType,
      cached: true,
      isPartial: !cached.isComplete
    };
  }

  async clearCache(trackId: string): Promise<void> {
    const interval = this.pollingIntervals.get(trackId);
    if (interval) {
      clearInterval(interval);
      this.pollingIntervals.delete(trackId);
    }
    this.cache.delete(trackId);
  }

  async clearAllCache(): Promise<void> {
    for (const interval of this.pollingIntervals.values()) {
      clearInterval(interval);
    }
    this.pollingIntervals.clear();
    this.cache.clear();
  }
}

export default KaraokeProcessor;
