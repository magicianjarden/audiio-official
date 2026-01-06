/**
 * Tracking & Sessions API type definitions
 */

import type { SuccessResponse, UnifiedTrack, Timestamp } from './common.types';

/** Tracking event types */
export type TrackingEventType =
  | 'play_start'
  | 'play_pause'
  | 'play_resume'
  | 'play_complete'
  | 'play_stop'
  | 'skip'
  | 'seek'
  | 'like'
  | 'unlike'
  | 'dislike'
  | 'add_to_playlist'
  | 'remove_from_playlist'
  | 'add_to_queue'
  | 'search'
  | 'view_artist'
  | 'view_album'
  | 'download_start'
  | 'download_complete';

/** Tracking event */
export interface TrackingEvent {
  id: string;
  type: TrackingEventType;
  sessionId: string;
  trackId?: string;
  trackData?: Partial<UnifiedTrack>;
  position?: number;        // playback position in milliseconds
  duration?: number;        // track duration in milliseconds
  timestamp: Timestamp;
  context?: {
    source?: string;        // 'library', 'search', 'radio', 'playlist'
    playlistId?: string;
    queuePosition?: number;
    [key: string]: unknown;
  };
}

/** Tracking session */
export interface TrackingSession {
  id: string;
  deviceId?: string;
  deviceType?: string;
  deviceName?: string;
  startedAt: Timestamp;
  endedAt?: Timestamp;
  duration?: number;        // milliseconds
  eventCount: number;
  playCount: number;
  listenTime: number;       // milliseconds
  context?: {
    appVersion?: string;
    platform?: string;
    [key: string]: unknown;
  };
}

/** Session summary */
export interface SessionSummary {
  session: TrackingSession;
  topTrack?: UnifiedTrack;
  genres: Record<string, number>;
  artists: Record<string, number>;
  avgCompletionRate: number;
  skipRate: number;
}

// Request types
export interface TrackEventRequest {
  type: TrackingEventType;
  trackId?: string;
  trackData?: Partial<UnifiedTrack>;
  position?: number;
  duration?: number;
  context?: Record<string, unknown>;
}

export interface TrackBatchRequest {
  events: TrackEventRequest[];
}

export interface StartSessionRequest {
  deviceId?: string;
  deviceType?: string;
  deviceName?: string;
  context?: Record<string, unknown>;
}

export interface GetEventsRequest {
  type?: TrackingEventType | TrackingEventType[];
  trackId?: string;
  sessionId?: string;
  startTime?: Timestamp;
  endTime?: Timestamp;
  limit?: number;
  offset?: number;
}

// Response types
export interface TrackEventResponse extends SuccessResponse {}

export interface TrackBatchResponse extends SuccessResponse {
  count: number;
}

export interface SessionStartResponse extends SuccessResponse {
  session: TrackingSession;
}

export interface SessionEndResponse {
  summary: SessionSummary;
}

export interface SessionGetResponse extends SessionSummary {}

export interface SessionsListResponse {
  sessions: TrackingSession[];
}

export interface TrackingEventsListResponse {
  events: TrackingEvent[];
  total?: number;
}
