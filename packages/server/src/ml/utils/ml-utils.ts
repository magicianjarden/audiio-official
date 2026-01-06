/**
 * ML Utilities - TensorFlow.js helpers for model building and training
 */

import * as tf from '@tensorflow/tfjs';
import type { TrainingConfig, TrainingMetrics } from '../types/training';

// ============================================================================
// Model Building
// ============================================================================

/**
 * Create a standard feedforward neural network
 */
export function createFeedforwardModel(
  inputDim: number,
  hiddenLayers: number[],
  outputDim: number,
  options: {
    activation?: string;
    outputActivation?: string;
    dropoutRate?: number;
    l2Regularization?: number;
  } = {}
): tf.LayersModel {
  const {
    activation = 'relu',
    outputActivation = 'sigmoid',
    dropoutRate = 0.3,
    l2Regularization = 0.01,
  } = options;

  const model = tf.sequential();

  // Input layer
  model.add(tf.layers.dense({
    units: hiddenLayers[0],
    activation: activation as 'relu',
    inputShape: [inputDim],
    kernelInitializer: 'heNormal',
    kernelRegularizer: l2Regularization > 0
      ? tf.regularizers.l2({ l2: l2Regularization })
      : undefined,
  }));

  // Hidden layers
  for (let i = 1; i < hiddenLayers.length; i++) {
    model.add(tf.layers.dense({
      units: hiddenLayers[i],
      activation: activation as 'relu',
      kernelInitializer: 'heNormal',
      kernelRegularizer: l2Regularization > 0
        ? tf.regularizers.l2({ l2: l2Regularization })
        : undefined,
    }));

    // Add dropout after each hidden layer
    if (dropoutRate > 0) {
      model.add(tf.layers.dropout({ rate: dropoutRate }));
    }
  }

  // Output layer
  model.add(tf.layers.dense({
    units: outputDim,
    activation: outputActivation as 'sigmoid',
    kernelInitializer: 'glorotNormal',
  }));

  return model;
}

/**
 * Create the default Audiio recommendation model architecture
 */
export function createRecommendationModel(inputDim: number): tf.LayersModel {
  return createFeedforwardModel(
    inputDim,
    [64, 128, 64, 32],
    1,
    {
      activation: 'relu',
      outputActivation: 'sigmoid',
      dropoutRate: 0.3,
      l2Regularization: 0.01,
    }
  );
}

// ============================================================================
// Model Compilation
// ============================================================================

/**
 * Compile a model with standard settings for binary classification
 */
export function compileForBinaryClassification(
  model: tf.LayersModel,
  learningRate = 0.001
): void {
  model.compile({
    optimizer: tf.train.adam(learningRate),
    loss: 'binaryCrossentropy',
    metrics: ['accuracy'],
  });
}

/**
 * Compile a model for regression
 */
export function compileForRegression(
  model: tf.LayersModel,
  learningRate = 0.001
): void {
  model.compile({
    optimizer: tf.train.adam(learningRate),
    loss: 'meanSquaredError',
    metrics: ['mae'],
  });
}

// ============================================================================
// Training
// ============================================================================

export interface TrainOptions {
  epochs: number;
  batchSize: number;
  validationSplit: number;
  callbacks?: tf.CustomCallbackArgs;
  verbose?: 0 | 1 | 2;
  classWeight?: { [classId: number]: number };
  shuffle?: boolean;
}

/**
 * Train a model with the given data
 */
export async function trainModel(
  model: tf.LayersModel,
  x: tf.Tensor2D,
  y: tf.Tensor,
  options: TrainOptions
): Promise<TrainingMetrics> {
  const history = await model.fit(x, y, {
    epochs: options.epochs,
    batchSize: options.batchSize,
    validationSplit: options.validationSplit,
    callbacks: options.callbacks,
    verbose: options.verbose ?? 0,
    classWeight: options.classWeight,
    shuffle: options.shuffle ?? true,
  });

  const lastEpoch = history.history.loss.length - 1;

  return {
    loss: history.history.loss[lastEpoch] as number,
    accuracy: (history.history.acc?.[lastEpoch] ?? history.history.accuracy?.[lastEpoch] ?? 0) as number,
    valLoss: (history.history.val_loss?.[lastEpoch] ?? 0) as number,
    valAccuracy: (history.history.val_acc?.[lastEpoch] ?? history.history.val_accuracy?.[lastEpoch] ?? 0) as number,
    epochs: options.epochs,
    lossHistory: history.history.loss as number[],
    accuracyHistory: (history.history.acc ?? history.history.accuracy ?? []) as number[],
    valHistory: {
      loss: (history.history.val_loss ?? []) as number[],
      accuracy: (history.history.val_acc ?? history.history.val_accuracy ?? []) as number[],
    },
  };
}

/**
 * Create class weights for imbalanced datasets
 */
export function calculateClassWeights(labels: number[]): { 0: number; 1: number } {
  const positiveCount = labels.filter(l => l >= 0.5).length;
  const negativeCount = labels.length - positiveCount;
  const total = labels.length;

  if (positiveCount === 0 || negativeCount === 0) {
    return { 0: 1, 1: 1 };
  }

  return {
    0: total / (2 * negativeCount),
    1: total / (2 * positiveCount),
  };
}

// ============================================================================
// Data Preparation
// ============================================================================

/**
 * Shuffle arrays in unison
 */
export function shuffleArrays<T, U>(arr1: T[], arr2: U[]): [T[], U[]] {
  const indices = Array.from({ length: arr1.length }, (_, i) => i);

  // Fisher-Yates shuffle
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }

  return [
    indices.map(i => arr1[i]),
    indices.map(i => arr2[i]),
  ];
}

/**
 * Split data into train/validation sets
 */
export function trainValSplit<T>(
  data: T[],
  validationSplit: number
): { train: T[]; val: T[] } {
  const splitIndex = Math.floor(data.length * (1 - validationSplit));
  return {
    train: data.slice(0, splitIndex),
    val: data.slice(splitIndex),
  };
}

// ============================================================================
// Prediction
// ============================================================================

/**
 * Predict scores for a batch of feature vectors
 */
export async function predictBatch(
  model: tf.LayersModel,
  features: number[][]
): Promise<number[]> {
  const inputTensor = tf.tensor2d(features);

  try {
    const predictions = model.predict(inputTensor) as tf.Tensor;
    const scores = await predictions.data();
    predictions.dispose();
    return Array.from(scores);
  } finally {
    inputTensor.dispose();
  }
}

// ============================================================================
// Model Management
// ============================================================================

/**
 * Get model summary as string
 */
export function getModelSummary(model: tf.LayersModel): string {
  const lines: string[] = [];

  model.summary(undefined, undefined, (line) => {
    lines.push(line);
  });

  return lines.join('\n');
}

/**
 * Calculate model checksum for integrity verification
 */
export async function calculateModelChecksum(model: tf.LayersModel): Promise<string> {
  const weights: number[] = [];

  for (const layer of model.layers) {
    for (const w of layer.getWeights()) {
      const data = await w.data();
      // Sample first 100 weights for checksum
      weights.push(...Array.from(data).slice(0, 100));
    }
  }

  // Simple checksum based on sum and count
  const sum = weights.reduce((a, b) => a + b, 0);
  return `${weights.length}-${sum.toFixed(6)}`;
}

// ============================================================================
// Memory Management
// ============================================================================

/**
 * Dispose tensors safely
 */
export function disposeTensors(...tensors: (tf.Tensor | null | undefined)[]): void {
  for (const tensor of tensors) {
    if (tensor && !tensor.isDisposed) {
      tensor.dispose();
    }
  }
}

/**
 * Get current memory usage
 */
export function getMemoryInfo(): { numTensors: number; numBytes: number } {
  const info = tf.memory();
  return {
    numTensors: info.numTensors,
    numBytes: info.numBytes,
  };
}

// ============================================================================
// Callbacks
// ============================================================================

/**
 * Create early stopping callback
 */
export function createEarlyStoppingCallback(
  patience: number,
  monitor = 'val_loss'
): tf.CustomCallbackArgs {
  let bestValue = Infinity;
  let waitCount = 0;

  return {
    onEpochEnd: async (epoch, logs) => {
      const currentValue = logs?.[monitor] ?? Infinity;

      if (currentValue < bestValue) {
        bestValue = currentValue as number;
        waitCount = 0;
      } else {
        waitCount++;
        if (waitCount >= patience) {
          console.log(`Early stopping at epoch ${epoch + 1}`);
          // Note: TF.js doesn't support stop_training, caller should check logs
        }
      }
    },
  };
}

/**
 * Create progress callback
 */
export function createProgressCallback(
  onProgress: (progress: number, epoch: number, logs?: tf.Logs) => void,
  totalEpochs: number
): tf.CustomCallbackArgs {
  return {
    onEpochEnd: async (epoch, logs) => {
      const progress = (epoch + 1) / totalEpochs;
      onProgress(progress, epoch + 1, logs);
    },
  };
}
