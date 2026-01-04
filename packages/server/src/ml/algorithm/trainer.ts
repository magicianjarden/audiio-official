/**
 * Trainer - Orchestrates model training
 */

import type {
  MLCoreEndpoints,
  TrainingDataset,
  TrainingResult,
  TrainingStatus,
  TrainingState,
} from '../types';
import type { NeuralScorer } from './neural-scorer';

export class Trainer {
  private endpoints: MLCoreEndpoints;
  private neuralScorer: NeuralScorer;
  private state: TrainingState = 'idle';
  private progress = 0;
  private currentEpoch = 0;
  private totalEpochs = 50;
  private lastResult?: TrainingResult;

  constructor(endpoints: MLCoreEndpoints, neuralScorer: NeuralScorer) {
    this.endpoints = endpoints;
    this.neuralScorer = neuralScorer;
  }

  /**
   * Train the model
   */
  async train(dataset: TrainingDataset): Promise<TrainingResult> {
    if (this.state === 'training') {
      return {
        success: false,
        error: 'Training already in progress',
        metrics: {
          loss: 0,
          accuracy: 0,
          valLoss: 0,
          valAccuracy: 0,
          epochs: 0,
          lossHistory: [],
          accuracyHistory: [],
        },
        model: {
          version: 0,
          parameters: 0,
          architecture: '',
          inputDimension: 0,
          outputDimension: 0,
        },
        duration: 0,
        completedAt: Date.now(),
      };
    }

    console.log('[Trainer] Starting training...');
    this.state = 'preparing';
    this.progress = 0;

    try {
      // Validate dataset
      const totalSamples = dataset.positive.length + dataset.negative.length + dataset.partial.length;
      if (totalSamples < 50) {
        this.state = 'error';
        return {
          success: false,
          error: `Not enough training data: ${totalSamples} samples (need 50+)`,
          metrics: {
            loss: 0,
            accuracy: 0,
            valLoss: 0,
            valAccuracy: 0,
            epochs: 0,
            lossHistory: [],
            accuracyHistory: [],
          },
          model: {
            version: 0,
            parameters: 0,
            architecture: '',
            inputDimension: 0,
            outputDimension: 0,
          },
          duration: 0,
          completedAt: Date.now(),
        };
      }

      console.log(`[Trainer] Dataset: ${totalSamples} samples (${dataset.positive.length}+, ${dataset.negative.length}-, ${dataset.partial.length} partial)`);

      // Enrich features if needed
      this.state = 'preparing';
      this.progress = 0.1;
      const enrichedDataset = await this.enrichDataset(dataset);

      // Train neural network
      this.state = 'training';
      this.progress = 0.2;

      const result = await this.neuralScorer.train(enrichedDataset);

      if (result.success) {
        this.state = 'saving';
        this.progress = 0.9;

        // Mark training complete
        await this.endpoints.training.markTrainingComplete(result.model.version);

        this.state = 'complete';
        this.progress = 1;

        console.log(`[Trainer] Training complete. Loss: ${result.metrics.loss.toFixed(4)}, Accuracy: ${result.metrics.accuracy.toFixed(4)}`);
      } else {
        this.state = 'error';
        console.error('[Trainer] Training failed:', result.error);
      }

      this.lastResult = result;
      return result;
    } catch (error) {
      this.state = 'error';
      console.error('[Trainer] Training error:', error);

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        metrics: {
          loss: 0,
          accuracy: 0,
          valLoss: 0,
          valAccuracy: 0,
          epochs: 0,
          lossHistory: [],
          accuracyHistory: [],
        },
        model: {
          version: 0,
          parameters: 0,
          architecture: '',
          inputDimension: 0,
          outputDimension: 0,
        },
        duration: 0,
        completedAt: Date.now(),
      };
    }
  }

  /**
   * Get training status
   */
  getStatus(): TrainingStatus {
    return {
      state: this.state,
      progress: this.progress,
      currentEpoch: this.currentEpoch,
      totalEpochs: this.totalEpochs,
      lastResult: this.lastResult,
    };
  }

  /**
   * Enrich dataset with additional features
   */
  private async enrichDataset(dataset: TrainingDataset): Promise<TrainingDataset> {
    // For samples without complete features, try to fetch them
    const allSamples = [...dataset.positive, ...dataset.negative, ...dataset.partial];
    const trackIds = [...new Set(allSamples.map(s => s.track.id))];

    // Prefetch features
    await this.endpoints.features.prefetch(trackIds);

    // Enrich each sample
    for (const sample of allSamples) {
      const features = await this.endpoints.features.get(sample.track.id);

      // Update feature vector if we have better data
      if (features.audio) {
        sample.features.audio = {
          ...sample.features.audio,
          bpm: features.audio.bpm !== undefined ? features.audio.bpm / 200 : sample.features.audio.bpm,
          energy: features.audio.energy ?? sample.features.audio.energy,
          valence: features.audio.valence ?? sample.features.audio.valence,
          danceability: features.audio.danceability ?? sample.features.audio.danceability,
          acousticness: features.audio.acousticness ?? sample.features.audio.acousticness,
          instrumentalness: features.audio.instrumentalness ?? sample.features.audio.instrumentalness,
          loudness: features.audio.loudness !== undefined
            ? (features.audio.loudness + 60) / 60 // Normalize from dB
            : sample.features.audio.loudness,
        };
      }

      if (features.emotion) {
        sample.features.emotion = {
          valence: features.emotion.valence,
          arousal: features.emotion.arousal,
          dominance: features.emotion.dominance ?? 0.5,
        };
      }

      if (features.lyrics) {
        sample.features.lyrics = {
          sentiment: (features.lyrics.sentiment + 1) / 2, // Normalize -1 to 1 -> 0 to 1
          intensity: features.lyrics.emotionalIntensity,
        };
      }
    }

    return dataset;
  }
}
