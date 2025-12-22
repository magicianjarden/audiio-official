/**
 * Shared types between server and web client
 */
export interface AccessConfig {
    /** Unique access token for this session */
    token: string;
    /** Local network URL */
    localUrl: string;
    /** Remote tunnel URL (if enabled) */
    tunnelUrl?: string;
    /** QR code data URL for easy mobile access */
    qrCode?: string;
    /** When the session was created */
    createdAt: number;
    /** Session expiry (0 = never) */
    expiresAt?: number;
}
export interface ServerConfig {
    /** Port for local server */
    port: number;
    /** Enable remote tunnel access */
    enableTunnel: boolean;
    /** Tunnel provider */
    tunnelProvider: 'localtunnel' | 'cloudflare' | 'ngrok';
    /** Custom subdomain for tunnel (if supported) */
    tunnelSubdomain?: string;
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
    type: 'playback-sync' | 'track-change' | 'queue-update' | 'session-update' | 'ping' | 'pong';
    payload: unknown;
}
export declare const DEFAULT_SERVER_CONFIG: ServerConfig;
//# sourceMappingURL=types.d.ts.map