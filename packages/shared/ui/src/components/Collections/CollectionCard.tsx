/**
 * CollectionCard - Card component for displaying a collection
 *
 * Shows collection name, description, cover image, and item count.
 * Used in both grid and list views.
 */

import React from 'react';
import type { Collection } from '../../stores/collection-store';
import { FolderIcon, TrashIcon, EditIcon, MoreIcon } from '@audiio/icons';
import './CollectionCard.css';

interface CollectionCardProps {
  collection: Collection;
  onClick: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  variant?: 'grid' | 'list';
  showActions?: boolean;
}

export const CollectionCard: React.FC<CollectionCardProps> = ({
  collection,
  onClick,
  onEdit,
  onDelete,
  variant = 'grid',
  showActions = true,
}) => {
  const [showMenu, setShowMenu] = React.useState(false);
  const menuRef = React.useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showMenu]);

  const handleMenuClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowMenu(!showMenu);
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowMenu(false);
    onEdit?.();
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowMenu(false);
    onDelete?.();
  };

  if (variant === 'list') {
    return (
      <div className="collection-card-list" onClick={onClick}>
        <div className="collection-card-list-cover">
          {collection.coverImage ? (
            <img src={collection.coverImage} alt={collection.name} />
          ) : (
            <div className="collection-card-cover-placeholder">
              <FolderIcon size={24} />
            </div>
          )}
        </div>
        <div className="collection-card-list-info">
          <span className="collection-card-list-name">{collection.name}</span>
          {collection.description && (
            <span className="collection-card-list-description">
              {collection.description}
            </span>
          )}
        </div>
        <span className="collection-card-list-count">
          {collection.itemCount} {collection.itemCount === 1 ? 'item' : 'items'}
        </span>
        {showActions && (
          <div className="collection-card-list-actions" ref={menuRef}>
            <button
              className="collection-card-menu-btn"
              onClick={handleMenuClick}
            >
              <MoreIcon size={18} />
            </button>
            {showMenu && (
              <div className="collection-card-menu">
                <button onClick={handleEdit}>
                  <EditIcon size={14} />
                  Edit
                </button>
                <button onClick={handleDelete} className="danger">
                  <TrashIcon size={14} />
                  Delete
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="collection-card" onClick={onClick}>
      <div className="collection-card-cover">
        {collection.coverImage ? (
          <img src={collection.coverImage} alt={collection.name} />
        ) : (
          <div className="collection-card-cover-placeholder">
            <FolderIcon size={48} />
          </div>
        )}
        {showActions && (
          <div className="collection-card-actions" ref={menuRef}>
            <button
              className="collection-card-menu-btn"
              onClick={handleMenuClick}
            >
              <MoreIcon size={18} />
            </button>
            {showMenu && (
              <div className="collection-card-menu">
                <button onClick={handleEdit}>
                  <EditIcon size={14} />
                  Edit
                </button>
                <button onClick={handleDelete} className="danger">
                  <TrashIcon size={14} />
                  Delete
                </button>
              </div>
            )}
          </div>
        )}
      </div>
      <div className="collection-card-info">
        <h3 className="collection-card-name">{collection.name}</h3>
        <p className="collection-card-count">
          {collection.itemCount} {collection.itemCount === 1 ? 'item' : 'items'}
        </p>
      </div>
    </div>
  );
};

export default CollectionCard;
