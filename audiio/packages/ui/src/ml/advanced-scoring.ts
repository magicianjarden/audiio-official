/**
 * Advanced Scoring System
 *
 * Enhances recommendations with:
 * - Exploration vs Exploitation (epsilon-greedy / Thompson sampling)
 * - Serendipity scoring for unexpected discoveries
 * - Diversity scoring to ensure variety
 * - Plugin-provided audio features integration
 * - Session flow / mood continuity
 * - Day-of-week temporal patterns
 */

import type { UnifiedTrack } from '@audiio/core';

// ============================================
// Types
// ============================================

export interface AudioFeatures {
  bpm?: number;           // Beats per minute (60-200)
  key?: string;           // Musical key (C, C#, D, etc.)
  mode?: 'major' | 'minor';
  energy?: number;        // 0-1, intensity and activity
  danceability?: number;  // 0-1, how suitable for dancing
  acousticness?: number;  // 0-1, acoustic vs electronic
  instrumentalness?: number; // 0-1, vocal vs instrumental
  valence?: number;       // 0-1, positive vs negative mood
  loudness?: number;      // dB, typically -60 to 0
  speechiness?: number;   // 0-1, presence of spoken words
}

export interface PluginFeatureProvider {
  pluginId: string;
  priority: number;
  getAudioFeatures: (trackId: string) => Promise<AudioFeatures | null>;
  getSimilarTracks?: (trackId: string, limit: number) => Promise<string[]>;
  getArtistSimilarity?: (artistId1: string, artistId2: string) => Promise<number>;
}

export interface ScoringContext {
  hour: number;
  dayOfWeek: number;
  sessionTracks: UnifiedTrack[];      // Tracks played this session
  recentGenres: string[];             // Genres from last 5 tracks
  recentArtists: string[];            // Artists from last 5 tracks
  recentEnergy: number[];             // Energy levels from last 5 tracks
  explorationMode: 'exploit' | 'explore' | 'balanced';
  userMood?: 'energetic' | 'chill' | 'focus' | 'party' | 'sad' | 'auto';
}

export interface EnhancedScore {
  baseScore: number;          // Original algo/ML score
  explorationBonus: number;   // Bonus for exploring new music
  serendipityScore: number;   // Unexpected but fitting
  diversityScore: number;     // Variety from recent plays
  flowScore: number;          // How well it fits the session flow
  temporalScore: number;      // Time-based relevance
  pluginScore: number;        // Aggregated plugin-provided scores
  finalScore: number;         // Weighted combination
  explanation: string[];      // Why this track was scored this way
}

// ============================================
// Configuration
// ============================================

export const SCORING_CONFIG = {
  // Exploration vs Exploitation
  exploration: {
    epsilon: 0.15,            // 15% chance to explore
    explorationBoost: 25,     // Points added to novel tracks
    noveltyDecay: 0.9,        // How fast novelty wears off
  },

  // Serendipity
  serendipity: {
    enabled: true,
    maxBonus: 30,             // Max serendipity bonus
    genreJumpBonus: 15,       // Bonus for different but fitting genre
    unexpectedArtistBonus: 20, // Bonus for new artist in liked genre
  },

  // Diversity
  diversity: {
    enabled: true,
    sameArtistPenalty: -30,   // Penalty if artist played recently
    sameGenrePenalty: -10,    // Penalty if genre overrepresented
    idealGenreMix: 0.4,       // Ideal ratio of same-genre tracks
  },

  // Session Flow
  flow: {
    enabled: true,
    energyTransitionMax: 0.3, // Max energy jump between tracks
    smoothTransitionBonus: 15,
    jarringTransitionPenalty: -20,
  },

  // Temporal patterns
  temporal: {
    dayOfWeekWeight: 0.15,    // Weight for day patterns
    hourWeight: 0.25,         // Weight for hour patterns
  },

  // Weight distribution for final score
  weights: {
    base: 0.40,               // Original algo score
    exploration: 0.10,
    serendipity: 0.15,
    diversity: 0.15,
    flow: 0.10,
    temporal: 0.05,
    plugin: 0.05,
  },
};

// ============================================
// Plugin Feature Registry
// ============================================

const featureProviders: PluginFeatureProvider[] = [];
const audioFeatureCache = new Map<string, AudioFeatures>();

/**
 * Register a plugin as a feature provider
 */
export function registerFeatureProvider(provider: PluginFeatureProvider): void {
  // Remove existing provider with same ID
  const existingIndex = featureProviders.findIndex(p => p.pluginId === provider.pluginId);
  if (existingIndex >= 0) {
    featureProviders.splice(existingIndex, 1);
  }

  // Add and sort by priority
  featureProviders.push(provider);
  featureProviders.sort((a, b) => b.priority - a.priority);

  console.log(`[AdvancedScoring] Registered feature provider: ${provider.pluginId}`);
}

/**
 * Unregister a plugin feature provider
 */
export function unregisterFeatureProvider(pluginId: string): void {
  const index = featureProviders.findIndex(p => p.pluginId === pluginId);
  if (index >= 0) {
    featureProviders.splice(index, 1);
    console.log(`[AdvancedScoring] Unregistered feature provider: ${pluginId}`);
  }
}

/**
 * Get all registered feature providers (for plugin-based discovery)
 */
export function getFeatureProviders(): readonly PluginFeatureProvider[] {
  return featureProviders;
}

/**
 * Get audio features for a track from plugins
 */
export async function getAudioFeatures(trackId: string): Promise<AudioFeatures | null> {
  // Check cache first
  if (audioFeatureCache.has(trackId)) {
    return audioFeatureCache.get(trackId)!;
  }

  // Try each provider in priority order
  for (const provider of featureProviders) {
    try {
      const features = await provider.getAudioFeatures(trackId);
      if (features) {
        audioFeatureCache.set(trackId, features);
        return features;
      }
    } catch (error) {
      console.warn(`[AdvancedScoring] Provider ${provider.pluginId} failed:`, error);
    }
  }

  return null;
}

// ============================================
// Scoring Functions
// ============================================

/**
 * Calculate exploration bonus using epsilon-greedy with decay
 */
export function calculateExplorationBonus(
  track: UnifiedTrack,
  userArtistHistory: Set<string>,
  userGenreHistory: Set<string>,
  playCount: number
): number {
  const config = SCORING_CONFIG.exploration;

  // Check if this is a novel track
  const isNewArtist = !track.artists.some(a =>
    userArtistHistory.has(a.id || a.name.toLowerCase())
  );
  const isNewGenre = !track.genres?.some(g =>
    userGenreHistory.has(g.toLowerCase())
  );

  let bonus = 0;

  // New artist bonus
  if (isNewArtist) {
    bonus += config.explorationBoost * 0.6;
  }

  // New genre bonus (less than artist since genres are broader)
  if (isNewGenre) {
    bonus += config.explorationBoost * 0.4;
  }

  // Decay based on play count (more plays = less exploration bonus)
  const decayFactor = Math.pow(config.noveltyDecay, playCount);
  bonus *= decayFactor;

  // Random exploration (epsilon-greedy)
  if (Math.random() < config.epsilon) {
    bonus += config.explorationBoost * 0.5;
  }

  return bonus;
}

/**
 * Calculate serendipity score - unexpected but fitting
 */
export function calculateSerendipityScore(
  track: UnifiedTrack,
  userProfile: { genrePreferences: Record<string, number>; artistPreferences: Record<string, number> },
  recentTracks: UnifiedTrack[]
): number {
  const config = SCORING_CONFIG.serendipity;
  if (!config.enabled) return 0;

  let score = 0;
  const explanation: string[] = [];

  // Get user's top genres and artists
  const topGenres = Object.entries(userProfile.genrePreferences)
    .filter(([_, score]) => score > 20)
    .map(([genre]) => genre.toLowerCase());

  const topArtists = Object.entries(userProfile.artistPreferences)
    .filter(([_, score]) => score > 30)
    .map(([artist]) => artist.toLowerCase());

  // Check for genre jump (different genre but user might like)
  const trackGenres = track.genres?.map(g => g.toLowerCase()) || [];
  const hasTopGenre = trackGenres.some(g => topGenres.includes(g));
  const isNewGenre = !trackGenres.some(g =>
    recentTracks.slice(0, 10).some(t =>
      t.genres?.some(tg => tg.toLowerCase() === g)
    )
  );

  if (isNewGenre && hasTopGenre) {
    // Different genre but one user likes - serendipitous!
    score += config.genreJumpBonus;
  }

  // Check for unexpected artist in liked genre
  const trackArtists = track.artists.map(a => a.name.toLowerCase());
  const isKnownArtist = trackArtists.some(a => topArtists.includes(a));

  if (!isKnownArtist && hasTopGenre) {
    // New artist but in a genre user loves
    score += config.unexpectedArtistBonus;
  }

  // Bonus for tracks that bridge genres
  if (trackGenres.length >= 2) {
    const bridgesGenres = trackGenres.filter(g => topGenres.includes(g)).length >= 1 &&
                         trackGenres.filter(g => !topGenres.includes(g)).length >= 1;
    if (bridgesGenres) {
      score += 10; // Bonus for genre-bridging tracks
    }
  }

  return Math.min(score, config.maxBonus);
}

/**
 * Calculate diversity score based on recent plays
 */
export function calculateDiversityScore(
  track: UnifiedTrack,
  recentTracks: UnifiedTrack[],
  sessionArtists: Map<string, number>,
  sessionGenres: Map<string, number>
): number {
  const config = SCORING_CONFIG.diversity;
  if (!config.enabled) return 0;

  let score = 0;

  // Check artist repetition
  const trackArtist = track.artists[0]?.name.toLowerCase();
  if (trackArtist && sessionArtists.has(trackArtist)) {
    const count = sessionArtists.get(trackArtist)!;
    score += config.sameArtistPenalty * Math.min(count, 3);
  }

  // Check genre balance
  const trackGenre = track.genres?.[0]?.toLowerCase();
  if (trackGenre && sessionGenres.size > 0) {
    const totalTracks = Array.from(sessionGenres.values()).reduce((a, b) => a + b, 0);
    const genreCount = sessionGenres.get(trackGenre) || 0;
    const genreRatio = genreCount / Math.max(totalTracks, 1);

    if (genreRatio > config.idealGenreMix) {
      // Genre is overrepresented
      score += config.sameGenrePenalty * (genreRatio - config.idealGenreMix) * 10;
    } else {
      // Genre is underrepresented - bonus!
      score += 10 * (config.idealGenreMix - genreRatio);
    }
  }

  // Bonus for introducing new genre to session
  if (trackGenre && !sessionGenres.has(trackGenre)) {
    score += 15;
  }

  return score;
}

/**
 * Calculate session flow score - smooth transitions
 */
export function calculateFlowScore(
  track: UnifiedTrack,
  previousTrack: UnifiedTrack | null,
  trackFeatures: AudioFeatures | null,
  previousFeatures: AudioFeatures | null,
  recentEnergyLevels: number[]
): number {
  const config = SCORING_CONFIG.flow;
  if (!config.enabled || !previousTrack) return 0;

  let score = 0;

  // Calculate energy transition
  const currentEnergy = trackFeatures?.energy ?? estimateEnergy(track);
  const previousEnergy = previousFeatures?.energy ??
    (recentEnergyLevels.length > 0 ? recentEnergyLevels[recentEnergyLevels.length - 1] : 0.5);

  const energyDiff = Math.abs(currentEnergy - previousEnergy);

  if (energyDiff <= config.energyTransitionMax) {
    // Smooth transition
    score += config.smoothTransitionBonus * (1 - energyDiff / config.energyTransitionMax);
  } else {
    // Jarring transition
    score += config.jarringTransitionPenalty * (energyDiff - config.energyTransitionMax);
  }

  // BPM transition (if available)
  if (trackFeatures?.bpm && previousFeatures?.bpm) {
    const bpmDiff = Math.abs(trackFeatures.bpm - previousFeatures.bpm);
    const bpmRatio = bpmDiff / previousFeatures.bpm;

    if (bpmRatio <= 0.15) {
      // Similar tempo
      score += 10;
    } else if (bpmRatio <= 0.5 || bpmDiff <= 30) {
      // Acceptable tempo change
      score += 5;
    } else {
      // Large tempo jump
      score -= 10;
    }
  }

  // Key compatibility (if available)
  if (trackFeatures?.key && previousFeatures?.key) {
    const keyScore = calculateKeyCompatibility(trackFeatures.key, previousFeatures.key);
    score += keyScore * 10;
  }

  return score;
}

/**
 * Calculate temporal score based on time patterns
 */
export function calculateTemporalScore(
  track: UnifiedTrack,
  hour: number,
  dayOfWeek: number,
  userTimePatterns: Map<number, { genres: Record<string, number>; energy: number }>
): number {
  const config = SCORING_CONFIG.temporal;
  let score = 0;

  // Hour-based patterns
  const hourPattern = userTimePatterns.get(hour);
  if (hourPattern) {
    // Check genre match for this hour
    const trackGenre = track.genres?.[0]?.toLowerCase();
    if (trackGenre && hourPattern.genres[trackGenre]) {
      score += hourPattern.genres[trackGenre] * config.hourWeight * 100;
    }

    // Check energy match for this hour
    const trackEnergy = estimateEnergy(track);
    const energyDiff = Math.abs(trackEnergy - hourPattern.energy);
    score += (1 - energyDiff) * config.hourWeight * 50;
  }

  // Day-of-week patterns (weekend vs weekday)
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
  const trackEnergy = estimateEnergy(track);

  if (isWeekend) {
    // Weekends tend toward higher energy, more variety
    if (trackEnergy > 0.6) score += 5;
  } else {
    // Weekdays vary by time
    if (hour >= 9 && hour <= 17) {
      // Work hours - focus music
      if (trackEnergy >= 0.3 && trackEnergy <= 0.6) score += 5;
    } else if (hour >= 18 && hour <= 22) {
      // Evening - relaxation
      if (trackEnergy >= 0.4 && trackEnergy <= 0.7) score += 5;
    }
  }

  return score;
}

/**
 * Get enhanced score with all factors
 */
export async function getEnhancedScore(
  track: UnifiedTrack,
  baseScore: number,
  context: ScoringContext,
  userProfile: {
    genrePreferences: Record<string, number>;
    artistPreferences: Record<string, number>;
    artistHistory: Set<string>;
    genreHistory: Set<string>;
    timePatterns: Map<number, { genres: Record<string, number>; energy: number }>;
  },
  playCount: number = 0
): Promise<EnhancedScore> {
  const weights = SCORING_CONFIG.weights;
  const explanation: string[] = [];

  // Get audio features if available
  const trackFeatures = await getAudioFeatures(track.id);
  const previousTrack = context.sessionTracks[context.sessionTracks.length - 1];
  const previousFeatures = previousTrack ? await getAudioFeatures(previousTrack.id) : null;

  // Build session stats
  const sessionArtists = new Map<string, number>();
  const sessionGenres = new Map<string, number>();

  for (const t of context.sessionTracks) {
    const artist = t.artists[0]?.name.toLowerCase();
    if (artist) sessionArtists.set(artist, (sessionArtists.get(artist) || 0) + 1);
    const genre = t.genres?.[0]?.toLowerCase();
    if (genre) sessionGenres.set(genre, (sessionGenres.get(genre) || 0) + 1);
  }

  // Calculate all scores
  const explorationBonus = calculateExplorationBonus(
    track,
    userProfile.artistHistory,
    userProfile.genreHistory,
    playCount
  );
  if (explorationBonus > 10) explanation.push('New discovery');

  const serendipityScore = calculateSerendipityScore(
    track,
    userProfile,
    context.sessionTracks
  );
  if (serendipityScore > 15) explanation.push('Unexpected find');

  const diversityScore = calculateDiversityScore(
    track,
    context.sessionTracks,
    sessionArtists,
    sessionGenres
  );
  if (diversityScore > 10) explanation.push('Adds variety');
  if (diversityScore < -15) explanation.push('Too repetitive');

  const flowScore = calculateFlowScore(
    track,
    previousTrack || null,
    trackFeatures,
    previousFeatures,
    context.recentEnergy
  );
  if (flowScore > 10) explanation.push('Smooth transition');

  const temporalScore = calculateTemporalScore(
    track,
    context.hour,
    context.dayOfWeek,
    userProfile.timePatterns
  );
  if (temporalScore > 5) explanation.push('Right time');

  // Plugin score (from audio features matching user preferences)
  let pluginScore = 0;
  if (trackFeatures) {
    // Match against user's preferred energy for this time
    const preferredEnergy = userProfile.timePatterns.get(context.hour)?.energy ?? 0.5;
    if (trackFeatures.energy !== undefined) {
      pluginScore += (1 - Math.abs(trackFeatures.energy - preferredEnergy)) * 20;
    }
    explanation.push('Audio-analyzed');
  }

  // Calculate weighted final score
  const normalizedBase = Math.max(-100, Math.min(100, baseScore));

  const finalScore =
    normalizedBase * weights.base +
    explorationBonus * weights.exploration +
    serendipityScore * weights.serendipity +
    diversityScore * weights.diversity +
    flowScore * weights.flow +
    temporalScore * weights.temporal +
    pluginScore * weights.plugin;

  // Add mode-based adjustments
  let adjustedFinal = finalScore;
  if (context.explorationMode === 'explore') {
    adjustedFinal += explorationBonus * 0.5; // Extra weight on exploration
  } else if (context.explorationMode === 'exploit') {
    adjustedFinal += normalizedBase * 0.2; // Extra weight on known preferences
  }

  return {
    baseScore: normalizedBase,
    explorationBonus,
    serendipityScore,
    diversityScore,
    flowScore,
    temporalScore,
    pluginScore,
    finalScore: adjustedFinal,
    explanation,
  };
}

// ============================================
// Helper Functions
// ============================================

/**
 * Estimate energy from track metadata (when audio features unavailable)
 */
function estimateEnergy(track: UnifiedTrack): number {
  const genres = track.genres?.map(g => g.toLowerCase()) || [];

  // Genre-based energy estimation
  const highEnergy = ['electronic', 'edm', 'dance', 'metal', 'punk', 'hardcore', 'drum and bass', 'dubstep'];
  const mediumEnergy = ['pop', 'rock', 'hip-hop', 'rap', 'indie', 'alternative', 'funk', 'disco'];
  const lowEnergy = ['ambient', 'classical', 'jazz', 'acoustic', 'folk', 'lo-fi', 'chill', 'sleep'];

  for (const genre of genres) {
    if (highEnergy.some(g => genre.includes(g))) return 0.8;
    if (lowEnergy.some(g => genre.includes(g))) return 0.3;
    if (mediumEnergy.some(g => genre.includes(g))) return 0.55;
  }

  return 0.5; // Default medium energy
}

/**
 * Calculate key compatibility (Circle of Fifths)
 */
function calculateKeyCompatibility(key1: string, key2: string): number {
  const circleOfFifths = ['C', 'G', 'D', 'A', 'E', 'B', 'F#', 'C#', 'Ab', 'Eb', 'Bb', 'F'];

  const normalizeKey = (k: string) => k.replace('m', '').replace('#', '#').toUpperCase();
  const k1 = normalizeKey(key1);
  const k2 = normalizeKey(key2);

  const idx1 = circleOfFifths.indexOf(k1);
  const idx2 = circleOfFifths.indexOf(k2);

  if (idx1 === -1 || idx2 === -1) return 0.5;

  const distance = Math.min(
    Math.abs(idx1 - idx2),
    12 - Math.abs(idx1 - idx2)
  );

  // Adjacent keys on circle = compatible
  if (distance <= 1) return 1.0;
  if (distance <= 2) return 0.8;
  if (distance <= 3) return 0.5;
  return 0.2;
}

/**
 * Batch score tracks with enhanced scoring
 */
export async function batchEnhancedScore(
  tracks: UnifiedTrack[],
  baseScores: Map<string, number>,
  context: ScoringContext,
  userProfile: {
    genrePreferences: Record<string, number>;
    artistPreferences: Record<string, number>;
    artistHistory: Set<string>;
    genreHistory: Set<string>;
    timePatterns: Map<number, { genres: Record<string, number>; energy: number }>;
  },
  playCounts: Map<string, number>
): Promise<Map<string, EnhancedScore>> {
  const results = new Map<string, EnhancedScore>();

  // Process in parallel with concurrency limit
  const batchSize = 10;
  for (let i = 0; i < tracks.length; i += batchSize) {
    const batch = tracks.slice(i, i + batchSize);
    const promises = batch.map(track =>
      getEnhancedScore(
        track,
        baseScores.get(track.id) || 50,
        context,
        userProfile,
        playCounts.get(track.id) || 0
      ).then(score => ({ trackId: track.id, score }))
    );

    const batchResults = await Promise.all(promises);
    for (const { trackId, score } of batchResults) {
      results.set(trackId, score);
    }
  }

  return results;
}

export default {
  SCORING_CONFIG,
  registerFeatureProvider,
  unregisterFeatureProvider,
  getAudioFeatures,
  getEnhancedScore,
  batchEnhancedScore,
  calculateExplorationBonus,
  calculateSerendipityScore,
  calculateDiversityScore,
  calculateFlowScore,
  calculateTemporalScore,
};
