/**
 * Playlists & Smart Playlists API type definitions
 */

import type { SuccessResponse, UnifiedTrack, Timestamp } from './common.types';

/** Playlist entity */
export interface Playlist {
  id: string;
  name: string;
  description?: string;
  artwork?: string;
  trackCount: number;
  duration: number;         // total duration in milliseconds
  folderId?: string;
  isPublic?: boolean;
  isSmart: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/** Playlist with tracks */
export interface PlaylistWithTracks extends Playlist {
  tracks: UnifiedTrack[];
}

/** Playlist folder */
export interface PlaylistFolder {
  id: string;
  name: string;
  parentId?: string;
  position: number;
  isExpanded?: boolean;
  playlistCount: number;
  createdAt: Timestamp;
}

/** Smart playlist rule operators */
export type RuleOperator =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'not_contains'
  | 'starts_with'
  | 'ends_with'
  | 'greater_than'
  | 'less_than'
  | 'between'
  | 'is_empty'
  | 'is_not_empty'
  | 'in_last'
  | 'not_in_last';

/** Smart playlist rule fields */
export type RuleField =
  | 'title'
  | 'artist'
  | 'album'
  | 'genre'
  | 'year'
  | 'duration'
  | 'play_count'
  | 'skip_count'
  | 'last_played'
  | 'date_added'
  | 'rating'
  | 'bpm'
  | 'energy'
  | 'valence'
  | 'danceability'
  | 'acousticness'
  | 'instrumentalness'
  | 'tag'
  | 'liked'
  | 'source';

/** Smart playlist rule */
export interface PlaylistRule {
  id: string;
  field: RuleField;
  operator: RuleOperator;
  value: string | number | boolean | string[] | number[];
  unit?: 'days' | 'weeks' | 'months' | 'years';
}

/** Smart playlist rule combinator */
export type RuleCombinator = 'and' | 'or';

/** Smart playlist */
export interface SmartPlaylist extends Playlist {
  isSmart: true;
  rules: PlaylistRule[];
  combinator: RuleCombinator;
  orderBy?: string;
  orderDirection?: 'asc' | 'desc';
  limit?: number;
  lastEvaluatedAt?: Timestamp;
}

/** Available rule definition (for UI) */
export interface RuleDefinition {
  field: RuleField;
  label: string;
  type: 'string' | 'number' | 'date' | 'boolean' | 'select';
  operators: RuleOperator[];
  options?: Array<{ value: string; label: string }>;
  unit?: 'days' | 'weeks' | 'months' | 'years';
}

// Request types
export interface CreatePlaylistRequest {
  name: string;
  description?: string;
  folderId?: string;
  tracks?: string[];
}

export interface UpdatePlaylistRequest {
  name?: string;
  description?: string;
  folderId?: string;
}

export interface CreateSmartPlaylistRequest {
  name: string;
  description?: string;
  rules: Omit<PlaylistRule, 'id'>[];
  combinator?: RuleCombinator;
  orderBy?: string;
  orderDirection?: 'asc' | 'desc';
  limit?: number;
  folderId?: string;
}

export interface UpdateSmartPlaylistRequest {
  name?: string;
  description?: string;
  rules?: Omit<PlaylistRule, 'id'>[];
  combinator?: RuleCombinator;
  orderBy?: string;
  orderDirection?: 'asc' | 'desc';
  limit?: number;
  folderId?: string;
}

export interface PreviewRulesRequest {
  rules: Omit<PlaylistRule, 'id'>[];
  combinator?: RuleCombinator;
  orderBy?: string;
  orderDirection?: 'asc' | 'desc';
  limit?: number;
}

// Response types
export interface PlaylistsGetAllResponse {
  playlists: Playlist[];
  synced: boolean;
}

export interface PlaylistGetResponse extends PlaylistWithTracks {}

export interface PlaylistCreateResponse extends SuccessResponse {
  playlist?: Playlist;
}

export interface PlaylistEvaluateResponse {
  trackIds: string[];
  tracks: UnifiedTrack[];
  count: number;
  source: string;
}

export interface PlaylistRulesResponse {
  rules: RuleDefinition[];
}

export interface SmartPlaylistsGetAllResponse {
  playlists: SmartPlaylist[];
  synced: boolean;
}

export interface SmartPlaylistGetResponse extends SmartPlaylist {}

export interface SmartPlaylistCreateResponse extends SuccessResponse {
  playlist?: SmartPlaylist;
}

export interface SmartPlaylistTracksResponse {
  playlistId: string;
  trackIds: string[];
  tracks?: UnifiedTrack[];
  count: number;
  evaluatedAt: Timestamp;
}

export interface SmartPlaylistPreviewResponse {
  tracks: UnifiedTrack[];
  count: number;
  evaluatedAt: Timestamp;
}

// Library folders
export interface LibraryFoldersGetAllResponse {
  folders: PlaylistFolder[];
  synced: boolean;
}

export interface LibraryFolderCreateResponse extends SuccessResponse {
  folder?: PlaylistFolder;
}
