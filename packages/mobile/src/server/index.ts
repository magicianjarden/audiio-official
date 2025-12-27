/**
 * @audiio/mobile - Server Entry Point
 *
 * Creates a personal streaming server that can be accessed
 * from mobile devices on local network or via P2P (anywhere).
 */

import Fastify from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import rateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import * as path from 'path';
import type { WebSocket } from 'ws';

import { AccessManager } from './services/access-manager';
import { SessionManager } from './services/session-manager';
import { P2PManager, type P2PPeer } from './services/p2p-manager';
import { registerApiRoutes } from './api/routes';
import { authMiddleware } from './middleware/auth';
import type { ServerConfig, AccessConfig } from '../shared/types';
import { DEFAULT_SERVER_CONFIG } from '../shared/types';

export interface MobileServerOptions {
  config?: Partial<ServerConfig>;
  /** Callback when server is ready with access URLs */
  onReady?: (access: AccessConfig) => void;
  /** Core orchestrators from desktop app */
  orchestrators?: {
    search?: unknown;
    trackResolver?: unknown;
    playback?: unknown;
    registry?: unknown;
    /** Metadata provider for trending, charts, etc. */
    metadata?: unknown;
    /** Auth manager for enhanced authentication */
    authManager?: unknown;
    /** Library bridge for syncing likes/playlists with desktop */
    libraryBridge?: unknown;
    /** ML service for recommendations and audio features (optional) */
    mlService?: unknown;
  };
}

export class MobileServer {
  private fastify = Fastify({ logger: true });
  private config: ServerConfig;
  private accessManager: AccessManager;
  private sessionManager: SessionManager;
  private p2pManager: P2PManager;
  private isRunning = false;
  private webDistPath: string;
  private p2pInfo: { code: string } | null = null;
  private p2pApprovalCallback?: (peer: P2PPeer) => void;
  private cleanupInterval: NodeJS.Timeout | null = null;

  // Session cleanup interval (1 minute)
  private readonly CLEANUP_INTERVAL = 60 * 1000;

  constructor(private options: MobileServerOptions = {}) {
    this.config = { ...DEFAULT_SERVER_CONFIG, ...options.config };
    this.accessManager = new AccessManager();
    this.sessionManager = new SessionManager();
    this.p2pManager = new P2PManager();
    // __dirname is dist/server/server, web is at dist/web, so go up two levels
    this.webDistPath = path.join(__dirname, '../../web');

    // Set up P2P event handlers
    this.setupP2PHandlers();
  }

  /**
   * Set up event handlers for P2P connections
   */
  private setupP2PHandlers(): void {
    this.p2pManager.on('peer-joined', (peer: P2PPeer) => {
      console.log(`[Mobile] P2P peer connected: ${peer.deviceName}`);
      if (this.p2pApprovalCallback) {
        this.p2pApprovalCallback(peer);
      }
    });

    this.p2pManager.on('peer-updated', (peer: P2PPeer) => {
      console.log(`[Mobile] P2P peer identified: ${peer.deviceName}`);
    });

    this.p2pManager.on('peer-left', (peerId: string) => {
      console.log(`[Mobile] P2P peer disconnected: ${peerId}`);
    });

    this.p2pManager.on('message', (peerId: string, message: unknown) => {
      console.log(`[Mobile] P2P message from ${peerId}:`, message);
      this.handleP2PMessage(peerId, message);
    });
  }

  /**
   * Handle messages received via P2P
   */
  private handleP2PMessage(peerId: string, message: unknown): void {
    const msg = message as { type: string; payload?: unknown; requestId?: string };

    switch (msg.type) {
      case 'api-request':
        this.handleP2PApiRequest(peerId, msg);
        break;
      case 'playback-command':
        this.handleP2PPlaybackCommand(peerId, msg);
        break;
      default:
        console.log(`[Mobile] Unknown P2P message type: ${msg.type}`);
    }
  }

  private handleP2PApiRequest(peerId: string, msg: { requestId?: string; payload?: unknown }): void {
    // Process API request and send response back via P2P
    this.p2pManager.send({
      type: 'api-response',
      requestId: msg.requestId,
      success: true
    }, peerId);
  }

  private handleP2PPlaybackCommand(peerId: string, msg: { requestId?: string; payload?: unknown }): void {
    // Forward playback commands to desktop playback orchestrator
    this.p2pManager.send({
      type: 'command-ack',
      requestId: msg.requestId,
      success: true
    }, peerId);
  }

  /**
   * Register all plugins and middleware on the Fastify instance
   */
  private async registerPlugins(): Promise<void> {
    // CORS
    await this.fastify.register(cors, {
      origin: true,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization']
    });

    // Rate limiting
    await this.fastify.register(rateLimit, {
      max: this.config.rateLimit,
      timeWindow: '1 minute'
    });

    // WebSocket
    await this.fastify.register(websocket);

    // Static file serving
    await this.registerStaticFiles();

    // Auth middleware
    this.fastify.addHook('onRequest', authMiddleware(this.accessManager, this.sessionManager));

    // API routes
    registerApiRoutes(this.fastify, {
      accessManager: this.accessManager,
      sessionManager: this.sessionManager,
      orchestrators: this.options.orchestrators
    });

    // WebSocket handler
    this.registerWebSocketHandler();
  }

  /**
   * Register static file serving with SPA fallback
   */
  private async registerStaticFiles(): Promise<void> {
    console.log('[Mobile] __dirname:', __dirname);
    console.log('[Mobile] Web dist path:', this.webDistPath);

    try {
      const fs = await import('fs');
      const exists = fs.existsSync(this.webDistPath);
      console.log('[Mobile] Web dist exists:', exists);

      if (exists) {
        const files = fs.readdirSync(this.webDistPath);
        console.log('[Mobile] Web dist contents:', files);

        // Register static files with wildcard: false for SPA support
        await this.fastify.register(fastifyStatic, {
          root: this.webDistPath,
          prefix: '/',
          wildcard: false
        });

        // SPA fallback - serve index.html for non-API, non-asset routes
        this.fastify.setNotFoundHandler(async (request, reply) => {
          const url = request.url;
          const pathname = new URL(url, `http://${request.headers.host}`).pathname;

          // Don't serve index.html for API routes, WebSocket, or file requests with extensions
          if (pathname.startsWith('/api/') || pathname.startsWith('/ws') ||
              (pathname.includes('.') && !pathname.endsWith('.html'))) {
            return reply.code(404).send({ error: 'Not found', path: pathname });
          }

          // Serve index.html for SPA routes
          console.log(`[Mobile] SPA fallback: ${pathname} -> index.html`);
          return reply.sendFile('index.html');
        });

        console.log('[Mobile] Static file serving with SPA fallback registered');
      } else {
        console.log('[Mobile] Web dist not found, API-only mode');
      }
    } catch (staticError) {
      console.log('[Mobile] Static file serving error:', staticError);
    }
  }

  /**
   * Register WebSocket handler for real-time sync
   */
  private registerWebSocketHandler(): void {
    this.fastify.get('/ws', { websocket: true }, (socket, req) => {
      const token = new URL(req.url!, `http://${req.headers.host}`).searchParams.get('token');

      if (!token || !this.accessManager.validateToken(token)) {
        socket.close(4001, 'Invalid token');
        return;
      }

      const session = this.sessionManager.createSession(token, req.headers['user-agent']);

      socket.on('message', (message: Buffer) => {
        try {
          const data = JSON.parse(message.toString());
          this.handleWebSocketMessage(socket, session.id, data);
        } catch {
          // Invalid JSON, ignore
        }
      });

      socket.on('close', () => {
        this.sessionManager.endSession(session.id);
      });

      // Send initial state
      socket.send(JSON.stringify({
        type: 'session-update',
        payload: { sessionId: session.id }
      }));
    });
  }

  async start(): Promise<AccessConfig> {
    if (this.isRunning) {
      throw new Error('Server is already running');
    }

    // Register all plugins
    await this.registerPlugins();

    // Start server with port fallback
    let actualPort = this.config.port;
    const maxPortAttempts = 10;

    for (let attempt = 0; attempt < maxPortAttempts; attempt++) {
      try {
        await this.fastify.listen({
          port: actualPort,
          host: '0.0.0.0'
        });
        console.log(`[Mobile] Server listening on port ${actualPort}`);
        break;
      } catch (err: any) {
        if (err.code === 'EADDRINUSE' && attempt < maxPortAttempts - 1) {
          console.log(`[Mobile] Port ${actualPort} in use, trying ${actualPort + 1}...`);
          actualPort++;
          // Create new Fastify instance and re-register all plugins
          this.fastify = Fastify({ logger: false });
          await this.registerPlugins();
        } else {
          throw err;
        }
      }
    }

    this.isRunning = true;
    this.config.port = actualPort; // Update config with actual port

    // Start session cleanup interval
    this.cleanupInterval = setInterval(() => {
      const cleaned = this.sessionManager.cleanupStale();
      if (cleaned > 0) {
        console.log(`[Mobile] Cleaned up ${cleaned} stale sessions`);
      }
    }, this.CLEANUP_INTERVAL);

    // Generate access config
    const localUrl = `http://${getLocalIP()}:${actualPort}`;

    // Start P2P for remote access (serverless - no backend needed!)
    console.log('[P2P] Starting P2P for remote access...');
    try {
      this.p2pInfo = await this.p2pManager.startAsHost();
      console.log(`[P2P] Connection code: ${this.p2pInfo.code}`);
      console.log('[P2P] Remote access ready - works from anywhere!');
    } catch (error) {
      console.error('[P2P] Failed to start P2P:', error);
      this.p2pInfo = null;
    }

    // Set up pairing callback if authManager is available
    const authManager = this.options.orchestrators?.authManager as import('./services/auth-manager').AuthManager | undefined;
    if (authManager) {
      this.accessManager.setPairingCallback((userAgent: string) => {
        return authManager.pairDevice(userAgent);
      });
      console.log('[Mobile] Pairing callback registered with AuthManager');
    }

    const access = await this.accessManager.generateAccess(localUrl);

    // Update P2P manager with auth info so it can send to connecting peers
    if (this.p2pManager.getIsRunning() && access.token) {
      this.p2pManager.setAuthConfig(access.token, localUrl);
    }

    // Add P2P info to access config
    if (this.p2pInfo) {
      access.p2pCode = this.p2pInfo.code;
      access.p2pActive = true;
    }

    console.log('[Mobile] Generated access config:');
    console.log('[Mobile]   localUrl:', access.localUrl);
    console.log('[Mobile]   p2pCode:', access.p2pCode);
    console.log('[Mobile]   p2pActive:', access.p2pActive);
    console.log('[Mobile]   hasQrCode:', !!access.qrCode);

    this.options.onReady?.(access);

    console.log(`\n========================================`);
    console.log(`Mobile server running at ${localUrl}`);
    if (this.p2pInfo) {
      console.log(`Remote access code: ${this.p2pInfo.code}`);
      console.log(`(Works from anywhere - cellular, WiFi, etc.)`);
    }
    console.log(`========================================\n`);

    return access;
  }

  async stop(): Promise<void> {
    if (!this.isRunning) return;

    // Stop cleanup interval
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    await this.p2pManager.stop();
    await this.fastify.close();
    this.isRunning = false;
    this.p2pInfo = null;
    console.log('Mobile server stopped');
  }

  getAccessConfig(): AccessConfig | null {
    return this.accessManager.getCurrentAccess();
  }

  getSessions() {
    return this.sessionManager.getAllSessions();
  }

  /**
   * Get the auth manager for device/passphrase management
   */
  getAuthManager(): unknown {
    return this.options.orchestrators?.authManager;
  }

  /**
   * Get the access manager for pairing approval
   */
  getAccessManager(): AccessManager {
    return this.accessManager;
  }

  /**
   * Set callback for when a device requests approval
   */
  onDeviceApprovalRequest(callback: (request: { id: string; deviceName: string; userAgent: string }) => void): void {
    this.accessManager.setApprovalCallback(callback);
  }

  /**
   * Approve a pending device pairing request
   */
  approveDevice(requestId: string): boolean {
    return this.accessManager.approvePairingRequest(requestId);
  }

  /**
   * Deny a pending device pairing request
   */
  denyDevice(requestId: string): boolean {
    return this.accessManager.denyPairingRequest(requestId);
  }

  /**
   * Get pending approval requests
   */
  getPendingApprovals(): Array<{ id: string; deviceName: string; timestamp: number }> {
    return this.accessManager.getPendingRequests();
  }

  /**
   * Enable or disable desktop approval requirement
   */
  setRequireApproval(require: boolean): void {
    this.accessManager.setRequireApproval(require);
  }

  // ========================================
  // P2P Management (Remote Access)
  // ========================================

  /**
   * Get P2P connection code - this is what users enter on their phone
   */
  getP2PCode(): string | null {
    return this.p2pManager.getConnectionCode();
  }

  /**
   * Get connected P2P peers
   */
  getP2PPeers(): P2PPeer[] {
    return this.p2pManager.getPeers();
  }

  /**
   * Check if P2P is active
   */
  isP2PActive(): boolean {
    return this.p2pManager.getIsRunning();
  }

  /**
   * Set callback for when a P2P peer connects
   */
  onP2PPeerJoined(callback: (peer: P2PPeer) => void): void {
    this.p2pApprovalCallback = callback;
  }

  /**
   * Send message to a P2P peer
   */
  sendToP2PPeer(peerId: string, message: unknown): void {
    this.p2pManager.send(message, peerId);
  }

  /**
   * Broadcast message to all P2P peers
   */
  broadcastToP2PPeers(message: unknown): void {
    this.p2pManager.send(message);
  }

  private handleWebSocketMessage(socket: WebSocket, sessionId: string, data: { type: string; payload?: unknown }) {
    switch (data.type) {
      case 'ping':
        socket.send(JSON.stringify({ type: 'pong', payload: Date.now() }));
        this.sessionManager.updateActivity(sessionId);
        break;
      case 'playback-sync':
        // Broadcast to other sessions
        this.broadcastToOthers(sessionId, data);
        break;
      default:
        break;
    }
  }

  private broadcastToOthers(_excludeSessionId: string, _message: unknown) {
    // Implementation for broadcasting to other connected clients
    // This would be used for multi-device sync
  }
}

/**
 * Get local IP address for LAN access
 */
function getLocalIP(): string {
  const { networkInterfaces } = require('os');
  const nets = networkInterfaces();

  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }

  return 'localhost';
}

// CLI entry point
if (require.main === module) {
  const server = new MobileServer({
    onReady: (access) => {
      console.log('\n========================================');
      console.log('Audiio Mobile Portal Ready!');
      console.log('========================================');
      console.log(`Local:  ${access.localUrl}`);
      if (access.p2pCode) {
        console.log(`\nRemote Access Code: ${access.p2pCode}`);
        console.log('(Enter this code on your phone to connect from anywhere)');
      }
      console.log('========================================\n');
    }
  });

  server.start().catch(console.error);

  process.on('SIGINT', async () => {
    await server.stop();
    process.exit(0);
  });
}

export { AccessManager, SessionManager };
export { P2PManager, type P2PPeer, type P2PConfig } from './services/p2p-manager';
export { AuthManager } from './services/auth-manager';
