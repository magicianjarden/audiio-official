/**
 * Recommendation Store - Advanced local recommendation algorithm
 *
 * Tracks listening patterns, likes, dislikes, downloads and uses
 * weighted scoring to generate personalized recommendations.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { UnifiedTrack } from '@audiio/core';
import { useStatsStore } from './stats-store';

// ============================================
// Types
// ============================================

export type DislikeReason =
  | 'not_my_taste'
  | 'heard_too_much'
  | 'bad_audio_quality'
  | 'wrong_mood'
  | 'dont_like_artist'
  | 'too_long'
  | 'too_short'
  | 'explicit_content'
  | 'other';

export const DISLIKE_REASONS: { value: DislikeReason; label: string }[] = [
  { value: 'not_my_taste', label: "Not my taste" },
  { value: 'heard_too_much', label: "Heard it too much" },
  { value: 'bad_audio_quality', label: "Bad audio quality" },
  { value: 'wrong_mood', label: "Wrong mood/vibe" },
  { value: 'dont_like_artist', label: "Don't like this artist" },
  { value: 'too_long', label: "Too long" },
  { value: 'too_short', label: "Too short" },
  { value: 'explicit_content', label: "Explicit content" },
  { value: 'other', label: "Other reason" },
];

export interface ListenEvent {
  trackId: string;
  timestamp: number;
  duration: number; // How long they listened (ms)
  totalDuration: number; // Track's total duration (ms)
  completed: boolean; // Did they listen to >80%
  skipped: boolean; // Did they skip before 30s
}

export interface DislikedTrack {
  trackId: string;
  reasons: DislikeReason[];
  timestamp: number;
  track: UnifiedTrack; // Full track object for mobile sync
  trackData: {
    title: string;
    artists: string[];
    genres?: string[];
  };
}

export interface ArtistPreference {
  artistId: string;
  artistName: string;
  score: number; // -100 to 100
  playCount: number;
  totalListenTime: number;
  likeCount: number;
  dislikeCount: number;
}

export interface GenrePreference {
  genre: string;
  score: number; // -100 to 100
  playCount: number;
  likeCount: number;
  dislikeCount: number;
}

export interface TimePattern {
  hour: number; // 0-23
  genres: Record<string, number>; // genre -> play count
  energy: 'low' | 'medium' | 'high'; // Inferred energy level
}

export interface UserProfile {
  // Preferences
  artistPreferences: Record<string, ArtistPreference>;
  genrePreferences: Record<string, GenrePreference>;

  // Patterns
  timePatterns: TimePattern[];
  avgSessionLength: number;
  preferredDuration: { min: number; max: number };

  // Stats
  totalListens: number;
  totalListenTime: number;
  uniqueArtists: number;
  uniqueTracks: number;
}

// ============================================
// Mood & Energy Types
// ============================================

export type EnergyLevel = 'very-low' | 'low' | 'medium' | 'high' | 'very-high';
export type MoodCategory = 'calm' | 'chill' | 'neutral' | 'upbeat' | 'energetic' | 'intense';

export interface TrackMoodScore {
  energy: number; // 0-100
  energyLevel: EnergyLevel;
  mood: MoodCategory;
  valence: number; // 0-100 (happiness/positivity)
}

// Genre to energy mapping
export const GENRE_ENERGY_MAP: Record<string, number> = {
  // Very Low Energy (0-20)
  'ambient': 10,
  'sleep': 5,
  'meditation': 5,
  'new age': 15,
  'classical': 20,
  'drone': 10,

  // Low Energy (20-40)
  'lofi': 25,
  'lo-fi': 25,
  'chill': 30,
  'jazz': 35,
  'acoustic': 30,
  'folk': 35,
  'soul': 40,
  'r&b': 40,
  'blues': 35,
  'ballad': 25,

  // Medium Energy (40-60)
  'pop': 55,
  'indie': 50,
  'alternative': 50,
  'rock': 55,
  'country': 45,
  'reggae': 45,
  'funk': 55,
  'disco': 60,

  // High Energy (60-80)
  'hip hop': 65,
  'hip-hop': 65,
  'rap': 70,
  'electronic': 70,
  'dance': 75,
  'house': 70,
  'techno': 75,
  'punk': 75,
  'metal': 80,

  // Very High Energy (80-100)
  'edm': 85,
  'dubstep': 85,
  'drum and bass': 90,
  'dnb': 90,
  'hardcore': 95,
  'hardstyle': 95,
  'workout': 90,
  'party': 85,
};

// ============================================
// Algorithm Weights
// ============================================

export const WEIGHTS = {
  // Positive signals
  LIKE: 25,
  DOWNLOAD: 30,
  COMPLETED_LISTEN: 10,
  REPEAT_LISTEN: 5, // Per repeat
  PLAYLIST_ADD: 15,

  // Negative signals
  DISLIKE_BASE: -20,
  DISLIKE_REASON_MULTIPLIERS: {
    not_my_taste: 1.5,
    heard_too_much: 0.5, // Less severe - might like later
    bad_audio_quality: 0.3, // Not about the song
    wrong_mood: 0.3, // Contextual, not permanent
    dont_like_artist: 2.0, // Affects all artist tracks
    too_long: 0.5,
    too_short: 0.5,
    explicit_content: 1.0,
    other: 1.0,
  } as Record<DislikeReason, number>,
  SKIP: -5,

  // Decay factors (per day)
  LISTEN_DECAY: 0.95,
  PREFERENCE_DECAY: 0.98,

  // Similarity weights
  ARTIST_SIMILARITY: 40,
  GENRE_SIMILARITY: 30,
  DURATION_SIMILARITY: 10,
  TEMPORAL_MATCH: 20,

  // Thresholds
  MIN_LISTENS_FOR_PATTERN: 5,
  SKIP_THRESHOLD_SECONDS: 30,
  COMPLETION_THRESHOLD: 0.8,
};

// ============================================
// Store Interface
// ============================================

interface RecommendationState {
  // Data
  listenHistory: ListenEvent[];
  dislikedTracks: Record<string, DislikedTrack>;
  userProfile: UserProfile;
  lastUpdated: number;

  // Actions - Tracking
  recordListen: (track: UnifiedTrack, duration: number, completed: boolean, skipped: boolean) => void;
  recordDislike: (track: UnifiedTrack, reasons: DislikeReason[]) => void;
  recordSkip: (trackId: string, data: { skipPosition: number; skipPercentage: number; earlySkip: boolean }) => void;
  recordReorder: (track: UnifiedTrack, fromIndex: number, toIndex: number) => void;
  removeDislike: (trackId: string) => void;
  isDisliked: (trackId: string) => boolean;
  getDislikeReasons: (trackId: string) => DislikeReason[] | null;

  // Actions - Recommendations
  calculateTrackScore: (track: UnifiedTrack, context?: { hour?: number }) => number;
  getRecommendedTracks: (candidates: UnifiedTrack[], limit?: number, context?: { hour?: number }) => UnifiedTrack[];
  getMLEnhancedRecommendations: (candidates: UnifiedTrack[], limit?: number, context?: { hour?: number }) => UnifiedTrack[];
  getTopGenres: (limit?: number) => string[];
  getTopArtists: (limit?: number) => string[];
  getPersonalizedQueries: () => { id: string; title: string; query: string }[];
  sortTracksByEnergy: (tracks: UnifiedTrack[], direction?: 'asc' | 'desc') => UnifiedTrack[];

  // Actions - Profile
  updateUserProfile: () => void;
  clearHistory: () => void;
  exportData: () => object;

  // Actions - Advanced Scoring Support
  getArtistHistory: () => Set<string>;
  getGenreHistory: () => Set<string>;
  getTimePatternsForScoring: () => Map<number, { genres: Record<string, number>; energy: number }>;
  getPlayCounts: () => Map<string, number>;
}

// ============================================
// Helper Functions
// ============================================

function normalizeScore(score: number): number {
  return Math.max(-100, Math.min(100, score));
}

function getHourOfDay(): number {
  return new Date().getHours();
}

function daysSince(timestamp: number): number {
  return (Date.now() - timestamp) / (1000 * 60 * 60 * 24);
}

function applyDecay(value: number, days: number, decayFactor: number): number {
  return value * Math.pow(decayFactor, days);
}

function extractGenres(track: UnifiedTrack): string[] {
  // Try to extract genres from track metadata
  if (track.genres && track.genres.length > 0) {
    return track.genres;
  }
  // Fallback: could infer from album or artist metadata
  return [];
}

function extractArtistIds(track: UnifiedTrack): { id: string; name: string }[] {
  if (!track.artists || !Array.isArray(track.artists)) {
    return [];
  }
  return track.artists
    .filter(a => a && a.name)
    .map(a => ({
      id: a.id || a.name.toLowerCase().replace(/\s+/g, '-'),
      name: a.name
    }));
}

/**
 * Calculate mood/energy score for a track based on genres and metadata
 */
export function calculateTrackMood(track: UnifiedTrack): TrackMoodScore {
  const genres = track.genres || [];

  // Calculate energy from genres
  let totalEnergy = 50; // Default neutral
  let genreMatches = 0;

  for (const genre of genres) {
    const normalizedGenre = genre.toLowerCase();
    // Check for exact match or partial match
    for (const [key, energy] of Object.entries(GENRE_ENERGY_MAP)) {
      if (normalizedGenre.includes(key) || key.includes(normalizedGenre)) {
        totalEnergy += energy;
        genreMatches++;
        break;
      }
    }
  }

  // Average if we found matches, otherwise use default
  const energy = genreMatches > 0 ? Math.round(totalEnergy / (genreMatches + 1)) : 50;

  // Determine energy level
  let energyLevel: EnergyLevel;
  if (energy <= 20) energyLevel = 'very-low';
  else if (energy <= 40) energyLevel = 'low';
  else if (energy <= 60) energyLevel = 'medium';
  else if (energy <= 80) energyLevel = 'high';
  else energyLevel = 'very-high';

  // Determine mood category
  let mood: MoodCategory;
  if (energy <= 15) mood = 'calm';
  else if (energy <= 35) mood = 'chill';
  else if (energy <= 55) mood = 'neutral';
  else if (energy <= 75) mood = 'upbeat';
  else if (energy <= 90) mood = 'energetic';
  else mood = 'intense';

  // Valence is harder to determine without actual audio analysis
  // Use a simplified heuristic based on genre
  const valence = energy > 50 ? Math.min(energy + 10, 100) : Math.max(energy - 10, 0);

  return { energy, energyLevel, mood, valence };
}

// ============================================
// Store Implementation
// ============================================

const initialProfile: UserProfile = {
  artistPreferences: {},
  genrePreferences: {},
  timePatterns: Array.from({ length: 24 }, (_, i) => ({
    hour: i,
    genres: {},
    energy: 'medium' as const
  })),
  avgSessionLength: 0,
  preferredDuration: { min: 120000, max: 300000 }, // 2-5 minutes default
  totalListens: 0,
  totalListenTime: 0,
  uniqueArtists: 0,
  uniqueTracks: 0,
};

export const useRecommendationStore = create<RecommendationState>()(
  persist(
    (set, get) => ({
      // Initial state
      listenHistory: [],
      dislikedTracks: {},
      userProfile: initialProfile,
      lastUpdated: Date.now(),

      // ==========================================
      // Tracking Actions
      // ==========================================

      recordListen: (track, duration, completed, skipped) => {
        const event: ListenEvent = {
          trackId: track.id,
          timestamp: Date.now(),
          duration,
          totalDuration: track.duration,
          completed,
          skipped,
        };

        // Also record to stats store for the stats dashboard
        useStatsStore.getState().recordListen(track, Math.round(duration / 1000), completed);

        set((state) => {
          // Add to history (keep last 1000 events)
          const newHistory = [event, ...state.listenHistory].slice(0, 1000);

          // Update artist preferences
          const artistPrefs = { ...state.userProfile.artistPreferences };
          for (const artist of extractArtistIds(track)) {
            const existing = artistPrefs[artist.id] || {
              artistId: artist.id,
              artistName: artist.name,
              score: 0,
              playCount: 0,
              totalListenTime: 0,
              likeCount: 0,
              dislikeCount: 0,
            };

            let scoreChange = 0;
            if (completed) scoreChange += WEIGHTS.COMPLETED_LISTEN;
            if (skipped) scoreChange += WEIGHTS.SKIP;

            artistPrefs[artist.id] = {
              ...existing,
              score: normalizeScore(existing.score + scoreChange),
              playCount: existing.playCount + 1,
              totalListenTime: existing.totalListenTime + duration,
            };
          }

          // Update genre preferences
          const genrePrefs = { ...state.userProfile.genrePreferences };
          for (const genre of extractGenres(track)) {
            const existing = genrePrefs[genre] || {
              genre,
              score: 0,
              playCount: 0,
              likeCount: 0,
              dislikeCount: 0,
            };

            let scoreChange = 0;
            if (completed) scoreChange += WEIGHTS.COMPLETED_LISTEN * 0.5;
            if (skipped) scoreChange += WEIGHTS.SKIP * 0.5;

            genrePrefs[genre] = {
              ...existing,
              score: normalizeScore(existing.score + scoreChange),
              playCount: existing.playCount + 1,
            };
          }

          // Update time patterns
          const hour = getHourOfDay();
          const timePatterns = [...state.userProfile.timePatterns];
          const hourPattern = timePatterns[hour]!;
          for (const genre of extractGenres(track)) {
            hourPattern.genres[genre] = (hourPattern.genres[genre] || 0) + 1;
          }

          return {
            listenHistory: newHistory,
            userProfile: {
              ...state.userProfile,
              artistPreferences: artistPrefs,
              genrePreferences: genrePrefs,
              timePatterns,
              totalListens: state.userProfile.totalListens + 1,
              totalListenTime: state.userProfile.totalListenTime + duration,
            },
            lastUpdated: Date.now(),
          };
        });
      },

      recordDislike: (track, reasons) => {
        set((state) => {
          const disliked: DislikedTrack = {
            trackId: track.id,
            reasons,
            timestamp: Date.now(),
            track, // Store full track for mobile sync
            trackData: {
              title: track.title,
              artists: track.artists.map(a => a.name),
              genres: extractGenres(track),
            },
          };

          // Update artist preferences negatively
          const artistPrefs = { ...state.userProfile.artistPreferences };
          const hasArtistDislike = reasons.includes('dont_like_artist');

          for (const artist of extractArtistIds(track)) {
            const existing = artistPrefs[artist.id] || {
              artistId: artist.id,
              artistName: artist.name,
              score: 0,
              playCount: 0,
              totalListenTime: 0,
              likeCount: 0,
              dislikeCount: 0,
            };

            // Calculate penalty based on reasons
            let penalty = WEIGHTS.DISLIKE_BASE;
            for (const reason of reasons) {
              penalty *= WEIGHTS.DISLIKE_REASON_MULTIPLIERS[reason] || 1;
            }
            // Extra penalty for artist-specific dislike
            if (hasArtistDislike) {
              penalty *= 1.5;
            }

            artistPrefs[artist.id] = {
              ...existing,
              score: normalizeScore(existing.score + penalty),
              dislikeCount: existing.dislikeCount + 1,
            };
          }

          // Update genre preferences
          const genrePrefs = { ...state.userProfile.genrePreferences };
          for (const genre of extractGenres(track)) {
            const existing = genrePrefs[genre] || {
              genre,
              score: 0,
              playCount: 0,
              likeCount: 0,
              dislikeCount: 0,
            };

            genrePrefs[genre] = {
              ...existing,
              score: normalizeScore(existing.score + WEIGHTS.DISLIKE_BASE * 0.3),
              dislikeCount: existing.dislikeCount + 1,
            };
          }

          return {
            dislikedTracks: {
              ...state.dislikedTracks,
              [track.id]: disliked,
            },
            userProfile: {
              ...state.userProfile,
              artistPreferences: artistPrefs,
              genrePreferences: genrePrefs,
            },
            lastUpdated: Date.now(),
          };
        });
      },

      recordSkip: (trackId, data) => {
        // Record skip event for ML training
        // This is a lightweight record - the actual penalty is calculated by the ML model
        const skipPenalty = data.earlySkip ? WEIGHTS.SKIP * 1.5 : WEIGHTS.SKIP;

        // Store skip event in listen history (we'll look up the track later if needed)
        set((state) => {
          const event: ListenEvent = {
            trackId,
            timestamp: Date.now(),
            duration: data.skipPosition * 1000, // Convert back to ms
            totalDuration: data.skipPosition / data.skipPercentage * 1000,
            completed: false,
            skipped: true,
          };

          // Add to history
          const newHistory = [event, ...state.listenHistory].slice(0, 1000);

          return {
            listenHistory: newHistory,
            lastUpdated: Date.now(),
          };
        });

        console.debug('[RecommendationStore] Recorded skip:', {
          trackId,
          skipPercentage: `${(data.skipPercentage * 100).toFixed(1)}%`,
          earlySkip: data.earlySkip,
          penalty: skipPenalty,
        });
      },

      recordReorder: (track, fromIndex, toIndex) => {
        // Moving a track UP (to earlier position) = user wants it sooner = positive signal
        // Moving a track DOWN = user wants it later = slight negative signal
        const positionChange = fromIndex - toIndex;
        const isPromotion = positionChange > 0;
        // Scale strength based on how many positions moved (max 15 points)
        const strength = Math.min(Math.abs(positionChange) * 2, 15);

        set((state) => {
          const artistPrefs = { ...state.userProfile.artistPreferences };
          const genrePrefs = { ...state.userProfile.genrePreferences };

          // Update artist preferences
          for (const artist of extractArtistIds(track)) {
            const existing = artistPrefs[artist.id] || {
              artistId: artist.id,
              artistName: artist.name,
              score: 0,
              playCount: 0,
              totalListenTime: 0,
              likeCount: 0,
              dislikeCount: 0,
            };

            const scoreChange = isPromotion ? strength : -strength * 0.3;
            artistPrefs[artist.id] = {
              ...existing,
              score: normalizeScore(existing.score + scoreChange),
            };
          }

          // Update genre preferences (smaller effect)
          for (const genre of extractGenres(track)) {
            const existing = genrePrefs[genre] || {
              genre,
              score: 0,
              playCount: 0,
              likeCount: 0,
              dislikeCount: 0,
            };

            const scoreChange = isPromotion ? strength * 0.5 : -strength * 0.15;
            genrePrefs[genre] = {
              ...existing,
              score: normalizeScore(existing.score + scoreChange),
            };
          }

          return {
            userProfile: {
              ...state.userProfile,
              artistPreferences: artistPrefs,
              genrePreferences: genrePrefs,
            },
            lastUpdated: Date.now(),
          };
        });
      },

      removeDislike: (trackId) => {
        set((state) => {
          const { [trackId]: removed, ...rest } = state.dislikedTracks;
          return { dislikedTracks: rest };
        });
      },

      isDisliked: (trackId) => {
        return trackId in get().dislikedTracks;
      },

      getDislikeReasons: (trackId) => {
        const disliked = get().dislikedTracks[trackId];
        return disliked ? disliked.reasons : null;
      },

      // ==========================================
      // Recommendation Actions
      // ==========================================

      calculateTrackScore: (track, context = {}) => {
        const state = get();
        const { userProfile, dislikedTracks, listenHistory } = state;
        const hour = context.hour ?? getHourOfDay();

        // If disliked, heavily penalize
        if (dislikedTracks[track.id]) {
          const dislike = dislikedTracks[track.id]!;
          let penalty = WEIGHTS.DISLIKE_BASE;
          for (const reason of dislike.reasons) {
            penalty *= WEIGHTS.DISLIKE_REASON_MULTIPLIERS[reason] || 1;
          }
          // Apply decay - dislike weight decreases over time
          const days = daysSince(dislike.timestamp);
          penalty = applyDecay(penalty, days, 0.99);
          return penalty;
        }

        let score = 50; // Base neutral score

        // Artist preference scoring
        const artistIds = extractArtistIds(track);
        for (const artist of artistIds) {
          const pref = userProfile.artistPreferences[artist.id];
          if (pref) {
            score += (pref.score / 100) * WEIGHTS.ARTIST_SIMILARITY;
          }
        }

        // Genre preference scoring
        const genres = extractGenres(track);
        for (const genre of genres) {
          const pref = userProfile.genrePreferences[genre];
          if (pref) {
            score += (pref.score / 100) * WEIGHTS.GENRE_SIMILARITY;
          }
        }

        // Temporal scoring - boost if genre matches current hour patterns
        const hourPattern = userProfile.timePatterns[hour];
        if (hourPattern && Object.keys(hourPattern.genres).length > 0) {
          const totalPlays = Object.values(hourPattern.genres).reduce((a, b) => a + b, 0);
          for (const genre of genres) {
            const genrePlays = hourPattern.genres[genre] || 0;
            const genreRatio = genrePlays / totalPlays;
            score += genreRatio * WEIGHTS.TEMPORAL_MATCH;
          }
        }

        // Duration preference scoring
        const { preferredDuration } = userProfile;
        if (track.duration >= preferredDuration.min && track.duration <= preferredDuration.max) {
          score += WEIGHTS.DURATION_SIMILARITY;
        }

        // Recent listen penalty (avoid repeating recently played)
        const recentListens = listenHistory
          .filter(e => e.trackId === track.id)
          .slice(0, 5);
        for (const listen of recentListens) {
          const hoursSince = (Date.now() - listen.timestamp) / (1000 * 60 * 60);
          if (hoursSince < 1) score -= 20;
          else if (hoursSince < 24) score -= 10;
          else if (hoursSince < 72) score -= 5;
        }

        // Freshness bonus for unplayed tracks
        if (recentListens.length === 0) {
          score += 5;
        }

        return normalizeScore(score);
      },

      getRecommendedTracks: (candidates, limit = 20, context = {}) => {
        const state = get();
        const { calculateTrackScore, dislikedTracks } = state;

        // Filter out disliked tracks
        const filtered = candidates.filter(t => !dislikedTracks[t.id]);

        // Score and sort
        const scored = filtered.map(track => ({
          track,
          score: calculateTrackScore(track, context),
        }));

        scored.sort((a, b) => b.score - a.score);

        return scored.slice(0, limit).map(s => s.track);
      },

      getMLEnhancedRecommendations: (candidates, limit = 20, context = {}) => {
        // This method delegates to the ML store for hybrid scoring
        // Import is done lazily to avoid circular dependencies
        const { useMLStore } = require('./ml-store');
        const mlStore = useMLStore.getState();

        return mlStore.getHybridRecommendations(candidates, limit, context.hour);
      },

      getTopGenres: (limit = 5) => {
        const { genrePreferences } = get().userProfile;
        return Object.values(genrePreferences)
          .filter(g => g.playCount > 0)
          .sort((a, b) => b.score - a.score)
          .slice(0, limit)
          .map(g => g.genre);
      },

      getTopArtists: (limit = 5) => {
        const { artistPreferences } = get().userProfile;
        return Object.values(artistPreferences)
          .filter(a => a.playCount > 0)
          .sort((a, b) => b.score - a.score)
          .slice(0, limit)
          .map(a => a.artistName);
      },

      getPersonalizedQueries: () => {
        const state = get();
        const topGenres = state.getTopGenres(3);
        const topArtists = state.getTopArtists(3);
        const hour = getHourOfDay();

        const queries: { id: string; title: string; query: string }[] = [];

        // Morning (6-12): Upbeat, energizing
        // Afternoon (12-18): Varied
        // Evening (18-22): Chill, relaxing
        // Night (22-6): Ambient, lo-fi

        let moodPrefix = '';
        let moodTitle = '';
        if (hour >= 6 && hour < 12) {
          moodPrefix = 'upbeat energizing';
          moodTitle = 'Morning Energy';
        } else if (hour >= 12 && hour < 18) {
          moodPrefix = 'popular trending';
          moodTitle = 'Afternoon Vibes';
        } else if (hour >= 18 && hour < 22) {
          moodPrefix = 'chill relaxing';
          moodTitle = 'Evening Wind Down';
        } else {
          moodPrefix = 'ambient calm lofi';
          moodTitle = 'Night Mode';
        }

        // Time-based mood section
        queries.push({
          id: 'mood-time',
          title: moodTitle,
          query: `${moodPrefix} ${topGenres[0] || 'music'}`,
        });

        // Top genre based
        if (topGenres.length > 0) {
          queries.push({
            id: 'top-genre',
            title: `More ${topGenres[0]}`,
            query: `${topGenres[0]} best 2024`,
          });
        }

        // Top artist based
        if (topArtists.length > 0) {
          queries.push({
            id: 'top-artist',
            title: `Because you like ${topArtists[0]}`,
            query: `${topArtists[0]} similar artists`,
          });

          queries.push({
            id: 'artist-mix',
            title: `${topArtists[0]} Radio`,
            query: `${topArtists[0]}`,
          });
        }

        // Genre mix
        if (topGenres.length >= 2) {
          queries.push({
            id: 'genre-mix',
            title: `${topGenres[0]} x ${topGenres[1]}`,
            query: `${topGenres[0]} ${topGenres[1]}`,
          });
        }

        // Discovery based on second favorite
        if (topArtists.length >= 2) {
          queries.push({
            id: 'discover-artist',
            title: `Discover: ${topArtists[1]}`,
            query: `${topArtists[1]} discography`,
          });
        }

        // Fallback sections if not enough personalization
        if (queries.length < 4) {
          queries.push(
            { id: 'trending', title: 'Trending Now', query: 'top hits 2024' },
            { id: 'chill', title: 'Chill Vibes', query: 'chill lofi beats' },
          );
        }

        return queries.slice(0, 6);
      },

      sortTracksByEnergy: (tracks, direction = 'asc') => {
        return [...tracks].sort((a, b) => {
          const moodA = calculateTrackMood(a);
          const moodB = calculateTrackMood(b);
          return direction === 'asc'
            ? moodA.energy - moodB.energy
            : moodB.energy - moodA.energy;
        });
      },

      // ==========================================
      // Profile Actions
      // ==========================================

      updateUserProfile: () => {
        const state = get();
        const { listenHistory, userProfile } = state;

        // Calculate preferred duration from history
        const durations = listenHistory
          .filter(e => e.completed)
          .map(e => e.totalDuration);

        if (durations.length >= WEIGHTS.MIN_LISTENS_FOR_PATTERN) {
          durations.sort((a, b) => a - b);
          const p25 = durations[Math.floor(durations.length * 0.25)] || 120000;
          const p75 = durations[Math.floor(durations.length * 0.75)] || 300000;

          set({
            userProfile: {
              ...userProfile,
              preferredDuration: { min: p25, max: p75 },
              uniqueTracks: new Set(listenHistory.map(e => e.trackId)).size,
            },
          });
        }
      },

      clearHistory: () => {
        set({
          listenHistory: [],
          dislikedTracks: {},
          userProfile: initialProfile,
          lastUpdated: Date.now(),
        });
      },

      exportData: () => {
        const state = get();
        return {
          listenHistory: state.listenHistory,
          dislikedTracks: state.dislikedTracks,
          userProfile: state.userProfile,
          exportedAt: new Date().toISOString(),
        };
      },

      // ==========================================
      // Advanced Scoring Support
      // ==========================================

      /**
       * Get set of all artists the user has listened to
       */
      getArtistHistory: () => {
        const state = get();
        const artists = new Set<string>();

        // From artist preferences
        Object.keys(state.userProfile.artistPreferences).forEach(id => {
          artists.add(id.toLowerCase());
        });

        // From listen history
        state.listenHistory.forEach(event => {
          if (event.artistId) {
            artists.add(event.artistId.toLowerCase());
          }
        });

        return artists;
      },

      /**
       * Get set of all genres the user has listened to
       */
      getGenreHistory: () => {
        const state = get();
        const genres = new Set<string>();

        // From genre preferences
        Object.keys(state.userProfile.genrePreferences).forEach(genre => {
          genres.add(genre.toLowerCase());
        });

        // From time patterns
        state.userProfile.timePatterns.forEach(pattern => {
          Object.keys(pattern.genres).forEach(genre => {
            genres.add(genre.toLowerCase());
          });
        });

        return genres;
      },

      /**
       * Get time patterns in format needed by advanced scoring
       */
      getTimePatternsForScoring: () => {
        const state = get();
        const patterns = new Map<number, { genres: Record<string, number>; energy: number }>();

        // Initialize all hours
        for (let h = 0; h < 24; h++) {
          patterns.set(h, { genres: {}, energy: 0.5 });
        }

        // Populate from user profile time patterns
        state.userProfile.timePatterns.forEach(tp => {
          const energyMap: Record<string, number> = { low: 0.3, medium: 0.5, high: 0.75 };
          patterns.set(tp.hour, {
            genres: tp.genres,
            energy: energyMap[tp.energy] || 0.5,
          });
        });

        // Enhance with recent listen history
        state.listenHistory.slice(0, 200).forEach(event => {
          const hour = new Date(event.timestamp).getHours();
          const pattern = patterns.get(hour)!;

          // Update genre counts
          if (event.genres) {
            for (const genre of event.genres) {
              const g = genre.toLowerCase();
              pattern.genres[g] = (pattern.genres[g] || 0) + 1;
            }
          }
        });

        return patterns;
      },

      /**
       * Get play counts for tracks
       */
      getPlayCounts: () => {
        const state = get();
        const counts = new Map<string, number>();

        state.listenHistory.forEach(event => {
          counts.set(event.trackId, (counts.get(event.trackId) || 0) + 1);
        });

        return counts;
      },
    }),
    {
      name: 'audiio-recommendations',
      partialize: (state) => ({
        listenHistory: state.listenHistory.slice(0, 500), // Limit persisted history
        dislikedTracks: state.dislikedTracks,
        userProfile: state.userProfile,
        lastUpdated: state.lastUpdated,
      }),
    }
  )
);
