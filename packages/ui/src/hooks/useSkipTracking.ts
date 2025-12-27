/**
 * Skip Tracking Hook
 * Detects and records skip events when user changes tracks before completion
 */

import { useEffect, useRef, useCallback } from 'react';
import { usePlayerStore } from '../stores/player-store';
import { useRecommendationStore } from '../stores/recommendation-store';

// Threshold for considering a track "completed" (80%)
const COMPLETION_THRESHOLD = 0.80;

// Minimum position to consider a skip (avoid false positives from track changes at start)
const MIN_SKIP_POSITION_MS = 1000; // 1 second

interface SkipTrackingOptions {
  enabled?: boolean;
  onSkip?: (trackId: string, skipPercentage: number, earlySkip: boolean) => void;
}

/**
 * Hook to track when users skip tracks
 * Records skip events to the recommendation store for ML training
 */
export function useSkipTracking(options: SkipTrackingOptions = {}): void {
  const { enabled = true, onSkip } = options;

  const {
    currentTrack,
    position,
    duration,
    isPlaying,
  } = usePlayerStore();

  const { recordSkip } = useRecommendationStore();

  // Track previous state to detect changes
  const prevTrackRef = useRef<{
    id: string;
    position: number;
    duration: number;
    wasPlaying: boolean;
  } | null>(null);

  // Record skip event
  const handleSkip = useCallback((
    trackId: string,
    skipPosition: number,
    skipDuration: number
  ) => {
    if (!enabled) return;
    if (skipPosition < MIN_SKIP_POSITION_MS) return; // Too early, might be loading
    if (skipDuration <= 0) return;

    const skipPercentage = skipPosition / skipDuration;

    // Don't record if track was nearly complete
    if (skipPercentage >= COMPLETION_THRESHOLD) return;

    const earlySkip = skipPercentage < 0.25; // Less than 25%

    // Record to recommendation store
    recordSkip(trackId, {
      skipPosition: Math.floor(skipPosition / 1000), // Convert to seconds
      skipPercentage,
      earlySkip,
    });

    // Call optional callback
    onSkip?.(trackId, skipPercentage, earlySkip);

    console.debug('[SkipTracking] Recorded skip:', {
      trackId,
      skipPercentage: `${(skipPercentage * 100).toFixed(1)}%`,
      earlySkip,
    });
  }, [enabled, recordSkip, onSkip]);

  // Detect track changes
  useEffect(() => {
    const prev = prevTrackRef.current;

    // Track changed
    if (prev && currentTrack && prev.id !== currentTrack.id) {
      // Previous track was playing and wasn't completed
      if (prev.wasPlaying && prev.duration > 0) {
        handleSkip(prev.id, prev.position, prev.duration);
      }
    }

    // Update ref with current state
    if (currentTrack) {
      prevTrackRef.current = {
        id: currentTrack.id,
        position,
        duration,
        wasPlaying: isPlaying,
      };
    } else {
      prevTrackRef.current = null;
    }
  }, [currentTrack?.id, position, duration, isPlaying, handleSkip]);

  // Handle component unmount - record skip if track was playing
  useEffect(() => {
    return () => {
      const prev = prevTrackRef.current;
      if (prev && prev.wasPlaying && prev.duration > 0) {
        const skipPercentage = prev.position / prev.duration;
        if (skipPercentage < COMPLETION_THRESHOLD && prev.position >= MIN_SKIP_POSITION_MS) {
          // Note: This won't actually record since component is unmounting,
          // but it's here for completeness. In practice, navigation changes
          // will trigger the track change detection above.
          console.debug('[SkipTracking] Component unmounting with incomplete track');
        }
      }
    };
  }, []);
}

/**
 * SkipTrackingManager component
 * Add to App to enable skip tracking globally
 */
export const SkipTrackingManager: React.FC = () => {
  useSkipTracking({ enabled: true });
  return null;
};
