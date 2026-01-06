import React, { useState, useEffect, useRef } from 'react';
import type { UnifiedTrack } from '@audiio/core';
import { useTagStore, type Tag, type TrackTag } from '../../stores/tag-store';
import { CloseIcon, AddIcon, TagIcon, CheckIcon, MusicNoteIcon } from '@audiio/icons';

// Pre-defined tag colors
const TAG_COLORS = [
  '#ef4444', // Red
  '#f97316', // Orange
  '#f59e0b', // Amber
  '#eab308', // Yellow
  '#84cc16', // Lime
  '#22c55e', // Green
  '#14b8a6', // Teal
  '#06b6d4', // Cyan
  '#3b82f6', // Blue
  '#6366f1', // Indigo
  '#8b5cf6', // Violet
  '#a855f7', // Purple
  '#d946ef', // Fuchsia
  '#ec4899', // Pink
  '#6b7280', // Gray
];

interface TagTrackModalProps {
  track: UnifiedTrack;
  onClose: () => void;
}

export const TagTrackModal: React.FC<TagTrackModalProps> = ({
  track,
  onClose
}) => {
  const [isCreating, setIsCreating] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState(TAG_COLORS[Math.floor(Math.random() * TAG_COLORS.length)]!);
  const [trackTags, setTrackTags] = useState<TrackTag[]>([]);
  const [isLoadingTags, setIsLoadingTags] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  const { tags, createTag, addTagToTrack, removeTagFromTrack, getTrackTags, refreshTags } = useTagStore();

  // Refresh tags and load track tags on mount
  useEffect(() => {
    const loadData = async () => {
      await refreshTags();
      const existingTags = await getTrackTags(track.id);
      setTrackTags(existingTags);
      setIsLoadingTags(false);
    };
    loadData();
  }, [track.id, refreshTags, getTrackTags]);

  // Close on escape or click outside
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isCreating) {
          setIsCreating(false);
        } else {
          onClose();
        }
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
  }, [onClose, isCreating]);

  // Focus input when creating
  useEffect(() => {
    if (isCreating && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isCreating]);

  const handleCreateTag = async () => {
    if (newTagName.trim()) {
      // Create the tag first
      const tag = await createTag(newTagName.trim(), newTagColor);
      if (tag) {
        // Then add it to the track
        await addTagToTrack(track.id, tag.name, tag.color);
        // Update local state
        setTrackTags(prev => [...prev, {
          id: `temp-${Date.now()}`,
          trackId: track.id,
          tagName: tag.name,
          color: tag.color,
          createdAt: Date.now()
        }]);
      }
      setNewTagName('');
      setNewTagColor(TAG_COLORS[Math.floor(Math.random() * TAG_COLORS.length)]!);
      setIsCreating(false);
    }
  };

  const handleToggleTag = async (tag: Tag) => {
    const hasTag = trackTags.some(t => t.tagName === tag.name);

    if (hasTag) {
      await removeTagFromTrack(track.id, tag.name);
      setTrackTags(prev => prev.filter(t => t.tagName !== tag.name));
    } else {
      await addTagToTrack(track.id, tag.name, tag.color);
      setTrackTags(prev => [...prev, {
        id: `temp-${Date.now()}`,
        trackId: track.id,
        tagName: tag.name,
        color: tag.color,
        createdAt: Date.now()
      }]);
    }
  };

  const artworkUrl = track.artwork?.medium ?? track.album?.artwork?.medium;

  return (
    <div className="modal-overlay">
      <div className="modal" ref={modalRef}>
        <header className="modal-header">
          <h2>Tag Track</h2>
          <button className="modal-close" onClick={onClose}>
            <CloseIcon size={20} />
          </button>
        </header>

        <div className="modal-track-preview">
          {artworkUrl ? (
            <img src={artworkUrl} alt={track.title} />
          ) : (
            <div className="modal-track-placeholder">
              <MusicNoteIcon size={24} />
            </div>
          )}
          <div className="modal-track-info">
            <div className="modal-track-title">{track.title}</div>
            <div className="modal-track-artist">
              {track.artists.map(a => a.name).join(', ')}
            </div>
          </div>
        </div>

        {/* Current tags on track */}
        {trackTags.length > 0 && (
          <div className="modal-current-tags">
            <div className="modal-section-label">Current tags</div>
            <div className="modal-tag-badges">
              {trackTags.map((trackTag) => (
                <button
                  key={trackTag.id}
                  className="modal-tag-badge"
                  style={{ backgroundColor: trackTag.color || 'var(--accent)' }}
                  onClick={() => {
                    const tag = tags.find(t => t.name === trackTag.tagName);
                    if (tag) handleToggleTag(tag);
                  }}
                  title="Click to remove"
                >
                  {trackTag.tagName}
                  <CloseIcon size={12} />
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="modal-content">
          {isCreating ? (
            <div className="modal-create-form">
              <div className="modal-create-tag-row">
                <input
                  ref={inputRef}
                  type="text"
                  placeholder="Tag name"
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCreateTag();
                    if (e.key === 'Escape') setIsCreating(false);
                  }}
                  style={{ flex: 1 }}
                />
              </div>
              <div className="modal-color-picker">
                {TAG_COLORS.map((color) => (
                  <button
                    key={color}
                    className={`modal-color-swatch ${newTagColor === color ? 'selected' : ''}`}
                    style={{ backgroundColor: color }}
                    onClick={() => setNewTagColor(color)}
                    title={color}
                  />
                ))}
              </div>
              <div className="modal-create-buttons">
                <button
                  className="modal-button secondary"
                  onClick={() => setIsCreating(false)}
                >
                  Cancel
                </button>
                <button
                  className="modal-button primary"
                  onClick={handleCreateTag}
                  disabled={!newTagName.trim()}
                  style={{ backgroundColor: newTagColor }}
                >
                  Create Tag
                </button>
              </div>
            </div>
          ) : (
            <button
              className="modal-create-playlist"
              onClick={() => setIsCreating(true)}
            >
              <AddIcon size={20} />
              <span>Create New Tag</span>
            </button>
          )}

          <div className="modal-playlist-list">
            {isLoadingTags ? (
              <div className="modal-empty">Loading tags...</div>
            ) : tags.length === 0 ? (
              <div className="modal-empty">
                No tags yet. Create one above!
              </div>
            ) : (
              tags.map((tag) => {
                const hasTag = trackTags.some(t => t.tagName === tag.name);
                return (
                  <button
                    key={tag.id}
                    className={`modal-playlist-item ${hasTag ? 'added' : ''}`}
                    onClick={() => handleToggleTag(tag)}
                  >
                    <span
                      className="modal-tag-color-dot"
                      style={{ backgroundColor: tag.color || 'var(--accent)' }}
                    />
                    <span className="modal-playlist-name">{tag.name}</span>
                    <span className="modal-playlist-count">
                      {tag.usageCount} tracks
                    </span>
                    {hasTag && <CheckIcon size={18} />}
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
