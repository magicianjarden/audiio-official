/**
 * TagBadge - Small badge component for displaying a tag
 *
 * Used inline with tracks, albums, artists, playlists to show tags.
 * Supports click to filter by tag and optional remove button.
 */

import React from 'react';
import { CloseIcon } from '@audiio/icons';
import './TagBadge.css';

interface TagBadgeProps {
  name: string;
  color?: string;
  size?: 'sm' | 'md' | 'lg';
  onClick?: () => void;
  onRemove?: () => void;
  removable?: boolean;
  className?: string;
}

export const TagBadge: React.FC<TagBadgeProps> = ({
  name,
  color = '#6366f1',
  size = 'md',
  onClick,
  onRemove,
  removable = false,
  className = '',
}) => {
  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    onRemove?.();
  };

  return (
    <span
      className={`tag-badge tag-badge-${size} ${onClick ? 'tag-badge-clickable' : ''} ${className}`}
      style={{ '--tag-color': color } as React.CSSProperties}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      <span className="tag-badge-dot" />
      <span className="tag-badge-name">{name}</span>
      {removable && onRemove && (
        <button
          className="tag-badge-remove"
          onClick={handleRemove}
          title={`Remove tag "${name}"`}
        >
          <CloseIcon size={10} />
        </button>
      )}
    </span>
  );
};

// Compact version for inline display
export const TagBadgeCompact: React.FC<{ name: string; color?: string }> = ({
  name,
  color = '#6366f1',
}) => (
  <span
    className="tag-badge tag-badge-compact"
    style={{ '--tag-color': color } as React.CSSProperties}
    title={name}
  >
    <span className="tag-badge-dot" />
  </span>
);

// List of tags with overflow handling
interface TagListProps {
  tags: Array<{ name: string; color?: string }>;
  max?: number;
  size?: 'sm' | 'md' | 'lg';
  onTagClick?: (tagName: string) => void;
  onTagRemove?: (tagName: string) => void;
  removable?: boolean;
}

export const TagList: React.FC<TagListProps> = ({
  tags,
  max = 5,
  size = 'sm',
  onTagClick,
  onTagRemove,
  removable = false,
}) => {
  const visibleTags = tags.slice(0, max);
  const overflowCount = tags.length - max;

  return (
    <div className="tag-list">
      {visibleTags.map((tag) => (
        <TagBadge
          key={tag.name}
          name={tag.name}
          color={tag.color}
          size={size}
          onClick={onTagClick ? () => onTagClick(tag.name) : undefined}
          onRemove={onTagRemove ? () => onTagRemove(tag.name) : undefined}
          removable={removable}
        />
      ))}
      {overflowCount > 0 && (
        <span className="tag-list-overflow">+{overflowCount}</span>
      )}
    </div>
  );
};

export default TagBadge;
