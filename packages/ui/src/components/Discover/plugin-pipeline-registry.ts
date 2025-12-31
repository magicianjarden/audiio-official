/**
 * Plugin Pipeline Registry
 * Manages registration and execution of pipeline hooks
 */

import type { UnifiedTrack } from '@audiio/core';
import type {
  ResultTransformer,
  DataProvider,
  QueryEnhancer,
  SeeAllContext,
  PipelineResult,
  PipelineConfig,
  PipelineRegistrationOptions,
  StructuredSectionQuery,
} from './plugin-pipeline';
import { DEFAULT_PIPELINE_CONFIG } from './plugin-pipeline';

type StateListener = () => void;

/**
 * Central registry for pipeline hooks
 * Singleton pattern for global access
 */
class PluginPipelineRegistryClass {
  private transformers = new Map<string, ResultTransformer>();
  private providers = new Map<string, DataProvider>();
  private enhancers = new Map<string, QueryEnhancer>();
  private disabledTransformers = new Set<string>();
  private listeners = new Set<StateListener>();
  private config: PipelineConfig = DEFAULT_PIPELINE_CONFIG;

  // ============================================
  // Configuration
  // ============================================

  /**
   * Update pipeline configuration
   */
  setConfig(config: Partial<PipelineConfig>): void {
    this.config = { ...this.config, ...config };
    this.notifyListeners();
  }

  /**
   * Get current configuration
   */
  getConfig(): PipelineConfig {
    return { ...this.config };
  }

  // ============================================
  // Transformer Registration
  // ============================================

  /**
   * Register a result transformer
   */
  registerTransformer(
    transformer: ResultTransformer,
    options?: PipelineRegistrationOptions
  ): void {
    if (this.transformers.has(transformer.id) && !options?.replace) {
      console.warn(
        `[PipelineRegistry] Transformer "${transformer.id}" already exists. Use replace: true to override.`
      );
      return;
    }

    this.transformers.set(transformer.id, transformer);

    // Apply default enabled state
    if (!transformer.enabledByDefault) {
      this.disabledTransformers.add(transformer.id);
    }

    console.log(`[PipelineRegistry] Registered transformer: ${transformer.name}`);
    this.notifyListeners();
  }

  /**
   * Unregister a transformer
   */
  unregisterTransformer(id: string): boolean {
    const removed = this.transformers.delete(id);
    this.disabledTransformers.delete(id);
    if (removed) {
      this.notifyListeners();
    }
    return removed;
  }

  /**
   * Enable/disable a transformer
   */
  setTransformerEnabled(id: string, enabled: boolean): void {
    if (!this.transformers.has(id)) return;

    if (enabled) {
      this.disabledTransformers.delete(id);
    } else {
      this.disabledTransformers.add(id);
    }
    this.notifyListeners();
  }

  /**
   * Check if a transformer is enabled
   */
  isTransformerEnabled(id: string): boolean {
    return this.transformers.has(id) && !this.disabledTransformers.has(id);
  }

  /**
   * Get all registered transformers
   */
  getTransformers(): ResultTransformer[] {
    return Array.from(this.transformers.values());
  }

  /**
   * Get enabled transformers sorted by priority (highest first)
   */
  getEnabledTransformers(): ResultTransformer[] {
    return Array.from(this.transformers.values())
      .filter((t) => !this.disabledTransformers.has(t.id))
      .sort((a, b) => b.priority - a.priority);
  }

  // ============================================
  // Data Provider Registration
  // ============================================

  /**
   * Register a data provider
   */
  registerProvider(
    provider: DataProvider,
    options?: PipelineRegistrationOptions
  ): void {
    if (this.providers.has(provider.id) && !options?.replace) {
      console.warn(
        `[PipelineRegistry] Provider "${provider.id}" already exists. Use replace: true to override.`
      );
      return;
    }

    this.providers.set(provider.id, provider);
    console.log(`[PipelineRegistry] Registered provider: ${provider.name}`);
    this.notifyListeners();
  }

  /**
   * Unregister a provider
   */
  unregisterProvider(id: string): boolean {
    const removed = this.providers.delete(id);
    if (removed) {
      this.notifyListeners();
    }
    return removed;
  }

  /**
   * Get all registered providers
   */
  getProviders(): DataProvider[] {
    return Array.from(this.providers.values());
  }

  /**
   * Get providers sorted by priority (highest first)
   */
  getProvidersByPriority(): DataProvider[] {
    return Array.from(this.providers.values()).sort(
      (a, b) => b.priority - a.priority
    );
  }

  // ============================================
  // Query Enhancer Registration
  // ============================================

  /**
   * Register a query enhancer
   */
  registerEnhancer(
    enhancer: QueryEnhancer,
    options?: PipelineRegistrationOptions
  ): void {
    if (this.enhancers.has(enhancer.id) && !options?.replace) {
      console.warn(
        `[PipelineRegistry] Enhancer "${enhancer.id}" already exists. Use replace: true to override.`
      );
      return;
    }

    this.enhancers.set(enhancer.id, enhancer);
    console.log(`[PipelineRegistry] Registered enhancer: ${enhancer.name}`);
    this.notifyListeners();
  }

  /**
   * Unregister an enhancer
   */
  unregisterEnhancer(id: string): boolean {
    const removed = this.enhancers.delete(id);
    if (removed) {
      this.notifyListeners();
    }
    return removed;
  }

  /**
   * Get all registered enhancers
   */
  getEnhancers(): QueryEnhancer[] {
    return Array.from(this.enhancers.values());
  }

  /**
   * Get enhancers sorted by priority (highest first)
   */
  getEnhancersByPriority(): QueryEnhancer[] {
    return Array.from(this.enhancers.values()).sort(
      (a, b) => b.priority - a.priority
    );
  }

  // ============================================
  // Plugin Cleanup
  // ============================================

  /**
   * Remove all hooks registered by a plugin
   */
  unregisterPlugin(pluginId: string): void {
    let removed = 0;

    // Remove transformers
    for (const [id, transformer] of this.transformers) {
      if (transformer.pluginId === pluginId) {
        this.transformers.delete(id);
        this.disabledTransformers.delete(id);
        removed++;
      }
    }

    // Remove providers
    for (const [id, provider] of this.providers) {
      if (provider.pluginId === pluginId) {
        this.providers.delete(id);
        removed++;
      }
    }

    // Remove enhancers
    for (const [id, enhancer] of this.enhancers) {
      if (enhancer.pluginId === pluginId) {
        this.enhancers.delete(id);
        removed++;
      }
    }

    if (removed > 0) {
      console.log(
        `[PipelineRegistry] Unregistered ${removed} hooks from plugin: ${pluginId}`
      );
      this.notifyListeners();
    }
  }

  // ============================================
  // Pipeline Execution
  // ============================================

  /**
   * Enhance a query using all applicable enhancers
   */
  enhanceQuery(
    query: StructuredSectionQuery,
    context: Omit<SeeAllContext, 'currentResults'>
  ): { query: StructuredSectionQuery; appliedEnhancers: string[] } {
    const appliedEnhancers: string[] = [];
    let enhancedQuery = query;

    for (const enhancer of this.getEnhancersByPriority()) {
      try {
        if (enhancer.canEnhance(enhancedQuery)) {
          enhancedQuery = enhancer.enhance(enhancedQuery, context);
          appliedEnhancers.push(enhancer.id);
        }
      } catch (error) {
        console.error(
          `[PipelineRegistry] Enhancer "${enhancer.id}" failed:`,
          error
        );
        if (!this.config.continueOnError) {
          throw error;
        }
      }
    }

    return { query: enhancedQuery, appliedEnhancers };
  }

  /**
   * Run all applicable data providers
   */
  async runProviders(context: SeeAllContext): Promise<{
    tracks: UnifiedTrack[];
    contributingProviders: string[];
  }> {
    const contributingProviders: string[] = [];
    const allTracks: UnifiedTrack[] = [];

    const providers = this.getProvidersByPriority().filter((p) =>
      p.canProvide(context.query)
    );

    if (providers.length === 0) {
      return { tracks: [], contributingProviders: [] };
    }

    // Run providers with timeout
    const providerPromises = providers.map(async (provider) => {
      try {
        const timeoutPromise = new Promise<UnifiedTrack[]>((_, reject) => {
          setTimeout(
            () => reject(new Error('Provider timeout')),
            this.config.providerTimeout
          );
        });

        const tracks = await Promise.race([
          provider.provide(context),
          timeoutPromise,
        ]);

        return { providerId: provider.id, tracks };
      } catch (error) {
        console.error(
          `[PipelineRegistry] Provider "${provider.id}" failed:`,
          error
        );
        return { providerId: provider.id, tracks: [] };
      }
    });

    const results = await Promise.all(providerPromises);

    for (const result of results) {
      if (result.tracks.length > 0) {
        allTracks.push(...result.tracks);
        contributingProviders.push(result.providerId);
      }
    }

    // Limit and deduplicate results
    const seenIds = new Set<string>();
    const uniqueTracks: UnifiedTrack[] = [];

    for (const track of allTracks) {
      if (!seenIds.has(track.id) && uniqueTracks.length < this.config.maxProviderResults) {
        seenIds.add(track.id);
        uniqueTracks.push(track);
      }
    }

    return { tracks: uniqueTracks, contributingProviders };
  }

  /**
   * Run all applicable transformers on results
   */
  async runTransformers(
    results: UnifiedTrack[],
    context: SeeAllContext
  ): Promise<{ tracks: UnifiedTrack[]; appliedTransformers: string[] }> {
    const appliedTransformers: string[] = [];
    let transformedResults = results;

    const transformers = this.getEnabledTransformers().filter((t) =>
      t.canTransform(context.query)
    );

    for (const transformer of transformers) {
      try {
        const timeoutPromise = new Promise<UnifiedTrack[]>((_, reject) => {
          setTimeout(
            () => reject(new Error('Transformer timeout')),
            this.config.transformerTimeout
          );
        });

        transformedResults = await Promise.race([
          transformer.transform(transformedResults, {
            ...context,
            currentResults: transformedResults,
          }),
          timeoutPromise,
        ]);

        appliedTransformers.push(transformer.id);
      } catch (error) {
        console.error(
          `[PipelineRegistry] Transformer "${transformer.id}" failed:`,
          error
        );
        if (!this.config.continueOnError) {
          throw error;
        }
        // Continue with previous results on error
      }
    }

    return { tracks: transformedResults, appliedTransformers };
  }

  /**
   * Execute full pipeline: enhance query, run providers, merge, transform
   */
  async executePipeline(
    baseResults: UnifiedTrack[],
    query: StructuredSectionQuery,
    context: Omit<SeeAllContext, 'currentResults' | 'query'>
  ): Promise<PipelineResult> {
    const startTime = performance.now();

    // 1. Enhance query
    const { query: enhancedQuery, appliedEnhancers } = this.enhanceQuery(query, {
      ...context,
      query,
    });

    // 2. Run providers
    const { tracks: providerTracks, contributingProviders } =
      await this.runProviders({
        ...context,
        query: enhancedQuery,
        currentResults: baseResults,
      });

    // 3. Merge base results with provider results
    const mergedResults = this.mergeResults(baseResults, providerTracks);

    // 4. Run transformers
    const { tracks: finalTracks, appliedTransformers } =
      await this.runTransformers(mergedResults, {
        ...context,
        query: enhancedQuery,
        currentResults: mergedResults,
      });

    const executionTime = performance.now() - startTime;

    return {
      tracks: finalTracks,
      appliedTransformers,
      contributingProviders,
      appliedEnhancers,
      executionTime,
    };
  }

  /**
   * Merge base results with provider results, deduplicating by ID
   */
  private mergeResults(
    baseResults: UnifiedTrack[],
    providerResults: UnifiedTrack[]
  ): UnifiedTrack[] {
    const seenIds = new Set(baseResults.map((t) => t.id));
    const merged = [...baseResults];

    for (const track of providerResults) {
      if (!seenIds.has(track.id)) {
        seenIds.add(track.id);
        merged.push(track);
      }
    }

    return merged;
  }

  // ============================================
  // Observer Pattern
  // ============================================

  /**
   * Subscribe to registry changes
   */
  subscribe(listener: StateListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(): void {
    this.listeners.forEach((listener) => {
      try {
        listener();
      } catch (error) {
        console.error('[PipelineRegistry] Listener error:', error);
      }
    });
  }

  // ============================================
  // Debugging
  // ============================================

  /**
   * Get registry stats for debugging
   */
  getStats(): {
    transformers: number;
    enabledTransformers: number;
    providers: number;
    enhancers: number;
  } {
    return {
      transformers: this.transformers.size,
      enabledTransformers:
        this.transformers.size - this.disabledTransformers.size,
      providers: this.providers.size,
      enhancers: this.enhancers.size,
    };
  }
}

// Singleton instance
export const pluginPipelineRegistry = new PluginPipelineRegistryClass();

// Type export for external use
export type { PluginPipelineRegistryClass };
