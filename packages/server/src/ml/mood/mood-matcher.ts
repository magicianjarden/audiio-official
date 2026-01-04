/**
 * MoodMatcher - Matches tracks to mood profiles
 *
 * Uses audio features and genre information to score how well
 * tracks match predefined mood profiles.
 */

import type {
  MoodType,
  MoodProfile,
  MoodMatchResult,
  FeatureRange,
} from '../types';
import { MOOD_PROFILES } from '../utils';

/**
 * Audio features that can be used for mood matching
 */
export interface AudioFeatures {
  energy?: number;
  valence?: number;
  danceability?: number;
  bpm?: number;
  acousticness?: number;
  instrumentalness?: number;
  loudness?: number;
  speechiness?: number;
}

/**
 * Track with features for mood matching
 */
export interface TrackWithFeatures {
  id: string;
  title: string;
  artist: string;
  genres?: string[];
  features?: AudioFeatures;
}

/**
 * Check if a value falls within a range
 */
function isInRange(value: number, range: FeatureRange): boolean {
  return value >= range.min && value <= range.max;
}

/**
 * Calculate how well a value matches a range (0-1)
 * Returns 1.0 if in range, decreases based on distance from range
 */
function rangeScore(value: number | undefined, range: FeatureRange | undefined): number | null {
  if (value === undefined || range === undefined) return null;

  if (isInRange(value, range)) {
    return 1.0;
  }

  // Calculate distance from range
  const rangeMid = (range.min + range.max) / 2;
  const rangeWidth = range.max - range.min;

  // Distance normalized to range width
  const distance = Math.abs(value - rangeMid) - (rangeWidth / 2);
  const normalizedDistance = distance / (rangeWidth || 1);

  // Score decreases with distance, minimum 0
  return Math.max(0, 1 - normalizedDistance * 0.5);
}

/**
 * MoodMatcher class for scoring tracks against mood profiles
 */
export class MoodMatcher {
  private profiles: Record<MoodType, MoodProfile>;

  constructor() {
    this.profiles = MOOD_PROFILES;
  }

  /**
   * Get all available mood profiles
   */
  getProfiles(): MoodProfile[] {
    return Object.values(this.profiles);
  }

  /**
   * Get a specific mood profile
   */
  getProfile(moodId: MoodType): MoodProfile | undefined {
    return this.profiles[moodId];
  }

  /**
   * Score a single track against a mood profile
   */
  matchTrack(track: TrackWithFeatures, moodId: MoodType): MoodMatchResult {
    const profile = this.profiles[moodId];
    if (!profile) {
      return {
        mood: moodId,
        score: 0,
        matchedFeatures: [],
        mismatchedFeatures: [],
      };
    }

    const matchedFeatures: string[] = [];
    const mismatchedFeatures: string[] = [];
    const scores: number[] = [];

    const features = track.features || {};
    const profileFeatures = profile.features;

    // Score audio features
    const featureChecks: [string, number | undefined, FeatureRange | undefined][] = [
      ['energy', features.energy, profileFeatures.energy],
      ['valence', features.valence, profileFeatures.valence],
      ['danceability', features.danceability, profileFeatures.danceability],
      ['bpm', features.bpm, profileFeatures.bpm],
      ['acousticness', features.acousticness, profileFeatures.acousticness],
      ['instrumentalness', features.instrumentalness, profileFeatures.instrumentalness],
    ];

    for (const [name, value, range] of featureChecks) {
      const score = rangeScore(value, range);
      if (score !== null) {
        scores.push(score);
        if (score >= 0.7) {
          matchedFeatures.push(name);
        } else if (score < 0.4) {
          mismatchedFeatures.push(name);
        }
      }
    }

    // Score genre match
    const genres = track.genres?.map(g => g.toLowerCase()) || [];
    const preferredGenres = profile.preferredGenres?.map(g => g.toLowerCase()) || [];
    const excludedGenres = profile.excludedGenres?.map(g => g.toLowerCase()) || [];

    // Check for genre matches
    let genreScore = 0.5; // Default neutral
    const matchedGenres = genres.filter(g =>
      preferredGenres.some(pg => g.includes(pg) || pg.includes(g))
    );
    const excludedMatches = genres.filter(g =>
      excludedGenres.some(eg => g.includes(eg) || eg.includes(g))
    );

    if (matchedGenres.length > 0) {
      genreScore = 0.7 + (matchedGenres.length * 0.1);
      matchedFeatures.push('genre');
    }
    if (excludedMatches.length > 0) {
      genreScore = Math.max(0.1, genreScore - excludedMatches.length * 0.2);
      mismatchedFeatures.push('genre');
    }

    scores.push(Math.min(1, genreScore));

    // Calculate final score
    const avgScore = scores.length > 0
      ? scores.reduce((a, b) => a + b, 0) / scores.length
      : 0.5;

    return {
      mood: moodId,
      score: avgScore,
      matchedFeatures,
      mismatchedFeatures,
    };
  }

  /**
   * Find the best matching mood for a track
   */
  findBestMood(track: TrackWithFeatures): MoodMatchResult {
    let bestResult: MoodMatchResult = {
      mood: 'chill',
      score: 0,
      matchedFeatures: [],
      mismatchedFeatures: [],
    };

    for (const moodId of Object.keys(this.profiles) as MoodType[]) {
      const result = this.matchTrack(track, moodId);
      if (result.score > bestResult.score) {
        bestResult = result;
      }
    }

    return bestResult;
  }

  /**
   * Filter and sort tracks by mood match score
   */
  filterByMood(
    tracks: TrackWithFeatures[],
    moodId: MoodType,
    options?: {
      minScore?: number;
      limit?: number;
    }
  ): Array<TrackWithFeatures & { moodScore: number }> {
    const { minScore = 0.3, limit } = options || {};

    const scored = tracks
      .map(track => ({
        ...track,
        moodScore: this.matchTrack(track, moodId).score,
      }))
      .filter(t => t.moodScore >= minScore)
      .sort((a, b) => b.moodScore - a.moodScore);

    return limit ? scored.slice(0, limit) : scored;
  }

  /**
   * Get search terms for a mood (for API fallback)
   */
  getSearchTerms(moodId: MoodType): string[] {
    return this.profiles[moodId]?.searchTerms || [];
  }

  /**
   * Get a random search query for a mood
   */
  getRandomSearchQuery(moodId: MoodType): string {
    const terms = this.getSearchTerms(moodId);
    if (terms.length === 0) return moodId;
    return terms[Math.floor(Math.random() * terms.length)];
  }
}

// Singleton instance
let moodMatcherInstance: MoodMatcher | null = null;

/**
 * Get the singleton MoodMatcher instance
 */
export function getMoodMatcher(): MoodMatcher {
  if (!moodMatcherInstance) {
    moodMatcherInstance = new MoodMatcher();
  }
  return moodMatcherInstance;
}
