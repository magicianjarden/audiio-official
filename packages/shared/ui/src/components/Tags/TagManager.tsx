/**
 * TagManager - Full-page component for managing all tags
 *
 * Features:
 * - View all tags with usage counts
 * - Create new tags
 * - Edit tag name and color
 * - Delete tags
 * - Search/filter tags
 */

import React, { useState, useMemo, useCallback } from 'react';
import { useTagStore, type Tag } from '../../stores/tag-store';
import { TagBadge } from './TagBadge';
import { FloatingSearch, SearchAction } from '../Search/FloatingSearch';
import {
  AddIcon,
  EditIcon,
  TrashIcon,
  CloseIcon,
  CheckIcon,
  TagIcon,
  SortIcon,
} from '@audiio/icons';
import './TagManager.css';

const DEFAULT_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444', '#f97316',
  '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#6b7280',
];

interface TagManagerProps {
  onTagClick?: (tagName: string) => void;
}

export const TagManager: React.FC<TagManagerProps> = ({ onTagClick }) => {
  const { tags, createTag, updateTag, deleteTag } = useTagStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'usage' | 'name'>('usage');
  const [editingTag, setEditingTag] = useState<Tag | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(DEFAULT_COLORS[0]!);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Filter and sort tags
  const filteredTags = useMemo(() => {
    let filtered = [...tags];

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(tag =>
        tag.name.toLowerCase().includes(query)
      );
    }

    // Sort
    if (sortBy === 'usage') {
      filtered.sort((a, b) => {
        if (b.usageCount !== a.usageCount) {
          return b.usageCount - a.usageCount;
        }
        return a.name.localeCompare(b.name);
      });
    } else {
      filtered.sort((a, b) => a.name.localeCompare(b.name));
    }

    return filtered;
  }, [tags, searchQuery, sortBy]);

  // Search helpers
  const isSearching = searchQuery.trim().length > 0;

  const handleSearchClose = useCallback(() => {
    setSearchQuery('');
  }, []);

  // Build actions for FloatingSearch
  const actions: SearchAction[] = useMemo(() => {
    const result: SearchAction[] = [];

    result.push({
      id: 'create',
      label: 'New Tag',
      icon: <AddIcon size={14} />,
      shortcut: 'N',
      primary: true,
      onClick: () => setIsCreating(true),
    });

    result.push({
      id: 'sort-usage',
      label: 'Most Used',
      icon: <SortIcon size={14} />,
      active: sortBy === 'usage',
      onClick: () => setSortBy('usage'),
    });

    result.push({
      id: 'sort-name',
      label: 'A-Z',
      icon: <SortIcon size={14} />,
      active: sortBy === 'name',
      onClick: () => setSortBy('name'),
    });

    return result;
  }, [sortBy]);

  const handleStartEdit = (tag: Tag) => {
    setEditingTag(tag);
    setEditName(tag.name);
    setEditColor(tag.color);
  };

  const handleSaveEdit = async () => {
    if (!editingTag || !editName.trim()) return;

    await updateTag(editingTag.id, {
      name: editName.trim(),
      color: editColor,
    });
    setEditingTag(null);
  };

  const handleCancelEdit = () => {
    setEditingTag(null);
    setEditName('');
    setEditColor('');
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;

    await createTag(newName.trim(), newColor);
    setNewName('');
    setNewColor(DEFAULT_COLORS[0]!);
    setIsCreating(false);
  };

  const handleDelete = async () => {
    if (!deleteConfirmId) return;
    await deleteTag(deleteConfirmId);
    setDeleteConfirmId(null);
  };

  return (
    <div className={`tag-manager tags-view ${isSearching ? 'searching' : ''}`}>
      <FloatingSearch
        onSearch={setSearchQuery}
        onClose={handleSearchClose}
        isSearchActive={isSearching}
        actions={actions}
        pageContext={{
          type: 'tags',
          label: `${tags.length} ${tags.length === 1 ? 'tag' : 'tags'}`,
          icon: <TagIcon size={14} />,
        }}
      />

      {/* Create Tag Form (shown as overlay) */}
      {isCreating && (
        <div className="tag-manager-create-overlay">
          <div className="tag-manager-create-form">
            <h3>Create New Tag</h3>
            <input
              type="text"
              placeholder="Tag name..."
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreate();
                if (e.key === 'Escape') setIsCreating(false);
              }}
              autoFocus
            />
            <div className="tag-manager-color-select">
              {DEFAULT_COLORS.map(color => (
                <button
                  key={color}
                  className={`tag-manager-color ${color === newColor ? 'selected' : ''}`}
                  style={{ background: color }}
                  onClick={() => setNewColor(color)}
                />
              ))}
            </div>
            <div className="tag-manager-create-actions">
              <button
                className="tag-manager-btn secondary"
                onClick={() => setIsCreating(false)}
              >
                Cancel
              </button>
              <button
                className="tag-manager-btn primary"
                onClick={handleCreate}
                disabled={!newName.trim()}
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tags List */}
      <div className="tag-manager-list">
        {filteredTags.length === 0 ? (
          <div className="tag-manager-empty">
            {searchQuery ? (
              <>
                <TagIcon size={48} />
                <p>No tags matching "{searchQuery}"</p>
                <button onClick={() => setSearchQuery('')}>Clear search</button>
              </>
            ) : (
              <>
                <TagIcon size={48} />
                <p>No tags yet</p>
                <p className="tag-manager-empty-hint">
                  Create tags to organize your music
                </p>
                <button
                  className="tag-manager-btn primary"
                  onClick={() => setIsCreating(true)}
                >
                  <AddIcon size={16} />
                  Create First Tag
                </button>
              </>
            )}
          </div>
        ) : (
          filteredTags.map(tag => (
            <div key={tag.id} className="tag-manager-item">
              {editingTag?.id === tag.id ? (
                // Edit mode
                <div className="tag-manager-item-edit">
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveEdit();
                      if (e.key === 'Escape') handleCancelEdit();
                    }}
                    autoFocus
                  />
                  <div className="tag-manager-color-select">
                    {DEFAULT_COLORS.map(color => (
                      <button
                        key={color}
                        className={`tag-manager-color ${color === editColor ? 'selected' : ''}`}
                        style={{ background: color }}
                        onClick={() => setEditColor(color)}
                      />
                    ))}
                  </div>
                  <div className="tag-manager-item-edit-actions">
                    <button
                      className="tag-manager-icon-btn"
                      onClick={handleCancelEdit}
                      title="Cancel"
                    >
                      <CloseIcon size={16} />
                    </button>
                    <button
                      className="tag-manager-icon-btn save"
                      onClick={handleSaveEdit}
                      title="Save"
                    >
                      <CheckIcon size={16} />
                    </button>
                  </div>
                </div>
              ) : (
                // View mode
                <>
                  <TagBadge
                    name={tag.name}
                    color={tag.color}
                    size="md"
                    onClick={onTagClick ? () => onTagClick(tag.name) : undefined}
                  />
                  <span className="tag-manager-item-count">
                    {tag.usageCount} {tag.usageCount === 1 ? 'item' : 'items'}
                  </span>
                  <div className="tag-manager-item-actions">
                    <button
                      className="tag-manager-icon-btn"
                      onClick={() => handleStartEdit(tag)}
                      title="Edit tag"
                    >
                      <EditIcon size={16} />
                    </button>
                    <button
                      className="tag-manager-icon-btn danger"
                      onClick={() => setDeleteConfirmId(tag.id)}
                      title="Delete tag"
                    >
                      <TrashIcon size={16} />
                    </button>
                  </div>
                </>
              )}
            </div>
          ))
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="modal-overlay">
          <div className="modal modal-small">
            <header className="modal-header">
              <h2>Delete Tag?</h2>
              <button className="modal-close" onClick={() => setDeleteConfirmId(null)}>
                <CloseIcon size={20} />
              </button>
            </header>
            <div className="modal-content">
              <p style={{ color: 'var(--text-secondary)', marginBottom: '16px' }}>
                This will remove the tag from all items. This action cannot be undone.
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

export default TagManager;
