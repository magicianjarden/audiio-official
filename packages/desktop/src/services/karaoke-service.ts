/**
 * Karaoke Service v3 - Premium Streaming Vocal Removal
 *
 * Features:
 * - INSTANT PLAYBACK: First chunk ready in ~3-4 seconds
 * - SEAMLESS STREAMING: Chunks processed and served as they complete
 * - PREDICTIVE PROCESSING: Pre-processes upcoming tracks in queue
 * - HARDWARE ADAPTIVE: Server auto-tunes based on GPU/CPU
 * - SMART CACHING: Persistent LRU cache across restarts
 */

import { io, Socket } from 'socket.io-client';

const DEMUCS_SERVER = 'http://localhost:8765';

interface HardwareInfo {
  device: string;
  device_name?: string;
  rtf: number;  // Real-time factor
}

interface DemucsHealthResponse {
  status: string;
  device: string;
  device_name: string;
  model: string;
  model_loaded: boolean;
  model_instances: number;
  chunk_seconds: number;
  estimated_rtf: number;
  vram_gb: number;
  gpu_available: boolean;
  streaming_enabled: boolean;
  predictive_enabled: boolean;
  cache_entries: number;
}

interface StreamStartResponse {
  success: boolean;
  first_chunk_url?: string;
  full_track_url?: string;
  is_cached?: boolean;
  is_complete?: boolean;
  estimated_total_seconds?: number;
  hardware?: HardwareInfo;
  error?: string;
}

interface StreamStatusResponse {
  status: 'processing' | 'complete' | 'error' | 'not_found';
  progress?: number;
  stage?: string;
  url?: string;
  first_chunk_url?: string;
  error?: string;
}

export interface KaraokeProcessorResult {
  trackId: string;
  instrumentalUrl: string;
  mimeType: string;
  cached: boolean;
  isPartial: boolean;
  isFirstChunk?: boolean;
  progress?: number;
  stage?: string;
  eta?: number;
}

export type ProgressCallback = (trackId: string, progress: number, stage: string, eta?: number) => void;
export type FullTrackReadyCallback = (trackId: string, result: KaraokeProcessorResult) => void;
export type FirstChunkReadyCallback = (trackId: string, url: string) => void;
export type ChunkUpdatedCallback = (trackId: string, url: string, chunkNumber: number) => void;

class KaraokeService {
  private socket: Socket | null = null;
  private socketConnected = false;

  // Connection waiters - resolved when WebSocket connects
  private connectionResolvers: Array<() => void> = [];

  // Cache tracks that we know about (just URLs, not data)
  private trackCache = new Map<string, { url: string; isComplete: boolean; isFirstChunk: boolean; firstChunkCallbackFired?: boolean; chunkNumber?: number }>();

  // Active processing
  private processing = new Map<string, Promise<KaraokeProcessorResult>>();

  // Callbacks
  private onFullTrackReadyCallbacks: FullTrackReadyCallback[] = [];
  private onProgressCallbacks: ProgressCallback[] = [];
  private onFirstChunkReadyCallbacks: FirstChunkReadyCallback[] = [];
  private onChunkUpdatedCallbacks: ChunkUpdatedCallback[] = [];

  // Polling fallback
  private pollingIntervals = new Map<string, NodeJS.Timeout>();

  // Hardware info from server
  private hardwareInfo: HardwareInfo | null = null;

  initialize(): void {
    this.trackCache.clear();
    this.connectWebSocket();
    console.log('[KaraokeService] Initialized - Premium Streaming Mode');
  }

  dispose(): void {
    this.disconnectWebSocket();
    for (const interval of this.pollingIntervals.values()) {
      clearInterval(interval);
    }
    this.pollingIntervals.clear();
    this.trackCache.clear();
    this.processing.clear();
    this.onFullTrackReadyCallbacks = [];
    this.onProgressCallbacks = [];
    this.onFirstChunkReadyCallbacks = [];
    this.onChunkUpdatedCallbacks = [];
    // Clear any pending connection waiters
    this.connectionResolvers = [];
    console.log('[KaraokeService] Disposed');
  }

  /**
   * Wait for WebSocket connection to be established.
   * Returns immediately if already connected.
   */
  private async waitForConnection(timeoutMs: number = 3000): Promise<boolean> {
    if (this.socketConnected) {
      return true;
    }

    // Ensure socket is being created
    if (!this.socket) {
      this.connectWebSocket();
    }

    return new Promise<boolean>((resolve) => {
      const timeout = setTimeout(() => {
        console.warn('[KaraokeService] WebSocket connection timeout - proceeding without WebSocket');
        resolve(false);
      }, timeoutMs);

      this.connectionResolvers.push(() => {
        clearTimeout(timeout);
        resolve(true);
      });
    });
  }

  private connectWebSocket(): void {
    if (this.socket) return;

    try {
      console.log('[KaraokeService] Attempting WebSocket connection to:', DEMUCS_SERVER);

      this.socket = io(DEMUCS_SERVER, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionAttempts: 10,
        timeout: 5000
      });

      this.socket.on('connect', () => {
        console.log('[KaraokeService] ✓ WebSocket connected successfully');
        this.socketConnected = true;
        // Resolve any pending connection waiters
        if (this.connectionResolvers.length > 0) {
          console.log(`[KaraokeService] Resolving ${this.connectionResolvers.length} pending connection waiters`);
          this.connectionResolvers.forEach(resolve => resolve());
          this.connectionResolvers = [];
        }
      });

      this.socket.on('disconnect', (reason) => {
        console.log('[KaraokeService] WebSocket disconnected:', reason);
        this.socketConnected = false;
      });

      this.socket.on('connect_error', (error) => {
        console.error('[KaraokeService] ✗ WebSocket connection error:', error.message);
        this.socketConnected = false;
      });

      this.socket.on('reconnect_attempt', (attempt) => {
        console.log('[KaraokeService] WebSocket reconnecting, attempt:', attempt);
      });

      this.socket.on('reconnect_failed', () => {
        console.error('[KaraokeService] ✗ WebSocket reconnection failed after all attempts');
      });

      // FIRST CHUNK READY - This is the key for instant playback!
      this.socket.on('first_chunk', (data: { track_id: string; url: string }) => {
        console.log(`[KaraokeService] First chunk ready via WebSocket: ${data.track_id}`);

        const fullUrl = `${DEMUCS_SERVER}${data.url}`;

        // Check if we already fired the callback
        const cached = this.trackCache.get(data.track_id);
        if (cached?.firstChunkCallbackFired) {
          console.log(`[KaraokeService] First chunk callback already fired for: ${data.track_id}`);
          return;
        }

        // Update cache
        this.trackCache.set(data.track_id, {
          url: fullUrl,
          isComplete: false,
          isFirstChunk: true,
          firstChunkCallbackFired: true
        });

        // Notify listeners - they can start playback NOW
        for (const callback of this.onFirstChunkReadyCallbacks) {
          try {
            callback(data.track_id, fullUrl);
          } catch (error) {
            console.error('[KaraokeService] FirstChunkReady callback error:', error);
          }
        }
      });

      // CHUNK UPDATED - Progressive streaming, audio file has grown
      this.socket.on('chunk_updated', (data: { track_id: string; url: string; chunk: number }) => {
        console.log(`[KaraokeService] Chunk ${data.chunk} ready for: ${data.track_id}`);

        const fullUrl = `${DEMUCS_SERVER}${data.url}`;

        // Update cache with new URL (same URL but file is longer now)
        this.trackCache.set(data.track_id, {
          url: fullUrl,
          isComplete: false,
          isFirstChunk: false,
          firstChunkCallbackFired: true,
          chunkNumber: data.chunk
        });

        // Notify listeners to reload audio with longer version
        for (const callback of this.onChunkUpdatedCallbacks) {
          try {
            callback(data.track_id, fullUrl, data.chunk);
          } catch (error) {
            console.error('[KaraokeService] ChunkUpdated callback error:', error);
          }
        }
      });

      // Progress updates with ETA
      this.socket.on('progress', (data: { track_id: string; progress: number; stage: string }) => {
        // Parse ETA from stage if present
        let eta: number | undefined;
        const etaMatch = data.stage.match(/ETA:\s*(\d+)s/);
        if (etaMatch && etaMatch[1]) {
          eta = parseInt(etaMatch[1], 10);
        }

        for (const callback of this.onProgressCallbacks) {
          try {
            callback(data.track_id, data.progress, data.stage, eta);
          } catch (error) {
            console.error('[KaraokeService] Progress callback error:', error);
          }
        }
      });

      // Full track complete
      this.socket.on('complete', (data: { track_id: string; url: string; is_complete: boolean }) => {
        console.log(`[KaraokeService] Full track complete: ${data.track_id}`);

        const fullUrl = `${DEMUCS_SERVER}${data.url}`;

        // Update cache to full version
        this.trackCache.set(data.track_id, {
          url: fullUrl,
          isComplete: true,
          isFirstChunk: false
        });

        // Clear polling
        const interval = this.pollingIntervals.get(data.track_id);
        if (interval) {
          clearInterval(interval);
          this.pollingIntervals.delete(data.track_id);
        }

        // Notify listeners
        const result: KaraokeProcessorResult = {
          trackId: data.track_id,
          instrumentalUrl: fullUrl,
          mimeType: 'audio/mpeg',
          cached: true,
          isPartial: false,
          isFirstChunk: false
        };

        for (const callback of this.onFullTrackReadyCallbacks) {
          try {
            callback(data.track_id, result);
          } catch (error) {
            console.error('[KaraokeService] FullTrackReady callback error:', error);
          }
        }
      });

      // Error handling
      this.socket.on('error', (data: { track_id: string; error: string }) => {
        console.error(`[KaraokeService] Processing error: ${data.track_id} - ${data.error}`);
      });

    } catch (error) {
      console.warn('[KaraokeService] WebSocket not available');
      this.socketConnected = false;
    }
  }

  private disconnectWebSocket(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.socketConnected = false;
    }
  }

  private subscribeToTrack(trackId: string): void {
    if (this.socket && this.socketConnected) {
      this.socket.emit('subscribe', { track_id: trackId });
    }
  }

  // ==========================================
  // Callback Registration
  // ==========================================

  onFullTrackReady(callback: FullTrackReadyCallback): () => void {
    this.onFullTrackReadyCallbacks.push(callback);
    return () => {
      const index = this.onFullTrackReadyCallbacks.indexOf(callback);
      if (index > -1) this.onFullTrackReadyCallbacks.splice(index, 1);
    };
  }

  onProgress(callback: ProgressCallback): () => void {
    this.onProgressCallbacks.push(callback);
    return () => {
      const index = this.onProgressCallbacks.indexOf(callback);
      if (index > -1) this.onProgressCallbacks.splice(index, 1);
    };
  }

  onFirstChunkReady(callback: FirstChunkReadyCallback): () => void {
    this.onFirstChunkReadyCallbacks.push(callback);
    return () => {
      const index = this.onFirstChunkReadyCallbacks.indexOf(callback);
      if (index > -1) this.onFirstChunkReadyCallbacks.splice(index, 1);
    };
  }

  onChunkUpdated(callback: ChunkUpdatedCallback): () => void {
    this.onChunkUpdatedCallbacks.push(callback);
    return () => {
      const index = this.onChunkUpdatedCallbacks.indexOf(callback);
      if (index > -1) this.onChunkUpdatedCallbacks.splice(index, 1);
    };
  }

  // ==========================================
  // Public API
  // ==========================================

  async isAvailable(): Promise<boolean> {
    try {
      console.log('[KaraokeService] Checking server availability at:', DEMUCS_SERVER);

      const response = await fetch(`${DEMUCS_SERVER}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(3000)
      });

      if (!response.ok) {
        console.error('[KaraokeService] ✗ Server returned status:', response.status);
        return false;
      }

      const data: DemucsHealthResponse = await response.json();
      this.hardwareInfo = {
        device: data.device,
        device_name: data.device_name,
        rtf: data.estimated_rtf
      };

      const available = data.status === 'ok' && data.model_loaded;
      if (available) {
        console.log('[KaraokeService] ✓ Server available:', data.device_name, '| Model:', data.model, '| GPU:', data.gpu_available);
      } else {
        console.error('[KaraokeService] ✗ Server not ready:', { status: data.status, model_loaded: data.model_loaded });
      }

      return available;
    } catch (error) {
      console.error('[KaraokeService] ✗ Server not available:', error instanceof Error ? error.message : 'Unknown error');
      return false;
    }
  }

  async getCapabilities(): Promise<DemucsHealthResponse | null> {
    try {
      const response = await fetch(`${DEMUCS_SERVER}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(3000)
      });

      if (!response.ok) return null;
      const data = await response.json();
      this.hardwareInfo = {
        device: data.device,
        device_name: data.device_name,
        rtf: data.estimated_rtf
      };
      return data;
    } catch {
      return null;
    }
  }

  /**
   * Process track with streaming - returns FIRST CHUNK URL as soon as available.
   * Full track continues processing in background.
   */
  async processTrack(
    trackId: string,
    audioUrl: string,
    predictNext?: Array<{ id: string; url: string }>
  ): Promise<KaraokeProcessorResult> {
    // Check cache first
    const cached = this.trackCache.get(trackId);
    if (cached?.isComplete) {
      return {
        trackId,
        instrumentalUrl: cached.url,
        mimeType: 'audio/mpeg',
        cached: true,
        isPartial: false,
        isFirstChunk: false
      };
    }

    // Check if already processing
    const existing = this.processing.get(trackId);
    if (existing) return existing;

    // Start streaming processing
    const processingPromise = this.doStreamProcess(trackId, audioUrl, predictNext);
    this.processing.set(trackId, processingPromise);

    try {
      return await processingPromise;
    } finally {
      this.processing.delete(trackId);
    }
  }

  private async doStreamProcess(
    trackId: string,
    audioUrl: string,
    predictNext?: Array<{ id: string; url: string }>
  ): Promise<KaraokeProcessorResult> {
    console.log(`[KaraokeService] Starting premium stream: ${trackId}`);
    console.log(`[KaraokeService] Audio URL: ${audioUrl.substring(0, 80)}...`);

    // CRITICAL: Wait for WebSocket connection BEFORE starting stream
    // This ensures we receive the first_chunk event
    const wsConnected = await this.waitForConnection(3000);
    console.log(`[KaraokeService] WebSocket connected: ${wsConnected}`);

    let response: Response;
    try {
      response = await fetch(`${DEMUCS_SERVER}/stream/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: audioUrl,
          track_id: trackId,
          predict_next: predictNext?.map(t => [t.id, t.url]) || []
        }),
        signal: AbortSignal.timeout(10000)
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[KaraokeService] ✗ Failed to start stream:`, msg);
      throw new Error(`Failed to connect to Demucs server: ${msg}`);
    }

    if (!response.ok) {
      console.error(`[KaraokeService] ✗ Stream start failed with status: ${response.status}`);
      throw new Error(`Stream start failed: ${response.status}`);
    }

    const data: StreamStartResponse = await response.json();

    if (!data.success) {
      console.error(`[KaraokeService] ✗ Stream start returned error:`, data.error);
      throw new Error(data.error || 'Stream start failed');
    }

    console.log(`[KaraokeService] ✓ Stream started:`, { is_cached: data.is_cached, is_complete: data.is_complete });

    // If cached, return immediately
    if (data.is_cached && data.is_complete) {
      const fullUrl = `${DEMUCS_SERVER}${data.full_track_url}`;

      this.trackCache.set(trackId, {
        url: fullUrl,
        isComplete: true,
        isFirstChunk: false
      });

      console.log(`[KaraokeService] Cache hit: ${trackId}`);

      return {
        trackId,
        instrumentalUrl: fullUrl,
        mimeType: 'audio/mpeg',
        cached: true,
        isPartial: false,
        isFirstChunk: false
      };
    }

    // Store hardware info
    if (data.hardware) {
      this.hardwareInfo = data.hardware;
    }

    // Subscribe to WebSocket events
    if (this.socketConnected) {
      this.subscribeToTrack(trackId);
    }

    // Start polling as backup
    this.startPolling(trackId);

    // Return immediately - first chunk URL will come via WebSocket
    // For now, return a pending result
    const firstChunkUrl = `${DEMUCS_SERVER}${data.first_chunk_url}`;

    // Store in cache (not complete yet, waiting for first chunk)
    this.trackCache.set(trackId, {
      url: firstChunkUrl,
      isComplete: false,
      isFirstChunk: true
    });

    console.log(`[KaraokeService] Processing started: ${trackId}, ETA: ${data.estimated_total_seconds}s`);

    return {
      trackId,
      instrumentalUrl: firstChunkUrl,
      mimeType: 'audio/mpeg',
      cached: false,
      isPartial: true,
      isFirstChunk: true,
      eta: data.estimated_total_seconds
    };
  }

  private startPolling(trackId: string): void {
    const existing = this.pollingIntervals.get(trackId);
    if (existing) clearInterval(existing);

    let attempts = 0;
    const maxAttempts = 180;  // 3 minutes max
    let lastStatus = '';

    console.log(`[KaraokeService] Starting polling for: ${trackId} (WebSocket connected: ${this.socketConnected})`);

    const interval = setInterval(async () => {
      attempts++;

      if (attempts > maxAttempts) {
        console.log(`[KaraokeService] ✗ Polling timeout after ${maxAttempts} attempts: ${trackId}`);
        clearInterval(interval);
        this.pollingIntervals.delete(trackId);
        return;
      }

      try {
        const response = await fetch(`${DEMUCS_SERVER}/stream/status/${trackId}`, {
          signal: AbortSignal.timeout(5000)
        });

        if (!response.ok) {
          if (attempts % 10 === 0) {
            console.log(`[KaraokeService] Polling: status check returned ${response.status} for ${trackId}`);
          }
          return;
        }

        const data: StreamStatusResponse = await response.json();

        // Log status changes
        const currentStatus = `${data.status}:${data.progress}:${!!data.first_chunk_url}`;
        if (currentStatus !== lastStatus) {
          console.log(`[KaraokeService] Polling: ${trackId} status=${data.status} progress=${data.progress} hasFirstChunk=${!!data.first_chunk_url}`);
          lastStatus = currentStatus;
        }

        if (data.status === 'complete' && data.url) {
          const fullUrl = `${DEMUCS_SERVER}${data.url}`;

          this.trackCache.set(trackId, {
            url: fullUrl,
            isComplete: true,
            isFirstChunk: false
          });

          clearInterval(interval);
          this.pollingIntervals.delete(trackId);

          // Notify if WebSocket didn't
          const result: KaraokeProcessorResult = {
            trackId,
            instrumentalUrl: fullUrl,
            mimeType: 'audio/mpeg',
            cached: true,
            isPartial: false
          };

          for (const callback of this.onFullTrackReadyCallbacks) {
            try {
              callback(trackId, result);
            } catch (error) {
              console.error('[KaraokeService] Callback error:', error);
            }
          }
        } else if (data.first_chunk_url) {
          // First chunk ready via polling
          const cached = this.trackCache.get(trackId);
          // Only fire callback if we haven't already
          if (!cached?.firstChunkCallbackFired) {
            const firstUrl = `${DEMUCS_SERVER}${data.first_chunk_url}`;
            console.log(`[KaraokeService] First chunk detected via polling: ${trackId}`);

            this.trackCache.set(trackId, {
              url: firstUrl,
              isComplete: false,
              isFirstChunk: true,
              firstChunkCallbackFired: true
            });

            for (const callback of this.onFirstChunkReadyCallbacks) {
              try {
                callback(trackId, firstUrl);
              } catch (error) {
                console.error('[KaraokeService] FirstChunk callback error:', error);
              }
            }
          }
        } else if (data.status === 'processing' && data.progress !== undefined) {
          // Forward progress updates
          for (const callback of this.onProgressCallbacks) {
            try {
              callback(trackId, data.progress, data.stage || 'Processing...');
            } catch (error) {
              // Ignore
            }
          }
        }
      } catch (error) {
        // Log polling errors periodically instead of ignoring
        if (attempts % 10 === 0) {
          console.error(`[KaraokeService] Polling error for ${trackId}:`, error instanceof Error ? error.message : 'Unknown error');
        }
      }
    }, 500);  // Poll every 500ms instead of 1s for faster response

    this.pollingIntervals.set(trackId, interval);
  }

  /**
   * Queue tracks for predictive processing
   */
  async predictivePrefetch(tracks: Array<{ id: string; url: string }>): Promise<void> {
    if (tracks.length === 0) return;

    try {
      await fetch(`${DEMUCS_SERVER}/predict`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tracks: tracks.slice(0, 5)  // Max 5
        })
      });
      console.log(`[KaraokeService] Queued ${tracks.length} tracks for predictive processing`);
    } catch (error) {
      console.error('[KaraokeService] Predictive prefetch failed:', error);
    }
  }

  async isFullTrackReady(trackId: string): Promise<boolean> {
    const cached = this.trackCache.get(trackId);
    return cached?.isComplete || false;
  }

  async getFullTrack(trackId: string): Promise<KaraokeProcessorResult | null> {
    const cached = this.trackCache.get(trackId);
    if (cached?.isComplete) {
      return {
        trackId,
        instrumentalUrl: cached.url,
        mimeType: 'audio/mpeg',
        cached: true,
        isPartial: false
      };
    }

    // Check server
    try {
      const response = await fetch(`${DEMUCS_SERVER}/stream/status/${trackId}`);
      const data: StreamStatusResponse = await response.json();

      if (data.status === 'complete' && data.url) {
        const fullUrl = `${DEMUCS_SERVER}${data.url}`;

        this.trackCache.set(trackId, {
          url: fullUrl,
          isComplete: true,
          isFirstChunk: false
        });

        return {
          trackId,
          instrumentalUrl: fullUrl,
          mimeType: 'audio/mpeg',
          cached: true,
          isPartial: false
        };
      }
    } catch {
      // Ignore
    }

    return null;
  }

  async getProgress(trackId: string): Promise<{ progress: number; stage: string; eta?: number } | null> {
    try {
      const response = await fetch(`${DEMUCS_SERVER}/stream/status/${trackId}`);
      const data: StreamStatusResponse = await response.json();

      if (data.status === 'not_found') return null;

      let eta: number | undefined;
      if (data.stage) {
        const etaMatch = data.stage.match(/ETA:\s*(\d+)s/);
        if (etaMatch && etaMatch[1]) eta = parseInt(etaMatch[1], 10);
      }

      return {
        progress: data.progress || 0,
        stage: data.stage || '',
        eta
      };
    } catch {
      return null;
    }
  }

  getHardwareInfo(): HardwareInfo | null {
    return this.hardwareInfo;
  }

  async hasCached(trackId: string): Promise<boolean> {
    return this.trackCache.has(trackId);
  }

  async getCached(trackId: string): Promise<KaraokeProcessorResult | null> {
    const cached = this.trackCache.get(trackId);
    if (!cached) return null;

    return {
      trackId,
      instrumentalUrl: cached.url,
      mimeType: 'audio/mpeg',
      cached: true,
      isPartial: !cached.isComplete,
      isFirstChunk: cached.isFirstChunk
    };
  }

  async clearCache(trackId: string): Promise<void> {
    const interval = this.pollingIntervals.get(trackId);
    if (interval) {
      clearInterval(interval);
      this.pollingIntervals.delete(trackId);
    }
    this.trackCache.delete(trackId);
  }

  async clearAllCache(): Promise<void> {
    for (const interval of this.pollingIntervals.values()) {
      clearInterval(interval);
    }
    this.pollingIntervals.clear();
    this.trackCache.clear();

    try {
      await fetch(`${DEMUCS_SERVER}/clear-cache`, { method: 'POST' });
    } catch {
      // Ignore
    }
  }
}

export const karaokeService = new KaraokeService();
