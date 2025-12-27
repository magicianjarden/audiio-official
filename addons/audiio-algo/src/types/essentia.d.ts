/**
 * Type declarations for essentia.js
 */

declare module 'essentia.js' {
  export interface EssentiaInstance {
    arrayToVector: (arr: Float32Array) => unknown;
    vectorToArray: (vec: unknown) => Float32Array;
    RhythmExtractor: (signal: unknown) => { bpm: number; confidence: number };
    KeyExtractor: (signal: unknown) => { key: string; scale: string; strength: number };
    Loudness: (signal: unknown) => { loudness: number };
    Energy: (signal: unknown) => { energy: number };
    DynamicComplexity: (signal: unknown) => { dynamicComplexity: number; loudness: number };
    Danceability: (signal: unknown) => { danceability: number };
    SpectralCentroidTime: (signal: unknown) => { spectralCentroid: number };
    ZeroCrossingRate: (signal: unknown) => { zeroCrossingRate: number };
    MFCC: (signal: unknown, options?: { numberCoefficients?: number }) => { mfcc: Float32Array[] };
  }

  // The module exports a promise that resolves to a constructor
  const EssentiaWASM: Promise<new () => EssentiaInstance>;
  export default EssentiaWASM;
}
