/**
 * Import Progress Component
 * Shows import progress with animated indicator
 */

import React from 'react';
import type { ImportPhase } from '../stores/sposify-store';

interface ImportProgressProps {
  phase: ImportPhase;
  progress: number;
  error: string | null;
}

const phaseLabels: Record<ImportPhase, string> = {
  idle: 'Ready',
  selecting: 'Selecting files...',
  parsing: 'Parsing export files...',
  matching: 'Matching tracks...',
  previewing: 'Preparing preview...',
  importing: 'Importing data...',
  complete: 'Complete!',
  error: 'Error',
};

export const ImportProgress: React.FC<ImportProgressProps> = ({
  phase,
  progress,
  error,
}) => {
  const percentage = Math.round(progress * 100);

  if (error) {
    return (
      <div className="sposify-progress error">
        <div className="progress-icon error">✕</div>
        <h3>Import Failed</h3>
        <p className="error-message">{error}</p>
      </div>
    );
  }

  if (phase === 'complete') {
    return (
      <div className="sposify-progress complete">
        <div className="progress-icon success">✓</div>
        <h3>Import Complete!</h3>
      </div>
    );
  }

  return (
    <div className="sposify-progress active">
      <div className="progress-spinner">
        <div className="spinner"></div>
      </div>
      <h3>{phaseLabels[phase]}</h3>
      <div className="progress-bar-container">
        <div
          className="progress-bar-fill"
          style={{ width: `${percentage}%` }}
        />
      </div>
      <span className="progress-percentage">{percentage}%</span>
    </div>
  );
};

export default ImportProgress;
