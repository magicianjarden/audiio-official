/**
 * Smart Queue - Candidate retrieval for ML queue replenishment
 *
 * This class is responsible for:
 * - Fetching candidates from various sources (library, similar tracks)
 * - Tracking session history to avoid repetition
 * - Providing diversity through artist/genre tracking
 *
 * Note: Actual queue state management is handled client-side.
 * This server-side component only provides candidates for scoring.
 */

import type {
  Track,
  ScoringContext,
  QueueCandidateContext,
  CandidateSource,
} from '../types';

const MAX_SESSION_HISTORY = 200;

export class SmartQueue {
  private sessionHistory: Track[] = [];
  private sessionArtists: Set<string> = new Set();

  // External data providers (set by MLService)
  private libraryProvider?: () => Promise<Track[]>;
  private similarProvider?: (trackId: string, limit: number) => Promise<Track[]>;

  // ============================================================================
  // Data Providers
  // ============================================================================

  /**
   * Set library provider - returns all available tracks
   */
  setLibraryProvider(provider: () => Promise<Track[]>): void {
    this.libraryProvider = provider;
  }

  /**
   * Set similar tracks provider - finds similar tracks to a given track
   */
  setSimilarProvider(provider: (trackId: string, limit: number) => Promise<Track[]>): void {
    this.similarProvider = provider;
  }

  // ============================================================================
  // Session Tracking
  // ============================================================================

  /**
   * Get session history
   */
  getSessionHistory(): Track[] {
    return [...this.sessionHistory];
  }

  /**
   * Check if track was played in session
   */
  wasPlayedInSession(trackId: string): boolean {
    return this.sessionHistory.some(t => t.id === trackId);
  }

  /**
   * Record a track as played (for session diversity)
   */
  recordPlayed(track: Track): void {
    this.sessionHistory.push(track);

    if (track.artistId) {
      this.sessionArtists.add(track.artistId);
    }

    // Trim history to prevent unbounded growth
    if (this.sessionHistory.length > MAX_SESSION_HISTORY) {
      this.sessionHistory = this.sessionHistory.slice(-MAX_SESSION_HISTORY);
    }
  }

  /**
   * Reset session (e.g., when user starts fresh listening session)
   */
  resetSession(): void {
    this.sessionHistory = [];
    this.sessionArtists.clear();
  }

  /**
   * Get artists played in current session
   */
  getSessionArtists(): string[] {
    return Array.from(this.sessionArtists);
  }

  /**
   * Get genres played in current session
   */
  getSessionGenres(): string[] {
    const genres = new Set<string>();
    for (const track of this.sessionHistory) {
      if (track.genre) genres.add(track.genre);
    }
    return Array.from(genres);
  }

  // ============================================================================
  // Candidate Retrieval
  // ============================================================================

  /**
   * Get candidates for queue replenishment
   * Returns tracks from configured sources, excluding already-played tracks
   */
  async getCandidates(context: QueueCandidateContext): Promise<Track[]> {
    const candidates: Track[] = [];
    const seen = new Set<string>();

    // Add explicit exclusions
    for (const id of context.exclude || []) {
      seen.add(id);
    }

    // Exclude session history to avoid repetition
    for (const track of this.sessionHistory) {
      seen.add(track.id);
    }

    // Fetch from each source in priority order
    for (const source of context.sources) {
      const sourceCandidates = await this.fetchFromSource(source, context);

      for (const track of sourceCandidates) {
        if (!seen.has(track.id)) {
          seen.add(track.id);
          candidates.push(track);
        }
      }

      // Stop early if we have enough candidates
      if (candidates.length >= context.count) break;
    }

    return candidates.slice(0, context.count);
  }

  /**
   * Fetch candidates from a specific source
   */
  private async fetchFromSource(
    source: CandidateSource,
    context: QueueCandidateContext
  ): Promise<Track[]> {
    const limit = Math.min(context.count, 50);

    try {
      switch (source) {
        case 'library':
          return this.libraryProvider ? await this.libraryProvider() : [];

        case 'similar':
          if (!this.similarProvider) return [];
          const currentTrack = context.scoringContext.currentTrack;
          if (!currentTrack) return [];
          return this.similarProvider(currentTrack.id, limit);

        case 'radio':
          if (!context.radioSeed || !this.similarProvider) return [];
          if (context.radioSeed.type === 'track') {
            return this.similarProvider(context.radioSeed.id, limit);
          }
          return [];

        default:
          return [];
      }
    } catch (error) {
      console.warn(`[SmartQueue] Failed to fetch from ${source}:`, error);
      return [];
    }
  }
}
