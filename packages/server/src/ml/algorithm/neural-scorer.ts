/**
 * Neural Scorer - TensorFlow.js neural network for preference prediction
 */

import * as tf from '@tensorflow/tfjs';
import type {
  MLCoreEndpoints,
  TrainingDataset,
  TrainingResult,
  TrainingMetrics,
  FeatureVector,
} from '../types';
import {
  createRecommendationModel,
  compileForBinaryClassification,
  trainModel,
  predictBatch,
  calculateClassWeights,
  getFeatureVectorDimension,
  flattenFeatureVector,
  createEarlyStoppingCallback,
  shuffleArrays,
} from '../utils';

const MODEL_KEY = 'recommendation-model';

export class NeuralScorer {
  private model: tf.LayersModel | null = null;
  private endpoints!: MLCoreEndpoints;
  private modelVersion = 0;
  private isTraining = false;
  private lastTrainingLoss = 0;
  private lastTrainingAccuracy = 0;

  /**
   * Initialize the neural scorer
   */
  async initialize(endpoints: MLCoreEndpoints): Promise<void> {
    this.endpoints = endpoints;

    // Try to load existing model
    const modelStorage = endpoints.storage.getModelStorage();
    const existingModel = await modelStorage.load(MODEL_KEY);

    if (existingModel) {
      this.model = existingModel;
      console.log('[NeuralScorer] Loaded existing model');

      // Load metadata
      const metadata = await endpoints.storage.get<{
        version: number;
        loss: number;
        accuracy: number;
      }>('model-metadata');

      if (metadata) {
        this.modelVersion = metadata.version;
        this.lastTrainingLoss = metadata.loss;
        this.lastTrainingAccuracy = metadata.accuracy;
      }
    } else {
      // Create new model
      const inputDim = getFeatureVectorDimension();
      this.model = createRecommendationModel(inputDim);
      compileForBinaryClassification(this.model);
      console.log('[NeuralScorer] Created new model');
    }
  }

  /**
   * Dispose resources
   */
  async dispose(): Promise<void> {
    if (this.model) {
      this.model.dispose();
      this.model = null;
    }
  }

  /**
   * Predict preference score for feature vectors
   */
  async predict(features: FeatureVector[]): Promise<number[]> {
    if (!this.model) {
      return features.map(() => 0.5);
    }

    const flatFeatures = features.map(f => flattenFeatureVector(f));
    return predictBatch(this.model, flatFeatures);
  }

  /**
   * Predict single feature vector
   */
  async predictSingle(features: FeatureVector): Promise<number> {
    const scores = await this.predict([features]);
    return scores[0];
  }

  /**
   * Train the model on a dataset
   */
  async train(dataset: TrainingDataset): Promise<TrainingResult> {
    if (!this.model) {
      return {
        success: false,
        error: 'Model not initialized',
        metrics: this.getEmptyMetrics(),
        model: this.getModelInfo(),
        duration: 0,
        completedAt: Date.now(),
      };
    }

    if (this.isTraining) {
      return {
        success: false,
        error: 'Training already in progress',
        metrics: this.getEmptyMetrics(),
        model: this.getModelInfo(),
        duration: 0,
        completedAt: Date.now(),
      };
    }

    this.isTraining = true;
    const startTime = Date.now();

    try {
      // Prepare training data
      const { features, labels } = this.prepareTrainingData(dataset);

      if (features.length < 50) {
        return {
          success: false,
          error: 'Not enough training data (need at least 50 samples)',
          metrics: this.getEmptyMetrics(),
          model: this.getModelInfo(),
          duration: Date.now() - startTime,
          completedAt: Date.now(),
        };
      }

      // Calculate class weights for imbalanced data
      const classWeights = calculateClassWeights(labels);

      // Convert to tensors
      const xTensor = tf.tensor2d(features);
      const yTensor = tf.tensor1d(labels);

      // Create early stopping callback to prevent overfitting
      // Stops training when validation loss stops improving for 5 epochs
      const earlyStoppingCallback = createEarlyStoppingCallback(5, 'val_loss');

      // Train with early stopping
      const metrics = await trainModel(this.model, xTensor, yTensor, {
        epochs: 100, // Max epochs - early stopping will stop sooner if needed
        batchSize: 32,
        validationSplit: 0.2,
        classWeight: classWeights,
        shuffle: true,
        verbose: 0,
        callbacks: earlyStoppingCallback,
      });

      // Cleanup tensors
      xTensor.dispose();
      yTensor.dispose();

      // Save model
      await this.saveModel(metrics);

      this.modelVersion++;
      this.lastTrainingLoss = metrics.loss;
      this.lastTrainingAccuracy = metrics.accuracy;

      console.log(`[NeuralScorer] Training complete. Loss: ${metrics.loss.toFixed(4)}, Accuracy: ${metrics.accuracy.toFixed(4)}`);

      return {
        success: true,
        metrics,
        model: this.getModelInfo(),
        duration: Date.now() - startTime,
        completedAt: Date.now(),
      };
    } catch (error) {
      console.error('[NeuralScorer] Training failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        metrics: this.getEmptyMetrics(),
        model: this.getModelInfo(),
        duration: Date.now() - startTime,
        completedAt: Date.now(),
      };
    } finally {
      this.isTraining = false;
    }
  }

  /**
   * Get model confidence (how well trained it is)
   */
  getConfidence(): number {
    if (this.modelVersion === 0) return 0;
    if (this.lastTrainingAccuracy === 0) return 0;

    // Confidence based on accuracy and training iterations
    const accuracyFactor = this.lastTrainingAccuracy;
    const versionFactor = Math.min(1, this.modelVersion / 10);

    return (accuracyFactor * 0.7 + versionFactor * 0.3);
  }

  /**
   * Get ML weight for hybrid scoring
   */
  getMLWeight(): number {
    // Start with low weight, increase with model maturity
    const baseWeight = 0.1;
    const maxWeight = 0.6;
    const confidence = this.getConfidence();

    return baseWeight + (maxWeight - baseWeight) * confidence;
  }

  /**
   * Check if model is ready for predictions
   */
  isReady(): boolean {
    return this.model !== null && this.modelVersion > 0;
  }

  /**
   * Get model version
   */
  getVersion(): number {
    return this.modelVersion;
  }

  /**
   * Prepare training data from dataset
   * Shuffles data to prevent ordering bias during training
   */
  private prepareTrainingData(dataset: TrainingDataset): {
    features: number[][];
    labels: number[];
  } {
    const features: number[][] = [];
    const labels: number[] = [];

    // Process all samples
    const allSamples = [
      ...dataset.positive,
      ...dataset.negative,
      ...dataset.partial,
    ];

    for (const sample of allSamples) {
      features.push(flattenFeatureVector(sample.features));
      labels.push(sample.label);
    }

    // Shuffle to prevent ordering bias (e.g., all positives then all negatives)
    const [shuffledFeatures, shuffledLabels] = shuffleArrays(features, labels);

    return { features: shuffledFeatures, labels: shuffledLabels };
  }

  /**
   * Save model to storage
   */
  private async saveModel(metrics: TrainingMetrics): Promise<void> {
    const modelStorage = this.endpoints.storage.getModelStorage();
    await modelStorage.save(MODEL_KEY, this.model!);

    // Save metadata
    await this.endpoints.storage.set('model-metadata', {
      version: this.modelVersion + 1,
      loss: metrics.loss,
      accuracy: metrics.accuracy,
      trainedAt: Date.now(),
    });
  }

  /**
   * Get model info
   */
  private getModelInfo() {
    const inputDim = getFeatureVectorDimension();
    return {
      version: this.modelVersion,
      parameters: this.model ? this.countParameters() : 0,
      architecture: '64-128-64-32-1 MLP',
      inputDimension: inputDim,
      outputDimension: 1,
    };
  }

  /**
   * Count model parameters
   */
  private countParameters(): number {
    if (!this.model) return 0;

    let total = 0;
    for (const layer of this.model.layers) {
      for (const weight of layer.getWeights()) {
        total += weight.size;
      }
    }
    return total;
  }

  /**
   * Get empty metrics
   */
  private getEmptyMetrics(): TrainingMetrics {
    return {
      loss: 0,
      accuracy: 0,
      valLoss: 0,
      valAccuracy: 0,
      epochs: 0,
      lossHistory: [],
      accuracyHistory: [],
    };
  }
}
