/**
 * Built-in Result Transformers
 * Default transformers that enhance Discover "See All" results
 */

import type { UnifiedTrack } from '@audiio/core';
import type { ResultTransformer, SeeAllContext } from './plugin-pipeline';
import type { StructuredSectionQuery } from './types';

/**
 * Helper to get the primary artist ID from a track
 */
function getArtistId(track: UnifiedTrack): string {
  if (!track.artists || !Array.isArray(track.artists) || track.artists.length === 0) {
    return 'unknown';
  }
  return track.artists[0]?.id || track.artists[0]?.name || 'unknown';
}

/**
 * Helper to get the primary genre from a track
 */
function getGenre(track: UnifiedTrack): string {
  return track.genres?.[0] || '';
}

// ============================================
// Artist Diversity Transformer
// ============================================

/**
 * Ensures variety of artists in results by limiting
 * max tracks per artist and interleaving
 */
export const artistDiversityTransformer: ResultTransformer = {
  id: 'builtin:artist-diversity',
  pluginId: 'builtin',
  priority: 90, // High priority - runs early
  name: 'Artist Diversity',
  description: 'Ensures variety of artists in results (max 4 per artist)',
  enabledByDefault: true,

  canTransform(): boolean {
    // Always applicable
    return true;
  },

  async transform(
    results: UnifiedTrack[],
    _context: SeeAllContext
  ): Promise<UnifiedTrack[]> {
    const maxPerArtist = 4;
    const artistCounts = new Map<string, number>();
    const diversified: UnifiedTrack[] = [];
    const overflow: UnifiedTrack[] = [];

    // First pass: collect up to max per artist
    for (const track of results) {
      const artistId = getArtistId(track);
      const count = artistCounts.get(artistId) || 0;

      if (count < maxPerArtist) {
        diversified.push(track);
        artistCounts.set(artistId, count + 1);
      } else {
        overflow.push(track);
      }
    }

    // Interleave: spread artists throughout the list
    const interleaved = interleaveByArtist(diversified);

    // Append overflow at the end (if we need more results)
    return [...interleaved, ...overflow];
  },
};

/**
 * Interleave tracks so same artist isn't adjacent
 */
function interleaveByArtist(tracks: UnifiedTrack[]): UnifiedTrack[] {
  if (tracks.length <= 2) return tracks;

  // Group by artist
  const byArtist = new Map<string, UnifiedTrack[]>();
  for (const track of tracks) {
    const artistId = getArtistId(track);
    const group = byArtist.get(artistId) || [];
    group.push(track);
    byArtist.set(artistId, group);
  }

  // Round-robin interleave
  const result: UnifiedTrack[] = [];
  const artists = Array.from(byArtist.keys());
  let artistIndex = 0;

  while (result.length < tracks.length && artists.length > 0) {
    const idx = artistIndex % artists.length;
    const artistId = artists[idx];
    if (!artistId) break;

    const group = byArtist.get(artistId);
    if (!group || group.length === 0) {
      artists.splice(idx, 1);
      continue;
    }

    const nextTrack = group.shift();
    if (nextTrack) {
      result.push(nextTrack);
    }

    // Remove empty groups
    if (group.length === 0) {
      artists.splice(idx, 1);
    } else {
      artistIndex++;
    }
  }

  return result;
}

// ============================================
// Duplicate Remover Transformer
// ============================================

/**
 * Removes duplicate tracks by ID and similar titles
 */
export const duplicateRemoverTransformer: ResultTransformer = {
  id: 'builtin:duplicate-remover',
  pluginId: 'builtin',
  priority: 100, // Highest priority - runs first
  name: 'Duplicate Remover',
  description: 'Removes duplicate tracks and similar titles',
  enabledByDefault: true,

  canTransform(): boolean {
    return true;
  },

  async transform(
    results: UnifiedTrack[],
    _context: SeeAllContext
  ): Promise<UnifiedTrack[]> {
    const seenIds = new Set<string>();
    const seenTitles = new Map<string, string>(); // normalized title -> original track ID
    const deduplicated: UnifiedTrack[] = [];

    for (const track of results) {
      // Skip exact ID duplicates
      if (seenIds.has(track.id)) continue;

      // Check for similar titles by same artist
      const normalizedTitle = normalizeTitle(track.title);
      const artistKey = `${getArtistId(track)}:${normalizedTitle}`;

      if (seenTitles.has(artistKey)) continue;

      seenIds.add(track.id);
      seenTitles.set(artistKey, track.id);
      deduplicated.push(track);
    }

    return deduplicated;
  },
};

/**
 * Normalize title for duplicate detection
 */
function normalizeTitle(title: string | undefined): string {
  if (!title || typeof title !== 'string') {
    return '';
  }
  return title
    .toLowerCase()
    .replace(/\s*\(.*?\)\s*/g, '') // Remove parenthetical content
    .replace(/\s*\[.*?\]\s*/g, '') // Remove bracketed content
    .replace(/\s*-\s*(remaster|remix|edit|version|live).*$/i, '') // Remove suffixes
    .replace(/[^\w\s]/g, '') // Remove punctuation
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
}

// ============================================
// Recency Boost Transformer
// ============================================

/**
 * Boosts recently played/liked tracks in personalized sections
 */
export const recencyBoostTransformer: ResultTransformer = {
  id: 'builtin:recency-boost',
  pluginId: 'builtin',
  priority: 70,
  name: 'Recency Boost',
  description: 'Boosts recently interacted tracks in personalized results',
  enabledByDefault: true,

  canTransform(query: StructuredSectionQuery): boolean {
    // Only for personalized sections
    return (
      query.sectionType === 'personalized' ||
      query.sectionType === 'weekly-rotation' ||
      query.embedding?.method === 'personalized'
    );
  },

  async transform(
    results: UnifiedTrack[],
    context: SeeAllContext
  ): Promise<UnifiedTrack[]> {
    // Get top artists by listen time from user profile
    const topArtists = Object.entries(context.userProfile.artistPreferences)
      .filter(([, pref]) => pref.totalListenTime > 0)
      .sort(([, a], [, b]) => b.totalListenTime - a.totalListenTime)
      .slice(0, 10) // Top 10 artists
      .map(([artistId]) => artistId);

    if (topArtists.length === 0) return results;

    const topArtistSet = new Set(topArtists);

    // Separate into boosted and regular
    const boosted: UnifiedTrack[] = [];
    const regular: UnifiedTrack[] = [];

    for (const track of results) {
      const artistId = getArtistId(track);
      if (topArtistSet.has(artistId)) {
        boosted.push(track);
      } else {
        regular.push(track);
      }
    }

    // Interleave: 1 boosted, 2 regular pattern
    const interleaved: UnifiedTrack[] = [];
    let boostedIdx = 0;
    let regularIdx = 0;

    while (boostedIdx < boosted.length || regularIdx < regular.length) {
      // Add 1 boosted
      if (boostedIdx < boosted.length) {
        const track = boosted[boostedIdx++];
        if (track) interleaved.push(track);
      }
      // Add 2 regular
      for (let i = 0; i < 2 && regularIdx < regular.length; i++) {
        const track = regular[regularIdx++];
        if (track) interleaved.push(track);
      }
    }

    return interleaved;
  },
};

// ============================================
// Time-of-Day Energy Transformer
// ============================================

/**
 * Adjusts energy levels based on time of day
 */
export const timeEnergyTransformer: ResultTransformer = {
  id: 'builtin:time-energy',
  pluginId: 'builtin',
  priority: 60,
  name: 'Time-Aware Energy',
  description: 'Adjusts track energy based on time of day',
  enabledByDefault: true,

  canTransform(query: StructuredSectionQuery): boolean {
    // Only for mood/energy-related queries
    return (
      query.embedding?.method === 'mood' ||
      query.embedding?.method === 'discovery' ||
      query.embedding?.method === 'personalized'
    );
  },

  async transform(
    results: UnifiedTrack[],
    context: SeeAllContext
  ): Promise<UnifiedTrack[]> {
    const hour = context.hour;

    // Determine preferred energy based on time
    let preferHigh = false;
    let preferLow = false;

    if (hour >= 6 && hour < 10) {
      // Morning: gradually increasing energy
      preferLow = hour < 8;
    } else if (hour >= 10 && hour < 18) {
      // Daytime: higher energy
      preferHigh = true;
    } else if (hour >= 18 && hour < 22) {
      // Evening: moderate energy
      // No preference adjustment
    } else {
      // Night (22-6): lower energy
      preferLow = true;
    }

    if (!preferHigh && !preferLow) return results;

    // Estimate track energy from title keywords and duration
    const scored = results.map((track) => ({
      track,
      energyScore: estimateEnergy(track),
    }));

    // Sort: prefer high or low energy
    if (preferHigh) {
      scored.sort((a, b) => b.energyScore - a.energyScore);
    } else if (preferLow) {
      scored.sort((a, b) => a.energyScore - b.energyScore);
    }

    return scored.map((s) => s.track);
  },
};

/**
 * Estimate energy level from track metadata
 */
function estimateEnergy(track: UnifiedTrack): number {
  let score = 0.5; // Base

  const title = (track.title || '').toLowerCase();
  const genre = getGenre(track).toLowerCase();

  // High energy indicators
  if (/rock|metal|punk|edm|dance|party|hype|power|energy/.test(title + genre)) {
    score += 0.3;
  }
  if (/remix|club|dj/.test(title)) {
    score += 0.2;
  }

  // Low energy indicators
  if (/chill|relax|calm|sleep|ambient|acoustic|ballad|slow/.test(title + genre)) {
    score -= 0.3;
  }
  if (/piano|classical|jazz/.test(genre)) {
    score -= 0.15;
  }

  // Duration: very short or very long tend to be different
  const duration = track.duration || 0;
  if (duration > 0) {
    if (duration < 150) score += 0.1; // Under 2.5 min - often punchy
    if (duration > 360) score -= 0.1; // Over 6 min - often slower
  }

  return Math.max(0, Math.min(1, score));
}

// ============================================
// Mood Consistency Transformer
// ============================================

/**
 * Ensures mood consistency in mood-based queries
 */
export const moodConsistencyTransformer: ResultTransformer = {
  id: 'builtin:mood-consistency',
  pluginId: 'builtin',
  priority: 75,
  name: 'Mood Consistency',
  description: 'Removes tracks that don\'t match the requested mood',
  enabledByDefault: true,

  canTransform(query: StructuredSectionQuery): boolean {
    return !!query.embedding?.mood;
  },

  async transform(
    results: UnifiedTrack[],
    context: SeeAllContext
  ): Promise<UnifiedTrack[]> {
    const targetMood = context.query.embedding?.mood?.toLowerCase();
    if (!targetMood) return results;

    // Define anti-mood keywords (moods that conflict)
    const antiMood: Record<string, string[]> = {
      happy: ['sad', 'cry', 'tears', 'heartbreak', 'lonely'],
      sad: ['happy', 'party', 'celebrate', 'fun'],
      energetic: ['chill', 'relax', 'calm', 'slow', 'sleep'],
      chill: ['hype', 'rage', 'party', 'scream', 'metal'],
      romantic: ['angry', 'rage', 'hate', 'fight'],
    };

    const antiKeywords = antiMood[targetMood] || [];

    // Filter out tracks with anti-mood keywords
    const filtered = results.filter((track) => {
      const artistName = track.artists?.[0]?.name || '';
      const albumTitle = track.album?.title || '';
      const genre = getGenre(track);
      const text = `${track.title || ''} ${artistName} ${albumTitle} ${genre}`.toLowerCase();

      // Check for anti-mood keywords
      const hasAnti = antiKeywords.some((kw) => text.includes(kw));
      if (hasAnti) return false;

      return true;
    });

    // If we filtered too many, return original
    if (filtered.length < results.length * 0.5) {
      return results;
    }

    return filtered;
  },
};

// ============================================
// Export All Built-in Transformers
// ============================================

export const builtinTransformers: ResultTransformer[] = [
  duplicateRemoverTransformer,
  artistDiversityTransformer,
  moodConsistencyTransformer,
  recencyBoostTransformer,
  timeEnergyTransformer,
];

// Guard to prevent duplicate registration
let transformersRegistered = false;

/**
 * Register all built-in transformers with the pipeline registry
 */
export function registerBuiltinTransformers(
  registry: { registerTransformer: (t: ResultTransformer) => void }
): void {
  if (transformersRegistered) {
    return; // Already registered
  }

  for (const transformer of builtinTransformers) {
    registry.registerTransformer(transformer);
  }

  transformersRegistered = true;
  console.log(
    `[BuiltinTransformers] Registered ${builtinTransformers.length} built-in transformers`
  );
}
