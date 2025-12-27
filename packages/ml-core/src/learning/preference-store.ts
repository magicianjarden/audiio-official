/**
 * Preference Store - Manages user preferences and affinities
 */

import type {
  UserEvent,
  UserPreferences,
  TemporalPatterns,
  DislikeEvent,
} from '@audiio/ml-sdk';
import { getEventWeight, DISLIKE_REASON_WEIGHTS } from '@audiio/ml-sdk';
import type { StorageAdapter } from '../storage/node-storage';

const STORAGE_KEY = 'audiio-ml-preferences';
const DECAY_FACTOR = 0.98; // Daily decay
const MAX_AFFINITY = 100;
const MIN_AFFINITY = -100;

interface ArtistStats {
  playCount: number;
  totalDuration: number;
  likeCount: number;
  dislikeCount: number;
  lastPlayed: number;
  affinity: number;
}

interface GenreStats {
  playCount: number;
  totalDuration: number;
  likeCount: number;
  dislikeCount: number;
  affinity: number;
}

interface PreferenceState {
  artists: Record<string, ArtistStats>;
  genres: Record<string, GenreStats>;
  temporalPatterns: {
    hourlyPlays: number[];
    hourlyEnergy: number[];
    dailyPlays: number[];
    genresByHour: Record<number, Record<string, number>>;
  };
  dislikedTracks: Map<string, { reason: string; timestamp: number; artistId?: string }>;
  recentPlays: Map<string, number>; // trackId -> timestamp
  totalListens: number;
  lastDecayApplied: number;
}

export class PreferenceStore {
  private artists = new Map<string, ArtistStats>();
  private genres = new Map<string, GenreStats>();
  private dislikedTracks = new Map<string, { reason: string; timestamp: number; artistId?: string }>();
  private recentPlays = new Map<string, number>();
  private hourlyPlays = new Array(24).fill(0);
  private hourlyEnergy = new Array(24).fill(0.5);
  private dailyPlays = new Array(7).fill(0);
  private genresByHour: Record<number, Record<string, number>> = {};
  private totalListens = 0;
  private lastDecayApplied = Date.now();
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
   * Load preferences from storage
   */
  async load(): Promise<void> {
    const storage = this.getStorage();
    if (!storage) {
      console.warn('[PreferenceStore] No storage available');
      return;
    }

    try {
      const stored = storage.getItem(STORAGE_KEY);
      if (stored) {
        const state = JSON.parse(stored);
        this.artists = new Map(Object.entries(state.artists || {}));
        this.genres = new Map(Object.entries(state.genres || {}));
        this.dislikedTracks = new Map(Object.entries(state.dislikedTracks || {}));
        this.recentPlays = new Map(Object.entries(state.recentPlays || {}));
        this.hourlyPlays = state.temporalPatterns?.hourlyPlays || new Array(24).fill(0);
        this.hourlyEnergy = state.temporalPatterns?.hourlyEnergy || new Array(24).fill(0.5);
        this.dailyPlays = state.temporalPatterns?.dailyPlays || new Array(7).fill(0);
        this.genresByHour = state.temporalPatterns?.genresByHour || {};
        this.totalListens = state.totalListens || 0;
        this.lastDecayApplied = state.lastDecayApplied || Date.now();

        // Apply decay if needed
        this.applyDecay();
      }
    } catch (error) {
      console.warn('[PreferenceStore] Failed to load preferences:', error);
    }
  }

  /**
   * Save preferences to storage
   */
  async save(): Promise<void> {
    const storage = this.getStorage();
    if (!storage) return;

    try {
      const state = {
        artists: Object.fromEntries(this.artists),
        genres: Object.fromEntries(this.genres),
        dislikedTracks: Object.fromEntries(this.dislikedTracks),
        recentPlays: Object.fromEntries(this.recentPlays),
        temporalPatterns: {
          hourlyPlays: this.hourlyPlays,
          hourlyEnergy: this.hourlyEnergy,
          dailyPlays: this.dailyPlays,
          genresByHour: this.genresByHour,
        },
        totalListens: this.totalListens,
        lastDecayApplied: this.lastDecayApplied,
      };
      storage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      console.warn('[PreferenceStore] Failed to save preferences:', error);
    }
  }

  /**
   * Update preferences from a user event
   */
  async updateFromEvent(event: UserEvent): Promise<void> {
    const weight = getEventWeight(event);

    switch (event.type) {
      case 'listen':
        this.recordListen(event);
        break;
      case 'skip':
        this.recordSkip(event);
        break;
      case 'dislike':
        this.recordDislike(event);
        break;
      case 'like':
        this.recordLike(event);
        break;
    }

    // Auto-save periodically
    if (this.totalListens % 5 === 0) {
      await this.save();
    }
  }

  /**
   * Record a listen event
   */
  private recordListen(event: import('@audiio/ml-sdk').ListenEvent): void {
    const { track, duration, completed, context } = event;

    // Update artist stats
    if (track.artistId) {
      const stats = this.getOrCreateArtistStats(track.artistId);
      stats.playCount++;
      stats.totalDuration += duration;
      stats.lastPlayed = event.timestamp;

      // Update affinity based on completion
      const affinityDelta = completed ? 5 : duration / track.duration * 3;
      stats.affinity = this.clampAffinity(stats.affinity + affinityDelta);
    }

    // Update genre stats
    const genre = track.genre || 'other';
    const genreStats = this.getOrCreateGenreStats(genre);
    genreStats.playCount++;
    genreStats.totalDuration += duration;

    const genreAffinityDelta = completed ? 3 : duration / track.duration * 2;
    genreStats.affinity = this.clampAffinity(genreStats.affinity + genreAffinityDelta);

    // Update temporal patterns
    const hour = context.hourOfDay;
    const day = context.dayOfWeek;
    this.hourlyPlays[hour]++;
    this.dailyPlays[day]++;

    // Track genre by hour
    if (!this.genresByHour[hour]) {
      this.genresByHour[hour] = {};
    }
    this.genresByHour[hour][genre] = (this.genresByHour[hour][genre] || 0) + 1;

    // Record recent play
    this.recentPlays.set(track.id, event.timestamp);
    this.totalListens++;

    // Trim old recent plays
    if (this.recentPlays.size > 1000) {
      const entries = Array.from(this.recentPlays.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 500);
      this.recentPlays = new Map(entries);
    }
  }

  /**
   * Record a skip event
   */
  private recordSkip(event: import('@audiio/ml-sdk').SkipEvent): void {
    const { track, earlySkip } = event;

    if (track.artistId) {
      const stats = this.getOrCreateArtistStats(track.artistId);
      const penalty = earlySkip ? -3 : -1;
      stats.affinity = this.clampAffinity(stats.affinity + penalty);
    }

    const genre = track.genre || 'other';
    const genreStats = this.getOrCreateGenreStats(genre);
    const penalty = earlySkip ? -2 : -0.5;
    genreStats.affinity = this.clampAffinity(genreStats.affinity + penalty);
  }

  /**
   * Record a dislike event
   */
  private recordDislike(event: DislikeEvent): void {
    const { track, reason } = event;

    // Store disliked track
    this.dislikedTracks.set(track.id, {
      reason,
      timestamp: event.timestamp,
      artistId: track.artistId,
    });

    // Update artist affinity
    if (track.artistId) {
      const stats = this.getOrCreateArtistStats(track.artistId);
      stats.dislikeCount++;

      const weight = DISLIKE_REASON_WEIGHTS[reason];
      const penalty = -10 * weight;
      stats.affinity = this.clampAffinity(stats.affinity + penalty);
    }

    // Update genre affinity
    const genre = track.genre || 'other';
    const genreStats = this.getOrCreateGenreStats(genre);
    genreStats.dislikeCount++;

    const weight = DISLIKE_REASON_WEIGHTS[reason];
    const penalty = -5 * weight;
    genreStats.affinity = this.clampAffinity(genreStats.affinity + penalty);
  }

  /**
   * Record a like event
   */
  private recordLike(event: import('@audiio/ml-sdk').LikeEvent): void {
    const { track, strength } = event;

    if (track.artistId) {
      const stats = this.getOrCreateArtistStats(track.artistId);
      stats.likeCount++;
      const bonus = strength === 2 ? 15 : 10;
      stats.affinity = this.clampAffinity(stats.affinity + bonus);
    }

    const genre = track.genre || 'other';
    const genreStats = this.getOrCreateGenreStats(genre);
    genreStats.likeCount++;
    const bonus = strength === 2 ? 8 : 5;
    genreStats.affinity = this.clampAffinity(genreStats.affinity + bonus);
  }

  /**
   * Get user preferences summary
   */
  async getPreferences(): Promise<UserPreferences> {
    const topArtists = Array.from(this.artists.entries())
      .sort((a, b) => b[1].affinity - a[1].affinity)
      .slice(0, 10)
      .map(([id, stats]) => ({
        artistId: id,
        name: id, // TODO: Get actual name from track data
        affinity: stats.affinity / MAX_AFFINITY,
      }));

    const topGenres = Array.from(this.genres.entries())
      .sort((a, b) => b[1].affinity - a[1].affinity)
      .slice(0, 10)
      .map(([genre, stats]) => ({
        genre,
        affinity: stats.affinity / MAX_AFFINITY,
      }));

    // Calculate energy by hour
    const energyByHour = this.hourlyEnergy.slice();

    // Calculate duration preference
    const allDurations: number[] = []; // Would need to track this
    const durationPreference = {
      min: 120,
      max: 300,
      mean: 210,
    };

    return {
      topGenres,
      topArtists,
      energyByHour,
      durationPreference,
      discoveryBalance: 0.3, // TODO: Calculate from exploration patterns
      totalListens: this.totalListens,
      uniqueArtists: this.artists.size,
      accountAgeDays: 30, // TODO: Track account creation
    };
  }

  /**
   * Get artist affinity (-1 to 1)
   */
  async getArtistAffinity(artistId: string): Promise<number> {
    const stats = this.artists.get(artistId);
    if (!stats) return 0;
    return stats.affinity / MAX_AFFINITY;
  }

  /**
   * Get genre affinity (-1 to 1)
   */
  async getGenreAffinity(genre: string): Promise<number> {
    const stats = this.genres.get(genre);
    if (!stats) return 0;
    return stats.affinity / MAX_AFFINITY;
  }

  /**
   * Get all artist affinities
   */
  async getAllArtistAffinities(): Promise<Map<string, number>> {
    const result = new Map<string, number>();
    for (const [id, stats] of this.artists) {
      result.set(id, stats.affinity / MAX_AFFINITY);
    }
    return result;
  }

  /**
   * Get all genre affinities
   */
  async getAllGenreAffinities(): Promise<Map<string, number>> {
    const result = new Map<string, number>();
    for (const [genre, stats] of this.genres) {
      result.set(genre, stats.affinity / MAX_AFFINITY);
    }
    return result;
  }

  /**
   * Get temporal patterns
   */
  async getTemporalPatterns(): Promise<TemporalPatterns> {
    // Calculate preferred genres by hour
    const genresByHourMap = new Map<number, string[]>();
    for (const [hourStr, genres] of Object.entries(this.genresByHour)) {
      const hour = parseInt(hourStr);
      const sorted = Object.entries(genres)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([g]) => g);
      genresByHourMap.set(hour, sorted);
    }

    // Calculate weekend vs weekday preferences
    const weekendDays = [0, 6];
    const weekdayDays = [1, 2, 3, 4, 5];

    const weekendPlays = weekendDays.reduce((sum, d) => sum + this.dailyPlays[d], 0);
    const weekdayPlays = weekdayDays.reduce((sum, d) => sum + this.dailyPlays[d], 0);

    return {
      hourlyFrequency: this.hourlyPlays,
      dailyFrequency: this.dailyPlays,
      genresByHour: genresByHourMap,
      energyByHour: this.hourlyEnergy,
      weekendPreferences: {
        genres: [], // TODO: Calculate
        energyLevel: 0.7,
        discoveryRate: 0.4,
      },
      weekdayPreferences: {
        genres: [],
        energyLevel: 0.5,
        discoveryRate: 0.2,
      },
    };
  }

  /**
   * Check if track was recently played
   */
  async wasRecentlyPlayed(trackId: string, withinMs = 3600000): Promise<boolean> {
    const lastPlayed = this.recentPlays.get(trackId);
    if (!lastPlayed) return false;
    return Date.now() - lastPlayed < withinMs;
  }

  /**
   * Get last played timestamp
   */
  async getLastPlayed(trackId: string): Promise<number | null> {
    return this.recentPlays.get(trackId) ?? null;
  }

  /**
   * Get disliked tracks
   */
  getDislikedTracks(): Array<{ trackId: string; reason: string; timestamp: number; artistId?: string }> {
    return Array.from(this.dislikedTracks.entries()).map(([trackId, info]) => ({
      trackId,
      ...info,
    }));
  }

  /**
   * Apply decay to affinities
   */
  private applyDecay(): void {
    const now = Date.now();
    const daysSinceDecay = (now - this.lastDecayApplied) / (24 * 60 * 60 * 1000);

    if (daysSinceDecay < 1) return;

    const decay = Math.pow(DECAY_FACTOR, Math.floor(daysSinceDecay));

    for (const stats of this.artists.values()) {
      stats.affinity *= decay;
    }

    for (const stats of this.genres.values()) {
      stats.affinity *= decay;
    }

    this.lastDecayApplied = now;
  }

  /**
   * Get or create artist stats
   */
  private getOrCreateArtistStats(artistId: string): ArtistStats {
    let stats = this.artists.get(artistId);
    if (!stats) {
      stats = {
        playCount: 0,
        totalDuration: 0,
        likeCount: 0,
        dislikeCount: 0,
        lastPlayed: 0,
        affinity: 0,
      };
      this.artists.set(artistId, stats);
    }
    return stats;
  }

  /**
   * Get or create genre stats
   */
  private getOrCreateGenreStats(genre: string): GenreStats {
    let stats = this.genres.get(genre);
    if (!stats) {
      stats = {
        playCount: 0,
        totalDuration: 0,
        likeCount: 0,
        dislikeCount: 0,
        affinity: 0,
      };
      this.genres.set(genre, stats);
    }
    return stats;
  }

  /**
   * Clamp affinity to valid range
   */
  private clampAffinity(value: number): number {
    return Math.max(MIN_AFFINITY, Math.min(MAX_AFFINITY, value));
  }
}
