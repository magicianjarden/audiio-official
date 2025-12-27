/**
 * Hooks Module Exports
 */

export {
  useAutoQueue,
  useRadioMode,
  useMLRecommendations,
  useSmartPlayback,
  default as useSmartQueue
} from './useSmartQueue';

export {
  useMLRanking,
  usePersonalizedTracks,
  type RankingOptions,
  type RankedTrack,
  type UseMLRankingResult
} from './useMLRanking';

export {
  usePluginAudioFeatures,
  getCachedAudioFeatures,
  clearAudioFeaturesCache,
  getAudioFeaturesCacheStats,
  triggerAudioAnalysis
} from './usePluginAudioFeatures';

export { useDownloadProgress } from './useDownloadProgress';

export { useLibraryBridge } from './useLibraryBridge';

export {
  useGlobalKeyboardShortcuts,
  GlobalShortcutManager
} from './useKeyboardShortcuts';

export {
  useSkipTracking,
  SkipTrackingManager
} from './useSkipTracking';

export {
  useRecommendationExplanation,
  type ExplanationFactor,
  type TrackExplanation
} from './useRecommendationExplanation';

export { useKaraoke } from './useKaraoke';
export { useKaraokeAudio } from './useKaraokeAudio';

export {
  useEmbeddingPlaylist,
  useMoodPlaylist,
  useGenrePlaylist,
  useSimilarTracks,
  type EmbeddingPlaylistOptions,
  type PlaylistResult,
} from './useEmbeddingPlaylist';
