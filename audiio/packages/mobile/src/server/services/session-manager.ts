/**
 * Session Manager - Tracks connected mobile clients
 *
 * Manages active sessions, tracks device info, and handles
 * session lifecycle for connected mobile clients.
 */

import { nanoid } from 'nanoid';
import type { MobileSession } from '../../shared/types';

export class SessionManager {
  private sessions = new Map<string, MobileSession>();
  private sessionsByToken = new Map<string, Set<string>>();

  /** Max inactive time before session is considered stale (5 minutes) */
  private readonly INACTIVE_TIMEOUT = 5 * 60 * 1000;

  /**
   * Create a new session for a connected client
   */
  createSession(token: string, userAgent?: string, deviceName?: string): MobileSession {
    const session: MobileSession = {
      id: nanoid(16),
      token,
      deviceName: deviceName || this.parseDeviceName(userAgent),
      userAgent,
      connectedAt: Date.now(),
      lastActivity: Date.now(),
      isActive: true
    };

    this.sessions.set(session.id, session);

    // Track session by token
    if (!this.sessionsByToken.has(token)) {
      this.sessionsByToken.set(token, new Set());
    }
    this.sessionsByToken.get(token)!.add(session.id);

    return session;
  }

  /**
   * Update last activity time for a session
   */
  updateActivity(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.lastActivity = Date.now();
      session.isActive = true;
    }
  }

  /**
   * Mark a session as ended
   */
  endSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.isActive = false;
      this.sessions.delete(sessionId);

      // Remove from token tracking
      const tokenSessions = this.sessionsByToken.get(session.token);
      if (tokenSessions) {
        tokenSessions.delete(sessionId);
        if (tokenSessions.size === 0) {
          this.sessionsByToken.delete(session.token);
        }
      }
    }
  }

  /**
   * Get a session by ID
   */
  getSession(sessionId: string): MobileSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Get all sessions for a token
   */
  getSessionsForToken(token: string): MobileSession[] {
    const sessionIds = this.sessionsByToken.get(token);
    if (!sessionIds) return [];

    return Array.from(sessionIds)
      .map(id => this.sessions.get(id))
      .filter((s): s is MobileSession => s !== undefined);
  }

  /**
   * Get all active sessions
   */
  getAllSessions(): MobileSession[] {
    return Array.from(this.sessions.values());
  }

  /**
   * Get active session count
   */
  getActiveCount(): number {
    return Array.from(this.sessions.values()).filter(s => s.isActive).length;
  }

  /**
   * Clean up stale sessions
   */
  cleanupStale(): number {
    const now = Date.now();
    let cleaned = 0;

    for (const [id, session] of this.sessions) {
      if (now - session.lastActivity > this.INACTIVE_TIMEOUT) {
        this.endSession(id);
        cleaned++;
      }
    }

    return cleaned;
  }

  /**
   * End all sessions for a token (e.g., when token is revoked)
   */
  endSessionsForToken(token: string): void {
    const sessionIds = this.sessionsByToken.get(token);
    if (sessionIds) {
      for (const id of sessionIds) {
        this.endSession(id);
      }
    }
  }

  /**
   * Parse device name from user agent
   */
  private parseDeviceName(userAgent?: string): string {
    if (!userAgent) return 'Unknown Device';

    // Simple device detection
    if (userAgent.includes('iPhone')) return 'iPhone';
    if (userAgent.includes('iPad')) return 'iPad';
    if (userAgent.includes('Android')) {
      const match = userAgent.match(/Android.*?;\s*([^)]+)/);
      return match?.[1]?.trim() ?? 'Android Device';
    }
    if (userAgent.includes('Windows')) return 'Windows Browser';
    if (userAgent.includes('Mac')) return 'Mac Browser';
    if (userAgent.includes('Linux')) return 'Linux Browser';

    return 'Web Browser';
  }
}
