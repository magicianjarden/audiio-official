/**
 * Algorithm Registry - Manages algorithm plugin registration and lifecycle
 */

import type {
  AlgorithmPlugin,
  AlgorithmState,
  AlgorithmHealth,
  MLCoreEndpoints,
} from '../types';

export class AlgorithmRegistry {
  private algorithms = new Map<string, AlgorithmPlugin>();
  private states = new Map<string, AlgorithmState>();
  private activeAlgorithmId: string | null = null;
  private endpoints: MLCoreEndpoints | null = null;

  /**
   * Set the endpoints for algorithm initialization
   */
  setEndpoints(endpoints: MLCoreEndpoints): void {
    this.endpoints = endpoints;
  }

  /**
   * Register an algorithm plugin
   */
  async register(algorithm: AlgorithmPlugin): Promise<void> {
    const { id } = algorithm.manifest;

    if (this.algorithms.has(id)) {
      console.warn(`[AlgorithmRegistry] Algorithm ${id} already registered`);
      return;
    }

    this.algorithms.set(id, algorithm);
    this.states.set(id, {
      id,
      initialized: false,
      active: false,
      settings: {},
      training: {},
      health: {
        status: 'healthy',
        lastCheck: Date.now(),
      },
    });

    console.log(`[AlgorithmRegistry] Registered algorithm: ${algorithm.manifest.name} (${id})`);

    // Auto-initialize if endpoints are available
    if (this.endpoints) {
      await this.initializeAlgorithm(id);
    }
  }

  /**
   * Unregister an algorithm
   */
  async unregister(algorithmId: string): Promise<void> {
    const algorithm = this.algorithms.get(algorithmId);

    if (!algorithm) {
      console.warn(`[AlgorithmRegistry] Algorithm ${algorithmId} not found`);
      return;
    }

    // Dispose if initialized
    const state = this.states.get(algorithmId);
    if (state?.initialized) {
      await algorithm.dispose();
    }

    // If this was the active algorithm, clear it
    if (this.activeAlgorithmId === algorithmId) {
      this.activeAlgorithmId = null;
    }

    this.algorithms.delete(algorithmId);
    this.states.delete(algorithmId);

    console.log(`[AlgorithmRegistry] Unregistered algorithm: ${algorithmId}`);
  }

  /**
   * Initialize an algorithm
   */
  async initializeAlgorithm(algorithmId: string): Promise<void> {
    const algorithm = this.algorithms.get(algorithmId);
    const state = this.states.get(algorithmId);

    if (!algorithm || !state) {
      throw new Error(`Algorithm ${algorithmId} not found`);
    }

    if (state.initialized) {
      console.warn(`[AlgorithmRegistry] Algorithm ${algorithmId} already initialized`);
      return;
    }

    if (!this.endpoints) {
      throw new Error('Endpoints not set. Call setEndpoints first.');
    }

    try {
      await algorithm.initialize(this.endpoints);
      state.initialized = true;
      state.health = {
        status: 'healthy',
        lastCheck: Date.now(),
      };

      console.log(`[AlgorithmRegistry] Initialized algorithm: ${algorithmId}`);
    } catch (error) {
      state.health = {
        status: 'error',
        message: error instanceof Error ? error.message : String(error),
        lastCheck: Date.now(),
      };
      throw error;
    }
  }

  /**
   * Initialize all registered algorithms
   */
  async initializeAll(): Promise<void> {
    const promises: Promise<void>[] = [];

    for (const [id, state] of this.states.entries()) {
      if (!state.initialized) {
        promises.push(
          this.initializeAlgorithm(id).catch(err => {
            console.error(`[AlgorithmRegistry] Failed to initialize ${id}:`, err);
          })
        );
      }
    }

    await Promise.all(promises);
  }

  /**
   * Set the active algorithm
   */
  setActive(algorithmId: string): void {
    const algorithm = this.algorithms.get(algorithmId);
    const state = this.states.get(algorithmId);

    if (!algorithm || !state) {
      throw new Error(`Algorithm ${algorithmId} not found`);
    }

    if (!state.initialized) {
      throw new Error(`Algorithm ${algorithmId} not initialized`);
    }

    // Deactivate current
    if (this.activeAlgorithmId) {
      const currentState = this.states.get(this.activeAlgorithmId);
      if (currentState) currentState.active = false;
    }

    // Activate new
    this.activeAlgorithmId = algorithmId;
    state.active = true;

    console.log(`[AlgorithmRegistry] Active algorithm: ${algorithmId}`);
  }

  /**
   * Get the active algorithm
   */
  getActive(): AlgorithmPlugin | null {
    if (!this.activeAlgorithmId) return null;
    return this.algorithms.get(this.activeAlgorithmId) ?? null;
  }

  /**
   * Get the active algorithm ID
   */
  getActiveId(): string | null {
    return this.activeAlgorithmId;
  }

  /**
   * Get an algorithm by ID
   */
  get(algorithmId: string): AlgorithmPlugin | undefined {
    return this.algorithms.get(algorithmId);
  }

  /**
   * Get all registered algorithms
   */
  getAll(): AlgorithmPlugin[] {
    return Array.from(this.algorithms.values());
  }

  /**
   * Get all algorithm IDs
   */
  getAllIds(): string[] {
    return Array.from(this.algorithms.keys());
  }

  /**
   * Get algorithm state
   */
  getState(algorithmId: string): AlgorithmState | undefined {
    return this.states.get(algorithmId);
  }

  /**
   * Get all algorithm states
   */
  getAllStates(): AlgorithmState[] {
    return Array.from(this.states.values());
  }

  /**
   * Check if an algorithm is registered
   */
  has(algorithmId: string): boolean {
    return this.algorithms.has(algorithmId);
  }

  /**
   * Get algorithm health
   */
  getHealth(algorithmId: string): AlgorithmHealth | undefined {
    return this.states.get(algorithmId)?.health;
  }

  /**
   * Update algorithm health
   */
  updateHealth(algorithmId: string, health: Partial<AlgorithmHealth>): void {
    const state = this.states.get(algorithmId);
    if (state) {
      state.health = {
        ...state.health,
        ...health,
        lastCheck: Date.now(),
      };
    }
  }

  /**
   * Get count of registered algorithms
   */
  get size(): number {
    return this.algorithms.size;
  }

  /**
   * Dispose all algorithms
   */
  async disposeAll(): Promise<void> {
    const promises: Promise<void>[] = [];

    for (const [id, algorithm] of this.algorithms.entries()) {
      const state = this.states.get(id);
      if (state?.initialized) {
        promises.push(
          algorithm.dispose().catch(err => {
            console.error(`[AlgorithmRegistry] Failed to dispose ${id}:`, err);
          })
        );
      }
    }

    await Promise.all(promises);

    this.algorithms.clear();
    this.states.clear();
    this.activeAlgorithmId = null;
  }
}
