/**
 * Shared types between server and web client
 */

export interface AccessConfig {
  /** Unique access token for this session */
  token: string;
  /** Local network URL */
  localUrl: string;
  /** QR code data URL for easy mobile access */
  qrCode?: string;
  /** When the session was created */
  createdAt: number;
  /** Session expiry (0 = never) */
  expiresAt?: number;
  /** One-time pairing code for instant device trust */
  pairingCode?: string;
  /** P2P connection code (e.g. BLUE-TIGER-42) - works from anywhere! */
  p2pCode?: string;
  /** Whether P2P is active */
  p2pActive?: boolean;
}

export interface ServerConfig {
  /** Port for local server */
  port: number;
  /** Rate limit requests per minute */
  rateLimit: number;
  /** Max concurrent streams */
  maxStreams: number;
  /** Audio quality for mobile streaming */
  streamQuality: 'low' | 'medium' | 'high' | 'original';
}

export interface MobileSession {
  id: string;
  token: string;
  deviceName?: string;
  userAgent?: string;
  connectedAt: number;
  lastActivity: number;
  isActive: boolean;
}

export interface PlaybackSync {
  trackId: string;
  position: number;
  isPlaying: boolean;
  volume: number;
  timestamp: number;
}

export interface WebSocketMessage {
  type:
    | 'playback-sync'
    | 'track-change'
    | 'queue-update'
    | 'session-update'
    | 'ping'
    | 'pong'
    | 'remote-command'
    | 'mode-change'
    | 'desktop-state'
    | 'library-sync';
  payload: unknown;
}

// ========================================
// Enhanced Authentication Types
// ========================================

export type PlaybackMode = 'local' | 'remote';

export interface AuthorizedDeviceInfo {
  id: string;
  name: string;
  createdAt: string;
  lastAccessAt: string;
  expiresAt: string | null;
}

export interface AuthSettings {
  /** Current passphrase (hashed) */
  passphraseHash?: string;
  passphraseSalt?: string;
  /** Custom password (hashed) - alternative to passphrase */
  customPasswordHash?: string;
  customPasswordSalt?: string;
  /** Whether custom password is enabled */
  useCustomPassword: boolean;
  /** Default expiration for new devices in days (null = never) */
  defaultExpirationDays: number | null;
  /** Require password on every connection */
  requirePasswordEveryTime: boolean;
}

export interface LoginRequest {
  /** The passphrase or custom password */
  password: string;
  /** Device name for this connection */
  deviceName?: string;
  /** Remember this device (get a device token) */
  rememberDevice?: boolean;
}

export interface LoginResponse {
  success: boolean;
  error?: string;
  /** Device token for future connections (if rememberDevice was true) */
  deviceToken?: string;
  deviceId?: string;
  expiresAt?: string;
}

export interface DeviceAuthRequest {
  /** Combined device token (deviceId:token) */
  deviceToken: string;
}

export interface RemoteControlCommand {
  type: 'play' | 'pause' | 'resume' | 'seek' | 'next' | 'previous' | 'volume' | 'queue';
  payload?: unknown;
  timestamp: number;
}

export interface DesktopPlaybackState {
  currentTrack: unknown;
  queue: unknown[];
  queueIndex: number;
  position: number;
  duration: number;
  isPlaying: boolean;
  volume: number;
  repeatMode: 'none' | 'one' | 'all';
  isShuffled: boolean;
}

export const DEFAULT_SERVER_CONFIG: ServerConfig = {
  port: 8484,
  rateLimit: 100,
  maxStreams: 3,
  streamQuality: 'medium'
};
