/**
 * Artwork utilities for properly accessing track artwork
 */

export interface ArtworkSet {
  small?: string;
  medium?: string;
  large?: string;
  original?: string;
  animated?: {
    videoUrl: string;
    aspectRatio: 'tall' | 'square';
    previewFrame?: string;
    hasAudio?: boolean;
  };
}

export interface TrackWithArtwork {
  artwork?: ArtworkSet | string;
  album?: {
    artwork?: ArtworkSet | string;
  };
}

/**
 * Get artwork URL from an ArtworkSet at the specified size
 * Falls back through sizes: requested → medium → small → large → original
 */
export function getArtworkUrl(
  artwork: ArtworkSet | string | undefined,
  size: 'small' | 'medium' | 'large' | 'original' = 'medium'
): string | undefined {
  if (!artwork) return undefined;

  // Handle legacy string URLs
  if (typeof artwork === 'string') {
    return artwork;
  }

  // Try requested size first, then fall back through options
  return artwork[size]
    || artwork.medium
    || artwork.small
    || artwork.large
    || artwork.original;
}

/**
 * Get artwork URL from a track, checking track artwork first, then album artwork
 * @param track - Track object with optional artwork and album.artwork
 * @param size - Desired image size
 * @returns Artwork URL or undefined
 */
export function getTrackArtwork(
  track: TrackWithArtwork | null | undefined,
  size: 'small' | 'medium' | 'large' | 'original' = 'medium'
): string | undefined {
  if (!track) return undefined;

  // Try track's own artwork first
  const trackArtwork = getArtworkUrl(track.artwork, size);
  if (trackArtwork) return trackArtwork;

  // Fall back to album artwork
  return getArtworkUrl(track.album?.artwork, size);
}

/**
 * Check if a track has animated artwork available
 */
export function hasAnimatedArtwork(track: TrackWithArtwork | null | undefined): boolean {
  if (!track?.artwork || typeof track.artwork === 'string') return false;
  return !!track.artwork.animated?.videoUrl;
}

/**
 * Get animated artwork info if available
 */
export function getAnimatedArtwork(track: TrackWithArtwork | null | undefined) {
  if (!track?.artwork || typeof track.artwork === 'string') return undefined;
  return track.artwork.animated;
}
