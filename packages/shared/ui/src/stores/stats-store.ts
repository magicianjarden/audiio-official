/**
 * Stats Store - Server-backed listening statistics
 *
 * All statistics are stored on the server. This store:
 * - Fetches stats from the server for display
 * - Sends tracking events to the server
 * - Caches stats locally for rendering (not persisted)
 */

import { create } from 'zustand';
import type { UnifiedTrack } from '@audiio/core';

export interface ListenEntry {
  trackId: string;
  trackTitle: string;
  artistId: string;
  artistName: string;
  albumId?: string;
  albumTitle?: string;
  artwork?: string;
  genre: string;
  duration: number;
  totalDuration?: number;
  timestamp: number;
  completed: boolean;
  skipped: boolean;
}

export interface ArtistStats {
  artistId: string;
  artistName: string;
  artwork?: string;
  playCount: number;
  totalDuration: number;
  lastPlayed: number;
}

export interface GenreStats {
  genre: string;
  playCount: number;
  totalDuration: number;
}

export interface DailyStats {
  date: string;
  playCount: number;
  totalDuration: number;
  uniqueTracks: number;
  uniqueArtists: number;
}

export interface HourlyDistribution {
  hour: number;
  playCount: number;
}

export interface DayOfWeekDistribution {
  day: number;
  playCount: number;
}

export interface StatsSnapshot {
  period: 'week' | 'month' | 'year' | 'all';
  totalListenTime: number;
  totalTracks: number;
  uniqueTracks: number;
  uniqueArtists: number;
  topArtists: ArtistStats[];
  topGenres: GenreStats[];
  dailyStats: DailyStats[];
  hourlyDistribution: HourlyDistribution[];
  dayOfWeekDistribution: DayOfWeekDistribution[];
  currentStreak: number;
  longestStreak: number;
}

interface StatsState {
  /** Cached stats by period */
  cachedStats: Partial<Record<'week' | 'month' | 'year' | 'all', StatsSnapshot>>;
  /** When the cache was last updated */
  cacheTimestamp: number;
  /** Loading state */
  isLoading: boolean;
  /** Error state */
  error: string | null;
  /** Recent listen history from server */
  listenHistory: ListenEntry[];
  /** Skip stats from server */
  skipStats: { totalSkips: number; earlySkips: number; avgSkipPosition: number };

  // Actions
  recordListen: (track: UnifiedTrack, duration: number, completed: boolean, skipped?: boolean) => Promise<void>;
  recordSkip: (track: UnifiedTrack, listenedDuration: number, totalDuration: number) => Promise<void>;
  getStats: (period: 'week' | 'month' | 'year' | 'all') => StatsSnapshot;
  fetchStats: (period: 'week' | 'month' | 'year' | 'all') => Promise<StatsSnapshot>;
  getSkipStats: () => { totalSkips: number; earlySkips: number; avgSkipPosition: number };
  fetchListenHistory: () => Promise<void>;
  clearHistory: () => Promise<void>;
}

// Default empty stats
function getEmptyStats(period: 'week' | 'month' | 'year' | 'all'): StatsSnapshot {
  return {
    period,
    totalListenTime: 0,
    totalTracks: 0,
    uniqueTracks: 0,
    uniqueArtists: 0,
    topArtists: [],
    topGenres: [],
    dailyStats: [],
    hourlyDistribution: Array.from({ length: 24 }, (_, hour) => ({ hour, playCount: 0 })),
    dayOfWeekDistribution: Array.from({ length: 7 }, (_, day) => ({ day, playCount: 0 })),
    currentStreak: 0,
    longestStreak: 0,
  };
}

export const useStatsStore = create<StatsState>()((set, get) => ({
  cachedStats: {},
  cacheTimestamp: 0,
  isLoading: false,
  error: null,
  listenHistory: [],
  skipStats: { totalSkips: 0, earlySkips: 0, avgSkipPosition: 0 },

  /**
   * Record a listen event - sends to server
   */
  recordListen: async (track, duration, completed, skipped = false) => {
    try {
      if (window.api?.trackEvent) {
        await window.api.trackEvent({
          type: completed ? 'complete' : skipped ? 'skip' : 'play',
          trackId: track.id,
          trackData: {
            title: track.title,
            artists: track.artists?.map(a => a.name) || [],
            genres: track.genres || [],
            duration: track.duration,
            albumTitle: track.album?.title,
          },
          position: 0,
          duration: duration,
          percentage: track.duration > 0 ? (duration / track.duration) * 100 : 0,
          source: 'playback',
        });
      }

      // Invalidate cache
      set({ cachedStats: {}, cacheTimestamp: 0 });
    } catch (error) {
      console.error('[StatsStore] Failed to record listen:', error);
    }
  },

  /**
   * Record a skip event - sends to server
   */
  recordSkip: async (track, listenedDuration, totalDuration) => {
    try {
      if (window.api?.trackEvent) {
        await window.api.trackEvent({
          type: 'skip',
          trackId: track.id,
          trackData: {
            title: track.title,
            artists: track.artists?.map(a => a.name) || [],
            genres: track.genres || [],
            duration: track.duration,
          },
          position: listenedDuration,
          duration: listenedDuration,
          percentage: totalDuration > 0 ? (listenedDuration / totalDuration) * 100 : 0,
          source: 'playback',
        });
      }

      // Invalidate cache
      set({ cachedStats: {}, cacheTimestamp: 0 });
    } catch (error) {
      console.error('[StatsStore] Failed to record skip:', error);
    }
  },

  /**
   * Get stats - returns cached stats (call fetchStats separately via useEffect)
   * This does NOT trigger fetches to avoid setState during render
   */
  getStats: (period) => {
    const state = get();
    // Return cached or empty stats - no async fetch here to avoid setState during render
    return state.cachedStats[period] || getEmptyStats(period);
  },

  /**
   * Fetch stats from server
   */
  fetchStats: async (period) => {
    set({ isLoading: true, error: null });

    try {
      if (window.api?.getStats) {
        const serverStats = await window.api.getStats(period);

        if (serverStats) {
          const stats: StatsSnapshot = {
            period,
            totalListenTime: serverStats.totalListenTime || 0,
            totalTracks: serverStats.totalTracks || 0,
            uniqueTracks: serverStats.uniqueTracks || 0,
            uniqueArtists: serverStats.uniqueArtists || 0,
            topArtists: serverStats.topArtists || [],
            topGenres: serverStats.topGenres || [],
            dailyStats: serverStats.dailyStats || [],
            hourlyDistribution: serverStats.hourlyDistribution ||
              Array.from({ length: 24 }, (_, hour) => ({ hour, playCount: 0 })),
            dayOfWeekDistribution: serverStats.dayOfWeekDistribution ||
              Array.from({ length: 7 }, (_, day) => ({ day, playCount: 0 })),
            currentStreak: serverStats.currentStreak || 0,
            longestStreak: serverStats.longestStreak || 0,
          };

          set(state => ({
            cachedStats: { ...state.cachedStats, [period]: stats },
            cacheTimestamp: Date.now(),
            isLoading: false,
          }));

          return stats;
        }
      }

      // Return empty stats if server doesn't respond
      const empty = getEmptyStats(period);
      set({ isLoading: false });
      return empty;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch stats';
      console.error('[StatsStore] Fetch stats failed:', message);
      set({ isLoading: false, error: message });
      return getEmptyStats(period);
    }
  },

  /**
   * Get skip stats - returns cached skip stats
   */
  getSkipStats: () => {
    return get().skipStats;
  },

  /**
   * Fetch listen history from server
   */
  fetchListenHistory: async () => {
    try {
      if (window.api?.getListenHistory) {
        const result = await window.api.getListenHistory(50); // Last 50 entries
        if (result?.entries) {
          const entries: ListenEntry[] = result.entries.map((e: any) => ({
            trackId: e.trackId || '',
            trackTitle: e.trackTitle || e.trackData?.title || 'Unknown Track',
            artistId: e.artistId || e.trackData?.artists?.[0] || '',
            artistName: e.artistName || e.trackData?.artists?.[0] || 'Unknown Artist',
            albumId: e.albumId,
            albumTitle: e.albumTitle,
            artwork: e.artwork,
            genre: e.genre || e.trackData?.genres?.[0] || '',
            duration: e.duration || 0,
            totalDuration: e.totalDuration || e.trackData?.duration || 0,
            timestamp: e.timestamp || Date.now(),
            completed: e.completed ?? e.type === 'complete',
            skipped: e.skipped ?? e.type === 'skip',
          }));

          // Calculate skip stats from history
          const skipped = entries.filter(e => e.skipped);
          const earlySkips = skipped.filter(e => e.duration < (e.totalDuration || 0) * 0.3);
          const avgSkipPos = skipped.length > 0
            ? skipped.reduce((sum, e) => sum + (e.duration / (e.totalDuration || 1)), 0) / skipped.length
            : 0;

          set({
            listenHistory: entries,
            skipStats: {
              totalSkips: skipped.length,
              earlySkips: earlySkips.length,
              avgSkipPosition: avgSkipPos,
            },
          });
        }
      }
    } catch (error) {
      console.error('[StatsStore] Failed to fetch listen history:', error);
    }
  },

  /**
   * Clear history - sends request to server
   */
  clearHistory: async () => {
    try {
      if (window.api?.clearStats) {
        await window.api.clearStats();
      }

      set({
        cachedStats: {},
        cacheTimestamp: 0,
      });
    } catch (error) {
      console.error('[StatsStore] Failed to clear history:', error);
    }
  },
}));

// ============================================
// Helper Functions
// ============================================

/**
 * Format duration in seconds to human readable string
 */
export function formatDuration(seconds: number): string {
  if (!seconds || seconds < 0) return '0s';

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  }
  return `${secs}s`;
}

/**
 * Format a date for display
 */
export function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Get day name from day index
 */
export function getDayName(day: number): string {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[day] || '';
}
