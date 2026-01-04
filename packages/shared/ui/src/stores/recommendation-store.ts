/**
 * Recommendation Store - Server-backed recommendation system
 *
 * This store provides access to user preference data and recommendations
 * from the server. ALL data is stored on the server - the client only
 * caches data for UI rendering.
 *
 * Key principle: The server is the source of truth for:
 * - Listen history
 * - Likes/dislikes
 * - User profile & preferences
 * - ML-based recommendations
 */

import { create } from 'zustand';
import type { UnifiedTrack } from '@audiio/core';

// ============================================
// Types
// ============================================

export type DislikeReason =
  // Track-specific
  | 'not_my_taste'
  | 'heard_too_much'
  | 'wrong_version'
  | 'too_repetitive'
  // Artist-specific
  | 'dont_like_artist'
  | 'skip_artist'
  // Mood/Context
  | 'wrong_mood'
  | 'too_intense'
  | 'too_mellow'
  | 'bad_recommendation'
  // Technical/Quality
  | 'bad_audio_quality'
  | 'wrong_tempo'
  // Duration
  | 'too_long'
  | 'too_short'
  // Content
  | 'explicit_content'
  | 'offensive_content'
  // Other
  | 'other';

export type DislikeCategory = 'track' | 'artist' | 'mood' | 'quality' | 'content';

export interface DislikeReasonOption {
  value: DislikeReason;
  label: string;
  category: DislikeCategory;
  description?: string;
  mlWeight?: number;
}

export const DISLIKE_REASONS: DislikeReasonOption[] = [
  // Track-specific (most common)
  { value: 'not_my_taste', label: "Not for me", category: 'track', description: "Just not my style" },
  { value: 'heard_too_much', label: "Overplayed", category: 'track', description: "I've heard this too many times" },
  { value: 'too_repetitive', label: "Too repetitive", category: 'track', description: "Gets boring/monotonous" },
  { value: 'wrong_version', label: "Wrong version", category: 'track', description: "Prefer a different mix/remix" },

  // Artist-specific
  { value: 'dont_like_artist', label: "Not this artist", category: 'artist', description: "Don't enjoy this artist", mlWeight: 0.8 },
  { value: 'skip_artist', label: "Hide this artist", category: 'artist', description: "Never show me this artist", mlWeight: 1.0 },

  // Mood/Context
  { value: 'wrong_mood', label: "Wrong vibe", category: 'mood', description: "Doesn't fit my current mood" },
  { value: 'too_intense', label: "Too intense", category: 'mood', description: "Too energetic/heavy right now" },
  { value: 'too_mellow', label: "Too mellow", category: 'mood', description: "Too slow/calm right now" },
  { value: 'bad_recommendation', label: "Bad suggestion", category: 'mood', description: "Doesn't match what I'm listening to", mlWeight: 0.6 },

  // Quality/Technical
  { value: 'bad_audio_quality', label: "Bad quality", category: 'quality', description: "Audio sounds poor" },
  { value: 'wrong_tempo', label: "Wrong tempo", category: 'quality', description: "Speed doesn't fit", mlWeight: 0.7 },
  { value: 'too_long', label: "Too long", category: 'quality', mlWeight: 0.5 },
  { value: 'too_short', label: "Too short", category: 'quality', mlWeight: 0.5 },

  // Content
  { value: 'explicit_content', label: "Explicit", category: 'content', description: "Contains explicit content" },
  { value: 'offensive_content', label: "Offensive", category: 'content', description: "Content I find offensive" },

  // Other
  { value: 'other', label: "Other", category: 'track', description: "Some other reason" },
];

// Category labels for grouping in UI
export const DISLIKE_CATEGORIES: Record<DislikeCategory, string> = {
  track: "This Track",
  artist: "The Artist",
  mood: "Current Mood",
  quality: "Quality & Length",
  content: "Content"
};

export interface ListenEvent {
  trackId: string;
  timestamp: number;
  duration: number;
  totalDuration: number;
  completed: boolean;
  skipped: boolean;
}

export interface DislikedTrack {
  trackId: string;
  reasons: DislikeReason[];
  timestamp: number;
  track: UnifiedTrack;
  trackData: {
    title: string;
    artists: string[];
    genres?: string[];
  };
}

export interface ArtistPreference {
  artistId: string;
  artistName: string;
  score: number;
  playCount: number;
  totalListenTime: number;
  likeCount: number;
  dislikeCount: number;
}

export interface GenrePreference {
  genre: string;
  score: number;
  playCount: number;
  likeCount: number;
  dislikeCount: number;
}

export interface TimePattern {
  hour: number;
  genres: Record<string, number>;
  energy: 'low' | 'medium' | 'high';
}

export interface UserProfile {
  artistPreferences: Record<string, ArtistPreference>;
  genrePreferences: Record<string, GenrePreference>;
  timePatterns: TimePattern[];
  avgSessionLength: number;
  preferredDuration: { min: number; max: number };
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
  energy: number;
  energyLevel: EnergyLevel;
  mood: MoodCategory;
  valence: number;
}

// Genre to energy mapping (used for local mood calculations)
export const GENRE_ENERGY_MAP: Record<string, number> = {
  'ambient': 10, 'sleep': 5, 'meditation': 5, 'new age': 15, 'classical': 20, 'drone': 10,
  'lofi': 25, 'lo-fi': 25, 'chill': 30, 'jazz': 35, 'acoustic': 30, 'folk': 35,
  'soul': 40, 'r&b': 40, 'blues': 35, 'ballad': 25,
  'pop': 55, 'indie': 50, 'alternative': 50, 'rock': 55, 'country': 45,
  'reggae': 45, 'funk': 55, 'disco': 60,
  'hip hop': 65, 'hip-hop': 65, 'rap': 70, 'electronic': 70, 'dance': 75,
  'house': 70, 'techno': 75, 'punk': 75, 'metal': 80,
  'edm': 85, 'dubstep': 85, 'drum and bass': 90, 'dnb': 90,
  'hardcore': 95, 'hardstyle': 95, 'workout': 90, 'party': 85,
};

// ============================================
// Store Interface
// ============================================

interface RecommendationState {
  // Cached data from server (NOT persisted locally)
  dislikedTracks: Record<string, DislikedTrack>;
  userProfile: UserProfile | null;
  isLoading: boolean;
  lastFetched: number;
  error: string | null;

  // Actions - Tracking (all send to server)
  recordListen: (track: UnifiedTrack, duration: number, completed: boolean, skipped: boolean) => Promise<void>;
  recordDislike: (track: UnifiedTrack, reasons: DislikeReason[]) => Promise<void>;
  recordSkip: (trackId: string, data: { skipPosition: number; skipPercentage: number; earlySkip: boolean }) => Promise<void>;
  recordReorder: (track: UnifiedTrack, fromIndex: number, toIndex: number) => Promise<void>;
  removeDislike: (trackId: string) => Promise<void>;

  // Actions - Query
  isDisliked: (trackId: string) => boolean;
  getDislikeReasons: (trackId: string) => DislikeReason[] | null;

  // Actions - Recommendations (from server)
  calculateTrackScore: (track: UnifiedTrack, context?: { hour?: number }) => Promise<number>;
  getRecommendedTracks: (candidates: UnifiedTrack[], limit?: number, context?: { hour?: number }) => Promise<UnifiedTrack[]>;
  getMLEnhancedRecommendations: (candidates: UnifiedTrack[], limit?: number, context?: { hour?: number }) => Promise<UnifiedTrack[]>;
  getTopGenres: (limit?: number) => string[];
  getTopArtists: (limit?: number) => string[];
  getPersonalizedQueries: () => { id: string; title: string; query: string }[];
  sortTracksByEnergy: (tracks: UnifiedTrack[], direction?: 'asc' | 'desc') => UnifiedTrack[];

  // Actions - Data fetching
  fetchUserProfile: () => Promise<void>;
  fetchDislikedTracks: () => Promise<void>;
  refreshData: () => Promise<void>;

  // Actions - Advanced Scoring Support (from cached profile)
  getArtistHistory: () => Set<string>;
  getGenreHistory: () => Set<string>;
  getTimePatternsForScoring: () => Map<number, { genres: Record<string, number>; energy: number }>;
  getPlayCounts: () => Map<string, number>;
}

// ============================================
// Helper Functions
// ============================================

function getHourOfDay(): number {
  return new Date().getHours();
}

/**
 * Calculate mood/energy score for a track based on genres and metadata
 */
export function calculateTrackMood(track: UnifiedTrack): TrackMoodScore {
  const genres = track.genres || [];

  let totalEnergy = 50;
  let genreMatches = 0;

  for (const genre of genres) {
    const normalizedGenre = genre.toLowerCase();
    for (const [key, energy] of Object.entries(GENRE_ENERGY_MAP)) {
      if (normalizedGenre.includes(key) || key.includes(normalizedGenre)) {
        totalEnergy += energy;
        genreMatches++;
        break;
      }
    }
  }

  const energy = genreMatches > 0 ? Math.round(totalEnergy / (genreMatches + 1)) : 50;

  let energyLevel: EnergyLevel;
  if (energy <= 20) energyLevel = 'very-low';
  else if (energy <= 40) energyLevel = 'low';
  else if (energy <= 60) energyLevel = 'medium';
  else if (energy <= 80) energyLevel = 'high';
  else energyLevel = 'very-high';

  let mood: MoodCategory;
  if (energy <= 15) mood = 'calm';
  else if (energy <= 35) mood = 'chill';
  else if (energy <= 55) mood = 'neutral';
  else if (energy <= 75) mood = 'upbeat';
  else if (energy <= 90) mood = 'energetic';
  else mood = 'intense';

  const valence = energy > 50 ? Math.min(energy + 10, 100) : Math.max(energy - 10, 0);

  return { energy, energyLevel, mood, valence };
}

// ============================================
// Default Profile
// ============================================

const defaultProfile: UserProfile = {
  artistPreferences: {},
  genrePreferences: {},
  timePatterns: Array.from({ length: 24 }, (_, i) => ({
    hour: i,
    genres: {},
    energy: 'medium' as const
  })),
  avgSessionLength: 0,
  preferredDuration: { min: 120000, max: 300000 },
  totalListens: 0,
  totalListenTime: 0,
  uniqueArtists: 0,
  uniqueTracks: 0,
};

// ============================================
// Store Implementation (NO PERSIST - data is on server)
// ============================================

export const useRecommendationStore = create<RecommendationState>()((set, get) => ({
  // Initial state - empty until fetched from server
  dislikedTracks: {},
  userProfile: null,
  isLoading: false,
  lastFetched: 0,
  error: null,

  // ==========================================
  // Tracking Actions - All send to server
  // ==========================================

  recordListen: async (track, duration, completed, skipped) => {
    try {
      // Send to server via IPC
      if (window.api?.trackEvent) {
        await window.api.trackEvent({
          type: completed ? 'complete' : skipped ? 'skip' : 'play',
          trackId: track.id,
          trackData: {
            title: track.title,
            artists: track.artists?.map(a => a.name) || [],
            genres: track.genres || [],
            duration: track.duration,
          },
          position: 0,
          duration: Math.round(duration / 1000),
          percentage: track.duration > 0 ? duration / track.duration : 0,
          source: 'playback',
        });
      }
    } catch (error) {
      console.error('[RecommendationStore] Failed to record listen:', error);
    }
  },

  recordDislike: async (track, reasons) => {
    try {
      // Send to server
      if (window.api?.dislikeTrack) {
        await window.api.dislikeTrack(track, reasons);
      }

      // Update local cache optimistically
      const disliked: DislikedTrack = {
        trackId: track.id,
        reasons,
        timestamp: Date.now(),
        track,
        trackData: {
          title: track.title,
          artists: track.artists.map(a => a.name),
          genres: track.genres || [],
        },
      };

      set((state) => ({
        dislikedTracks: {
          ...state.dislikedTracks,
          [track.id]: disliked,
        },
      }));
    } catch (error) {
      console.error('[RecommendationStore] Failed to record dislike:', error);
    }
  },

  recordSkip: async (trackId, data) => {
    try {
      if (window.api?.trackEvent) {
        await window.api.trackEvent({
          type: 'skip',
          trackId,
          position: data.skipPosition,
          percentage: data.skipPercentage,
          metadata: { earlySkip: data.earlySkip },
        });
      }
    } catch (error) {
      console.error('[RecommendationStore] Failed to record skip:', error);
    }
  },

  recordReorder: async (track, fromIndex, toIndex) => {
    try {
      if (window.api?.trackEvent) {
        await window.api.trackEvent({
          type: 'reorder',
          trackId: track.id,
          metadata: { fromIndex, toIndex },
        });
      }
    } catch (error) {
      console.error('[RecommendationStore] Failed to record reorder:', error);
    }
  },

  removeDislike: async (trackId) => {
    try {
      if (window.api?.removeDislike) {
        await window.api.removeDislike(trackId);
      }

      // Update local cache
      set((state) => {
        const { [trackId]: removed, ...rest } = state.dislikedTracks;
        return { dislikedTracks: rest };
      });
    } catch (error) {
      console.error('[RecommendationStore] Failed to remove dislike:', error);
    }
  },

  isDisliked: (trackId) => {
    return trackId in get().dislikedTracks;
  },

  getDislikeReasons: (trackId) => {
    const disliked = get().dislikedTracks[trackId];
    return disliked ? disliked.reasons : null;
  },

  // ==========================================
  // Recommendations - From server
  // ==========================================

  calculateTrackScore: async (track, context = {}) => {
    try {
      if (window.api?.algoScoreTrack) {
        const result = await window.api.algoScoreTrack(track.id);
        return result?.finalScore ?? 50;
      }
    } catch (error) {
      console.error('[RecommendationStore] Score failed:', error);
    }
    return 50; // Neutral score as fallback
  },

  getRecommendedTracks: async (candidates, limit = 20, context = {}) => {
    const state = get();

    // Filter out disliked tracks locally
    const filtered = candidates.filter(t => !state.dislikedTracks[t.id]);

    try {
      // Get scores from server
      if (window.api?.algoScoreBatch) {
        const trackIds = filtered.map(t => t.id);
        const scores = await window.api.algoScoreBatch(trackIds);

        if (scores && scores.length > 0) {
          // Create map of scores
          const scoreMap = new Map<string, number>();
          scores.forEach((s: any) => {
            if (s?.trackId && typeof s.finalScore === 'number') {
              scoreMap.set(s.trackId, s.finalScore);
            }
          });

          // Sort by score
          const sorted = [...filtered].sort((a, b) => {
            const scoreA = scoreMap.get(a.id) ?? 50;
            const scoreB = scoreMap.get(b.id) ?? 50;
            return scoreB - scoreA;
          });

          return sorted.slice(0, limit);
        }
      }
    } catch (error) {
      console.error('[RecommendationStore] Get recommendations failed:', error);
    }

    // Fallback: return filtered candidates
    return filtered.slice(0, limit);
  },

  getMLEnhancedRecommendations: async (candidates, limit = 20, context = {}) => {
    // Same as getRecommendedTracks - server handles ML
    return get().getRecommendedTracks(candidates, limit, context);
  },

  getTopGenres: (limit = 5) => {
    const profile = get().userProfile;
    if (!profile?.genrePreferences) return [];

    return Object.values(profile.genrePreferences)
      .filter(g => g.playCount > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(g => g.genre);
  },

  getTopArtists: (limit = 5) => {
    const profile = get().userProfile;
    if (!profile?.artistPreferences) return [];

    return Object.values(profile.artistPreferences)
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

    // Time-based mood
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

    queries.push({
      id: 'mood-time',
      title: moodTitle,
      query: `${moodPrefix} ${topGenres[0] || 'music'}`,
    });

    if (topGenres.length > 0) {
      queries.push({
        id: 'top-genre',
        title: `More ${topGenres[0]}`,
        query: `${topGenres[0]} best 2024`,
      });
    }

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

    if (topGenres.length >= 2) {
      queries.push({
        id: 'genre-mix',
        title: `${topGenres[0]} x ${topGenres[1]}`,
        query: `${topGenres[0]} ${topGenres[1]}`,
      });
    }

    if (topArtists.length >= 2) {
      queries.push({
        id: 'discover-artist',
        title: `Discover: ${topArtists[1]}`,
        query: `${topArtists[1]} discography`,
      });
    }

    // Fallback sections
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
  // Data Fetching from Server
  // ==========================================

  fetchUserProfile: async () => {
    set({ isLoading: true, error: null });

    try {
      if (window.api?.algoGetProfile) {
        const profile = await window.api.algoGetProfile();
        if (profile) {
          set({ userProfile: profile as UserProfile, isLoading: false, lastFetched: Date.now() });
          return;
        }
      }

      // Fallback to default profile
      set({ userProfile: defaultProfile, isLoading: false });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch profile';
      console.error('[RecommendationStore] Fetch profile failed:', message);
      set({ error: message, isLoading: false, userProfile: defaultProfile });
    }
  },

  fetchDislikedTracks: async () => {
    try {
      if (window.api?.getDislikedTracks) {
        const result = await window.api.getDislikedTracks();
        if (result?.tracks) {
          const dislikedMap: Record<string, DislikedTrack> = {};
          for (const item of result.tracks) {
            if (item?.track?.id) {
              dislikedMap[item.track.id] = {
                trackId: item.track.id,
                reasons: item.reasons || ['not_my_taste'],
                timestamp: item.timestamp || Date.now(),
                track: item.track,
                trackData: {
                  title: item.track.title,
                  artists: item.track.artists?.map((a: any) => a.name) || [],
                  genres: item.track.genres || [],
                },
              };
            }
          }
          set({ dislikedTracks: dislikedMap });
        }
      }
    } catch (error) {
      console.error('[RecommendationStore] Fetch dislikes failed:', error);
    }
  },

  refreshData: async () => {
    const state = get();
    await Promise.all([
      state.fetchUserProfile(),
      state.fetchDislikedTracks(),
    ]);
  },

  // ==========================================
  // Advanced Scoring Support (from cached profile)
  // ==========================================

  getArtistHistory: () => {
    const profile = get().userProfile;
    if (!profile) return new Set<string>();

    return new Set(
      Object.keys(profile.artistPreferences).map(id => id.toLowerCase())
    );
  },

  getGenreHistory: () => {
    const profile = get().userProfile;
    if (!profile) return new Set<string>();

    const genres = new Set<string>();
    Object.keys(profile.genrePreferences).forEach(genre => {
      genres.add(genre.toLowerCase());
    });

    profile.timePatterns?.forEach(pattern => {
      Object.keys(pattern.genres).forEach(genre => {
        genres.add(genre.toLowerCase());
      });
    });

    return genres;
  },

  getTimePatternsForScoring: () => {
    const profile = get().userProfile;
    const patterns = new Map<number, { genres: Record<string, number>; energy: number }>();

    for (let h = 0; h < 24; h++) {
      patterns.set(h, { genres: {}, energy: 0.5 });
    }

    if (profile?.timePatterns) {
      const energyMap: Record<string, number> = { low: 0.3, medium: 0.5, high: 0.75 };
      profile.timePatterns.forEach(tp => {
        patterns.set(tp.hour, {
          genres: tp.genres,
          energy: energyMap[tp.energy] || 0.5,
        });
      });
    }

    return patterns;
  },

  getPlayCounts: () => {
    // Play counts come from server stats - return empty for now
    // The server handles this via its ML scoring
    return new Map<string, number>();
  },
}));
