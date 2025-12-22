import React, { useState } from 'react';
import type { UnifiedTrack } from '@audiio/core';
import {
  useRecommendationStore,
  DISLIKE_REASONS,
  type DislikeReason
} from '../../stores/recommendation-store';
import { useLibraryStore } from '../../stores/library-store';
import { CloseIcon, MusicNoteIcon } from '../Icons/Icons';

interface DislikeModalProps {
  track: UnifiedTrack;
  onClose: () => void;
}

export const DislikeModal: React.FC<DislikeModalProps> = ({ track, onClose }) => {
  const [selectedReasons, setSelectedReasons] = useState<DislikeReason[]>([]);
  const { recordDislike } = useRecommendationStore();
  const { dislikeTrack } = useLibraryStore();

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
            Help us understand why so we can improve your recommendations:
          </p>

          <div className="dislike-reasons-grid">
            {DISLIKE_REASONS.map(({ value, label }) => (
              <button
                key={value}
                className={`dislike-reason-button ${selectedReasons.includes(value) ? 'selected' : ''}`}
                onClick={() => toggleReason(value)}
              >
                {label}
              </button>
            ))}
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
            Submit Feedback
          </button>
        </footer>
      </div>
    </div>
  );
};
