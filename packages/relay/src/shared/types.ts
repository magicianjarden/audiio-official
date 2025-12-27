/**
 * Shared types for Audiio Relay
 */

// Connection codes are memorable words + number
// e.g., "BLUE-TIGER-42", "SWIFT-RIVER-17"
export type ConnectionCode = string;

// Message types for relay protocol
export type RelayMessageType =
  | 'register'        // Desktop registers with relay
  | 'registered'      // Relay confirms registration with code
  | 'join'            // Mobile joins with code
  | 'joined'          // Relay confirms mobile joined
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
    // Optional: request specific code (for reconnection)
    requestedCode?: string;
  };
}

// Registration confirmed
export interface RegisteredMessage extends RelayMessage {
  type: 'registered';
  payload: {
    code: ConnectionCode;
    expiresAt: number; // Code expiry timestamp
  };
}

// Mobile joining with code
export interface JoinMessage extends RelayMessage {
  type: 'join';
  payload: {
    code: ConnectionCode;
    // Mobile's public key for E2E encryption
    publicKey: string;
    // Device info
    deviceName: string;
    userAgent: string;
  };
}

// Join confirmed
export interface JoinedMessage extends RelayMessage {
  type: 'joined';
  payload: {
    // Desktop's public key for mobile to encrypt messages
    desktopPublicKey: string;
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
  code: ConnectionCode;
  desktopId: string;
  desktopPublicKey: string;
  peers: Map<string, RelayPeer>;
  createdAt: number;
  expiresAt: number;
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
  // How long codes are valid (default 5 minutes)
  codeExpiryMs: number;
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
  codeExpiryMs: 5 * 60 * 1000, // 5 minutes
  maxPeersPerRoom: 5
};
