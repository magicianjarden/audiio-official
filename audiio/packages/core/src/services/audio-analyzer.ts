/**
 * Audio Analyzer Service
 * Extracts audio features (BPM, key, energy, etc.) from audio files/streams
 *
 * Uses FFmpeg for audio extraction and custom DSP algorithms for analysis.
 * Designed to work in Electron's main process.
 */

import { spawn } from 'child_process';
import type {
  AudioFeatures,
  AudioData,
  AnalysisOptions,
  BpmResult,
  KeyResult,
  MusicalKey,
  MusicalMode,
  Chromagram
} from '../types/audio-features';

// ============================================
// Constants
// ============================================

/** Standard sample rate for analysis */
const ANALYSIS_SAMPLE_RATE = 22050;

/** FFT size for spectral analysis */
const FFT_SIZE = 2048;

/** Hop size for STFT */
const HOP_SIZE = 512;

/** Pitch class names */
const PITCH_CLASSES: MusicalKey[] = [
  'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'
];

/** Krumhansl-Kessler key profiles for key detection */
const MAJOR_PROFILE = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const MINOR_PROFILE = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

// ============================================
// Audio Analyzer Class
// ============================================

export class AudioAnalyzer {
  private static instance: AudioAnalyzer;
  private ffmpegAvailable: boolean | null = null;
  private cache: Map<string, AudioFeatures> = new Map();

  private constructor() {}

  /**
   * Get singleton instance
   */
  static getInstance(): AudioAnalyzer {
    if (!AudioAnalyzer.instance) {
      AudioAnalyzer.instance = new AudioAnalyzer();
    }
    return AudioAnalyzer.instance;
  }

  /**
   * Check if FFmpeg is available
   */
  async checkFFmpegAvailable(): Promise<boolean> {
    if (this.ffmpegAvailable !== null) {
      return this.ffmpegAvailable;
    }

    this.ffmpegAvailable = await new Promise<boolean>((resolve) => {
      const ffmpeg = spawn('ffmpeg', ['-version']);
      ffmpeg.on('close', (code) => resolve(code === 0));
      ffmpeg.on('error', () => resolve(false));
    });

    return this.ffmpegAvailable;
  }

  /**
   * Analyze audio features from a file path
   */
  async analyzeFile(
    filePath: string,
    options: AnalysisOptions = {}
  ): Promise<AudioFeatures | null> {
    // Check cache
    const cacheKey = `file:${filePath}`;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    try {
      const audioData = await this.extractAudioData(filePath, options);
      if (!audioData) {
        return null;
      }

      const features = await this.analyzeAudioData(audioData, options);
      features.source = 'local';
      features.analyzedAt = new Date();

      // Cache result
      this.cache.set(cacheKey, features);
      return features;
    } catch (error) {
      console.error('[AudioAnalyzer] Analysis failed:', error);
      return null;
    }
  }

  /**
   * Analyze audio features from a URL (stream)
   */
  async analyzeUrl(
    url: string,
    options: AnalysisOptions = {}
  ): Promise<AudioFeatures | null> {
    // Check cache
    const cacheKey = `url:${url}`;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    try {
      const audioData = await this.extractAudioDataFromUrl(url, options);
      if (!audioData) {
        return null;
      }

      const features = await this.analyzeAudioData(audioData, options);
      features.source = 'local';
      features.analyzedAt = new Date();

      // Cache result
      this.cache.set(cacheKey, features);
      return features;
    } catch (error) {
      console.error('[AudioAnalyzer] URL analysis failed:', error);
      return null;
    }
  }

  /**
   * Analyze raw audio data
   */
  async analyzeAudioData(
    audioData: AudioData,
    options: AnalysisOptions = {}
  ): Promise<AudioFeatures> {
    const {
      analyzeBpm = true,
      analyzeKey = true,
      analyzeEnergy = true,
      analyzeVocals = true
    } = options;

    const features: AudioFeatures = {
      duration: audioData.duration
    };

    // Run analyses in parallel where possible
    const analyses: Promise<void>[] = [];

    if (analyzeBpm) {
      analyses.push(
        this.detectBpm(audioData).then(result => {
          if (result) {
            features.bpm = result.bpm;
            features.bpmConfidence = result.confidence;
          }
        })
      );
    }

    if (analyzeKey) {
      analyses.push(
        this.detectKey(audioData).then(result => {
          if (result) {
            features.key = result.key;
            features.mode = result.mode;
            features.keyConfidence = result.confidence;
          }
        })
      );
    }

    if (analyzeEnergy) {
      analyses.push(
        Promise.resolve().then(() => {
          const energyFeatures = this.analyzeEnergyFeatures(audioData);
          Object.assign(features, energyFeatures);
        })
      );
    }

    if (analyzeVocals) {
      analyses.push(
        Promise.resolve().then(() => {
          const vocalFeatures = this.analyzeVocalFeatures(audioData);
          Object.assign(features, vocalFeatures);
        })
      );
    }

    await Promise.all(analyses);
    return features;
  }

  /**
   * Extract audio data from file using FFmpeg
   */
  private async extractAudioData(
    filePath: string,
    options: AnalysisOptions
  ): Promise<AudioData | null> {
    const hasFFmpeg = await this.checkFFmpegAvailable();
    if (!hasFFmpeg) {
      console.warn('[AudioAnalyzer] FFmpeg not available');
      return null;
    }

    const maxDuration = options.maxDuration ?? 60;
    const skipTo = options.skipToPosition ?? 30;

    return new Promise((resolve) => {
      const args = [
        '-i', filePath,
        '-ss', String(skipTo),        // Skip to middle of song
        '-t', String(maxDuration),    // Limit duration
        '-ac', '1',                   // Mono
        '-ar', String(ANALYSIS_SAMPLE_RATE), // Resample
        '-f', 'f32le',                // 32-bit float PCM
        '-'                           // Output to stdout
      ];

      const ffmpeg = spawn('ffmpeg', args);
      const chunks: Buffer[] = [];

      ffmpeg.stdout.on('data', (chunk) => chunks.push(chunk));

      ffmpeg.on('close', (code) => {
        if (code !== 0 || chunks.length === 0) {
          resolve(null);
          return;
        }

        const buffer = Buffer.concat(chunks);
        const samples = new Float32Array(buffer.buffer, buffer.byteOffset, buffer.length / 4);

        resolve({
          sampleRate: ANALYSIS_SAMPLE_RATE,
          channels: 1,
          samples,
          duration: samples.length / ANALYSIS_SAMPLE_RATE
        });
      });

      ffmpeg.on('error', () => resolve(null));

      // Timeout after 30 seconds
      setTimeout(() => {
        ffmpeg.kill();
        resolve(null);
      }, 30000);
    });
  }

  /**
   * Extract audio data from URL using FFmpeg
   */
  private async extractAudioDataFromUrl(
    url: string,
    options: AnalysisOptions
  ): Promise<AudioData | null> {
    const hasFFmpeg = await this.checkFFmpegAvailable();
    if (!hasFFmpeg) {
      console.warn('[AudioAnalyzer] FFmpeg not available');
      return null;
    }

    const maxDuration = options.maxDuration ?? 60;
    const skipTo = options.skipToPosition ?? 30;

    return new Promise((resolve) => {
      const args = [
        '-i', url,
        '-ss', String(skipTo),
        '-t', String(maxDuration),
        '-ac', '1',
        '-ar', String(ANALYSIS_SAMPLE_RATE),
        '-f', 'f32le',
        '-'
      ];

      const ffmpeg = spawn('ffmpeg', args);
      const chunks: Buffer[] = [];

      ffmpeg.stdout.on('data', (chunk) => chunks.push(chunk));

      ffmpeg.on('close', (code) => {
        if (code !== 0 || chunks.length === 0) {
          resolve(null);
          return;
        }

        const buffer = Buffer.concat(chunks);
        const samples = new Float32Array(buffer.buffer, buffer.byteOffset, buffer.length / 4);

        resolve({
          sampleRate: ANALYSIS_SAMPLE_RATE,
          channels: 1,
          samples,
          duration: samples.length / ANALYSIS_SAMPLE_RATE
        });
      });

      ffmpeg.on('error', () => resolve(null));

      setTimeout(() => {
        ffmpeg.kill();
        resolve(null);
      }, 60000); // Longer timeout for URLs
    });
  }

  // ============================================
  // BPM Detection
  // ============================================

  /**
   * Detect BPM using onset detection and autocorrelation
   */
  private async detectBpm(audioData: AudioData): Promise<BpmResult | null> {
    try {
      const { samples, sampleRate } = audioData;

      // 1. Compute onset strength envelope
      const onsetEnvelope = this.computeOnsetEnvelope(samples, sampleRate);

      // 2. Compute autocorrelation
      const autocorr = this.autocorrelate(onsetEnvelope);

      // 3. Find peaks in autocorrelation (corresponding to tempo)
      const minLag = Math.floor(sampleRate * 60 / 200); // 200 BPM max
      const maxLag = Math.floor(sampleRate * 60 / 60);  // 60 BPM min

      let maxVal = 0;
      let maxLagIdx = minLag;

      for (let lag = minLag; lag < Math.min(maxLag, autocorr.length); lag++) {
        const val = autocorr[lag];
        if (val !== undefined && val > maxVal) {
          maxVal = val;
          maxLagIdx = lag;
        }
      }

      // Convert lag to BPM
      const bpm = Math.round((sampleRate * 60) / (maxLagIdx * HOP_SIZE));

      // Calculate confidence based on peak prominence
      const confidence = Math.min(1, maxVal / (this.mean(autocorr) + 0.001));

      // Validate BPM is in reasonable range
      if (bpm < 60 || bpm > 200) {
        return { bpm: 120, confidence: 0.3 }; // Default fallback
      }

      return {
        bpm,
        confidence: Math.max(0.3, Math.min(1, confidence))
      };
    } catch (error) {
      console.error('[AudioAnalyzer] BPM detection failed:', error);
      return null;
    }
  }

  /**
   * Compute onset strength envelope using spectral flux
   */
  private computeOnsetEnvelope(samples: Float32Array, _sampleRate: number): Float32Array {
    const numFrames = Math.floor((samples.length - FFT_SIZE) / HOP_SIZE);
    const envelope = new Float32Array(numFrames);

    let prevSpectrum: Float32Array | null = null;

    for (let i = 0; i < numFrames; i++) {
      const start = i * HOP_SIZE;
      const frame = samples.slice(start, start + FFT_SIZE);

      // Apply Hann window
      const windowed = this.applyWindow(frame);

      // Compute magnitude spectrum (simplified - using energy bands)
      const spectrum = this.computeSpectrum(windowed);

      if (prevSpectrum) {
        // Spectral flux - sum of positive differences
        let flux = 0;
        for (let j = 0; j < spectrum.length; j++) {
          const curr = spectrum[j] ?? 0;
          const prev = prevSpectrum[j] ?? 0;
          const diff = curr - prev;
          if (diff > 0) flux += diff;
        }
        envelope[i] = flux;
      }

      prevSpectrum = spectrum;
    }

    return envelope;
  }

  /**
   * Compute simplified magnitude spectrum using energy bands
   */
  private computeSpectrum(frame: Float32Array): Float32Array {
    const numBands = 32;
    const spectrum = new Float32Array(numBands);
    const bandSize = Math.floor(frame.length / numBands);

    for (let band = 0; band < numBands; band++) {
      let energy = 0;
      const start = band * bandSize;
      const end = start + bandSize;

      for (let i = start; i < end; i++) {
        const val = frame[i] ?? 0;
        energy += val * val;
      }

      spectrum[band]! = Math.sqrt(energy / bandSize);
    }

    return spectrum;
  }

  /**
   * Autocorrelation using direct computation
   */
  private autocorrelate(signal: Float32Array): Float32Array {
    const len = signal.length;
    const result = new Float32Array(len);

    for (let lag = 0; lag < len; lag++) {
      let sum = 0;
      for (let i = 0; i < len - lag; i++) {
        sum += (signal[i] ?? 0) * (signal[i + lag] ?? 0);
      }
      result[lag]! = sum;
    }

    // Normalize
    const max = result[0] ?? 1;
    for (let i = 0; i < len; i++) {
      result[i]! /= max;
    }

    return result;
  }

  // ============================================
  // Key Detection
  // ============================================

  /**
   * Detect musical key using chromagram analysis
   */
  private async detectKey(audioData: AudioData): Promise<KeyResult | null> {
    try {
      const { samples, sampleRate } = audioData;

      // Compute chromagram (pitch class profile)
      const chromagram = this.computeChromagram(samples, sampleRate);

      // Correlate with key profiles
      let bestKey: MusicalKey = 'C';
      let bestMode: MusicalMode = 'major';
      let bestCorrelation = -Infinity;

      for (let keyIdx = 0; keyIdx < 12; keyIdx++) {
        // Rotate profiles to match key
        const majorProfile = this.rotateArray(MAJOR_PROFILE, keyIdx);
        const minorProfile = this.rotateArray(MINOR_PROFILE, keyIdx);

        const majorCorr = this.pearsonCorrelation(chromagram.pitchClasses, majorProfile);
        const minorCorr = this.pearsonCorrelation(chromagram.pitchClasses, minorProfile);

        const pitchClass = PITCH_CLASSES[keyIdx];
        if (pitchClass !== undefined && majorCorr > bestCorrelation) {
          bestCorrelation = majorCorr;
          bestKey = pitchClass;
          bestMode = 'major';
        }

        if (pitchClass !== undefined && minorCorr > bestCorrelation) {
          bestCorrelation = minorCorr;
          bestKey = pitchClass;
          bestMode = 'minor';
        }
      }

      // Convert correlation to confidence (0-1)
      const confidence = Math.max(0, Math.min(1, (bestCorrelation + 1) / 2));

      return {
        key: bestKey,
        mode: bestMode,
        confidence,
        correlation: bestCorrelation
      };
    } catch (error) {
      console.error('[AudioAnalyzer] Key detection failed:', error);
      return null;
    }
  }

  /**
   * Compute chromagram (pitch class profile)
   */
  private computeChromagram(samples: Float32Array, sampleRate: number): Chromagram {
    const pitchClasses = new Float32Array(12);
    const numFrames = Math.floor((samples.length - FFT_SIZE) / HOP_SIZE);

    // Reference frequency for A4
    const A4 = 440;

    for (let frameIdx = 0; frameIdx < numFrames; frameIdx++) {
      const start = frameIdx * HOP_SIZE;
      const frame = samples.slice(start, start + FFT_SIZE);
      const windowed = this.applyWindow(frame);

      // Simple energy-based pitch estimation
      // Group frequencies into pitch classes
      for (let bin = 1; bin < FFT_SIZE / 2; bin++) {
        const freq = (bin * sampleRate) / FFT_SIZE;

        // Skip very low and very high frequencies
        if (freq < 65 || freq > 2000) continue;

        // Convert frequency to pitch class
        const midiNote = 12 * Math.log2(freq / A4) + 69;
        const pitchClass = Math.round(midiNote) % 12;

        if (pitchClass >= 0 && pitchClass < 12) {
          // Add energy contribution
          const windowedVal = windowed[bin] ?? 0;
          const energy = windowedVal * windowedVal;
          pitchClasses[pitchClass]! += energy;
        }
      }
    }

    // Normalize
    const max = Math.max(...pitchClasses) || 1;
    for (let i = 0; i < 12; i++) {
      pitchClasses[i]! /= max;
    }

    return { pitchClasses };
  }

  // ============================================
  // Energy Features
  // ============================================

  /**
   * Analyze energy-related features
   */
  private analyzeEnergyFeatures(audioData: AudioData): Partial<AudioFeatures> {
    const { samples } = audioData;

    // RMS energy
    const rms = this.computeRms(samples);

    // Convert RMS to dB
    const loudness = 20 * Math.log10(rms + 1e-10);

    // Energy (0-1 scale)
    // Map typical RMS range (0.01 - 0.3) to 0-1
    const energy = Math.max(0, Math.min(1, (rms - 0.01) / 0.29));

    // Danceability estimation based on rhythm regularity and energy
    // This is a simplified estimation
    const danceability = this.estimateDanceability(samples, energy);

    // Valence estimation (simplified - based on major key tendency and energy)
    const valence = energy * 0.6 + 0.4 * Math.random(); // Placeholder

    return {
      energy,
      loudness,
      danceability,
      valence
    };
  }

  /**
   * Estimate danceability from audio
   */
  private estimateDanceability(samples: Float32Array, energy: number): number {
    // Simple estimation based on:
    // 1. Energy level
    // 2. Beat regularity (variance in inter-onset intervals)

    // For a proper implementation, we'd analyze beat intervals
    // For now, use energy as primary factor with some variation
    const baseScore = energy * 0.7;
    const rhythmBonus = 0.3 * (1 - this.computeVariance(samples.slice(0, 10000)));

    return Math.max(0, Math.min(1, baseScore + rhythmBonus));
  }

  // ============================================
  // Vocal Features
  // ============================================

  /**
   * Analyze vocal-related features
   */
  private analyzeVocalFeatures(audioData: AudioData): Partial<AudioFeatures> {
    const { samples, sampleRate } = audioData;

    // Estimate speechiness/vocals using spectral flatness
    // Vocals tend to have less flat spectrum than instruments
    const spectralFlatness = this.computeSpectralFlatness(samples);

    // Instrumentalness is inverse of vocal presence
    // High flatness = more noise-like = potentially more instrumental
    const speechiness = Math.max(0, Math.min(1, 1 - spectralFlatness));
    const instrumentalness = spectralFlatness;

    // Acousticness estimation - based on spectral characteristics
    // Acoustic instruments tend to have more harmonic content
    const acousticness = this.estimateAcousticness(samples, sampleRate);

    // Liveness - hard to detect without reference, use placeholder
    const liveness = 0.1 + 0.2 * Math.random();

    return {
      speechiness,
      instrumentalness,
      acousticness,
      liveness
    };
  }

  /**
   * Compute spectral flatness (Wiener entropy)
   */
  private computeSpectralFlatness(samples: Float32Array): number {
    const frameSize = 2048;
    const numFrames = Math.floor(samples.length / frameSize);

    let totalFlatness = 0;

    for (let i = 0; i < numFrames; i++) {
      const frame = samples.slice(i * frameSize, (i + 1) * frameSize);
      const spectrum = this.computeSpectrum(frame);

      // Geometric mean / Arithmetic mean
      let geometricSum = 0;
      let arithmeticSum = 0;

      for (let j = 0; j < spectrum.length; j++) {
        const val = (spectrum[j] ?? 0) + 1e-10;
        geometricSum += Math.log(val);
        arithmeticSum += val;
      }

      const geometricMean = Math.exp(geometricSum / spectrum.length);
      const arithmeticMean = arithmeticSum / spectrum.length;

      totalFlatness += geometricMean / (arithmeticMean + 1e-10);
    }

    return totalFlatness / numFrames;
  }

  /**
   * Estimate acousticness
   */
  private estimateAcousticness(samples: Float32Array, sampleRate: number): number {
    // Simplified: acoustic tracks tend to have more low-frequency content
    // and less high-frequency "electronic" sounds

    const lowEnergy = this.computeBandEnergy(samples, 0, 500, sampleRate);
    const highEnergy = this.computeBandEnergy(samples, 5000, 10000, sampleRate);

    const ratio = lowEnergy / (highEnergy + 0.001);

    // Map ratio to 0-1 scale
    return Math.max(0, Math.min(1, ratio / 10));
  }

  /**
   * Compute energy in a frequency band
   */
  private computeBandEnergy(
    samples: Float32Array,
    _lowFreq: number,
    _highFreq: number,
    _sampleRate: number
  ): number {
    // Simplified band energy using sample filtering
    // A proper implementation would use FFT band extraction

    let energy = 0;
    for (let i = 0; i < samples.length; i++) {
      const val = samples[i] ?? 0;
      energy += val * val;
    }

    return Math.sqrt(energy / samples.length);
  }

  // ============================================
  // Utility Functions
  // ============================================

  /**
   * Apply Hann window to frame
   */
  private applyWindow(frame: Float32Array): Float32Array {
    const windowed = new Float32Array(frame.length);
    for (let i = 0; i < frame.length; i++) {
      const window = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (frame.length - 1)));
      windowed[i]! = (frame[i] ?? 0) * window;
    }
    return windowed;
  }

  /**
   * Compute RMS of samples
   */
  private computeRms(samples: Float32Array): number {
    let sum = 0;
    for (let i = 0; i < samples.length; i++) {
      const val = samples[i] ?? 0;
      sum += val * val;
    }
    return Math.sqrt(sum / samples.length);
  }

  /**
   * Compute mean of array
   */
  private mean(arr: Float32Array): number {
    let sum = 0;
    for (let i = 0; i < arr.length; i++) {
      sum += arr[i] ?? 0;
    }
    return sum / arr.length;
  }

  /**
   * Compute variance of array
   */
  private computeVariance(samples: Float32Array): number {
    const mean = this.mean(samples);
    let variance = 0;
    for (let i = 0; i < samples.length; i++) {
      variance += ((samples[i] ?? 0) - mean) ** 2;
    }
    return variance / samples.length;
  }

  /**
   * Pearson correlation coefficient
   */
  private pearsonCorrelation(a: Float32Array, b: number[]): number {
    const n = Math.min(a.length, b.length);
    let sumA = 0, sumB = 0, sumAB = 0, sumA2 = 0, sumB2 = 0;

    for (let i = 0; i < n; i++) {
      const aVal = a[i] ?? 0;
      const bVal = b[i] ?? 0;
      sumA += aVal;
      sumB += bVal;
      sumAB += aVal * bVal;
      sumA2 += aVal * aVal;
      sumB2 += bVal * bVal;
    }

    const num = n * sumAB - sumA * sumB;
    const den = Math.sqrt((n * sumA2 - sumA * sumA) * (n * sumB2 - sumB * sumB));

    return den === 0 ? 0 : num / den;
  }

  /**
   * Rotate array by n positions
   */
  private rotateArray(arr: number[], n: number): number[] {
    const result = new Array<number>(arr.length);
    for (let i = 0; i < arr.length; i++) {
      result[i] = arr[(i + n) % arr.length] ?? 0;
    }
    return result;
  }

  // ============================================
  // Cache Management
  // ============================================

  /**
   * Get cached features for a track
   */
  getCached(trackId: string): AudioFeatures | null {
    return this.cache.get(trackId) || null;
  }

  /**
   * Set cached features for a track
   */
  setCached(trackId: string, features: AudioFeatures): void {
    this.cache.set(trackId, features);
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache size
   */
  getCacheSize(): number {
    return this.cache.size;
  }
}

/**
 * Get the singleton AudioAnalyzer instance
 */
export function getAudioAnalyzer(): AudioAnalyzer {
  return AudioAnalyzer.getInstance();
}
