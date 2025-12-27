/**
 * SwipeableRow - Swipe-to-reveal actions component
 *
 * Features:
 * - Swipe left to reveal actions
 * - Smooth CSS transitions
 * - Haptic feedback
 * - Auto-close on action
 */

import React, { useRef, useState, useCallback } from 'react';
import { triggerHaptic } from '../utils/haptics';
import styles from './SwipeableRow.module.css';

export interface SwipeAction {
  key: string;
  icon: React.ReactNode;
  label: string;
  color: string;
  backgroundColor: string;
  onAction: () => void;
}

interface SwipeableRowProps {
  children: React.ReactNode;
  /** Actions revealed when swiping left */
  leftActions?: SwipeAction[];
  /** Actions revealed when swiping right */
  rightActions?: SwipeAction[];
  /** Callback when row is swiped fully */
  onFullSwipeLeft?: () => void;
  onFullSwipeRight?: () => void;
  /** Whether the row is disabled */
  disabled?: boolean;
}

const ACTION_WIDTH = 72;

export function SwipeableRow({
  children,
  leftActions = [],
  rightActions = [],
  onFullSwipeLeft,
  onFullSwipeRight,
  disabled = false,
}: SwipeableRowProps) {
  const rowRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState(0);
  const [startX, setStartX] = useState<number | null>(null);
  const [startY, setStartY] = useState<number | null>(null);
  const [isHorizontalSwipe, setIsHorizontalSwipe] = useState<boolean | null>(null);
  const [revealedSide, setRevealedSide] = useState<'left' | 'right' | null>(null);

  const maxLeftSwipe = leftActions.length * ACTION_WIDTH;
  const maxRightSwipe = rightActions.length * ACTION_WIDTH;

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (disabled) return;

    const touch = e.touches[0];
    setStartX(touch.clientX);
    setStartY(touch.clientY);
    setIsHorizontalSwipe(null);
  }, [disabled]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (disabled || startX === null || startY === null) return;

    const touch = e.touches[0];
    const deltaX = touch.clientX - startX;
    const deltaY = touch.clientY - startY;

    // Determine swipe direction on first significant movement
    if (isHorizontalSwipe === null) {
      if (Math.abs(deltaX) > 10 || Math.abs(deltaY) > 10) {
        const isHorizontal = Math.abs(deltaX) > Math.abs(deltaY);
        setIsHorizontalSwipe(isHorizontal);
        if (!isHorizontal) return;
      } else {
        return;
      }
    }

    if (!isHorizontalSwipe) return;

    // Prevent vertical scroll when swiping horizontally
    e.preventDefault();

    // Calculate bounded swipe position
    let newPosition = deltaX;

    // Swiping left (revealing right actions)
    if (deltaX < 0) {
      if (rightActions.length === 0) {
        newPosition = deltaX * 0.2;
      } else if (Math.abs(deltaX) > maxRightSwipe) {
        const overSwipe = Math.abs(deltaX) - maxRightSwipe;
        newPosition = -(maxRightSwipe + overSwipe * 0.2);
      }
      setRevealedSide('right');
    }
    // Swiping right (revealing left actions)
    else if (deltaX > 0) {
      if (leftActions.length === 0) {
        newPosition = deltaX * 0.2;
      } else if (deltaX > maxLeftSwipe) {
        const overSwipe = deltaX - maxLeftSwipe;
        newPosition = maxLeftSwipe + overSwipe * 0.2;
      }
      setRevealedSide('left');
    }

    setPosition(newPosition);
  }, [disabled, startX, startY, isHorizontalSwipe, leftActions, rightActions, maxLeftSwipe, maxRightSwipe]);

  const handleTouchEnd = useCallback(() => {
    if (disabled || startX === null) return;

    // Snap to reveal position or close
    if (position < -maxRightSwipe * 0.4) {
      setPosition(-maxRightSwipe);
    } else if (position > maxLeftSwipe * 0.4) {
      setPosition(maxLeftSwipe);
    } else {
      setPosition(0);
      setRevealedSide(null);
    }

    setStartX(null);
    setStartY(null);
    setIsHorizontalSwipe(null);
  }, [disabled, startX, position, maxLeftSwipe, maxRightSwipe]);

  const handleActionClick = useCallback((action: SwipeAction) => {
    triggerHaptic('light');
    action.onAction();
    setPosition(0);
    setRevealedSide(null);
  }, []);

  // Close when clicking the row (if revealed)
  const handleRowClick = useCallback(() => {
    if (position !== 0) {
      setPosition(0);
      setRevealedSide(null);
    }
  }, [position]);

  const rightProgress = Math.min(Math.abs(position) / maxRightSwipe, 1);
  const leftProgress = Math.min(position / maxLeftSwipe, 1);

  return (
    <div className={styles.container}>
      {/* Left actions (revealed when swiping right) */}
      {leftActions.length > 0 && (
        <div className={styles.actionsLeft}>
          {leftActions.map((action, index) => (
            <button
              key={action.key}
              className={styles.action}
              style={{
                backgroundColor: action.backgroundColor,
                color: action.color,
                transform: `translateX(${Math.min(0, position - (index + 1) * ACTION_WIDTH)}px)`,
                opacity: leftProgress,
              }}
              onClick={() => handleActionClick(action)}
            >
              {action.icon}
              <span className={styles.actionLabel}>{action.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* Right actions (revealed when swiping left) */}
      {rightActions.length > 0 && (
        <div className={styles.actionsRight}>
          {rightActions.map((action, index) => (
            <button
              key={action.key}
              className={styles.action}
              style={{
                backgroundColor: action.backgroundColor,
                color: action.color,
                transform: `translateX(${Math.max(0, position + (index + 1) * ACTION_WIDTH)}px)`,
                opacity: rightProgress,
              }}
              onClick={() => handleActionClick(action)}
            >
              {action.icon}
              <span className={styles.actionLabel}>{action.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* Row content */}
      <div
        ref={rowRef}
        className={styles.row}
        style={{
          transform: `translateX(${position}px)`,
          transition: startX === null ? 'transform 0.25s ease-out' : 'none',
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={handleRowClick}
      >
        {children}
      </div>
    </div>
  );
}
