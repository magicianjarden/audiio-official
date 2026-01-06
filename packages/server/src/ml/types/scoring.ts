/**
 * Scoring types for track recommendation
 */

import type { Track, MoodCategory } from './track';

export interface TrackScore {
  trackId: string;

  // Final combined score (0-100)
  finalScore: number;

  // Algorithm confidence in this score (0-1)
  confidence: number;

  // Component breakdown
  components: ScoreComponents;

  // Human-readable explanation
  explanation: string[];

  // Debug info (optional)
  debug?: Record<string, unknown>;
}

export interface ScoreComponents {
  // === Core Preference Signals ===

  /** User's historical preference for this track/artist/genre */
  basePreference?: number;

  /** Neural network prediction (0-1 scaled to component range) */
  mlPrediction?: number;

  // === Audio-Based Matching ===

  /** How well audio features (BPM, key, energy) match context */
  audioMatch?: number;

  /** How well mood/emotion matches user's current context */
  moodMatch?: number;

  /** Harmonic compatibility with recent tracks (Circle of Fifths) */
  harmonicFlow?: number;

  // === Context-Based Scoring ===

  /** Time-of-day and day-of-week pattern matching */
  temporalFit?: number;

  /** Flow continuity with recent session tracks */
  sessionFlow?: number;

  /** Activity-based matching (workout, focus, relax) */
  activityMatch?: number;

  // === Discovery & Variety ===

  /** Bonus for exploring new artists/genres */
  explorationBonus?: number;

  /** Pleasant surprise factor - unexpected but fitting */
  serendipityScore?: number;

  /** Contribution to queue variety */
  diversityScore?: number;

  /** Boost for familiar tracks (played before but not too recently) */
  familiarityBoost?: number;

  // === Penalties ===

  /** Penalty for recently played tracks */
  recentPlayPenalty?: number;

  /** Penalty for similarity to disliked tracks */
  dislikePenalty?: number;

  /** Penalty for artist/genre over-repetition */
  repetitionPenalty?: number;

  /** Penalty for fatigue (too much of similar sound) */
  fatiguePenalty?: number;

  // === Sequential/Session Components ===

  /** How well track fits the session trajectory in embedding space */
  trajectoryFit?: number;

  /** DJ-style BPM flow (smooth tempo transitions) */
  tempoFlow?: number;

  /** Genre transition naturalness (rock→metal vs rock→classical) */
  genreTransition?: number;

  /** Energy trend continuation (if building up, continue building) */
  energyTrend?: number;

  // === Custom Components ===

  /** Algorithm-specific custom scoring components */
  custom?: Record<string, number>;
}

export interface ScoringContext {
  // === Session State ===

  /** Tracks played in current session */
  sessionTracks: Track[];

  /** Currently playing track (if any) */
  currentTrack?: Track;

  /** Tracks already queued */
  queuedTracks: Track[];

  /** Artists played in session (for diversity) */
  sessionArtists: string[];

  /** Genres played in session (for diversity) */
  sessionGenres: string[];

  // === Time Context ===

  timestamp: Date;
  dayOfWeek: number; // 0 = Sunday
  hourOfDay: number; // 0-23
  isWeekend: boolean;

  // === User Preferences ===

  /** Discovery vs familiar balance */
  mode: ScoringMode;

  /** User's current mood (if specified) */
  userMood?: MoodCategory;

  /** User's current activity (if specified) */
  activity?: ActivityType;

  /** Energy level preference for this session */
  energyPreference?: 'low' | 'medium' | 'high' | 'auto';

  // === Queue Context ===

  /** How the queue is being populated */
  queueMode: QueueMode;

  /** Radio seed info (if in radio mode) */
  radioSeed?: RadioSeed;

  // === Feature Flags ===

  /** Whether to include exploration bonus */
  enableExploration?: boolean;

  /** Whether to enforce diversity */
  enforceDiversity?: boolean;

  /** Max same artist in queue */
  maxSameArtist?: number;
}

export type ScoringMode = 'discovery' | 'familiar' | 'balanced';

export type ActivityType =
  | 'working' | 'studying' | 'relaxing' | 'exercising'
  | 'commuting' | 'sleeping' | 'party' | 'dining';

export type QueueMode = 'manual' | 'auto' | 'radio';

export interface RadioSeed {
  type: 'track' | 'artist' | 'genre' | 'mood' | 'playlist';
  id: string;
  /** Display name (optional, can be derived from id) */
  name?: string;

  /** Current drift from original seed (0-1) */
  drift?: number;

  /** Target audio features for radio */
  targetFeatures?: Partial<import('./track').AudioFeatures>;
}

export interface ScoringWeights {
  // Component weights (should sum to ~1.0 for interpretability)
  basePreference: number;
  mlPrediction: number;
  audioMatch: number;
  moodMatch: number;
  harmonicFlow: number;
  temporalFit: number;
  sessionFlow: number;
  activityMatch: number;
  explorationBonus: number;
  serendipityScore: number;
  diversityScore: number;
  familiarityBoost: number;

  // Sequential/session flow weights
  trajectoryFit: number;
  tempoFlow: number;
  genreTransition: number;
  energyTrend: number;

  // Penalty multipliers
  recentPlayPenalty: number;
  dislikePenalty: number;
  repetitionPenalty: number;
  fatiguePenalty: number;
}

export const DEFAULT_SCORING_WEIGHTS: ScoringWeights = {
  basePreference: 0.20,
  mlPrediction: 0.18,
  audioMatch: 0.08,
  moodMatch: 0.06,
  harmonicFlow: 0.04,
  temporalFit: 0.05,
  sessionFlow: 0.04,
  activityMatch: 0.04,
  explorationBonus: 0.05,
  serendipityScore: 0.05,
  diversityScore: 0.05,
  familiarityBoost: 0.04, // Modest weight for rediscovering favorites

  // Sequential scoring (DJ-style flow)
  trajectoryFit: 0.06,
  tempoFlow: 0.04,
  genreTransition: 0.04,
  energyTrend: 0.02,

  recentPlayPenalty: 1.0,
  dislikePenalty: 1.5,
  repetitionPenalty: 1.0,
  fatiguePenalty: 0.8,
};

export interface ScoreExplanation {
  trackId: string;
  score: TrackScore;

  /** Natural language explanation */
  summary: string;

  /** Detailed breakdown - inline type replaces removed ScoreExplanationDetail */
  details: Array<{
    component: keyof ScoreComponents;
    label: string;
    value: number;
    impact: 'positive' | 'negative' | 'neutral';
    reason: string;
  }>;

  /** Comparison to average */
  comparison: {
    vsSessionAverage: number;
    vsHistoricalAverage: number;
  };
}

// Note: ScoreExplanationDetail was removed as unused dead code
// The ScoreExplanation.details field can use a simple inline type if needed
