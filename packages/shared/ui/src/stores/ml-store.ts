/**
 * ML Store - Server-backed ML functionality
 *
 * ALL ML computation happens on the server. This store provides:
 * - Access to server ML endpoints for scoring and recommendations
 * - Training status monitoring
 * - Model version tracking
 *
 * Key principle: The client is a thin UI layer. ML training, prediction,
 * and model storage all happen on the server.
 */

import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import type { UnifiedTrack } from '@audiio/core';

// ============================================
// Types
// ============================================

export interface TrainingProgress {
  epoch: number;
  totalEpochs: number;
  loss: number;
}

export interface TrainingMetrics {
  accuracy: number;
  loss: number;
  validationLoss: number;
  epochs: number;
}

export interface TrainingStatus {
  isTraining: boolean;
  progress: number;
  phase: 'idle' | 'preparing' | 'training' | 'validating' | 'saving';
  message: string;
  lastTrainedAt?: number;
  modelVersion?: string;
  samplesUsed?: number;
}

interface MLState {
  // Server model state (cached)
  isModelLoaded: boolean;
  isTraining: boolean;
  modelVersion: number;
  lastTrainedAt: number;

  // Training status from server
  trainingStatus: TrainingStatus | null;
  trainingMetrics: TrainingMetrics | null;

  // Error state
  lastError: string | null;
  isLoading: boolean;

  // Actions - Initialization
  initialize: () => Promise<void>;
  refreshStatus: () => Promise<void>;

  // Actions - Training (triggers server training)
  trainModel: () => Promise<boolean>;

  // Actions - Predictions (from server)
  predictScore: (track: UnifiedTrack, hour?: number) => Promise<number>;
  predictBatchScores: (tracks: UnifiedTrack[], hour?: number) => Promise<Map<string, number>>;
  getHybridScore: (track: UnifiedTrack, hour?: number) => Promise<number>;
  getHybridRecommendations: (candidates: UnifiedTrack[], limit?: number, hour?: number) => Promise<UnifiedTrack[]>;

  // Actions - Legacy compatibility
  checkAndTrain: () => Promise<void>;
  resetModel: () => Promise<void>;
}

// ============================================
// Default Status
// ============================================

const defaultTrainingStatus: TrainingStatus = {
  isTraining: false,
  progress: 0,
  phase: 'idle',
  message: 'Ready',
};

// ============================================
// Store Implementation (NO LOCAL PERSISTENCE)
// ============================================

export const useMLStore = create<MLState>()((set, get) => ({
  // Initial state
  isModelLoaded: false,
  isTraining: false,
  modelVersion: 0,
  lastTrainedAt: 0,
  trainingStatus: null,
  trainingMetrics: null,
  lastError: null,
  isLoading: false,

  /**
   * Initialize - fetch current ML status from server
   */
  initialize: async () => {
    set({ isLoading: true, lastError: null });

    try {
      if (window.api?.algoGetTrainingStatus) {
        const status = await window.api.algoGetTrainingStatus();
        if (status) {
          set({
            isModelLoaded: true,
            isLoading: false,
            trainingStatus: status as TrainingStatus,
            modelVersion: parseInt(status.modelVersion || '0', 10),
            lastTrainedAt: status.lastTrainedAt || 0,
          });
          console.log('[MLStore] Initialized from server:', status);
          return;
        }
      }

      // Server might not have training status endpoint, assume ready
      set({
        isModelLoaded: true,
        isLoading: false,
        trainingStatus: defaultTrainingStatus,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to initialize ML';
      console.error('[MLStore] Initialization error:', message);
      set({
        lastError: message,
        isLoading: false,
        isModelLoaded: true, // Assume model is ready
        trainingStatus: defaultTrainingStatus,
      });
    }
  },

  /**
   * Refresh training status from server
   */
  refreshStatus: async () => {
    try {
      if (window.api?.algoGetTrainingStatus) {
        const status = await window.api.algoGetTrainingStatus();
        if (status) {
          set({
            trainingStatus: status as TrainingStatus,
            isTraining: status.isTraining,
            modelVersion: parseInt(status.modelVersion || '0', 10),
            lastTrainedAt: status.lastTrainedAt || 0,
          });
        }
      }
    } catch (error) {
      console.error('[MLStore] Failed to refresh status:', error);
    }
  },

  /**
   * Trigger training on server
   */
  trainModel: async () => {
    const state = get();

    if (state.isTraining) {
      console.log('[MLStore] Training already in progress');
      return false;
    }

    set({
      isTraining: true,
      lastError: null,
      trainingStatus: {
        isTraining: true,
        progress: 0,
        phase: 'preparing',
        message: 'Starting training...',
      },
    });

    try {
      if (window.api?.algoTrain) {
        await window.api.algoTrain();
      }

      // Refresh status after training
      await state.refreshStatus();

      console.log('[MLStore] Training complete');
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Training failed';
      console.error('[MLStore] Training error:', message);

      set({
        isTraining: false,
        lastError: message,
        trainingStatus: {
          isTraining: false,
          progress: 0,
          phase: 'idle',
          message: 'Training failed',
        },
      });

      return false;
    }
  },

  /**
   * Get ML prediction score for a track from server
   */
  predictScore: async (track, hour) => {
    try {
      if (window.api?.algoScoreTrack) {
        const result = await window.api.algoScoreTrack(track.id);
        // Normalize to 0-1 range from server's -100 to 100 range
        const normalized = ((result?.finalScore ?? 50) + 100) / 200;
        return Math.max(0, Math.min(1, normalized));
      }
    } catch (error) {
      console.error('[MLStore] Predict score failed:', error);
    }
    return 0.5; // Neutral
  },

  /**
   * Batch predict for efficiency
   */
  predictBatchScores: async (tracks, hour) => {
    const scores = new Map<string, number>();

    if (tracks.length === 0) {
      return scores;
    }

    try {
      if (window.api?.algoScoreBatch) {
        const trackIds = tracks.map(t => t.id);
        const results = await window.api.algoScoreBatch(trackIds);

        if (results && Array.isArray(results)) {
          results.forEach((r: any) => {
            if (r?.trackId && typeof r.finalScore === 'number') {
              // Normalize to 0-1 range
              const normalized = (r.finalScore + 100) / 200;
              scores.set(r.trackId, Math.max(0, Math.min(1, normalized)));
            }
          });
        }
      }
    } catch (error) {
      console.error('[MLStore] Batch predict failed:', error);
    }

    // Fill in missing scores with neutral value
    tracks.forEach(t => {
      if (!scores.has(t.id)) {
        scores.set(t.id, 0.5);
      }
    });

    return scores;
  },

  /**
   * Get hybrid score (server does the combining)
   */
  getHybridScore: async (track, hour) => {
    try {
      if (window.api?.algoScoreTrack) {
        const result = await window.api.algoScoreTrack(track.id);
        return result?.finalScore ?? 50;
      }
    } catch (error) {
      console.error('[MLStore] Hybrid score failed:', error);
    }
    return 50;
  },

  /**
   * Get ML-enhanced recommendations from server
   */
  getHybridRecommendations: async (candidates, limit = 20, hour) => {
    if (candidates.length === 0) return [];

    try {
      // Get scores from server
      if (window.api?.algoScoreBatch) {
        const trackIds = candidates.map(t => t.id);
        const results = await window.api.algoScoreBatch(trackIds);

        if (results && Array.isArray(results)) {
          // Create score map
          const scoreMap = new Map<string, number>();
          results.forEach((r: any) => {
            if (r?.trackId && typeof r.finalScore === 'number') {
              scoreMap.set(r.trackId, r.finalScore);
            }
          });

          // Sort by score
          const sorted = [...candidates].sort((a, b) => {
            const scoreA = scoreMap.get(a.id) ?? 50;
            const scoreB = scoreMap.get(b.id) ?? 50;
            return scoreB - scoreA;
          });

          return sorted.slice(0, limit);
        }
      }
    } catch (error) {
      console.error('[MLStore] Hybrid recommendations failed:', error);
    }

    // Fallback: return candidates as-is
    return candidates.slice(0, limit);
  },

  /**
   * Check if training needed and trigger if so (called by auto-train logic)
   */
  checkAndTrain: async () => {
    const state = get();

    if (state.isTraining) {
      console.log('[MLStore] checkAndTrain: Already training, skipping');
      return;
    }

    // Refresh status first
    await state.refreshStatus();

    // Let server decide if training is needed - client just triggers
    // Server will skip if not enough data or recently trained
    console.log('[MLStore] checkAndTrain: Triggering server training check');
    await state.trainModel();
  },

  /**
   * Reset the ML model on server
   */
  resetModel: async () => {
    // The client can't reset the server model directly
    // This would need admin access or a specific endpoint
    console.log('[MLStore] resetModel: Would need server admin endpoint');

    // Just reset local state
    set({
      isModelLoaded: false,
      isTraining: false,
      modelVersion: 0,
      lastTrainedAt: 0,
      trainingStatus: defaultTrainingStatus,
      trainingMetrics: null,
      lastError: null,
    });
  },
}));

// ============================================
// Hooks and Utilities
// ============================================

/**
 * Hook to get training status - uses useShallow to prevent infinite re-renders
 */
export function useTrainingStatus() {
  return useMLStore(
    useShallow((state) => ({
      isTraining: state.isTraining,
      progress: state.trainingStatus,
      metrics: state.trainingMetrics,
      error: state.lastError
    }))
  );
}

/**
 * Hook to get model readiness
 */
export function useModelReady() {
  return useMLStore((state) => state.isModelLoaded);
}

/**
 * Get the ML store instance (for non-React contexts)
 */
export function getMLStore() {
  return useMLStore.getState();
}

// ============================================
// Legacy exports for backwards compatibility
// ============================================

// These types were previously used by the local TensorFlow trainer
// Keep them for any code that might reference them
export interface FeatureScalers {
  bpm: { min: number; max: number };
  duration: { min: number; max: number };
  energy: { min: number; max: number };
  valence: { min: number; max: number };
}

export function initializeScalers(_tracks: UnifiedTrack[]): FeatureScalers {
  // No-op - scalers are managed by server
  return getDefaultScalers();
}

export function getDefaultScalers(): FeatureScalers {
  return {
    bpm: { min: 60, max: 200 },
    duration: { min: 60000, max: 600000 },
    energy: { min: 0, max: 1 },
    valence: { min: 0, max: 1 },
  };
}

export function canTrain(_sampleCount: number): boolean {
  // Server decides - always return true
  return true;
}

export function shouldRetrain(): boolean {
  // Server decides
  return false;
}

export function getTrainer() {
  // No local trainer - return stub
  return {
    isReady: () => true,
    createModel: () => {},
    loadModel: async () => true,
    saveModel: async () => {},
    deleteModel: async () => {},
    dispose: () => {},
    predict: () => 0.5,
    predictBatch: () => [],
    train: async () => ({ accuracy: 0, loss: 0, validationLoss: 0, epochs: 0 }),
  };
}
