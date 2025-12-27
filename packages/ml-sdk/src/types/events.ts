/**
 * User event types for ML training and real-time updates
 */

import type { Track, MoodCategory } from './track';

export type UserEvent =
  | ListenEvent
  | SkipEvent
  | DislikeEvent
  | LikeEvent
  | QueueEvent
  | PlaylistEvent
  | SearchEvent
  | DownloadEvent;

// ============================================================================
// Listen Events
// ============================================================================

export interface ListenEvent {
  type: 'listen';
  timestamp: number;
  track: Track;

  /** Duration listened in seconds */
  duration: number;

  /** Percentage of track played (0-1) */
  completion: number;

  /** Whether track was completed (>80%) */
  completed: boolean;

  /** Source of playback */
  source: ListenSource;

  /** Context when played */
  context: ListenContext;
}

export interface ListenSource {
  type: 'queue' | 'search' | 'radio' | 'playlist' | 'album' | 'artist' | 'recommendation';
  id?: string;
  name?: string;
}

export interface ListenContext {
  hourOfDay: number;
  dayOfWeek: number;
  isWeekend: boolean;

  /** Device type */
  device?: 'desktop' | 'mobile' | 'web';

  /** Activity if specified */
  activity?: string;

  /** Mood if specified */
  mood?: MoodCategory;
}

// ============================================================================
// Skip Events
// ============================================================================

export interface SkipEvent {
  type: 'skip';
  timestamp: number;
  track: Track;

  /** How far into the track before skipping (seconds) */
  skipPosition: number;

  /** Percentage of track played before skip */
  skipPercentage: number;

  /** Whether this was an early skip (<30s) */
  earlySkip: boolean;

  /** Context when skipped */
  context: ListenContext;
}

// ============================================================================
// Dislike Events
// ============================================================================

export interface DislikeEvent {
  type: 'dislike';
  timestamp: number;
  track: Track;

  /** Reason for dislike */
  reason: DislikeReason;

  /** Optional additional feedback */
  feedback?: string;
}

export type DislikeReason =
  | 'not_my_taste'      // General dislike
  | 'heard_too_much'    // Fatigue, not actual dislike
  | 'bad_audio_quality' // Technical issue
  | 'wrong_mood'        // Contextual mismatch
  | 'dont_like_artist'  // Artist-level dislike
  | 'too_long'          // Duration issue
  | 'too_short'         // Duration issue
  | 'explicit_content'  // Content issue
  | 'wrong_genre'       // Genre mismatch
  | 'other';            // Unspecified

export const DISLIKE_REASON_WEIGHTS: Record<DislikeReason, number> = {
  'not_my_taste': 0.95,
  'heard_too_much': 0.40,
  'bad_audio_quality': 0.30,
  'wrong_mood': 0.35,
  'dont_like_artist': 1.0,
  'too_long': 0.50,
  'too_short': 0.50,
  'explicit_content': 0.70,
  'wrong_genre': 0.80,
  'other': 0.60,
};

// ============================================================================
// Like Events
// ============================================================================

export interface LikeEvent {
  type: 'like';
  timestamp: number;
  track: Track;

  /** Like strength (1 = like, 2 = love/super like) */
  strength: 1 | 2;
}

// ============================================================================
// Queue Events
// ============================================================================

export interface QueueEvent {
  type: 'queue';
  timestamp: number;
  track: Track;

  /** Queue action */
  action: QueueAction;

  /** Position in queue (if relevant) */
  position?: number;

  /** Priority (for queue adds) */
  priority?: 'next' | 'last' | 'position';
}

export type QueueAction =
  | 'add'           // Added to queue
  | 'remove'        // Removed from queue
  | 'move_up'       // Moved earlier in queue
  | 'move_down'     // Moved later in queue
  | 'play_next';    // Added as next track

// ============================================================================
// Playlist Events
// ============================================================================

export interface PlaylistEvent {
  type: 'playlist';
  timestamp: number;
  track: Track;

  /** Playlist info */
  playlist: {
    id: string;
    name: string;
  };

  /** Playlist action */
  action: PlaylistAction;
}

export type PlaylistAction = 'add' | 'remove';

// ============================================================================
// Search Events
// ============================================================================

export interface SearchEvent {
  type: 'search';
  timestamp: number;

  /** Search query */
  query: string;

  /** Track selected from results (if any) */
  selectedTrack?: Track;

  /** Position of selected track in results */
  selectedPosition?: number;

  /** Total results shown */
  resultsCount: number;
}

// ============================================================================
// Download Events
// ============================================================================

export interface DownloadEvent {
  type: 'download';
  timestamp: number;
  track: Track;

  /** Download action */
  action: 'start' | 'complete' | 'cancel';

  /** Quality if relevant */
  quality?: string;
}

// ============================================================================
// Event Utilities
// ============================================================================

export function isPositiveSignal(event: UserEvent): boolean {
  switch (event.type) {
    case 'listen':
      return event.completed;
    case 'like':
      return true;
    case 'playlist':
      return event.action === 'add';
    case 'queue':
      return event.action === 'add' || event.action === 'play_next';
    case 'download':
      return event.action === 'complete';
    case 'search':
      return event.selectedTrack !== undefined;
    default:
      return false;
  }
}

export function isNegativeSignal(event: UserEvent): boolean {
  switch (event.type) {
    case 'skip':
      return event.earlySkip;
    case 'dislike':
      return true;
    case 'playlist':
      return event.action === 'remove';
    case 'queue':
      return event.action === 'remove';
    default:
      return false;
  }
}

export function getEventWeight(event: UserEvent): number {
  switch (event.type) {
    case 'listen':
      return event.completed ? 1.0 : event.completion;
    case 'skip':
      return event.earlySkip ? -0.8 : -0.3;
    case 'dislike':
      return -DISLIKE_REASON_WEIGHTS[event.reason];
    case 'like':
      return event.strength === 2 ? 1.5 : 1.0;
    case 'playlist':
      return event.action === 'add' ? 0.8 : -0.5;
    case 'queue':
      if (event.action === 'play_next') return 0.6;
      if (event.action === 'add') return 0.4;
      if (event.action === 'remove') return -0.3;
      return 0.2; // move_up/down
    case 'download':
      return event.action === 'complete' ? 1.2 : 0;
    case 'search':
      return event.selectedTrack ? 0.5 : 0;
    default:
      return 0;
  }
}
