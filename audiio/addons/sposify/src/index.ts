/**
 * Sposify - Spotify Data Integration Plugin for Audiio
 *
 * Features:
 * - Import Spotify data export (streaming history, liked tracks, playlists)
 * - Audio features enrichment (tempo, key, danceability, energy, valence)
 * - ISRC metadata matching for local files
 * - Playlist discovery from 6.6M curated playlists
 */

// Types
export * from './types';

// Manifest
export { SPOSIFY_MANIFEST, type SposifyManifest } from './manifest';

// Database
export {
  SposifyDatabase,
  getSposifyDatabase,
  closeSposifyDatabase,
  PlaylistDatabase,
  getPlaylistDatabase,
  AudioFeaturesDatabase,
  getAudioFeaturesDatabase,
  IsrcMatcher,
  getIsrcMatcher,
  type LocalTrackInfo,
  type MatchResult,
} from './database';

// Import
export {
  HistoryParser,
  getHistoryParser,
  type HistoryParseResult,
  LibraryParser,
  getLibraryParser,
  type LibraryParseResult,
  PlaylistParser,
  getPlaylistParser,
  type PlaylistParseResult,
  ImportMapper,
  getImportMapper,
  SpotifyImportService,
  getSpotifyImportService,
  type ImportPhase,
  type ImportProgress,
  type ImportCallbacks,
  type UnifiedTrack,
  type ListenEvent,
  type Playlist,
} from './import';

// IPC (Main Process Only)
export {
  registerSposifyHandlers,
  unregisterSposifyHandlers,
  setMainWindow,
} from './ipc';

/**
 * Plugin metadata for registration
 */
export const plugin = {
  id: 'sposify',
  name: 'Sposify',
  version: '1.0.0',
  description: 'Import Spotify data, enrich with audio features, match by ISRC, discover playlists',
  author: 'Audiio',
};

export default plugin;
