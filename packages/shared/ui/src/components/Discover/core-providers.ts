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
 * Uses ML genre radio API for intelligent genre-based recommendations
 */
export const genreProvider: DataProvider = {
  id: `${CORE_PLUGIN_ID}:genre`,
  pluginId: CORE_PLUGIN_ID,
  priority: 75,
  name: 'Genre Provider',
  description: 'Fetches tracks by genre using ML recommendations',

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
      // Use ML genre radio API for real recommendations
      if (window.api?.algoGetGenreRadio) {
        console.log(`[GenreProvider] Using ML genre radio for: ${genre}`);
        const tracks = await window.api.algoGetGenreRadio(genre, context.query.limit || 30);
        if (tracks?.length) {
          console.log(`[GenreProvider] Got ${tracks.length} tracks from ML genre radio`);
          return tracks;
        }
      }

      // Fallback to search only if genre radio not available
      if (window.api?.search) {
        console.log(`[GenreProvider] Falling back to search for: ${genre}`);
        const results = await window.api.search({
          query: genre,
          type: 'track',
          limit: context.query.limit || 30,
        });
        return results || [];
      }

      return [];
    } catch (error) {
      console.error('[GenreProvider] Error:', error);
      return [];
    }
  },
};

/**
 * Mood Provider
 * Handles mood-based sections: mood-playlist, activity, seasonal, focus-mode
 * Uses ML genre radio API for intelligent mood-based recommendations
 */
export const moodProvider: DataProvider = {
  id: `${CORE_PLUGIN_ID}:mood`,
  pluginId: CORE_PLUGIN_ID,
  priority: 70,
  name: 'Mood Provider',
  description: 'Fetches tracks by mood using ML recommendations',

  canProvide(query: StructuredSectionQuery): boolean {
    // Handle all mood-based sections
    const moodSections = [
      'mood-playlist',
      'activity',
      'seasonal',
      'focus-mode',
    ];
    return (
      moodSections.includes(query.sectionType) ||
      query.embedding?.method === 'mood' ||
      !!query.embedding?.mood
    );
  },

  async provide(context: SeeAllContext): Promise<UnifiedTrack[]> {
    const { query } = context;

    // Get mood from embedding or section-specific logic
    const mood = query.embedding?.mood;
    if (!mood) {
      return [];
    }

    try {
      // Use ML genre radio API - moods are treated as genres in the ML system
      if (window.api?.algoGetGenreRadio) {
        console.log(`[MoodProvider] Using ML genre radio for mood: ${mood}`);
        const tracks = await window.api.algoGetGenreRadio(mood, query.limit || 30);
        if (tracks?.length) {
          console.log(`[MoodProvider] Got ${tracks.length} tracks for mood: ${mood}`);
          return tracks;
        }
      }

      // Fallback to search only if genre radio not available
      if (window.api?.search) {
        console.log(`[MoodProvider] Falling back to search for mood: ${mood}`);
        const results = await window.api.search({
          query: mood,
          type: 'track',
          limit: query.limit || 30,
        });
        return results || [];
      }

      return [];
    } catch (error) {
      console.error('[MoodProvider] Error:', error);
      return [];
    }
  },
};

/**
 * Decade Provider
 * Handles decade-mix section with year-based filtering
 */
export const decadeProvider: DataProvider = {
  id: `${CORE_PLUGIN_ID}:decade`,
  pluginId: CORE_PLUGIN_ID,
  priority: 75,
  name: 'Decade Provider',
  description: 'Fetches tracks by decade/era',

  canProvide(query: StructuredSectionQuery): boolean {
    return (
      query.sectionType === 'decade-mix' ||
      !!query.embedding?.yearRange
    );
  },

  async provide(context: SeeAllContext): Promise<UnifiedTrack[]> {
    const { query } = context;

    // Use search query from section (contains decade-specific terms)
    const searchQuery = query.search?.query;
    const yearRange = query.embedding?.yearRange;

    if (!searchQuery && !yearRange) {
      return [];
    }

    try {
      if (!window.api?.search) {
        return [];
      }

      // Build search query with decade context
      let finalQuery = searchQuery || '';
      if (yearRange) {
        const [startYear, endYear] = yearRange;
        // Add year context if not already in query
        if (!finalQuery.includes(String(startYear).slice(0, 3))) {
          finalQuery += ` ${startYear}s hits`;
        }
      }

      console.log(`[DecadeProvider] Searching: "${finalQuery}"`);
      const results = await window.api.search({
        query: finalQuery,
        type: 'track',
        limit: query.limit || 30,
      });

      if (results?.length) {
        console.log(`[DecadeProvider] Got ${results.length} tracks`);

        // If we have year range, prioritize tracks from that era
        if (yearRange) {
          const [startYear, endYear] = yearRange;
          // Sort by how close the track's release year is to the target decade
          // (if release year info is available)
          return results.sort((a: any, b: any) => {
            const yearA = a.album?.releaseDate ? new Date(a.album.releaseDate).getFullYear() : 0;
            const yearB = b.album?.releaseDate ? new Date(b.album.releaseDate).getFullYear() : 0;
            const inRangeA = yearA >= startYear && yearA <= endYear ? 1 : 0;
            const inRangeB = yearB >= startYear && yearB <= endYear ? 1 : 0;
            return inRangeB - inRangeA;
          });
        }

        return results;
      }

      return [];
    } catch (error) {
      console.error('[DecadeProvider] Error:', error);
      return [];
    }
  },
};

/**
 * Personalized Provider
 * Uses ML recommendations and user profile for personalized content
 * NO FALLBACK - if ML isn't available, section should hide
 */
export const personalizedProvider: DataProvider = {
  id: `${CORE_PLUGIN_ID}:personalized`,
  pluginId: CORE_PLUGIN_ID,
  priority: 80,
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
      // Only use ML recommendations - no generic fallback
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

      // No fallback - return empty, section will hide
      console.log('[PersonalizedProvider] No ML data available, section will hide');
      return [];
    } catch (error) {
      console.error('[PersonalizedProvider] Error:', error);
      return [];
    }
  },
};

/**
 * Discovery Provider
 * ONLY handles explicit discovery sections that need fresh/random content
 * Does NOT handle specialty sections (decade, seasonal, activity, etc.)
 * NO GENERIC FALLBACK - sections hide if no data
 */
export const discoveryProvider: DataProvider = {
  id: `${CORE_PLUGIN_ID}:discovery`,
  pluginId: CORE_PLUGIN_ID,
  priority: 65,
  name: 'Discovery Provider',
  description: 'Provides fresh discovery tracks',

  canProvide(query: StructuredSectionQuery): boolean {
    // Only handle true discovery sections - NOT specialty sections
    const discoverySections = [
      'fresh-finds',
      'deep-cuts',
      'blind-picks',
      'discover-weekly',
      'discovery',
    ];
    return (
      discoverySections.includes(query.sectionType) ||
      query.embedding?.method === 'discovery'
    );
  },

  async provide(context: SeeAllContext): Promise<UnifiedTrack[]> {
    try {
      // Use trending data for discovery - shuffled for variety
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

      // No fallback - return empty, section will hide
      console.log('[DiscoveryProvider] No trending data available, section will hide');
      return [];
    } catch (error) {
      console.error('[DiscoveryProvider] Error:', error);
      return [];
    }
  },
};

/**
 * New Releases Provider
 * Uses getNewReleases API or trending with recency filter
 * NO GENERIC FALLBACK
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
      // Try dedicated new releases API first
      if (window.api?.getNewReleases) {
        console.log('[NewReleasesProvider] Using getNewReleases API...');
        const releases = await window.api.getNewReleases({
          genre: context.query.embedding?.genre,
          limit: context.query.limit || 30,
        });
        if (releases?.length) {
          console.log(`[NewReleasesProvider] Got ${releases.length} new releases`);
          return releases;
        }
      }

      // Fall back to trending (which often includes recent releases)
      if (window.api?.getTrending) {
        const trending = await dedupedRequest('trending', async () => {
          return await window.api.getTrending();
        });

        const tracksArray = Array.isArray(trending?.tracks) ? trending.tracks : [];
        if (tracksArray.length > 0) {
          // Filter/prioritize recent tracks if release date is available
          const tracks: UnifiedTrack[] = tracksArray.map((track: any) => ({
            ...track,
            id: track.id?.startsWith?.('deezer:') ? track.id : `deezer:${track.id}`,
            streamSources: track.streamSources || [],
            _meta: {
              metadataProvider: track._provider || 'new-releases',
              matchConfidence: 1,
              externalIds: track.externalIds || {},
              lastUpdated: new Date().toISOString(),
            },
          }));
          return tracks.slice(0, context.query.limit || 30);
        }
      }

      // No data available
      console.log('[NewReleasesProvider] No new releases data, section will hide');
      return [];
    } catch (error) {
      console.error('[NewReleasesProvider] Error:', error);
      return [];
    }
  },
};

/**
 * Layout/General Provider
 * Handles layout sections that have explicit search queries or embedding config
 * NO GENERIC FALLBACK - only uses data from section config
 */
export const layoutProvider: DataProvider = {
  id: `${CORE_PLUGIN_ID}:layout`,
  pluginId: CORE_PLUGIN_ID,
  priority: 50,
  name: 'Layout Provider',
  description: 'Handles layout sections with explicit queries',

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
    // Only provide if section has explicit search query or embedding config
    return layoutSections.includes(query.sectionType) &&
           !!(query.search?.query || query.embedding?.genre || query.embedding?.mood);
  },

  async provide(context: SeeAllContext): Promise<UnifiedTrack[]> {
    try {
      // Only use explicit search query from section config
      const searchQuery = context.query.search?.query;

      // Or build from explicit embedding hints (genre/mood)
      let queryToUse = searchQuery || '';
      if (!queryToUse && context.query.embedding?.genre) {
        queryToUse = `${context.query.embedding.genre} music`;
      }
      if (!queryToUse && context.query.embedding?.mood) {
        queryToUse = `${context.query.embedding.mood} music`;
      }

      // No query = no results (section will hide)
      if (!queryToUse.trim()) {
        console.log('[LayoutProvider] No explicit query, section will hide');
        return [];
      }

      if (!window.api?.search) {
        console.warn('[LayoutProvider] search API not available');
        return [];
      }

      console.log(`[LayoutProvider] Searching for: ${queryToUse}`);
      const results = await dedupedRequest(`layout:${context.query.sectionType}:${queryToUse}`, async () => {
        return await window.api.search({
          query: queryToUse,
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
    // Handle embedding-based sections that benefit from ML personalization
    const embeddingSections = [
      // Personalized sections (require user taste data)
      'quick-picks',
      'time-greeting',
      'on-repeat',
      'top-mix',
      'rediscover',
      'discover-weekly',
      // Mood/activity sections (ML enhances mood matching)
      'mood-playlist',
      'focus-mode',
      'activity',
      'seasonal',
      // Genre/decade sections (ML can personalize within category)
      'genre-explorer',
      'decade-mix',
      // Hero section (personalized content)
      'hero',
      // Artist-based (uses similarity embeddings)
      'artist-radio',
      // Discovery sections (ML adds personalization)
      'fresh-finds',
      'deep-cuts',
      'blind-picks',
    ];

    // Check if section type matches
    if (embeddingSections.includes(query.sectionType)) {
      return true;
    }

    // Also handle queries with explicit embedding method
    if (query.embedding?.method === 'personalized' ||
        query.embedding?.method === 'mood' ||
        query.embedding?.method === 'genre' ||
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
          mood = query.embedding?.mood || 'energetic';
          exploration = 0.25;
          break;

        case 'seasonal':
          method = 'mood';
          mood = query.embedding?.mood || 'chill';
          exploration = 0.4;
          break;

        case 'genre-explorer':
          method = 'genre';
          genre = query.embedding?.genre;
          exploration = 0.5;
          break;

        case 'decade-mix':
          method = 'discovery';
          exploration = 0.3;
          break;

        case 'discover-weekly':
        case 'rediscover':
        case 'fresh-finds':
        case 'deep-cuts':
        case 'blind-picks':
          method = 'discovery';
          exploration = query.embedding?.exploration || 0.6;
          break;

        case 'hero':
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
            exploration = query.embedding.exploration || 0.6;
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
  embeddingProvider,     // 95  - Library ML personalization
  artistRadioProvider,   // 90  - Artist-based radio
  similarTracksProvider, // 85  - Similar tracks
  searchProvider,        // 80  - Text search
  personalizedProvider,  // 80  - API recommendations
  decadeProvider,        // 75  - Decade/era-based content
  newReleasesProvider,   // 75  - New releases
  genreProvider,         // 75  - Genre search
  moodProvider,          // 70  - Mood/activity/seasonal
  discoveryProvider,     // 65  - Discovery sections
  layoutProvider,        // 50  - Layout sections with explicit queries
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
