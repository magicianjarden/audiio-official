/**
 * Tag store - manages user tags for tracks, albums, artists, playlists
 *
 * All data is fetched from and synced to the server.
 */

import { create } from 'zustand';
import { showSuccessToast, showErrorToast } from './toast-store';

export interface Tag {
  id: string;
  name: string;
  color: string;
  usageCount: number;
  createdAt: number;
}

export interface TrackTag {
  id: string;
  trackId: string;
  tagName: string;
  color?: string;
  createdAt: number;
}

export interface EntityTag {
  id: string;
  entityType: 'album' | 'artist' | 'playlist';
  entityId: string;
  tagName: string;
  createdAt: number;
}

interface TagState {
  // All available tags
  tags: Tag[];

  // Cache of track tags (trackId -> tags)
  trackTagsCache: Map<string, TrackTag[]>;

  // Cache of entity tags (entityType:entityId -> tags)
  entityTagsCache: Map<string, EntityTag[]>;

  // Loading states
  isLoading: boolean;
  isInitialized: boolean;

  // Initialization
  initialize: () => Promise<void>;
  refreshTags: () => Promise<void>;

  // Tag CRUD
  createTag: (name: string, color?: string) => Promise<Tag | null>;
  updateTag: (tagId: string, data: Partial<{ name: string; color: string }>) => Promise<void>;
  deleteTag: (tagId: string) => Promise<void>;
  getTagByName: (name: string) => Tag | undefined;

  // Track tags
  getTrackTags: (trackId: string) => Promise<TrackTag[]>;
  addTagToTrack: (trackId: string, tagName: string, color?: string) => Promise<void>;
  removeTagFromTrack: (trackId: string, tagName: string) => Promise<void>;
  getTracksByTag: (tagName: string) => Promise<string[]>;
  hasTag: (trackId: string, tagName: string) => boolean;

  // Entity tags (albums, artists, playlists)
  getEntityTags: (entityType: string, entityId: string) => Promise<EntityTag[]>;
  addTagToEntity: (entityType: string, entityId: string, tagName: string) => Promise<void>;
  removeTagFromEntity: (entityType: string, entityId: string, tagName: string) => Promise<void>;

  // Utilities
  getTagSuggestions: (partial: string) => Tag[];
  getPopularTags: (limit?: number) => Tag[];
  clearCache: () => void;

  // Reorder
  reorderTags: (tagIds: string[]) => void;
}

export const useTagStore = create<TagState>()((set, get) => ({
  // Initial state
  tags: [],
  trackTagsCache: new Map(),
  entityTagsCache: new Map(),
  isLoading: false,
  isInitialized: false,

  // Initialize - fetch all tags from server
  initialize: async () => {
    if (get().isInitialized) return;

    set({ isLoading: true });

    try {
      await get().refreshTags();
      set({ isInitialized: true });
    } catch (error) {
      console.error('[TagStore] Initialization failed:', error);
    } finally {
      set({ isLoading: false });
    }
  },

  refreshTags: async () => {
    try {
      const response = await window.api.tags.getAll();
      if (response.tags) {
        set({ tags: response.tags });
      }
    } catch (error) {
      console.error('[TagStore] Failed to refresh tags:', error);
    }
  },

  // Tag CRUD
  createTag: async (name: string, color?: string) => {
    try {
      const response = await window.api.tags.create(name, color);

      if (response.success && response.tag) {
        set(state => ({ tags: [...state.tags, response.tag] }));
        return response.tag;
      }
      return null;
    } catch (error) {
      console.error('[TagStore] Failed to create tag:', error);
      showErrorToast('Failed to create tag');
      return null;
    }
  },

  updateTag: async (tagId: string, data: Partial<{ name: string; color: string }>) => {
    try {
      await window.api.tags.update(tagId, data);

      set(state => ({
        tags: state.tags.map(tag =>
          tag.id === tagId ? { ...tag, ...data } : tag
        )
      }));
    } catch (error) {
      console.error('[TagStore] Failed to update tag:', error);
      showErrorToast('Failed to update tag');
    }
  },

  deleteTag: async (tagId: string) => {
    try {
      await window.api.tags.delete(tagId);

      set(state => ({
        tags: state.tags.filter(tag => tag.id !== tagId)
      }));

      // Clear caches as tags may have been removed from items
      get().clearCache();
      showSuccessToast('Tag deleted');
    } catch (error) {
      console.error('[TagStore] Failed to delete tag:', error);
      showErrorToast('Failed to delete tag');
    }
  },

  getTagByName: (name: string) => {
    return get().tags.find(tag =>
      tag.name.toLowerCase() === name.toLowerCase()
    );
  },

  // Track tags
  getTrackTags: async (trackId: string) => {
    const cached = get().trackTagsCache.get(trackId);
    if (cached) return cached;

    try {
      const response = await window.api.tags.getTrackTags(trackId);
      if (response.tags) {
        set(state => {
          const newCache = new Map(state.trackTagsCache);
          newCache.set(trackId, response.tags);
          return { trackTagsCache: newCache };
        });
        return response.tags;
      }
      return [];
    } catch (error) {
      console.error('[TagStore] Failed to get track tags:', error);
      return [];
    }
  },

  addTagToTrack: async (trackId: string, tagName: string, _color?: string) => {
    try {
      const response = await window.api.tags.addToTrack(trackId, [tagName]);

      if (response.success && response.trackTag) {
        // Update cache
        set(state => {
          const newCache = new Map(state.trackTagsCache);
          const existing = newCache.get(trackId) || [];
          newCache.set(trackId, [...existing, response.trackTag]);
          return { trackTagsCache: newCache };
        });

        // Refresh tags to get updated usage count
        await get().refreshTags();
        showSuccessToast(`Tagged with "${tagName}"`);
      }
    } catch (error) {
      console.error('[TagStore] Failed to add tag to track:', error);
      showErrorToast('Failed to add tag');
    }
  },

  removeTagFromTrack: async (trackId: string, tagName: string) => {
    try {
      await window.api.tags.removeFromTrack(trackId, tagName);

      // Update cache
      set(state => {
        const newCache = new Map(state.trackTagsCache);
        const existing = newCache.get(trackId) || [];
        newCache.set(trackId, existing.filter(t => t.tagName !== tagName));
        return { trackTagsCache: newCache };
      });

      // Refresh tags to get updated usage count
      await get().refreshTags();
    } catch (error) {
      console.error('[TagStore] Failed to remove tag from track:', error);
      showErrorToast('Failed to remove tag');
    }
  },

  getTracksByTag: async (tagName: string) => {
    try {
      const response = await window.api.tags.getTracksByTag(tagName);
      return response.trackIds || [];
    } catch (error) {
      console.error('[TagStore] Failed to get tracks by tag:', error);
      return [];
    }
  },

  hasTag: (trackId: string, tagName: string) => {
    const cached = get().trackTagsCache.get(trackId);
    if (!cached) return false;
    return cached.some(t => t.tagName.toLowerCase() === tagName.toLowerCase());
  },

  // Entity tags
  getEntityTags: async (entityType: string, entityId: string) => {
    const cacheKey = `${entityType}:${entityId}`;
    const cached = get().entityTagsCache.get(cacheKey);
    if (cached) return cached;

    try {
      const response = await window.api.tags.getEntityTags(entityType, entityId);
      if (response.tags) {
        set(state => {
          const newCache = new Map(state.entityTagsCache);
          newCache.set(cacheKey, response.tags);
          return { entityTagsCache: newCache };
        });
        return response.tags;
      }
      return [];
    } catch (error) {
      console.error('[TagStore] Failed to get entity tags:', error);
      return [];
    }
  },

  addTagToEntity: async (entityType: string, entityId: string, tagName: string) => {
    try {
      const response = await window.api.tags.addToEntity(entityType, entityId, [tagName]);

      if (response.success && response.entityTag) {
        const cacheKey = `${entityType}:${entityId}`;
        set(state => {
          const newCache = new Map(state.entityTagsCache);
          const existing = newCache.get(cacheKey) || [];
          newCache.set(cacheKey, [...existing, response.entityTag]);
          return { entityTagsCache: newCache };
        });

        await get().refreshTags();
        showSuccessToast(`Tagged with "${tagName}"`);
      }
    } catch (error) {
      console.error('[TagStore] Failed to add tag to entity:', error);
      showErrorToast('Failed to add tag');
    }
  },

  removeTagFromEntity: async (entityType: string, entityId: string, tagName: string) => {
    try {
      await window.api.tags.removeFromEntity(entityType, entityId, tagName);

      const cacheKey = `${entityType}:${entityId}`;
      set(state => {
        const newCache = new Map(state.entityTagsCache);
        const existing = newCache.get(cacheKey) || [];
        newCache.set(cacheKey, existing.filter(t => t.tagName !== tagName));
        return { entityTagsCache: newCache };
      });

      await get().refreshTags();
    } catch (error) {
      console.error('[TagStore] Failed to remove tag from entity:', error);
      showErrorToast('Failed to remove tag');
    }
  },

  // Utilities
  getTagSuggestions: (partial: string) => {
    const query = partial.toLowerCase();
    return get().tags.filter(tag =>
      tag.name.toLowerCase().includes(query)
    ).slice(0, 10);
  },

  getPopularTags: (limit = 20) => {
    return [...get().tags]
      .sort((a, b) => b.usageCount - a.usageCount)
      .slice(0, limit);
  },

  clearCache: () => {
    set({
      trackTagsCache: new Map(),
      entityTagsCache: new Map()
    });
  },

  reorderTags: (tagIds: string[]) => {
    // Optimistically reorder tags in local state
    set(state => {
      const tagMap = new Map(state.tags.map(t => [t.id, t]));
      const reordered = tagIds
        .map(id => tagMap.get(id))
        .filter((t): t is Tag => t !== undefined);
      return { tags: reordered };
    });
  }
}));
