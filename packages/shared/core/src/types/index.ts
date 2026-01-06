/**
 * Core domain types for Audiio
 */

export interface Artist {
  id: string;
  name: string;
  artwork?: ArtworkSet;
  /** Artist biography/description */
  bio?: string;
  /** Music genres */
  genres?: string[];
  /** Follower/listener count */
  followers?: number;
  /** Whether this is a verified artist profile */
  verified?: boolean;
  /** External URLs (social media, website, etc.) */
  externalUrls?: {
    spotify?: string;
    instagram?: string;
    twitter?: string;
    facebook?: string;
    website?: string;
    [key: string]: string | undefined;
  };
}

export interface Album {
  id: string;
  title: string;
  artists?: Artist[];
  artwork?: ArtworkSet;
  releaseDate?: string;
  trackCount?: number;
}

/**
 * Animated artwork (video) for enhanced visual experience
 */
export interface AnimatedArtwork {
  /** URL to the video file (MP4 or M3U8) */
  videoUrl: string;
  /** Aspect ratio of the video */
  aspectRatio: 'tall' | 'square';
  /** Static preview frame image URL */
  previewFrame?: string;
  /** Whether the video includes audio */
  hasAudio?: boolean;
  /** Source album ID (for caching) */
  albumId?: string;
}

export interface ArtworkSet {
  small?: string;   // ~100px
  medium?: string;  // ~300px
  large?: string;   // ~600px
  original?: string;
  /** Animated video artwork (Apple Music loops, etc.) */
  animated?: AnimatedArtwork;
}

export type Quality = 'low' | 'medium' | 'high' | 'lossless';

export interface StreamInfo {
  url: string;
  format: 'opus' | 'mp4' | 'webm' | 'mp3' | 'aac';
  bitrate?: number;
  expiresAt?: number;
}

export interface StreamSource {
  providerId: string;
  trackId: string;
  available: boolean;
  qualities: Quality[];
}

export interface LyricsLine {
  time: number;  // Milliseconds from start
  text: string;
  endTime?: number;
}

export interface LyricsResult {
  plain?: string;
  synced?: LyricsLine[];
  /** Raw synced lyrics string (LRC format) for client-side parsing */
  _rawSynced?: string;
  source: string;
}

export interface ExternalIds {
  isrc?: string;
  deezer?: string;
  youtube?: string;
  spotify?: string;
  musicbrainz?: string;
  [key: string]: string | undefined;
}

/**
 * The unified track model that all addons contribute to
 */
export interface UnifiedTrack {
  /** Audiio internal ID (UUID) */
  id: string;

  /** Track title */
  title: string;

  /** Artists (primary first) */
  artists: Artist[];

  /** Album information */
  album?: Album;

  /** Duration in seconds */
  duration: number;

  /** Artwork at various resolutions */
  artwork?: ArtworkSet;

  /** Genres */
  genres?: string[];

  /** Release date */
  releaseDate?: string;

  /** Explicit content flag */
  explicit?: boolean;

  /** Resolved stream info (populated on play) */
  streamInfo?: StreamInfo;

  /** Available stream sources from providers */
  streamSources: StreamSource[];

  /** Lyrics (if fetched) */
  lyrics?: LyricsResult;

  /** Metadata about the unified track */
  _meta: {
    /** Which provider supplied the metadata */
    metadataProvider: string;

    /** Confidence score for stream matching (0-1) */
    matchConfidence: number;

    /** IDs from various services */
    externalIds: ExternalIds;

    /** When this was last refreshed */
    lastUpdated: Date;
  };
}

export interface SearchQuery {
  query: string;
  type?: 'track' | 'album' | 'artist';
  limit?: number;
  offset?: number;
}

export interface SearchResult {
  tracks: UnifiedTrack[];
  albums?: Album[];
  artists?: Artist[];
  query: string;
  source: string;
}
