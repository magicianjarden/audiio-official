/**
 * Sposify IPC Handlers
 * Registers all IPC handlers for the Sposify addon
 */

import { ipcMain, BrowserWindow, dialog, type IpcMainInvokeEvent } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { getSposifyDatabase, closeSposifyDatabase } from '../database/sposify-db';
import { getPlaylistDatabase } from '../database/playlist-db';
import { getAudioFeaturesDatabase } from '../database/audio-features-db';
import { getIsrcMatcher, type LocalTrackInfo } from '../database/isrc-matcher';
import { getSpotifyImportService, type ImportProgress } from '../import/spotify-import-service';
import type { SetupProgress } from '../database/database-setup';
import type {
  DatabaseStatus,
  AudioFeatures,
  PlaylistPreview,
  PlaylistDetail,
  PlaylistSearchOptions,
  ImportOptions,
  ImportResult,
  ParsedSpotifyData,
  MatchedTrack,
  MatchedHistoryEntry,
  MatchedPlaylist,
} from '../types';

let mainWindow: BrowserWindow | null = null;
let storedUserDataPath: string | null = null;

/**
 * Set the main window for sending events
 */
export function setMainWindow(window: BrowserWindow): void {
  mainWindow = window;
}

/**
 * Send progress updates to renderer
 */
function sendProgress(progress: ImportProgress): void {
  mainWindow?.webContents.send('sposify:import-progress', progress);
}

/**
 * Send setup progress updates to renderer
 */
function sendSetupProgress(progress: SetupProgress): void {
  mainWindow?.webContents.send('sposify:setup-progress', progress);
}

/**
 * Register all Sposify IPC handlers
 */
export function registerSposifyHandlers(userDataPath: string): void {
  storedUserDataPath = userDataPath;
  const dbPath = path.join(userDataPath, 'sposify');

  // Ensure sposify directory exists
  if (!fs.existsSync(dbPath)) {
    fs.mkdirSync(dbPath, { recursive: true });
  }

  // ============================================================================
  // Database Management
  // ============================================================================

  ipcMain.handle('sposify:init', async (): Promise<DatabaseStatus> => {
    try {
      const db = getSposifyDatabase();
      return await db.initialize(userDataPath, {
        onProgress: sendSetupProgress,
      });
    } catch (error) {
      console.error('[Sposify] Init error:', error);
      return {
        ready: false,
        path: null,
        trackCount: 0,
        artistCount: 0,
        albumCount: 0,
        playlistCount: 0,
        hasAudioFeatures: false,
        audioFeaturesCount: 0,
        databaseSizeBytes: 0,
        version: '0.0.0',
        lastUpdated: null,
      };
    }
  });

  ipcMain.handle('sposify:rebuild-database', async (): Promise<DatabaseStatus> => {
    try {
      const db = getSposifyDatabase();
      db.close();
      return await db.initialize(userDataPath, {
        onProgress: sendSetupProgress,
        forceRebuild: true,
      });
    } catch (error) {
      console.error('[Sposify] Rebuild error:', error);
      return {
        ready: false,
        path: null,
        trackCount: 0,
        artistCount: 0,
        albumCount: 0,
        playlistCount: 0,
        hasAudioFeatures: false,
        audioFeaturesCount: 0,
        databaseSizeBytes: 0,
        version: '0.0.0',
        lastUpdated: null,
      };
    }
  });

  ipcMain.handle('sposify:get-status', (): DatabaseStatus => {
    const db = getSposifyDatabase();
    return db.getStatus();
  });

  ipcMain.handle('sposify:close', (): void => {
    closeSposifyDatabase();
  });

  // ============================================================================
  // File Selection
  // ============================================================================

  ipcMain.handle('sposify:select-export-files', async (): Promise<string[] | null> => {
    const result = await dialog.showOpenDialog({
      title: 'Select Spotify Export Files',
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: 'JSON Files', extensions: ['json'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    });

    if (result.canceled) return null;
    return result.filePaths;
  });

  ipcMain.handle('sposify:select-export-folder', async (): Promise<string | null> => {
    const result = await dialog.showOpenDialog({
      title: 'Select Spotify Export Folder',
      properties: ['openDirectory'],
    });

    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  });

  // ============================================================================
  // Import Operations
  // ============================================================================

  ipcMain.handle('sposify:parse-export', async (
    _event: IpcMainInvokeEvent,
    filePaths: string[]
  ): Promise<ParsedSpotifyData> => {
    const importService = getSpotifyImportService();
    return importService.parseExportFiles(filePaths);
  });

  ipcMain.handle('sposify:parse-export-folder', async (
    _event: IpcMainInvokeEvent,
    folderPath: string
  ): Promise<ParsedSpotifyData> => {
    const importService = getSpotifyImportService();
    return importService.parseExportDirectory(folderPath);
  });

  ipcMain.handle('sposify:match-tracks', async (
    _event: IpcMainInvokeEvent,
    tracks: Array<{ trackName: string; artistName: string; albumName?: string }>
  ): Promise<{ matched: MatchedTrack[]; unmatched: typeof tracks; matchRate: number }> => {
    const importService = getSpotifyImportService();
    const normalized = tracks.map(t => ({
      trackName: t.trackName,
      artistName: t.artistName,
      albumName: t.albumName,
    }));

    const result = importService.matchParsedData({
      history: [],
      likedTracks: normalized,
      playlists: [],
      bannedTracks: [],
      parseErrors: [],
      stats: {
        totalHistoryEntries: 0,
        uniqueTracksPlayed: 0,
        totalPlaytimeMs: 0,
        dateRange: null,
        likedTracksCount: normalized.length,
        playlistsCount: 0,
      },
    });

    return {
      matched: result.matchedLikedTracks,
      unmatched: result.unmatchedLikedTracks,
      matchRate: result.matchStats.likedTracksMatchRate,
    };
  });

  ipcMain.handle('sposify:import-to-library', async (
    _event: IpcMainInvokeEvent,
    data: {
      matchedLikedTracks?: MatchedTrack[];
      matchedHistory?: MatchedHistoryEntry[];
      matchedPlaylists?: MatchedPlaylist[];
      options: ImportOptions;
    }
  ): Promise<ImportResult> => {
    const importService = getSpotifyImportService();

    // Note: The actual store integration happens in the renderer process
    // This just validates and processes the data
    return await importService.executeImport(
      data.options,
      {
        matchedLikedTracks: data.matchedLikedTracks || [],
        matchedHistory: data.matchedHistory || [],
        matchedPlaylists: data.matchedPlaylists || [],
      },
      {
        onProgress: sendProgress,
      }
    );
  });

  // ============================================================================
  // Audio Features
  // ============================================================================

  ipcMain.handle('sposify:get-audio-features', (
    _event: IpcMainInvokeEvent,
    spotifyId: string
  ): AudioFeatures | null => {
    const audioDb = getAudioFeaturesDatabase();
    return audioDb.getBySpotifyId(spotifyId);
  });

  ipcMain.handle('sposify:get-audio-features-batch', (
    _event: IpcMainInvokeEvent,
    spotifyIds: string[]
  ): Record<string, AudioFeatures> => {
    const audioDb = getAudioFeaturesDatabase();
    const result = audioDb.getBatch(spotifyIds);
    return Object.fromEntries(result);
  });

  ipcMain.handle('sposify:get-features-by-isrc', (
    _event: IpcMainInvokeEvent,
    isrc: string
  ): AudioFeatures | null => {
    const audioDb = getAudioFeaturesDatabase();
    return audioDb.getByIsrc(isrc);
  });

  ipcMain.handle('sposify:get-features-by-metadata', (
    _event: IpcMainInvokeEvent,
    title: string,
    artist: string
  ): AudioFeatures | null => {
    const audioDb = getAudioFeaturesDatabase();
    return audioDb.getByMetadata(title, artist);
  });

  ipcMain.handle('sposify:find-similar-by-features', (
    _event: IpcMainInvokeEvent,
    features: AudioFeatures,
    limit: number = 20
  ): Array<{ spotifyId: string; similarity: number }> => {
    const audioDb = getAudioFeaturesDatabase();
    return audioDb.findSimilar(features, limit);
  });

  // ============================================================================
  // ISRC Matching
  // ============================================================================

  ipcMain.handle('sposify:match-by-metadata', (
    _event: IpcMainInvokeEvent,
    tracks: LocalTrackInfo[]
  ): {
    matches: Array<{
      localId: string;
      spotifyId: string;
      confidence: number;
      matchedBy: 'isrc' | 'exact' | 'normalized' | 'fuzzy';
    }>;
    unmatched: string[];
  } => {
    const matcher = getIsrcMatcher();
    const result = matcher.matchTracks(tracks);

    return {
      matches: result.matches.map(m => ({
        localId: m.localId,
        spotifyId: m.spotifyId,
        confidence: m.confidence,
        matchedBy: m.matchedBy,
      })),
      unmatched: result.unmatched,
    };
  });

  ipcMain.handle('sposify:enrich-track', (
    _event: IpcMainInvokeEvent,
    localTrackId: string,
    spotifyId: string
  ): {
    success: boolean;
    enrichedData?: {
      genres?: string[];
      audioFeatures?: AudioFeatures;
      externalIds?: { spotify: string; isrc?: string };
    };
  } => {
    const db = getSposifyDatabase();
    const audioDb = getAudioFeaturesDatabase();

    const track = db.getTrackById(spotifyId);
    if (!track) {
      return { success: false };
    }

    const audioFeatures = audioDb.getBySpotifyId(spotifyId);
    const genres = track.genres ? JSON.parse(track.genres) : undefined;

    return {
      success: true,
      enrichedData: {
        genres,
        audioFeatures: audioFeatures || undefined,
        externalIds: {
          spotify: spotifyId,
          isrc: track.isrc || undefined,
        },
      },
    };
  });

  // ============================================================================
  // Playlist Discovery
  // ============================================================================

  ipcMain.handle('sposify:search-playlists', (
    _event: IpcMainInvokeEvent,
    query: string,
    options?: PlaylistSearchOptions
  ): { playlists: PlaylistPreview[]; total: number; hasMore: boolean } => {
    const playlistDb = getPlaylistDatabase();
    return playlistDb.searchPlaylists(query, options);
  });

  ipcMain.handle('sposify:browse-playlists', (
    _event: IpcMainInvokeEvent,
    options?: PlaylistSearchOptions
  ): { playlists: PlaylistPreview[]; total: number; categories: string[] } => {
    const playlistDb = getPlaylistDatabase();
    return playlistDb.browsePlaylists(options);
  });

  ipcMain.handle('sposify:get-playlist', (
    _event: IpcMainInvokeEvent,
    playlistId: string
  ): PlaylistDetail | null => {
    const playlistDb = getPlaylistDatabase();
    return playlistDb.getPlaylist(playlistId);
  });

  ipcMain.handle('sposify:get-top-playlists', (
    _event: IpcMainInvokeEvent,
    limit: number = 100
  ): PlaylistPreview[] => {
    const playlistDb = getPlaylistDatabase();
    return playlistDb.getTopPlaylists(limit);
  });

  ipcMain.handle('sposify:get-playlists-for-track', (
    _event: IpcMainInvokeEvent,
    spotifyId: string,
    limit: number = 10
  ): PlaylistPreview[] => {
    const playlistDb = getPlaylistDatabase();
    return playlistDb.getPlaylistsContainingTrack(spotifyId, limit);
  });

  // ============================================================================
  // Track Queries
  // ============================================================================

  ipcMain.handle('sposify:get-track', (
    _event: IpcMainInvokeEvent,
    spotifyId: string
  ) => {
    const db = getSposifyDatabase();
    return db.getTrackById(spotifyId);
  });

  ipcMain.handle('sposify:get-track-by-isrc', (
    _event: IpcMainInvokeEvent,
    isrc: string
  ) => {
    const db = getSposifyDatabase();
    return db.getTrackByIsrc(isrc);
  });

  ipcMain.handle('sposify:search-tracks', (
    _event: IpcMainInvokeEvent,
    title: string,
    artist: string,
    limit: number = 10
  ) => {
    const db = getSposifyDatabase();
    return db.searchTracks(title, artist, limit);
  });

  // ============================================================================
  // Configuration
  // ============================================================================

  ipcMain.handle('sposify:set-config', (
    _event: IpcMainInvokeEvent,
    config: {
      minMatchConfidence?: number;
      enableFuzzyMatching?: boolean;
      maxCacheSize?: number;
    }
  ): void => {
    const matcher = getIsrcMatcher();
    const audioDb = getAudioFeaturesDatabase();

    if (config.minMatchConfidence !== undefined) {
      matcher.setMinConfidence(config.minMatchConfidence);
    }
    if (config.enableFuzzyMatching !== undefined) {
      matcher.setFuzzyMatchingEnabled(config.enableFuzzyMatching);
    }
    if (config.maxCacheSize !== undefined) {
      audioDb.setMaxCacheSize(config.maxCacheSize * 100); // Convert MB to entries approx
    }
  });

  ipcMain.handle('sposify:clear-cache', (): void => {
    const audioDb = getAudioFeaturesDatabase();
    audioDb.clearCache();
  });

  console.log('[Sposify] IPC handlers registered');
}

/**
 * Unregister all Sposify IPC handlers
 */
export function unregisterSposifyHandlers(): void {
  const channels = [
    'sposify:init',
    'sposify:rebuild-database',
    'sposify:get-status',
    'sposify:close',
    'sposify:select-export-files',
    'sposify:select-export-folder',
    'sposify:parse-export',
    'sposify:parse-export-folder',
    'sposify:match-tracks',
    'sposify:import-to-library',
    'sposify:get-audio-features',
    'sposify:get-audio-features-batch',
    'sposify:get-features-by-isrc',
    'sposify:get-features-by-metadata',
    'sposify:find-similar-by-features',
    'sposify:match-by-metadata',
    'sposify:enrich-track',
    'sposify:search-playlists',
    'sposify:browse-playlists',
    'sposify:get-playlist',
    'sposify:get-top-playlists',
    'sposify:get-playlists-for-track',
    'sposify:get-track',
    'sposify:get-track-by-isrc',
    'sposify:search-tracks',
    'sposify:set-config',
    'sposify:clear-cache',
  ];

  for (const channel of channels) {
    ipcMain.removeHandler(channel);
  }

  closeSposifyDatabase();
  console.log('[Sposify] IPC handlers unregistered');
}
