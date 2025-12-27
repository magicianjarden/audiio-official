/**
 * Event Recorder - Records and manages user events for training
 */

import type {
  UserEvent,
  ListenEvent,
  SkipEvent,
  DislikeEvent,
  LikeEvent,
  TrainingSample,
  TrainingDataset,
  DatasetMetadata,
  FeatureStats,
  FeatureVector,
  Track,
} from '@audiio/ml-sdk';
import {
  isPositiveSignal,
  isNegativeSignal,
  getEventWeight,
  DISLIKE_REASON_WEIGHTS,
} from '@audiio/ml-sdk';
import type { StorageAdapter } from '../storage/node-storage';

const STORAGE_KEY = 'audiio-ml-events';
const MAX_EVENTS = 10000;

/**
 * Calculate graduated skip weight based on skip percentage
 * Earlier skips are stronger negative signals
 *
 * @param skipPercentage - 0-1 percentage of track played before skip
 * @returns Label value 0-0.3 (0 = strong negative, 0.3 = weak negative)
 */
function getGraduatedSkipWeight(skipPercentage: number): number {
  // Immediate skip (< 10%) - strongest negative signal
  if (skipPercentage < 0.10) return 0.0;

  // Early skip (10-25%) - strong negative
  if (skipPercentage < 0.25) return 0.05;

  // Mid skip (25-50%) - moderate negative
  if (skipPercentage < 0.50) return 0.15;

  // Late skip (50-80%) - weak negative
  if (skipPercentage < 0.80) return 0.25;

  // Near completion (> 80%) - very weak negative (almost neutral)
  return 0.30;
}

export interface EventRecorderState {
  events: UserEvent[];
  lastTrainingEventCount: number;
  lastTrainingTimestamp: number;
  lastTrainingAccuracy: number;
  lastTrainingLoss: number;
  lastModelVersion: number;
}

export class EventRecorder {
  private events: UserEvent[] = [];
  private listeners: Set<(event: UserEvent) => void> = new Set();
  private lastTrainingEventCount = 0;
  private lastTrainingTimestamp = 0;
  private lastTrainingAccuracy = 0;
  private lastTrainingLoss = 0;
  private lastModelVersion = 0;
  private storage: StorageAdapter | null = null;

  /**
   * Set storage adapter (call before load)
   */
  setStorage(storage: StorageAdapter): void {
    this.storage = storage;
  }

  /**
   * Get storage adapter (falls back to localStorage if available)
   */
  private getStorage(): StorageAdapter | null {
    if (this.storage) return this.storage;
    if (typeof localStorage !== 'undefined') {
      return {
        getItem: (key) => localStorage.getItem(key),
        setItem: (key, value) => localStorage.setItem(key, value),
        removeItem: (key) => localStorage.removeItem(key),
        clear: () => localStorage.clear(),
      };
    }
    return null;
  }

  /**
   * Load events from storage
   */
  async load(): Promise<void> {
    const storage = this.getStorage();
    if (!storage) {
      console.warn('[EventRecorder] No storage available');
      return;
    }

    try {
      const stored = storage.getItem(STORAGE_KEY);
      if (stored) {
        const state: EventRecorderState = JSON.parse(stored);
        this.events = state.events || [];
        this.lastTrainingEventCount = state.lastTrainingEventCount || 0;
        this.lastTrainingTimestamp = state.lastTrainingTimestamp || 0;
        this.lastTrainingAccuracy = state.lastTrainingAccuracy || 0;
        this.lastTrainingLoss = state.lastTrainingLoss || 0;
        this.lastModelVersion = state.lastModelVersion || 0;
      }
    } catch (error) {
      console.warn('[EventRecorder] Failed to load events:', error);
    }
  }

  /**
   * Save events to storage
   */
  async save(): Promise<void> {
    const storage = this.getStorage();
    if (!storage) return;

    try {
      const state: EventRecorderState = {
        events: this.events,
        lastTrainingEventCount: this.lastTrainingEventCount,
        lastTrainingTimestamp: this.lastTrainingTimestamp,
        lastTrainingAccuracy: this.lastTrainingAccuracy,
        lastTrainingLoss: this.lastTrainingLoss,
        lastModelVersion: this.lastModelVersion,
      };
      storage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      console.warn('[EventRecorder] Failed to save events:', error);
    }
  }

  /**
   * Record a user event
   */
  async record(event: UserEvent): Promise<void> {
    this.events.push(event);

    // Trim old events if needed
    if (this.events.length > MAX_EVENTS) {
      this.events = this.events.slice(-MAX_EVENTS);
    }

    // Notify listeners
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (error) {
        console.error('[EventRecorder] Listener error:', error);
      }
    }

    // Auto-save periodically
    if (this.events.length % 10 === 0) {
      await this.save();
    }
  }

  /**
   * Get all events
   */
  getEvents(): UserEvent[] {
    return [...this.events];
  }

  /**
   * Get events of a specific type
   */
  getEventsByType<T extends UserEvent['type']>(type: T): Extract<UserEvent, { type: T }>[] {
    return this.events.filter((e): e is Extract<UserEvent, { type: T }> => e.type === type);
  }

  /**
   * Get listen events
   */
  getListenEvents(): ListenEvent[] {
    return this.getEventsByType('listen');
  }

  /**
   * Get dislike events
   */
  getDislikeEvents(): DislikeEvent[] {
    return this.getEventsByType('dislike');
  }

  /**
   * Get event count
   */
  getEventCount(): number {
    return this.events.length;
  }

  /**
   * Get new event count since last training
   */
  getNewEventCount(): number {
    return this.events.length - this.lastTrainingEventCount;
  }

  /**
   * Subscribe to new events
   */
  subscribe(callback: (event: UserEvent) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  /**
   * Get positive training samples
   */
  getPositiveSamples(limit?: number): TrainingSample[] {
    const positiveEvents = this.events.filter(isPositiveSignal);
    const samples = positiveEvents.map(event => this.eventToSample(event, 1.0));
    return limit ? samples.slice(-limit) : samples;
  }

  /**
   * Get negative training samples
   */
  getNegativeSamples(limit?: number): TrainingSample[] {
    const negativeEvents = this.events.filter(isNegativeSignal);
    const samples = negativeEvents.map(event => {
      let label = 0.0;
      if (event.type === 'dislike') {
        label = 1 - DISLIKE_REASON_WEIGHTS[event.reason];
      }
      return this.eventToSample(event, label);
    });
    return limit ? samples.slice(-limit) : samples;
  }

  /**
   * Get full training dataset
   */
  getFullDataset(options?: {
    maxSamples?: number;
    since?: number;
    until?: number;
    minCompletion?: number;
    balanceClasses?: boolean;
  }): TrainingDataset {
    const {
      maxSamples = 10000,
      since,
      until,
      minCompletion = 0.1,
      balanceClasses = true,
    } = options || {};

    let filteredEvents = this.events;

    // Apply time filters
    if (since !== undefined) {
      filteredEvents = filteredEvents.filter(e => e.timestamp >= since);
    }
    if (until !== undefined) {
      filteredEvents = filteredEvents.filter(e => e.timestamp <= until);
    }

    const positive: TrainingSample[] = [];
    const negative: TrainingSample[] = [];
    const partial: TrainingSample[] = [];

    for (const event of filteredEvents) {
      if (event.type === 'listen') {
        if (event.completed) {
          positive.push(this.eventToSample(event, 1.0));
        } else if (event.completion >= minCompletion) {
          partial.push(this.eventToSample(event, event.completion));
        }
      } else if (event.type === 'skip') {
        // Use graduated skip weight based on how far into the track the skip occurred
        const label = getGraduatedSkipWeight(event.skipPercentage);
        negative.push(this.eventToSample(event, label));
      } else if (event.type === 'dislike') {
        const label = 0.2 * (1 - DISLIKE_REASON_WEIGHTS[event.reason]);
        negative.push(this.eventToSample(event, label));
      } else if (event.type === 'like') {
        positive.push(this.eventToSample(event, event.strength === 2 ? 1.0 : 0.9));
      }
    }

    // Balance classes if requested
    let finalPositive = positive;
    let finalNegative = negative;
    let finalPartial = partial;

    if (balanceClasses) {
      const minCount = Math.min(positive.length, negative.length);
      finalPositive = positive.slice(-minCount);
      finalNegative = negative.slice(-minCount);
    }

    // Apply max samples limit
    const totalSamples = finalPositive.length + finalNegative.length + finalPartial.length;
    if (totalSamples > maxSamples) {
      const ratio = maxSamples / totalSamples;
      finalPositive = finalPositive.slice(-Math.floor(finalPositive.length * ratio));
      finalNegative = finalNegative.slice(-Math.floor(finalNegative.length * ratio));
      finalPartial = finalPartial.slice(-Math.floor(finalPartial.length * ratio));
    }

    return {
      positive: finalPositive,
      negative: finalNegative,
      partial: finalPartial,
      metadata: this.calculateMetadata(finalPositive, finalNegative, finalPartial),
    };
  }

  /**
   * Get feature statistics for normalization
   */
  getFeatureStats(): FeatureStats {
    // Calculate statistics from stored events
    // This would need actual feature data - for now return defaults
    return {
      bpm: { min: 60, max: 200, mean: 120, std: 30 },
      energy: { min: 0, max: 1, mean: 0.5, std: 0.2 },
      valence: { min: 0, max: 1, mean: 0.5, std: 0.2 },
      danceability: { min: 0, max: 1, mean: 0.5, std: 0.2 },
      duration: { min: 60, max: 600, mean: 210, std: 60 },
    };
  }

  /**
   * Mark training as complete
   */
  markTrainingComplete(modelVersion: number): void {
    this.lastTrainingEventCount = this.events.length;
    this.lastTrainingTimestamp = Date.now();
    this.lastModelVersion = modelVersion;
    this.save();
  }

  /**
   * Get last training info
   */
  getLastTrainingInfo(): {
    timestamp: number;
    samplesUsed: number;
    modelVersion: number;
    accuracy: number;
    loss: number;
  } | null {
    if (this.lastTrainingTimestamp === 0) return null;
    return {
      timestamp: this.lastTrainingTimestamp,
      samplesUsed: this.lastTrainingEventCount,
      modelVersion: this.lastModelVersion,
      accuracy: this.lastTrainingAccuracy,
      loss: this.lastTrainingLoss,
    };
  }

  /**
   * Update training results
   */
  updateTrainingResults(accuracy: number, loss: number): void {
    this.lastTrainingAccuracy = accuracy;
    this.lastTrainingLoss = loss;
    this.save();
  }

  /**
   * Convert event to training sample
   */
  private eventToSample(event: UserEvent, label: number): TrainingSample {
    const track = this.getTrackFromEvent(event);
    const context = this.getContextFromEvent(event);

    return {
      track,
      features: this.createDefaultFeatures(), // Will be populated by feature aggregator
      label,
      weight: Math.abs(getEventWeight(event)),
      context,
      timestamp: event.timestamp,
    };
  }

  /**
   * Extract track from event
   */
  private getTrackFromEvent(event: UserEvent): Track {
    if ('track' in event) {
      return event.track;
    }
    // Return placeholder for events without track
    return {
      id: 'unknown',
      title: 'Unknown',
      artist: 'Unknown',
      duration: 0,
    };
  }

  /**
   * Extract context from event
   */
  private getContextFromEvent(event: UserEvent): import('@audiio/ml-sdk').ListenContext {
    if ('context' in event && event.context) {
      return event.context;
    }

    const now = new Date(event.timestamp);
    return {
      hourOfDay: now.getHours(),
      dayOfWeek: now.getDay(),
      isWeekend: now.getDay() === 0 || now.getDay() === 6,
    };
  }

  /**
   * Create default feature vector (placeholder)
   */
  private createDefaultFeatures(): FeatureVector {
    return {
      genreEncoding: new Array(16).fill(0),
      audio: {
        bpm: 0.5,
        energy: 0.5,
        valence: 0.5,
        danceability: 0.5,
        acousticness: 0.5,
        instrumentalness: 0.5,
        loudness: 0.5,
        duration: 0.5,
        speechiness: 0,
        liveness: 0.3,
        key: 0,
        mode: 1,
      },
      playCount: 0,
      skipRatio: 0,
      completionRatio: 0.5,
      recencyScore: 0,
      artistAffinity: 0.5,
      genreAffinity: 0.5,
      hourSin: 0,
      hourCos: 1,
      daySin: 0,
      dayCos: 1,
      isWeekend: 0,
    };
  }

  /**
   * Calculate dataset metadata
   */
  private calculateMetadata(
    positive: TrainingSample[],
    negative: TrainingSample[],
    partial: TrainingSample[]
  ): DatasetMetadata {
    const allSamples = [...positive, ...negative, ...partial];
    const trackIds = new Set(allSamples.map(s => s.track.id));
    const artistIds = new Set(allSamples.map(s => s.track.artistId).filter(Boolean));

    const timestamps = allSamples.map(s => s.timestamp);

    return {
      totalSamples: allSamples.length,
      uniqueTracks: trackIds.size,
      uniqueArtists: artistIds.size,
      timeRange: {
        start: Math.min(...timestamps),
        end: Math.max(...timestamps),
      },
      classBalance: {
        positive: positive.length,
        negative: negative.length,
        partial: partial.length,
      },
      featureStats: this.getFeatureStats(),
    };
  }

  /**
   * Clear all events
   */
  clear(): void {
    this.events = [];
    this.lastTrainingEventCount = 0;
    this.lastTrainingTimestamp = 0;
    this.save();
  }
}
