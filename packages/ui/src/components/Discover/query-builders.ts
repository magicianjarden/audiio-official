/**
 * Query Builder Utilities
 * Helper functions to construct StructuredSectionQuery objects
 */

import type {
  StructuredSectionQuery,
  EmbeddingContext,
  SearchContext,
} from './types';

/**
 * Build a mood-based embedding query
 */
export function buildMoodQuery(
  mood: string,
  title: string,
  options?: Partial<Omit<EmbeddingContext, 'method' | 'mood'>> & {
    subtitle?: string;
    sectionType?: string;
    limit?: number;
  }
): StructuredSectionQuery {
  return {
    strategy: 'embedding',
    embedding: {
      method: 'mood',
      mood,
      exploration: options?.exploration ?? 0.3,
      includeCollaborative: options?.includeCollaborative ?? true,
      contextHour: options?.contextHour,
      contextDayOfWeek: options?.contextDayOfWeek,
      energy: options?.energy,
      excludeTrackIds: options?.excludeTrackIds,
      excludeArtistIds: options?.excludeArtistIds,
    },
    title,
    subtitle: options?.subtitle,
    sectionType: options?.sectionType ?? 'mood',
    limit: options?.limit ?? 50,
  };
}

/**
 * Build a genre-based embedding query
 */
export function buildGenreQuery(
  genre: string,
  title: string,
  options?: Partial<Omit<EmbeddingContext, 'method' | 'genre'>> & {
    subtitle?: string;
    sectionType?: string;
    limit?: number;
  }
): StructuredSectionQuery {
  return {
    strategy: 'embedding',
    embedding: {
      method: 'genre',
      genre,
      exploration: options?.exploration ?? 0.4,
      includeCollaborative: options?.includeCollaborative ?? true,
      contextHour: options?.contextHour,
      contextDayOfWeek: options?.contextDayOfWeek,
      excludeTrackIds: options?.excludeTrackIds,
      excludeArtistIds: options?.excludeArtistIds,
    },
    title,
    subtitle: options?.subtitle,
    sectionType: options?.sectionType ?? 'genre',
    limit: options?.limit ?? 50,
  };
}

/**
 * Build an artist radio embedding query
 */
export function buildArtistRadioQuery(
  artistId: string,
  artistName: string,
  title: string,
  options?: Partial<Omit<EmbeddingContext, 'method' | 'seedArtistId' | 'artistName'>> & {
    subtitle?: string;
    sectionType?: string;
    limit?: number;
  }
): StructuredSectionQuery {
  return {
    strategy: 'embedding',
    embedding: {
      method: 'artist-radio',
      seedArtistId: artistId,
      artistName,
      exploration: options?.exploration ?? 0.3,
      includeCollaborative: options?.includeCollaborative ?? true,
      contextHour: options?.contextHour,
      contextDayOfWeek: options?.contextDayOfWeek,
      excludeTrackIds: options?.excludeTrackIds,
      excludeArtistIds: options?.excludeArtistIds,
    },
    title,
    subtitle: options?.subtitle ?? `Tracks similar to ${artistName}`,
    sectionType: options?.sectionType ?? 'artist-radio',
    limit: options?.limit ?? 50,
  };
}

/**
 * Build a seed-based embedding query (similar tracks)
 */
export function buildSeedQuery(
  seedTrackIds: string[],
  title: string,
  options?: Partial<Omit<EmbeddingContext, 'method' | 'seedTrackIds'>> & {
    subtitle?: string;
    sectionType?: string;
    limit?: number;
  }
): StructuredSectionQuery {
  return {
    strategy: 'embedding',
    embedding: {
      method: 'seed',
      seedTrackIds,
      exploration: options?.exploration ?? 0.3,
      includeCollaborative: options?.includeCollaborative ?? true,
      contextHour: options?.contextHour,
      contextDayOfWeek: options?.contextDayOfWeek,
      excludeTrackIds: options?.excludeTrackIds,
      excludeArtistIds: options?.excludeArtistIds,
    },
    title,
    subtitle: options?.subtitle ?? 'Similar tracks',
    sectionType: options?.sectionType ?? 'seed',
    limit: options?.limit ?? 50,
  };
}

/**
 * Build a similar tracks query (single seed track)
 */
export function buildSimilarTracksQuery(
  seedTrackId: string,
  seedTrackTitle: string,
  title: string,
  options?: Partial<Omit<EmbeddingContext, 'method' | 'seedTrackIds'>> & {
    subtitle?: string;
    sectionType?: string;
    limit?: number;
  }
): StructuredSectionQuery {
  return {
    strategy: 'embedding',
    embedding: {
      method: 'similar',
      seedTrackIds: [seedTrackId],
      exploration: options?.exploration ?? 0.2,
      includeCollaborative: options?.includeCollaborative ?? true,
      excludeTrackIds: [seedTrackId, ...(options?.excludeTrackIds ?? [])],
      excludeArtistIds: options?.excludeArtistIds,
    },
    title,
    subtitle: options?.subtitle ?? `Similar to "${seedTrackTitle}"`,
    sectionType: options?.sectionType ?? 'similar-tracks',
    limit: options?.limit ?? 50,
  };
}

/**
 * Build a discovery embedding query (high exploration)
 */
export function buildDiscoveryQuery(
  title: string,
  options?: Partial<Omit<EmbeddingContext, 'method'>> & {
    subtitle?: string;
    sectionType?: string;
    limit?: number;
  }
): StructuredSectionQuery {
  return {
    strategy: 'embedding',
    embedding: {
      method: 'discovery',
      exploration: options?.exploration ?? 0.8,
      includeCollaborative: options?.includeCollaborative ?? true,
      contextHour: options?.contextHour,
      contextDayOfWeek: options?.contextDayOfWeek,
      excludeTrackIds: options?.excludeTrackIds,
      excludeArtistIds: options?.excludeArtistIds,
    },
    title,
    subtitle: options?.subtitle ?? 'Expand your horizons',
    sectionType: options?.sectionType ?? 'discovery',
    limit: options?.limit ?? 50,
  };
}

/**
 * Build a personalized embedding query
 */
export function buildPersonalizedQuery(
  title: string,
  options?: Partial<Omit<EmbeddingContext, 'method'>> & {
    subtitle?: string;
    sectionType?: string;
    limit?: number;
  }
): StructuredSectionQuery {
  return {
    strategy: 'embedding',
    embedding: {
      method: 'personalized',
      exploration: options?.exploration ?? 0.2,
      includeCollaborative: options?.includeCollaborative ?? true,
      contextHour: options?.contextHour,
      contextDayOfWeek: options?.contextDayOfWeek,
      excludeTrackIds: options?.excludeTrackIds,
      excludeArtistIds: options?.excludeArtistIds,
    },
    title,
    subtitle: options?.subtitle ?? 'Based on your taste',
    sectionType: options?.sectionType ?? 'personalized',
    limit: options?.limit ?? 50,
  };
}

/**
 * Build a text search query
 */
export function buildSearchQuery(
  query: string,
  title: string,
  options?: {
    subtitle?: string;
    sectionType?: string;
    filters?: SearchContext['filters'];
    limit?: number;
  }
): StructuredSectionQuery {
  return {
    strategy: 'search',
    search: {
      query,
      filters: options?.filters,
    },
    title,
    subtitle: options?.subtitle,
    sectionType: options?.sectionType ?? 'search',
    limit: options?.limit ?? 50,
  };
}

/**
 * Build a hybrid query (embedding + search fallback)
 */
export function buildHybridQuery(
  embedding: EmbeddingContext,
  search: SearchContext,
  title: string,
  options?: {
    subtitle?: string;
    sectionType?: string;
    limit?: number;
  }
): StructuredSectionQuery {
  return {
    strategy: 'hybrid',
    embedding,
    search,
    title,
    subtitle: options?.subtitle,
    sectionType: options?.sectionType ?? 'hybrid',
    limit: options?.limit ?? 50,
  };
}

/**
 * Convert a legacy text query to a structured query
 * Used for backward compatibility with sections that haven't been migrated
 */
export function fromLegacyQuery(
  query: string,
  title: string,
  sectionType: string,
  subtitle?: string
): StructuredSectionQuery {
  return {
    strategy: 'search',
    search: { query },
    title,
    subtitle,
    sectionType,
    limit: 50,
  };
}

/**
 * Create a structured query for decade-based discovery
 */
export function buildDecadeQuery(
  decade: string,
  title: string,
  options?: {
    subtitle?: string;
    sectionType?: string;
    limit?: number;
  }
): StructuredSectionQuery {
  const startYear = parseInt(decade.replace('s', ''));
  return {
    strategy: 'search',
    search: {
      query: `${decade} hits classics`,
      filters: {
        yearRange: [startYear, startYear + 9],
      },
    },
    title,
    subtitle: options?.subtitle ?? `Hits from the ${decade}`,
    sectionType: options?.sectionType ?? 'decade-mix',
    limit: options?.limit ?? 50,
  };
}

/**
 * Create a structured query for seasonal content
 */
export function buildSeasonalQuery(
  season: 'spring' | 'summer' | 'fall' | 'winter',
  title: string,
  options?: Partial<Omit<EmbeddingContext, 'method' | 'mood'>> & {
    subtitle?: string;
    sectionType?: string;
    limit?: number;
  }
): StructuredSectionQuery {
  // Map seasons to moods
  const seasonMoods = {
    spring: 'uplifting',
    summer: 'energetic',
    fall: 'chill',
    winter: 'chill',
  } as const;

  const mood = seasonMoods[season];

  return buildMoodQuery(mood, title, {
    ...options,
    sectionType: options?.sectionType ?? 'seasonal',
    subtitle: options?.subtitle ?? `${season.charAt(0).toUpperCase() + season.slice(1)} vibes`,
  });
}
