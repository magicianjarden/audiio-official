/**
 * Authentication Middleware
 *
 * Validates access tokens for all API requests.
 * Tokens can be provided via query param or Authorization header.
 * Supports both legacy session tokens and new device tokens.
 */

import type { FastifyRequest, FastifyReply, HookHandlerDoneFunction } from 'fastify';
import type { AccessManager } from '../services/access-manager';
import type { SessionManager } from '../services/session-manager';
import type { PairingService } from '../services/pairing-service';

/** Routes that don't require authentication */
const PUBLIC_ROUTES = [
  '/health',
  '/api/health',
  '/',
  '/index.html',
  '/favicon.ico',
  // Auth routes - these handle their own validation
  '/api/auth/pair',
  '/api/auth/pair/check',
  '/api/auth/login',
  '/api/auth/device'
];

/** Static file extensions that don't require auth */
const STATIC_EXTENSIONS = ['.js', '.css', '.png', '.jpg', '.svg', '.woff', '.woff2', '.ttf', '.html', '.ico', '.json', '.map'];

/** Path prefixes that are always allowed (static assets) */
const PUBLIC_PREFIXES = ['/assets/'];

export function authMiddleware(
  accessManager: AccessManager,
  _sessionManager: SessionManager,
  pairingService?: PairingService
) {
  return function authenticate(
    request: FastifyRequest,
    reply: FastifyReply,
    done: HookHandlerDoneFunction
  ) {
    const url = request.url;
    const pathname = new URL(url, `http://${request.headers.host || 'localhost'}`).pathname;

    console.log(`[Auth] Request URL: ${url}, Pathname: ${pathname}`);
    console.log(`[Auth] Headers: x-p2p-request=${request.headers['x-p2p-request']}, host=${request.headers.host}`);

    // Allow public routes
    const isPublicRoute = PUBLIC_ROUTES.includes(pathname);
    console.log(`[Auth] Public route check: ${pathname} in PUBLIC_ROUTES = ${isPublicRoute}`);
    if (isPublicRoute) {
      console.log(`[Auth] Allowed (public route): ${pathname}`);
      return done();
    }

    // Allow public prefixes (static assets)
    if (PUBLIC_PREFIXES.some(prefix => pathname.startsWith(prefix))) {
      console.log(`[Auth] Allowed (public prefix): ${pathname}`);
      return done();
    }

    // Allow static files by extension
    if (STATIC_EXTENSIONS.some(ext => pathname.endsWith(ext))) {
      console.log(`[Auth] Allowed (static file): ${pathname}`);
      return done();
    }

    // Allow SPA routes (non-API paths without file extensions)
    // These will be handled by the index.html fallback
    if (!pathname.startsWith('/api/') && !pathname.startsWith('/ws') && !pathname.includes('.')) {
      console.log(`[Auth] Allowed (SPA route): ${pathname}`);
      return done();
    }

    // Allow P2P requests (authenticated via relay E2E encryption)
    const p2pHeader = request.headers['x-p2p-request'];
    console.log(`[Auth] P2P header check: "${p2pHeader}" (type: ${typeof p2pHeader})`);
    if (p2pHeader === 'true') {
      console.log(`[Auth] Allowed (P2P request): ${pathname}`);
      return done();
    }

    // Extract token from query param or header
    const queryToken = (request.query as Record<string, string>).token;
    const headerToken = extractBearerToken(request.headers.authorization);
    const token = queryToken || headerToken;

    if (!token) {
      console.log(`[Auth] REJECTED - no token and no P2P header for: ${pathname}`);
      console.log(`[Auth] All headers:`, JSON.stringify(Object.keys(request.headers)));
      reply.code(401).send({
        error: 'Unauthorized',
        message: 'Access token required'
      });
      return;
    }

    // Try legacy access token first
    if (accessManager.validateToken(token)) {
      console.log(`[Auth] Allowed (access token): ${pathname}`);
      (request as any).accessToken = token;
      return done();
    }

    // Try device token (from pairing) - format: deviceId:token or just token
    if (pairingService) {
      // Token could be just the token part, or deviceId:token format
      const deviceTokenResult = pairingService.validateDeviceToken(token);
      if (deviceTokenResult.valid) {
        console.log(`[Auth] Allowed (device token): ${pathname}`);
        (request as any).accessToken = token;
        (request as any).deviceId = deviceTokenResult.deviceId;
        return done();
      }
    }

    console.log(`[Auth] Rejected (invalid token): ${pathname}`);
    reply.code(401).send({
      error: 'Unauthorized',
      message: 'Invalid or expired access token'
    });
  };
}

/**
 * Extract bearer token from Authorization header
 */
function extractBearerToken(authHeader?: string): string | null {
  if (!authHeader) return null;

  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? null;
}
