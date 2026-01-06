/**
 * CollectionView - Detailed view of a single collection
 *
 * Collections are flexible "hubs" that can contain:
 * - Albums, Artists, Playlists, Tracks, Tags
 * - Folders (for organizing items within the collection)
 */

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useCollectionStore, type CollectionWithItems, type CollectionItem } from '../../stores/collection-store';
import { useNavigationStore } from '../../stores/navigation-store';
import { usePlayerStore } from '../../stores/player-store';
import { FloatingSearch, SearchAction } from '../Search/FloatingSearch';
import { getColorsForArtwork, getDefaultColors, type ExtractedColors } from '../../utils/color-extraction';
import {
  PlayIcon,
  ShuffleIcon,
  EditIcon,
  TrashIcon,
  FolderIcon,
  FolderPlusIcon,
  AddIcon,
  ChevronRightIcon,
  TagIcon,
  PlaylistIcon,
  AlbumIcon,
  ArtistIcon,
  MusicNoteIcon,
  SearchIcon,
  CloseIcon,
} from '@audiio/icons';
import './CollectionView.css';

interface CollectionViewProps {
  collectionId: string;
}

interface CollectionTreeItem {
  item: CollectionItem;
  children: CollectionTreeItem[];
}

export const CollectionView: React.FC<CollectionViewProps> = ({ collectionId }) => {
  const {
    getCollection,
    removeFromCollection,
    updateCollection,
    deleteCollection,
    createFolderInCollection,
    updateFolderInCollection,
    moveItemToFolder,
  } = useCollectionStore();
  const { navigateTo, goBack, openTagDetail } = useNavigationStore();
  const { playTracks, shuffleTracks } = usePlayerStore();

  const [collection, setCollection] = useState<CollectionWithItems | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [colors, setColors] = useState<ExtractedColors>(getDefaultColors());

  // Edit state
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');

  // Delete confirmation
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // New folder state
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [createFolderParentId, setCreateFolderParentId] = useState<string | null>(null);

  // Expanded folders state
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());

  // Load collection
  const loadCollection = useCallback(async () => {
    setIsLoading(true);
    const data = await getCollection(collectionId);
    setCollection(data);
    if (data) {
      setEditName(data.name);
      setEditDescription(data.description || '');
      // Auto-expand all folders initially
      const folderIds = data.items
        .filter(i => i.itemType === 'folder')
        .map(i => i.itemId);
      setExpandedFolders(new Set(folderIds));
    }
    setIsLoading(false);
  }, [collectionId, getCollection]);

  useEffect(() => {
    loadCollection();
  }, [loadCollection]);

  // Extract colors from collection cover or first item artwork
  useEffect(() => {
    const getArtwork = () => {
      if (collection?.coverImage) return collection.coverImage;
      // Find first item with artwork
      const firstItemWithArtwork = collection?.items.find(item => {
        const data = item.itemData as Record<string, unknown>;
        return data.artwork || data.image || data.cover;
      });
      if (firstItemWithArtwork) {
        const data = firstItemWithArtwork.itemData as Record<string, unknown>;
        return (data.artwork || data.image || data.cover) as string;
      }
      return null;
    };

    const artwork = getArtwork();
    if (artwork) {
      getColorsForArtwork(artwork).then(setColors);
    }
  }, [collection?.coverImage, collection?.items]);

  // Build tree structure from flat items
  const itemTree = useMemo(() => {
    if (!collection) return [];

    const buildTree = (parentFolderId: string | null): CollectionTreeItem[] => {
      return collection.items
        .filter(item => item.parentFolderId === parentFolderId)
        .sort((a, b) => a.position - b.position)
        .map(item => ({
          item,
          children: item.itemType === 'folder' ? buildTree(item.itemId) : [],
        }));
    };

    return buildTree(null);
  }, [collection]);

  const handleSaveEdit = async () => {
    if (!editName.trim()) return;

    await updateCollection(collectionId, {
      name: editName.trim(),
      description: editDescription.trim() || undefined,
    });
    setIsEditing(false);
    loadCollection();
  };

  const handleDelete = async () => {
    await deleteCollection(collectionId);
    goBack();
  };

  const handleRemoveItem = async (itemId: string) => {
    await removeFromCollection(collectionId, itemId);
    loadCollection();
  };

  const handleItemClick = (item: CollectionItem) => {
    switch (item.itemType) {
      case 'album':
        navigateTo('album', { selectedAlbum: item.itemData as never });
        break;
      case 'artist':
        navigateTo('artist', { selectedArtist: item.itemData as never });
        break;
      case 'playlist':
        navigateTo('playlist-detail', { selectedPlaylistId: item.itemId });
        break;
      case 'track':
        // Play the track
        playTracks([item.itemData as never], 0);
        break;
      case 'tag':
        // Navigate to tag detail
        const tagName = (item.itemData as { name?: string }).name || item.itemId;
        openTagDetail(tagName);
        break;
      case 'folder':
        // Toggle folder expansion
        toggleFolder(item.itemId);
        break;
    }
  };

  const toggleFolder = (folderId: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }
      return next;
    });
  };

  const handlePlayAll = () => {
    if (!collection) return;

    // Collect all tracks from items (including nested in folders)
    const tracks = collection.items
      .filter(item => item.itemType === 'track')
      .map(item => item.itemData as never);

    if (tracks.length > 0) {
      playTracks(tracks, 0);
    }
  };

  const handleShuffleAll = () => {
    if (!collection) return;

    const tracks = collection.items
      .filter(item => item.itemType === 'track')
      .map(item => item.itemData as never);

    if (tracks.length > 0) {
      shuffleTracks(tracks);
    }
  };

  // Search helpers
  const isSearching = searchQuery.trim().length > 0;

  const handleSearchClose = useCallback(() => {
    setSearchQuery('');
  }, []);

  // Filter items based on search query
  const filteredItemTree = useMemo(() => {
    if (!searchQuery.trim()) return itemTree;

    const query = searchQuery.toLowerCase();

    const filterTree = (items: CollectionTreeItem[]): CollectionTreeItem[] => {
      return items.reduce<CollectionTreeItem[]>((acc, treeItem) => {
        const title = getItemTitle(treeItem.item).toLowerCase();
        const matchesSearch = title.includes(query);
        const filteredChildren = filterTree(treeItem.children);

        if (matchesSearch || filteredChildren.length > 0) {
          acc.push({
            ...treeItem,
            children: filteredChildren,
          });
        }

        return acc;
      }, []);
    };

    return filterTree(itemTree);
  }, [itemTree, searchQuery]);

  // Build actions for FloatingSearch
  const actions: SearchAction[] = useMemo(() => {
    const result: SearchAction[] = [];
    const trackCount = collection?.items.filter(i => i.itemType === 'track').length || 0;

    if (trackCount > 0) {
      result.push({
        id: 'play',
        label: 'Play All',
        icon: <PlayIcon size={14} />,
        shortcut: 'P',
        primary: true,
        onClick: handlePlayAll,
      });
      result.push({
        id: 'shuffle',
        label: 'Shuffle',
        icon: <ShuffleIcon size={14} />,
        shortcut: 'S',
        primary: true,
        onClick: handleShuffleAll,
      });
    }

    result.push({
      id: 'new-folder',
      label: 'New Folder',
      icon: <FolderPlusIcon size={14} />,
      onClick: () => startCreatingFolder(null),
    });

    return result;
  }, [collection?.items, handlePlayAll, handleShuffleAll]);

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;

    await createFolderInCollection(collectionId, newFolderName.trim(), createFolderParentId);
    setNewFolderName('');
    setIsCreatingFolder(false);
    setCreateFolderParentId(null);
    loadCollection();
  };

  const startCreatingFolder = (parentId: string | null = null) => {
    setCreateFolderParentId(parentId);
    setNewFolderName('');
    setIsCreatingFolder(true);
  };

  const getItemIcon = (itemType: string) => {
    switch (itemType) {
      case 'album':
        return <AlbumIcon size={20} />;
      case 'artist':
        return <ArtistIcon size={20} />;
      case 'playlist':
        return <PlaylistIcon size={20} />;
      case 'track':
        return <MusicNoteIcon size={20} />;
      case 'tag':
        return <TagIcon size={20} />;
      case 'folder':
        return <FolderIcon size={20} />;
      default:
        return <FolderIcon size={20} />;
    }
  };

  const getItemImage = (item: CollectionItem) => {
    const data = item.itemData as Record<string, unknown>;
    return data.artwork || data.image || data.cover || data.thumbnail;
  };

  const getItemTitle = (item: CollectionItem) => {
    const data = item.itemData as Record<string, unknown>;
    return (data.name || data.title || 'Unknown') as string;
  };

  const getItemSubtitle = (item: CollectionItem) => {
    const data = item.itemData as Record<string, unknown>;
    switch (item.itemType) {
      case 'album':
        return (data.artist || data.artistName) as string;
      case 'artist':
        return `${data.albumCount || 0} albums`;
      case 'playlist':
        return `${data.trackCount || 0} tracks`;
      case 'track':
        return (data.artist || data.artistName) as string;
      case 'tag':
        return `${data.usageCount || 0} items`;
      case 'folder':
        // Count items in this folder
        const childCount = collection?.items.filter(i => i.parentFolderId === item.itemId).length || 0;
        return `${childCount} ${childCount === 1 ? 'item' : 'items'}`;
      default:
        return '';
    }
  };

  const renderItem = (treeItem: CollectionTreeItem, depth: number = 0) => {
    const { item, children } = treeItem;
    const isFolder = item.itemType === 'folder';
    const isExpanded = expandedFolders.has(item.itemId);

    return (
      <div key={item.id} className="collection-view-item-wrapper">
        <div
          className={`collection-view-item ${isFolder ? 'is-folder' : ''}`}
          style={{ paddingLeft: `${12 + depth * 24}px` }}
          onClick={() => handleItemClick(item)}
        >
          {isFolder && (
            <button
              className={`collection-view-folder-toggle ${isExpanded ? 'expanded' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                toggleFolder(item.itemId);
              }}
            >
              <ChevronRightIcon size={14} />
            </button>
          )}
          <div className="collection-view-item-image">
            {getItemImage(item) ? (
              <img src={getItemImage(item) as string} alt="" />
            ) : (
              <div className={`collection-view-item-placeholder type-${item.itemType}`}>
                {getItemIcon(item.itemType)}
              </div>
            )}
          </div>
          <div className="collection-view-item-info">
            <span className="collection-view-item-type">{item.itemType}</span>
            <span className="collection-view-item-title">{getItemTitle(item)}</span>
            <span className="collection-view-item-subtitle">{getItemSubtitle(item)}</span>
          </div>
          <div className="collection-view-item-actions">
            {isFolder && (
              <button
                className="collection-view-item-action"
                onClick={(e) => {
                  e.stopPropagation();
                  startCreatingFolder(item.itemId);
                }}
                title="Add subfolder"
              >
                <FolderPlusIcon size={16} />
              </button>
            )}
            <button
              className="collection-view-item-remove"
              onClick={(e) => {
                e.stopPropagation();
                handleRemoveItem(item.itemId);
              }}
              title="Remove from collection"
            >
              <TrashIcon size={16} />
            </button>
          </div>
        </div>

        {/* Render children if folder is expanded */}
        {isFolder && isExpanded && children.length > 0 && (
          <div className="collection-view-folder-children">
            {children.map(child => renderItem(child, depth + 1))}
          </div>
        )}

        {/* Empty folder message */}
        {isFolder && isExpanded && children.length === 0 && (
          <div
            className="collection-view-folder-empty"
            style={{ paddingLeft: `${36 + depth * 24}px` }}
          >
            Empty folder
          </div>
        )}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="collection-view-loading">
        <div className="loading-spinner" />
      </div>
    );
  }

  if (!collection) {
    return (
      <div className="collection-view-not-found">
        <p>Collection not found</p>
        <button onClick={goBack}>Go back</button>
      </div>
    );
  }

  const trackCount = collection.items.filter(i => i.itemType === 'track').length;

  return (
    <div className={`collection-view collection-detail-view ${isSearching ? 'searching' : ''}`}>
      <FloatingSearch
        onSearch={setSearchQuery}
        onClose={handleSearchClose}
        isSearchActive={isSearching}
        actions={actions}
        pageContext={{
          type: 'collection-detail',
          icon: <FolderIcon size={14} />,
        }}
        detailInfo={{
          title: collection.name,
          subtitle: `${collection.itemCount} ${collection.itemCount === 1 ? 'item' : 'items'}`,
          artwork: collection.coverImage,
          icon: <FolderIcon size={16} />,
          onBack: goBack,
        }}
      />
      {/* Ambient Background */}
      {collection.coverImage && (
        <div
          className="detail-ambient-bg"
          style={{ backgroundImage: `url(${collection.coverImage})` }}
        />
      )}

      {/* Items list */}
      <div className="collection-view-items">
        {/* New folder input */}
        {isCreatingFolder && createFolderParentId === null && (
          <div className="collection-view-new-folder">
            <FolderIcon size={20} />
            <input
              type="text"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="Folder name..."
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreateFolder();
                if (e.key === 'Escape') {
                  setIsCreatingFolder(false);
                  setNewFolderName('');
                }
              }}
              onBlur={() => {
                if (!newFolderName.trim()) {
                  setIsCreatingFolder(false);
                }
              }}
            />
            <button onClick={handleCreateFolder} disabled={!newFolderName.trim()}>
              Create
            </button>
          </div>
        )}

        {collection.items.length === 0 && !isCreatingFolder ? (
          <div className="collection-view-empty">
            <FolderIcon size={48} />
            <p>This collection is empty</p>
            <p className="collection-view-empty-hint">
              Add albums, artists, playlists, tracks, or tags from their context menus
            </p>
          </div>
        ) : filteredItemTree.length === 0 && isSearching ? (
          <div className="collection-view-empty">
            <SearchIcon size={48} />
            <p>No matching items</p>
            <p className="collection-view-empty-hint">
              Try adjusting your search
            </p>
          </div>
        ) : (
          filteredItemTree.map(treeItem => renderItem(treeItem, 0))
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="modal-overlay">
          <div className="modal modal-small">
            <header className="modal-header">
              <h2>Delete Collection?</h2>
            </header>
            <div className="modal-content">
              <p style={{ color: 'var(--text-secondary)', marginBottom: '16px' }}>
                This will permanently delete "{collection.name}". Items in the collection will not be affected.
              </p>
              <div className="modal-actions">
                <button
                  className="modal-button secondary"
                  onClick={() => setShowDeleteConfirm(false)}
                >
                  Cancel
                </button>
                <button
                  className="modal-button primary"
                  onClick={handleDelete}
                  style={{ background: 'var(--color-error)' }}
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Subfolder creation modal (for nested folders) */}
      {isCreatingFolder && createFolderParentId !== null && (
        <div className="modal-overlay">
          <div className="modal modal-small">
            <header className="modal-header">
              <h2>New Folder</h2>
            </header>
            <div className="modal-content">
              <input
                type="text"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="Folder name..."
                autoFocus
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '6px',
                  color: 'var(--text-primary)',
                  fontSize: '14px',
                  marginBottom: '16px',
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateFolder();
                  if (e.key === 'Escape') {
                    setIsCreatingFolder(false);
                    setNewFolderName('');
                    setCreateFolderParentId(null);
                  }
                }}
              />
              <div className="modal-actions">
                <button
                  className="modal-button secondary"
                  onClick={() => {
                    setIsCreatingFolder(false);
                    setNewFolderName('');
                    setCreateFolderParentId(null);
                  }}
                >
                  Cancel
                </button>
                <button
                  className="modal-button primary"
                  onClick={handleCreateFolder}
                  disabled={!newFolderName.trim()}
                >
                  Create
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CollectionView;
