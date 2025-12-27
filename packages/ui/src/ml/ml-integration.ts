/**
 * ML Integration Bridge
 *
 * Connects the new ML architecture (@audiio/ml-core + @audiio/audiio-algo)
 * with the existing UI-side ML code. This enables:
 *
 * 1. Gradual migration to the new architecture
 * 2. Plugin-based algorithm selection
 * 3. Backward compatibility with existing stores
 */

import type { UnifiedTrack } from '@audiio/core';
import type { ListenEvent, UserProfile, DislikedTrack } from '../stores/recommendation-store';
import type {
  AudioFeatures,
  PluginFeatureProvider,
  ScoringContext,
  EnhancedScore,
} from './advanced-scoring';
import {
  registerFeatureProvider,
  unregisterFeatureProvider,
  getEnhancedScore,
} from './advanced-scoring';
import { getTrainer } from './ml-trainer';
import { initializeScalers, getDefaultScalers, type FeatureScalers } from './feature-extractor';

// ============================================
// Types
// ============================================

/**
 * External algorithm plugin interface (mirrors @audiio/ml-sdk)
 */
export interface ExternalAlgorithmPlugin {
  manifest: {
    id: string;
    name: string;
    version: string;
    capabilities: {
      audioFeatures?: boolean;
      emotionDetection?: boolean;
      lyricsAnalysis?: boolean;
      fingerprinting?: boolean;
      embeddings?: boolean;
      neuralScoring?: boolean;
    };
  };
  initialize: () => Promise<void>;
  dispose: () => Promise<void>;
  getAudioFeatures?: (trackId: string) => Promise<AudioFeatures | null>;
  findSimilar?: (trackId: string, limit: number) => Promise<string[]>;
  scoreTrack?: (track: UnifiedTrack, context: any) => Promise<{ score: number; confidence: number }>;
}

/**
 * Integration state
 */
interface IntegrationState {
  plugins: Map<string, ExternalAlgorithmPlugin>;
  activePluginId: string | null;
  scalers: FeatureScalers;
  initialized: boolean;
}

// ============================================
// State
// ============================================

const state: IntegrationState = {
  plugins: new Map(),
  activePluginId: null,
  scalers: getDefaultScalers(),
  initialized: false,
};

// ============================================
// Plugin Management
// ============================================

/**
 * Register an external algorithm plugin
 */
export async function registerAlgorithmPlugin(plugin: ExternalAlgorithmPlugin): Promise<void> {
  console.log(`[MLIntegration] Registering algorithm plugin: ${plugin.manifest.id}`);

  try {
    // Initialize the plugin
    await plugin.initialize();

    // Store the plugin
    state.plugins.set(plugin.manifest.id, plugin);

    // Register as a feature provider if it supports audio features
    if (plugin.manifest.capabilities.audioFeatures && plugin.getAudioFeatures) {
      const featureProvider: PluginFeatureProvider = {
        pluginId: plugin.manifest.id,
        priority: 100, // High priority for algorithm plugins
        getAudioFeatures: plugin.getAudioFeatures.bind(plugin),
        getSimilarTracks: plugin.findSimilar?.bind(plugin),
      };

      registerFeatureProvider(featureProvider);
    }

    // Set as active if first plugin
    if (!state.activePluginId) {
      state.activePluginId = plugin.manifest.id;
    }

    console.log(`[MLIntegration] Plugin ${plugin.manifest.id} registered successfully`);
  } catch (error) {
    console.error(`[MLIntegration] Failed to register plugin ${plugin.manifest.id}:`, error);
    throw error;
  }
}

/**
 * Unregister an algorithm plugin
 */
export async function unregisterAlgorithmPlugin(pluginId: string): Promise<void> {
  const plugin = state.plugins.get(pluginId);
  if (!plugin) return;

  console.log(`[MLIntegration] Unregistering algorithm plugin: ${pluginId}`);

  try {
    // Dispose the plugin
    await plugin.dispose();

    // Remove from feature providers
    unregisterFeatureProvider(pluginId);

    // Remove from plugins map
    state.plugins.delete(pluginId);

    // Clear active plugin if it was the one removed
    if (state.activePluginId === pluginId) {
      state.activePluginId = state.plugins.size > 0
        ? state.plugins.keys().next().value ?? null
        : null;
    }
  } catch (error) {
    console.error(`[MLIntegration] Error unregistering plugin ${pluginId}:`, error);
  }
}

/**
 * Get all registered plugins
 */
export function getRegisteredPlugins(): ExternalAlgorithmPlugin[] {
  return Array.from(state.plugins.values());
}

/**
 * Get the active plugin
 */
export function getActivePlugin(): ExternalAlgorithmPlugin | null {
  if (!state.activePluginId) return null;
  return state.plugins.get(state.activePluginId) ?? null;
}

/**
 * Set the active plugin
 */
export function setActivePlugin(pluginId: string): boolean {
  if (!state.plugins.has(pluginId)) return false;
  state.activePluginId = pluginId;
  return true;
}

// ============================================
// Unified Scoring
// ============================================

/**
 * Get unified score for a track using active plugin + base ML
 */
export async function getUnifiedScore(
  track: UnifiedTrack,
  context: ScoringContext,
  userProfile: {
    genrePreferences: Record<string, number>;
    artistPreferences: Record<string, number>;
    artistHistory: Set<string>;
    genreHistory: Set<string>;
    timePatterns: Map<number, { genres: Record<string, number>; energy: number }>;
  },
  listenHistory: ListenEvent[],
  playCount: number = 0
): Promise<EnhancedScore> {
  const activePlugin = getActivePlugin();
  let baseScore = 50; // Default neutral score

  // Try to get score from active plugin
  if (activePlugin?.scoreTrack) {
    try {
      const pluginScore = await activePlugin.scoreTrack(track, {
        hourOfDay: context.hour,
        dayOfWeek: context.dayOfWeek,
        sessionTracks: context.sessionTracks,
        recentGenres: context.recentGenres,
        recentArtists: context.recentArtists,
        explorationMode: context.explorationMode,
      });

      // Weight plugin score by confidence
      baseScore = pluginScore.score * 100 * pluginScore.confidence +
                  baseScore * (1 - pluginScore.confidence);
    } catch (error) {
      console.warn('[MLIntegration] Plugin scoring failed:', error);
    }
  }

  // Also try the built-in ML trainer
  const trainer = getTrainer();
  if (trainer.isReady()) {
    try {
      const mlScore = trainer.predict(
        track,
        { artistPreferences: {}, genrePreferences: {}, listenHistory: {} } as unknown as UserProfile,
        listenHistory,
        state.scalers,
        context.hour
      );

      // Blend ML score with plugin score
      baseScore = baseScore * 0.6 + mlScore * 100 * 0.4;
    } catch (error) {
      console.warn('[MLIntegration] ML trainer prediction failed:', error);
    }
  }

  // Get enhanced score with all factors
  return getEnhancedScore(track, baseScore, context, userProfile, playCount);
}

// ============================================
// Initialization
// ============================================

/**
 * Initialize the ML integration layer
 */
export async function initializeMLIntegration(
  tracks?: UnifiedTrack[]
): Promise<void> {
  if (state.initialized) return;

  console.log('[MLIntegration] Initializing...');

  // Initialize scalers from tracks
  if (tracks && tracks.length > 0) {
    state.scalers = initializeScalers(tracks);
  }

  // Try to load saved ML model
  const trainer = getTrainer();
  await trainer.loadModel();

  state.initialized = true;
  console.log('[MLIntegration] Initialized successfully');
}

/**
 * Cleanup ML integration
 */
export async function cleanupMLIntegration(): Promise<void> {
  console.log('[MLIntegration] Cleaning up...');

  // Unregister all plugins
  for (const pluginId of state.plugins.keys()) {
    await unregisterAlgorithmPlugin(pluginId);
  }

  state.initialized = false;
}

// ============================================
// Training
// ============================================

/**
 * Trigger training with current data
 */
export async function trainWithCurrentData(
  tracks: Map<string, UnifiedTrack>,
  listenHistory: ListenEvent[],
  userProfile: UserProfile,
  dislikedTracks?: Record<string, DislikedTrack>,
  onProgress?: (progress: { epoch: number; totalEpochs: number; loss: number }) => void
): Promise<{ success: boolean; metrics?: any }> {
  const trainer = getTrainer();

  try {
    // Ensure model exists
    if (!trainer.getModel()) {
      trainer.createModel();
    }

    // Train
    const metrics = await trainer.train(
      tracks,
      listenHistory,
      userProfile,
      state.scalers,
      { epochs: 50 },
      onProgress,
      dislikedTracks
    );

    // Save model
    await trainer.saveModel();

    console.log('[MLIntegration] Training complete:', metrics);
    return { success: true, metrics };
  } catch (error) {
    console.error('[MLIntegration] Training failed:', error);
    return { success: false };
  }
}

// ============================================
// Exports
// ============================================

export default {
  registerAlgorithmPlugin,
  unregisterAlgorithmPlugin,
  getRegisteredPlugins,
  getActivePlugin,
  setActivePlugin,
  getUnifiedScore,
  initializeMLIntegration,
  cleanupMLIntegration,
  trainWithCurrentData,
};
