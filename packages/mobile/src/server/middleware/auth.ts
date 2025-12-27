/**
 * Authentication Middleware
 *
 * Validates access tokens for all API requests.
 * Tokens can be provided via query param or Authorization header.
 */

import type { FastifyRequest, FastifyReply, HookHandlerDoneFunction } from 'fastify';
import type { AccessManager } from '../services/access-manager';
import type { SessionManager } from '../services/session-manager';

/** Routes that don't require authentication */
const PUBLIC_ROUTES = [
  '/health',
  '/api/health',
  '/',
  '/index.html',
  '/favicon.ico'
];

/** Static file extensions that don't require auth */
const STATIC_EXTENSIONS = ['.js', '.css', '.png', '.jpg', '.svg', '.woff', '.woff2', '.ttf', '.html', '.ico', '.json', '.map'];

/** Path prefixes that are always allowed (static assets) */
const PUBLIC_PREFIXES = ['/assets/'];

export function authMiddleware(
  accessManager: AccessManager,
  _sessionManager: SessionManager
) {
  return function authenticate(
    request: FastifyRequest,
    reply: FastifyReply,
    done: HookHandlerDoneFunction
  ) {
    const url = request.url;
    const pathname = new URL(url, `http://${request.headers.host}`).pathname;

    console.log(`[Auth] Request: ${pathname}`);

    // Allow public routes
    if (PUBLIC_ROUTES.includes(pathname)) {
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

    // Extract token from query param or header
    const queryToken = (request.query as Record<string, string>).token;
    const headerToken = extractBearerToken(request.headers.authorization);
    const token = queryToken || headerToken;

    if (!token) {
      reply.code(401).send({
        error: 'Unauthorized',
        message: 'Access token required'
      });
      return;
    }

    if (!accessManager.validateToken(token)) {
      reply.code(401).send({
        error: 'Unauthorized',
        message: 'Invalid or expired access token'
      });
      return;
    }

    // Attach token to request for later use
    (request as any).accessToken = token;

    done();
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
