/**
 * Addon system types and provider contracts
 */

import type {
  Artist,
  Album,
  ArtworkSet,
  Quality,
  StreamInfo,
  LyricsResult,
  ExternalIds
} from './index';

// ============================================
// Extended Detail Types for API Responses
// ============================================

/** Extended artist details returned by getArtist */
export interface ArtistDetail extends Artist {
  /** Top/popular tracks */
  topTracks?: MetadataTrack[];
  /** Studio albums */
  albums?: Album[];
  /** Singles */
  singles?: Album[];
  /** EPs */
  eps?: Album[];
  /** Compilations */
  compilations?: Album[];
  /** Albums the artist appears on */
  appearsOn?: Album[];
  /** Similar/related artists */
  similarArtists?: Artist[];
}

/** Extended album details returned by getAlbum */
export interface AlbumDetail extends Album {
  /** Album tracks in order */
  tracks: MetadataTrack[];
  /** Other albums by the same artist */
  moreByArtist?: Album[];
  /** Similar albums based on genre/style */
  similarAlbums?: Album[];
  /** Full artist info for the album's primary artist */
  artistInfo?: ArtistDetail;
  /** Album credits (producers, writers, etc.) */
  credits?: AlbumCredits;
}

// ============================================
// Album Credits
// ============================================

export interface AlbumCredits {
  producers?: string[];
  writers?: string[];
  engineers?: string[];
  label?: string;
  copyright?: string;
}

// ============================================
// Trending & Discovery Content
// ============================================

/** Trending content for discovery page */
export interface TrendingContent {
  tracks: MetadataTrack[];
  artists: Artist[];
  albums: Album[];
}

/** Playlist for discovery and library */
export interface Playlist {
  id: string;
  name: string;
  description?: string;
  trackCount: number;
  coverUrls: string[];
  owner?: string;
  isPublic?: boolean;
}

/** Related content for album pages */
export interface AlbumRelatedContent {
  moreByArtist: Album[];
  similarAlbums: Album[];
  artistInfo: ArtistDetail;
  credits?: AlbumCredits;
}

/** Enhanced artist content for artist pages */
export interface ArtistFullContent {
  artist: ArtistDetail;
  latestRelease?: Album;
  featuredIn: Album[];
  relatedPlaylists: Playlist[];
}

export type AddonRole =
  | 'metadata-provider'
  | 'stream-provider'
  | 'lyrics-provider'
  | 'scrobbler'
  | 'audio-processor'
  | 'tool';

export interface AddonManifest {
  /** Unique identifier (e.g., "deezer", "youtube-music") */
  id: string;

  /** Human-readable name */
  name: string;

  /** Semantic version */
  version: string;

  /** Addon description */
  description?: string;

  /** Roles this addon fulfills */
  roles: AddonRole[];
}

export interface BaseAddon {
  manifest: AddonManifest;
  initialize(): Promise<void>;
  dispose(): Promise<void>;
  /** Update provider settings */
  updateSettings?(settings: Record<string, unknown>): void;
  /** Get current settings */
  getSettings?(): Record<string, unknown>;
}

// ============================================
// Deezer Provider Settings
// ============================================

export interface DeezerProviderSettings {
  /** Fetch album artwork (default: true) */
  fetchArtwork: boolean;
  /** Fetch artist information and artwork (default: true) */
  fetchArtistInfo: boolean;
  /** Fetch album metadata (default: true) */
  fetchAlbumInfo: boolean;
  /** Fetch external IDs like ISRC (default: true) */
  fetchExternalIds: boolean;
}

// ============================================
// Apple Music Provider Settings
// ============================================

export interface AppleMusicArtworkSettings {
  /** Preferred artwork type: 'animated' or 'static' */
  artworkType: 'animated' | 'static';
  /** Preferred aspect ratio for animated artwork */
  aspectRatio: 'tall' | 'square';
  /** Video loop count for animated artwork */
  loopCount: number;
  /** Include audio in animated artwork */
  includeAudio: boolean;
}

// ============================================
// Metadata Provider Contract
// ============================================

export interface MetadataTrack {
  /** Provider-specific ID */
  id: string;

  /** Track title */
  title: string;

  /** Artists */
  artists: Artist[];

  /** Album */
  album?: Album;

  /** Duration in seconds */
  duration: number;

  /** Artwork */
  artwork?: ArtworkSet;

  /** External identifiers (ISRC, etc.) */
  externalIds?: ExternalIds;

  /** Release date */
  releaseDate?: string;

  /** Genres */
  genres?: string[];

  /** Explicit content */
  explicit?: boolean;

  /** Internal: which provider this came from */
  _provider: string;
}

export interface MetadataSearchResult {
  tracks: MetadataTrack[];
  artists: Artist[];
  albums: Album[];
}

export interface MetadataSearchOptions {
  limit?: number;
  offset?: number;
}

export interface MetadataProvider extends BaseAddon {
  /** Unique provider identifier */
  readonly id: string;

  /** Human-readable name */
  readonly name: string;

  /** Priority (higher = preferred) */
  readonly priority: number;

  /** Search for tracks, artists, and albums */
  search(query: string, options?: MetadataSearchOptions): Promise<MetadataSearchResult>;

  /** Get detailed track information */
  getTrack(id: string): Promise<MetadataTrack | null>;

  /** Get detailed artist information */
  getArtist(id: string): Promise<Artist | null>;

  /** Get detailed album information with tracks */
  getAlbum(id: string): Promise<(Album & { tracks: MetadataTrack[] }) | null>;
}

// ============================================
// Stream Provider Contract
// ============================================

export interface StreamTrack {
  /** Provider-specific track ID */
  id: string;

  /** Track title */
  title: string;

  /** Artist name(s) */
  artists: string[];

  /** Duration in seconds */
  duration: number;

  /** Available qualities */
  availableQualities: Quality[];

  /** Thumbnail URL */
  thumbnail?: string;
}

export interface StreamSearchOptions {
  limit?: number;
}

export interface StreamProvider extends BaseAddon {
  /** Unique provider identifier */
  readonly id: string;

  /** Human-readable name */
  readonly name: string;

  /** Whether authentication is required */
  readonly requiresAuth: boolean;

  /** Available qualities this provider supports */
  readonly supportedQualities: Quality[];

  /** Search for streamable tracks */
  search(query: string, options?: StreamSearchOptions): Promise<StreamTrack[]>;

  /** Get stream URL and details */
  getStream(trackId: string, quality?: Quality): Promise<StreamInfo>;

  /** Search by metadata for best match */
  searchByMetadata?(metadata: {
    title: string;
    artist: string;
    album?: string;
    duration?: number;
    isrc?: string;
  }): Promise<StreamTrack | null>;

  /** Check if user is authenticated */
  isAuthenticated(): boolean;
}

// ============================================
// Lyrics Provider Contract
// ============================================

export interface LyricsQuery {
  title: string;
  artist: string;
  album?: string;
  duration?: number;
}

export interface LyricsSearchOptions {
  preferSynced?: boolean;
}

export interface LyricsProvider extends BaseAddon {
  /** Unique provider identifier */
  readonly id: string;

  /** Human-readable name */
  readonly name: string;

  /** Whether this provider supports synced lyrics */
  readonly supportsSynced: boolean;

  /** Get lyrics for a track */
  getLyrics(query: LyricsQuery, options?: LyricsSearchOptions): Promise<LyricsResult | null>;
}

// ============================================
// Scrobbler Contract
// ============================================

export interface ScrobblePayload {
  track: {
    title: string;
    artist: string;
    album?: string;
    duration: number;
  };
  timestamp: Date;
  playedDuration: number;
}

export interface NowPlayingPayload {
  track: {
    title: string;
    artist: string;
    album?: string;
    duration: number;
  };
}

export interface Scrobbler extends BaseAddon {
  /** Unique provider identifier */
  readonly id: string;

  /** Human-readable name */
  readonly name: string;

  /** Whether authentication is required */
  readonly requiresAuth: boolean;

  /** Record a completed listen */
  scrobble(payload: ScrobblePayload): Promise<boolean>;

  /** Update "now playing" status */
  updateNowPlaying(payload: NowPlayingPayload): Promise<boolean>;

  /** Check if user is authenticated */
  isAuthenticated(): boolean;
}

// ============================================
// Audio Processor Contract (Karaoke/Stem Separation)
// ============================================

export interface AudioProcessorResult {
  /** Track identifier */
  trackId: string;

  /** URL to the processed audio (blob or cached) */
  instrumentalUrl: string;

  /** Whether this result was from cache */
  cached: boolean;
}

export interface AudioProcessor extends BaseAddon {
  /** Unique processor identifier */
  readonly id: string;

  /** Human-readable name */
  readonly name: string;

  /** Check if processor is available (server running, etc.) */
  isAvailable(): Promise<boolean>;

  /** Process a track - returns instrumental audio */
  processTrack(trackId: string, audioUrl: string): Promise<AudioProcessorResult>;

  /** Check if track is already cached */
  hasCached(trackId: string): Promise<boolean>;

  /** Get cached result without processing */
  getCached(trackId: string): Promise<AudioProcessorResult | null>;

  /** Clear cache for a track */
  clearCache(trackId: string): Promise<void>;
}

// ============================================
// Tool Contract (Data Transfer, Cloud Mounts, Integrations)
// ============================================

/** Tool types for categorization */
export type ToolType =
  | 'data-transfer'   // Import/export data (Sposify, backups)
  | 'cloud-mount'     // Connect cloud storage (Google Drive, Dropbox)
  | 'integration'     // Third-party service connections
  | 'utility';        // Stats, analytics, file converters

/** Plugin UI Registry for dynamic UI registration */
export interface PluginUIRegistry {
  /** Register a sidebar item */
  registerSidebarItem(item: {
    id: string;
    label: string;
    icon: string;
    section: 'tools' | 'library' | 'playlists';
    order?: number;
  }): void;

  /** Register a view/page component */
  registerView(view: {
    id: string;
    component: unknown; // React.ComponentType - typed in implementation
    route?: string;
  }): void;

  /** Register a settings section */
  registerSettings(settings: {
    id: string;
    label: string;
    component: unknown; // React.ComponentType - typed in implementation
  }): void;

  /** Register a player control button */
  registerPlayerControl(control: {
    id: string;
    icon: string;
    tooltip: string;
    onClick: () => void;
    isActive?: () => boolean;
  }): void;
}

export interface Tool extends BaseAddon {
  /** Unique tool identifier */
  readonly id: string;

  /** Human-readable name */
  readonly name: string;

  /** Tool category */
  readonly toolType: ToolType;

  /** Icon name or URL */
  readonly icon?: string;

  /** Optional UI registration */
  registerUI?(registry: PluginUIRegistry): void;

  /** Optional IPC handlers for Electron main process */
  registerHandlers?(ipcMain: unknown, app: unknown): void;

  /** Unregister IPC handlers */
  unregisterHandlers?(): void;

  /** Execute the tool's main action (if applicable) */
  execute?(): Promise<void>;

  /** Check if tool is available/ready */
  isAvailable?(): Promise<boolean>;
}
