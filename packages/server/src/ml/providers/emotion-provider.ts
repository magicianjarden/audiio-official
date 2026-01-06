/**
 * Emotion Provider - Audio-based emotion/mood detection
 *
 * Uses a CNN model trained on mel-spectrograms to predict valence/arousal.
 * Leverages AudioProcessor (Essentia WASM) for high-performance spectrogram computation.
 */

import * as tf from '@tensorflow/tfjs';
import type { EmotionFeatures, MoodCategory, MLCoreEndpoints } from '../types';
import { MemoryCache, valenceArousalToMood, getAudioProcessor } from '../utils';

const MODEL_KEY = 'emotion-model';
const SAMPLE_RATE = 22050;
const WINDOW_SIZE = 2048;
const HOP_SIZE = 512;
const N_MELS = 128;
const DURATION_SECONDS = 10;

export class EmotionProvider {
  private model: tf.LayersModel | null = null;
  private endpoints!: MLCoreEndpoints;
  private cache: MemoryCache<EmotionFeatures>;

  constructor() {
    this.cache = new MemoryCache<EmotionFeatures>(1000, 3600000);
  }

  /**
   * Initialize the emotion model
   */
  async initialize(endpoints: MLCoreEndpoints): Promise<void> {
    this.endpoints = endpoints;

    // Try to load existing model
    const modelStorage = endpoints.storage.getModelStorage();
    const existingModel = await modelStorage.load(MODEL_KEY);

    if (existingModel) {
      this.model = existingModel;
      console.log('[EmotionProvider] Loaded existing model');
    } else {
      // Create default model (will be trained with data)
      this.model = this.createModel();
      console.log('[EmotionProvider] Created new model');
    }
  }

  /**
   * Dispose resources
   */
  async dispose(): Promise<void> {
    if (this.model) {
      this.model.dispose();
      this.model = null;
    }
    this.cache.clear();
  }

  /**
   * Get emotion features for a track
   */
  async getEmotionFeatures(trackId: string): Promise<EmotionFeatures | null> {
    // Check cache
    const cached = this.cache.get(trackId);
    if (cached) return cached;

    // Features need to be analyzed from audio
    return null;
  }

  /**
   * Analyze audio buffer for emotion
   */
  async analyzeAudio(
    audioData: Float32Array,
    sampleRate: number
  ): Promise<EmotionFeatures | null> {
    if (!this.model) {
      console.warn('[EmotionProvider] Model not loaded');
      return this.getDefaultFeatures();
    }

    try {
      const audioProcessor = getAudioProcessor();
      await audioProcessor.initialize();

      // Resample using AudioProcessor (uses Essentia if available)
      const resampled = audioProcessor.resample(audioData, sampleRate, SAMPLE_RATE);

      // Take a segment from the middle
      const segmentSamples = SAMPLE_RATE * DURATION_SECONDS;
      const start = Math.max(0, Math.floor((resampled.length - segmentSamples) / 2));
      const segment = resampled.slice(start, start + segmentSamples);

      // Compute mel spectrogram using AudioProcessor (uses Essentia if available)
      const melSpec = audioProcessor.computeMelSpectrogram(segment, {
        sampleRate: SAMPLE_RATE,
        windowSize: WINDOW_SIZE,
        hopSize: HOP_SIZE,
        nMels: N_MELS,
      });

      // Reshape melSpec to 4D: [batch, frames, mels, channels]
      const melSpec4d = melSpec.map(frame => frame.map(val => [val]));

      // Predict valence/arousal
      const inputTensor = tf.tensor4d([melSpec4d]);
      const prediction = this.model.predict(inputTensor) as tf.Tensor;
      const [valence, arousal] = await prediction.data();

      // Cleanup
      inputTensor.dispose();
      prediction.dispose();

      // Determine mood category
      const moodCategory = valenceArousalToMood(valence, arousal);

      return {
        valence,
        arousal,
        moodCategory,
        moodConfidence: 0.7,
      };
    } catch (error) {
      console.error('[EmotionProvider] Analysis failed:', error);
      return this.getDefaultFeatures();
    }
  }

  /**
   * Create the emotion detection model
   */
  private createModel(): tf.LayersModel {
    const numFrames = Math.floor((SAMPLE_RATE * DURATION_SECONDS - WINDOW_SIZE) / HOP_SIZE) + 1;

    const model = tf.sequential();

    // Conv block 1
    model.add(tf.layers.conv2d({
      inputShape: [numFrames, N_MELS, 1],
      filters: 32,
      kernelSize: [3, 3],
      activation: 'relu',
      padding: 'same',
    }));
    model.add(tf.layers.batchNormalization());
    model.add(tf.layers.maxPooling2d({ poolSize: [2, 2] }));

    // Conv block 2
    model.add(tf.layers.conv2d({
      filters: 64,
      kernelSize: [3, 3],
      activation: 'relu',
      padding: 'same',
    }));
    model.add(tf.layers.batchNormalization());
    model.add(tf.layers.maxPooling2d({ poolSize: [2, 2] }));

    // Conv block 3
    model.add(tf.layers.conv2d({
      filters: 128,
      kernelSize: [3, 3],
      activation: 'relu',
      padding: 'same',
    }));
    model.add(tf.layers.batchNormalization());
    model.add(tf.layers.globalAveragePooling2d({}));

    // Dense layers
    model.add(tf.layers.dense({ units: 64, activation: 'relu' }));
    model.add(tf.layers.dropout({ rate: 0.3 }));

    // Output: valence and arousal (0-1)
    model.add(tf.layers.dense({ units: 2, activation: 'sigmoid' }));

    model.compile({
      optimizer: tf.train.adam(0.001),
      loss: 'meanSquaredError',
      metrics: ['mae'],
    });

    return model;
  }

  /**
   * Get default features when analysis fails
   */
  private getDefaultFeatures(): EmotionFeatures {
    return {
      valence: 0.5,
      arousal: 0.5,
      moodCategory: 'calm',
      moodConfidence: 0,
    };
  }

  /**
   * Cache features for a track
   */
  cacheFeatures(trackId: string, features: EmotionFeatures): void {
    this.cache.set(trackId, features);
  }
}
