/**
 * useAlgorithm - Hook for accessing server-side ML functionality
 *
 * Provides access to the server's built-in ML engine for scoring, recommendations,
 * similarity search, and training. Plugins can override/extend this behavior on
 * the server side, but the client always calls the server's ML endpoints directly.
 *
 * ALL ML computation happens on the server - the client is a thin UI.
 */

import { useState, useEffect, useCallback } from 'react';
import { useConnectionStore } from '../stores/connection-store';

// Types for the hook
export interface TrackScore {
  trackId: string;
  finalScore: number;
  confidence: number;
  components: {
    basePreference?: number;
    mlPrediction?: number;
    audioMatch?: number;
    moodMatch?: number;
    harmonicFlow?: number;
    temporalFit?: number;
    sessionFlow?: number;
    activityMatch?: number;
    explorationBonus?: number;
    serendipityScore?: number;
    diversityScore?: number;
    recentPlayPenalty?: number;
    dislikePenalty?: number;
    repetitionPenalty?: number;
    fatiguePenalty?: number;
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
  brightness?: number;
  warmth?: number;
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

export interface UserProfile {
  artistPreferences: Record<string, number>;
  genrePreferences: Record<string, number>;
  temporalPatterns: {
    hourlyEnergy: number[];
    hourlyGenres: Record<number, string[]>;
  };
  explorationLevel: number;
  diversityWeight: number;
  topArtists: string[];
  topGenres: string[];
  totalListenTime: number;
  trackCount: number;
}

export interface AlgoState {
  isAvailable: boolean;
  isLoading: boolean;
  error: string | null;
  trainingStatus: TrainingStatus;
}

export interface UseAudiioAlgoReturn {
  // State
  state: AlgoState;

  // Scoring
  scoreTrack: (trackId: string) => Promise<TrackScore | null>;
  scoreBatch: (trackIds: string[]) => Promise<TrackScore[]>;

  // Recommendations
  getRecommendations: (count?: number, mode?: 'discovery' | 'familiar' | 'balanced') => Promise<string[]>;
  getSimilarTracks: (trackId: string, count?: number) => Promise<string[]>;

  // Radio
  getRadio: (seedTrackId: string, count?: number) => Promise<string[]>;
  getArtistRadio: (artistId: string, count?: number) => Promise<string[]>;
  getGenreRadio: (genre: string, count?: number) => Promise<string[]>;

  // Audio Analysis
  getAudioFeatures: (trackId: string) => Promise<AudioFeatures | null>;

  // User Profile
  getUserProfile: () => Promise<UserProfile | null>;
  updatePreferences: (prefs: { explorationLevel?: number; diversityWeight?: number }) => Promise<void>;

  // Queue
  getNextQueueTracks: (count?: number, context?: QueueContext) => Promise<string[]>;

  // Training
  triggerTraining: () => Promise<void>;
  refreshTrainingStatus: () => Promise<void>;
}

export interface QueueContext {
  currentTrackId?: string;
  recentTrackIds?: string[];
  recentArtists?: string[];
  mood?: string;
  energy?: 'low' | 'medium' | 'high';
  enforceVariety?: boolean;
}

// Default training status
const defaultTrainingStatus: TrainingStatus = {
  isTraining: false,
  progress: 0,
  phase: 'idle',
  message: 'Ready',
};

// Default state
const defaultState: AlgoState = {
  isAvailable: false,
  isLoading: true,
  error: null,
  trainingStatus: defaultTrainingStatus,
};

/**
 * Hook for accessing server-side ML functionality
 *
 * The server has a built-in ML engine that handles all computation.
 * Plugins can extend/override behavior on the server side.
 * The client simply calls the server's ML endpoints.
 */
export function useAlgorithm(): UseAudiioAlgoReturn {
  const { state: connectionState } = useConnectionStore();
  const [state, setState] = useState<AlgoState>(defaultState);

  // Check if ML is available (server connected + API available)
  useEffect(() => {
    const checkAvailability = async () => {
      // Check if we have the API and are connected to server
      const hasApi = typeof window !== 'undefined' && !!window.api?.algoScoreTrack;
      const isConnected = connectionState.connected;

      if (!hasApi) {
        setState({
          isAvailable: false,
          isLoading: false,
          error: 'ML API not available',
          trainingStatus: defaultTrainingStatus,
        });
        return;
      }

      if (!isConnected) {
        setState({
          isAvailable: false,
          isLoading: false,
          error: 'Not connected to server',
          trainingStatus: defaultTrainingStatus,
        });
        return;
      }

      // Try to get algo status from server
      try {
        if (window.api?.algoGetTrainingStatus) {
          const status = await window.api.algoGetTrainingStatus();
          setState({
            isAvailable: true,
            isLoading: false,
            error: null,
            trainingStatus: status || defaultTrainingStatus,
          });
        } else {
          setState({
            isAvailable: true,
            isLoading: false,
            error: null,
            trainingStatus: defaultTrainingStatus,
          });
        }
      } catch (error) {
        // Server might not have ML initialized yet, but API is available
        setState({
          isAvailable: true,
          isLoading: false,
          error: null,
          trainingStatus: defaultTrainingStatus,
        });
      }
    };

    checkAvailability();
  }, [connectionState.connected]);

  // Score a single track
  const scoreTrack = useCallback(
    async (trackId: string): Promise<TrackScore | null> => {
      if (!window.api?.algoScoreTrack) return null;

      try {
        const score = await window.api.algoScoreTrack(trackId);
        return score as TrackScore;
      } catch (error) {
        console.error('[useAlgorithm] Score failed:', error);
        return null;
      }
    },
    []
  );

  // Score multiple tracks
  const scoreBatch = useCallback(
    async (trackIds: string[]): Promise<TrackScore[]> => {
      if (!window.api?.algoScoreBatch || trackIds.length === 0) return [];

      try {
        const scores = await window.api.algoScoreBatch(trackIds);
        return (scores || []) as TrackScore[];
      } catch (error) {
        console.error('[useAlgorithm] Batch score failed:', error);
        return [];
      }
    },
    []
  );

  // Get recommendations
  const getRecommendations = useCallback(
    async (count = 20, mode?: 'discovery' | 'familiar' | 'balanced'): Promise<string[]> => {
      if (!window.api?.algoGetRecommendations) return [];

      try {
        const recommendations = await window.api.algoGetRecommendations(count, mode);
        return (recommendations || []) as string[];
      } catch (error) {
        console.error('[useAlgorithm] Recommendations failed:', error);
        return [];
      }
    },
    []
  );

  // Get similar tracks
  const getSimilarTracks = useCallback(
    async (trackId: string, count = 10): Promise<string[]> => {
      if (!window.api?.algoGetSimilar) return [];

      try {
        const similar = await window.api.algoGetSimilar(trackId, count);
        return (similar || []) as string[];
      } catch (error) {
        console.error('[useAlgorithm] Similar tracks failed:', error);
        return [];
      }
    },
    []
  );

  // Get radio from track seed
  const getRadio = useCallback(
    async (seedTrackId: string, count = 50): Promise<string[]> => {
      if (!window.api?.algoGetRadio) return [];

      try {
        const tracks = await window.api.algoGetRadio(seedTrackId, count);
        return (tracks || []) as string[];
      } catch (error) {
        console.error('[useAlgorithm] Radio failed:', error);
        return [];
      }
    },
    []
  );

  // Get radio from artist
  const getArtistRadio = useCallback(
    async (artistId: string, count = 50): Promise<string[]> => {
      if (!window.api?.algoGetArtistRadio) return [];

      try {
        const tracks = await window.api.algoGetArtistRadio(artistId, count);
        return (tracks || []) as string[];
      } catch (error) {
        console.error('[useAlgorithm] Artist radio failed:', error);
        return [];
      }
    },
    []
  );

  // Get radio from genre
  const getGenreRadio = useCallback(
    async (genre: string, count = 50): Promise<string[]> => {
      if (!window.api?.algoGetGenreRadio) return [];

      try {
        const tracks = await window.api.algoGetGenreRadio(genre, count);
        return (tracks || []) as string[];
      } catch (error) {
        console.error('[useAlgorithm] Genre radio failed:', error);
        return [];
      }
    },
    []
  );

  // Get audio features
  const getAudioFeatures = useCallback(
    async (trackId: string): Promise<AudioFeatures | null> => {
      if (!window.api?.algoGetFeatures) return null;

      try {
        const features = await window.api.algoGetFeatures(trackId);
        return features as AudioFeatures;
      } catch (error) {
        console.error('[useAlgorithm] Features failed:', error);
        return null;
      }
    },
    []
  );

  // Get user profile from server
  const getUserProfile = useCallback(async (): Promise<UserProfile | null> => {
    if (!window.api?.algoGetProfile) return null;

    try {
      const profile = await window.api.algoGetProfile();
      return profile as UserProfile;
    } catch (error) {
      console.error('[useAlgorithm] Get profile failed:', error);
      return null;
    }
  }, []);

  // Update user preferences on server
  const updatePreferences = useCallback(
    async (prefs: { explorationLevel?: number; diversityWeight?: number }): Promise<void> => {
      if (!window.api?.algoUpdatePreferences) return;

      try {
        await window.api.algoUpdatePreferences(prefs);
      } catch (error) {
        console.error('[useAlgorithm] Update preferences failed:', error);
      }
    },
    []
  );

  // Get next queue tracks from server
  const getNextQueueTracks = useCallback(
    async (count = 10, context?: QueueContext): Promise<string[]> => {
      if (!window.api?.algoGetNextQueue) return [];

      try {
        const tracks = await window.api.algoGetNextQueue(count, context);
        return (tracks || []) as string[];
      } catch (error) {
        console.error('[useAlgorithm] Get next queue failed:', error);
        return [];
      }
    },
    []
  );

  // Trigger training on server
  const triggerTraining = useCallback(async (): Promise<void> => {
    if (!window.api?.algoTrain) return;

    try {
      setState((prev) => ({
        ...prev,
        trainingStatus: {
          ...prev.trainingStatus,
          isTraining: true,
          phase: 'preparing',
          message: 'Starting training...',
        },
      }));

      await window.api.algoTrain();

      // Refresh status after training
      if (window.api?.algoGetTrainingStatus) {
        const status = await window.api.algoGetTrainingStatus();
        setState((prev) => ({
          ...prev,
          trainingStatus: status || {
            ...prev.trainingStatus,
            isTraining: false,
            phase: 'idle',
            message: 'Training complete',
            lastTrainedAt: Date.now(),
          },
        }));
      }
    } catch (error) {
      console.error('[useAlgorithm] Training failed:', error);
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
  }, []);

  // Refresh training status from server
  const refreshTrainingStatus = useCallback(async (): Promise<void> => {
    if (!window.api?.algoGetTrainingStatus) return;

    try {
      const status = await window.api.algoGetTrainingStatus();
      if (status) {
        setState((prev) => ({
          ...prev,
          trainingStatus: status,
        }));
      }
    } catch (error) {
      console.error('[useAlgorithm] Get training status failed:', error);
    }
  }, []);

  return {
    state,
    scoreTrack,
    scoreBatch,
    getRecommendations,
    getSimilarTracks,
    getRadio,
    getArtistRadio,
    getGenreRadio,
    getAudioFeatures,
    getUserProfile,
    updatePreferences,
    getNextQueueTracks,
    triggerTraining,
    refreshTrainingStatus,
  };
}

// Re-export types
export type { UseAudiioAlgoReturn as AudiioAlgoHook };

// Backward-compatible alias
export const useAudiioAlgo = useAlgorithm;
