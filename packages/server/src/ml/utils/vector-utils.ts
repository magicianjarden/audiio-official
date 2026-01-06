/**
 * Vector Utilities
 *
 * Shared vector operations for embeddings and similarity calculations.
 */

/**
 * Normalize a vector to unit length (L2 normalization)
 */
export function normalizeVector(vector: Float32Array): Float32Array {
  let magnitude = 0;
  for (let i = 0; i < vector.length; i++) {
    magnitude += vector[i] * vector[i];
  }
  magnitude = Math.sqrt(magnitude);

  if (magnitude === 0) return vector;

  const normalized = new Float32Array(vector.length);
  for (let i = 0; i < vector.length; i++) {
    normalized[i] = vector[i] / magnitude;
  }

  return normalized;
}

/**
 * Calculate cosine similarity between two vectors
 * Returns a value between -1 and 1, where 1 means identical direction
 * Accepts both Float32Array and number[] for flexibility
 */
export function cosineSimilarity(
  a: Float32Array | number[],
  b: Float32Array | number[]
): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  const len = Math.min(a.length, b.length);

  for (let i = 0; i < len; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Calculate Euclidean distance between two vectors
 */
export function euclideanDistance(a: Float32Array, b: Float32Array): number {
  let sum = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const diff = a[i] - b[i];
    sum += diff * diff;
  }
  return Math.sqrt(sum);
}

/**
 * Calculate the magnitude (L2 norm) of a vector
 */
export function vectorMagnitude(vector: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < vector.length; i++) {
    sum += vector[i] * vector[i];
  }
  return Math.sqrt(sum);
}

/**
 * Add two vectors element-wise
 */
export function addVectors(a: Float32Array, b: Float32Array): Float32Array {
  const len = Math.min(a.length, b.length);
  const result = new Float32Array(len);
  for (let i = 0; i < len; i++) {
    result[i] = a[i] + b[i];
  }
  return result;
}

/**
 * Scale a vector by a scalar
 */
export function scaleVector(vector: Float32Array, scalar: number): Float32Array {
  const result = new Float32Array(vector.length);
  for (let i = 0; i < vector.length; i++) {
    result[i] = vector[i] * scalar;
  }
  return result;
}

/**
 * Average multiple vectors
 */
export function averageVectors(vectors: Float32Array[]): Float32Array {
  if (vectors.length === 0) {
    return new Float32Array(0);
  }

  const dims = vectors[0].length;
  const result = new Float32Array(dims);

  for (const vec of vectors) {
    for (let i = 0; i < dims; i++) {
      result[i] += vec[i];
    }
  }

  for (let i = 0; i < dims; i++) {
    result[i] /= vectors.length;
  }

  return result;
}

/**
 * Blend two vectors with weights
 */
export function blendVectors(
  a: Float32Array,
  b: Float32Array,
  weightA: number,
  weightB: number
): Float32Array {
  const dims = Math.min(a.length, b.length);
  const result = new Float32Array(dims);

  for (let i = 0; i < dims; i++) {
    result[i] = a[i] * weightA + b[i] * weightB;
  }

  return result;
}
