/**
 * Type declarations for essentia.js
 */

declare module 'essentia.js' {
  interface EssentiaWASM {
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

  const EssentiaModule: Promise<new () => EssentiaWASM>;
  export default EssentiaModule;
}
