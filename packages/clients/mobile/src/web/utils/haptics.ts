/**
 * Haptic Feedback Utilities
 *
 * Provides tactile feedback for user interactions.
 * Uses the Vibration API where available.
 */

export type HapticType = 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error';

// Vibration patterns for different feedback types (in milliseconds)
const HAPTIC_PATTERNS: Record<HapticType, number | number[]> = {
  light: 10,
  medium: 25,
  heavy: 50,
  success: [10, 50, 30], // Short-pause-long
  warning: [25, 25, 25], // Three quick pulses
  error: [50, 100, 50],  // Long-pause-long
};

/**
 * Trigger haptic feedback
 * @param type - The type of haptic feedback
 */
export function triggerHaptic(type: HapticType = 'light'): void {
  // Check if vibration API is available
  if (!('vibrate' in navigator)) {
    return;
  }

  try {
    const pattern = HAPTIC_PATTERNS[type];
    navigator.vibrate(pattern);
  } catch {
    // Silently fail if vibration is not supported
  }
}

/**
 * Check if haptic feedback is supported
 */
export function isHapticSupported(): boolean {
  return 'vibrate' in navigator;
}

/**
 * Cancel any ongoing haptic feedback
 */
export function cancelHaptic(): void {
  if ('vibrate' in navigator) {
    navigator.vibrate(0);
  }
}
