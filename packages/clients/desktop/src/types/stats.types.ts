/**
 * Statistics API type definitions
 */

import type { SuccessResponse, UnifiedTrack, Artist, Album, Timestamp } from './common.types';

/** Statistics period */
export type StatsPeriod = 'day' | 'week' | 'month' | 'year' | 'all';

/** Stats overview */
export interface StatsOverview {
  totalListenTime: number;      // milliseconds
  totalTracks: number;
  totalArtists: number;
  totalAlbums: number;
  totalPlays: number;
  avgDailyListenTime: number;   // milliseconds
  mostActiveHour: number;       // 0-23
  mostActiveDay: number;        // 0-6 (Sunday-Saturday)
  topGenre?: string;
  topMood?: string;
  currentStreak: number;        // days
  longestStreak: number;        // days
}

/** Top artist stats */
export interface TopArtistStat {
  artist: Artist;
  playCount: number;
  listenTime: number;           // milliseconds
  trackCount: number;
  lastPlayedAt: Timestamp;
}

/** Top track stats */
export interface TopTrackStat {
  track: UnifiedTrack;
  playCount: number;
  listenTime: number;           // milliseconds
  completionRate: number;       // 0-1
  lastPlayedAt: Timestamp;
}

/** Top album stats */
export interface TopAlbumStat {
  album: Album;
  playCount: number;
  listenTime: number;           // milliseconds
  trackCount: number;
  lastPlayedAt: Timestamp;
}

/** Top genre stats */
export interface TopGenreStat {
  genre: string;
  playCount: number;
  listenTime: number;           // milliseconds
  trackCount: number;
  artistCount: number;
}

/** Listening patterns */
export interface ListeningPatterns {
  hourlyDistribution: number[];   // 24 values (play count per hour)
  dailyDistribution: number[];    // 7 values (play count per day)
  monthlyDistribution: number[];  // 12 values (play count per month)
  genreDistribution: Record<string, number>;
  moodDistribution: Record<string, number>;
  averageSessionLength: number;   // milliseconds
  peakHour: number;               // 0-23
  peakDay: number;                // 0-6
}

/** Listening streaks */
export interface ListeningStreaks {
  current: {
    days: number;
    startDate: string;
    endDate: string;
  };
  longest: {
    days: number;
    startDate: string;
    endDate: string;
  };
  thisWeek: number;
  thisMonth: number;
}

/** Period-specific stats */
export interface PeriodStats {
  period: StatsPeriod;
  totalListenTime: number;
  totalTracks: number;
  totalPlays: number;
  uniqueArtists: number;
  uniqueAlbums: number;
  topTrack?: UnifiedTrack;
  topArtist?: Artist;
  startDate: string;
  endDate: string;
}

/** Listen history entry */
export interface ListenHistoryEntry {
  id: string;
  track: UnifiedTrack;
  playedAt: Timestamp;
  listenDuration: number;     // milliseconds
  completed: boolean;
  source?: string;
}

// Response types
export interface StatsOverviewResponse {
  overview: StatsOverview;
}

export interface StatsTopArtistsResponse {
  artists: TopArtistStat[];
}

export interface StatsTopTracksResponse {
  tracks: TopTrackStat[];
}

export interface StatsTopAlbumsResponse {
  albums: TopAlbumStat[];
}

export interface StatsTopGenresResponse {
  genres: TopGenreStat[];
}

export interface StatsPatternsResponse extends ListeningPatterns {}

export interface StatsStreaksResponse extends ListeningStreaks {}

export interface StatsPeriodResponse extends PeriodStats {}

export interface StatsListenHistoryResponse {
  entries: ListenHistoryEntry[];
  total: number;
}

export interface StatsClearResponse extends SuccessResponse {}

export interface StatsRefreshResponse extends SuccessResponse {}
