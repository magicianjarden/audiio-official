import React, { useCallback, useRef, useState, useMemo, useEffect } from 'react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  DragOverlay,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useNavigationStore, type View } from '../../stores/navigation-store';
import { useLibraryStore, type Playlist, type PlaylistFolder, isRuleBasedPlaylist } from '../../stores/library-store';
import { useCollectionStore, type Collection, type CollectionItem } from '../../stores/collection-store';
import { useTagStore, type Tag } from '../../stores/tag-store';
import { usePluginStore } from '../../stores/plugin-store';
import { useUIStore } from '../../stores/ui-store';
import { usePluginUIRegistry } from '../../registry';
import { PlaylistCover } from '../common/PlaylistCover';
import { InputModal } from '../Modals/InputModal';
import { usePlaylistContextMenu, useTagContextMenu } from '../../contexts/ContextMenuContext';
import {
  DiscoverIcon,
  HeartIcon,
  ThumbDownIcon,
  PlaylistIcon,
  SparklesIcon,
  FolderIcon,
  TagIcon,
  DownloadIcon,
  AddIcon,
  AudiioLogoIcon,
  PluginIcon,
  SettingsIcon,
  StatsIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  FolderPlusIcon,
  DragHandleIcon,
  ArtistIcon,
  AlbumIcon,
  BookmarkFilledIcon,
} from '@audiio/icons';

// ============================================================================
// Types
// ============================================================================

interface NavItemProps {
  icon: React.ReactNode;
  label: string;
  view: View;
  isActive: boolean;
  onClick: () => void;
  badge?: number;
  isCollapsed?: boolean;
}

interface TreeItem {
  id: string;
  type: 'playlist' | 'folder';
  data: Playlist | PlaylistFolder;
  children?: TreeItem[];
}


// ============================================================================
// NavItem Component
// ============================================================================

const NavItem: React.FC<NavItemProps> = ({ icon, label, isActive, onClick, badge, isCollapsed }) => (
  <button
    className={`sidebar-nav-item ${isActive ? 'active' : ''}`}
    onClick={onClick}
    title={isCollapsed ? label : undefined}
  >
    <span className="sidebar-nav-icon">{icon}</span>
    {!isCollapsed && <span className="sidebar-nav-label">{label}</span>}
    {!isCollapsed && badge !== undefined && badge > 0 && (
      <span className="sidebar-nav-badge">{badge > 99 ? '99+' : badge}</span>
    )}
    {isCollapsed && badge !== undefined && badge > 0 && (
      <span className="sidebar-nav-badge-dot" />
    )}
  </button>
);

// ============================================================================
// SortablePlaylistItem Component
// ============================================================================

interface SortablePlaylistItemProps {
  playlist: Playlist;
  isActive: boolean;
  isCollapsed: boolean;
  isDragOverlay?: boolean;
  isExpanded?: boolean;
  isEditing?: boolean;
  editingName?: string;
  onEditingNameChange?: (name: string) => void;
  onStartEditing?: () => void;
  onFinishEditing?: () => void;
  editInputRef?: React.RefObject<HTMLInputElement>;
  onContextMenu?: (e: React.MouseEvent) => void;
  onToggleExpand?: () => void;
  onTrackClick?: (trackId: string) => void;
}

const SortablePlaylistItem: React.FC<SortablePlaylistItemProps> = ({
  playlist,
  isActive,
  isCollapsed,
  isDragOverlay = false,
  isExpanded = false,
  isEditing = false,
  editingName = '',
  onEditingNameChange,
  onStartEditing,
  onFinishEditing,
  editInputRef,
  onContextMenu,
  onToggleExpand,
  onTrackClick,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: `playlist-${playlist.id}`,
    data: { type: 'playlist', item: playlist },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging && !isDragOverlay ? 0.3 : 1,
  };

  const handleClick = () => {
    if (!isEditing) {
      useNavigationStore.getState().openPlaylist(playlist.id);
    }
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onStartEditing && !isCollapsed) {
      onStartEditing();
    }
  };

  const hasRules = isRuleBasedPlaylist(playlist);

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <div className={`sidebar-playlist-wrapper ${isExpanded ? 'expanded' : ''}`}>
        <button
          className={`sidebar-playlist-item ${isActive ? 'active' : ''} ${isDragging ? 'dragging' : ''} ${hasRules ? 'has-rules' : ''} ${isEditing ? 'editing' : ''}`}
          onClick={handleClick}
          onDoubleClick={handleDoubleClick}
          onContextMenu={onContextMenu}
          title={isCollapsed ? `${playlist.name}${hasRules ? ' (Smart)' : ''}` : undefined}
        >
          {!isCollapsed && (
            <span className="sidebar-drag-handle" {...listeners}>
              <DragHandleIcon size={12} />
            </span>
          )}
          {!isCollapsed && playlist.tracks.length > 0 && (
            <button
              className={`sidebar-expand-toggle ${isExpanded ? 'expanded' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                onToggleExpand?.();
              }}
              title={isExpanded ? 'Collapse' : 'Expand'}
            >
              <ChevronRightIcon size={12} />
            </button>
          )}
          <PlaylistCover
            tracks={playlist.tracks}
            name={playlist.name}
            size="xs"
            className="sidebar-playlist-cover"
          />
          {!isCollapsed && (
            <>
              {isEditing ? (
                <input
                  ref={editInputRef}
                  type="text"
                  value={editingName}
                  onChange={(e) => onEditingNameChange?.(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') onFinishEditing?.();
                    if (e.key === 'Escape') {
                      onEditingNameChange?.(playlist.name);
                      onFinishEditing?.();
                    }
                  }}
                  onBlur={onFinishEditing}
                  onClick={(e) => e.stopPropagation()}
                  className="sidebar-inline-edit-input"
                />
              ) : (
                <>
                  <span className="sidebar-playlist-name">
                    {playlist.name}
                    {hasRules && <SparklesIcon size={12} className="sidebar-playlist-smart-icon" />}
                  </span>
                  <span className="sidebar-playlist-count">{playlist.tracks.length}</span>
                </>
              )}
            </>
          )}
          {isCollapsed && hasRules && (
            <span className="sidebar-playlist-smart-dot" title="Smart Playlist" />
          )}
        </button>

        {/* Expanded tracks */}
        {!isCollapsed && isExpanded && (
          <div className="sidebar-playlist-tracks">
            {playlist.tracks.length === 0 ? (
              <div className="sidebar-playlist-empty">No tracks</div>
            ) : (
              playlist.tracks.slice(0, 10).map((track) => (
                <button
                  key={track.id}
                  className="sidebar-playlist-track-item"
                  onClick={() => onTrackClick?.(track.id)}
                  title={`${track.title} - ${track.artist}`}
                >
                  <span className="sidebar-playlist-track-title">
                    {track.title}
                  </span>
                  <span className="sidebar-playlist-track-artist">
                    {track.artist}
                  </span>
                </button>
              ))
            )}
            {playlist.tracks.length > 10 && (
              <button
                className="sidebar-playlist-view-all"
                onClick={handleClick}
              >
                View all {playlist.tracks.length} tracks...
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================================================
// SortableFolderItem Component
// ============================================================================

interface SortableFolderItemProps {
  folder: PlaylistFolder;
  children: React.ReactNode;
  isCollapsed: boolean;
  isOver?: boolean;
}

const SortableFolderItem: React.FC<SortableFolderItemProps> = ({
  folder,
  children,
  isCollapsed,
  isOver = false,
}) => {
  const { toggleFolderExpanded } = useLibraryStore();

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: `folder-${folder.id}`,
    data: { type: 'folder', item: folder },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <div
        className={`sidebar-folder ${isOver ? 'drop-target' : ''} ${isDragging ? 'dragging' : ''}`}
      >
        {!isCollapsed && (
          <span className="sidebar-drag-handle" {...listeners}>
            <DragHandleIcon size={12} />
          </span>
        )}
        <button
          className={`sidebar-folder-toggle ${folder.isExpanded ? 'expanded' : ''}`}
          onClick={(e) => {
            e.stopPropagation();
            toggleFolderExpanded(folder.id);
          }}
          title={folder.isExpanded ? 'Collapse folder' : 'Expand folder'}
        >
          <ChevronRightIcon size={14} />
        </button>
        <span className="sidebar-folder-icon">
          <FolderIcon size={16} />
        </span>
        {!isCollapsed && <span className="sidebar-folder-name">{folder.name}</span>}
      </div>
      {folder.isExpanded && (
        <div className="sidebar-folder-children">
          {children}
        </div>
      )}
    </div>
  );
};

// ============================================================================
// SortableCollectionItem Component
// ============================================================================

interface SortableCollectionItemProps {
  collection: Collection;
  isActive: boolean;
  isCollapsed: boolean;
  isExpanded: boolean;
  items: CollectionItem[];
  isLoadingItems: boolean;
  isEditing?: boolean;
  editingName?: string;
  onEditingNameChange?: (name: string) => void;
  onStartEditing?: () => void;
  onFinishEditing?: () => void;
  editInputRef?: React.RefObject<HTMLInputElement>;
  onClick: () => void;
  onToggleExpand: () => void;
  onItemClick: (item: CollectionItem) => void;
}

const SortableCollectionItem: React.FC<SortableCollectionItemProps> = ({
  collection,
  isActive,
  isCollapsed,
  isExpanded,
  items,
  isLoadingItems,
  isEditing = false,
  editingName = '',
  onEditingNameChange,
  onStartEditing,
  onFinishEditing,
  editInputRef,
  onClick,
  onToggleExpand,
  onItemClick,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: `collection-${collection.id}`,
    data: { type: 'collection', item: collection },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isCollapsed) {
      onStartEditing?.();
    }
  };

  const getItemIcon = (itemType: string) => {
    switch (itemType) {
      case 'album':
        return <AlbumIcon size={12} />;
      case 'artist':
        return <ArtistIcon size={12} />;
      case 'playlist':
        return <PlaylistIcon size={12} />;
      case 'track':
        return <PlaylistIcon size={12} />;
      case 'tag':
        return <TagIcon size={12} />;
      case 'folder':
        return <FolderIcon size={12} />;
      default:
        return <PlaylistIcon size={12} />;
    }
  };

  const getItemName = (item: CollectionItem) => {
    const data = item.itemData as Record<string, unknown>;
    return (data.name || data.title || 'Unknown') as string;
  };

  // Only show root-level items (not inside folders)
  const rootItems = items.filter(item => item.parentFolderId === null);

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <div className={`sidebar-collection-wrapper ${isExpanded ? 'expanded' : ''}`}>
        <button
          className={`sidebar-playlist-item ${isActive ? 'active' : ''} ${isDragging ? 'dragging' : ''} ${isEditing ? 'editing' : ''}`}
          onClick={() => !isEditing && onClick()}
          onDoubleClick={handleDoubleClick}
          title={isCollapsed ? `${collection.name} (${collection.itemCount} items)` : undefined}
        >
          {!isCollapsed && (
            <span className="sidebar-drag-handle" {...listeners}>
              <DragHandleIcon size={12} />
            </span>
          )}
          {!isCollapsed && collection.itemCount > 0 && (
            <button
              className={`sidebar-expand-toggle ${isExpanded ? 'expanded' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                onToggleExpand();
              }}
              title={isExpanded ? 'Collapse' : 'Expand'}
            >
              <ChevronRightIcon size={12} />
            </button>
          )}
          <FolderIcon size={14} />
          {!isCollapsed && (
            isEditing ? (
              <input
                ref={editInputRef}
                type="text"
                value={editingName}
                onChange={(e) => onEditingNameChange?.(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') onFinishEditing?.();
                  if (e.key === 'Escape') {
                    onEditingNameChange?.(collection.name);
                    onFinishEditing?.();
                  }
                }}
                onBlur={onFinishEditing}
                onClick={(e) => e.stopPropagation()}
                className="sidebar-inline-edit-input"
              />
            ) : (
              <>
                <span className="sidebar-playlist-name">{collection.name}</span>
                <span className="sidebar-playlist-count">{collection.itemCount}</span>
              </>
            )
          )}
        </button>

        {/* Expanded items */}
        {!isCollapsed && isExpanded && (
          <div className="sidebar-collection-children">
            {isLoadingItems ? (
              <div className="sidebar-collection-loading">Loading...</div>
            ) : rootItems.length === 0 ? (
              <div className="sidebar-collection-empty">No items</div>
            ) : (
              rootItems.slice(0, 10).map((item) => (
                <button
                  key={item.id}
                  className="sidebar-collection-child-item"
                  onClick={() => onItemClick(item)}
                  title={getItemName(item)}
                >
                  <span className="sidebar-collection-child-icon">
                    {getItemIcon(item.itemType)}
                  </span>
                  <span className="sidebar-collection-child-name">
                    {getItemName(item)}
                  </span>
                </button>
              ))
            )}
            {rootItems.length > 10 && (
              <button
                className="sidebar-collection-view-all"
                onClick={onClick}
              >
                View all {rootItems.length} items...
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================================================
// SortableTagItem Component
// ============================================================================

interface SortableTagItemProps {
  tag: Tag;
  isActive: boolean;
  isEditing?: boolean;
  editingName?: string;
  onEditingNameChange?: (name: string) => void;
  onStartEditing?: () => void;
  onFinishEditing?: () => void;
  editInputRef?: React.RefObject<HTMLInputElement>;
  onClick: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
}

const SortableTagItem: React.FC<SortableTagItemProps> = ({
  tag,
  isActive,
  isEditing = false,
  editingName = '',
  onEditingNameChange,
  onStartEditing,
  onFinishEditing,
  editInputRef,
  onClick,
  onContextMenu,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: `tag-${tag.id}`,
    data: { type: 'tag', item: tag },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onStartEditing?.();
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <button
        className={`sidebar-playlist-item sidebar-tag-item ${isActive ? 'active' : ''} ${isDragging ? 'dragging' : ''} ${isEditing ? 'editing' : ''}`}
        onClick={() => !isEditing && onClick()}
        onDoubleClick={handleDoubleClick}
        onContextMenu={onContextMenu}
        title={`${tag.name} (${tag.usageCount} tracks)`}
      >
        <span className="sidebar-drag-handle" {...listeners}>
          <DragHandleIcon size={12} />
        </span>
        <span className="sidebar-tag-dot" style={{ background: tag.color || 'var(--accent)' }} />
        {isEditing ? (
          <input
            ref={editInputRef}
            type="text"
            value={editingName}
            onChange={(e) => onEditingNameChange?.(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onFinishEditing?.();
              if (e.key === 'Escape') {
                onEditingNameChange?.(tag.name);
                onFinishEditing?.();
              }
            }}
            onBlur={onFinishEditing}
            onClick={(e) => e.stopPropagation()}
            className="sidebar-inline-edit-input"
          />
        ) : (
          <>
            <span className="sidebar-playlist-name">{tag.name}</span>
            <span className="sidebar-playlist-count">{tag.usageCount}</span>
          </>
        )}
      </button>
    </div>
  );
};


// ============================================================================
// Tree Building Utilities
// ============================================================================

function buildPlaylistTree(
  folders: PlaylistFolder[],
  playlists: Playlist[],
  parentId: string | null = null
): TreeItem[] {
  const items: TreeItem[] = [];

  // Get folders at this level
  const levelFolders = folders
    .filter(f => f.parentId === parentId)
    .sort((a, b) => a.order - b.order);

  // Get playlists at this level
  const levelPlaylists = playlists
    .filter(p => p.folderId === parentId)
    .sort((a, b) => a.order - b.order);

  // Add folders with their children
  for (const folder of levelFolders) {
    items.push({
      id: `folder-${folder.id}`,
      type: 'folder',
      data: folder,
      children: buildPlaylistTree(folders, playlists, folder.id),
    });
  }

  // Add playlists
  for (const playlist of levelPlaylists) {
    items.push({
      id: `playlist-${playlist.id}`,
      type: 'playlist',
      data: playlist,
    });
  }

  return items;
}

function getAllSortableIds(items: TreeItem[]): string[] {
  const ids: string[] = [];
  for (const item of items) {
    ids.push(item.id);
    if (item.children) {
      ids.push(...getAllSortableIds(item.children));
    }
  }
  return ids;
}


// ============================================================================
// Main Sidebar Component
// ============================================================================

export const Sidebar: React.FC = () => {
  const { currentView, navigate, selectedPlaylistId, selectedCollectionId, selectedTagName, openCollection, openTagDetail } = useNavigationStore();
  const {
    likedTracks,
    dislikedTracks,
    playlists,
    folders,
    downloads,
    createPlaylist,
    createFolder,
    updatePlaylist,
    movePlaylistToFolder,
    moveFolderToFolder,
    reorderSidebarItems,
  } = useLibraryStore();
  const {
    collections,
    pinnedItems,
    updateCollection,
    reorderCollections,
  } = useCollectionStore();
  const { tags, updateTag, reorderTags } = useTagStore();
  const { plugins } = usePluginStore();
  const {
    isSidebarCollapsed,
    toggleSidebar,
    sidebarWidth,
    setSidebarWidth,
    sidebarActiveTab,
    setSidebarActiveTab,
    isCreatingPlaylist,
    startCreatingPlaylist,
    stopCreatingPlaylist,
    isCreatingTag,
    startCreatingTag,
    stopCreatingTag,
    isCreatingCollection,
    startCreatingCollection,
    stopCreatingCollection,
    isCreateFolderModalOpen,
    openCreateFolderModal,
    closeCreateFolderModal,
  } = useUIStore();
  const { createTag } = useTagStore();
  const { createCollection } = useCollectionStore();
  const pluginUIRegistry = usePluginUIRegistry();

  // Context menu hooks
  const { showContextMenu: showPlaylistContextMenu } = usePlaylistContextMenu();
  const { showContextMenu: showTagContextMenu } = useTagContextMenu();

  // Drag state
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  // Expanded collections state
  const [expandedCollections, setExpandedCollections] = useState<Set<string>>(new Set());
  const [collectionItemsCache, setCollectionItemsCache] = useState<Map<string, CollectionItem[]>>(new Map());
  const [loadingCollectionItems, setLoadingCollectionItems] = useState<Set<string>>(new Set());

  // Expanded playlists state
  const [expandedPlaylists, setExpandedPlaylists] = useState<Set<string>>(new Set());

  // Resize state
  const resizeRef = useRef<{
    isDragging: boolean;
    startX: number;
    startWidth: number;
  }>({ isDragging: false, startX: 0, startWidth: 260 });
  const [isResizing, setIsResizing] = useState(false);

  const pendingDownloads = downloads.filter(d => d.status !== 'completed').length;
  const enabledPlugins = plugins.filter(p => p.enabled).length;

  // Helper to get icon for pinned item type
  const getPinnedItemIcon = (itemType: string) => {
    switch (itemType) {
      case 'playlist':
        return <PlaylistIcon size={18} />;
      case 'album':
        return <AlbumIcon size={18} />;
      case 'artist':
        return <ArtistIcon size={18} />;
      case 'collection':
        return <FolderIcon size={18} />;
      case 'smart_playlist':
        return <SparklesIcon size={18} />;
      default:
        return <BookmarkFilledIcon size={18} />;
    }
  };

  // Handle click on pinned item
  const handlePinnedItemClick = (itemType: string, itemId: string) => {
    switch (itemType) {
      case 'playlist':
      case 'smart_playlist': // Smart playlists are now unified with regular playlists
        useNavigationStore.getState().openPlaylist(itemId);
        break;
      case 'album':
        useNavigationStore.getState().openAlbum(itemId);
        break;
      case 'artist':
        useNavigationStore.getState().openArtist(itemId);
        break;
      case 'collection':
        useNavigationStore.getState().openCollection(itemId);
        break;
    }
  };

  // Get plugin nav items for the tools section
  const toolsNavItems = pluginUIRegistry.getNavItemsBySection('tools');

  // Build the playlist/folder tree
  const playlistTree = useMemo(
    () => buildPlaylistTree(folders, playlists),
    [folders, playlists]
  );

  const sortableIds = useMemo(
    () => getAllSortableIds(playlistTree),
    [playlistTree]
  );

  // Collection sortable IDs (flat list)
  const collectionSortableIds = useMemo(
    () => collections.map(c => `collection-${c.id}`),
    [collections]
  );

  // ========================================
  // DnD Sensors and Handlers
  // ========================================

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  }, []);

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const over = event.over;
    if (over) {
      setOverId(over.id as string);
    } else {
      setOverId(null);
    }
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    setOverId(null);

    if (!over || active.id === over.id) return;

    const activeData = active.data.current as { type: string; item: Playlist | PlaylistFolder } | undefined;
    const overData = over.data.current as { type: string; item: Playlist | PlaylistFolder } | undefined;

    if (!activeData || !overData) return;

    const activeType = activeData.type;
    const overType = overData.type;

    // If dropping on a folder, move into that folder
    if (overType === 'folder') {
      const targetFolderId = (overData.item as PlaylistFolder).id;
      if (activeType === 'playlist') {
        const playlistId = (activeData.item as Playlist).id;
        movePlaylistToFolder(playlistId, targetFolderId);
      } else if (activeType === 'folder') {
        const folderId = (activeData.item as PlaylistFolder).id;
        // Prevent moving folder into itself
        if (folderId !== targetFolderId) {
          moveFolderToFolder(folderId, targetFolderId);
        }
      }
    } else {
      // Reordering at same level - find the target's parent and reorder
      const overItem = overData.item;
      let targetParentId: string | null = null;

      if (overType === 'playlist') {
        targetParentId = (overItem as Playlist).folderId;
      } else {
        targetParentId = (overItem as PlaylistFolder).parentId;
      }

      // Get all items at this level and calculate new orders
      const siblingFolders = folders.filter(f => f.parentId === targetParentId);
      const siblingPlaylists = playlists.filter(p => p.folderId === targetParentId);

      // Build combined list with current order
      type OrderedItem = { id: string; type: 'playlist' | 'folder'; order: number };
      const allItems: OrderedItem[] = [
        ...siblingFolders.map(f => ({ id: f.id, type: 'folder' as const, order: f.order })),
        ...siblingPlaylists.map(p => ({ id: p.id, type: 'playlist' as const, order: p.order })),
      ].sort((a, b) => a.order - b.order);

      // Find active and over indices
      const activeItemId = activeType === 'playlist'
        ? (activeData.item as Playlist).id
        : (activeData.item as PlaylistFolder).id;
      const overItemId = overType === 'playlist'
        ? (overData.item as Playlist).id
        : (overData.item as PlaylistFolder).id;

      const activeIndex = allItems.findIndex(i => i.id === activeItemId);
      const overIndex = allItems.findIndex(i => i.id === overItemId);

      if (activeIndex !== -1 && overIndex !== -1 && activeIndex !== overIndex) {
        // Reorder
        const removed = allItems.splice(activeIndex, 1);
        const movedItem = removed[0];
        if (!movedItem) return;
        allItems.splice(overIndex, 0, movedItem);

        // Update orders
        const updates = allItems.map((item, index) => ({
          id: item.id,
          type: item.type,
          order: index,
          parentId: targetParentId,
        }));

        reorderSidebarItems(updates);
      }
    }
  }, [folders, playlists, movePlaylistToFolder, moveFolderToFolder, reorderSidebarItems]);

  // ========================================
  // Collection DnD Handlers (flat list)
  // ========================================

  const handleCollectionDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeIndex = collections.findIndex(c => `collection-${c.id}` === active.id);
    const overIndex = collections.findIndex(c => `collection-${c.id}` === over.id);

    if (activeIndex !== -1 && overIndex !== -1) {
      const newOrder = [...collections];
      const [removed] = newOrder.splice(activeIndex, 1);
      if (removed) {
        newOrder.splice(overIndex, 0, removed);
        reorderCollections(newOrder.map(c => c.id));
      }
    }
  }, [collections, reorderCollections]);

  // ========================================
  // Tag DnD Handlers
  // ========================================

  const tagSortableIds = useMemo(
    () => tags.map(t => `tag-${t.id}`),
    [tags]
  );

  const handleTagDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeIndex = tags.findIndex(t => `tag-${t.id}` === active.id);
    const overIndex = tags.findIndex(t => `tag-${t.id}` === over.id);

    if (activeIndex !== -1 && overIndex !== -1) {
      const newOrder = [...tags];
      const [removed] = newOrder.splice(activeIndex, 1);
      if (removed) {
        newOrder.splice(overIndex, 0, removed);
        reorderTags(newOrder.map(t => t.id));
      }
    }
  }, [tags, reorderTags]);

  // ========================================
  // Resize Handlers
  // ========================================

  const handleResizeMouseDown = useCallback((e: React.MouseEvent) => {
    if (isSidebarCollapsed) return;

    e.preventDefault();
    resizeRef.current = {
      isDragging: true,
      startX: e.clientX,
      startWidth: sidebarWidth,
    };
    setIsResizing(true);

    const handleMouseMove = (e: MouseEvent) => {
      if (!resizeRef.current.isDragging) return;
      const delta = e.clientX - resizeRef.current.startX;
      const newWidth = resizeRef.current.startWidth + delta;
      setSidebarWidth(newWidth);
    };

    const handleMouseUp = () => {
      resizeRef.current.isDragging = false;
      setIsResizing(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [isSidebarCollapsed, sidebarWidth, setSidebarWidth]);

  // ========================================
  // Inline Creation State
  // ========================================

  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [newTagName, setNewTagName] = useState('');
  const [newCollectionName, setNewCollectionName] = useState('');
  const playlistInputRef = useRef<HTMLInputElement>(null);
  const tagInputRef = useRef<HTMLInputElement>(null);
  const collectionInputRef = useRef<HTMLInputElement>(null);

  // ========================================
  // Inline Editing State (double-click rename)
  // ========================================

  const [editingPlaylistId, setEditingPlaylistId] = useState<string | null>(null);
  const [editingPlaylistName, setEditingPlaylistName] = useState('');
  const [editingCollectionId, setEditingCollectionId] = useState<string | null>(null);
  const [editingCollectionName, setEditingCollectionName] = useState('');
  const [editingTagId, setEditingTagId] = useState<string | null>(null);
  const [editingTagName, setEditingTagName] = useState('');
  const editPlaylistInputRef = useRef<HTMLInputElement>(null);
  const editCollectionInputRef = useRef<HTMLInputElement>(null);
  const editTagInputRef = useRef<HTMLInputElement>(null);

  // Focus input when inline creation starts
  useEffect(() => {
    if (isCreatingPlaylist && playlistInputRef.current) {
      playlistInputRef.current.focus();
    }
  }, [isCreatingPlaylist]);

  useEffect(() => {
    if (isCreatingTag && tagInputRef.current) {
      tagInputRef.current.focus();
    }
  }, [isCreatingTag]);

  useEffect(() => {
    if (isCreatingCollection && collectionInputRef.current) {
      collectionInputRef.current.focus();
    }
  }, [isCreatingCollection]);

  // Focus input when inline editing starts
  useEffect(() => {
    if (editingPlaylistId && editPlaylistInputRef.current) {
      editPlaylistInputRef.current.focus();
      editPlaylistInputRef.current.select();
    }
  }, [editingPlaylistId]);

  useEffect(() => {
    if (editingCollectionId && editCollectionInputRef.current) {
      editCollectionInputRef.current.focus();
      editCollectionInputRef.current.select();
    }
  }, [editingCollectionId]);

  useEffect(() => {
    if (editingTagId && editTagInputRef.current) {
      editTagInputRef.current.focus();
      editTagInputRef.current.select();
    }
  }, [editingTagId]);

  // ========================================
  // Inline Creation Handlers
  // ========================================

  const handleCreatePlaylist = useCallback(() => {
    if (newPlaylistName.trim()) {
      createPlaylist(newPlaylistName.trim());
      setNewPlaylistName('');
    }
    stopCreatingPlaylist();
  }, [newPlaylistName, createPlaylist, stopCreatingPlaylist]);

  const handleCreateTag = useCallback(async () => {
    if (newTagName.trim()) {
      await createTag(newTagName.trim());
      setNewTagName('');
    }
    stopCreatingTag();
  }, [newTagName, createTag, stopCreatingTag]);

  const handleCreateCollection = useCallback(async () => {
    if (newCollectionName.trim()) {
      await createCollection(newCollectionName.trim());
      setNewCollectionName('');
    }
    stopCreatingCollection();
  }, [newCollectionName, createCollection, stopCreatingCollection]);

  const handleCreateFolder = useCallback((name: string) => {
    createFolder(name);
  }, [createFolder]);

  // ========================================
  // Inline Editing Handlers (double-click rename)
  // ========================================

  const startEditingPlaylist = useCallback((playlist: Playlist) => {
    setEditingPlaylistId(playlist.id);
    setEditingPlaylistName(playlist.name);
  }, []);

  const handleRenamePlaylist = useCallback(() => {
    if (editingPlaylistId && editingPlaylistName.trim()) {
      updatePlaylist(editingPlaylistId, { name: editingPlaylistName.trim() });
    }
    setEditingPlaylistId(null);
    setEditingPlaylistName('');
  }, [editingPlaylistId, editingPlaylistName, updatePlaylist]);

  const startEditingCollection = useCallback((collection: Collection) => {
    setEditingCollectionId(collection.id);
    setEditingCollectionName(collection.name);
  }, []);

  const handleRenameCollection = useCallback(() => {
    if (editingCollectionId && editingCollectionName.trim()) {
      updateCollection(editingCollectionId, { name: editingCollectionName.trim() });
    }
    setEditingCollectionId(null);
    setEditingCollectionName('');
  }, [editingCollectionId, editingCollectionName, updateCollection]);

  const startEditingTag = useCallback((tag: Tag) => {
    setEditingTagId(tag.id);
    setEditingTagName(tag.name);
  }, []);

  const handleRenameTag = useCallback(() => {
    if (editingTagId && editingTagName.trim()) {
      updateTag(editingTagId, { name: editingTagName.trim() });
    }
    setEditingTagId(null);
    setEditingTagName('');
  }, [editingTagId, editingTagName, updateTag]);

  // ========================================
  // Collection Expansion Handlers
  // ========================================

  const { getCollection } = useCollectionStore();

  const toggleCollectionExpanded = useCallback(async (collectionId: string) => {
    const isCurrentlyExpanded = expandedCollections.has(collectionId);

    if (isCurrentlyExpanded) {
      // Collapse
      setExpandedCollections(prev => {
        const next = new Set(prev);
        next.delete(collectionId);
        return next;
      });
    } else {
      // Expand - fetch items if not cached
      setExpandedCollections(prev => new Set([...prev, collectionId]));

      if (!collectionItemsCache.has(collectionId)) {
        setLoadingCollectionItems(prev => new Set([...prev, collectionId]));
        try {
          const collectionWithItems = await getCollection(collectionId);
          if (collectionWithItems) {
            setCollectionItemsCache(prev => new Map(prev).set(collectionId, collectionWithItems.items));
          }
        } catch (error) {
          console.error('Failed to fetch collection items:', error);
        } finally {
          setLoadingCollectionItems(prev => {
            const next = new Set(prev);
            next.delete(collectionId);
            return next;
          });
        }
      }
    }
  }, [expandedCollections, collectionItemsCache, getCollection]);

  const handleCollectionItemClick = useCallback((item: CollectionItem) => {
    const data = item.itemData as Record<string, unknown>;

    switch (item.itemType) {
      case 'album':
        useNavigationStore.getState().openAlbum(item.itemId);
        break;
      case 'artist':
        useNavigationStore.getState().openArtist(item.itemId);
        break;
      case 'playlist':
        useNavigationStore.getState().openPlaylist(item.itemId);
        break;
      case 'track':
        // For tracks, maybe play them? Or navigate to album?
        break;
      case 'tag':
        useNavigationStore.getState().openTagDetail(data.name as string || item.itemId);
        break;
      case 'folder':
        // Folders within collections - do nothing on click (they expand in collection detail view)
        break;
    }
  }, []);

  // ========================================
  // Playlist Expansion Handlers
  // ========================================

  const togglePlaylistExpanded = useCallback((playlistId: string) => {
    setExpandedPlaylists(prev => {
      const next = new Set(prev);
      if (next.has(playlistId)) {
        next.delete(playlistId);
      } else {
        next.add(playlistId);
      }
      return next;
    });
  }, []);

  const handlePlaylistTrackClick = useCallback((trackId: string, playlist: Playlist) => {
    // Find the track in the playlist and play it
    const trackIndex = playlist.tracks.findIndex(t => t.id === trackId);
    if (trackIndex !== -1) {
      // Import playerStore and play the track within playlist context
      import('../../stores/player-store').then(({ usePlayerStore }) => {
        usePlayerStore.getState().setQueue(playlist.tracks, trackIndex);
      });
    }
  }, []);

  // ========================================
  // Render Tree Recursively
  // ========================================

  const renderTreeItems = useCallback((items: TreeItem[]): React.ReactNode => {
    return items.map((item) => {
      if (item.type === 'folder') {
        const folder = item.data as PlaylistFolder;
        return (
          <SortableFolderItem
            key={item.id}
            folder={folder}
            isCollapsed={isSidebarCollapsed}
            isOver={overId === item.id}
          >
            {item.children && renderTreeItems(item.children)}
          </SortableFolderItem>
        );
      } else {
        const playlist = item.data as Playlist;
        const isActive = currentView === 'playlist-detail' && selectedPlaylistId === playlist.id;
        const isEditingThis = editingPlaylistId === playlist.id;
        const isExpanded = expandedPlaylists.has(playlist.id);
        return (
          <SortablePlaylistItem
            key={item.id}
            playlist={playlist}
            isActive={isActive}
            isCollapsed={isSidebarCollapsed}
            isExpanded={isExpanded}
            isEditing={isEditingThis}
            editingName={isEditingThis ? editingPlaylistName : undefined}
            onEditingNameChange={setEditingPlaylistName}
            onStartEditing={() => startEditingPlaylist(playlist)}
            onFinishEditing={handleRenamePlaylist}
            editInputRef={isEditingThis ? editPlaylistInputRef : undefined}
            onContextMenu={(e) => showPlaylistContextMenu(e, playlist)}
            onToggleExpand={() => togglePlaylistExpanded(playlist.id)}
            onTrackClick={(trackId) => handlePlaylistTrackClick(trackId, playlist)}
          />
        );
      }
    });
  }, [currentView, selectedPlaylistId, isSidebarCollapsed, overId, editingPlaylistId, editingPlaylistName, startEditingPlaylist, handleRenamePlaylist, showPlaylistContextMenu, expandedPlaylists, togglePlaylistExpanded, handlePlaylistTrackClick]);


  // ========================================
  // Find active item for drag overlay
  // ========================================

  const activeItem = useMemo(() => {
    if (!activeId) return null;
    const findItem = (items: TreeItem[]): TreeItem | null => {
      for (const item of items) {
        if (item.id === activeId) return item;
        if (item.children) {
          const found = findItem(item.children);
          if (found) return found;
        }
      }
      return null;
    };
    return findItem(playlistTree);
  }, [activeId, playlistTree]);

  // ========================================
  // Render
  // ========================================

  return (
    <aside
      className={`sidebar ${isSidebarCollapsed ? 'collapsed' : ''}`}
      style={isSidebarCollapsed ? undefined : { width: sidebarWidth }}
    >
      <div className="sidebar-logo">
        <span className="sidebar-logo-icon"><AudiioLogoIcon size={20} /></span>
        {!isSidebarCollapsed && <span className="sidebar-logo-text">audiio</span>}
        <button
          className="sidebar-collapse-btn"
          onClick={toggleSidebar}
          title={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isSidebarCollapsed ? <ChevronRightIcon size={16} /> : <ChevronLeftIcon size={16} />}
        </button>
      </div>

      <nav className="sidebar-nav">
        <div className="sidebar-section">
          <NavItem
            icon={<DiscoverIcon size={20} />}
            label="Discover"
            view="home"
            isActive={currentView === 'home'}
            onClick={() => navigate('home')}
            isCollapsed={isSidebarCollapsed}
          />
        </div>

        {/* Pinned Items Section */}
        {pinnedItems.length > 0 && (
          <div className="sidebar-section">
            {!isSidebarCollapsed && <div className="sidebar-section-header">Pinned</div>}
            {pinnedItems
              .sort((a, b) => a.position - b.position)
              .map((item) => {
                const itemData = item.itemData as Record<string, unknown>;
                const name = (itemData.name || itemData.title || 'Unknown') as string;
                return (
                  <button
                    key={item.id}
                    className="sidebar-pinned-item"
                    onClick={() => handlePinnedItemClick(item.itemType, item.itemId)}
                    title={isSidebarCollapsed ? name : undefined}
                  >
                    <span className="sidebar-pinned-icon">
                      {getPinnedItemIcon(item.itemType)}
                    </span>
                    {!isSidebarCollapsed && (
                      <span className="sidebar-pinned-name">{name}</span>
                    )}
                  </button>
                );
              })}
          </div>
        )}

        <div className="sidebar-section">
          {!isSidebarCollapsed && <div className="sidebar-section-header">Your Library</div>}
          <NavItem
            icon={<HeartIcon size={20} />}
            label="Liked Songs"
            view="likes"
            isActive={currentView === 'likes'}
            onClick={() => navigate('likes')}
            badge={likedTracks.length}
            isCollapsed={isSidebarCollapsed}
          />
          <NavItem
            icon={<ThumbDownIcon size={20} />}
            label="Disliked Songs"
            view="dislikes"
            isActive={currentView === 'dislikes'}
            onClick={() => navigate('dislikes')}
            badge={dislikedTracks.length}
            isCollapsed={isSidebarCollapsed}
          />
          <NavItem
            icon={<DownloadIcon size={20} />}
            label="Downloads"
            view="downloads"
            isActive={currentView === 'downloads'}
            onClick={() => navigate('downloads')}
            badge={pendingDownloads}
            isCollapsed={isSidebarCollapsed}
          />
          <NavItem
            icon={<StatsIcon size={20} />}
            label="Stats"
            view="stats"
            isActive={currentView === 'stats'}
            onClick={() => navigate('stats')}
            isCollapsed={isSidebarCollapsed}
          />
        </div>

        {/* Plugin Tools Section - dynamically rendered from registry */}
        {toolsNavItems.length > 0 && (
          <div className="sidebar-section">
            {!isSidebarCollapsed && <div className="sidebar-section-header">Tools</div>}
            {toolsNavItems.map((item) => {
              const IconComponent = item.icon;
              const viewId = `plugin-view-${item.viewId}` as View;
              return (
                <NavItem
                  key={item.viewId}
                  icon={<IconComponent size={20} />}
                  label={item.label}
                  view={viewId}
                  isActive={currentView === viewId}
                  onClick={() => navigate(viewId)}
                  isCollapsed={isSidebarCollapsed}
                />
              );
            })}
          </div>
        )}

        <div className="sidebar-section">
          {!isSidebarCollapsed && <div className="sidebar-section-header">Settings</div>}
          <NavItem
            icon={<PluginIcon size={20} />}
            label="Plugins"
            view="plugins"
            isActive={currentView === 'plugins' || currentView === 'plugin-detail'}
            onClick={() => navigate('plugins')}
            badge={enabledPlugins}
            isCollapsed={isSidebarCollapsed}
          />
          <NavItem
            icon={<SettingsIcon size={20} />}
            label="Settings"
            view="settings"
            isActive={currentView === 'settings'}
            onClick={() => navigate('settings')}
            isCollapsed={isSidebarCollapsed}
          />
        </div>
      </nav>

      {/* Unified Playlists/Collections/Tags section with tabs */}
      <div className="sidebar-tabbed-section">
        {!isSidebarCollapsed && (
          <>
            {/* Tab bar */}
            <div className="sidebar-tabs">
              <button
                className={`sidebar-tab ${sidebarActiveTab === 'playlists' ? 'active' : ''}`}
                onClick={() => {
                  if (sidebarActiveTab === 'playlists') {
                    navigate('playlists');
                  } else {
                    setSidebarActiveTab('playlists');
                  }
                }}
                title={sidebarActiveTab === 'playlists' ? 'Click again to view all playlists' : `Playlists (${playlists.length})`}
              >
                <PlaylistIcon size={16} />
                <span className="sidebar-tab-count">{playlists.length}</span>
              </button>
              <button
                className={`sidebar-tab ${sidebarActiveTab === 'collections' ? 'active' : ''}`}
                onClick={() => {
                  if (sidebarActiveTab === 'collections') {
                    navigate('collections');
                  } else {
                    setSidebarActiveTab('collections');
                  }
                }}
                title={sidebarActiveTab === 'collections' ? 'Click again to view all collections' : `Collections (${collections.length})`}
              >
                <FolderIcon size={16} />
                <span className="sidebar-tab-count">{collections.length}</span>
              </button>
              <button
                className={`sidebar-tab ${sidebarActiveTab === 'tags' ? 'active' : ''}`}
                onClick={() => {
                  if (sidebarActiveTab === 'tags') {
                    navigate('tags');
                  } else {
                    setSidebarActiveTab('tags');
                  }
                }}
                title={sidebarActiveTab === 'tags' ? 'Click again to view all tags' : `Tags (${tags.length})`}
              >
                <TagIcon size={16} />
                <span className="sidebar-tab-count">{tags.length}</span>
              </button>
              <button
                className="sidebar-tab-add"
                onClick={() => {
                  if (sidebarActiveTab === 'playlists') startCreatingPlaylist();
                  else if (sidebarActiveTab === 'collections') startCreatingCollection();
                  else startCreatingTag();
                }}
                title={`Create ${sidebarActiveTab === 'playlists' ? 'Playlist' : sidebarActiveTab === 'collections' ? 'Collection' : 'Tag'}`}
              >
                <AddIcon size={14} />
              </button>
            </div>

            {/* Content based on active tab */}
            <div className="sidebar-tab-content">
              {/* Playlists Tab */}
              {sidebarActiveTab === 'playlists' && (
                <>
                  {isCreatingPlaylist && (
                    <div className="sidebar-inline-create">
                      <input
                        ref={playlistInputRef}
                        type="text"
                        value={newPlaylistName}
                        onChange={(e) => setNewPlaylistName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleCreatePlaylist();
                          if (e.key === 'Escape') { setNewPlaylistName(''); stopCreatingPlaylist(); }
                        }}
                        onBlur={handleCreatePlaylist}
                        placeholder="Playlist name..."
                        className="sidebar-inline-input"
                      />
                    </div>
                  )}

                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragStart={handleDragStart}
                    onDragOver={handleDragOver}
                    onDragEnd={handleDragEnd}
                  >
                    <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
                      <div className="sidebar-playlist-list">
                        {playlistTree.length === 0 && !isCreatingPlaylist ? (
                          <div className="sidebar-empty">No playlists yet</div>
                        ) : (
                          renderTreeItems(playlistTree)
                        )}
                      </div>
                    </SortableContext>

                    <DragOverlay>
                      {activeItem && activeItem.type === 'playlist' && (
                        <SortablePlaylistItem
                          playlist={activeItem.data as Playlist}
                          isActive={false}
                          isCollapsed={isSidebarCollapsed}
                          isDragOverlay
                        />
                      )}
                    </DragOverlay>
                  </DndContext>

                  <button
                    className="sidebar-add-folder-button"
                    onClick={openCreateFolderModal}
                    title="Create Folder"
                  >
                    <FolderPlusIcon size={14} />
                    <span>New Folder</span>
                  </button>
                </>
              )}

              {/* Collections Tab */}
              {sidebarActiveTab === 'collections' && (
                <>
                  {isCreatingCollection && (
                    <div className="sidebar-inline-create">
                      <input
                        ref={collectionInputRef}
                        type="text"
                        value={newCollectionName}
                        onChange={(e) => setNewCollectionName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleCreateCollection();
                          if (e.key === 'Escape') { setNewCollectionName(''); stopCreatingCollection(); }
                        }}
                        onBlur={handleCreateCollection}
                        placeholder="Collection name..."
                        className="sidebar-inline-input"
                      />
                    </div>
                  )}

                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleCollectionDragEnd}
                  >
                    <SortableContext items={collectionSortableIds} strategy={verticalListSortingStrategy}>
                      <div className="sidebar-playlist-list">
                        {collections.length === 0 && !isCreatingCollection ? (
                          <div className="sidebar-empty">No collections yet</div>
                        ) : (
                          collections.map((collection) => {
                            const isActive = currentView === 'collection-detail' && selectedCollectionId === collection.id;
                            const isEditingThis = editingCollectionId === collection.id;
                            const isExpanded = expandedCollections.has(collection.id);
                            const cachedItems = collectionItemsCache.get(collection.id) || [];
                            const isLoading = loadingCollectionItems.has(collection.id);
                            return (
                              <SortableCollectionItem
                                key={collection.id}
                                collection={collection}
                                isActive={isActive}
                                isCollapsed={isSidebarCollapsed}
                                isExpanded={isExpanded}
                                items={cachedItems}
                                isLoadingItems={isLoading}
                                isEditing={isEditingThis}
                                editingName={isEditingThis ? editingCollectionName : undefined}
                                onEditingNameChange={setEditingCollectionName}
                                onStartEditing={() => startEditingCollection(collection)}
                                onFinishEditing={handleRenameCollection}
                                editInputRef={isEditingThis ? editCollectionInputRef : undefined}
                                onClick={() => openCollection(collection.id)}
                                onToggleExpand={() => toggleCollectionExpanded(collection.id)}
                                onItemClick={handleCollectionItemClick}
                              />
                            );
                          })
                        )}
                      </div>
                    </SortableContext>
                  </DndContext>
                </>
              )}

              {/* Tags Tab */}
              {sidebarActiveTab === 'tags' && (
                <>
                  {isCreatingTag && (
                    <div className="sidebar-inline-create">
                      <input
                        ref={tagInputRef}
                        type="text"
                        value={newTagName}
                        onChange={(e) => setNewTagName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleCreateTag();
                          if (e.key === 'Escape') { setNewTagName(''); stopCreatingTag(); }
                        }}
                        onBlur={handleCreateTag}
                        placeholder="Tag name..."
                        className="sidebar-inline-input"
                      />
                    </div>
                  )}

                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleTagDragEnd}
                  >
                    <SortableContext items={tagSortableIds} strategy={verticalListSortingStrategy}>
                      <div className="sidebar-playlist-list">
                        {tags.length === 0 && !isCreatingTag ? (
                          <div className="sidebar-empty">No tags yet</div>
                        ) : (
                          tags.map((tag) => {
                            const isEditingThis = editingTagId === tag.id;
                            return (
                              <SortableTagItem
                                key={tag.id}
                                tag={tag}
                                isActive={currentView === 'tag-detail' && selectedTagName === tag.name}
                                isEditing={isEditingThis}
                                editingName={isEditingThis ? editingTagName : undefined}
                                onEditingNameChange={setEditingTagName}
                                onStartEditing={() => startEditingTag(tag)}
                                onFinishEditing={handleRenameTag}
                                editInputRef={isEditingThis ? editTagInputRef : undefined}
                                onClick={() => openTagDetail(tag.name)}
                                onContextMenu={(e) => showTagContextMenu(e, tag)}
                              />
                            );
                          })
                        )}
                      </div>
                    </SortableContext>
                  </DndContext>
                </>
              )}
            </div>
          </>
        )}
      </div>

      {/* Create Folder Modal */}
      {isCreateFolderModalOpen && (
        <InputModal
          title="Create Folder"
          placeholder="Folder name"
          submitLabel="Create"
          onSubmit={handleCreateFolder}
          onClose={closeCreateFolderModal}
          icon={<FolderIcon size={20} />}
        />
      )}

      {/* Resize handle - only when not collapsed */}
      {!isSidebarCollapsed && (
        <div
          className={`sidebar-resize-handle ${isResizing ? 'dragging' : ''}`}
          onMouseDown={handleResizeMouseDown}
        />
      )}
    </aside>
  );
};
