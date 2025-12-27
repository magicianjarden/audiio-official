/**
 * Scoring Utilities - Helpers for score calculation and combination
 */

import type { TrackScore, ScoreComponents, ScoringWeights, DEFAULT_SCORING_WEIGHTS } from '../types/scoring';
import type { Track, AudioFeatures } from '../types/track';

// ============================================================================
// Score Calculation
// ============================================================================

/**
 * Calculate weighted score from components
 */
export function calculateWeightedScore(
  components: Partial<ScoreComponents>,
  weights: ScoringWeights
): number {
  let totalScore = 0;
  let totalWeight = 0;

  // Positive components
  const positiveComponents: Array<[keyof ScoreComponents, number]> = [
    ['basePreference', weights.basePreference],
    ['mlPrediction', weights.mlPrediction],
    ['audioMatch', weights.audioMatch],
    ['moodMatch', weights.moodMatch],
    ['harmonicFlow', weights.harmonicFlow],
    ['temporalFit', weights.temporalFit],
    ['sessionFlow', weights.sessionFlow],
    ['activityMatch', weights.activityMatch],
    ['explorationBonus', weights.explorationBonus],
    ['serendipityScore', weights.serendipityScore],
    ['diversityScore', weights.diversityScore],
  ];

  for (const [key, weight] of positiveComponents) {
    const value = components[key] as number | undefined;
    if (value !== undefined && typeof weight === 'number' && weight > 0) {
      totalScore += value * weight;
      totalWeight += weight;
    }
  }

  // Normalize to 0-100 if we have weights
  let score = totalWeight > 0 ? (totalScore / totalWeight) * 100 : 50;

  // Apply penalties
  if (components.recentPlayPenalty !== undefined) {
    score -= components.recentPlayPenalty * weights.recentPlayPenalty;
  }
  if (components.dislikePenalty !== undefined) {
    score -= components.dislikePenalty * weights.dislikePenalty;
  }
  if (components.repetitionPenalty !== undefined) {
    score -= components.repetitionPenalty * weights.repetitionPenalty;
  }
  if (components.fatiguePenalty !== undefined) {
    score -= components.fatiguePenalty * weights.fatiguePenalty;
  }

  return clamp(score, 0, 100);
}

/**
 * Combine multiple scores with weights
 */
export function combineScores(
  scores: Array<{ score: number; weight: number }>
): number {
  let total = 0;
  let weightSum = 0;

  for (const { score, weight } of scores) {
    if (weight > 0) {
      total += score * weight;
      weightSum += weight;
    }
  }

  return weightSum > 0 ? total / weightSum : 50;
}

/**
 * Apply penalties to a base score
 */
export function applyPenalties(
  baseScore: number,
  penalties: Array<{ value: number; weight: number }>
): number {
  let score = baseScore;

  for (const { value, weight } of penalties) {
    score -= value * weight;
  }

  return clamp(score, 0, 100);
}

// ============================================================================
// Temporal Scoring
// ============================================================================

/**
 * Default energy curve throughout the day
 * Values represent preferred energy level (0-1) for each hour
 *
 * Pattern:
 * - Night (0-5 AM): Low energy for sleeping/late night
 * - Morning (6-11 AM): Rising energy to start the day
 * - Afternoon (12-5 PM): Peak energy during active hours
 * - Evening (6-11 PM): Declining energy for winding down
 */
export const DEFAULT_ENERGY_CURVE: number[] = [
  // 0-5 AM: Very low (sleep/late night)
  0.20, 0.15, 0.10, 0.10, 0.15, 0.25,
  // 6-11 AM: Rising (morning energy)
  0.40, 0.55, 0.65, 0.70, 0.75, 0.80,
  // 12-5 PM: Peak (afternoon active)
  0.85, 0.85, 0.80, 0.75, 0.70, 0.65,
  // 6-11 PM: Declining (evening wind down)
  0.60, 0.55, 0.50, 0.40, 0.35, 0.25,
];

/**
 * Get the expected energy level for the current time of day
 */
export function getExpectedEnergy(hour: number = new Date().getHours()): number {
  return DEFAULT_ENERGY_CURVE[hour] ?? 0.5;
}

/**
 * Get time-of-day context label
 */
export function getTimeOfDayLabel(hour: number = new Date().getHours()): string {
  if (hour >= 0 && hour < 6) return 'late-night';
  if (hour >= 6 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 18) return 'afternoon';
  if (hour >= 18 && hour < 22) return 'evening';
  return 'night';
}

/**
 * Calculate temporal fit score based on time of day patterns
 */
export function calculateTemporalFit(
  currentHour: number,
  trackEnergy: number,
  preferredEnergyByHour: number[] = DEFAULT_ENERGY_CURVE
): number {
  if (preferredEnergyByHour.length !== 24) {
    preferredEnergyByHour = DEFAULT_ENERGY_CURVE;
  }

  const preferredEnergy = preferredEnergyByHour[currentHour] ?? 0.5;
  const energyDiff = Math.abs(trackEnergy - preferredEnergy);

  // Convert difference to score (closer = higher score)
  // Use a smoother curve for better differentiation
  return Math.max(0, 1 - energyDiff * 1.2);
}

/**
 * Calculate enhanced temporal fit with time-of-day context
 */
export function calculateEnhancedTemporalFit(
  currentHour: number,
  trackEnergy: number,
  trackValence: number,
  userEnergyHistory?: number[]
): {
  score: number;
  reason: string;
  energyMatch: boolean;
  moodAppropriate: boolean;
} {
  const energyCurve = userEnergyHistory?.length === 24
    ? userEnergyHistory
    : DEFAULT_ENERGY_CURVE;

  const expectedEnergy = energyCurve[currentHour] ?? 0.5;
  const timeLabel = getTimeOfDayLabel(currentHour);

  // Calculate energy match
  const energyDiff = Math.abs(trackEnergy - expectedEnergy);
  const energyMatch = energyDiff < 0.25;

  // Calculate mood appropriateness based on time
  let moodAppropriate = true;
  let reason = '';

  switch (timeLabel) {
    case 'late-night':
      // Prefer calm, low-valence tracks
      moodAppropriate = trackEnergy < 0.4;
      reason = moodAppropriate ? 'Perfect for late night' : 'May be too energetic for late night';
      break;
    case 'morning':
      // Accept rising energy, prefer positive valence
      moodAppropriate = trackEnergy >= 0.3 && trackValence >= 0.4;
      reason = moodAppropriate ? 'Great morning energy' : 'Morning usually needs more upbeat music';
      break;
    case 'afternoon':
      // Peak activity, any energy works
      moodAppropriate = true;
      reason = 'Good for afternoon listening';
      break;
    case 'evening':
      // Winding down, moderate energy
      moodAppropriate = trackEnergy < 0.7;
      reason = moodAppropriate ? 'Nice for evening wind-down' : 'May be too intense for evening';
      break;
    case 'night':
      // Lower energy preferred
      moodAppropriate = trackEnergy < 0.5;
      reason = moodAppropriate ? 'Perfect night vibes' : 'Might be too energetic for night';
      break;
  }

  // Calculate final score
  const baseScore = 1 - energyDiff;
  const moodBonus = moodAppropriate ? 0.15 : -0.1;
  const score = Math.max(0, Math.min(1, baseScore + moodBonus));

  return {
    score,
    reason,
    energyMatch,
    moodAppropriate,
  };
}

/**
 * Calculate session flow score based on energy transitions
 */
export function calculateSessionFlowScore(
  currentTrackEnergy: number,
  sessionTracks: Array<{ energy: number }>,
  maxEnergyJump = 0.3
): number {
  if (sessionTracks.length === 0) return 1;

  const lastEnergy = sessionTracks[sessionTracks.length - 1].energy;
  const energyDiff = Math.abs(currentTrackEnergy - lastEnergy);

  if (energyDiff <= maxEnergyJump) {
    // Smooth transition
    return 1 - (energyDiff / maxEnergyJump) * 0.3;
  } else {
    // Jarring transition
    return Math.max(0, 0.7 - (energyDiff - maxEnergyJump));
  }
}

// ============================================================================
// Diversity Scoring
// ============================================================================

/**
 * Calculate diversity score based on variety in queue
 */
export function calculateDiversityScore(
  track: Track,
  sessionArtists: string[],
  sessionGenres: string[],
  maxSameArtist = 2,
  targetGenreVariety = 3
): number {
  let score = 1;

  // Artist diversity
  if (track.artistId) {
    const artistCount = sessionArtists.filter(a => a === track.artistId).length;
    if (artistCount >= maxSameArtist) {
      score -= 0.4;
    } else if (artistCount > 0) {
      score -= 0.1 * artistCount;
    }
  }

  // Genre diversity
  const genre = track.genre || 'other';
  const genreCount = sessionGenres.filter(g => g === genre).length;
  const uniqueGenres = new Set(sessionGenres).size;

  if (uniqueGenres < targetGenreVariety && !sessionGenres.includes(genre)) {
    // Bonus for new genre
    score += 0.2;
  } else if (genreCount > sessionGenres.length * 0.4) {
    // Penalty for over-representation
    score -= 0.2;
  }

  return clamp(score, 0, 1);
}

// ============================================================================
// Exploration Scoring
// ============================================================================

/**
 * Calculate exploration bonus using epsilon-greedy approach
 */
export function calculateExplorationBonus(
  isNewArtist: boolean,
  isNewGenre: boolean,
  artistPlayCount: number,
  genrePlayCount: number,
  epsilon = 0.15
): number {
  // Random exploration chance
  if (Math.random() < epsilon) {
    return 0.5; // Random boost
  }

  let bonus = 0;

  // New artist bonus (decays with play count)
  if (isNewArtist) {
    bonus += 0.3;
  } else {
    const artistDecay = Math.pow(0.9, artistPlayCount);
    bonus += 0.15 * artistDecay;
  }

  // New genre bonus
  if (isNewGenre) {
    bonus += 0.2;
  } else {
    const genreDecay = Math.pow(0.95, genrePlayCount);
    bonus += 0.1 * genreDecay;
  }

  return clamp(bonus, 0, 1);
}

/**
 * Calculate serendipity score - unexpected but fitting recommendations
 */
export function calculateSerendipityScore(
  track: Track,
  userTopGenres: string[],
  userTopArtists: string[],
  isNewArtist: boolean
): number {
  let score = 0;

  const trackGenre = track.genre?.toLowerCase() || '';

  // Unknown artist in loved genre = serendipitous
  if (isNewArtist && userTopGenres.some(g => trackGenre.includes(g.toLowerCase()))) {
    score += 0.4;
  }

  // Genre bridge: track spans multiple genres user likes
  if (track.genres && track.genres.length > 1) {
    const matchingGenres = track.genres.filter(g =>
      userTopGenres.some(ug => g.toLowerCase().includes(ug.toLowerCase()))
    );
    if (matchingGenres.length >= 2) {
      score += 0.3;
    }
  }

  return clamp(score, 0, 1);
}

// ============================================================================
// Recency Scoring
// ============================================================================

/**
 * Calculate recent play penalty
 */
export function calculateRecentPlayPenalty(
  lastPlayedMs: number | null,
  now: number = Date.now()
): number {
  if (!lastPlayedMs) return 0;

  const hoursSincePlay = (now - lastPlayedMs) / (60 * 60 * 1000);

  if (hoursSincePlay < 1) return 30;      // Very recent
  if (hoursSincePlay < 4) return 20;      // Recent
  if (hoursSincePlay < 24) return 10;     // Today
  if (hoursSincePlay < 72) return 5;      // Last 3 days

  return 0;
}

/**
 * Calculate recency score (exponential decay)
 */
export function calculateRecencyScore(
  lastPlayedMs: number | null,
  halfLifeDays = 7
): number {
  if (!lastPlayedMs) return 0;

  const daysSincePlay = (Date.now() - lastPlayedMs) / (24 * 60 * 60 * 1000);
  return Math.exp(-daysSincePlay / halfLifeDays);
}

// ============================================================================
// Audio Feature Matching
// ============================================================================

/**
 * Calculate audio feature match score between two tracks
 */
export function calculateAudioMatchScore(
  features1: AudioFeatures | undefined,
  features2: AudioFeatures | undefined,
  weights = { bpm: 0.3, energy: 0.3, key: 0.2, valence: 0.2 }
): number {
  if (!features1 || !features2) return 0.5;

  let score = 0;
  let totalWeight = 0;

  // BPM similarity
  if (features1.bpm && features2.bpm) {
    const bpmDiff = Math.abs(features1.bpm - features2.bpm);
    const bpmScore = Math.max(0, 1 - bpmDiff / 30); // 30 BPM tolerance
    score += bpmScore * weights.bpm;
    totalWeight += weights.bpm;
  }

  // Energy similarity
  if (features1.energy !== undefined && features2.energy !== undefined) {
    const energyDiff = Math.abs(features1.energy - features2.energy);
    const energyScore = 1 - energyDiff;
    score += energyScore * weights.energy;
    totalWeight += weights.energy;
  }

  // Key compatibility
  if (features1.key && features2.key && features1.mode && features2.mode) {
    const { getHarmonicCompatibility } = require('./feature-utils');
    const keyScore = getHarmonicCompatibility(
      features1.key,
      features1.mode,
      features2.key,
      features2.mode
    );
    score += keyScore * weights.key;
    totalWeight += weights.key;
  }

  // Valence similarity
  if (features1.valence !== undefined && features2.valence !== undefined) {
    const valenceDiff = Math.abs(features1.valence - features2.valence);
    const valenceScore = 1 - valenceDiff;
    score += valenceScore * weights.valence;
    totalWeight += weights.valence;
  }

  return totalWeight > 0 ? score / totalWeight : 0.5;
}

// ============================================================================
// Explanation Generation
// ============================================================================

/**
 * Generate explanation strings from score components
 */
export function generateExplanation(
  components: Partial<ScoreComponents>,
  thresholds = { high: 0.7, low: 0.3 }
): string[] {
  const explanations: string[] = [];

  if ((components.basePreference ?? 0) > thresholds.high * 100) {
    explanations.push('Matches your taste');
  }

  if ((components.mlPrediction ?? 0) > thresholds.high) {
    explanations.push('Predicted to be a good fit');
  }

  if ((components.temporalFit ?? 0) > thresholds.high) {
    explanations.push('Perfect for this time of day');
  }

  if ((components.sessionFlow ?? 0) > thresholds.high) {
    explanations.push('Flows well with recent tracks');
  }

  if ((components.explorationBonus ?? 0) > thresholds.high) {
    explanations.push('Something new to discover');
  }

  if ((components.serendipityScore ?? 0) > thresholds.high) {
    explanations.push('A pleasant surprise');
  }

  if ((components.diversityScore ?? 0) > thresholds.high) {
    explanations.push('Adds variety to your queue');
  }

  if ((components.moodMatch ?? 0) > thresholds.high) {
    explanations.push('Matches your current mood');
  }

  if ((components.harmonicFlow ?? 0) > thresholds.high) {
    explanations.push('Harmonically compatible');
  }

  // Penalties
  if ((components.recentPlayPenalty ?? 0) > 10) {
    explanations.push('Recently played');
  }

  if ((components.repetitionPenalty ?? 0) > 10) {
    explanations.push('Artist already in queue');
  }

  return explanations;
}

// ============================================================================
// Utility Functions
// ============================================================================

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Softmax function for converting scores to probabilities
 */
export function softmax(scores: number[], temperature = 1): number[] {
  const maxScore = Math.max(...scores);
  const expScores = scores.map(s => Math.exp((s - maxScore) / temperature));
  const sumExp = expScores.reduce((a, b) => a + b, 0);
  return expScores.map(e => e / sumExp);
}

/**
 * Weighted random selection based on scores
 */
export function weightedRandomSelect<T>(
  items: T[],
  scores: number[],
  count: number
): T[] {
  if (items.length <= count) return items;

  const probabilities = softmax(scores);
  const selected: T[] = [];
  const remaining = [...items];
  const remainingProbs = [...probabilities];

  for (let i = 0; i < count && remaining.length > 0; i++) {
    let rand = Math.random();
    let selectedIndex = 0;

    for (let j = 0; j < remainingProbs.length; j++) {
      rand -= remainingProbs[j];
      if (rand <= 0) {
        selectedIndex = j;
        break;
      }
    }

    selected.push(remaining[selectedIndex]);
    remaining.splice(selectedIndex, 1);

    // Renormalize probabilities
    remainingProbs.splice(selectedIndex, 1);
    const sum = remainingProbs.reduce((a, b) => a + b, 0);
    for (let j = 0; j < remainingProbs.length; j++) {
      remainingProbs[j] /= sum;
    }
  }

  return selected;
}
