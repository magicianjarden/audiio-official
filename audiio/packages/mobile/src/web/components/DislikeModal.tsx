/**
 * DislikeModal - Bottom sheet for selecting dislike reasons
 */

import React, { useState } from 'react';
import { ThumbDownIcon, CloseIcon } from './Icons';
import { DISLIKE_REASONS, type DislikeReason } from '../stores/library-store';
import styles from './DislikeModal.module.css';

interface DislikeModalProps {
  isOpen: boolean;
  trackTitle: string;
  trackArtist: string;
  onSubmit: (reasons: DislikeReason[]) => void;
  onClose: () => void;
}

export function DislikeModal({
  isOpen,
  trackTitle,
  trackArtist,
  onSubmit,
  onClose
}: DislikeModalProps) {
  const [selectedReasons, setSelectedReasons] = useState<DislikeReason[]>([]);

  if (!isOpen) return null;

  const toggleReason = (reasonId: DislikeReason) => {
    setSelectedReasons(prev =>
      prev.includes(reasonId)
        ? prev.filter(r => r !== reasonId)
        : [...prev, reasonId]
    );
  };

  const handleSubmit = () => {
    onSubmit(selectedReasons);
    setSelectedReasons([]);
  };

  const handleClose = () => {
    setSelectedReasons([]);
    onClose();
  };

  return (
    <div className={styles.overlay} onClick={handleClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* Handle for drag */}
        <div className={styles.handle} />

        {/* Header */}
        <div className={styles.header}>
          <div className={styles.iconContainer}>
            <ThumbDownIcon size={24} />
          </div>
          <div className={styles.headerText}>
            <h2 className={styles.title}>Not for me</h2>
            <p className={styles.subtitle}>
              <span className={styles.trackTitle}>{trackTitle}</span>
              {' by '}
              <span className={styles.trackArtist}>{trackArtist}</span>
            </p>
          </div>
          <button className={styles.closeButton} onClick={handleClose}>
            <CloseIcon size={20} />
          </button>
        </div>

        {/* Reasons */}
        <div className={styles.reasons}>
          <p className={styles.reasonsLabel}>Why don't you like this? (optional)</p>
          <div className={styles.reasonsList}>
            {DISLIKE_REASONS.map((reason) => (
              <button
                key={reason.id}
                className={`${styles.reasonPill} ${
                  selectedReasons.includes(reason.id) ? styles.selected : ''
                }`}
                onClick={() => toggleReason(reason.id)}
              >
                {reason.label}
              </button>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className={styles.actions}>
          <button className={styles.skipButton} onClick={handleSubmit}>
            Skip this track
          </button>
          <p className={styles.hint}>
            We'll use this to improve your recommendations
          </p>
        </div>
      </div>
    </div>
  );
}
