/**
 * Tracking Service - Comprehensive event collection and storage
 *
 * Captures all user interactions for:
 * - Statistics and analytics
 * - ML training data
 * - Personalization
 */

import Database from 'better-sqlite3';
import { nanoid } from 'nanoid';
import { EventEmitter } from 'events';

// ========================================
// Event Types
// ========================================

export type TrackingEventType =
  // Session events
  | 'session_start'
  | 'session_end'
  // Playback events
  | 'play_start'
  | 'play_complete'
  | 'play_pause'
  | 'play_resume'
  | 'skip'
  | 'seek'
  | 'volume_change'
  | 'repeat_toggle'
  | 'shuffle_toggle'
  // Queue events
  | 'queue_add'
  | 'queue_remove'
  | 'queue_reorder'
  | 'queue_clear'
  | 'queue_play'
  // Library events
  | 'like'
  | 'unlike'
  | 'dislike'
  | 'remove_dislike'
  | 'playlist_create'
  | 'playlist_delete'
  | 'playlist_add'
  | 'playlist_remove'
  // Discovery events
  | 'search'
  | 'search_result_click'
  | 'recommendation_shown'
  | 'recommendation_click'
  | 'recommendation_skip'
  // Navigation events
  | 'artist_view'
  | 'album_view'
  | 'playlist_view'
  | 'genre_view'
  // Feature events
  | 'lyrics_view'
  | 'lyrics_scroll'
  | 'share'
  | 'download_start'
  | 'download_complete';

export interface TrackingEvent {
  id?: string;
  type: TrackingEventType;
  timestamp: number;
  sessionId: string;
  deviceId?: string;
  trackId?: string;
  trackData?: TrackData;
  position?: number;       // Playback position in ms
  duration?: number;       // Track duration in ms
  percentage?: number;     // Completion percentage
  source?: EventSource;
  metadata?: Record<string, unknown>;
}

export interface TrackData {
  id: string;
  title?: string;
  artist?: string;
  artistId?: string;
  album?: string;
  albumId?: string;
  duration?: number;
  genres?: string[];
  source?: string;
  [key: string]: unknown;
}

export type EventSource =
  | 'queue'
  | 'search'
  | 'recommendation'
  | 'playlist'
  | 'album'
  | 'artist'
  | 'radio'
  | 'liked'
  | 'history'
  | 'discover'
  | 'mix'
  | 'external';

export interface TrackingSession {
  id: string;
  startTime: number;
  endTime?: number;
  deviceId?: string;
  deviceType?: string;
  deviceName?: string;
  trackCount: number;
  totalListenTime: number;  // ms
  skipCount: number;
  likeCount: number;
  dislikeCount: number;
}

export interface SessionSummary {
  id: string;
  duration: number;
  tracksPlayed: number;
  uniqueTracks: number;
  skipRate: number;
  averageListenPercentage: number;
  topArtists: string[];
  topGenres: string[];
}

// ========================================
// Tracking Service
// ========================================

export class TrackingService extends EventEmitter {
  private db: Database.Database;
  private currentSessions: Map<string, TrackingSession> = new Map();

  constructor(db: Database.Database) {
    super();
    this.db = db;
    this.initializeTables();
  }

  private initializeTables(): void {
    // Tracking events table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS tracking_events (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        session_id TEXT NOT NULL,
        device_id TEXT,
        track_id TEXT,
        track_data TEXT,
        position INTEGER,
        duration INTEGER,
        percentage REAL,
        source TEXT,
        metadata TEXT,
        created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
      )
    `);

    // Sessions table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS tracking_sessions (
        id TEXT PRIMARY KEY,
        start_time INTEGER NOT NULL,
        end_time INTEGER,
        device_id TEXT,
        device_type TEXT,
        device_name TEXT,
        track_count INTEGER DEFAULT 0,
        total_listen_time INTEGER DEFAULT 0,
        skip_count INTEGER DEFAULT 0,
        like_count INTEGER DEFAULT 0,
        dislike_count INTEGER DEFAULT 0
      )
    `);

    // Daily aggregates for fast stats queries
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS stats_daily (
        date TEXT PRIMARY KEY,
        play_count INTEGER DEFAULT 0,
        total_duration INTEGER DEFAULT 0,
        unique_tracks INTEGER DEFAULT 0,
        unique_artists INTEGER DEFAULT 0,
        unique_albums INTEGER DEFAULT 0,
        skip_count INTEGER DEFAULT 0,
        like_count INTEGER DEFAULT 0,
        dislike_count INTEGER DEFAULT 0,
        search_count INTEGER DEFAULT 0,
        top_genres TEXT,
        top_artists TEXT,
        top_tracks TEXT,
        hourly_distribution TEXT,
        updated_at INTEGER
      )
    `);

    // Track play counts for quick lookups
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS track_stats (
        track_id TEXT PRIMARY KEY,
        track_data TEXT,
        play_count INTEGER DEFAULT 0,
        total_listen_time INTEGER DEFAULT 0,
        skip_count INTEGER DEFAULT 0,
        complete_count INTEGER DEFAULT 0,
        last_played INTEGER,
        first_played INTEGER,
        average_completion REAL DEFAULT 0
      )
    `);

    // Artist stats
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS artist_stats (
        artist_id TEXT PRIMARY KEY,
        artist_name TEXT,
        play_count INTEGER DEFAULT 0,
        total_listen_time INTEGER DEFAULT 0,
        track_count INTEGER DEFAULT 0,
        last_played INTEGER,
        first_played INTEGER
      )
    `);

    // Indexes for performance
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_events_timestamp ON tracking_events(timestamp DESC);
      CREATE INDEX IF NOT EXISTS idx_events_session ON tracking_events(session_id);
      CREATE INDEX IF NOT EXISTS idx_events_type ON tracking_events(type);
      CREATE INDEX IF NOT EXISTS idx_events_track ON tracking_events(track_id);
      CREATE INDEX IF NOT EXISTS idx_sessions_start ON tracking_sessions(start_time DESC);
      CREATE INDEX IF NOT EXISTS idx_track_stats_plays ON track_stats(play_count DESC);
      CREATE INDEX IF NOT EXISTS idx_artist_stats_plays ON artist_stats(play_count DESC);
    `);

    console.log('[TrackingService] Tables initialized');
  }

  // ========================================
  // Session Management
  // ========================================

  /**
   * Start or get existing session
   */
  startSession(deviceId?: string, deviceType?: string, deviceName?: string): TrackingSession {
    const id = nanoid();
    const session: TrackingSession = {
      id,
      startTime: Date.now(),
      deviceId,
      deviceType,
      deviceName,
      trackCount: 0,
      totalListenTime: 0,
      skipCount: 0,
      likeCount: 0,
      dislikeCount: 0
    };

    // Store in database
    this.db.prepare(`
      INSERT INTO tracking_sessions (id, start_time, device_id, device_type, device_name)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, session.startTime, deviceId, deviceType, deviceName);

    // Keep in memory for quick updates
    this.currentSessions.set(id, session);

    // Record session start event
    this.recordEvent({
      type: 'session_start',
      timestamp: session.startTime,
      sessionId: id,
      deviceId
    });

    console.log(`[TrackingService] Session started: ${id}`);
    return session;
  }

  /**
   * End a session
   */
  endSession(sessionId: string): SessionSummary | null {
    const session = this.currentSessions.get(sessionId);
    if (!session) {
      // Try to load from database
      const row = this.db.prepare('SELECT * FROM tracking_sessions WHERE id = ?').get(sessionId) as any;
      if (!row) return null;
    }

    const endTime = Date.now();

    // Update database
    this.db.prepare(`
      UPDATE tracking_sessions
      SET end_time = ?
      WHERE id = ?
    `).run(endTime, sessionId);

    // Record session end event
    this.recordEvent({
      type: 'session_end',
      timestamp: endTime,
      sessionId,
      metadata: { duration: session ? endTime - session.startTime : 0 }
    });

    // Generate summary
    const summary = this.getSessionSummary(sessionId);

    // Remove from memory
    this.currentSessions.delete(sessionId);

    console.log(`[TrackingService] Session ended: ${sessionId}`);
    return summary;
  }

  /**
   * Get session summary
   */
  getSessionSummary(sessionId: string): SessionSummary | null {
    const session = this.db.prepare(`
      SELECT * FROM tracking_sessions WHERE id = ?
    `).get(sessionId) as any;

    if (!session) return null;

    // Get events for this session
    const events = this.db.prepare(`
      SELECT * FROM tracking_events
      WHERE session_id = ? AND type IN ('play_start', 'play_complete', 'skip')
    `).all(sessionId) as any[];

    const uniqueTracks = new Set<string>();
    const artists: Record<string, number> = {};
    const genres: Record<string, number> = {};
    let totalCompletion = 0;
    let completionCount = 0;

    for (const event of events) {
      if (event.track_id) uniqueTracks.add(event.track_id);
      if (event.track_data) {
        const track = JSON.parse(event.track_data);
        if (track.artist) {
          artists[track.artist] = (artists[track.artist] || 0) + 1;
        }
        if (track.genres) {
          for (const genre of track.genres) {
            genres[genre] = (genres[genre] || 0) + 1;
          }
        }
      }
      if (event.percentage != null) {
        totalCompletion += event.percentage;
        completionCount++;
      }
    }

    const duration = (session.end_time || Date.now()) - session.start_time;
    const skipRate = session.track_count > 0
      ? session.skip_count / session.track_count
      : 0;

    return {
      id: sessionId,
      duration,
      tracksPlayed: session.track_count,
      uniqueTracks: uniqueTracks.size,
      skipRate,
      averageListenPercentage: completionCount > 0 ? totalCompletion / completionCount : 0,
      topArtists: Object.entries(artists)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name]) => name),
      topGenres: Object.entries(genres)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name]) => name)
    };
  }

  // ========================================
  // Event Recording
  // ========================================

  /**
   * Record a single tracking event
   */
  recordEvent(event: TrackingEvent): void {
    const id = event.id || nanoid();
    const timestamp = event.timestamp || Date.now();

    this.db.prepare(`
      INSERT INTO tracking_events
      (id, type, timestamp, session_id, device_id, track_id, track_data, position, duration, percentage, source, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      event.type,
      timestamp,
      event.sessionId,
      event.deviceId || null,
      event.trackId || null,
      event.trackData ? JSON.stringify(event.trackData) : null,
      event.position ?? null,
      event.duration ?? null,
      event.percentage ?? null,
      event.source || null,
      event.metadata ? JSON.stringify(event.metadata) : null
    );

    // Update session stats
    this.updateSessionStats(event);

    // Update track stats
    if (event.trackId && event.trackData) {
      this.updateTrackStats(event);
    }

    // Update artist stats
    if (event.trackData?.artist) {
      this.updateArtistStats(event);
    }

    // Emit for ML training
    this.emit('event', { ...event, id, timestamp });

    // Update daily aggregates periodically (every 10 events)
    const count = this.db.prepare('SELECT COUNT(*) as c FROM tracking_events WHERE date(timestamp/1000, "unixepoch") = date("now")').get() as { c: number };
    if (count.c % 10 === 0) {
      this.updateDailyAggregates();
    }
  }

  /**
   * Record multiple events in batch
   */
  recordBatch(events: TrackingEvent[]): void {
    const insert = this.db.prepare(`
      INSERT INTO tracking_events
      (id, type, timestamp, session_id, device_id, track_id, track_data, position, duration, percentage, source, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const transaction = this.db.transaction(() => {
      for (const event of events) {
        const id = event.id || nanoid();
        const timestamp = event.timestamp || Date.now();

        insert.run(
          id,
          event.type,
          timestamp,
          event.sessionId,
          event.deviceId || null,
          event.trackId || null,
          event.trackData ? JSON.stringify(event.trackData) : null,
          event.position ?? null,
          event.duration ?? null,
          event.percentage ?? null,
          event.source || null,
          event.metadata ? JSON.stringify(event.metadata) : null
        );

        // Update stats
        this.updateSessionStats(event);
        if (event.trackId && event.trackData) {
          this.updateTrackStats(event);
        }
        if (event.trackData?.artist) {
          this.updateArtistStats(event);
        }

        // Emit for ML
        this.emit('event', { ...event, id, timestamp });
      }
    });

    transaction();
    this.updateDailyAggregates();
  }

  // ========================================
  // Stats Updates
  // ========================================

  private updateSessionStats(event: TrackingEvent): void {
    const session = this.currentSessions.get(event.sessionId);
    if (!session) return;

    switch (event.type) {
      case 'play_start':
        session.trackCount++;
        break;
      case 'skip':
        session.skipCount++;
        break;
      case 'like':
        session.likeCount++;
        break;
      case 'dislike':
        session.dislikeCount++;
        break;
      case 'play_complete':
      case 'play_pause':
        if (event.position) {
          session.totalListenTime += event.position;
        }
        break;
    }

    // Persist updates periodically
    if (session.trackCount % 5 === 0) {
      this.db.prepare(`
        UPDATE tracking_sessions
        SET track_count = ?, total_listen_time = ?, skip_count = ?, like_count = ?, dislike_count = ?
        WHERE id = ?
      `).run(
        session.trackCount,
        session.totalListenTime,
        session.skipCount,
        session.likeCount,
        session.dislikeCount,
        session.id
      );
    }
  }

  private updateTrackStats(event: TrackingEvent): void {
    if (!event.trackId) return;

    const now = Date.now();
    const trackData = event.trackData ? JSON.stringify(event.trackData) : null;

    // Upsert track stats
    const existing = this.db.prepare('SELECT * FROM track_stats WHERE track_id = ?').get(event.trackId) as any;

    if (!existing) {
      this.db.prepare(`
        INSERT INTO track_stats (track_id, track_data, first_played, last_played)
        VALUES (?, ?, ?, ?)
      `).run(event.trackId, trackData, now, now);
    }

    switch (event.type) {
      case 'play_start':
        this.db.prepare(`
          UPDATE track_stats
          SET play_count = play_count + 1, last_played = ?, track_data = COALESCE(?, track_data)
          WHERE track_id = ?
        `).run(now, trackData, event.trackId);
        break;

      case 'play_complete':
        this.db.prepare(`
          UPDATE track_stats
          SET complete_count = complete_count + 1,
              total_listen_time = total_listen_time + ?,
              average_completion = (average_completion * complete_count + ?) / (complete_count + 1)
          WHERE track_id = ?
        `).run(event.position || 0, event.percentage || 100, event.trackId);
        break;

      case 'skip':
        this.db.prepare(`
          UPDATE track_stats
          SET skip_count = skip_count + 1,
              total_listen_time = total_listen_time + ?,
              average_completion = (average_completion * (play_count - skip_count) + ?) / (play_count - skip_count + 1)
          WHERE track_id = ?
        `).run(event.position || 0, event.percentage || 0, event.trackId);
        break;
    }
  }

  private updateArtistStats(event: TrackingEvent): void {
    if (!event.trackData?.artist) return;

    const artistId = event.trackData.artistId || event.trackData.artist.toLowerCase().replace(/\s+/g, '-');
    const artistName = event.trackData.artist;
    const now = Date.now();

    // Upsert artist stats
    const existing = this.db.prepare('SELECT * FROM artist_stats WHERE artist_id = ?').get(artistId) as any;

    if (!existing) {
      this.db.prepare(`
        INSERT INTO artist_stats (artist_id, artist_name, first_played, last_played, track_count)
        VALUES (?, ?, ?, ?, 1)
      `).run(artistId, artistName, now, now);
    }

    if (event.type === 'play_start') {
      this.db.prepare(`
        UPDATE artist_stats
        SET play_count = play_count + 1, last_played = ?
        WHERE artist_id = ?
      `).run(now, artistId);
    }

    if (event.type === 'play_complete' || event.type === 'skip') {
      this.db.prepare(`
        UPDATE artist_stats
        SET total_listen_time = total_listen_time + ?
        WHERE artist_id = ?
      `).run(event.position || 0, artistId);
    }
  }

  private updateDailyAggregates(): void {
    const today = new Date().toISOString().split('T')[0];
    const startOfDay = new Date(today).getTime();
    const endOfDay = startOfDay + 24 * 60 * 60 * 1000;

    // Get today's events
    const events = this.db.prepare(`
      SELECT * FROM tracking_events
      WHERE timestamp >= ? AND timestamp < ?
    `).all(startOfDay, endOfDay) as any[];

    const playEvents = events.filter(e => e.type === 'play_start');
    const skipEvents = events.filter(e => e.type === 'skip');
    const likeEvents = events.filter(e => e.type === 'like');
    const dislikeEvents = events.filter(e => e.type === 'dislike');
    const searchEvents = events.filter(e => e.type === 'search');

    // Calculate unique tracks, artists, albums
    const uniqueTracks = new Set<string>();
    const uniqueArtists = new Set<string>();
    const uniqueAlbums = new Set<string>();
    const genreCounts: Record<string, number> = {};
    const artistCounts: Record<string, number> = {};
    const trackCounts: Record<string, { count: number; data: any }> = {};
    const hourlyDistribution: number[] = new Array(24).fill(0);

    let totalDuration = 0;

    for (const event of playEvents) {
      if (event.track_id) uniqueTracks.add(event.track_id);
      if (event.track_data) {
        const track = JSON.parse(event.track_data);
        if (track.artist) {
          uniqueArtists.add(track.artist);
          artistCounts[track.artist] = (artistCounts[track.artist] || 0) + 1;
        }
        if (track.album) uniqueAlbums.add(track.album);
        if (track.genres) {
          for (const genre of track.genres) {
            genreCounts[genre] = (genreCounts[genre] || 0) + 1;
          }
        }
        if (event.track_id) {
          if (!trackCounts[event.track_id]) {
            trackCounts[event.track_id] = { count: 0, data: track };
          }
          trackCounts[event.track_id].count++;
        }
      }
      if (event.duration) totalDuration += event.duration;

      // Hourly distribution
      const hour = new Date(event.timestamp).getHours();
      hourlyDistribution[hour]++;
    }

    // Sort and get top items
    const topGenres = Object.entries(genreCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([genre, count]) => ({ genre, count }));

    const topArtists = Object.entries(artistCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([artist, count]) => ({ artist, count }));

    const topTracks = Object.entries(trackCounts)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 10)
      .map(([id, { count, data }]) => ({ id, count, title: data.title, artist: data.artist }));

    // Upsert daily aggregate
    this.db.prepare(`
      INSERT INTO stats_daily
      (date, play_count, total_duration, unique_tracks, unique_artists, unique_albums,
       skip_count, like_count, dislike_count, search_count,
       top_genres, top_artists, top_tracks, hourly_distribution, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(date) DO UPDATE SET
        play_count = excluded.play_count,
        total_duration = excluded.total_duration,
        unique_tracks = excluded.unique_tracks,
        unique_artists = excluded.unique_artists,
        unique_albums = excluded.unique_albums,
        skip_count = excluded.skip_count,
        like_count = excluded.like_count,
        dislike_count = excluded.dislike_count,
        search_count = excluded.search_count,
        top_genres = excluded.top_genres,
        top_artists = excluded.top_artists,
        top_tracks = excluded.top_tracks,
        hourly_distribution = excluded.hourly_distribution,
        updated_at = excluded.updated_at
    `).run(
      today,
      playEvents.length,
      totalDuration,
      uniqueTracks.size,
      uniqueArtists.size,
      uniqueAlbums.size,
      skipEvents.length,
      likeEvents.length,
      dislikeEvents.length,
      searchEvents.length,
      JSON.stringify(topGenres),
      JSON.stringify(topArtists),
      JSON.stringify(topTracks),
      JSON.stringify(hourlyDistribution),
      Date.now()
    );
  }

  // ========================================
  // Query Methods
  // ========================================

  /**
   * Get events for a time range
   */
  getEvents(options: {
    startTime?: number;
    endTime?: number;
    types?: TrackingEventType[];
    sessionId?: string;
    trackId?: string;
    limit?: number;
    offset?: number;
  } = {}): TrackingEvent[] {
    let query = 'SELECT * FROM tracking_events WHERE 1=1';
    const params: any[] = [];

    if (options.startTime) {
      query += ' AND timestamp >= ?';
      params.push(options.startTime);
    }
    if (options.endTime) {
      query += ' AND timestamp <= ?';
      params.push(options.endTime);
    }
    if (options.types && options.types.length > 0) {
      query += ` AND type IN (${options.types.map(() => '?').join(',')})`;
      params.push(...options.types);
    }
    if (options.sessionId) {
      query += ' AND session_id = ?';
      params.push(options.sessionId);
    }
    if (options.trackId) {
      query += ' AND track_id = ?';
      params.push(options.trackId);
    }

    query += ' ORDER BY timestamp DESC';

    if (options.limit) {
      query += ' LIMIT ?';
      params.push(options.limit);
    }
    if (options.offset) {
      query += ' OFFSET ?';
      params.push(options.offset);
    }

    const rows = this.db.prepare(query).all(...params) as any[];

    return rows.map(row => ({
      id: row.id,
      type: row.type,
      timestamp: row.timestamp,
      sessionId: row.session_id,
      deviceId: row.device_id,
      trackId: row.track_id,
      trackData: row.track_data ? JSON.parse(row.track_data) : undefined,
      position: row.position,
      duration: row.duration,
      percentage: row.percentage,
      source: row.source,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined
    }));
  }

  /**
   * Get recent sessions
   */
  getSessions(limit: number = 10): TrackingSession[] {
    const rows = this.db.prepare(`
      SELECT * FROM tracking_sessions
      ORDER BY start_time DESC
      LIMIT ?
    `).all(limit) as any[];

    return rows.map(row => ({
      id: row.id,
      startTime: row.start_time,
      endTime: row.end_time,
      deviceId: row.device_id,
      deviceType: row.device_type,
      deviceName: row.device_name,
      trackCount: row.track_count,
      totalListenTime: row.total_listen_time,
      skipCount: row.skip_count,
      likeCount: row.like_count,
      dislikeCount: row.dislike_count
    }));
  }

  /**
   * Get event count for ML training trigger
   */
  getEventCountSince(timestamp: number): number {
    const result = this.db.prepare(`
      SELECT COUNT(*) as count FROM tracking_events
      WHERE timestamp >= ?
      AND type IN ('play_start', 'play_complete', 'skip', 'like', 'dislike', 'queue_add')
    `).get(timestamp) as { count: number };

    return result.count;
  }

  /**
   * Get training data for ML
   */
  getTrainingData(limit: number = 10000): {
    plays: any[];
    skips: any[];
    likes: any[];
    dislikes: any[];
  } {
    const plays = this.db.prepare(`
      SELECT track_id, track_data, position, duration, percentage, source, timestamp
      FROM tracking_events
      WHERE type = 'play_complete' AND track_data IS NOT NULL
      ORDER BY timestamp DESC
      LIMIT ?
    `).all(limit) as any[];

    const skips = this.db.prepare(`
      SELECT track_id, track_data, position, duration, percentage, source, timestamp
      FROM tracking_events
      WHERE type = 'skip' AND track_data IS NOT NULL
      ORDER BY timestamp DESC
      LIMIT ?
    `).all(limit) as any[];

    const likes = this.db.prepare(`
      SELECT track_id, track_data, timestamp
      FROM tracking_events
      WHERE type = 'like' AND track_data IS NOT NULL
      ORDER BY timestamp DESC
      LIMIT ?
    `).all(limit) as any[];

    const dislikes = this.db.prepare(`
      SELECT track_id, track_data, metadata, timestamp
      FROM tracking_events
      WHERE type = 'dislike' AND track_data IS NOT NULL
      ORDER BY timestamp DESC
      LIMIT ?
    `).all(limit) as any[];

    return {
      plays: plays.map(p => ({ ...p, track_data: JSON.parse(p.track_data) })),
      skips: skips.map(s => ({ ...s, track_data: JSON.parse(s.track_data) })),
      likes: likes.map(l => ({ ...l, track_data: JSON.parse(l.track_data) })),
      dislikes: dislikes.map(d => ({
        ...d,
        track_data: JSON.parse(d.track_data),
        metadata: d.metadata ? JSON.parse(d.metadata) : undefined
      }))
    };
  }
}
