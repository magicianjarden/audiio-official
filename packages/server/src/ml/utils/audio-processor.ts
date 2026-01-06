/**
 * AudioProcessor - Unified audio processing service
 *
 * Uses Essentia.js WASM when available for high-performance DSP operations.
 * Falls back to pure JS implementations when Essentia isn't loaded.
 *
 * This is the single source of truth for audio processing in the ML system.
 */

// Essentia.js types
interface EssentiaInstance {
  arrayToVector: (arr: Float32Array) => unknown;
  vectorToArray: (vec: unknown) => Float32Array;

  // Algorithms we use
  Resample: (signal: unknown, options: { inputSampleRate: number; outputSampleRate: number }) => { signal: unknown };
  Windowing: (frame: unknown, options?: { type?: string; size?: number }) => { frame: unknown };
  Spectrum: (frame: unknown) => { spectrum: unknown };
  MelBands: (spectrum: unknown, options?: { numberBands?: number; sampleRate?: number }) => { bands: unknown };
  MFCC: (signal: unknown, options?: { numberCoefficients?: number }) => { mfcc: Float32Array[] };
  RhythmExtractor: (signal: unknown) => { bpm: number; confidence: number };
  KeyExtractor: (signal: unknown) => { key: string; scale: string; strength: number };
  Energy: (signal: unknown) => { energy: number };
  Loudness: (signal: unknown) => { loudness: number };
  Danceability: (signal: unknown) => { danceability: number };
  SpectralCentroidTime: (signal: unknown) => { spectralCentroid: number };
  ZeroCrossingRate: (signal: unknown) => { zeroCrossingRate: number };
  DynamicComplexity: (signal: unknown) => { dynamicComplexity: number; loudness: number };
}

export interface MelSpectrogramOptions {
  sampleRate?: number;
  windowSize?: number;
  hopSize?: number;
  nMels?: number;
  fMin?: number;
  fMax?: number;
}

export interface AudioAnalysisResult {
  bpm?: number;
  bpmConfidence?: number;
  key?: string;
  mode?: 'major' | 'minor';
  energy?: number;
  loudness?: number;
  danceability?: number;
  spectralCentroid?: number;
  zeroCrossingRate?: number;
  mfcc?: number[];
}

const DEFAULT_MEL_OPTIONS: Required<MelSpectrogramOptions> = {
  sampleRate: 22050,
  windowSize: 2048,
  hopSize: 512,
  nMels: 128,
  fMin: 0,
  fMax: 11025,
};

/**
 * Singleton AudioProcessor that delegates to Essentia when available
 */
class AudioProcessorImpl {
  private essentia: EssentiaInstance | null = null;
  private loadPromise: Promise<void> | null = null;
  private initialized = false;

  /**
   * Initialize the audio processor (loads Essentia WASM)
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;
    if (this.loadPromise) return this.loadPromise;

    this.loadPromise = this.loadEssentia();
    await this.loadPromise;
    this.initialized = true;
  }

  /**
   * Load Essentia.js WASM module
   */
  private async loadEssentia(): Promise<void> {
    try {
      const essentiaModule = await import('essentia.js');
      const EssentiaWASM = await essentiaModule.default;
      this.essentia = new EssentiaWASM() as EssentiaInstance;
      console.log('[AudioProcessor] Essentia WASM loaded');
    } catch (error) {
      console.warn('[AudioProcessor] Essentia not available, using JS fallback:', error);
      this.essentia = null;
    }
  }

  /**
   * Check if Essentia is available
   */
  isEssentiaAvailable(): boolean {
    return this.essentia !== null;
  }

  /**
   * Resample audio data to a target sample rate
   */
  resample(audioData: Float32Array, fromRate: number, toRate: number): Float32Array {
    if (fromRate === toRate) return audioData;

    if (this.essentia) {
      try {
        const signal = this.essentia.arrayToVector(audioData);
        const result = this.essentia.Resample(signal, {
          inputSampleRate: fromRate,
          outputSampleRate: toRate,
        });
        return this.essentia.vectorToArray(result.signal);
      } catch {
        // Fall through to JS implementation
      }
    }

    return this.resampleJS(audioData, fromRate, toRate);
  }

  /**
   * JS fallback for resampling (linear interpolation)
   */
  private resampleJS(audioData: Float32Array, fromRate: number, toRate: number): Float32Array {
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
   * Compute mel spectrogram from audio data
   */
  computeMelSpectrogram(
    audioData: Float32Array,
    options: MelSpectrogramOptions = {}
  ): number[][] {
    const opts = { ...DEFAULT_MEL_OPTIONS, ...options };

    if (this.essentia) {
      try {
        return this.computeMelSpectrogramEssentia(audioData, opts);
      } catch {
        // Fall through to JS implementation
      }
    }

    return this.computeMelSpectrogramJS(audioData, opts);
  }

  /**
   * Compute mel spectrogram using Essentia
   */
  private computeMelSpectrogramEssentia(
    audioData: Float32Array,
    opts: Required<MelSpectrogramOptions>
  ): number[][] {
    const numFrames = Math.floor((audioData.length - opts.windowSize) / opts.hopSize) + 1;
    const melSpec: number[][] = [];

    for (let i = 0; i < numFrames; i++) {
      const start = i * opts.hopSize;
      const frame = audioData.slice(start, start + opts.windowSize);

      const frameVec = this.essentia!.arrayToVector(frame);

      // Apply Hann window
      const windowed = this.essentia!.Windowing(frameVec, { type: 'hann', size: opts.windowSize });

      // Compute spectrum
      const spectrum = this.essentia!.Spectrum(windowed.frame);

      // Apply mel filterbank
      const melBands = this.essentia!.MelBands(spectrum.spectrum, {
        numberBands: opts.nMels,
        sampleRate: opts.sampleRate,
      });

      // Convert to array and apply log scale
      const melArray = Array.from(this.essentia!.vectorToArray(melBands.bands as unknown as unknown));
      const logMel = melArray.map(x => Math.log10(Math.max(1e-10, x)));

      melSpec.push(logMel);
    }

    return melSpec;
  }

  /**
   * JS fallback for mel spectrogram computation
   */
  private computeMelSpectrogramJS(
    audioData: Float32Array,
    opts: Required<MelSpectrogramOptions>
  ): number[][] {
    const numFrames = Math.floor((audioData.length - opts.windowSize) / opts.hopSize) + 1;
    const melSpec: number[][] = [];

    for (let i = 0; i < numFrames; i++) {
      const start = i * opts.hopSize;
      const frame = audioData.slice(start, start + opts.windowSize);

      // Apply Hann window
      const windowed = this.applyHannWindow(frame);

      // Compute FFT magnitude
      const spectrum = this.computeFFTMagnitude(windowed);

      // Apply mel filterbank
      const melFrame = this.applyMelFilterbank(spectrum, opts.sampleRate, opts.nMels, opts.fMin, opts.fMax);

      // Log scale
      const logMel = Array.from(melFrame).map(x => Math.log10(Math.max(1e-10, x)));

      melSpec.push(logMel);
    }

    return melSpec;
  }

  /**
   * Compute FFT magnitude spectrum
   */
  computeFFTMagnitude(frame: Float32Array): Float32Array {
    // Use Essentia if available
    if (this.essentia) {
      try {
        const frameVec = this.essentia.arrayToVector(frame);
        const windowed = this.essentia.Windowing(frameVec, { type: 'hann' });
        const spectrum = this.essentia.Spectrum(windowed.frame);
        return this.essentia.vectorToArray(spectrum.spectrum as unknown as unknown);
      } catch {
        // Fall through to JS
      }
    }

    return this.computeFFTMagnitudeJS(frame);
  }

  /**
   * JS fallback: Cooley-Tukey FFT (O(n log n))
   */
  private computeFFTMagnitudeJS(frame: Float32Array): Float32Array {
    const n = this.nextPowerOf2(frame.length);
    const padded = new Float32Array(n);
    padded.set(frame);

    const { real, imag } = this.fft(padded);

    const halfN = n / 2;
    const magnitude = new Float32Array(halfN);
    for (let k = 0; k < halfN; k++) {
      magnitude[k] = Math.sqrt(real[k] * real[k] + imag[k] * imag[k]);
    }

    return magnitude;
  }

  /**
   * Cooley-Tukey radix-2 FFT
   */
  private fft(input: Float32Array): { real: Float32Array; imag: Float32Array } {
    const n = input.length;

    if (n === 1) {
      return {
        real: new Float32Array([input[0]]),
        imag: new Float32Array([0]),
      };
    }

    const evenInput = new Float32Array(n / 2);
    const oddInput = new Float32Array(n / 2);

    for (let i = 0; i < n / 2; i++) {
      evenInput[i] = input[2 * i];
      oddInput[i] = input[2 * i + 1];
    }

    const even = this.fft(evenInput);
    const odd = this.fft(oddInput);

    const real = new Float32Array(n);
    const imag = new Float32Array(n);

    for (let k = 0; k < n / 2; k++) {
      const angle = (-2 * Math.PI * k) / n;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);

      const oddReal = odd.real[k] * cos - odd.imag[k] * sin;
      const oddImag = odd.real[k] * sin + odd.imag[k] * cos;

      real[k] = even.real[k] + oddReal;
      imag[k] = even.imag[k] + oddImag;
      real[k + n / 2] = even.real[k] - oddReal;
      imag[k + n / 2] = even.imag[k] - oddImag;
    }

    return { real, imag };
  }

  /**
   * Apply Hann window
   */
  applyHannWindow(frame: Float32Array): Float32Array {
    const result = new Float32Array(frame.length);
    const n = frame.length - 1;

    for (let i = 0; i < frame.length; i++) {
      const multiplier = 0.5 * (1 - Math.cos((2 * Math.PI * i) / n));
      result[i] = frame[i] * multiplier;
    }

    return result;
  }

  /**
   * Apply mel filterbank to spectrum
   */
  private applyMelFilterbank(
    spectrum: Float32Array,
    sampleRate: number,
    nMels: number,
    fMin: number,
    fMax: number
  ): Float32Array {
    const nFft = spectrum.length * 2;
    const melFilters = new Float32Array(nMels);

    const hzToMel = (hz: number) => 2595 * Math.log10(1 + hz / 700);
    const melToHz = (mel: number) => 700 * (Math.pow(10, mel / 2595) - 1);

    const melMin = hzToMel(fMin);
    const melMax = hzToMel(fMax);
    const melStep = (melMax - melMin) / (nMels + 1);

    const melCenters: number[] = [];
    for (let i = 0; i <= nMels + 1; i++) {
      melCenters.push(melToHz(melMin + i * melStep));
    }

    const binCenters = melCenters.map(hz => Math.floor((nFft + 1) * hz / sampleRate));

    for (let m = 0; m < nMels; m++) {
      const startBin = binCenters[m];
      const centerBin = binCenters[m + 1];
      const endBin = binCenters[m + 2];

      let sum = 0;

      for (let k = startBin; k < centerBin && k < spectrum.length; k++) {
        const weight = (k - startBin) / Math.max(1, centerBin - startBin);
        sum += spectrum[k] * weight;
      }

      for (let k = centerBin; k < endBin && k < spectrum.length; k++) {
        const weight = (endBin - k) / Math.max(1, endBin - centerBin);
        sum += spectrum[k] * weight;
      }

      melFilters[m] = sum;
    }

    return melFilters;
  }

  /**
   * Extract MFCC features
   */
  extractMFCC(audioData: Float32Array, numCoefficients: number = 13): Float32Array[] | null {
    if (!this.essentia) return null;

    try {
      const signal = this.essentia.arrayToVector(audioData);
      const result = this.essentia.MFCC(signal, { numberCoefficients: numCoefficients });
      return result.mfcc;
    } catch {
      return null;
    }
  }

  /**
   * Analyze audio and extract all features at once (efficient batch processing)
   */
  async analyzeAudio(audioData: Float32Array, sampleRate: number): Promise<AudioAnalysisResult> {
    await this.initialize();

    // Resample to 44100 Hz for Essentia
    const targetRate = 44100;
    const resampled = this.resample(audioData, sampleRate, targetRate);

    if (!this.essentia) {
      // Return minimal features from JS analysis
      return {
        zeroCrossingRate: this.calculateZCR(resampled),
        energy: this.calculateEnergy(resampled),
      };
    }

    const signal = this.essentia.arrayToVector(resampled);

    try {
      const rhythm = this.essentia.RhythmExtractor(signal);
      const key = this.essentia.KeyExtractor(signal);
      const energy = this.essentia.Energy(signal);
      const loudness = this.essentia.Loudness(signal);
      const zcr = this.essentia.ZeroCrossingRate(signal);

      let danceability: number | undefined;
      let spectralCentroid: number | undefined;

      try {
        danceability = this.essentia.Danceability(signal).danceability;
        spectralCentroid = this.essentia.SpectralCentroidTime(signal).spectralCentroid;
      } catch {
        // Some algorithms may not be available
      }

      return {
        bpm: rhythm.bpm,
        bpmConfidence: rhythm.confidence,
        key: key.key,
        mode: key.scale.toLowerCase() as 'major' | 'minor',
        energy: this.normalizeEnergy(energy.energy),
        loudness: loudness.loudness,
        danceability,
        spectralCentroid,
        zeroCrossingRate: zcr.zeroCrossingRate,
      };
    } catch (error) {
      console.error('[AudioProcessor] Analysis failed:', error);
      return {};
    }
  }

  /**
   * Calculate zero-crossing rate (JS fallback)
   */
  private calculateZCR(audioData: Float32Array): number {
    if (audioData.length < 2) return 0;

    let crossings = 0;
    for (let i = 1; i < audioData.length; i++) {
      if ((audioData[i] >= 0) !== (audioData[i - 1] >= 0)) {
        crossings++;
      }
    }

    return crossings / (audioData.length - 1);
  }

  /**
   * Calculate RMS energy (JS fallback)
   */
  private calculateEnergy(audioData: Float32Array): number {
    if (audioData.length === 0) return 0;

    let sum = 0;
    for (let i = 0; i < audioData.length; i++) {
      sum += audioData[i] * audioData[i];
    }

    return Math.sqrt(sum / audioData.length);
  }

  /**
   * Normalize energy to 0-1 range
   */
  private normalizeEnergy(energy: number): number {
    const normalized = 2 / (1 + Math.exp(-energy / 1000)) - 1;
    return Math.max(0, Math.min(1, normalized));
  }

  /**
   * Find next power of 2
   */
  private nextPowerOf2(n: number): number {
    let power = 1;
    while (power < n) power *= 2;
    return power;
  }

  /**
   * Dispose and cleanup
   */
  dispose(): void {
    this.essentia = null;
    this.initialized = false;
    this.loadPromise = null;
  }
}

// Singleton instance
let audioProcessor: AudioProcessorImpl | null = null;

/**
 * Get the AudioProcessor singleton
 */
export function getAudioProcessor(): AudioProcessorImpl {
  if (!audioProcessor) {
    audioProcessor = new AudioProcessorImpl();
  }
  return audioProcessor;
}

/**
 * Reset the AudioProcessor (for testing)
 */
export function resetAudioProcessor(): void {
  if (audioProcessor) {
    audioProcessor.dispose();
    audioProcessor = null;
  }
}

export { AudioProcessorImpl as AudioProcessor };
