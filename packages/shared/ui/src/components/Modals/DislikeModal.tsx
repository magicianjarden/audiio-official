import React, { useState, useMemo } from 'react';
import type { UnifiedTrack } from '@audiio/core';
import {
  useRecommendationStore,
  DISLIKE_REASONS,
  DISLIKE_CATEGORIES,
  type DislikeReason,
  type DislikeCategory
} from '../../stores/recommendation-store';
import { useLibraryStore } from '../../stores/library-store';
import { CloseIcon, MusicNoteIcon } from '@audiio/icons';

interface DislikeModalProps {
  track: UnifiedTrack;
  onClose: () => void;
}

export const DislikeModal: React.FC<DislikeModalProps> = ({ track, onClose }) => {
  const [selectedReasons, setSelectedReasons] = useState<DislikeReason[]>([]);
  const { recordDislike } = useRecommendationStore();
  const { dislikeTrack } = useLibraryStore();

  // Group reasons by category
  const reasonsByCategory = useMemo(() => {
    const grouped = new Map<DislikeCategory, typeof DISLIKE_REASONS>();
    for (const reason of DISLIKE_REASONS) {
      const existing = grouped.get(reason.category) || [];
      existing.push(reason);
      grouped.set(reason.category, existing);
    }
    return grouped;
  }, []);

  const toggleReason = (reason: DislikeReason) => {
    setSelectedReasons(prev =>
      prev.includes(reason)
        ? prev.filter(r => r !== reason)
        : [...prev, reason]
    );
  };

  const handleSubmit = () => {
    if (selectedReasons.length > 0) {
      recordDislike(track, selectedReasons);
      dislikeTrack(track);
      onClose();
    }
  };

  const handleSkip = () => {
    // Record dislike with generic reason
    recordDislike(track, ['not_my_taste']);
    dislikeTrack(track);
    onClose();
  };

  const artworkUrl = track.artwork?.medium ?? track.album?.artwork?.medium;
  const artistNames = track.artists.map(a => a.name).join(', ');

  // Order categories for display
  const categoryOrder: DislikeCategory[] = ['track', 'artist', 'mood', 'quality', 'content'];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="dislike-modal" onClick={e => e.stopPropagation()}>
        <header className="dislike-modal-header">
          <h2>Not for you?</h2>
          <button className="dislike-modal-close" onClick={onClose}>
            <CloseIcon size={20} />
          </button>
        </header>

        <div className="dislike-modal-track">
          {artworkUrl ? (
            <img className="dislike-modal-artwork" src={artworkUrl} alt="" />
          ) : (
            <div className="dislike-modal-artwork dislike-modal-artwork-placeholder">
              <MusicNoteIcon size={24} />
            </div>
          )}
          <div className="dislike-modal-track-info">
            <span className="dislike-modal-title">{track.title}</span>
            <span className="dislike-modal-artist">{artistNames}</span>
          </div>
        </div>

        <div className="dislike-modal-content">
          <p className="dislike-modal-prompt">
            Tell us why to improve your recommendations:
          </p>

          <div className="dislike-categories">
            {categoryOrder.map(category => {
              const reasons = reasonsByCategory.get(category);
              if (!reasons?.length) return null;

              return (
                <div key={category} className="dislike-category">
                  <h4 className="dislike-category-title">{DISLIKE_CATEGORIES[category]}</h4>
                  <div className="dislike-category-reasons">
                    {reasons.map(({ value, label, description }) => (
                      <button
                        key={value}
                        className={`dislike-reason-chip ${selectedReasons.includes(value) ? 'selected' : ''}`}
                        onClick={() => toggleReason(value)}
                        title={description}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <footer className="dislike-modal-footer">
          <button className="dislike-modal-skip" onClick={handleSkip}>
            Just hide it
          </button>
          <button
            className="dislike-modal-submit"
            onClick={handleSubmit}
            disabled={selectedReasons.length === 0}
          >
            Submit{selectedReasons.length > 0 ? ` (${selectedReasons.length})` : ''}
          </button>
        </footer>
      </div>
    </div>
  );
};
