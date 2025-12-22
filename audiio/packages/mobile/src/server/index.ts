/**
 * @audiio/mobile - Server Entry Point
 *
 * Creates a personal streaming server that can be accessed
 * from mobile devices on local network or via secure tunnel.
 */

import Fastify from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import rateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import * as path from 'path';

import { AccessManager } from './services/access-manager';
import { SessionManager } from './services/session-manager';
import { TunnelManager } from './tunnel/tunnel-manager';
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
  };
}

export class MobileServer {
  private fastify = Fastify({ logger: true });
  private config: ServerConfig;
  private accessManager: AccessManager;
  private sessionManager: SessionManager;
  private tunnelManager: TunnelManager;
  private isRunning = false;
  private webDistPath: string;

  constructor(private options: MobileServerOptions = {}) {
    this.config = { ...DEFAULT_SERVER_CONFIG, ...options.config };
    this.accessManager = new AccessManager();
    this.sessionManager = new SessionManager();
    this.tunnelManager = new TunnelManager(this.config.tunnelProvider);
    // __dirname is dist/server/server, web is at dist/web, so go up two levels
    this.webDistPath = path.join(__dirname, '../../web');
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
      allowedHeaders: ['Content-Type', 'Authorization', 'Bypass-Tunnel-Reminder']
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

    // Generate access config
    const localUrl = `http://${getLocalIP()}:${actualPort}`;
    let tunnelUrl: string | undefined;
    let tunnelPassword: string | undefined;

    // Start tunnel if enabled
    if (this.config.enableTunnel) {
      try {
        const tunnelInfo = await this.tunnelManager.start(actualPort, this.config.tunnelSubdomain);
        tunnelUrl = tunnelInfo.url;
        tunnelPassword = tunnelInfo.password;
        console.log(`[Tunnel] URL: ${tunnelUrl}`);
        if (tunnelPassword) {
          console.log(`[Tunnel] Bypass password: ${tunnelPassword}`);
        }
      } catch (error) {
        console.error('Failed to start tunnel:', error);
      }
    }

    const access = await this.accessManager.generateAccess(localUrl, tunnelUrl, tunnelPassword);

    console.log('[Mobile] Generated access config:');
    console.log('[Mobile]   localUrl:', access.localUrl);
    console.log('[Mobile]   tunnelUrl:', access.tunnelUrl);
    console.log('[Mobile]   tunnelPassword:', access.tunnelPassword);
    console.log('[Mobile]   hasQrCode:', !!access.qrCode);

    this.options.onReady?.(access);

    console.log(`Mobile server running at ${localUrl}`);
    if (tunnelUrl) {
      console.log(`Remote access: ${tunnelUrl}`);
    }

    return access;
  }

  async stop(): Promise<void> {
    if (!this.isRunning) return;

    await this.tunnelManager.stop();
    await this.fastify.close();
    this.isRunning = false;
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
    config: {
      enableTunnel: process.argv.includes('--tunnel')
    },
    onReady: (access) => {
      console.log('\n========================================');
      console.log('Audiio Mobile Portal Ready!');
      console.log('========================================');
      console.log(`Local:  ${access.localUrl}`);
      if (access.tunnelUrl) {
        console.log(`Remote: ${access.tunnelUrl}`);
      }
      console.log(`Token:  ${access.token}`);
      console.log('========================================\n');
    }
  });

  server.start().catch(console.error);

  process.on('SIGINT', async () => {
    await server.stop();
    process.exit(0);
  });
}

export { AccessManager, SessionManager, TunnelManager };
export { AuthManager } from './services/auth-manager';
