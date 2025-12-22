/**
 * Apple Music Animated Artwork Provider
 * Fetches animated album artwork from Apple Music to enhance track display
 * Based on: https://github.com/Skidudeaa/Apple-Music-Animated-Artwork-Fetcher
 */

import {
  type AddonManifest,
  type BaseAddon,
  type ArtworkSet,
  type AnimatedArtwork as SdkAnimatedArtwork,
  type AppleMusicArtworkSettings,
  getMediaProcessor,
  type HLSConversionOptions,
  type ConversionResult
} from '@audiio/sdk';

const ITUNES_API = 'https://itunes.apple.com';
const APPLE_MUSIC_API = 'https://amp-api.music.apple.com/v1/catalog';

// Token sources to try fetching from (Apple's JS bundles)
const TOKEN_SOURCES = [
  'https://music.apple.com/us/browse',
  'https://music.apple.com/us/album/1',
];

/** Default settings */
const DEFAULT_SETTINGS: AppleMusicArtworkSettings = {
  artworkType: 'animated',
  aspectRatio: 'tall',
  loopCount: 2,
  includeAudio: false
};

interface ITunesSearchResult {
  resultCount: number;
  results: ITunesAlbum[];
}

interface ITunesAlbum {
  collectionId: number;
  collectionName: string;
  artistName: string;
  artworkUrl100: string;
  collectionViewUrl: string;
  releaseDate: string;
  trackCount: number;
  primaryGenreName: string;
}

/** Apple Music API response structures */
interface AppleMusicAlbumResponse {
  data: AppleMusicAlbum[];
}

interface AppleMusicAlbum {
  id: string;
  type: string;
  attributes: AppleMusicAlbumAttributes;
}

interface AppleMusicAlbumAttributes {
  name: string;
  artistName: string;
  artwork: {
    url: string;
    width: number;
    height: number;
  };
  editorialVideo?: EditorialVideo;
}

interface EditorialVideo {
  motionDetailTall?: VideoAsset;
  motionDetailSquare?: VideoAsset;
  motionSquareVideo1x1?: VideoAsset;
}

interface VideoAsset {
  video: string; // M3U8 URL
  previewFrame?: {
    url: string;
  };
}

export interface AnimatedArtwork {
  /** URL to the animated artwork video (M3U8 HLS stream) */
  videoUrl?: string;
  /** URL to static high-res artwork */
  staticUrl: string;
  /** Whether animated artwork is available */
  hasAnimated: boolean;
  /** Aspect ratio of the animated artwork */
  aspectRatio: 'tall' | 'square';
  /** Apple Music album ID */
  albumId: string;
  /** Preview frame URL if available */
  previewFrameUrl?: string;
}

export interface ConvertedArtwork extends AnimatedArtwork {
  /** Path to the converted MP4 file */
  mp4Path: string;
  /** MP4 file as a Buffer (if requested) */
  mp4Buffer?: Buffer;
  /** File size in bytes */
  fileSize: number;
  /** Conversion duration in ms */
  conversionTime: number;
}

/** Options for artwork conversion - extends core HLSConversionOptions */
export type ArtworkConversionOptions = HLSConversionOptions;

export interface ArtworkQuery {
  /** Album title */
  album: string;
  /** Artist name */
  artist: string;
  /** Track title (for more accurate matching) */
  track?: string;
}

export class AppleMusicArtworkProvider implements BaseAddon {
  readonly id = 'applemusic-artwork';
  readonly name = 'Apple Music Artwork';
  readonly priority = 90; // Higher priority for artwork

  private settings: AppleMusicArtworkSettings = { ...DEFAULT_SETTINGS };
  private cachedToken: string | null = null;
  private tokenRefreshAttempted = false;

  get manifest(): AddonManifest {
    return {
      id: this.id,
      name: this.name,
      version: '1.0.0',
      description: 'Fetches animated album artwork from Apple Music',
      roles: [] // This is an artwork enhancement utility, not a full metadata provider
    };
  }

  async initialize(): Promise<void> {
    // No initialization needed
  }

  async dispose(): Promise<void> {
    // No cleanup needed
  }

  /**
   * Update provider settings
   */
  updateSettings(settings: Partial<AppleMusicArtworkSettings>): void {
    this.settings = { ...this.settings, ...settings };
  }

  /**
   * Get current settings
   */
  getSettings(): Record<string, unknown> {
    return { ...this.settings } as Record<string, unknown>;
  }

  /**
   * Search for an album and get its artwork
   */
  async getArtwork(query: ArtworkQuery): Promise<AnimatedArtwork | null> {
    try {
      // Search iTunes for the album to get the ID
      const album = await this.searchAlbum(query);
      if (!album) {
        return null;
      }

      // Fetch animated artwork from Apple Music API
      const animatedArtwork = await this.fetchAnimatedArtwork(String(album.collectionId));

      if (animatedArtwork) {
        return animatedArtwork;
      }

      // Fall back to static artwork if no animated available
      return {
        staticUrl: this.resizeArtworkUrl(album.artworkUrl100, 3000),
        hasAnimated: false,
        aspectRatio: this.settings.aspectRatio,
        albumId: String(album.collectionId)
      };
    } catch (error) {
      console.error('Apple Music artwork fetch error:', error);
      return null;
    }
  }

  /**
   * Get artwork by Apple Music album ID directly
   */
  async getArtworkById(albumId: string): Promise<AnimatedArtwork | null> {
    try {
      // Try to get animated artwork first
      const animatedArtwork = await this.fetchAnimatedArtwork(albumId);
      if (animatedArtwork) {
        return animatedArtwork;
      }

      // Fall back to iTunes lookup for static artwork
      const url = `${ITUNES_API}/lookup?id=${albumId}&entity=album`;
      const response = await fetch(url);

      if (!response.ok) {
        return null;
      }

      const data = await response.json() as ITunesSearchResult;
      const album = data.results[0];
      if (data.resultCount === 0 || !album) {
        return null;
      }

      return {
        staticUrl: this.resizeArtworkUrl(album.artworkUrl100, 3000),
        hasAnimated: false,
        aspectRatio: this.settings.aspectRatio,
        albumId
      };
    } catch {
      return null;
    }
  }

  /**
   * Get a valid token, refreshing if necessary
   */
  private async getToken(): Promise<string | null> {
    if (this.cachedToken) {
      return this.cachedToken;
    }

    // Try to fetch a fresh token
    const token = await this.refreshToken();
    if (token) {
      this.cachedToken = token;
    }
    return token;
  }

  /**
   * Fetch animated artwork from Apple Music API
   */
  private async fetchAnimatedArtwork(albumId: string, country = 'us'): Promise<AnimatedArtwork | null> {
    try {
      const token = await this.getToken();
      if (!token) {
        console.warn('No Apple Music token available, cannot fetch animated artwork');
        return null;
      }

      const url = `${APPLE_MUSIC_API}/${country}/albums/${albumId}?extend=editorialVideo`;

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Origin': 'https://music.apple.com'
        }
      });

      if (!response.ok) {
        // Token might be expired, try to refresh once
        if (response.status === 401 && !this.tokenRefreshAttempted) {
          this.tokenRefreshAttempted = true;
          this.cachedToken = null;
          const newToken = await this.refreshToken();
          if (newToken) {
            this.cachedToken = newToken;
            this.tokenRefreshAttempted = false;
            return this.fetchAnimatedArtwork(albumId, country);
          }
        }
        return null;
      }

      // Reset the refresh flag on success
      this.tokenRefreshAttempted = false;

      const data = await response.json() as AppleMusicAlbumResponse;
      const albumData = data.data[0];

      if (!albumData) {
        return null;
      }

      const attributes = albumData.attributes;
      const editorialVideo = attributes.editorialVideo;

      // Get static artwork URL
      const staticUrl = attributes.artwork?.url
        ? attributes.artwork.url.replace('{w}x{h}', '3000x3000')
        : '';

      // Check for animated artwork
      if (!editorialVideo) {
        return {
          staticUrl,
          hasAnimated: false,
          aspectRatio: this.settings.aspectRatio,
          albumId
        };
      }

      // Extract video URL based on preferred aspect ratio
      const videoAsset = this.extractVideoAsset(editorialVideo);

      return {
        videoUrl: videoAsset?.video,
        staticUrl,
        hasAnimated: !!videoAsset?.video,
        aspectRatio: this.settings.aspectRatio,
        albumId,
        previewFrameUrl: videoAsset?.previewFrame?.url
      };
    } catch (error) {
      console.error('Failed to fetch animated artwork:', error);
      return null;
    }
  }

  /**
   * Extract video asset based on settings
   */
  private extractVideoAsset(editorialVideo: EditorialVideo): VideoAsset | undefined {
    if (this.settings.aspectRatio === 'tall') {
      return editorialVideo.motionDetailTall;
    }

    // For square, try multiple possible keys
    return editorialVideo.motionDetailSquare || editorialVideo.motionSquareVideo1x1;
  }

  /**
   * Refresh the Apple Music token by fetching from the web player
   * The token is a JWT embedded in Apple's JavaScript bundles
   */
  private async refreshToken(): Promise<string | null> {
    // JWT pattern for Apple Music WebPlay token
    const tokenPattern = /eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IldlYlBsYXlLaWQifQ\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/;

    for (const source of TOKEN_SOURCES) {
      try {
        const response = await fetch(source, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        });

        if (!response.ok) {
          continue;
        }

        const html = await response.text();
        const tokenMatch = html.match(tokenPattern);

        if (tokenMatch) {
          console.log('Successfully refreshed Apple Music token');
          return tokenMatch[0];
        }
      } catch (error) {
        console.warn(`Failed to fetch token from ${source}:`, error);
      }
    }

    console.error('Could not refresh Apple Music token from any source');
    return null;
  }

  /**
   * Manually set the Apple Music token (useful for configuration)
   */
  setToken(token: string): void {
    this.cachedToken = token;
    this.tokenRefreshAttempted = false;
  }

  /**
   * Get animated artwork and convert to MP4
   * This is the main method for backend use - handles the full pipeline
   */
  async getAnimatedArtworkAsMP4(
    query: ArtworkQuery,
    options: ArtworkConversionOptions = {}
  ): Promise<ConvertedArtwork | null> {
    const artwork = await this.getArtwork(query);

    if (!artwork || !artwork.hasAnimated || !artwork.videoUrl) {
      return null;
    }

    return this.convertToMP4(artwork, options);
  }

  /**
   * Get animated artwork by album ID and convert to MP4
   */
  async getAnimatedArtworkByIdAsMP4(
    albumId: string,
    options: ArtworkConversionOptions = {}
  ): Promise<ConvertedArtwork | null> {
    const artwork = await this.getArtworkById(albumId);

    if (!artwork || !artwork.hasAnimated || !artwork.videoUrl) {
      return null;
    }

    return this.convertToMP4(artwork, options);
  }

  /**
   * Convert an AnimatedArtwork M3U8 stream to MP4
   * Uses core MediaProcessor for FFmpeg operations
   */
  async convertToMP4(
    artwork: AnimatedArtwork,
    options: ArtworkConversionOptions = {}
  ): Promise<ConvertedArtwork | null> {
    if (!artwork.videoUrl) {
      return null;
    }

    const mediaProcessor = getMediaProcessor();

    // Use settings for defaults
    const conversionOptions: HLSConversionOptions = {
      loopCount: options.loopCount ?? this.settings.loopCount,
      filename: options.filename ?? `artwork_${artwork.albumId}_${Date.now()}`,
      ...options
    };

    const result: ConversionResult = await mediaProcessor.convertHLSToMP4(
      artwork.videoUrl,
      conversionOptions
    );

    return {
      ...artwork,
      mp4Path: result.outputPath,
      mp4Buffer: result.buffer,
      fileSize: result.size,
      conversionTime: result.duration
    };
  }

  /**
   * Check if FFmpeg is available on the system
   */
  async checkFFmpegAvailable(): Promise<boolean> {
    const mediaProcessor = getMediaProcessor();
    return mediaProcessor.checkFFmpegAvailable();
  }

  /**
   * Convert to standard ArtworkSet format
   * Includes animated artwork when available and settings allow
   */
  async getArtworkSet(query: ArtworkQuery): Promise<ArtworkSet | null> {
    const artwork = await this.getArtwork(query);
    if (!artwork) {
      return null;
    }

    const artworkSet: ArtworkSet = {
      small: this.resizeArtworkUrl(artwork.staticUrl, 100),
      medium: this.resizeArtworkUrl(artwork.staticUrl, 300),
      large: this.resizeArtworkUrl(artwork.staticUrl, 600),
      original: artwork.staticUrl
    };

    // Include animated artwork if available and settings prefer animated
    if (artwork.hasAnimated && artwork.videoUrl && this.settings.artworkType === 'animated') {
      // Convert HLS to MP4 for browser compatibility
      try {
        const converted = await this.convertToMP4(artwork, { returnBuffer: false, cleanup: false });
        if (converted?.mp4Path) {
          const animatedArtwork: SdkAnimatedArtwork = {
            videoUrl: `file://${converted.mp4Path}`,
            aspectRatio: artwork.aspectRatio,
            previewFrame: artwork.previewFrameUrl || artwork.staticUrl,
            hasAudio: this.settings.includeAudio,
            albumId: artwork.albumId
          };
          artworkSet.animated = animatedArtwork;
        }
      } catch (error) {
        console.error('Failed to convert animated artwork:', error);
        // Still return static artwork if conversion fails
      }
    }

    return artworkSet;
  }

  /**
   * Search iTunes for an album
   */
  private async searchAlbum(query: ArtworkQuery): Promise<ITunesAlbum | null> {
    const searchTerm = `${query.album} ${query.artist}`.trim();
    const url = `${ITUNES_API}/search?term=${encodeURIComponent(searchTerm)}&entity=album&limit=5`;

    const response = await fetch(url);
    if (!response.ok) {
      return null;
    }

    const data = await response.json() as ITunesSearchResult;
    if (data.resultCount === 0) {
      return null;
    }

    // Find best match
    return this.findBestMatch(data.results, query);
  }

  /**
   * Find the best matching album from search results
   */
  private findBestMatch(results: ITunesAlbum[], query: ArtworkQuery): ITunesAlbum | null {
    const firstResult = results[0];
    if (results.length === 0 || !firstResult) {
      return null;
    }

    const normalizedAlbum = this.normalizeString(query.album);
    const normalizedArtist = this.normalizeString(query.artist);

    // Score each result
    let bestMatch: ITunesAlbum = firstResult;
    let bestScore = 0;

    for (const result of results) {
      let score = 0;
      const resultAlbum = this.normalizeString(result.collectionName);
      const resultArtist = this.normalizeString(result.artistName);

      // Album name matching
      if (resultAlbum === normalizedAlbum) {
        score += 50;
      } else if (resultAlbum.includes(normalizedAlbum) || normalizedAlbum.includes(resultAlbum)) {
        score += 30;
      }

      // Artist name matching
      if (resultArtist === normalizedArtist) {
        score += 50;
      } else if (resultArtist.includes(normalizedArtist) || normalizedArtist.includes(resultArtist)) {
        score += 30;
      }

      if (score > bestScore) {
        bestScore = score;
        bestMatch = result;
      }
    }

    // Require minimum score for a match
    return bestScore >= 50 ? bestMatch : firstResult;
  }

  /**
   * Resize artwork URL to specified size
   */
  private resizeArtworkUrl(url: string, size: number): string {
    // iTunes artwork URLs contain size info that can be modified
    // e.g., artworkUrl100 -> change 100x100 to desired size
    return url.replace(/\d+x\d+bb/, `${size}x${size}bb`);
  }

  /**
   * Normalize string for comparison
   */
  private normalizeString(str: string): string {
    return str
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\w\s]/g, '')
      .trim();
  }
}

// Default export for addon loading
export default AppleMusicArtworkProvider;
