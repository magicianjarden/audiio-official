/**
 * Radio Generator - Generates infinite radio playlists from seeds
 */

import type {
  Track,
  RadioSeed,
  ScoringContext,
  MLCoreEndpoints,
  MoodCategory,
} from '../types';
import type { HybridScorer } from './hybrid-scorer';
import { weightedRandomSelect } from '../utils';

const SEED_WEIGHT_INITIAL = 0.7;
const SEED_WEIGHT_DECAY = 0.02;
const SEED_WEIGHT_MIN = 0.3;

export class RadioGenerator {
  private endpoints: MLCoreEndpoints;
  private scorer: HybridScorer;
  private sessionTracks: Map<string, Set<string>> = new Map(); // seedId -> played trackIds
  private seedDrift: Map<string, number> = new Map(); // seedId -> drift amount

  constructor(endpoints: MLCoreEndpoints, scorer: HybridScorer) {
    this.endpoints = endpoints;
    this.scorer = scorer;
  }

  /**
   * Generate radio tracks from a seed
   */
  async generate(
    seed: RadioSeed,
    count: number,
    context: ScoringContext
  ): Promise<Track[]> {
    const sessionKey = this.getSessionKey(seed);

    // Get or create session tracking
    if (!this.sessionTracks.has(sessionKey)) {
      this.sessionTracks.set(sessionKey, new Set());
      this.seedDrift.set(sessionKey, 0);
    }

    const playedTracks = this.sessionTracks.get(sessionKey)!;
    const drift = this.seedDrift.get(sessionKey)!;

    // Calculate current seed weight
    const seedWeight = Math.max(
      SEED_WEIGHT_MIN,
      SEED_WEIGHT_INITIAL - drift * SEED_WEIGHT_DECAY
    );

    // Get candidates based on seed type
    const candidates = await this.getCandidatesForSeed(seed, count * 3, context);

    // Filter out already played
    const freshCandidates = candidates.filter(t => !playedTracks.has(t.id));

    // Score candidates with radio context
    const radioContext: ScoringContext = {
      ...context,
      queueMode: 'radio',
      radioSeed: {
        ...seed,
        drift: drift,
      },
    };

    const scores = await this.scorer.scoreBatch(freshCandidates, radioContext);

    // Apply seed weight to maintain focus
    const adjustedScores = scores.map(score => ({
      ...score,
      finalScore: score.finalScore * seedWeight + score.finalScore * (1 - seedWeight) * Math.random(),
    }));

    // Sort by adjusted score
    const sorted = freshCandidates
      .map((track, i) => ({ track, score: adjustedScores[i].finalScore }))
      .sort((a, b) => b.score - a.score);

    // Select tracks with some randomness
    const selected = this.selectWithVariety(sorted, count);

    // Record played tracks and update drift
    for (const track of selected) {
      playedTracks.add(track.id);
    }
    this.seedDrift.set(sessionKey, drift + selected.length);

    return selected;
  }

  /**
   * Reset radio session for a seed
   */
  resetSession(seed: RadioSeed): void {
    const sessionKey = this.getSessionKey(seed);
    this.sessionTracks.delete(sessionKey);
    this.seedDrift.delete(sessionKey);
  }

  /**
   * Get candidates based on seed type
   */
  private async getCandidatesForSeed(
    seed: RadioSeed,
    limit: number,
    context: ScoringContext
  ): Promise<Track[]> {
    const candidates: Track[] = [];

    switch (seed.type) {
      case 'track':
        // Get similar tracks
        const queueContext = {
          count: limit,
          sources: ['similar' as const, 'library' as const],
          radioSeed: seed,
          scoringContext: context,
        };
        const similar = await this.endpoints.queue.getCandidates(queueContext);
        candidates.push(...similar);
        break;

      case 'artist':
        // Get tracks by artist + similar artists
        const artistTracks = await this.endpoints.library.getTracksByArtist(seed.id);
        candidates.push(...artistTracks.slice(0, limit / 2));

        // Also get library tracks for variety
        const libraryContext = {
          count: limit / 2,
          sources: ['library' as const],
          scoringContext: context,
        };
        const libraryTracks = await this.endpoints.queue.getCandidates(libraryContext);
        candidates.push(...libraryTracks);
        break;

      case 'genre':
        // Get tracks by genre
        const genreTracks = await this.endpoints.library.getTracksByGenre(seed.id);
        candidates.push(...genreTracks.slice(0, limit));
        break;

      case 'mood':
        // Get tracks matching mood from library
        const moodContext = {
          count: limit,
          sources: ['library' as const, 'similar' as const],
          scoringContext: {
            ...context,
            userMood: seed.id as MoodCategory,
          },
        };
        const moodTracks = await this.endpoints.queue.getCandidates(moodContext);
        candidates.push(...moodTracks);
        break;

      case 'playlist':
        // Get playlist tracks + similar
        const playlistTracks = await this.endpoints.library.getPlaylistTracks(seed.id);
        candidates.push(...playlistTracks);

        // Add similar tracks to each playlist track
        for (const track of playlistTracks.slice(0, 5)) {
          const similarContext = {
            count: 10,
            sources: ['similar' as const],
            radioSeed: { type: 'track' as const, id: track.id, name: track.title },
            scoringContext: context,
          };
          const trackSimilar = await this.endpoints.queue.getCandidates(similarContext);
          candidates.push(...trackSimilar);
        }
        break;
    }

    // Deduplicate
    const seen = new Set<string>();
    return candidates.filter(t => {
      if (seen.has(t.id)) return false;
      seen.add(t.id);
      return true;
    });
  }

  /**
   * Select tracks with variety using probabilistic weighted selection
   * Uses softmax-based weighted random to add controlled variety while
   * still favoring higher-scored tracks
   */
  private selectWithVariety(
    sorted: Array<{ track: Track; score: number }>,
    count: number
  ): Track[] {
    if (sorted.length <= count) {
      return sorted.map(s => s.track);
    }

    const maxSameArtist = 2;
    const artistCounts = new Map<string, number>();
    const selected: Track[] = [];

    // Filter candidates by artist diversity as we select
    let remaining = [...sorted];

    while (selected.length < count && remaining.length > 0) {
      // Filter out artists that have reached the limit
      const eligible = remaining.filter(({ track }) => {
        const artistId = track.artistId || 'unknown';
        return (artistCounts.get(artistId) || 0) < maxSameArtist;
      });

      // If no eligible tracks, relax constraint and use remaining
      const candidates = eligible.length > 0 ? eligible : remaining;

      if (candidates.length === 0) break;

      // Use weighted random selection based on scores
      const tracks = candidates.map(c => c.track);
      const scores = candidates.map(c => c.score);

      // Select one track probabilistically
      const [picked] = weightedRandomSelect(tracks, scores, 1);

      if (picked) {
        selected.push(picked);
        const artistId = picked.artistId || 'unknown';
        artistCounts.set(artistId, (artistCounts.get(artistId) || 0) + 1);

        // Remove from remaining
        remaining = remaining.filter(c => c.track.id !== picked.id);
      }
    }

    return selected;
  }

  /**
   * Get session key for a seed
   */
  private getSessionKey(seed: RadioSeed): string {
    return `${seed.type}:${seed.id}`;
  }
}
