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
import * as QRCode from 'qrcode';
import type { WebSocket } from 'ws';

import { AccessManager } from './services/access-manager';
import { SessionManager } from './services/session-manager';
import { PairingService } from './services/pairing-service';
import { P2PManager, type P2PPeer } from './services/p2p-manager';
import { registerApiRoutes } from './api/routes';
import { authMiddleware } from './middleware/auth';
import type { ServerConfig, AccessConfig } from '../shared/types';
import { DEFAULT_SERVER_CONFIG } from '../shared/types';

// Playback orchestrator interface (matching desktop)
interface PlaybackOrchestrator {
  play(track: unknown): Promise<unknown>;
  pause?(): void;
  resume?(): void;
  seek?(position: number): void;
  next?(): void;
  previous?(): void;
  setVolume?(volume: number): void;
  toggleShuffle?(): void;
  toggleRepeat?(): void;
  playFromQueue?(index: number): void;
  addToQueue?(track: unknown): void;
  playNext?(track: unknown): void;
  getState?(): unknown;
}

export interface MobileServerOptions {
  config?: Partial<ServerConfig>;
  /** Callback when server is ready with access URLs */
  onReady?: (access: AccessConfig) => void;
  /** Custom relay server URL (default: wss://audiio-relay.fly.dev) */
  customRelayUrl?: string;
  /** Core orchestrators from desktop app */
  orchestrators?: {
    search?: unknown;
    trackResolver?: unknown;
    playback?: PlaybackOrchestrator;
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
  private pairingService: PairingService;
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
    this.pairingService = new PairingService({
      dataPath: (options.config as any)?.dataPath,
      customRelayUrl: options.customRelayUrl
    });
    this.p2pManager = new P2PManager({
      relayUrl: options.customRelayUrl
    });
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

  private async handleP2PApiRequest(peerId: string, msg: { requestId?: string; url?: string; method?: string; body?: unknown }): Promise<void> {
    const { requestId, url, method = 'GET', body } = msg;

    if (!url) {
      this.p2pManager.sendApiResponse(peerId, requestId || '', {
        ok: false,
        status: 400,
        data: { error: 'Missing URL' }
      });
      return;
    }

    console.log(`[P2P] API request: ${method} ${url}`);

    try {
      // Inject the request into Fastify
      const response = await this.fastify.inject({
        method: method as any,
        url,
        payload: body ? JSON.stringify(body) : undefined,
        headers: {
          'content-type': 'application/json',
          'host': 'localhost',
          // Skip auth for P2P requests - they're already authenticated via relay
          'x-p2p-request': 'true'
        }
      });

      console.log(`[P2P] API response: ${response.statusCode} for ${url}`);

      this.p2pManager.sendApiResponse(peerId, requestId || '', {
        ok: response.statusCode >= 200 && response.statusCode < 300,
        status: response.statusCode,
        data: response.json()
      });
    } catch (error) {
      console.error(`[P2P] API error for ${url}:`, error);
      this.p2pManager.sendApiResponse(peerId, requestId || '', {
        ok: false,
        status: 500,
        data: { error: error instanceof Error ? error.message : 'Internal error' }
      });
    }
  }

  private async handleP2PPlaybackCommand(peerId: string, msg: { requestId?: string; payload?: unknown }): Promise<void> {
    const orchestrators = this.options.orchestrators;
    const payload = msg.payload as { command: string; track?: unknown; position?: number; volume?: number; index?: number } | undefined;

    if (!payload?.command) {
      this.p2pManager.send({
        type: 'command-ack',
        requestId: msg.requestId,
        success: false,
        error: 'Missing command'
      }, peerId);
      return;
    }

    if (!orchestrators?.playback) {
      console.warn('[P2P] Playback command received but orchestrator not available');
      this.p2pManager.send({
        type: 'command-ack',
        requestId: msg.requestId,
        success: false,
        error: 'Playback not available'
      }, peerId);
      return;
    }

    console.log('[P2P] Playback command:', payload.command);

    try {
      switch (payload.command) {
        case 'play':
          if (payload.track) {
            await orchestrators.playback.play(payload.track);
          }
          break;
        case 'pause':
          orchestrators.playback.pause?.();
          break;
        case 'resume':
          orchestrators.playback.resume?.();
          break;
        case 'seek':
          if (typeof payload.position === 'number') {
            orchestrators.playback.seek?.(payload.position);
          }
          break;
        case 'next':
          orchestrators.playback.next?.();
          break;
        case 'previous':
          orchestrators.playback.previous?.();
          break;
        case 'volume':
          if (typeof payload.volume === 'number') {
            orchestrators.playback.setVolume?.(payload.volume);
          }
          break;
        case 'toggleShuffle':
          orchestrators.playback.toggleShuffle?.();
          break;
        case 'toggleRepeat':
          orchestrators.playback.toggleRepeat?.();
          break;
        case 'playFromQueue':
          if (typeof payload.index === 'number') {
            orchestrators.playback.playFromQueue?.(payload.index);
          }
          break;
        case 'addToQueue':
          if (payload.track) {
            orchestrators.playback.addToQueue?.(payload.track);
          }
          break;
        case 'playNext':
          if (payload.track) {
            orchestrators.playback.playNext?.(payload.track);
          }
          break;
        default:
          console.warn('[P2P] Unknown playback command:', payload.command);
      }

      this.p2pManager.send({
        type: 'command-ack',
        requestId: msg.requestId,
        success: true
      }, peerId);
    } catch (error) {
      console.error('[P2P] Playback command error:', error);
      this.p2pManager.send({
        type: 'command-ack',
        requestId: msg.requestId,
        success: false,
        error: error instanceof Error ? error.message : 'Command failed'
      }, peerId);
    }
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

    // Auth middleware - validates both legacy tokens and device tokens from pairing
    this.fastify.addHook('onRequest', authMiddleware(this.accessManager, this.sessionManager, this.pairingService));

    // API routes
    registerApiRoutes(this.fastify, {
      accessManager: this.accessManager,
      sessionManager: this.sessionManager,
      pairingService: this.pairingService,
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

      if (!token) {
        socket.close(4001, 'Token required');
        return;
      }

      // Try both token validation methods:
      // 1. AccessManager (legacy tokens)
      // 2. DeviceManager (paired device tokens in format "deviceId:token")
      let isValid = this.accessManager.validateToken(token);

      if (!isValid && token.includes(':')) {
        // Try device token format (deviceId:token)
        const deviceManager = this.pairingService.getDeviceManager?.();
        if (deviceManager) {
          const result = deviceManager.validateCombinedToken(token);
          isValid = result.valid;
        }
      }

      if (!isValid) {
        console.log('[WebSocket] Invalid token');
        socket.close(4001, 'Invalid token');
        return;
      }

      console.log('[WebSocket] Token validated, creating session');
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

    // Initialize the pairing service (loads/creates persistent server identity)
    await this.pairingService.initialize();

    // Start the pairing service (generates WORD-WORD-NUMBER code)
    const pairingCode = await this.pairingService.start(localUrl);
    console.log(`[Mobile] Pairing code: ${pairingCode.code}`);

    // Start P2P for remote access (serverless - no backend needed!)
    // Use persistent server identity for static room model
    console.log('[P2P] Starting P2P for remote access...');
    try {
      // Get persistent room ID from server identity
      const serverIdentity = this.pairingService.getServerIdentity();
      const roomId = serverIdentity?.getRelayCode();
      const serverName = serverIdentity?.getServerName() || 'Audiio Desktop';

      console.log(`[P2P] Server identity exists: ${!!serverIdentity}`);
      console.log(`[P2P] Room ID: ${roomId || 'none'}`);
      console.log(`[P2P] Server name: ${serverName}`);

      if (!roomId) {
        throw new Error('No room ID available - server identity not initialized');
      }

      // Start with static room ID and server name
      this.p2pInfo = await this.p2pManager.startAsHost(roomId, serverName);
      console.log(`[P2P] Room registered: ${this.p2pInfo.code}`);
      console.log('[P2P] Remote access ready - static room ID never changes!');

      // Sync relay code to PairingService so it accepts this code
      this.pairingService.setRelayCode(this.p2pInfo.code);
    } catch (error) {
      console.error('[P2P] Failed to start P2P:', error);
      this.p2pInfo = null;
    }

    // Generate legacy access config for backwards compatibility
    const access = await this.accessManager.generateAccess(localUrl);

    // Override with pairing service code (WORD-WORD-NUMBER format)
    access.pairingCode = pairingCode.code;

    // Update localUrl to use the new WORD-WORD-NUMBER code format
    // Old format: ?token=XXX&pair=OLD_CODE
    // New format: ?token=XXX&pair=WORD-WORD-NUMBER
    const baseUrl = localUrl.split('?')[0];
    access.localUrl = `${baseUrl}?token=${access.token}&pair=${pairingCode.code}`;

    // Use the pairing service QR code (points to URL with WORD-WORD-NUMBER)
    if (pairingCode.qrCode) {
      access.qrCode = pairingCode.qrCode;
    }

    // Update P2P manager with auth info so it can send to connecting peers
    if (this.p2pManager.getIsRunning() && access.token) {
      this.p2pManager.setAuthConfig(access.token, localUrl);
    }

    // Add P2P info to access config (set both p2p* and relay* for compatibility)
    if (this.p2pInfo) {
      access.p2pCode = this.p2pInfo.code;
      access.p2pActive = true;
      // Also set relay* aliases for desktop UI compatibility
      access.relayCode = this.p2pInfo.code;
      access.relayActive = true;

      // Generate QR code for remote access
      // The URL points to the hosted remote portal with the static room ID
      const remotePortalUrl = `https://magicianjarden.github.io/audiio-official/remote/?room=${this.p2pInfo.code}`;
      try {
        access.remoteQrCode = await QRCode.toDataURL(remotePortalUrl, {
          width: 256,
          margin: 2,
          color: {
            dark: '#ffffff',
            light: '#00000000' // Transparent background
          },
          errorCorrectionLevel: 'M'
        });
        console.log('[Mobile] Generated remote QR code for:', remotePortalUrl);
      } catch (err) {
        console.error('[Mobile] Failed to generate remote QR code:', err);
      }
    }

    console.log('[Mobile] Generated access config:');
    console.log('[Mobile]   localUrl:', access.localUrl);
    console.log('[Mobile]   p2pCode/relayCode:', access.p2pCode);
    console.log('[Mobile]   p2pActive/relayActive:', access.p2pActive);
    console.log('[Mobile]   hasQrCode:', !!access.qrCode);
    console.log('[Mobile]   hasRemoteQrCode:', !!access.remoteQrCode);

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

    // Stop pairing service
    this.pairingService.stop();

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

  // ========================================
  // Pairing Service (Device Management)
  // ========================================

  /**
   * Get the pairing service
   */
  getPairingService(): PairingService {
    return this.pairingService;
  }

  /**
   * Get current pairing code info (full object for UI)
   * Uses the relay code as the primary code (works for both local and remote)
   */
  getPairingCode(): { code: string; qrCode?: string; localUrl: string; expiresAt: number } | null {
    // Use relay code if available (works from anywhere)
    const relayCode = this.p2pManager.getConnectionCode();
    const pairingInfo = this.pairingService.getCurrentCode();

    if (!relayCode && !pairingInfo) return null;

    return {
      code: relayCode || pairingInfo?.code || '',
      qrCode: pairingInfo?.qrCode,
      localUrl: pairingInfo?.localUrl || '',
      expiresAt: pairingInfo?.expiresAt || Date.now() + 300000 // 5 min default
    };
  }

  /**
   * Refresh the pairing code
   */
  async refreshPairingCode(): Promise<{ code: string; qrCode?: string; localUrl: string; expiresAt: number } | null> {
    // Refresh the PairingService code (local QR codes etc)
    const refreshed = await this.pairingService.refreshCode();

    // Return with relay code as primary
    const relayCode = this.p2pManager.getConnectionCode();

    return {
      code: relayCode || refreshed?.code || '',
      qrCode: refreshed?.qrCode,
      localUrl: refreshed?.localUrl || '',
      expiresAt: refreshed?.expiresAt || Date.now() + 300000
    };
  }

  /**
   * Get paired devices
   */
  getDevices(): import('./services/device-manager').AuthorizedDevice[] {
    return this.pairingService.getDevices();
  }

  /**
   * Revoke a device
   */
  revokeDevice(deviceId: string): boolean {
    return this.pairingService.revokeDevice(deviceId);
  }

  /**
   * Revoke all devices
   */
  revokeAllDevices(): number {
    return this.pairingService.revokeAllDevices();
  }

  /**
   * Get custom relay URL
   */
  getRelayUrl(): string {
    return this.pairingService.getRelayUrl();
  }

  /**
   * Set custom relay URL (takes effect on next restart)
   */
  setCustomRelayUrl(url: string | null): void {
    const relayUrl = url || 'wss://audiio-relay.fly.dev';
    this.pairingService.setRelayUrl(relayUrl);
    this.p2pManager.setRelayUrl(relayUrl);
    console.log(`[Mobile] Custom relay URL set to: ${relayUrl}`);
  }

  /**
   * Get local URL
   */
  getLocalUrl(): string | null {
    return this.pairingService.getLocalUrl();
  }

  private async handleWebSocketMessage(socket: WebSocket, sessionId: string, data: { type: string; payload?: unknown }) {
    const orchestrators = this.options.orchestrators;

    switch (data.type) {
      case 'ping':
        socket.send(JSON.stringify({ type: 'pong', payload: Date.now() }));
        this.sessionManager.updateActivity(sessionId);
        break;

      case 'playback-sync':
        // Broadcast to other sessions
        this.broadcastToOthers(sessionId, data);
        break;

      case 'remote-command':
        // Handle remote playback commands from mobile
        if (!orchestrators?.playback) {
          console.warn('[Mobile] Remote command received but playback orchestrator not available');
          break;
        }

        const payload = data.payload as { command: string; track?: any; position?: number; volume?: number; index?: number };
        console.log('[Mobile] Remote command:', payload.command);

        try {
          switch (payload.command) {
            case 'play':
              if (payload.track) {
                await orchestrators.playback.play(payload.track);
              }
              break;
            case 'pause':
              orchestrators.playback.pause?.();
              break;
            case 'resume':
              orchestrators.playback.resume?.();
              break;
            case 'seek':
              if (typeof payload.position === 'number') {
                orchestrators.playback.seek?.(payload.position);
              }
              break;
            case 'next':
              orchestrators.playback.next?.();
              break;
            case 'previous':
              orchestrators.playback.previous?.();
              break;
            case 'volume':
              if (typeof payload.volume === 'number') {
                orchestrators.playback.setVolume?.(payload.volume);
              }
              break;
            case 'toggleShuffle':
              orchestrators.playback.toggleShuffle?.();
              break;
            case 'toggleRepeat':
              orchestrators.playback.toggleRepeat?.();
              break;
            case 'playFromQueue':
              if (typeof payload.index === 'number') {
                orchestrators.playback.playFromQueue?.(payload.index);
              }
              break;
            case 'addToQueue':
              if (payload.track) {
                orchestrators.playback.addToQueue?.(payload.track);
              }
              break;
            case 'playNext':
              if (payload.track) {
                orchestrators.playback.playNext?.(payload.track);
              }
              break;
            default:
              console.warn('[Mobile] Unknown remote command:', payload.command);
          }
        } catch (error) {
          console.error('[Mobile] Remote command error:', error);
        }
        break;

      case 'request-desktop-state':
        // Send current desktop playback state
        if (orchestrators?.playback) {
          const state = orchestrators.playback.getState?.();
          if (state) {
            socket.send(JSON.stringify({
              type: 'desktop-state',
              payload: state
            }));
          }
        }
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
export { PairingService } from './services/pairing-service';
export { P2PManager, type P2PPeer, type P2PConfig } from './services/p2p-manager';
export { AuthManager } from './services/auth-manager';
