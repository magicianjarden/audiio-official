/**
 * Sposify Import Mapper
 * Maps parsed Spotify data to Audiio data structures
 */

import type {
  NormalizedTrack,
  NormalizedHistoryEntry,
  NormalizedPlaylist,
  MatchedTrack,
  MatchedHistoryEntry,
  MatchedPlaylist,
  AudioFeatures,
} from '../types';
import { getIsrcMatcher } from '../database/isrc-matcher';
import { getAudioFeaturesDatabase } from '../database/audio-features-db';
import { getSposifyDatabase } from '../database/sposify-db';

// Types that would come from @audiio/core
export interface UnifiedTrack {
  id: string;
  title: string;
  artists: Array<{ id: string; name: string }>;
  album?: {
    id: string;
    name: string;
    artwork?: string;
  };
  duration: number;
  genres?: string[];
  releaseDate?: string;
  explicit?: boolean;
  _meta: {
    metadataProvider: string;
    matchConfidence: number;
    externalIds: {
      spotify?: string;
      isrc?: string;
    };
  };
}

export interface ListenEvent {
  trackId: string;
  timestamp: number;
  duration: number;
  totalDuration: number;
  completed: boolean;
  skipped: boolean;
}

export interface Playlist {
  id: string;
  name: string;
  description?: string;
  tracks: UnifiedTrack[];
  createdAt: Date;
  updatedAt: Date;
}

export class ImportMapper {
  /**
   * Match and convert normalized tracks to UnifiedTrack format
   */
  matchAndConvertTracks(
    tracks: NormalizedTrack[],
    onProgress?: (progress: number) => void
  ): { matched: MatchedTrack[]; unmatched: NormalizedTrack[] } {
    const matcher = getIsrcMatcher();
    const audioFeaturesDb = getAudioFeaturesDatabase();

    const localTracks = tracks.map((t, i) => ({
      id: String(i),
      title: t.trackName,
      artist: t.artistName,
      album: t.albumName,
      isrc: undefined, // Could be extracted from Spotify URI
    }));

    const result = matcher.matchTracks(localTracks, onProgress);

    // Enrich with audio features
    const matchedTracks: MatchedTrack[] = [];
    for (const match of result.matches) {
      const features = audioFeaturesDb.getBySpotifyId(match.spotifyId);
      const originalIndex = parseInt(match.localId, 10);

      matchedTracks.push({
        original: tracks[originalIndex],
        spotifyId: match.spotifyId,
        isrc: match.track.isrc || undefined,
        confidence: match.confidence,
        matchedBy: match.matchedBy,
        audioFeatures: features || undefined,
      });
    }

    const unmatchedTracks = result.unmatched.map(id => tracks[parseInt(id, 10)]);

    return { matched: matchedTracks, unmatched: unmatchedTracks };
  }

  /**
   * Convert matched track to UnifiedTrack format
   */
  toUnifiedTrack(matched: MatchedTrack): UnifiedTrack {
    const db = getSposifyDatabase();
    const dbTrack = db.getTrackById(matched.spotifyId);

    return {
      id: this.generateId(),
      title: matched.original.trackName,
      artists: [{
        id: dbTrack?.artist_id || this.generateId(),
        name: matched.original.artistName,
      }],
      album: matched.original.albumName ? {
        id: dbTrack?.album_id || this.generateId(),
        name: matched.original.albumName,
      } : undefined,
      duration: dbTrack?.duration_ms ? Math.round(dbTrack.duration_ms / 1000) : 180,
      genres: dbTrack?.genres ? JSON.parse(dbTrack.genres) : undefined,
      explicit: dbTrack?.explicit === 1,
      _meta: {
        metadataProvider: 'sposify',
        matchConfidence: matched.confidence,
        externalIds: {
          spotify: matched.spotifyId,
          isrc: matched.isrc,
        },
      },
    };
  }

  /**
   * Match and convert history entries
   */
  matchAndConvertHistory(
    entries: NormalizedHistoryEntry[],
    onProgress?: (progress: number) => void
  ): MatchedHistoryEntry[] {
    const matcher = getIsrcMatcher();

    // Deduplicate entries by track for matching
    const uniqueTracks = new Map<string, NormalizedHistoryEntry>();
    for (const entry of entries) {
      const key = `${entry.artistName}:::${entry.trackName}`;
      if (!uniqueTracks.has(key)) {
        uniqueTracks.set(key, entry);
      }
    }

    // Match unique tracks
    const localTracks = Array.from(uniqueTracks.entries()).map(([key, entry]) => ({
      id: key,
      title: entry.trackName,
      artist: entry.artistName,
      album: entry.albumName,
    }));

    const matchResult = matcher.matchTracks(localTracks, onProgress);
    const matchMap = new Map(matchResult.matches.map(m => [m.localId, m]));

    // Apply matches to all entries
    return entries.map(entry => {
      const key = `${entry.artistName}:::${entry.trackName}`;
      const match = matchMap.get(key);

      return {
        ...entry,
        matchedSpotifyId: match?.spotifyId,
        matchConfidence: match?.confidence,
      };
    });
  }

  /**
   * Convert matched history entry to ListenEvent
   */
  toListenEvent(entry: MatchedHistoryEntry, trackId: string, totalDuration: number): ListenEvent {
    return {
      trackId,
      timestamp: new Date(entry.endTime).getTime(),
      duration: entry.msPlayed,
      totalDuration,
      completed: entry.msPlayed > 30000 && entry.msPlayed >= totalDuration * 0.8,
      skipped: entry.skipped || entry.msPlayed < 30000,
    };
  }

  /**
   * Match and convert playlist
   */
  matchAndConvertPlaylist(
    playlist: NormalizedPlaylist,
    prefix: string = '',
    onProgress?: (progress: number) => void
  ): MatchedPlaylist {
    const { matched, unmatched } = this.matchAndConvertTracks(playlist.tracks, onProgress);

    const matchRate = playlist.tracks.length > 0
      ? matched.length / playlist.tracks.length
      : 0;

    return {
      ...playlist,
      name: prefix + playlist.name,
      matchedTracks: matched,
      unmatchedTracks: unmatched,
      matchRate,
    };
  }

  /**
   * Convert matched playlist to Playlist format
   */
  toPlaylist(matched: MatchedPlaylist): Playlist {
    return {
      id: this.generateId(),
      name: matched.name,
      description: matched.description,
      tracks: matched.matchedTracks.map(t => this.toUnifiedTrack(t)),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `sposify_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }
}

// Singleton
let instance: ImportMapper | null = null;

export function getImportMapper(): ImportMapper {
  if (!instance) {
    instance = new ImportMapper();
  }
  return instance;
}
