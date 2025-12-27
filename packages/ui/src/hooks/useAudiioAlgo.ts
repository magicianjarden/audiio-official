/**
 * useAudiioAlgo - Hook for integrating with the Audiio Algorithm plugin
 *
 * Provides easy access to ML-powered features like scoring, recommendations,
 * similarity search, and training status.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { usePluginStore } from '../stores/plugin-store';

// Types for the hook
export interface TrackScore {
  trackId: string;
  finalScore: number;
  confidence: number;
  components: {
    preference?: number;
    temporal?: number;
    exploration?: number;
    flow?: number;
    neural?: number;
  };
  explanation: string[];
}

export interface AudioFeatures {
  bpm?: number;
  key?: string;
  mode?: 'major' | 'minor';
  energy?: number;
  danceability?: number;
  valence?: number;
  acousticness?: number;
  instrumentalness?: number;
  loudness?: number;
}

export interface TrainingStatus {
  isTraining: boolean;
  progress: number;
  phase: 'idle' | 'preparing' | 'training' | 'validating' | 'saving';
  message: string;
  lastTrainedAt?: number;
  modelVersion?: string;
}

export interface AlgoState {
  isEnabled: boolean;
  isInitialized: boolean;
  isLoading: boolean;
  error: string | null;
  trainingStatus: TrainingStatus;
  settings: Record<string, boolean | string | number>;
}

export interface UseAudiioAlgoReturn {
  // State
  state: AlgoState;

  // Scoring
  scoreTrack: (trackId: string) => Promise<TrackScore | null>;
  scoreBatch: (trackIds: string[]) => Promise<TrackScore[]>;

  // Recommendations
  getRecommendations: (count?: number) => Promise<string[]>;
  getSimilarTracks: (trackId: string, count?: number) => Promise<string[]>;

  // Audio Analysis
  getAudioFeatures: (trackId: string) => Promise<AudioFeatures | null>;

  // Training
  triggerTraining: () => Promise<void>;
  getTrainingStatus: () => TrainingStatus;

  // Settings
  updateSetting: (key: string, value: boolean | string | number) => void;
}

// Default training status
const defaultTrainingStatus: TrainingStatus = {
  isTraining: false,
  progress: 0,
  phase: 'idle',
  message: 'Model ready',
};

// Default state
const defaultState: AlgoState = {
  isEnabled: false,
  isInitialized: false,
  isLoading: false,
  error: null,
  trainingStatus: defaultTrainingStatus,
  settings: {},
};

/**
 * Hook for accessing Audiio Algorithm functionality
 */
export function useAudiioAlgo(): UseAudiioAlgoReturn {
  const { getPlugin, updatePluginSetting, getPluginSettings } = usePluginStore();

  const [state, setState] = useState<AlgoState>(defaultState);

  // Get plugin state
  const plugin = useMemo(() => getPlugin('audiio-algo'), [getPlugin]);
  const isEnabled = plugin?.enabled ?? false;

  // Initialize state from plugin
  useEffect(() => {
    if (plugin) {
      setState((prev) => ({
        ...prev,
        isEnabled: plugin.enabled,
        settings: plugin.settings ?? {},
      }));
    }
  }, [plugin]);

  // Check if algorithm is available via IPC
  useEffect(() => {
    const checkInitialization = async () => {
      if (!isEnabled) {
        setState((prev) => ({ ...prev, isInitialized: false }));
        return;
      }

      try {
        // Check if the algorithm addon is loaded in main process
        if (window.api?.isAddonLoaded) {
          const loaded = await window.api.isAddonLoaded('audiio-algo');
          setState((prev) => ({
            ...prev,
            isInitialized: loaded,
            isLoading: false,
            error: loaded ? null : 'Algorithm not loaded',
          }));
        }
      } catch (error) {
        setState((prev) => ({
          ...prev,
          isInitialized: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        }));
      }
    };

    checkInitialization();
  }, [isEnabled]);

  // Score a single track
  const scoreTrack = useCallback(
    async (trackId: string): Promise<TrackScore | null> => {
      if (!state.isInitialized || !window.api?.algoScoreTrack) {
        return null;
      }

      try {
        const score = await window.api.algoScoreTrack(trackId);
        return score as TrackScore;
      } catch (error) {
        console.error('[useAudiioAlgo] Score failed:', error);
        return null;
      }
    },
    [state.isInitialized]
  );

  // Score multiple tracks
  const scoreBatch = useCallback(
    async (trackIds: string[]): Promise<TrackScore[]> => {
      if (!state.isInitialized || !window.api?.algoScoreBatch) {
        return [];
      }

      try {
        const scores = await window.api.algoScoreBatch(trackIds);
        return scores as TrackScore[];
      } catch (error) {
        console.error('[useAudiioAlgo] Batch score failed:', error);
        return [];
      }
    },
    [state.isInitialized]
  );

  // Get recommendations
  const getRecommendations = useCallback(
    async (count = 20): Promise<string[]> => {
      if (!state.isInitialized || !window.api?.algoGetRecommendations) {
        return [];
      }

      try {
        const recommendations = await window.api.algoGetRecommendations(count);
        return recommendations as string[];
      } catch (error) {
        console.error('[useAudiioAlgo] Recommendations failed:', error);
        return [];
      }
    },
    [state.isInitialized]
  );

  // Get similar tracks
  const getSimilarTracks = useCallback(
    async (trackId: string, count = 10): Promise<string[]> => {
      if (!state.isInitialized || !window.api?.algoGetSimilar) {
        return [];
      }

      try {
        const similar = await window.api.algoGetSimilar(trackId, count);
        return similar as string[];
      } catch (error) {
        console.error('[useAudiioAlgo] Similar tracks failed:', error);
        return [];
      }
    },
    [state.isInitialized]
  );

  // Get audio features
  const getAudioFeatures = useCallback(
    async (trackId: string): Promise<AudioFeatures | null> => {
      if (!state.isInitialized || !window.api?.algoGetFeatures) {
        return null;
      }

      try {
        const features = await window.api.algoGetFeatures(trackId);
        return features as AudioFeatures;
      } catch (error) {
        console.error('[useAudiioAlgo] Features failed:', error);
        return null;
      }
    },
    [state.isInitialized]
  );

  // Trigger training
  const triggerTraining = useCallback(async (): Promise<void> => {
    if (!state.isInitialized || !window.api?.algoTrain) {
      return;
    }

    try {
      setState((prev) => ({
        ...prev,
        trainingStatus: {
          ...prev.trainingStatus,
          isTraining: true,
          phase: 'preparing',
          message: 'Preparing training data...',
        },
      }));

      await window.api.algoTrain();

      setState((prev) => ({
        ...prev,
        trainingStatus: {
          ...prev.trainingStatus,
          isTraining: false,
          phase: 'idle',
          message: 'Training complete',
          lastTrainedAt: Date.now(),
        },
      }));
    } catch (error) {
      console.error('[useAudiioAlgo] Training failed:', error);
      setState((prev) => ({
        ...prev,
        trainingStatus: {
          ...prev.trainingStatus,
          isTraining: false,
          phase: 'idle',
          message: 'Training failed',
        },
      }));
    }
  }, [state.isInitialized]);

  // Get training status
  const getTrainingStatus = useCallback((): TrainingStatus => {
    return state.trainingStatus;
  }, [state.trainingStatus]);

  // Update setting
  const updateSetting = useCallback(
    (key: string, value: boolean | string | number): void => {
      updatePluginSetting('audiio-algo', key, value);
      setState((prev) => ({
        ...prev,
        settings: { ...prev.settings, [key]: value },
      }));
    },
    [updatePluginSetting]
  );

  return {
    state,
    scoreTrack,
    scoreBatch,
    getRecommendations,
    getSimilarTracks,
    getAudioFeatures,
    triggerTraining,
    getTrainingStatus,
    updateSetting,
  };
}

// Re-export types
export type { UseAudiioAlgoReturn as AudiioAlgoHook };
