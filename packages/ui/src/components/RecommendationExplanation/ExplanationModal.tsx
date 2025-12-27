/**
 * ExplanationModal - Modal showing why a track was recommended
 */

import React, { useEffect, useRef } from 'react';
import type { TrackExplanation, ExplanationFactor } from '../../hooks/useRecommendationExplanation';
import { CloseIcon, MusicNoteIcon } from '@audiio/icons';

interface ExplanationModalProps {
  explanation: TrackExplanation | null;
  isLoading: boolean;
  error: string | null;
  onClose: () => void;
}

export const ExplanationModal: React.FC<ExplanationModalProps> = ({
  explanation,
  isLoading,
  error,
  onClose,
}) => {
  const modalRef = useRef<HTMLDivElement>(null);

  // Close on escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Close on click outside
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  if (!explanation && !isLoading && !error) return null;

  return (
    <div className="explanation-modal-backdrop" onClick={handleBackdropClick}>
      <div className="explanation-modal" ref={modalRef}>
        <header className="explanation-modal-header">
          <h2 className="explanation-modal-title">Why this recommendation?</h2>
          <button className="explanation-modal-close" onClick={onClose}>
            <CloseIcon size={20} />
          </button>
        </header>

        {isLoading && (
          <div className="explanation-modal-loading">
            <div className="explanation-spinner" />
            <p>Analyzing recommendation...</p>
          </div>
        )}

        {error && (
          <div className="explanation-modal-error">
            <p>{error}</p>
          </div>
        )}

        {explanation && !isLoading && (
          <div className="explanation-modal-content">
            {/* Track Info */}
            <div className="explanation-track-info">
              <div className="explanation-track-artwork">
                {explanation.track.artwork?.medium ? (
                  <img
                    src={explanation.track.artwork.medium}
                    alt={explanation.track.title}
                  />
                ) : (
                  <div className="explanation-track-artwork-placeholder">
                    <MusicNoteIcon size={32} />
                  </div>
                )}
              </div>
              <div className="explanation-track-details">
                <h3 className="explanation-track-title">{explanation.track.title}</h3>
                <p className="explanation-track-artist">
                  {explanation.track.artists.map(a => a.name).join(', ')}
                </p>
              </div>
              <div className="explanation-score-badge">
                <span className="explanation-score-value">{explanation.score}</span>
                <span className="explanation-score-label">match</span>
              </div>
            </div>

            {/* Summary */}
            <div className="explanation-summary">
              <p>{explanation.summary}</p>
            </div>

            {/* Factors */}
            <div className="explanation-factors">
              <h4 className="explanation-factors-title">Scoring Factors</h4>
              <div className="explanation-factors-list">
                {explanation.factors.map((factor) => (
                  <FactorItem key={factor.id} factor={factor} />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

interface FactorItemProps {
  factor: ExplanationFactor;
}

const FactorItem: React.FC<FactorItemProps> = ({ factor }) => {
  const impactClass = `factor-impact-${factor.impact}`;

  return (
    <div className={`explanation-factor ${impactClass}`}>
      <div className="explanation-factor-icon">{factor.icon}</div>
      <div className="explanation-factor-content">
        <div className="explanation-factor-header">
          <span className="explanation-factor-label">{factor.label}</span>
          <span className="explanation-factor-value">{factor.value}%</span>
        </div>
        <div className="explanation-factor-bar">
          <div
            className="explanation-factor-bar-fill"
            style={{ width: `${factor.value}%` }}
          />
        </div>
        <p className="explanation-factor-description">{factor.description}</p>
      </div>
    </div>
  );
};

export default ExplanationModal;
