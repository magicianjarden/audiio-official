/**
 * ML Service - Orchestrates ML functionality in the Electron main process
 *
 * Bridges the MLEngine with IPC handlers and library data.
 */

import { app } from 'electron';
import * as path from 'path';
import type {
  Track,
  TrackScore,
  ScoringContext,
  UserEvent,
  TrainingResult,
  TrainingStatus,
  AggregatedFeatures,
} from '@audiio/ml-sdk';
import type { UnifiedTrack } from '@audiio/core';

export interface MLServiceConfig {
  storagePath?: string;
  enableAutoTraining?: boolean;
  algorithmId?: string;
}

export interface LibraryDataProvider {
  getAllTracks(): UnifiedTrack[];
  getTrack(trackId: string): UnifiedTrack | null;
  getLikedTracks(): UnifiedTrack[];
  getDislikedTrackIds(): string[];
}

/**
 * Convert UnifiedTrack (from core) to ML SDK Track format
 */
function convertToMLTrack(unifiedTrack: UnifiedTrack): Track {
  // Extract release year from releaseDate string
  let releaseYear: number | undefined;
  if (unifiedTrack.releaseDate) {
    const year = parseInt(unifiedTrack.releaseDate.substring(0, 4), 10);
    if (!isNaN(year)) releaseYear = year;
  }

  return {
    id: unifiedTrack.id,
    title: unifiedTrack.title,
    // Convert artists array to single artist string
    artist: unifiedTrack.artists?.[0]?.name || 'Unknown Artist',
    artistId: unifiedTrack.artists?.[0]?.id,
    album: unifiedTrack.album?.title,
    albumId: unifiedTrack.album?.id,
    duration: unifiedTrack.duration,
    genre: unifiedTrack.genres?.[0],
    genres: unifiedTrack.genres,
    releaseYear,
    explicit: unifiedTrack.explicit,
    artworkUrl: unifiedTrack.artwork?.large || unifiedTrack.artwork?.medium || unifiedTrack.artwork?.small,
  };
}

/**
 * ML Service for Electron main process
 */
class MLService {
  private engine: import('@audiio/ml-core').MLEngine | null = null;
  private storage: import('@audiio/ml-core/node').NodeStorage | null = null;
  private libraryProvider: LibraryDataProvider | null = null;
  private initialized = false;
  private initializing = false;

  /**
   * Initialize the ML service
   */
  async initialize(config: MLServiceConfig = {}): Promise<void> {
    if (this.initialized) {
      console.warn('[MLService] Already initialized');
      return;
    }

    if (this.initializing) {
      console.warn('[MLService] Initialization in progress');
      return;
    }

    this.initializing = true;

    try {
      console.log('[MLService] Initializing...');

      // Dynamic import to avoid bundling issues
      const mlCore = await import('@audiio/ml-core');
      const { getMLEngine } = mlCore;
      const { NodeStorage } = await import('@audiio/ml-core/node');

      // Create storage adapter
      const storagePath = config.storagePath || path.join(app.getPath('userData'), 'ml-data');
      this.storage = new NodeStorage(storagePath);

      // Get or create engine
      this.engine = getMLEngine({
        defaultAlgorithmId: config.algorithmId || 'audiio-algo',
        autoInitialize: false, // We'll initialize after registering algorithms
        enableAutoTraining: config.enableAutoTraining ?? true,
      });

      // Storage is configured via the engine's internal components

      // Try to load the audiio-algo algorithm
      try {
        const audiioAlgo = await import('@audiio/algo');
        const algorithm = audiioAlgo.createAudiioAlgorithm();
        await this.engine.registerAlgorithm(algorithm);
        console.log('[MLService] Audiio Algorithm registered');
      } catch (error) {
        console.warn('[MLService] Failed to load Audiio Algorithm:', error);
        console.log('[MLService] Continuing without algorithm...');
      }

      // Initialize the engine
      await this.engine.initialize();

      this.initialized = true;
      this.initializing = false;
      console.log('[MLService] Initialized successfully');
    } catch (error) {
      this.initializing = false;
      console.error('[MLService] Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Dispose the ML service
   */
  async dispose(): Promise<void> {
    if (!this.initialized) return;

    console.log('[MLService] Disposing...');

    if (this.engine) {
      await this.engine.dispose();
      this.engine = null;
    }

    if (this.storage) {
      this.storage.dispose();
      this.storage = null;
    }

    this.initialized = false;
    console.log('[MLService] Disposed');
  }

  /**
   * Set the library data provider
   */
  setLibraryProvider(provider: LibraryDataProvider): void {
    this.libraryProvider = provider;
  }

  // ============================================================================
  // Status
  // ============================================================================

  /**
   * Check if initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Check if algorithm is loaded
   */
  isAlgorithmLoaded(): boolean {
    if (!this.engine) return false;
    return this.engine.getActiveAlgorithm() !== null;
  }

  // ============================================================================
  // Scoring
  // ============================================================================

  /**
   * Score a single track
   */
  async scoreTrack(trackId: string): Promise<TrackScore | null> {
    if (!this.engine) return null;

    const unifiedTrack = this.getTrack(trackId);
    if (!unifiedTrack) return null;

    try {
      const mlTrack = convertToMLTrack(unifiedTrack);
      const context = this.createScoringContext();
      return await this.engine.scoreTrack(mlTrack, context);
    } catch (error) {
      console.error('[MLService] Score track failed:', error);
      return null;
    }
  }

  /**
   * Score multiple tracks
   */
  async scoreBatch(trackIds: string[]): Promise<TrackScore[]> {
    if (!this.engine) return [];

    const unifiedTracks = trackIds
      .map(id => this.getTrack(id))
      .filter((t): t is UnifiedTrack => t !== null);

    if (unifiedTracks.length === 0) return [];

    try {
      const mlTracks = unifiedTracks.map(convertToMLTrack);
      const context = this.createScoringContext();
      return await this.engine.scoreBatch(mlTracks, context);
    } catch (error) {
      console.error('[MLService] Score batch failed:', error);
      return [];
    }
  }

  /**
   * Get recommendations
   */
  async getRecommendations(count: number = 20): Promise<string[]> {
    if (!this.engine) return [];

    try {
      const context = this.createScoringContext();
      const tracks = await this.engine.getNextTracks(count, context);
      return tracks.map(t => t.id);
    } catch (error) {
      console.error('[MLService] Get recommendations failed:', error);
      return [];
    }
  }

  /**
   * Get similar tracks
   */
  async getSimilarTracks(trackId: string, count: number = 10): Promise<string[]> {
    if (!this.engine) return [];

    try {
      const similar = await this.engine.findSimilar(trackId, count);
      return similar.map(t => t.id);
    } catch (error) {
      console.error('[MLService] Get similar tracks failed:', error);
      return [];
    }
  }

  // ============================================================================
  // Features
  // ============================================================================

  /**
   * Get audio features for a track
   */
  async getAudioFeatures(trackId: string): Promise<AggregatedFeatures | null> {
    if (!this.engine) return null;

    try {
      const endpoints = this.engine.getEndpoints();
      return await endpoints.features.get(trackId);
    } catch (error) {
      console.error('[MLService] Get features failed:', error);
      return null;
    }
  }

  // ============================================================================
  // Training
  // ============================================================================

  /**
   * Trigger training
   */
  async train(): Promise<TrainingResult | null> {
    if (!this.engine) return null;

    try {
      return await this.engine.train();
    } catch (error) {
      console.error('[MLService] Training failed:', error);
      return null;
    }
  }

  /**
   * Get training status
   */
  getTrainingStatus(): TrainingStatus {
    const idleStatus: TrainingStatus = {
      state: 'idle',
      progress: 0,
    };

    if (!this.engine) {
      return idleStatus;
    }

    const active = this.engine.getActiveAlgorithm();
    if (!active) {
      return idleStatus;
    }

    return this.engine.getTrainingStatus(active.manifest.id) || idleStatus;
  }

  // ============================================================================
  // Events
  // ============================================================================

  /**
   * Record a user event
   */
  async recordEvent(event: UserEvent): Promise<void> {
    if (!this.engine) return;

    try {
      await this.engine.recordEvent(event);
    } catch (error) {
      console.error('[MLService] Record event failed:', error);
    }
  }

  // ============================================================================
  // Settings
  // ============================================================================

  /**
   * Update algorithm settings
   */
  updateSettings(settings: Record<string, unknown>): void {
    if (!this.engine) return;

    const active = this.engine.getActiveAlgorithm();
    if (active?.updateSettings) {
      active.updateSettings(settings);
    }
  }

  /**
   * Get algorithm settings
   */
  getSettings(): Record<string, unknown> {
    if (!this.engine) return {};

    const active = this.engine.getActiveAlgorithm();
    if (active?.getSettings) {
      return active.getSettings();
    }

    return {};
  }

  // ============================================================================
  // Helpers
  // ============================================================================

  /**
   * Get track from library
   */
  private getTrack(trackId: string): UnifiedTrack | null {
    if (this.libraryProvider) {
      return this.libraryProvider.getTrack(trackId);
    }
    return null;
  }

  /**
   * Create scoring context
   */
  private createScoringContext(): ScoringContext {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const hourOfDay = now.getHours();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    return {
      // Session state
      sessionTracks: [],
      currentTrack: undefined,
      queuedTracks: [],
      sessionArtists: [],
      sessionGenres: [],

      // Time context
      timestamp: now,
      dayOfWeek,
      hourOfDay,
      isWeekend,

      // User preferences
      mode: 'balanced',
      queueMode: 'auto',

      // Feature flags
      enableExploration: true,
      enforceDiversity: true,
      maxSameArtist: 3,
    };
  }
}

// Export singleton instance
export const mlService = new MLService();
