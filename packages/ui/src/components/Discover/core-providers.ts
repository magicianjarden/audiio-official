/**
 * Core Data Providers - Built-in providers that wrap IPC calls
 *
 * These providers route through the existing API layer to get data from plugins
 * (Deezer, YouTube Music, etc.) without hardcoding any specific plugin.
 */

import type { UnifiedTrack } from '@audiio/core';
import type { DataProvider, SeeAllContext } from './plugin-pipeline';
import type { StructuredSectionQuery } from './types';
import { pluginPipelineRegistry } from './plugin-pipeline-registry';
import {
  isEmbeddingReady,
  getIndexedTrackCount,
  generateEmbeddingPlaylist,
  getAllIndexedTracks,
  indexTracksStandalone,
} from '../../hooks/useEmbeddingPlaylist';

const CORE_PLUGIN_ID = 'core';

// Simple request cache to prevent duplicate API calls
interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const requestCache = new Map<string, CacheEntry<unknown>>();
const CACHE_TTL = 30000; // 30 seconds cache

function getCached<T>(key: string): T | null {
  const entry = requestCache.get(key);
  if (entry && Date.now() - entry.timestamp < CACHE_TTL) {
    return entry.data as T;
  }
  requestCache.delete(key);
  return null;
}

function setCache<T>(key: string, data: T): void {
  requestCache.set(key, { data, timestamp: Date.now() });
}

// Deduplication for in-flight requests
const inFlightRequests = new Map<string, Promise<unknown>>();

async function dedupedRequest<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  // Check cache first
  const cached = getCached<T>(key);
  if (cached) {
    console.log(`[CoreProviders] Cache hit for: ${key}`);
    return cached;
  }

  // Check if request is already in flight
  const existing = inFlightRequests.get(key);
  if (existing) {
    console.log(`[CoreProviders] Deduped request for: ${key}`);
    return existing as Promise<T>;
  }

  // Make new request
  const promise = fetcher().then((result) => {
    setCache(key, result);
    inFlightRequests.delete(key);
    return result;
  }).catch((error) => {
    inFlightRequests.delete(key);
    throw error;
  });

  inFlightRequests.set(key, promise);
  return promise;
}

/**
 * Trending/Charts Provider
 * Routes to: metadataOrchestrator.getCharts() → Deezer (or other metadata providers)
 */
export const trendingProvider: DataProvider = {
  id: `${CORE_PLUGIN_ID}:trending`,
  pluginId: CORE_PLUGIN_ID,
  priority: 100, // High priority - primary source for trending
  name: 'Trending Provider',
  description: 'Fetches trending/chart tracks from metadata providers',

  canProvide(query: StructuredSectionQuery): boolean {
    // ONLY provide for explicitly trending/chart sections
    // DO NOT catch all 'plugin' strategy - that was causing all sections to get trending data
    const trendingSections = [
      'trending-tracks',
      'trending',
      'charts',
      'chart-list',
      'top-charts',
      'popular',
    ];
    return trendingSections.includes(query.sectionType);
  },

  async provide(context: SeeAllContext): Promise<UnifiedTrack[]> {
    try {
      if (!window.api?.getTrending) {
        console.warn('[TrendingProvider] getTrending API not available');
        return [];
      }

      // Use cached/deduped request
      const trending = await dedupedRequest('trending', async () => {
        console.log('[TrendingProvider] Calling getTrending...');
        const result = await window.api.getTrending();
        console.log('[TrendingProvider] Response:', JSON.stringify({
          hasTracks: !!result?.tracks,
          tracksLength: Array.isArray(result?.tracks) ? result.tracks.length : 0,
          isArray: Array.isArray(result?.tracks),
          error: result?.error,
          keys: result ? Object.keys(result) : []
        }));
        return result;
      });

      // Ensure tracks is an array
      const tracksArray = Array.isArray(trending?.tracks) ? trending.tracks : [];

      if (tracksArray.length === 0) {
        console.log('[TrendingProvider] No trending tracks returned');
        return [];
      }

      console.log(`[TrendingProvider] Got ${tracksArray.length} trending tracks`);

      // Convert MetadataTrack to UnifiedTrack format
      const tracks: UnifiedTrack[] = tracksArray.map((track: any) => ({
        ...track,
        id: track.id?.startsWith?.('deezer:') ? track.id : `deezer:${track.id}`,
        streamSources: track.streamSources || [],
        _meta: {
          metadataProvider: track._provider || 'trending',
          matchConfidence: 1,
          externalIds: track.externalIds || {},
          lastUpdated: new Date().toISOString(),
        },
      }));

      return tracks.slice(0, context.query.limit || 50);
    } catch (error) {
      console.error('[TrendingProvider] Error:', error);
      return [];
    }
  },
};

/**
 * Search Provider
 * Routes to: searchOrchestrator.search() → all search-capable providers
 */
export const searchProvider: DataProvider = {
  id: `${CORE_PLUGIN_ID}:search`,
  pluginId: CORE_PLUGIN_ID,
  priority: 80, // Below trending but still high
  name: 'Search Provider',
  description: 'Searches for tracks using the search orchestrator',

  canProvide(query: StructuredSectionQuery): boolean {
    // Provide when we have a search query
    return !!(query.search?.query || query.strategy === 'search');
  },

  async provide(context: SeeAllContext): Promise<UnifiedTrack[]> {
    const searchQuery = context.query.search?.query;
    if (!searchQuery) {
      return [];
    }

    try {
      if (!window.api?.search) {
        console.warn('[SearchProvider] search API not available');
        return [];
      }

      console.log(`[SearchProvider] Searching for: ${searchQuery}`);
      const results = await window.api.search({
        query: searchQuery,
        type: 'track',
        limit: context.query.limit || 50,
      });

      if (!results?.length) {
        console.log('[SearchProvider] No search results');
        return [];
      }

      console.log(`[SearchProvider] Got ${results.length} search results`);
      return results;
    } catch (error) {
      console.error('[SearchProvider] Error:', error);
      return [];
    }
  },
};

/**
 * Artist Radio Provider
 * Routes to: metadataOrchestrator.getArtistRadio() or getSimilarTracks()
 */
export const artistRadioProvider: DataProvider = {
  id: `${CORE_PLUGIN_ID}:artist-radio`,
  pluginId: CORE_PLUGIN_ID,
  priority: 90,
  name: 'Artist Radio Provider',
  description: 'Fetches artist radio/similar tracks',

  canProvide(query: StructuredSectionQuery): boolean {
    const artistSections = [
      'artist-radio',
      'because-you-like',
      'similar-artists',
    ];
    return (
      artistSections.includes(query.sectionType) ||
      !!(query.embedding?.method === 'artist-radio' && query.embedding?.seedArtistId)
    );
  },

  async provide(context: SeeAllContext): Promise<UnifiedTrack[]> {
    const embedding = context.query.embedding;

    try {
      // Try artist radio first
      if (embedding?.seedArtistId && window.api?.getArtistRadio) {
        console.log(`[ArtistRadioProvider] Getting radio for artist: ${embedding.seedArtistId}`);
        const tracks = await window.api.getArtistRadio({
          artistId: embedding.seedArtistId,
          limit: context.query.limit || 30,
        });
        if (tracks?.length) {
          console.log(`[ArtistRadioProvider] Got ${tracks.length} artist radio tracks`);
          return tracks;
        }
      }

      // Fallback to search by artist name
      if (embedding?.artistName && window.api?.search) {
        console.log(`[ArtistRadioProvider] Searching for artist: ${embedding.artistName}`);
        const results = await window.api.search({
          query: `${embedding.artistName} similar`,
          type: 'track',
          limit: context.query.limit || 30,
        });
        if (results?.length) {
          return results;
        }
      }

      return [];
    } catch (error) {
      console.error('[ArtistRadioProvider] Error:', error);
      return [];
    }
  },
};

/**
 * Similar Tracks Provider
 * Routes to: metadataOrchestrator.getSimilarTracks()
 */
export const similarTracksProvider: DataProvider = {
  id: `${CORE_PLUGIN_ID}:similar-tracks`,
  pluginId: CORE_PLUGIN_ID,
  priority: 85,
  name: 'Similar Tracks Provider',
  description: 'Fetches tracks similar to seed tracks',

  canProvide(query: StructuredSectionQuery): boolean {
    return (
      query.sectionType === 'similar-tracks' ||
      !!(query.embedding?.method === 'similar' && query.embedding?.seedTrackIds?.length)
    );
  },

  async provide(context: SeeAllContext): Promise<UnifiedTrack[]> {
    const seedTrackIds = context.query.embedding?.seedTrackIds;
    if (!seedTrackIds?.length) {
      return [];
    }

    try {
      if (!window.api?.getSimilarTracks) {
        return [];
      }

      console.log(`[SimilarTracksProvider] Getting similar to: ${seedTrackIds[0]}`);
      const tracks = await window.api.getSimilarTracks({
        trackId: seedTrackIds[0],
        limit: context.query.limit || 20,
      });

      if (tracks?.length) {
        console.log(`[SimilarTracksProvider] Got ${tracks.length} similar tracks`);
        return tracks;
      }

      return [];
    } catch (error) {
      console.error('[SimilarTracksProvider] Error:', error);
      return [];
    }
  },
};

/**
 * Genre Provider
 * Uses search with genre terms
 */
export const genreProvider: DataProvider = {
  id: `${CORE_PLUGIN_ID}:genre`,
  pluginId: CORE_PLUGIN_ID,
  priority: 75,
  name: 'Genre Provider',
  description: 'Fetches tracks by genre',

  canProvide(query: StructuredSectionQuery): boolean {
    return (
      query.sectionType === 'genre-explorer' ||
      query.embedding?.method === 'genre' ||
      !!query.embedding?.genre
    );
  },

  async provide(context: SeeAllContext): Promise<UnifiedTrack[]> {
    const genre = context.query.embedding?.genre;
    if (!genre) {
      return [];
    }

    try {
      if (!window.api?.search) {
        return [];
      }

      console.log(`[GenreProvider] Searching for genre: ${genre}`);
      const results = await window.api.search({
        query: `${genre} music best hits`,
        type: 'track',
        limit: context.query.limit || 30,
      });

      return results || [];
    } catch (error) {
      console.error('[GenreProvider] Error:', error);
      return [];
    }
  },
};

/**
 * Mood Provider
 * Uses search with mood-related terms
 */
export const moodProvider: DataProvider = {
  id: `${CORE_PLUGIN_ID}:mood`,
  pluginId: CORE_PLUGIN_ID,
  priority: 70,
  name: 'Mood Provider',
  description: 'Fetches tracks by mood',

  canProvide(query: StructuredSectionQuery): boolean {
    return (
      query.sectionType === 'mood-playlist' ||
      query.embedding?.method === 'mood' ||
      !!query.embedding?.mood
    );
  },

  async provide(context: SeeAllContext): Promise<UnifiedTrack[]> {
    const mood = context.query.embedding?.mood;
    if (!mood) {
      return [];
    }

    // Map moods to search terms
    const moodSearchTerms: Record<string, string> = {
      chill: 'chill relaxing lofi ambient',
      energetic: 'upbeat energetic workout dance',
      happy: 'happy feel good positive',
      sad: 'sad emotional melancholy',
      focus: 'focus concentration instrumental ambient',
      party: 'party dance club hits',
      romantic: 'romantic love songs ballads',
      angry: 'aggressive intense heavy',
    };

    const searchTerms = moodSearchTerms[mood.toLowerCase()] || `${mood} music`;

    try {
      if (!window.api?.search) {
        return [];
      }

      console.log(`[MoodProvider] Searching for mood: ${mood} (${searchTerms})`);
      const results = await window.api.search({
        query: searchTerms,
        type: 'track',
        limit: context.query.limit || 30,
      });

      return results || [];
    } catch (error) {
      console.error('[MoodProvider] Error:', error);
      return [];
    }
  },
};

/**
 * Personalized Provider
 * Uses ML recommendations and user profile for personalized content
 */
export const personalizedProvider: DataProvider = {
  id: `${CORE_PLUGIN_ID}:personalized`,
  pluginId: CORE_PLUGIN_ID,
  priority: 80, // High priority for personalized sections
  name: 'Personalized Provider',
  description: 'Provides personalized recommendations via ML',

  canProvide(query: StructuredSectionQuery): boolean {
    const personalizedSections = [
      'top-mix',
      'weekly-rotation',
      'time-greeting',
      'on-repeat',
      'rediscover',
      'personalized',
      'similar-tracks',
    ];
    return (
      personalizedSections.includes(query.sectionType) ||
      query.embedding?.method === 'personalized'
    );
  },

  async provide(context: SeeAllContext): Promise<UnifiedTrack[]> {
    try {
      // Try ML recommendations first
      if (window.api?.algoGetRecommendations) {
        console.log('[PersonalizedProvider] Getting ML recommendations...');
        const recommendations = await window.api.algoGetRecommendations(
          context.query.limit || 30
        );
        if (recommendations?.length) {
          console.log(`[PersonalizedProvider] Got ${recommendations.length} ML recommendations`);
          return recommendations;
        }
      }

      // Fallback: Use search with personalized terms
      if (window.api?.search) {
        const topGenre = Object.entries(context.userProfile.genrePreferences || {})
          .sort(([, a], [, b]) => b.totalListenTime - a.totalListenTime)
          .map(([genre]) => genre)[0];

        const searchQuery = topGenre
          ? `${topGenre} popular recommended`
          : 'popular recommended music 2024';

        console.log(`[PersonalizedProvider] Fallback search: ${searchQuery}`);
        const results = await window.api.search({
          query: searchQuery,
          type: 'track',
          limit: context.query.limit || 30,
        });
        return results || [];
      }

      return [];
    } catch (error) {
      console.error('[PersonalizedProvider] Error:', error);
      return [];
    }
  },
};

/**
 * Discovery Provider
 * Uses trending + randomization for fresh discovery
 */
export const discoveryProvider: DataProvider = {
  id: `${CORE_PLUGIN_ID}:discovery`,
  pluginId: CORE_PLUGIN_ID,
  priority: 65,
  name: 'Discovery Provider',
  description: 'Provides fresh discovery tracks',

  canProvide(query: StructuredSectionQuery): boolean {
    const discoverySections = [
      'fresh-finds',
      'deep-cuts',
      'blind-picks',
      'discover-weekly',
      'discovery',
      // Additional discovery-style sections
      'decade-mix',
      'seasonal',
      'activity',
      'focus-mode',
      'audio-analysis',
      'streaming-highlights',
      'lyrics-highlight',
    ];
    return (
      discoverySections.includes(query.sectionType) ||
      query.embedding?.method === 'discovery'
    );
  },

  async provide(context: SeeAllContext): Promise<UnifiedTrack[]> {
    try {
      // Get trending as base (reuse cached trending data)
      if (window.api?.getTrending) {
        const trending = await dedupedRequest('trending', async () => {
          return await window.api.getTrending();
        });

        const tracksArray = Array.isArray(trending?.tracks) ? trending.tracks : [];
        if (tracksArray.length > 0) {
          // Shuffle for variety
          const shuffled = [...tracksArray].sort(() => Math.random() - 0.5);

          const tracks: UnifiedTrack[] = shuffled.map((track: any) => ({
            ...track,
            id: track.id?.startsWith?.('deezer:') ? track.id : `deezer:${track.id}`,
            streamSources: track.streamSources || [],
            _meta: {
              metadataProvider: track._provider || 'discovery',
              matchConfidence: 1,
              externalIds: track.externalIds || {},
              lastUpdated: new Date().toISOString(),
            },
          }));

          return tracks.slice(0, context.query.limit || 30);
        }
      }

      // Fallback to search
      if (window.api?.search) {
        const queries = [
          'new music 2025',
          'trending indie',
          'undiscovered artists',
          'fresh releases',
        ];
        const randomQuery = queries[Math.floor(Math.random() * queries.length)];

        const results = await dedupedRequest(`search:${randomQuery}`, async () => {
          return await window.api.search({
            query: randomQuery,
            type: 'track',
            limit: context.query.limit || 30,
          });
        });

        return results || [];
      }

      return [];
    } catch (error) {
      console.error('[DiscoveryProvider] Error:', error);
      return [];
    }
  },
};

/**
 * New Releases Provider
 */
export const newReleasesProvider: DataProvider = {
  id: `${CORE_PLUGIN_ID}:new-releases`,
  pluginId: CORE_PLUGIN_ID,
  priority: 75,
  name: 'New Releases Provider',
  description: 'Fetches new music releases',

  canProvide(query: StructuredSectionQuery): boolean {
    return query.sectionType === 'new-releases';
  },

  async provide(context: SeeAllContext): Promise<UnifiedTrack[]> {
    try {
      if (!window.api?.search) {
        return [];
      }

      // Use genre from context if available
      const genre = context.query.embedding?.genre || '';
      const searchQuery = genre
        ? `new releases ${genre} 2024`
        : 'new releases 2024 latest music';

      console.log(`[NewReleasesProvider] Searching: ${searchQuery}`);
      const results = await window.api.search({
        query: searchQuery,
        type: 'track',
        limit: context.query.limit || 30,
      });

      return results || [];
    } catch (error) {
      console.error('[NewReleasesProvider] Error:', error);
      return [];
    }
  },
};

/**
 * Layout/General Provider
 * Fallback for layout sections (horizontal, grid, hero, etc.) that use search queries
 */
export const layoutProvider: DataProvider = {
  id: `${CORE_PLUGIN_ID}:layout`,
  pluginId: CORE_PLUGIN_ID,
  priority: 50, // Lower priority - acts as fallback
  name: 'Layout Provider',
  description: 'Fallback for layout sections using search',

  canProvide(query: StructuredSectionQuery): boolean {
    const layoutSections = [
      'horizontal',
      'grid',
      'hero',
      'masonry',
      'banner',
      'compact-list',
      'large-cards',
      'quick-picks',
      'artist-spotlight',
      'mood-gradient',
    ];
    // ONLY provide for explicit layout sections - no catch-all fallback
    // Each section type should have its own specific provider
    return layoutSections.includes(query.sectionType);
  },

  async provide(context: SeeAllContext): Promise<UnifiedTrack[]> {
    try {
      // Build search query from context
      let searchQuery = '';

      // Use title/subtitle for context
      if (context.query.title) {
        searchQuery = context.query.title;
      }

      // Add genre/mood hints from embedding
      if (context.query.embedding?.genre) {
        searchQuery += ` ${context.query.embedding.genre}`;
      }
      if (context.query.embedding?.mood) {
        searchQuery += ` ${context.query.embedding.mood}`;
      }

      // Fallback to generic popular music
      if (!searchQuery.trim()) {
        searchQuery = 'popular hits music 2024';
      }

      if (!window.api?.search) {
        console.warn('[LayoutProvider] search API not available');
        return [];
      }

      console.log(`[LayoutProvider] Searching for: ${searchQuery}`);
      const results = await dedupedRequest(`layout:${context.query.sectionType}:${searchQuery}`, async () => {
        return await window.api.search({
          query: searchQuery,
          type: 'track',
          limit: context.query.limit || 30,
        });
      });

      if (results?.length) {
        console.log(`[LayoutProvider] Got ${results.length} results`);
        return results;
      }

      return [];
    } catch (error) {
      console.error('[LayoutProvider] Error:', error);
      return [];
    }
  },
};

// ============================================
// EMBEDDING PROVIDER - Uses local ML for personalized playlists
// ============================================

/**
 * Embedding-based provider that generates playlists from the user's indexed library
 * Uses the ML embedding system for semantic similarity and taste-aware recommendations
 *
 * This is the UNIFIED provider that combines library data with ML personalization.
 * It has HIGH priority so library-based personalized results come first,
 * then API providers can augment with fresh content.
 */
const embeddingProvider: DataProvider = {
  id: `${CORE_PLUGIN_ID}:embedding`,
  pluginId: CORE_PLUGIN_ID,
  priority: 95, // High priority - library-first approach

  canProvide(query: StructuredSectionQuery): boolean {
    // Handle embedding-based sections that need personalization
    const embeddingSections = [
      // Personalized sections
      'quick-picks',
      'time-greeting',
      'on-repeat',
      'top-mix',
      'rediscover',
      'discover-weekly',
      // Mood/energy sections
      'mood-playlist',
      'focus-mode',
      'activity',
      // Discovery sections that benefit from ML
      'deep-cuts',
      'audio-analysis',
      'streaming-highlights',
      'lyrics-highlight',
      // Hero section for personalized hero
      'hero',
      // Artist-based sections
      'artist-radio',
      // Generic section type for useSectionTracks
      'generic',
    ];

    // Check if section type matches
    if (embeddingSections.includes(query.sectionType)) {
      return true;
    }

    // Also handle queries with explicit embedding method
    if (query.embedding?.method === 'personalized' ||
        query.embedding?.method === 'mood' ||
        query.embedding?.method === 'discovery' ||
        query.embedding?.method === 'artist-radio' ||
        query.embedding?.method === 'similar') {
      return true;
    }

    return false;
  },

  async provide(context: SeeAllContext): Promise<UnifiedTrack[]> {
    const { query } = context;

    // Check if embedding system is ready
    if (!isEmbeddingReady()) {
      console.log(`[EmbeddingProvider] Not ready (${getIndexedTrackCount()} tracks indexed)`);
      return []; // Let other providers handle it
    }

    const indexedCount = getIndexedTrackCount();
    console.log(`[EmbeddingProvider] Generating for ${query.sectionType} (${indexedCount} tracks indexed)`);

    try {
      // Determine generation method based on section type
      let method: 'personalized' | 'mood' | 'genre' | 'artist-radio' | 'discovery' | 'similar' = 'personalized';
      let mood: string | undefined;
      let genre: string | undefined;
      let exploration = 0.2;

      switch (query.sectionType) {
        case 'quick-picks':
        case 'on-repeat':
        case 'top-mix':
          method = 'personalized';
          exploration = 0.1; // Low exploration for familiar picks
          break;

        case 'time-greeting':
          method = 'mood';
          // Map time of day to mood
          const hour = context.hour;
          if (hour >= 5 && hour < 12) {
            mood = 'uplifting';
          } else if (hour >= 12 && hour < 17) {
            mood = 'focus';
          } else if (hour >= 17 && hour < 21) {
            mood = 'chill';
          } else {
            mood = 'chill';
          }
          break;

        case 'mood-playlist':
        case 'focus-mode':
          method = 'mood';
          mood = query.embedding?.mood || 'chill';
          break;

        case 'activity':
          method = 'mood';
          mood = 'energetic';
          break;

        case 'discover-weekly':
        case 'deep-cuts':
        case 'rediscover':
          method = 'discovery';
          exploration = 0.6;
          break;

        case 'hero':
        case 'audio-analysis':
        case 'streaming-highlights':
        case 'lyrics-highlight':
          method = 'personalized';
          exploration = 0.3;
          break;

        case 'artist-radio':
          method = 'artist-radio';
          exploration = query.embedding?.exploration || 0.3;
          break;

        default:
          // Use embedding hints if provided
          if (query.embedding?.method === 'mood' && query.embedding.mood) {
            method = 'mood';
            mood = query.embedding.mood;
          } else if (query.embedding?.method === 'genre' && query.embedding.genre) {
            method = 'genre';
            genre = query.embedding.genre;
          } else if (query.embedding?.method === 'discovery') {
            method = 'discovery';
            exploration = query.embedding.exploration || 0.7;
          } else if (query.embedding?.method === 'artist-radio') {
            method = 'artist-radio';
            exploration = query.embedding.exploration || 0.3;
          } else if (query.embedding?.method === 'similar') {
            method = 'similar';
            exploration = query.embedding.exploration || 0.5;
          } else {
            method = 'personalized';
          }
      }

      // Generate playlist
      const tracks = generateEmbeddingPlaylist(method, {
        mood,
        genre,
        artistId: query.embedding?.seedArtistId,
        seedTrackIds: query.embedding?.seedTrackIds,
        limit: query.limit || 20,
        exploration,
      });

      if (tracks.length > 0) {
        console.log(`[EmbeddingProvider] Generated ${tracks.length} tracks via ${method}`);
        return tracks;
      }

      console.log(`[EmbeddingProvider] No tracks generated, falling back`);
      return [];
    } catch (error) {
      console.error('[EmbeddingProvider] Error:', error);
      return [];
    }
  },
};

/**
 * All core providers to register
 * Order matters for priority - higher priority providers are checked first
 */
export const coreProviders: DataProvider[] = [
  trendingProvider,      // 100 - Charts/trending
  embeddingProvider,     // 95  - Library ML personalization (NEW!)
  artistRadioProvider,   // 90  - Artist-based radio
  similarTracksProvider, // 85  - Similar tracks
  searchProvider,        // 80  - Text search
  personalizedProvider,  // 80  - API recommendations
  newReleasesProvider,   // 75  - New releases
  genreProvider,         // 75  - Genre search
  moodProvider,          // 70  - Mood search
  discoveryProvider,     // 65  - Discovery sections
  layoutProvider,        // 50  - Fallback layout
];

// Guard to prevent duplicate registration
let coreProvidersRegistered = false;

/**
 * Register all core providers with the pipeline
 */
export function registerCoreProviders(): void {
  if (coreProvidersRegistered) {
    return; // Already registered
  }

  for (const provider of coreProviders) {
    pluginPipelineRegistry.registerProvider(provider);
  }

  coreProvidersRegistered = true;
  console.log(`[CoreProviders] Registered ${coreProviders.length} core providers`);
}

/**
 * Unregister all core providers
 */
export function unregisterCoreProviders(): void {
  pluginPipelineRegistry.unregisterPlugin(CORE_PLUGIN_ID);
}

export default coreProviders;
