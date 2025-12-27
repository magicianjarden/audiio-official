/**
 * RecommendationExplanation - Provider component for recommendation explanations
 *
 * Wrap your app with this to enable the "Why?" explanation feature.
 * Use the context to show explanations for any track.
 */

import React, { createContext, useContext, useCallback, useState } from 'react';
import type { UnifiedTrack } from '@audiio/core';
import { useRecommendationExplanation, type TrackExplanation } from '../../hooks/useRecommendationExplanation';
import { ExplanationModal } from './ExplanationModal';

interface ExplanationContextValue {
  showExplanation: (track: UnifiedTrack) => void;
  hideExplanation: () => void;
  isVisible: boolean;
  currentTrack: UnifiedTrack | null;
}

const ExplanationContext = createContext<ExplanationContextValue | null>(null);

export function useExplanationContext() {
  const context = useContext(ExplanationContext);
  if (!context) {
    throw new Error('useExplanationContext must be used within RecommendationExplanationProvider');
  }
  return context;
}

interface RecommendationExplanationProviderProps {
  children: React.ReactNode;
}

export const RecommendationExplanationProvider: React.FC<RecommendationExplanationProviderProps> = ({
  children,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [currentTrack, setCurrentTrack] = useState<UnifiedTrack | null>(null);

  const {
    explanation,
    isLoading,
    error,
    fetchExplanation,
    clearExplanation,
  } = useRecommendationExplanation();

  const showExplanation = useCallback(async (track: UnifiedTrack) => {
    setCurrentTrack(track);
    setIsVisible(true);
    await fetchExplanation(track);
  }, [fetchExplanation]);

  const hideExplanation = useCallback(() => {
    setIsVisible(false);
    setCurrentTrack(null);
    clearExplanation();
  }, [clearExplanation]);

  const contextValue: ExplanationContextValue = {
    showExplanation,
    hideExplanation,
    isVisible,
    currentTrack,
  };

  return (
    <ExplanationContext.Provider value={contextValue}>
      {children}
      {isVisible && (
        <ExplanationModal
          explanation={explanation}
          isLoading={isLoading}
          error={error}
          onClose={hideExplanation}
        />
      )}
    </ExplanationContext.Provider>
  );
};

/**
 * WhyButton - A button that shows the explanation modal for a track
 */
interface WhyButtonProps {
  track: UnifiedTrack;
  className?: string;
  size?: 'small' | 'medium';
}

export const WhyButton: React.FC<WhyButtonProps> = ({
  track,
  className = '',
  size = 'small',
}) => {
  const { showExplanation } = useExplanationContext();

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    showExplanation(track);
  };

  return (
    <button
      className={`why-button why-button-${size} ${className}`}
      onClick={handleClick}
      title="Why was this recommended?"
    >
      ?
    </button>
  );
};

export { ExplanationModal };
export type { TrackExplanation, ExplanationContextValue };
