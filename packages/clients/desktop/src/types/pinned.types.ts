/**
 * Pinned Items API type definitions
 */

import type { SuccessResponse, Timestamp } from './common.types';

/** Pinned item types */
export type PinnedItemType = 'playlist' | 'album' | 'artist' | 'collection' | 'smart_playlist';

/** Pinned item entity */
export interface PinnedItem {
  id: string;
  itemType: PinnedItemType;
  itemId: string;
  itemData: Record<string, unknown>;
  position: number;
  pinnedAt: Timestamp;
}

// Request types
export interface PinItemRequest {
  itemType: string;
  itemId: string;
  itemData?: Record<string, unknown>;
}

export interface ReorderPinnedRequest {
  items: Array<{ itemType: string; itemId: string }>;
}

// Response types
export interface PinnedGetAllResponse {
  items: PinnedItem[];
}

export interface PinnedAddResponse extends SuccessResponse {
  item?: PinnedItem;
}

export interface PinnedCheckResponse {
  pinned: boolean;
}
