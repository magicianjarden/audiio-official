/**
 * Track matching service for cross-provider matching
 * Uses ISRC when available, falls back to fuzzy matching
 */

import type { MetadataTrack, StreamTrack } from '../types/addon';

interface MatchCandidate {
  id: string;
  title: string;
  artist: string;
  duration?: number;
  isrc?: string;
}

export class TrackMatcher {
  private lastMatchConfidence = 0;

  /**
   * Find the best matching track from candidates
   */
  findBestMatch(
    source: MetadataTrack,
    candidates: MatchCandidate[]
  ): MatchCandidate | null {
    if (candidates.length === 0) {
      this.lastMatchConfidence = 0;
      return null;
    }

    // Strategy 1: ISRC exact match (most reliable)
    if (source.externalIds?.isrc) {
      const isrcMatch = candidates.find(c => c.isrc === source.externalIds?.isrc);
      if (isrcMatch) {
        this.lastMatchConfidence = 1.0;
        return isrcMatch;
      }
    }

    // Strategy 2: Fuzzy matching on title + artist + duration
    const targetTitle = this.normalize(source.title);
    const targetArtist = this.normalize(source.artists[0]?.name ?? '');
    const targetDuration = source.duration;

    let bestMatch: MatchCandidate | null = null;
    let bestScore = 0;

    for (const candidate of candidates) {
      const score = this.calculateMatchScore(
        targetTitle,
        targetArtist,
        targetDuration,
        this.normalize(candidate.title),
        this.normalize(candidate.artist),
        candidate.duration
      );

      if (score > bestScore && score >= 0.7) {
        bestScore = score;
        bestMatch = candidate;
      }
    }

    this.lastMatchConfidence = bestScore;
    return bestMatch;
  }

  /**
   * Match a metadata track to stream tracks
   */
  findBestStreamMatch(
    source: MetadataTrack,
    streamTracks: StreamTrack[]
  ): StreamTrack | null {
    const candidates: MatchCandidate[] = streamTracks.map(st => ({
      id: st.id,
      title: st.title,
      artist: st.artists[0] ?? '',
      duration: st.duration
    }));

    const match = this.findBestMatch(source, candidates);
    if (!match) return null;

    return streamTracks.find(st => st.id === match.id) ?? null;
  }

  /**
   * Get the confidence score of the last match
   */
  getLastMatchConfidence(): number {
    return this.lastMatchConfidence;
  }

  /**
   * Calculate match score between two tracks
   */
  private calculateMatchScore(
    targetTitle: string,
    targetArtist: string,
    targetDuration: number | undefined,
    candidateTitle: string,
    candidateArtist: string,
    candidateDuration: number | undefined
  ): number {
    // Title similarity (50% weight)
    const titleScore = this.stringSimilarity(targetTitle, candidateTitle) * 0.5;

    // Artist similarity (35% weight)
    const artistScore = this.stringSimilarity(targetArtist, candidateArtist) * 0.35;

    // Duration similarity (15% weight) - allow 5 second variance
    let durationScore = 0.15;
    if (targetDuration !== undefined && candidateDuration !== undefined) {
      const diff = Math.abs(targetDuration - candidateDuration);
      durationScore = diff <= 5 ? 0.15 : Math.max(0, 0.15 - (diff / 100));
    }

    return titleScore + artistScore + durationScore;
  }

  /**
   * Normalize string for comparison
   */
  private normalize(str: string): string {
    return str
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
      .replace(/[^a-z0-9\s]/g, '')     // Remove special chars
      .replace(/\s+/g, ' ')            // Normalize whitespace
      .trim();
  }

  /**
   * Calculate string similarity using Levenshtein distance
   */
  private stringSimilarity(s1: string, s2: string): number {
    if (s1 === s2) return 1;
    if (!s1 || !s2) return 0;

    const longer = s1.length > s2.length ? s1 : s2;
    const shorter = s1.length > s2.length ? s2 : s1;
    const longerLength = longer.length;

    if (longerLength === 0) return 1;

    const distance = this.levenshteinDistance(longer, shorter);
    return (longerLength - distance) / longerLength;
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  private levenshteinDistance(s1: string, s2: string): number {
    const costs: number[] = [];

    for (let i = 0; i <= s1.length; i++) {
      let lastValue = i;
      for (let j = 0; j <= s2.length; j++) {
        if (i === 0) {
          costs[j] = j;
        } else if (j > 0) {
          let newValue = costs[j - 1]!;
          if (s1.charAt(i - 1) !== s2.charAt(j - 1)) {
            newValue = Math.min(Math.min(newValue, lastValue), costs[j]!) + 1;
          }
          costs[j - 1] = lastValue;
          lastValue = newValue;
        }
      }
      if (i > 0) costs[s2.length] = lastValue;
    }

    return costs[s2.length]!;
  }
}
