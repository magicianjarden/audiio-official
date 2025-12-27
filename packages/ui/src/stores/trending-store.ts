/**
 * Trending Store - Tracks daily trending data for discover sections
 * Caches trending tracks per day for the Weekly Rotation section
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { UnifiedTrack } from '@audiio/core';

// Trending entry for a single day
export interface DailyTrending {
  date: string; // ISO date string (YYYY-MM-DD)
  tracks: TrendingTrack[];
  fetchedAt: number;
}

// Track with trending metadata
export interface TrendingTrack {
  id: string;
  title: string;
  artist: string;
  artwork?: string;
  trendScore: number; // Computed score based on plays, searches, etc.
  changeDirection: 'up' | 'down' | 'stable' | 'new';
  previousRank?: number;
}

// Promotional banner data
export interface PromoBanner {
  id: string;
  type: 'new-release' | 'featured-artist' | 'playlist' | 'event' | 'custom';
  title: string;
  subtitle?: string;
  ctaText?: string;
  ctaAction?: string; // Route or action identifier
  backgroundImage?: string;
  backgroundColor?: string;
  gradientColors?: [string, string];
  artistId?: string;
  albumId?: string;
  playlistId?: string;
  expiresAt?: number;
  priority: number;
}

interface TrendingState {
  // Daily trending cache (last 7 days)
  dailyTrending: DailyTrending[];

  // Currently active promotional banners
  banners: PromoBanner[];

  // Search popularity tracking (for computing trends)
  searchPopularity: Map<string, number>;

  // Last update timestamps
  lastTrendingUpdate: number;
  lastBannerUpdate: number;

  // Actions
  updateDailyTrending: (date: string, tracks: TrendingTrack[]) => void;
  getTrendingForDate: (date: string) => DailyTrending | undefined;
  getWeeklyTrending: () => DailyTrending[];
  recordSearch: (query: string) => void;
  getPopularSearches: (limit?: number) => Array<{ query: string; count: number }>;

  // Banner management
  addBanner: (banner: Omit<PromoBanner, 'id'>) => void;
  removeBanner: (bannerId: string) => void;
  getActiveBanners: () => PromoBanner[];

  // Compute trending from tracks
  computeTrendingFromTracks: (tracks: UnifiedTrack[]) => TrendingTrack[];
}

// Helper to get ISO date string
function getDateString(date: Date = new Date()): string {
  return date.toISOString().split('T')[0];
}

// Helper to get dates for last N days
function getLastNDays(n: number): string[] {
  const dates: string[] = [];
  const today = new Date();
  for (let i = 0; i < n; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    dates.push(getDateString(date));
  }
  return dates;
}

// Cache duration: 6 hours
const CACHE_DURATION = 6 * 60 * 60 * 1000;

export const useTrendingStore = create<TrendingState>()(
  persist(
    (set, get) => ({
      dailyTrending: [],
      banners: [],
      searchPopularity: new Map(),
      lastTrendingUpdate: 0,
      lastBannerUpdate: 0,

      updateDailyTrending: (date, tracks) => {
        set((state) => {
          // Remove old entry for this date if exists
          const filtered = state.dailyTrending.filter((d) => d.date !== date);

          // Add new entry
          const newEntry: DailyTrending = {
            date,
            tracks,
            fetchedAt: Date.now(),
          };

          // Keep only last 7 days
          const updated = [newEntry, ...filtered].slice(0, 7);

          return {
            dailyTrending: updated,
            lastTrendingUpdate: Date.now(),
          };
        });
      },

      getTrendingForDate: (date) => {
        const { dailyTrending } = get();
        const entry = dailyTrending.find((d) => d.date === date);

        // Check if cache is still valid
        if (entry && Date.now() - entry.fetchedAt < CACHE_DURATION) {
          return entry;
        }

        return undefined;
      },

      getWeeklyTrending: () => {
        const { dailyTrending } = get();
        const lastWeek = getLastNDays(7);

        return lastWeek
          .map((date) => dailyTrending.find((d) => d.date === date))
          .filter((d): d is DailyTrending => d !== undefined);
      },

      recordSearch: (query) => {
        const normalized = query.toLowerCase().trim();
        if (normalized.length < 2) return;

        set((state) => {
          const newMap = new Map(state.searchPopularity);
          const current = newMap.get(normalized) || 0;
          newMap.set(normalized, current + 1);

          // Limit map size to prevent memory bloat
          if (newMap.size > 1000) {
            // Remove least popular entries
            const sorted = [...newMap.entries()].sort((a, b) => b[1] - a[1]);
            const trimmed = sorted.slice(0, 500);
            return { searchPopularity: new Map(trimmed) };
          }

          return { searchPopularity: newMap };
        });
      },

      getPopularSearches: (limit = 10) => {
        const { searchPopularity } = get();
        return [...searchPopularity.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, limit)
          .map(([query, count]) => ({ query, count }));
      },

      addBanner: (banner) => {
        const id = `banner-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        set((state) => ({
          banners: [...state.banners, { ...banner, id }],
          lastBannerUpdate: Date.now(),
        }));
      },

      removeBanner: (bannerId) => {
        set((state) => ({
          banners: state.banners.filter((b) => b.id !== bannerId),
        }));
      },

      getActiveBanners: () => {
        const { banners } = get();
        const now = Date.now();

        return banners
          .filter((b) => !b.expiresAt || b.expiresAt > now)
          .sort((a, b) => b.priority - a.priority);
      },

      computeTrendingFromTracks: (tracks) => {
        const { searchPopularity, dailyTrending } = get();

        // Get yesterday's trending for comparison
        const yesterday = getLastNDays(2)[1];
        const yesterdayTrending = dailyTrending.find((d) => d.date === yesterday);
        const yesterdayMap = new Map(
          yesterdayTrending?.tracks.map((t, i) => [t.id, i]) ?? []
        );

        return tracks.slice(0, 20).map((track, index): TrendingTrack => {
          // Calculate trend score based on search popularity
          const searchQuery = `${track.artists[0]?.name ?? ''} ${track.title}`.toLowerCase();
          const searchScore = searchPopularity.get(searchQuery) ?? 0;
          const trendScore = 100 - index * 5 + searchScore;

          // Determine change direction
          const previousRank = yesterdayMap.get(track.id);
          let changeDirection: TrendingTrack['changeDirection'] = 'new';

          if (previousRank !== undefined) {
            if (previousRank > index) {
              changeDirection = 'up';
            } else if (previousRank < index) {
              changeDirection = 'down';
            } else {
              changeDirection = 'stable';
            }
          }

          return {
            id: track.id,
            title: track.title,
            artist: track.artists.map((a) => a.name).join(', '),
            artwork: track.artwork?.small ?? track.artwork?.medium,
            trendScore,
            changeDirection,
            previousRank: previousRank !== undefined ? previousRank + 1 : undefined,
          };
        });
      },
    }),
    {
      name: 'audiio-trending',
      partialize: (state) => ({
        dailyTrending: state.dailyTrending.slice(0, 7), // Keep only 7 days
        banners: state.banners.filter(
          (b) => !b.expiresAt || b.expiresAt > Date.now()
        ),
        searchPopularity: Object.fromEntries(
          [...state.searchPopularity.entries()].slice(0, 200)
        ),
        lastTrendingUpdate: state.lastTrendingUpdate,
        lastBannerUpdate: state.lastBannerUpdate,
      }),
      merge: (persisted, current) => {
        const persistedState = persisted as Partial<TrendingState> & {
          searchPopularity?: Record<string, number>;
        };

        return {
          ...current,
          dailyTrending: persistedState.dailyTrending ?? [],
          banners: persistedState.banners ?? [],
          searchPopularity: new Map(
            Object.entries(persistedState.searchPopularity ?? {})
          ),
          lastTrendingUpdate: persistedState.lastTrendingUpdate ?? 0,
          lastBannerUpdate: persistedState.lastBannerUpdate ?? 0,
        };
      },
    }
  )
);

// Default promotional banners for new users
export const DEFAULT_BANNERS: Omit<PromoBanner, 'id'>[] = [
  {
    type: 'custom',
    title: 'Discover Your Sound',
    subtitle: 'Explore millions of tracks from YouTube Music',
    ctaText: 'Start Exploring',
    gradientColors: ['#1db954', '#191414'],
    priority: 100,
  },
];

// Initialize default banners on first load
export function initializeDefaultBanners() {
  const store = useTrendingStore.getState();
  if (store.banners.length === 0) {
    DEFAULT_BANNERS.forEach((banner) => store.addBanner(banner));
  }
}

export default useTrendingStore;
