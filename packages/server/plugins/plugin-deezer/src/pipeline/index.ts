/**
 * Pipeline Hooks for Deezer Plugin
 *
 * Provides chart/trending data to the Discover "See All" pipeline.
 */

export { deezerChartsProvider, setDeezerProvider } from './charts-provider';
export {
  registerDeezerPipelineHooks,
  unregisterDeezerPipelineHooks,
} from './register';
