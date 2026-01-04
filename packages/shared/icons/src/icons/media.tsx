/**
 * Media Icons - Modern, rounded design
 * MusicNote, Lyrics, Playlist, Album, Artist, Radio, Volume, Mic
 */

import React from 'react';
import type { IconProps } from '../types';

// ============================================
// Music Note Icons
// ============================================

export const MusicNoteIcon: React.FC<IconProps> = ({ size = 24, className, ...props }) => (
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
    <path d="M9 18V5l12-2v13" />
    <circle cx="6" cy="18" r="3" />
    <circle cx="18" cy="16" r="3" />
  </svg>
);

export const MusicNote2Icon: React.FC<IconProps> = ({ size = 24, className, ...props }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
    {...props}
  >
    <path d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6Z" />
  </svg>
);

// ============================================
// Lyrics Icons
// ============================================

export const LyricsIcon: React.FC<IconProps> = ({ size = 24, className, ...props }) => (
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
    <path d="M4 6h16" />
    <path d="M4 10h12" />
    <path d="M4 14h8" />
    <path d="M4 18h10" />
    <circle cx="18" cy="16" r="3" />
    <path d="M21 13v6" />
  </svg>
);

// Plain Lyrics Icon - Text lines only (no music note, for static/unsynced view)
export const PlainLyricsIcon: React.FC<IconProps> = ({ size = 24, className, ...props }) => (
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
    <path d="M4 6h16" />
    <path d="M4 10h16" />
    <path d="M4 14h16" />
    <path d="M4 18h12" />
  </svg>
);

// Synced Lyrics Icon - Text lines with sync indicator (timing marks)
export const SyncedLyricsIcon: React.FC<IconProps> = ({ size = 24, className, ...props }) => (
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
    <path d="M4 6h12" />
    <path d="M4 10h10" />
    <path d="M4 14h8" />
    <path d="M4 18h10" />
    {/* Sync/timing indicator */}
    <path d="M19 4v4" />
    <path d="M17 6h4" />
    <circle cx="19" cy="14" r="3" />
    <path d="M19 17v3" />
  </svg>
);

// ============================================
// Playlist Icons
// ============================================

export const PlaylistIcon: React.FC<IconProps> = ({ size = 24, className, ...props }) => (
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
    {/* Stacked list items representing tracks in a playlist */}
    <rect x="3" y="4" width="2" height="2" rx="0.5" fill="currentColor" stroke="none" />
    <line x1="8" y1="5" x2="21" y2="5" />
    <rect x="3" y="9" width="2" height="2" rx="0.5" fill="currentColor" stroke="none" />
    <line x1="8" y1="10" x2="21" y2="10" />
    <rect x="3" y="14" width="2" height="2" rx="0.5" fill="currentColor" stroke="none" />
    <line x1="8" y1="15" x2="21" y2="15" />
    <rect x="3" y="19" width="2" height="2" rx="0.5" fill="currentColor" stroke="none" />
    <line x1="8" y1="20" x2="17" y2="20" />
  </svg>
);

export const PlaylistAddIcon: React.FC<IconProps> = ({ size = 24, className, ...props }) => (
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
    {/* List items with add button */}
    <rect x="3" y="4" width="2" height="2" rx="0.5" fill="currentColor" stroke="none" />
    <line x1="8" y1="5" x2="21" y2="5" />
    <rect x="3" y="9" width="2" height="2" rx="0.5" fill="currentColor" stroke="none" />
    <line x1="8" y1="10" x2="21" y2="10" />
    <rect x="3" y="14" width="2" height="2" rx="0.5" fill="currentColor" stroke="none" />
    <line x1="8" y1="15" x2="14" y2="15" />
    {/* Plus sign */}
    <line x1="18" y1="14" x2="18" y2="20" />
    <line x1="15" y1="17" x2="21" y2="17" />
  </svg>
);

// ============================================
// Album Icons
// ============================================

export const AlbumIcon: React.FC<IconProps> = ({ size = 24, className, ...props }) => (
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
    <circle cx="12" cy="12" r="10" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

// ============================================
// Artist Icons
// ============================================

export const ArtistIcon: React.FC<IconProps> = ({ size = 24, className, ...props }) => (
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
    <path d="M12 8a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />
    <path d="M20 21a8 8 0 1 0-16 0" />
    <path d="M12 12v6" />
    <circle cx="12" cy="20" r="2" />
  </svg>
);

export const PersonIcon: React.FC<IconProps> = ({ size = 24, className, ...props }) => (
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
    <circle cx="12" cy="7" r="4" />
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
  </svg>
);

export const UserIcon: React.FC<IconProps> = PersonIcon;

// ============================================
// Radio Icon
// ============================================

export const RadioIcon: React.FC<IconProps> = ({ size = 24, className, ...props }) => (
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
    <circle cx="12" cy="12" r="2" />
    <path d="M16.24 7.76a6 6 0 0 1 0 8.49m-8.48-.01a6 6 0 0 1 0-8.49m11.31-2.82a10 10 0 0 1 0 14.14m-14.14 0a10 10 0 0 1 0-14.14" />
  </svg>
);

// ============================================
// Volume Icons
// ============================================

export const VolumeHighIcon: React.FC<IconProps> = ({ size = 24, className, ...props }) => (
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
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" stroke="none" />
    <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
    <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
  </svg>
);

export const VolumeLowIcon: React.FC<IconProps> = ({ size = 24, className, ...props }) => (
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
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" stroke="none" />
    <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
  </svg>
);

export const VolumeMuteIcon: React.FC<IconProps> = ({ size = 24, className, ...props }) => (
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
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" stroke="none" />
    <line x1="23" y1="9" x2="17" y2="15" />
    <line x1="17" y1="9" x2="23" y2="15" />
  </svg>
);

export const VolumeOffIcon: React.FC<IconProps> = ({ size = 24, className, ...props }) => (
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
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" stroke="none" />
  </svg>
);

// ============================================
// Microphone Icons
// ============================================

export const MicIcon: React.FC<IconProps> = ({ size = 24, className, ...props }) => (
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
    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
    <line x1="12" y1="19" x2="12" y2="23" />
    <line x1="8" y1="23" x2="16" y2="23" />
  </svg>
);

export const KaraokeIcon: React.FC<IconProps> = ({ size = 24, className, ...props }) => (
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
    {/* Microphone with vocal waves - represents vocal removal/karaoke mode */}
    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
    <line x1="12" y1="19" x2="12" y2="23" />
    <path d="M16 22h-8" />
    {/* Sound waves indicating vocal track */}
    <path d="M3 6l2 2 2-2" />
    <path d="M19 6l2 2 2-2" />
  </svg>
);

// Sing-Along Icon - Text lines with bouncing highlight indicator
// Represents word-by-word karaoke-style text highlighting
export const SingAlongIcon: React.FC<IconProps> = ({ size = 24, className, ...props }) => (
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
    {/* Text lines representing lyrics */}
    <path d="M4 7h16" />
    <path d="M4 12h12" />
    <path d="M4 17h8" />
    {/* Bouncing ball / highlight indicator */}
    <circle cx="19" cy="12" r="3" fill="currentColor" stroke="none" />
    {/* Motion trail indicating progression */}
    <path d="M19 7v2" strokeWidth="2.5" strokeLinecap="round" />
    <path d="M19 15v2" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
  </svg>
);

// ============================================
// Translate Icon
// ============================================

export const TranslateIcon: React.FC<IconProps> = ({ size = 24, className, ...props }) => (
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
    <path d="M5 8l6 6" />
    <path d="M4 14l6-6 2-3" />
    <path d="M2 5h12" />
    <path d="M7 2v3" />
    <path d="M22 22l-5-10-5 10" />
    <path d="M14 18h6" />
  </svg>
);
