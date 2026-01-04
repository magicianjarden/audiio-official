/**
 * Audiio Authentication Service
 *
 * Implements the Device Trust Model:
 * - Server identity (persistent X25519 key pair)
 * - QR code pairing for new devices
 * - Challenge-response authentication
 * - Device management (list, revoke)
 */

import nacl from 'tweetnacl';
import { encodeBase64, decodeBase64, decodeUTF8 } from 'tweetnacl-util';
import { randomBytes } from 'crypto';
import Database from 'better-sqlite3';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';

// ========================================
// Types
// ========================================

export interface ServerIdentity {
  publicKey: string;      // Base64
  secretKey: string;      // Base64
  serverId: string;       // First 8 chars of hash
  serverName: string;
}

export interface TrustedDevice {
  deviceId: string;
  publicKey: string;
  deviceName: string;
  deviceType: 'mobile' | 'desktop' | 'web';
  trustedAt: number;
  lastSeen: number;
  lastIp?: string;
}

export interface PairingToken {
  token: string;
  expiresAt: number;
}

export interface PairingQRData {
  serverId: string;
  serverPublicKey: string;
  serverName: string;
  pairingToken: string;
  localUrl?: string;
  relayUrl?: string;
  version: number;
}

export interface SessionToken {
  token: string;
  deviceId: string;
  expiresAt: number;
}

// ========================================
// Constants
// ========================================

const PAIRING_TOKEN_EXPIRY_MS = 5 * 60 * 1000;  // 5 minutes
const SESSION_TOKEN_EXPIRY_MS = 30 * 24 * 60 * 60 * 1000;  // 30 days
const CHALLENGE_EXPIRY_MS = 60 * 1000;  // 1 minute

// ========================================
// Auth Service
// ========================================

export class AuthService {
  private db: Database.Database;
  private identity: ServerIdentity;
  private dataDir: string;
  private pendingPairings = new Map<string, PairingToken>();
  private pendingChallenges = new Map<string, { challenge: string; expiresAt: number }>();
  private sessions = new Map<string, SessionToken>();

  constructor(dataDir: string, serverName?: string) {
    this.dataDir = dataDir;
    // Ensure data directory exists
    if (!existsSync(dataDir)) {
      mkdirSync(dataDir, { recursive: true });
    }

    // Initialize database
    const dbPath = join(dataDir, 'auth.db');
    this.db = new Database(dbPath);
    this.initDatabase();

    // Load or create server identity
    this.identity = this.loadOrCreateIdentity(dataDir, serverName || 'Audiio Server');

    console.log(`[Auth] Server ID: ${this.identity.serverId}`);
    console.log(`[Auth] Server Name: ${this.identity.serverName}`);
  }

  // ========================================
  // Server Identity
  // ========================================

  private loadOrCreateIdentity(dataDir: string, defaultName: string): ServerIdentity {
    const identityPath = join(dataDir, 'server-identity.json');

    if (existsSync(identityPath)) {
      try {
        const data = JSON.parse(readFileSync(identityPath, 'utf-8'));
        console.log('[Auth] Loaded existing server identity');
        return data;
      } catch (err) {
        console.error('[Auth] Failed to load identity, creating new one');
      }
    }

    // Generate new identity
    const keyPair = nacl.box.keyPair();
    const publicKey = encodeBase64(keyPair.publicKey);
    const secretKey = encodeBase64(keyPair.secretKey);
    const serverId = this.fingerprint(publicKey);

    const identity: ServerIdentity = {
      publicKey,
      secretKey,
      serverId,
      serverName: defaultName
    };

    // Save to disk
    writeFileSync(identityPath, JSON.stringify(identity, null, 2));
    console.log('[Auth] Created new server identity');

    return identity;
  }

  /**
   * Get the server's public identity (safe to share)
   */
  getPublicIdentity() {
    return {
      serverId: this.identity.serverId,
      serverName: this.identity.serverName,
      publicKey: this.identity.publicKey
    };
  }

  /**
   * Update server name (persists to disk)
   */
  updateServerName(name: string): void {
    this.identity.serverName = name;
    this.saveIdentityToDisk();
  }

  /**
   * Save identity to disk
   */
  private saveIdentityToDisk(): void {
    const identityPath = join(this.dataDir, 'server-identity.json');
    writeFileSync(identityPath, JSON.stringify(this.identity, null, 2));
    console.log(`[Auth] Updated server name to: ${this.identity.serverName}`);
  }

  // ========================================
  // Pairing
  // ========================================

  /**
   * Generate a pairing token for QR code
   */
  createPairingToken(options?: {
    localUrl?: string;
    relayUrl?: string;
  }): { token: PairingToken; qrData: PairingQRData } {
    const token = this.generateToken(32);
    const expiresAt = Date.now() + PAIRING_TOKEN_EXPIRY_MS;

    const pairingToken: PairingToken = { token, expiresAt };
    this.pendingPairings.set(token, pairingToken);

    const qrData: PairingQRData = {
      serverId: this.identity.serverId,
      serverPublicKey: this.identity.publicKey,
      serverName: this.identity.serverName,
      pairingToken: token,
      localUrl: options?.localUrl,
      relayUrl: options?.relayUrl,
      version: 1
    };

    // Cleanup expired tokens
    this.cleanupExpiredPairings();

    console.log(`[Auth] Created pairing token (expires in 5 min)`);
    return { token: pairingToken, qrData };
  }

  /**
   * Complete device pairing
   */
  pairDevice(params: {
    pairingToken: string;
    deviceId: string;
    devicePublicKey: string;
    deviceName: string;
    deviceType?: 'mobile' | 'desktop' | 'web';
    ip?: string;
  }): { success: boolean; error?: string; sessionToken?: string } {
    const pending = this.pendingPairings.get(params.pairingToken);

    if (!pending) {
      return { success: false, error: 'Invalid pairing token' };
    }

    if (Date.now() > pending.expiresAt) {
      this.pendingPairings.delete(params.pairingToken);
      return { success: false, error: 'Pairing token expired' };
    }

    // Validate the device's public key
    if (!this.isValidPublicKey(params.devicePublicKey)) {
      return { success: false, error: 'Invalid device public key' };
    }

    // Verify deviceId matches the public key
    const expectedDeviceId = this.fingerprint(params.devicePublicKey);
    if (params.deviceId !== expectedDeviceId) {
      return { success: false, error: 'Device ID does not match public key' };
    }

    // Check if device already trusted
    const existing = this.getDevice(params.deviceId);
    if (existing) {
      // Update existing device
      this.updateDeviceLastSeen(params.deviceId, params.ip);
      const sessionToken = this.createSession(params.deviceId);
      this.pendingPairings.delete(params.pairingToken);
      return { success: true, sessionToken };
    }

    // Store trusted device
    const device: TrustedDevice = {
      deviceId: params.deviceId,
      publicKey: params.devicePublicKey,
      deviceName: params.deviceName,
      deviceType: params.deviceType || 'mobile',
      trustedAt: Date.now(),
      lastSeen: Date.now(),
      lastIp: params.ip
    };

    this.addDevice(device);
    this.pendingPairings.delete(params.pairingToken);

    // Create session
    const sessionToken = this.createSession(params.deviceId);

    console.log(`[Auth] Paired device: ${params.deviceName} (${params.deviceId})`);
    return { success: true, sessionToken };
  }

  // ========================================
  // Challenge-Response Auth
  // ========================================

  /**
   * Generate a challenge for device authentication
   */
  createChallenge(deviceId: string): { success: boolean; challenge?: string; error?: string } {
    const device = this.getDevice(deviceId);
    if (!device) {
      return { success: false, error: 'Device not trusted' };
    }

    const challenge = this.generateToken(32);
    const expiresAt = Date.now() + CHALLENGE_EXPIRY_MS;

    this.pendingChallenges.set(deviceId, { challenge, expiresAt });

    return { success: true, challenge };
  }

  /**
   * Verify a signed challenge
   */
  verifyChallenge(params: {
    deviceId: string;
    signature: string;
    ip?: string;
  }): { success: boolean; sessionToken?: string; error?: string } {
    const pending = this.pendingChallenges.get(params.deviceId);
    if (!pending) {
      return { success: false, error: 'No challenge pending' };
    }

    if (Date.now() > pending.expiresAt) {
      this.pendingChallenges.delete(params.deviceId);
      return { success: false, error: 'Challenge expired' };
    }

    const device = this.getDevice(params.deviceId);
    if (!device) {
      return { success: false, error: 'Device not trusted' };
    }

    // Verify signature
    // Note: For simplicity, we use a MAC (encrypt challenge with shared secret)
    // A proper implementation would use Ed25519 signatures
    try {
      const devicePubKey = decodeBase64(device.publicKey);
      const serverSecKey = decodeBase64(this.identity.secretKey);

      // Compute shared secret
      const sharedSecret = nacl.box.before(devicePubKey, serverSecKey);

      // Expected signature = hash(challenge + sharedSecret)
      const expectedSig = this.hmac(pending.challenge, encodeBase64(sharedSecret));

      if (params.signature !== expectedSig) {
        return { success: false, error: 'Invalid signature' };
      }
    } catch (err) {
      return { success: false, error: 'Signature verification failed' };
    }

    this.pendingChallenges.delete(params.deviceId);
    this.updateDeviceLastSeen(params.deviceId, params.ip);

    const sessionToken = this.createSession(params.deviceId);
    return { success: true, sessionToken };
  }

  // ========================================
  // Session Management
  // ========================================

  /**
   * Create a session token for a device
   */
  private createSession(deviceId: string): string {
    const token = this.generateToken(48);
    const expiresAt = Date.now() + SESSION_TOKEN_EXPIRY_MS;

    this.sessions.set(token, { token, deviceId, expiresAt });
    return token;
  }

  /**
   * Validate a session token
   */
  validateSession(token: string): { valid: boolean; deviceId?: string } {
    const session = this.sessions.get(token);
    if (!session) {
      return { valid: false };
    }

    if (Date.now() > session.expiresAt) {
      this.sessions.delete(token);
      return { valid: false };
    }

    // Verify device is still trusted
    const device = this.getDevice(session.deviceId);
    if (!device) {
      this.sessions.delete(token);
      return { valid: false };
    }

    return { valid: true, deviceId: session.deviceId };
  }

  /**
   * Invalidate a session
   */
  revokeSession(token: string): void {
    this.sessions.delete(token);
  }

  // ========================================
  // Device Management
  // ========================================

  /**
   * Get all trusted devices
   */
  getDevices(): TrustedDevice[] {
    const stmt = this.db.prepare('SELECT * FROM trusted_devices ORDER BY lastSeen DESC');
    return stmt.all() as TrustedDevice[];
  }

  /**
   * Get a specific device
   */
  getDevice(deviceId: string): TrustedDevice | null {
    const stmt = this.db.prepare('SELECT * FROM trusted_devices WHERE deviceId = ?');
    return stmt.get(deviceId) as TrustedDevice | null;
  }

  /**
   * Check if a device is trusted
   */
  isDeviceTrusted(deviceId: string): boolean {
    return this.getDevice(deviceId) !== null;
  }

  /**
   * Add a trusted device
   */
  private addDevice(device: TrustedDevice): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO trusted_devices
      (deviceId, publicKey, deviceName, deviceType, trustedAt, lastSeen, lastIp)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      device.deviceId,
      device.publicKey,
      device.deviceName,
      device.deviceType,
      device.trustedAt,
      device.lastSeen,
      device.lastIp || null
    );
  }

  /**
   * Update device last seen timestamp
   */
  private updateDeviceLastSeen(deviceId: string, ip?: string): void {
    const stmt = this.db.prepare(`
      UPDATE trusted_devices SET lastSeen = ?, lastIp = COALESCE(?, lastIp)
      WHERE deviceId = ?
    `);
    stmt.run(Date.now(), ip || null, deviceId);
  }

  /**
   * Revoke a device (remove trust)
   */
  revokeDevice(deviceId: string): boolean {
    const stmt = this.db.prepare('DELETE FROM trusted_devices WHERE deviceId = ?');
    const result = stmt.run(deviceId);

    // Also revoke any sessions for this device
    for (const [token, session] of this.sessions) {
      if (session.deviceId === deviceId) {
        this.sessions.delete(token);
      }
    }

    console.log(`[Auth] Revoked device: ${deviceId}`);
    return result.changes > 0;
  }

  /**
   * Rename a device
   */
  renameDevice(deviceId: string, newName: string): boolean {
    const stmt = this.db.prepare('UPDATE trusted_devices SET deviceName = ? WHERE deviceId = ?');
    const result = stmt.run(newName, deviceId);
    return result.changes > 0;
  }

  // ========================================
  // Relay Integration
  // ========================================

  /**
   * Check if an incoming relay connection is from a trusted device
   */
  validateRelayConnection(params: {
    deviceId: string;
    devicePublicKey: string;
  }): { trusted: boolean; device?: TrustedDevice } {
    const device = this.getDevice(params.deviceId);
    if (!device) {
      return { trusted: false };
    }

    // Verify public key matches
    if (device.publicKey !== params.devicePublicKey) {
      return { trusted: false };
    }

    return { trusted: true, device };
  }

  // ========================================
  // Utilities
  // ========================================

  private initDatabase(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS trusted_devices (
        deviceId TEXT PRIMARY KEY,
        publicKey TEXT NOT NULL,
        deviceName TEXT NOT NULL,
        deviceType TEXT DEFAULT 'mobile',
        trustedAt INTEGER NOT NULL,
        lastSeen INTEGER NOT NULL,
        lastIp TEXT
      )
    `);
  }

  private generateToken(bytes: number): string {
    return randomBytes(bytes).toString('base64url');
  }

  private fingerprint(publicKey: string): string {
    const bytes = decodeUTF8(publicKey);
    const hash = nacl.hash(bytes);
    return encodeBase64(hash).substring(0, 8).toUpperCase();
  }

  private isValidPublicKey(publicKey: string): boolean {
    try {
      const decoded = decodeBase64(publicKey);
      return decoded.length === nacl.box.publicKeyLength;
    } catch {
      return false;
    }
  }

  private hmac(data: string, key: string): string {
    const dataBytes = decodeUTF8(data);
    const keyBytes = decodeBase64(key);
    const combined = new Uint8Array(dataBytes.length + keyBytes.length);
    combined.set(dataBytes);
    combined.set(keyBytes, dataBytes.length);
    const hash = nacl.hash(combined);
    return encodeBase64(hash).substring(0, 44);  // Base64 of first 32 bytes
  }

  private cleanupExpiredPairings(): void {
    const now = Date.now();
    for (const [token, pairing] of this.pendingPairings) {
      if (now > pairing.expiresAt) {
        this.pendingPairings.delete(token);
      }
    }
  }

  /**
   * Close the database connection
   */
  close(): void {
    this.db.close();
  }
}

// Singleton export for convenience
let authServiceInstance: AuthService | null = null;

export function getAuthService(): AuthService | null {
  return authServiceInstance;
}

export function initAuthService(dataDir: string, serverName?: string): AuthService {
  if (authServiceInstance) {
    return authServiceInstance;
  }
  authServiceInstance = new AuthService(dataDir, serverName);
  return authServiceInstance;
}
