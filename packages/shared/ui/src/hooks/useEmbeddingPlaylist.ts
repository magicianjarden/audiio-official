/**
 * useEmbeddingPlaylist Hook
 *
 * Provides playlist generation using the server's ML API.
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
// Server API Configuration
// ============================================================================

let serverBaseUrl = '';

/**
 * Set the server base URL for API calls
 */
export function setServerUrl(url: string) {
  serverBaseUrl = url.replace(/\/$/, '');
}

/**
 * Get the current server URL
 */
export function getServerUrl(): string {
  return serverBaseUrl;
}

// ============================================================================
// API Helpers
// ============================================================================

async function fetchApi<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  if (!serverBaseUrl) {
    throw new Error('Server URL not configured. Call setServerUrl() first.');
  }

  const response = await fetch(`${serverBaseUrl}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

// ============================================================================
// Track Cache (for converting IDs to full tracks)
// ============================================================================

const trackCache = new Map<string, UnifiedTrack>();

function cacheTrack(track: UnifiedTrack) {
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

// ============================================================================
// Main Hook
// ============================================================================

export function useEmbeddingPlaylist() {
  const [isReady, setIsReady] = useState(false);
  const [tracksIndexed, setTracksIndexed] = useState(0);

  // Check server readiness on mount
  useEffect(() => {
    async function checkReady() {
      if (!serverBaseUrl) {
        setIsReady(false);
        return;
      }

      try {
        const status = await fetchApi<{ initialized: boolean; algorithmLoaded: boolean }>('/api/algo/status');
        setIsReady(status.initialized && status.algorithmLoaded);
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

    try {
      await fetchApi('/api/algo/event', {
        method: 'POST',
        body: JSON.stringify({
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
      });
    } catch (error) {
      console.error('[useEmbeddingPlaylist] Failed to record play:', error);
    }
  }, []);

  /**
   * Record a like
   */
  const recordLike = useCallback(async (track: UnifiedTrack) => {
    cacheTrack(track);

    try {
      await fetchApi('/api/algo/event', {
        method: 'POST',
        body: JSON.stringify({
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
      });
    } catch (error) {
      console.error('[useEmbeddingPlaylist] Failed to record like:', error);
    }
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
    if (!isReady) return null;

    try {
      const result = await fetchApi<{ tracks: string[] }>(
        `/api/algo/radio/mood/${encodeURIComponent(mood)}?count=${options.limit || 20}`
      );

      return {
        tracks: result.tracks.map(id => ({
          trackId: id,
          score: 1,
          method: 'mood',
        })),
        method: `mood:${mood}`,
        generatedAt: Date.now(),
      };
    } catch (error) {
      console.error('[useEmbeddingPlaylist] Failed to generate mood playlist:', error);
      return null;
    }
  }, [isReady]);

  /**
   * Generate genre-based playlist
   */
  const generateGenrePlaylist = useCallback(async (
    genre: string,
    options: EmbeddingPlaylistOptions = {}
  ): Promise<GeneratedPlaylist | null> => {
    if (!isReady) return null;

    try {
      const result = await fetchApi<{ tracks: string[] }>(
        `/api/algo/radio/genre/${encodeURIComponent(genre)}?count=${options.limit || 20}`
      );

      return {
        tracks: result.tracks.map(id => ({
          trackId: id,
          score: 1,
          method: 'genre',
        })),
        method: `genre:${genre}`,
        generatedAt: Date.now(),
      };
    } catch (error) {
      console.error('[useEmbeddingPlaylist] Failed to generate genre playlist:', error);
      return null;
    }
  }, [isReady]);

  /**
   * Generate seed-track based playlist (like "Song Radio")
   */
  const generateSeedPlaylist = useCallback(async (
    seedTrackIds: string[],
    options: EmbeddingPlaylistOptions = {}
  ): Promise<GeneratedPlaylist | null> => {
    if (!isReady || seedTrackIds.length === 0) return null;

    try {
      // Use the first seed track for radio generation
      const result = await fetchApi<{ tracks: string[] }>(
        `/api/algo/radio/track/${seedTrackIds[0]}?count=${options.limit || 20}`
      );

      return {
        tracks: result.tracks.map(id => ({
          trackId: id,
          score: 1,
          method: 'seed',
        })),
        method: 'seed-playlist',
        generatedAt: Date.now(),
      };
    } catch (error) {
      console.error('[useEmbeddingPlaylist] Failed to generate seed playlist:', error);
      return null;
    }
  }, [isReady]);

  /**
   * Generate personalized playlist
   */
  const generatePersonalizedPlaylist = useCallback(async (
    options: EmbeddingPlaylistOptions = {}
  ): Promise<GeneratedPlaylist | null> => {
    if (!isReady) return null;

    try {
      const result = await fetchApi<{ recommendations: string[] }>(
        `/api/algo/recommendations?count=${options.limit || 20}`
      );

      return {
        tracks: result.recommendations.map(id => ({
          trackId: id,
          score: 1,
          method: 'personalized',
        })),
        method: 'personalized',
        generatedAt: Date.now(),
      };
    } catch (error) {
      console.error('[useEmbeddingPlaylist] Failed to generate personalized playlist:', error);
      return null;
    }
  }, [isReady]);

  /**
   * Generate artist radio playlist
   */
  const generateArtistRadio = useCallback(async (
    artistId: string,
    options: EmbeddingPlaylistOptions = {}
  ): Promise<GeneratedPlaylist | null> => {
    if (!isReady) return null;

    try {
      const result = await fetchApi<{ tracks: string[] }>(
        `/api/algo/radio/artist/${encodeURIComponent(artistId)}?count=${options.limit || 20}`
      );

      return {
        tracks: result.tracks.map(id => ({
          trackId: id,
          score: 1,
          method: 'artist-radio',
        })),
        method: `artist-radio:${artistId}`,
        generatedAt: Date.now(),
      };
    } catch (error) {
      console.error('[useEmbeddingPlaylist] Failed to generate artist radio:', error);
      return null;
    }
  }, [isReady]);

  /**
   * Generate discovery playlist (uses recommendations with high exploration)
   */
  const generateDiscoveryPlaylist = useCallback(async (
    options: EmbeddingPlaylistOptions = {}
  ): Promise<GeneratedPlaylist | null> => {
    if (!isReady) return null;

    try {
      // Use recommendations endpoint - discovery uses same backend
      const result = await fetchApi<{ recommendations: string[] }>(
        `/api/algo/recommendations?count=${options.limit || 20}&mode=discovery`
      );

      return {
        tracks: result.recommendations.map(id => ({
          trackId: id,
          score: 1,
          method: 'discovery',
        })),
        method: 'discovery',
        generatedAt: Date.now(),
      };
    } catch (error) {
      console.error('[useEmbeddingPlaylist] Failed to generate discovery playlist:', error);
      return null;
    }
  }, [isReady]);

  /**
   * Find similar tracks
   */
  const findSimilarTracks = useCallback(async (
    trackId: string,
    limit = 20
  ): Promise<PlaylistTrack[]> => {
    if (!isReady) return [];

    try {
      const result = await fetchApi<{ tracks: string[] }>(
        `/api/algo/similar/${trackId}?count=${limit}`
      );

      return result.tracks.map(id => ({
        trackId: id,
        score: 1,
        method: 'similar',
      }));
    } catch (error) {
      console.error('[useEmbeddingPlaylist] Failed to find similar tracks:', error);
      return [];
    }
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
    try {
      const profile = await fetchApi<{
        artistPreferences: Record<string, number>;
        genrePreferences: Record<string, number>;
        topArtists: string[];
        topGenres: string[];
        totalListenTime: number;
        trackCount: number;
      }>('/api/algo/profile');

      return {
        isValid: true,
        interactionCount: profile.trackCount,
        topGenres: profile.topGenres.slice(0, 5),
        topArtists: profile.topArtists.slice(0, 5),
        totalListenTime: profile.totalListenTime,
      };
    } catch {
      return {
        isValid: false,
        interactionCount: 0,
        topGenres: [],
        topArtists: [],
      };
    }
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
  return serverBaseUrl !== '' && trackCache.size > 0;
}

/**
 * Index tracks (standalone version)
 */
export function indexTracksStandalone(tracks: UnifiedTrack[]): number {
  let newlyIndexed = 0;
  for (const track of tracks) {
    if (!trackCache.has(track.id)) {
      trackCache.set(track.id, track);
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
  if (!serverBaseUrl) {
    console.warn('[generateEmbeddingPlaylist] Server URL not configured');
    return [];
  }

  try {
    let endpoint = '';
    const limit = options.limit || 20;

    switch (method) {
      case 'personalized':
      case 'discovery':
        endpoint = `/api/algo/recommendations?count=${limit}`;
        break;
      case 'mood':
        if (!options.mood) return [];
        endpoint = `/api/algo/radio/mood/${encodeURIComponent(options.mood)}?count=${limit}`;
        break;
      case 'genre':
        if (!options.genre) return [];
        endpoint = `/api/algo/radio/genre/${encodeURIComponent(options.genre)}?count=${limit}`;
        break;
      case 'artist-radio':
        if (!options.artistId) return [];
        endpoint = `/api/algo/radio/artist/${encodeURIComponent(options.artistId)}?count=${limit}`;
        break;
      case 'similar':
        if (!options.seedTrackIds?.length) return [];
        endpoint = `/api/algo/radio/track/${options.seedTrackIds[0]}?count=${limit}`;
        break;
    }

    const result = await fetchApi<{ tracks?: string[]; recommendations?: string[] }>(endpoint);
    const trackIds = result.tracks || result.recommendations || [];

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
