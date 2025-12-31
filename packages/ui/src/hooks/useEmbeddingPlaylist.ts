/**
 * useEmbeddingPlaylist Hook
 *
 * Provides vector-based playlist generation using the ml-core embedding system.
 * Replaces keyword search with semantic similarity for mood/genre/personalized playlists.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import {
  EmbeddingEngine,
  VectorIndex,
  TasteProfileManager,
  CoOccurrenceMatrix,
  PlaylistGenerator,
  type TrackData,
  type PlaylistOptions,
  type GeneratedPlaylist,
  type PlaylistTrack,
} from '@audiio/ml-core';
import type { UnifiedTrack } from '@audiio/core';

// ============================================================================
// Types
// ============================================================================

export interface EmbeddingPlaylistOptions {
  limit?: number;
  exploration?: number; // 0-1, how much to explore vs exploit
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

// ============================================================================
// Singleton instances (shared across hook instances)
// ============================================================================

let embeddingEngine: EmbeddingEngine | null = null;
let vectorIndex: VectorIndex | null = null;
let cooccurrence: CoOccurrenceMatrix | null = null;
let tasteProfile: TasteProfileManager | null = null;
let playlistGenerator: PlaylistGenerator | null = null;
let isInitialized = false;

// Shared state across all hook instances
type StateListener = () => void;
const stateListeners = new Set<StateListener>();
let sharedTracksIndexed = 0;
const sharedIndexedTracks = new Set<string>();
const sharedTrackCache = new Map<string, UnifiedTrack>();

function notifyStateChange() {
  stateListeners.forEach(listener => listener());
}

function subscribeToState(listener: StateListener) {
  stateListeners.add(listener);
  return () => stateListeners.delete(listener);
}

function getSharedTracksIndexed() {
  return sharedTracksIndexed;
}

function setSharedTracksIndexed(count: number) {
  if (count !== sharedTracksIndexed) {
    sharedTracksIndexed = count;
    notifyStateChange();
  }
}

function getInstances() {
  if (!isInitialized) {
    embeddingEngine = new EmbeddingEngine({ dimensions: 128 });
    vectorIndex = new VectorIndex({ dimensions: 128 });
    cooccurrence = new CoOccurrenceMatrix();
    tasteProfile = new TasteProfileManager('default-user', embeddingEngine);
    playlistGenerator = new PlaylistGenerator(
      embeddingEngine,
      vectorIndex,
      cooccurrence,
      tasteProfile
    );
    isInitialized = true;
  }

  return {
    embeddingEngine: embeddingEngine!,
    vectorIndex: vectorIndex!,
    cooccurrence: cooccurrence!,
    tasteProfile: tasteProfile!,
    playlistGenerator: playlistGenerator!,
  };
}

// ============================================================================
// Track conversion utilities
// ============================================================================

function unifiedTrackToTrackData(track: UnifiedTrack): TrackData {
  return {
    id: track.id,
    title: track.title,
    artist: track.artists?.[0]?.name,
    artistId: track.artists?.[0]?.id || track.artists?.[0]?.name?.toLowerCase().replace(/\s+/g, '-'),
    genres: track.genres || [],
    duration: track.duration,
    audioFeatures: track.audioFeatures ? {
      energy: track.audioFeatures.energy,
      valence: track.audioFeatures.valence,
      danceability: track.audioFeatures.danceability,
      acousticness: track.audioFeatures.acousticness,
      instrumentalness: track.audioFeatures.instrumentalness,
      speechiness: track.audioFeatures.speechiness,
      liveness: track.audioFeatures.liveness,
      bpm: track.audioFeatures.tempo,
      loudness: track.audioFeatures.loudness,
    } : undefined,
  };
}

// ============================================================================
// Main Hook
// ============================================================================

export function useEmbeddingPlaylist() {
  const [isReady, setIsReady] = useState(false);
  const [tracksIndexed, setTracksIndexed] = useState(getSharedTracksIndexed);

  // Initialize on mount
  useEffect(() => {
    getInstances();
    setIsReady(true);
    // Sync with shared state on mount
    setTracksIndexed(getSharedTracksIndexed());
  }, []);

  // Subscribe to shared state changes
  useEffect(() => {
    const unsubscribe = subscribeToState(() => {
      setTracksIndexed(getSharedTracksIndexed());
    });
    return unsubscribe;
  }, []);

  /**
   * Register tracks for embedding indexing
   */
  const indexTracks = useCallback((tracks: UnifiedTrack[]) => {
    const { playlistGenerator } = getInstances();
    let newlyIndexed = 0;

    for (const track of tracks) {
      if (!sharedIndexedTracks.has(track.id)) {
        const trackData = unifiedTrackToTrackData(track);
        playlistGenerator.registerTrack(trackData);
        sharedIndexedTracks.add(track.id);
        sharedTrackCache.set(track.id, track);
        newlyIndexed++;
      }
    }

    if (newlyIndexed > 0) {
      // Update shared state - this will notify all hook instances
      setSharedTracksIndexed(sharedIndexedTracks.size);
    }
  }, []);

  /**
   * Record a track play for taste learning
   */
  const recordPlay = useCallback((
    track: UnifiedTrack,
    duration: number,
    completed: boolean
  ) => {
    const { embeddingEngine, tasteProfile, playlistGenerator } = getInstances();

    // Index track if needed
    if (!sharedIndexedTracks.has(track.id)) {
      const trackData = unifiedTrackToTrackData(track);
      playlistGenerator.registerTrack(trackData);
      sharedIndexedTracks.add(track.id);
      sharedTrackCache.set(track.id, track);
      setSharedTracksIndexed(sharedIndexedTracks.size);
    }

    // Get embedding
    const embedding = embeddingEngine.getEmbedding(track.id);
    if (embedding) {
      // Record in taste profile
      tasteProfile.addListen(
        track.id,
        embedding.vector,
        duration,
        track.duration || duration * 1.2,
        track.genres,
        track.artists?.[0]?.id
      );
    }
  }, []);

  /**
   * Record a like for taste learning
   */
  const recordLike = useCallback((track: UnifiedTrack) => {
    const { embeddingEngine, tasteProfile, playlistGenerator } = getInstances();

    // Index track if needed
    if (!sharedIndexedTracks.has(track.id)) {
      const trackData = unifiedTrackToTrackData(track);
      playlistGenerator.registerTrack(trackData);
      sharedIndexedTracks.add(track.id);
      sharedTrackCache.set(track.id, track);
      setSharedTracksIndexed(sharedIndexedTracks.size);
    }

    const embedding = embeddingEngine.getEmbedding(track.id);
    if (embedding) {
      tasteProfile.addLike(
        track.id,
        embedding.vector,
        track.genres,
        track.artists?.[0]?.id
      );
    }
  }, []);

  /**
   * Record co-occurrence (tracks played together)
   */
  const recordSession = useCallback((trackIds: string[]) => {
    const { cooccurrence } = getInstances();
    cooccurrence.recordCoOccurrence(trackIds, 'session');
  }, []);

  /**
   * Generate mood-based playlist
   */
  const generateMoodPlaylist = useCallback((
    mood: string,
    options: EmbeddingPlaylistOptions = {}
  ): GeneratedPlaylist | null => {
    if (!isReady || tracksIndexed < 1) {
      return null;
    }

    const { playlistGenerator } = getInstances();
    const now = new Date();

    return playlistGenerator.generateMoodPlaylist(mood, {
      limit: options.limit || 20,
      explorationFactor: options.exploration || 0.2,
      includeCollaborative: options.includeCollaborative ?? true,
      excludeTrackIds: options.excludeTrackIds,
      excludeArtistIds: options.excludeArtistIds,
      contextHour: now.getHours(),
      contextDayOfWeek: now.getDay(),
    });
  }, [isReady, tracksIndexed]);

  /**
   * Generate genre-based playlist
   */
  const generateGenrePlaylist = useCallback((
    genre: string,
    options: EmbeddingPlaylistOptions = {}
  ): GeneratedPlaylist | null => {
    if (!isReady || tracksIndexed < 1) {
      return null;
    }

    const { playlistGenerator } = getInstances();
    const now = new Date();

    return playlistGenerator.generateGenrePlaylist(genre, {
      limit: options.limit || 20,
      explorationFactor: options.exploration || 0.2,
      includeCollaborative: options.includeCollaborative ?? true,
      excludeTrackIds: options.excludeTrackIds,
      excludeArtistIds: options.excludeArtistIds,
      contextHour: now.getHours(),
      contextDayOfWeek: now.getDay(),
    });
  }, [isReady, tracksIndexed]);

  /**
   * Generate seed-track based playlist (like "Song Radio")
   */
  const generateSeedPlaylist = useCallback((
    seedTrackIds: string[],
    options: EmbeddingPlaylistOptions = {}
  ): GeneratedPlaylist | null => {
    if (!isReady || tracksIndexed < 1) {
      return null;
    }

    const { playlistGenerator } = getInstances();

    return playlistGenerator.generateSeedPlaylist(seedTrackIds, {
      limit: options.limit || 20,
      explorationFactor: options.exploration || 0.2,
      includeCollaborative: options.includeCollaborative ?? true,
      excludeTrackIds: options.excludeTrackIds,
      excludeArtistIds: options.excludeArtistIds,
    });
  }, [isReady, tracksIndexed]);

  /**
   * Generate personalized playlist
   */
  const generatePersonalizedPlaylist = useCallback((
    options: EmbeddingPlaylistOptions = {}
  ): GeneratedPlaylist | null => {
    if (!isReady || tracksIndexed < 1) {
      return null;
    }

    const { playlistGenerator } = getInstances();
    const now = new Date();

    return playlistGenerator.generatePersonalizedPlaylist({
      limit: options.limit || 20,
      explorationFactor: options.exploration || 0.2,
      includeCollaborative: options.includeCollaborative ?? true,
      excludeTrackIds: options.excludeTrackIds,
      excludeArtistIds: options.excludeArtistIds,
      contextHour: now.getHours(),
      contextDayOfWeek: now.getDay(),
    });
  }, [isReady, tracksIndexed]);

  /**
   * Generate artist radio playlist
   */
  const generateArtistRadio = useCallback((
    artistId: string,
    options: EmbeddingPlaylistOptions = {}
  ): GeneratedPlaylist | null => {
    if (!isReady || tracksIndexed < 1) {
      return null;
    }

    const { playlistGenerator } = getInstances();

    return playlistGenerator.generateArtistRadio(artistId, {
      limit: options.limit || 20,
      explorationFactor: options.exploration || 0.2,
      includeCollaborative: options.includeCollaborative ?? true,
      excludeTrackIds: options.excludeTrackIds,
      excludeArtistIds: options.excludeArtistIds,
    });
  }, [isReady, tracksIndexed]);

  /**
   * Generate discovery playlist (new music)
   */
  const generateDiscoveryPlaylist = useCallback((
    options: EmbeddingPlaylistOptions = {}
  ): GeneratedPlaylist | null => {
    if (!isReady || tracksIndexed < 1) {
      return null;
    }

    const { playlistGenerator } = getInstances();

    return playlistGenerator.generateDiscoveryPlaylist({
      limit: options.limit || 20,
      explorationFactor: options.exploration || 0.7,
      includeCollaborative: options.includeCollaborative ?? true,
      excludeTrackIds: options.excludeTrackIds,
      excludeArtistIds: options.excludeArtistIds,
    });
  }, [isReady, tracksIndexed]);

  /**
   * Find similar tracks
   */
  const findSimilarTracks = useCallback((
    trackId: string,
    limit = 20
  ): PlaylistTrack[] => {
    if (!isReady) {
      return [];
    }

    const { playlistGenerator } = getInstances();
    return playlistGenerator.findSimilarTracks(trackId, limit);
  }, [isReady]);

  /**
   * Convert playlist result to UnifiedTrack array
   * IMPORTANT: Clears stale streamInfo/streamSources so TrackResolver fetches fresh streams
   */
  const getTracksFromPlaylist = useCallback((
    playlist: GeneratedPlaylist | null
  ): UnifiedTrack[] => {
    if (!playlist) return [];

    return playlist.tracks
      .map((pt) => {
        const cached = sharedTrackCache.get(pt.trackId);
        if (!cached) return undefined;

        // Clear stale stream info - forces TrackResolver to get fresh streams on play
        // YouTube stream URLs expire, so cached streamInfo causes 403 errors
        return {
          ...cached,
          streamInfo: undefined,
          streamSources: [],
        };
      })
      .filter((t): t is UnifiedTrack => t !== undefined);
  }, []);

  /**
   * Get taste profile stats
   */
  const getTasteStats = useCallback(() => {
    const { tasteProfile } = getInstances();
    const profile = tasteProfile.getProfile();

    if (!profile) {
      return {
        isValid: false,
        interactionCount: tasteProfile.getInteractionCount(),
        topGenres: [],
        topArtists: [],
      };
    }

    return {
      isValid: true,
      interactionCount: profile.stats.tracksContributed,
      topGenres: tasteProfile.getTopGenres(5),
      topArtists: tasteProfile.getTopArtists(5),
      totalListenTime: profile.stats.totalListenTime,
    };
  }, []);

  /**
   * Get index statistics
   */
  const getIndexStats = useCallback(() => {
    const { vectorIndex, cooccurrence } = getInstances();

    return {
      tracksIndexed: vectorIndex.size(),
      cooccurrencePairs: cooccurrence.size(),
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

    // Playlist Generation
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

  // Index tracks on change
  useEffect(() => {
    if (tracks.length > 0) {
      indexTracks(tracks);
    }
  }, [tracks, indexTracks]);

  // Generate playlist when mood changes
  useEffect(() => {
    if (!mood || !isReady) return;

    setLoading(true);
    const playlist = generateMoodPlaylist(mood, options);
    setResult(getTracksFromPlaylist(playlist));
    setLoading(false);
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

    setLoading(true);
    const playlist = generateGenrePlaylist(genre, options);
    setResult(getTracksFromPlaylist(playlist));
    setLoading(false);
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
  const trackCache = useRef(new Map<string, UnifiedTrack>());

  useEffect(() => {
    if (tracks.length > 0) {
      indexTracks(tracks);
      for (const t of tracks) {
        trackCache.current.set(t.id, t);
      }
    }
  }, [tracks, indexTracks]);

  useEffect(() => {
    if (!seedTrackId || !isReady) return;

    const similar = findSimilarTracks(seedTrackId, limit);
    setResult(similar);
  }, [seedTrackId, isReady, findSimilarTracks, limit]);

  const tracksWithData = result
    .map((pt) => {
      const cached = trackCache.current.get(pt.trackId);
      if (!cached) return { ...pt, track: undefined };
      // Clear stale stream info to force fresh resolution
      return {
        ...pt,
        track: { ...cached, streamInfo: undefined, streamSources: [] },
      };
    })
    .filter((t) => t.track !== undefined);

  return { similar: tracksWithData };
}

// ============================================================================
// Standalone Functions for Providers (non-React)
// These can be used by DataProviders in the plugin pipeline
// ============================================================================

/**
 * Get the embedding system instances (initializes if needed)
 */
export function getEmbeddingInstances() {
  return getInstances();
}

/**
 * Get current indexed track count
 */
export function getIndexedTrackCount(): number {
  return sharedTracksIndexed;
}

/**
 * Check if embedding system is ready
 */
export function isEmbeddingReady(): boolean {
  return isInitialized && sharedTracksIndexed > 0;
}

/**
 * Index tracks into the embedding system (standalone version)
 */
export function indexTracksStandalone(tracks: UnifiedTrack[]): number {
  const { playlistGenerator } = getInstances();
  let newlyIndexed = 0;

  for (const track of tracks) {
    if (!sharedIndexedTracks.has(track.id)) {
      const trackData = unifiedTrackToTrackData(track);
      playlistGenerator.registerTrack(trackData);
      sharedIndexedTracks.add(track.id);
      sharedTrackCache.set(track.id, track);
      newlyIndexed++;
    }
  }

  if (newlyIndexed > 0) {
    setSharedTracksIndexed(sharedIndexedTracks.size);
  }

  return newlyIndexed;
}

/**
 * Generate playlist from embedding system (standalone version)
 * Returns tracks ready for playback
 */
export function generateEmbeddingPlaylist(
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
): UnifiedTrack[] {
  if (!isInitialized || sharedTracksIndexed < 1) {
    return [];
  }

  const { playlistGenerator } = getInstances();
  const now = new Date();
  const baseOptions = {
    limit: options.limit || 20,
    explorationFactor: options.exploration || 0.2,
    includeCollaborative: true,
    excludeTrackIds: options.excludeTrackIds,
    contextHour: now.getHours(),
    contextDayOfWeek: now.getDay(),
  };

  let playlist: GeneratedPlaylist | null = null;

  switch (method) {
    case 'personalized':
      playlist = playlistGenerator.generatePersonalizedPlaylist(baseOptions);
      break;
    case 'mood':
      if (options.mood) {
        playlist = playlistGenerator.generateMoodPlaylist(options.mood, baseOptions);
      }
      break;
    case 'genre':
      if (options.genre) {
        playlist = playlistGenerator.generateGenrePlaylist(options.genre, baseOptions);
      }
      break;
    case 'artist-radio':
      if (options.artistId) {
        playlist = playlistGenerator.generateArtistRadio(options.artistId, baseOptions);
      }
      break;
    case 'discovery':
      playlist = playlistGenerator.generateDiscoveryPlaylist({
        ...baseOptions,
        explorationFactor: options.exploration || 0.7,
      });
      break;
    case 'similar':
      if (options.seedTrackIds?.length) {
        playlist = playlistGenerator.generateSeedPlaylist(options.seedTrackIds, baseOptions);
      }
      break;
  }

  if (!playlist) return [];

  // Convert to UnifiedTrack array, clearing stale stream info
  return playlist.tracks
    .map((pt) => {
      const cached = sharedTrackCache.get(pt.trackId);
      if (!cached) return undefined;
      return {
        ...cached,
        streamInfo: undefined,
        streamSources: [],
      };
    })
    .filter((t): t is UnifiedTrack => t !== undefined);
}

/**
 * Get all indexed tracks
 */
export function getAllIndexedTracks(): UnifiedTrack[] {
  return Array.from(sharedTrackCache.values()).map(track => ({
    ...track,
    streamInfo: undefined,
    streamSources: [],
  }));
}
