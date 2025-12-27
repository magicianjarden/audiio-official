/**
 * Query Parser - Parses natural language search queries into structured filters
 *
 * Supports patterns like:
 * - "by [artist]" → artist filter
 * - "from [album]" → album filter
 * - "genre:[genre]" → genre filter
 * - "2020" or "year:2020" → year filter
 * - "liked" or "favorites" → liked tracks filter
 */

export interface ParsedQuery {
  /** The remaining search text after extracting filters */
  text: string;
  /** Extracted filters */
  filters: QueryFilter[];
  /** Original query before parsing */
  original: string;
}

export interface QueryFilter {
  type: 'artist' | 'album' | 'genre' | 'year' | 'liked' | 'playlist';
  value: string;
  /** Display label for the filter chip */
  label: string;
}

// Patterns for natural language parsing
const PATTERNS = {
  // "by Artist Name" or "from Artist Name"
  byArtist: /\bby\s+([^,]+?)(?=\s+from\s+|\s+genre:|\s+\d{4}\b|$)/i,

  // "from Album Name"
  fromAlbum: /\bfrom\s+([^,]+?)(?=\s+by\s+|\s+genre:|\s+\d{4}\b|$)/i,

  // "genre:rock" or "genre: rock" or "in rock"
  genre: /(?:genre:\s*|in\s+)([\w\s-]+?)(?=\s+by\s+|\s+from\s+|\s+\d{4}\b|$)/i,

  // "2020" or "year:2020" or "from 2020"
  year: /(?:year:\s*|\bfrom\s+)?(\d{4})\b/i,

  // "liked" or "favorites" or "my favorites"
  liked: /\b(liked|favorites?|my\s+favorites?|loved)\b/i,

  // "in playlist:name" or "playlist:name"
  playlist: /\bplaylist:\s*([^\s]+)/i,
};

/**
 * Parse a search query into structured filters and remaining text
 */
export function parseQuery(query: string): ParsedQuery {
  if (!query?.trim()) {
    return { text: '', filters: [], original: '' };
  }

  const original = query;
  const filters: QueryFilter[] = [];
  let text = query.trim();

  // Extract liked/favorites filter
  const likedMatch = text.match(PATTERNS.liked);
  if (likedMatch) {
    filters.push({
      type: 'liked',
      value: 'true',
      label: 'Liked',
    });
    text = text.replace(PATTERNS.liked, '').trim();
  }

  // Extract year filter
  const yearMatch = text.match(PATTERNS.year);
  if (yearMatch) {
    const year = yearMatch[1];
    const yearNum = parseInt(year, 10);
    // Only treat as year filter if it's a reasonable year
    if (yearNum >= 1900 && yearNum <= new Date().getFullYear() + 1) {
      filters.push({
        type: 'year',
        value: year,
        label: year,
      });
      // Only remove "year:" prefix, leave bare year in text for searching
      text = text.replace(/year:\s*\d{4}/i, '').trim();
    }
  }

  // Extract genre filter
  const genreMatch = text.match(PATTERNS.genre);
  if (genreMatch) {
    const genre = genreMatch[1].trim();
    if (genre) {
      filters.push({
        type: 'genre',
        value: genre.toLowerCase(),
        label: capitalizeWords(genre),
      });
      text = text.replace(PATTERNS.genre, '').trim();
    }
  }

  // Extract album filter
  const albumMatch = text.match(PATTERNS.fromAlbum);
  if (albumMatch) {
    const album = albumMatch[1].trim();
    if (album) {
      filters.push({
        type: 'album',
        value: album,
        label: `Album: ${album}`,
      });
      text = text.replace(PATTERNS.fromAlbum, '').trim();
    }
  }

  // Extract artist filter
  const artistMatch = text.match(PATTERNS.byArtist);
  if (artistMatch) {
    const artist = artistMatch[1].trim();
    if (artist) {
      filters.push({
        type: 'artist',
        value: artist,
        label: `By: ${artist}`,
      });
      text = text.replace(PATTERNS.byArtist, '').trim();
    }
  }

  // Extract playlist filter
  const playlistMatch = text.match(PATTERNS.playlist);
  if (playlistMatch) {
    const playlist = playlistMatch[1].trim();
    if (playlist) {
      filters.push({
        type: 'playlist',
        value: playlist,
        label: `Playlist: ${playlist}`,
      });
      text = text.replace(PATTERNS.playlist, '').trim();
    }
  }

  // Clean up remaining text
  text = text
    .replace(/\s+/g, ' ')
    .replace(/^[\s,]+|[\s,]+$/g, '')
    .trim();

  return { text, filters, original };
}

/**
 * Build a search query string from filters
 */
export function buildQueryFromFilters(filters: QueryFilter[]): string {
  const parts: string[] = [];

  for (const filter of filters) {
    switch (filter.type) {
      case 'artist':
        parts.push(`by ${filter.value}`);
        break;
      case 'album':
        parts.push(`from ${filter.value}`);
        break;
      case 'genre':
        parts.push(`genre:${filter.value}`);
        break;
      case 'year':
        parts.push(filter.value);
        break;
      case 'liked':
        parts.push('liked');
        break;
      case 'playlist':
        parts.push(`playlist:${filter.value}`);
        break;
    }
  }

  return parts.join(' ');
}

/**
 * Check if a query looks like it might have natural language filters
 */
export function hasNaturalLanguageFilters(query: string): boolean {
  if (!query) return false;
  return (
    PATTERNS.byArtist.test(query) ||
    PATTERNS.fromAlbum.test(query) ||
    PATTERNS.genre.test(query) ||
    PATTERNS.year.test(query) ||
    PATTERNS.liked.test(query) ||
    PATTERNS.playlist.test(query)
  );
}

// Helper function
function capitalizeWords(str: string): string {
  return str
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
