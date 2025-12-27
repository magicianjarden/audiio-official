/**
 * Stats Store - Aggregates listening statistics for the stats dashboard
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { UnifiedTrack } from '@audiio/core';

export interface ListenEntry {
  trackId: string;
  artistId: string;
  artistName: string;
  genre: string;
  duration: number; // seconds
  timestamp: number;
  completed: boolean;
}

export interface ArtistStats {
  artistId: string;
  artistName: string;
  artwork?: string;
  playCount: number;
  totalDuration: number; // seconds
  lastPlayed: number;
}

export interface GenreStats {
  genre: string;
  playCount: number;
  totalDuration: number;
}

export interface DailyStats {
  date: string; // YYYY-MM-DD
  playCount: number;
  totalDuration: number;
  uniqueTracks: number;
  uniqueArtists: number;
}

export interface HourlyDistribution {
  hour: number; // 0-23
  playCount: number;
}

export interface DayOfWeekDistribution {
  day: number; // 0-6 (Sunday = 0)
  playCount: number;
}

export interface StatsSnapshot {
  period: 'week' | 'month' | 'year' | 'all';
  totalListenTime: number; // seconds
  totalTracks: number;
  uniqueTracks: number;
  uniqueArtists: number;
  topArtists: ArtistStats[];
  topGenres: GenreStats[];
  dailyStats: DailyStats[];
  hourlyDistribution: HourlyDistribution[];
  dayOfWeekDistribution: DayOfWeekDistribution[];
  currentStreak: number; // days
  longestStreak: number;
}

interface StatsState {
  /** All listen entries */
  listenHistory: ListenEntry[];
  /** Cached stats by period */
  cachedStats: Partial<Record<'week' | 'month' | 'year' | 'all', StatsSnapshot>>;
  /** When the cache was last updated */
  cacheTimestamp: number;

  // Actions
  recordListen: (track: UnifiedTrack, duration: number, completed: boolean) => void;
  getStats: (period: 'week' | 'month' | 'year' | 'all') => StatsSnapshot;
  clearHistory: () => void;
}

// Period boundaries in milliseconds
const PERIODS = {
  week: 7 * 24 * 60 * 60 * 1000,
  month: 30 * 24 * 60 * 60 * 1000,
  year: 365 * 24 * 60 * 60 * 1000,
  all: Infinity,
};

function calculateStats(entries: ListenEntry[], period: 'week' | 'month' | 'year' | 'all'): StatsSnapshot {
  const now = Date.now();
  const cutoff = period === 'all' ? 0 : now - PERIODS[period];

  // Filter entries by period
  const filtered = entries.filter(e => e.timestamp >= cutoff);

  // Aggregate artists
  const artistMap = new Map<string, ArtistStats>();
  for (const entry of filtered) {
    const existing = artistMap.get(entry.artistId);
    if (existing) {
      existing.playCount++;
      existing.totalDuration += entry.duration;
      existing.lastPlayed = Math.max(existing.lastPlayed, entry.timestamp);
    } else {
      artistMap.set(entry.artistId, {
        artistId: entry.artistId,
        artistName: entry.artistName,
        playCount: 1,
        totalDuration: entry.duration,
        lastPlayed: entry.timestamp,
      });
    }
  }

  // Aggregate genres
  const genreMap = new Map<string, GenreStats>();
  for (const entry of filtered) {
    if (!entry.genre) continue;
    const existing = genreMap.get(entry.genre);
    if (existing) {
      existing.playCount++;
      existing.totalDuration += entry.duration;
    } else {
      genreMap.set(entry.genre, {
        genre: entry.genre,
        playCount: 1,
        totalDuration: entry.duration,
      });
    }
  }

  // Daily stats
  const dailyMap = new Map<string, DailyStats>();
  const tracksByDay = new Map<string, Set<string>>();
  const artistsByDay = new Map<string, Set<string>>();

  for (const entry of filtered) {
    const date = new Date(entry.timestamp).toISOString().split('T')[0];
    const existing = dailyMap.get(date);

    if (!tracksByDay.has(date)) tracksByDay.set(date, new Set());
    if (!artistsByDay.has(date)) artistsByDay.set(date, new Set());

    tracksByDay.get(date)!.add(entry.trackId);
    artistsByDay.get(date)!.add(entry.artistId);

    if (existing) {
      existing.playCount++;
      existing.totalDuration += entry.duration;
      existing.uniqueTracks = tracksByDay.get(date)!.size;
      existing.uniqueArtists = artistsByDay.get(date)!.size;
    } else {
      dailyMap.set(date, {
        date,
        playCount: 1,
        totalDuration: entry.duration,
        uniqueTracks: 1,
        uniqueArtists: 1,
      });
    }
  }

  // Hourly distribution
  const hourly = Array.from({ length: 24 }, (_, i) => ({ hour: i, playCount: 0 }));
  for (const entry of filtered) {
    const hour = new Date(entry.timestamp).getHours();
    hourly[hour].playCount++;
  }

  // Day of week distribution
  const dayOfWeek = Array.from({ length: 7 }, (_, i) => ({ day: i, playCount: 0 }));
  for (const entry of filtered) {
    const day = new Date(entry.timestamp).getDay();
    dayOfWeek[day].playCount++;
  }

  // Calculate streaks
  const sortedDates = Array.from(dailyMap.keys()).sort();
  let currentStreak = 0;
  let longestStreak = 0;
  let tempStreak = 0;

  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  // Check if today or yesterday was listened to
  const lastListenDate = sortedDates[sortedDates.length - 1];
  const isActiveStreak = lastListenDate === today || lastListenDate === yesterday;

  for (let i = 0; i < sortedDates.length; i++) {
    if (i === 0) {
      tempStreak = 1;
    } else {
      const prevDate = new Date(sortedDates[i - 1]);
      const currDate = new Date(sortedDates[i]);
      const diffDays = Math.round((currDate.getTime() - prevDate.getTime()) / (24 * 60 * 60 * 1000));

      if (diffDays === 1) {
        tempStreak++;
      } else {
        tempStreak = 1;
      }
    }
    longestStreak = Math.max(longestStreak, tempStreak);

    // If this date is the last listen date and we have an active streak
    if (sortedDates[i] === lastListenDate && isActiveStreak) {
      currentStreak = tempStreak;
    }
  }

  // Calculate totals
  const uniqueTracks = new Set(filtered.map(e => e.trackId)).size;
  const uniqueArtists = artistMap.size;
  const totalListenTime = filtered.reduce((sum, e) => sum + e.duration, 0);

  // Sort and limit top lists
  const topArtists = Array.from(artistMap.values())
    .sort((a, b) => b.playCount - a.playCount)
    .slice(0, 10);

  const topGenres = Array.from(genreMap.values())
    .sort((a, b) => b.playCount - a.playCount)
    .slice(0, 10);

  const dailyStats = Array.from(dailyMap.values())
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-30); // Last 30 days

  return {
    period,
    totalListenTime,
    totalTracks: filtered.length,
    uniqueTracks,
    uniqueArtists,
    topArtists,
    topGenres,
    dailyStats,
    hourlyDistribution: hourly,
    dayOfWeekDistribution: dayOfWeek,
    currentStreak,
    longestStreak,
  };
}

export const useStatsStore = create<StatsState>()(
  persist(
    (set, get) => ({
      listenHistory: [],
      cachedStats: {},
      cacheTimestamp: 0,

      recordListen: (track, duration, completed) => {
        const entry: ListenEntry = {
          trackId: track.id,
          artistId: track.artists[0]?.id || 'unknown',
          artistName: track.artists[0]?.name || 'Unknown Artist',
          genre: track.genre || 'Unknown',
          duration,
          timestamp: Date.now(),
          completed,
        };

        set(state => ({
          listenHistory: [...state.listenHistory, entry].slice(-5000), // Keep last 5000 entries
          cachedStats: {}, // Invalidate cache
          cacheTimestamp: 0,
        }));
      },

      getStats: (period) => {
        const state = get();
        const cacheAge = Date.now() - state.cacheTimestamp;

        // Use cache if less than 5 minutes old
        if (cacheAge < 5 * 60 * 1000 && state.cachedStats[period]) {
          return state.cachedStats[period]!;
        }

        // Calculate fresh stats
        const stats = calculateStats(state.listenHistory, period);

        // Update cache
        set(state => ({
          cachedStats: { ...state.cachedStats, [period]: stats },
          cacheTimestamp: Date.now(),
        }));

        return stats;
      },

      clearHistory: () => {
        set({ listenHistory: [], cachedStats: {}, cacheTimestamp: 0 });
      },
    }),
    {
      name: 'audiio-stats',
      partialize: (state) => ({
        listenHistory: state.listenHistory,
      }),
    }
  )
);

// Helper to format duration
export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

// Helper to format large numbers
export function formatNumber(num: number): string {
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`;
  }
  if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}K`;
  }
  return num.toString();
}
