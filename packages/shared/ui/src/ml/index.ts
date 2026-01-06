/**
 * ML Module Exports
 */

export {
  type PluginFeatureProvider,
  createPluginFeatureProvider,
  registerPluginAudioProvider,
  unregisterPluginAudioProvider,
  initializeAudioProviders,
  cleanupAudioProviders,
  normalizeBpm,
  keyNumberToString,
  estimateEnergyFromFeatures
} from './plugin-audio-provider';

// Re-export AudioFeatures from core
export type { AudioFeatures } from '@audiio/core';
