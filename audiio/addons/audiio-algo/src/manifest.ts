/**
 * Audiio Algorithm Manifest
 */

import type { AlgorithmManifest } from '@audiio/ml-sdk';

export const AUDIIO_ALGO_MANIFEST: AlgorithmManifest = {
  id: 'audiio-algo',
  name: 'Audiio Algorithm',
  version: '1.0.0',
  author: 'Audiio',
  description:
    'Official Audiio recommendation algorithm with neural network scoring, ' +
    'real-time audio analysis, emotion detection, lyrics sentiment analysis, ' +
    'and intelligent queue management.',

  capabilities: {
    // Core capabilities
    scoring: true,
    batchScoring: true,
    ranking: true,
    training: true,
    radioGeneration: true,
    similaritySearch: true,
    moodDetection: true,

    // Feature providers
    providesAudioFeatures: true,
    providesEmotionFeatures: true,
    providesLyricsAnalysis: true,
    providesFingerprinting: true,
    providesEmbeddings: true,
  },

  requirements: {
    // Data dependencies
    needsListenHistory: true,
    needsDislikedTracks: true,
    needsUserPreferences: true,
    needsTemporalPatterns: true,
    needsAudioFeatures: false, // We provide our own
    needsLyrics: true,

    // Resource requirements
    estimatedModelSize: '50MB',
    estimatedMemoryUsage: '200MB',
    requiresGPU: false,
    requiresWASM: true,

    // Minimum data requirements
    minListenEvents: 50,
    minLibrarySize: 20,
  },

  settings: [
    // === Audio Analysis ===
    {
      key: 'enableAudioAnalysis',
      label: 'Audio Analysis',
      description: 'Analyze audio for BPM, key, and energy using Essentia',
      type: 'boolean',
      default: true,
      category: 'Audio',
    },
    {
      key: 'audioAnalysisQuality',
      label: 'Analysis Quality',
      description: 'Higher quality uses more resources but is more accurate',
      type: 'select',
      default: 'balanced',
      options: [
        { value: 'fast', label: 'Fast' },
        { value: 'balanced', label: 'Balanced' },
        { value: 'accurate', label: 'Accurate' },
      ],
      category: 'Audio',
    },

    // === Emotion Detection ===
    {
      key: 'enableEmotionDetection',
      label: 'Emotion Detection',
      description: 'Detect mood and emotion from audio',
      type: 'boolean',
      default: true,
      category: 'Emotion',
    },

    // === Lyrics Analysis ===
    {
      key: 'enableLyricsAnalysis',
      label: 'Lyrics Analysis',
      description: 'Analyze lyrics for sentiment and themes',
      type: 'boolean',
      default: true,
      category: 'Lyrics',
    },

    // === Fingerprinting ===
    {
      key: 'enableFingerprinting',
      label: 'Audio Fingerprinting',
      description: 'Enable Chromaprint fingerprinting for track identification',
      type: 'boolean',
      default: true,
      category: 'Fingerprint',
    },
    {
      key: 'autoIdentifyUnknown',
      label: 'Auto-Identify Unknown',
      description: 'Automatically identify tracks without metadata',
      type: 'boolean',
      default: false,
      category: 'Fingerprint',
    },

    // === Similarity ===
    {
      key: 'enableEmbeddings',
      label: 'Similarity Search',
      description: 'Generate embeddings for track similarity',
      type: 'boolean',
      default: true,
      category: 'Similarity',
    },

    // === Scoring ===
    {
      key: 'explorationLevel',
      label: 'Exploration Level',
      description: 'How often to recommend new artists and genres',
      type: 'select',
      default: 'balanced',
      options: [
        { value: 'low', label: 'Stick to favorites' },
        { value: 'balanced', label: 'Balanced' },
        { value: 'high', label: 'Discover new music' },
      ],
      category: 'Scoring',
    },
    {
      key: 'mlWeight',
      label: 'ML Weight',
      description: 'How much to weight neural network predictions vs rules',
      type: 'range',
      default: 0.5,
      min: 0,
      max: 1,
      step: 0.1,
      category: 'Scoring',
    },
    {
      key: 'enableSessionFlow',
      label: 'Session Flow',
      description: 'Consider energy and mood transitions between tracks',
      type: 'boolean',
      default: true,
      category: 'Scoring',
    },
    {
      key: 'enableTemporalMatching',
      label: 'Time-Based Matching',
      description: 'Match music to time of day patterns',
      type: 'boolean',
      default: true,
      category: 'Scoring',
    },

    // === Training ===
    {
      key: 'autoTrain',
      label: 'Auto-Train',
      description: 'Automatically retrain model with new data',
      type: 'boolean',
      default: true,
      category: 'Training',
    },
    {
      key: 'trainOnIdle',
      label: 'Train When Idle',
      description: 'Train model when app is idle',
      type: 'boolean',
      default: true,
      category: 'Training',
    },
  ],

  icon: 'https://audiio.app/icons/algo.svg',
  docsUrl: 'https://docs.audiio.app/algorithm',
  repoUrl: 'https://github.com/audiio/audiio-algo',
};
