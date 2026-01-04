/**
 * StackedCardsSection - Overlapping "deck" of cards user can flip through
 * Interactive card stack with swipe/click to reveal next
 */

import React, { useState, useCallback } from 'react';
import type { UnifiedTrack } from '@audiio/core';
import { usePlayerStore } from '../../../stores/player-store';
import { useTrackContextMenu } from '../../../contexts/ContextMenuContext';
import { BaseSectionWrapper, useSectionTracks } from './base/BaseSection';
import type { BaseSectionProps } from '../section-registry';
import { PlayIcon, MusicNoteIcon, ChevronLeftIcon, ChevronRightIcon } from '@audiio/icons';

export interface StackedCardsSectionProps extends BaseSectionProps {
  tracks?: UnifiedTrack[];
  maxCards?: number;
}

export const StackedCardsSection: React.FC<StackedCardsSectionProps> = ({
  id,
  title,
  subtitle,
  query,
  isPersonalized,
  context,
  tracks: propTracks,
  maxCards = 5,
  onSeeAll,
}) => {
  const { play, setQueue, currentTrack, isPlaying } = usePlayerStore();
  const { showContextMenu } = useTrackContextMenu();

  // Use provided tracks or fetch via query
  const { tracks: fetchedTracks, isLoading, error } = useSectionTracks(
    propTracks ? undefined : query,
    { limit: maxCards }
  );

  const tracks = (propTracks ?? fetchedTracks).slice(0, maxCards);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [animationDirection, setAnimationDirection] = useState<'left' | 'right' | null>(null);

  const handleNext = useCallback(() => {
    if (isAnimating || currentIndex >= tracks.length - 1) return;
    setIsAnimating(true);
    setAnimationDirection('left');
    setTimeout(() => {
      setCurrentIndex((prev) => prev + 1);
      setIsAnimating(false);
      setAnimationDirection(null);
    }, 300);
  }, [isAnimating, currentIndex, tracks.length]);

  const handlePrev = useCallback(() => {
    if (isAnimating || currentIndex <= 0) return;
    setIsAnimating(true);
    setAnimationDirection('right');
    setTimeout(() => {
      setCurrentIndex((prev) => prev - 1);
      setIsAnimating(false);
      setAnimationDirection(null);
    }, 300);
  }, [isAnimating, currentIndex]);

  const handleTrackClick = (track: UnifiedTrack) => {
    setQueue(tracks, tracks.indexOf(track));
    play(track);
  };

  if (!isLoading && tracks.length === 0) {
    return null;
  }

  // Visible cards (current + next 2 for stacking effect)
  const visibleCards = tracks.slice(currentIndex, currentIndex + 3);

  return (
    <BaseSectionWrapper
      id={id}
      type="stacked-cards"
      title={title}
      subtitle={subtitle}
      isPersonalized={isPersonalized}
      isLoading={isLoading}
      error={error}
      context={context}
      onSeeAll={onSeeAll}
      className="stacked-cards-section"
    >
      <div className="stacked-cards-container">
        {/* Navigation buttons */}
        <button
          className={`stacked-nav stacked-nav--prev ${currentIndex === 0 ? 'disabled' : ''}`}
          onClick={handlePrev}
          disabled={currentIndex === 0}
        >
          <ChevronLeftIcon size={24} />
        </button>

        {/* Card stack */}
        <div className="stacked-cards-stack">
          {visibleCards.map((track, index) => (
            <StackedCard
              key={track.id}
              track={track}
              stackIndex={index}
              isTop={index === 0}
              isAnimating={isAnimating && index === 0}
              animationDirection={animationDirection}
              isPlaying={currentTrack?.id === track.id && isPlaying}
              onClick={() => index === 0 && handleTrackClick(track)}
              onContextMenu={(e) => index === 0 && showContextMenu(e, track)}
              onSwipeLeft={handleNext}
              onSwipeRight={handlePrev}
            />
          ))}

          {/* Progress indicator */}
          <div className="stacked-cards-progress">
            {tracks.map((_, index) => (
              <span
                key={index}
                className={`progress-dot ${index === currentIndex ? 'active' : ''} ${index < currentIndex ? 'passed' : ''}`}
              />
            ))}
          </div>
        </div>

        {/* Navigation buttons */}
        <button
          className={`stacked-nav stacked-nav--next ${currentIndex >= tracks.length - 1 ? 'disabled' : ''}`}
          onClick={handleNext}
          disabled={currentIndex >= tracks.length - 1}
        >
          <ChevronRightIcon size={24} />
        </button>
      </div>

      {/* Current track info below stack */}
      {tracks[currentIndex] && (
        <div className="stacked-cards-info">
          <span className="stacked-cards-counter">
            {currentIndex + 1} / {tracks.length}
          </span>
        </div>
      )}
    </BaseSectionWrapper>
  );
};

interface StackedCardProps {
  track: UnifiedTrack;
  stackIndex: number;
  isTop: boolean;
  isAnimating: boolean;
  animationDirection: 'left' | 'right' | null;
  isPlaying: boolean;
  onClick: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
}

const StackedCard: React.FC<StackedCardProps> = ({
  track,
  stackIndex,
  isTop,
  isAnimating,
  animationDirection,
  isPlaying,
  onClick,
  onContextMenu,
  onSwipeLeft,
  onSwipeRight,
}) => {
  const [touchStart, setTouchStart] = useState<number | null>(null);

  const artwork = track.artwork?.large ?? track.artwork?.medium;

  // Calculate transform based on stack position
  const scale = 1 - stackIndex * 0.05;
  const translateY = stackIndex * 12;
  const opacity = 1 - stackIndex * 0.2;

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.touches[0].clientX);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStart === null || !isTop) return;
    const touchEnd = e.changedTouches[0].clientX;
    const diff = touchStart - touchEnd;

    if (Math.abs(diff) > 50) {
      if (diff > 0) {
        onSwipeLeft();
      } else {
        onSwipeRight();
      }
    }
    setTouchStart(null);
  };

  let animationClass = '';
  if (isAnimating && isTop) {
    animationClass = animationDirection === 'left' ? 'swipe-left' : 'swipe-right';
  }

  return (
    <div
      className={`stacked-card ${isTop ? 'top' : ''} ${isPlaying ? 'playing' : ''} ${animationClass}`}
      style={{
        transform: `translateY(${translateY}px) scale(${scale})`,
        opacity,
        zIndex: 10 - stackIndex,
      }}
      onClick={isTop ? onClick : undefined}
      onContextMenu={isTop ? onContextMenu : undefined}
      onTouchStart={isTop ? handleTouchStart : undefined}
      onTouchEnd={isTop ? handleTouchEnd : undefined}
    >
      <div className="stacked-card-artwork">
        {artwork ? (
          <img src={artwork} alt={track.title} />
        ) : (
          <div className="stacked-card-placeholder">
            <MusicNoteIcon size={64} />
          </div>
        )}

        {isTop && (
          <div className="stacked-card-overlay">
            <button className="stacked-card-play">
              <PlayIcon size={40} />
            </button>
          </div>
        )}

        {isPlaying && (
          <div className="stacked-card-playing">
            <span className="playing-bar" />
            <span className="playing-bar" />
            <span className="playing-bar" />
          </div>
        )}
      </div>

      <div className="stacked-card-info">
        <h3 className="stacked-card-title">{track.title}</h3>
        <p className="stacked-card-artist">
          {track.artists.map((a) => a.name).join(', ')}
        </p>
      </div>
    </div>
  );
};

export default StackedCardsSection;
