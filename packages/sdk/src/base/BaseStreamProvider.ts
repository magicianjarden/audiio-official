/**
 * Base class for stream providers with helper methods
 */

import type {
  AddonManifest,
  StreamProvider,
  StreamTrack,
  StreamSearchOptions,
  StreamInfo,
  Quality
} from '@audiio/core';

export abstract class BaseStreamProvider implements StreamProvider {
  abstract readonly id: string;
  abstract readonly name: string;
  abstract readonly requiresAuth: boolean;
  abstract readonly supportedQualities: Quality[];

  get manifest(): AddonManifest {
    return {
      id: this.id,
      name: this.name,
      version: '1.0.0',
      roles: ['stream-provider']
    };
  }

  async initialize(): Promise<void> {
    // Override in subclass if needed
  }

  async dispose(): Promise<void> {
    // Override in subclass if needed
  }

  abstract search(query: string, options?: StreamSearchOptions): Promise<StreamTrack[]>;
  abstract getStream(trackId: string, quality?: Quality): Promise<StreamInfo>;
  abstract isAuthenticated(): boolean;

  /**
   * Optional: Search by metadata for best match
   */
  async searchByMetadata?(metadata: {
    title: string;
    artist: string;
    album?: string;
    duration?: number;
    isrc?: string;
  }): Promise<StreamTrack | null>;

  /**
   * Helper: Select best quality from available options
   */
  protected selectQuality(available: Quality[], preferred?: Quality): Quality {
    const order: Quality[] = ['lossless', 'high', 'medium', 'low'];

    if (preferred && available.includes(preferred)) {
      return preferred;
    }

    for (const q of order) {
      if (available.includes(q)) {
        return q;
      }
    }

    return available[0] ?? 'medium';
  }

  /**
   * Helper: Calculate match score between tracks
   */
  protected calculateMatchScore(
    candidate: { title: string; artists: string[]; duration?: number },
    target: { title: string; artist: string; duration?: number }
  ): number {
    const normalizedCandidateTitle = this.normalize(candidate.title);
    const normalizedTargetTitle = this.normalize(target.title);
    const normalizedTargetArtist = this.normalize(target.artist);

    // Title similarity (40%)
    const titleScore = this.stringSimilarity(normalizedCandidateTitle, normalizedTargetTitle) * 0.4;

    // Artist match (40%)
    const artistScore = Math.max(
      ...candidate.artists.map(a =>
        this.stringSimilarity(this.normalize(a), normalizedTargetArtist)
      ),
      0
    ) * 0.4;

    // Duration match (20%) - 5 second tolerance
    let durationScore = 0.2;
    if (candidate.duration !== undefined && target.duration !== undefined) {
      const diff = Math.abs(candidate.duration - target.duration);
      durationScore = diff <= 5 ? 0.2 : Math.max(0, 0.2 - (diff / 100));
    }

    return titleScore + artistScore + durationScore;
  }

  /**
   * Helper: Normalize string
   */
  protected normalize(str: string): string {
    return str
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s]/g, '')
      .trim();
  }

  /**
   * Helper: Simple string similarity
   */
  private stringSimilarity(s1: string, s2: string): number {
    if (s1 === s2) return 1;
    if (!s1 || !s2) return 0;

    // Check for substring containment
    if (s1.includes(s2) || s2.includes(s1)) {
      return 0.9;
    }

    // Simple word overlap
    const words1 = new Set(s1.split(/\s+/));
    const words2 = new Set(s2.split(/\s+/));
    const intersection = new Set([...words1].filter(w => words2.has(w)));
    const union = new Set([...words1, ...words2]);

    return intersection.size / union.size;
  }
}
