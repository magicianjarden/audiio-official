/**
 * UI Adapter - Bridges Audiio Algo plugin to the UI integration layer
 *
 * This is a simplified adapter that provides a UI-compatible interface.
 * Full integration with ml-core will be completed in the UI package.
 */

import { AUDIIO_ALGO_MANIFEST } from '../manifest';

/**
 * Audio features type matching UI expectations
 */
interface UIAudioFeatures {
  bpm?: number;
  key?: string;
  mode?: 'major' | 'minor';
  energy?: number;
  danceability?: number;
  acousticness?: number;
  instrumentalness?: number;
  valence?: number;
  loudness?: number;
  speechiness?: number;
}

/**
 * Create a UI-compatible plugin wrapper for AudiioAlgorithm
 */
export function createUIPluginAdapter() {
  let initialized = false;

  return {
    manifest: {
      id: AUDIIO_ALGO_MANIFEST.id,
      name: AUDIIO_ALGO_MANIFEST.name,
      version: AUDIIO_ALGO_MANIFEST.version,
      capabilities: {
        audioFeatures: true,
        emotionDetection: true,
        lyricsAnalysis: true,
        fingerprinting: true,
        embeddings: true,
        neuralScoring: true,
      },
    },

    async initialize(): Promise<void> {
      if (initialized) return;
      initialized = true;
      console.log('[UIAdapter] Audiio Algorithm adapter ready');
    },

    async dispose(): Promise<void> {
      initialized = false;
    },

    async getAudioFeatures(_trackId: string): Promise<UIAudioFeatures | null> {
      // Audio features will be provided through the full ml-core integration
      return null;
    },

    async findSimilar(_trackId: string, _limit: number): Promise<string[]> {
      // Similarity search will be provided through the full ml-core integration
      return [];
    },

    async scoreTrack(
      _track: unknown,
      _context: unknown
    ): Promise<{ score: number; confidence: number }> {
      // Scoring will be provided through the full ml-core integration
      return { score: 0.5, confidence: 0 };
    },
  };
}

/**
 * Export singleton factory
 */
export const audiioAlgoUIPlugin = createUIPluginAdapter();

export default audiioAlgoUIPlugin;
