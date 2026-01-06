/**
 * useEmbeddingPlaylist Hook
 *
 * Provides playlist generation using the server's ML API via IPC.
 * All ML computation is done server-side - this hook just calls the APIs.
 */

import { useState, useCallback, useEffect } from 'react';

// ============================================================================
// Types
// ============================================================================

export interface UnifiedTrack {
  id: string;
  title: string;
  artists?: Array<{ id?: string; name: string }>;
  album?: { id?: string; title: string };
  duration: number;
  genres?: string[];
  releaseDate?: string;
  explicit?: boolean;
  artwork?: { small?: string; medium?: string; large?: string };
  audioFeatures?: {
    energy?: number;
    valence?: number;
    danceability?: number;
    acousticness?: number;
    instrumentalness?: number;
    speechiness?: number;
    liveness?: number;
    tempo?: number;
    loudness?: number;
  };
}

export interface EmbeddingPlaylistOptions {
  limit?: number;
  exploration?: number;
  includeCollaborative?: boolean;
  excludeTrackIds?: string[];
  excludeArtistIds?: string[];
}

export interface PlaylistResult {
  tracks: UnifiedTrack[];
  method: string;
  avgSimilarity: number;
  isLoading: boolean;
  error: string | null;
}

export interface PlaylistTrack {
  trackId: string;
  score: number;
  method: string;
  track?: UnifiedTrack;
}

export interface GeneratedPlaylist {
  tracks: PlaylistTrack[];
  method: string;
  generatedAt: number;
}

// ============================================================================
// Track Cache (for converting IDs to full tracks)
// ============================================================================

const MAX_CACHE_SIZE = 10000;
const trackCache = new Map<string, UnifiedTrack>();

function cacheTrack(track: UnifiedTrack) {
  // Enforce max cache size with LRU-like eviction
  if (trackCache.size >= MAX_CACHE_SIZE && !trackCache.has(track.id)) {
    // Remove oldest entry (first key in Map)
    const firstKey = trackCache.keys().next().value;
    if (firstKey) {
      trackCache.delete(firstKey);
    }
  }
  trackCache.set(track.id, track);
}

function cacheTracks(tracks: UnifiedTrack[]) {
  for (const track of tracks) {
    cacheTrack(track);
  }
}

function getTrackFromCache(id: string): UnifiedTrack | undefined {
  return trackCache.get(id);
}

/**
 * Clear the track cache - call on server disconnect or memory pressure
 */
export function clearTrackCache(): void {
  trackCache.clear();
}

/**
 * Get current cache size
 */
export function getTrackCacheSize(): number {
  return trackCache.size;
}

// ============================================================================
// IPC API Helper
// ============================================================================

/**
 * Check if window.api is available (running in Electron)
 */
function hasIpcApi(): boolean {
  return typeof window !== 'undefined' && window.api !== undefined;
}

/**
 * Safe IPC call with fallback
 */
async function safeIpcCall<T>(
  fn: () => Promise<T>,
  fallback: T,
  context: string
): Promise<T> {
  if (!hasIpcApi()) {
    console.warn(`[useEmbeddingPlaylist] IPC not available for ${context}`);
    return fallback;
  }
  try {
    return await fn();
  } catch (error) {
    console.error(`[useEmbeddingPlaylist] ${context} failed:`, error);
    return fallback;
  }
}

// ============================================================================
// Legacy API Compatibility (deprecated)
// ============================================================================

/** @deprecated Server URL is now managed by IPC layer. This function is a no-op. */
export function setServerUrl(_url: string) {
  // No-op: IPC layer handles server connection
}

/** @deprecated Server URL is now managed by IPC layer. */
export function getServerUrl(): string {
  return '';
}

// ============================================================================
// Main Hook
// ============================================================================

export function useEmbeddingPlaylist() {
  const [isReady, setIsReady] = useState(false);
  const [tracksIndexed, setTracksIndexed] = useState(0);

  // Check server readiness on mount
  useEffect(() => {
    async function checkReady() {
      if (!hasIpcApi()) {
        setIsReady(false);
        return;
      }

      try {
        const status = await window.api!.algoGetStatus();
        setIsReady(status?.initialized && status?.algorithmLoaded);
      } catch {
        setIsReady(false);
      }
    }

    checkReady();
  }, []);

  /**
   * Register tracks with the server (caches locally for ID->track lookup)
   */
  const indexTracks = useCallback((tracks: UnifiedTrack[]) => {
    cacheTracks(tracks);
    setTracksIndexed(trackCache.size);
  }, []);

  /**
   * Record a track play
   */
  const recordPlay = useCallback(async (
    track: UnifiedTrack,
    duration: number,
    completed: boolean
  ) => {
    cacheTrack(track);

    if (!hasIpcApi()) return;

    await safeIpcCall(
      () => window.api!.algoRecordEvent({
        type: 'listen',
        track: {
          id: track.id,
          title: track.title,
          artist: track.artists?.[0]?.name || 'Unknown',
          artistId: track.artists?.[0]?.id,
          duration: track.duration,
          genres: track.genres,
        },
        duration,
        completion: duration / (track.duration || duration),
        completed,
      }),
      undefined,
      'recordPlay'
    );
  }, []);

  /**
   * Record a like
   */
  const recordLike = useCallback(async (track: UnifiedTrack) => {
    cacheTrack(track);

    if (!hasIpcApi()) return;

    await safeIpcCall(
      () => window.api!.algoRecordEvent({
        type: 'like',
        track: {
          id: track.id,
          title: track.title,
          artist: track.artists?.[0]?.name || 'Unknown',
          artistId: track.artists?.[0]?.id,
          duration: track.duration,
          genres: track.genres,
        },
        strength: 1,
      }),
      undefined,
      'recordLike'
    );
  }, []);

  /**
   * Record session (co-occurrence) - no-op for server-side
   */
  const recordSession = useCallback((_trackIds: string[]) => {
    // Server tracks sessions automatically via events
  }, []);

  /**
   * Generate mood-based playlist
   */
  const generateMoodPlaylist = useCallback(async (
    mood: string,
    options: EmbeddingPlaylistOptions = {}
  ): Promise<GeneratedPlaylist | null> => {
    if (!isReady || !hasIpcApi()) return null;

    const result = await safeIpcCall(
      () => window.api!.algoGetMoodRadio(mood, options.limit || 20),
      { tracks: [] },
      'generateMoodPlaylist'
    );

    if (!result.tracks?.length) return null;

    return {
      tracks: result.tracks.map((id: string) => ({
        trackId: id,
        score: 1,
        method: 'mood',
      })),
      method: `mood:${mood}`,
      generatedAt: Date.now(),
    };
  }, [isReady]);

  /**
   * Generate genre-based playlist
   */
  const generateGenrePlaylist = useCallback(async (
    genre: string,
    options: EmbeddingPlaylistOptions = {}
  ): Promise<GeneratedPlaylist | null> => {
    if (!isReady || !hasIpcApi()) return null;

    const result = await safeIpcCall(
      () => window.api!.algoGetGenreRadio(genre, options.limit || 20),
      { tracks: [] },
      'generateGenrePlaylist'
    );

    if (!result.tracks?.length) return null;

    return {
      tracks: result.tracks.map((id: string) => ({
        trackId: id,
        score: 1,
        method: 'genre',
      })),
      method: `genre:${genre}`,
      generatedAt: Date.now(),
    };
  }, [isReady]);

  /**
   * Generate seed-track based playlist (like "Song Radio")
   */
  const generateSeedPlaylist = useCallback(async (
    seedTrackIds: string[],
    options: EmbeddingPlaylistOptions = {}
  ): Promise<GeneratedPlaylist | null> => {
    if (!isReady || !hasIpcApi() || seedTrackIds.length === 0) return null;

    const result = await safeIpcCall(
      () => window.api!.algoGetRadio(seedTrackIds[0], options.limit || 20),
      { tracks: [] },
      'generateSeedPlaylist'
    );

    if (!result.tracks?.length) return null;

    return {
      tracks: result.tracks.map((id: string) => ({
        trackId: id,
        score: 1,
        method: 'seed',
      })),
      method: 'seed-playlist',
      generatedAt: Date.now(),
    };
  }, [isReady]);

  /**
   * Generate personalized playlist
   */
  const generatePersonalizedPlaylist = useCallback(async (
    options: EmbeddingPlaylistOptions = {}
  ): Promise<GeneratedPlaylist | null> => {
    if (!isReady || !hasIpcApi()) return null;

    const result = await safeIpcCall(
      () => window.api!.algoGetRecommendations(options.limit || 20),
      { recommendations: [] },
      'generatePersonalizedPlaylist'
    );

    if (!result.recommendations?.length) return null;

    return {
      tracks: result.recommendations.map((id: string) => ({
        trackId: id,
        score: 1,
        method: 'personalized',
      })),
      method: 'personalized',
      generatedAt: Date.now(),
    };
  }, [isReady]);

  /**
   * Generate artist radio playlist
   */
  const generateArtistRadio = useCallback(async (
    artistId: string,
    options: EmbeddingPlaylistOptions = {}
  ): Promise<GeneratedPlaylist | null> => {
    if (!isReady || !hasIpcApi()) return null;

    const result = await safeIpcCall(
      () => window.api!.algoGetArtistRadio(artistId, options.limit || 20),
      { tracks: [] },
      'generateArtistRadio'
    );

    if (!result.tracks?.length) return null;

    return {
      tracks: result.tracks.map((id: string) => ({
        trackId: id,
        score: 1,
        method: 'artist-radio',
      })),
      method: `artist-radio:${artistId}`,
      generatedAt: Date.now(),
    };
  }, [isReady]);

  /**
   * Generate discovery playlist (uses recommendations with high exploration)
   */
  const generateDiscoveryPlaylist = useCallback(async (
    options: EmbeddingPlaylistOptions = {}
  ): Promise<GeneratedPlaylist | null> => {
    if (!isReady || !hasIpcApi()) return null;

    const result = await safeIpcCall(
      () => window.api!.algoGetRecommendations(options.limit || 20, 'discovery'),
      { recommendations: [] },
      'generateDiscoveryPlaylist'
    );

    if (!result.recommendations?.length) return null;

    return {
      tracks: result.recommendations.map((id: string) => ({
        trackId: id,
        score: 1,
        method: 'discovery',
      })),
      method: 'discovery',
      generatedAt: Date.now(),
    };
  }, [isReady]);

  /**
   * Find similar tracks
   */
  const findSimilarTracks = useCallback(async (
    trackId: string,
    limit = 20
  ): Promise<PlaylistTrack[]> => {
    if (!isReady || !hasIpcApi()) return [];

    const result = await safeIpcCall(
      () => window.api!.algoGetSimilar(trackId, limit),
      { tracks: [] },
      'findSimilarTracks'
    );

    if (!result.tracks?.length) return [];

    return result.tracks.map((id: string) => ({
      trackId: id,
      score: 1,
      method: 'similar',
    }));
  }, [isReady]);

  /**
   * Convert playlist result to UnifiedTrack array
   */
  const getTracksFromPlaylist = useCallback((
    playlist: GeneratedPlaylist | null
  ): UnifiedTrack[] => {
    if (!playlist) return [];

    return playlist.tracks
      .map(pt => {
        const cached = getTrackFromCache(pt.trackId);
        if (!cached) return undefined;

        // Clear stale stream info
        return {
          ...cached,
          streamInfo: undefined,
          streamSources: [],
        };
      })
      .filter((t): t is UnifiedTrack => t !== undefined);
  }, []);

  /**
   * Get taste profile stats from server
   */
  const getTasteStats = useCallback(async () => {
    if (!hasIpcApi()) {
      return {
        isValid: false,
        interactionCount: 0,
        topGenres: [],
        topArtists: [],
      };
    }

    const profile = await safeIpcCall(
      () => window.api!.algoGetProfile(),
      null,
      'getTasteStats'
    );

    if (!profile) {
      return {
        isValid: false,
        interactionCount: 0,
        topGenres: [],
        topArtists: [],
      };
    }

    return {
      isValid: true,
      interactionCount: profile.trackCount || 0,
      topGenres: (profile.topGenres || []).slice(0, 5),
      topArtists: (profile.topArtists || []).slice(0, 5),
      totalListenTime: profile.totalListenTime,
    };
  }, []);

  /**
   * Get index statistics
   */
  const getIndexStats = useCallback(() => {
    return {
      tracksIndexed: trackCache.size,
      cooccurrencePairs: 0, // Server-side only
    };
  }, []);

  return {
    // State
    isReady,
    tracksIndexed,

    // Indexing
    indexTracks,

    // Recording
    recordPlay,
    recordLike,
    recordSession,

    // Playlist Generation (now async)
    generateMoodPlaylist,
    generateGenrePlaylist,
    generateSeedPlaylist,
    generatePersonalizedPlaylist,
    generateArtistRadio,
    generateDiscoveryPlaylist,
    findSimilarTracks,

    // Utilities
    getTracksFromPlaylist,
    getTasteStats,
    getIndexStats,

    // Cache management
    clearCache: clearTrackCache,
  };
}

// ============================================================================
// Convenience Hooks
// ============================================================================

/**
 * Hook for mood-based playlists
 */
export function useMoodPlaylist(
  mood: string | null,
  tracks: UnifiedTrack[],
  options: EmbeddingPlaylistOptions = {}
) {
  const { indexTracks, generateMoodPlaylist, getTracksFromPlaylist, isReady } =
    useEmbeddingPlaylist();
  const [result, setResult] = useState<UnifiedTrack[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (tracks.length > 0) {
      indexTracks(tracks);
    }
  }, [tracks, indexTracks]);

  useEffect(() => {
    if (!mood || !isReady) return;

    let cancelled = false;
    setLoading(true);

    generateMoodPlaylist(mood, options).then(playlist => {
      if (!cancelled) {
        setResult(getTracksFromPlaylist(playlist));
        setLoading(false);
      }
    });

    return () => { cancelled = true; };
  }, [mood, isReady, generateMoodPlaylist, getTracksFromPlaylist, options]);

  return { tracks: result, loading };
}

/**
 * Hook for genre-based playlists
 */
export function useGenrePlaylist(
  genre: string | null,
  tracks: UnifiedTrack[],
  options: EmbeddingPlaylistOptions = {}
) {
  const { indexTracks, generateGenrePlaylist, getTracksFromPlaylist, isReady } =
    useEmbeddingPlaylist();
  const [result, setResult] = useState<UnifiedTrack[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (tracks.length > 0) {
      indexTracks(tracks);
    }
  }, [tracks, indexTracks]);

  useEffect(() => {
    if (!genre || !isReady) return;

    let cancelled = false;
    setLoading(true);

    generateGenrePlaylist(genre, options).then(playlist => {
      if (!cancelled) {
        setResult(getTracksFromPlaylist(playlist));
        setLoading(false);
      }
    });

    return () => { cancelled = true; };
  }, [genre, isReady, generateGenrePlaylist, getTracksFromPlaylist, options]);

  return { tracks: result, loading };
}

/**
 * Hook for similar tracks
 */
export function useSimilarTracks(
  seedTrackId: string | null,
  tracks: UnifiedTrack[],
  limit = 20
) {
  const { indexTracks, findSimilarTracks, isReady } = useEmbeddingPlaylist();
  const [result, setResult] = useState<PlaylistTrack[]>([]);

  useEffect(() => {
    if (tracks.length > 0) {
      indexTracks(tracks);
    }
  }, [tracks, indexTracks]);

  useEffect(() => {
    if (!seedTrackId || !isReady) return;

    let cancelled = false;

    findSimilarTracks(seedTrackId, limit).then(similar => {
      if (!cancelled) {
        setResult(similar);
      }
    });

    return () => { cancelled = true; };
  }, [seedTrackId, isReady, findSimilarTracks, limit]);

  const tracksWithData = result
    .map(pt => {
      const cached = getTrackFromCache(pt.trackId);
      if (!cached) return { ...pt, track: undefined };
      return {
        ...pt,
        track: { ...cached, streamInfo: undefined, streamSources: [] },
      };
    })
    .filter(t => t.track !== undefined);

  return { similar: tracksWithData };
}

// ============================================================================
// Standalone Functions for Providers (non-React)
// ============================================================================

/**
 * Get current indexed track count
 */
export function getIndexedTrackCount(): number {
  return trackCache.size;
}

/**
 * Check if embedding system is ready
 */
export function isEmbeddingReady(): boolean {
  return hasIpcApi() && trackCache.size > 0;
}

/**
 * Index tracks (standalone version)
 */
export function indexTracksStandalone(tracks: UnifiedTrack[]): number {
  let newlyIndexed = 0;
  for (const track of tracks) {
    if (!trackCache.has(track.id)) {
      cacheTrack(track);
      newlyIndexed++;
    }
  }
  return newlyIndexed;
}

/**
 * Generate playlist from server (standalone version)
 */
export async function generateEmbeddingPlaylist(
  method: 'personalized' | 'mood' | 'genre' | 'artist-radio' | 'discovery' | 'similar',
  options: {
    mood?: string;
    genre?: string;
    artistId?: string;
    seedTrackIds?: string[];
    limit?: number;
    exploration?: number;
    excludeTrackIds?: string[];
  } = {}
): Promise<UnifiedTrack[]> {
  if (!hasIpcApi()) {
    console.warn('[generateEmbeddingPlaylist] IPC not available');
    return [];
  }

  try {
    const limit = options.limit || 20;
    let trackIds: string[] = [];

    switch (method) {
      case 'personalized':
      case 'discovery': {
        const result = await window.api!.algoGetRecommendations(limit, method === 'discovery' ? 'discovery' : undefined);
        trackIds = result.recommendations || [];
        break;
      }
      case 'mood': {
        if (!options.mood) return [];
        const result = await window.api!.algoGetMoodRadio(options.mood, limit);
        trackIds = result.tracks || [];
        break;
      }
      case 'genre': {
        if (!options.genre) return [];
        const result = await window.api!.algoGetGenreRadio(options.genre, limit);
        trackIds = result.tracks || [];
        break;
      }
      case 'artist-radio': {
        if (!options.artistId) return [];
        const result = await window.api!.algoGetArtistRadio(options.artistId, limit);
        trackIds = result.tracks || [];
        break;
      }
      case 'similar': {
        if (!options.seedTrackIds?.length) return [];
        const result = await window.api!.algoGetRadio(options.seedTrackIds[0], limit);
        trackIds = result.tracks || [];
        break;
      }
    }

    // Convert IDs to tracks from cache
    return trackIds
      .map(id => {
        const cached = trackCache.get(id);
        if (!cached) return undefined;
        return { ...cached, streamInfo: undefined, streamSources: [] };
      })
      .filter((t): t is UnifiedTrack => t !== undefined);
  } catch (error) {
    console.error('[generateEmbeddingPlaylist] Failed:', error);
    return [];
  }
}

/**
 * Get all indexed tracks
 */
export function getAllIndexedTracks(): UnifiedTrack[] {
  return Array.from(trackCache.values()).map(track => ({
    ...track,
    streamInfo: undefined,
    streamSources: [],
  }));
}
