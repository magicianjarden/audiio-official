/**
 * User Taste Profile
 *
 * Builds and maintains a user's taste profile as a vector embedding.
 * Aggregates liked tracks, listening history, and contextual preferences
 * into a dense representation for similarity-based recommendations.
 */

import type {
  UserTasteProfile,
  TasteProfileStats,
  ContextualProfiles,
  TrackEmbedding,
} from './types';
import { EmbeddingEngine, type TrackData } from './embedding-engine';

/**
 * Configuration for taste profile generation
 */
export interface TasteProfileConfig {
  dimensions: number;
  likeWeight: number; // Weight for liked tracks
  listenWeight: number; // Weight for listened tracks
  recentWeight: number; // Extra weight for recent tracks
  recencyDecayDays: number; // Days until weight decays to half
  minTracksForProfile: number; // Minimum tracks before profile is valid
  contextTimeSlots: number; // Number of time-of-day slots
  maxTracksToConsider: number; // Limit for performance
}

/**
 * Default configuration
 */
export const DEFAULT_TASTE_CONFIG: TasteProfileConfig = {
  dimensions: 128,
  likeWeight: 3.0,
  listenWeight: 1.0,
  recentWeight: 1.5,
  recencyDecayDays: 30,
  minTracksForProfile: 5,
  contextTimeSlots: 4, // morning, afternoon, evening, night
  maxTracksToConsider: 1000,
};

/**
 * Track interaction for profile building
 */
export interface TrackInteraction {
  trackId: string;
  embedding: Float32Array;
  interactionType: 'like' | 'listen' | 'download' | 'playlist-add';
  timestamp: number;
  duration?: number; // Listen duration in seconds
  completed?: boolean;
  genres?: string[];
  artistId?: string;
  context?: {
    hour?: number;
    dayOfWeek?: number;
  };
}

/**
 * Taste Profile Manager
 *
 * Generates and maintains user taste profiles from their interactions.
 */
export class TasteProfileManager {
  private config: TasteProfileConfig;
  private embeddingEngine: EmbeddingEngine;
  private profile: UserTasteProfile | null = null;
  private interactions: TrackInteraction[] = [];
  private userId: string;

  constructor(
    userId: string,
    embeddingEngine: EmbeddingEngine,
    config: Partial<TasteProfileConfig> = {}
  ) {
    this.userId = userId;
    this.embeddingEngine = embeddingEngine;
    this.config = { ...DEFAULT_TASTE_CONFIG, ...config };
  }

  /**
   * Add a track interaction to the profile
   */
  addInteraction(interaction: TrackInteraction): void {
    this.interactions.push(interaction);

    // Trim old interactions if too many
    if (this.interactions.length > this.config.maxTracksToConsider) {
      // Keep most recent
      this.interactions = this.interactions
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, this.config.maxTracksToConsider);
    }

    // Invalidate cached profile
    this.profile = null;
  }

  /**
   * Add a liked track
   */
  addLike(trackId: string, embedding: Float32Array, genres?: string[], artistId?: string): void {
    this.addInteraction({
      trackId,
      embedding,
      interactionType: 'like',
      timestamp: Date.now(),
      genres,
      artistId,
      context: this.getCurrentContext(),
    });
  }

  /**
   * Add a listen event
   */
  addListen(
    trackId: string,
    embedding: Float32Array,
    duration: number,
    totalDuration: number,
    genres?: string[],
    artistId?: string
  ): void {
    this.addInteraction({
      trackId,
      embedding,
      interactionType: 'listen',
      timestamp: Date.now(),
      duration,
      completed: duration >= totalDuration * 0.8,
      genres,
      artistId,
      context: this.getCurrentContext(),
    });
  }

  /**
   * Generate the user's taste profile
   */
  generateProfile(): UserTasteProfile {
    if (this.profile && this.interactions.length === this.profile.stats.tracksContributed) {
      return this.profile;
    }

    const now = Date.now();
    const dims = this.config.dimensions;

    // Calculate weighted average of all track embeddings
    const aggregated = new Float32Array(dims);
    let totalWeight = 0;

    // Track stats
    const genreCount: Record<string, number> = {};
    const artistCount: Record<string, number> = {};
    let likesContributed = 0;
    let totalListenTime = 0;

    // Contextual profiles
    const contextVectors: Record<string, { vector: Float32Array; weight: number }> = {
      morning: { vector: new Float32Array(dims), weight: 0 },
      afternoon: { vector: new Float32Array(dims), weight: 0 },
      evening: { vector: new Float32Array(dims), weight: 0 },
      night: { vector: new Float32Array(dims), weight: 0 },
      weekday: { vector: new Float32Array(dims), weight: 0 },
      weekend: { vector: new Float32Array(dims), weight: 0 },
    };

    for (const interaction of this.interactions) {
      // Calculate weight for this interaction
      let weight = this.config.listenWeight;

      // Interaction type weight
      if (interaction.interactionType === 'like') {
        weight = this.config.likeWeight;
        likesContributed++;
      } else if (interaction.interactionType === 'download') {
        weight = this.config.likeWeight * 1.2;
      } else if (interaction.interactionType === 'playlist-add') {
        weight = this.config.likeWeight * 0.8;
      }

      // Completion bonus for listens
      if (interaction.completed) {
        weight *= 1.5;
      }

      // Recency weight
      const daysSince = (now - interaction.timestamp) / (24 * 60 * 60 * 1000);
      const recencyMultiplier = Math.pow(0.5, daysSince / this.config.recencyDecayDays);
      weight *= recencyMultiplier * this.config.recentWeight;

      // Add to aggregated vector
      for (let i = 0; i < dims; i++) {
        aggregated[i] += interaction.embedding[i] * weight;
      }
      totalWeight += weight;

      // Track stats
      if (interaction.genres) {
        for (const genre of interaction.genres) {
          genreCount[genre] = (genreCount[genre] || 0) + 1;
        }
      }
      if (interaction.artistId) {
        artistCount[interaction.artistId] = (artistCount[interaction.artistId] || 0) + 1;
      }
      if (interaction.duration) {
        totalListenTime += interaction.duration;
      }

      // Contextual profiles
      if (interaction.context) {
        const { hour, dayOfWeek } = interaction.context;

        // Time of day
        if (hour !== undefined) {
          const timeSlot = this.getTimeSlot(hour);
          const ctx = contextVectors[timeSlot];
          for (let i = 0; i < dims; i++) {
            ctx.vector[i] += interaction.embedding[i] * weight;
          }
          ctx.weight += weight;
        }

        // Weekday/weekend
        if (dayOfWeek !== undefined) {
          const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
          const ctx = contextVectors[isWeekend ? 'weekend' : 'weekday'];
          for (let i = 0; i < dims; i++) {
            ctx.vector[i] += interaction.embedding[i] * weight;
          }
          ctx.weight += weight;
        }
      }
    }

    // Normalize aggregated vector
    if (totalWeight > 0) {
      for (let i = 0; i < dims; i++) {
        aggregated[i] /= totalWeight;
      }
    }

    // Normalize to unit length
    const normalized = this.normalizeVector(aggregated);

    // Normalize contextual profiles
    const contextProfiles: ContextualProfiles = {};
    for (const [key, ctx] of Object.entries(contextVectors)) {
      if (ctx.weight > 0) {
        for (let i = 0; i < dims; i++) {
          ctx.vector[i] /= ctx.weight;
        }
        (contextProfiles as Record<string, Float32Array>)[key] = this.normalizeVector(ctx.vector);
      }
    }

    // Build stats
    const stats: TasteProfileStats = {
      tracksContributed: this.interactions.length,
      likesContributed,
      totalListenTime,
      genreDistribution: genreCount,
      artistDistribution: artistCount,
    };

    this.profile = {
      userId: this.userId,
      vector: normalized,
      version: 1,
      updatedAt: now,
      stats,
      contextProfiles,
    };

    return this.profile;
  }

  /**
   * Get taste vector for a specific context
   */
  getContextualVector(hour: number, dayOfWeek: number): Float32Array {
    const profile = this.generateProfile();
    const contextProfiles = profile.contextProfiles;

    if (!contextProfiles) {
      return profile.vector;
    }

    // Get time slot and weekday/weekend vectors
    const timeSlot = this.getTimeSlot(hour);
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    const timeVector = (contextProfiles as Record<string, Float32Array>)[timeSlot];
    const dayVector = isWeekend ? contextProfiles.weekend : contextProfiles.weekday;

    if (!timeVector && !dayVector) {
      return profile.vector;
    }

    // Blend context vectors with main profile
    const dims = this.config.dimensions;
    const blended = new Float32Array(dims);

    const mainWeight = 0.5;
    const timeWeight = timeVector ? 0.3 : 0;
    const dayWeight = dayVector ? 0.2 : 0;
    const totalWeight = mainWeight + timeWeight + dayWeight;

    for (let i = 0; i < dims; i++) {
      blended[i] = profile.vector[i] * mainWeight;
      if (timeVector) {
        blended[i] += timeVector[i] * timeWeight;
      }
      if (dayVector) {
        blended[i] += dayVector[i] * dayWeight;
      }
      blended[i] /= totalWeight;
    }

    return this.normalizeVector(blended);
  }

  /**
   * Get time slot from hour
   */
  private getTimeSlot(hour: number): string {
    if (hour >= 6 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 18) return 'afternoon';
    if (hour >= 18 && hour < 22) return 'evening';
    return 'night';
  }

  /**
   * Check if profile has enough data
   */
  isProfileValid(): boolean {
    return this.interactions.length >= this.config.minTracksForProfile;
  }

  /**
   * Get current profile or null
   */
  getProfile(): UserTasteProfile | null {
    if (!this.isProfileValid()) return null;
    return this.generateProfile();
  }

  /**
   * Get the raw taste vector
   */
  getTasteVector(): Float32Array | null {
    if (!this.isProfileValid()) return null;
    return this.generateProfile().vector;
  }

  /**
   * Calculate similarity between user taste and a track
   */
  calculateTrackSimilarity(trackEmbedding: Float32Array): number {
    const profile = this.getProfile();
    if (!profile) return 0.5; // Neutral for new users

    return this.cosineSimilarity(profile.vector, trackEmbedding);
  }

  /**
   * Calculate contextual similarity
   */
  calculateContextualSimilarity(
    trackEmbedding: Float32Array,
    hour: number,
    dayOfWeek: number
  ): number {
    if (!this.isProfileValid()) return 0.5;

    const contextVector = this.getContextualVector(hour, dayOfWeek);
    return this.cosineSimilarity(contextVector, trackEmbedding);
  }

  /**
   * Get top genres from profile
   */
  getTopGenres(limit = 5): Array<{ genre: string; count: number }> {
    const profile = this.getProfile();
    if (!profile) return [];

    return Object.entries(profile.stats.genreDistribution)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([genre, count]) => ({ genre, count }));
  }

  /**
   * Get top artists from profile
   */
  getTopArtists(limit = 5): Array<{ artistId: string; count: number }> {
    const profile = this.getProfile();
    if (!profile) return [];

    return Object.entries(profile.stats.artistDistribution)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([artistId, count]) => ({ artistId, count }));
  }

  /**
   * Generate exploration vector (opposite of taste)
   */
  getExplorationVector(): Float32Array | null {
    const profile = this.getProfile();
    if (!profile) return null;

    // Generate a vector that's different from the user's taste
    // but not completely opposite (that would be bad recommendations)
    const dims = this.config.dimensions;
    const exploration = new Float32Array(dims);

    // Add some randomness but stay somewhat related
    for (let i = 0; i < dims; i++) {
      // Mix user taste with random values
      exploration[i] = profile.vector[i] * 0.3 + (Math.random() - 0.5) * 0.7;
    }

    return this.normalizeVector(exploration);
  }

  /**
   * Blend taste with mood for mood-based playlists
   */
  blendWithMood(moodVector: Float32Array, moodWeight = 0.6): Float32Array | null {
    const profile = this.getProfile();
    if (!profile) {
      // New user: just use mood
      return moodVector;
    }

    const dims = this.config.dimensions;
    const blended = new Float32Array(dims);
    const tasteWeight = 1 - moodWeight;

    for (let i = 0; i < dims; i++) {
      blended[i] = profile.vector[i] * tasteWeight + moodVector[i] * moodWeight;
    }

    return this.normalizeVector(blended);
  }

  /**
   * Normalize vector to unit length
   */
  private normalizeVector(vector: Float32Array): Float32Array {
    let magnitude = 0;
    for (let i = 0; i < vector.length; i++) {
      magnitude += vector[i] * vector[i];
    }
    magnitude = Math.sqrt(magnitude);

    if (magnitude === 0) return vector;

    const normalized = new Float32Array(vector.length);
    for (let i = 0; i < vector.length; i++) {
      normalized[i] = vector[i] / magnitude;
    }

    return normalized;
  }

  /**
   * Calculate cosine similarity
   */
  private cosineSimilarity(a: Float32Array, b: Float32Array): number {
    let dot = 0;
    let normA = 0;
    let normB = 0;
    const len = Math.min(a.length, b.length);

    for (let i = 0; i < len; i++) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    if (normA === 0 || normB === 0) return 0;
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Get current context
   */
  private getCurrentContext(): { hour: number; dayOfWeek: number } {
    const now = new Date();
    return {
      hour: now.getHours(),
      dayOfWeek: now.getDay(),
    };
  }

  /**
   * Export profile for persistence
   */
  export(): {
    userId: string;
    interactions: Array<{
      trackId: string;
      vector: number[];
      type: string;
      timestamp: number;
      genres?: string[];
      artistId?: string;
    }>;
  } {
    return {
      userId: this.userId,
      interactions: this.interactions.map((i) => ({
        trackId: i.trackId,
        vector: Array.from(i.embedding),
        type: i.interactionType,
        timestamp: i.timestamp,
        genres: i.genres,
        artistId: i.artistId,
      })),
    };
  }

  /**
   * Import profile from persistence
   */
  import(data: {
    interactions: Array<{
      trackId: string;
      vector: number[];
      type: string;
      timestamp: number;
      genres?: string[];
      artistId?: string;
    }>;
  }): void {
    this.interactions = data.interactions.map((i) => ({
      trackId: i.trackId,
      embedding: new Float32Array(i.vector),
      interactionType: i.type as 'like' | 'listen' | 'download' | 'playlist-add',
      timestamp: i.timestamp,
      genres: i.genres,
      artistId: i.artistId,
    }));
    this.profile = null;
  }

  /**
   * Clear all data
   */
  clear(): void {
    this.interactions = [];
    this.profile = null;
  }

  /**
   * Get interaction count
   */
  getInteractionCount(): number {
    return this.interactions.length;
  }
}
