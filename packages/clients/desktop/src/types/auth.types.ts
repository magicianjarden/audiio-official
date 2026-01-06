/**
 * Authentication & Device API type definitions
 */

import type { SuccessResponse, Timestamp } from './common.types';

/** Server identity */
export interface ServerIdentity {
  serverId: string;
  serverName: string;
  publicKey: string;
  version?: string;
}

/** Device entity */
export interface Device {
  id: string;
  name: string;
  type?: 'desktop' | 'mobile' | 'web' | 'other';
  platform?: string;
  trusted: boolean;
  lastSeenAt: Timestamp;
  createdAt: Timestamp;
}

/** Connection state */
export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

/** Server connection info */
export interface ServerConnection {
  state: ConnectionState;
  serverUrl?: string;
  serverId?: string;
  serverName?: string;
  connectedAt?: Timestamp;
  error?: string;
}

/** Saved server info */
export interface SavedServer {
  url: string;
  serverId: string;
  serverName: string;
  publicKey: string;
  token?: string;
  lastConnectedAt?: Timestamp;
}

/** Discovered server (via mDNS) */
export interface DiscoveredServer {
  id: string;
  name: string;
  host: string;
  port: number;
  version?: string;
  addresses: string[];
}

/** Setup status */
export interface SetupStatus {
  completed: boolean;
  serverName?: string;
  lastRun?: Timestamp;
}

/** Server settings */
export interface ServerSettings {
  name: string;
  serverId: string;
  requirePairing?: boolean;
  allowAnonymous?: boolean;
  maxDevices?: number;
}

/** Log level */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/** Log entry */
export interface LogEntry {
  id: string;
  level: LogLevel;
  message: string;
  service?: string;
  timestamp: Timestamp;
  metadata?: Record<string, unknown>;
}

/** Log query options */
export interface LogQueryOptions {
  level?: LogLevel;
  service?: string;
  limit?: number;
  since?: Timestamp;
}

// Response types
export interface AuthIdentityResponse extends ServerIdentity {}

export interface AuthDevicesResponse {
  devices: Device[];
}

export interface AuthDeviceRemoveResponse extends SuccessResponse {}

export interface AuthDeviceUpdateResponse extends SuccessResponse {}

export interface ConnectionStateResponse extends ServerConnection {}

export interface SavedServerResponse extends SavedServer {}

export interface DiscoveredServersResponse {
  servers: DiscoveredServer[];
}

export interface SetupStatusResponse extends SetupStatus {}

export interface SetupCompleteResponse extends SuccessResponse {}

export interface ServerSettingsGetResponse extends ServerSettings {}

export interface ServerSettingsUpdateResponse extends SuccessResponse {}

export interface LogsGetResponse {
  logs: LogEntry[];
  stats?: {
    total: number;
    byLevel: Record<LogLevel, number>;
  };
}

export interface LogsClearResponse extends SuccessResponse {}

/** Library capabilities */
export interface LibraryCapabilities {
  'metadata-provider': { available: boolean; providers: string[] };
  'stream-provider': { available: boolean; providers: string[] };
  'lyrics-provider': { available: boolean; providers: string[] };
  'audio-processor': { available: boolean; providers: string[] };
  'scrobbler': { available: boolean; providers: string[] };
  [key: string]: { available: boolean; providers: string[] };
}

export interface LibraryCapabilitiesResponse extends LibraryCapabilities {}

export interface ImportProvidersResponse {
  providers: Array<{
    id: string;
    name: string;
    description?: string;
    formats: string[];
  }>;
}

export interface ExportFormatsResponse {
  formats: Array<{
    id: string;
    name: string;
    extension: string;
    mimeType: string;
  }>;
}

/** Library stats */
export interface LibraryStats {
  trackCount: number;
  artistCount: number;
  albumCount: number;
  playlistCount: number;
  totalDuration: number;
  totalSize: number;
  analyzedCount: number;
}

export interface LibraryStatsResponse extends LibraryStats {}

export interface TrackStatsResponse {
  trackId: string;
  playCount: number;
  skipCount: number;
  totalListenTime: number;
  lastPlayedAt?: Timestamp;
  firstPlayedAt?: Timestamp;
}

export interface MostPlayedResponse {
  tracks: Array<{
    track: import('./common.types').UnifiedTrack;
    playCount: number;
    listenTime: number;
  }>;
}

/** Debug persistence info */
export interface DebugPersistence {
  timestamp: Timestamp;
  library: {
    tracks: number;
    playlists: number;
    likes: number;
    dislikes: number;
  };
  ml: {
    events: number;
    embeddings: number;
    profiles: number;
  };
}

export interface DebugPersistenceResponse extends DebugPersistence {}
