/**
 * Sposify ISRC Matcher
 * Matches local tracks to Spotify database using ISRC, metadata, and fuzzy matching
 */

import Fuse from 'fuse.js';
import type { DbTrack, TrackMatch, TrackInfo } from '../types';
import { getSposifyDatabase } from './sposify-db';

export interface LocalTrackInfo {
  id: string;
  title: string;
  artist: string;
  album?: string;
  duration?: number; // in seconds
  isrc?: string;
}

export interface MatchResult {
  matches: TrackMatch[];
  unmatched: string[];
  stats: {
    total: number;
    matchedByIsrc: number;
    matchedByExact: number;
    matchedByNormalized: number;
    matchedByFuzzy: number;
    unmatched: number;
    averageConfidence: number;
  };
}

export class IsrcMatcher {
  private minConfidence = 0.7;
  private enableFuzzyMatching = true;
  private durationToleranceMs = 5000; // 5 second tolerance

  /**
   * Match a batch of local tracks to Spotify database
   */
  matchTracks(tracks: LocalTrackInfo[], onProgress?: (progress: number) => void): MatchResult {
    const matches: TrackMatch[] = [];
    const unmatched: string[] = [];
    const stats = {
      total: tracks.length,
      matchedByIsrc: 0,
      matchedByExact: 0,
      matchedByNormalized: 0,
      matchedByFuzzy: 0,
      unmatched: 0,
      averageConfidence: 0,
    };

    let totalConfidence = 0;

    for (let i = 0; i < tracks.length; i++) {
      const track = tracks[i];
      const match = this.matchSingleTrack(track);

      if (match) {
        matches.push(match);
        totalConfidence += match.confidence;

        switch (match.matchedBy) {
          case 'isrc':
            stats.matchedByIsrc++;
            break;
          case 'exact':
            stats.matchedByExact++;
            break;
          case 'normalized':
            stats.matchedByNormalized++;
            break;
          case 'fuzzy':
            stats.matchedByFuzzy++;
            break;
        }
      } else {
        unmatched.push(track.id);
        stats.unmatched++;
      }

      if (onProgress) {
        onProgress((i + 1) / tracks.length);
      }
    }

    stats.averageConfidence = matches.length > 0 ? totalConfidence / matches.length : 0;

    return { matches, unmatched, stats };
  }

  /**
   * Match a single track
   */
  matchSingleTrack(track: LocalTrackInfo): TrackMatch | null {
    const db = getSposifyDatabase();

    // 1. Try ISRC match first (most reliable)
    if (track.isrc) {
      const isrcMatch = db.getTrackByIsrc(track.isrc);
      if (isrcMatch) {
        return this.createMatch(track.id, isrcMatch, 1.0, 'isrc');
      }
    }

    // 2. Try exact title + artist match
    const exactMatches = db.searchTracks(track.title, track.artist, 5);

    for (const match of exactMatches) {
      if (
        this.normalizeString(match.title) === this.normalizeString(track.title) &&
        this.normalizeString(match.artist_name) === this.normalizeString(track.artist)
      ) {
        // Verify duration if available
        if (track.duration && match.duration_ms) {
          const durationDiff = Math.abs(track.duration * 1000 - match.duration_ms);
          if (durationDiff <= this.durationToleranceMs) {
            return this.createMatch(track.id, match, 0.95, 'exact');
          }
        } else {
          return this.createMatch(track.id, match, 0.95, 'exact');
        }
      }
    }

    // 3. Try normalized match
    for (const match of exactMatches) {
      const titleSimilarity = this.calculateSimilarity(
        this.normalizeString(track.title),
        this.normalizeString(match.title)
      );
      const artistSimilarity = this.calculateSimilarity(
        this.normalizeString(track.artist),
        this.normalizeString(match.artist_name)
      );

      if (titleSimilarity >= 0.9 && artistSimilarity >= 0.8) {
        const confidence = (titleSimilarity * 0.6 + artistSimilarity * 0.4) * 0.85;
        if (confidence >= this.minConfidence) {
          return this.createMatch(track.id, match, confidence, 'normalized');
        }
      }
    }

    // 4. Try fuzzy match (if enabled)
    if (this.enableFuzzyMatching) {
      const fuzzyMatch = this.fuzzyMatch(track);
      if (fuzzyMatch && fuzzyMatch.confidence >= this.minConfidence) {
        return fuzzyMatch;
      }
    }

    return null;
  }

  /**
   * Fuzzy match using Fuse.js
   */
  private fuzzyMatch(track: LocalTrackInfo): TrackMatch | null {
    const db = getSposifyDatabase();
    const searchResults = db.searchTracks(track.title, track.artist, 20);

    if (searchResults.length === 0) return null;

    // Build search index
    const fuse = new Fuse(searchResults, {
      keys: [
        { name: 'title', weight: 0.6 },
        { name: 'artist_name', weight: 0.4 },
      ],
      threshold: 0.4,
      includeScore: true,
    });

    const query = `${track.title} ${track.artist}`;
    const results = fuse.search(query);

    if (results.length === 0) return null;

    const bestMatch = results[0];
    const score = 1 - (bestMatch.score || 0); // Fuse score is 0 (perfect) to 1 (worst)

    // Additional verification with duration
    if (track.duration && bestMatch.item.duration_ms) {
      const durationDiff = Math.abs(track.duration * 1000 - bestMatch.item.duration_ms);
      const durationScore = durationDiff <= this.durationToleranceMs ? 1 : 0.7;
      const adjustedConfidence = score * durationScore * 0.7; // Cap fuzzy at 70%

      if (adjustedConfidence >= this.minConfidence) {
        return this.createMatch(track.id, bestMatch.item, adjustedConfidence, 'fuzzy');
      }
    } else {
      const confidence = score * 0.7;
      if (confidence >= this.minConfidence) {
        return this.createMatch(track.id, bestMatch.item, confidence, 'fuzzy');
      }
    }

    return null;
  }

  /**
   * Create a match result
   */
  private createMatch(
    localId: string,
    dbTrack: DbTrack,
    confidence: number,
    matchedBy: 'isrc' | 'exact' | 'normalized' | 'fuzzy'
  ): TrackMatch {
    return {
      localId,
      spotifyId: dbTrack.spotify_id,
      confidence,
      matchedBy,
      track: {
        spotifyId: dbTrack.spotify_id,
        title: dbTrack.title,
        artistName: dbTrack.artist_name,
        albumName: dbTrack.album_name,
        durationMs: dbTrack.duration_ms,
        isrc: dbTrack.isrc,
        explicit: dbTrack.explicit === 1,
        popularity: dbTrack.popularity,
      },
    };
  }

  /**
   * Normalize string for comparison
   */
  private normalizeString(str: string): string {
    return str
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
      .replace(/[^\w\s]/g, '') // Remove special chars
      .replace(/\s+/g, ' ') // Normalize spaces
      .replace(/\b(feat|ft|featuring|with|vs|versus)\b/gi, '') // Remove featuring etc
      .replace(/\([^)]*\)/g, '') // Remove parenthetical content
      .replace(/\[[^\]]*\]/g, '') // Remove bracketed content
      .trim();
  }

  /**
   * Calculate string similarity (Dice coefficient)
   */
  private calculateSimilarity(str1: string, str2: string): number {
    if (str1 === str2) return 1;
    if (str1.length < 2 || str2.length < 2) return 0;

    const bigrams1 = this.getBigrams(str1);
    const bigrams2 = this.getBigrams(str2);

    let intersection = 0;
    for (const bigram of bigrams1) {
      if (bigrams2.has(bigram)) {
        intersection++;
      }
    }

    return (2 * intersection) / (bigrams1.size + bigrams2.size);
  }

  /**
   * Get bigrams from string
   */
  private getBigrams(str: string): Set<string> {
    const bigrams = new Set<string>();
    for (let i = 0; i < str.length - 1; i++) {
      bigrams.add(str.substring(i, i + 2));
    }
    return bigrams;
  }

  // Configuration methods
  setMinConfidence(value: number): void {
    this.minConfidence = Math.max(0, Math.min(1, value));
  }

  setFuzzyMatchingEnabled(enabled: boolean): void {
    this.enableFuzzyMatching = enabled;
  }

  setDurationTolerance(ms: number): void {
    this.durationToleranceMs = ms;
  }
}

// Singleton
let instance: IsrcMatcher | null = null;

export function getIsrcMatcher(): IsrcMatcher {
  if (!instance) {
    instance = new IsrcMatcher();
  }
  return instance;
}
