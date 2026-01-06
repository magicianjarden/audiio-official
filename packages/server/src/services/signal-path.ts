/**
 * Signal Path Tracing Service
 * Tracks the complete journey from track request to playback
 * Captures each step: metadata → ML → stream resolve → playback
 */

import { EventEmitter } from 'events';
import { nanoid } from 'nanoid';

export type SignalPhase = 'request' | 'metadata' | 'ml' | 'resolve' | 'stream' | 'playback' | 'error';

export interface SignalPathStep {
  stepId: string;
  timestamp: number;
  duration?: number;
  phase: SignalPhase;
  action: string;
  provider?: string;
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  success: boolean;
  error?: string;
}

export interface SignalPath {
  traceId: string;
  trackId: string;
  trackTitle: string;
  trackArtist: string;
  startTime: number;
  endTime?: number;
  totalDuration?: number;
  success: boolean;
  steps: SignalPathStep[];
  finalStreamUrl?: string;
  finalProvider?: string;
  finalQuality?: string;
}

class SignalPathService extends EventEmitter {
  private activeTraces: Map<string, SignalPath> = new Map();
  private completedTraces: SignalPath[] = [];
  private maxCompletedTraces = 100;

  /**
   * Start a new signal path trace for a track
   */
  startTrace(trackId: string, trackTitle: string, trackArtist: string): string {
    const traceId = nanoid(12);
    const trace: SignalPath = {
      traceId,
      trackId,
      trackTitle,
      trackArtist,
      startTime: Date.now(),
      success: false,
      steps: []
    };

    this.activeTraces.set(traceId, trace);
    this.emit('trace_start', trace);

    return traceId;
  }

  /**
   * Add a step to an active trace
   */
  addStep(
    traceId: string,
    step: Omit<SignalPathStep, 'stepId' | 'timestamp'>
  ): void {
    const trace = this.activeTraces.get(traceId);
    if (!trace) return;

    const lastStep = trace.steps[trace.steps.length - 1];
    const now = Date.now();

    const fullStep: SignalPathStep = {
      ...step,
      stepId: nanoid(8),
      timestamp: now,
      duration: lastStep ? now - lastStep.timestamp : 0
    };

    trace.steps.push(fullStep);
    this.emit('step', { traceId, step: fullStep });
  }

  /**
   * Complete a trace with final status
   */
  completeTrace(
    traceId: string,
    success: boolean,
    options?: {
      finalUrl?: string;
      provider?: string;
      quality?: string;
      error?: string;
    }
  ): void {
    const trace = this.activeTraces.get(traceId);
    if (!trace) return;

    trace.endTime = Date.now();
    trace.totalDuration = trace.endTime - trace.startTime;
    trace.success = success;
    trace.finalStreamUrl = options?.finalUrl;
    trace.finalProvider = options?.provider;
    trace.finalQuality = options?.quality;

    if (options?.error) {
      this.addStep(traceId, {
        phase: 'error',
        action: 'Resolution failed',
        success: false,
        error: options.error
      });
    }

    // Move to completed
    this.activeTraces.delete(traceId);
    this.completedTraces.push(trace);

    // Limit stored traces (FIFO)
    if (this.completedTraces.length > this.maxCompletedTraces) {
      this.completedTraces.shift();
    }

    this.emit('trace_complete', trace);
  }

  /**
   * Fail a trace with error
   */
  failTrace(traceId: string, error: string): void {
    this.completeTrace(traceId, false, { error });
  }

  /**
   * Get a specific trace by ID
   */
  getTrace(traceId: string): SignalPath | null {
    return this.activeTraces.get(traceId) ||
           this.completedTraces.find(t => t.traceId === traceId) ||
           null;
  }

  /**
   * Get all active (in-progress) traces
   */
  getActiveTraces(): SignalPath[] {
    return Array.from(this.activeTraces.values());
  }

  /**
   * Get completed traces
   */
  getCompletedTraces(limit: number = 50): SignalPath[] {
    return this.completedTraces.slice(-Math.min(limit, this.maxCompletedTraces));
  }

  /**
   * Get all traces (active + completed)
   */
  getAllTraces(limit: number = 50): SignalPath[] {
    const active = this.getActiveTraces();
    const completed = this.getCompletedTraces(limit - active.length);
    return [...active, ...completed];
  }

  /**
   * Clear all traces
   */
  clear(): void {
    this.activeTraces.clear();
    this.completedTraces = [];
    this.emit('clear');
  }

  /**
   * Get statistics
   */
  getStats(): {
    activeCount: number;
    completedCount: number;
    successRate: number;
    avgDuration: number;
  } {
    const successCount = this.completedTraces.filter(t => t.success).length;
    const totalDuration = this.completedTraces.reduce(
      (sum, t) => sum + (t.totalDuration || 0), 0
    );

    return {
      activeCount: this.activeTraces.size,
      completedCount: this.completedTraces.length,
      successRate: this.completedTraces.length > 0
        ? (successCount / this.completedTraces.length) * 100
        : 0,
      avgDuration: this.completedTraces.length > 0
        ? totalDuration / this.completedTraces.length
        : 0
    };
  }
}

// Singleton instance
export const signalPathService = new SignalPathService();

// Helper for creating traces with automatic cleanup
export function withTrace<T>(
  trackId: string,
  trackTitle: string,
  trackArtist: string,
  fn: (traceId: string) => Promise<T>
): Promise<T> {
  const traceId = signalPathService.startTrace(trackId, trackTitle, trackArtist);

  return fn(traceId).then(
    (result) => {
      // Success case - caller should have called completeTrace
      return result;
    },
    (error) => {
      // Error case - automatically fail the trace
      signalPathService.failTrace(traceId, error.message || String(error));
      throw error;
    }
  );
}
