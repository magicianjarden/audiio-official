/**
 * Essentia Provider - Real-time audio analysis using Essentia.js
 *
 * Uses WebAssembly for in-browser audio feature extraction.
 */

import type { AudioFeatures, MusicalKey } from '@audiio/ml-sdk';
import { MemoryCache } from '@audiio/ml-sdk';

// Essentia.js types (will be loaded dynamically)
interface EssentiaInstance {
  arrayToVector: (arr: Float32Array) => any;
  vectorToArray: (vec: any) => Float32Array;

  // Algorithms
  RhythmExtractor: (signal: any) => { bpm: number; confidence: number };
  KeyExtractor: (signal: any) => { key: string; scale: string; strength: number };
  Loudness: (signal: any) => { loudness: number };
  Energy: (signal: any) => { energy: number };
  DynamicComplexity: (signal: any) => { dynamicComplexity: number; loudness: number };
  Danceability: (signal: any) => { danceability: number };
  SpectralCentroidTime: (signal: any) => { spectralCentroid: number };
  ZeroCrossingRate: (signal: any) => { zeroCrossingRate: number };
  MFCC: (signal: any, options?: any) => { mfcc: Float32Array[] };
}

interface EssentiaWASM {
  EssentiaWASM: new () => EssentiaInstance;
}

type QualityLevel = 'fast' | 'balanced' | 'accurate';

export class EssentiaProvider {
  private essentia: EssentiaInstance | null = null;
  private isLoading = false;
  private loadPromise: Promise<void> | null = null;
  private cache: MemoryCache<AudioFeatures>;
  private quality: QualityLevel;

  constructor(quality: QualityLevel = 'balanced') {
    this.quality = quality;
    this.cache = new MemoryCache<AudioFeatures>(1000, 3600000); // 1 hour cache
  }

  /**
   * Initialize the Essentia WASM module
   */
  async initialize(): Promise<void> {
    if (this.essentia) return;
    if (this.loadPromise) return this.loadPromise;

    this.isLoading = true;
    this.loadPromise = this.loadEssentia();
    await this.loadPromise;
    this.isLoading = false;
  }

  /**
   * Load Essentia.js WASM
   */
  private async loadEssentia(): Promise<void> {
    try {
      // Dynamic import of essentia.js
      const essentiaModule = await import('essentia.js');

      // Initialize WASM - the default export is a Promise that resolves to a constructor
      const EssentiaWASM = await essentiaModule.default;
      this.essentia = new EssentiaWASM() as EssentiaInstance;

      console.log('[EssentiaProvider] WASM loaded successfully');
    } catch (error) {
      console.error('[EssentiaProvider] Failed to load WASM:', error);
      throw error;
    }
  }

  /**
   * Dispose resources
   */
  async dispose(): Promise<void> {
    this.essentia = null;
    this.cache.clear();
  }

  /**
   * Get audio features for a track (by ID)
   */
  async getAudioFeatures(trackId: string): Promise<AudioFeatures | null> {
    // Check cache
    const cached = this.cache.get(trackId);
    if (cached) return cached;

    // Features need to be analyzed from audio buffer
    // This will be called by the audio player when track plays
    return null;
  }

  /**
   * Analyze audio buffer
   */
  async analyzeBuffer(buffer: ArrayBuffer, sampleRate: number): Promise<AudioFeatures | null> {
    if (!this.essentia) {
      await this.initialize();
    }

    if (!this.essentia) {
      console.error('[EssentiaProvider] Essentia not loaded');
      return null;
    }

    try {
      // Convert to Float32Array
      const audioData = new Float32Array(buffer);

      // Resample if needed (Essentia expects 44100 Hz)
      const targetSampleRate = 44100;
      const resampled = sampleRate === targetSampleRate
        ? audioData
        : this.resample(audioData, sampleRate, targetSampleRate);

      // Convert to Essentia vector
      const signal = this.essentia.arrayToVector(resampled);

      // Extract features based on quality level
      const features = await this.extractFeatures(signal, resampled);

      return features;
    } catch (error) {
      console.error('[EssentiaProvider] Analysis failed:', error);
      return null;
    }
  }

  /**
   * Extract features from signal
   */
  private async extractFeatures(signal: any, audioData: Float32Array): Promise<AudioFeatures> {
    const features: AudioFeatures = {};

    try {
      // === BPM / Rhythm ===
      const rhythm = this.essentia!.RhythmExtractor(signal);
      features.bpm = rhythm.bpm;
      features.beatStrength = rhythm.confidence;

      // === Key Detection ===
      const key = this.essentia!.KeyExtractor(signal);
      features.key = this.normalizeKey(key.key) as MusicalKey;
      features.mode = key.scale.toLowerCase() as 'major' | 'minor';

      // === Energy & Loudness ===
      const loudness = this.essentia!.Loudness(signal);
      features.loudness = loudness.loudness;

      const energy = this.essentia!.Energy(signal);
      features.energy = this.normalizeEnergy(energy.energy);

      // === Danceability ===
      if (this.quality !== 'fast') {
        const danceability = this.essentia!.Danceability(signal);
        features.danceability = danceability.danceability;
      }

      // === Spectral Features ===
      if (this.quality === 'accurate') {
        const spectral = this.essentia!.SpectralCentroidTime(signal);
        features.spectralCentroid = spectral.spectralCentroid;

        const zcr = this.essentia!.ZeroCrossingRate(signal);
        features.zeroCrossingRate = zcr.zeroCrossingRate;

        // MFCC for ML models
        const mfcc = this.essentia!.MFCC(signal, { numberCoefficients: 13 });
        features.mfcc = Array.from(mfcc.mfcc[0]);
      }

      // === Derived Features ===

      // Estimate valence from spectral and energy features
      features.valence = this.estimateValence(features);

      // Estimate acousticness
      features.acousticness = this.estimateAcousticness(features);

      // Estimate instrumentalness (requires speechiness estimate)
      const speechEstimate = this.estimateSpeechiness(audioData);
      features.speechiness = speechEstimate;
      features.instrumentalness = 1 - speechEstimate;

      features.analysisConfidence = 0.8;

    } catch (error) {
      console.error('[EssentiaProvider] Feature extraction error:', error);
    }

    return features;
  }

  /**
   * Normalize key to standard format
   */
  private normalizeKey(key: string): string {
    const keyMap: Record<string, string> = {
      'C': 'C', 'C#': 'C#', 'Db': 'Db', 'D': 'D', 'D#': 'D#', 'Eb': 'Eb',
      'E': 'E', 'F': 'F', 'F#': 'F#', 'Gb': 'Gb', 'G': 'G', 'G#': 'G#',
      'Ab': 'Ab', 'A': 'A', 'A#': 'A#', 'Bb': 'Bb', 'B': 'B',
    };
    return keyMap[key] || 'C';
  }

  /**
   * Normalize energy to 0-1 range
   */
  private normalizeEnergy(energy: number): number {
    // Energy values from Essentia can vary widely
    // Normalize using sigmoid-like function
    const normalized = 2 / (1 + Math.exp(-energy / 1000)) - 1;
    return Math.max(0, Math.min(1, normalized));
  }

  /**
   * Estimate valence from other features
   */
  private estimateValence(features: AudioFeatures): number {
    // Higher energy and brighter tones suggest higher valence
    const energyContribution = (features.energy ?? 0.5) * 0.4;
    const modeContribution = features.mode === 'major' ? 0.3 : 0.15;
    const brightnessContribution = features.spectralCentroid
      ? Math.min(1, features.spectralCentroid / 5000) * 0.3
      : 0.25;

    return energyContribution + modeContribution + brightnessContribution;
  }

  /**
   * Estimate acousticness
   */
  private estimateAcousticness(features: AudioFeatures): number {
    // Lower spectral centroid and less dynamic range suggest acoustic
    const spectralFactor = features.spectralCentroid
      ? 1 - Math.min(1, features.spectralCentroid / 4000)
      : 0.5;

    return spectralFactor;
  }

  /**
   * Estimate speechiness from audio
   */
  private estimateSpeechiness(audioData: Float32Array): number {
    // Simple ZCR-based estimate
    let zeroCrossings = 0;
    for (let i = 1; i < audioData.length; i++) {
      if ((audioData[i] >= 0) !== (audioData[i - 1] >= 0)) {
        zeroCrossings++;
      }
    }

    const zcr = zeroCrossings / audioData.length;

    // Speech typically has higher ZCR than music
    // Normalize to 0-1
    return Math.min(1, zcr * 10);
  }

  /**
   * Resample audio data
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
   * Cache features for a track
   */
  cacheFeatures(trackId: string, features: AudioFeatures): void {
    this.cache.set(trackId, features);
  }
}
