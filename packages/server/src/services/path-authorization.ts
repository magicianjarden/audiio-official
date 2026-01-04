/**
 * Path Authorization Service
 *
 * Manages authorized filesystem paths for plugins.
 * Similar to how Plex/Navidrome let users add media folders.
 *
 * Features:
 * - Store authorized paths per plugin
 * - Admin approval flow for new path requests
 * - Persistent storage in SQLite
 * - Path validation (exists, readable, not system dir)
 */

import Database from 'better-sqlite3';
import * as fs from 'fs/promises';
import * as path from 'path';

// ========================================
// Types
// ========================================

export interface AuthorizedPath {
  id: string;
  pluginId: string;
  path: string;
  name: string;
  permissions: 'read' | 'readwrite';
  addedAt: number;
  addedBy: string;  // 'admin' or 'plugin-request'
  status: 'active' | 'pending' | 'revoked';
  lastAccessed?: number;
}

export interface PathAuthorizationRequest {
  id: string;
  pluginId: string;
  path: string;
  permissions: 'read' | 'readwrite';
  requestedAt: number;
  reason?: string;
  status: 'pending' | 'approved' | 'denied';
  reviewedAt?: number;
}

export interface AddPathOptions {
  pluginId: string;
  path: string;
  name?: string;
  permissions?: 'read' | 'readwrite';
  addedBy?: string;
}

// Forbidden paths that should never be authorized
const FORBIDDEN_PATHS_UNIX = [
  '/etc', '/sys', '/proc', '/dev', '/boot', '/root',
  '/usr/bin', '/usr/sbin', '/bin', '/sbin',
  '/var/run', '/var/lock'
];

const FORBIDDEN_PATHS_WINDOWS = [
  'C:\\Windows', 'C:\\Program Files', 'C:\\Program Files (x86)',
  'C:\\ProgramData', 'C:\\System Volume Information',
  'C:\\$Recycle.Bin'
];

// ========================================
// Path Authorization Service
// ========================================

export class PathAuthorizationService {
  private db: Database.Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.initSchema();
  }

  private initSchema(): void {
    this.db.exec(`
      -- Authorized paths table
      CREATE TABLE IF NOT EXISTS authorized_paths (
        id TEXT PRIMARY KEY,
        plugin_id TEXT NOT NULL,
        path TEXT NOT NULL,
        name TEXT NOT NULL,
        permissions TEXT NOT NULL DEFAULT 'read',
        added_at INTEGER NOT NULL,
        added_by TEXT NOT NULL DEFAULT 'admin',
        status TEXT NOT NULL DEFAULT 'active',
        last_accessed INTEGER,
        UNIQUE(plugin_id, path)
      );

      -- Path authorization requests (for admin approval)
      CREATE TABLE IF NOT EXISTS path_requests (
        id TEXT PRIMARY KEY,
        plugin_id TEXT NOT NULL,
        path TEXT NOT NULL,
        permissions TEXT NOT NULL DEFAULT 'read',
        requested_at INTEGER NOT NULL,
        reason TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        reviewed_at INTEGER,
        UNIQUE(plugin_id, path, status)
      );

      -- Indexes
      CREATE INDEX IF NOT EXISTS idx_paths_plugin ON authorized_paths(plugin_id);
      CREATE INDEX IF NOT EXISTS idx_paths_status ON authorized_paths(status);
      CREATE INDEX IF NOT EXISTS idx_requests_status ON path_requests(status);
    `);
  }

  close(): void {
    this.db.close();
  }

  // ========================================
  // Path Management
  // ========================================

  /**
   * Add an authorized path for a plugin
   */
  async addPath(options: AddPathOptions): Promise<{ success: boolean; path?: AuthorizedPath; error?: string }> {
    const { pluginId, path: folderPath, name, permissions = 'read', addedBy = 'admin' } = options;

    // Validate path
    const validation = await this.validatePath(folderPath);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    // Check if already exists
    const existing = this.getPathByPluginAndPath(pluginId, folderPath);
    if (existing) {
      if (existing.status === 'revoked') {
        // Reactivate revoked path
        this.updatePathStatus(existing.id, 'active');
        return { success: true, path: { ...existing, status: 'active' } };
      }
      return { success: false, error: 'Path already authorized' };
    }

    const id = this.generateId();
    const pathName = name || path.basename(folderPath);

    const authorizedPath: AuthorizedPath = {
      id,
      pluginId,
      path: folderPath,
      name: pathName,
      permissions,
      addedAt: Date.now(),
      addedBy,
      status: 'active'
    };

    this.db.prepare(`
      INSERT INTO authorized_paths (id, plugin_id, path, name, permissions, added_at, added_by, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, pluginId, folderPath, pathName, permissions, authorizedPath.addedAt, addedBy, 'active');

    console.log(`[PathAuth] Added path for ${pluginId}: ${folderPath} (${permissions})`);

    return { success: true, path: authorizedPath };
  }

  /**
   * Remove/revoke an authorized path
   */
  revokePath(pathId: string): boolean {
    const result = this.db.prepare(`
      UPDATE authorized_paths SET status = 'revoked' WHERE id = ?
    `).run(pathId);

    return result.changes > 0;
  }

  /**
   * Permanently delete an authorized path
   */
  deletePath(pathId: string): boolean {
    const result = this.db.prepare(`
      DELETE FROM authorized_paths WHERE id = ?
    `).run(pathId);

    return result.changes > 0;
  }

  /**
   * Get all authorized paths for a plugin
   */
  getPathsForPlugin(pluginId: string, includeRevoked = false): AuthorizedPath[] {
    const sql = includeRevoked
      ? `SELECT * FROM authorized_paths WHERE plugin_id = ?`
      : `SELECT * FROM authorized_paths WHERE plugin_id = ? AND status = 'active'`;

    const rows = this.db.prepare(sql).all(pluginId) as any[];
    return rows.map(this.rowToPath);
  }

  /**
   * Get all authorized paths
   */
  getAllPaths(includeRevoked = false): AuthorizedPath[] {
    const sql = includeRevoked
      ? `SELECT * FROM authorized_paths ORDER BY plugin_id, path`
      : `SELECT * FROM authorized_paths WHERE status = 'active' ORDER BY plugin_id, path`;

    const rows = this.db.prepare(sql).all() as any[];
    return rows.map(this.rowToPath);
  }

  /**
   * Check if a plugin can access a specific path
   */
  canAccess(pluginId: string, targetPath: string, write = false): boolean {
    const authorizedPaths = this.getPathsForPlugin(pluginId);

    // Normalize the target path
    const normalizedTarget = path.resolve(targetPath).toLowerCase();

    for (const auth of authorizedPaths) {
      const normalizedAuth = path.resolve(auth.path).toLowerCase();

      // Check if target is within authorized path
      if (normalizedTarget.startsWith(normalizedAuth)) {
        // Check permissions
        if (write && auth.permissions !== 'readwrite') {
          continue;  // Need write but only have read
        }
        return true;
      }
    }

    return false;
  }

  /**
   * Get the list of allowed paths for sandbox injection
   */
  getAllowedPathsForSandbox(pluginId: string): string[] {
    return this.getPathsForPlugin(pluginId).map(p => p.path);
  }

  /**
   * Update last accessed timestamp
   */
  recordAccess(pathId: string): void {
    this.db.prepare(`
      UPDATE authorized_paths SET last_accessed = ? WHERE id = ?
    `).run(Date.now(), pathId);
  }

  // ========================================
  // Path Requests (Plugin-initiated)
  // ========================================

  /**
   * Create a path authorization request from a plugin
   */
  requestPathAccess(pluginId: string, folderPath: string, permissions: 'read' | 'readwrite' = 'read', reason?: string): PathAuthorizationRequest {
    const id = this.generateId();

    const request: PathAuthorizationRequest = {
      id,
      pluginId,
      path: folderPath,
      permissions,
      requestedAt: Date.now(),
      reason,
      status: 'pending'
    };

    this.db.prepare(`
      INSERT OR REPLACE INTO path_requests (id, plugin_id, path, permissions, requested_at, reason, status)
      VALUES (?, ?, ?, ?, ?, ?, 'pending')
    `).run(id, pluginId, folderPath, permissions, request.requestedAt, reason);

    console.log(`[PathAuth] New path request from ${pluginId}: ${folderPath}`);

    return request;
  }

  /**
   * Get pending path requests
   */
  getPendingRequests(): PathAuthorizationRequest[] {
    const rows = this.db.prepare(`
      SELECT * FROM path_requests WHERE status = 'pending' ORDER BY requested_at DESC
    `).all() as any[];

    return rows.map(this.rowToRequest);
  }

  /**
   * Approve a path request
   */
  async approveRequest(requestId: string): Promise<{ success: boolean; error?: string }> {
    const request = this.db.prepare(`
      SELECT * FROM path_requests WHERE id = ?
    `).get(requestId) as any;

    if (!request) {
      return { success: false, error: 'Request not found' };
    }

    if (request.status !== 'pending') {
      return { success: false, error: 'Request already processed' };
    }

    // Add the path
    const result = await this.addPath({
      pluginId: request.plugin_id,
      path: request.path,
      permissions: request.permissions,
      addedBy: 'plugin-request'
    });

    if (!result.success) {
      return result;
    }

    // Update request status
    this.db.prepare(`
      UPDATE path_requests SET status = 'approved', reviewed_at = ? WHERE id = ?
    `).run(Date.now(), requestId);

    return { success: true };
  }

  /**
   * Deny a path request
   */
  denyRequest(requestId: string): boolean {
    const result = this.db.prepare(`
      UPDATE path_requests SET status = 'denied', reviewed_at = ? WHERE id = ?
    `).run(Date.now(), requestId);

    return result.changes > 0;
  }

  // ========================================
  // Validation
  // ========================================

  /**
   * Validate a path for authorization
   */
  async validatePath(folderPath: string): Promise<{ valid: boolean; error?: string }> {
    // Normalize path
    const normalizedPath = path.resolve(folderPath);

    // Check forbidden paths
    const isWindows = process.platform === 'win32';
    const forbiddenPaths = isWindows ? FORBIDDEN_PATHS_WINDOWS : FORBIDDEN_PATHS_UNIX;

    for (const forbidden of forbiddenPaths) {
      const normalizedForbidden = path.resolve(forbidden).toLowerCase();
      if (normalizedPath.toLowerCase().startsWith(normalizedForbidden)) {
        return { valid: false, error: `Access to system path ${forbidden} is forbidden` };
      }
    }

    // Check path exists
    try {
      const stats = await fs.stat(normalizedPath);
      if (!stats.isDirectory()) {
        return { valid: false, error: 'Path is not a directory' };
      }
    } catch {
      return { valid: false, error: 'Path does not exist or is not accessible' };
    }

    // Check readable
    try {
      await fs.access(normalizedPath, fs.constants.R_OK);
    } catch {
      return { valid: false, error: 'Path is not readable' };
    }

    return { valid: true };
  }

  // ========================================
  // Helpers
  // ========================================

  private getPathByPluginAndPath(pluginId: string, folderPath: string): AuthorizedPath | null {
    const row = this.db.prepare(`
      SELECT * FROM authorized_paths WHERE plugin_id = ? AND path = ?
    `).get(pluginId, folderPath) as any;

    return row ? this.rowToPath(row) : null;
  }

  private updatePathStatus(pathId: string, status: AuthorizedPath['status']): void {
    this.db.prepare(`
      UPDATE authorized_paths SET status = ? WHERE id = ?
    `).run(status, pathId);
  }

  private generateId(): string {
    return `path_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  private rowToPath(row: any): AuthorizedPath {
    return {
      id: row.id,
      pluginId: row.plugin_id,
      path: row.path,
      name: row.name,
      permissions: row.permissions,
      addedAt: row.added_at,
      addedBy: row.added_by,
      status: row.status,
      lastAccessed: row.last_accessed
    };
  }

  private rowToRequest(row: any): PathAuthorizationRequest {
    return {
      id: row.id,
      pluginId: row.plugin_id,
      path: row.path,
      permissions: row.permissions,
      requestedAt: row.requested_at,
      reason: row.reason,
      status: row.status,
      reviewedAt: row.reviewed_at
    };
  }
}

// ========================================
// Singleton Instance
// ========================================

let pathAuthService: PathAuthorizationService | null = null;

export function initPathAuthService(dbPath: string): PathAuthorizationService {
  if (!pathAuthService) {
    pathAuthService = new PathAuthorizationService(dbPath);
  }
  return pathAuthService;
}

export function getPathAuthService(): PathAuthorizationService | null {
  return pathAuthService;
}
