/**
 * Collection store - manages user collections and pinned items
 *
 * Collections are flexible "hubs" that can contain:
 * - Albums, Artists, Playlists, Tracks, Tags
 * - Folders (for organizing items within the collection)
 *
 * Pinned items appear in the sidebar for quick access.
 */

import { create } from 'zustand';
import { showSuccessToast, showErrorToast } from './toast-store';

export interface Collection {
  id: string;
  name: string;
  description?: string;
  coverImage?: string;
  itemCount: number;
  position: number;
  createdAt: number;
  updatedAt: number;
}

export interface CollectionItem {
  id: string;
  collectionId: string;
  itemType: 'album' | 'artist' | 'playlist' | 'track' | 'tag' | 'folder';
  itemId: string;
  itemData: Record<string, unknown>;
  parentFolderId: string | null; // For items inside a folder within the collection
  position: number;
  addedAt: number;
}

export interface CollectionWithItems extends Collection {
  items: CollectionItem[];
}

export interface PinnedItem {
  id: string;
  itemType: 'playlist' | 'album' | 'artist' | 'collection' | 'smart_playlist';
  itemId: string;
  itemData: Record<string, unknown>;
  position: number;
  pinnedAt: number;
}

export interface LibraryView {
  id: string;
  name: string;
  icon?: string;
  filters: Record<string, unknown>;
  sortBy?: string;
  sortDirection?: 'asc' | 'desc';
  isBuiltIn: boolean;
  createdAt: number;
}

interface CollectionState {
  // Collections
  collections: Collection[];

  // Pinned items
  pinnedItems: PinnedItem[];

  // Library views
  libraryViews: LibraryView[];

  // Loading states
  isLoading: boolean;
  isInitialized: boolean;

  // Initialization
  initialize: () => Promise<void>;
  refreshCollections: () => Promise<void>;
  refreshPinnedItems: () => Promise<void>;
  refreshLibraryViews: () => Promise<void>;

  // Collection CRUD
  createCollection: (name: string, description?: string) => Promise<Collection | null>;
  updateCollection: (collectionId: string, data: Partial<{ name: string; description: string; coverImage: string }>) => Promise<void>;
  deleteCollection: (collectionId: string) => Promise<void>;
  getCollection: (collectionId: string) => Promise<CollectionWithItems | null>;

  // Collection items
  addToCollection: (collectionId: string, itemType: string, itemId: string, itemData?: Record<string, unknown>, parentFolderId?: string | null) => Promise<void>;
  removeFromCollection: (collectionId: string, itemId: string) => Promise<void>;
  reorderCollectionItems: (collectionId: string, itemIds: string[]) => Promise<void>;
  reorderCollections: (collectionIds: string[]) => void;
  moveItemToFolder: (collectionId: string, itemId: string, targetFolderId: string | null) => Promise<void>;

  // Folders within collections
  createFolderInCollection: (collectionId: string, name: string, parentFolderId?: string | null) => Promise<CollectionItem | null>;
  updateFolderInCollection: (collectionId: string, folderId: string, data: { name?: string; isExpanded?: boolean }) => Promise<void>;
  deleteFolderInCollection: (collectionId: string, folderId: string, moveContentsToParent?: boolean) => Promise<void>;

  // Pinned items
  pinItem: (itemType: string, itemId: string, itemData?: Record<string, unknown>) => Promise<void>;
  unpinItem: (itemType: string, itemId: string) => Promise<void>;
  isPinned: (itemType: string, itemId: string) => boolean;
  reorderPinnedItems: (items: Array<{ type: string; id: string }>) => Promise<void>;

  // Library views
  createLibraryView: (data: {
    name: string;
    icon?: string;
    filters: Record<string, unknown>;
    sortBy?: string;
    sortDirection?: 'asc' | 'desc';
  }) => Promise<LibraryView | null>;
  updateLibraryView: (viewId: string, data: Partial<{
    name: string;
    icon: string;
    filters: Record<string, unknown>;
    sortBy: string;
    sortDirection: 'asc' | 'desc';
  }>) => Promise<void>;
  deleteLibraryView: (viewId: string) => Promise<void>;
}

export const useCollectionStore = create<CollectionState>()((set, get) => ({
  // Initial state
  collections: [],
  pinnedItems: [],
  libraryViews: [],
  isLoading: false,
  isInitialized: false,

  // Initialize - fetch all data from server
  initialize: async () => {
    if (get().isInitialized) return;

    set({ isLoading: true });

    try {
      await Promise.all([
        get().refreshCollections(),
        get().refreshPinnedItems(),
        get().refreshLibraryViews()
      ]);
      set({ isInitialized: true });
    } catch (error) {
      console.error('[CollectionStore] Initialization failed:', error);
    } finally {
      set({ isLoading: false });
    }
  },

  refreshCollections: async () => {
    try {
      const response = await window.api.collections.getAll();
      if (response.collections) {
        set({ collections: response.collections });
      }
    } catch (error) {
      console.error('[CollectionStore] Failed to refresh collections:', error);
    }
  },

  refreshPinnedItems: async () => {
    try {
      const response = await window.api.pinned.getAll();
      if (response.items) {
        set({ pinnedItems: response.items });
      }
    } catch (error) {
      console.error('[CollectionStore] Failed to refresh pinned items:', error);
    }
  },

  refreshLibraryViews: async () => {
    try {
      const response = await window.api.libraryViews.getAll();
      if (response.views) {
        set({ libraryViews: response.views });
      }
    } catch (error) {
      console.error('[CollectionStore] Failed to refresh library views:', error);
    }
  },

  // Collection CRUD
  createCollection: async (name: string, description?: string) => {
    try {
      const response = await window.api.collections.create({ name, description });

      if (response.success && response.collection) {
        set(state => ({
          collections: [...state.collections, response.collection]
        }));
        showSuccessToast('Collection created');
        return response.collection;
      }
      return null;
    } catch (error) {
      console.error('[CollectionStore] Failed to create collection:', error);
      showErrorToast('Failed to create collection');
      return null;
    }
  },

  updateCollection: async (collectionId: string, data) => {
    try {
      await window.api.collections.update(collectionId, data);

      set(state => ({
        collections: state.collections.map(c =>
          c.id === collectionId ? { ...c, ...data, updatedAt: Date.now() } : c
        )
      }));
    } catch (error) {
      console.error('[CollectionStore] Failed to update collection:', error);
      showErrorToast('Failed to update collection');
    }
  },

  deleteCollection: async (collectionId: string) => {
    try {
      await window.api.collections.delete(collectionId);

      set(state => ({
        collections: state.collections.filter(c => c.id !== collectionId)
      }));
      showSuccessToast('Collection deleted');
    } catch (error) {
      console.error('[CollectionStore] Failed to delete collection:', error);
      showErrorToast('Failed to delete collection');
    }
  },

  getCollection: async (collectionId: string) => {
    try {
      const response = await window.api.collections.get(collectionId);
      if (response && response.id) {
        return response as CollectionWithItems;
      }
      return null;
    } catch (error) {
      console.error('[CollectionStore] Failed to get collection:', error);
      return null;
    }
  },

  // Collection items
  addToCollection: async (collectionId: string, itemType: string, itemId: string, itemData?: Record<string, unknown>, _parentFolderId?: string | null) => {
    try {
      await window.api.collections.addItem(collectionId, {
        type: itemType as 'track' | 'album' | 'artist' | 'playlist',
        id: itemId,
        data: itemData
      });

      // Update local count
      set(state => ({
        collections: state.collections.map(c =>
          c.id === collectionId ? { ...c, itemCount: c.itemCount + 1, updatedAt: Date.now() } : c
        )
      }));
      showSuccessToast('Added to collection');
    } catch (error) {
      console.error('[CollectionStore] Failed to add to collection:', error);
      showErrorToast('Failed to add to collection');
    }
  },

  removeFromCollection: async (collectionId: string, itemId: string) => {
    try {
      await window.api.collections.removeItem(collectionId, itemId);

      set(state => ({
        collections: state.collections.map(c =>
          c.id === collectionId ? { ...c, itemCount: Math.max(0, c.itemCount - 1), updatedAt: Date.now() } : c
        )
      }));
    } catch (error) {
      console.error('[CollectionStore] Failed to remove from collection:', error);
      showErrorToast('Failed to remove from collection');
    }
  },

  reorderCollectionItems: async (collectionId: string, itemIds: string[]) => {
    try {
      await window.api.collections.reorderItems(collectionId, itemIds);
    } catch (error) {
      console.error('[CollectionStore] Failed to reorder collection items:', error);
    }
  },

  reorderCollections: (collectionIds: string[]) => {
    // Optimistically reorder collections in local state
    set(state => {
      const collectionMap = new Map(state.collections.map(c => [c.id, c]));
      const reordered = collectionIds
        .map(id => collectionMap.get(id))
        .filter((c): c is Collection => c !== undefined);
      return { collections: reordered };
    });

    // Persist to server
    window.api.collections.reorder(collectionIds).catch(error => {
      console.error('[CollectionStore] Failed to persist collection order:', error);
    });
  },

  moveItemToFolder: async (collectionId: string, itemId: string, targetFolderId: string | null) => {
    try {
      await window.api.collections.moveItem(collectionId, itemId, targetFolderId);
    } catch (error) {
      console.error('[CollectionStore] Failed to move item:', error);
      showErrorToast('Failed to move item');
    }
  },

  // Folders within collections
  createFolderInCollection: async (collectionId: string, name: string, parentFolderId?: string | null) => {
    try {
      const response = await window.api.collections.createFolder(collectionId, name, parentFolderId);

      if (response.success && response.item) {
        // Update local count
        set(state => ({
          collections: state.collections.map(c =>
            c.id === collectionId ? { ...c, itemCount: c.itemCount + 1, updatedAt: Date.now() } : c
          )
        }));
        return response.item as CollectionItem;
      }
      return null;
    } catch (error) {
      console.error('[CollectionStore] Failed to create folder in collection:', error);
      showErrorToast('Failed to create folder');
      return null;
    }
  },

  updateFolderInCollection: async (collectionId: string, folderId: string, data: { name?: string; isExpanded?: boolean }) => {
    try {
      await window.api.collections.updateFolder(collectionId, folderId, data);
    } catch (error) {
      console.error('[CollectionStore] Failed to update folder:', error);
      showErrorToast('Failed to update folder');
    }
  },

  deleteFolderInCollection: async (collectionId: string, folderId: string, moveContentsToParent: boolean = true) => {
    try {
      await window.api.collections.deleteFolder(collectionId, folderId, moveContentsToParent);

      // Refresh collection to get updated count
      await get().refreshCollections();
      showSuccessToast('Folder deleted');
    } catch (error) {
      console.error('[CollectionStore] Failed to delete folder:', error);
      showErrorToast('Failed to delete folder');
    }
  },

  // Pinned items
  pinItem: async (itemType: string, itemId: string, itemData?: Record<string, unknown>) => {
    try {
      const response = await window.api.pinned.add(itemType, itemId, itemData);

      if (response.success && response.item) {
        set(state => ({
          pinnedItems: [...state.pinnedItems, response.item]
        }));
        showSuccessToast('Pinned to sidebar');
      }
    } catch (error) {
      console.error('[CollectionStore] Failed to pin item:', error);
      showErrorToast('Failed to pin item');
    }
  },

  unpinItem: async (itemType: string, itemId: string) => {
    try {
      await window.api.pinned.remove(itemType, itemId);

      set(state => ({
        pinnedItems: state.pinnedItems.filter(p =>
          !(p.itemType === itemType && p.itemId === itemId)
        )
      }));
      showSuccessToast('Unpinned from sidebar');
    } catch (error) {
      console.error('[CollectionStore] Failed to unpin item:', error);
      showErrorToast('Failed to unpin item');
    }
  },

  isPinned: (itemType: string, itemId: string) => {
    return get().pinnedItems.some(p =>
      p.itemType === itemType && p.itemId === itemId
    );
  },

  reorderPinnedItems: async (items: Array<{ type: string; id: string }>) => {
    try {
      await window.api.pinned.reorder(items.map(i => ({ itemType: i.type, itemId: i.id })));

      // Refresh to get new positions
      await get().refreshPinnedItems();
    } catch (error) {
      console.error('[CollectionStore] Failed to reorder pinned items:', error);
    }
  },

  // Library views
  createLibraryView: async (data) => {
    try {
      const response = await window.api.libraryViews.create({
        name: data.name,
        type: 'custom',
        filters: data.filters,
        sortBy: data.sortBy,
        sortOrder: data.sortDirection
      });

      if (response.success && response.view) {
        set(state => ({
          libraryViews: [...state.libraryViews, response.view]
        }));
        showSuccessToast('View created');
        return response.view;
      }
      return null;
    } catch (error) {
      console.error('[CollectionStore] Failed to create library view:', error);
      showErrorToast('Failed to create view');
      return null;
    }
  },

  updateLibraryView: async (viewId: string, data) => {
    try {
      await window.api.libraryViews.update(viewId, {
        name: data.name,
        filters: data.filters,
        sortBy: data.sortBy,
        sortOrder: data.sortDirection
      });

      set(state => ({
        libraryViews: state.libraryViews.map(v =>
          v.id === viewId ? { ...v, ...data } : v
        )
      }));
    } catch (error) {
      console.error('[CollectionStore] Failed to update library view:', error);
      showErrorToast('Failed to update view');
    }
  },

  deleteLibraryView: async (viewId: string) => {
    try {
      await window.api.libraryViews.delete(viewId);

      set(state => ({
        libraryViews: state.libraryViews.filter(v => v.id !== viewId)
      }));
      showSuccessToast('View deleted');
    } catch (error) {
      console.error('[CollectionStore] Failed to delete library view:', error);
      showErrorToast('Failed to delete view');
    }
  }
}));
