/**
 * Playback Icons - Modern, rounded design
 * Play, Pause, Next, Prev, Shuffle, Repeat, Queue
 */

import React from 'react';
import type { IconProps } from '../types';

// ============================================
// Play Icons
// ============================================

export const PlayIcon: React.FC<IconProps> = ({ size = 24, className, ...props }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
    {...props}
  >
    <path d="M8 6.82v10.36c0 .79.87 1.27 1.54.84l8.14-5.18a1 1 0 0 0 0-1.68L9.54 5.98A1 1 0 0 0 8 6.82Z" />
  </svg>
);

export const PlayOutlineIcon: React.FC<IconProps> = ({ size = 24, className, ...props }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    {...props}
  >
    <polygon points="6 3 20 12 6 21 6 3" />
  </svg>
);

// ============================================
// Pause Icons
// ============================================

export const PauseIcon: React.FC<IconProps> = ({ size = 24, className, ...props }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
    {...props}
  >
    <rect x="6" y="4" width="4" height="16" rx="1" />
    <rect x="14" y="4" width="4" height="16" rx="1" />
  </svg>
);

export const PauseOutlineIcon: React.FC<IconProps> = ({ size = 24, className, ...props }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    {...props}
  >
    <rect x="6" y="4" width="4" height="16" rx="1" />
    <rect x="14" y="4" width="4" height="16" rx="1" />
  </svg>
);

// ============================================
// Skip Icons
// ============================================

export const NextIcon: React.FC<IconProps> = ({ size = 24, className, ...props }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
    {...props}
  >
    <path d="M6 6.82v10.36c0 .79.87 1.27 1.54.84l6.46-4.11V17a1 1 0 0 0 1 1h1a1 1 0 0 0 1-1V7a1 1 0 0 0-1-1h-1a1 1 0 0 0-1 1v3.09L7.54 5.98A1 1 0 0 0 6 6.82Z" />
  </svg>
);

export const PrevIcon: React.FC<IconProps> = ({ size = 24, className, ...props }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
    {...props}
  >
    <path d="M18 6.82v10.36c0 .79-.87 1.27-1.54.84L10 13.91V17a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h1a1 1 0 0 1 1 1v3.09l6.46-4.11A1 1 0 0 1 18 6.82Z" />
  </svg>
);

export const SkipForwardIcon: React.FC<IconProps> = ({ size = 24, className, ...props }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
    {...props}
  >
    <path d="M4 6.82v10.36c0 .79.87 1.27 1.54.84l5.46-3.47v3.27c0 .79.87 1.27 1.54.84l6.92-4.41a1 1 0 0 0 0-1.7l-6.92-4.41A1 1 0 0 0 11 8.98v3.27L5.54 8.78A1 1 0 0 0 4 6.82Z" />
  </svg>
);

export const SkipBackIcon: React.FC<IconProps> = ({ size = 24, className, ...props }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
    {...props}
  >
    <path d="M20 6.82v10.36c0 .79-.87 1.27-1.54.84L13 14.55v3.27c0 .79-.87 1.27-1.54.84L4.54 14.25a1 1 0 0 1 0-1.7l6.92-4.41A1 1 0 0 1 13 8.98v3.27l5.46-3.47A1 1 0 0 1 20 6.82Z" />
  </svg>
);

// ============================================
// Shuffle Icon
// ============================================

export const ShuffleIcon: React.FC<IconProps> = ({ size = 24, className, ...props }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    {...props}
  >
    <path d="M16 3h5v5" />
    <path d="M4 20 21 3" />
    <path d="M21 16v5h-5" />
    <path d="M15 15 21 21" />
    <path d="M4 4l5 5" />
  </svg>
);

// ============================================
// Repeat Icons
// ============================================

export const RepeatIcon: React.FC<IconProps> = ({ size = 24, className, ...props }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    {...props}
  >
    <path d="M17 2l4 4-4 4" />
    <path d="M3 11v-1a4 4 0 0 1 4-4h14" />
    <path d="M7 22l-4-4 4-4" />
    <path d="M21 13v1a4 4 0 0 1-4 4H3" />
  </svg>
);

export const RepeatOneIcon: React.FC<IconProps> = ({ size = 24, className, ...props }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    {...props}
  >
    <path d="M17 2l4 4-4 4" />
    <path d="M3 11v-1a4 4 0 0 1 4-4h14" />
    <path d="M7 22l-4-4 4-4" />
    <path d="M21 13v1a4 4 0 0 1-4 4H3" />
    <text x="11" y="15" fontSize="8" fill="currentColor" fontWeight="bold" stroke="none">1</text>
  </svg>
);

// ============================================
// Queue Icon
// ============================================

export const QueueIcon: React.FC<IconProps> = ({ size = 24, className, ...props }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    {...props}
  >
    <line x1="3" y1="6" x2="17" y2="6" />
    <line x1="3" y1="12" x2="13" y2="12" />
    <line x1="3" y1="18" x2="10" y2="18" />
    <polygon points="16 13 21 16 16 19" fill="currentColor" stroke="none" />
  </svg>
);

// ============================================
// Stop Icon
// ============================================

export const StopIcon: React.FC<IconProps> = ({ size = 24, className, ...props }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
    {...props}
  >
    <rect x="6" y="6" width="12" height="12" rx="2" />
  </svg>
);
