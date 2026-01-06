/**
 * Essentia Provider - Real-time audio analysis using Essentia.js
 *
 * Uses WebAssembly for in-browser audio feature extraction.
 * Provides specialized music analysis algorithms (BPM, key, danceability, MFCC).
 *
 * Note: This provider loads its own Essentia instance for specialized algorithms.
 * For basic audio processing (FFT, mel spectrogram), use AudioProcessor instead.
 */

import type { AudioFeatures, MusicalKey } from '../types';
import { MemoryCache, getAudioProcessor } from '../utils';

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
      const resampled = getAudioProcessor().resample(audioData, sampleRate, targetSampleRate);

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
   * Cache features for a track
   */
  cacheFeatures(trackId: string, features: AudioFeatures): void {
    this.cache.set(trackId, features);
  }

  // =========================================================================
  // DEEP AUDIO EMBEDDINGS (uses AudioProcessor for resampling)
  // =========================================================================

  /**
   * Generate deep audio embedding vector (128-dim)
   * Uses MFCC statistics and spectral features to create a "fingerprint"
   * that represents the sonic characteristics of a track.
   */
  async generateAudioEmbedding(
    buffer: ArrayBuffer,
    sampleRate: number
  ): Promise<number[] | null> {
    if (!this.essentia) {
      await this.initialize();
    }

    if (!this.essentia) {
      return null;
    }

    try {
      const audioData = new Float32Array(buffer);
      const targetSampleRate = 44100;
      const resampled = getAudioProcessor().resample(audioData, sampleRate, targetSampleRate);

      const signal = this.essentia.arrayToVector(resampled);

      // Extract comprehensive MFCC (20 coefficients)
      const mfcc = this.essentia.MFCC(signal, { numberCoefficients: 20 });
      const mfccFrames = mfcc.mfcc;

      // Calculate MFCC statistics across frames (mean, std, delta)
      const mfccStats = this.calculateMfccStatistics(mfccFrames);

      // Extract spectral features for embedding
      const spectral = this.essentia.SpectralCentroidTime(signal);
      const zcr = this.essentia.ZeroCrossingRate(signal);
      const energy = this.essentia.Energy(signal);
      const rhythm = this.essentia.RhythmExtractor(signal);
      const key = this.essentia.KeyExtractor(signal);

      // Build 128-dimensional embedding vector
      const embedding: number[] = [
        // MFCC mean (20)
        ...mfccStats.mean,
        // MFCC std (20)
        ...mfccStats.std,
        // MFCC delta mean (20)
        ...mfccStats.deltaMean,
        // Spectral features (normalized to 0-1)
        Math.min(1, spectral.spectralCentroid / 10000),
        zcr.zeroCrossingRate,
        this.normalizeEnergy(energy.energy),
        // Rhythm features
        rhythm.bpm / 200, // Normalize BPM
        rhythm.confidence,
        // Key/Mode (one-hot encoded: 12 keys + 2 modes = 14)
        ...this.encodeKey(key.key, key.scale),
        // Pad to 128 dimensions
        ...new Array(128 - (20 + 20 + 20 + 5 + 14)).fill(0).map((_, i) =>
          Math.sin(i * 0.1 + (mfccStats.mean[0] || 0))
        ),
      ].slice(0, 128);

      // L2 normalize
      const norm = Math.sqrt(embedding.reduce((sum, v) => sum + v * v, 0)) || 1;
      return embedding.map(v => v / norm);
    } catch (error) {
      console.error('[EssentiaProvider] Embedding generation failed:', error);
      return null;
    }
  }

  /**
   * Calculate MFCC statistics for embedding
   */
  private calculateMfccStatistics(mfccFrames: Float32Array[]): {
    mean: number[];
    std: number[];
    deltaMean: number[];
  } {
    const numCoeffs = 20;
    const numFrames = mfccFrames.length;

    const mean = new Array(numCoeffs).fill(0);
    const variance = new Array(numCoeffs).fill(0);
    const deltaMean = new Array(numCoeffs).fill(0);

    if (numFrames === 0) {
      return { mean, std: mean.slice(), deltaMean };
    }

    // Calculate mean
    for (const frame of mfccFrames) {
      for (let i = 0; i < numCoeffs && i < frame.length; i++) {
        mean[i] += frame[i];
      }
    }
    for (let i = 0; i < numCoeffs; i++) {
      mean[i] /= numFrames;
    }

    // Calculate variance
    for (const frame of mfccFrames) {
      for (let i = 0; i < numCoeffs && i < frame.length; i++) {
        variance[i] += (frame[i] - mean[i]) ** 2;
      }
    }

    const std = variance.map((v, i) => Math.sqrt(v / numFrames));

    // Calculate delta (rate of change)
    for (let f = 1; f < numFrames; f++) {
      for (let i = 0; i < numCoeffs && i < mfccFrames[f].length; i++) {
        deltaMean[i] += Math.abs(mfccFrames[f][i] - mfccFrames[f - 1][i]);
      }
    }
    for (let i = 0; i < numCoeffs; i++) {
      deltaMean[i] /= Math.max(1, numFrames - 1);
    }

    return { mean, std, deltaMean };
  }

  /**
   * Encode key and mode as one-hot vector
   */
  private encodeKey(key: string, scale: string): number[] {
    const keys = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const keyVector = new Array(12).fill(0);
    const modeVector = new Array(2).fill(0);

    const keyIdx = keys.indexOf(key);
    if (keyIdx >= 0) keyVector[keyIdx] = 1;

    modeVector[scale.toLowerCase() === 'major' ? 0 : 1] = 1;

    return [...keyVector, ...modeVector];
  }

  // =========================================================================
  // VOICE / INSTRUMENTAL DETECTION
  // =========================================================================

  /**
   * Improved voice/instrumental detection using spectral analysis
   * Returns a value between 0 (pure instrumental) and 1 (pure vocals)
   */
  async analyzeVoiceInstrumental(
    buffer: ArrayBuffer,
    sampleRate: number
  ): Promise<{ voicePresence: number; confidence: number }> {
    try {
      const audioData = new Float32Array(buffer);

      // Analyze vocal frequency range (80Hz - 3kHz typically)
      const vocalEnergy = this.calculateVocalBandEnergy(audioData, sampleRate);

      // Analyze harmonic structure (vocals have strong harmonics)
      const harmonicity = this.calculateHarmonicity(audioData, sampleRate);

      // Use ZCR pattern (speech has specific patterns)
      const zcrPattern = this.analyzeZcrPattern(audioData);

      // Combine metrics
      const voicePresence = (vocalEnergy * 0.4 + harmonicity * 0.4 + zcrPattern * 0.2);

      return {
        voicePresence: Math.max(0, Math.min(1, voicePresence)),
        confidence: 0.75, // Confidence in our analysis
      };
    } catch (error) {
      console.error('[EssentiaProvider] Voice analysis failed:', error);
      return { voicePresence: 0.5, confidence: 0 };
    }
  }

  /**
   * Calculate energy in vocal frequency band
   */
  private calculateVocalBandEnergy(audioData: Float32Array, sampleRate: number): number {
    // Simple bandpass approximation using ZCR ranges
    const segmentSize = 2048;
    const numSegments = Math.floor(audioData.length / segmentSize);

    let vocalEnergy = 0;
    let totalEnergy = 0;

    for (let s = 0; s < numSegments; s++) {
      const start = s * segmentSize;
      let segEnergy = 0;
      let zcr = 0;

      for (let i = 0; i < segmentSize; i++) {
        segEnergy += audioData[start + i] ** 2;
        if (i > 0 && (audioData[start + i] >= 0) !== (audioData[start + i - 1] >= 0)) {
          zcr++;
        }
      }

      // ZCR corresponding to vocal range (estimate)
      const zcrRate = zcr / segmentSize;
      const estimatedFreq = zcrRate * sampleRate / 2;

      // Vocal range: roughly 80Hz to 3000Hz
      if (estimatedFreq > 80 && estimatedFreq < 3000) {
        vocalEnergy += segEnergy;
      }
      totalEnergy += segEnergy;
    }

    return totalEnergy > 0 ? vocalEnergy / totalEnergy : 0.5;
  }

  /**
   * Calculate harmonicity (vocal sounds are more harmonic)
   */
  private calculateHarmonicity(audioData: Float32Array, sampleRate: number): number {
    // Simplified autocorrelation for pitch detection
    const frameSize = 2048;
    const segment = audioData.slice(0, Math.min(frameSize * 10, audioData.length));

    let periodicEnergy = 0;
    let totalEnergy = 0;

    for (let lag = 20; lag < 200; lag++) {
      let correlation = 0;
      for (let i = 0; i < segment.length - lag; i++) {
        correlation += segment[i] * segment[i + lag];
        if (lag === 20) totalEnergy += segment[i] ** 2;
      }
      if (correlation > periodicEnergy) {
        periodicEnergy = correlation;
      }
    }

    return totalEnergy > 0 ? Math.min(1, periodicEnergy / totalEnergy) : 0.5;
  }

  /**
   * Analyze ZCR pattern for voice detection
   */
  private analyzeZcrPattern(audioData: Float32Array): number {
    const frameSize = 1024;
    const numFrames = Math.floor(audioData.length / frameSize);
    const zcrValues: number[] = [];

    for (let f = 0; f < numFrames; f++) {
      let zcr = 0;
      const start = f * frameSize;
      for (let i = 1; i < frameSize; i++) {
        if ((audioData[start + i] >= 0) !== (audioData[start + i - 1] >= 0)) {
          zcr++;
        }
      }
      zcrValues.push(zcr / frameSize);
    }

    if (zcrValues.length === 0) return 0.5;

    // Voice has higher variance in ZCR (words, silence gaps)
    const mean = zcrValues.reduce((a, b) => a + b, 0) / zcrValues.length;
    const variance = zcrValues.reduce((sum, v) => sum + (v - mean) ** 2, 0) / zcrValues.length;

    // Higher variance suggests more vocal content
    return Math.min(1, variance * 50);
  }

  // =========================================================================
  // ADVANCED DANCEABILITY
  // =========================================================================

  /**
   * Enhanced danceability scoring using multiple factors
   */
  async getAdvancedDanceability(
    buffer: ArrayBuffer,
    sampleRate: number
  ): Promise<{ danceability: number; confidence: number }> {
    if (!this.essentia) {
      await this.initialize();
    }

    if (!this.essentia) {
      return { danceability: 0.5, confidence: 0 };
    }

    try {
      const audioData = new Float32Array(buffer);
      const targetSampleRate = 44100;
      const resampled = getAudioProcessor().resample(audioData, sampleRate, targetSampleRate);

      const signal = this.essentia.arrayToVector(resampled);

      // Core Essentia danceability
      const danceResult = this.essentia.Danceability(signal);
      const baseDanceability = danceResult.danceability;

      // Rhythm strength
      const rhythm = this.essentia.RhythmExtractor(signal);
      const rhythmFactor = rhythm.confidence;

      // BPM factor (danceable range: 90-140 BPM)
      const bpmFactor = 1 - Math.abs(rhythm.bpm - 115) / 50;

      // Energy factor (danceable music is typically energetic)
      const energy = this.essentia.Energy(signal);
      const energyFactor = this.normalizeEnergy(energy.energy);

      // Combine factors
      const finalDanceability = (
        baseDanceability * 0.4 +
        rhythmFactor * 0.2 +
        Math.max(0, Math.min(1, bpmFactor)) * 0.2 +
        energyFactor * 0.2
      );

      return {
        danceability: Math.max(0, Math.min(1, finalDanceability)),
        confidence: 0.8,
      };
    } catch (error) {
      console.error('[EssentiaProvider] Danceability analysis failed:', error);
      return { danceability: 0.5, confidence: 0 };
    }
  }
}
