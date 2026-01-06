/**
 * Section Registry - Adaptive section selection system for Discover page
 * Modeled after the AddonRegistry pattern from @audiio/core
 */

import type { ComponentType } from 'react';
import type { RecommendationProfile } from '../../stores/recommendation-store';
import type { UnifiedTrack } from '@audiio/core';
import type { StructuredSectionQuery } from './types';

// Section type identifiers
export type SectionType =
  // Primary sections
  | 'hero'
  | 'horizontal'
  | 'large-cards'
  | 'compact-list'
  | 'grid'
  // Algorithmic sections
  | 'trending-tracks'
  | 'trending-artists'
  | 'artist-radio'
  | 'because-you-like'
  | 'new-releases'
  // Variety sections
  | 'chart-list'
  | 'quick-picks'
  // Artist spotlight
  | 'artist-spotlight'
  // Additional variety sections
  | 'mood-gradient'
  | 'genre-explorer'
  | 'weekly-rotation'
  | 'banner'
  | 'masonry'
  // New personalized sections
  | 'time-greeting'
  | 'on-repeat'
  | 'discover-weekly'
  | 'top-mix'
  | 'rediscover'
  | 'activity'
  | 'decade-mix'
  | 'seasonal'
  | 'blind-picks'
  | 'similar-artists'
  | 'mood-playlist'
  // Plugin/ML-powered sections
  | 'lyrics-highlight'
  | 'fresh-finds'
  | 'deep-cuts'
  | 'focus-mode'
  | 'streaming-highlights'
  | 'audio-analysis'
  | 'similar-tracks';

// Context passed to selection algorithm and sections
export interface SelectionContext {
  userProfile: RecommendationProfile;
  likedTracksCount: number;
  topArtists: string[];
  topGenres: string[];
  hour: number;
  dayOfWeek: number;
  hasLyrics: boolean;
  hasPlaylists: boolean;
  playlistCount: number;
  recentSections: SectionType[];
  isNewUser: boolean;
}

// Base props all sections receive
export interface BaseSectionProps {
  id: string;
  type: SectionType;
  title: string;
  subtitle?: string;
  query?: string;
  isPersonalized?: boolean;
  whyExplanation?: string;
  context: SelectionContext;
  onSeeAll?: () => void;
}

// Section data that can be pre-fetched or fetched by section
export interface SectionData {
  tracks?: UnifiedTrack[];
  artists?: Array<{ id: string; name: string; image?: string }>;
  albums?: Array<{ id: string; name: string; artwork?: string; artist: string }>;
  playlists?: Array<{ id: string; name: string; trackCount: number; coverUrls: string[] }>;
  lyrics?: Array<{ trackId: string; line: string; trackTitle: string; artist: string; artwork?: string }>;
  custom?: Record<string, unknown>;
}

// Requirements for section eligibility
export interface SectionRequirements {
  minListens?: number;
  minLikedTracks?: number;
  requiresLyrics?: boolean;
  requiresHistory?: boolean;
  requiresPlaylists?: boolean;
  minTopArtists?: number;
  minTopGenres?: number;
  minPlaylistCount?: number;
  newUserOnly?: boolean;
  returningUserOnly?: boolean;
}

// Display constraints
export interface SectionConstraints {
  maxPerPage?: number;
  cooldownSections?: number;
  incompatibleWith?: SectionType[];
  preferredPosition?: 'top' | 'middle' | 'bottom';
  minSectionsBefore?: number;
}

// Weight configuration for adaptive selection
export interface SectionWeights {
  base: number;
  personalizedBoost: number;
  newUserBoost?: number;
  timeRelevance?: (hour: number) => number;
  dayRelevance?: (day: number) => number;
}

// Full section definition for registry
export interface SectionDefinition {
  type: SectionType;
  component: ComponentType<BaseSectionProps>;
  displayName: string;
  description?: string;
  requirements: SectionRequirements;
  constraints: SectionConstraints;
  weights: SectionWeights;
  generateConfig?: (context: SelectionContext) => Partial<SectionConfig>;
}

// Configuration for a selected section instance
export interface SectionConfig {
  id: string;
  type: SectionType;
  title: string;
  subtitle?: string;
  /** @deprecated Use structuredQuery for ML-aware "See All" */
  query?: string;
  /** Structured query for ML-aware "See All" navigation */
  structuredQuery?: StructuredSectionQuery;
  isPersonalized: boolean;
  whyExplanation?: string;
  priority: number;
}

// Maximum sections to display
const MAX_SECTIONS = 12;
const NEW_USER_THRESHOLD = 5;

/**
 * Section Registry - manages section types and adaptive selection
 */
export class SectionRegistry {
  private sections = new Map<SectionType, SectionDefinition>();
  private disabledSections = new Set<SectionType>();

  /**
   * Register a section definition
   */
  register(definition: SectionDefinition): void {
    if (this.sections.has(definition.type)) {
      console.warn(`[SectionRegistry] Overwriting existing section: ${definition.type}`);
    }
    this.sections.set(definition.type, definition);
  }

  /**
   * Unregister a section type
   */
  unregister(type: SectionType): void {
    this.sections.delete(type);
    this.disabledSections.delete(type);
  }

  /**
   * Enable/disable a section type
   */
  setEnabled(type: SectionType, enabled: boolean): void {
    if (enabled) {
      this.disabledSections.delete(type);
    } else {
      this.disabledSections.add(type);
    }
  }

  /**
   * Get a section definition
   */
  get(type: SectionType): SectionDefinition | undefined {
    if (this.disabledSections.has(type)) return undefined;
    return this.sections.get(type);
  }

  /**
   * Get all registered sections
   */
  getAll(): SectionDefinition[] {
    return Array.from(this.sections.values());
  }

  /**
   * Get all enabled sections
   */
  getEnabled(): SectionDefinition[] {
    return Array.from(this.sections.values()).filter(
      (def) => !this.disabledSections.has(def.type)
    );
  }

  /**
   * Check if a section meets its requirements
   * Note: Requirements are now very permissive - we show all sections by default
   * The sections themselves handle gracefully when data isn't available
   */
  private meetsRequirements(_def: SectionDefinition, _context: SelectionContext): boolean {
    // All sections are shown by default - they handle missing data gracefully
    return true;
  }

  /**
   * Check if a section meets its constraints given already selected sections
   */
  private meetsConstraints(
    def: SectionDefinition,
    selected: SectionConfig[],
    usedTypes: Set<SectionType>
  ): boolean {
    const { constraints } = def;

    // Check max per page
    if (constraints.maxPerPage !== undefined) {
      const count = selected.filter((s) => s.type === def.type).length;
      if (count >= constraints.maxPerPage) return false;
    }

    // Check cooldown (minimum sections between same type)
    if (constraints.cooldownSections !== undefined && selected.length > 0) {
      const lastIndex = selected.length - 1;
      for (let i = lastIndex; i >= Math.max(0, lastIndex - constraints.cooldownSections); i--) {
        if (selected[i]?.type === def.type) return false;
      }
    }

    // Check incompatible sections
    if (constraints.incompatibleWith) {
      for (const incompatible of constraints.incompatibleWith) {
        if (usedTypes.has(incompatible)) return false;
      }
    }

    // Check minimum sections before
    if (constraints.minSectionsBefore !== undefined) {
      if (selected.length < constraints.minSectionsBefore) return false;
    }

    return true;
  }

  /**
   * Calculate weight for a section
   */
  private calculateWeight(def: SectionDefinition, context: SelectionContext): number {
    const { weights } = def;
    let weight = weights.base;

    // Add personalized boost if user has history
    if (!context.isNewUser && weights.personalizedBoost) {
      weight += weights.personalizedBoost;
    }

    // Add new user boost
    if (context.isNewUser && weights.newUserBoost) {
      weight += weights.newUserBoost;
    }

    // Apply time relevance
    if (weights.timeRelevance) {
      weight += weights.timeRelevance(context.hour);
    }

    // Apply day relevance
    if (weights.dayRelevance) {
      weight += weights.dayRelevance(context.dayOfWeek);
    }

    // Reduce weight if recently shown
    if (context.recentSections.includes(def.type)) {
      weight *= 0.5;
    }

    return weight;
  }

  /**
   * Create a section config from definition and context
   */
  private createSectionConfig(
    def: SectionDefinition,
    context: SelectionContext,
    priority: number
  ): SectionConfig {
    // Get custom config from generator if available
    const customConfig = def.generateConfig?.(context) ?? {};

    return {
      id: `${def.type}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      type: def.type,
      title: customConfig.title ?? def.displayName,
      subtitle: customConfig.subtitle,
      query: customConfig.query,
      structuredQuery: customConfig.structuredQuery,
      isPersonalized: !context.isNewUser && (customConfig.isPersonalized ?? false),
      whyExplanation: customConfig.whyExplanation,
      priority,
    };
  }

  /**
   * Get ALL section configs without any limiting - for "show all" mode
   */
  getAllSectionConfigs(context: SelectionContext): SectionConfig[] {
    const enrichedContext: SelectionContext = {
      ...context,
      isNewUser: (context.userProfile?.totalListens ?? 0) < NEW_USER_THRESHOLD,
    };

    const allSections = this.getEnabled();

    // Group by preferred position
    const topSections = allSections.filter(
      (def) => def.constraints.preferredPosition === 'top'
    );
    const bottomSections = allSections.filter(
      (def) => def.constraints.preferredPosition === 'bottom'
    );
    const middleSections = allSections.filter(
      (def) => !def.constraints.preferredPosition || def.constraints.preferredPosition === 'middle'
    );

    // Build configs in order: top, middle, bottom
    const configs: SectionConfig[] = [];
    let priority = 0;

    for (const def of topSections) {
      configs.push(this.createSectionConfig(def, enrichedContext, priority++));
    }
    for (const def of middleSections) {
      configs.push(this.createSectionConfig(def, enrichedContext, priority++));
    }
    for (const def of bottomSections) {
      configs.push(this.createSectionConfig(def, enrichedContext, priority++));
    }

    return configs;
  }

  /**
   * Select sections based on context using adaptive algorithm
   */
  selectSections(context: SelectionContext, maxSections: number = MAX_SECTIONS): SectionConfig[] {
    // Update context with computed values
    const enrichedContext: SelectionContext = {
      ...context,
      isNewUser: (context.userProfile?.totalListens ?? 0) < NEW_USER_THRESHOLD,
    };

    // 1. Filter by requirements
    const eligible = this.getEnabled().filter((def) =>
      this.meetsRequirements(def, enrichedContext)
    );

    // 2. Calculate weights
    const weighted = eligible.map((def) => ({
      def,
      weight: this.calculateWeight(def, enrichedContext),
    }));

    // 3. Sort by weight with randomization for variety
    weighted.sort((a, b) => {
      const randomFactor = (Math.random() - 0.5) * 15;
      return b.weight + randomFactor - (a.weight + randomFactor);
    });

    // 4. Select sections respecting constraints
    const selected: SectionConfig[] = [];
    const usedTypes = new Set<SectionType>();
    let priority = 0;

    // First pass: add sections with preferred positions
    const topPreferred = weighted.filter(
      (w) => w.def.constraints.preferredPosition === 'top'
    );
    const bottomPreferred = weighted.filter(
      (w) => w.def.constraints.preferredPosition === 'bottom'
    );
    const others = weighted.filter(
      (w) => !w.def.constraints.preferredPosition || w.def.constraints.preferredPosition === 'middle'
    );

    // Add top-preferred sections first
    for (const { def } of topPreferred) {
      if (selected.length >= maxSections) break;
      if (!this.meetsConstraints(def, selected, usedTypes)) continue;

      selected.push(this.createSectionConfig(def, enrichedContext, priority++));
      usedTypes.add(def.type);
    }

    // Add middle sections
    for (const { def } of others) {
      if (selected.length >= maxSections - bottomPreferred.length) break;
      if (!this.meetsConstraints(def, selected, usedTypes)) continue;

      selected.push(this.createSectionConfig(def, enrichedContext, priority++));
      usedTypes.add(def.type);
    }

    // Add bottom-preferred sections last
    for (const { def } of bottomPreferred) {
      if (selected.length >= maxSections) break;
      if (!this.meetsConstraints(def, selected, usedTypes)) continue;

      selected.push(this.createSectionConfig(def, enrichedContext, priority++));
      usedTypes.add(def.type);
    }

    return selected;
  }
}

// Singleton instance
export const sectionRegistry = new SectionRegistry();

// Helper to create selection context
export function createSelectionContext(options: {
  userProfile: RecommendationProfile;
  likedTracksCount: number;
  topArtists: string[];
  topGenres: string[];
  hasLyrics: boolean;
  hasPlaylists: boolean;
  playlistCount: number;
  recentSections?: SectionType[];
}): SelectionContext {
  const now = new Date();
  return {
    ...options,
    hour: now.getHours(),
    dayOfWeek: now.getDay(),
    recentSections: options.recentSections ?? [],
    isNewUser: (options.userProfile?.totalListens ?? 0) < NEW_USER_THRESHOLD,
  };
}

export default sectionRegistry;
