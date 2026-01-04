/**
 * Audiio Relay Server
 *
 * A lightweight WebSocket relay that enables secure remote access
 * for Audiio mobile streaming.
 *
 * Features:
 * - Memorable connection codes (BLUE-TIGER-42)
 * - E2E encryption (relay never sees plaintext)
 * - Room-based connections (desktop + multiple mobile peers)
 * - Automatic cleanup of expired rooms
 */

import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createHttpServer, IncomingMessage, ServerResponse } from 'http';
import { createServer as createHttpsServer } from 'https';
import { readFileSync } from 'fs';

import {
  RelayServerConfig,
  DEFAULT_RELAY_CONFIG,
  RelayMessage,
  RelayRoom,
  RelayPeer,
  RegisterMessage,
  JoinMessage,
  DataMessage,
  RoomId,
  // V2 types
  ServerId,
  DeviceId,
  RegisterV2Message,
  ConnectMessage,
  RelayServerState,
  RelayPeerV2
} from '../shared/types';
import { normalizeCode } from '../shared/codes';

interface ConnectedClient {
  ws: WebSocket;
  id: string;
  isDesktop: boolean;
  roomCode?: string;      // V1: room code
  serverId?: ServerId;    // V2: server ID
  deviceId?: DeviceId;    // V2: device ID (for mobile)
  publicKey?: string;
  protocolVersion: number; // 1 = legacy, 2 = device trust
}

export class RelayServer {
  private wss: WebSocketServer | null = null;
  private config: RelayServerConfig;
  // V1: Room-based connections (legacy)
  private rooms = new Map<string, RelayRoom>();
  // V2: Server-based connections (device trust)
  private servers = new Map<ServerId, RelayServerState>();
  private clients = new Map<WebSocket, ConnectedClient>();
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  constructor(config: Partial<RelayServerConfig> = {}) {
    this.config = { ...DEFAULT_RELAY_CONFIG, ...config };
  }

  /**
   * Handle HTTP requests (health checks, etc.)
   */
  private handleHttpRequest(req: IncomingMessage, res: ServerResponse): void {
    if (req.url === '/health' || req.url === '/') {
      const stats = this.getStats();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'ok',
        rooms: stats.rooms,       // V1 legacy rooms
        servers: stats.servers,   // V2 registered servers
        clients: stats.clients,
        uptime: process.uptime()
      }));
    } else {
      res.writeHead(404);
      res.end('Not found');
    }
  }

  /**
   * Start the relay server
   */
  async start(): Promise<void> {
    // Create HTTP(S) server with request handler
    const requestHandler = (req: IncomingMessage, res: ServerResponse) => {
      this.handleHttpRequest(req, res);
    };

    const server = this.config.tls
      ? createHttpsServer({
          cert: readFileSync(this.config.tls.cert),
          key: readFileSync(this.config.tls.key)
        }, requestHandler)
      : createHttpServer(requestHandler);

    // Create WebSocket server
    this.wss = new WebSocketServer({ server });

    this.wss.on('connection', (ws: WebSocket, req: unknown) => {
      this.handleConnection(ws, req);
    });

    // Start cleanup interval
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredRooms();
    }, 60000); // Every minute

    // Start listening
    return new Promise((resolve) => {
      server.listen(this.config.port, this.config.host, () => {
        console.log(`[Relay] Server running on ${this.config.host}:${this.config.port}`);
        console.log(`[Relay] TLS: ${this.config.tls ? 'enabled' : 'disabled'}`);
        resolve();
      });
    });
  }

  /**
   * Stop the relay server
   */
  async stop(): Promise<void> {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    if (this.wss) {
      return new Promise((resolve) => {
        this.wss!.close(() => {
          console.log('[Relay] Server stopped');
          resolve();
        });
      });
    }
  }

  /**
   * Handle new WebSocket connection
   */
  private handleConnection(ws: WebSocket, _req: unknown): void {
    const clientId = this.generateClientId();

    const client: ConnectedClient = {
      ws,
      id: clientId,
      isDesktop: false,
      protocolVersion: 1  // Default to v1, upgraded on v2 register/connect
    };

    this.clients.set(ws, client);
    console.log(`[Relay] Client connected: ${clientId}`);

    ws.on('message', (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString()) as RelayMessage;
        this.handleMessage(ws, client, message);
      } catch {
        this.sendError(ws, 'INVALID_MESSAGE', 'Failed to parse message');
      }
    });

    ws.on('close', () => {
      this.handleDisconnect(client);
    });

    ws.on('error', (err: Error) => {
      console.error(`[Relay] WebSocket error for ${clientId}:`, err.message);
    });
  }

  /**
   * Handle incoming message
   */
  private handleMessage(ws: WebSocket, client: ConnectedClient, message: RelayMessage): void {
    switch (message.type) {
      // V1 (Legacy)
      case 'register':
        this.handleRegister(ws, client, message as RegisterMessage);
        break;

      case 'join':
        this.handleJoin(ws, client, message as JoinMessage);
        break;

      // V2 (Device Trust)
      case 'register-v2':
        this.handleRegisterV2(ws, client, message as RegisterV2Message);
        break;

      case 'connect':
        this.handleConnect(ws, client, message as ConnectMessage);
        break;

      // Common
      case 'data':
        this.handleData(client, message as DataMessage);
        break;

      case 'ping':
        this.send(ws, { type: 'pong', timestamp: Date.now() });
        break;

      default:
        this.sendError(ws, 'UNKNOWN_TYPE', `Unknown message type: ${message.type}`);
    }
  }

  /**
   * Handle desktop registration with static room ID
   */
  private handleRegister(ws: WebSocket, client: ConnectedClient, message: RegisterMessage): void {
    const { publicKey, roomId, passwordHash, serverName } = message.payload;

    if (!roomId) {
      this.sendError(ws, 'MISSING_ROOM_ID', 'Room ID is required');
      return;
    }

    const normalizedRoomId = normalizeCode(roomId);

    if (this.rooms.has(normalizedRoomId)) {
      // Room exists - update desktop connection (reconnection)
      const existingRoom = this.rooms.get(normalizedRoomId)!;

      // Update the desktop connection
      existingRoom.desktopId = client.id;
      existingRoom.desktopPublicKey = publicKey;
      existingRoom.isDesktopOnline = true;
      existingRoom.lastDesktopSeen = Date.now();

      // Update password if provided (allows changing password)
      if (passwordHash !== undefined) {
        existingRoom.passwordHash = passwordHash || undefined;
      }
      if (serverName) {
        existingRoom.serverName = serverName;
      }

      console.log(`[Relay] Desktop reconnected to room: ${normalizedRoomId}`);

      // Notify any waiting peers that desktop is back
      for (const [peerId] of existingRoom.peers) {
        const peerClient = this.findClientById(peerId);
        if (peerClient) {
          this.send(peerClient.ws, {
            type: 'joined',
            payload: {
              desktopPublicKey: publicKey,
              serverName: existingRoom.serverName
            },
            timestamp: Date.now()
          });
        }
      }
    } else {
      // Create new room with static ID
      const room: RelayRoom = {
        roomId: normalizedRoomId,
        desktopId: client.id,
        desktopPublicKey: publicKey,
        passwordHash: passwordHash || undefined,
        serverName: serverName || undefined,
        peers: new Map(),
        createdAt: Date.now(),
        lastDesktopSeen: Date.now(),
        isDesktopOnline: true
      };

      this.rooms.set(normalizedRoomId, room);
      console.log(`[Relay] Desktop created room: ${normalizedRoomId}${passwordHash ? ' (password protected)' : ''}`);
    }

    // Update client
    client.isDesktop = true;
    client.roomCode = normalizedRoomId;
    client.publicKey = publicKey;

    // Send confirmation
    this.send(ws, {
      type: 'registered',
      payload: {
        roomId: normalizedRoomId,
        hasPassword: !!this.rooms.get(normalizedRoomId)!.passwordHash
      },
      timestamp: Date.now()
    });

    console.log(`[Relay] Desktop registered: ${normalizedRoomId}`);
  }

  /**
   * Handle mobile join request
   */
  private handleJoin(ws: WebSocket, client: ConnectedClient, message: JoinMessage): void {
    const { roomId, publicKey, deviceName, userAgent, passwordHash } = message.payload;

    // Support both old 'code' field and new 'roomId' field for backwards compatibility
    const roomIdToUse = roomId || (message.payload as any).code;
    if (!roomIdToUse) {
      this.sendError(ws, 'MISSING_ROOM_ID', 'Room ID is required');
      return;
    }

    const normalizedRoomId = normalizeCode(roomIdToUse);

    // Find room
    const room = this.rooms.get(normalizedRoomId);
    if (!room) {
      this.sendError(ws, 'ROOM_NOT_FOUND', 'Room not found. Make sure the desktop app is running.');
      return;
    }

    // Check password if room requires it
    if (room.passwordHash) {
      if (!passwordHash) {
        // Password required but not provided - request it
        this.send(ws, {
          type: 'auth-required',
          payload: {
            roomId: normalizedRoomId,
            serverName: room.serverName
          },
          timestamp: Date.now()
        });
        return;
      }

      // Verify password hash matches
      if (passwordHash !== room.passwordHash) {
        this.sendError(ws, 'INVALID_PASSWORD', 'Incorrect password');
        return;
      }
    }

    // Check if room is full
    if (room.peers.size >= this.config.maxPeersPerRoom) {
      this.sendError(ws, 'ROOM_FULL', 'Maximum devices reached');
      return;
    }

    // Check if desktop is online
    if (!room.isDesktopOnline || !room.desktopId) {
      // Still add peer to room - they'll get notified when desktop comes back
      const peer: RelayPeer = {
        id: client.id,
        publicKey,
        deviceName,
        userAgent,
        connectedAt: Date.now()
      };
      room.peers.set(client.id, peer);
      client.roomCode = normalizedRoomId;
      client.publicKey = publicKey;

      this.sendError(ws, 'DESKTOP_OFFLINE', 'Desktop is currently offline. Waiting for connection...');
      return;
    }

    // Add peer to room
    const peer: RelayPeer = {
      id: client.id,
      publicKey,
      deviceName,
      userAgent,
      connectedAt: Date.now()
    };

    room.peers.set(client.id, peer);

    // Update client
    client.roomCode = normalizedRoomId;
    client.publicKey = publicKey;

    // Notify mobile of success
    this.send(ws, {
      type: 'joined',
      payload: {
        desktopPublicKey: room.desktopPublicKey,
        serverName: room.serverName
      },
      timestamp: Date.now()
    });

    // Notify desktop of new peer
    const desktopClient = this.findClientById(room.desktopId);
    if (desktopClient) {
      this.send(desktopClient.ws, {
        type: 'peer-joined',
        payload: {
          peerId: client.id,
          publicKey,
          deviceName,
          userAgent
        },
        timestamp: Date.now()
      });
    }

    console.log(`[Relay] Mobile joined ${normalizedRoomId}: ${deviceName}`);
  }

  /**
   * Handle data relay (E2E encrypted)
   */
  private handleData(client: ConnectedClient, message: DataMessage): void {
    // V2 uses serverId instead of roomCode
    if (client.protocolVersion === 2) {
      this.handleDataV2(client, message);
      return;
    }

    // V1: room-based routing
    if (!client.roomCode) {
      return;
    }

    const room = this.rooms.get(client.roomCode);
    if (!room) {
      return;
    }

    const { to, encrypted, nonce } = message.payload;

    if (client.isDesktop) {
      // Desktop sending to specific peer or broadcast
      if (to) {
        // Send to specific peer
        const targetClient = this.findClientById(to);
        if (targetClient) {
          this.send(targetClient.ws, {
            type: 'data',
            payload: { encrypted, nonce, from: client.id },
            timestamp: Date.now()
          });
        }
      } else {
        // Broadcast to all peers
        for (const [peerId] of room.peers) {
          const peerClient = this.findClientById(peerId);
          if (peerClient) {
            this.send(peerClient.ws, {
              type: 'data',
              payload: { encrypted, nonce, from: client.id },
              timestamp: Date.now()
            });
          }
        }
      }
    } else {
      // Mobile sending to desktop
      if (room.desktopId) {
        const desktopClient = this.findClientById(room.desktopId);
        if (desktopClient) {
          this.send(desktopClient.ws, {
            type: 'data',
            payload: { encrypted, nonce, from: client.id },
            timestamp: Date.now()
          });
        }
      }
    }
  }

  // ========================================
  // V2 Handlers (Device Trust Model)
  // ========================================

  /**
   * Handle server registration (V2)
   */
  private handleRegisterV2(ws: WebSocket, client: ConnectedClient, message: RegisterV2Message): void {
    const { serverId, serverPublicKey, serverName, protocolVersion } = message.payload;

    if (!serverId || !serverPublicKey) {
      this.sendError(ws, 'MISSING_FIELDS', 'serverId and serverPublicKey required');
      return;
    }

    // Check if server already exists
    const existing = this.servers.get(serverId);
    if (existing) {
      // Reconnection - update the connection
      existing.clientId = client.id;
      existing.isOnline = true;
      existing.lastSeen = Date.now();
      if (serverName) existing.serverName = serverName;

      console.log(`[Relay] Server reconnected (v2): ${serverId}`);

      // Notify any waiting devices that server is back
      for (const [, peer] of existing.peers) {
        const peerClient = this.findClientById(peer.clientId);
        if (peerClient) {
          this.send(peerClient.ws, {
            type: 'connected',
            payload: {
              serverPublicKey: existing.serverPublicKey,
              serverName: existing.serverName
            },
            timestamp: Date.now()
          });
        }
      }
    } else {
      // New server registration
      const serverState: RelayServerState = {
        serverId,
        clientId: client.id,
        serverPublicKey,
        serverName,
        peers: new Map(),
        createdAt: Date.now(),
        lastSeen: Date.now(),
        isOnline: true,
        protocolVersion: protocolVersion || 2
      };

      this.servers.set(serverId, serverState);
      console.log(`[Relay] Server registered (v2): ${serverId} - ${serverName || 'unnamed'}`);
    }

    // Update client
    client.isDesktop = true;
    client.serverId = serverId;
    client.publicKey = serverPublicKey;
    client.protocolVersion = 2;

    // Send confirmation
    this.send(ws, {
      type: 'registered-v2',
      payload: { serverId },
      timestamp: Date.now()
    });
  }

  /**
   * Handle device connection request (V2)
   * Note: The relay just routes the request to the server.
   * The server decides if the device is trusted.
   */
  private handleConnect(ws: WebSocket, client: ConnectedClient, message: ConnectMessage): void {
    const { serverId, deviceId, devicePublicKey, deviceName, protocolVersion } = message.payload;

    if (!serverId || !deviceId || !devicePublicKey) {
      this.sendError(ws, 'MISSING_FIELDS', 'serverId, deviceId, and devicePublicKey required');
      return;
    }

    // Find the server
    const server = this.servers.get(serverId);
    if (!server) {
      this.sendError(ws, 'SERVER_NOT_FOUND', 'Server not found. Make sure the server is running.');
      return;
    }

    // Check if server is online
    if (!server.isOnline || !server.clientId) {
      this.sendError(ws, 'SERVER_OFFLINE', 'Server is currently offline.');
      return;
    }

    // Check peer limit
    if (server.peers.size >= this.config.maxPeersPerRoom) {
      this.sendError(ws, 'SERVER_FULL', 'Maximum devices reached');
      return;
    }

    // Update client
    client.serverId = serverId;
    client.deviceId = deviceId;
    client.publicKey = devicePublicKey;
    client.protocolVersion = 2;

    // Add peer to server (pending trust verification)
    const peer: RelayPeerV2 = {
      deviceId,
      clientId: client.id,
      publicKey: devicePublicKey,
      deviceName,
      connectedAt: Date.now()
    };
    server.peers.set(deviceId, peer);

    // Forward connection request to server for trust verification
    const serverClient = this.findClientById(server.clientId);
    if (serverClient) {
      this.send(serverClient.ws, {
        type: 'peer-joined',
        payload: {
          peerId: client.id,
          deviceId,
          publicKey: devicePublicKey,
          deviceName,
          protocolVersion: protocolVersion || 2
        },
        timestamp: Date.now()
      });
    }

    // The server will respond with 'connected' (trusted) or 'trust-required' (not trusted)
    // For now, optimistically send connected (server can reject via 'trust-required')
    this.send(ws, {
      type: 'connected',
      payload: {
        serverPublicKey: server.serverPublicKey,
        serverName: server.serverName
      },
      timestamp: Date.now()
    });

    console.log(`[Relay] Device connected (v2): ${deviceName} -> ${serverId}`);
  }

  /**
   * Handle data relay (V2) - uses serverId instead of roomCode
   */
  private handleDataV2(client: ConnectedClient, message: DataMessage): void {
    if (!client.serverId) {
      return;
    }

    const server = this.servers.get(client.serverId);
    if (!server) {
      return;
    }

    const { to, encrypted, nonce } = message.payload;

    if (client.isDesktop) {
      // Server sending to specific device or broadcast
      if (to) {
        const peer = server.peers.get(to as DeviceId);
        if (peer) {
          const peerClient = this.findClientById(peer.clientId);
          if (peerClient) {
            this.send(peerClient.ws, {
              type: 'data',
              payload: { encrypted, nonce, from: client.id },
              timestamp: Date.now()
            });
          }
        }
      } else {
        // Broadcast to all connected devices
        for (const [, peer] of server.peers) {
          const peerClient = this.findClientById(peer.clientId);
          if (peerClient) {
            this.send(peerClient.ws, {
              type: 'data',
              payload: { encrypted, nonce, from: client.id },
              timestamp: Date.now()
            });
          }
        }
      }
    } else {
      // Device sending to server
      if (server.clientId) {
        const serverClient = this.findClientById(server.clientId);
        if (serverClient) {
          this.send(serverClient.ws, {
            type: 'data',
            payload: { encrypted, nonce, from: client.id, deviceId: client.deviceId },
            timestamp: Date.now()
          });
        }
      }
    }
  }

  /**
   * Handle V2 client disconnect
   */
  private handleDisconnectV2(client: ConnectedClient): void {
    if (!client.serverId) return;

    const server = this.servers.get(client.serverId);
    if (!server) return;

    if (client.isDesktop) {
      // Server went offline
      server.isOnline = false;
      server.clientId = null;
      server.lastSeen = Date.now();

      // Notify all connected devices
      for (const [, peer] of server.peers) {
        const peerClient = this.findClientById(peer.clientId);
        if (peerClient) {
          this.send(peerClient.ws, {
            type: 'peer-left',
            payload: { peerId: client.id },
            timestamp: Date.now()
          });
        }
      }

      console.log(`[Relay] Server offline (v2): ${client.serverId}`);
    } else if (client.deviceId) {
      // Device disconnected
      server.peers.delete(client.deviceId);

      // Notify server
      if (server.clientId) {
        const serverClient = this.findClientById(server.clientId);
        if (serverClient) {
          this.send(serverClient.ws, {
            type: 'peer-left',
            payload: { peerId: client.id, deviceId: client.deviceId },
            timestamp: Date.now()
          });
        }
      }

      console.log(`[Relay] Device disconnected (v2): ${client.deviceId}`);
    }
  }

  /**
   * Handle client disconnect
   */
  private handleDisconnect(client: ConnectedClient): void {
    console.log(`[Relay] Client disconnected: ${client.id}`);

    // Handle V2 disconnect
    if (client.protocolVersion === 2) {
      this.handleDisconnectV2(client);
      this.clients.delete(client.ws);
      return;
    }

    // V1 disconnect handling
    if (client.roomCode) {
      const room = this.rooms.get(client.roomCode);
      if (room) {
        if (client.isDesktop) {
          // Desktop disconnected - mark room as offline
          room.isDesktopOnline = false;
          room.desktopId = null;
          room.lastDesktopSeen = Date.now();

          // Notify all peers that desktop went offline
          for (const [peerId] of room.peers) {
            const peerClient = this.findClientById(peerId);
            if (peerClient) {
              this.send(peerClient.ws, {
                type: 'peer-left',
                payload: { peerId: client.id },
                timestamp: Date.now()
              });
            }
          }
          // Don't delete room - it's static and will persist for reconnection
          console.log(`[Relay] Desktop offline for room: ${client.roomCode}`);
        } else {
          // Mobile disconnected - remove from room and notify desktop
          room.peers.delete(client.id);

          if (room.desktopId) {
            const desktopClient = this.findClientById(room.desktopId);
            if (desktopClient) {
              this.send(desktopClient.ws, {
                type: 'peer-left',
                payload: { peerId: client.id },
                timestamp: Date.now()
              });
            }
          }
        }
      }
    }

    this.clients.delete(client.ws);
  }

  /**
   * Clean up abandoned rooms (desktop offline for too long)
   */
  private cleanupExpiredRooms(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [roomId, room] of this.rooms) {
      // Only clean up rooms where:
      // 1. Desktop is offline
      // 2. No peers connected
      // 3. Desktop has been offline longer than cleanup threshold
      if (!room.isDesktopOnline &&
          room.peers.size === 0 &&
          (now - room.lastDesktopSeen) > this.config.roomCleanupMs) {
        this.rooms.delete(roomId);
        cleaned++;
        console.log(`[Relay] Cleaned up abandoned room: ${roomId}`);
      }
    }

    if (cleaned > 0) {
      console.log(`[Relay] Cleaned up ${cleaned} abandoned rooms`);
    }
  }

  /**
   * Find client by ID
   */
  private findClientById(id: string): ConnectedClient | undefined {
    for (const client of this.clients.values()) {
      if (client.id === id) {
        return client;
      }
    }
    return undefined;
  }

  /**
   * Send message to client
   */
  private send(ws: WebSocket, message: RelayMessage): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  /**
   * Send error to client
   */
  private sendError(ws: WebSocket, code: string, message: string): void {
    this.send(ws, {
      type: 'error',
      payload: { code, message },
      timestamp: Date.now()
    });
  }

  /**
   * Generate unique client ID
   */
  private generateClientId(): string {
    return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get server stats
   */
  getStats(): { rooms: number; servers: number; clients: number } {
    return {
      rooms: this.rooms.size,      // V1 rooms
      servers: this.servers.size,  // V2 servers
      clients: this.clients.size
    };
  }
}

// CLI entry point
if (require.main === module) {
  const port = parseInt(process.env.PORT || '9484', 10);
  const server = new RelayServer({ port });

  server.start().then(() => {
    console.log('\n========================================');
    console.log('  Audiio Relay Server');
    console.log('========================================');
    console.log(`  Port: ${port}`);
    console.log('  Ready for connections');
    console.log('========================================\n');
  });

  process.on('SIGINT', async () => {
    await server.stop();
    process.exit(0);
  });
}

export { generateCode, normalizeCode } from '../shared/codes';
export * from '../shared/types';
