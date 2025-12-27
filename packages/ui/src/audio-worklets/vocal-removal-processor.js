/**
 * VocalRemovalProcessor - Enhanced real-time vocal removal with spectral processing
 *
 * QUICK WINS implemented to reduce "underwater" artifacts:
 * 1. Proper FFT-based spectral processing with Hann windowing
 * 2. Per-bin center detection with phase correlation
 * 3. Spectral smoothing to reduce musical noise
 * 4. Soft-knee gain application to prevent harsh transitions
 * 5. Optimized overlap-add for artifact-free reconstruction
 *
 * Based on research from:
 * - Sound on Sound: Mid-Side processing for vocal extraction
 * - Audacity's vocal remover algorithm
 * - Phase vocoder techniques for spectral processing
 */

class VocalRemovalProcessor extends AudioWorkletProcessor {
  constructor() {
    super();

    // FFT configuration - larger FFT = better frequency resolution, more latency
    this.fftSize = 2048;
    this.hopSize = this.fftSize / 4; // 75% overlap for smoother results
    this.windowSize = this.fftSize;

    // Circular buffers for overlap-add processing
    this.inputBufferL = new Float32Array(this.fftSize * 2);
    this.inputBufferR = new Float32Array(this.fftSize * 2);
    this.outputBufferL = new Float32Array(this.fftSize * 2);
    this.outputBufferR = new Float32Array(this.fftSize * 2);
    this.inputWritePos = 0;
    this.outputReadPos = 0;
    this.samplesUntilNextHop = this.hopSize;

    // Hann window for smooth transitions (reduces spectral leakage)
    this.window = new Float32Array(this.fftSize);
    for (let i = 0; i < this.fftSize; i++) {
      this.window[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (this.fftSize - 1)));
    }

    // Normalization factor for overlap-add
    this.windowSum = new Float32Array(this.fftSize * 2);
    for (let i = 0; i < this.fftSize; i++) {
      for (let hop = 0; hop < 4; hop++) {
        const pos = (i + hop * this.hopSize) % (this.fftSize * 2);
        this.windowSum[pos] += this.window[i] * this.window[i];
      }
    }

    // Processing parameters (updated via port messages)
    this.enabled = false;
    this.vocalReduction = 0.85;
    this.bassPreservation = 0.7;
    this.highBoost = 0.3;
    this.useSpectralProcessing = true; // QUICK WIN: Enable spectral mode

    // Frequency band boundaries (in bins, assuming 44.1kHz sample rate)
    this.updateFrequencyBands(44100);

    // Spectral smoothing for artifact reduction (QUICK WIN)
    this.prevGainsL = new Float32Array(this.fftSize / 2 + 1);
    this.prevGainsR = new Float32Array(this.fftSize / 2 + 1);
    this.prevGainsL.fill(1);
    this.prevGainsR.fill(1);
    this.gainSmoothingFactor = 0.7; // Higher = more smoothing, less artifacts

    // Pre-computed twiddle factors for FFT
    this.cosTable = new Float32Array(this.fftSize);
    this.sinTable = new Float32Array(this.fftSize);
    for (let i = 0; i < this.fftSize; i++) {
      const angle = (2 * Math.PI * i) / this.fftSize;
      this.cosTable[i] = Math.cos(angle);
      this.sinTable[i] = Math.sin(angle);
    }

    // Listen for parameter updates
    this.port.onmessage = (event) => {
      const { type, value } = event.data;
      switch (type) {
        case 'enable':
          this.enabled = value;
          break;
        case 'vocalReduction':
          this.vocalReduction = value;
          break;
        case 'bassPreservation':
          this.bassPreservation = value;
          break;
        case 'highBoost':
          this.highBoost = value;
          break;
        case 'useSpectralProcessing':
          this.useSpectralProcessing = value;
          break;
        case 'sampleRate':
          this.updateFrequencyBands(value);
          break;
      }
    };
  }

  /**
   * Update frequency band cutoffs based on sample rate
   */
  updateFrequencyBands(sampleRate) {
    const binWidth = sampleRate / this.fftSize;
    this.subBassCutoff = Math.floor(60 / binWidth);    // 60 Hz
    this.bassCutoff = Math.floor(150 / binWidth);      // 150 Hz
    this.lowMidCutoff = Math.floor(400 / binWidth);    // 400 Hz
    this.midCutoff = Math.floor(2000 / binWidth);      // 2 kHz
    this.presenceCutoff = Math.floor(5000 / binWidth); // 5 kHz
    this.airCutoff = Math.floor(10000 / binWidth);     // 10 kHz
  }

  /**
   * Get frequency-dependent reduction multiplier
   * QUICK WIN: More nuanced frequency response
   */
  getFrequencyMultiplier(binIndex) {
    if (binIndex < this.subBassCutoff) {
      // Sub-bass (< 60Hz): Almost no reduction - preserve kick/sub
      return 0.02 * (1 - this.bassPreservation);
    } else if (binIndex < this.bassCutoff) {
      // Bass (60-150Hz): Very light reduction
      return 0.1 * (1 - this.bassPreservation * 0.8);
    } else if (binIndex < this.lowMidCutoff) {
      // Low-mid (150-400Hz): Moderate - male vocal fundamentals
      return 0.5;
    } else if (binIndex < this.midCutoff) {
      // Mid (400Hz-2kHz): High - vocal body, both genders
      return 0.9;
    } else if (binIndex < this.presenceCutoff) {
      // Presence (2-5kHz): Maximum - vocal clarity and intelligibility
      return 1.0;
    } else if (binIndex < this.airCutoff) {
      // Sibilance (5-10kHz): High - S, T, F sounds
      return 0.85 * (1 - this.highBoost * 0.3);
    } else {
      // Air (10kHz+): Moderate - preserve cymbal shimmer
      return 0.4 * (1 - this.highBoost * 0.5);
    }
  }

  /**
   * Fast DFT implementation optimized for audio worklet
   * QUICK WIN: Using pre-computed twiddle factors
   */
  fft(real, imag) {
    const n = real.length;
    const outReal = new Float32Array(n);
    const outImag = new Float32Array(n);

    // Bit-reversal permutation
    let j = 0;
    for (let i = 0; i < n; i++) {
      if (i < j) {
        outReal[i] = real[j];
        outReal[j] = real[i];
        outImag[i] = imag[j];
        outImag[j] = imag[i];
      } else {
        outReal[i] = real[i];
        outImag[i] = imag[i];
      }
      let m = n >> 1;
      while (m >= 1 && j >= m) {
        j -= m;
        m >>= 1;
      }
      j += m;
    }

    // Cooley-Tukey FFT
    for (let size = 2; size <= n; size *= 2) {
      const halfSize = size / 2;
      const step = n / size;

      for (let i = 0; i < n; i += size) {
        for (let k = 0; k < halfSize; k++) {
          const tIndex = k * step;
          const cos = this.cosTable[tIndex];
          const sin = this.sinTable[tIndex];

          const evenIdx = i + k;
          const oddIdx = i + k + halfSize;

          const tReal = cos * outReal[oddIdx] + sin * outImag[oddIdx];
          const tImag = cos * outImag[oddIdx] - sin * outReal[oddIdx];

          outReal[oddIdx] = outReal[evenIdx] - tReal;
          outImag[oddIdx] = outImag[evenIdx] - tImag;
          outReal[evenIdx] = outReal[evenIdx] + tReal;
          outImag[evenIdx] = outImag[evenIdx] + tImag;
        }
      }
    }

    return { real: outReal, imag: outImag };
  }

  /**
   * Inverse FFT
   */
  ifft(real, imag) {
    const n = real.length;

    // Conjugate input
    const conjImag = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      conjImag[i] = -imag[i];
    }

    // Forward FFT
    const result = this.fft(real, conjImag);

    // Conjugate and scale output
    for (let i = 0; i < n; i++) {
      result.real[i] /= n;
      result.imag[i] = -result.imag[i] / n;
    }

    return result;
  }

  /**
   * Process a spectral frame with center detection and M/S processing
   * QUICK WIN: Per-bin analysis with smoothing
   */
  processSpectralFrame(frameL, frameR) {
    const n = this.fftSize;
    const halfN = n / 2 + 1;

    // Apply window
    const windowedL = new Float32Array(n);
    const windowedR = new Float32Array(n);
    const zeroImag = new Float32Array(n);

    for (let i = 0; i < n; i++) {
      windowedL[i] = frameL[i] * this.window[i];
      windowedR[i] = frameR[i] * this.window[i];
    }

    // Forward FFT
    const specL = this.fft(windowedL, zeroImag);
    const specR = this.fft(windowedR, zeroImag);

    // Process each frequency bin
    for (let k = 0; k < halfN; k++) {
      // Calculate magnitude and phase
      const magL = Math.sqrt(specL.real[k] ** 2 + specL.imag[k] ** 2);
      const magR = Math.sqrt(specR.real[k] ** 2 + specR.imag[k] ** 2);
      const phaseL = Math.atan2(specL.imag[k], specL.real[k]);
      const phaseR = Math.atan2(specR.imag[k], specR.real[k]);

      // CENTER DETECTION (QUICK WIN: improved algorithm)
      // 1. Magnitude similarity (0-1)
      const maxMag = Math.max(magL, magR, 0.0001);
      const minMag = Math.min(magL, magR);
      const magSimilarity = minMag / maxMag;

      // 2. Phase correlation - center content has matching phases
      const phaseDiff = Math.abs(phaseL - phaseR);
      const normalizedPhaseDiff = Math.min(phaseDiff, 2 * Math.PI - phaseDiff);
      const phaseCorrelation = Math.cos(normalizedPhaseDiff);

      // 3. Combined center likelihood with soft knee
      const rawCenterLikelihood = magSimilarity * Math.max(0, phaseCorrelation);
      // Soft knee: smooth transition around threshold
      const threshold = 0.3;
      const knee = 0.2;
      let centerLikelihood;
      if (rawCenterLikelihood < threshold - knee) {
        centerLikelihood = 0;
      } else if (rawCenterLikelihood > threshold + knee) {
        centerLikelihood = rawCenterLikelihood;
      } else {
        // Smooth transition in knee region
        const t = (rawCenterLikelihood - threshold + knee) / (2 * knee);
        centerLikelihood = rawCenterLikelihood * t * t;
      }

      // 4. Frequency-dependent reduction
      const freqMultiplier = this.getFrequencyMultiplier(k);

      // 5. Final reduction amount
      const rawReduction = this.vocalReduction * freqMultiplier * centerLikelihood;

      // SPECTRAL SMOOTHING (QUICK WIN: reduces musical noise)
      const targetGainL = 1 - rawReduction;
      const targetGainR = 1 - rawReduction;

      const smoothedGainL = this.prevGainsL[k] * this.gainSmoothingFactor +
                           targetGainL * (1 - this.gainSmoothingFactor);
      const smoothedGainR = this.prevGainsR[k] * this.gainSmoothingFactor +
                           targetGainR * (1 - this.gainSmoothingFactor);

      this.prevGainsL[k] = smoothedGainL;
      this.prevGainsR[k] = smoothedGainR;

      // M/S PROCESSING
      // Mid = (L + R) / 2, Side = (L - R) / 2
      const midReal = (specL.real[k] + specR.real[k]) / 2;
      const midImag = (specL.imag[k] + specR.imag[k]) / 2;
      const sideReal = (specL.real[k] - specR.real[k]) / 2;
      const sideImag = (specL.imag[k] - specR.imag[k]) / 2;

      // Reduce mid (center) while preserving side (stereo)
      const gainedMidReal = midReal * smoothedGainL;
      const gainedMidImag = midImag * smoothedGainL;

      // Reconstruct L/R
      specL.real[k] = gainedMidReal + sideReal;
      specL.imag[k] = gainedMidImag + sideImag;
      specR.real[k] = gainedMidReal - sideReal;
      specR.imag[k] = gainedMidImag - sideImag;

      // Mirror for negative frequencies
      if (k > 0 && k < halfN - 1) {
        const mirrorK = n - k;
        specL.real[mirrorK] = specL.real[k];
        specL.imag[mirrorK] = -specL.imag[k];
        specR.real[mirrorK] = specR.real[k];
        specR.imag[mirrorK] = -specR.imag[k];
      }
    }

    // Inverse FFT
    const outL = this.ifft(specL.real, specL.imag);
    const outR = this.ifft(specR.real, specR.imag);

    // Apply window for synthesis
    const outputL = new Float32Array(n);
    const outputR = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      outputL[i] = outL.real[i] * this.window[i];
      outputR[i] = outR.real[i] * this.window[i];
    }

    return { left: outputL, right: outputR };
  }

  /**
   * Simple time-domain M/S processing (fallback for low latency)
   */
  processTimeDomain(left, right, output) {
    for (let i = 0; i < left.length; i++) {
      const l = left[i];
      const r = right[i];

      // M/S conversion
      const mid = (l + r) / 2;
      const side = (l - r) / 2;

      // Apply reduction to mid
      const reducedMid = mid * (1 - this.vocalReduction);

      // Reconstruct
      output[0][i] = side + reducedMid;
      output[1][i] = -side + reducedMid;
    }
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    const output = outputs[0];

    if (!input || input.length < 2) {
      return true;
    }

    const inputL = input[0];
    const inputR = input[1];
    const outputL = output[0];
    const outputR = output[1];
    const blockSize = inputL.length;

    if (!this.enabled) {
      // Pass through unchanged
      for (let i = 0; i < blockSize; i++) {
        outputL[i] = inputL[i];
        outputR[i] = inputR[i];
      }
      return true;
    }

    if (!this.useSpectralProcessing) {
      // Use simple time-domain processing
      this.processTimeDomain(inputL, inputR, output);
      return true;
    }

    // SPECTRAL PROCESSING with overlap-add
    for (let i = 0; i < blockSize; i++) {
      // Write input to circular buffer
      this.inputBufferL[this.inputWritePos] = inputL[i];
      this.inputBufferR[this.inputWritePos] = inputR[i];

      // Read output from circular buffer (with normalization)
      const norm = this.windowSum[this.outputReadPos];
      if (norm > 0.001) {
        outputL[i] = this.outputBufferL[this.outputReadPos] / norm;
        outputR[i] = this.outputBufferR[this.outputReadPos] / norm;
      } else {
        outputL[i] = 0;
        outputR[i] = 0;
      }

      // Clear output buffer position for next overlap-add
      this.outputBufferL[this.outputReadPos] = 0;
      this.outputBufferR[this.outputReadPos] = 0;

      // Advance positions
      this.inputWritePos = (this.inputWritePos + 1) % (this.fftSize * 2);
      this.outputReadPos = (this.outputReadPos + 1) % (this.fftSize * 2);
      this.samplesUntilNextHop--;

      // Time to process a frame?
      if (this.samplesUntilNextHop <= 0) {
        this.samplesUntilNextHop = this.hopSize;

        // Extract frame from input buffer
        const frameL = new Float32Array(this.fftSize);
        const frameR = new Float32Array(this.fftSize);
        for (let j = 0; j < this.fftSize; j++) {
          const pos = (this.inputWritePos - this.fftSize + j + this.fftSize * 2) % (this.fftSize * 2);
          frameL[j] = this.inputBufferL[pos];
          frameR[j] = this.inputBufferR[pos];
        }

        // Process frame
        const processed = this.processSpectralFrame(frameL, frameR);

        // Overlap-add to output buffer
        for (let j = 0; j < this.fftSize; j++) {
          const pos = (this.outputReadPos + j) % (this.fftSize * 2);
          this.outputBufferL[pos] += processed.left[j];
          this.outputBufferR[pos] += processed.right[j];
        }
      }
    }

    return true;
  }
}

registerProcessor('vocal-removal-processor', VocalRemovalProcessor);
