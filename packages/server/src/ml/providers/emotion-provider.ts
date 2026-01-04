/**
 * Emotion Provider - Audio-based emotion/mood detection
 *
 * Uses a CNN model trained on mel-spectrograms to predict valence/arousal.
 */

import * as tf from '@tensorflow/tfjs';
import type { EmotionFeatures, MoodCategory, MLCoreEndpoints } from '../types';
import { MemoryCache, valenceArousalToMood } from '../utils';

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
  private isLoading = false;

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
      // Resample if needed
      const resampled = sampleRate === SAMPLE_RATE
        ? audioData
        : this.resample(audioData, sampleRate, SAMPLE_RATE);

      // Take a segment from the middle
      const segmentSamples = SAMPLE_RATE * DURATION_SECONDS;
      const start = Math.max(0, Math.floor((resampled.length - segmentSamples) / 2));
      const segment = resampled.slice(start, start + segmentSamples);

      // Compute mel spectrogram
      const melSpec = await this.computeMelSpectrogram(segment);

      // Reshape melSpec to 4D: [batch, frames, mels, channels]
      // melSpec is [frames][mels], we need to add batch and channel dimensions
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
   * Compute mel spectrogram from audio
   */
  private async computeMelSpectrogram(audioData: Float32Array): Promise<number[][]> {
    const numFrames = Math.floor((audioData.length - WINDOW_SIZE) / HOP_SIZE) + 1;
    const melSpec: number[][] = [];

    // Simple mel spectrogram computation
    // In production, use a proper DSP library
    for (let i = 0; i < numFrames; i++) {
      const start = i * HOP_SIZE;
      const frame = audioData.slice(start, start + WINDOW_SIZE);

      // Apply Hann window
      const windowed = this.applyHannWindow(frame);

      // Compute FFT magnitude
      const fftMag = this.computeFFTMagnitude(windowed);

      // Apply mel filterbank
      const melFrame = this.applyMelFilterbank(fftMag);

      // Log scale
      const logMel = melFrame.map(x => Math.log10(Math.max(1e-10, x)));

      melSpec.push(logMel);
    }

    return melSpec;
  }

  /**
   * Apply Hann window
   */
  private applyHannWindow(frame: Float32Array): Float32Array {
    const result = new Float32Array(frame.length);
    for (let i = 0; i < frame.length; i++) {
      const multiplier = 0.5 * (1 - Math.cos(2 * Math.PI * i / (frame.length - 1)));
      result[i] = frame[i] * multiplier;
    }
    return result;
  }

  /**
   * Compute FFT magnitude (simplified)
   */
  private computeFFTMagnitude(frame: Float32Array): Float32Array {
    // Simplified DFT for demonstration
    // In production, use proper FFT library
    const n = frame.length;
    const magnitude = new Float32Array(n / 2);

    for (let k = 0; k < n / 2; k++) {
      let real = 0;
      let imag = 0;

      for (let t = 0; t < n; t++) {
        const angle = (2 * Math.PI * k * t) / n;
        real += frame[t] * Math.cos(angle);
        imag -= frame[t] * Math.sin(angle);
      }

      magnitude[k] = Math.sqrt(real * real + imag * imag);
    }

    return magnitude;
  }

  /**
   * Apply mel filterbank
   */
  private applyMelFilterbank(fftMag: Float32Array): number[] {
    const melFilters: number[] = [];
    const fftBins = fftMag.length;

    for (let m = 0; m < N_MELS; m++) {
      // Simplified mel filter
      const startBin = Math.floor((m / N_MELS) * fftBins * 0.8);
      const endBin = Math.floor(((m + 1) / N_MELS) * fftBins * 0.8);

      let sum = 0;
      for (let i = startBin; i < endBin && i < fftBins; i++) {
        sum += fftMag[i];
      }
      melFilters.push(sum / Math.max(1, endBin - startBin));
    }

    return melFilters;
  }

  /**
   * Resample audio
   */
  private resample(
    audioData: Float32Array,
    fromRate: number,
    toRate: number
  ): Float32Array {
    const ratio = fromRate / toRate;
    const newLength = Math.floor(audioData.length / ratio);
    const result = new Float32Array(newLength);

    for (let i = 0; i < newLength; i++) {
      const srcIndex = i * ratio;
      const srcIndexFloor = Math.floor(srcIndex);
      const srcIndexCeil = Math.min(srcIndexFloor + 1, audioData.length - 1);
      const frac = srcIndex - srcIndexFloor;

      result[i] = audioData[srcIndexFloor] * (1 - frac) + audioData[srcIndexCeil] * frac;
    }

    return result;
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
