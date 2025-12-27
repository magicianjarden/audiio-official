/**
 * Playback Orchestrator - Manages playback state and queue
 */

import type { UnifiedTrack, StreamInfo } from '../types/index';
import type { TrackResolver } from './track-resolver';
import { EventEmitter } from '../utils/event-emitter';

export interface PlaybackState {
  currentTrack: UnifiedTrack | null;
  queue: UnifiedTrack[];
  queueIndex: number;
  position: number;       // Current position in ms
  duration: number;       // Total duration in ms
  isPlaying: boolean;
  volume: number;         // 0-1
  isMuted: boolean;
  repeatMode: 'none' | 'one' | 'all';
  isShuffled: boolean;
}

export interface PlaybackEvents {
  play: { track: UnifiedTrack; streamInfo: StreamInfo };
  pause: undefined;
  resume: undefined;
  stop: undefined;
  seek: { position: number };
  trackChange: { track: UnifiedTrack; previous: UnifiedTrack | null };
  queueUpdate: { queue: UnifiedTrack[] };
  volumeChange: { volume: number; isMuted: boolean };
  error: { error: Error; track?: UnifiedTrack };
}

export class PlaybackOrchestrator extends EventEmitter<PlaybackEvents> {
  private state: PlaybackState = {
    currentTrack: null,
    queue: [],
    queueIndex: -1,
    position: 0,
    duration: 0,
    isPlaying: false,
    volume: 1,
    isMuted: false,
    repeatMode: 'none',
    isShuffled: false
  };

  constructor(private resolver: TrackResolver) {
    super();
  }

  /**
   * Play a specific track
   */
  async play(track: UnifiedTrack): Promise<StreamInfo> {
    // Resolve stream if not already resolved
    if (!track.streamInfo) {
      const streamInfo = await this.resolver.resolveStream(track);
      if (!streamInfo) {
        const error = new Error(`Could not resolve stream for: ${track.title}`);
        this.emit('error', { error, track });
        throw error;
      }
    }

    const previous = this.state.currentTrack;

    this.state.currentTrack = track;
    this.state.isPlaying = true;
    this.state.duration = track.duration * 1000;
    this.state.position = 0;

    // Update queue index if track is in queue
    const queueIndex = this.state.queue.findIndex(t => t.id === track.id);
    if (queueIndex !== -1) {
      this.state.queueIndex = queueIndex;
    }

    this.emit('play', { track, streamInfo: track.streamInfo! });
    this.emit('trackChange', { track, previous });

    return track.streamInfo!;
  }

  /**
   * Pause playback
   */
  pause(): void {
    this.state.isPlaying = false;
    this.emit('pause', undefined);
  }

  /**
   * Resume playback
   */
  resume(): void {
    if (this.state.currentTrack) {
      this.state.isPlaying = true;
      this.emit('resume', undefined);
    }
  }

  /**
   * Stop playback
   */
  stop(): void {
    this.state.isPlaying = false;
    this.state.position = 0;
    this.emit('stop', undefined);
  }

  /**
   * Seek to position (in ms)
   */
  seek(position: number): void {
    this.state.position = Math.max(0, Math.min(position, this.state.duration));
    this.emit('seek', { position: this.state.position });
  }

  /**
   * Skip to next track
   */
  async next(): Promise<void> {
    if (this.state.queue.length === 0) return;

    let nextIndex: number;

    if (this.state.repeatMode === 'one') {
      // Repeat current track
      nextIndex = this.state.queueIndex;
    } else if (this.state.queueIndex < this.state.queue.length - 1) {
      nextIndex = this.state.queueIndex + 1;
    } else if (this.state.repeatMode === 'all') {
      nextIndex = 0;
    } else {
      // End of queue
      this.stop();
      return;
    }

    const nextTrack = this.state.queue[nextIndex];
    if (nextTrack) {
      await this.play(nextTrack);
    }
  }

  /**
   * Skip to previous track
   */
  async previous(): Promise<void> {
    // If more than 3 seconds in, restart current track
    if (this.state.position > 3000) {
      this.seek(0);
      return;
    }

    if (this.state.queue.length === 0) return;

    const prevIndex = this.state.queueIndex > 0
      ? this.state.queueIndex - 1
      : this.state.repeatMode === 'all'
        ? this.state.queue.length - 1
        : 0;

    const prevTrack = this.state.queue[prevIndex];
    if (prevTrack) {
      await this.play(prevTrack);
    }
  }

  /**
   * Set the queue
   */
  setQueue(tracks: UnifiedTrack[], startIndex = 0): void {
    this.state.queue = [...tracks];
    this.state.queueIndex = startIndex;
    this.emit('queueUpdate', { queue: this.state.queue });
  }

  /**
   * Add track to end of queue
   */
  addToQueue(track: UnifiedTrack): void {
    this.state.queue.push(track);
    this.emit('queueUpdate', { queue: this.state.queue });
  }

  /**
   * Add track to play next
   */
  addNext(track: UnifiedTrack): void {
    const insertIndex = this.state.queueIndex + 1;
    this.state.queue.splice(insertIndex, 0, track);
    this.emit('queueUpdate', { queue: this.state.queue });
  }

  /**
   * Remove track from queue
   */
  removeFromQueue(trackId: string): void {
    const index = this.state.queue.findIndex(t => t.id === trackId);
    if (index !== -1) {
      this.state.queue.splice(index, 1);
      // Adjust queue index if needed
      if (index < this.state.queueIndex) {
        this.state.queueIndex--;
      }
      this.emit('queueUpdate', { queue: this.state.queue });
    }
  }

  /**
   * Clear the queue
   */
  clearQueue(): void {
    this.state.queue = [];
    this.state.queueIndex = -1;
    this.emit('queueUpdate', { queue: [] });
  }

  /**
   * Set volume (0-1)
   */
  setVolume(volume: number): void {
    this.state.volume = Math.max(0, Math.min(1, volume));
    this.state.isMuted = false;
    this.emit('volumeChange', {
      volume: this.state.volume,
      isMuted: this.state.isMuted
    });
  }

  /**
   * Toggle mute
   */
  toggleMute(): void {
    this.state.isMuted = !this.state.isMuted;
    this.emit('volumeChange', {
      volume: this.state.volume,
      isMuted: this.state.isMuted
    });
  }

  /**
   * Set repeat mode
   */
  setRepeatMode(mode: 'none' | 'one' | 'all'): void {
    this.state.repeatMode = mode;
  }

  /**
   * Toggle shuffle
   */
  toggleShuffle(): void {
    this.state.isShuffled = !this.state.isShuffled;
    // TODO: Implement shuffle logic
  }

  /**
   * Update current position (called by audio player)
   */
  updatePosition(position: number): void {
    this.state.position = position;
  }

  /**
   * Get current playback state
   */
  getState(): Readonly<PlaybackState> {
    return { ...this.state };
  }

  /**
   * Get current track
   */
  getCurrentTrack(): UnifiedTrack | null {
    return this.state.currentTrack;
  }

  /**
   * Get current queue
   */
  getQueue(): readonly UnifiedTrack[] {
    return this.state.queue;
  }
}
