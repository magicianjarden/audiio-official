/**
 * ML Core Endpoints - Public API for algorithm plugins
 */

import type { Track, AggregatedFeatures, AudioFeatures, EmotionFeatures, LyricsFeatures } from './track';
import type { TrackScore, ScoringContext } from './scoring';
import type { TrainingSample, TrainingDataset, FeatureStats } from './training';
import type { UserEvent, ListenEvent, DislikeEvent } from './events';
import type { FeatureProvider } from './providers';
import type * as tf from '@tensorflow/tfjs';

// ============================================================================
// Main Endpoints Interface
// ============================================================================

export interface MLCoreEndpoints {
  /** Feature access and registration */
  features: FeatureEndpoint;

  /** User data and preferences */
  user: UserEndpoint;

  /** Training data access */
  training: TrainingEndpoint;

  /** Queue operations */
  queue: QueueEndpoint;

  /** Score submission and retrieval */
  scoring: ScoringEndpoint;

  /** Persistent storage for algorithm state */
  storage: StorageEndpoint;

  /** Event subscription */
  events: EventEndpoint;

  /** Library access */
  library: LibraryEndpoint;
}

// ============================================================================
// Feature Endpoint
// ============================================================================

export interface FeatureEndpoint {
  /** Get aggregated features for a track */
  get(trackId: string): Promise<AggregatedFeatures>;

  /** Get features for multiple tracks */
  getBatch(trackIds: string[]): Promise<Map<string, AggregatedFeatures>>;

  /** Get specific feature type */
  getAudio(trackId: string): Promise<AudioFeatures | null>;
  getEmotion(trackId: string): Promise<EmotionFeatures | null>;
  getLyrics(trackId: string): Promise<LyricsFeatures | null>;
  getEmbedding(trackId: string): Promise<number[] | null>;

  /** Register a feature provider */
  register(provider: FeatureProvider): void;

  /** Unregister a provider */
  unregister(providerId: string): void;

  /** Get all registered providers */
  getProviders(): FeatureProvider[];

  /** Invalidate cached features */
  invalidateCache(trackId?: string): void;

  /** Prefetch features for tracks */
  prefetch(trackIds: string[]): Promise<void>;
}

// ============================================================================
// User Endpoint
// ============================================================================

export interface UserEndpoint {
  /** Get user preferences summary */
  getPreferences(): Promise<UserPreferences>;

  /** Get listen history */
  getListenHistory(options?: HistoryOptions): Promise<ListenEvent[]>;

  /** Get disliked tracks */
  getDislikedTracks(): Promise<DislikedTrackInfo[]>;

  /** Get artist affinity (-1 to 1) */
  getArtistAffinity(artistId: string): Promise<number>;

  /** Get genre affinity (-1 to 1) */
  getGenreAffinity(genre: string): Promise<number>;

  /** Get all artist affinities */
  getAllArtistAffinities(): Promise<Map<string, number>>;

  /** Get all genre affinities */
  getAllGenreAffinities(): Promise<Map<string, number>>;

  /** Get temporal listening patterns */
  getTemporalPatterns(): Promise<TemporalPatterns>;

  /** Get session statistics */
  getSessionStats(): Promise<SessionStats>;

  /** Check if track was recently played */
  wasRecentlyPlayed(trackId: string, withinMs?: number): Promise<boolean>;

  /** Get recent play timestamp for track */
  getLastPlayed(trackId: string): Promise<number | null>;
}

export interface UserPreferences {
  /** Top genres by affinity */
  topGenres: Array<{ genre: string; affinity: number }>;

  /** Top artists by affinity */
  topArtists: Array<{ artistId: string; name: string; affinity: number }>;

  /** Preferred energy level by time of day */
  energyByHour: number[];

  /** Preferred track duration range */
  durationPreference: { min: number; max: number; mean: number };

  /** Discovery vs familiar balance (0-1, 0 = all familiar) */
  discoveryBalance: number;

  /** Total listen count */
  totalListens: number;

  /** Unique artists listened */
  uniqueArtists: number;

  /** Account age in days */
  accountAgeDays: number;
}

export interface HistoryOptions {
  /** Maximum number of events */
  limit?: number;

  /** Only events after this timestamp */
  since?: number;

  /** Only events before this timestamp */
  until?: number;

  /** Only completed listens */
  completedOnly?: boolean;

  /** Filter by track IDs */
  trackIds?: string[];

  /** Filter by artist IDs */
  artistIds?: string[];
}

export interface DislikedTrackInfo {
  trackId: string;
  track: Track;
  reason: string;
  timestamp: number;
  artistId?: string;
}

export interface TemporalPatterns {
  /** Listening frequency by hour (0-23) */
  hourlyFrequency: number[];

  /** Listening frequency by day (0-6, 0 = Sunday) */
  dailyFrequency: number[];

  /** Preferred genres by hour */
  genresByHour: Map<number, string[]>;

  /** Preferred energy by hour */
  energyByHour: number[];

  /** Weekend vs weekday patterns */
  weekendPreferences: {
    genres: string[];
    energyLevel: number;
    discoveryRate: number;
  };

  weekdayPreferences: {
    genres: string[];
    energyLevel: number;
    discoveryRate: number;
  };
}

export interface SessionStats {
  /** Current session ID */
  sessionId: string;

  /** Session start time */
  startTime: number;

  /** Tracks played this session */
  tracksPlayed: number;

  /** Unique artists this session */
  uniqueArtists: number;

  /** Genres played this session */
  genresPlayed: string[];

  /** Average energy this session */
  averageEnergy: number;

  /** Skip rate this session */
  skipRate: number;
}

// ============================================================================
// Training Endpoint
// ============================================================================

export interface TrainingEndpoint {
  /** Get positive training samples */
  getPositiveSamples(limit?: number): Promise<TrainingSample[]>;

  /** Get negative training samples */
  getNegativeSamples(limit?: number): Promise<TrainingSample[]>;

  /** Get full training dataset */
  getFullDataset(options?: DatasetOptions): Promise<TrainingDataset>;

  /** Get feature statistics for normalization */
  getFeatureStats(): Promise<FeatureStats>;

  /** Subscribe to new training data */
  onNewData(callback: (sample: TrainingSample) => void): () => void;

  /** Get count of events since last training */
  getNewEventCount(): Promise<number>;

  /** Mark training as complete */
  markTrainingComplete(modelVersion: number): Promise<void>;

  /** Get last training info */
  getLastTrainingInfo(): Promise<LastTrainingInfo | null>;
}

export interface DatasetOptions {
  /** Maximum samples */
  maxSamples?: number;

  /** Time range */
  since?: number;
  until?: number;

  /** Minimum completion for partial samples */
  minCompletion?: number;

  /** Whether to balance classes */
  balanceClasses?: boolean;

  /** Whether to include context features */
  includeContext?: boolean;
}

export interface LastTrainingInfo {
  timestamp: number;
  modelVersion: number;
  samplesUsed: number;
  accuracy: number;
  loss: number;
}

// ============================================================================
// Queue Endpoint
// ============================================================================

export interface QueueEndpoint {
  /** Get candidate tracks for queue */
  getCandidates(context: QueueCandidateContext): Promise<Track[]>;

  /** Submit ranked tracks for queue */
  submitRanking(tracks: Array<{ track: Track; score: TrackScore }>): void;

  /** Get current queue */
  getCurrentQueue(): Track[];

  /** Get session history (recently played) */
  getSessionHistory(): Track[];

  /** Get queue configuration */
  getConfig(): QueueConfig;

  /** Check if track is in queue */
  isInQueue(trackId: string): boolean;

  /** Check if track was played in session */
  wasPlayedInSession(trackId: string): boolean;
}

export interface QueueCandidateContext {
  /** How many candidates to return */
  count: number;

  /** Source preferences */
  sources: CandidateSource[];

  /** Exclude these track IDs */
  exclude?: string[];

  /** Radio seed if in radio mode */
  radioSeed?: import('./scoring').RadioSeed;

  /** Current scoring context */
  scoringContext: ScoringContext;
}

export type CandidateSource =
  | 'library'          // User's local library
  | 'liked'            // Liked tracks
  | 'playlists'        // Tracks from playlists
  | 'similar'          // Similar to current/seed
  | 'discovery'        // API recommendations
  | 'trending'         // Trending tracks
  | 'recent'           // Recently played
  | 'radio';           // Radio-specific

export interface QueueConfig {
  /** Queue mode */
  mode: 'manual' | 'auto' | 'radio';

  /** Auto-replenish threshold */
  replenishThreshold: number;

  /** Number of tracks to add when replenishing */
  replenishCount: number;

  /** Maximum same artist in queue */
  maxSameArtist: number;

  /** Whether to allow explicit content */
  allowExplicit: boolean;
}

// ============================================================================
// Scoring Endpoint
// ============================================================================

export interface ScoringEndpoint {
  /** Submit a score for a track */
  submitScore(trackId: string, score: TrackScore, algorithmId: string): void;

  /** Submit multiple scores */
  submitBatchScores(
    scores: Map<string, TrackScore>,
    algorithmId: string
  ): void;

  /** Get scores from other algorithms */
  getOtherAlgorithmScores(trackId: string): Promise<AlgorithmScoreEntry[]>;

  /** Get combined/final score for a track */
  getFinalScore(trackId: string): Promise<TrackScore | null>;

  /** Get scoring statistics */
  getStats(): Promise<ScoringStats>;
}

export interface AlgorithmScoreEntry {
  algorithmId: string;
  score: TrackScore;
  timestamp: number;
}

export interface ScoringStats {
  /** Total scores computed */
  totalScores: number;

  /** Average scoring time in ms */
  avgScoringTime: number;

  /** Score distribution */
  distribution: {
    low: number;    // 0-33
    medium: number; // 34-66
    high: number;   // 67-100
  };

  /** Cache hit rate */
  cacheHitRate: number;
}

// ============================================================================
// Storage Endpoint
// ============================================================================

export interface StorageEndpoint {
  /** Get a value from storage */
  get<T>(key: string): Promise<T | null>;

  /** Set a value in storage */
  set<T>(key: string, value: T): Promise<void>;

  /** Delete a value from storage */
  delete(key: string): Promise<void>;

  /** Check if key exists */
  has(key: string): Promise<boolean>;

  /** Get all keys with prefix */
  keys(prefix?: string): Promise<string[]>;

  /** Clear all storage for this algorithm */
  clear(): Promise<void>;

  /** Get storage for TensorFlow.js models */
  getModelStorage(): ModelStorage;
}

export interface ModelStorage {
  /** Save a TensorFlow.js model */
  save(key: string, model: tf.LayersModel): Promise<void>;

  /** Load a TensorFlow.js model */
  load(key: string): Promise<tf.LayersModel | null>;

  /** Delete a model */
  delete(key: string): Promise<void>;

  /** Check if model exists */
  exists(key: string): Promise<boolean>;

  /** Get model URL for tf.loadLayersModel (e.g., 'indexeddb://model-key') */
  getModelUrl(key: string): string;
}

// ============================================================================
// Event Endpoint
// ============================================================================

export interface EventEndpoint {
  /** Subscribe to user events */
  onUserEvent(callback: (event: UserEvent) => void): () => void;

  /** Subscribe to specific event types */
  on<T extends UserEvent['type']>(
    type: T,
    callback: (event: Extract<UserEvent, { type: T }>) => void
  ): () => void;

  /** Subscribe to queue changes */
  onQueueChange(callback: (queue: Track[]) => void): () => void;

  /** Subscribe to playback changes */
  onPlaybackChange(callback: (track: Track | null, isPlaying: boolean) => void): () => void;
}

// ============================================================================
// Library Endpoint
// ============================================================================

export interface LibraryEndpoint {
  /** Get all tracks in library */
  getAllTracks(): Promise<Track[]>;

  /** Get track by ID */
  getTrack(trackId: string): Promise<Track | null>;

  /** Get tracks by artist */
  getTracksByArtist(artistId: string): Promise<Track[]>;

  /** Get tracks by genre */
  getTracksByGenre(genre: string): Promise<Track[]>;

  /** Get liked tracks */
  getLikedTracks(): Promise<Track[]>;

  /** Get playlist tracks */
  getPlaylistTracks(playlistId: string): Promise<Track[]>;

  /** Get all playlists */
  getPlaylists(): Promise<PlaylistInfo[]>;

  /** Search library */
  search(query: string, limit?: number): Promise<Track[]>;

  /** Get library statistics */
  getStats(): Promise<LibraryStats>;
}

export interface PlaylistInfo {
  id: string;
  name: string;
  trackCount: number;
  createdAt: number;
  updatedAt: number;
}

export interface LibraryStats {
  totalTracks: number;
  totalArtists: number;
  totalAlbums: number;
  totalPlaylists: number;
  totalDuration: number;
  genreDistribution: Map<string, number>;
}
