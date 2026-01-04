/**
 * ML Service - Comprehensive ML orchestration for Audiio Server
 *
 * Provides:
 * - Track scoring and recommendations
 * - Radio generation
 * - Embeddings and similarity search
 * - User profile and preferences
 * - Training triggered by tracking events
 * - Smart queue generation
 */

import * as path from 'path';
import { paths } from '../paths';
import { TrackingService, TrackingEvent, TrackingEventType } from './tracking-service';
import type {
  Track,
  TrackScore,
  ScoringContext,
  UserEvent,
  TrainingResult,
  TrainingStatus,
  AggregatedFeatures,
  AudioFeatures,
  RadioSeed,
  ListenEvent,
  SkipEvent,
  LikeEvent,
  DislikeEvent,
  ListenContext,
} from '../ml';
import type { MLEngine } from '../ml';
import type { NodeStorage } from '../ml/storage/node-storage';

// UnifiedTrack type - matches the structure used in the library
interface UnifiedTrack {
  id: string;
  title: string;
  artists?: Array<{ id?: string; name: string }>;
  album?: { id?: string; title: string };
  duration: number;
  genres?: string[];
  releaseDate?: string;
  explicit?: boolean;
  artwork?: { small?: string; medium?: string; large?: string };
}

// ========================================
// Types
// ========================================

export interface MLServiceConfig {
  storagePath?: string;
  enableAutoTraining?: boolean;
  trainingThresholds?: {
    eventCount: number;  // Train after N events
    hours: number;       // Or train every N hours
  };
}

export interface LibraryDataProvider {
  getAllTracks(): UnifiedTrack[];
  getTrack(trackId: string): UnifiedTrack | null;
  getLikedTracks(): UnifiedTrack[];
  getDislikedTrackIds(): string[];
}

export interface UserProfile {
  artistPreferences: Record<string, number>;   // artist -> affinity (-100 to 100)
  genrePreferences: Record<string, number>;    // genre -> affinity
  temporalPatterns: {
    hourlyEnergy: number[];                    // 24 values
    hourlyGenres: Record<number, string[]>;    // hour -> top genres
  };
  explorationLevel: number;                    // 0-1
  diversityWeight: number;                     // 0-1
  recentArtists: string[];
  recentGenres: string[];
  topArtists: string[];
  topGenres: string[];
  totalListenTime: number;
  trackCount: number;
  updatedAt: number;
}

export interface RecommendationOptions {
  count?: number;
  mode?: 'discovery' | 'familiar' | 'balanced';
  seedTrackId?: string;
  seedArtistId?: string;
  seedGenre?: string;
  excludeIds?: string[];
  maxSameArtist?: number;
}

export interface TrainingHistoryEntry {
  timestamp: number;
  samplesUsed?: number;
  accuracy?: number;
  loss?: number;
  modelVersion?: number;
  metrics: {
    accuracy?: number;
    loss?: number;
    samplesUsed?: number;
  };
}

export interface QueueContext {
  currentTrackId?: string;
  recentTrackIds: string[];
  recentArtists: string[];
  mood?: string;
  energy?: 'low' | 'medium' | 'high';
  enforceVariety?: boolean;
}

export interface TrainingTrigger {
  type: 'event_threshold' | 'time_threshold' | 'manual';
  eventCount?: number;
  lastTrainingTime?: number;
}

// ========================================
// Helpers
// ========================================

/**
 * Convert UnifiedTrack (from core) to ML SDK Track format
 */
function convertToMLTrack(unifiedTrack: UnifiedTrack): Track {
  let releaseYear: number | undefined;
  if (unifiedTrack.releaseDate) {
    const year = parseInt(unifiedTrack.releaseDate.substring(0, 4), 10);
    if (!isNaN(year)) releaseYear = year;
  }

  return {
    id: unifiedTrack.id,
    title: unifiedTrack.title,
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
 * Convert TrackingEvent to ML UserEvent
 */
function convertToUserEvent(event: TrackingEvent): UserEvent | null {
  if (!event.trackData) return null;

  const now = new Date();
  const track: Track = {
    id: event.trackId || event.trackData.id,
    title: event.trackData.title || '',
    artist: event.trackData.artist || 'Unknown',
    artistId: event.trackData.artistId,
    genre: event.trackData.genres?.[0],
    duration: event.trackData.duration || event.duration || 0,
  };

  const listenContext: ListenContext = {
    hourOfDay: now.getHours(),
    dayOfWeek: now.getDay(),
    isWeekend: now.getDay() === 0 || now.getDay() === 6,
    device: 'desktop',
  };

  switch (event.type) {
    case 'play_complete':
      return {
        type: 'listen',
        track,
        timestamp: event.timestamp,
        duration: event.duration || track.duration,
        completion: (event.percentage ?? 100) / 100,
        completed: (event.percentage ?? 100) >= 80,
        source: { type: event.source as any || 'queue' },
        context: listenContext,
      } as ListenEvent;
    case 'skip':
      return {
        type: 'skip',
        track,
        timestamp: event.timestamp,
        skipPosition: (event.percentage ?? 0) / 100 * track.duration,
        skipPercentage: (event.percentage ?? 0) / 100,
        earlySkip: (event.percentage ?? 0) < 30,
        context: listenContext,
      } as SkipEvent;
    case 'like':
      return {
        type: 'like',
        track,
        timestamp: event.timestamp,
        strength: 1,
      } as LikeEvent;
    case 'dislike':
      return {
        type: 'dislike',
        track,
        timestamp: event.timestamp,
        reason: ((event.metadata as any)?.reasons?.[0] || 'not_my_taste') as any,
      } as DislikeEvent;
    default:
      return null;
  }
}

// ========================================
// ML Service
// ========================================

class MLService {
  private engine: MLEngine | null = null;
  private storage: NodeStorage | null = null;
  private libraryProvider: LibraryDataProvider | null = null;
  private trackingService: TrackingService | null = null;
  private initialized = false;
  private initializing = false;

  // Training management
  private lastTrainingTime = 0;
  private eventsSinceLastTraining = 0;
  private trainingThresholds = {
    eventCount: 100,     // Train after 100 relevant events
    hours: 24,           // Or train every 24 hours
  };
  private trainingInProgress = false;
  private relevantEventTypes: TrackingEventType[] = [
    'play_start', 'play_complete', 'skip', 'like', 'dislike', 'queue_add'
  ];

  // User profile cache
  private userProfileCache: UserProfile | null = null;
  private profileCacheExpiry = 0;

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

      // Configure thresholds
      if (config.trainingThresholds) {
        this.trainingThresholds = config.trainingThresholds;
      }

      // Dynamic import to avoid bundling issues
      const { getMLEngine } = await import('../ml');
      const { NodeStorage: NodeStorageClass } = await import('../ml/storage/node-storage');

      // Create storage adapter
      const storagePath = config.storagePath || path.join(paths.data, 'ml-data');
      this.storage = new NodeStorageClass(storagePath);

      // Get or create engine
      this.engine = getMLEngine({
        autoInitialize: false,
        enableAutoTraining: false,  // We handle training via tracking events
      });

      // Initialize the engine
      await this.engine.initialize();

      // Load last training time
      try {
        const trainingState = await this.storage.get<{ lastTrainingTime?: number }>('training-state');
        if (trainingState) {
          this.lastTrainingTime = trainingState.lastTrainingTime || 0;
        }
      } catch {
        // No saved state
      }

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

  /**
   * Set the tracking service for training triggers
   */
  setTrackingService(trackingService: TrackingService): void {
    this.trackingService = trackingService;

    // Listen to tracking events for ML training
    trackingService.on('event', (event: TrackingEvent) => {
      this.handleTrackingEvent(event);
    });
  }

  // ============================================================================
  // Status
  // ============================================================================

  isInitialized(): boolean {
    return this.initialized;
  }

  isAlgorithmLoaded(): boolean {
    if (!this.engine) return false;
    return this.engine.hasCoreAlgorithm() || this.engine.getActiveAlgorithm() !== null;
  }

  getStatus(): {
    initialized: boolean;
    algorithmLoaded: boolean;
    lastTrainingTime: number;
    eventsSinceTraining: number;
    trainingInProgress: boolean;
    nextTrainingTrigger: 'event_threshold' | 'time_threshold' | 'none';
    eventsUntilTraining: number;
    hoursUntilTraining: number;
  } {
    const now = Date.now();
    const hoursSinceTraining = (now - this.lastTrainingTime) / (60 * 60 * 1000);
    const eventsUntilTraining = Math.max(0, this.trainingThresholds.eventCount - this.eventsSinceLastTraining);
    const hoursUntilTraining = Math.max(0, this.trainingThresholds.hours - hoursSinceTraining);

    let nextTrigger: 'event_threshold' | 'time_threshold' | 'none' = 'none';
    if (eventsUntilTraining > 0 && hoursUntilTraining > 0) {
      nextTrigger = eventsUntilTraining < hoursUntilTraining * 10 ? 'event_threshold' : 'time_threshold';
    }

    return {
      initialized: this.initialized,
      algorithmLoaded: this.isAlgorithmLoaded(),
      lastTrainingTime: this.lastTrainingTime,
      eventsSinceTraining: this.eventsSinceLastTraining,
      trainingInProgress: this.trainingInProgress,
      nextTrainingTrigger: nextTrigger,
      eventsUntilTraining,
      hoursUntilTraining,
    };
  }

  // ============================================================================
  // Scoring
  // ============================================================================

  async scoreTrack(trackId: string, context?: Partial<ScoringContext>): Promise<TrackScore | null> {
    if (!this.engine) return null;

    const unifiedTrack = this.getTrack(trackId);
    if (!unifiedTrack) return null;

    try {
      const mlTrack = convertToMLTrack(unifiedTrack);
      const fullContext = this.createScoringContext(context);
      return await this.engine.scoreTrack(mlTrack, fullContext);
    } catch (error) {
      console.error('[MLService] Score track failed:', error);
      return null;
    }
  }

  async scoreBatch(trackIds: string[], context?: Partial<ScoringContext>): Promise<TrackScore[]> {
    if (!this.engine) return [];

    const unifiedTracks = trackIds
      .map(id => this.getTrack(id))
      .filter((t): t is UnifiedTrack => t !== null);

    if (unifiedTracks.length === 0) return [];

    try {
      const mlTracks = unifiedTracks.map(convertToMLTrack);
      const fullContext = this.createScoringContext(context);
      return await this.engine.scoreBatch(mlTracks, fullContext);
    } catch (error) {
      console.error('[MLService] Score batch failed:', error);
      return [];
    }
  }

  // ============================================================================
  // Recommendations
  // ============================================================================

  async getRecommendations(options: RecommendationOptions = {}): Promise<string[]> {
    if (!this.engine) return [];

    const count = options.count || 20;
    const context = this.createScoringContext({
      mode: options.mode || 'balanced',
      enableExploration: options.mode === 'discovery',
      enforceDiversity: true,
      maxSameArtist: options.maxSameArtist || 3,
    });

    try {
      const tracks = await this.engine.getNextTracks(count, context);
      let results = tracks.map(t => t.id);

      // Apply exclusions
      if (options.excludeIds?.length) {
        const excludeSet = new Set(options.excludeIds);
        results = results.filter(id => !excludeSet.has(id));
      }

      return results;
    } catch (error) {
      console.error('[MLService] Get recommendations failed:', error);
      return [];
    }
  }

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
  // Radio Generation
  // ============================================================================

  async generateRadio(seed: RadioSeed, count: number = 50): Promise<string[]> {
    if (!this.engine) return [];

    try {
      const context = this.createScoringContext({});
      const tracks = await this.engine.generateRadio(seed, count, context);
      return tracks.map(t => t.id);
    } catch (error) {
      console.error('[MLService] Generate radio failed:', error);
      return [];
    }
  }

  async generateArtistRadio(artistId: string, count: number = 50): Promise<string[]> {
    return this.generateRadio({ type: 'artist', id: artistId }, count);
  }

  async generateTrackRadio(trackId: string, count: number = 50): Promise<string[]> {
    return this.generateRadio({ type: 'track', id: trackId }, count);
  }

  async generateGenreRadio(genre: string, count: number = 50): Promise<string[]> {
    return this.generateRadio({ type: 'genre', id: genre }, count);
  }

  async generateMoodRadio(mood: string, count: number = 50): Promise<string[]> {
    return this.generateRadio({ type: 'mood', id: mood }, count);
  }

  // ============================================================================
  // Smart Queue
  // ============================================================================

  async getNextQueueCandidates(count: number, context: QueueContext): Promise<string[]> {
    if (!this.engine) return [];

    try {
      const scoringContext = this.createScoringContext({
        currentTrack: context.currentTrackId ? convertToMLTrack(
          this.getTrack(context.currentTrackId)!
        ) : undefined,
        sessionTracks: context.recentTrackIds.map(id => {
          const track = this.getTrack(id);
          return track ? convertToMLTrack(track) : null;
        }).filter((t): t is Track => t !== null),
        sessionArtists: context.recentArtists,
        enforceDiversity: context.enforceVariety ?? true,
      });

      // Get candidates from multiple sources
      const tracks = await this.engine.getNextTracks(count * 2, scoringContext);

      // Filter out recently played
      const recentSet = new Set(context.recentTrackIds);
      const filtered = tracks.filter(t => !recentSet.has(t.id));

      return filtered.slice(0, count).map(t => t.id);
    } catch (error) {
      console.error('[MLService] Get queue candidates failed:', error);
      return [];
    }
  }

  // ============================================================================
  // Features
  // ============================================================================

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

  async extractFeatures(trackId: string): Promise<AudioFeatures | null> {
    if (!this.engine) return null;

    try {
      const endpoints = this.engine.getEndpoints();
      const features = await endpoints.features.extract(trackId);
      return features?.audio || null;
    } catch (error) {
      console.error('[MLService] Extract features failed:', error);
      return null;
    }
  }

  // ============================================================================
  // Embeddings
  // ============================================================================

  async getTrackEmbedding(trackId: string): Promise<number[] | null> {
    if (!this.engine) return null;

    try {
      const endpoints = this.engine.getEndpoints();
      return await endpoints.features.getEmbedding(trackId);
    } catch (error) {
      console.error('[MLService] Get embedding failed:', error);
      return null;
    }
  }

  async findSimilarByEmbedding(embedding: number[], count: number = 10): Promise<string[]> {
    if (!this.engine) return [];

    try {
      const endpoints = this.engine.getEndpoints();
      const similar = await endpoints.features.findSimilarByEmbedding(embedding, count);
      return similar.map(s => s.trackId);
    } catch (error) {
      console.error('[MLService] Find similar by embedding failed:', error);
      return [];
    }
  }

  // ============================================================================
  // User Profile
  // ============================================================================

  async getUserProfile(): Promise<UserProfile> {
    // Return cached if valid
    if (this.userProfileCache && Date.now() < this.profileCacheExpiry) {
      return this.userProfileCache;
    }

    if (!this.engine) {
      return this.getDefaultProfile();
    }

    try {
      const endpoints = this.engine.getEndpoints();
      const preferences = await endpoints.user.getPreferences();
      const stats = await endpoints.user.getStats();

      const profile: UserProfile = {
        artistPreferences: preferences?.artistPreferences || {},
        genrePreferences: preferences?.genrePreferences || {},
        temporalPatterns: {
          hourlyEnergy: preferences?.hourlyEnergy || new Array(24).fill(0.5),
          hourlyGenres: preferences?.hourlyGenres || {},
        },
        explorationLevel: preferences?.explorationLevel ?? 0.2,
        diversityWeight: preferences?.diversityWeight ?? 0.5,
        recentArtists: preferences?.topArtists?.slice(0, 5).map(a => a.artistId) || [],
        recentGenres: preferences?.topGenres?.slice(0, 5).map(g => g.genre) || [],
        topArtists: Object.entries(preferences?.artistPreferences || {})
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10)
          .map(([artist]) => artist),
        topGenres: Object.entries(preferences?.genrePreferences || {})
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10)
          .map(([genre]) => genre),
        totalListenTime: stats?.totalListenTime || 0,
        trackCount: stats?.uniqueTracks || 0,
        updatedAt: Date.now(),
      };

      // Cache for 5 minutes
      this.userProfileCache = profile;
      this.profileCacheExpiry = Date.now() + 5 * 60 * 1000;

      return profile;
    } catch (error) {
      console.error('[MLService] Get user profile failed:', error);
      return this.getDefaultProfile();
    }
  }

  private getDefaultProfile(): UserProfile {
    return {
      artistPreferences: {},
      genrePreferences: {},
      temporalPatterns: {
        hourlyEnergy: new Array(24).fill(0.5),
        hourlyGenres: {},
      },
      explorationLevel: 0.2,
      diversityWeight: 0.5,
      recentArtists: [],
      recentGenres: [],
      topArtists: [],
      topGenres: [],
      totalListenTime: 0,
      trackCount: 0,
      updatedAt: Date.now(),
    };
  }

  async updatePreferences(preferences: Partial<{
    explorationLevel: number;
    diversityWeight: number;
  }>): Promise<void> {
    if (!this.engine) return;

    try {
      const endpoints = this.engine.getEndpoints();
      await endpoints.user.updatePreferences(preferences);

      // Invalidate cache
      this.userProfileCache = null;
    } catch (error) {
      console.error('[MLService] Update preferences failed:', error);
    }
  }

  // ============================================================================
  // Training
  // ============================================================================

  async train(trigger?: TrainingTrigger): Promise<TrainingResult | null> {
    if (!this.engine) return null;
    if (this.trainingInProgress) {
      console.log('[MLService] Training already in progress');
      return null;
    }

    this.trainingInProgress = true;

    try {
      console.log('[MLService] Starting training...', trigger);
      const result = await this.engine.train();

      if (result) {
        this.lastTrainingTime = Date.now();
        this.eventsSinceLastTraining = 0;

        // Persist training state
        if (this.storage) {
          await this.storage.set('training-state', {
            lastTrainingTime: this.lastTrainingTime,
            lastResult: {
              success: result.success,
              metrics: result.metrics,
              timestamp: Date.now(),
            },
          });
        }

        // Invalidate profile cache
        this.userProfileCache = null;

        console.log('[MLService] Training complete:', result.metrics);
      }

      return result;
    } catch (error) {
      console.error('[MLService] Training failed:', error);
      return null;
    } finally {
      this.trainingInProgress = false;
    }
  }

  getTrainingStatus(): TrainingStatus {
    const idleStatus: TrainingStatus = {
      state: 'idle',
      progress: 0,
    };

    if (!this.engine) return idleStatus;

    const active = this.engine.getActiveAlgorithm();
    if (active) {
      return this.engine.getTrainingStatus(active.manifest.id) || idleStatus;
    }

    return this.engine.getCoreTrainingStatus() || idleStatus;
  }

  async getTrainingHistory(): Promise<{
    lastTrainingTime: number;
    totalTrainingSessions: number;
    recentSessions: { timestamp: number; metrics: any }[];
  }> {
    if (!this.storage) {
      return {
        lastTrainingTime: 0,
        totalTrainingSessions: 0,
        recentSessions: [],
      };
    }

    try {
      const state = await this.storage.get<{ lastTrainingTime?: number }>('training-state');
      const history = await this.storage.get<TrainingHistoryEntry[]>('training-history') || [];

      return {
        lastTrainingTime: state?.lastTrainingTime || 0,
        totalTrainingSessions: history.length,
        recentSessions: history.slice(-10),
      };
    } catch {
      return {
        lastTrainingTime: 0,
        totalTrainingSessions: 0,
        recentSessions: [],
      };
    }
  }

  // ============================================================================
  // Event Handling
  // ============================================================================

  private async handleTrackingEvent(event: TrackingEvent): Promise<void> {
    // Convert and record for ML
    const userEvent = convertToUserEvent(event);
    if (userEvent) {
      await this.recordEvent(userEvent);
    }

    // Check if this is a relevant event for training
    if (this.relevantEventTypes.includes(event.type)) {
      this.eventsSinceLastTraining++;

      // Check if we should trigger training
      await this.checkTrainingTriggers();
    }
  }

  private async checkTrainingTriggers(): Promise<void> {
    if (this.trainingInProgress) return;

    const now = Date.now();
    const hoursSinceTraining = (now - this.lastTrainingTime) / (60 * 60 * 1000);

    // Check event threshold
    if (this.eventsSinceLastTraining >= this.trainingThresholds.eventCount) {
      console.log('[MLService] Training triggered: event threshold reached');
      await this.train({ type: 'event_threshold', eventCount: this.eventsSinceLastTraining });
      return;
    }

    // Check time threshold
    if (hoursSinceTraining >= this.trainingThresholds.hours) {
      console.log('[MLService] Training triggered: time threshold reached');
      await this.train({ type: 'time_threshold', lastTrainingTime: this.lastTrainingTime });
      return;
    }
  }

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

  updateSettings(settings: Record<string, unknown>): void {
    if (!this.engine) return;

    const active = this.engine.getActiveAlgorithm();
    if (active?.updateSettings) {
      active.updateSettings(settings);
    }
  }

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

  private getTrack(trackId: string): UnifiedTrack | null {
    if (this.libraryProvider) {
      return this.libraryProvider.getTrack(trackId);
    }
    return null;
  }

  private createScoringContext(overrides?: Partial<ScoringContext>): ScoringContext {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const hourOfDay = now.getHours();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    return {
      sessionTracks: [],
      currentTrack: undefined,
      queuedTracks: [],
      sessionArtists: [],
      sessionGenres: [],
      timestamp: now,
      dayOfWeek,
      hourOfDay,
      isWeekend,
      mode: 'balanced',
      queueMode: 'auto',
      enableExploration: true,
      enforceDiversity: true,
      maxSameArtist: 3,
      ...overrides,
    };
  }
}

// Export singleton instance
export const mlService = new MLService();
