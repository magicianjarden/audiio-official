/**
 * Stats Service - Statistics computation and caching
 *
 * Provides comprehensive statistics based on tracking data:
 * - Overview stats
 * - Listening patterns
 * - Top artists/genres/tracks
 * - Streaks and achievements
 */

import Database from 'better-sqlite3';

export interface OverviewStats {
  totalPlayCount: number;
  totalListenTime: number;        // ms
  totalListenTimeFormatted: string;
  uniqueTracks: number;
  uniqueArtists: number;
  uniqueAlbums: number;
  avgDailyListenTime: number;     // ms
  skipRate: number;               // 0-1
  likesCount: number;
  dislikesCount: number;
  playlistCount: number;
  topGenre?: string;
  topArtist?: string;
  currentStreak: number;          // days
  longestStreak: number;          // days
  firstListenDate?: number;
  lastActiveDate?: number;
}

export interface ListeningStats {
  period: 'day' | 'week' | 'month' | 'year' | 'all';
  playCount: number;
  listenTime: number;
  uniqueTracks: number;
  uniqueArtists: number;
  skipCount: number;
  skipRate: number;
  avgSessionLength: number;
  avgTracksPerSession: number;
  dailyData: { date: string; plays: number; duration: number }[];
}

export interface TopItem {
  id: string;
  name: string;
  count: number;
  duration: number;
  percentage: number;
  artwork?: string;
  metadata?: Record<string, unknown>;
}

export interface ListeningPattern {
  hourlyDistribution: number[];     // 24 values
  dailyDistribution: number[];      // 7 values (Sun-Sat)
  peakHour: number;
  peakDay: number;
  morningRatio: number;             // 6-12
  afternoonRatio: number;           // 12-18
  eveningRatio: number;             // 18-24
  nightRatio: number;               // 0-6
  weekdayRatio: number;
  weekendRatio: number;
}

export interface Streak {
  current: number;
  longest: number;
  lastActiveDate: string;
  streakHistory: { start: string; end: string; days: number }[];
}

export class StatsService {
  private db: Database.Database;
  private cache: Map<string, { data: any; expiry: number }> = new Map();
  private cacheTTL = 5 * 60 * 1000; // 5 minutes

  constructor(db: Database.Database) {
    this.db = db;
  }

  // ========================================
  // Overview Stats
  // ========================================

  getOverview(): OverviewStats {
    const cached = this.getFromCache<OverviewStats>('overview');
    if (cached) return cached;

    // Total play count and listen time
    const playStats = this.db.prepare(`
      SELECT
        COUNT(*) as play_count,
        COALESCE(SUM(position), 0) as total_time
      FROM tracking_events
      WHERE type = 'play_complete' OR type = 'skip'
    `).get() as { play_count: number; total_time: number };

    // Skip count
    const skipStats = this.db.prepare(`
      SELECT COUNT(*) as skip_count
      FROM tracking_events
      WHERE type = 'skip'
    `).get() as { skip_count: number };

    // Unique tracks
    const uniqueTracks = this.db.prepare(`
      SELECT COUNT(DISTINCT track_id) as count
      FROM tracking_events
      WHERE track_id IS NOT NULL
    `).get() as { count: number };

    // Unique artists from track_data
    const uniqueArtists = this.db.prepare(`
      SELECT COUNT(DISTINCT json_extract(track_data, '$.artist')) as count
      FROM tracking_events
      WHERE track_data IS NOT NULL
    `).get() as { count: number };

    // Unique albums
    const uniqueAlbums = this.db.prepare(`
      SELECT COUNT(DISTINCT json_extract(track_data, '$.album')) as count
      FROM tracking_events
      WHERE track_data IS NOT NULL AND json_extract(track_data, '$.album') IS NOT NULL
    `).get() as { count: number };

    // Library stats
    const likedCount = this.db.prepare('SELECT COUNT(*) as count FROM liked_tracks').get() as { count: number };
    const dislikedCount = this.db.prepare('SELECT COUNT(*) as count FROM disliked_tracks').get() as { count: number };
    const playlistCount = this.db.prepare('SELECT COUNT(*) as count FROM playlists').get() as { count: number };

    // Date range
    const dateRange = this.db.prepare(`
      SELECT MIN(timestamp) as first, MAX(timestamp) as last
      FROM tracking_events
    `).get() as { first: number | null; last: number | null };

    // Calculate daily average
    let avgDailyListenTime = 0;
    if (dateRange.first && dateRange.last) {
      const days = Math.max(1, Math.ceil((dateRange.last - dateRange.first) / (24 * 60 * 60 * 1000)));
      avgDailyListenTime = playStats.total_time / days;
    }

    // Top artist
    const topArtist = this.db.prepare(`
      SELECT json_extract(track_data, '$.artist') as artist, COUNT(*) as count
      FROM tracking_events
      WHERE type = 'play_start' AND track_data IS NOT NULL
      GROUP BY artist
      ORDER BY count DESC
      LIMIT 1
    `).get() as { artist: string; count: number } | undefined;

    // Top genre
    const topGenre = this.db.prepare(`
      SELECT value as genre, COUNT(*) as count
      FROM tracking_events, json_each(json_extract(track_data, '$.genres'))
      WHERE type = 'play_start' AND track_data IS NOT NULL
      GROUP BY genre
      ORDER BY count DESC
      LIMIT 1
    `).get() as { genre: string; count: number } | undefined;

    // Streaks
    const streaks = this.calculateStreaks();

    const result: OverviewStats = {
      totalPlayCount: playStats.play_count,
      totalListenTime: playStats.total_time,
      totalListenTimeFormatted: this.formatDuration(playStats.total_time),
      uniqueTracks: uniqueTracks.count,
      uniqueArtists: uniqueArtists.count,
      uniqueAlbums: uniqueAlbums.count,
      avgDailyListenTime,
      skipRate: playStats.play_count > 0 ? skipStats.skip_count / playStats.play_count : 0,
      likesCount: likedCount.count,
      dislikesCount: dislikedCount.count,
      playlistCount: playlistCount.count,
      topGenre: topGenre?.genre,
      topArtist: topArtist?.artist,
      currentStreak: streaks.current,
      longestStreak: streaks.longest,
      firstListenDate: dateRange.first ?? undefined,
      lastActiveDate: dateRange.last ?? undefined
    };

    this.setCache('overview', result);
    return result;
  }

  // ========================================
  // Listening Stats by Period
  // ========================================

  getListeningStats(period: 'day' | 'week' | 'month' | 'year' | 'all'): ListeningStats {
    const cacheKey = `listening_${period}`;
    const cached = this.getFromCache<ListeningStats>(cacheKey);
    if (cached) return cached;

    const now = Date.now();
    let startTime: number;

    switch (period) {
      case 'day':
        startTime = now - 24 * 60 * 60 * 1000;
        break;
      case 'week':
        startTime = now - 7 * 24 * 60 * 60 * 1000;
        break;
      case 'month':
        startTime = now - 30 * 24 * 60 * 60 * 1000;
        break;
      case 'year':
        startTime = now - 365 * 24 * 60 * 60 * 1000;
        break;
      case 'all':
        startTime = 0;
        break;
    }

    // Play stats
    const playStats = this.db.prepare(`
      SELECT
        COUNT(*) as play_count,
        COALESCE(SUM(position), 0) as listen_time
      FROM tracking_events
      WHERE (type = 'play_complete' OR type = 'skip')
        AND timestamp >= ?
    `).get(startTime) as { play_count: number; listen_time: number };

    // Skip count
    const skipCount = this.db.prepare(`
      SELECT COUNT(*) as count
      FROM tracking_events
      WHERE type = 'skip' AND timestamp >= ?
    `).get(startTime) as { count: number };

    // Unique tracks/artists
    const uniqueTracks = this.db.prepare(`
      SELECT COUNT(DISTINCT track_id) as count
      FROM tracking_events
      WHERE track_id IS NOT NULL AND timestamp >= ?
    `).get(startTime) as { count: number };

    const uniqueArtists = this.db.prepare(`
      SELECT COUNT(DISTINCT json_extract(track_data, '$.artist')) as count
      FROM tracking_events
      WHERE track_data IS NOT NULL AND timestamp >= ?
    `).get(startTime) as { count: number };

    // Session stats
    const sessionStats = this.db.prepare(`
      SELECT
        COUNT(*) as session_count,
        AVG(total_listen_time) as avg_length,
        AVG(track_count) as avg_tracks
      FROM tracking_sessions
      WHERE start_time >= ?
    `).get(startTime) as { session_count: number; avg_length: number; avg_tracks: number };

    // Daily data
    const dailyData = this.db.prepare(`
      SELECT
        date(timestamp/1000, 'unixepoch') as date,
        COUNT(*) as plays,
        COALESCE(SUM(position), 0) as duration
      FROM tracking_events
      WHERE (type = 'play_complete' OR type = 'skip')
        AND timestamp >= ?
      GROUP BY date
      ORDER BY date ASC
    `).all(startTime) as { date: string; plays: number; duration: number }[];

    const result: ListeningStats = {
      period,
      playCount: playStats.play_count,
      listenTime: playStats.listen_time,
      uniqueTracks: uniqueTracks.count,
      uniqueArtists: uniqueArtists.count,
      skipCount: skipCount.count,
      skipRate: playStats.play_count > 0 ? skipCount.count / playStats.play_count : 0,
      avgSessionLength: sessionStats.avg_length || 0,
      avgTracksPerSession: sessionStats.avg_tracks || 0,
      dailyData
    };

    this.setCache(cacheKey, result);
    return result;
  }

  // ========================================
  // Top Items
  // ========================================

  getTopArtists(limit: number = 10, period?: 'week' | 'month' | 'year' | 'all'): TopItem[] {
    const startTime = this.getPeriodStartTime(period);

    const rows = this.db.prepare(`
      SELECT
        json_extract(track_data, '$.artistId') as id,
        json_extract(track_data, '$.artist') as name,
        json_extract(track_data, '$.artwork') as artwork,
        COUNT(*) as count,
        COALESCE(SUM(position), 0) as duration
      FROM tracking_events
      WHERE type IN ('play_complete', 'skip')
        AND track_data IS NOT NULL
        AND timestamp >= ?
      GROUP BY name
      ORDER BY count DESC
      LIMIT ?
    `).all(startTime, limit) as any[];

    const total = rows.reduce((sum, r) => sum + r.count, 0);

    return rows.map(row => ({
      id: row.id || row.name.toLowerCase().replace(/\s+/g, '-'),
      name: row.name,
      count: row.count,
      duration: row.duration,
      percentage: total > 0 ? row.count / total : 0,
      artwork: row.artwork
    }));
  }

  getTopTracks(limit: number = 10, period?: 'week' | 'month' | 'year' | 'all'): TopItem[] {
    const startTime = this.getPeriodStartTime(period);

    const rows = this.db.prepare(`
      SELECT
        track_id as id,
        json_extract(track_data, '$.title') as name,
        json_extract(track_data, '$.artist') as artist,
        json_extract(track_data, '$.artwork') as artwork,
        COUNT(*) as count,
        COALESCE(SUM(position), 0) as duration
      FROM tracking_events
      WHERE type IN ('play_complete', 'skip')
        AND track_id IS NOT NULL
        AND track_data IS NOT NULL
        AND timestamp >= ?
      GROUP BY track_id
      ORDER BY count DESC
      LIMIT ?
    `).all(startTime, limit) as any[];

    const total = rows.reduce((sum, r) => sum + r.count, 0);

    return rows.map(row => ({
      id: row.id,
      name: row.name,
      count: row.count,
      duration: row.duration,
      percentage: total > 0 ? row.count / total : 0,
      artwork: row.artwork,
      metadata: { artist: row.artist }
    }));
  }

  getTopGenres(limit: number = 10, period?: 'week' | 'month' | 'year' | 'all'): TopItem[] {
    const startTime = this.getPeriodStartTime(period);

    const rows = this.db.prepare(`
      SELECT
        value as name,
        COUNT(*) as count
      FROM tracking_events, json_each(json_extract(track_data, '$.genres'))
      WHERE type IN ('play_complete', 'skip')
        AND track_data IS NOT NULL
        AND timestamp >= ?
      GROUP BY name
      ORDER BY count DESC
      LIMIT ?
    `).all(startTime, limit) as any[];

    const total = rows.reduce((sum, r) => sum + r.count, 0);

    return rows.map(row => ({
      id: row.name.toLowerCase().replace(/\s+/g, '-'),
      name: row.name,
      count: row.count,
      duration: 0,
      percentage: total > 0 ? row.count / total : 0
    }));
  }

  getTopAlbums(limit: number = 10, period?: 'week' | 'month' | 'year' | 'all'): TopItem[] {
    const startTime = this.getPeriodStartTime(period);

    const rows = this.db.prepare(`
      SELECT
        json_extract(track_data, '$.albumId') as id,
        json_extract(track_data, '$.album') as name,
        json_extract(track_data, '$.artist') as artist,
        json_extract(track_data, '$.artwork') as artwork,
        COUNT(*) as count,
        COALESCE(SUM(position), 0) as duration
      FROM tracking_events
      WHERE type IN ('play_complete', 'skip')
        AND track_data IS NOT NULL
        AND json_extract(track_data, '$.album') IS NOT NULL
        AND timestamp >= ?
      GROUP BY name, artist
      ORDER BY count DESC
      LIMIT ?
    `).all(startTime, limit) as any[];

    const total = rows.reduce((sum, r) => sum + r.count, 0);

    return rows.map(row => ({
      id: row.id || row.name.toLowerCase().replace(/\s+/g, '-'),
      name: row.name,
      count: row.count,
      duration: row.duration,
      percentage: total > 0 ? row.count / total : 0,
      artwork: row.artwork,
      metadata: { artist: row.artist }
    }));
  }

  // ========================================
  // Listening Patterns
  // ========================================

  getListeningPatterns(): ListeningPattern {
    const cached = this.getFromCache<ListeningPattern>('patterns');
    if (cached) return cached;

    // Hourly distribution
    const hourly = this.db.prepare(`
      SELECT
        CAST(strftime('%H', timestamp/1000, 'unixepoch') AS INTEGER) as hour,
        COUNT(*) as count
      FROM tracking_events
      WHERE type = 'play_start'
      GROUP BY hour
    `).all() as { hour: number; count: number }[];

    const hourlyDistribution = new Array(24).fill(0);
    for (const row of hourly) {
      hourlyDistribution[row.hour] = row.count;
    }

    // Daily distribution
    const daily = this.db.prepare(`
      SELECT
        CAST(strftime('%w', timestamp/1000, 'unixepoch') AS INTEGER) as day,
        COUNT(*) as count
      FROM tracking_events
      WHERE type = 'play_start'
      GROUP BY day
    `).all() as { day: number; count: number }[];

    const dailyDistribution = new Array(7).fill(0);
    for (const row of daily) {
      dailyDistribution[row.day] = row.count;
    }

    // Calculate totals and ratios
    const totalPlays = hourlyDistribution.reduce((a, b) => a + b, 0);
    if (totalPlays === 0) {
      const emptyResult: ListeningPattern = {
        hourlyDistribution,
        dailyDistribution,
        peakHour: 0,
        peakDay: 0,
        morningRatio: 0,
        afternoonRatio: 0,
        eveningRatio: 0,
        nightRatio: 0,
        weekdayRatio: 0,
        weekendRatio: 0
      };
      this.setCache('patterns', emptyResult);
      return emptyResult;
    }

    const morning = hourlyDistribution.slice(6, 12).reduce((a, b) => a + b, 0);
    const afternoon = hourlyDistribution.slice(12, 18).reduce((a, b) => a + b, 0);
    const evening = hourlyDistribution.slice(18, 24).reduce((a, b) => a + b, 0);
    const night = hourlyDistribution.slice(0, 6).reduce((a, b) => a + b, 0);

    const weekday = dailyDistribution.slice(1, 6).reduce((a, b) => a + b, 0);
    const weekend = dailyDistribution[0] + dailyDistribution[6];

    const totalDaily = dailyDistribution.reduce((a, b) => a + b, 0);

    const result: ListeningPattern = {
      hourlyDistribution,
      dailyDistribution,
      peakHour: hourlyDistribution.indexOf(Math.max(...hourlyDistribution)),
      peakDay: dailyDistribution.indexOf(Math.max(...dailyDistribution)),
      morningRatio: morning / totalPlays,
      afternoonRatio: afternoon / totalPlays,
      eveningRatio: evening / totalPlays,
      nightRatio: night / totalPlays,
      weekdayRatio: totalDaily > 0 ? weekday / totalDaily : 0,
      weekendRatio: totalDaily > 0 ? weekend / totalDaily : 0
    };

    this.setCache('patterns', result);
    return result;
  }

  // ========================================
  // Streaks
  // ========================================

  getStreaks(): Streak {
    return this.calculateStreaks();
  }

  private calculateStreaks(): Streak {
    // Get all unique listening days
    const days = this.db.prepare(`
      SELECT DISTINCT date(timestamp/1000, 'unixepoch') as date
      FROM tracking_events
      WHERE type = 'play_start'
      ORDER BY date DESC
    `).all() as { date: string }[];

    if (days.length === 0) {
      return {
        current: 0,
        longest: 0,
        lastActiveDate: '',
        streakHistory: []
      };
    }

    const today = new Date().toISOString().split('T')[0];
    const daySet = new Set(days.map(d => d.date));

    // Calculate current streak
    let currentStreak = 0;
    let checkDate = new Date(today);

    // Check if listened today
    if (daySet.has(today)) {
      currentStreak = 1;
      checkDate.setDate(checkDate.getDate() - 1);

      while (daySet.has(checkDate.toISOString().split('T')[0])) {
        currentStreak++;
        checkDate.setDate(checkDate.getDate() - 1);
      }
    } else {
      // Check yesterday
      checkDate.setDate(checkDate.getDate() - 1);
      const yesterday = checkDate.toISOString().split('T')[0];
      if (daySet.has(yesterday)) {
        currentStreak = 1;
        checkDate.setDate(checkDate.getDate() - 1);

        while (daySet.has(checkDate.toISOString().split('T')[0])) {
          currentStreak++;
          checkDate.setDate(checkDate.getDate() - 1);
        }
      }
    }

    // Calculate longest streak and history
    const sortedDays = [...daySet].sort();
    let longestStreak = 0;
    const streakHistory: { start: string; end: string; days: number }[] = [];

    if (sortedDays.length > 0) {
      let streakStart = sortedDays[0];
      let streakLength = 1;
      let prevDate = new Date(sortedDays[0]);

      for (let i = 1; i < sortedDays.length; i++) {
        const currDate = new Date(sortedDays[i]);
        const diff = (currDate.getTime() - prevDate.getTime()) / (24 * 60 * 60 * 1000);

        if (diff === 1) {
          streakLength++;
        } else {
          // Save streak if > 2 days
          if (streakLength >= 2) {
            streakHistory.push({
              start: streakStart,
              end: sortedDays[i - 1],
              days: streakLength
            });
          }
          longestStreak = Math.max(longestStreak, streakLength);
          streakStart = sortedDays[i];
          streakLength = 1;
        }
        prevDate = currDate;
      }

      // Handle final streak
      if (streakLength >= 2) {
        streakHistory.push({
          start: streakStart,
          end: sortedDays[sortedDays.length - 1],
          days: streakLength
        });
      }
      longestStreak = Math.max(longestStreak, streakLength);
    }

    return {
      current: currentStreak,
      longest: longestStreak,
      lastActiveDate: days[0]?.date || '',
      streakHistory: streakHistory.sort((a, b) => b.days - a.days).slice(0, 10)
    };
  }

  // ========================================
  // Helpers
  // ========================================

  private getPeriodStartTime(period?: 'week' | 'month' | 'year' | 'all'): number {
    const now = Date.now();
    switch (period) {
      case 'week':
        return now - 7 * 24 * 60 * 60 * 1000;
      case 'month':
        return now - 30 * 24 * 60 * 60 * 1000;
      case 'year':
        return now - 365 * 24 * 60 * 60 * 1000;
      case 'all':
      default:
        return 0;
    }
  }

  private formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return `${days}d ${hours % 24}h`;
    } else if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else {
      return `${minutes}m`;
    }
  }

  private getFromCache<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (entry && entry.expiry > Date.now()) {
      return entry.data as T;
    }
    return null;
  }

  private setCache(key: string, data: any): void {
    this.cache.set(key, {
      data,
      expiry: Date.now() + this.cacheTTL
    });
  }

  /**
   * Clear stats cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Refresh all aggregates
   */
  refreshAggregates(): void {
    this.clearCache();
    // Pre-warm cache
    this.getOverview();
    this.getListeningPatterns();
  }
}
