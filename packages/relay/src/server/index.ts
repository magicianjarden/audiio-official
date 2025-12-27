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
  DataMessage
} from '../shared/types';
import { generateCode, normalizeCode } from '../shared/codes';

interface ConnectedClient {
  ws: WebSocket;
  id: string;
  isDesktop: boolean;
  roomCode?: string;
  publicKey?: string;
}

export class RelayServer {
  private wss: WebSocketServer | null = null;
  private config: RelayServerConfig;
  private rooms = new Map<string, RelayRoom>();
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
        rooms: stats.rooms,
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
      isDesktop: false
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
      case 'register':
        this.handleRegister(ws, client, message as RegisterMessage);
        break;

      case 'join':
        this.handleJoin(ws, client, message as JoinMessage);
        break;

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
   * Handle desktop registration
   */
  private handleRegister(ws: WebSocket, client: ConnectedClient, message: RegisterMessage): void {
    const { publicKey, requestedCode } = message.payload;

    // Check if requesting a specific code (reconnection)
    let code: string;
    if (requestedCode && this.rooms.has(requestedCode)) {
      const existingRoom = this.rooms.get(requestedCode)!;
      // Verify it's the same desktop (would need auth in production)
      code = requestedCode;
      // Update the desktop connection
      existingRoom.desktopId = client.id;
      existingRoom.desktopPublicKey = publicKey;
    } else {
      // Generate new unique code
      do {
        code = generateCode();
      } while (this.rooms.has(code));

      // Create room
      const room: RelayRoom = {
        code,
        desktopId: client.id,
        desktopPublicKey: publicKey,
        peers: new Map(),
        createdAt: Date.now(),
        expiresAt: Date.now() + this.config.codeExpiryMs
      };

      this.rooms.set(code, room);
    }

    // Update client
    client.isDesktop = true;
    client.roomCode = code;
    client.publicKey = publicKey;

    // Send confirmation
    this.send(ws, {
      type: 'registered',
      payload: {
        code,
        expiresAt: this.rooms.get(code)!.expiresAt
      },
      timestamp: Date.now()
    });

    console.log(`[Relay] Desktop registered: ${code}`);
  }

  /**
   * Handle mobile join request
   */
  private handleJoin(ws: WebSocket, client: ConnectedClient, message: JoinMessage): void {
    const { code, publicKey, deviceName, userAgent } = message.payload;
    const normalizedCode = normalizeCode(code);

    // Find room
    const room = this.rooms.get(normalizedCode);
    if (!room) {
      this.sendError(ws, 'ROOM_NOT_FOUND', 'Invalid or expired connection code');
      return;
    }

    // Check if room is full
    if (room.peers.size >= this.config.maxPeersPerRoom) {
      this.sendError(ws, 'ROOM_FULL', 'Maximum devices reached');
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
    client.roomCode = normalizedCode;
    client.publicKey = publicKey;

    // Extend room expiry since someone joined
    room.expiresAt = Date.now() + (30 * 60 * 1000); // 30 minutes

    // Notify mobile of success
    this.send(ws, {
      type: 'joined',
      payload: {
        desktopPublicKey: room.desktopPublicKey
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

    console.log(`[Relay] Mobile joined ${normalizedCode}: ${deviceName}`);
  }

  /**
   * Handle data relay (E2E encrypted)
   */
  private handleData(client: ConnectedClient, message: DataMessage): void {
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

  /**
   * Handle client disconnect
   */
  private handleDisconnect(client: ConnectedClient): void {
    console.log(`[Relay] Client disconnected: ${client.id}`);

    if (client.roomCode) {
      const room = this.rooms.get(client.roomCode);
      if (room) {
        if (client.isDesktop) {
          // Desktop disconnected - notify all peers
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
          // Don't delete room immediately - desktop may reconnect
          // Room will be cleaned up by expiry
        } else {
          // Mobile disconnected - remove from room and notify desktop
          room.peers.delete(client.id);

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

    this.clients.delete(client.ws);
  }

  /**
   * Clean up expired rooms
   */
  private cleanupExpiredRooms(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [code, room] of this.rooms) {
      if (now > room.expiresAt && room.peers.size === 0) {
        this.rooms.delete(code);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      console.log(`[Relay] Cleaned up ${cleaned} expired rooms`);
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
  getStats(): { rooms: number; clients: number } {
    return {
      rooms: this.rooms.size,
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
