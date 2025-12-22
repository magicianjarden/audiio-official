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
