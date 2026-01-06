/**
 * Enrichment API type definitions
 */

import type { SuccessResponse, Timestamp } from './common.types';

/** Enrichment types available */
export type EnrichmentType =
  | 'videos'
  | 'timeline'
  | 'setlists'
  | 'concerts'
  | 'gallery'
  | 'merchandise';

/** Video result */
export interface MusicVideo {
  id: string;
  title: string;
  thumbnail?: string;
  duration?: number;          // seconds
  viewCount?: number;
  publishedAt?: string;
  source: 'youtube' | 'vimeo' | 'other';
  url?: string;
}

/** Video stream info */
export interface VideoStream {
  url: string;
  quality: '360p' | '480p' | '720p' | '1080p' | 'audio';
  format: string;
  bitrate?: number;
  hasAudio: boolean;
  hasVideo: boolean;
}

/** Timeline event */
export interface TimelineEvent {
  id: string;
  date: string;
  type: 'album' | 'single' | 'ep' | 'tour' | 'award' | 'milestone';
  title: string;
  description?: string;
  image?: string;
  links?: Array<{ label: string; url: string }>;
}

/** Setlist */
export interface Setlist {
  id: string;
  date: string;
  venue: string;
  city: string;
  country: string;
  tour?: string;
  songs: Array<{
    name: string;
    info?: string;
    tape?: boolean;
    cover?: { name: string; artist: string };
  }>;
  source?: string;
}

/** Concert/event */
export interface Concert {
  id: string;
  date: string;
  venue: string;
  city: string;
  country: string;
  status: 'confirmed' | 'cancelled' | 'postponed' | 'sold_out';
  ticketUrl?: string;
  price?: {
    min: number;
    max: number;
    currency: string;
  };
}

/** Gallery image */
export interface GalleryImage {
  id: string;
  url: string;
  thumbnailUrl?: string;
  width?: number;
  height?: number;
  caption?: string;
  source?: string;
  date?: string;
}

/** Gallery collection */
export interface Gallery {
  artistName: string;
  mbid?: string;
  images: GalleryImage[];
  total: number;
}

/** Merchandise item */
export interface MerchandiseItem {
  id: string;
  name: string;
  description?: string;
  price: number;
  currency: string;
  image?: string;
  url: string;
  category?: string;
  inStock?: boolean;
}

/** Merchandise collection */
export interface Merchandise {
  artistName: string;
  items: MerchandiseItem[];
  storeUrl?: string;
}

// Response types
export interface EnrichmentTypesResponse {
  types: EnrichmentType[];
}

export interface EnrichmentResponse<T> {
  success: boolean;
  data: T;
  source: string;
  cachedAt?: Timestamp;
}

export interface ArtistVideosResponse extends EnrichmentResponse<MusicVideo[]> {}

export interface AlbumVideosResponse extends EnrichmentResponse<MusicVideo[]> {}

export interface VideoStreamResponse extends EnrichmentResponse<VideoStream> {}

export interface ArtistTimelineResponse extends EnrichmentResponse<TimelineEvent[]> {}

export interface ArtistSetlistsResponse extends EnrichmentResponse<Setlist[]> {}

export interface ArtistConcertsResponse extends EnrichmentResponse<Concert[]> {}

export interface ArtistGalleryResponse extends EnrichmentResponse<Gallery> {}

export interface ArtistMerchandiseResponse extends EnrichmentResponse<Merchandise> {}
