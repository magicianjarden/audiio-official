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

export type AddonRole =
  | 'metadata-provider'
  | 'stream-provider'
  | 'lyrics-provider'
  | 'scrobbler'
  | 'audio-processor'
  | 'tool'
  | 'artist-enrichment'
  | 'search-provider'         // Provide search results (videos, playlists, concerts, etc.)
  // Library Management Roles
  | 'metadata-enricher'       // Auto-tag via MusicBrainz, Discogs, TheAudioDB, etc.
  | 'artwork-provider'        // Cover art from Cover Art Archive, Fanart.tv, Last.fm, etc.
  | 'fingerprint-provider'    // Audio fingerprinting via Chromaprint/AcoustID
  | 'isrc-resolver'           // ISRC → metadata lookup via Deezer, MusicBrainz, etc.
  | 'analytics-provider'      // Stream counts, charts from Songstats, Chartmetric, scrapers
  | 'smart-playlist-rules'    // Custom smart playlist rule types
  | 'duplicate-detector'      // Find duplicate tracks via fingerprint or metadata
  | 'import-provider'         // Import from Spotify, Apple Music, M3U, Rekordbox, etc.
  | 'export-provider'         // Export to M3U, JSON, CSV, XML, etc.
  | 'library-hook';           // React to library events (track added, played, liked, etc.)

// ============================================
// Artist Enrichment Types
// ============================================

/** Music video from external sources */
export interface MusicVideo {
  id: string;
  title: string;
  thumbnail: string;
  publishedAt: string;
  viewCount?: number;
  duration?: string;
  url: string;
  source: string;
}

/** Video stream information for playback */
export interface VideoStreamInfo {
  /** Direct stream URL */
  url: string;
  /** MIME type (e.g., 'video/mp4', 'video/webm') */
  mimeType: string;
  /** Video quality label (e.g., '1080p', '720p') */
  quality: string;
  /** Video width */
  width?: number;
  /** Video height */
  height?: number;
  /** Whether this is an audio-only stream */
  audioOnly?: boolean;
  /** Separate audio stream URL if video is muxed separately */
  audioUrl?: string;
  /** Audio MIME type */
  audioMimeType?: string;
  /** Expiration timestamp */
  expiresAt?: number;
}

/** Timeline entry for artist discography history */
export interface TimelineEntry {
  year: number;
  type: 'album' | 'single' | 'ep' | 'compilation' | 'live';
  title: string;
  artwork?: string;
  label?: string;
  id?: string;
  source?: string;
}

/** Concert/event information */
export interface Concert {
  id: string;
  datetime: string;
  venue: {
    name: string;
    city: string;
    region?: string;
    country: string;
  };
  lineup: string[];
  ticketUrl?: string;
  onSaleDate?: string;
  offers?: Array<{ type: string; url: string; status: string }>;
  source: string;
}

/** Past concert setlist */
export interface Setlist {
  id: string;
  eventDate: string;
  venue: {
    name: string;
    city: string;
    country: string;
  };
  tour?: string;
  songs: Array<{ name: string; info?: string; cover?: boolean }>;
  url?: string;
  source: string;
}

/** Artist gallery images */
export interface ArtistImages {
  backgrounds: Array<{ url: string; likes?: number }>;
  thumbs: Array<{ url: string; likes?: number }>;
  logos: Array<{ url: string; likes?: number }>;
  hdLogos: Array<{ url: string; likes?: number }>;
  banners: Array<{ url: string; likes?: number }>;
}

/** Enrichment type discriminator */
export type ArtistEnrichmentType =
  | 'videos'
  | 'timeline'
  | 'setlists'
  | 'concerts'
  | 'gallery'
  | 'merchandise';

/** Aggregated enrichment data */
export interface ArtistEnrichmentData {
  musicVideos?: MusicVideo[];
  timeline?: TimelineEntry[];
  recentSetlists?: Setlist[];
  upcomingShows?: Concert[];
  gallery?: ArtistImages;
  merchandiseUrl?: string;
  mbid?: string;
}

// ============================================
// Settings Schema Types
// ============================================

/** Setting field type */
export type SettingsFieldType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'select'
  | 'multiselect'
  | 'color';

/** Individual setting field definition */
export interface SettingsSchemaItem {
  /** Unique key for this setting */
  key: string;
  /** Display label */
  label: string;
  /** Help text / description */
  description?: string;
  /** Field type */
  type: SettingsFieldType;
  /** Default value */
  default?: unknown;
  /** Whether this field is required */
  required?: boolean;
  /** Whether this is a secret (password/token) - will be masked */
  secret?: boolean;
  /** For 'select' or 'multiselect' type: available options */
  options?: Array<{ value: string; label: string }>;
  /** For 'number' type: minimum value */
  min?: number;
  /** For 'number' type: maximum value */
  max?: number;
  /** For 'number' type: step increment */
  step?: number;
  /** Placeholder text for input fields */
  placeholder?: string;
}

// ============================================
// Privacy Manifest Types
// ============================================

/** Data categories - what types of data are accessed */
export type PrivacyDataCategory =
  | 'listening-history'    // Play history, timestamps
  | 'library-data'         // Playlists, likes, library contents
  | 'user-credentials'     // Tokens, passwords, API keys
  | 'device-info'          // Device ID, OS, app version
  | 'usage-analytics'      // Feature usage, interactions
  | 'audio-content';       // Actual audio streams/files

/** How data is used */
export type PrivacyDataUsage =
  | 'service-functionality' // Required for core features
  | 'personalization'       // Recommendations, preferences
  | 'analytics'             // Usage statistics
  | 'third-party-sharing';  // Sent to external services

/** Network access declaration */
export interface PrivacyNetworkAccess {
  /** Host domain (e.g., "api.listenbrainz.org") */
  host: string;
  /** Purpose description (e.g., "Submit listening history") */
  purpose: string;
  /** Data types sent to this host */
  dataTypes: PrivacyDataCategory[];
}

/** Individual data access item */
export interface PrivacyDataAccess {
  /** Category of data being accessed */
  category: PrivacyDataCategory;
  /** How this data is used */
  usage: PrivacyDataUsage[];
  /** Whether this access is required for core functionality */
  required: boolean;
  /** User-friendly label (e.g., "Listening History") */
  userFriendlyLabel: string;
  /** User-friendly description (e.g., "Tracks you play and when") */
  userFriendlyDesc: string;
  /** Technical description for developers (e.g., "artist_name, track_name, listened_at") */
  technicalDesc?: string;
}

/** Full privacy manifest for transparency */
export interface PrivacyManifest {
  // Simple summary for user-friendly view
  /** Does this plugin collect any data? */
  collects: boolean;
  /** Does this plugin share data with third parties? */
  sharesWithThirdParties: boolean;
  /** Does this plugin track users across apps/services? */
  tracksAcrossApps: boolean;

  // Detailed declarations
  /** Data access declarations */
  dataAccess: PrivacyDataAccess[];
  /** Network access declarations */
  networkAccess: PrivacyNetworkAccess[];

  // Storage info
  /** Whether local storage is used */
  localStorageUsed: boolean;
  /** Description of what is stored locally */
  localStorageDesc?: string;

  // Data retention
  /** How long data is retained */
  dataRetention?: 'session' | 'persistent' | 'third-party-controlled';

  // Last updated
  /** ISO date when privacy manifest was last updated */
  lastUpdated?: string;
}

export interface AddonManifest {
  /** Unique identifier (e.g., "deezer", "youtube-music") */
  id: string;

  /** Human-readable name */
  name: string;

  /** Semantic version */
  version: string;

  /** Addon description */
  description?: string;

  /** Author name */
  author?: string;

  /** Roles this addon fulfills */
  roles: AddonRole[];

  /** Settings schema for plugin configuration UI */
  settingsSchema?: SettingsSchemaItem[];

  /** Privacy transparency manifest (Apple-style privacy labels) */
  privacy?: PrivacyManifest;
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

// ============================================
// Artist Enrichment Provider Contract
// ============================================

/**
 * Artist Enrichment Provider
 * Provides supplementary artist data like videos, concerts, setlists, etc.
 * Each provider specializes in one enrichment type.
 */
export interface ArtistEnrichmentProvider extends BaseAddon {
  /** Unique provider identifier */
  readonly id: string;

  /** Human-readable name */
  readonly name: string;

  /** Type of enrichment this provider offers */
  readonly enrichmentType: ArtistEnrichmentType;

  /** Get music videos for an artist */
  getArtistVideos?(artistName: string, limit?: number): Promise<MusicVideo[]>;

  /** Get music videos for an album (matching album title and track names) */
  getAlbumVideos?(albumTitle: string, artistName: string, trackNames?: string[], limit?: number): Promise<MusicVideo[]>;

  /** Get artist timeline/discography history */
  getArtistTimeline?(artistName: string): Promise<TimelineEntry[]>;

  /** Get past concert setlists */
  getArtistSetlists?(artistName: string, mbid?: string, limit?: number): Promise<Setlist[]>;

  /** Get upcoming concerts/events */
  getUpcomingConcerts?(artistName: string): Promise<Concert[]>;

  /** Get artist gallery images (can use MusicBrainz ID or artist name) */
  getArtistGallery?(mbid: string, artistName?: string): Promise<ArtistImages>;

  /** Get merchandise URL for artist */
  getMerchandiseUrl?(artistName: string): Promise<string | null>;

  /** Search for artist (returns provider-specific ID) */
  searchArtist?(artistName: string): Promise<{ id: string; name: string } | null>;

  /** Get direct video stream URL for playback */
  getVideoStream?(videoId: string, preferredQuality?: string): Promise<VideoStreamInfo | null>;
}

// ============================================
// Metadata Enricher Contract
// Auto-tag tracks from MusicBrainz, Discogs, TheAudioDB, etc.
// ============================================

/** Result from metadata enrichment lookup */
export interface MetadataEnrichmentResult {
  /** Match confidence (0-1) */
  confidence: number;
  /** Source plugin ID */
  source: string;
  /** MusicBrainz recording ID */
  musicbrainzId?: string;
  /** Discogs release ID */
  discogsId?: string;
  /** ISRC code */
  isrc?: string;
  /** UPC/barcode for album */
  upc?: string;
  /** Enriched title */
  title?: string;
  /** Enriched artists */
  artists?: Artist[];
  /** Enriched album */
  album?: Album;
  /** Genres */
  genres?: string[];
  /** Release date */
  releaseDate?: string;
  /** BPM */
  bpm?: number;
  /** Musical key (e.g., "C major", "A minor") */
  musicalKey?: string;
  /** Mood tags */
  moods?: string[];
  /** User tags/folksonomy */
  tags?: string[];
  /** Track credits */
  credits?: {
    producers?: string[];
    writers?: string[];
    composers?: string[];
    engineers?: string[];
    performers?: string[];
  };
  /** Lyrics (if found) */
  lyrics?: string;
  /** Label name */
  label?: string;
  /** Catalog number */
  catalogNumber?: string;
}

/** Query for metadata enrichment */
export interface MetadataEnrichmentQuery {
  /** Track title */
  title: string;
  /** Primary artist name */
  artist: string;
  /** Album name */
  album?: string;
  /** Duration in seconds */
  duration?: number;
  /** ISRC if known */
  isrc?: string;
  /** Audio fingerprint if available */
  fingerprint?: string;
  /** File path for local files */
  filePath?: string;
}

export interface MetadataEnricher extends BaseAddon {
  readonly id: string;
  readonly name: string;
  /** Priority (higher = preferred, tried first) */
  readonly priority: number;

  /**
   * Enrich track metadata from external database
   */
  enrichTrack(query: MetadataEnrichmentQuery): Promise<MetadataEnrichmentResult | null>;

  /**
   * Lookup by external ID (MBID, Discogs ID, etc.)
   */
  lookupById?(id: string, idType: 'musicbrainz' | 'discogs' | 'spotify' | 'deezer' | string): Promise<MetadataEnrichmentResult | null>;

  /**
   * Batch enrich multiple tracks (more efficient for APIs with rate limits)
   */
  enrichBatch?(queries: Array<MetadataEnrichmentQuery & { id: string }>): Promise<Map<string, MetadataEnrichmentResult>>;

  /**
   * Check if this enricher can handle the given query
   */
  canHandle?(query: MetadataEnrichmentQuery): boolean;
}

// ============================================
// Artwork Provider Contract
// Fetch cover art from Cover Art Archive, Fanart.tv, Last.fm, etc.
// ============================================

/** Artwork fetch result */
export interface ArtworkResult {
  /** Source plugin ID */
  source: string;
  /** Available images */
  images: {
    front?: string;
    back?: string;
    disc?: string;
    booklet?: string[];
    liner?: string[];
  };
  /** Pre-generated thumbnails */
  thumbnails: {
    small?: string;   // ~250px
    medium?: string;  // ~500px
    large?: string;   // ~1200px
  };
  /** Animated artwork (Apple Music style) */
  animated?: {
    url: string;
    mimeType: string;
    aspectRatio?: 'square' | 'tall';
  };
}

export interface ArtworkProvider extends BaseAddon {
  readonly id: string;
  readonly name: string;
  readonly priority: number;

  /**
   * Get artwork for an album/release
   */
  getAlbumArtwork(query: {
    artist: string;
    album: string;
    mbid?: string;      // MusicBrainz release ID
    year?: number;
  }): Promise<ArtworkResult | null>;

  /**
   * Get artwork for an artist
   */
  getArtistArtwork?(artistName: string, mbid?: string): Promise<{
    photos: string[];
    logos?: string[];
    backgrounds?: string[];
    banners?: string[];
  } | null>;

  /**
   * Get artwork for a track (single cover)
   */
  getTrackArtwork?(query: {
    title: string;
    artist: string;
    album?: string;
    isrc?: string;
  }): Promise<ArtworkResult | null>;
}

// ============================================
// Fingerprint Provider Contract
// Audio fingerprinting via Chromaprint/AcoustID
// ============================================

/** Audio fingerprint result */
export interface FingerprintResult {
  /** Chromaprint fingerprint string */
  fingerprint: string;
  /** Audio duration in seconds */
  duration: number;
  /** AcoustID identifier (if looked up) */
  acoustId?: string;
  /** MusicBrainz recordings matched */
  recordings?: Array<{
    id: string;
    title: string;
    artists: string[];
    releaseGroups: Array<{
      id: string;
      title: string;
      type: 'album' | 'single' | 'ep' | 'compilation' | 'soundtrack' | string;
    }>;
    score: number;  // Match confidence (0-1)
  }>;
}

export interface FingerprintProvider extends BaseAddon {
  readonly id: string;
  readonly name: string;

  /**
   * Check if fingerprinting is available (native binary installed)
   */
  isAvailable(): Promise<boolean>;

  /**
   * Generate fingerprint for audio file
   */
  generateFingerprint(filePath: string): Promise<{
    fingerprint: string;
    duration: number;
  }>;

  /**
   * Lookup fingerprint in AcoustID database
   */
  lookupFingerprint(fingerprint: string, duration: number): Promise<FingerprintResult>;

  /**
   * Generate and lookup in one step
   */
  identifyTrack(filePath: string): Promise<FingerprintResult>;

  /**
   * Compare two fingerprints for similarity (0-1)
   */
  compareFingerprints(fp1: string, fp2: string): number;
}

// ============================================
// ISRC Resolver Contract
// ISRC → metadata lookup via Deezer, MusicBrainz, etc.
// ============================================

/** ISRC lookup result */
export interface ISRCLookupResult {
  /** The ISRC that was looked up */
  isrc: string;
  /** Source plugin ID */
  source: string;
  /** Track metadata */
  track: {
    title: string;
    artists: string[];
    album?: string;
    duration?: number;
    releaseDate?: string;
    explicit?: boolean;
  };
  /** External IDs */
  externalIds: {
    deezer?: string;
    spotify?: string;
    musicbrainz?: string;
    youtube?: string;
    appleMusic?: string;
  };
  /** Artwork URLs */
  artwork?: ArtworkSet;
}

export interface ISRCResolver extends BaseAddon {
  readonly id: string;
  readonly name: string;
  readonly priority: number;

  /**
   * Lookup track by ISRC code
   */
  lookupISRC(isrc: string): Promise<ISRCLookupResult | null>;

  /**
   * Batch lookup multiple ISRCs
   */
  lookupBatch?(isrcs: string[]): Promise<Map<string, ISRCLookupResult>>;

  /**
   * Find ISRC for a track by metadata
   */
  findISRC?(query: {
    title: string;
    artist: string;
    album?: string;
    duration?: number;
  }): Promise<string | null>;
}

// ============================================
// Analytics Provider Contract
// Stream counts, charts from Songstats, Chartmetric, scrapers
// ============================================

/** Track analytics data */
export interface TrackAnalytics {
  /** Track identifier used for lookup */
  trackId: string;
  /** Source plugin ID */
  source: string;
  /** Last updated timestamp */
  updatedAt: Date;
  /** Streaming data per platform */
  streams?: {
    total?: number;
    spotify?: number;
    appleMusic?: number;
    youtube?: number;
    deezer?: number;
    amazonMusic?: number;
    tidal?: number;
    soundcloud?: number;
  };
  /** Popularity scores per platform (0-100) */
  popularity?: {
    spotify?: number;
    appleMusic?: number;
    deezer?: number;
  };
  /** Chart positions */
  charts?: Array<{
    chart: string;       // e.g., "Spotify Global Top 50"
    position: number;
    peak?: number;
    weeksOnChart?: number;
    date: string;
  }>;
  /** Playlist placements */
  playlists?: Array<{
    name: string;
    platform: string;
    followers?: number;
    addedAt?: string;
  }>;
  /** Shazam data */
  shazam?: {
    count?: number;
    trend?: 'up' | 'down' | 'stable';
  };
  /** Radio airplay */
  radio?: {
    spins?: number;
    stations?: number;
  };
  /** TikTok/social */
  social?: {
    tiktokVideos?: number;
    instagramReels?: number;
  };
}

/** Artist analytics data */
export interface ArtistAnalytics {
  artistId: string;
  source: string;
  updatedAt: Date;
  /** Monthly listeners per platform */
  monthlyListeners?: {
    spotify?: number;
    appleMusic?: number;
    deezer?: number;
  };
  /** Follower counts */
  followers?: {
    spotify?: number;
    instagram?: number;
    twitter?: number;
    youtube?: number;
    tiktok?: number;
  };
  /** Total streams */
  totalStreams?: number;
}

export interface AnalyticsProvider extends BaseAddon {
  readonly id: string;
  readonly name: string;
  /** Whether this provider requires paid API access */
  readonly requiresPaidAccess: boolean;
  /** Data freshness (how often data updates) */
  readonly dataFreshness: 'realtime' | 'daily' | 'weekly';

  /**
   * Get analytics for a track
   */
  getTrackAnalytics(query: {
    isrc?: string;
    spotifyId?: string;
    title?: string;
    artist?: string;
  }): Promise<TrackAnalytics | null>;

  /**
   * Get analytics for an artist
   */
  getArtistAnalytics?(query: {
    spotifyId?: string;
    name?: string;
  }): Promise<ArtistAnalytics | null>;

  /**
   * Check if provider has data for track
   */
  hasData?(isrc: string): Promise<boolean>;
}

// ============================================
// Smart Playlist Rules Contract
// Custom smart playlist rule types
// ============================================

/** Smart playlist rule definition */
export interface SmartPlaylistRule {
  /** Field to filter on */
  field: string;
  /** Comparison operator */
  operator: string;
  /** Value to compare against */
  value: unknown;
}

/** Rule field definition (for UI) */
export interface SmartPlaylistRuleDefinition {
  /** Field identifier */
  field: string;
  /** Display label */
  label: string;
  /** Value type */
  type: 'string' | 'number' | 'date' | 'boolean' | 'enum' | 'duration' | 'custom';
  /** Available operators for this field */
  operators: Array<{
    id: string;
    label: string;
  }>;
  /** For enum type: available values */
  enumValues?: Array<{ value: string; label: string }>;
  /** Category for grouping in UI */
  category?: 'metadata' | 'playback' | 'library' | 'audio' | 'custom';
  /** Description/help text */
  description?: string;
}

export interface SmartPlaylistRulesProvider extends BaseAddon {
  readonly id: string;
  readonly name: string;

  /**
   * Get custom rule definitions this provider adds
   */
  getRuleDefinitions(): SmartPlaylistRuleDefinition[];

  /**
   * Evaluate a rule against a track (for custom rules)
   * Can accept either a track object or a track ID
   */
  evaluateRule(rule: SmartPlaylistRule, trackOrId: MetadataTrack | string): Promise<boolean>;

  /**
   * Convert rule to SQL WHERE clause (if possible)
   * If provided, this allows the rule to be evaluated directly in the database
   */
  getRuleSql?(rule: SmartPlaylistRule): { sql: string; params: unknown[] } | null;
}

// ============================================
// Duplicate Detector Contract
// Find duplicate tracks via fingerprint or metadata
// ============================================

/** Duplicate candidate pair */
export interface DuplicateCandidate {
  /** First track */
  trackA: {
    id: string;
    path?: string;
    title: string;
    artist: string;
    duration?: number;
  };
  /** Second track */
  trackB: {
    id: string;
    path?: string;
    title: string;
    artist: string;
    duration?: number;
  };
  /** Overall similarity score (0-1) */
  similarity: number;
  /** Type of match */
  matchType: 'exact' | 'audio-match' | 'metadata-match' | 'possible';
  /** Detailed comparison */
  details: {
    fingerprintMatch?: number;
    titleSimilarity?: number;
    artistSimilarity?: number;
    durationDiff?: number;
    qualityComparison?: {
      trackA: { bitrate?: number; format?: string; sampleRate?: number };
      trackB: { bitrate?: number; format?: string; sampleRate?: number };
      recommended: 'A' | 'B';
    };
  };
}

export interface DuplicateDetector extends BaseAddon {
  readonly id: string;
  readonly name: string;

  /**
   * Scan library for duplicates
   */
  findDuplicates(options?: {
    threshold?: number;       // Similarity threshold (0-1), default 0.85
    useFingerprint?: boolean; // Use audio fingerprinting
    useMetadata?: boolean;    // Use metadata comparison
    folderId?: string;        // Limit to specific folder
    progressCallback?: (progress: { scanned: number; total: number; found: number }) => void;
  }): AsyncGenerator<DuplicateCandidate, void, unknown>;

  /**
   * Compare two specific tracks
   */
  compareTracks(trackAPath: string, trackBPath: string): Promise<DuplicateCandidate | null>;

  /**
   * Cancel ongoing scan
   */
  cancelScan?(): void;
}

// ============================================
// Import Provider Contract
// Import from Spotify, Apple Music, M3U, Rekordbox, etc.
// ============================================

/** Import source configuration */
export interface ImportSource {
  type: 'file' | 'url' | 'service';
  /** Supported file formats for 'file' type */
  formats?: string[];  // ['m3u', 'm3u8', 'json', 'csv', 'xml', 'nml']
  /** Supported services for 'service' type */
  services?: string[]; // ['spotify', 'apple-music', 'youtube-music', 'deezer', 'tidal']
}

/** Import result */
export interface ImportResult {
  /** Number of items successfully imported */
  imported: number;
  /** Number of items skipped (already exist, etc.) */
  skipped: number;
  /** Items that failed to import */
  errors: Array<{ item: string; error: string }>;
  /** Playlists created/updated */
  playlists?: Array<{ id: string; name: string; trackCount: number }>;
  /** Tracks matched/added */
  tracks?: Array<{ id: string; title: string; artist: string; matched: boolean }>;
}

export interface ImportProvider extends BaseAddon {
  readonly id: string;
  readonly name: string;
  readonly source: ImportSource;

  /**
   * Import from file (M3U, JSON, etc.)
   */
  importFile?(filePath: string, options?: {
    targetPlaylist?: string;
    createPlaylist?: boolean;
    matchStrategy?: 'exact' | 'fuzzy' | 'fingerprint';
  }): Promise<ImportResult>;

  /**
   * Import from streaming service
   */
  importFromService?(options: {
    playlists?: string[];    // Playlist IDs to import
    likedSongs?: boolean;    // Import liked songs
    albums?: string[];       // Album IDs to import
    artists?: string[];      // Import all from artists
  }): Promise<ImportResult>;

  /**
   * Get available items from service (for selection UI)
   */
  getImportableItems?(): Promise<{
    playlists: Array<{ id: string; name: string; trackCount: number; image?: string }>;
    likedCount?: number;
    albumCount?: number;
  }>;

  /**
   * Check if service auth is configured
   */
  isAuthenticated?(): boolean;

  /**
   * Start OAuth flow for service
   */
  authenticate?(): Promise<boolean>;
}

// ============================================
// Export Provider Contract
// Export to M3U, JSON, CSV, XML, etc.
// ============================================

/** Export format configuration */
export interface ExportFormat {
  id: string;
  name: string;
  extension: string;
  mimeType: string;
}

export interface ExportProvider extends BaseAddon {
  readonly id: string;
  readonly name: string;
  readonly formats: ExportFormat[];

  /**
   * Export a playlist
   */
  exportPlaylist(playlistId: string, format: string, options?: {
    includeMetadata?: boolean;
    relativePaths?: boolean;
    encoding?: 'utf-8' | 'utf-16' | 'ascii';
  }): Promise<{
    filename: string;
    content: string | Buffer;
    mimeType: string;
  }>;

  /**
   * Export entire library
   */
  exportLibrary?(format: string, options?: {
    includeLikes?: boolean;
    includePlaylists?: boolean;
    includeHistory?: boolean;
  }): Promise<{
    filename: string;
    content: string | Buffer;
    mimeType: string;
  }>;

  /**
   * Export to streaming service (sync)
   */
  syncToService?(options: {
    playlists?: string[];
    likedSongs?: boolean;
  }): Promise<{ synced: number; failed: number }>;
}

// ============================================
// Library Hook Contract
// React to library events
// ============================================

/** Library event types */
export type LibraryEventType =
  | 'track:added'
  | 'track:removed'
  | 'track:played'
  | 'track:liked'
  | 'track:unliked'
  | 'track:disliked'
  | 'track:metadata-changed'
  | 'track:artwork-changed'
  | 'playlist:created'
  | 'playlist:deleted'
  | 'playlist:renamed'
  | 'playlist:tracks-added'
  | 'playlist:tracks-removed'
  | 'playlist:reordered'
  | 'folder:created'
  | 'folder:deleted'
  | 'folder:renamed'
  | 'scan:started'
  | 'scan:progress'
  | 'scan:completed'
  | 'scan:error'
  | 'download:started'
  | 'download:progress'
  | 'download:completed'
  | 'download:error'
  | 'import:completed'
  | 'export:completed';

/** Library event payload */
export interface LibraryEvent<T = unknown> {
  type: LibraryEventType;
  timestamp: Date;
  data: T;
}

export interface LibraryHook extends BaseAddon {
  readonly id: string;
  readonly name: string;
  /** Events this hook wants to receive */
  readonly subscribedEvents: LibraryEventType[];

  /**
   * Handle a library event
   */
  onEvent(event: LibraryEvent): Promise<void>;

  /**
   * Called when hook is enabled
   */
  onEnable?(): Promise<void>;

  /**
   * Called when hook is disabled
   */
  onDisable?(): Promise<void>;
}

// ============================================
// Search Provider Contract
// Provide search results for videos, playlists, concerts, etc.
// ============================================

/** Search result types that a provider can supply */
export type SearchResultType = 'videos' | 'playlists' | 'concerts' | 'artists' | 'albums' | 'tracks';

/** Search options for provider queries */
export interface SearchProviderOptions {
  limit?: number;
  offset?: number;
}

/** Aggregated search results from a provider */
export interface SearchProviderResults {
  videos?: MusicVideo[];
  playlists?: Playlist[];
  concerts?: Concert[];
  /** Source plugin ID */
  source: string;
}

/**
 * Search Provider
 * Provides supplementary search results like videos, playlists, concerts.
 * Plugins can implement any subset of search methods.
 */
export interface SearchProvider extends BaseAddon {
  /** Unique provider identifier */
  readonly id: string;

  /** Human-readable name */
  readonly name: string;

  /** Types of search results this provider can supply */
  readonly supportedSearchTypes: SearchResultType[];

  /**
   * Search for videos (music videos, live performances, etc.)
   */
  searchVideos?(query: string, options?: SearchProviderOptions): Promise<MusicVideo[]>;

  /**
   * Search for playlists (from external services like Spotify, YouTube Music, etc.)
   */
  searchPlaylists?(query: string, options?: SearchProviderOptions): Promise<Playlist[]>;

  /**
   * Search for concerts/events
   */
  searchConcerts?(query: string, options?: SearchProviderOptions): Promise<Concert[]>;

  /**
   * Unified search that returns all supported types at once
   * More efficient for providers that can query multiple types in one request
   */
  search?(query: string, options?: SearchProviderOptions): Promise<SearchProviderResults>;

  /**
   * Get video stream URL for playback (if provider supports video playback)
   */
  getVideoStream?(videoId: string, preferredQuality?: string): Promise<VideoStreamInfo | null>;
}
