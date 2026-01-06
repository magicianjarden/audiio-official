/**
 * TagSelector - Component for selecting/adding tags to items
 *
 * Features:
 * - Autocomplete with existing tags
 * - Create new tags on the fly
 * - Color picker for new tags
 * - Display current tags with remove option
 */

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useTagStore, type Tag } from '../../stores/tag-store';
import { TagBadge } from './TagBadge';
import { AddIcon, CheckIcon } from '@audiio/icons';
import './TagSelector.css';

interface TagSelectorProps {
  selectedTags: string[];
  onTagAdd: (tagName: string, color?: string) => void;
  onTagRemove: (tagName: string) => void;
  placeholder?: string;
  maxTags?: number;
  showPopularTags?: boolean;
  className?: string;
}

const DEFAULT_COLORS = [
  '#6366f1', // Indigo
  '#8b5cf6', // Violet
  '#ec4899', // Pink
  '#ef4444', // Red
  '#f97316', // Orange
  '#eab308', // Yellow
  '#22c55e', // Green
  '#06b6d4', // Cyan
  '#3b82f6', // Blue
  '#6b7280', // Gray
];

export const TagSelector: React.FC<TagSelectorProps> = ({
  selectedTags,
  onTagAdd,
  onTagRemove,
  placeholder = 'Add tag...',
  maxTags,
  showPopularTags = true,
  className = '',
}) => {
  const { tags, getTagSuggestions, getPopularTags, getTagByName } = useTagStore();

  const [inputValue, setInputValue] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [selectedColor, setSelectedColor] = useState(DEFAULT_COLORS[0]);
  const [showColorPicker, setShowColorPicker] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Get suggestions based on input
  const suggestions = useMemo(() => {
    if (inputValue.trim()) {
      return getTagSuggestions(inputValue).filter(
        tag => !selectedTags.includes(tag.name)
      );
    }
    if (showPopularTags) {
      return getPopularTags(10).filter(
        tag => !selectedTags.includes(tag.name)
      );
    }
    return [];
  }, [inputValue, selectedTags, getTagSuggestions, getPopularTags, showPopularTags]);

  // Check if current input is a new tag
  const isNewTag = useMemo(() => {
    if (!inputValue.trim()) return false;
    return !tags.some(tag =>
      tag.name.toLowerCase() === inputValue.trim().toLowerCase()
    );
  }, [inputValue, tags]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setShowColorPicker(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
    setIsOpen(true);
  };

  const handleInputFocus = () => {
    setIsOpen(true);
  };

  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && inputValue.trim()) {
      e.preventDefault();
      handleAddTag(inputValue.trim());
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      inputRef.current?.blur();
    } else if (e.key === 'Backspace' && !inputValue && selectedTags.length > 0) {
      // Remove last tag on backspace when input is empty
      onTagRemove(selectedTags[selectedTags.length - 1]!);
    }
  };

  const handleAddTag = (tagName: string) => {
    if (maxTags && selectedTags.length >= maxTags) return;

    const existingTag = getTagByName(tagName);
    if (existingTag) {
      onTagAdd(tagName, existingTag.color);
    } else {
      // New tag - use selected color
      onTagAdd(tagName, selectedColor);
    }

    setInputValue('');
    setShowColorPicker(false);
    inputRef.current?.focus();
  };

  const handleSuggestionClick = (tag: Tag) => {
    onTagAdd(tag.name, tag.color);
    setInputValue('');
    inputRef.current?.focus();
  };

  const canAddMore = !maxTags || selectedTags.length < maxTags;

  return (
    <div className={`tag-selector ${className}`} ref={containerRef}>
      {/* Selected tags */}
      <div className="tag-selector-tags">
        {selectedTags.map(tagName => {
          const tag = getTagByName(tagName);
          return (
            <TagBadge
              key={tagName}
              name={tagName}
              color={tag?.color}
              size="sm"
              removable
              onRemove={() => onTagRemove(tagName)}
            />
          );
        })}

        {/* Input */}
        {canAddMore && (
          <input
            ref={inputRef}
            type="text"
            className="tag-selector-input"
            placeholder={selectedTags.length === 0 ? placeholder : ''}
            value={inputValue}
            onChange={handleInputChange}
            onFocus={handleInputFocus}
            onKeyDown={handleInputKeyDown}
          />
        )}
      </div>

      {/* Dropdown */}
      {isOpen && (suggestions.length > 0 || isNewTag) && (
        <div className="tag-selector-dropdown">
          {/* Create new tag option */}
          {isNewTag && (
            <div className="tag-selector-new">
              <button
                className="tag-selector-new-btn"
                onClick={() => setShowColorPicker(!showColorPicker)}
              >
                <AddIcon size={14} />
                <span>Create "{inputValue.trim()}"</span>
                <span
                  className="tag-selector-color-preview"
                  style={{ background: selectedColor }}
                />
              </button>

              {showColorPicker && (
                <div className="tag-selector-colors">
                  {DEFAULT_COLORS.map(color => (
                    <button
                      key={color}
                      className={`tag-selector-color ${color === selectedColor ? 'selected' : ''}`}
                      style={{ background: color }}
                      onClick={() => {
                        setSelectedColor(color);
                        handleAddTag(inputValue.trim());
                      }}
                    >
                      {color === selectedColor && <CheckIcon size={12} />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Suggestions */}
          {suggestions.length > 0 && (
            <div className="tag-selector-suggestions">
              {!isNewTag && inputValue && (
                <div className="tag-selector-suggestions-header">Suggestions</div>
              )}
              {!inputValue && showPopularTags && (
                <div className="tag-selector-suggestions-header">Popular Tags</div>
              )}
              {suggestions.map(tag => (
                <button
                  key={tag.id}
                  className="tag-selector-suggestion"
                  onClick={() => handleSuggestionClick(tag)}
                >
                  <span
                    className="tag-selector-suggestion-dot"
                    style={{ background: tag.color }}
                  />
                  <span className="tag-selector-suggestion-name">{tag.name}</span>
                  <span className="tag-selector-suggestion-count">{tag.usageCount}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TagSelector;
