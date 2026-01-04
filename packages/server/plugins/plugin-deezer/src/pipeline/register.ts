/**
 * Pipeline Registration
 *
 * Registers the Deezer charts data provider with the Discover pipeline.
 */

import type { PluginPipelineAPI } from '@audiio/sdk';
import { deezerChartsProvider, setDeezerProvider } from './charts-provider';
import { DeezerMetadataProvider } from '../index';

/**
 * Register Deezer pipeline hooks
 *
 * @param pipeline - The pipeline API from the app
 * @param provider - Optional Deezer provider instance for chart data
 */
export function registerDeezerPipelineHooks(
  pipeline: PluginPipelineAPI,
  provider?: DeezerMetadataProvider
): void {
  console.log('[DeezerPipeline] Registering pipeline hooks...');

  // Inject provider instance if available
  if (provider) {
    setDeezerProvider(provider);
    console.log('[DeezerPipeline] Provider instance injected');
  }

  // Register the charts data provider
  try {
    pipeline.registerProvider(deezerChartsProvider);
    console.log('[DeezerPipeline] Registered charts data provider');
  } catch (error) {
    console.error('[DeezerPipeline] Failed to register charts provider:', error);
  }
}

/**
 * Unregister Deezer pipeline hooks
 */
export function unregisterDeezerPipelineHooks(pipeline: PluginPipelineAPI): void {
  pipeline.unregisterPlugin('deezer');
  console.log('[DeezerPipeline] Unregistered all pipeline hooks');
}
