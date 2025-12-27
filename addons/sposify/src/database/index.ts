/**
 * Sposify Database Module - Re-exports
 */

export { SposifyDatabase, getSposifyDatabase, closeSposifyDatabase } from './sposify-db';
export { PlaylistDatabase, getPlaylistDatabase } from './playlist-db';
export { AudioFeaturesDatabase, getAudioFeaturesDatabase } from './audio-features-db';
export { IsrcMatcher, getIsrcMatcher, type LocalTrackInfo, type MatchResult } from './isrc-matcher';
export {
  setupDatabase,
  checkDatabaseExists,
  type SetupProgress,
  type SetupOptions,
  type SetupResult,
  type ProgressCallback,
} from './database-setup';
