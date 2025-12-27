/**
 * Sposify UI Module - Main Exports
 */

// Main view and registration
export { sposifyUI, SpotifyIcon, SposifyView } from './register';

// Components
export {
  SposifyWizard,
  FileDropZone,
  ImportProgress,
  PlaylistBrowser,
  PlaylistCard,
  AudioFeaturesPanel,
  IsrcMatcherView,
  DatabaseSetup,
} from './components';

// Stores
export { useSposifyStore } from './stores';
export type {
  ParsedSpotifyData,
  MatchedTrack,
  MatchedPlaylist,
  ImportOptions,
  ImportStats,
  AudioFeatures,
  PlaylistPreview,
  ImportPhase,
  SetupProgress,
} from './stores';
