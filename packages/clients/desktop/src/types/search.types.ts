/**
 * Search API type definitions (including NLP search)
 */

import type { SuccessResponse, UnifiedTrack, Artist, Album, Timestamp } from './common.types';
import type { MoodType } from './audio-features.types';

/** Parsed natural language query */
export interface ParsedQuery {
  original: string;
  normalized: string;
  intent: 'search' | 'play' | 'filter' | 'recommendation';
  entities: {
    artists?: string[];
    albums?: string[];
    tracks?: string[];
    genres?: string[];
    moods?: MoodType[];
    decades?: string[];
    years?: number[];
    tags?: string[];
  };
  filters: {
    tempo?: { min?: number; max?: number };
    energy?: { min?: number; max?: number };
    valence?: { min?: number; max?: number };
    danceability?: { min?: number; max?: number };
    duration?: { min?: number; max?: number };
    year?: { min?: number; max?: number };
  };
  confidence: number;
}

/** Search suggestion */
export interface SearchSuggestion {
  type: 'track' | 'artist' | 'album' | 'genre' | 'tag' | 'query';
  text: string;
  id?: string;
  score: number;
}

/** Search history item */
export interface SearchHistoryItem {
  id: string;
  query: string;
  type: 'text' | 'natural';
  timestamp: Timestamp;
  resultCount: number;
}

/** Advanced search parameters */
export interface AdvancedSearchParams {
  query?: string;
  artist?: string;
  album?: string;
  genre?: string;
  mood?: MoodType;
  decade?: string;
  yearMin?: number;
  yearMax?: number;
  durationMin?: number;
  durationMax?: number;
  tempoMin?: number;
  tempoMax?: number;
  tags?: string[];
  source?: string;
  sortBy?: 'relevance' | 'title' | 'artist' | 'date' | 'duration' | 'popularity';
  sortDir?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

// Response types
export interface SearchResponse {
  tracks: UnifiedTrack[];
  artists: Artist[];
  albums: Album[];
}

export interface NaturalSearchResponse {
  parsedQuery: ParsedQuery;
  tracks: UnifiedTrack[];
  total: number;
  suggestions: string[];
}

export interface AdvancedSearchResponse {
  tracks: UnifiedTrack[];
  total: number;
}

export interface SearchSuggestionsResponse {
  suggestions: SearchSuggestion[];
  tracks?: UnifiedTrack[];
  artists?: Artist[];
  albums?: Album[];
  tags?: string[];
  recentSearches?: SearchHistoryItem[];
}

export interface SearchHistoryResponse {
  searches: SearchHistoryItem[];
}

export interface SearchHistoryDeleteResponse extends SuccessResponse {}
