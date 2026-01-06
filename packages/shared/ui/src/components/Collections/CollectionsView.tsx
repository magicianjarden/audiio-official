/**
 * CollectionsView - View for managing all collections
 *
 * Features:
 * - View collections in grid or list mode
 * - Create new collections
 * - Search and sort collections
 * - Edit/delete collections
 */

import React, { useState, useMemo, useCallback } from 'react';
import { useCollectionStore } from '../../stores/collection-store';
import { useNavigationStore } from '../../stores/navigation-store';
import { CollectionCard } from './CollectionCard';
import { FloatingSearch, SearchAction } from '../Search/FloatingSearch';
import {
  AddIcon,
  CloseIcon,
  FolderIcon,
  SortIcon,
  GridIcon,
  ListIcon,
} from '@audiio/icons';
import './CollectionsView.css';

type SortOption = 'name' | 'created' | 'updated' | 'count';

export const CollectionsView: React.FC = () => {
  const { collections, createCollection, deleteCollection, updateCollection } = useCollectionStore();
  const { navigateTo } = useNavigationStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortBy, setSortBy] = useState<SortOption>('updated');

  // Create modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');

  // Edit modal state
  const [editingCollection, setEditingCollection] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');

  // Delete confirmation
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Filter and sort collections
  const filteredCollections = useMemo(() => {
    let filtered = [...collections];

    // Filter by search query
    if (searchQuery?.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(c =>
        c.name.toLowerCase().includes(query) ||
        c.description?.toLowerCase().includes(query)
      );
    }

    // Sort
    switch (sortBy) {
      case 'name':
        filtered.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'created':
        filtered.sort((a, b) => b.createdAt - a.createdAt);
        break;
      case 'updated':
        filtered.sort((a, b) => b.updatedAt - a.updatedAt);
        break;
      case 'count':
        filtered.sort((a, b) => b.itemCount - a.itemCount);
        break;
    }

    return filtered;
  }, [collections, searchQuery, sortBy]);

  // Build actions for the search bar
  const actions: SearchAction[] = useMemo(() => {
    const result: SearchAction[] = [];

    result.push({
      id: 'create',
      label: 'New Collection',
      icon: <AddIcon size={14} />,
      shortcut: 'N',
      primary: true,
      onClick: () => setShowCreateModal(true),
    });

    // Sort options
    result.push({
      id: 'sort-updated',
      label: 'Recent',
      icon: <SortIcon size={14} />,
      active: sortBy === 'updated',
      onClick: () => setSortBy('updated'),
    });
    result.push({
      id: 'sort-name',
      label: 'Name',
      icon: <SortIcon size={14} />,
      active: sortBy === 'name',
      onClick: () => setSortBy('name'),
    });

    // View mode
    result.push({
      id: 'view-grid',
      label: 'Grid',
      icon: <GridIcon size={14} />,
      active: viewMode === 'grid',
      onClick: () => setViewMode('grid'),
    });
    result.push({
      id: 'view-list',
      label: 'List',
      icon: <ListIcon size={14} />,
      active: viewMode === 'list',
      onClick: () => setViewMode('list'),
    });

    return result;
  }, [sortBy, viewMode]);

  const isSearching = searchQuery.trim().length > 0;

  const handleClose = useCallback(() => {
    setSearchQuery('');
  }, []);

  const handleCreate = async () => {
    if (!newName.trim()) return;

    const collection = await createCollection(newName.trim(), newDescription.trim() || undefined);
    if (collection) {
      setShowCreateModal(false);
      setNewName('');
      setNewDescription('');
    }
  };

  const handleStartEdit = (collectionId: string) => {
    const collection = collections.find(c => c.id === collectionId);
    if (collection) {
      setEditingCollection(collectionId);
      setEditName(collection.name);
      setEditDescription(collection.description || '');
    }
  };

  const handleSaveEdit = async () => {
    if (!editingCollection || !editName.trim()) return;

    await updateCollection(editingCollection, {
      name: editName.trim(),
      description: editDescription.trim() || undefined,
    });
    setEditingCollection(null);
    setEditName('');
    setEditDescription('');
  };

  const handleDelete = async () => {
    if (!deleteConfirmId) return;
    await deleteCollection(deleteConfirmId);
    setDeleteConfirmId(null);
  };

  const handleOpenCollection = (collectionId: string) => {
    navigateTo('collection-detail', { selectedCollectionId: collectionId });
  };

  return (
    <div className={`collections-view ${isSearching ? 'searching' : ''}`}>
      <FloatingSearch
        onSearch={setSearchQuery}
        onClose={handleClose}
        isSearchActive={isSearching}
        actions={actions}
        pageContext={{
          type: 'collections',
          label: 'Collections',
          icon: <FolderIcon size={14} />,
        }}
      />

      {/* Collections grid/list */}
      {filteredCollections.length === 0 ? (
        <div className="collections-view-empty">
          {searchQuery ? (
            <>
              <p>No collections matching "{searchQuery}"</p>
            </>
          ) : (
            <>
              <p>No collections yet</p>
              <p className="collections-view-empty-hint">
                Create a collection to organize albums, artists, and playlists
              </p>
              <button onClick={() => setShowCreateModal(true)}>
                <AddIcon size={14} />
                Create your first collection
              </button>
            </>
          )}
        </div>
      ) : (
        <div className={`collections-view-${viewMode}`}>
          {filteredCollections.map(collection => (
            <CollectionCard
              key={collection.id}
              collection={collection}
              variant={viewMode}
              onClick={() => handleOpenCollection(collection.id)}
              onEdit={() => handleStartEdit(collection.id)}
              onDelete={() => setDeleteConfirmId(collection.id)}
            />
          ))}
        </div>
      )}

      {/* Create Collection Modal */}
      {showCreateModal && (
        <div className="modal-overlay">
          <div className="modal modal-small">
            <header className="modal-header">
              <h2>Create Collection</h2>
              <button className="modal-close" onClick={() => setShowCreateModal(false)}>
                <CloseIcon size={20} />
              </button>
            </header>
            <div className="modal-content">
              <div className="modal-field">
                <label>Name</label>
                <input
                  type="text"
                  placeholder="My Collection"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCreate();
                    if (e.key === 'Escape') setShowCreateModal(false);
                  }}
                  autoFocus
                />
              </div>
              <div className="modal-field">
                <label>Description (optional)</label>
                <textarea
                  placeholder="Add a description..."
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  rows={3}
                />
              </div>
              <div className="modal-actions">
                <button
                  className="modal-button secondary"
                  onClick={() => setShowCreateModal(false)}
                >
                  Cancel
                </button>
                <button
                  className="modal-button primary"
                  onClick={handleCreate}
                  disabled={!newName.trim()}
                >
                  Create
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Collection Modal */}
      {editingCollection && (
        <div className="modal-overlay">
          <div className="modal modal-small">
            <header className="modal-header">
              <h2>Edit Collection</h2>
              <button className="modal-close" onClick={() => setEditingCollection(null)}>
                <CloseIcon size={20} />
              </button>
            </header>
            <div className="modal-content">
              <div className="modal-field">
                <label>Name</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveEdit();
                    if (e.key === 'Escape') setEditingCollection(null);
                  }}
                  autoFocus
                />
              </div>
              <div className="modal-field">
                <label>Description</label>
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  rows={3}
                />
              </div>
              <div className="modal-actions">
                <button
                  className="modal-button secondary"
                  onClick={() => setEditingCollection(null)}
                >
                  Cancel
                </button>
                <button
                  className="modal-button primary"
                  onClick={handleSaveEdit}
                  disabled={!editName.trim()}
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="modal-overlay">
          <div className="modal modal-small">
            <header className="modal-header">
              <h2>Delete Collection?</h2>
              <button className="modal-close" onClick={() => setDeleteConfirmId(null)}>
                <CloseIcon size={20} />
              </button>
            </header>
            <div className="modal-content">
              <p style={{ color: 'var(--text-secondary)', marginBottom: '16px' }}>
                This will permanently delete this collection. Items in the collection will not be deleted.
              </p>
              <div className="modal-actions">
                <button
                  className="modal-button secondary"
                  onClick={() => setDeleteConfirmId(null)}
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
    </div>
  );
};

export default CollectionsView;
