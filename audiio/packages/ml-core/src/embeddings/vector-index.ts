/**
 * Vector Index
 *
 * Fast similarity search using Approximate Nearest Neighbors (ANN).
 * Implements a simplified HNSW-like structure for efficient vector search.
 */

import type { SimilarityResult, TrackEmbedding } from './types';

/**
 * Configuration for the vector index
 */
export interface VectorIndexConfig {
  dimensions: number;
  maxElements: number;
  efConstruction: number; // Size of dynamic candidate list for construction
  efSearch: number; // Size of dynamic candidate list for search
  mMax: number; // Max number of connections per element
  mMax0: number; // Max connections at layer 0
}

/**
 * Default index configuration
 */
export const DEFAULT_INDEX_CONFIG: VectorIndexConfig = {
  dimensions: 128,
  maxElements: 100000,
  efConstruction: 200,
  efSearch: 50,
  mMax: 16,
  mMax0: 32,
};

/**
 * A node in the HNSW graph
 */
interface HNSWNode {
  id: string;
  vector: Float32Array;
  connections: Map<number, Set<string>>; // layer -> connected node ids
  layer: number; // Maximum layer this node exists in
}

/**
 * Vector Index for fast similarity search
 *
 * Uses a simplified HNSW (Hierarchical Navigable Small World) algorithm
 * for approximate nearest neighbor search.
 */
export class VectorIndex {
  private config: VectorIndexConfig;
  private nodes = new Map<string, HNSWNode>();
  private entryPoint: string | null = null;
  private maxLayer = 0;
  private levelMultiplier: number;

  constructor(config: Partial<VectorIndexConfig> = {}) {
    this.config = { ...DEFAULT_INDEX_CONFIG, ...config };
    this.levelMultiplier = 1 / Math.log(this.config.mMax);
  }

  /**
   * Add a vector to the index
   */
  add(id: string, vector: Float32Array): void {
    if (this.nodes.has(id)) {
      // Update existing
      this.update(id, vector);
      return;
    }

    // Determine random level for this node
    const level = this.getRandomLevel();

    const node: HNSWNode = {
      id,
      vector: new Float32Array(vector),
      connections: new Map(),
      layer: level,
    };

    // Initialize connection sets for each layer
    for (let l = 0; l <= level; l++) {
      node.connections.set(l, new Set());
    }

    this.nodes.set(id, node);

    if (this.entryPoint === null) {
      this.entryPoint = id;
      this.maxLayer = level;
      return;
    }

    // Find entry point at top layer
    let currentNode = this.entryPoint;
    let currentDist = this.distance(vector, this.nodes.get(currentNode)!.vector);

    // Traverse from top layer down to node's layer
    for (let lc = this.maxLayer; lc > level; lc--) {
      const result = this.searchLayer(vector, currentNode, 1, lc);
      if (result.length > 0) {
        currentNode = result[0].id;
        currentDist = result[0].distance;
      }
    }

    // Insert at each layer from level down to 0
    for (let lc = Math.min(level, this.maxLayer); lc >= 0; lc--) {
      const neighbors = this.searchLayer(
        vector,
        currentNode,
        this.config.efConstruction,
        lc
      );

      // Select M nearest neighbors
      const M = lc === 0 ? this.config.mMax0 : this.config.mMax;
      const selectedNeighbors = this.selectNeighbors(neighbors, M);

      // Connect to neighbors
      for (const neighbor of selectedNeighbors) {
        node.connections.get(lc)!.add(neighbor.id);
        const neighborNode = this.nodes.get(neighbor.id)!;
        if (!neighborNode.connections.has(lc)) {
          neighborNode.connections.set(lc, new Set());
        }
        neighborNode.connections.get(lc)!.add(id);
      }

      // Prune neighbor connections if needed
      for (const neighbor of selectedNeighbors) {
        const neighborNode = this.nodes.get(neighbor.id)!;
        const neighborConnections = neighborNode.connections.get(lc)!;
        if (neighborConnections.size > M) {
          this.pruneConnections(neighborNode, lc, M);
        }
      }

      if (neighbors.length > 0) {
        currentNode = neighbors[0].id;
      }
    }

    // Update entry point if needed
    if (level > this.maxLayer) {
      this.entryPoint = id;
      this.maxLayer = level;
    }
  }

  /**
   * Update an existing vector
   */
  update(id: string, vector: Float32Array): void {
    const node = this.nodes.get(id);
    if (!node) {
      this.add(id, vector);
      return;
    }

    // Simple update: just replace the vector
    // For more accuracy, could remove and re-add
    node.vector = new Float32Array(vector);
  }

  /**
   * Remove a vector from the index
   */
  remove(id: string): boolean {
    const node = this.nodes.get(id);
    if (!node) return false;

    // Remove connections to this node from all neighbors
    for (const [layer, connections] of node.connections) {
      for (const neighborId of connections) {
        const neighbor = this.nodes.get(neighborId);
        if (neighbor && neighbor.connections.has(layer)) {
          neighbor.connections.get(layer)!.delete(id);
        }
      }
    }

    this.nodes.delete(id);

    // Update entry point if needed
    if (this.entryPoint === id) {
      if (this.nodes.size === 0) {
        this.entryPoint = null;
        this.maxLayer = 0;
      } else {
        // Find new entry point (node with highest layer)
        let maxLayer = -1;
        let newEntry: string | null = null;
        for (const [nodeId, n] of this.nodes) {
          if (n.layer > maxLayer) {
            maxLayer = n.layer;
            newEntry = nodeId;
          }
        }
        this.entryPoint = newEntry;
        this.maxLayer = maxLayer;
      }
    }

    return true;
  }

  /**
   * Search for k nearest neighbors
   */
  search(query: Float32Array, k: number): SimilarityResult[] {
    if (this.entryPoint === null || this.nodes.size === 0) {
      return [];
    }

    let currentNode = this.entryPoint;

    // Traverse from top layer down to layer 1
    for (let lc = this.maxLayer; lc > 0; lc--) {
      const result = this.searchLayer(query, currentNode, 1, lc);
      if (result.length > 0) {
        currentNode = result[0].id;
      }
    }

    // Search at layer 0 with ef parameter
    const candidates = this.searchLayer(
      query,
      currentNode,
      Math.max(k, this.config.efSearch),
      0
    );

    // Return top k
    return candidates.slice(0, k).map((c) => ({
      trackId: c.id,
      score: 1 / (1 + c.distance), // Convert distance to similarity score
      distance: c.distance,
    }));
  }

  /**
   * Search within a single layer
   */
  private searchLayer(
    query: Float32Array,
    entryPointId: string,
    ef: number,
    layer: number
  ): Array<{ id: string; distance: number }> {
    const entryNode = this.nodes.get(entryPointId);
    if (!entryNode) return [];

    const visited = new Set<string>([entryPointId]);
    const candidates: Array<{ id: string; distance: number }> = [
      { id: entryPointId, distance: this.distance(query, entryNode.vector) },
    ];
    const results: Array<{ id: string; distance: number }> = [...candidates];

    while (candidates.length > 0) {
      // Get nearest candidate
      candidates.sort((a, b) => a.distance - b.distance);
      const current = candidates.shift()!;

      // Get furthest result
      const furthestResult = results[results.length - 1];
      if (current.distance > furthestResult.distance && results.length >= ef) {
        break;
      }

      // Explore neighbors
      const currentNode = this.nodes.get(current.id)!;
      const connections = currentNode.connections.get(layer);
      if (!connections) continue;

      for (const neighborId of connections) {
        if (visited.has(neighborId)) continue;
        visited.add(neighborId);

        const neighborNode = this.nodes.get(neighborId);
        if (!neighborNode) continue;

        const dist = this.distance(query, neighborNode.vector);

        if (results.length < ef || dist < results[results.length - 1].distance) {
          candidates.push({ id: neighborId, distance: dist });
          results.push({ id: neighborId, distance: dist });
          results.sort((a, b) => a.distance - b.distance);
          if (results.length > ef) {
            results.pop();
          }
        }
      }
    }

    return results;
  }

  /**
   * Select best neighbors from candidates
   */
  private selectNeighbors(
    candidates: Array<{ id: string; distance: number }>,
    M: number
  ): Array<{ id: string; distance: number }> {
    // Simple selection: take M nearest
    return candidates.slice(0, M);
  }

  /**
   * Prune connections to maintain max M connections
   */
  private pruneConnections(node: HNSWNode, layer: number, M: number): void {
    const connections = node.connections.get(layer)!;
    if (connections.size <= M) return;

    // Calculate distances and keep M nearest
    const withDistances: Array<{ id: string; distance: number }> = [];
    for (const neighborId of connections) {
      const neighbor = this.nodes.get(neighborId);
      if (neighbor) {
        withDistances.push({
          id: neighborId,
          distance: this.distance(node.vector, neighbor.vector),
        });
      }
    }

    withDistances.sort((a, b) => a.distance - b.distance);
    const toKeep = new Set(withDistances.slice(0, M).map((x) => x.id));

    // Remove excess connections
    for (const id of connections) {
      if (!toKeep.has(id)) {
        connections.delete(id);
        // Also remove reverse connection
        const neighbor = this.nodes.get(id);
        if (neighbor && neighbor.connections.has(layer)) {
          neighbor.connections.get(layer)!.delete(node.id);
        }
      }
    }
  }

  /**
   * Get random level for new node
   */
  private getRandomLevel(): number {
    const r = Math.random();
    return Math.floor(-Math.log(r) * this.levelMultiplier);
  }

  /**
   * Calculate Euclidean distance between two vectors
   */
  private distance(a: Float32Array, b: Float32Array): number {
    let sum = 0;
    const len = Math.min(a.length, b.length);
    for (let i = 0; i < len; i++) {
      const diff = a[i] - b[i];
      sum += diff * diff;
    }
    return Math.sqrt(sum);
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  cosineSimilarity(a: Float32Array, b: Float32Array): number {
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
   * Search using cosine similarity (for normalized vectors)
   */
  searchByCosine(query: Float32Array, k: number): SimilarityResult[] {
    if (this.nodes.size === 0) return [];

    // For small indices, use brute force with cosine
    if (this.nodes.size <= 1000) {
      return this.bruteForceSearch(query, k);
    }

    // For larger indices, use HNSW with Euclidean distance
    // (works well for normalized vectors)
    return this.search(query, k);
  }

  /**
   * Brute force search (for small indices or exact search)
   */
  bruteForceSearch(query: Float32Array, k: number): SimilarityResult[] {
    const results: Array<{ trackId: string; score: number; distance: number }> = [];

    for (const [id, node] of this.nodes) {
      const similarity = this.cosineSimilarity(query, node.vector);
      results.push({
        trackId: id,
        score: similarity,
        distance: 1 - similarity,
      });
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, k);
  }

  /**
   * Get index size
   */
  size(): number {
    return this.nodes.size;
  }

  /**
   * Check if index contains a vector
   */
  has(id: string): boolean {
    return this.nodes.has(id);
  }

  /**
   * Get a vector by id
   */
  get(id: string): Float32Array | undefined {
    return this.nodes.get(id)?.vector;
  }

  /**
   * Clear the index
   */
  clear(): void {
    this.nodes.clear();
    this.entryPoint = null;
    this.maxLayer = 0;
  }

  /**
   * Build index from embeddings
   */
  buildFromEmbeddings(embeddings: Map<string, TrackEmbedding>): void {
    this.clear();
    for (const [id, embedding] of embeddings) {
      this.add(id, embedding.vector);
    }
  }

  /**
   * Export index for persistence
   */
  export(): {
    nodes: Array<{ id: string; vector: number[]; layer: number }>;
    entryPoint: string | null;
    maxLayer: number;
  } {
    const nodes: Array<{ id: string; vector: number[]; layer: number }> = [];

    for (const [id, node] of this.nodes) {
      nodes.push({
        id,
        vector: Array.from(node.vector),
        layer: node.layer,
      });
    }

    return {
      nodes,
      entryPoint: this.entryPoint,
      maxLayer: this.maxLayer,
    };
  }

  /**
   * Import index from persistence (rebuilds connections)
   */
  import(data: {
    nodes: Array<{ id: string; vector: number[]; layer: number }>;
    entryPoint: string | null;
    maxLayer: number;
  }): void {
    this.clear();

    // Add all nodes
    for (const nodeData of data.nodes) {
      this.add(nodeData.id, new Float32Array(nodeData.vector));
    }
  }

  /**
   * Get statistics about the index
   */
  getStats(): {
    size: number;
    maxLayer: number;
    avgConnections: number;
    dimensions: number;
  } {
    let totalConnections = 0;
    for (const node of this.nodes.values()) {
      for (const connections of node.connections.values()) {
        totalConnections += connections.size;
      }
    }

    return {
      size: this.nodes.size,
      maxLayer: this.maxLayer,
      avgConnections: this.nodes.size > 0 ? totalConnections / this.nodes.size : 0,
      dimensions: this.config.dimensions,
    };
  }
}

// Singleton instance
let indexInstance: VectorIndex | null = null;

export function getVectorIndex(config?: Partial<VectorIndexConfig>): VectorIndex {
  if (!indexInstance) {
    indexInstance = new VectorIndex(config);
  }
  return indexInstance;
}

export function resetVectorIndex(): void {
  indexInstance = null;
}
