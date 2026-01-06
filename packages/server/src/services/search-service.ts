/**
 * Search Service - Server-side search with natural language parsing
 *
 * Features:
 * - Natural language query parsing
 * - Audio feature filtering (energy, tempo, mood)
 * - Tag and metadata filtering
 * - Play behavior filtering
 * - Search history management
 */

import type { Database } from 'better-sqlite3';
import {
  type FeatureRange,
  type AudioFeatureQuery,
  MOOD_CRITERIA,
  TEMPO_RANGES,
  DECADE_RANGES
} from './shared-types';

// ============================================================================
// Types
// ============================================================================

// Re-export for backward compatibility
export type AudioFeatureRange = FeatureRange;
/** @deprecated Use AudioFeatureFilter instead */
export type AudioFeatures = AudioFeatureQuery;
/** Audio feature filter for search queries (different from AudioFeatures type in @audiio/core) */
export type AudioFeatureFilter = AudioFeatureQuery;

export interface PlayBehavior {
  minPlays?: number;
  maxPlays?: number;
  playedWithinDays?: number;
  neverPlayed?: boolean;
}

export interface ParsedFilter {
  type: 'artist' | 'album' | 'genre' | 'year' | 'duration' | 'tag' | 'source' | 'rating' | 'decade';
  operator: 'is' | 'contains' | 'gt' | 'lt' | 'between' | 'not';
  value: string | number | [number, number];
}

export interface ParsedQuery {
  text: string;
  filters: ParsedFilter[];
  audioFeatureFilter?: AudioFeatureFilter;
  playBehavior?: PlayBehavior;
  similarity?: {
    trackId?: string;
    artistName?: string;
  };
}

export interface SearchOptions {
  limit?: number;
  offset?: number;
  sortBy?: 'relevance' | 'title' | 'artist' | 'duration' | 'plays' | 'added';
  sortDirection?: 'asc' | 'desc';
}

export interface SearchHistoryEntry {
  id: string;
  query: string;
  timestamp: number;
  resultCount: number;
}

// ============================================================================
// Natural Language Patterns (use consolidated definitions from shared-types)
// ============================================================================

// Use MOOD_CRITERIA from shared-types as MOOD_MAPPINGS
const MOOD_MAPPINGS = MOOD_CRITERIA;

// Use TEMPO_RANGES from shared-types as TEMPO_MAPPINGS
const TEMPO_MAPPINGS: Record<string, [number, number]> = Object.fromEntries(
  Object.entries(TEMPO_RANGES).map(([key, range]) => [key, [range.min ?? 0, range.max ?? 200]])
) as Record<string, [number, number]>;

// Use DECADE_RANGES from shared-types as DECADE_MAPPINGS
const DECADE_MAPPINGS = DECADE_RANGES;

// ============================================================================
// Search Service Class
// ============================================================================

export class SearchService {
  constructor(private db: Database) {
    this.ensureSearchHistoryTable();
  }

  private ensureSearchHistoryTable(): void {
    // Check if table exists and has correct schema
    const tableInfo = this.db.prepare(`PRAGMA table_info(search_history)`).all() as Array<{ name: string }>;

    if (tableInfo.length === 0) {
      // Table doesn't exist, create it
      this.db.exec(`
        CREATE TABLE search_history (
          id TEXT PRIMARY KEY,
          query TEXT NOT NULL,
          timestamp INTEGER NOT NULL,
          result_count INTEGER DEFAULT 0
        );
        CREATE INDEX IF NOT EXISTS idx_search_history_timestamp ON search_history(timestamp DESC);
      `);
    } else {
      // Table exists, check for missing columns
      const columns = new Set(tableInfo.map(col => col.name));

      if (!columns.has('timestamp')) {
        // Old schema - drop and recreate
        this.db.exec(`DROP TABLE search_history`);
        this.db.exec(`
          CREATE TABLE search_history (
            id TEXT PRIMARY KEY,
            query TEXT NOT NULL,
            timestamp INTEGER NOT NULL,
            result_count INTEGER DEFAULT 0
          );
          CREATE INDEX IF NOT EXISTS idx_search_history_timestamp ON search_history(timestamp DESC);
        `);
      }
    }
  }

  // ============================================================================
  // Natural Language Parsing
  // ============================================================================

  /**
   * Parse a natural language query into structured filters
   */
  parseNaturalQuery(query: string): ParsedQuery {
    let remainingText = query.toLowerCase().trim();
    const filters: ParsedFilter[] = [];
    let audioFeatureFilter: AudioFeatureFilter = {};
    let playBehavior: PlayBehavior | undefined;
    let similarity: ParsedQuery['similarity'] | undefined;

    // Extract explicit filters (by:Artist, genre:rock, etc.)
    remainingText = this.extractExplicitFilters(remainingText, filters);

    // Extract mood/energy words
    const moodResult = this.extractMoodFeatures(remainingText);
    remainingText = moodResult.remaining;
    audioFeatureFilter = { ...audioFeatureFilter, ...moodResult.features };

    // Extract tempo words
    const tempoResult = this.extractTempoFeatures(remainingText);
    remainingText = tempoResult.remaining;
    if (tempoResult.features.tempo) {
      audioFeatureFilter.tempo = tempoResult.features.tempo;
    }

    // Extract decade/year
    const decadeResult = this.extractDecadeFilters(remainingText, filters);
    remainingText = decadeResult;

    // Extract duration
    const durationResult = this.extractDurationFilters(remainingText, filters);
    remainingText = durationResult;

    // Extract play behavior
    const playResult = this.extractPlayBehavior(remainingText);
    remainingText = playResult.remaining;
    playBehavior = playResult.behavior;

    // Extract similarity
    const similarResult = this.extractSimilarity(remainingText);
    remainingText = similarResult.remaining;
    similarity = similarResult.similarity;

    // Extract tags (#workout, tagged:chill)
    const tagResult = this.extractTagFilters(remainingText, filters);
    remainingText = tagResult;

    // Extract source filters (local, streaming)
    const sourceResult = this.extractSourceFilters(remainingText, filters);
    remainingText = sourceResult;

    return {
      text: remainingText.trim(),
      filters,
      audioFeatureFilter: Object.keys(audioFeatureFilter).length > 0 ? audioFeatureFilter : undefined,
      playBehavior,
      similarity,
    };
  }

  private extractExplicitFilters(text: string, filters: ParsedFilter[]): string {
    // by:Artist or by Artist
    const byPattern = /\bby[:\s]+["']?([^"'\s]+(?:\s+[^"'\s]+)*)["']?/gi;
    text = text.replace(byPattern, (_, artist) => {
      filters.push({ type: 'artist', operator: 'contains', value: artist.trim() });
      return '';
    });

    // genre:rock
    const genrePattern = /\bgenre[:\s]+["']?([^"'\s]+)["']?/gi;
    text = text.replace(genrePattern, (_, genre) => {
      filters.push({ type: 'genre', operator: 'contains', value: genre.trim() });
      return '';
    });

    // album:Name
    const albumPattern = /\balbum[:\s]+["']?([^"'\s]+(?:\s+[^"'\s]+)*)["']?/gi;
    text = text.replace(albumPattern, (_, album) => {
      filters.push({ type: 'album', operator: 'contains', value: album.trim() });
      return '';
    });

    // year:2020 or year:2020-2023
    const yearPattern = /\byear[:\s]+(\d{4})(?:\s*-\s*(\d{4}))?/gi;
    text = text.replace(yearPattern, (_, start, end) => {
      if (end) {
        filters.push({ type: 'year', operator: 'between', value: [parseInt(start), parseInt(end)] });
      } else {
        filters.push({ type: 'year', operator: 'is', value: parseInt(start) });
      }
      return '';
    });

    return text;
  }

  private extractMoodFeatures(text: string): { remaining: string; features: AudioFeatureFilter } {
    const features: AudioFeatureFilter = {};
    let remaining = text;

    for (const [mood, moodFeatures] of Object.entries(MOOD_MAPPINGS)) {
      const pattern = new RegExp(`\\b${mood}\\b`, 'gi');
      if (pattern.test(remaining)) {
        remaining = remaining.replace(pattern, '');
        // Merge features - moodFeatures has FeatureRange values
        for (const [key, value] of Object.entries(moodFeatures)) {
          const featureKey = key as keyof AudioFeatureFilter;
          if (!features[featureKey] && value) {
            (features as Record<string, unknown>)[featureKey] = value;
          }
        }
      }
    }

    return { remaining, features };
  }

  private extractTempoFeatures(text: string): { remaining: string; features: { tempo?: AudioFeatureRange } } {
    let remaining = text;
    let tempo: AudioFeatureRange | undefined;

    // Extract BPM (e.g., "120 bpm", "around 140bpm")
    const bpmPattern = /\b(?:around\s+)?(\d{2,3})\s*bpm\b/gi;
    const bpmMatch = bpmPattern.exec(remaining);
    if (bpmMatch) {
      const bpm = parseInt(bpmMatch[1]!);
      tempo = { min: bpm - 10, max: bpm + 10 };
      remaining = remaining.replace(bpmMatch[0], '');
    }

    // Extract tempo words
    for (const [word, range] of Object.entries(TEMPO_MAPPINGS)) {
      const pattern = new RegExp(`\\b${word}\\b`, 'gi');
      if (pattern.test(remaining)) {
        remaining = remaining.replace(pattern, '');
        tempo = { min: range[0], max: range[1] };
        break;
      }
    }

    return { remaining, features: tempo ? { tempo } : {} };
  }

  private extractDecadeFilters(text: string, filters: ParsedFilter[]): string {
    let remaining = text;

    for (const [decade, range] of Object.entries(DECADE_MAPPINGS)) {
      const pattern = new RegExp(`\\b${decade}\\b`, 'gi');
      if (pattern.test(remaining)) {
        remaining = remaining.replace(pattern, '');
        filters.push({ type: 'decade', operator: 'between', value: range });
        break;
      }
    }

    // "from the 80s", "from the eighties"
    const fromThePattern = /\bfrom\s+the\s+(\w+)\b/gi;
    remaining = remaining.replace(fromThePattern, (match, decade) => {
      const lowerDecade = decade.toLowerCase();
      if (DECADE_MAPPINGS[lowerDecade]) {
        filters.push({ type: 'decade', operator: 'between', value: DECADE_MAPPINGS[lowerDecade]! });
        return '';
      }
      return match;
    });

    return remaining;
  }

  private extractDurationFilters(text: string, filters: ParsedFilter[]): string {
    let remaining = text;

    // "short songs", "under 3 minutes"
    const shortPattern = /\b(?:short|under\s+(\d+)\s*(?:min(?:ute)?s?))\b/gi;
    remaining = remaining.replace(shortPattern, (_, minutes) => {
      const maxDuration = minutes ? parseInt(minutes) * 60 : 180; // default 3 min
      filters.push({ type: 'duration', operator: 'lt', value: maxDuration });
      return '';
    });

    // "long songs", "over 5 minutes"
    const longPattern = /\b(?:long|over\s+(\d+)\s*(?:min(?:ute)?s?))\b/gi;
    remaining = remaining.replace(longPattern, (_, minutes) => {
      const minDuration = minutes ? parseInt(minutes) * 60 : 300; // default 5 min
      filters.push({ type: 'duration', operator: 'gt', value: minDuration });
      return '';
    });

    return remaining;
  }

  private extractPlayBehavior(text: string): { remaining: string; behavior?: PlayBehavior } {
    let remaining = text;
    let behavior: PlayBehavior | undefined;

    // "never played", "unplayed"
    if (/\b(?:never\s+played|unplayed|not\s+played)\b/i.test(remaining)) {
      remaining = remaining.replace(/\b(?:never\s+played|unplayed|not\s+played)\b/gi, '');
      behavior = { ...behavior, neverPlayed: true };
    }

    // "recently played"
    if (/\b(?:recently\s+played|just\s+played)\b/i.test(remaining)) {
      remaining = remaining.replace(/\b(?:recently\s+played|just\s+played)\b/gi, '');
      behavior = { ...behavior, playedWithinDays: 7 };
    }

    // "most played", "top played"
    if (/\b(?:most\s+played|top\s+played|favorites?)\b/i.test(remaining)) {
      remaining = remaining.replace(/\b(?:most\s+played|top\s+played|favorites?)\b/gi, '');
      behavior = { ...behavior, minPlays: 5 };
    }

    return { remaining, behavior };
  }

  private extractSimilarity(text: string): { remaining: string; similarity?: ParsedQuery['similarity'] } {
    let remaining = text;
    let similarity: ParsedQuery['similarity'] | undefined;

    // "similar to [track/artist]", "like [artist]"
    const similarPattern = /\b(?:similar\s+to|like)\s+["']?([^"']+)["']?/gi;
    const match = similarPattern.exec(remaining);
    if (match) {
      similarity = { artistName: match[1]!.trim() };
      remaining = remaining.replace(match[0], '');
    }

    return { remaining, similarity };
  }

  private extractTagFilters(text: string, filters: ParsedFilter[]): string {
    let remaining = text;

    // #tag or tagged:tag
    const tagPattern = /(?:#(\w+)|\btagged?[:\s]+(\w+))/gi;
    remaining = remaining.replace(tagPattern, (_, hashtag, tagged) => {
      const tag = hashtag || tagged;
      filters.push({ type: 'tag', operator: 'is', value: tag });
      return '';
    });

    return remaining;
  }

  private extractSourceFilters(text: string, filters: ParsedFilter[]): string {
    let remaining = text;

    // "local", "downloaded", "offline"
    if (/\b(?:local|downloaded|offline)\b/i.test(remaining)) {
      remaining = remaining.replace(/\b(?:local|downloaded|offline)\b/gi, '');
      filters.push({ type: 'source', operator: 'is', value: 'local' });
    }

    // "streaming", "online"
    if (/\b(?:streaming|online)\b/i.test(remaining)) {
      remaining = remaining.replace(/\b(?:streaming|online)\b/gi, '');
      filters.push({ type: 'source', operator: 'not', value: 'local' });
    }

    return remaining;
  }

  // ============================================================================
  // Search Execution
  // ============================================================================

  /**
   * Execute a search with parsed query
   */
  searchTracks(parsedQuery: ParsedQuery, options: SearchOptions = {}): { trackIds: string[]; total: number } {
    const { limit = 50, offset = 0, sortBy = 'relevance', sortDirection = 'desc' } = options;

    // Build SQL query
    const conditions: string[] = [];
    const params: unknown[] = [];

    // Text search
    if (parsedQuery.text) {
      conditions.push(`(
        json_extract(track_data, '$.title') LIKE ? COLLATE NOCASE OR
        json_extract(track_data, '$.artists[0].name') LIKE ? COLLATE NOCASE OR
        json_extract(track_data, '$.album.title') LIKE ? COLLATE NOCASE
      )`);
      const searchTerm = `%${parsedQuery.text}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    // Apply filters
    for (const filter of parsedQuery.filters) {
      const condition = this.buildFilterCondition(filter, params);
      if (condition) {
        conditions.push(condition);
      }
    }

    // Apply audio features
    if (parsedQuery.audioFeatureFilter) {
      const audioConditions = this.buildAudioFeatureConditions(parsedQuery.audioFeatureFilter, params);
      conditions.push(...audioConditions);
    }

    // Apply play behavior
    if (parsedQuery.playBehavior) {
      const playConditions = this.buildPlayBehaviorConditions(parsedQuery.playBehavior, params);
      conditions.push(...playConditions);
    }

    // Build the query
    let sql = `
      SELECT DISTINCT track_id, track_data FROM (
        SELECT id as track_id, track_data FROM liked_tracks
        UNION
        SELECT track_id, track_data FROM playlist_tracks
        UNION
        SELECT track_id, track_data FROM play_history
      ) as all_tracks
    `;

    if (conditions.length > 0) {
      sql += ` WHERE ${conditions.join(' AND ')}`;
    }

    // Apply sorting
    sql += this.buildOrderBy(sortBy, sortDirection);

    // Get total count first
    const countSql = sql.replace('SELECT DISTINCT track_id, track_data', 'SELECT COUNT(DISTINCT track_id) as count');
    const countResult = this.db.prepare(countSql).get(...params) as { count: number } | undefined;
    const total = countResult?.count || 0;

    // Apply pagination
    sql += ` LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const rows = this.db.prepare(sql).all(...params) as Array<{ track_id: string }>;
    return {
      trackIds: rows.map(r => r.track_id),
      total,
    };
  }

  private buildFilterCondition(filter: ParsedFilter, params: unknown[]): string | null {
    switch (filter.type) {
      case 'artist':
        params.push(`%${filter.value}%`);
        return `json_extract(track_data, '$.artists[0].name') LIKE ? COLLATE NOCASE`;

      case 'album':
        params.push(`%${filter.value}%`);
        return `json_extract(track_data, '$.album.title') LIKE ? COLLATE NOCASE`;

      case 'genre':
        params.push(`%${filter.value}%`);
        return `json_extract(track_data, '$.genre') LIKE ? COLLATE NOCASE`;

      case 'year':
      case 'decade':
        if (filter.operator === 'between' && Array.isArray(filter.value)) {
          params.push(filter.value[0], filter.value[1]);
          return `CAST(json_extract(track_data, '$.year') AS INTEGER) BETWEEN ? AND ?`;
        } else if (filter.operator === 'is') {
          params.push(filter.value);
          return `CAST(json_extract(track_data, '$.year') AS INTEGER) = ?`;
        }
        break;

      case 'duration':
        if (filter.operator === 'lt') {
          params.push(filter.value);
          return `CAST(json_extract(track_data, '$.duration') AS INTEGER) < ?`;
        } else if (filter.operator === 'gt') {
          params.push(filter.value);
          return `CAST(json_extract(track_data, '$.duration') AS INTEGER) > ?`;
        }
        break;

      case 'tag':
        params.push(filter.value);
        return `track_id IN (SELECT track_id FROM track_tags WHERE tag_name = ?)`;

      case 'source':
        if (filter.operator === 'is' && filter.value === 'local') {
          return `json_extract(track_data, '$.source') = 'local'`;
        } else if (filter.operator === 'not' && filter.value === 'local') {
          return `json_extract(track_data, '$.source') != 'local'`;
        }
        break;
    }

    return null;
  }

  private buildAudioFeatureConditions(features: AudioFeatures, params: unknown[]): string[] {
    const conditions: string[] = [];

    // Only range-based features (excludes key/mode which are discrete values)
    const featureColumns: Partial<Record<keyof AudioFeatures, string>> = {
      energy: 'energy',
      tempo: 'tempo',
      valence: 'valence',
      danceability: 'danceability',
      acousticness: 'acousticness',
      instrumentalness: 'instrumentalness',
      speechiness: 'speechiness',
      loudness: 'loudness',
    };

    for (const [key, range] of Object.entries(features)) {
      const column = featureColumns[key as keyof AudioFeatures];
      if (!column || !range) continue;

      if (range.min !== undefined && range.max !== undefined) {
        params.push(range.min, range.max);
        conditions.push(`track_id IN (SELECT track_id FROM audio_features WHERE ${column} BETWEEN ? AND ?)`);
      } else if (range.min !== undefined) {
        params.push(range.min);
        conditions.push(`track_id IN (SELECT track_id FROM audio_features WHERE ${column} >= ?)`);
      } else if (range.max !== undefined) {
        params.push(range.max);
        conditions.push(`track_id IN (SELECT track_id FROM audio_features WHERE ${column} <= ?)`);
      }
    }

    return conditions;
  }

  private buildPlayBehaviorConditions(behavior: PlayBehavior, params: unknown[]): string[] {
    const conditions: string[] = [];

    if (behavior.neverPlayed) {
      conditions.push(`track_id NOT IN (SELECT DISTINCT track_id FROM play_history)`);
    }

    if (behavior.playedWithinDays) {
      const cutoff = Date.now() - (behavior.playedWithinDays * 24 * 60 * 60 * 1000);
      params.push(cutoff);
      conditions.push(`track_id IN (SELECT track_id FROM play_history WHERE played_at > ?)`);
    }

    if (behavior.minPlays) {
      params.push(behavior.minPlays);
      conditions.push(`track_id IN (SELECT track_id FROM track_play_stats WHERE play_count >= ?)`);
    }

    if (behavior.maxPlays !== undefined) {
      params.push(behavior.maxPlays);
      conditions.push(`track_id IN (SELECT track_id FROM track_play_stats WHERE play_count <= ?)`);
    }

    return conditions;
  }

  private buildOrderBy(sortBy: string, direction: string): string {
    const dir = direction === 'asc' ? 'ASC' : 'DESC';

    switch (sortBy) {
      case 'title':
        return ` ORDER BY json_extract(track_data, '$.title') COLLATE NOCASE ${dir}`;
      case 'artist':
        return ` ORDER BY json_extract(track_data, '$.artists[0].name') COLLATE NOCASE ${dir}`;
      case 'duration':
        return ` ORDER BY CAST(json_extract(track_data, '$.duration') AS INTEGER) ${dir}`;
      case 'plays':
        return ` ORDER BY (SELECT COALESCE(play_count, 0) FROM track_play_stats WHERE track_id = all_tracks.track_id) ${dir}`;
      case 'added':
        return ` ORDER BY (SELECT liked_at FROM liked_tracks WHERE id = all_tracks.track_id) ${dir}`;
      case 'relevance':
      default:
        // For relevance, prioritize liked tracks and recently played
        return ` ORDER BY
          CASE WHEN track_id IN (SELECT id FROM liked_tracks) THEN 0 ELSE 1 END,
          (SELECT COALESCE(play_count, 0) FROM track_play_stats WHERE track_id = all_tracks.track_id) DESC`;
    }
  }

  // ============================================================================
  // Search History
  // ============================================================================

  saveSearch(query: string, resultCount: number): void {
    const id = `search_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.db.prepare(`
      INSERT INTO search_history (id, query, timestamp, result_count)
      VALUES (?, ?, ?, ?)
    `).run(id, query, Date.now(), resultCount);

    // Keep only last 100 searches
    this.db.prepare(`
      DELETE FROM search_history WHERE id NOT IN (
        SELECT id FROM search_history ORDER BY timestamp DESC LIMIT 100
      )
    `).run();
  }

  getSearchHistory(limit: number = 20): SearchHistoryEntry[] {
    const rows = this.db.prepare(`
      SELECT id, query, timestamp, result_count
      FROM search_history
      ORDER BY timestamp DESC
      LIMIT ?
    `).all(limit) as Array<{ id: string; query: string; timestamp: number; result_count: number }>;

    return rows.map(r => ({
      id: r.id,
      query: r.query,
      timestamp: r.timestamp,
      resultCount: r.result_count,
    }));
  }

  deleteSearchHistory(id: string): void {
    this.db.prepare(`DELETE FROM search_history WHERE id = ?`).run(id);
  }

  clearSearchHistory(): void {
    this.db.prepare(`DELETE FROM search_history`).run();
  }

  // ============================================================================
  // Suggestions
  // ============================================================================

  getSuggestions(prefix: string, limit: number = 10): {
    tracks: string[];
    artists: string[];
    albums: string[];
    tags: string[];
    recentSearches: string[];
  } {
    const pattern = `${prefix}%`;

    // Get track title suggestions
    const tracks = this.db.prepare(`
      SELECT DISTINCT json_extract(track_data, '$.title') as title
      FROM liked_tracks
      WHERE json_extract(track_data, '$.title') LIKE ? COLLATE NOCASE
      LIMIT ?
    `).all(pattern, limit) as Array<{ title: string }>;

    // Get artist suggestions
    const artists = this.db.prepare(`
      SELECT DISTINCT json_extract(track_data, '$.artists[0].name') as artist
      FROM liked_tracks
      WHERE json_extract(track_data, '$.artists[0].name') LIKE ? COLLATE NOCASE
      LIMIT ?
    `).all(pattern, limit) as Array<{ artist: string }>;

    // Get album suggestions
    const albums = this.db.prepare(`
      SELECT DISTINCT json_extract(track_data, '$.album.title') as album
      FROM liked_tracks
      WHERE json_extract(track_data, '$.album.title') LIKE ? COLLATE NOCASE
      LIMIT ?
    `).all(pattern, limit) as Array<{ album: string }>;

    // Get tag suggestions
    const tags = this.db.prepare(`
      SELECT DISTINCT name FROM tags
      WHERE name LIKE ? COLLATE NOCASE
      ORDER BY usage_count DESC
      LIMIT ?
    `).all(pattern, limit) as Array<{ name: string }>;

    // Get recent search suggestions
    const recentSearches = this.db.prepare(`
      SELECT DISTINCT query FROM search_history
      WHERE query LIKE ? COLLATE NOCASE
      ORDER BY timestamp DESC
      LIMIT ?
    `).all(pattern, limit) as Array<{ query: string }>;

    return {
      tracks: tracks.map(t => t.title).filter(Boolean),
      artists: artists.map(a => a.artist).filter(Boolean),
      albums: albums.map(a => a.album).filter(Boolean),
      tags: tags.map(t => t.name),
      recentSearches: recentSearches.map(s => s.query),
    };
  }
}
