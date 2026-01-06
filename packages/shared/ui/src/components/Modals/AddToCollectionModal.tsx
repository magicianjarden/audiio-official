import React, { useState, useEffect, useRef } from 'react';
import type { UnifiedTrack } from '@audiio/core';
import { useCollectionStore, type Collection } from '../../stores/collection-store';
import { CloseIcon, AddIcon, FolderIcon, CheckIcon, AlbumIcon, ArtistIcon, MusicNoteIcon } from '@audiio/icons';

export type CollectionItemType = 'track' | 'album' | 'artist' | 'playlist';

interface AddToCollectionModalProps {
  itemType: CollectionItemType;
  itemId: string;
  itemData: Record<string, unknown>;
  onClose: () => void;
}

export const AddToCollectionModal: React.FC<AddToCollectionModalProps> = ({
  itemType,
  itemId,
  itemData,
  onClose
}) => {
  const [isCreating, setIsCreating] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState('');
  const [addedTo, setAddedTo] = useState<Set<string>>(new Set());
  const inputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  const { collections, createCollection, addToCollection, refreshCollections } = useCollectionStore();

  // Refresh collections on mount
  useEffect(() => {
    refreshCollections();
  }, [refreshCollections]);

  // Close on escape or click outside
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

  // Focus input when creating
  useEffect(() => {
    if (isCreating && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isCreating]);

  const handleCreateCollection = async () => {
    if (newCollectionName.trim()) {
      const collection = await createCollection(newCollectionName.trim());
      if (collection) {
        await addToCollection(collection.id, itemType, itemId, itemData);
        setAddedTo(prev => new Set(prev).add(collection.id));
      }
      setNewCollectionName('');
      setIsCreating(false);
    }
  };

  const handleAddToCollection = async (collectionId: string) => {
    if (!addedTo.has(collectionId)) {
      await addToCollection(collectionId, itemType, itemId, itemData);
      setAddedTo(prev => new Set(prev).add(collectionId));
    }
  };

  // Get display info based on item type
  const getItemIcon = () => {
    switch (itemType) {
      case 'track': return <MusicNoteIcon size={24} />;
      case 'album': return <AlbumIcon size={24} />;
      case 'artist': return <ArtistIcon size={24} />;
      default: return <FolderIcon size={24} />;
    }
  };

  const getItemTitle = () => {
    return (itemData.title || itemData.name || 'Unknown') as string;
  };

  const getItemSubtitle = () => {
    if (itemType === 'track') {
      const artists = itemData.artists as Array<{ name: string }> | undefined;
      return artists?.map(a => a.name).join(', ') || '';
    }
    if (itemType === 'album') {
      return (itemData.artist || '') as string;
    }
    return '';
  };

  const artworkUrl = (itemData.artwork as { medium?: string })?.medium
    || (itemData.album as { artwork?: { medium?: string } })?.artwork?.medium
    || (itemData.image as string);

  return (
    <div className="modal-overlay">
      <div className="modal" ref={modalRef}>
        <header className="modal-header">
          <h2>Add to Collection</h2>
          <button className="modal-close" onClick={onClose}>
            <CloseIcon size={20} />
          </button>
        </header>

        <div className="modal-track-preview">
          {artworkUrl ? (
            <img src={artworkUrl} alt={getItemTitle()} />
          ) : (
            <div className="modal-track-placeholder">
              {getItemIcon()}
            </div>
          )}
          <div className="modal-track-info">
            <div className="modal-track-title">{getItemTitle()}</div>
            {getItemSubtitle() && (
              <div className="modal-track-artist">{getItemSubtitle()}</div>
            )}
          </div>
        </div>

        <div className="modal-content">
          {isCreating ? (
            <div className="modal-create-form">
              <input
                ref={inputRef}
                type="text"
                placeholder="Collection name"
                value={newCollectionName}
                onChange={(e) => setNewCollectionName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateCollection();
                  if (e.key === 'Escape') setIsCreating(false);
                }}
              />
              <div className="modal-create-buttons">
                <button
                  className="modal-button secondary"
                  onClick={() => setIsCreating(false)}
                >
                  Cancel
                </button>
                <button
                  className="modal-button primary"
                  onClick={handleCreateCollection}
                  disabled={!newCollectionName.trim()}
                >
                  Create
                </button>
              </div>
            </div>
          ) : (
            <button
              className="modal-create-playlist"
              onClick={() => setIsCreating(true)}
            >
              <AddIcon size={20} />
              <span>New Collection</span>
            </button>
          )}

          <div className="modal-playlist-list">
            {collections.length === 0 ? (
              <div className="modal-empty">
                No collections yet. Create one above!
              </div>
            ) : (
              collections.map((collection) => {
                const isAdded = addedTo.has(collection.id);
                return (
                  <button
                    key={collection.id}
                    className={`modal-playlist-item ${isAdded ? 'added' : ''}`}
                    onClick={() => handleAddToCollection(collection.id)}
                    disabled={isAdded}
                  >
                    <FolderIcon size={20} />
                    <span className="modal-playlist-name">{collection.name}</span>
                    <span className="modal-playlist-count">
                      {collection.itemCount} items
                    </span>
                    {isAdded && <CheckIcon size={18} />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
