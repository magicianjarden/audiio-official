/**
 * Plugin Router - Enables plugins to register custom HTTP routes
 *
 * All plugin routes are prefixed with /api/plugins/:pluginId/
 * Auth middleware is applied to all plugin routes automatically.
 */

import { FastifyInstance, FastifyRequest, FastifyReply, RouteOptions } from 'fastify';

// ========================================
// Types
// ========================================

export type PluginRouteMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

export interface PluginRouteHandler {
  method: PluginRouteMethod;
  path: string;                   // e.g., '/folders', '/scan/:id'
  handler: (request: PluginRequest, reply: PluginReply) => Promise<unknown>;
  schema?: RouteSchema;
  rateLimit?: { max: number; timeWindow: string };
  description?: string;
}

export interface PluginRequest {
  params: Record<string, string>;
  query: Record<string, string | undefined>;
  body: unknown;
  headers: Record<string, string | string[] | undefined>;
  ip: string;
  method: string;
  url: string;
  pluginId: string;
}

export interface PluginReply {
  code(statusCode: number): PluginReply;
  header(name: string, value: string): PluginReply;
  send(payload?: unknown): void;
  redirect(url: string): void;
}

export interface RouteSchema {
  body?: Record<string, unknown>;
  querystring?: Record<string, unknown>;
  params?: Record<string, unknown>;
  response?: Record<number, Record<string, unknown>>;
}

export interface RegisteredRoute {
  pluginId: string;
  method: PluginRouteMethod;
  path: string;
  fullPath: string;
  description?: string;
}

// ========================================
// Plugin Router Service
// ========================================

export class PluginRouter {
  private fastify: FastifyInstance;
  private registeredRoutes: Map<string, RegisteredRoute[]> = new Map();
  private routePrefix = '/api/plugins';

  constructor(fastify: FastifyInstance) {
    this.fastify = fastify;
  }

  /**
   * Register routes for a plugin
   */
  registerPlugin(pluginId: string, routes: PluginRouteHandler[]): void {
    if (routes.length === 0) return;

    const prefix = `${this.routePrefix}/${pluginId}`;
    const registeredRoutes: RegisteredRoute[] = [];

    for (const route of routes) {
      const fullPath = `${prefix}${route.path}`;

      try {
        const routeOptions: RouteOptions = {
          method: route.method,
          url: fullPath,
          handler: async (request: FastifyRequest, reply: FastifyReply) => {
            // Wrap request and reply for plugin
            const pluginRequest = this.wrapRequest(request, pluginId);
            const pluginReply = this.wrapReply(reply);

            try {
              const result = await route.handler(pluginRequest, pluginReply);
              // If handler returns a value and hasn't already sent response
              if (result !== undefined && !reply.sent) {
                return result;
              }
            } catch (error) {
              console.error(`[PluginRouter] Error in ${pluginId}${route.path}:`, error);
              if (!reply.sent) {
                reply.code(500).send({
                  error: 'Plugin route error',
                  message: error instanceof Error ? error.message : 'Unknown error'
                });
              }
            }
          }
        };

        // Add rate limiting if specified
        if (route.rateLimit) {
          routeOptions.config = {
            rateLimit: route.rateLimit
          };
        }

        // Add schema if specified
        if (route.schema) {
          routeOptions.schema = route.schema;
        }

        this.fastify.route(routeOptions);

        registeredRoutes.push({
          pluginId,
          method: route.method,
          path: route.path,
          fullPath,
          description: route.description
        });

        console.log(`[PluginRouter] Registered: ${route.method} ${fullPath}`);
      } catch (error) {
        console.error(`[PluginRouter] Failed to register ${route.method} ${fullPath}:`, error);
      }
    }

    this.registeredRoutes.set(pluginId, registeredRoutes);
  }

  /**
   * Unregister all routes for a plugin
   * Note: Fastify doesn't support route removal, so this just clears tracking
   * Full unregistration requires server restart
   */
  unregisterPlugin(pluginId: string): void {
    this.registeredRoutes.delete(pluginId);
    console.log(`[PluginRouter] Unregistered routes for: ${pluginId}`);
  }

  /**
   * Get all registered routes
   */
  getAllRoutes(): RegisteredRoute[] {
    const allRoutes: RegisteredRoute[] = [];
    for (const routes of this.registeredRoutes.values()) {
      allRoutes.push(...routes);
    }
    return allRoutes;
  }

  /**
   * Get routes for a specific plugin
   */
  getPluginRoutes(pluginId: string): RegisteredRoute[] {
    return this.registeredRoutes.get(pluginId) || [];
  }

  /**
   * Check if a plugin has registered routes
   */
  hasRoutes(pluginId: string): boolean {
    return this.registeredRoutes.has(pluginId);
  }

  /**
   * Wrap Fastify request for plugin consumption
   */
  private wrapRequest(request: FastifyRequest, pluginId: string): PluginRequest {
    return {
      params: request.params as Record<string, string>,
      query: request.query as Record<string, string | undefined>,
      body: request.body,
      headers: request.headers as Record<string, string | string[] | undefined>,
      ip: request.ip,
      method: request.method,
      url: request.url,
      pluginId
    };
  }

  /**
   * Wrap Fastify reply for plugin consumption
   */
  private wrapReply(reply: FastifyReply): PluginReply {
    return {
      code(statusCode: number) {
        reply.code(statusCode);
        return this;
      },
      header(name: string, value: string) {
        reply.header(name, value);
        return this;
      },
      send(payload?: unknown) {
        reply.send(payload);
      },
      redirect(url: string) {
        reply.redirect(url);
      }
    };
  }
}

// ========================================
// Plugin Route Helper
// ========================================

/**
 * Create a route handler with type safety
 */
export function createRoute<TBody = unknown, TParams = Record<string, string>, TQuery = Record<string, string>>(
  method: PluginRouteMethod,
  path: string,
  handler: (request: PluginRequest & { body: TBody; params: TParams; query: TQuery }, reply: PluginReply) => Promise<unknown>,
  options?: {
    description?: string;
    schema?: RouteSchema;
    rateLimit?: { max: number; timeWindow: string };
  }
): PluginRouteHandler {
  return {
    method,
    path,
    handler: handler as PluginRouteHandler['handler'],
    description: options?.description,
    schema: options?.schema,
    rateLimit: options?.rateLimit
  };
}

/**
 * Helper to create GET route
 */
export function get<TParams = Record<string, string>, TQuery = Record<string, string>>(
  path: string,
  handler: (request: PluginRequest & { params: TParams; query: TQuery }, reply: PluginReply) => Promise<unknown>,
  options?: { description?: string; schema?: RouteSchema }
): PluginRouteHandler {
  return createRoute('GET', path, handler as any, options);
}

/**
 * Helper to create POST route
 */
export function post<TBody = unknown, TParams = Record<string, string>>(
  path: string,
  handler: (request: PluginRequest & { body: TBody; params: TParams }, reply: PluginReply) => Promise<unknown>,
  options?: { description?: string; schema?: RouteSchema; rateLimit?: { max: number; timeWindow: string } }
): PluginRouteHandler {
  return createRoute('POST', path, handler as any, options);
}

/**
 * Helper to create PUT route
 */
export function put<TBody = unknown, TParams = Record<string, string>>(
  path: string,
  handler: (request: PluginRequest & { body: TBody; params: TParams }, reply: PluginReply) => Promise<unknown>,
  options?: { description?: string; schema?: RouteSchema }
): PluginRouteHandler {
  return createRoute('PUT', path, handler as any, options);
}

/**
 * Helper to create DELETE route
 */
export function del<TParams = Record<string, string>>(
  path: string,
  handler: (request: PluginRequest & { params: TParams }, reply: PluginReply) => Promise<unknown>,
  options?: { description?: string; schema?: RouteSchema }
): PluginRouteHandler {
  return createRoute('DELETE', path, handler as any, options);
}

/**
 * Helper to create PATCH route
 */
export function patch<TBody = unknown, TParams = Record<string, string>>(
  path: string,
  handler: (request: PluginRequest & { body: TBody; params: TParams }, reply: PluginReply) => Promise<unknown>,
  options?: { description?: string; schema?: RouteSchema }
): PluginRouteHandler {
  return createRoute('PATCH', path, handler as any, options);
}
