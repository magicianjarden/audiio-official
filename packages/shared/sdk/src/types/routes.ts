/**
 * Plugin Route Types
 *
 * Types for plugins that register custom HTTP routes.
 * Routes are automatically prefixed with /api/plugins/:pluginId/
 */

export type PluginRouteMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

/**
 * Plugin route handler definition
 */
export interface PluginRouteHandler {
  /** HTTP method */
  method: PluginRouteMethod;
  /** Route path (e.g., '/folders', '/scan/:id') */
  path: string;
  /** Route handler function */
  handler: (request: PluginRouteRequest, reply: PluginRouteReply) => Promise<unknown>;
  /** Optional JSON schema for validation */
  schema?: PluginRouteSchema;
  /** Optional rate limiting */
  rateLimit?: { max: number; timeWindow: string };
  /** Route description for documentation */
  description?: string;
}

/**
 * Request object passed to plugin route handlers
 */
export interface PluginRouteRequest {
  /** URL path parameters */
  params: Record<string, string>;
  /** URL query parameters */
  query: Record<string, string | undefined>;
  /** Request body (parsed JSON) */
  body: unknown;
  /** Request headers */
  headers: Record<string, string | string[] | undefined>;
  /** Client IP address */
  ip: string;
  /** HTTP method */
  method: string;
  /** Request URL */
  url: string;
  /** Plugin ID that owns this route */
  pluginId: string;
}

/**
 * Reply object for sending responses
 */
export interface PluginRouteReply {
  /** Set HTTP status code */
  code(statusCode: number): PluginRouteReply;
  /** Set response header */
  header(name: string, value: string): PluginRouteReply;
  /** Send response */
  send(payload?: unknown): void;
  /** Redirect to URL */
  redirect(url: string): void;
}

/**
 * JSON schema for route validation
 */
export interface PluginRouteSchema {
  body?: Record<string, unknown>;
  querystring?: Record<string, unknown>;
  params?: Record<string, unknown>;
  response?: Record<number, Record<string, unknown>>;
}

/**
 * Interface for plugins that provide custom routes
 */
export interface PluginWithRoutes {
  /**
   * Get routes to register for this plugin
   * Routes are automatically prefixed with /api/plugins/:pluginId/
   */
  getRoutes?(): PluginRouteHandler[];
}

/**
 * Registered route information
 */
export interface RegisteredPluginRoute {
  pluginId: string;
  method: PluginRouteMethod;
  path: string;
  fullPath: string;
  description?: string;
}
