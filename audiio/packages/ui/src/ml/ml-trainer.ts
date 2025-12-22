/**
 * ML Trainer - TensorFlow.js model for music recommendations
 *
 * Neural network architecture:
 * Input (22 dims) -> Dense(64) -> Dense(128) -> Dropout(0.3)
 * -> Dense(64) -> Dense(32) -> Output(1, sigmoid)
 */

import * as tf from '@tensorflow/tfjs';
import type { UnifiedTrack } from '@audiio/core';
import type { ListenEvent, UserProfile, DislikedTrack } from '../stores/recommendation-store';
import {
  extractAllFeatures,
  extractContextFeatures,
  prepareTrainingData,
  TOTAL_FEATURE_DIM,
  type FeatureScalers
} from './feature-extractor';

// ============================================
// Types
// ============================================

export interface TrainingConfig {
  epochs: number;
  batchSize: number;
  learningRate: number;
  validationSplit: number;
}

export interface TrainingMetrics {
  loss: number;
  accuracy: number;
  valLoss?: number;
  valAccuracy?: number;
  samplesUsed: number;
}

export interface TrainingProgress {
  epoch: number;
  totalEpochs: number;
  loss: number;
  accuracy?: number;
}

// ============================================
// Default Configuration
// ============================================

const DEFAULT_CONFIG: TrainingConfig = {
  epochs: 50,
  batchSize: 32,
  learningRate: 0.001,
  validationSplit: 0.2
};

const MODEL_STORAGE_KEY = 'audiio-ml-model';

// ============================================
// ML Trainer Class
// ============================================

export class MLTrainer {
  private model: tf.LayersModel | null = null;
  private isDisposed = false;

  /**
   * Create the neural network model
   */
  createModel(): tf.LayersModel {
    if (this.model) {
      this.model.dispose();
    }

    const model = tf.sequential();

    // Input layer with initial dense transformation
    model.add(tf.layers.dense({
      inputShape: [TOTAL_FEATURE_DIM],
      units: 64,
      activation: 'relu',
      kernelInitializer: 'heNormal',
      name: 'input_dense'
    }));

    // Hidden layers
    model.add(tf.layers.dense({
      units: 128,
      activation: 'relu',
      kernelInitializer: 'heNormal',
      name: 'hidden_1'
    }));

    model.add(tf.layers.dropout({
      rate: 0.3,
      name: 'dropout'
    }));

    model.add(tf.layers.dense({
      units: 64,
      activation: 'relu',
      kernelInitializer: 'heNormal',
      name: 'hidden_2'
    }));

    model.add(tf.layers.dense({
      units: 32,
      activation: 'relu',
      kernelInitializer: 'heNormal',
      name: 'hidden_3'
    }));

    // Output layer - preference score [0, 1]
    model.add(tf.layers.dense({
      units: 1,
      activation: 'sigmoid',
      name: 'output'
    }));

    // Compile the model
    model.compile({
      optimizer: tf.train.adam(DEFAULT_CONFIG.learningRate),
      loss: 'binaryCrossentropy',
      metrics: ['accuracy']
    });

    this.model = model;
    return model;
  }

  /**
   * Get the current model (creates one if needed)
   */
  getModel(): tf.LayersModel | null {
    return this.model;
  }

  /**
   * Check if model is ready for inference
   */
  isReady(): boolean {
    return this.model !== null && !this.isDisposed;
  }

  /**
   * Train the model on listen history and disliked tracks
   * Disliked tracks are used as weighted negative examples based on reasons
   */
  async train(
    tracks: Map<string, UnifiedTrack>,
    listenHistory: ListenEvent[],
    userProfile: UserProfile,
    scalers: FeatureScalers,
    config: Partial<TrainingConfig> = {},
    onProgress?: (progress: TrainingProgress) => void,
    dislikedTracks?: Record<string, DislikedTrack>
  ): Promise<TrainingMetrics> {
    const fullConfig = { ...DEFAULT_CONFIG, ...config };

    // Ensure model exists
    if (!this.model) {
      this.createModel();
    }

    // Prepare training data (now includes disliked tracks as negative examples)
    const { inputs, labels } = prepareTrainingData(
      tracks,
      listenHistory,
      userProfile,
      scalers,
      dislikedTracks
    );

    // Log training data composition
    const positiveCount = labels.filter(l => l > 0.5).length;
    const negativeCount = labels.filter(l => l <= 0.2).length;
    const neutralCount = labels.length - positiveCount - negativeCount;
    console.log(`[MLTrainer] Training data: ${positiveCount} positive, ${negativeCount} negative (disliked), ${neutralCount} neutral samples`);

    if (inputs.length < 10) {
      throw new Error('Insufficient training data (need at least 10 samples)');
    }

    // Create tensors
    const inputTensor = tf.tensor2d(inputs);
    const labelTensor = tf.tensor1d(labels);

    try {
      // Train the model
      const history = await this.model!.fit(inputTensor, labelTensor, {
        epochs: fullConfig.epochs,
        batchSize: fullConfig.batchSize,
        validationSplit: fullConfig.validationSplit,
        shuffle: true,
        callbacks: {
          onEpochEnd: (epoch, logs) => {
            if (onProgress && logs) {
              onProgress({
                epoch: epoch + 1,
                totalEpochs: fullConfig.epochs,
                loss: logs.loss as number,
                accuracy: logs.acc as number
              });
            }
          }
        }
      });

      // Extract final metrics
      const finalEpoch = history.history.loss.length - 1;
      const metrics: TrainingMetrics = {
        loss: history.history.loss[finalEpoch] as number,
        accuracy: (history.history.acc?.[finalEpoch] as number) ?? 0,
        valLoss: history.history.val_loss?.[finalEpoch] as number,
        valAccuracy: history.history.val_acc?.[finalEpoch] as number,
        samplesUsed: inputs.length
      };

      return metrics;
    } finally {
      // Cleanup tensors
      inputTensor.dispose();
      labelTensor.dispose();
    }
  }

  /**
   * Predict preference score for a single track
   */
  predict(
    track: UnifiedTrack,
    userProfile: UserProfile,
    listenHistory: ListenEvent[],
    scalers: FeatureScalers,
    hour?: number
  ): number {
    if (!this.model || this.isDisposed) {
      return 0.5; // Neutral if no model
    }

    const features = extractAllFeatures(track, userProfile, listenHistory, scalers, hour);
    const input = tf.tensor2d([features.combined]);

    try {
      const prediction = this.model.predict(input) as tf.Tensor;
      const score = prediction.dataSync()[0];
      prediction.dispose();
      return score;
    } finally {
      input.dispose();
    }
  }

  /**
   * Batch predict for efficiency
   */
  predictBatch(
    tracks: UnifiedTrack[],
    userProfile: UserProfile,
    listenHistory: ListenEvent[],
    scalers: FeatureScalers,
    hour?: number
  ): number[] {
    if (!this.model || this.isDisposed || tracks.length === 0) {
      return tracks.map(() => 0.5);
    }

    const contextFeatures = extractContextFeatures(hour);

    // Extract features for all tracks
    const inputs = tracks.map(track => {
      const features = extractAllFeatures(track, userProfile, listenHistory, scalers, hour);
      return features.combined;
    });

    const inputTensor = tf.tensor2d(inputs);

    try {
      const predictions = this.model.predict(inputTensor) as tf.Tensor;
      const scores = Array.from(predictions.dataSync());
      predictions.dispose();
      return scores;
    } finally {
      inputTensor.dispose();
    }
  }

  /**
   * Save model to IndexedDB
   */
  async saveModel(): Promise<boolean> {
    if (!this.model) {
      console.warn('[MLTrainer] No model to save');
      return false;
    }

    try {
      await this.model.save(`indexeddb://${MODEL_STORAGE_KEY}`);
      console.log('[MLTrainer] Model saved to IndexedDB');
      return true;
    } catch (error) {
      console.error('[MLTrainer] Failed to save model:', error);
      return false;
    }
  }

  /**
   * Load model from IndexedDB
   */
  async loadModel(): Promise<boolean> {
    try {
      this.model = await tf.loadLayersModel(`indexeddb://${MODEL_STORAGE_KEY}`);

      // Recompile with same settings
      this.model.compile({
        optimizer: tf.train.adam(DEFAULT_CONFIG.learningRate),
        loss: 'binaryCrossentropy',
        metrics: ['accuracy']
      });

      console.log('[MLTrainer] Model loaded from IndexedDB');
      return true;
    } catch (error) {
      console.log('[MLTrainer] No saved model found, will create new one');
      return false;
    }
  }

  /**
   * Check if a saved model exists
   */
  async hasSavedModel(): Promise<boolean> {
    try {
      const models = await tf.io.listModels();
      return `indexeddb://${MODEL_STORAGE_KEY}` in models;
    } catch {
      return false;
    }
  }

  /**
   * Delete saved model
   */
  async deleteModel(): Promise<void> {
    try {
      await tf.io.removeModel(`indexeddb://${MODEL_STORAGE_KEY}`);
      console.log('[MLTrainer] Saved model deleted');
    } catch (error) {
      console.warn('[MLTrainer] No model to delete');
    }
  }

  /**
   * Get model summary
   */
  getSummary(): string {
    if (!this.model) {
      return 'No model loaded';
    }

    let summary = '';
    this.model.summary(undefined, undefined, (line) => {
      summary += line + '\n';
    });
    return summary;
  }

  /**
   * Dispose model and free memory
   */
  dispose(): void {
    if (this.model) {
      this.model.dispose();
      this.model = null;
    }
    this.isDisposed = true;
  }
}

// ============================================
// Singleton Instance
// ============================================

let trainerInstance: MLTrainer | null = null;

/**
 * Get the singleton trainer instance
 */
export function getTrainer(): MLTrainer {
  if (!trainerInstance) {
    trainerInstance = new MLTrainer();
  }
  return trainerInstance;
}

/**
 * Reset the trainer (for testing)
 */
export function resetTrainer(): void {
  if (trainerInstance) {
    trainerInstance.dispose();
    trainerInstance = null;
  }
}

// ============================================
// Utility Functions
// ============================================

/**
 * Check if we have enough data to train
 */
export function canTrain(listenHistoryLength: number): boolean {
  return listenHistoryLength >= 50;
}

/**
 * Check if we should retrain the model
 */
export function shouldRetrain(
  lastTrainedAt: number,
  currentHistoryLength: number,
  historyAtLastTrain: number,
  modelVersion: number
): boolean {
  // Never trained and enough data
  if (modelVersion === 0 && currentHistoryLength >= 50) {
    return true;
  }

  // Don't retrain if we don't have a previous model
  if (modelVersion === 0) {
    return false;
  }

  // Time since last train
  const hoursSinceLastTrain = (Date.now() - lastTrainedAt) / (1000 * 60 * 60);

  // Retrain after 24 hours if we have 10+ new events
  if (hoursSinceLastTrain >= 24 && (currentHistoryLength - historyAtLastTrain) >= 10) {
    return true;
  }

  // Retrain after 7 days regardless
  if (hoursSinceLastTrain >= 168) {
    return true;
  }

  return false;
}
