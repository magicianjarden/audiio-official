/**
 * Collection API type definitions
 */

import type { SuccessResponse, Timestamp } from './common.types';

/** Collection entity */
export interface Collection {
  id: string;
  name: string;
  description?: string;
  coverImage?: string;
  color?: string;
  icon?: string;
  itemCount: number;
  position: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/** Item types that can be in a collection */
export type CollectionItemType = 'album' | 'artist' | 'playlist' | 'track' | 'tag' | 'folder';

/** Collection item */
export interface CollectionItem {
  id: string;
  collectionId: string;
  itemType: CollectionItemType;
  itemId: string;
  itemData: Record<string, unknown>;
  parentFolderId: string | null;
  position: number;
  addedAt: Timestamp;
}

/** Collection with all items */
export interface CollectionWithItems extends Collection {
  items: CollectionItem[];
}

/** Collection folder (for organizing items within a collection) */
export interface CollectionFolder {
  id: string;
  collectionId: string;
  name: string;
  parentFolderId: string | null;
  position: number;
  isExpanded?: boolean;
  createdAt: Timestamp;
}

// Request types
export interface CreateCollectionRequest {
  name: string;
  description?: string;
  color?: string;
  icon?: string;
}

export interface UpdateCollectionRequest {
  name?: string;
  description?: string;
  coverImage?: string;
  color?: string;
  icon?: string;
}

export interface AddCollectionItemRequest {
  type: CollectionItemType;
  id: string;
  data?: Record<string, unknown>;
  parentFolderId?: string | null;
}

export interface CreateFolderRequest {
  name: string;
  parentFolderId?: string | null;
}

export interface UpdateFolderRequest {
  name?: string;
  isExpanded?: boolean;
}

// Response types
export interface CollectionsGetAllResponse {
  collections: Collection[];
}

export interface CollectionGetResponse extends CollectionWithItems {}

export interface CollectionCreateResponse extends SuccessResponse {
  collection?: Collection;
}

export interface CollectionItemAddResponse extends SuccessResponse {
  item?: CollectionItem;
}

export interface CollectionFolderCreateResponse extends SuccessResponse {
  item?: CollectionFolder;
}
