import React, { useCallback, useRef, useState, useMemo } from 'react';
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
import { useLibraryStore, type Playlist, type PlaylistFolder } from '../../stores/library-store';
import { usePluginStore } from '../../stores/plugin-store';
import { useUIStore } from '../../stores/ui-store';
import { usePluginUIRegistry } from '../../registry';
import { PlaylistCover } from '../common/PlaylistCover';
import { InputModal } from '../Modals/InputModal';
import {
  DiscoverIcon,
  HeartIcon,
  ThumbDownIcon,
  PlaylistIcon,
  DownloadIcon,
  AddIcon,
  MusicNoteIcon,
  PluginIcon,
  SettingsIcon,
  StatsIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  FolderIcon,
  FolderPlusIcon,
  DragHandleIcon,
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
}

const SortablePlaylistItem: React.FC<SortablePlaylistItemProps> = ({
  playlist,
  isActive,
  isCollapsed,
  isDragOverlay = false,
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
    useNavigationStore.getState().openPlaylist(playlist.id);
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <button
        className={`sidebar-playlist-item ${isActive ? 'active' : ''} ${isDragging ? 'dragging' : ''}`}
        onClick={handleClick}
        title={isCollapsed ? playlist.name : undefined}
      >
        {!isCollapsed && (
          <span className="sidebar-drag-handle" {...listeners}>
            <DragHandleIcon size={12} />
          </span>
        )}
        <PlaylistCover
          tracks={playlist.tracks}
          name={playlist.name}
          size="xs"
          className="sidebar-playlist-cover"
        />
        {!isCollapsed && (
          <>
            <span className="sidebar-playlist-name">{playlist.name}</span>
            <span className="sidebar-playlist-count">{playlist.tracks.length}</span>
          </>
        )}
      </button>
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
  const { currentView, navigate, selectedPlaylistId } = useNavigationStore();
  const {
    likedTracks,
    dislikedTracks,
    playlists,
    folders,
    downloads,
    createPlaylist,
    createFolder,
    movePlaylistToFolder,
    moveFolderToFolder,
    reorderSidebarItems,
  } = useLibraryStore();
  const { plugins } = usePluginStore();
  const {
    isSidebarCollapsed,
    toggleSidebar,
    sidebarWidth,
    setSidebarWidth,
    isPlaylistsExpanded,
    togglePlaylistsExpanded,
    isCreatePlaylistModalOpen,
    isCreateFolderModalOpen,
    openCreatePlaylistModal,
    closeCreatePlaylistModal,
    openCreateFolderModal,
    closeCreateFolderModal,
  } = useUIStore();
  const pluginUIRegistry = usePluginUIRegistry();

  // Drag state
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  // Resize state
  const resizeRef = useRef<{
    isDragging: boolean;
    startX: number;
    startWidth: number;
  }>({ isDragging: false, startX: 0, startWidth: 260 });
  const [isResizing, setIsResizing] = useState(false);

  const pendingDownloads = downloads.filter(d => d.status !== 'completed').length;
  const enabledPlugins = plugins.filter(p => p.enabled).length;

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
  // Playlist/Folder Actions
  // ========================================

  const handleCreatePlaylist = useCallback((name: string) => {
    createPlaylist(name);
  }, [createPlaylist]);

  const handleCreateFolder = useCallback((name: string) => {
    createFolder(name);
  }, [createFolder]);

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
        return (
          <SortablePlaylistItem
            key={item.id}
            playlist={playlist}
            isActive={isActive}
            isCollapsed={isSidebarCollapsed}
          />
        );
      }
    });
  }, [currentView, selectedPlaylistId, isSidebarCollapsed, overId]);

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
        <span className="sidebar-logo-icon"><MusicNoteIcon size={20} /></span>
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
            icon={<PlaylistIcon size={20} />}
            label="Playlists"
            view="playlists"
            isActive={currentView === 'playlists' || currentView === 'playlist-detail'}
            onClick={() => navigate('playlists')}
            badge={playlists.length}
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

      {/* Playlists section with folders and drag-drop */}
      <div className={`sidebar-playlists ${isPlaylistsExpanded ? 'expanded' : 'collapsed'}`}>
        {!isSidebarCollapsed && (
          <div className="sidebar-playlists-header">
            <button
              className="sidebar-playlists-toggle"
              onClick={togglePlaylistsExpanded}
              title={isPlaylistsExpanded ? 'Collapse playlists' : 'Expand playlists'}
            >
              {isPlaylistsExpanded ? <ChevronDownIcon size={16} /> : <ChevronRightIcon size={16} />}
              <span>Playlists</span>
              <span className="sidebar-playlists-count">{playlists.length}</span>
            </button>
            <button
              className="sidebar-add-button"
              onClick={openCreatePlaylistModal}
              title="Create Playlist"
            >
              <AddIcon size={18} />
            </button>
          </div>
        )}

        {isPlaylistsExpanded && (
          <>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDragEnd={handleDragEnd}
            >
              <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
                <div className="sidebar-playlist-list">
                  {playlistTree.length === 0 && !isSidebarCollapsed ? (
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

            {/* Add folder button */}
            {!isSidebarCollapsed && (
              <button
                className="sidebar-add-folder-button"
                onClick={openCreateFolderModal}
                title="Create Folder"
              >
                <FolderPlusIcon size={14} />
                <span>New Folder</span>
              </button>
            )}
          </>
        )}
      </div>

      {/* Create Playlist Modal */}
      {isCreatePlaylistModalOpen && (
        <InputModal
          title="Create Playlist"
          placeholder="Playlist name"
          submitLabel="Create"
          onSubmit={handleCreatePlaylist}
          onClose={closeCreatePlaylistModal}
          icon={<PlaylistIcon size={20} />}
        />
      )}

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
