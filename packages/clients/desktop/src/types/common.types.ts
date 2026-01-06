/**
 * Common response types used across all API namespaces
 */

/** Base success response */
export interface SuccessResponse {
  success: boolean;
}

/** Error response with message */
export interface ErrorResponse {
  success: false;
  error: string;
}

/** Generic list response */
export interface ListResponse<T> {
  items: T[];
  total?: number;
}

/** Paginated response */
export interface PaginatedResponse<T> extends ListResponse<T> {
  offset: number;
  limit: number;
  hasMore: boolean;
}

/** Unified track representation */
export interface UnifiedTrack {
  id: string;
  title: string;
  artists?: Array<{ id?: string; name: string }>;
  album?: { id?: string; title: string; artwork?: ArtworkSet };
  duration: number;
  genres?: string[];
  releaseDate?: string;
  explicit?: boolean;
  artwork?: ArtworkSet;
  streamSources?: StreamSource[];
  audioFeatures?: AudioFeaturesSummary;
  _meta?: TrackMeta;
}

/** Artwork URLs at different sizes */
export interface ArtworkSet {
  small?: string;
  medium?: string;
  large?: string;
}

/** Stream source for a track */
export interface StreamSource {
  provider: string;
  url: string;
  quality?: string;
  format?: string;
}

/** Track metadata from providers */
export interface TrackMeta {
  metadataProvider?: string;
  lastUpdated?: string;
  externalIds?: {
    isrc?: string;
    spotify?: string;
    youtube?: string;
    musicbrainz?: string;
  };
}

/** Audio features summary for track display */
export interface AudioFeaturesSummary {
  energy?: number;
  valence?: number;
  danceability?: number;
  acousticness?: number;
  instrumentalness?: number;
  speechiness?: number;
  liveness?: number;
  tempo?: number;
  loudness?: number;
}

/** Artist representation */
export interface Artist {
  id: string;
  name: string;
  artwork?: ArtworkSet;
  genres?: string[];
}

/** Album representation */
export interface Album {
  id: string;
  title: string;
  artists?: Artist[];
  artwork?: ArtworkSet;
  releaseDate?: string;
  trackCount?: number;
  genres?: string[];
}

/** Timestamp type (Unix milliseconds) */
export type Timestamp = number;
