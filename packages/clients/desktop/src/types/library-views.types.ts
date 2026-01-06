/**
 * Library Views API type definitions
 */

import type { SuccessResponse, Timestamp } from './common.types';

/** Sort direction */
export type SortDirection = 'asc' | 'desc';

/** Library view entity */
export interface LibraryView {
  id: string;
  name: string;
  type: 'custom' | 'builtin';
  icon?: string;
  filters: LibraryViewFilters;
  sortBy?: string;
  sortOrder?: SortDirection;
  isBuiltIn: boolean;
  createdAt: Timestamp;
}

/** Filter configuration for library views */
export interface LibraryViewFilters {
  genres?: string[];
  tags?: string[];
  yearRange?: { min?: number; max?: number };
  durationRange?: { min?: number; max?: number };
  artists?: string[];
  albums?: string[];
  sources?: string[];
  hasLyrics?: boolean;
  isLiked?: boolean;
  [key: string]: unknown;
}

// Request types
export interface CreateLibraryViewRequest {
  name: string;
  type?: 'custom' | 'builtin';
  icon?: string;
  filters: LibraryViewFilters;
  sortBy?: string;
  sortOrder?: SortDirection;
}

export interface UpdateLibraryViewRequest {
  name?: string;
  icon?: string;
  filters?: LibraryViewFilters;
  sortBy?: string;
  sortOrder?: SortDirection;
}

// Response types
export interface LibraryViewsGetAllResponse {
  views: LibraryView[];
}

export interface LibraryViewGetResponse extends LibraryView {}

export interface LibraryViewCreateResponse extends SuccessResponse {
  view?: LibraryView;
}
