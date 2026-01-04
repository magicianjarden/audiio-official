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
          sources: ['similar' as const, 'discovery' as const],
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

        // Also get discovery tracks
        const discoveryContext = {
          count: limit / 2,
          sources: ['discovery' as const],
          scoringContext: context,
        };
        const discovery = await this.endpoints.queue.getCandidates(discoveryContext);
        candidates.push(...discovery);
        break;

      case 'genre':
        // Get tracks by genre
        const genreTracks = await this.endpoints.library.getTracksByGenre(seed.id);
        candidates.push(...genreTracks.slice(0, limit));
        break;

      case 'mood':
        // Get tracks matching mood (via discovery)
        const moodContext = {
          count: limit,
          sources: ['discovery' as const, 'library' as const],
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
   * Select tracks with variety (not all top scores)
   */
  private selectWithVariety(
    sorted: Array<{ track: Track; score: number }>,
    count: number
  ): Track[] {
    if (sorted.length <= count) {
      return sorted.map(s => s.track);
    }

    const selected: Track[] = [];
    const artistCounts = new Map<string, number>();
    const maxSameArtist = 2;

    // Take top tracks with artist diversity
    for (const { track } of sorted) {
      if (selected.length >= count) break;

      const artistId = track.artistId || 'unknown';
      const artistCount = artistCounts.get(artistId) || 0;

      if (artistCount < maxSameArtist) {
        selected.push(track);
        artistCounts.set(artistId, artistCount + 1);
      }
    }

    // If we still need more, relax the constraint
    if (selected.length < count) {
      for (const { track } of sorted) {
        if (selected.length >= count) break;
        if (!selected.find(t => t.id === track.id)) {
          selected.push(track);
        }
      }
    }

    // Shuffle slightly to avoid predictability
    return this.shuffleWithBias(selected);
  }

  /**
   * Shuffle with bias toward keeping high scores early
   */
  private shuffleWithBias(tracks: Track[]): Track[] {
    const result = [...tracks];

    // Only shuffle the middle portion
    const fixedStart = Math.floor(tracks.length * 0.3);
    const fixedEnd = Math.floor(tracks.length * 0.9);

    for (let i = fixedStart; i < fixedEnd; i++) {
      const j = fixedStart + Math.floor(Math.random() * (fixedEnd - fixedStart));
      [result[i], result[j]] = [result[j], result[i]];
    }

    return result;
  }

  /**
   * Get session key for a seed
   */
  private getSessionKey(seed: RadioSeed): string {
    return `${seed.type}:${seed.id}`;
  }
}
