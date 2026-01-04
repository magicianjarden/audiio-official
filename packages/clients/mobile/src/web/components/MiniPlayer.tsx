/**
 * MiniPlayer - Compact player bar with swipe gestures
 *
 * Gestures:
 * - Swipe left: Next track
 * - Swipe right: Previous track
 * - Swipe up: Open full player
 * - Tap: Open full player
 */

import React, { useRef, useState, useCallback } from 'react';
import { usePlaybackState, usePlaybackControls } from '../stores/player-store';
import { getTrackArtwork } from '../utils/artwork';
import { PlayIcon, PauseIcon, MusicNoteIcon, NextIcon, PrevIcon } from '@audiio/icons';
import { triggerHaptic } from '../utils/haptics';
import styles from './MiniPlayer.module.css';

// Swipe threshold in pixels
const SWIPE_THRESHOLD = 50;
const SWIPE_VELOCITY_THRESHOLD = 0.3;

interface MiniPlayerProps {
  onExpand?: () => void;
}

interface TouchState {
  startX: number;
  startY: number;
  startTime: number;
  currentX: number;
  currentY: number;
  isSwiping: boolean;
}

export function MiniPlayer({ onExpand }: MiniPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [touchState, setTouchState] = useState<TouchState | null>(null);
  const [swipeDirection, setSwipeDirection] = useState<'left' | 'right' | null>(null);
  const [translateX, setTranslateX] = useState(0);

  // Use fine-grained selectors for performance
  const { currentTrack, isPlaying, isBuffering, position, duration } = usePlaybackState();
  const { pause, resume, nextTrack, previousTrack } = usePlaybackControls();

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    if (!touch) return;
    setTouchState({
      startX: touch.clientX,
      startY: touch.clientY,
      startTime: Date.now(),
      currentX: touch.clientX,
      currentY: touch.clientY,
      isSwiping: false,
    });
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!touchState) return;

    const touch = e.touches[0];
    if (!touch) return;
    const deltaX = touch.clientX - touchState.startX;
    const deltaY = touch.clientY - touchState.startY;

    // Determine if this is a horizontal swipe
    if (!touchState.isSwiping && Math.abs(deltaX) > 10) {
      // Only allow horizontal swipe if it's more horizontal than vertical
      if (Math.abs(deltaX) > Math.abs(deltaY)) {
        setTouchState({ ...touchState, isSwiping: true });
      }
    }

    if (touchState.isSwiping || Math.abs(deltaX) > Math.abs(deltaY)) {
      // Prevent default to avoid scrolling
      e.preventDefault();

      // Apply resistance at edges
      const resistance = 0.4;
      const resistedDelta = deltaX * resistance;

      setTranslateX(resistedDelta);
      setSwipeDirection(deltaX < 0 ? 'left' : 'right');
    }

    setTouchState({
      ...touchState,
      currentX: touch.clientX,
      currentY: touch.clientY,
    });
  }, [touchState]);

  const handleTouchEnd = useCallback(() => {
    if (!touchState) return;

    const deltaX = touchState.currentX - touchState.startX;
    const deltaY = touchState.currentY - touchState.startY;
    const deltaTime = Date.now() - touchState.startTime;
    const velocity = Math.abs(deltaX) / deltaTime;

    // Check for swipe up (open full player)
    if (deltaY < -SWIPE_THRESHOLD && Math.abs(deltaY) > Math.abs(deltaX)) {
      triggerHaptic('light');
      onExpand?.();
    }
    // Check for horizontal swipe
    else if (Math.abs(deltaX) > SWIPE_THRESHOLD || velocity > SWIPE_VELOCITY_THRESHOLD) {
      if (deltaX < 0) {
        // Swipe left - next track
        triggerHaptic('medium');
        nextTrack();
      } else {
        // Swipe right - previous track
        triggerHaptic('medium');
        previousTrack();
      }
    }

    // Reset state
    setTouchState(null);
    setTranslateX(0);
    setSwipeDirection(null);
  }, [touchState, onExpand, nextTrack, previousTrack]);

  if (!currentTrack) return null;

  const progress = duration > 0 ? (position / duration) * 100 : 0;
  const artistName = currentTrack.artists?.[0]?.name || 'Unknown Artist';
  const artwork = getTrackArtwork(currentTrack, 'small');

  const handlePlayPause = (e: React.MouseEvent) => {
    e.stopPropagation();
    triggerHaptic('light');
    if (isPlaying) {
      pause();
    } else {
      resume();
    }
  };

  const handleClick = () => {
    // Only expand if not swiping
    if (!touchState?.isSwiping && Math.abs(translateX) < 10) {
      onExpand?.();
    }
  };

  return (
    <div
      ref={containerRef}
      className={styles.container}
      onClick={handleClick}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{
        transform: `translateX(${translateX}px)`,
        transition: touchState ? 'none' : 'transform 0.3s ease-out',
      }}
    >
      <div className={styles.progress} style={{ width: `${progress}%` }} />

      {/* Swipe indicators */}
      {swipeDirection === 'left' && (
        <div className={`${styles.swipeIndicator} ${styles.swipeLeft}`}>
          <NextIcon size={20} />
        </div>
      )}
      {swipeDirection === 'right' && (
        <div className={`${styles.swipeIndicator} ${styles.swipeRight}`}>
          <PrevIcon size={20} />
        </div>
      )}

      <div className={styles.content}>
        <div className={styles.artwork}>
          {artwork ? (
            <img src={artwork} alt={currentTrack.title} />
          ) : (
            <div className={styles.artworkPlaceholder}>
              <MusicNoteIcon size={20} />
            </div>
          )}
          {isPlaying && <div className={styles.playingIndicator} />}
        </div>

        <div className={styles.info}>
          <span className={styles.title}>{currentTrack.title}</span>
          <span className={styles.artist}>{artistName}</span>
        </div>

        <button
          className={styles.playButton}
          onClick={handlePlayPause}
          disabled={isBuffering}
          aria-label={isPlaying ? 'Pause' : 'Play'}
        >
          {isBuffering ? (
            <div className={styles.spinner} />
          ) : isPlaying ? (
            <PauseIcon size={24} />
          ) : (
            <PlayIcon size={24} />
          )}
        </button>
      </div>
    </div>
  );
}
