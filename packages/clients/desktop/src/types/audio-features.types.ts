/**
 * Audio Features API type definitions
 */

import type { SuccessResponse, UnifiedTrack, Timestamp } from './common.types';

/** Musical key (0-11 representing C through B) */
export type MusicalKey = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11;

/** Musical mode */
export type MusicalMode = 'major' | 'minor';

/** Full audio features for a track */
export interface AudioFeatures {
  trackId: string;
  energy: number;           // 0-1
  tempo: number;            // BPM
  valence: number;          // 0-1 (happiness/positivity)
  danceability: number;     // 0-1
  acousticness: number;     // 0-1
  instrumentalness: number; // 0-1
  speechiness: number;      // 0-1
  liveness: number;         // 0-1
  loudness: number;         // dB (typically -60 to 0)
  key: MusicalKey;
  mode: 0 | 1;              // 0 = minor, 1 = major
  timeSignature: number;    // beats per measure
  analyzedAt: Timestamp;
  confidence?: number;      // 0-1, analysis confidence
  source?: string;          // Analysis provider
}

/** Range for feature queries */
export interface FeatureRange {
  min?: number;
  max?: number;
}

/** Audio feature query parameters */
export interface AudioFeatureQuery {
  energyMin?: number;
  energyMax?: number;
  tempoMin?: number;
  tempoMax?: number;
  valenceMin?: number;
  valenceMax?: number;
  danceabilityMin?: number;
  danceabilityMax?: number;
  acousticnessMin?: number;
  acousticnessMax?: number;
  instrumentalnessMin?: number;
  instrumentalnessMax?: number;
  speechinessMin?: number;
  speechinessMax?: number;
  key?: MusicalKey;
  mode?: MusicalMode;
  limit?: number;
  offset?: number;
}

/** Mood type name */
export type MoodType =
  | 'energetic' | 'upbeat' | 'party' | 'workout' | 'hype' | 'intense'
  | 'chill' | 'calm' | 'relaxing' | 'sleep' | 'mellow' | 'peaceful'
  | 'happy' | 'sad' | 'melancholy' | 'angry' | 'dark' | 'bright' | 'aggressive'
  | 'acoustic' | 'electronic' | 'instrumental' | 'vocal'
  | 'danceable' | 'groovy' | 'focus';

/** Feature distribution for visualization */
export interface FeatureDistribution {
  feature: string;
  histogram: number[];
  min: number;
  max: number;
  mean: number;
  median: number;
  stdDev: number;
}

/** Mood cluster for grouping */
export interface MoodCluster {
  mood: string;
  trackCount: number;
  avgEnergy: number;
  avgValence: number;
  tracks?: UnifiedTrack[];
}

// Response types
export interface AudioFeaturesGetResponse extends AudioFeatures {}

export interface AudioFeaturesQueryResponse {
  tracks: UnifiedTrack[];
  total: number;
}

export interface AudioFeaturesSimilarResponse {
  tracks: UnifiedTrack[];
}

export interface AudioFeaturesDistributionsResponse {
  distributions: Record<string, FeatureDistribution>;
}

export interface AudioFeaturesMoodsResponse {
  moods: MoodType[];
}

export interface AudioFeaturesMoodClustersResponse {
  clusters: MoodCluster[];
}

export interface AudioFeaturesTrackMoodResponse {
  trackId: string;
  mood: MoodType;
  confidence: number;
}

export interface AudioFeaturesStatsResponse {
  analyzedCount: number;
  totalTracks: number;
  unanalyzedSample: UnifiedTrack[];
}

export interface AudioFeaturesSaveResponse extends SuccessResponse {}

export interface AudioFeaturesSearchResponse {
  trackIds: string[];
}
