/**
 * ML Algorithm API type definitions
 */

import type { SuccessResponse, UnifiedTrack, Timestamp } from './common.types';
import type { AudioFeatures } from './audio-features.types';

/** Track score from ML algorithm */
export interface TrackScore {
  trackId: string;
  score: number;          // 0-100
  confidence: number;     // 0-1
  reasons?: string[];
  components?: {
    preference?: number;
    recency?: number;
    variety?: number;
    discovery?: number;
    mood?: number;
    [key: string]: number | undefined;
  };
  timestamp: Timestamp;
}

/** ML training status */
export interface TrainingStatus {
  isTraining: boolean;
  progress: number;       // 0-100
  stage?: 'preparing' | 'training' | 'validating' | 'finalizing';
  startedAt?: Timestamp;
  estimatedCompletion?: Timestamp;
  lastTrainedAt?: Timestamp;
  error?: string;
}

/** ML system status */
export interface MLStatus {
  available: boolean;
  initialized: boolean;
  modelLoaded: boolean;
  trainingStatus: TrainingStatus;
  stats: {
    tracksIndexed: number;
    eventsRecorded: number;
    lastEventAt?: Timestamp;
  };
}

/** Training history entry */
export interface TrainingHistoryEntry {
  id: string;
  startedAt: Timestamp;
  completedAt?: Timestamp;
  duration: number;       // milliseconds
  status: 'completed' | 'failed' | 'cancelled';
  metrics?: {
    accuracy?: number;
    loss?: number;
    tracksProcessed: number;
    eventsProcessed: number;
  };
  error?: string;
}

/** User taste profile */
export interface TasteProfile {
  id: string;
  userId?: string;
  genres: Record<string, number>;      // genre -> affinity score
  artists: Record<string, number>;     // artist -> affinity score
  features: {
    avgEnergy: number;
    avgValence: number;
    avgDanceability: number;
    avgAcousticness: number;
    avgInstrumentalness: number;
    tempoRange: { min: number; max: number };
  };
  moods: Record<string, number>;       // mood -> affinity score
  decades: Record<string, number>;     // decade -> affinity score
  listenTimeByHour: number[];          // 24 hours
  listenTimeByDay: number[];           // 7 days
  updatedAt: Timestamp;
}

/** ML preferences */
export interface MLPreferences {
  explorationLevel: number;    // 0-1, higher = more discovery
  diversityWeight: number;     // 0-1, higher = more variety
  recentBias: number;          // 0-1, higher = prefer recent listens
  moodSensitivity: number;     // 0-1, higher = more mood-aware
}

/** Aggregated features for a track */
export interface AggregatedFeatures extends AudioFeatures {
  playCount: number;
  skipCount: number;
  completionRate: number;
  lastPlayedAt?: Timestamp;
  preferenceScore: number;
}

/** Smart queue context */
export interface QueueContext {
  currentTrackId?: string;
  recentTrackIds?: string[];
  recentArtists?: string[];
  mood?: string;
  enforceVariety?: boolean;
}

/** ML event types */
export type MLEventType =
  | 'play_start'
  | 'play_complete'
  | 'skip'
  | 'like'
  | 'dislike'
  | 'add_to_playlist'
  | 'search'
  | 'queue_add';

/** ML event for recording */
export interface MLEvent {
  type: MLEventType;
  trackId?: string;
  trackData?: Partial<UnifiedTrack>;
  position?: number;
  duration?: number;
  timestamp?: Timestamp;
  context?: Record<string, unknown>;
}

// Response types
export interface AlgoScoreResponse {
  score: TrackScore;
}

export interface AlgoScoreBatchResponse {
  scores: Record<string, TrackScore>;
}

export interface AlgoRecommendationsResponse {
  recommendations: UnifiedTrack[];
  method?: string;
}

export interface AlgoSimilarResponse {
  tracks: UnifiedTrack[];
}

export interface AlgoRadioResponse {
  tracks: UnifiedTrack[];
  seedTrackId?: string;
  seedArtistId?: string;
  seedGenre?: string;
  seedMood?: string;
}

export interface AlgoFeaturesResponse {
  features: AggregatedFeatures;
}

export interface AlgoTrainResponse extends SuccessResponse {
  result?: {
    duration: number;
    tracksProcessed: number;
    eventsProcessed: number;
  };
}

export interface AlgoTrainingStatusResponse {
  status: TrainingStatus;
  mlStatus: MLStatus;
}

export interface AlgoTrainingHistoryResponse {
  history: TrainingHistoryEntry[];
}

export interface AlgoProfileResponse {
  profile: TasteProfile;
}

export interface AlgoPreferencesResponse {
  preferences: MLPreferences;
}

export interface AlgoStatusResponse extends MLStatus {}

export interface AlgoNextQueueResponse {
  tracks: UnifiedTrack[];
}

export interface AlgoEventResponse extends SuccessResponse {}
