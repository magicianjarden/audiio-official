/**
 * ML Store - Manages ML model state and hybrid recommendations
 *
 * Provides:
 * - Model initialization and persistence
 * - Training management with progress tracking
 * - Hybrid scoring (ML + rule-based)
 * - Feature scaler management
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useShallow } from 'zustand/react/shallow';
import type { UnifiedTrack } from '@audiio/core';
import {
  getTrainer,
  canTrain,
  shouldRetrain,
  initializeScalers,
  getDefaultScalers,
  type FeatureScalers,
  type TrainingMetrics,
  type TrainingProgress
} from '../ml';
import { useRecommendationStore } from './recommendation-store';

// ============================================
// Types
// ============================================

interface MLState {
  // Model state
  isModelLoaded: boolean;
  isTraining: boolean;
  modelVersion: number;
  lastTrainedAt: number;
  eventsAtLastTrain: number;

  // Feature scalers (persisted)
  featureScalers: FeatureScalers | null;

  // Training metrics
  trainingMetrics: TrainingMetrics | null;

  // Training progress (transient)
  trainingProgress: TrainingProgress | null;

  // Error state
  lastError: string | null;

  // Actions
  initializeModel: () => Promise<void>;
  trainModel: (tracks: UnifiedTrack[]) => Promise<boolean>;
  predictScore: (track: UnifiedTrack, hour?: number) => number;
  predictBatchScores: (tracks: UnifiedTrack[], hour?: number) => Map<string, number>;
  getHybridScore: (track: UnifiedTrack, hour?: number) => number;
  getHybridRecommendations: (candidates: UnifiedTrack[], limit?: number, hour?: number) => UnifiedTrack[];
  updateScalers: (tracks: UnifiedTrack[]) => void;
  checkAndTrain: (tracks: UnifiedTrack[]) => Promise<void>;
  resetModel: () => Promise<void>;
}

// ============================================
// Store Implementation
// ============================================

export const useMLStore = create<MLState>()(
  persist(
    (set, get) => ({
      // Initial state
      isModelLoaded: false,
      isTraining: false,
      modelVersion: 0,
      lastTrainedAt: 0,
      eventsAtLastTrain: 0,
      featureScalers: null,
      trainingMetrics: null,
      trainingProgress: null,
      lastError: null,

      /**
       * Initialize the ML model (load from storage or create new)
       */
      initializeModel: async () => {
        const trainer = getTrainer();

        try {
          // Try to load existing model
          const loaded = await trainer.loadModel();

          if (loaded) {
            set({ isModelLoaded: true, lastError: null });
            console.log('[MLStore] Model loaded successfully');
          } else {
            // Create new model
            trainer.createModel();
            set({ isModelLoaded: false, lastError: null });
            console.log('[MLStore] New model created, needs training');
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Failed to initialize model';
          console.error('[MLStore] Initialization error:', message);
          set({ lastError: message });

          // Create new model as fallback
          trainer.createModel();
        }
      },

      /**
       * Train the model on available data
       */
      trainModel: async (tracks: UnifiedTrack[]) => {
        const state = get();

        if (state.isTraining) {
          console.log('[MLStore] Training already in progress');
          return false;
        }

        const recStore = useRecommendationStore.getState();
        const { listenHistory, userProfile, dislikedTracks } = recStore;

        // Check if we can train (count listen events + disliked tracks)
        const totalSamples = listenHistory.length + Object.keys(dislikedTracks).length;
        if (!canTrain(totalSamples)) {
          console.log('[MLStore] Not enough data to train');
          set({ lastError: 'Need at least 50 listen events to train' });
          return false;
        }

        console.log(`[MLStore] Training with ${listenHistory.length} listens + ${Object.keys(dislikedTracks).length} disliked tracks`);

        // Update scalers if needed
        let scalers = state.featureScalers;
        if (!scalers) {
          scalers = tracks.length > 0 ? initializeScalers(tracks) : getDefaultScalers();
          set({ featureScalers: scalers });
        }

        // Build track map for training
        const trackMap = new Map<string, UnifiedTrack>();
        for (const track of tracks) {
          trackMap.set(track.id, track);
        }

        // Also add tracks from listen history that might not be in current tracks
        // (This requires the track data to be stored somewhere, which we don't have)

        set({
          isTraining: true,
          trainingProgress: { epoch: 0, totalEpochs: 50, loss: 0 },
          lastError: null
        });

        try {
          const trainer = getTrainer();

          // Ensure model exists
          if (!trainer.isReady()) {
            trainer.createModel();
          }

          const metrics = await trainer.train(
            trackMap,
            listenHistory,
            userProfile,
            scalers,
            { epochs: 50, batchSize: 32 },
            (progress) => {
              set({ trainingProgress: progress });
            },
            dislikedTracks // Pass disliked tracks for negative examples
          );

          // Save model
          await trainer.saveModel();

          set({
            isModelLoaded: true,
            isTraining: false,
            modelVersion: state.modelVersion + 1,
            lastTrainedAt: Date.now(),
            eventsAtLastTrain: listenHistory.length,
            trainingMetrics: metrics,
            trainingProgress: null,
            lastError: null
          });

          console.log('[MLStore] Training complete:', metrics);
          return true;
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Training failed';
          console.error('[MLStore] Training error:', message);

          set({
            isTraining: false,
            trainingProgress: null,
            lastError: message
          });

          return false;
        }
      },

      /**
       * Predict ML score for a single track
       */
      predictScore: (track: UnifiedTrack, hour?: number) => {
        const state = get();

        if (!state.isModelLoaded) {
          return 0.5; // Neutral
        }

        const trainer = getTrainer();
        if (!trainer.isReady()) {
          return 0.5;
        }

        const recStore = useRecommendationStore.getState();
        const scalers = state.featureScalers || getDefaultScalers();

        return trainer.predict(
          track,
          recStore.userProfile,
          recStore.listenHistory,
          scalers,
          hour
        );
      },

      /**
       * Batch predict for efficiency
       */
      predictBatchScores: (tracks: UnifiedTrack[], hour?: number) => {
        const scores = new Map<string, number>();
        const state = get();

        if (!state.isModelLoaded || tracks.length === 0) {
          tracks.forEach(t => scores.set(t.id, 0.5));
          return scores;
        }

        const trainer = getTrainer();
        if (!trainer.isReady()) {
          tracks.forEach(t => scores.set(t.id, 0.5));
          return scores;
        }

        const recStore = useRecommendationStore.getState();
        const scalers = state.featureScalers || getDefaultScalers();

        const predictions = trainer.predictBatch(
          tracks,
          recStore.userProfile,
          recStore.listenHistory,
          scalers,
          hour
        );

        tracks.forEach((track, i) => {
          scores.set(track.id, predictions[i]);
        });

        return scores;
      },

      /**
       * Get hybrid score combining ML and rule-based scoring
       */
      getHybridScore: (track: UnifiedTrack, hour?: number) => {
        const state = get();
        const recStore = useRecommendationStore.getState();

        // Get rule-based score (existing algorithm)
        const ruleScore = recStore.calculateTrackScore(track, { hour });

        // If ML model not ready, use rule-based only
        if (!state.isModelLoaded) {
          return ruleScore;
        }

        // Get ML score
        const mlScore = state.predictScore(track, hour);

        // Convert ML score (0-1) to same scale as rule score (-100 to 100)
        const mlScoreScaled = (mlScore * 200) - 100;

        // Weighted combination
        // ML weight increases as model improves (more training)
        // Starts at 0.1, increases by 0.1 per model version, caps at 0.6
        const mlWeight = Math.min(0.6, 0.1 + (state.modelVersion * 0.1));
        const ruleWeight = 1 - mlWeight;

        const hybridScore = (ruleScore * ruleWeight) + (mlScoreScaled * mlWeight);

        return Math.max(-100, Math.min(100, hybridScore));
      },

      /**
       * Get ML-enhanced recommendations
       */
      getHybridRecommendations: (candidates: UnifiedTrack[], limit = 20, hour?: number) => {
        const state = get();
        const recStore = useRecommendationStore.getState();
        const h = hour ?? new Date().getHours();

        // Filter out disliked tracks
        const filtered = candidates.filter(t => !recStore.isDisliked(t.id));

        if (filtered.length === 0) {
          return [];
        }

        // Score all tracks
        const scored = filtered.map(track => ({
          track,
          score: state.getHybridScore(track, h)
        }));

        // Sort by score (highest first)
        scored.sort((a, b) => b.score - a.score);

        // Add slight randomization to top results for variety
        const topCount = Math.min(limit * 2, scored.length);
        const topScored = scored.slice(0, topCount);

        // Shuffle top results slightly
        for (let i = topScored.length - 1; i > 0; i--) {
          // Only swap with nearby items (within 3 positions)
          const maxSwap = Math.min(i, 3);
          const j = i - Math.floor(Math.random() * maxSwap);
          if (j !== i && Math.abs(topScored[i].score - topScored[j].score) < 10) {
            [topScored[i], topScored[j]] = [topScored[j], topScored[i]];
          }
        }

        return topScored.slice(0, limit).map(s => s.track);
      },

      /**
       * Update feature scalers from tracks
       */
      updateScalers: (tracks: UnifiedTrack[]) => {
        if (tracks.length === 0) return;

        const scalers = initializeScalers(tracks);
        set({ featureScalers: scalers });
      },

      /**
       * Check if training is needed and train if so
       */
      checkAndTrain: async (tracks: UnifiedTrack[]) => {
        const state = get();

        if (state.isTraining) {
          return;
        }

        const recStore = useRecommendationStore.getState();
        const { listenHistory } = recStore;

        const needsTraining = shouldRetrain(
          state.lastTrainedAt,
          listenHistory.length,
          state.eventsAtLastTrain,
          state.modelVersion
        );

        if (needsTraining) {
          console.log('[MLStore] Training triggered');
          await state.trainModel(tracks);
        }
      },

      /**
       * Reset the ML model (delete and recreate)
       */
      resetModel: async () => {
        const trainer = getTrainer();

        // Delete saved model
        await trainer.deleteModel();

        // Dispose current model
        trainer.dispose();

        // Reset state
        set({
          isModelLoaded: false,
          isTraining: false,
          modelVersion: 0,
          lastTrainedAt: 0,
          eventsAtLastTrain: 0,
          featureScalers: null,
          trainingMetrics: null,
          trainingProgress: null,
          lastError: null
        });

        console.log('[MLStore] Model reset');
      }
    }),
    {
      name: 'audiio-ml',
      partialize: (state) => ({
        // Only persist these fields
        modelVersion: state.modelVersion,
        lastTrainedAt: state.lastTrainedAt,
        eventsAtLastTrain: state.eventsAtLastTrain,
        featureScalers: state.featureScalers,
        trainingMetrics: state.trainingMetrics
        // Don't persist: isModelLoaded, isTraining, trainingProgress, lastError
      })
    }
  )
);

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
      progress: state.trainingProgress,
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
