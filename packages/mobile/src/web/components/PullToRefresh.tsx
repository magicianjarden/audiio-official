/**
 * PullToRefresh - Native-feeling pull-to-refresh
 *
 * Features:
 * - Rubber band resistance effect
 * - Haptic feedback at threshold
 * - Loading spinner with smooth transitions
 */

import React, { useRef, useState, useCallback } from 'react';
import { triggerHaptic } from '../utils/haptics';
import styles from './PullToRefresh.module.css';

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: React.ReactNode;
  /** Pull distance to trigger refresh (default: 80) */
  threshold?: number;
  /** Whether refresh is disabled */
  disabled?: boolean;
}

// Rubber band resistance curve (iOS-like)
function rubberBand(distance: number, dimension: number, coeff: number = 0.55): number {
  return (1 - (1 / ((distance * coeff / dimension) + 1))) * dimension;
}

export function PullToRefresh({
  onRefresh,
  children,
  threshold = 80,
  disabled = false
}: PullToRefreshProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [startY, setStartY] = useState<number | null>(null);
  const [canPull, setCanPull] = useState(false);
  const crossedThresholdRef = useRef(false);

  // Check if at top of scroll
  const checkScrollTop = useCallback(() => {
    if (containerRef.current) {
      return containerRef.current.scrollTop <= 0;
    }
    return true;
  }, []);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (disabled || isRefreshing) return;

    if (checkScrollTop()) {
      setStartY(e.touches[0].clientY);
      setCanPull(true);
      crossedThresholdRef.current = false;
    }
  }, [disabled, isRefreshing, checkScrollTop]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!canPull || startY === null || disabled || isRefreshing) return;

    const currentY = e.touches[0].clientY;
    const delta = currentY - startY;

    // Only pull down, not up
    if (delta > 0) {
      // Apply rubber band resistance for natural feel
      const maxPull = threshold * 2;
      const resistedDelta = rubberBand(delta, maxPull, 0.55);

      // Haptic feedback when crossing threshold
      if (resistedDelta >= threshold && !crossedThresholdRef.current) {
        triggerHaptic('medium');
        crossedThresholdRef.current = true;
      } else if (resistedDelta < threshold && crossedThresholdRef.current) {
        triggerHaptic('light');
        crossedThresholdRef.current = false;
      }

      setPullDistance(resistedDelta);
    }
  }, [canPull, startY, disabled, isRefreshing, threshold]);

  const handleTouchEnd = useCallback(async () => {
    if (!canPull || disabled) return;

    if (pullDistance >= threshold && !isRefreshing) {
      setIsRefreshing(true);
      triggerHaptic('light');
      setPullDistance(threshold * 0.6);

      try {
        await onRefresh();
      } finally {
        setIsRefreshing(false);
        setPullDistance(0);
      }
    } else {
      setPullDistance(0);
    }

    setStartY(null);
    setCanPull(false);
    crossedThresholdRef.current = false;
  }, [canPull, disabled, pullDistance, threshold, isRefreshing, onRefresh]);

  const progress = Math.min(pullDistance / threshold, 1);
  const showIndicator = pullDistance > 10 || isRefreshing;

  return (
    <div
      ref={containerRef}
      className={styles.container}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Pull indicator */}
      <div
        className={`${styles.indicator} ${showIndicator ? styles.visible : ''}`}
        style={{
          transform: `translateY(${pullDistance - 40}px)`,
          opacity: isRefreshing ? 1 : progress,
        }}
      >
        <div
          className={`${styles.spinner} ${isRefreshing ? styles.spinning : ''}`}
          style={{
            transform: isRefreshing ? 'none' : `rotate(${progress * 360}deg)`,
          }}
        >
          <RefreshIcon />
        </div>
      </div>

      {/* Content with pull transform */}
      <div
        className={styles.content}
        style={{
          transform: `translateY(${pullDistance}px)`,
          transition: startY === null ? 'transform 0.3s ease-out' : 'none',
        }}
      >
        {children}
      </div>
    </div>
  );
}

function RefreshIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.65 6.35A7.958 7.958 0 0012 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0112 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/>
    </svg>
  );
}
