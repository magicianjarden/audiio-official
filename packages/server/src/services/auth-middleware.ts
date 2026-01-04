/**
 * Authentication Middleware for Audiio Server
 *
 * Protects API routes by requiring valid session tokens.
 * Supports multiple authentication methods:
 * - Session token in Authorization header
 * - Device ID + challenge-response for trusted devices
 * - No auth for public routes (health, admin UI)
 */

import { FastifyRequest, FastifyReply, FastifyInstance } from 'fastify';
import { getAuthService } from './auth-service';

// Routes that don't require authentication
const PUBLIC_ROUTES = [
  '/',
  '/audiio',
  '/audiio/*',
  '/health',
  '/api/info',
  '/api/auth/*',
  '/api/discovery/*',
  '/api/settings/*',
  '/api/plugins/*',
  '/api/addons/*',
  '/api/stats/*',
  '/api/algo/*',
  '/api/tracking/*',
  '/api/library/*',
  '/api/search',
  '/api/stream/*',
  '/api/trending',
  '/api/artist/*',
  '/api/album/*',
  '/api/discover',
  '/api/discover/*',
  '/api/lyrics',
  '/api/enrichment/*'
];

// Check if a route is public
function isPublicRoute(url: string): boolean {
  // Remove query string for matching
  const path = url.split('?')[0];

  // Exact match
  if (PUBLIC_ROUTES.includes(path)) {
    return true;
  }

  // Wildcard match
  for (const route of PUBLIC_ROUTES) {
    if (route.endsWith('/*')) {
      const prefix = route.slice(0, -2);
      if (path.startsWith(prefix)) {
        return true;
      }
    }
  }

  return false;
}

// Extended request type
interface AuthenticatedRequest extends FastifyRequest {
  deviceId?: string;
  sessionToken?: string;
}

/**
 * Session authentication hook
 */
async function authHook(request: AuthenticatedRequest, reply: FastifyReply): Promise<void> {
  const authService = getAuthService();

  // Skip auth for public routes
  if (isPublicRoute(request.url)) {
    return;
  }

  // Skip auth if service not initialized
  if (!authService) {
    console.warn('[Auth] Auth service not initialized, allowing request');
    return;
  }

  // Check Authorization header for session token
  const authHeader = request.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    const result = authService.validateSession(token);

    if (result.valid) {
      request.sessionToken = token;
      request.deviceId = result.deviceId;
      return;
    }
  }

  // Check for device ID in custom header (for trusted devices)
  const deviceId = request.headers['x-device-id'] as string;
  if (deviceId && authService.isDeviceTrusted(deviceId)) {
    request.deviceId = deviceId;
    return;
  }

  // No valid auth found
  reply.code(401).send({
    error: 'Unauthorized',
    message: 'Valid session token or trusted device required'
  });
}

/**
 * Register auth middleware on a Fastify instance
 */
export function registerAuthMiddleware(fastify: FastifyInstance, options?: {
  enforceAuth?: boolean;  // If false, only logs warnings instead of rejecting
}): void {
  const enforceAuth = options?.enforceAuth ?? false;  // Default to not enforcing during development

  fastify.addHook('preHandler', async (request: AuthenticatedRequest, reply) => {
    const authService = getAuthService();

    // Skip auth for public routes
    if (isPublicRoute(request.url)) {
      return;
    }

    // Skip if auth service not initialized
    if (!authService) {
      if (enforceAuth) {
        reply.code(500).send({ error: 'Auth service not available' });
      }
      return;
    }

    // Check Authorization header for session token
    const authHeader = request.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      const result = authService.validateSession(token);

      if (result.valid) {
        request.sessionToken = token;
        request.deviceId = result.deviceId;
        return;
      }
    }

    // Check for device ID in custom header (for trusted devices)
    const deviceId = request.headers['x-device-id'] as string;
    if (deviceId && authService.isDeviceTrusted(deviceId)) {
      request.deviceId = deviceId;
      return;
    }

    // No valid auth found
    if (enforceAuth) {
      reply.code(401).send({
        error: 'Unauthorized',
        message: 'Valid session token or trusted device required'
      });
    } else {
      // Log warning but allow request (for development)
      console.log(`[Auth] Unauthenticated request to ${request.url} from ${request.ip}`);
    }
  });

  console.log(`[Auth] Middleware registered (enforceAuth: ${enforceAuth})`);
}

/**
 * Decorator to require auth on specific routes
 */
export function requireAuth(fastify: FastifyInstance): void {
  fastify.decorateRequest('deviceId', '');
  fastify.decorateRequest('sessionToken', '');

  fastify.addHook('preHandler', authHook);
}
