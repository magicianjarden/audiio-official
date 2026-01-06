/**
 * Tag API type definitions
 */

import type { SuccessResponse } from './common.types';

/** Tag entity */
export interface Tag {
  id: string;
  name: string;
  color: string;
  usageCount: number;
  createdAt: number;
}

/** Track tag association */
export interface TrackTag {
  id: string;
  trackId: string;
  tagName: string;
  color?: string;
  createdAt: number;
}

/** Entity tag (for albums, artists, playlists) */
export interface EntityTag {
  id: string;
  entityType: 'album' | 'artist' | 'playlist';
  entityId: string;
  tagName: string;
  createdAt: number;
}

// Response types
export interface TagsGetAllResponse {
  tags: Tag[];
}

export interface TagCreateResponse extends SuccessResponse {
  tag?: Tag;
}

export interface TrackTagsResponse {
  tags: TrackTag[];
}

export interface TrackTagAddResponse extends SuccessResponse {
  trackTag?: TrackTag;
}

export interface EntityTagsResponse {
  tags: EntityTag[];
}

export interface EntityTagAddResponse extends SuccessResponse {
  entityTag?: EntityTag;
}

export interface TracksByTagResponse {
  trackIds: string[];
}
