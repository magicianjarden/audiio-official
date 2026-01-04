/**
 * Plugin Pipeline Interfaces
 * Defines contracts for plugins to contribute to "See All" results
 */

import type { UnifiedTrack } from '@audiio/core';
import type { StructuredSectionQuery } from './types';
import type { UserProfile } from '../../stores/recommendation-store';

// Re-export types for convenience
export type { StructuredSectionQuery };

/**
 * Context passed to pipeline hooks
 */
export interface SeeAllContext {
  /** The structured query being executed */
  query: StructuredSectionQuery;
  /** User's profile for personalization */
  userProfile: UserProfile;
  /** Current results (for transformers) */
  currentResults: UnifiedTrack[];
  /** Hour of day (0-23) */
  hour: number;
  /** Day of week (0-6, 0=Sunday) */
  dayOfWeek: number;
}

/**
 * Result Transformer - modifies/filters/reorders results
 * Examples: filter by lyrics mood, enforce artist diversity, boost by audio features
 */
export interface ResultTransformer {
  /** Unique identifier (format: "pluginId:transformerId") */
  id: string;
  /** Plugin that registered this transformer */
  pluginId: string;
  /** Execution priority (higher = runs first) */
  priority: number;
  /** Display name */
  name: string;
  /** Description of what this transformer does */
  description: string;
  /** Whether this transformer is enabled by default */
  enabledByDefault: boolean;

  /**
   * Transform the results
   * @param results Current results to transform
   * @param context Pipeline context
   * @returns Transformed results
   */
  transform(results: UnifiedTrack[], context: SeeAllContext): Promise<UnifiedTrack[]>;

  /**
   * Check if this transformer can handle the given query
   * Return false to skip this transformer for incompatible queries
   */
  canTransform(query: StructuredSectionQuery): boolean;
}

/**
 * Data Provider - contributes additional results
 * Examples: fetch from external API, provide cached recommendations
 */
export interface DataProvider {
  /** Unique identifier (format: "pluginId:providerId") */
  id: string;
  /** Plugin that registered this provider */
  pluginId: string;
  /** Execution priority (higher = runs first) */
  priority: number;
  /** Display name */
  name: string;
  /** Description of what this provider offers */
  description: string;

  /**
   * Provide additional results
   * @param context Pipeline context
   * @returns Additional tracks to merge with existing results
   */
  provide(context: SeeAllContext): Promise<UnifiedTrack[]>;

  /**
   * Check if this provider can contribute to the given query
   * Return false to skip this provider for incompatible queries
   */
  canProvide(query: StructuredSectionQuery): boolean;
}

/**
 * Query Enhancer - modifies the query before execution
 * Examples: add audio feature filters, expand genre to related genres
 */
export interface QueryEnhancer {
  /** Unique identifier (format: "pluginId:enhancerId") */
  id: string;
  /** Plugin that registered this enhancer */
  pluginId: string;
  /** Execution priority (higher = runs first) */
  priority: number;
  /** Display name */
  name: string;
  /** Description of what this enhancer does */
  description: string;

  /**
   * Enhance the query before execution
   * @param query Original query
   * @param context Partial context (results not yet available)
   * @returns Enhanced query
   */
  enhance(
    query: StructuredSectionQuery,
    context: Omit<SeeAllContext, 'currentResults'>
  ): StructuredSectionQuery;

  /**
   * Check if this enhancer should process the given query
   */
  canEnhance(query: StructuredSectionQuery): boolean;
}

/**
 * Pipeline execution result with metadata
 */
export interface PipelineResult {
  /** Final transformed tracks */
  tracks: UnifiedTrack[];
  /** Which transformers were applied */
  appliedTransformers: string[];
  /** Which providers contributed */
  contributingProviders: string[];
  /** Which enhancers modified the query */
  appliedEnhancers: string[];
  /** Execution timing in ms */
  executionTime: number;
}

/**
 * Registration options for pipeline hooks
 */
export interface PipelineRegistrationOptions {
  /** Replace existing hook with same ID */
  replace?: boolean;
}

/**
 * Pipeline configuration
 */
export interface PipelineConfig {
  /** Maximum time (ms) to wait for all providers */
  providerTimeout: number;
  /** Maximum time (ms) to wait for each transformer */
  transformerTimeout: number;
  /** Whether to continue if a hook fails */
  continueOnError: boolean;
  /** Maximum results from providers to merge */
  maxProviderResults: number;
}

/**
 * Default pipeline configuration
 */
export const DEFAULT_PIPELINE_CONFIG: PipelineConfig = {
  providerTimeout: 5000,
  transformerTimeout: 2000,
  continueOnError: true,
  maxProviderResults: 50,
};
