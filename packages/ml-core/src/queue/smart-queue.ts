/**
 * Smart Queue - Intelligent queue management
 */

import type {
  Track,
  ScoringContext,
  QueueMode,
  RadioSeed,
  QueueConfig,
  QueueCandidateContext,
  CandidateSource,
} from '@audiio/ml-sdk';

const STORAGE_KEY = 'audiio-ml-queue-config';
const MAX_SESSION_HISTORY = 200;

export class SmartQueue {
  private queue: Track[] = [];
  private sessionHistory: Track[] = [];
  private sessionArtists: Set<string> = new Set();
  private config: QueueConfig;

  // External data sources (set by MLEngine)
  private libraryProvider?: () => Promise<Track[]>;
  private similarProvider?: (trackId: string, limit: number) => Promise<Track[]>;
  private discoveryProvider?: (context: ScoringContext) => Promise<Track[]>;
  private trendingProvider?: () => Promise<Track[]>;

  constructor() {
    this.config = {
      mode: 'auto',
      replenishThreshold: 2,
      replenishCount: 10,
      maxSameArtist: 2,
      allowExplicit: true,
    };

    this.loadConfig();
  }

  // ============================================================================
  // Configuration
  // ============================================================================

  /**
   * Load configuration from storage
   */
  private loadConfig(): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        this.config = { ...this.config, ...JSON.parse(stored) };
      }
    } catch (error) {
      console.warn('[SmartQueue] Failed to load config:', error);
    }
  }

  /**
   * Save configuration to storage
   */
  private saveConfig(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.config));
    } catch (error) {
      console.warn('[SmartQueue] Failed to save config:', error);
    }
  }

  /**
   * Get queue configuration
   */
  getConfig(): QueueConfig {
    return { ...this.config };
  }

  /**
   * Update queue configuration
   */
  setConfig(config: Partial<QueueConfig>): void {
    this.config = { ...this.config, ...config };
    this.saveConfig();
  }

  /**
   * Set queue mode
   */
  setMode(mode: QueueMode): void {
    this.config.mode = mode;
    this.saveConfig();
  }

  // ============================================================================
  // Data Providers
  // ============================================================================

  /**
   * Set library provider
   */
  setLibraryProvider(provider: () => Promise<Track[]>): void {
    this.libraryProvider = provider;
  }

  /**
   * Set similar tracks provider
   */
  setSimilarProvider(provider: (trackId: string, limit: number) => Promise<Track[]>): void {
    this.similarProvider = provider;
  }

  /**
   * Set discovery provider
   */
  setDiscoveryProvider(provider: (context: ScoringContext) => Promise<Track[]>): void {
    this.discoveryProvider = provider;
  }

  /**
   * Set trending provider
   */
  setTrendingProvider(provider: () => Promise<Track[]>): void {
    this.trendingProvider = provider;
  }

  // ============================================================================
  // Queue Operations
  // ============================================================================

  /**
   * Get current queue
   */
  getCurrentQueue(): Track[] {
    return [...this.queue];
  }

  /**
   * Get session history
   */
  getSessionHistory(): Track[] {
    return [...this.sessionHistory];
  }

  /**
   * Check if track is in queue
   */
  isInQueue(trackId: string): boolean {
    return this.queue.some(t => t.id === trackId);
  }

  /**
   * Check if track was played in session
   */
  wasPlayedInSession(trackId: string): boolean {
    return this.sessionHistory.some(t => t.id === trackId);
  }

  /**
   * Add track to queue
   */
  addToQueue(track: Track, position: 'next' | 'last' | number = 'last'): void {
    // Remove if already in queue
    this.queue = this.queue.filter(t => t.id !== track.id);

    if (position === 'next') {
      this.queue.unshift(track);
    } else if (position === 'last') {
      this.queue.push(track);
    } else {
      this.queue.splice(position, 0, track);
    }
  }

  /**
   * Remove track from queue
   */
  removeFromQueue(trackId: string): void {
    this.queue = this.queue.filter(t => t.id !== trackId);
  }

  /**
   * Clear queue
   */
  clearQueue(): void {
    this.queue = [];
  }

  /**
   * Pop next track from queue
   */
  popNext(): Track | undefined {
    const track = this.queue.shift();
    if (track) {
      this.recordPlayed(track);
    }
    return track;
  }

  /**
   * Record a track as played
   */
  recordPlayed(track: Track): void {
    this.sessionHistory.push(track);

    if (track.artistId) {
      this.sessionArtists.add(track.artistId);
    }

    // Trim history
    if (this.sessionHistory.length > MAX_SESSION_HISTORY) {
      this.sessionHistory = this.sessionHistory.slice(-MAX_SESSION_HISTORY);
    }
  }

  /**
   * Reset session
   */
  resetSession(): void {
    this.sessionHistory = [];
    this.sessionArtists.clear();
  }

  // ============================================================================
  // Candidate Retrieval
  // ============================================================================

  /**
   * Get candidates for queue replenishment
   */
  async getCandidates(context: QueueCandidateContext): Promise<Track[]> {
    const candidates: Track[] = [];
    const seen = new Set<string>();

    // Add exclusions
    for (const id of context.exclude || []) {
      seen.add(id);
    }

    // Add current queue to exclusions
    for (const track of this.queue) {
      seen.add(track.id);
    }

    // Add session history to exclusions
    for (const track of this.sessionHistory) {
      seen.add(track.id);
    }

    // Fetch from each source
    for (const source of context.sources) {
      const sourceCandidates = await this.fetchFromSource(source, context);

      for (const track of sourceCandidates) {
        if (!seen.has(track.id)) {
          seen.add(track.id);
          candidates.push(track);
        }
      }

      // Stop if we have enough
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

        case 'liked':
          // TODO: Get liked tracks from library
          return [];

        case 'similar':
          if (!this.similarProvider) return [];
          const currentTrack = context.scoringContext.currentTrack;
          if (!currentTrack) return [];
          return this.similarProvider(currentTrack.id, limit);

        case 'discovery':
          return this.discoveryProvider
            ? await this.discoveryProvider(context.scoringContext)
            : [];

        case 'trending':
          return this.trendingProvider ? await this.trendingProvider() : [];

        case 'radio':
          if (!context.radioSeed || !this.similarProvider) return [];
          if (context.radioSeed.type === 'track') {
            return this.similarProvider(context.radioSeed.id, limit);
          }
          // TODO: Handle other seed types
          return [];

        default:
          return [];
      }
    } catch (error) {
      console.warn(`[SmartQueue] Failed to fetch from ${source}:`, error);
      return [];
    }
  }

  /**
   * Submit ranking from algorithm
   */
  submitRanking(tracks: Array<{ track: Track; score: import('@audiio/ml-sdk').TrackScore }>): void {
    // Filter by max same artist
    const artistCounts = new Map<string, number>();
    const filtered: Track[] = [];

    for (const { track } of tracks) {
      const artistId = track.artistId || 'unknown';
      const count = artistCounts.get(artistId) || 0;

      if (count < this.config.maxSameArtist) {
        filtered.push(track);
        artistCounts.set(artistId, count + 1);
      }
    }

    // Add to queue
    for (const track of filtered) {
      if (!this.isInQueue(track.id)) {
        this.queue.push(track);
      }
    }
  }

  /**
   * Check if queue needs replenishment
   */
  needsReplenishment(): boolean {
    if (this.config.mode === 'manual') return false;
    return this.queue.length <= this.config.replenishThreshold;
  }

  /**
   * Get session artists
   */
  getSessionArtists(): string[] {
    return Array.from(this.sessionArtists);
  }

  /**
   * Get session genres
   */
  getSessionGenres(): string[] {
    const genres = new Set<string>();
    for (const track of this.sessionHistory) {
      if (track.genre) genres.add(track.genre);
    }
    return Array.from(genres);
  }
}
