/**
 * Playlist Generator
 *
 * Generates playlists using vector embeddings instead of keyword search.
 * Supports mood-based, genre-based, artist-radio, and personalized playlists.
 */

import type { SimilarityResult, TrackEmbedding } from './types';
import { EmbeddingEngine, type TrackData } from './embedding-engine';
import { VectorIndex } from './vector-index';
import { TasteProfileManager } from './taste-profile';
import { CoOccurrenceMatrix } from './cooccurrence';
import { normalizeVector, averageVectors as avgVectorsUtil, blendVectors as blendVectorsUtil } from '../utils/vector-utils';

/**
 * Playlist generation options
 */
export interface PlaylistOptions {
  limit: number;
  mood?: string;
  genre?: string;
  seedTrackIds?: string[];
  seedArtistId?: string;
  energy?: 'low' | 'medium' | 'high';
  explorationFactor?: number; // 0 = only familiar, 1 = only new
  excludeTrackIds?: string[];
  excludeArtistIds?: string[];
  includeCollaborative?: boolean;
  contextHour?: number;
  contextDayOfWeek?: number;
}

/**
 * Generated playlist result
 */
export interface GeneratedPlaylist {
  tracks: PlaylistTrack[];
  queryVector: Float32Array;
  method: PlaylistMethod;
  stats: PlaylistStats;
}

/**
 * Track in a generated playlist
 */
export interface PlaylistTrack {
  trackId: string;
  score: number;
  reasons: string[];
}

/**
 * Method used to generate playlist
 */
export type PlaylistMethod =
  | 'mood'
  | 'genre'
  | 'artist-radio'
  | 'seed-tracks'
  | 'personalized'
  | 'collaborative'
  | 'discovery'
  | 'hybrid';

/**
 * Statistics about the generated playlist
 */
export interface PlaylistStats {
  candidatesConsidered: number;
  embeddingSearchTime: number;
  collaborativeBoost: number;
  avgSimilarity: number;
}

/**
 * Playlist Generator
 *
 * Uses the embedding system to generate high-quality playlists
 * without relying on keyword search.
 */
export class PlaylistGenerator {
  private embeddingEngine: EmbeddingEngine;
  private vectorIndex: VectorIndex;
  private tasteProfile: TasteProfileManager | null;
  private cooccurrence: CoOccurrenceMatrix;
  private trackMetadata = new Map<string, TrackData>();

  constructor(
    embeddingEngine: EmbeddingEngine,
    vectorIndex: VectorIndex,
    cooccurrence: CoOccurrenceMatrix,
    tasteProfile?: TasteProfileManager
  ) {
    this.embeddingEngine = embeddingEngine;
    this.vectorIndex = vectorIndex;
    this.cooccurrence = cooccurrence;
    this.tasteProfile = tasteProfile ?? null;
  }

  /**
   * Set the taste profile manager
   */
  setTasteProfile(profile: TasteProfileManager): void {
    this.tasteProfile = profile;
  }

  /**
   * Register track metadata for the generator
   */
  registerTrack(track: TrackData): void {
    this.trackMetadata.set(track.id, track);

    // Generate and index embedding
    const embedding = this.embeddingEngine.getOrGenerateEmbedding(track);
    this.vectorIndex.add(track.id, embedding.vector);
  }

  /**
   * Register multiple tracks
   */
  registerTracks(tracks: TrackData[]): void {
    for (const track of tracks) {
      this.registerTrack(track);
    }
  }

  /**
   * Generate a mood-based playlist
   */
  generateMoodPlaylist(
    mood: string,
    options: Partial<PlaylistOptions> = {}
  ): GeneratedPlaylist {
    const opts = this.normalizeOptions(options);
    const startTime = Date.now();

    // Generate mood query vector
    let queryVector = this.embeddingEngine.generateMoodVector(mood);

    // Blend with user taste if available
    if (this.tasteProfile && opts.explorationFactor !== 1) {
      const blended = this.tasteProfile.blendWithMood(
        queryVector,
        0.6 + opts.explorationFactor! * 0.3 // More exploration = more mood weight
      );
      if (blended) {
        queryVector = blended;
      }
    }

    // Search for similar tracks
    const candidates = this.vectorIndex.searchByCosine(queryVector, opts.limit * 3);

    // Filter and rank
    const filtered = this.filterCandidates(candidates, opts);
    const ranked = this.rankWithCollaborative(filtered, opts);
    const tracks = this.selectFinal(ranked, opts);

    return {
      tracks,
      queryVector,
      method: 'mood',
      stats: {
        candidatesConsidered: candidates.length,
        embeddingSearchTime: Date.now() - startTime,
        collaborativeBoost: opts.includeCollaborative ? 0.2 : 0,
        avgSimilarity: this.calculateAvgSimilarity(tracks),
      },
    };
  }

  /**
   * Generate a genre-based playlist
   */
  generateGenrePlaylist(
    genre: string,
    options: Partial<PlaylistOptions> = {}
  ): GeneratedPlaylist {
    const opts = this.normalizeOptions(options);
    const startTime = Date.now();

    // Generate genre query vector
    let queryVector = this.embeddingEngine.generateGenreQueryVector(genre);

    // Blend with user taste
    if (this.tasteProfile && opts.explorationFactor !== 1) {
      const tasteVector = this.tasteProfile.getTasteVector();
      if (tasteVector) {
        queryVector = normalizeVector(blendVectorsUtil(
          queryVector,
          tasteVector,
          0.7, // Genre weight
          0.3 // Taste weight
        ));
      }
    }

    // Search
    const candidates = this.vectorIndex.searchByCosine(queryVector, opts.limit * 3);
    const filtered = this.filterCandidates(candidates, opts);
    const ranked = this.rankWithCollaborative(filtered, opts);
    const tracks = this.selectFinal(ranked, opts);

    return {
      tracks,
      queryVector,
      method: 'genre',
      stats: {
        candidatesConsidered: candidates.length,
        embeddingSearchTime: Date.now() - startTime,
        collaborativeBoost: opts.includeCollaborative ? 0.2 : 0,
        avgSimilarity: this.calculateAvgSimilarity(tracks),
      },
    };
  }

  /**
   * Generate a seed-track based playlist (like "Song Radio")
   */
  generateSeedPlaylist(
    seedTrackIds: string[],
    options: Partial<PlaylistOptions> = {}
  ): GeneratedPlaylist {
    const opts = this.normalizeOptions({ ...options, seedTrackIds });
    const startTime = Date.now();

    // Get embeddings for seed tracks
    const seedEmbeddings: Float32Array[] = [];
    for (const trackId of seedTrackIds) {
      const embedding = this.embeddingEngine.getEmbedding(trackId);
      if (embedding) {
        seedEmbeddings.push(embedding.vector);
      }
    }

    if (seedEmbeddings.length === 0) {
      return this.generatePersonalizedPlaylist(options);
    }

    // Average seed embeddings
    let queryVector = normalizeVector(avgVectorsUtil(seedEmbeddings));

    // Light blend with user taste
    if (this.tasteProfile) {
      const tasteVector = this.tasteProfile.getTasteVector();
      if (tasteVector) {
        queryVector = normalizeVector(blendVectorsUtil(queryVector, tasteVector, 0.8, 0.2));
      }
    }

    // Search
    const candidates = this.vectorIndex.searchByCosine(queryVector, opts.limit * 3);

    // Get collaborative candidates from co-occurrence
    const collaborativeCandidates = this.cooccurrence.getRelatedTracksMultiple(
      seedTrackIds,
      opts.limit
    );

    // Merge candidates
    const merged = this.mergeCandidates(candidates, collaborativeCandidates, 0.7, 0.3);
    const filtered = this.filterCandidates(merged, opts);
    const tracks = this.selectFinal(filtered, opts);

    return {
      tracks,
      queryVector,
      method: 'seed-tracks',
      stats: {
        candidatesConsidered: candidates.length + collaborativeCandidates.length,
        embeddingSearchTime: Date.now() - startTime,
        collaborativeBoost: collaborativeCandidates.length > 0 ? 0.3 : 0,
        avgSimilarity: this.calculateAvgSimilarity(tracks),
      },
    };
  }

  /**
   * Generate a personalized playlist for the user
   */
  generatePersonalizedPlaylist(
    options: Partial<PlaylistOptions> = {}
  ): GeneratedPlaylist {
    const opts = this.normalizeOptions(options);
    const startTime = Date.now();

    let queryVector: Float32Array;
    let method: PlaylistMethod = 'personalized';

    if (this.tasteProfile && this.tasteProfile.isProfileValid()) {
      // Use contextual taste if available
      if (opts.contextHour !== undefined && opts.contextDayOfWeek !== undefined) {
        queryVector = this.tasteProfile.getContextualVector(
          opts.contextHour,
          opts.contextDayOfWeek
        );
      } else {
        queryVector = this.tasteProfile.getTasteVector()!;
      }

      // Add exploration if requested
      if (opts.explorationFactor && opts.explorationFactor > 0) {
        const explorationVector = this.tasteProfile.getExplorationVector();
        if (explorationVector) {
          queryVector = normalizeVector(blendVectorsUtil(
            queryVector,
            explorationVector,
            1 - opts.explorationFactor,
            opts.explorationFactor
          ));
          method = 'discovery';
        }
      }
    } else {
      // No taste profile - generate neutral query or use popular
      queryVector = this.generatePopularityVector();
      method = 'discovery';
    }

    // Search
    const candidates = this.vectorIndex.searchByCosine(queryVector, opts.limit * 3);
    const filtered = this.filterCandidates(candidates, opts);
    const ranked = this.rankWithCollaborative(filtered, opts);
    const tracks = this.selectFinal(ranked, opts);

    return {
      tracks,
      queryVector,
      method,
      stats: {
        candidatesConsidered: candidates.length,
        embeddingSearchTime: Date.now() - startTime,
        collaborativeBoost: opts.includeCollaborative ? 0.2 : 0,
        avgSimilarity: this.calculateAvgSimilarity(tracks),
      },
    };
  }

  /**
   * Generate an artist radio playlist
   */
  generateArtistRadio(
    artistId: string,
    options: Partial<PlaylistOptions> = {}
  ): GeneratedPlaylist {
    const opts = this.normalizeOptions({ ...options, seedArtistId: artistId });
    const startTime = Date.now();

    // Find all tracks by this artist
    const artistTracks: TrackData[] = [];
    for (const track of this.trackMetadata.values()) {
      if (track.artistId === artistId) {
        artistTracks.push(track);
      }
    }

    if (artistTracks.length === 0) {
      return this.generatePersonalizedPlaylist(options);
    }

    // Get embeddings for artist's tracks
    const artistEmbeddings: Float32Array[] = [];
    for (const track of artistTracks) {
      const embedding = this.embeddingEngine.getEmbedding(track.id);
      if (embedding) {
        artistEmbeddings.push(embedding.vector);
      }
    }

    // Create artist "sound" vector
    let queryVector = normalizeVector(avgVectorsUtil(artistEmbeddings));

    // Light personalization
    if (this.tasteProfile) {
      const tasteVector = this.tasteProfile.getTasteVector();
      if (tasteVector) {
        queryVector = normalizeVector(blendVectorsUtil(queryVector, tasteVector, 0.85, 0.15));
      }
    }

    // Search
    const candidates = this.vectorIndex.searchByCosine(queryVector, opts.limit * 3);

    // Collaborative boost from artist's tracks
    const artistTrackIds = artistTracks.map((t) => t.id);
    const collaborativeCandidates = this.cooccurrence.getRelatedTracksMultiple(
      artistTrackIds.slice(0, 10),
      opts.limit
    );

    const merged = this.mergeCandidates(candidates, collaborativeCandidates, 0.7, 0.3);
    const filtered = this.filterCandidates(merged, opts);
    const tracks = this.selectFinal(filtered, opts);

    return {
      tracks,
      queryVector,
      method: 'artist-radio',
      stats: {
        candidatesConsidered: candidates.length + collaborativeCandidates.length,
        embeddingSearchTime: Date.now() - startTime,
        collaborativeBoost: 0.3,
        avgSimilarity: this.calculateAvgSimilarity(tracks),
      },
    };
  }

  /**
   * Generate energy-based playlist
   */
  generateEnergyPlaylist(
    energy: 'low' | 'medium' | 'high',
    options: Partial<PlaylistOptions> = {}
  ): GeneratedPlaylist {
    // Map energy to moods
    const moodMap: Record<string, string> = {
      low: 'chill',
      medium: 'happy',
      high: 'energetic',
    };

    return this.generateMoodPlaylist(moodMap[energy], {
      ...options,
      energy,
    });
  }

  /**
   * Generate discovery playlist (new music for user)
   */
  generateDiscoveryPlaylist(
    options: Partial<PlaylistOptions> = {}
  ): GeneratedPlaylist {
    return this.generatePersonalizedPlaylist({
      ...options,
      explorationFactor: 0.7, // High exploration
    });
  }

  /**
   * Find similar tracks to a given track
   */
  findSimilarTracks(trackId: string, limit = 20): PlaylistTrack[] {
    const embedding = this.embeddingEngine.getEmbedding(trackId);
    if (!embedding) {
      return [];
    }

    // Embedding similarity
    const embeddingResults = this.vectorIndex.searchByCosine(embedding.vector, limit * 2);

    // Co-occurrence similarity
    const cooccurrenceResults = this.cooccurrence.getRelatedTracks(trackId, limit);

    // Merge
    const merged = this.mergeCandidates(embeddingResults, cooccurrenceResults, 0.6, 0.4);

    // Filter out the seed track
    return merged
      .filter((r) => r.trackId !== trackId)
      .slice(0, limit)
      .map((r) => ({
        trackId: r.trackId,
        score: r.score,
        reasons: this.generateReasons(r.trackId, trackId),
      }));
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  /**
   * Normalize options with defaults
   */
  private normalizeOptions(options: Partial<PlaylistOptions>): PlaylistOptions {
    return {
      limit: 20,
      explorationFactor: 0.2,
      includeCollaborative: true,
      ...options,
      excludeTrackIds: options.excludeTrackIds || [],
      excludeArtistIds: options.excludeArtistIds || [],
    };
  }

  /**
   * Filter candidates based on exclusions
   */
  private filterCandidates(
    candidates: SimilarityResult[],
    options: PlaylistOptions
  ): SimilarityResult[] {
    const excludeSet = new Set(options.excludeTrackIds);
    const excludeArtistSet = new Set(options.excludeArtistIds);

    // Also exclude seed tracks
    if (options.seedTrackIds) {
      for (const id of options.seedTrackIds) {
        excludeSet.add(id);
      }
    }

    return candidates.filter((c) => {
      if (excludeSet.has(c.trackId)) return false;

      const track = this.trackMetadata.get(c.trackId);
      if (track && track.artistId && excludeArtistSet.has(track.artistId)) {
        return false;
      }

      return true;
    });
  }

  /**
   * Rank candidates with collaborative filtering boost
   */
  private rankWithCollaborative(
    candidates: SimilarityResult[],
    options: PlaylistOptions
  ): SimilarityResult[] {
    if (!options.includeCollaborative || !options.seedTrackIds?.length) {
      return candidates;
    }

    const collaborativeScores = new Map<string, number>();
    const related = this.cooccurrence.getRelatedTracksMultiple(
      options.seedTrackIds,
      100
    );

    for (const { trackId, score } of related) {
      collaborativeScores.set(trackId, score);
    }

    // Boost candidates that appear in collaborative results
    return candidates
      .map((c) => {
        const collabScore = collaborativeScores.get(c.trackId) || 0;
        const boost = collabScore > 0 ? Math.log1p(collabScore) * 0.1 : 0;
        return {
          ...c,
          score: c.score + boost,
        };
      })
      .sort((a, b) => b.score - a.score);
  }

  /**
   * Select final tracks with diversity
   */
  private selectFinal(
    candidates: SimilarityResult[],
    options: PlaylistOptions
  ): PlaylistTrack[] {
    const selected: PlaylistTrack[] = [];
    const selectedArtists = new Set<string>();
    const artistLimit = 3; // Max tracks per artist

    for (const candidate of candidates) {
      if (selected.length >= options.limit) break;

      const track = this.trackMetadata.get(candidate.trackId);

      // Limit per artist for diversity
      if (track?.artistId) {
        const artistCount = Array.from(selected).filter(
          (s) => this.trackMetadata.get(s.trackId)?.artistId === track.artistId
        ).length;

        if (artistCount >= artistLimit) continue;
      }

      selected.push({
        trackId: candidate.trackId,
        score: candidate.score,
        reasons: this.generateReasons(candidate.trackId, options.seedTrackIds?.[0]),
      });
    }

    return selected;
  }

  /**
   * Merge two sets of candidates
   */
  private mergeCandidates(
    embeddingResults: SimilarityResult[],
    collaborativeResults: Array<{ trackId: string; score: number }>,
    embeddingWeight: number,
    collaborativeWeight: number
  ): SimilarityResult[] {
    const merged = new Map<string, number>();

    // Normalize and add embedding results
    const maxEmbedding = Math.max(...embeddingResults.map((r) => r.score), 0.001);
    for (const r of embeddingResults) {
      const normalizedScore = (r.score / maxEmbedding) * embeddingWeight;
      merged.set(r.trackId, normalizedScore);
    }

    // Normalize and add collaborative results
    const maxCollab = Math.max(...collaborativeResults.map((r) => r.score), 0.001);
    for (const r of collaborativeResults) {
      const normalizedScore = (r.score / maxCollab) * collaborativeWeight;
      merged.set(r.trackId, (merged.get(r.trackId) || 0) + normalizedScore);
    }

    return Array.from(merged.entries())
      .map(([trackId, score]) => ({ trackId, score, distance: 1 - score }))
      .sort((a, b) => b.score - a.score);
  }

  /**
   * Generate a popularity-based vector (for new users)
   */
  private generatePopularityVector(): Float32Array {
    // Use a balanced "pop" style vector
    return this.embeddingEngine.generateGenreQueryVector('pop');
  }

  /**
   * Calculate average similarity score
   */
  private calculateAvgSimilarity(tracks: PlaylistTrack[]): number {
    if (tracks.length === 0) return 0;
    return tracks.reduce((sum, t) => sum + t.score, 0) / tracks.length;
  }

  /**
   * Generate explanation reasons for why a track was selected
   */
  private generateReasons(trackId: string, seedTrackId?: string): string[] {
    const reasons: string[] = [];
    const track = this.trackMetadata.get(trackId);

    if (!track) {
      return ['Similar sound'];
    }

    if (track.genres && track.genres.length > 0) {
      reasons.push(`${track.genres[0]} vibes`);
    }

    if (seedTrackId) {
      const cooccurrenceScore = this.cooccurrence.getScore(trackId, seedTrackId);
      if (cooccurrenceScore > 5) {
        reasons.push('Frequently played together');
      }
    }

    if (this.tasteProfile) {
      const embedding = this.embeddingEngine.getEmbedding(trackId);
      if (embedding) {
        const similarity = this.tasteProfile.calculateTrackSimilarity(embedding.vector);
        if (similarity > 0.7) {
          reasons.push('Matches your taste');
        }
      }
    }

    if (reasons.length === 0) {
      reasons.push('Similar sound');
    }

    return reasons;
  }

  /**
   * Get track metadata
   */
  getTrackMetadata(trackId: string): TrackData | undefined {
    return this.trackMetadata.get(trackId);
  }

  /**
   * Get index size
   */
  getIndexSize(): number {
    return this.vectorIndex.size();
  }
}
