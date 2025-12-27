/**
 * Sposify Import Service
 * Orchestrates the complete Spotify data import process
 */

import * as fs from 'fs';
import * as path from 'path';
import type {
  ParsedSpotifyData,
  ImportOptions,
  ImportResult,
  ImportError,
  MatchedTrack,
  MatchedHistoryEntry,
  MatchedPlaylist,
} from '../types';
import { getHistoryParser } from './history-parser';
import { getLibraryParser } from './library-parser';
import { getPlaylistParser } from './playlist-parser';
import { getImportMapper, type UnifiedTrack, type ListenEvent, type Playlist } from './import-mapper';
import { getSposifyDatabase } from '../database/sposify-db';

export type ImportPhase = 'idle' | 'parsing' | 'matching' | 'importing' | 'complete' | 'error';

export interface ImportProgress {
  phase: ImportPhase;
  progress: number; // 0-1
  currentItem?: string;
  stats?: {
    parsed?: number;
    matched?: number;
    imported?: number;
  };
}

export interface ImportCallbacks {
  onProgress?: (progress: ImportProgress) => void;
  onTrackImported?: (track: UnifiedTrack) => void;
  onListenRecorded?: (event: ListenEvent) => void;
  onPlaylistCreated?: (playlist: Playlist) => void;
}

export class SpotifyImportService {
  private historyParser = getHistoryParser();
  private libraryParser = getLibraryParser();
  private playlistParser = getPlaylistParser();
  private importMapper = getImportMapper();

  /**
   * Parse Spotify export files
   */
  parseExportFiles(filePaths: string[]): ParsedSpotifyData {
    // Separate files by type
    const historyFiles = filePaths.filter(f => {
      const name = path.basename(f);
      return name.startsWith('StreamingHistory') || name.includes('endsong');
    });

    const libraryFile = filePaths.find(f =>
      path.basename(f).toLowerCase() === 'yourlibrary.json'
    );

    const playlistFiles = filePaths.filter(f =>
      path.basename(f).startsWith('Playlist') && f.endsWith('.json')
    );

    // Parse each type
    const historyResult = this.historyParser.parseFiles(historyFiles);
    const libraryResult = libraryFile
      ? this.libraryParser.parseLibraryFile(libraryFile)
      : { likedTracks: [], bannedTracks: [], errors: [] };
    const playlistResult = this.playlistParser.parseFiles(playlistFiles);

    // Combine errors
    const parseErrors = [
      ...historyResult.errors,
      ...libraryResult.errors,
      ...playlistResult.errors,
    ];

    return {
      history: historyResult.entries,
      likedTracks: libraryResult.likedTracks,
      playlists: playlistResult.playlists,
      bannedTracks: libraryResult.bannedTracks,
      parseErrors,
      stats: {
        totalHistoryEntries: historyResult.stats.totalEntries,
        uniqueTracksPlayed: historyResult.stats.uniqueTracks,
        totalPlaytimeMs: historyResult.stats.totalPlaytimeMs,
        dateRange: historyResult.stats.dateRange,
        likedTracksCount: libraryResult.likedTracks.length,
        playlistsCount: playlistResult.playlists.length,
      },
    };
  }

  /**
   * Parse Spotify export directory
   */
  parseExportDirectory(dirPath: string): ParsedSpotifyData {
    if (!fs.existsSync(dirPath)) {
      throw new Error(`Directory not found: ${dirPath}`);
    }

    const files = fs.readdirSync(dirPath)
      .filter(f => f.endsWith('.json'))
      .map(f => path.join(dirPath, f));

    return this.parseExportFiles(files);
  }

  /**
   * Match parsed data against Sposify database
   */
  matchParsedData(
    data: ParsedSpotifyData,
    callbacks?: ImportCallbacks
  ): {
    matchedLikedTracks: MatchedTrack[];
    unmatchedLikedTracks: typeof data.likedTracks;
    matchedHistory: MatchedHistoryEntry[];
    matchedPlaylists: MatchedPlaylist[];
    matchStats: {
      likedTracksMatchRate: number;
      historyMatchRate: number;
      averagePlaylistMatchRate: number;
    };
  } {
    // Match liked tracks
    callbacks?.onProgress?.({
      phase: 'matching',
      progress: 0,
      currentItem: 'Matching liked tracks...',
    });

    const { matched: matchedLikedTracks, unmatched: unmatchedLikedTracks } =
      this.importMapper.matchAndConvertTracks(data.likedTracks, (p) => {
        callbacks?.onProgress?.({
          phase: 'matching',
          progress: p * 0.3,
          currentItem: 'Matching liked tracks...',
        });
      });

    // Match history
    callbacks?.onProgress?.({
      phase: 'matching',
      progress: 0.3,
      currentItem: 'Matching streaming history...',
    });

    const matchedHistory = this.importMapper.matchAndConvertHistory(
      data.history,
      (p) => {
        callbacks?.onProgress?.({
          phase: 'matching',
          progress: 0.3 + p * 0.4,
          currentItem: 'Matching streaming history...',
        });
      }
    );

    // Match playlists
    callbacks?.onProgress?.({
      phase: 'matching',
      progress: 0.7,
      currentItem: 'Matching playlists...',
    });

    const matchedPlaylists: MatchedPlaylist[] = [];
    for (let i = 0; i < data.playlists.length; i++) {
      const playlist = data.playlists[i];
      const matched = this.importMapper.matchAndConvertPlaylist(playlist);
      matchedPlaylists.push(matched);

      callbacks?.onProgress?.({
        phase: 'matching',
        progress: 0.7 + (i / data.playlists.length) * 0.3,
        currentItem: `Matching playlist: ${playlist.name}`,
      });
    }

    // Calculate stats
    const likedTracksMatchRate = data.likedTracks.length > 0
      ? matchedLikedTracks.length / data.likedTracks.length
      : 0;

    const matchedHistoryCount = matchedHistory.filter(h => h.matchedSpotifyId).length;
    const historyMatchRate = matchedHistory.length > 0
      ? matchedHistoryCount / matchedHistory.length
      : 0;

    const averagePlaylistMatchRate = matchedPlaylists.length > 0
      ? matchedPlaylists.reduce((sum, p) => sum + p.matchRate, 0) / matchedPlaylists.length
      : 0;

    return {
      matchedLikedTracks,
      unmatchedLikedTracks,
      matchedHistory,
      matchedPlaylists,
      matchStats: {
        likedTracksMatchRate,
        historyMatchRate,
        averagePlaylistMatchRate,
      },
    };
  }

  /**
   * Execute the import with matched data
   */
  async executeImport(
    options: ImportOptions,
    matchedData: {
      matchedLikedTracks: MatchedTrack[];
      matchedHistory: MatchedHistoryEntry[];
      matchedPlaylists: MatchedPlaylist[];
    },
    callbacks?: ImportCallbacks
  ): Promise<ImportResult> {
    const startTime = Date.now();
    const errors: ImportError[] = [];
    let historyImported = 0;
    let tracksLiked = 0;
    let tracksDisliked = 0;
    let playlistsCreated = 0;

    const db = getSposifyDatabase();

    // Import liked tracks
    if (options.importLikedTracks) {
      callbacks?.onProgress?.({
        phase: 'importing',
        progress: 0,
        currentItem: 'Importing liked tracks...',
        stats: { imported: 0 },
      });

      for (let i = 0; i < matchedData.matchedLikedTracks.length; i++) {
        const matched = matchedData.matchedLikedTracks[i];

        try {
          if (matched.confidence >= options.minConfidence) {
            const unifiedTrack = this.importMapper.toUnifiedTrack(matched);
            callbacks?.onTrackImported?.(unifiedTrack);
            tracksLiked++;
          }
        } catch (error) {
          errors.push({
            type: 'track',
            item: matched.original.trackName,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }

        if (i % 10 === 0) {
          callbacks?.onProgress?.({
            phase: 'importing',
            progress: (i / matchedData.matchedLikedTracks.length) * 0.3,
            currentItem: `Importing: ${matched.original.trackName}`,
            stats: { imported: tracksLiked },
          });
        }
      }
    }

    // Import streaming history
    if (options.importHistory) {
      callbacks?.onProgress?.({
        phase: 'importing',
        progress: 0.3,
        currentItem: 'Importing streaming history...',
      });

      const matchedEntries = matchedData.matchedHistory.filter(
        h => h.matchedSpotifyId && (h.matchConfidence || 0) >= options.minConfidence
      );

      for (let i = 0; i < matchedEntries.length; i++) {
        const entry = matchedEntries[i];

        try {
          // Get track duration from database
          const track = db.getTrackById(entry.matchedSpotifyId!);
          const totalDuration = track?.duration_ms || entry.msPlayed;

          const listenEvent = this.importMapper.toListenEvent(
            entry,
            entry.matchedSpotifyId!,
            totalDuration
          );
          callbacks?.onListenRecorded?.(listenEvent);
          historyImported++;
        } catch (error) {
          errors.push({
            type: 'history',
            item: `${entry.artistName} - ${entry.trackName}`,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }

        if (i % 100 === 0) {
          callbacks?.onProgress?.({
            phase: 'importing',
            progress: 0.3 + (i / matchedEntries.length) * 0.4,
            currentItem: `Recording history: ${entry.trackName}`,
            stats: { imported: historyImported },
          });
        }
      }
    }

    // Import playlists
    if (options.importPlaylists) {
      callbacks?.onProgress?.({
        phase: 'importing',
        progress: 0.7,
        currentItem: 'Creating playlists...',
      });

      for (let i = 0; i < matchedData.matchedPlaylists.length; i++) {
        const matched = matchedData.matchedPlaylists[i];

        try {
          // Apply prefix
          const namedPlaylist = {
            ...matched,
            name: options.playlistPrefix + matched.name,
          };

          const playlist = this.importMapper.toPlaylist(namedPlaylist);
          callbacks?.onPlaylistCreated?.(playlist);
          playlistsCreated++;
        } catch (error) {
          errors.push({
            type: 'playlist',
            item: matched.name,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }

        callbacks?.onProgress?.({
          phase: 'importing',
          progress: 0.7 + (i / matchedData.matchedPlaylists.length) * 0.3,
          currentItem: `Creating playlist: ${matched.name}`,
        });
      }
    }

    callbacks?.onProgress?.({
      phase: 'complete',
      progress: 1,
      stats: {
        imported: historyImported + tracksLiked + playlistsCreated,
      },
    });

    return {
      historyImported,
      tracksLiked,
      tracksDisliked,
      playlistsCreated,
      errors,
      duration: Date.now() - startTime,
    };
  }

  /**
   * Full import flow: parse -> match -> import
   */
  async fullImport(
    filePaths: string[],
    options: ImportOptions,
    callbacks?: ImportCallbacks
  ): Promise<ImportResult> {
    // Phase 1: Parse
    callbacks?.onProgress?.({ phase: 'parsing', progress: 0 });
    const parsed = this.parseExportFiles(filePaths);
    callbacks?.onProgress?.({ phase: 'parsing', progress: 1 });

    // Phase 2: Match
    const matched = this.matchParsedData(parsed, callbacks);

    // Phase 3: Import
    return await this.executeImport(options, {
      matchedLikedTracks: matched.matchedLikedTracks,
      matchedHistory: matched.matchedHistory,
      matchedPlaylists: matched.matchedPlaylists,
    }, callbacks);
  }
}

// Singleton
let instance: SpotifyImportService | null = null;

export function getSpotifyImportService(): SpotifyImportService {
  if (!instance) {
    instance = new SpotifyImportService();
  }
  return instance;
}
