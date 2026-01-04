/**
 * CreditsModal - Display album production credits
 */

import React from 'react';
import { CloseIcon } from '@audiio/icons';
import type { AlbumCredits } from '@audiio/core';

interface CreditsModalProps {
  credits: AlbumCredits;
  albumTitle: string;
  onClose: () => void;
}

export const CreditsModal: React.FC<CreditsModalProps> = ({
  credits,
  albumTitle,
  onClose
}) => {
  // Handle backdrop click
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  // Handle escape key
  React.useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  // Build credit sections from the AlbumCredits structure
  const creditSections: Array<{ role: string; names: string[] }> = [];

  if (credits.producers && credits.producers.length > 0) {
    creditSections.push({ role: 'Producers', names: credits.producers });
  }
  if (credits.writers && credits.writers.length > 0) {
    creditSections.push({ role: 'Writers', names: credits.writers });
  }
  if (credits.engineers && credits.engineers.length > 0) {
    creditSections.push({ role: 'Engineers', names: credits.engineers });
  }
  if (credits.label) {
    creditSections.push({ role: 'Label', names: [credits.label] });
  }
  if (credits.copyright) {
    creditSections.push({ role: 'Copyright', names: [credits.copyright] });
  }

  return (
    <div className="modal-overlay" onClick={handleBackdropClick}>
      <div className="modal credits-modal">
        <div className="modal-header">
          <h2>Credits</h2>
          <p className="modal-subtitle">{albumTitle}</p>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            <CloseIcon size={20} />
          </button>
        </div>

        <div className="modal-content">
          {creditSections.map(({ role, names }) => (
            <div key={role} className="credit-group">
              <h3 className="credit-role">{role}</h3>
              <ul className="credit-names">
                {names.map((name, index) => (
                  <li key={`${role}-${index}`} className="credit-name">{name}</li>
                ))}
              </ul>
            </div>
          ))}

          {creditSections.length === 0 && (
            <p className="credits-empty">No credits available</p>
          )}
        </div>

        <div className="modal-footer">
          <button className="modal-button secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreditsModal;
