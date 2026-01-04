/**
 * Shared types for Audiio Relay
 *
 * Device Trust Model (v2):
 * - Each server has a cryptographic identity (serverId = fingerprint of public key)
 * - Devices are trusted via QR code pairing
 * - Relay routes messages, server validates device trust
 * - No passwords - cryptographic authentication only
 *
 * Legacy Room Model (v1, deprecated):
 * - Room codes like SWIFT-EAGLE-42
 * - Password protection
 */

// Server ID - fingerprint of server's public key (8 chars)
// e.g., "A3F2B1C9", "7D4E8F2A"
export type ServerId = string;

// Device ID - fingerprint of device's public key (8 chars)
export type DeviceId = string;

// Legacy Room ID (deprecated, for backwards compatibility)
// e.g., "BLUE-TIGER-42", "SWIFT-RIVER-17"
export type RoomId = string;

// Legacy alias for compatibility
export type ConnectionCode = RoomId;

// Message types for relay protocol
export type RelayMessageType =
  // V1 (Legacy - room codes + passwords)
  | 'register'        // Desktop registers with relay (creates/joins room)
  | 'registered'      // Relay confirms registration
  | 'join'            // Mobile joins room
  | 'joined'          // Relay confirms mobile joined
  | 'auth-required'   // Room requires password
  // V2 (Device Trust - serverId + cryptographic auth)
  | 'register-v2'     // Server registers with serverId
  | 'registered-v2'   // Relay confirms v2 registration
  | 'connect'         // Device connects to server
  | 'connected'       // Connection accepted
  | 'trust-required'  // Device not trusted by server
  // Common
  | 'peer-joined'     // Notify desktop that mobile connected
  | 'peer-left'       // Notify when peer disconnects
  | 'data'            // E2E encrypted data packet
  | 'ping'            // Keep-alive
  | 'pong'            // Keep-alive response
  | 'error';          // Error message

export interface RelayMessage {
  type: RelayMessageType;
  payload?: unknown;
  timestamp: number;
}

// Registration message from desktop
export interface RegisterMessage extends RelayMessage {
  type: 'register';
  payload: {
    // Desktop's public key for E2E encryption
    publicKey: string;
    // Persistent room ID (SWIFT-EAGLE-42 format)
    roomId: RoomId;
    // Optional: password hash for room authentication
    // SHA-256 hash of user's password - relay only compares hashes
    passwordHash?: string;
    // Server name for display (e.g., "Jordan's MacBook Pro")
    serverName?: string;
  };
}

// Registration confirmed
export interface RegisteredMessage extends RelayMessage {
  type: 'registered';
  payload: {
    roomId: RoomId;
    // Whether room has password protection enabled
    hasPassword: boolean;
  };
}

// Mobile joining with room ID
export interface JoinMessage extends RelayMessage {
  type: 'join';
  payload: {
    roomId: RoomId;
    // Mobile's public key for E2E encryption
    publicKey: string;
    // Device info
    deviceName: string;
    userAgent: string;
    // Password hash if room requires authentication
    passwordHash?: string;
  };
}

// Room requires password
export interface AuthRequiredMessage extends RelayMessage {
  type: 'auth-required';
  payload: {
    roomId: RoomId;
    serverName?: string;
  };
}

// Join confirmed
export interface JoinedMessage extends RelayMessage {
  type: 'joined';
  payload: {
    // Desktop's public key for mobile to encrypt messages
    desktopPublicKey: string;
    // Server info
    serverName?: string;
  };
}

// Notify desktop of new peer
export interface PeerJoinedMessage extends RelayMessage {
  type: 'peer-joined';
  payload: {
    peerId: string;
    publicKey: string;
    deviceName: string;
    userAgent: string;
  };
}

// Peer disconnected
export interface PeerLeftMessage extends RelayMessage {
  type: 'peer-left';
  payload: {
    peerId: string;
  };
}

// E2E encrypted data
export interface DataMessage extends RelayMessage {
  type: 'data';
  payload: {
    // Target peer ID (for multi-device support)
    to?: string;
    // Encrypted data (base64)
    encrypted: string;
    // Nonce used for encryption (base64)
    nonce: string;
  };
}

// Error
export interface ErrorMessage extends RelayMessage {
  type: 'error';
  payload: {
    code: string;
    message: string;
  };
}

// Room state on the relay server
export interface RelayRoom {
  roomId: RoomId;
  desktopId: string | null;  // null when desktop is offline
  desktopPublicKey: string;
  // Password hash for authentication (relay compares, never decrypts)
  passwordHash?: string;
  // Human-readable server name
  serverName?: string;
  peers: Map<string, RelayPeer>;
  createdAt: number;
  // When desktop last connected (for cleanup)
  lastDesktopSeen: number;
  // Static rooms don't expire while desktop is connected
  isDesktopOnline: boolean;
}

export interface RelayPeer {
  id: string;
  publicKey: string;
  deviceName: string;
  userAgent: string;
  connectedAt: number;
}

// Relay server configuration
export interface RelayServerConfig {
  port: number;
  host: string;
  // How long to keep inactive rooms (desktop offline) - default 24 hours
  roomCleanupMs: number;
  // Max peers per room
  maxPeersPerRoom: number;
  // Enable TLS
  tls?: {
    cert: string;
    key: string;
  };
}

export const DEFAULT_RELAY_CONFIG: RelayServerConfig = {
  port: 9484,
  host: '0.0.0.0',
  roomCleanupMs: 24 * 60 * 60 * 1000, // 24 hours - rooms persist while desktop offline
  maxPeersPerRoom: 5
};

// ========================================
// V2 Message Types (Device Trust Model)
// ========================================

// Server registers with relay using cryptographic identity
export interface RegisterV2Message extends RelayMessage {
  type: 'register-v2';
  payload: {
    // Server's cryptographic identity
    serverId: ServerId;
    serverPublicKey: string;
    serverName?: string;
    // Protocol version for future compatibility
    protocolVersion: number;
  };
}

// Relay confirms v2 registration
export interface RegisteredV2Message extends RelayMessage {
  type: 'registered-v2';
  payload: {
    serverId: ServerId;
  };
}

// Device connects to a server via relay
export interface ConnectMessage extends RelayMessage {
  type: 'connect';
  payload: {
    // Target server
    serverId: ServerId;
    // Device's identity
    deviceId: DeviceId;
    devicePublicKey: string;
    deviceName: string;
    // Protocol version
    protocolVersion: number;
  };
}

// Connection accepted - device is trusted
export interface ConnectedMessage extends RelayMessage {
  type: 'connected';
  payload: {
    serverPublicKey: string;
    serverName?: string;
  };
}

// Device is not trusted by server - needs pairing
export interface TrustRequiredMessage extends RelayMessage {
  type: 'trust-required';
  payload: {
    serverId: ServerId;
    serverName?: string;
    // Instructions for pairing
    message: string;
  };
}

// Server state on the relay (v2)
export interface RelayServerState {
  serverId: ServerId;
  clientId: string | null;  // WebSocket client ID, null when offline
  serverPublicKey: string;
  serverName?: string;
  peers: Map<DeviceId, RelayPeerV2>;
  createdAt: number;
  lastSeen: number;
  isOnline: boolean;
  protocolVersion: number;
}

export interface RelayPeerV2 {
  deviceId: DeviceId;
  clientId: string;
  publicKey: string;
  deviceName: string;
  connectedAt: number;
}
